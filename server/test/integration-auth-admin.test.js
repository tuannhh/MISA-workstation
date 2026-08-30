'use strict';
// G1A.3 — integration test mức HTTP cho nhóm route auth + admin (R143,R144,R145,R099-R103).
// Dùng lại harness G1A.1 (app-harness/db-harness/fixtures/resource-stack) — xem server/test/smoke.test.js
// cho pattern gốc. Mỗi route tối thiểu: happy + invalid + unauthenticated + not-found (route nào
// không có :id hoặc không có khái niệm "invalid body" thì bỏ qua case đó có ghi chú tại sao).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

let baseUrl;
let admin; // super_admin — có quyền admin.*
let staff; // executor — KHÔNG có quyền admin.* (dùng để kiểm forbidden 403)
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

  admin = fixtures.createPrivilegedUser({ username: `auth_admin_${Date.now()}` });
  staff = fixtures.createUser('executor', { username: `auth_staff_${Date.now()}` });
});

after(async () => {
  await resources.cleanupAll();
});

async function loginAs(user) {
  const { cookie } = await fixtures.login(baseUrl, { username: user.username, password: user.password });
  return cookie;
}

// ---------------------------------------------------------------------------
// R143 — POST /api/login (public, không auth). Không có :id -> không có case
// not-found; "unauthenticated" không áp dụng vì route này CHÍNH LÀ đăng nhập.
// ---------------------------------------------------------------------------
test('R143 happy: đăng nhập đúng tài khoản trả 200 + user + permissions', async () => {
  const res = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: admin.username, password: admin.password }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user.username, admin.username);
  assert.ok(body.permissions);
});

test('R143 invalid: sai mật khẩu trả 401, không lộ chi tiết tài khoản có tồn tại hay không', async () => {
  const res = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: admin.username, password: 'sai-mat-khau' }),
  });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'Sai tài khoản hoặc mật khẩu.');
});

test('R143 invalid: thiếu username/password trả 401 (không 400/500)', async () => {
  const res = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 401);
});

// ---------------------------------------------------------------------------
// R144 — POST /api/logout (không có middleware requireAuth — auth.js:22). Không
// có :id -> không có not-found. "Unauthenticated" đặc tả là hành vi vẫn 200.
// ---------------------------------------------------------------------------
test('R144 happy: đăng xuất khi đang có session trả 200, session bị huỷ thật', async () => {
  const cookie = await loginAs(admin);
  const res = await fetch(`${baseUrl}/api/logout`, { method: 'POST', headers: { cookie } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });

  const me = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
  assert.equal(me.status, 401, 'cookie cũ phải không còn dùng được sau logout');
});

test('R144 CHARACTERIZATION (không phải bug — route không gắn requireAuth): logout không cookie vẫn trả 200 {ok:true}', async () => {
  const res = await fetch(`${baseUrl}/api/logout`, { method: 'POST' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

// ---------------------------------------------------------------------------
// R145 — GET /api/me (tự kiểm session trong handler, không có middleware).
// ---------------------------------------------------------------------------
test('R145 happy: có cookie hợp lệ trả đúng user + permissions', async () => {
  const cookie = await loginAs(admin);
  const res = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user.username, admin.username);
  assert.equal(body.user.role, 'super_admin');
});

test('R145 unauthenticated: không cookie trả 401', async () => {
  const res = await fetch(`${baseUrl}/api/me`);
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'Chưa đăng nhập');
});

// ---------------------------------------------------------------------------
// R099 — GET /api/admin/users (requirePerm admin,view)
// ---------------------------------------------------------------------------
test('R099 happy: super_admin xem được danh sách user + roles + sensitiveGroups', async () => {
  const cookie = await loginAs(admin);
  const res = await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.rows) && body.rows.some((r) => r.username === admin.username));
  assert.ok(body.roles && body.roles.super_admin);
  assert.ok(body.sensitiveGroups);
});

test('R099 unauthenticated: không cookie trả 401', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users`);
  assert.equal(res.status, 401);
});

test('R099 forbidden: executor không có quyền admin.view trả 403', async () => {
  const cookie = await loginAs(staff);
  const res = await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie } });
  assert.equal(res.status, 403);
});

// ---------------------------------------------------------------------------
// R100 — POST /api/admin/users (requirePerm admin,create)
// ---------------------------------------------------------------------------
test('R100 happy: tạo user mới hợp lệ trả 200 + id, đăng nhập được ngay', async () => {
  const cookie = await loginAs(admin);
  const uname = `r100_new_${Date.now()}`;
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ username: uname, password: 'pass-1234', full_name: 'R100 New', role: 'executor' }),
  });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).id);
  const login2 = await fetch(`${baseUrl}/api/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: uname, password: 'pass-1234' }),
  });
  assert.equal(login2.status, 200);
});

test('R100 invalid: thiếu full_name trả 400', async () => {
  const cookie = await loginAs(admin);
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ username: `r100_bad_${Date.now()}`, password: 'pass-1234', role: 'executor' }),
  });
  assert.equal(res.status, 400);
});

test('R100 invalid: username trùng trả 409', async () => {
  const cookie = await loginAs(admin);
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ username: admin.username, password: 'pass-1234', full_name: 'Trùng', role: 'executor' }),
  });
  assert.equal(res.status, 409);
});

test('R100 unauthenticated: không cookie trả 401', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'x', password: 'x', full_name: 'x', role: 'executor' }),
  });
  assert.equal(res.status, 401);
});

