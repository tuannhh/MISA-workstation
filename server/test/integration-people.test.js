'use strict';
// G1A.3 (3/~12) — integration test HTTP cho nhóm "Nhân sự" (R029-R037): people CRUD, upload ảnh
// chân dung/giấy tờ tùy thân, đặt ảnh chính, xoá attachment, phục vụ file (download).
// Pattern giống integration-auth-admin.test.js/integration-partners.test.js.
//
// Khác nhóm partners: đây là module DUY NHẤT trong G1A.3 (ngoài admin/reports) có case
// "forbidden" THẬT với đúng 2 role hiện có — vì nhóm dữ liệu mật `iddoc` (giấy tờ tùy thân) gate
// riêng theo `senGroups(req).has('iddoc')`, và `pr_staff` có `canSeeSensitive=false` (rbac.js) nên
// KHÔNG có nhóm `iddoc` khi không có `sensitive_perms` override — dùng đúng đặc điểm này để test
// forbidden ở R034/R036/R037, không cần vai trò giả lập.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

let baseUrl;
let cookie; // super_admin — canSeeSensitive=true, có nhóm iddoc
let staffCookie; // pr_staff — canSeeSensitive=false, KHÔNG có nhóm iddoc
let viewerCookie;
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
  const admin = fixtures.createPrivilegedUser({ username: `people_admin_${Date.now()}` });
  cookie = (await fixtures.login(baseUrl, { username: admin.username, password: admin.password })).cookie;
  const staff = fixtures.createUser('pr_staff', { username: `people_staff_${Date.now()}` });
  staffCookie = (await fixtures.login(baseUrl, { username: staff.username, password: staff.password })).cookie;
  const viewer = fixtures.createUser('viewer', { username: `people_viewer_${Date.now()}` });
  viewerCookie = (await fixtures.login(baseUrl, { username: viewer.username, password: viewer.password })).cookie;
});

after(async () => {
  await resources.cleanupAll();
});

async function call(method, path, { body, auth = true, as = cookie, headers } = {}) {
  const opts = { method, headers: { ...(auth ? { cookie: as } : {}), ...(headers || {}) } };
  if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  return fetch(`${baseUrl}${path}`, opts);
}
async function uploadFiles(path, files, { as = cookie, auth = true } = {}) {
  const form = new FormData();
  for (const f of files) form.append('files', new Blob([f.content || 'x'], { type: f.type || 'image/png' }), f.name);
  const headers = auth ? { cookie: as } : {};
  return fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: form });
}
async function createPerson(overrides = {}) {
  const res = await call('POST', '/api/people', { body: { full_name: `Người ${Date.now()}_${Math.random()}`, ...overrides } });
  assert.equal(res.status, 200);
  return (await res.json()).id;
}

// ---------------------------------------------------------------------------
// R029 — GET /api/people
// ---------------------------------------------------------------------------
test('R029 happy: tìm được người vừa tạo qua search', async () => {
  const name = `Nhà báo Test ${Date.now()}`;
  await createPerson({ full_name: name });
  const res = await call('GET', `/api/people?search=${encodeURIComponent(name)}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.rows.some((r) => r.full_name === name));
});
test('R029 invalid CHARACTERIZATION: org_id không tồn tại -> rows rỗng, không lỗi', async () => {
  const res = await call('GET', '/api/people?org_id=9999999');
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).rows, []);
});
test('R029 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/people', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R030 — GET /api/people/:id (404 thật)
// ---------------------------------------------------------------------------
test('R030 happy: trả record + portraits/idDocs/interactions/gifts', async () => {
  const id = await createPerson();
  const res = await call('GET', `/api/people/${id}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.record.id, id);
  assert.ok(Array.isArray(body.portraits) && Array.isArray(body.idDocs) && Array.isArray(body.interactions) && Array.isArray(body.gifts));
});
test('R030 not-found: id không tồn tại trả 404 {error}', async () => {
  const res = await call('GET', '/api/people/9999999');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'Không tìm thấy');
});
test('R030 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/people/1', { auth: false })).status, 401);
});

