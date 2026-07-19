'use strict';

const { parentPort } = require('worker_threads');
const mysql = require('mysql2/promise');

let connection;
async function getConnection() {
  if (!connection) {
    // Cloud Run + Cloud SQL: dùng unix socket /cloudsql/<INSTANCE_CONNECTION_NAME>;
    // Docker/local: dùng host + port. Ưu tiên socketPath nếu có.
    const cfg = {
      user: process.env.MYSQL_USER || 'pr_media',
      password: process.env.MYSQL_PASSWORD || 'pr_media',
      database: process.env.MYSQL_DATABASE || 'pr_media',
      charset: 'utf8mb4',
      supportBigNumbers: true,
      bigNumberStrings: false,
    };
    if (process.env.MYSQL_SOCKET_PATH) {
      cfg.socketPath = process.env.MYSQL_SOCKET_PATH;
    } else {
      cfg.host = process.env.MYSQL_HOST || '127.0.0.1';
      cfg.port = Number(process.env.MYSQL_PORT || 3306);
    }
    connection = mysql.createConnection(cfg);
  }
  return connection;
}

parentPort.on('message', async ({ shared, sql, params }) => {
  const state = new Int32Array(shared, 0, 2);
  const output = new Uint8Array(shared, 8);
  try {
    const db = await getConnection();
    const [rows] = await db.execute(sql, params);
    const result = Array.isArray(rows)
      ? { rows }
      : { affectedRows: rows.affectedRows, insertId: rows.insertId, warningStatus: rows.warningStatus };
    write(result, 1);
  } catch (error) {
    if (error && ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET'].includes(error.code)) connection = null;
    write({ error: error.message, code: error.code }, 2);
  }

  function write(value, status) {
    const encoded = Buffer.from(JSON.stringify(value));
    if (encoded.length > output.length) {
      const fallback = Buffer.from(JSON.stringify({ error: `MySQL response exceeds ${output.length} bytes` }));
      output.set(fallback.subarray(0, output.length));
      Atomics.store(state, 1, Math.min(fallback.length, output.length));
      Atomics.store(state, 0, 2);
    } else {
      output.set(encoded);
      Atomics.store(state, 1, encoded.length);
      Atomics.store(state, 0, status);
    }
    Atomics.notify(state, 0, 1);
  }
});