test('R100 forbidden: executor không có quyền admin.create trả 403', async () => {
  const cookie = await loginAs(staff);
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ username: `r100_forbid_${Date.now()}`, password: 'x', full_name: 'x', role: 'executor' }),
  });
  assert.equal(res.status, 403);
});

// ---------------------------------------------------------------------------
// R101 — PUT /api/admin/users/:id (requirePerm admin,edit)
// ---------------------------------------------------------------------------
test('R101 happy: sửa full_name của user khác, GET lại đúng giá trị mới', async () => {
  const cookie = await loginAs(admin);
  const target = fixtures.createUser('executor', { username: `r101_target_${Date.now()}` });
  const listBefore = await (await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie } })).json();
  const row = listBefore.rows.find((r) => r.username === target.username);

  const res = await fetch(`${baseUrl}/api/admin/users/${row.id}`, {
    method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ full_name: 'Đã sửa R101' }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });

  const listAfter = await (await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie } })).json();
  assert.equal(listAfter.rows.find((r) => r.id === row.id).full_name, 'Đã sửa R101');
});

test('R101 invalid: role không hợp lệ bị BỎ QUA lặng lẽ (đặc tả hiện trạng, không có lỗi 400)', async () => {
  const cookie = await loginAs(admin);
  const target = fixtures.createUser('executor', { username: `r101_badrole_${Date.now()}` });
  const list = await (await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie } })).json();
  const row = list.rows.find((r) => r.username === target.username);

  const res = await fetch(`${baseUrl}/api/admin/users/${row.id}`, {
    method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'role-khong-ton-tai' }),
  });
  assert.equal(res.status, 200, 'CHARACTERIZATION: routes.js không validate role -> vẫn 200 nhưng role KHÔNG đổi');
  const after2 = await (await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie } })).json();
  assert.equal(after2.rows.find((r) => r.id === row.id).role, 'executor');
});

test('R101 not-found CHARACTERIZATION: sửa id không tồn tại vẫn trả 200 {ok:true} (không có 404)', async () => {
  const cookie = await loginAs(admin);
  const res = await fetch(`${baseUrl}/api/admin/users/9999999`, {
    method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ full_name: 'khong ton tai' }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('R101 unauthenticated: không cookie trả 401', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users/1`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ full_name: 'x' }),
  });
  assert.equal(res.status, 401);
});

test('R101 forbidden: executor không có quyền admin.edit trả 403', async () => {
  const cookie = await loginAs(staff);
  const res = await fetch(`${baseUrl}/api/admin/users/1`, {
    method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ full_name: 'x' }),
  });
  assert.equal(res.status, 403);
});

// ---------------------------------------------------------------------------
// R102 — DELETE /api/admin/users/:id (requirePerm admin,delete)
// ---------------------------------------------------------------------------
test('R102 happy: xoá user khác thành công, không còn trong danh sách', async () => {
  const cookie = await loginAs(admin);
  const target = fixtures.createUser('executor', { username: `r102_del_${Date.now()}` });
  const list = await (await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie } })).json();
  const row = list.rows.find((r) => r.username === target.username);

  const res = await fetch(`${baseUrl}/api/admin/users/${row.id}`, { method: 'DELETE', headers: { cookie } });
  assert.equal(res.status, 200);
  const after2 = await (await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie } })).json();
  assert.ok(!after2.rows.some((r) => r.id === row.id));
});

test('R102 invalid: tự xoá chính mình trả 400', async () => {
  const cookie = await loginAs(admin);
  const list = await (await fetch(`${baseUrl}/api/admin/users`, { headers: { cookie } })).json();
  const self = list.rows.find((r) => r.username === admin.username);
  const res = await fetch(`${baseUrl}/api/admin/users/${self.id}`, { method: 'DELETE', headers: { cookie } });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Không thể xóa chính mình');
});

test('R102 not-found CHARACTERIZATION: xoá id không tồn tại vẫn trả 200 {ok:true} (không có 404)', async () => {
  const cookie = await loginAs(admin);
  const res = await fetch(`${baseUrl}/api/admin/users/9999998`, { method: 'DELETE', headers: { cookie } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('R102 unauthenticated: không cookie trả 401', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users/1`, { method: 'DELETE' });
  assert.equal(res.status, 401);
});

test('R102 forbidden: executor không có quyền admin.delete trả 403', async () => {
  const cookie = await loginAs(staff);
  const res = await fetch(`${baseUrl}/api/admin/users/1`, { method: 'DELETE', headers: { cookie } });
  assert.equal(res.status, 403);
});

// ---------------------------------------------------------------------------
// R103 — GET /api/admin/audit (requirePerm admin,view). Không có :id/body ->
// không có case invalid/not-found riêng.
// ---------------------------------------------------------------------------
test('R103 happy: sau khi login, audit log chứa bản ghi LOGIN mới nhất', async () => {
  const cookie = await loginAs(admin);
  const res = await fetch(`${baseUrl}/api/admin/audit`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.rows));
  assert.ok(body.rows.some((r) => r.action === 'LOGIN' && r.username === admin.username));
});

test('R103 unauthenticated: không cookie trả 401', async () => {
  const res = await fetch(`${baseUrl}/api/admin/audit`);
  assert.equal(res.status, 401);
});

test('R103 forbidden: executor không có quyền admin.view trả 403', async () => {
  const cookie = await loginAs(staff);
  const res = await fetch(`${baseUrl}/api/admin/audit`, { headers: { cookie } });
  assert.equal(res.status, 403);
});
