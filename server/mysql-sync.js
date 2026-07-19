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
      .replace(/(`?\w+`?)\s+TEXT\s+UNIQUE/gi, '$1 VARCHAR(191) UNIQUE')
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
