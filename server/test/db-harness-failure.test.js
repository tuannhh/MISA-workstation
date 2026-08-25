'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';

// Chỉ có ý nghĩa ở chế độ MySQL — SQLite không có bước GRANT nên không có failure-path này.
// Tái hiện đúng thí nghiệm Codex G1A1-audit A2: MYSQL_USER không tồn tại -> GRANT lỗi -> phải
// rollback (DROP DATABASE) chứ không để sót schema tạm.
//
// Kiểm tra ĐÚNG TÊN database mà lần gọi này định tạo (đọc từ error.attemptedDbName) — KHÔNG so
// toàn bộ danh sách `pr_media_test_%` trên server, vì các file test khác (vd smoke.test.js) chạy
// đồng thời trong process riêng và có thể đang có database tạm riêng còn sống hợp lệ tại đúng
// thời điểm này; so toàn bộ danh sách sẽ cho false positive.
test('createMysqlTestDb() rollback khi GRANT lỗi — không sót đúng database vừa thử tạo', { skip: !isMysql }, async () => {
  const mysql = require('mysql2/promise');
  const dbHarness = require('../test-support/db-harness');

  const adminConfig = {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_ADMIN_USER || 'root',
    password: process.env.MYSQL_ADMIN_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || 'change-root-password',
  };

  const originalUser = process.env.MYSQL_USER;
  process.env.MYSQL_USER = 'codex_missing_test_user_xyz'; // user không tồn tại -> GRANT phải lỗi

  let attemptedName;
  try {
    await dbHarness.createMysqlTestDb();
    assert.fail('createMysqlTestDb() phải reject khi GRANT lỗi');
  } catch (error) {
    attemptedName = error.attemptedDbName;
  } finally {
    process.env.MYSQL_USER = originalUser;
  }

  assert.ok(attemptedName, 'error phải gắn attemptedDbName để test kiểm tra đúng tên');
  const conn = await mysql.createConnection(adminConfig);
  try {
    const [rows] = await conn.query('SHOW DATABASES LIKE ?', [attemptedName]);
    assert.equal(rows.length, 0, `database "${attemptedName}" phải bị rollback, nhưng vẫn còn tồn tại`);
  } finally {
    await conn.end();
  }
});
