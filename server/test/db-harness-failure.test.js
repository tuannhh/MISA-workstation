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
// Khôi phục env đúng semantics (Codex re-audit round 2, S2): nếu giá trị ban đầu là undefined,
// phải delete key chứ không gán lại 'undefined' (Node sẽ stringify thành chuỗi "undefined").
function withEnvOverride(key, value, fn) {
  const hadKey = Object.prototype.hasOwnProperty.call(process.env, key);
  const original = process.env[key];
  process.env[key] = value;
  return Promise.resolve().then(fn).finally(() => {
    if (hadKey) process.env[key] = original;
    else delete process.env[key];
  });
}

test('createMysqlTestDb() rollback khi GRANT lỗi — không sót đúng database vừa thử tạo', { skip: !isMysql }, async () => {
  const mysql = require('mysql2/promise');
  const dbHarness = require('../test-support/db-harness');

  const adminConfig = {
    host: process.env.TEST_MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.TEST_MYSQL_PORT || 3306),
    user: process.env.TEST_MYSQL_ADMIN_USER || 'root',
    password: process.env.TEST_MYSQL_ADMIN_PASSWORD || 'change-root-password',
  };

  let attemptedName;
  // user không tồn tại -> GRANT phải lỗi
  await withEnvOverride('MYSQL_USER', 'codex_missing_test_user_xyz', async () => {
    try {
      await dbHarness.createMysqlTestDb();
      assert.fail('createMysqlTestDb() phải reject khi GRANT lỗi');
    } catch (error) {
      attemptedName = error.attemptedDbName;
    }
  });

  assert.ok(attemptedName, 'error phải gắn attemptedDbName để test kiểm tra đúng tên');
  const conn = await mysql.createConnection(adminConfig);
  try {
    const [rows] = await conn.query('SHOW DATABASES LIKE ?', [attemptedName]);
    assert.equal(rows.length, 0, `database "${attemptedName}" phải bị rollback, nhưng vẫn còn tồn tại`);
  } finally {
    await conn.end();
  }
});

test('dropMysqlTestDb() từ chối chạy khi thiếu ALLOW_TEST_DB_CREATE — opt-in áp dụng cho cả DROP', { skip: !isMysql }, async () => {
  const dbHarness = require('../test-support/db-harness');
  const hadFlag = Object.prototype.hasOwnProperty.call(process.env, 'ALLOW_TEST_DB_CREATE');
  const originalFlag = process.env.ALLOW_TEST_DB_CREATE;
  delete process.env.ALLOW_TEST_DB_CREATE;
  try {
    await assert.rejects(
      () => dbHarness.dropMysqlTestDb('pr_media_test_123_aaaaaaaa'),
      /ALLOW_TEST_DB_CREATE=1/,
      'dropMysqlTestDb() phải từ chối trước khi mở connection khi chưa opt-in'
    );
  } finally {
    if (hadFlag) process.env.ALLOW_TEST_DB_CREATE = originalFlag;
    else delete process.env.ALLOW_TEST_DB_CREATE;
  }
});
