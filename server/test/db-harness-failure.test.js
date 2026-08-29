'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { createResourceStack } = require('../test-support/resource-stack');

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

// Codex re-audit `cefd6b3` (R1, 2026-08-25): setupTestDataDir() phải là resource ĐỘC LẬP khỏi
// lifecycle database — teardown phải xoá dir VÀ khôi phục đúng process.env.DATA_DIR (không để
// trỏ tới đường dẫn đã xoá), cả khi có giá trị DATA_DIR trước đó lẫn khi không.
test('setupTestDataDir() success: xoá dir + khôi phục DATA_DIR (có giá trị trước đó)', () => {
  const dbHarness = require('../test-support/db-harness');
  const hadPrev = Object.prototype.hasOwnProperty.call(process.env, 'DATA_DIR');
  const prevValue = process.env.DATA_DIR;
  process.env.DATA_DIR = '/tmp/gia-lap-data-dir-truoc-do';
  try {
    const { dir, teardown } = dbHarness.setupTestDataDir();
    assert.ok(fs.existsSync(dir), 'setupTestDataDir() phải tạo dir thật');
    assert.equal(process.env.DATA_DIR, dir, 'DATA_DIR phải trỏ đúng dir vừa tạo trong lúc dùng');
    teardown();
    assert.equal(fs.existsSync(dir), false, 'teardown() phải xoá dir');
    assert.equal(process.env.DATA_DIR, '/tmp/gia-lap-data-dir-truoc-do', 'teardown() phải khôi phục đúng giá trị DATA_DIR trước đó');
  } finally {
    if (hadPrev) process.env.DATA_DIR = prevValue;
    else delete process.env.DATA_DIR;
  }
});

test('setupTestDataDir() success: khôi phục về "chưa từng set" khi trước đó không có DATA_DIR', () => {
  const dbHarness = require('../test-support/db-harness');
  const hadPrev = Object.prototype.hasOwnProperty.call(process.env, 'DATA_DIR');
  const prevValue = process.env.DATA_DIR;
  delete process.env.DATA_DIR;
  try {
    const { dir, teardown } = dbHarness.setupTestDataDir();
    teardown();
    assert.equal(
      Object.prototype.hasOwnProperty.call(process.env, 'DATA_DIR'), false,
      'teardown() phải xoá hẳn key DATA_DIR nếu trước đó chưa từng set, không để lại chuỗi "undefined"'
    );
  } finally {
    if (hadPrev) process.env.DATA_DIR = prevValue;
    else delete process.env.DATA_DIR;
  }
});

// Tái hiện đúng thí nghiệm Codex đo được ở audit `cefd6b3` (R1): "chạy failure test làm số thư
// mục tmp tăng thêm 1 mỗi lần". Với pattern mới — acquire setupTestDataDir() vào resource-stack
// TRƯỚC khi gọi createMysqlTestDb() — dù DB creation thất bại giữa đường, resource-stack vẫn có
// đúng 1 cleanup đã đăng ký để dọn dir, không rò.
test('pattern acquire-trước-khi-tạo-DB: setupTestDataDir() không rò khi createMysqlTestDb() thất bại', { skip: !isMysql }, async () => {
  const dbHarness = require('../test-support/db-harness');
  const stack = createResourceStack();
  const hadUser = Object.prototype.hasOwnProperty.call(process.env, 'MYSQL_USER');
  const originalUser = process.env.MYSQL_USER;

  // Đúng thứ tự các file test G1A.3 phải dùng: acquire dir TRƯỚC khi thử tạo DB.
  const { dir, teardown } = dbHarness.setupTestDataDir();
  stack.acquire(teardown);
  assert.equal(stack.size, 1, 'resource dir phải được acquire ngay, độc lập với việc tạo DB có thành công hay không');

  process.env.MYSQL_USER = 'codex_missing_test_user_xyz'; // user không tồn tại -> GRANT phải lỗi
  try {
    await assert.rejects(
      () => dbHarness.createMysqlTestDb(),
      'createMysqlTestDb() phải reject khi GRANT lỗi (không đăng ký thêm resource DB nào)'
    );
  } finally {
    if (hadUser) process.env.MYSQL_USER = originalUser;
    else delete process.env.MYSQL_USER;
  }

  // Resource dir vẫn còn nguyên trong stack (createMysqlTestDb() thất bại không tự dọn resource
  // của caller) — cleanupAll() phải dọn được, khác hẳn hành vi rò trước fix (Codex đo được: chạy
  // lại failure test làm số thư mục tmp tăng thêm 1 mỗi lần).
  assert.equal(stack.size, 1, 'resource dir đã acquire trước đó không bị mất khi bước tạo DB sau đó thất bại');
  assert.ok(fs.existsSync(dir), 'dir vẫn còn tồn tại ngay trước khi cleanupAll()');
  await stack.cleanupAll();
  assert.equal(fs.existsSync(dir), false, 'cleanupAll() phải xoá dir dù createMysqlTestDb() đã thất bại giữa đường');
});
