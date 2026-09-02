'use strict';

const path = require('path');
const { Worker } = require('worker_threads');

const MAX_RESPONSE_BYTES = Number(process.env.MYSQL_SYNC_BUFFER_BYTES || 16 * 1024 * 1024);
const QUERY_TIMEOUT_MS = Number(process.env.MYSQL_QUERY_TIMEOUT_MS || 30000);

function splitStatements(sql) {
  // Xoá TẤT CẢ comment '--' (kể cả inline) trước khi tách theo ';' —
  // tránh split nhầm khi comment chứa dấu ';' (vd: "-- 1 = auto; 0 = user tự thêm").
  return String(sql).replace(/--[^\n]*/g, '').split(';').map((part) => part.trim()).filter(Boolean);
}

function translate(sql) {
  let out = String(sql)
    // Modifier ngày kiểu SQLite: date/datetime('now','-30 day') -> MySQL INTERVAL (phải xử lý TRƯỚC dạng không modifier)
    .replace(/datetime\('now'\s*,\s*'([+-]?\d+)\s+(day|month|year|hour|minute)s?'\)/gi, '(UTC_TIMESTAMP() + INTERVAL $1 $2)')
    .replace(/date\('now'\s*,\s*'([+-]?\d+)\s+(day|month|year)s?'\)/gi, '(CURRENT_DATE() + INTERVAL $1 $2)')
    .replace(/datetime\('now'\)/gi, 'UTC_TIMESTAMP()')
    .replace(/date\('now'\)/gi, 'CURRENT_DATE()')
    .replace(/strftime\('%Y-%m',\s*([^)]+)\)/gi, "DATE_FORMAT($1,'%Y-%m')")
    .replace(/strftime\('%Y',\s*([^)]+)\)/gi, "DATE_FORMAT($1,'%Y')")
    .replace(/strftime\('%m',\s*([^)]+)\)/gi, "DATE_FORMAT($1,'%m')")
    .replace(/INSERT\s+OR\s+IGNORE/gi, 'INSERT IGNORE')
    .replace(/ON\s+CONFLICT\s*\(`?key`?\)\s*DO\s+UPDATE\s+SET\s+value\s*=\s*excluded\.value/gi, 'ON DUPLICATE KEY UPDATE value=VALUES(value)')
    .replace(/ON\s+CONFLICT\s*\(period\)\s*DO\s+UPDATE\s+SET\s+amount\s*=\s*excluded\.amount\s*,\s*note\s*=\s*excluded\.note/gi, 'ON DUPLICATE KEY UPDATE amount=VALUES(amount), note=VALUES(note)')
    .replace(/ON\s+CONFLICT\s*\(sid\)\s*DO\s+UPDATE\s+SET\s+data\s*=\s*excluded\.data\s*,\s*expires_at\s*=\s*excluded\.expires_at/gi, 'ON DUPLICATE KEY UPDATE data=VALUES(data), expires_at=VALUES(expires_at)')
    // datetime('now') ở statement này đã bị thay UTC_TIMESTAMP() bởi rule phía trên trong CÙNG
    // chuỗi .replace() này — nên match phần đuôi theo dạng ĐÃ dịch, không phải literal gốc.
    .replace(/ON\s+CONFLICT\s*\(module,\s*field\)\s*DO\s+UPDATE\s+SET\s+is_public\s*=\s*excluded\.is_public\s*,\s*updated_by\s*=\s*excluded\.updated_by\s*,\s*updated_at\s*=\s*UTC_TIMESTAMP\(\)/gi, 'ON DUPLICATE KEY UPDATE is_public=VALUES(is_public), updated_by=VALUES(updated_by), updated_at=UTC_TIMESTAMP()');

  if (/^CREATE\s+INDEX/i.test(out)) return '';
  if (/^CREATE\s+TABLE/i.test(out)) {
    const uniqueColumns = [...out.matchAll(/UNIQUE\s*\(([^)]+)\)/gi)]
      .flatMap((match) => match[1].split(',').map((name) => name.trim()));
    out = out
      .replace(/(`?\w+`?)\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s*\(UTC_TIMESTAMP\(\)\)/gi, '$1 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP')
      .replace(/(`?\w+`?)\s+TEXT\s+PRIMARY\s+KEY/gi, '$1 VARCHAR(191) PRIMARY KEY')
      // 768 = tối đa an toàn cho khóa UNIQUE utf8mb4 (row format DYNAMIC, 3072 byte / 4 byte-per-char);
      // đủ cho URL dài (vd cột `link` dedup theo link bài báo, có thể > 191 ký tự).
      .replace(/(`?\w+`?)\s+TEXT\s+UNIQUE/gi, '$1 VARCHAR(768) UNIQUE')
      .replace(/(`?\w+`?)\s+TEXT(\s+(?:NOT\s+NULL\s+)?DEFAULT\s+['"][^'"]*['"])/gi, '$1 VARCHAR(191)$2')
      .replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'BIGINT AUTO_INCREMENT PRIMARY KEY')
      .replace(/\bINTEGER\b/gi, 'BIGINT');
    for (const column of uniqueColumns) {
      const safe = column.replace(/[^a-zA-Z0-9_]/g, '');
      if (safe) out = out.replace(new RegExp(`(\\b${safe}\\s+)TEXT\\b`, 'i'), '$1VARCHAR(191)');
    }
    // F15: SQLite chấp nhận `col TYPE REFERENCES tbl(col) [ON DELETE ...]` như 1 FK thật (với
    // PRAGMA foreign_keys=ON, đã bật ở db.js). MySQL/InnoDB thì KHÔNG — nó PARSE nhưng ÂM THẦM BỎ
    // QUA cú pháp REFERENCES gắn trực tiếp vào cột (inline column-level), không tạo ràng buộc nào
    // (hành vi đã tài liệu hoá của MySQL, không phải bug của driver `mysql2`/`translate()` trước
    // đây — xác nhận thực nghiệm: SHOW CREATE TABLE sau khi tạo chỉ còn `col BIGINT DEFAULT NULL`,
    // không còn REFERENCES/CONSTRAINT nào). MySQL chỉ tạo FK thật khi có `CONSTRAINT ... FOREIGN
    // KEY (col) REFERENCES tbl(col)` tách riêng (out-of-line). Vì mọi bảng tham chiếu trong
    // `db.js` đều được tạo TRƯỚC bảng tham chiếu tới nó (không có forward reference — đã kiểm tra
    // thủ công thứ tự khai báo), an toàn để chuyển inline REFERENCES thành FOREIGN KEY out-of-line
    // ngay tại đây mà không cần hoãn/2-pass ALTER TABLE thêm constraint sau.
    const tableMatch = out.match(/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`?(\w+)`?/i);
    const tableName = tableMatch ? tableMatch[1] : 'tbl';
    const fkClauses = [];
    out = out.replace(
      /(`?\w+`?)\s+BIGINT(\s+NOT\s+NULL)?\s+REFERENCES\s+(\w+)\((\w+)\)(\s+ON\s+DELETE\s+(?:CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/gi,
      (match, col, notNull, refTable, refCol, onDelete) => {
        const cleanCol = col.replace(/`/g, '');
        fkClauses.push(`CONSTRAINT fk_${tableName}_${cleanCol} FOREIGN KEY (${cleanCol}) REFERENCES ${refTable}(${refCol})${onDelete || ''}`);
        return `${col} BIGINT${notNull || ''}`;
      }
    );
    if (fkClauses.length) out = out.replace(/\)\s*$/, `,\n    ${fkClauses.join(',\n    ')}\n  )`);
  } else if (/^ALTER\s+TABLE/i.test(out)) {
    out = out.replace(/\bINTEGER\b/gi, 'BIGINT');
  }
  return out;
}

// better-sqlite3 accepts named parameters written as @name, while mysql2 only
// binds positional `?` values in the worker. Convert the SQLite-style object
// binding at this adapter boundary so every existing caller gets identical
// semantics on MySQL (rather than letting MySQL interpret @name as a session
// user variable, which silently produced NULL in saveMention()).
function bindSqliteNamedParams(sql, params) {
  if (!Array.isArray(params) || params.length !== 1 || !params[0] ||
      typeof params[0] !== 'object' || Array.isArray(params[0])) {
    return { sql, params };
  }
  const valuesObject = params[0];
  const values = [];
  let out = '';
  let state = 'normal';
  let escaped = false;

  for (let i = 0; i < String(sql).length; i++) {
    const c = String(sql)[i];
    const next = String(sql)[i + 1];
    if (state === 'lineComment') {
      out += c;
      if (c === '\n') state = 'normal';
      continue;
    }
    if (state === 'blockComment') {
      out += c;
      if (c === '*' && next === '/') { out += next; i++; state = 'normal'; }
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'backtick') {
      out += c;
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      const closing = state === 'single' ? "'" : state === 'double' ? '"' : '`';
      if (c === closing) {
        if ((state === 'single' || state === 'double') && next === closing) { out += next; i++; }
        else state = 'normal';
      }
      continue;
    }
    if (c === '-' && next === '-' && /\s/.test(String(sql)[i + 2] || '')) {
      out += c + next; i++; state = 'lineComment'; continue;
    }
    if (c === '/' && next === '*') { out += c + next; i++; state = 'blockComment'; continue; }
    if (c === "'") { out += c; state = 'single'; escaped = false; continue; }
    if (c === '"') { out += c; state = 'double'; escaped = false; continue; }
    if (c === '`') { out += c; state = 'backtick'; escaped = false; continue; }
    if (c === '@' && next === '@') { out += c + next; i++; continue; }
    if (c === '@' && /[A-Za-z_]/.test(next || '')) {
      let j = i + 1;
      while (j < String(sql).length && /[A-Za-z0-9_]/.test(String(sql)[j])) j++;
      const name = String(sql).slice(i + 1, j);
      if (!Object.prototype.hasOwnProperty.call(valuesObject, name)) {
        throw new Error(`Thiếu named parameter @${name} khi chạy MySQL`);
      }
      out += '?';
      values.push(valuesObject[name]);
      i = j - 1;
      continue;
    }
    out += c;
  }
  return { sql: out, params: values };
}

// Tách state machine shutdown thành hàm thuần nhận vào bất kỳ object giống worker_threads.Worker
// (on/once/postMessage/terminate) — Codex re-audit round 3, R3-02, cho phép test dùng fake worker
// (EventEmitter) để kiểm mọi nhánh lỗi mà không cần spawn worker thread thật. `timeoutMs` cho
// phép test rút ngắn nhánh force-terminate (mặc định 3000ms cho production).
//
// Sửa 2 lỗi Codex phát hiện trong bản trước:
// (1) TDZ: `timer` từng được `const` khai báo SAU nhánh `catch` của `postMessage()` — nếu
//     postMessage() throw đồng bộ, nhánh catch gọi settle() -> clearTimeout(timer) trong khi
//     `timer` còn ở temporal dead zone -> ReferenceError che mất lỗi worker gốc. Ở đây `timer`
//     được khai báo và gán TRƯỚC khi gọi postMessage(), nên clearTimeout() luôn hợp lệ.
// (2) False-success: bản trước chỉ dựa vào "có nhận được shutdownAck báo lỗi hay không" để quyết
//     định resolve/reject ở event 'exit', bỏ qua hẳn exit code — worker exit code 1 (hoặc bất kỳ
//     code khác 0) mà thông báo shutdownAck bị mất/chưa kịp gửi vẫn được coi là thành công. Ở đây
//     chỉ resolve khi: đã nhận đúng 1 shutdownAck KHÔNG lỗi VÀ exit code === 0; mọi tổ hợp khác
//     (ack lỗi, exit khác 0, exit trước khi có ack, worker 'error', postMessage throw đồng bộ,
//     hoặc phải force-terminate) đều reject.
function closeWorker(worker, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let ackError = null;
    let ackReceived = false;

    const settle = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error instanceof Error ? error : new Error(String(error)));
      else resolve();
    };

    worker.on('message', (msg) => {
      if (msg && msg.shutdownAck) {
        ackReceived = true;
        if (msg.error) {
          ackError = new Error(`mysql-worker: lỗi khi đóng connection lúc shutdown: ${msg.error.message}`);
        }
      }
    });

    worker.once('exit', (code) => {
      if (ackError) return settle(ackError);
      if (code !== 0) {
        return settle(new Error(`mysql-worker: thoát với exit code ${code} khi shutdown — không nhận được shutdownAck thành công.`));
      }
      if (!ackReceived) {
        return settle(new Error('mysql-worker: thoát trước khi gửi shutdownAck — không xác nhận được connection đã đóng sạch.'));
      }
      settle(null);
    });

    worker.once('error', (error) => settle(error));

    // Đặt timer TRƯỚC khi gọi postMessage() (xem chú thích TDZ ở trên) — an toàn nếu worker
    // không tự thoát sau graceful shutdown (vd connection.end() treo): force-terminate cứng để
    // close() không bao giờ treo teardown test, nhưng vẫn báo lỗi vì đây là shutdown không sạch
    // (R2-02: "phải reject/report nếu graceful close lỗi hoặc terminate lỗi").
    const timer = setTimeout(() => {
      worker.terminate().then(
        () => settle(new Error(`mysql-sync: worker không tự thoát sau shutdown message trong ${timeoutMs}ms — đã force-terminate.`)),
        (terminateError) => settle(terminateError)
      );
    }, timeoutMs);

    try {
      worker.postMessage({ shutdown: true });
    } catch (error) {
      settle(error);
    }
  });
}

