'use strict';
// D13 batch RBAC-EXP-B1 (mở rộng PolicyEngine từ pilot `person` sang 6 entity Module-admin-only:
// budget, scan_query, source, competitor, campaign, monitor_alert). D13.4a: nhóm này KHÔNG có khái
// niệm chủ sở hữu — Nhân viên thực thi (executor) bị chặn HOÀN TOÀN mọi hành động ghi (kể cả
// create), chỉ Admin/Super Admin (target role) hoặc super_admin/pr_staff (legacy) mới được sửa.
// User legacy 2-role giữ nguyên nhánh requirePerm cũ không đổi hành vi (đã có test ở
// integration-bookings-budgets.test.js/integration-monitor-1.test.js/integration-monitor-2.test.js
// — file này CHỈ test nhánh D13 target-role mới, không lặp lại coverage legacy).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

let baseUrl;
let cookie; // super_admin — dùng để dựng dữ liệu nền, không phải đối tượng test chính
let viewerCookie;
let executorCookie;
let targetAdminCookie; // D13 target role 'admin'
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
  const admin = fixtures.createPrivilegedUser({ username: `rbacb1_admin_${Date.now()}` });
  cookie = (await fixtures.login(baseUrl, { username: admin.username, password: admin.password })).cookie;
  const viewer = fixtures.createUser('viewer', { username: `rbacb1_viewer_${Date.now()}` });
  viewerCookie = (await fixtures.login(baseUrl, { username: viewer.username, password: viewer.password })).cookie;
  const executor = fixtures.createUser('executor', { username: `rbacb1_executor_${Date.now()}` });
  executorCookie = (await fixtures.login(baseUrl, { username: executor.username, password: executor.password })).cookie;
  const targetAdmin = fixtures.createUser('admin', { username: `rbacb1_target_admin_${Date.now()}` });
  targetAdminCookie = (await fixtures.login(baseUrl, { username: targetAdmin.username, password: targetAdmin.password })).cookie;
});

after(async () => {
  await resources.cleanupAll();
});

async function call(method, path, { body, auth = true, as = cookie, headers } = {}) {
  const opts = { method, headers: { ...(auth ? { cookie: as } : {}), ...(headers || {}) } };
  if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  return fetch(`${baseUrl}${path}`, opts);
}

// ---------------------------------------------------------------------------
// D13-025 — POST /api/budgets (module-admin-only, chỉ có action upsert, không có PUT/DELETE)
// ---------------------------------------------------------------------------
test('D13-025 budget: viewer POST trả 403', async () => {
  const res = await call('POST', '/api/budgets', { body: { period: '2026-08', amount: 1 }, as: viewerCookie });
  assert.equal(res.status, 403);
});
test('D13-025 budget: executor POST trả 403 (Module-admin-only — executor không được sửa ngân sách dù chỉ tạo mới)', async () => {
  const res = await call('POST', '/api/budgets', { body: { period: '2026-08', amount: 1 }, as: executorCookie });
  assert.equal(res.status, 403);
});
test('D13-025 budget: admin (target role) POST trả 200', async () => {
  const res = await call('POST', '/api/budgets', { body: { period: `2026-08`, amount: 12345 }, as: targetAdminCookie });
  assert.equal(res.status, 200);
});

