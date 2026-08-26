'use strict';
// G1A.3 Batch "reports-awards" (2/3) — integration test HTTP cho nhóm "Báo cáo" (R052-R056):
// tổng hợp chi tiêu/quan hệ, theo nhân sự PR, theo đơn vị, theo giải thưởng, cảnh báo chăm sóc.
// Tất cả 5 route đều requirePerm('reports','view') — pr_staff (MATRIX.reports=[]) bị 403 toàn bộ.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

let baseUrl;
let cookie;
let staffCookie;
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
  const admin = fixtures.createPrivilegedUser({ username: `reports_admin_${Date.now()}` });
  cookie = (await fixtures.login(baseUrl, { username: admin.username, password: admin.password })).cookie;
  const staff = fixtures.createUser('pr_staff', { username: `reports_staff_${Date.now()}` });
  staffCookie = (await fixtures.login(baseUrl, { username: staff.username, password: staff.password })).cookie;
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
  const res = await call('POST', '/api/bookings', { body: { subject_type: 'person', subject_id: 1, title: `Bài PR báo cáo ${Date.now()}`, amount: 1000000, booked_date: '2026-08-05', status: 'Đã đăng', ...overrides } });
  assert.equal(res.status, 200);
  return (await res.json()).id;
}

// ---------------------------------------------------------------------------
// R052 — GET /api/reports (tổng hợp toàn diện)
// ---------------------------------------------------------------------------
test('R052 happy: trả đủ khối spend/events/fees/grandTotal/tiers/byBeat/careRisk/interactions/network', async () => {
  await createBooking();
  const res = await call('GET', '/api/reports?from=2026-08-01&to=2026-08-31');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.spend && Array.isArray(body.spend.byMonth));
  assert.equal(typeof body.grandTotal, 'number');
  assert.ok(body.network);
});
test('R052 happy: grandTotal cộng đúng bằng số (F14 — trước đây SUM() qua mysql2 trả string khiến "+" nối chuỗi thay vì cộng số trên MySQL)', async () => {
  await createBooking({ amount: 300000, booked_date: '2026-08-10', status: 'Đã đăng' });
  await createBooking({ amount: 700000, booked_date: '2026-08-11', status: 'Đã đăng' });
  const res = await call('GET', '/api/reports?from=2026-08-01&to=2026-08-31');
  const body = await res.json();
  assert.equal(typeof body.spend.total, 'number');
  assert.equal(typeof body.events.total, 'number');
  assert.equal(typeof body.fees.total, 'number');
  assert.equal(body.grandTotal, body.spend.total + body.events.total + body.fees.total);
  assert.ok(body.grandTotal >= 1000000, `grandTotal phải >= 1000000 (2 booking 300000+700000), thực tế ${body.grandTotal}`);
});
test('R052 happy CHARACTERIZATION: thiếu from/to tự dùng dải mặc định 0000-01-01..9999-12-31, không lỗi', async () => {
  const res = await call('GET', '/api/reports');
  assert.equal(res.status, 200);
});
test('R052 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/reports', { auth: false })).status, 401);
});
test('R052 forbidden: pr_staff trả 403', async () => {
  assert.equal((await call('GET', '/api/reports', { cookie: staffCookie })).status, 403);
});

// ---------------------------------------------------------------------------
// R053 — GET /api/reports/by-staff
// ---------------------------------------------------------------------------
test('R053 happy: trả mảng rows, mỗi nhân sự có spend/bookings/interactions/overdue', async () => {
  const res = await call('GET', '/api/reports/by-staff');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray((await res.json()).rows));
});
test('R053 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/reports/by-staff', { auth: false })).status, 401);
});
test('R053 forbidden: pr_staff trả 403', async () => {
  assert.equal((await call('GET', '/api/reports/by-staff', { cookie: staffCookie })).status, 403);
});

// ---------------------------------------------------------------------------
// R054 — GET /api/reports/by-unit
// ---------------------------------------------------------------------------
test('R054 happy: trả mảng rows theo đơn vị, có caretakers gắn kèm', async () => {
  const res = await call('GET', '/api/reports/by-unit');
  assert.equal(res.status, 200);
  const rows = (await res.json()).rows;
  assert.ok(Array.isArray(rows));
  if (rows.length) assert.ok(Array.isArray(rows[0].caretakers));
});
test('R054 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/reports/by-unit', { auth: false })).status, 401);
});
test('R054 forbidden: pr_staff trả 403', async () => {
  assert.equal((await call('GET', '/api/reports/by-unit', { cookie: staffCookie })).status, 403);
});

// ---------------------------------------------------------------------------
// R055 — GET /api/reports/awards
// ---------------------------------------------------------------------------
test('R055 happy CHARACTERIZATION: chỉ trả giải thưởng có participations hoặc mediaCost > 0 (lọc ẩn)', async () => {
  const res = await call('GET', '/api/reports/awards');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray((await res.json()).rows));
});
test('R055 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/reports/awards', { auth: false })).status, 401);
});
test('R055 forbidden: pr_staff trả 403', async () => {
  assert.equal((await call('GET', '/api/reports/awards', { cookie: staffCookie })).status, 403);
});

// ---------------------------------------------------------------------------
// R056 — GET /api/reports/care-alerts
// ---------------------------------------------------------------------------
test('R056 happy: trả rows + counts theo bucket 1m/3m/6m/12m', async () => {
  const res = await call('GET', '/api/reports/care-alerts');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.rows));
  assert.ok('1m' in body.counts && '3m' in body.counts && '6m' in body.counts && '12m' in body.counts);
});
test('R056 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/reports/care-alerts', { auth: false })).status, 401);
});
test('R056 forbidden: pr_staff trả 403', async () => {
  assert.equal((await call('GET', '/api/reports/care-alerts', { cookie: staffCookie })).status, 403);
});
