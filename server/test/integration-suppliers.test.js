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
test('R075 CHARACTERIZATION (F15): supplier_id không tồn tại — route không kiểm tồn tại trước khi insert; SQLite thực thi FK (400), MySQL không (200), giống R067', async () => {
  const res = await call('POST', '/api/suppliers/9999999/contacts', { body: { full_name: 'x' } });
  assert.equal(res.status, isMysql ? 200 : 400);
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
test('R083 CHARACTERIZATION (F15 mở rộng): xoá NCC có quotes/transactions/contacts liên quan — SQLite cascade xoá con (FK ON DELETE CASCADE hoạt động), MySQL để lại bản ghi con mồ côi (FK không cascade, đúng phạm vi Codex đã mở rộng ở batch reports-awards)', async () => {
  const id = await createSupplier();
  const qid = (await (await call('POST', `/api/suppliers/${id}/quotes`, { body: { item: 'In banner', qty: 1, unit_price: 100000 } })).json()).id;
  const tid = (await (await call('POST', `/api/suppliers/${id}/transactions`, { body: { contract_no: 'HD-CASCADE' } })).json()).id;
  const cid = (await (await call('POST', `/api/suppliers/${id}/contacts`, { body: { full_name: 'Liên hệ cascade' } })).json()).id;
  await call('DELETE', `/api/suppliers/${id}`);
  // Route HTTP không còn cách đọc bảng con sau khi cha đã 404 -> query trực tiếp qua cùng `db`
  // mà app dùng (đồng bộ với F15 đã ghi ở 01-audit-findings.md, không lặp lại thí nghiệm mới).
  const { db } = require('../db');
  const quote = db.prepare('SELECT id FROM supplier_quotes WHERE id=?').get(qid);
  const trans = db.prepare('SELECT id FROM supplier_transactions WHERE id=?').get(tid);
  const contact = db.prepare('SELECT id FROM supplier_contacts WHERE id=?').get(cid);
  if (isMysql) {
    assert.ok(quote && trans && contact, 'F15: MySQL không cascade xoá bảng con — nếu test này fail nghĩa là F15 đã được sửa, cập nhật lại 01-audit-findings.md');
  } else {
    assert.ok(!quote && !trans && !contact, 'SQLite phải cascade xoá đúng theo ON DELETE CASCADE');
  }
});
test('R083 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/suppliers/9999999');
  assert.equal(res.status, 200);
});
test('R083 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/suppliers/1', { auth: false })).status, 401);
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
