'use strict';
// G1A.3 (3/~12) — integration test HTTP cho nhóm "Nhân sự" (R029-R037): people CRUD, upload ảnh
// chân dung/giấy tờ tùy thân, đặt ảnh chính, xoá attachment, phục vụ file (download).
// Pattern giống integration-auth-admin.test.js/integration-partners.test.js.
//
// Khác nhóm partners: đây là module DUY NHẤT trong G1A.3 (ngoài admin/reports) có case
// "forbidden" THẬT với đúng 2 role hiện có — vì nhóm dữ liệu mật `iddoc` (giấy tờ tùy thân) gate
// riêng theo `senGroups(req).has('iddoc')`, và `executor` có `canSeeSensitive=false` (rbac.js) nên
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
let staffCookie; // executor — canSeeSensitive=false, KHÔNG có nhóm iddoc
let viewerCookie;
let executorCookie; // D13 target role — Global edit trên people, KHÔNG có quyền delete
let targetAdminCookie; // D13 target role 'admin' — khác legacy 'super_admin' fixture (cookie)
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
  const staff = fixtures.createUser('executor', { username: `people_staff_${Date.now()}` });
  staffCookie = (await fixtures.login(baseUrl, { username: staff.username, password: staff.password })).cookie;
  const viewer = fixtures.createUser('viewer', { username: `people_viewer_${Date.now()}` });
  viewerCookie = (await fixtures.login(baseUrl, { username: viewer.username, password: viewer.password })).cookie;
  const executor = fixtures.createUser('executor', { username: `people_executor_${Date.now()}` });
  executorCookie = (await fixtures.login(baseUrl, { username: executor.username, password: executor.password })).cookie;
  const targetAdmin = fixtures.createUser('admin', { username: `people_target_admin_${Date.now()}` });
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

test('D13-011 People Detail pilot: viewer thay field Public mac dinh (D13.2b), field mat van an; collection lien quan van rong', async () => {
  const id = await createPerson({ full_name: 'Viewer public name', phone_personal: '0900123456', bank_name: 'Restricted bank' });
  const res = await call('GET', `/api/people/${id}`, { as: viewerCookie });
  assert.equal(res.status, 200);
  const body = await res.json();
  // Field Public (khong thuoc nhom mat nao) mac dinh HIEN THI, khong can field_visibility rieng
  // -- sua P0 2026-08-30: truoc day moi field Public deu bi an mac dinh (chi full_name duoc demo
  // qua toggle thu cong), khien executor/viewer thay record gan nhu rong hoan toan tren production.
  assert.equal(body.record.id, id);
  assert.equal(body.record.full_name, 'Viewer public name');
  assert.deepEqual(body.interactions, []);
  assert.deepEqual(body.gifts, []);
  assert.equal('phone_personal' in body.record, false);
  assert.equal('bank_name' in body.record, false);
});

test('D13-011b field_visibility SIET field Public xuong private cho viewer (D13.2b: chi duoc siet, khong duoc noi)', async () => {
  const id = await createPerson({ full_name: 'Ten se bi siet an' });
  const { db } = require('../db');
  const { createVisibilityStore } = require('../policy-visibility-store');
  const store = createVisibilityStore(db);
  store.setPublic({ module: 'partners', field: 'full_name', isPublic: false, principal: { id: 1, role: 'super_admin' } });
  try {
    const res = await call('GET', `/api/people/${id}`, { as: viewerCookie });
    const body = await res.json();
    assert.equal('full_name' in body.record, false);
    assert.equal(body.record.id, id); // field Public khac khong bi anh huong boi cau hinh rieng full_name
  } finally {
    db.prepare("DELETE FROM field_visibility WHERE module='partners' AND field='full_name'").run();
  }
});

test('D13-012 People Detail pilot write: viewer PUT/DELETE đều 403 (không được sửa/xoá gì)', async () => {
  const id = await createPerson();
  const putRes = await call('PUT', `/api/people/${id}`, { body: { full_name: 'x' }, as: viewerCookie });
  assert.equal(putRes.status, 403);
  const delRes = await call('DELETE', `/api/people/${id}`, { as: viewerCookie });
  assert.equal(delRes.status, 403);
});

test('D13-013 People Detail pilot write: executor PUT sửa được (Global edit, không cần là owner vì people không có owner_id)', async () => {
  const id = await createPerson({ full_name: 'Trước khi executor sửa' });
  const res = await call('PUT', `/api/people/${id}`, { body: { full_name: 'Executor đã sửa' }, as: executorCookie });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const detail = await (await call('GET', `/api/people/${id}`, { as: targetAdminCookie })).json();
  assert.equal(detail.record.full_name, 'Executor đã sửa');
});

