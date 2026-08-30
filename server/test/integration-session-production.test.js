'use strict';
// W1.7 — session hardening (F2) khi NODE_ENV=production: fail-fast SESSION_SECRET, cookie Secure.
// Tách riêng khỏi target-session-f2.test.js vì phải toggle process.env.NODE_ENV/SESSION_SECRET và
// require lại server/app.js (require.cache) — không dùng chung app instance với các test khác.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const resources = createResourceStack();
const appPath = require.resolve('../app');

before(async () => {
  if (isMysql) {
    resources.acquire(dbHarness.setupTestDataDir().teardown);
    const dbName = await dbHarness.createMysqlTestDb();
    resources.acquire(() => dbHarness.dropMysqlTestDb(dbName));
  } else {
    const { teardown } = dbHarness.setupSqliteDb();
    resources.acquire(teardown);
  }
  const { closeDb } = require('../db');
  resources.acquire(closeDb);
});

after(async () => {
  await resources.cleanupAll();
});

test('production fail-fast: createApp() throw khi NODE_ENV=production và thiếu SESSION_SECRET', () => {
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.SESSION_SECRET;
  process.env.NODE_ENV = 'production';
  delete process.env.SESSION_SECRET;
  delete require.cache[appPath];
  try {
    const { createApp } = require('../app');
    assert.throws(() => createApp(), /SESSION_SECRET bắt buộc/);
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = prevSecret;
    delete require.cache[appPath];
  }
});

test('production: cookie session có thuộc tính Secure', async () => {
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.SESSION_SECRET;
  process.env.NODE_ENV = 'production';
  process.env.SESSION_SECRET = 'test-secret-for-production-mode';
  delete require.cache[appPath];
  let started;
  try {
    const { createApp } = require('../app');
    const fixtures = require('../test-support/fixtures');
    started = await startTestApp(createApp());
    const user = fixtures.createUser('pr_staff', { username: `f2_secure_${Date.now()}` });
    // Test harness phục vụ qua HTTP trần (không TLS thật); express-session chỉ set cookie.secure
    // khi req.secure=true. Mô phỏng đúng deployment thật (Cloud Run/reverse proxy chấm dứt TLS rồi
    // forward X-Forwarded-Proto: https) — đây là lý do createApp() phải bật `trust proxy` ở production.
    const res = await fetch(`${started.baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'https' },
      body: JSON.stringify({ username: user.username, password: user.password }),
    });
    assert.equal(res.status, 200);
    const setCookie = res.headers.getSetCookie();
    assert.ok(setCookie.length, 'phải có Set-Cookie');
    assert.match(setCookie[0], /Secure/i, 'cookie session ở production phải có thuộc tính Secure');
  } finally {
    if (started) await started.close();
    process.env.NODE_ENV = prevEnv;
    if (prevSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = prevSecret;
    delete require.cache[appPath];
  }
});
