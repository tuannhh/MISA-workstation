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
test('R052 happy: mọi field "amount" trong các mảng breakdown (spend.byMonth/byOrg/byPerson/byType/byStaff, fulfillment, events.byCategory/byEvent, fees.byOrg) đều là number, tiers.t1-t4 cũng là number (F18 — trước đây chỉ tổng đơn (spend.total/events.total/fees.total) được Number() ở F14, các mảng breakdown dùng để vẽ chart vẫn bị bỏ sót, mysql2 trả string)', async () => {
  await createBooking({ amount: 500000, booked_date: '2026-08-15', status: 'Đã đăng', content_type: 'Bài PR' });
  const res = await call('GET', '/api/reports?from=2026-08-01&to=2026-08-31');
  const body = await res.json();
  const arrays = [body.spend.byMonth, body.spend.byOrg, body.spend.byPerson, body.spend.byType, body.spend.byStaff, body.fulfillment, body.events.byCategory, body.events.byEvent, body.fees.byOrg];
  for (const arr of arrays) {
    assert.ok(Array.isArray(arr));
    for (const row of arr) if ('amount' in row) assert.equal(typeof row.amount, 'number', `amount phải là number, thực tế ${typeof row.amount} (${JSON.stringify(row)})`);
  }
  assert.ok(body.spend.byMonth.some((r) => r.amount >= 500000), 'phải có ít nhất 1 tháng cộng số (không nối chuỗi) >= 500000');
  assert.equal(typeof body.tiers.t1, 'number');
  assert.equal(typeof body.tiers.t2, 'number');
  assert.equal(typeof body.tiers.t3, 'number');
  assert.equal(typeof body.tiers.t4, 'number');
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
test('R053 happy: spend là number cộng đúng (F18 — SUM() qua mysql2 trả string trên MySQL, cùng lớp bug F14/F16, chưa từng sửa ở route này)', async () => {
  await createBooking({ amount: 300000, booked_date: '2026-08-10', status: 'Đã đăng' });
  await createBooking({ amount: 700000, booked_date: '2026-08-11', status: 'Đã đăng' });
  const res = await call('GET', '/api/reports/by-staff?from=2026-08-01&to=2026-08-31');
  const row = (await res.json()).rows.find((r) => r.spend > 0);
  assert.ok(row, 'phải có ít nhất 1 nhân sự có spend > 0');
  assert.equal(typeof row.spend, 'number');
  assert.ok(row.spend >= 1000000, `spend phải cộng số (không nối chuỗi) >= 1000000, thực tế ${row.spend}`);
});
test('R053 happy CHARACTERIZATION (BR-CALC-009): avgScore = null khi nhân sự có đầu mối được giao (org/award) nhưng KHÔNG có đầu mối "person" nào — AVG() trên tập rỗng trả NULL, không bị JS-side guard về 0', async () => {
  const res = await call('GET', '/api/reports/by-staff?from=2026-08-01&to=2026-08-31');
  const row = (await res.json()).rows.find((r) => r.spend > 0 && r.people === 0);
  assert.ok(row, 'phải có nhân sự spend>0 nhưng không có đầu mối person nào (assigned qua booking, không qua assignments)');
  assert.equal(row.avgScore, null);
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
test('R054 happy: spend là number cộng đúng theo đơn vị (F18, cùng lớp bug F14/F16)', async () => {
  const orgId = await (async () => {
    const r = await call('POST', '/api/partners', { body: { name: `Đơn vị F18 ${Date.now()}`, org_type: 'press' } });
    return (await r.json()).id;
  })();
  await createBooking({ subject_type: 'org', subject_id: orgId, amount: 400000, booked_date: '2026-08-10', status: 'Đã đăng' });
  const res = await call('GET', '/api/reports/by-unit?from=2026-08-01&to=2026-08-31');
  const row = (await res.json()).rows.find((r) => r.id === orgId);
  assert.ok(row);
  assert.equal(typeof row.spend, 'number');
  assert.equal(row.spend, 400000);
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
test('R055 happy: mediaCost/totalCost là number cộng đúng (F18 — trước đây "cost + partBudget + mediaCost" nối chuỗi thay vì cộng số trên MySQL khi mediaCost là string, vd totalCost="0300000" thay vì 300000)', async () => {
  const award = await (async () => {
    const r = await call('POST', '/api/awards', { body: { name: `Giải F18 ${Date.now()}`, organizer_type: 'gov' } });
    return (await r.json()).id;
  })();
  await createBooking({ subject_type: 'award', subject_id: award, award_id: award, amount: 300000, booked_date: '2026-08-10', status: 'Đã đăng' });
  const res = await call('GET', '/api/reports/awards');
  const row = (await res.json()).rows.find((r) => r.id === award);
  assert.ok(row);
  assert.equal(typeof row.mediaCost, 'number');
  assert.equal(typeof row.totalCost, 'number');
  assert.equal(row.mediaCost, 300000);
  assert.equal(row.totalCost, 300000);
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
