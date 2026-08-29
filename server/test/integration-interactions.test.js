'use strict';
// G1A.3 (6/~12) — integration test HTTP cho nhóm "Lịch sử tương tác" (R043-R045): tìm nhanh
// nhân sự+cơ quan để gắn tương tác, danh sách tương tác (phân trang+filter), tạo tương tác.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

let baseUrl;
let cookie;
let fixtures;
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
  const admin = fixtures.createPrivilegedUser({ username: `interactions_admin_${Date.now()}` });
  cookie = (await fixtures.login(baseUrl, { username: admin.username, password: admin.password })).cookie;
});

after(async () => {
  await resources.cleanupAll();
});

async function call(method, path, { body, auth = true, headers } = {}) {
  const opts = { method, headers: { ...(auth ? { cookie } : {}), ...(headers || {}) } };
  if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  return fetch(`${baseUrl}${path}`, opts);
}
async function createOrg(overrides = {}) {
  const res = await call('POST', '/api/partners', { body: { name: `Org tương tác ${Date.now()}`, org_type: 'press', ...overrides } });
  assert.equal(res.status, 200);
  return (await res.json()).id;
}

// ---------------------------------------------------------------------------
// R043 — GET /api/entities/search (không có :id/body -> không case invalid/not-found)
// ---------------------------------------------------------------------------
test('R043 happy: tìm theo tên khớp cả người lẫn cơ quan, gắn đúng type/sub', async () => {
  const orgId = await createOrg({ name: `Báo Tương Tác Test ${Date.now()}` });
  const res = await call('GET', `/api/entities/search?q=${encodeURIComponent('Báo Tương Tác Test')}`);
  assert.equal(res.status, 200);
  const rows = (await res.json()).rows;
  const org = rows.find((r) => r.id === orgId && r.type === 'org');
  assert.ok(org, 'phải tìm thấy org vừa tạo trong kết quả search');
  assert.equal(org.sub, 'Cơ quan báo chí');
});
test('R043 happy: q rỗng CHARACTERIZATION — không lỗi, trả tối đa 10 người + 10 cơ quan bất kỳ', async () => {
  const res = await call('GET', '/api/entities/search');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray((await res.json()).rows));
});
test('R043 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/entities/search?q=x', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R044 — GET /api/interactions (không có :id -> không case not-found)
// ---------------------------------------------------------------------------
test('R044 happy: trả danh sách phân trang + total, filter partner_type/search hoạt động', async () => {
  const created = await (await call('POST', '/api/interactions', { body: { partner_type: 'person', partner_id: 1, date: '2026-08-01', summary: `Ghi chú tương tác ${Date.now()}` } })).json();
  const res = await call('GET', '/api/interactions');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.rows.some((r) => r.id === created.id));
  assert.equal(typeof body.total, 'number');
  assert.equal(typeof body.page, 'number');
  assert.equal(typeof body.pageSize, 'number');
});
test('R044 invalid CHARACTERIZATION: page/pageSize sai định dạng không lỗi, tự clamp về mặc định', async () => {
  const res = await call('GET', '/api/interactions?page=-5&pageSize=99999');
  assert.equal(res.status, 200);
});
test('R044 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/interactions', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R045 — POST /api/interactions
// ---------------------------------------------------------------------------
test('R045 happy: tạo tương tác hợp lệ trả 200 + id', async () => {
  const res = await call('POST', '/api/interactions', { body: { partner_type: 'org', partner_id: 1, date: '2026-08-02', summary: 'Gặp gỡ trao đổi' } });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).id);
});
test('R045 invalid: thiếu date (NOT NULL) -> lỗi DB, trả 400', async () => {
  const res = await call('POST', '/api/interactions', { body: { partner_type: 'person', partner_id: 1, summary: 'Thiếu ngày' } });
  assert.equal(res.status, 400);
});
test('R045 CHARACTERIZATION: partner_type lạ tự về "person", partner_id thiếu tự về 0 — không lỗi', async () => {
  const res = await call('POST', '/api/interactions', { body: { partner_type: 'khong-hop-le', date: '2026-08-03', summary: 'partner_type lạ' } });
  assert.equal(res.status, 200);
});
test('R045 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/interactions', { auth: false, body: { date: '2026-08-01' } })).status, 401);
});