test('D13-011 People Detail pilot: viewer only receives configured Public fields; related collections stay private', async () => {
  const id = await createPerson({ full_name: 'Viewer public name', phone_personal: '0900123456', bank_name: 'Restricted bank' });
  const { db } = require('../db');
  db.prepare('INSERT INTO field_visibility (module,field,is_public) VALUES (?,?,?)').run('partners', 'full_name', 1);
  const res = await call('GET', `/api/people/${id}`, { as: viewerCookie });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.record, { full_name: 'Viewer public name' });
  assert.deepEqual(body.interactions, []);
  assert.deepEqual(body.gifts, []);
  assert.equal('phone_personal' in body.record, false);
  assert.equal('bank_name' in body.record, false);
});

// ---------------------------------------------------------------------------
// R031 — POST /api/people
// ---------------------------------------------------------------------------
test('R031 happy: tạo người mới trả 200 + id', async () => {
  const id = await createPerson({ full_name: 'Người R031' });
  assert.ok(id);
});
test('R031 invalid: thiếu full_name (NOT NULL) -> lỗi DB, trả 400', async () => {
  const res = await call('POST', '/api/people', { body: { level: 'Phóng viên' } });
  assert.equal(res.status, 400);
});
test('R031 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/people', { auth: false, body: { full_name: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R032 — PUT /api/people/:id
// ---------------------------------------------------------------------------
test('R032 happy: sửa full_name, GET lại đúng giá trị mới', async () => {
  const id = await createPerson();
  assert.equal((await call('PUT', `/api/people/${id}`, { body: { full_name: 'Đã sửa R032' } })).status, 200);
  const detail = await (await call('GET', `/api/people/${id}`)).json();
  assert.equal(detail.record.full_name, 'Đã sửa R032');
});
test('R032 not-found CHARACTERIZATION: sửa id không tồn tại vẫn 200 {ok:true}', async () => {
  const res = await call('PUT', '/api/people/9999999', { body: { full_name: 'x' } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});
test('R032 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/people/1', { auth: false, body: { full_name: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R033 — DELETE /api/people/:id
// ---------------------------------------------------------------------------
test('R033 happy: xoá người, GET lại trả 404', async () => {
  const id = await createPerson();
  assert.equal((await call('DELETE', `/api/people/${id}`)).status, 200);
  assert.equal((await call('GET', `/api/people/${id}`)).status, 404);
});
test('R033 not-found CHARACTERIZATION: xoá id không tồn tại vẫn 200 {ok:true}', async () => {
  const res = await call('DELETE', '/api/people/9999999');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});
test('R033 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/people/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R034 — POST /api/people/:id/attachments (kind=portrait mặc định | id_doc qua query)
// ---------------------------------------------------------------------------
test('R034 happy: upload 1 ảnh chân dung, tự đặt làm ảnh chính', async () => {
  const id = await createPerson();
  const res = await uploadFiles(`/api/people/${id}/attachments`, [{ name: 'anh1.png' }]);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ids.length, 1);
  const detail = await (await call('GET', `/api/people/${id}`)).json();
  assert.equal(detail.portraits.length, 1);
  assert.equal(detail.portraits[0].is_primary, 1);
});
test('R034 happy: super_admin (có nhóm iddoc) upload giấy tờ tùy thân thành công', async () => {
  const id = await createPerson();
  const res = await uploadFiles(`/api/people/${id}/attachments?kind=id_doc`, [{ name: 'cccd.png' }]);
  assert.equal(res.status, 200);
  const detail = await (await call('GET', `/api/people/${id}`)).json();
  assert.equal(detail.idDocCount, 1);
});
test('R034 invalid: không gửi file nào trả 400', async () => {
  const id = await createPerson();
  const res = await uploadFiles(`/api/people/${id}/attachments`, []);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Không có file nào.');
});
test('R034 invalid: vượt quá 5 ảnh chân dung trả 400', async () => {
  const id = await createPerson();
  await uploadFiles(`/api/people/${id}/attachments`, [{ name: 'a.png' }, { name: 'b.png' }, { name: 'c.png' }]);
  const res = await uploadFiles(`/api/people/${id}/attachments`, [{ name: 'd.png' }, { name: 'e.png' }, { name: 'f.png' }]);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Tối đa 5 ảnh chân dung/);
});
test('R034 forbidden: pr_staff (không có nhóm iddoc) upload giấy tờ tùy thân trả 403', async () => {
  const id = await createPerson();
  const res = await uploadFiles(`/api/people/${id}/attachments?kind=id_doc`, [{ name: 'cccd.png' }], { as: staffCookie });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'Bạn không có quyền tải lên giấy tờ tùy thân (dữ liệu mật).');
});
test('R034 not-found CHARACTERIZATION: person_id không tồn tại -> vẫn 200 (route không kiểm người tồn tại trước khi insert attachment)', async () => {
  const res = await uploadFiles('/api/people/9999999/attachments', [{ name: 'anh.png' }]);
  assert.equal(res.status, 200);
});
test('R034 unauthenticated: không cookie trả 401', async () => {
  const res = await uploadFiles('/api/people/1/attachments', [{ name: 'x.png' }], { auth: false });
  assert.equal(res.status, 401);
});

// ---------------------------------------------------------------------------
// R035 — PUT /api/people/:id/attachments/:aid/primary (404 thật)
// ---------------------------------------------------------------------------
test('R035 happy: đặt ảnh thứ 2 làm ảnh chính, ảnh cũ hết primary', async () => {
  const id = await createPerson();
  const up = await (await uploadFiles(`/api/people/${id}/attachments`, [{ name: 'a.png' }, { name: 'b.png' }])).json();
  const secondId = up.ids[1];
  assert.equal((await call('PUT', `/api/people/${id}/attachments/${secondId}/primary`)).status, 200);
  const detail = await (await call('GET', `/api/people/${id}`)).json();
  assert.equal(detail.portraits.find((p) => p.id === secondId).is_primary, 1);
  assert.equal(detail.portraits.find((p) => p.id === up.ids[0]).is_primary, 0);
});
test('R035 not-found: aid không khớp person/kind trả 404 {error}', async () => {
  const id = await createPerson();
  const res = await call('PUT', `/api/people/${id}/attachments/9999999/primary`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'Không tìm thấy ảnh');
});
test('R035 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/people/1/attachments/1/primary', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R036 — DELETE /api/attachments/:aid (404 thật + gate iddoc)
// ---------------------------------------------------------------------------
test('R036 happy: xoá ảnh chân dung, ảnh còn lại tự thành primary', async () => {
  const id = await createPerson();
  const up = await (await uploadFiles(`/api/people/${id}/attachments`, [{ name: 'a.png' }, { name: 'b.png' }])).json();
  assert.equal((await call('DELETE', `/api/attachments/${up.ids[0]}`)).status, 200);
  const detail = await (await call('GET', `/api/people/${id}`)).json();
  assert.equal(detail.portraits.length, 1);
  assert.equal(detail.portraits[0].is_primary, 1);
});
test('R036 not-found: aid không tồn tại trả 404 {error}', async () => {
  const res = await call('DELETE', '/api/attachments/9999999');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'Không tìm thấy');
});
test('R036 forbidden: pr_staff xoá attachment kind=id_doc trả 403', async () => {
  const id = await createPerson();
  const up = await (await uploadFiles(`/api/people/${id}/attachments?kind=id_doc`, [{ name: 'cccd.png' }])).json();
  const res = await call('DELETE', `/api/attachments/${up.ids[0]}`, { as: staffCookie });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'Không đủ quyền');
});
test('R036 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/attachments/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R037 — GET /api/files/:id (requireAuth only, không requirePerm — vẫn gate riêng theo kind)
// ---------------------------------------------------------------------------
test('R037 happy: tải được file ảnh chân dung vừa upload, đúng content-type', async () => {
  const id = await createPerson();
  const up = await (await uploadFiles(`/api/people/${id}/attachments`, [{ name: 'a.png', type: 'image/png' }])).json();
  const res = await call('GET', `/api/files/${up.ids[0]}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /image\/png/);
});
test('R037 not-found: attachment id không tồn tại trả 404 {error}', async () => {
  const res = await call('GET', '/api/files/9999999');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'Không tìm thấy file');
});
test('R037 forbidden: pr_staff tải file kind=id_doc trả 403 (dù có thẻ requireAuth-only, vẫn gate iddoc riêng trong handler)', async () => {
  const id = await createPerson();
  const up = await (await uploadFiles(`/api/people/${id}/attachments?kind=id_doc`, [{ name: 'cccd.png' }])).json();
  const res = await call('GET', `/api/files/${up.ids[0]}`, { as: staffCookie });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'Không đủ quyền xem giấy tờ tùy thân');
});
test('R037 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/files/1', { auth: false })).status, 401);
});
