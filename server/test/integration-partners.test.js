'use strict';
// G1A.3 (2/~12) — integration test HTTP cho nhóm "Cơ quan đối tác" (R001-R028): assignable-users,
// organizations CRUD, sponsorships, agreements(+files), work-logs(+files), gifts, benefit-usages,
// association_fees(+remind). Harness/pattern giống server/test/integration-auth-admin.test.js.
//
// Ghi chú quan trọng áp dụng cho CẢ FILE: module `partners` trong rbac.js MATRIX cho pr_staff
// đủ quyền view/create/edit/delete GIỐNG super_admin (chỉ khác ở canSeeSensitive/org_fee) — với
// đúng 2 role hiện có, KHÔNG có role nào "đăng nhập được nhưng bị 403" trên module này. Vì vậy
// case "forbidden" của mọi route dưới đây = N/A (ghi rõ ở mapping), chỉ còn case
// happy/invalid/unauthenticated/not-found. Khi D13 (RBAC v2 nhiều role) lên Wave 1, phải bổ sung
// lại case forbidden thật.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

let baseUrl;
let cookie; // super_admin — đủ quyền org_fee để không phải rẽ nhánh mask tiền trong test này
let fixtures;
const resources = createResourceStack();

before(async () => {
  if (isMysql) {
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
  const admin = fixtures.createPrivilegedUser({ username: `partners_admin_${Date.now()}` });
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
  const res = await call('POST', '/api/partners', { body: { name: `Cơ quan ${Date.now()}_${Math.random()}`, org_type: 'press', ...overrides } });
  assert.equal(res.status, 200);
  return (await res.json()).id;
}

// ---------------------------------------------------------------------------
// R001 — GET /api/assignable-users
// ---------------------------------------------------------------------------
test('R001 happy: trả danh sách user đang hoạt động', async () => {
  const res = await call('GET', '/api/assignable-users');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray((await res.json()).rows));
});
test('R001 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/assignable-users', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R002 — GET /api/partners (list, phân trang, filter)
// ---------------------------------------------------------------------------
test('R002 happy: trả rows + total, tìm được org vừa tạo qua search', async () => {
  const name = `Báo Test ${Date.now()}`;
  await createOrg({ name });
  const res = await call('GET', `/api/partners?search=${encodeURIComponent(name)}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.rows.some((r) => r.name === name));
  assert.equal(typeof body.total, 'number');
});
test('R002 invalid CHARACTERIZATION: type lạ bị bỏ qua lặng lẽ (không lỗi, coi như không filter)', async () => {
  const res = await call('GET', '/api/partners?type=khong-hop-le');
  assert.equal(res.status, 200);
});
test('R002 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/partners', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R003 — GET /api/partners/:id (detail — CÓ 404 thật, khác đa số route dưới)
// ---------------------------------------------------------------------------
test('R003 happy: trả record + các mảng liên quan (people/sponsorships/...)', async () => {
  const id = await createOrg();
  const res = await call('GET', `/api/partners/${id}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.record.id, id);
  assert.ok(Array.isArray(body.people) && Array.isArray(body.sponsorships) && Array.isArray(body.agreements));
});
test('R003 not-found: id không tồn tại trả 404 {error}', async () => {
  const res = await call('GET', '/api/partners/9999999');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'Không tìm thấy');
});
test('R003 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/partners/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R004 — POST /api/partners
// ---------------------------------------------------------------------------
test('R004 happy: tạo org hợp lệ trả 200 + id', async () => {
  const id = await createOrg({ name: 'Org R004' });
  assert.ok(id);
});
test('R004 invalid: thiếu name (NOT NULL) -> lỗi DB rơi vào error handler chung, trả 400', async () => {
  const res = await call('POST', '/api/partners', { body: { org_type: 'press' } });
  assert.equal(res.status, 400);
});
test('R004 invalid CHARACTERIZATION: org_type lạ tự chuyển thành "other" (không lỗi)', async () => {
  const res = await call('POST', '/api/partners', { body: { name: 'Org type lạ', org_type: 'khong-ton-tai' } });
  assert.equal(res.status, 200);
  const id = (await res.json()).id;
  const detail = await (await call('GET', `/api/partners/${id}`)).json();
  assert.equal(detail.record.org_type, 'other');
});
test('R004 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/partners', { auth: false, body: { name: 'x', org_type: 'press' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R005 — PUT /api/partners/:id
// ---------------------------------------------------------------------------
test('R005 happy: sửa name, GET lại đúng giá trị mới', async () => {
  const id = await createOrg();
  const res = await call('PUT', `/api/partners/${id}`, { body: { name: 'Đã sửa R005', org_type: 'press' } });
  assert.equal(res.status, 200);
  const detail = await (await call('GET', `/api/partners/${id}`)).json();
  assert.equal(detail.record.name, 'Đã sửa R005');
});
test('R005 not-found CHARACTERIZATION: sửa id không tồn tại vẫn 200 {ok:true} (không 404)', async () => {
  const res = await call('PUT', '/api/partners/9999999', { body: { name: 'x', org_type: 'press' } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});
test('R005 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/partners/1', { auth: false, body: { name: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R006 — DELETE /api/partners/:id
// ---------------------------------------------------------------------------
test('R006 happy: xoá org, GET lại trả 404', async () => {
  const id = await createOrg();
  assert.equal((await call('DELETE', `/api/partners/${id}`)).status, 200);
  assert.equal((await call('GET', `/api/partners/${id}`)).status, 404);
});
test('R006 not-found CHARACTERIZATION: xoá id không tồn tại vẫn 200 {ok:true}', async () => {
  const res = await call('DELETE', '/api/partners/9999999');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});
test('R006 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/partners/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R007/R008/R009 — sponsorships
// ---------------------------------------------------------------------------
test('R007 happy: tạo sponsorship cho org trả 200 + id', async () => {
  const orgId = await createOrg();
  const res = await call('POST', `/api/partners/${orgId}/sponsorships`, { body: { title: 'Tài trợ A', amount: 1000000 } });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).id);
});
test('R007 invalid: thiếu title (NOT NULL) -> lỗi DB, trả 400', async () => {
  const orgId = await createOrg();
  const res = await call('POST', `/api/partners/${orgId}/sponsorships`, { body: { amount: 1000 } });
  assert.equal(res.status, 400);
});
test('R007 not-found CHARACTERIZATION: org_id không tồn tại — SQLite chặn (FK PRAGMA=ON, 400); MySQL KHÔNG chặn (cột `REFERENCES` inline không tạo FOREIGN KEY constraint thật trong translate(), insert mồ côi vẫn 200) — lệch hành vi 2 driver, ghi nhận cho G1A.5, không sửa ở đây', async () => {
  const res = await call('POST', '/api/partners/9999999/sponsorships', { body: { title: 'Tài trợ mồ côi' } });
  assert.equal(res.status, isMysql ? 200 : 400);
});
test('R007 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/partners/1/sponsorships', { auth: false, body: { title: 'x' } })).status, 401);
});

test('R008 happy: sửa sponsorship, GET org lại thấy giá trị mới', async () => {
  const orgId = await createOrg();
  const created = await (await call('POST', `/api/partners/${orgId}/sponsorships`, { body: { title: 'S1' } })).json();
  const res = await call('PUT', `/api/sponsorships/${created.id}`, { body: { title: 'S1-sửa' } });
  assert.equal(res.status, 200);
  const detail = await (await call('GET', `/api/partners/${orgId}`)).json();
  assert.equal(detail.sponsorships.find((s) => s.id === created.id).title, 'S1-sửa');
});
test('R008 not-found CHARACTERIZATION: sửa id không tồn tại vẫn 200 {ok:true}', async () => {
  assert.equal((await call('PUT', '/api/sponsorships/9999999', { body: { title: 'x' } })).status, 200);
});
test('R008 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/sponsorships/1', { auth: false, body: { title: 'x' } })).status, 401);
});

test('R009 happy: xoá sponsorship thành công', async () => {
  const orgId = await createOrg();
  const created = await (await call('POST', `/api/partners/${orgId}/sponsorships`, { body: { title: 'S-del' } })).json();
  assert.equal((await call('DELETE', `/api/sponsorships/${created.id}`)).status, 200);
  const detail = await (await call('GET', `/api/partners/${orgId}`)).json();
  assert.ok(!detail.sponsorships.some((s) => s.id === created.id));
});
test('R009 not-found CHARACTERIZATION: xoá id không tồn tại vẫn 200 {ok:true}', async () => {
  assert.equal((await call('DELETE', '/api/sponsorships/9999999')).status, 200);
});
test('R009 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/sponsorships/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R010/R011/R012 — agreements (MOU)
// ---------------------------------------------------------------------------
test('R010 happy: tạo agreement trả 200 + id', async () => {
  const orgId = await createOrg();
  const res = await call('POST', `/api/partners/${orgId}/agreements`, { body: { title: 'MOU A' } });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).id);
});
test('R010 invalid: thiếu title trả 400 (validate rõ ràng trong route, không phải lỗi DB)', async () => {
  const orgId = await createOrg();
  const res = await call('POST', `/api/partners/${orgId}/agreements`, { body: { signed_date: '2026-01-01' } });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Thiếu tên thỏa thuận');
});
test('R010 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/partners/1/agreements', { auth: false, body: { title: 'x' } })).status, 401);
});