// ---------------------------------------------------------------------------
// D13-026 — /api/monitor/queries (scan_query)
// ---------------------------------------------------------------------------
test('D13-026 scan_query: viewer create/edit/delete đều 403', async () => {
  assert.equal((await call('POST', '/api/monitor/queries', { body: { name: 'x' }, as: viewerCookie })).status, 403);
  assert.equal((await call('PUT', '/api/monitor/queries/1', { body: { name: 'x' }, as: viewerCookie })).status, 403);
  assert.equal((await call('DELETE', '/api/monitor/queries/1', { as: viewerCookie })).status, 403);
});
test('D13-026 scan_query: executor create/edit/delete đều 403 (Module-admin-only)', async () => {
  assert.equal((await call('POST', '/api/monitor/queries', { body: { name: 'x' }, as: executorCookie })).status, 403);
  assert.equal((await call('PUT', '/api/monitor/queries/1', { body: { name: 'x' }, as: executorCookie })).status, 403);
  assert.equal((await call('DELETE', '/api/monitor/queries/1', { as: executorCookie })).status, 403);
});
test('D13-026 scan_query: admin (target role) full CRUD trả 200', async () => {
  const created = await call('POST', '/api/monitor/queries', { body: { name: `RBAC-B1 query ${Date.now()}` }, as: targetAdminCookie });
  assert.equal(created.status, 200);
  const id = (await created.json()).id;
  assert.equal((await call('PUT', `/api/monitor/queries/${id}`, { body: { name: 'đã sửa' }, as: targetAdminCookie })).status, 200);
  assert.equal((await call('DELETE', `/api/monitor/queries/${id}`, { as: targetAdminCookie })).status, 200);
});

// ---------------------------------------------------------------------------
// D13-027 — /api/monitor/sources (source) — dùng URL an toàn mạng http://127.0.0.1:1 (refused ngay,
// không tạo request mạng thật ra ngoài — cùng pattern R122 trong integration-monitor-2.test.js)
// ---------------------------------------------------------------------------
test('D13-027 source: viewer create/edit/delete đều 403', async () => {
  assert.equal((await call('POST', '/api/monitor/sources', { body: { name: 'x', url: 'http://127.0.0.1:1/nofeed' }, as: viewerCookie })).status, 403);
  assert.equal((await call('PUT', '/api/monitor/sources/1', { body: { name: 'x' }, as: viewerCookie })).status, 403);
  assert.equal((await call('DELETE', '/api/monitor/sources/1', { as: viewerCookie })).status, 403);
});
test('D13-027 source: executor create/edit/delete đều 403 (Module-admin-only)', async () => {
  assert.equal((await call('POST', '/api/monitor/sources', { body: { name: 'x', url: 'http://127.0.0.1:1/nofeed' }, as: executorCookie })).status, 403);
  assert.equal((await call('PUT', '/api/monitor/sources/1', { body: { name: 'x' }, as: executorCookie })).status, 403);
  assert.equal((await call('DELETE', '/api/monitor/sources/1', { as: executorCookie })).status, 403);
});
test('D13-027 source: admin (target role) create — vượt qua cổng PolicyEngine, đi tiếp xuống lớp chặn SSRF (400, không phải 403)', async () => {
  // URL loopback bị chặn fail-closed bởi outbound.validateOutboundUrl (R122) bất kể vai trò — dùng
  // chính đặc điểm đó để phân biệt: PolicyEngine chặn (403, trước khi vào handler) khác với đã qua
  // cổng nhưng bị chặn SSRF ở bước sau (400, sau khi vào handler) — xem D13-027 viewer/executor 403 ở trên.
  const res = await call('POST', '/api/monitor/sources', { body: { name: `RBAC-B1 nguồn ${Date.now()}`, url: 'http://127.0.0.1:1/nofeed' }, as: targetAdminCookie });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /URL không được phép/);
});
test('D13-027 source: admin (target role) edit/delete trả 200 (dựng bản ghi nền trực tiếp qua DB, tránh phụ thuộc SSRF của bước tạo)', async () => {
  const { db } = require('../db');
  const id = db.prepare(`INSERT INTO sources (name, type, url, enabled, auto, mode) VALUES (?,?,?,1,0,'rss')`)
    .run('RBAC-B1 nguồn nền', 'news', 'http://127.0.0.1:1/base').lastInsertRowid;
  assert.equal((await call('PUT', `/api/monitor/sources/${id}`, { body: { name: 'đã sửa' }, as: targetAdminCookie })).status, 200);
  assert.equal((await call('DELETE', `/api/monitor/sources/${id}`, { as: targetAdminCookie })).status, 200);
});

