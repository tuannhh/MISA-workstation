'use strict';
// G1A.3 Batch "reports-awards" (1/3) — integration test HTTP cho "Booking bài viết" (R046-R049)
// và "Ngân sách theo tháng" (R050-R051). Xem Batch Contract trong 15-changelog.md.
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
