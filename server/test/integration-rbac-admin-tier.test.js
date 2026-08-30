'use strict';
// D13.1 (02-decisions.md §D.13.1): Admin (khác Super Admin) KHÔNG được quản trị tài khoản Admin/
// Super Admin (tạo/sửa/xoá) và KHÔNG được xem audit_log — chỉ Super Admin mới toàn quyền. Batch
// RBAC-CUTOVER (2026-08-30, cùng lúc bỏ hoàn toàn 2-role legacy) phát hiện MATRIX.admin ban đầu vô
// tình cấp full quyền module 'admin' giống hệt super_admin — vá bằng guard riêng trong từng route
// (server/routes.js POST/PUT/DELETE /admin/users, GET /admin/audit), không phải ở MATRIX thô.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

let baseUrl;
let superAdminCookie;
let adminCookie; // D13 'admin' (không phải super_admin)
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
  const superAdmin = fixtures.createPrivilegedUser({ username: `admtier_super_${Date.now()}` });
  superAdminCookie = (await fixtures.login(baseUrl, { username: superAdmin.username, password: superAdmin.password })).cookie;
  const admin = fixtures.createUser('admin', { username: `admtier_admin_${Date.now()}` });
  adminCookie = (await fixtures.login(baseUrl, { username: admin.username, password: admin.password })).cookie;
});

after(async () => {
  await resources.cleanupAll();
});

async function call(method, path, { body, auth = true, as = adminCookie, headers } = {}) {
  const opts = { method, headers: { ...(auth ? { cookie: as } : {}), ...(headers || {}) } };
  if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  return fetch(`${baseUrl}${path}`, opts);
}
function idOf(username) {
  const { db } = require('../db');
  return db.prepare('SELECT id FROM users WHERE username=?').get(username).id;
}

// ---------------------------------------------------------------------------
// D13-031 — POST /api/admin/users: Admin không tạo được tài khoản Admin/Super Admin
// ---------------------------------------------------------------------------
test('D13-031: admin tạo user role=admin trả 403', async () => {
  const res = await call('POST', '/api/admin/users', { body: { username: `d13031a_${Date.now()}`, password: 'x', full_name: 'x', role: 'admin' } });
  assert.equal(res.status, 403);
});
test('D13-031: admin tạo user role=super_admin trả 403', async () => {
  const res = await call('POST', '/api/admin/users', { body: { username: `d13031b_${Date.now()}`, password: 'x', full_name: 'x', role: 'super_admin' } });
  assert.equal(res.status, 403);
});
test('D13-031: admin tạo user role=executor/viewer vẫn trả 200 (chỉ chặn tạo Admin/Super Admin)', async () => {
  assert.equal((await call('POST', '/api/admin/users', { body: { username: `d13031c_${Date.now()}`, password: 'x', full_name: 'x', role: 'executor' } })).status, 200);
  assert.equal((await call('POST', '/api/admin/users', { body: { username: `d13031d_${Date.now()}`, password: 'x', full_name: 'x', role: 'viewer' } })).status, 200);
});
test('D13-031: super_admin tạo user role=admin/super_admin vẫn trả 200 (không bị ràng buộc này)', async () => {
  const res = await call('POST', '/api/admin/users', { body: { username: `d13031e_${Date.now()}`, password: 'x', full_name: 'x', role: 'super_admin' }, as: superAdminCookie });
  assert.equal(res.status, 200);
});

// ---------------------------------------------------------------------------
// D13-032 — PUT /api/admin/users/:id: Admin không sửa được tài khoản Admin/Super Admin KHÁC
// ---------------------------------------------------------------------------
test('D13-032: admin sửa 1 tài khoản super_admin khác trả 403 (kể cả không đổi role)', async () => {
  const target = fixtures.createPrivilegedUser({ username: `d13032a_${Date.now()}` });
  const res = await call('PUT', `/api/admin/users/${idOf(target.username)}`, { body: { full_name: 'Đổi tên' } });
  assert.equal(res.status, 403);
});
test('D13-032: admin sửa 1 tài khoản executor bình thường vẫn trả 200', async () => {
  const target = fixtures.createUser('executor', { username: `d13032b_${Date.now()}` });
  const res = await call('PUT', `/api/admin/users/${idOf(target.username)}`, { body: { full_name: 'Đổi tên' } });
  assert.equal(res.status, 200);
});
test('D13-032: admin nâng cấp 1 executor bình thường lên role=admin trả 403 (không được tự phong)', async () => {
  const target = fixtures.createUser('executor', { username: `d13032c_${Date.now()}` });
  const res = await call('PUT', `/api/admin/users/${idOf(target.username)}`, { body: { role: 'admin' } });
  assert.equal(res.status, 403);
});
test('D13-032: admin tự sửa chính mình (giữ nguyên role=admin) vẫn trả 200 (không phải leo thang)', async () => {
  const meRes = await call('GET', '/api/admin/users');
  const rows = (await meRes.json()).rows;
  const me = rows.find((r) => r.role === 'admin' && r.username.startsWith('admtier_admin_'));
  assert.ok(me, 'không tìm thấy chính user admin trong danh sách');
  const res = await call('PUT', `/api/admin/users/${me.id}`, { body: { full_name: 'Tên mới của chính mình', role: 'admin' } });
  assert.equal(res.status, 200);
});
test('D13-032: admin tự nâng cấp chính mình lên super_admin trả 403 (không được tự leo thang)', async () => {
  const meRes = await call('GET', '/api/admin/users');
  const rows = (await meRes.json()).rows;
  const me = rows.find((r) => r.role === 'admin' && r.username.startsWith('admtier_admin_'));
  const res = await call('PUT', `/api/admin/users/${me.id}`, { body: { role: 'super_admin' } });
  assert.equal(res.status, 403);
});

// ---------------------------------------------------------------------------
// D13-033 — DELETE /api/admin/users/:id: Admin không xoá được tài khoản Admin/Super Admin khác
// ---------------------------------------------------------------------------
test('D13-033: admin xoá 1 tài khoản super_admin khác trả 403', async () => {
  const target = fixtures.createPrivilegedUser({ username: `d13033a_${Date.now()}` });
  const res = await call('DELETE', `/api/admin/users/${idOf(target.username)}`);
  assert.equal(res.status, 403);
});
test('D13-033: admin xoá 1 tài khoản executor bình thường vẫn trả 200', async () => {
  const target = fixtures.createUser('executor', { username: `d13033b_${Date.now()}` });
  const res = await call('DELETE', `/api/admin/users/${idOf(target.username)}`);
  assert.equal(res.status, 200);
});

// ---------------------------------------------------------------------------
// D13-034 — GET /api/admin/audit: chỉ Super Admin xem được
// ---------------------------------------------------------------------------
test('D13-034: admin xem audit log trả 403', async () => {
  assert.equal((await call('GET', '/api/admin/audit')).status, 403);
});
test('D13-034: super_admin xem audit log trả 200', async () => {
  assert.equal((await call('GET', '/api/admin/audit', { as: superAdminCookie })).status, 200);
});