class MySQLSyncDatabase {
  constructor() {
    this.worker = new Worker(path.join(__dirname, 'mysql-worker.js'), { env: process.env });
    this.worker.on('error', (error) => { this.workerError = error; });
    this._closed = false;
  }

  // Đóng connection MySQL trong worker rồi terminate worker thread — thiếu bước này khiến
  // tiến trình node giữ event loop sống vô hạn (worker + connection vẫn "alive"), test runner
  // báo assertion xanh nhưng không bao giờ exit (Codex G1A1-audit A1). Luôn gọi trước khi drop
  // schema test để tránh vừa đóng connection vừa drop DB đang được trỏ tới.
  close() {
    if (this._closed) return this._closePromise;
    this._closed = true;
    this._closePromise = closeWorker(this.worker);
    return this._closePromise;
  }

  _call(sql, params = []) {
    if (this.workerError) throw this.workerError;
    const shared = new SharedArrayBuffer(8 + MAX_RESPONSE_BYTES);
    const state = new Int32Array(shared, 0, 2);
    this.worker.postMessage({ shared, sql: translate(sql), params });
    const wait = Atomics.wait(state, 0, 0, QUERY_TIMEOUT_MS);
    if (wait === 'timed-out') throw new Error(`MySQL query timeout (${QUERY_TIMEOUT_MS}ms)`);
    const length = Atomics.load(state, 1);
    const payload = Buffer.from(new Uint8Array(shared, 8, length)).toString('utf8');
    const result = JSON.parse(payload || '{}');
    if (Atomics.load(state, 0) === 2) {
      // W2.1: worker đã gửi kèm `code` (mysql2 err.code, vd 'ER_BAD_NULL_ERROR') nhưng trước đây bị
      // bỏ qua ở đây — global error middleware (app.js) cần field này để phân biệt lỗi ràng buộc dữ
      // liệu (400, message chung) khỏi lỗi server thật không xác định (500), không lộ raw DB message.
      const err = new Error(result.error || 'MySQL query failed');
      if (result.code) err.code = result.code;
      throw err;
    }
    return result;
  }

  exec(sql) {
    let result;
    for (const statement of splitStatements(sql)) {
      const translated = translate(statement);
      if (translated) result = this._call(translated);
    }
    return result;
  }

  prepare(sql) {
    const database = this;
    const bind = (params) => bindSqliteNamedParams(sql, params);
    return {
      all(...params) { const bound = bind(params); return database._call(bound.sql, bound.params).rows || []; },
      get(...params) { const bound = bind(params); return (database._call(bound.sql, bound.params).rows || [])[0]; },
      run(...params) {
        const bound = bind(params);
        const result = database._call(bound.sql, bound.params);
        return { changes: result.affectedRows || 0, lastInsertRowid: result.insertId || 0 };
      },
    };
  }
}

module.exports = { MySQLSyncDatabase, translate, closeWorker, bindSqliteNamedParams };
