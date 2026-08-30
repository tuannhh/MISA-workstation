'use strict';
// G1A.3 Batch "suppliers" (1/1) — integration test HTTP cho nhóm "Nhà cung cấp" (R072-R086):
// CRUD suppliers, liên hệ (contacts), giao dịch (transactions), báo giá (quotes), upload tài liệu.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

let baseUrl;
let cookie;
let viewerCookie; // D13 target role
let executorCookie; // D13 target role — Global edit, KHÔNG có quyền delete
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
  const admin = fixtures.createPrivilegedUser({ username: `suppliers_admin_${Date.now()}` });
  cookie = (await fixtures.login(baseUrl, { username: admin.username, password: admin.password })).cookie;
  const viewer = fixtures.createUser('viewer', { username: `suppliers_viewer_${Date.now()}` });
  viewerCookie = (await fixtures.login(baseUrl, { username: viewer.username, password: viewer.password })).cookie;
  const executor = fixtures.createUser('executor', { username: `suppliers_executor_${Date.now()}` });
  executorCookie = (await fixtures.login(baseUrl, { username: executor.username, password: executor.password })).cookie;
  const targetAdmin = fixtures.createUser('admin', { username: `suppliers_target_admin_${Date.now()}` });
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
  for (const f of files) form.append('files', new Blob([f.content || 'x'], { type: f.type || 'application/pdf' }), f.name);
  const headers = auth ? { cookie: as } : {};
  return fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: form });
}
async function createSupplier(overrides = {}) {
  const res = await call('POST', '/api/suppliers', { body: { name: `NCC ${Date.now()}_${Math.random()}`, ...overrides } });
  assert.equal(res.status, 200);
  return (await res.json()).id;
}

