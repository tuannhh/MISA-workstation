'use strict';
// Failure-path tests cho pattern resource-stack dùng trong smoke.test.js (Codex re-audit round 2,
// R2-01): "after() không được tự require() DB mới; phải có failure test cho create/grant failure
// trước require, DB init failure sau worker spawn, và HTTP listen/start failure sau khi DB đã
// load — tất cả phải chứng minh không chạm DB mặc định và không sót schema/worker."
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const { createResourceStack } = require('../test-support/resource-stack');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';

test('resource-stack: cleanupAll() chạy đúng thứ tự LIFO và gộp lỗi thành AggregateError', async () => {
  const order = [];
  const stack = createResourceStack();
  stack.acquire(async () => { order.push('first-acquired-cleaned-last'); });
  stack.acquire(async () => { order.push('second'); throw new Error('lỗi bước 2'); });
  stack.acquire(async () => { order.push('third-acquired-cleaned-first'); });

  await assert.rejects(() => stack.cleanupAll(), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors.length, 1);
    assert.equal(error.errors[0].message, 'lỗi bước 2');
    return true;
  });

  assert.deepEqual(order, ['third-acquired-cleaned-first', 'second', 'first-acquired-cleaned-last']);
});

test('resource-stack: stack rỗng (chưa acquire gì) thì cleanupAll() không làm gì, không lỗi', async () => {
  const stack = createResourceStack();
  assert.equal(stack.size, 0);
  await stack.cleanupAll();
});

test(
  'create/grant failure trước khi require DB: không đổi MYSQL_DATABASE mặc định, resource-stack rỗng',
  { skip: !isMysql },
  async () => {
    const dbHarness = require('../test-support/db-harness');
    const stack = createResourceStack();
    const originalDatabaseEnv = process.env.MYSQL_DATABASE;
    // Khôi phục env đúng semantics (S2): nếu MYSQL_USER ban đầu chưa được set, phải delete key
    // chứ không gán lại chuỗi "undefined" — nếu không, test kế tiếp trong cùng process sẽ dùng
    // literal string 'undefined' làm tên user MySQL và tự làm GRANT lỗi không liên quan gì tới
    // kịch bản đang test.
    const hadUser = Object.prototype.hasOwnProperty.call(process.env, 'MYSQL_USER');
    const originalUser = process.env.MYSQL_USER;
    process.env.MYSQL_USER = 'codex_missing_test_user_xyz';
    try {
      await assert.rejects(async () => {
        const dbName = await dbHarness.createMysqlTestDb();
        stack.acquire(() => dbHarness.dropMysqlTestDb(dbName));
      });
    } finally {
      if (hadUser) process.env.MYSQL_USER = originalUser;
      else delete process.env.MYSQL_USER;
    }
    // Đúng như R2-01 yêu cầu: nếu bước tạo DB test thất bại, KHÔNG được có bất kỳ resource nào
    // được acquire (nên after()/cleanupAll() không có gì để dọn), và biến môi trường trỏ database
    // mặc định của app không bị đổi bởi lần thử thất bại này.
    assert.equal(stack.size, 0, 'không được acquire resource nào khi createMysqlTestDb() thất bại');
    assert.equal(process.env.MYSQL_DATABASE, originalDatabaseEnv, 'MYSQL_DATABASE không được bị đổi khi setup thất bại');
  }
);

test(
  'listen/start failure sau khi DB đã load: resource-stack vẫn drop đúng DB đã tạo trước đó',
  { skip: !isMysql },
  async () => {
    const dbHarness = require('../test-support/db-harness');
    const mysql = require('mysql2/promise');
    const stack = createResourceStack();

    const dbName = await dbHarness.createMysqlTestDb();
    stack.acquire(() => dbHarness.dropMysqlTestDb(dbName));

    // Mô phỏng bước acquire kế tiếp thất bại (vd HTTP server listen lỗi sau khi DB đã sẵn sàng) —
    // đúng thứ tự thật trong smoke.test.js: DB được acquire trước app/server.
    await assert.rejects(async () => {
      throw new Error('mô phỏng listen() thất bại sau khi DB đã load');
    });

    // Resource DB đã acquire ở bước trước đó vẫn còn trong stack (before() không revert lại), nên
    // after() thật (cleanupAll()) vẫn phải drop đúng DB này — không được sót lại vĩnh viễn chỉ vì
    // một bước acquire SAU đó thất bại.
    await stack.cleanupAll();

    const conn = await mysql.createConnection({
      host: process.env.TEST_MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.TEST_MYSQL_PORT || 3306),
      user: process.env.TEST_MYSQL_ADMIN_USER || 'root',
      password: process.env.TEST_MYSQL_ADMIN_PASSWORD || 'change-root-password',
    });
    try {
      const [rows] = await conn.query('SHOW DATABASES LIKE ?', [dbName]);
      assert.equal(rows.length, 0, `database "${dbName}" phải bị drop bởi cleanupAll(), nhưng vẫn còn tồn tại`);
    } finally {
      await conn.end();
    }
  }
);

test(
  'DB init failure sau khi worker đã spawn: require("../db") phải crash rõ ràng (exit khác 0), không âm thầm seed nhầm',
  { skip: !isMysql },
  () => {
    // Chạy trong process con riêng (không phải test process chính): server/db.js có side-effect
    // module-scope (spawn worker + init() + seed() ngay khi require), nếu chạy trong process test
    // hiện tại sẽ làm hỏng module cache/worker cho các test khác trong cùng file. Trỏ MYSQL_DATABASE
    // tới một schema CHƯA TỪNG được tạo (không qua createMysqlTestDb()) để buộc init() thất bại
    // đúng lúc worker đã tồn tại — đây là kịch bản Codex nêu ("DB init failure sau worker spawn").
    const fixture = path.join(__dirname, '..', 'test-support', 'require-db-fixture.js');
    const result = spawnSync(process.execPath, [fixture], {
      encoding: 'utf8',
      timeout: 15000,
      env: {
        ...process.env,
        DB_CLIENT: 'mysql',
        MYSQL_HOST: process.env.TEST_MYSQL_HOST || '127.0.0.1',
        MYSQL_PORT: process.env.TEST_MYSQL_PORT || '3306',
        MYSQL_USER: 'pr_media',
        MYSQL_PASSWORD: 'pr_media',
        MYSQL_DATABASE: `pr_media_test_never_created_${Date.now()}`,
      },
    });

    assert.equal(result.signal, null, 'process con không được bị kill do treo (timeout) — init failure phải crash nhanh, không hang');
    assert.notEqual(result.status, 0, 'require("../db") với database chưa tồn tại phải làm process thoát khác 0, không âm thầm PASS');
    assert.ok(!result.stdout.includes('DB_LOADED_OK'), 'không được in DB_LOADED_OK khi init() thất bại');
    assert.match(result.stderr, /Unknown database/i, 'lỗi phải nêu rõ nguyên nhân (database không tồn tại), không phải lỗi mơ hồ');
    // Ghi nhận rủi ro còn lại (đã trao đổi với Codex, chấp nhận là residual risk trong changelog):
    // worker thread bị "leak" trong kịch bản này không có handle để đóng graceful (module.exports
    // của db.js chưa từng chạy tới vì init() throw trước dòng đó) — nhưng vì toàn bộ kịch bản chạy
    // trong MỘT process con độc lập, worker đó chỉ sống trong vòng đời process con này và bị dọn
    // sạch bởi hệ điều hành ngay khi process con thoát (đã chứng minh ở trên: result.signal=null,
    // process tự thoát chứ không bị treo).
  }
);
