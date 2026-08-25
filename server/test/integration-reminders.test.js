'use strict';
// G1A.3 (4/~12) — integration test HTTP cho nhóm "Nhắc việc & thông báo" (R038-R042,R057-R061):
// important_dates CRUD, danh sách nhắc sắp tới, notification in-app (đọc 1/đọc tất cả), chạy thủ
// công bộ nhắc (side-effect job nền qua route), xuất .ics. Pattern giống các file G1A.3 trước.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

let baseUrl;
let cookie;
let fixtures;
let db;
let adminId;
const resources = createResourceStack();

before(async () => {
  if (isMysql) {
    const dbName = await dbHarness.createMysqlTestDb();
    resources.acquire(() => dbHarness.dropMysqlTestDb(dbName));
  } else {
    const { teardown } = dbHarness.setupSqliteDb();
    resources.acquire(teardown);
  }
  db = require('../db').db;
  resources.acquire(require('../db').closeDb);
  const { createApp } = require('../app');
  fixtures = require('../test-support/fixtures');
  const started = await startTestApp(createApp());
  baseUrl = started.baseUrl;
  resources.acquire(started.close);
  const admin = fixtures.createPrivilegedUser({ username: `reminders_admin_${Date.now()}` });
  cookie = (await fixtures.login(baseUrl, { username: admin.username, password: admin.password })).cookie;
  adminId = db.prepare('SELECT id FROM users WHERE username=?').get(admin.username).id;
});

after(async () => {
  await resources.cleanupAll();
});

async function call(method, path, { body, auth = true, headers } = {}) {
  const opts = { method, headers: { ...(auth ? { cookie } : {}), ...(headers || {}) } };
  if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  return fetch(`${baseUrl}${path}`, opts);
}
// Cùng công thức GMT+7 mà scheduler.js#todayGMT7() dùng — để reminder tạo ra "đến hạn" NGAY hôm nay.
function todayGMT7() { return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10); }
async function createReminder(overrides = {}) {
  const res = await call('POST', '/api/reminders', { body: { title: `Nhắc ${Date.now()}`, event_date: todayGMT7(), recurring: 0, lead_days: 0, ...overrides } });
  assert.equal(res.status, 200);
  return (await res.json()).id;
}

// ---------------------------------------------------------------------------
// R038 — GET /api/reminders/upcoming
// ---------------------------------------------------------------------------
test('R038 happy: reminder đến hạn hôm nay nằm trong danh sách sắp tới', async () => {
  const id = await createReminder({ title: 'Sắp tới R038' });
  const res = await call('GET', '/api/reminders/upcoming');
  assert.equal(res.status, 200);
  assert.ok((await res.json()).rows.some((r) => r.id === id));
});
test('R038 invalid CHARACTERIZATION: days vượt 365 bị clamp về 365, không lỗi', async () => {
  const res = await call('GET', '/api/reminders/upcoming?days=999999');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).days, 365);
});
test('R038 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/reminders/upcoming', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R039 — GET /api/reminders (không phân trang/filter -> không case invalid/not-found)
// ---------------------------------------------------------------------------
test('R039 happy: trả toàn bộ important_dates, có decorate daysUntil', async () => {
  const id = await createReminder({ title: 'List R039' });
  const res = await call('GET', '/api/reminders');
  assert.equal(res.status, 200);
  const row = (await res.json()).rows.find((r) => r.id === id);
  assert.ok(row && 'daysUntil' in row);
});
test('R039 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/reminders', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R040 — POST /api/reminders
// ---------------------------------------------------------------------------
test('R040 happy: tạo reminder hợp lệ trả 200 + id', async () => {
  const id = await createReminder({ title: 'Tạo R040' });
  assert.ok(id);
});
test('R040 invalid: thiếu event_date trả 400', async () => {
  const res = await call('POST', '/api/reminders', { body: { title: 'Thiếu ngày' } });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Thiếu ngày sự kiện');
});
test('R040 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/reminders', { auth: false, body: { event_date: todayGMT7() } })).status, 401);
});