// ---------------------------------------------------------------------------
// R072 — GET /api/suppliers
// ---------------------------------------------------------------------------
test('R072 happy: tìm theo name/services/tax_code/address/industry/contact_phone/contact_email, lọc industry, phân trang', async () => {
  const name = `NCC Tìm Test ${Date.now()}`;
  const id = await createSupplier({ name, industry: 'In ấn' });
  const res = await call('GET', `/api/suppliers?search=${encodeURIComponent(name)}&industry=In`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.rows.some((r) => r.id === id));
  assert.equal(typeof body.total, 'number');
});
test('R072 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/suppliers', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R073 — GET /api/suppliers/list (chỉ id+name, phục vụ dropdown)
// ---------------------------------------------------------------------------
test('R073 happy: trả toàn bộ NCC dạng {id, name}, sắp theo tên', async () => {
  const id = await createSupplier({ name: `NCC List ${Date.now()}` });
  const res = await call('GET', '/api/suppliers/list');
  assert.equal(res.status, 200);
  const rows = (await res.json()).rows;
  assert.ok(rows.some((r) => r.id === id));
  assert.ok(!('address' in rows[0]));
});
test('R073 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/suppliers/list', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R074 — GET /api/suppliers/:id
// ---------------------------------------------------------------------------
test('R074 happy: trả record + quotes + files + transactions + dates + contacts', async () => {
  const id = await createSupplier();
  const res = await call('GET', `/api/suppliers/${id}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.record.id, id);
  assert.ok(Array.isArray(body.quotes) && Array.isArray(body.transactions) && Array.isArray(body.contacts));
});
test('R074 not-found: id không tồn tại trả 404', async () => {
  const res = await call('GET', '/api/suppliers/9999999');
  assert.equal(res.status, 404);
});
test('R074 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/suppliers/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R075 — POST /api/suppliers/:id/contacts
// ---------------------------------------------------------------------------
test('R075 happy: tạo liên hệ NCC trả 200 + id', async () => {
  const id = await createSupplier();
  const res = await call('POST', `/api/suppliers/${id}/contacts`, { body: { full_name: 'Nguyễn Văn A', phone: '0900000000' } });
  assert.equal(res.status, 200);
  const contacts = (await (await call('GET', `/api/suppliers/${id}`)).json()).contacts;
  assert.equal(contacts.length, 1);
});
test('R075 not-found: supplier_id không tồn tại bị FK chặn, trả 400 (F15 đã sửa — MySQL nay có FOREIGN KEY thật, đồng nhất SQLite)', async () => {
  const res = await call('POST', '/api/suppliers/9999999/contacts', { body: { full_name: 'x' } });
  assert.equal(res.status, 400);
});
test('R075 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/suppliers/1/contacts', { auth: false, body: { full_name: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R076 — PUT /api/suppliers/:id/contacts/:cid
// ---------------------------------------------------------------------------
test('R076 happy: cập nhật liên hệ trả 200 và thay đổi được ghi nhận', async () => {
  const id = await createSupplier();
  const cid = (await (await call('POST', `/api/suppliers/${id}/contacts`, { body: { full_name: 'A' } })).json()).id;
  const res = await call('PUT', `/api/suppliers/${id}/contacts/${cid}`, { body: { full_name: 'B' } });
  assert.equal(res.status, 200);
  const contacts = (await (await call('GET', `/api/suppliers/${id}`)).json()).contacts;
  assert.equal(contacts.find((c) => c.id === cid).full_name, 'B');
});
test('R076 not-found CHARACTERIZATION: cid không tồn tại vẫn trả 200 {ok:true} (UPDATE 0 dòng không lỗi)', async () => {
  const res = await call('PUT', '/api/suppliers/1/contacts/9999999', { body: { full_name: 'x' } });
  assert.equal(res.status, 200);
});
test('R076 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/suppliers/1/contacts/1', { auth: false, body: { full_name: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R077 — DELETE /api/suppliers/:id/contacts/:cid
// ---------------------------------------------------------------------------
test('R077 happy: xoá liên hệ trả 200, không còn trong danh sách', async () => {
  const id = await createSupplier();
  const cid = (await (await call('POST', `/api/suppliers/${id}/contacts`, { body: { full_name: 'A' } })).json()).id;
  const res = await call('DELETE', `/api/suppliers/${id}/contacts/${cid}`);
  assert.equal(res.status, 200);
  const contacts = (await (await call('GET', `/api/suppliers/${id}`)).json()).contacts;
  assert.ok(!contacts.some((c) => c.id === cid));
});
test('R077 not-found CHARACTERIZATION: cid không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/suppliers/1/contacts/9999999');
  assert.equal(res.status, 200);
});
test('R077 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/suppliers/1/contacts/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R078 — POST /api/suppliers/:id/transactions
// ---------------------------------------------------------------------------
test('R078 happy: tạo giao dịch trả 200 + id', async () => {
  const id = await createSupplier();
  const res = await call('POST', `/api/suppliers/${id}/transactions`, { body: { service_type: 'In ấn', value: 5000000, contract_no: 'HD001' } });
  assert.equal(res.status, 200);
  const trans = (await (await call('GET', `/api/suppliers/${id}`)).json()).transactions;
  assert.equal(trans.length, 1);
});
test('R078 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/suppliers/1/transactions', { auth: false, body: {} })).status, 401);
});

// ---------------------------------------------------------------------------
// R079 — PUT /api/suppliers/:id/transactions/:tid
// ---------------------------------------------------------------------------
test('R079 happy: cập nhật giao dịch trả 200 và thay đổi được ghi nhận', async () => {
  const id = await createSupplier();
  const tid = (await (await call('POST', `/api/suppliers/${id}/transactions`, { body: { contract_no: 'HD001' } })).json()).id;
  const res = await call('PUT', `/api/suppliers/${id}/transactions/${tid}`, { body: { contract_no: 'HD002', status: 'Đã hoàn thành' } });
  assert.equal(res.status, 200);
  const trans = (await (await call('GET', `/api/suppliers/${id}`)).json()).transactions;
  assert.equal(trans.find((t) => t.id === tid).contract_no, 'HD002');
});
test('R079 not-found CHARACTERIZATION: tid không tồn tại vẫn trả 200 {ok:true} (UPDATE 0 dòng không lỗi)', async () => {
  const res = await call('PUT', '/api/suppliers/1/transactions/9999999', { body: { contract_no: 'x' } });
  assert.equal(res.status, 200);
});
test('R079 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/suppliers/1/transactions/1', { auth: false, body: {} })).status, 401);
});

// ---------------------------------------------------------------------------
// R080 — DELETE /api/suppliers/:id/transactions/:tid
// ---------------------------------------------------------------------------
test('R080 happy: xoá giao dịch trả 200, không còn trong danh sách', async () => {
  const id = await createSupplier();
  const tid = (await (await call('POST', `/api/suppliers/${id}/transactions`, { body: { contract_no: 'HD001' } })).json()).id;
  const res = await call('DELETE', `/api/suppliers/${id}/transactions/${tid}`);
  assert.equal(res.status, 200);
  const trans = (await (await call('GET', `/api/suppliers/${id}`)).json()).transactions;
  assert.ok(!trans.some((t) => t.id === tid));
});
test('R080 not-found CHARACTERIZATION: tid không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/suppliers/1/transactions/9999999');
  assert.equal(res.status, 200);
});
test('R080 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/suppliers/1/transactions/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R081 — POST /api/suppliers
// ---------------------------------------------------------------------------
test('R081 happy: tạo NCC hợp lệ trả 200 + id', async () => {
  const id = await createSupplier({ name: 'Công ty In ấn ABC' });
  const res = await call('GET', `/api/suppliers/${id}`);
  assert.equal((await res.json()).record.name, 'Công ty In ấn ABC');
});
test('R081 invalid: thiếu name (NOT NULL) trả 400', async () => {
  const res = await call('POST', '/api/suppliers', { body: { address: 'x' } });
  assert.equal(res.status, 400);
});
test('R081 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/suppliers', { auth: false, body: { name: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R082 — PUT /api/suppliers/:id
// ---------------------------------------------------------------------------
test('R082 happy: cập nhật NCC trả 200 và thay đổi được ghi nhận', async () => {
  const id = await createSupplier();
  const res = await call('PUT', `/api/suppliers/${id}`, { body: { name: 'Đã sửa tên NCC' } });
  assert.equal(res.status, 200);
  const rec = (await (await call('GET', `/api/suppliers/${id}`)).json()).record;
  assert.equal(rec.name, 'Đã sửa tên NCC');
});
test('R082 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (UPDATE 0 dòng không lỗi)', async () => {
  const res = await call('PUT', '/api/suppliers/9999999', { body: { name: 'x' } });
  assert.equal(res.status, 200);
});
test('R082 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/suppliers/1', { auth: false, body: { name: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R083 — DELETE /api/suppliers/:id (xoá file vật lý attachments trước khi xoá record; F15 hotspot: FK cascade quotes/transactions/contacts)
// ---------------------------------------------------------------------------
test('R083 happy: xoá NCC kèm attachments trả 200, không còn truy vấn được', async () => {
  const id = await createSupplier();
  await uploadFiles(`/api/suppliers/${id}/files`, [{ name: 'bao-gia.pdf' }]);
  const res = await call('DELETE', `/api/suppliers/${id}`);
  assert.equal(res.status, 200);
  assert.equal((await call('GET', `/api/suppliers/${id}`)).status, 404);
});
test('R083: xoá NCC cascade xoá quotes/transactions/contacts liên quan (F15 đã sửa — MySQL nay cascade thật, đồng nhất SQLite)', async () => {
  const id = await createSupplier();
  const qid = (await (await call('POST', `/api/suppliers/${id}/quotes`, { body: { item: 'In banner', qty: 1, unit_price: 100000 } })).json()).id;
  const tid = (await (await call('POST', `/api/suppliers/${id}/transactions`, { body: { contract_no: 'HD-CASCADE' } })).json()).id;
  const cid = (await (await call('POST', `/api/suppliers/${id}/contacts`, { body: { full_name: 'Liên hệ cascade' } })).json()).id;
  await call('DELETE', `/api/suppliers/${id}`);
  // Route HTTP không còn cách đọc bảng con sau khi cha đã 404 -> query trực tiếp qua cùng `db`
  // mà app dùng.
  const { db } = require('../db');
  const quote = db.prepare('SELECT id FROM supplier_quotes WHERE id=?').get(qid);
  const trans = db.prepare('SELECT id FROM supplier_transactions WHERE id=?').get(tid);
  const contact = db.prepare('SELECT id FROM supplier_contacts WHERE id=?').get(cid);
  assert.ok(!quote && !trans && !contact, 'ON DELETE CASCADE phải xoá luôn cả 3 bảng con');
});
test('R083 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/suppliers/9999999');
  assert.equal(res.status, 200);
});
test('R083 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/suppliers/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// D13-039..042 — batch RBAC-EXP-B2 (2/6 entity Global còn lại): supplier qua PolicyEngine, giống
// pattern person pilot (memory-bank/18-g1b-rbac-batch-contract.md#batch-rbac-exp-b2-2026-08-30)
// ---------------------------------------------------------------------------
test('D13-039: viewer thấy field Public (name/address) mặc định (D13.2b), service_fee_pct/deposit_pct (Confidential) vẫn ẩn', async () => {
  const id = await createSupplier({ name: 'NCC D13-039', service_fee_pct: 10, deposit_pct: 20 });
  const res = await call('GET', `/api/suppliers/${id}`, { as: viewerCookie });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.record.id, id);
  assert.equal(body.record.name, 'NCC D13-039');
  assert.equal('service_fee_pct' in body.record, false);
  assert.equal('deposit_pct' in body.record, false);
});
test('D13-040: viewer PUT/DELETE supplier đều 403', async () => {
  const id = await createSupplier();
  assert.equal((await call('PUT', `/api/suppliers/${id}`, { body: { name: 'x' }, as: viewerCookie })).status, 403);
  assert.equal((await call('DELETE', `/api/suppliers/${id}`, { as: viewerCookie })).status, 403);
});
test('D13-041: executor PUT supplier 200 (Global, không cần là người tạo); DELETE 403 (executor không bao giờ xoá được Global)', async () => {
  const id = await createSupplier({ name: 'Trước khi executor sửa' });
  const putRes = await call('PUT', `/api/suppliers/${id}`, { body: { name: 'Executor đã sửa' }, as: executorCookie });
  assert.equal(putRes.status, 200);
  const detail = await (await call('GET', `/api/suppliers/${id}`, { as: targetAdminCookie })).json();
  assert.equal(detail.record.name, 'Executor đã sửa');
  assert.equal((await call('DELETE', `/api/suppliers/${id}`, { as: executorCookie })).status, 403);
});
test('D13-042: admin (target role D13) PUT + DELETE supplier đều 200 (full CRUD)', async () => {
  const id = await createSupplier({ name: 'Trước khi admin sửa' });
  assert.equal((await call('PUT', `/api/suppliers/${id}`, { body: { name: 'Admin đã sửa' }, as: targetAdminCookie })).status, 200);
  const detail = await (await call('GET', `/api/suppliers/${id}`, { as: targetAdminCookie })).json();
  assert.equal(detail.record.name, 'Admin đã sửa');
  assert.equal((await call('DELETE', `/api/suppliers/${id}`, { as: targetAdminCookie })).status, 200);
  assert.equal((await call('GET', `/api/suppliers/${id}`, { as: targetAdminCookie })).status, 404);
});

// ---------------------------------------------------------------------------
// R084 — POST /api/suppliers/:id/quotes
// ---------------------------------------------------------------------------
test('R084 happy: tạo báo giá trả 200 + id', async () => {
  const id = await createSupplier();
  const res = await call('POST', `/api/suppliers/${id}/quotes`, { body: { item: 'In banner', qty: 2, unit_price: 150000 } });
  assert.equal(res.status, 200);
  const quotes = (await (await call('GET', `/api/suppliers/${id}`)).json()).quotes;
  assert.equal(quotes.length, 1);
});
test('R084 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/suppliers/1/quotes', { auth: false, body: {} })).status, 401);
});

// ---------------------------------------------------------------------------
// R085 — DELETE /api/suppliers/:id/quotes/:qid
// ---------------------------------------------------------------------------
test('R085 happy: xoá báo giá trả 200, không còn trong danh sách', async () => {
  const id = await createSupplier();
  const qid = (await (await call('POST', `/api/suppliers/${id}/quotes`, { body: { item: 'x' } })).json()).id;
  const res = await call('DELETE', `/api/suppliers/${id}/quotes/${qid}`);
  assert.equal(res.status, 200);
  const quotes = (await (await call('GET', `/api/suppliers/${id}`)).json()).quotes;
  assert.ok(!quotes.some((q) => q.id === qid));
});
test('R085 not-found CHARACTERIZATION: qid không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/suppliers/1/quotes/9999999');
  assert.equal(res.status, 200);
});
test('R085 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/suppliers/1/quotes/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R086 — POST /api/suppliers/:id/files (upload ≤5 file, kind=quote)
// ---------------------------------------------------------------------------
test('R086 happy: upload 1 file báo giá trả 200', async () => {
  const id = await createSupplier();
  const res = await uploadFiles(`/api/suppliers/${id}/files`, [{ name: 'bao-gia.pdf' }]);
  assert.equal(res.status, 200);
  const files = (await (await call('GET', `/api/suppliers/${id}`)).json()).files;
  assert.equal(files.length, 1);
});
test('R086 happy: upload nhiều file cùng lúc (tối đa 5) đều được lưu', async () => {
  const id = await createSupplier();
  const res = await uploadFiles(`/api/suppliers/${id}/files`, [{ name: 'a.pdf' }, { name: 'b.pdf' }]);
  assert.equal(res.status, 200);
  const files = (await (await call('GET', `/api/suppliers/${id}`)).json()).files;
  assert.equal(files.length, 2);
});
test('R086 happy CHARACTERIZATION: không gửi file nào vẫn trả 200 (route KHÔNG kiểm files.length, khác R034/R070)', async () => {
  const id = await createSupplier();
  const res = await uploadFiles(`/api/suppliers/${id}/files`, []);
  assert.equal(res.status, 200);
});
test('R086 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await uploadFiles('/api/suppliers/1/files', [{ name: 'x.pdf' }], { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// D13-066..072 — batch RBAC-EXP-B5 (3/6 entity Direct — supplier_contact/supplier_transaction/
// supplier_quote): mỗi loại có owner_id riêng, executor chỉ sửa được bản ghi CHÍNH mình tạo,
// không bao giờ xoá được (memory-bank/18-g1b-rbac-batch-contract.md#batch-rbac-exp-b5)
// ---------------------------------------------------------------------------
test('D13-066: viewer tạo contact/transaction/quote đều 403', async () => {
  const id = await createSupplier();
  assert.equal((await call('POST', `/api/suppliers/${id}/contacts`, { body: { full_name: 'x' }, as: viewerCookie })).status, 403);
  assert.equal((await call('POST', `/api/suppliers/${id}/transactions`, { body: { value: 1 }, as: viewerCookie })).status, 403);
  assert.equal((await call('POST', `/api/suppliers/${id}/quotes`, { body: { item: 'x' }, as: viewerCookie })).status, 403);
});
test('D13-067: supplier_contact — executor tạo trả 200, owner_id = chính executor; PUT contact người khác 403, PUT của mình 200; DELETE (kể cả của mình) luôn 403', async () => {
  const { db } = require('../db');
  const id = await createSupplier();
  const myCid = (await (await call('POST', `/api/suppliers/${id}/contacts`, { body: { full_name: 'Của executor' }, as: executorCookie })).json()).id;
  const row = db.prepare('SELECT owner_id, created_by FROM supplier_contacts WHERE id=?').get(myCid);
  const me = db.prepare("SELECT id FROM users WHERE username LIKE 'suppliers_executor_%' ORDER BY id DESC LIMIT 1").get();
  assert.equal(row.owner_id, me.id);
  assert.equal(row.created_by, me.id);
  assert.equal((await call('PUT', `/api/suppliers/${id}/contacts/${myCid}`, { body: { full_name: 'Executor tự sửa' }, as: executorCookie })).status, 200);
  const othersCid = (await (await call('POST', `/api/suppliers/${id}/contacts`, { body: { full_name: 'Của người khác' } })).json()).id;
  assert.equal((await call('PUT', `/api/suppliers/${id}/contacts/${othersCid}`, { body: { full_name: 'x' }, as: executorCookie })).status, 403);
  assert.equal((await call('DELETE', `/api/suppliers/${id}/contacts/${myCid}`, { as: executorCookie })).status, 403);
});
test('D13-068: supplier_transaction — executor tạo trả 200, owner_id đúng; thấy value trên giao dịch mình tạo, KHÔNG thấy value trên giao dịch người khác', async () => {
  const id = await createSupplier();
  const myTid = (await (await call('POST', `/api/suppliers/${id}/transactions`, { body: { purpose: 'Của executor', value: 111 }, as: executorCookie })).json()).id;
  const othersTid = (await (await call('POST', `/api/suppliers/${id}/transactions`, { body: { purpose: 'Của người khác', value: 222 } })).json()).id;
  const detail = await (await call('GET', `/api/suppliers/${id}`, { as: executorCookie })).json();
  assert.equal('value' in detail.transactions.find((t) => t.id === myTid), true);
  assert.equal('value' in detail.transactions.find((t) => t.id === othersTid), false);
});
test('D13-069: supplier_transaction — executor PUT giao dịch người khác 403, PUT của mình 200; DELETE (kể cả của mình) luôn 403; admin xoá 200', async () => {
  const id = await createSupplier();
  const myTid = (await (await call('POST', `/api/suppliers/${id}/transactions`, { body: { purpose: 'Trước sửa' }, as: executorCookie })).json()).id;
  assert.equal((await call('PUT', `/api/suppliers/${id}/transactions/${myTid}`, { body: { purpose: 'Executor tự sửa' }, as: executorCookie })).status, 200);
  const othersTid = (await (await call('POST', `/api/suppliers/${id}/transactions`, { body: { purpose: 'Của người khác 2' } })).json()).id;
  assert.equal((await call('PUT', `/api/suppliers/${id}/transactions/${othersTid}`, { body: { purpose: 'x' }, as: executorCookie })).status, 403);
  assert.equal((await call('DELETE', `/api/suppliers/${id}/transactions/${myTid}`, { as: executorCookie })).status, 403);
  assert.equal((await call('DELETE', `/api/suppliers/${id}/transactions/${myTid}`)).status, 200);
});
test('D13-070: supplier_quote — executor tạo trả 200, owner_id đúng; thấy unit_price trên báo giá mình tạo, KHÔNG thấy trên báo giá người khác; DELETE (kể cả của mình) luôn 403', async () => {
  const { db } = require('../db');
  const id = await createSupplier();
  const myQid = (await (await call('POST', `/api/suppliers/${id}/quotes`, { body: { item: 'Của executor', unit_price: 500 }, as: executorCookie })).json()).id;
  const row = db.prepare('SELECT owner_id, created_by FROM supplier_quotes WHERE id=?').get(myQid);
  const me = db.prepare("SELECT id FROM users WHERE username LIKE 'suppliers_executor_%' ORDER BY id DESC LIMIT 1").get();
  assert.equal(row.owner_id, me.id);
  assert.equal(row.created_by, me.id);
  const othersQid = (await (await call('POST', `/api/suppliers/${id}/quotes`, { body: { item: 'Của người khác', unit_price: 900 } })).json()).id;
  const detail = await (await call('GET', `/api/suppliers/${id}`, { as: executorCookie })).json();
  assert.equal('unit_price' in detail.quotes.find((q) => q.id === myQid), true);
  assert.equal('unit_price' in detail.quotes.find((q) => q.id === othersQid), false);
  assert.equal((await call('DELETE', `/api/suppliers/${id}/quotes/${myQid}`, { as: executorCookie })).status, 403);
  assert.equal((await call('DELETE', `/api/suppliers/${id}/quotes/${myQid}`)).status, 200);
});

// ---------------------------------------------------------------------------
// D13-080 — remediation P0 audit F19: GET /api/files/:id trước đây phục vụ file báo giá supplier
// không gate gì. supplier là entity Global (không có owner-bypass, giống service_fee_pct/
// deposit_pct luôn ẩn với executor) — nên KHÁC award (D13-078): file private chỉ Admin/Super Admin
// tải được, kể cả executor tự upload file đó cũng không tải lại được.
// ---------------------------------------------------------------------------
test('D13-080: supplier là entity Global — file báo giá private chỉ Admin/Super Admin tải được; viewer và executor (kể cả người đã tự upload) đều 403', async () => {
  const id = await createSupplier();
  assert.equal((await uploadFiles(`/api/suppliers/${id}/files`, [{ name: 'bao-gia-mat.pdf' }], { as: executorCookie })).status, 200);
  const fileId = (await (await call('GET', `/api/suppliers/${id}`, { as: executorCookie })).json()).files[0].id;
  assert.equal((await call('GET', `/api/files/${fileId}`, { as: viewerCookie })).status, 403);
  assert.equal((await call('GET', `/api/files/${fileId}`, { as: executorCookie })).status, 403);
  assert.equal((await call('GET', `/api/files/${fileId}`, { as: targetAdminCookie })).status, 200);
  assert.equal((await call('GET', `/api/files/${fileId}`)).status, 200); // cookie mặc định = super_admin
});
