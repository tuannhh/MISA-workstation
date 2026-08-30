'use strict';
// W2.1 — integration test HTTP cho envelope lỗi chuẩn hóa (05-error-contract.md). Không lặp lại
// mọi route đã có test riêng (R143/R099 v.v.) — chỉ xác nhận 1 lần cho mỗi status/code đại diện
// rằng error===message ký tự-cho-ký tự, code ổn định đúng bảng, và requestId trong body khớp
// header X-Request-Id (bằng chứng middleware chạy trước khi response được ghi).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

let baseUrl;
let fixtures;
let staff;
const resources = createResourceStack();

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
  const { createApp } = require('../app');
  fixtures = require('../test-support/fixtures');
  const started = await startTestApp(createApp());
  baseUrl = started.baseUrl;
  resources.acquire(started.close);
  staff = fixtures.createUser('pr_staff', { username: `errctr_staff_${Date.now()}` });
});

after(async () => {
  await resources.cleanupAll();
});

function assertEnvelope(body, headerRequestId, { code, message }) {
  assert.equal(body.code, code);
  if (message !== undefined) assert.equal(body.message, message);
  assert.equal(body.error, body.message, 'error phải === message ký tự-cho-ký tự');
  assert.ok(body.requestId, 'body.requestId phải có mặt');
  assert.equal(body.requestId, headerRequestId, 'body.requestId phải khớp header X-Request-Id');
}

test('BR-ERR-006: 401 UNAUTHENTICATED sai mật khẩu login đúng envelope + requestId khớp header', async () => {
  const res = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: staff.username, password: 'sai-mat-khau' }),
  });
  assert.equal(res.status, 401);
  assertEnvelope(await res.json(), res.headers.get('x-request-id'), { code: 'UNAUTHENTICATED', message: 'Sai tài khoản hoặc mật khẩu.' });
});

test('BR-ERR-007: 401 UNAUTHENTICATED requireAuth không cookie đúng envelope', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard`);
  assert.equal(res.status, 401);
  assertEnvelope(await res.json(), res.headers.get('x-request-id'), { code: 'UNAUTHENTICATED', message: 'Chưa đăng nhập' });
});

test('BR-ERR-008: 403 FORBIDDEN_MODULE requirePerm từ chối pr_staff trên admin.view đúng envelope', async () => {
  const { cookie } = await fixtures.login(baseUrl, { username: staff.username, password: staff.password });
  const res = await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie } });
  assert.equal(res.status, 403);
  const body = await res.json();
  assertEnvelope(body, res.headers.get('x-request-id'), { code: 'FORBIDDEN_MODULE' });
});

test('BR-ERR-009: 429 RATE_LIMITED brute-force login đúng envelope (code ổn định, không chỉ message)', async () => {
  const username = `errctr_ratelimit_${Date.now()}`;
  let last;
  for (let i = 0; i < 6; i++) {
    last = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password: 'sai' }),
    });
  }
  assert.equal(last.status, 429);
  assertEnvelope(await last.json(), last.headers.get('x-request-id'), { code: 'RATE_LIMITED' });
});

test('BR-ERR-010: X-Request-Id mỗi response (kể cả 200) đều có header, 2 request khác nhau có id khác nhau', async () => {
  const r1 = await fetch(`${baseUrl}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
  const r2 = await fetch(`${baseUrl}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
  const id1 = r1.headers.get('x-request-id');
  const id2 = r2.headers.get('x-request-id');
  assert.ok(id1 && id2);
  assert.notEqual(id1, id2);
});