test('R011 happy: sửa agreement thành công', async () => {
  const orgId = await createOrg();
  const created = await (await call('POST', `/api/partners/${orgId}/agreements`, { body: { title: 'MOU sửa' } })).json();
  assert.equal((await call('PUT', `/api/agreements/${created.id}`, { body: { title: 'MOU đã sửa' } })).status, 200);
});
test('R011 not-found CHARACTERIZATION: sửa id không tồn tại vẫn 200 {ok:true}', async () => {
  assert.equal((await call('PUT', '/api/agreements/9999999', { body: { title: 'x' } })).status, 200);
});
test('R011 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/agreements/1', { auth: false, body: { title: 'x' } })).status, 401);
});

test('R012 happy: xoá agreement (kèm dọn file vật lý qua delOwnerFiles) thành công', async () => {
  const orgId = await createOrg();
  const created = await (await call('POST', `/api/partners/${orgId}/agreements`, { body: { title: 'MOU xoá' } })).json();
  assert.equal((await call('DELETE', `/api/agreements/${created.id}`)).status, 200);
});
test('R012 not-found CHARACTERIZATION: xoá id không tồn tại vẫn 200 {ok:true}', async () => {
  assert.equal((await call('DELETE', '/api/agreements/9999999')).status, 200);
});
test('R012 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/agreements/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R013/R014/R015 — work-logs
// ---------------------------------------------------------------------------
test('R013 happy: tạo work-log trả 200 + id', async () => {
  const orgId = await createOrg();
  const res = await call('POST', `/api/partners/${orgId}/work-logs`, { body: { topic: 'Buổi làm việc A' } });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).id);
});
test('R013 invalid CHARACTERIZATION: không có field NOT NULL nào ngoài id -> body rỗng vẫn 200', async () => {
  const orgId = await createOrg();
  const res = await call('POST', `/api/partners/${orgId}/work-logs`, { body: {} });
  assert.equal(res.status, 200);
});
test('R013 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/partners/1/work-logs', { auth: false, body: {} })).status, 401);
});