test('D13-014 People Detail pilot write: executor DELETE trả 403 (D13.1: Nhân viên thực thi không có quyền xoá dù là Global)', async () => {
  const id = await createPerson();
  const res = await call('DELETE', `/api/people/${id}`, { as: executorCookie });
  assert.equal(res.status, 403);
  const detail = await call('GET', `/api/people/${id}`, { as: targetAdminCookie });
  assert.equal(detail.status, 200); // vẫn còn tồn tại, không bị xoá
});

test('D13-015 People Detail pilot write: admin (target role) PUT + DELETE đều 200 (full CRUD)', async () => {
  const id = await createPerson({ full_name: 'Trước khi admin sửa' });
  const putRes = await call('PUT', `/api/people/${id}`, { body: { full_name: 'Admin đã sửa' }, as: targetAdminCookie });
  assert.equal(putRes.status, 200);
  const detail = await (await call('GET', `/api/people/${id}`, { as: targetAdminCookie })).json();
  assert.equal(detail.record.full_name, 'Admin đã sửa');
  const delRes = await call('DELETE', `/api/people/${id}`, { as: targetAdminCookie });
  assert.equal(delRes.status, 200);
  assert.equal((await call('GET', `/api/people/${id}`, { as: targetAdminCookie })).status, 404);
});

