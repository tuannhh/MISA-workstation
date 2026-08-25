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
    .replace(/ON\s+CONFLICT\s*\(period\)\s*DO\s+UPDATE\s+SET\s+amount\s*=\s*excluded\.amount\s*,\s*note\s*=\s*excluded\.note/gi, 'ON DUPLICATE KEY UPDATE amount=VALUES(amount), note=VALUES(note)');

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
  } else if (/^ALTER\s+TABLE/i.test(out)) {
    out = out.replace(/\bINTEGER\b/gi, 'BIGINT');
  }
  return out;
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
  //
  // Không nuốt lỗi cleanup (Codex re-audit round 2, R2-02): nếu worker báo shutdownAck kèm lỗi
  // (connection.end() thất bại) hoặc phải force-terminate vì worker không tự thoát, close() phải
  // reject để caller (smoke.test.js after(), dùng AggregateError) thấy được sự cố thay vì coi
  // như đã dọn sạch. Vẫn luôn thử hết mọi bước cleanup còn lại của caller — reject ở đây chỉ báo
  // lỗi, không ném ngoại lệ đồng bộ chặn các bước sau.
  close() {
    if (this._closed) return this._closePromise;
    this._closed = true;
    this._closePromise = new Promise((resolve, reject) => {
      let settled = false;
      let shutdownAckError = null;
      const finishOk = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const finishError = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      };
      this.worker.on('message', (msg) => {
        if (msg && msg.shutdownAck && msg.error) {
          shutdownAckError = new Error(`mysql-worker: lỗi khi đóng connection lúc shutdown: ${msg.error.message}`);
        }
      });
      this.worker.once('exit', () => {
        if (shutdownAckError) finishError(shutdownAckError);
        else finishOk();
      });
      this.worker.once('error', finishError);
      try {
        this.worker.postMessage({ shutdown: true });
      } catch (error) {
        finishError(error);
      }
      // An toàn: nếu worker không tự thoát sau graceful shutdown (vd connection.end() treo),
      // terminate cứng để close() không bao giờ treo teardown test — nhưng vẫn báo lỗi vì đây là
      // shutdown không sạch (R2-02: "phải reject/report nếu graceful close lỗi hoặc terminate lỗi").
      const timer = setTimeout(() => {
        this.worker.terminate().then(
          () => finishError(new Error('mysql-sync: worker không tự thoát sau shutdown message trong 3s — đã force-terminate.')),
          finishError
        );
      }, 3000);
    });
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
    if (Atomics.load(state, 0) === 2) throw new Error(result.error || 'MySQL query failed');
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
    return {
      all(...params) { return database._call(sql, params).rows || []; },
      get(...params) { return (database._call(sql, params).rows || [])[0]; },
      run(...params) {
        const result = database._call(sql, params);
        return { changes: result.affectedRows || 0, lastInsertRowid: result.insertId || 0 };
      },
    };
  }
}

module.exports = { MySQLSyncDatabase, translate };