test('R014 happy: sửa work-log thành công', async () => {
  const orgId = await createOrg();
  const created = await (await call('POST', `/api/partners/${orgId}/work-logs`, { body: { topic: 'WL' } })).json();
  assert.equal((await call('PUT', `/api/work-logs/${created.id}`, { body: { topic: 'WL sửa' } })).status, 200);
});
test('R014 not-found CHARACTERIZATION: sửa id không tồn tại vẫn 200 {ok:true}', async () => {
  assert.equal((await call('PUT', '/api/work-logs/9999999', { body: { topic: 'x' } })).status, 200);
});
test('R014 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/work-logs/1', { auth: false, body: { topic: 'x' } })).status, 401);
});

test('R015 happy: xoá work-log thành công', async () => {
  const orgId = await createOrg();
  const created = await (await call('POST', `/api/partners/${orgId}/work-logs`, { body: { topic: 'WL xoá' } })).json();
  assert.equal((await call('DELETE', `/api/work-logs/${created.id}`)).status, 200);
});
test('R015 not-found CHARACTERIZATION: xoá id không tồn tại vẫn 200 {ok:true}', async () => {
  assert.equal((await call('DELETE', '/api/work-logs/9999999')).status, 200);
});
test('R015 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/work-logs/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R016/R017 — upload file cho agreements/work-logs (multipart, field "files", tối đa 8)
// ---------------------------------------------------------------------------
async function uploadFiles(path, fieldFiles) {
  const form = new FormData();
  for (const f of fieldFiles) form.append('files', new Blob([f.content], { type: f.type || 'application/pdf' }), f.name);
  return fetch(`${baseUrl}${path}`, { method: 'POST', headers: { cookie }, body: form });
}
test('R016 happy: upload 1 file cho agreement trả 200 ok:true', async () => {
  const orgId = await createOrg();
  const ag = await (await call('POST', `/api/partners/${orgId}/agreements`, { body: { title: 'MOU file' } })).json();
  const res = await uploadFiles(`/api/agreements/${ag.id}/files`, [{ name: 'hopdong.pdf', content: 'noi-dung-pdf-gia' }]);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const detail = await (await call('GET', `/api/partners/${orgId}`)).json();
  assert.equal(detail.agreements.find((a) => a.id === ag.id).files.length, 1);
});
test('R016 invalid: không gửi file nào trả 400', async () => {
  const orgId = await createOrg();
  const ag = await (await call('POST', `/api/partners/${orgId}/agreements`, { body: { title: 'MOU no-file' } })).json();
  const res = await uploadFiles(`/api/agreements/${ag.id}/files`, []);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Không có file nào.');
});
test('R016 unauthenticated: không cookie trả 401', async () => {
  const form = new FormData();
  form.append('files', new Blob(['x']), 'a.pdf');
  const res = await fetch(`${baseUrl}/api/agreements/1/files`, { method: 'POST', body: form });
  assert.equal(res.status, 401);
});

test('R017 happy: upload file cho work-log trả 200 ok:true', async () => {
  const orgId = await createOrg();
  const wl = await (await call('POST', `/api/partners/${orgId}/work-logs`, { body: { topic: 'WL file' } })).json();
  const res = await uploadFiles(`/api/work-logs/${wl.id}/files`, [{ name: 'baocao.pdf', content: 'noi-dung' }]);
  assert.equal(res.status, 200);
});
test('R017 invalid: không gửi file nào trả 400', async () => {
  const orgId = await createOrg();
  const wl = await (await call('POST', `/api/partners/${orgId}/work-logs`, { body: { topic: 'WL no-file' } })).json();
  assert.equal((await uploadFiles(`/api/work-logs/${wl.id}/files`, [])).status, 400);
});
test('R017 unauthenticated: không cookie trả 401', async () => {
  const form = new FormData();
  form.append('files', new Blob(['x']), 'a.pdf');
  const res = await fetch(`${baseUrl}/api/work-logs/1/files`, { method: 'POST', body: form });
  assert.equal(res.status, 401);
});

// ---------------------------------------------------------------------------
// R018/R019/R020/R021 — gifts (owner=org qua R018, owner=person qua R019)
// ---------------------------------------------------------------------------
test('R018 happy: tặng quà cho org trả 200 + id', async () => {
  const orgId = await createOrg();
  const res = await call('POST', `/api/partners/${orgId}/gifts`, { body: { gift_type: 'Hoa', value: 500000 } });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).id);
});
test('R018 invalid CHARACTERIZATION: body rỗng vẫn 200 (owner_type/owner_id do server gán, không field nào bắt buộc từ client)', async () => {
  const orgId = await createOrg();
  assert.equal((await call('POST', `/api/partners/${orgId}/gifts`, { body: {} })).status, 200);
});
test('R018 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/partners/1/gifts', { auth: false, body: {} })).status, 401);
});

