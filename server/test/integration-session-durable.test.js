'use strict';
// F2 regression: a session created by one app instance must work on another instance sharing the
// database, then be revoked for both when logout destroys it. This catches a silent MemoryStore
// fallback, which unit tests of login/regenerate cannot see.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const resources = createResourceStack();
let db;
let fixtures;

before(async () => {
  if (isMysql) {
    resources.acquire(dbHarness.setupTestDataDir().teardown);
    const dbName = await dbHarness.createMysqlTestDb();
    resources.acquire(() => dbHarness.dropMysqlTestDb(dbName));
  } else {
    resources.acquire(dbHarness.setupSqliteDb().teardown);
  }
  const dbMod = require('../db');
  db = dbMod.db;
  resources.acquire(dbMod.closeDb);
  fixtures = require('../test-support/fixtures');
});

after(async () => { await resources.cleanupAll(); });

test('F2 durable store: session qua app instance khác vẫn hợp lệ, logout xoá session server-side', async () => {
  const { createApp } = require('../app');
  const user = fixtures.createUser('executor', { username: `f2_durable_${Date.now()}` });
  const first = await startTestApp(createApp());
  let second;
  try {
    const { cookie } = await fixtures.login(first.baseUrl, { username: user.username, password: user.password });
    assert.equal(db.prepare('SELECT COUNT(*) c FROM web_sessions').get().c, 1, 'login phải persist session vào DB, không phải MemoryStore');
    await first.close();

    second = await startTestApp(createApp());
    const me = await fetch(`${second.baseUrl}/api/me`, { headers: { cookie } });
    assert.equal(me.status, 200, 'instance mới phải đọc được session đã persist');
    assert.equal((await me.json()).user.username, user.username);

    const logout = await fetch(`${second.baseUrl}/api/logout`, { method: 'POST', headers: { cookie } });
    assert.equal(logout.status, 200);
    assert.equal(db.prepare('SELECT COUNT(*) c FROM web_sessions').get().c, 0, 'logout phải huỷ session bền vững');
    assert.equal((await fetch(`${second.baseUrl}/api/me`, { headers: { cookie } })).status, 401);
  } finally {
    if (second) await second.close();
    else await first.close();
  }
});