// ---------------------------------------------------------------------------
// D13-083 — batch W1.POLICY.2 (dọn cơ chế mask cũ list): GET /people (list) nay qua
// projectRecord() giống detail (D13-011), trước đây dùng rbac.maskList/senGroups
// (SUPERSEDED bởi D13, 02-decisions.md O7)
// ---------------------------------------------------------------------------
test('D13-083: GET /people (list) viewer thấy field Public nhưng bank_name/phone_personal (Confidential/Restricted) vẫn ẩn, admin thấy đủ', async () => {
  const full_name = `Người D13-083 ${Date.now()}`;
  await createPerson({ full_name, bank_name: 'Ngân hàng mật D13-083', phone_personal: '0900111222' });
  const viewerRes = await call('GET', `/api/people?search=${encodeURIComponent(full_name)}`, { as: viewerCookie });
  assert.equal(viewerRes.status, 200);
  const viewerRow = (await viewerRes.json()).rows.find((r) => r.full_name === full_name);
  assert.ok(viewerRow);
  assert.equal('bank_name' in viewerRow, false);
  assert.equal('phone_personal' in viewerRow, false);
  const adminRes = await call('GET', `/api/people?search=${encodeURIComponent(full_name)}`, { as: targetAdminCookie });
  const adminRow = (await adminRes.json()).rows.find((r) => r.full_name === full_name);
  assert.equal(adminRow.bank_name, 'Ngân hàng mật D13-083');
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
test('R034 forbidden: executor (không có nhóm iddoc) upload giấy tờ tùy thân trả 403', async () => {
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
test('R036 forbidden: executor xoá attachment kind=id_doc trả 403', async () => {
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
test('R037 forbidden: executor tải file kind=id_doc trả 403 (dù có thẻ requireAuth-only, vẫn gate iddoc riêng trong handler)', async () => {
  const id = await createPerson();
  const up = await (await uploadFiles(`/api/people/${id}/attachments?kind=id_doc`, [{ name: 'cccd.png' }])).json();
  const res = await call('GET', `/api/files/${up.ids[0]}`, { as: staffCookie });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'Không đủ quyền xem giấy tờ tùy thân');
});
test('R037 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/files/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// D13 People Detail file pilot (W1.FILE, batch RBAC-PILOT3-people-file) — R034-R037
// role D13 mới đi qua PolicyEngine/policy-engine attachment ceiling, legacy 2-role không đổi.
// ---------------------------------------------------------------------------
test('D13-016 People Detail file pilot: viewer upload/set-primary/delete đều 403 (không có quyền edit)', async () => {
  const id = await createPerson();
  const up = await uploadFiles(`/api/people/${id}/attachments`, [{ name: 'a.png' }], { as: targetAdminCookie });
  const aid = (await up.json()).ids[0];
  assert.equal((await uploadFiles(`/api/people/${id}/attachments`, [{ name: 'b.png' }], { as: viewerCookie })).status, 403);
  assert.equal((await call('PUT', `/api/people/${id}/attachments/${aid}/primary`, { as: viewerCookie })).status, 403);
  assert.equal((await call('DELETE', `/api/attachments/${aid}`, { as: viewerCookie })).status, 403);
});

test('D13-017 People Detail file pilot: executor upload ảnh mặc định private -> chính executor cũng KHÔNG thấy lại (person là Global, không có owner bypass)', async () => {
  const id = await createPerson();
  const res = await uploadFiles(`/api/people/${id}/attachments`, [{ name: 'a.png' }], { as: executorCookie });
  assert.equal(res.status, 200);
  const detail = await (await call('GET', `/api/people/${id}`, { as: executorCookie })).json();
  assert.deepEqual(detail.portraits, []);
  const asAdmin = await (await call('GET', `/api/people/${id}`, { as: targetAdminCookie })).json();
  assert.equal(asAdmin.portraits.length, 1);
});

test('D13-018 People Detail file pilot: executor upload ảnh với visibility=public -> chính executor thấy lại được', async () => {
  const id = await createPerson();
  const res = await uploadFiles(`/api/people/${id}/attachments?visibility=public`, [{ name: 'a.png' }], { as: executorCookie });
  assert.equal(res.status, 200);
  const detail = await (await call('GET', `/api/people/${id}`, { as: executorCookie })).json();
  assert.equal(detail.portraits.length, 1);
});

test('D13-019 People Detail file pilot: executor upload giấy tờ tùy thân trả 403 (chỉ Admin/Super Admin, D13.3b trần private)', async () => {
  const id = await createPerson();
  const res = await uploadFiles(`/api/people/${id}/attachments?kind=id_doc`, [{ name: 'cccd.png' }], { as: executorCookie });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'Bạn không có quyền tải lên giấy tờ tùy thân (dữ liệu mật).');
});

test('D13-020 People Detail file pilot: admin (target role) upload id_doc thành công, executor thấy idDocCount nhưng KHÔNG thấy nội dung', async () => {
  const id = await createPerson();
  const res = await uploadFiles(`/api/people/${id}/attachments?kind=id_doc`, [{ name: 'cccd.png' }], { as: targetAdminCookie });
  assert.equal(res.status, 200);
  const asExecutor = await (await call('GET', `/api/people/${id}`, { as: executorCookie })).json();
  assert.equal(asExecutor.idDocCount, 1);
  assert.deepEqual(asExecutor.idDocs, []);
  const asAdmin = await (await call('GET', `/api/people/${id}`, { as: targetAdminCookie })).json();
  assert.equal(asAdmin.idDocs.length, 1);
});

test('D13-021 People Detail file pilot: admin (target role) upload id_doc kèm visibility=public vẫn trả 400 (trần D13.3b private cứng, không có ngoại lệ Admin)', async () => {
  const id = await createPerson();
  const res = await uploadFiles(`/api/people/${id}/attachments?kind=id_doc&visibility=public`, [{ name: 'cccd.png' }], { as: targetAdminCookie });
  assert.equal(res.status, 400);
});

test('D13-022 People Detail file pilot: GET /api/files/:id — executor 403 trên id_doc, 200 trên portrait public; admin 200 trên cả hai', async () => {
  const id = await createPerson();
  const idDocUp = await (await uploadFiles(`/api/people/${id}/attachments?kind=id_doc`, [{ name: 'cccd.png' }], { as: targetAdminCookie })).json();
  const portraitUp = await (await uploadFiles(`/api/people/${id}/attachments?visibility=public`, [{ name: 'a.png' }], { as: executorCookie })).json();
  assert.equal((await call('GET', `/api/files/${idDocUp.ids[0]}`, { as: executorCookie })).status, 403);
  assert.equal((await call('GET', `/api/files/${portraitUp.ids[0]}`, { as: executorCookie })).status, 200);
  assert.equal((await call('GET', `/api/files/${idDocUp.ids[0]}`, { as: targetAdminCookie })).status, 200);
});

test('D13-023 People Detail file pilot: executor set-primary/delete ảnh chân dung OK (Global edit); DELETE giấy tờ tùy thân vẫn 403', async () => {
  const id = await createPerson();
  const up = await (await uploadFiles(`/api/people/${id}/attachments`, [{ name: 'a.png' }, { name: 'b.png' }], { as: executorCookie })).json();
  assert.equal((await call('PUT', `/api/people/${id}/attachments/${up.ids[1]}/primary`, { as: executorCookie })).status, 200);
  assert.equal((await call('DELETE', `/api/attachments/${up.ids[0]}`, { as: executorCookie })).status, 200);
  const idDocUp = await (await uploadFiles(`/api/people/${id}/attachments?kind=id_doc`, [{ name: 'cccd.png' }], { as: targetAdminCookie })).json();
  assert.equal((await call('DELETE', `/api/attachments/${idDocUp.ids[0]}`, { as: executorCookie })).status, 403);
});

test('D13-024 People Detail file pilot: DELETE /api/attachments/:aid fail-closed 403 khi owner_type khác person (chưa có policy slice riêng)', async () => {
  const { db } = require('../db');
  const r = db.prepare(`INSERT INTO attachments (owner_type, owner_id, kind, filename, original_name, mime)
    VALUES ('award', 1, 'file', 'x.png', 'x.png', 'image/png')`).run();
  const res = await call('DELETE', `/api/attachments/${r.lastInsertRowid}`, { as: targetAdminCookie });
  assert.equal(res.status, 403);
});