test('R019 happy: tặng quà cho person trả 200 + id (dùng org_id giả vì test này chỉ cần person tồn tại về mặt route, chưa cần bảng people)', async () => {
  // Route R019 không kiểm tra FK người nhận tồn tại ở tầng JS — chỉ INSERT owner_type='person'.
  const res = await call('POST', '/api/people/1/gifts', { body: { gift_type: 'Tiền mặt', value: 200000 } });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).id);
});
test('R019 not-found CHARACTERIZATION: person_id không tồn tại -> vẫn 200 (gifts.owner_id không có FK constraint tới people)', async () => {
  const res = await call('POST', '/api/people/9999999/gifts', { body: { gift_type: 'Hoa' } });
  assert.equal(res.status, 200);
});
test('R019 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/people/1/gifts', { auth: false, body: {} })).status, 401);
});

test('R020 happy: sửa quà tặng thành công', async () => {
  const orgId = await createOrg();
  const created = await (await call('POST', `/api/partners/${orgId}/gifts`, { body: { gift_type: 'Hoa' } })).json();
  assert.equal((await call('PUT', `/api/gifts/${created.id}`, { body: { gift_type: 'Quà' } })).status, 200);
});
test('R020 not-found CHARACTERIZATION: sửa id không tồn tại vẫn 200 {ok:true}', async () => {
  assert.equal((await call('PUT', '/api/gifts/9999999', { body: { gift_type: 'x' } })).status, 200);
});
test('R020 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/gifts/1', { auth: false, body: {} })).status, 401);
});

