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
  fixtureUser = fixtures.createUser('super_admin', { username: `smoke_admin_${Date.now()}` });
});

after(async () => {
  if (closeServer) await closeServer();
  if (isMysql && dbName) await dbHarness.dropMysqlTestDb(dbName);
  if (sqliteTeardown) sqliteTeardown();
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