// ---------------------------------------------------------------------------
// D13-028 — /api/monitor/competitors (competitor)
// ---------------------------------------------------------------------------
test('D13-028 competitor: viewer create/edit/delete đều 403', async () => {
  assert.equal((await call('POST', '/api/monitor/competitors', { body: { name: 'x' }, as: viewerCookie })).status, 403);
  assert.equal((await call('PUT', '/api/monitor/competitors/1', { body: { name: 'x' }, as: viewerCookie })).status, 403);
  assert.equal((await call('DELETE', '/api/monitor/competitors/1', { as: viewerCookie })).status, 403);
});
test('D13-028 competitor: executor create/edit/delete đều 403 (Module-admin-only)', async () => {
  assert.equal((await call('POST', '/api/monitor/competitors', { body: { name: 'x' }, as: executorCookie })).status, 403);
  assert.equal((await call('PUT', '/api/monitor/competitors/1', { body: { name: 'x' }, as: executorCookie })).status, 403);
  assert.equal((await call('DELETE', '/api/monitor/competitors/1', { as: executorCookie })).status, 403);
});
test('D13-028 competitor: admin (target role) full CRUD trả 200', async () => {
  const created = await call('POST', '/api/monitor/competitors', { body: { name: `RBAC-B1 đối thủ ${Date.now()}` }, as: targetAdminCookie });
  assert.equal(created.status, 200);
  const id = (await created.json()).id;
  assert.equal((await call('PUT', `/api/monitor/competitors/${id}`, { body: { name: 'đã sửa' }, as: targetAdminCookie })).status, 200);
  assert.equal((await call('DELETE', `/api/monitor/competitors/${id}`, { as: targetAdminCookie })).status, 200);
});

// ---------------------------------------------------------------------------
// D13-029 — /api/monitor/campaigns (campaign)
// ---------------------------------------------------------------------------
test('D13-029 campaign: viewer create/edit/delete đều 403', async () => {
  assert.equal((await call('POST', '/api/monitor/campaigns', { body: { name: 'x' }, as: viewerCookie })).status, 403);
  assert.equal((await call('PUT', '/api/monitor/campaigns/1', { body: { name: 'x' }, as: viewerCookie })).status, 403);
  assert.equal((await call('DELETE', '/api/monitor/campaigns/1', { as: viewerCookie })).status, 403);
});
test('D13-029 campaign: executor create/edit/delete đều 403 (Module-admin-only)', async () => {
  assert.equal((await call('POST', '/api/monitor/campaigns', { body: { name: 'x' }, as: executorCookie })).status, 403);
  assert.equal((await call('PUT', '/api/monitor/campaigns/1', { body: { name: 'x' }, as: executorCookie })).status, 403);
  assert.equal((await call('DELETE', '/api/monitor/campaigns/1', { as: executorCookie })).status, 403);
});
test('D13-029 campaign: admin (target role) full CRUD trả 200', async () => {
  const created = await call('POST', '/api/monitor/campaigns', { body: { name: `RBAC-B1 chiến dịch ${Date.now()}` }, as: targetAdminCookie });
  assert.equal(created.status, 200);
  const id = (await created.json()).id;
  assert.equal((await call('PUT', `/api/monitor/campaigns/${id}`, { body: { name: 'đã sửa' }, as: targetAdminCookie })).status, 200);
  assert.equal((await call('DELETE', `/api/monitor/campaigns/${id}`, { as: targetAdminCookie })).status, 200);
});

// ---------------------------------------------------------------------------
// D13-030 — POST /api/monitor/alerts/:id/read (monitor_alert — chỉ có action 'ack')
// ---------------------------------------------------------------------------
test('D13-030 monitor_alert: viewer/executor ack đều 403, admin (target role) trả 200', async () => {
  const { db } = require('../db');
  const r = db.prepare(`INSERT INTO monitor_alerts (level, title) VALUES ('warning','RBAC-B1 test')`).run();
  const id = r.lastInsertRowid;
  assert.equal((await call('POST', `/api/monitor/alerts/${id}/read`, { as: viewerCookie })).status, 403);
  assert.equal((await call('POST', `/api/monitor/alerts/${id}/read`, { as: executorCookie })).status, 403);
  assert.equal((await call('POST', `/api/monitor/alerts/${id}/read`, { as: targetAdminCookie })).status, 200);
});