test('R021 happy: xoá quà tặng thành công', async () => {
  const orgId = await createOrg();
  const created = await (await call('POST', `/api/partners/${orgId}/gifts`, { body: { gift_type: 'Hoa' } })).json();
  assert.equal((await call('DELETE', `/api/gifts/${created.id}`)).status, 200);
});
test('R021 not-found CHARACTERIZATION: xoá id không tồn tại vẫn 200 {ok:true}', async () => {
  assert.equal((await call('DELETE', '/api/gifts/9999999')).status, 200);
});
test('R021 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/gifts/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R022/R023/R024 — benefit-usages
// ---------------------------------------------------------------------------
test('R022 happy: tạo benefit-usage trả 200 + id', async () => {
  const orgId = await createOrg();
  const res = await call('POST', `/api/partners/${orgId}/benefit-usages`, { body: { title: 'Đổi trang quảng cáo' } });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).id);
});
test('R022 invalid: thiếu title trả 400 (validate rõ ràng trong route)', async () => {
  const orgId = await createOrg();
  const res = await call('POST', `/api/partners/${orgId}/benefit-usages`, { body: { used_date: '2026-01-01' } });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Thiếu tiêu đề');
});
test('R022 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/partners/1/benefit-usages', { auth: false, body: { title: 'x' } })).status, 401);
});

test('R023 happy: sửa benefit-usage thành công', async () => {
  const orgId = await createOrg();
  const created = await (await call('POST', `/api/partners/${orgId}/benefit-usages`, { body: { title: 'BU' } })).json();
  assert.equal((await call('PUT', `/api/benefit-usages/${created.id}`, { body: { title: 'BU sửa' } })).status, 200);
});
test('R023 not-found CHARACTERIZATION: sửa id không tồn tại vẫn 200 {ok:true}', async () => {
  assert.equal((await call('PUT', '/api/benefit-usages/9999999', { body: { title: 'x' } })).status, 200);
});
test('R023 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/benefit-usages/1', { auth: false, body: { title: 'x' } })).status, 401);
});