// ---------------------------------------------------------------------------
// R041 — PUT /api/reminders/:id
// ---------------------------------------------------------------------------
test('R041 happy: sửa title, GET lại đúng giá trị mới', async () => {
  const id = await createReminder({ title: 'Trước sửa' });
  assert.equal((await call('PUT', `/api/reminders/${id}`, { body: { title: 'Sau sửa R041' } })).status, 200);
  const rows = (await (await call('GET', '/api/reminders')).json()).rows;
  assert.equal(rows.find((r) => r.id === id).title, 'Sau sửa R041');
});
test('R041 not-found CHARACTERIZATION: sửa id không tồn tại vẫn 200 {ok:true}', async () => {
  assert.equal((await call('PUT', '/api/reminders/9999999', { body: { title: 'x' } })).status, 200);
});
test('R041 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/reminders/1', { auth: false, body: { title: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R042 — DELETE /api/reminders/:id
// ---------------------------------------------------------------------------
test('R042 happy: xoá reminder, không còn trong danh sách', async () => {
  const id = await createReminder({ title: 'Xoá R042' });
  assert.equal((await call('DELETE', `/api/reminders/${id}`)).status, 200);
  const rows = (await (await call('GET', '/api/reminders')).json()).rows;
  assert.ok(!rows.some((r) => r.id === id));
});
test('R042 not-found CHARACTERIZATION: xoá id không tồn tại vẫn 200 {ok:true}', async () => {
  assert.equal((await call('DELETE', '/api/reminders/9999999')).status, 200);
});
test('R042 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/reminders/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R057/R058/R059/R060 — notifications + chạy thủ công bộ nhắc. Test theo 1 luồng liên tiếp vì
// notification chỉ sinh ra sau khi R060 (POST /reminders/run) chạy — không có API tạo trực tiếp.
// ---------------------------------------------------------------------------
test('R060 happy (SQLite) / F13 CHARACTERIZATION (MySQL): SQLite trả 200 {ok:true, created, emailed} và sinh log in-app cho reminder đến hạn hôm nay; MySQL — scheduler.js dùng cú pháp `recipient_user_id IS ?` chỉ SQLite chấp nhận (MySQL "IS" không nhận placeholder tham số) — runOnce() ném lỗi cú pháp SQL ngay khi có user opt-in đến hạn, route rơi vào error handler chung và trả 400 kèm nguyên message SQL thô. Ghi nhận F13 (`01-audit-findings.md`), KHÔNG sửa scheduler.js ở đây.', async () => {
  await createReminder({ title: 'Đến hạn hôm nay R060' });
  const res = await call('POST', '/api/reminders/run');
  if (isMysql) {
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /syntax/i);
    return;
  }
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.created, 'number');
  assert.equal(typeof body.emailed, 'number');
  assert.ok(body.created >= 1, 'user admin notify_opt_in=1 mặc định -> phải sinh >=1 log in-app');
});
test('R060 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/reminders/run', { auth: false })).status, 401);
});

test('R057/R058/R059 happy: notification xuất hiện, đọc 1 rồi đọc tất cả làm unread về 0', async () => {
  // Seed trực tiếp reminder_log (KHÔNG qua POST /api/reminders/run) — route đó phụ thuộc
  // scheduler.runOnce() vốn đang lỗi cú pháp trên MySQL (F13, xem test R060 phía trên); seed thẳng
  // để R057/R058/R059 (bản thân các route notification không dính F13) được đặc tả độc lập ở cả
  // 2 driver, không bị chặn bởi bug của route khác.
  const dateId = await createReminder({ title: 'Notif flow R057' });
  db.prepare("INSERT INTO reminder_log (date_id, occur_date, seq, channel, recipient_user_id) VALUES (?,?,?,?,?)")
    .run(dateId, todayGMT7(), 1, 'inapp', adminId);

  const before1 = await (await call('GET', '/api/notifications')).json();
  assert.ok(before1.rows.length >= 1);
  assert.ok(before1.unread >= 1);

  const target = before1.rows.find((r) => !r.read_at);
  const readRes = await call('POST', `/api/notifications/${target.id}/read`);
  assert.equal(readRes.status, 200);
  assert.deepEqual(await readRes.json(), { ok: true });
  const afterRead = await (await call('GET', '/api/notifications')).json();
  assert.equal(afterRead.unread, before1.unread - 1);

  const allRes = await call('POST', '/api/notifications/read-all');
  assert.equal(allRes.status, 200);
  const afterAll = await (await call('GET', '/api/notifications')).json();
  assert.equal(afterAll.unread, 0);
});
test('R057 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/notifications', { auth: false })).status, 401);
});
test('R058 not-found CHARACTERIZATION: đánh dấu đọc id log không tồn tại vẫn 200 {ok:true} (UPDATE 0 dòng, không lỗi)', async () => {
  const res = await call('POST', '/api/notifications/9999999/read');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});
test('R058 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/notifications/1/read', { auth: false })).status, 401);
});
test('R059 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/notifications/read-all', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R061 — GET /api/reminders/:id/ics (404 thật)
// ---------------------------------------------------------------------------
test('R061 happy: xuất .ics đúng content-type + filename', async () => {
  const id = await createReminder({ title: 'Sự kiện ICS' });
  const res = await call('GET', `/api/reminders/${id}/ics`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/calendar/);
  assert.match(res.headers.get('content-disposition') || '', new RegExp(`su-kien-${id}\\.ics`));
  const text = await res.text();
  assert.match(text, /BEGIN:VCALENDAR/);
  assert.match(text, /BEGIN:VALARM/);
});
test('R061 not-found: id không tồn tại trả 404 {error}', async () => {
  const res = await call('GET', '/api/reminders/9999999/ics');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'Không tìm thấy');
});
test('R061 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/reminders/1/ics', { auth: false })).status, 401);
});
