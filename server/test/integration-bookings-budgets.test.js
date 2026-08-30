'use strict';
// G1A.3 Batch "reports-awards" (1/3) — integration test HTTP cho "Booking bài viết" (R046-R049)
// và "Ngân sách theo tháng" (R050-R051). Xem Batch Contract trong 15-changelog.md.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const rbac = require('../rbac');

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
  const admin = fixtures.createPrivilegedUser({ username: `bookings_admin_${Date.now()}` });
  cookie = (await fixtures.login(baseUrl, { username: admin.username, password: admin.password })).cookie;
});

after(async () => {
  await resources.cleanupAll();
});

async function call(method, path, { body, auth = true, cookie: as, headers } = {}) {
  const opts = { method, headers: { ...(auth ? { cookie: as || cookie } : {}), ...(headers || {}) } };
  if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  return fetch(`${baseUrl}${path}`, opts);
}
async function createBooking(overrides = {}) {
  const res = await call('POST', '/api/bookings', { body: { subject_type: 'person', subject_id: 1, title: `Bài PR ${Date.now()}`, amount: 1000000, booked_date: '2026-08-01', ...overrides } });
  assert.equal(res.status, 200);
  return (await res.json()).id;
}

// ---------------------------------------------------------------------------
// R046 — GET /api/bookings
// ---------------------------------------------------------------------------
test('R046 happy: lọc theo subject_type/subject_id/from/to, trả total_amount cộng dồn', async () => {
  const id = await createBooking({ amount: 500000 });
  const res = await call('GET', '/api/bookings?subject_type=person&subject_id=1&from=2026-08-01&to=2026-08-31');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.rows.some((r) => r.id === id));
  assert.equal(typeof body.total_amount, 'number');
});
test('R046 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/bookings', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R047 — POST /api/bookings
// ---------------------------------------------------------------------------
test('R047 happy: tạo booking hợp lệ trả 200 + id, tự resolve org theo subject', async () => {
  const id = await createBooking({ title: 'Bài PR ra mắt', amount: 2000000 });
  const res = await call('GET', `/api/bookings?subject_type=person&subject_id=1`);
  const row = (await res.json()).rows.find((r) => r.id === id);
  assert.ok(row);
});
test('R047 invalid: thiếu title (NOT NULL) trả 400', async () => {
  const res = await call('POST', '/api/bookings', { body: { subject_type: 'person', subject_id: 1, amount: 100 } });
  assert.equal(res.status, 400);
});
test('R047 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/bookings', { auth: false, body: { title: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R048 — PUT /api/bookings/:id
// ---------------------------------------------------------------------------
test('R048 happy: cập nhật booking trả 200 và thay đổi được ghi nhận', async () => {
  const id = await createBooking();
  const res = await call('PUT', `/api/bookings/${id}`, { body: { subject_type: 'person', subject_id: 1, title: 'Đã sửa', amount: 999 } });
  assert.equal(res.status, 200);
  const row = (await (await call('GET', '/api/bookings?subject_type=person&subject_id=1')).json()).rows.find((r) => r.id === id);
  assert.equal(row.title, 'Đã sửa');
});
test('R048 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (UPDATE 0 dòng không lỗi)', async () => {
  const res = await call('PUT', '/api/bookings/9999999', { body: { subject_type: 'person', subject_id: 1, title: 'x' } });
  assert.equal(res.status, 200);
});
test('R048 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/bookings/1', { auth: false, body: { title: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R049 — DELETE /api/bookings/:id
// ---------------------------------------------------------------------------
test('R049 happy: xoá booking trả 200, không còn trong danh sách', async () => {
  const id = await createBooking();
  const res = await call('DELETE', `/api/bookings/${id}`);
  assert.equal(res.status, 200);
  const rows = (await (await call('GET', '/api/bookings?subject_type=person&subject_id=1')).json()).rows;
  assert.ok(!rows.some((r) => r.id === id));
});
test('R049 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/bookings/9999999');
  assert.equal(res.status, 200);
});
test('R049 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/bookings/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// D13-048..051 — batch RBAC-EXP-B3 (1/6 entity Direct đầu tiên, CRUD đầy đủ): booking.amount là
// Confidential — che theo classification_tier + owner-bypass; executor chỉ sửa được booking chính
// mình sở hữu, không bao giờ xoá được (memory-bank/18-g1b-rbac-batch-contract.md#batch-rbac-exp-b3)
// ---------------------------------------------------------------------------
test('D13-048: viewer thấy field Public (title/status) nhưng amount (Confidential) bị ẩn; total_amount bị MASK', async () => {
  const viewer = fixtures.createUser('viewer', { username: `bookings_viewer_${Date.now()}` });
  const viewerCookie = (await fixtures.login(baseUrl, { username: viewer.username, password: viewer.password })).cookie;
  await createBooking({ title: 'Booking D13-048', amount: 700000 });
  const res = await call('GET', '/api/bookings?subject_type=person&subject_id=1', { cookie: viewerCookie });
  assert.equal(res.status, 200);
  const body = await res.json();
  const row = body.rows.find((r) => r.title === 'Booking D13-048');
  assert.ok(row);
  assert.equal('amount' in row, false);
  assert.equal(body.total_amount, rbac.MASK);
});
test('D13-049: executor tạo booking trả 200, owner_id = chính executor đó; executor thấy amount trên booking mình tạo, KHÔNG thấy amount trên booking người khác tạo', async () => {
  const executor = fixtures.createUser('executor', { username: `bookings_executor_${Date.now()}` });
  const executorCookie = (await fixtures.login(baseUrl, { username: executor.username, password: executor.password })).cookie;
  const myId = (await (await call('POST', '/api/bookings', { body: { subject_type: 'person', subject_id: 1, title: 'Của executor', amount: 300000, booked_date: '2026-08-01' }, cookie: executorCookie })).json()).id;
  const { db } = require('../db');
  const row = db.prepare('SELECT owner_id, created_by FROM bookings WHERE id=?').get(myId);
  assert.equal(row.owner_id, executor_id(db, executor.username));
  assert.equal(row.created_by, executor_id(db, executor.username));

  const othersId = await createBooking({ title: 'Của người khác', amount: 900000 });
  const res = await call('GET', '/api/bookings?subject_type=person&subject_id=1', { cookie: executorCookie });
  const rows = (await res.json()).rows;
  assert.equal('amount' in rows.find((r) => r.id === myId), true);
  assert.equal('amount' in rows.find((r) => r.id === othersId), false);
});
function executor_id(db, username) { return db.prepare('SELECT id FROM users WHERE username=?').get(username).id; }
test('D13-050: executor PUT booking mình sở hữu trả 200; PUT booking người khác tạo trả 403; DELETE (kể cả của mình) luôn 403', async () => {
  const executor = fixtures.createUser('executor', { username: `bookings_executor2_${Date.now()}` });
  const executorCookie = (await fixtures.login(baseUrl, { username: executor.username, password: executor.password })).cookie;
  const myId = (await (await call('POST', '/api/bookings', { body: { subject_type: 'person', subject_id: 1, title: 'Trước sửa', amount: 1, booked_date: '2026-08-01' }, cookie: executorCookie })).json()).id;
  const putOwn = await call('PUT', `/api/bookings/${myId}`, { body: { subject_type: 'person', subject_id: 1, title: 'Executor tự sửa', amount: 2 }, cookie: executorCookie });
  assert.equal(putOwn.status, 200);
  assert.equal((await call('DELETE', `/api/bookings/${myId}`, { cookie: executorCookie })).status, 403);

  const othersId = await createBooking({ title: 'Của người khác 2' });
  assert.equal((await call('PUT', `/api/bookings/${othersId}`, { body: { subject_type: 'person', subject_id: 1, title: 'x' }, cookie: executorCookie })).status, 403);
});
test('D13-050b: viewer PUT/DELETE booking đều 403', async () => {
  const viewer = fixtures.createUser('viewer', { username: `bookings_viewer2_${Date.now()}` });
  const viewerCookie = (await fixtures.login(baseUrl, { username: viewer.username, password: viewer.password })).cookie;
  const id = await createBooking();
  assert.equal((await call('PUT', `/api/bookings/${id}`, { body: { title: 'x' }, cookie: viewerCookie })).status, 403);
  assert.equal((await call('DELETE', `/api/bookings/${id}`, { cookie: viewerCookie })).status, 403);
});
test('D13-051: executor PUT booking id không tồn tại trả 403 (khác legacy 200 no-op — không xác định được owner trên bản ghi không tồn tại nên fail-closed)', async () => {
  const executor = fixtures.createUser('executor', { username: `bookings_executor3_${Date.now()}` });
  const executorCookie = (await fixtures.login(baseUrl, { username: executor.username, password: executor.password })).cookie;
  const res = await call('PUT', '/api/bookings/9999999', { body: { title: 'x' }, cookie: executorCookie });
  assert.equal(res.status, 403);
});

// ---------------------------------------------------------------------------
// R050 — GET /api/budgets
// ---------------------------------------------------------------------------
test('R050 happy: trả danh sách ngân sách theo kỳ, sắp theo period', async () => {
  await call('POST', '/api/budgets', { body: { period: '2026-08', amount: 10000000 } });
  const res = await call('GET', '/api/budgets');
  assert.equal(res.status, 200);
  assert.ok((await res.json()).rows.some((r) => r.period === '2026-08'));
});
test('R050 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/budgets', { auth: false })).status, 401);
});
test('R050 forbidden: executor (reports rỗng trong MATRIX) trả 403', async () => {
  const staff = fixtures.createUser('executor', { username: `budgets_staff_${Date.now()}` });
  const staffCookie = (await fixtures.login(baseUrl, { username: staff.username, password: staff.password })).cookie;
  const res = await call('GET', '/api/budgets', { cookie: staffCookie });
  assert.equal(res.status, 403);
});
// D13-085 — batch W1.POLICY.2 (dọn thiếu mask): GET /budgets trước đây KHÔNG che amount
// (Confidential) dù viewer có reports:view — nay đồng nhất Module-admin-only qua projectRecord()
// giống các entity Confidential khác (vd supplier.service_fee_pct).
test('D13-085: GET /budgets viewer (có reports:view) vẫn KHÔNG thấy amount (Confidential); admin thấy đủ', async () => {
  const period = `2027-0${Math.floor(Math.random() * 8) + 1}`;
  await call('POST', '/api/budgets', { body: { period, amount: 8888888 } });
  const viewer = fixtures.createUser('viewer', { username: `budgets_viewer_${Date.now()}` });
  const viewerCookie = (await fixtures.login(baseUrl, { username: viewer.username, password: viewer.password })).cookie;
  const viewerRes = await call('GET', '/api/budgets', { cookie: viewerCookie });
  assert.equal(viewerRes.status, 200);
  const viewerRow = (await viewerRes.json()).rows.find((r) => r.period === period);
  assert.ok(viewerRow);
  assert.equal('amount' in viewerRow, false);
  const adminRow = (await (await call('GET', '/api/budgets')).json()).rows.find((r) => r.period === period);
  assert.equal(adminRow.amount, 8888888);
});

// ---------------------------------------------------------------------------
// R051 — POST /api/budgets (upsert theo period, dùng requirePerm(reports,view) — CHARACTERIZATION: route ghi dữ liệu nhưng chỉ đòi quyền 'view')
// ---------------------------------------------------------------------------
test('R051 happy: tạo mới ngân sách 1 kỳ trả 200 {ok:true}', async () => {
  const res = await call('POST', '/api/budgets', { body: { period: '2026-09', amount: 5000000, note: 'Q3' } });
  assert.equal(res.status, 200);
  const rows = (await (await call('GET', '/api/budgets')).json()).rows;
  assert.ok(rows.find((r) => r.period === '2026-09' && r.amount === 5000000));
});
test('R051 happy: gửi lại cùng period upsert đè amount/note (ON CONFLICT)', async () => {
  await call('POST', '/api/budgets', { body: { period: '2026-10', amount: 1, note: 'cũ' } });
  await call('POST', '/api/budgets', { body: { period: '2026-10', amount: 2, note: 'mới' } });
  const rows = (await (await call('GET', '/api/budgets')).json()).rows;
  const row = rows.find((r) => r.period === '2026-10');
  assert.equal(row.amount, 2);
  assert.equal(row.note, 'mới');
});
test('R051 invalid: period sai định dạng (không phải YYYY-MM) trả 400', async () => {
  const res = await call('POST', '/api/budgets', { body: { period: '2026/11', amount: 1 } });
  assert.equal(res.status, 400);
});
test('R051 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/budgets', { auth: false, body: { period: '2026-08', amount: 1 } })).status, 401);
});
test('R051 forbidden: executor (reports rỗng trong MATRIX) trả 403', async () => {
  const staff = fixtures.createUser('executor', { username: `budgets_staff2_${Date.now()}` });
  const staffCookie = (await fixtures.login(baseUrl, { username: staff.username, password: staff.password })).cookie;
  const res = await call('POST', '/api/budgets', { body: { period: '2026-08', amount: 1 }, cookie: staffCookie });
  assert.equal(res.status, 403);
});