test('R024 happy: xoá benefit-usage thành công', async () => {
  const orgId = await createOrg();
  const created = await (await call('POST', `/api/partners/${orgId}/benefit-usages`, { body: { title: 'BU xoá' } })).json();
  assert.equal((await call('DELETE', `/api/benefit-usages/${created.id}`)).status, 200);
});
test('R024 not-found CHARACTERIZATION: xoá id không tồn tại vẫn 200 {ok:true}', async () => {
  assert.equal((await call('DELETE', '/api/benefit-usages/9999999')).status, 200);
});
test('R024 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/benefit-usages/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R025/R026/R027/R028 — association_fees(+remind)
// ---------------------------------------------------------------------------
test('R025 happy: tạo hội phí năm trả 200 + id', async () => {
  const orgId = await createOrg();
  const res = await call('POST', `/api/partners/${orgId}/fees`, { body: { year: 2026, amount: 3000000 } });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).id);
});
test('R025 invalid CHARACTERIZATION: body rỗng vẫn 200 (year/amount đều nullable)', async () => {
  const orgId = await createOrg();
  assert.equal((await call('POST', `/api/partners/${orgId}/fees`, { body: {} })).status, 200);
});
test('R025 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/partners/1/fees', { auth: false, body: {} })).status, 401);
});

test('R026 happy: sửa hội phí thành công', async () => {
  const orgId = await createOrg();
  const created = await (await call('POST', `/api/partners/${orgId}/fees`, { body: { year: 2026, amount: 1000 } })).json();
  const res = await call('PUT', `/api/partners/${orgId}/fees/${created.id}`, { body: { status: 'Đã đóng' } });
  assert.equal(res.status, 200);
});
test('R026 not-found CHARACTERIZATION: sửa fid không tồn tại vẫn 200 {ok:true}', async () => {
  const orgId = await createOrg();
  assert.equal((await call('PUT', `/api/partners/${orgId}/fees/9999999`, { body: { status: 'Đã đóng' } })).status, 200);
});
test('R026 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/partners/1/fees/1', { auth: false, body: {} })).status, 401);
});

test('R027 happy: xoá hội phí thành công (đúng org_id+fid)', async () => {
  const orgId = await createOrg();
  const created = await (await call('POST', `/api/partners/${orgId}/fees`, { body: { year: 2026 } })).json();
  assert.equal((await call('DELETE', `/api/partners/${orgId}/fees/${created.id}`)).status, 200);
});
test('R027 not-found CHARACTERIZATION: xoá fid không tồn tại vẫn 200 {ok:true}', async () => {
  const orgId = await createOrg();
  assert.equal((await call('DELETE', `/api/partners/${orgId}/fees/9999999`)).status, 200);
});
test('R027 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/partners/1/fees/1', { auth: false })).status, 401);
});

test('R028 happy: nhắc hạn hội phí trả 200 + id (tạo important_dates)', async () => {
  const orgId = await createOrg();
  const created = await (await call('POST', `/api/partners/${orgId}/fees`, { body: { year: 2026, due_date: '2026-12-31' } })).json();
  const res = await call('POST', `/api/partners/${orgId}/fees/${created.id}/remind`, { body: { lead_days: 10 } });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).id);
});
test('R028 invalid: hội phí chưa có hạn đóng (due_date null) trả 400', async () => {
  const orgId = await createOrg();
  const created = await (await call('POST', `/api/partners/${orgId}/fees`, { body: { year: 2026 } })).json();
  const res = await call('POST', `/api/partners/${orgId}/fees/${created.id}/remind`, { body: {} });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Khoản hội phí chưa có hạn đóng.');
});
test('R028 not-found: fid không tồn tại -> f=null -> cùng nhánh 400 "chưa có hạn đóng"', async () => {
  const orgId = await createOrg();
  const res = await call('POST', `/api/partners/${orgId}/fees/9999999/remind`, { body: {} });
  assert.equal(res.status, 400);
});
test('R028 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/partners/1/fees/1/remind', { auth: false, body: {} })).status, 401);
});
