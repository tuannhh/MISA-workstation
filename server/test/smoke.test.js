'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');

let dbName;
let sqliteTeardown;
let closeServer;
let baseUrl;
let fixtureUser;

before(async () => {
  if (isMysql) {
    dbName = await dbHarness.createMysqlTestDb();
  } else {
    ({ teardown: sqliteTeardown } = dbHarness.setupSqliteDb());
  }

  // Chỉ require app/db SAU KHI database tạm đã sẵn sàng (xem ràng buộc ở db-harness.js).
  const { createApp } = require('../app');
  const fixtures = require('../test-support/fixtures');

  ({ baseUrl, close: closeServer } = await startTestApp(createApp()));
  fixtureUser = fixtures.createPrivilegedUser({ username: `smoke_admin_${Date.now()}` });
});

after(async () => {
  // Mỗi bước dọn dẹp chạy độc lập (N2, Codex G1A1-audit): 1 bước lỗi không được cản các bước
  // sau — nếu không, đóng server lỗi có thể khiến worker MySQL/database tạm bị bỏ sót vĩnh viễn.
  // Thứ tự: đóng HTTP server -> đóng connection/worker DB (A1, bắt buộc trước khi drop schema)
  // -> drop schema tạm / xoá thư mục sqlite tạm.
  const steps = [
    async () => { if (closeServer) await closeServer(); },
    async () => { await require('../db').closeDb(); },
    async () => { if (isMysql && dbName) await dbHarness.dropMysqlTestDb(dbName); },
    async () => { if (sqliteTeardown) sqliteTeardown(); },
  ];
  const errors = [];
  for (const step of steps) {
    try { await step(); } catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, 'teardown gặp lỗi (đã thử hết các bước dọn dẹp)');
});

test('login + GET /api/me trả đúng session user', async () => {
  const fixtures = require('../test-support/fixtures');
  const { cookie } = await fixtures.login(baseUrl, {
    username: fixtureUser.username,
    password: fixtureUser.password,
  });

  const res = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user.username, fixtureUser.username);
  assert.equal(body.user.role, 'super_admin');
  assert.ok(body.permissions, 'phải có object permissions');
});

test('GET /api/me không có cookie trả 401', async () => {
  const res = await fetch(`${baseUrl}/api/me`);
  assert.equal(res.status, 401);
});
