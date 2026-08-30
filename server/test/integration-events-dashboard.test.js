'use strict';
// G1A.3 Batch "events-dashboard" (1/1) — integration test HTTP cho nhóm "Sự kiện" (R087-R096) và
// "Dashboard" (R097-R098): CRUD sự kiện, chi phí (sponsor/organization/media), upload tài liệu,
// nhắc lịch, tổng quan trang báo chí, dashboard tổng hợp (biểu đồ theo tháng).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');
const rbac = require('../rbac');

let baseUrl;
let cookie;
let viewerCookie; // D13 target role
let executorCookie; // D13 target role
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
  const admin = fixtures.createPrivilegedUser({ username: `events_admin_${Date.now()}` });
  cookie = (await fixtures.login(baseUrl, { username: admin.username, password: admin.password })).cookie;
  const viewer = fixtures.createUser('viewer', { username: `events_viewer_${Date.now()}` });
  viewerCookie = (await fixtures.login(baseUrl, { username: viewer.username, password: viewer.password })).cookie;
  const executor = fixtures.createUser('executor', { username: `events_executor_${Date.now()}` });
  executorCookie = (await fixtures.login(baseUrl, { username: executor.username, password: executor.password })).cookie;
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
async function createEvent(overrides = {}) {
  const res = await call('POST', '/api/events', { body: { name: `Sự kiện ${Date.now()}_${Math.random()}`, mode: 'host', start_time: '2026-09-01T09:00:00Z', ...overrides } });
  assert.equal(res.status, 200);
  return (await res.json()).id;
}

// ---------------------------------------------------------------------------
// R087 — GET /api/events
// ---------------------------------------------------------------------------
test('R087 happy: tìm theo name/organizer, lọc mode/field/status, phân trang, có total_cost', async () => {
  const name = `Sự kiện Tìm ${Date.now()}`;
  const id = await createEvent({ name });
  const res = await call('GET', `/api/events?search=${encodeURIComponent(name)}&mode=host`);
  assert.equal(res.status, 200);
  const body = await res.json();
  const row = body.rows.find((r) => r.id === id);
  assert.ok(row);
  assert.equal(typeof row.total_cost, 'number');
});
test('R087 happy CHARACTERIZATION: mode lạ (ngoài join/host) bị bỏ qua filter, không lỗi', async () => {
  const res = await call('GET', '/api/events?mode=khong-hop-le');
  assert.equal(res.status, 200);
});
test('R087 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/events', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R088 — GET /api/events/:id
// ---------------------------------------------------------------------------
test('R088 happy: trả record + costs (chia 3 nhóm sponsor/organization/media) + totals + attachments', async () => {
  const id = await createEvent();
  const res = await call('GET', `/api/events/${id}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.record.id, id);
  assert.ok('sponsor' in body.costs && 'organization' in body.costs && 'media' in body.costs);
  assert.equal(typeof body.totals.grand, 'number');
});
test('R088 happy: totals.grand cộng đúng bằng số khi có nhiều cost (F14-style hotspot, xác nhận không tái diễn)', async () => {
  const id = await createEvent();
  await call('POST', `/api/events/${id}/costs`, { body: { category: 'sponsor', amount: 300000 } });
  await call('POST', `/api/events/${id}/costs`, { body: { category: 'media', amount: 700000 } });
  const body = await (await call('GET', `/api/events/${id}`)).json();
  assert.equal(typeof body.totals.sponsor, 'number');
  assert.equal(typeof body.totals.media, 'number');
  assert.equal(typeof body.totals.grand, 'number');
  assert.equal(body.totals.grand, body.totals.sponsor + body.totals.organization + body.totals.media);
  assert.equal(body.totals.grand, 1000000);
});
test('R088 not-found: id không tồn tại trả 404', async () => {
  const res = await call('GET', '/api/events/9999999');
  assert.equal(res.status, 404);
});
test('R088 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/events/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R089 — POST /api/events
// ---------------------------------------------------------------------------
test('R089 happy: tạo sự kiện hợp lệ trả 200 + id', async () => {
  const id = await createEvent({ name: 'Hội nghị Chiến lược 2026' });
  const res = await call('GET', `/api/events/${id}`);
  assert.equal((await res.json()).record.name, 'Hội nghị Chiến lược 2026');
});
test('R089 invalid: thiếu name (NOT NULL) trả 400', async () => {
  const res = await call('POST', '/api/events', { body: { mode: 'host' } });
  assert.equal(res.status, 400);
});
test('R089 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/events', { auth: false, body: { name: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R090 — PUT /api/events/:id
// ---------------------------------------------------------------------------
test('R090 happy: cập nhật sự kiện trả 200 và thay đổi được ghi nhận', async () => {
  const id = await createEvent();
  const res = await call('PUT', `/api/events/${id}`, { body: { name: 'Đã sửa tên sự kiện' } });
  assert.equal(res.status, 200);
  const rec = (await (await call('GET', `/api/events/${id}`)).json()).record;
  assert.equal(rec.name, 'Đã sửa tên sự kiện');
});
test('R090 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (UPDATE 0 dòng không lỗi)', async () => {
  const res = await call('PUT', '/api/events/9999999', { body: { name: 'x' } });
  assert.equal(res.status, 200);
});
test('R090 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/events/1', { auth: false, body: { name: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R091 — DELETE /api/events/:id (xoá file vật lý attachments trước khi xoá record; F15 hotspot)
// ---------------------------------------------------------------------------
test('R091 happy: xoá sự kiện kèm attachments trả 200, không còn truy vấn được', async () => {
  const id = await createEvent();
  await uploadFiles(`/api/events/${id}/files`, [{ name: 'anh-su-kien.png' }]);
  const res = await call('DELETE', `/api/events/${id}`);
  assert.equal(res.status, 200);
  assert.equal((await call('GET', `/api/events/${id}`)).status, 404);
});
test('R091: xoá event cascade xoá event_costs liên quan (F15 đã sửa — MySQL nay cascade thật, đồng nhất SQLite)', async () => {
  const id = await createEvent();
  const cid = (await (await call('POST', `/api/events/${id}/costs`, { body: { category: 'media', amount: 1 } })).json()).id;
  await call('DELETE', `/api/events/${id}`);
  const { db } = require('../db');
  const cost = db.prepare('SELECT id FROM event_costs WHERE id=?').get(cid);
  assert.ok(!cost, 'ON DELETE CASCADE phải xoá luôn event_costs con');
});
test('R091 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/events/9999999');
  assert.equal(res.status, 200);
});
test('R091 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/events/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R092 — POST /api/events/:id/costs
// ---------------------------------------------------------------------------
test('R092 happy: tạo chi phí sự kiện trả 200 + id', async () => {
  const id = await createEvent();
  const res = await call('POST', `/api/events/${id}/costs`, { body: { category: 'organization', title: 'Thuê hội trường', amount: 20000000 } });
  assert.equal(res.status, 200);
  const body = await (await call('GET', `/api/events/${id}`)).json();
  assert.equal(body.costs.organization.length, 1);
});
test('R092 invalid: thiếu category (NOT NULL) trả 400', async () => {
  const id = await createEvent();
  const res = await call('POST', `/api/events/${id}/costs`, { body: { title: 'x', amount: 1 } });
  assert.equal(res.status, 400);
});
test('R092 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/events/1/costs', { auth: false, body: { category: 'media' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R093 — PUT /api/events/:id/costs/:cid
// ---------------------------------------------------------------------------
test('R093 happy: cập nhật chi phí trả 200 và thay đổi được ghi nhận', async () => {
  const id = await createEvent();
  const cid = (await (await call('POST', `/api/events/${id}/costs`, { body: { category: 'media', amount: 1 } })).json()).id;
  const res = await call('PUT', `/api/events/${id}/costs/${cid}`, { body: { category: 'media', amount: 999 } });
  assert.equal(res.status, 200);
  const body = await (await call('GET', `/api/events/${id}`)).json();
  assert.equal(body.costs.media.find((c) => c.id === cid).amount, 999);
});
test('R093 not-found CHARACTERIZATION: cid không tồn tại vẫn trả 200 {ok:true} (UPDATE 0 dòng không lỗi)', async () => {
  const res = await call('PUT', '/api/events/1/costs/9999999', { body: { category: 'media' } });
  assert.equal(res.status, 200);
});
test('R093 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/events/1/costs/1', { auth: false, body: {} })).status, 401);
});

// ---------------------------------------------------------------------------
// R094 — DELETE /api/events/:id/costs/:cid
// ---------------------------------------------------------------------------
test('R094 happy: xoá chi phí trả 200, không còn trong danh sách', async () => {
  const id = await createEvent();
  const cid = (await (await call('POST', `/api/events/${id}/costs`, { body: { category: 'media', amount: 1 } })).json()).id;
  const res = await call('DELETE', `/api/events/${id}/costs/${cid}`);
  assert.equal(res.status, 200);
  const body = await (await call('GET', `/api/events/${id}`)).json();
  assert.ok(!body.costs.media.some((c) => c.id === cid));
});
test('R094 not-found CHARACTERIZATION: cid không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/events/1/costs/9999999');
  assert.equal(res.status, 200);
});
test('R094 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/events/1/costs/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R095 — POST /api/events/:id/files (upload ≤10 file, kind từ query string CHARACTERIZATION F9: chỉ cắt 40 ký tự, không whitelist)
// ---------------------------------------------------------------------------
test('R095 happy: upload 1 file trả 200, kind mặc định "doc" khi không truyền query', async () => {
  const id = await createEvent();
  const res = await uploadFiles(`/api/events/${id}/files`, [{ name: 'anh.png' }]);
  assert.equal(res.status, 200);
  const atts = (await (await call('GET', `/api/events/${id}`)).json()).attachments;
  assert.equal(atts.length, 1);
  assert.equal(atts[0].kind, 'doc');
});
test('R095 happy CHARACTERIZATION (F9): kind lấy trực tiếp từ query string, không whitelist — giá trị tuỳ ý bị cắt còn 40 ký tự vẫn được lưu', async () => {
  const id = await createEvent();
  const weirdKind = 'x'.repeat(60);
  const res = await uploadFiles(`/api/events/${id}/files?kind=${weirdKind}`, [{ name: 'anh.png' }]);
  assert.equal(res.status, 200);
  const atts = (await (await call('GET', `/api/events/${id}`)).json()).attachments;
  assert.equal(atts[0].kind, weirdKind.slice(0, 40));
});
test('R095 happy CHARACTERIZATION: không gửi file nào vẫn trả 200 (route không kiểm files.length, giống R086 suppliers)', async () => {
  const id = await createEvent();
  const res = await uploadFiles(`/api/events/${id}/files`, []);
  assert.equal(res.status, 200);
});
test('R095 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await uploadFiles('/api/events/1/files', [{ name: 'x.png' }], { auth: false })).status, 401);
});
// D13-086 — batch W1.FILE P2: event là entity Direct — upload file nay gate theo owner_id giống
// PUT /events/:id, không chỉ gate thô theo role (trước đây bất kỳ executor nào cũng upload được
// vào event người khác tạo).
test('D13-086: executor upload file vào event KHÔNG phải của mình trả 403; vào event của chính mình trả 200; admin luôn 200 bất kể ai tạo', async () => {
  const othersId = await createEvent({ name: 'Sự kiện của admin' });
  assert.equal((await uploadFiles(`/api/events/${othersId}/files`, [{ name: 'khac.png' }], { as: executorCookie })).status, 403);
  const myRes = await call('POST', '/api/events', { body: { name: 'Sự kiện của executor', mode: 'host', start_time: '2026-09-01T09:00:00Z' }, as: executorCookie });
  const myId = (await myRes.json()).id;
  assert.equal((await uploadFiles(`/api/events/${myId}/files`, [{ name: 'cuaminh.png' }], { as: executorCookie })).status, 200);
  assert.equal((await uploadFiles(`/api/events/${othersId}/files`, [{ name: 'admin.png' }])).status, 200);
});

// ---------------------------------------------------------------------------
// R096 — POST /api/events/:id/remind (side-effect: tạo important_dates)
// ---------------------------------------------------------------------------
test('R096 happy: tạo nhắc lịch sự kiện trả 200 + id', async () => {
  const id = await createEvent({ start_time: '2026-10-01T09:00:00Z' });
  const res = await call('POST', `/api/events/${id}/remind`, { body: { lead_days: 5 } });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).id);
});
test('R096 invalid: sự kiện chưa có start_time trả 400', async () => {
  const id = await createEvent({ start_time: null });
  const res = await call('POST', `/api/events/${id}/remind`);
  assert.equal(res.status, 400);
});
test('R096 invalid CHARACTERIZATION: event_id không tồn tại cũng trả 400 (route gộp chung not-found và thiếu start_time cùng 1 nhánh `!e || !e.start_time`, không phân biệt 404)', async () => {
  const res = await call('POST', '/api/events/9999999/remind');
  assert.equal(res.status, 400);
});
test('R096 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/events/1/remind', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// D13-059..065 — batch RBAC-EXP-B4 (1/6 entity Inherited — event_cost, + entity Direct event):
// event tự sở hữu owner_id (Direct); event_cost KHÔNG có owner_id riêng, kế thừa owner_id của
// event cha qua parentOwnerId (memory-bank/18-g1b-rbac-batch-contract.md#batch-rbac-exp-b4)
// ---------------------------------------------------------------------------
test('D13-059: viewer tạo event trả 403', async () => {
  const res = await call('POST', '/api/events', { body: { name: 'x' }, as: viewerCookie });
  assert.equal(res.status, 403);
});
test('D13-060: executor tạo event trả 200, owner_id = chính executor đó', async () => {
  const { db } = require('../db');
  const myId = (await (await call('POST', '/api/events', { body: { name: 'Của executor' }, as: executorCookie })).json()).id;
  const row = db.prepare('SELECT owner_id, created_by FROM events WHERE id=?').get(myId);
  const me = db.prepare("SELECT id FROM users WHERE username LIKE 'events_executor_%' ORDER BY id DESC LIMIT 1").get();
  assert.equal(row.owner_id, me.id);
  assert.equal(row.created_by, me.id);
});
test('D13-061: executor PUT event của người khác trả 403; PUT event mình sở hữu trả 200', async () => {
  const myId = (await (await call('POST', '/api/events', { body: { name: 'Trước sửa' }, as: executorCookie })).json()).id;
  assert.equal((await call('PUT', `/api/events/${myId}`, { body: { name: 'Executor tự sửa' }, as: executorCookie })).status, 200);
  const othersId = await createEvent({ name: 'Của người khác' });
  assert.equal((await call('PUT', `/api/events/${othersId}`, { body: { name: 'x' }, as: executorCookie })).status, 403);
});
test('D13-062: executor DELETE event (kể cả của chính mình) luôn 403; viewer PUT/DELETE cũng 403', async () => {
  const myId = (await (await call('POST', '/api/events', { body: { name: 'Của executor để xoá' }, as: executorCookie })).json()).id;
  assert.equal((await call('DELETE', `/api/events/${myId}`, { as: executorCookie })).status, 403);
  const id = await createEvent();
  assert.equal((await call('PUT', `/api/events/${id}`, { body: { name: 'x' }, as: viewerCookie })).status, 403);
  assert.equal((await call('DELETE', `/api/events/${id}`, { as: viewerCookie })).status, 403);
});
test('D13-063: event_cost kế thừa owner_id CỦA EVENT CHA — executor tạo cost cho event MÌNH sở hữu trả 200, tạo cho event NGƯỜI KHÁC sở hữu trả 403', async () => {
  const myEventId = (await (await call('POST', '/api/events', { body: { name: 'Event của executor cho cost' }, as: executorCookie })).json()).id;
  const ok = await call('POST', `/api/events/${myEventId}/costs`, { body: { category: 'media', amount: 100 }, as: executorCookie });
  assert.equal(ok.status, 200);
  const othersEventId = await createEvent({ name: 'Event của người khác cho cost' });
  const denied = await call('POST', `/api/events/${othersEventId}/costs`, { body: { category: 'media', amount: 100 }, as: executorCookie });
  assert.equal(denied.status, 403);
});
test('D13-064: executor thấy amount/total_cost trên event mình sở hữu, KHÔNG thấy trên event người khác sở hữu; viewer không bao giờ thấy amount', async () => {
  const myEventId = (await (await call('POST', '/api/events', { body: { name: 'Event executor xem cost' }, as: executorCookie })).json()).id;
  await call('POST', `/api/events/${myEventId}/costs`, { body: { category: 'media', amount: 500000 }, as: executorCookie });
  const mine = await (await call('GET', `/api/events/${myEventId}`, { as: executorCookie })).json();
  assert.equal(typeof mine.totals.grand, 'number');
  assert.equal(mine.costs.media[0].amount, 500000);

  const othersName = `Event người khác xem cost ${Date.now()}`;
  const othersEventId = await createEvent({ name: othersName });
  await call('POST', `/api/events/${othersEventId}/costs`, { body: { category: 'media', amount: 700000 } });
  const theirs = await (await call('GET', `/api/events/${othersEventId}`, { as: executorCookie })).json();
  assert.equal(theirs.totals.grand, rbac.MASK);
  assert.equal(theirs.costs.media[0].amount, rbac.MASK);

  const myRow = (await (await call('GET', `/api/events?search=${encodeURIComponent('Event executor xem cost')}`, { as: executorCookie })).json()).rows.find((r) => r.id === myEventId);
  const theirRow = (await (await call('GET', `/api/events?search=${encodeURIComponent(othersName)}`, { as: executorCookie })).json()).rows.find((r) => r.id === othersEventId);
  assert.equal(typeof myRow.total_cost, 'number');
  assert.equal(theirRow.total_cost, rbac.MASK);

  const viewerView = await (await call('GET', `/api/events/${myEventId}`, { as: viewerCookie })).json();
  assert.equal(viewerView.totals.grand, rbac.MASK);
});
test('D13-065: executor DELETE event_cost (kể cả trên event mình sở hữu) luôn 403; admin xoá 200', async () => {
  const myEventId = (await (await call('POST', '/api/events', { body: { name: 'Event executor xoá cost' }, as: executorCookie })).json()).id;
  const cid = (await (await call('POST', `/api/events/${myEventId}/costs`, { body: { category: 'media', amount: 1 }, as: executorCookie })).json()).id;
  assert.equal((await call('DELETE', `/api/events/${myEventId}/costs/${cid}`, { as: executorCookie })).status, 403);
  assert.equal((await call('DELETE', `/api/events/${myEventId}/costs/${cid}`)).status, 200);
});

// ---------------------------------------------------------------------------
// R097 — GET /api/press-overview
// ---------------------------------------------------------------------------
test('R097 happy: trả topPeople + recentInteractions (mảng, có thể rỗng)', async () => {
  const res = await call('GET', '/api/press-overview');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.topPeople) && Array.isArray(body.recentInteractions));
});
test('R097 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/press-overview', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R098 — GET /api/dashboard (N2, W1 nhánh security: nay có requirePerm('dashboard','view') tường
// minh — cả 2 role legacy đều được cấp dashboard:['view'] nên vẫn không có case forbidden ở đây)
// ---------------------------------------------------------------------------
test('R098 happy: trả overview + charts + upcoming + month/year', async () => {
  const res = await call('GET', '/api/dashboard');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.overview && body.overview.press && body.overview.assoc && body.overview.events);
  assert.ok(body.charts);
  assert.ok(Array.isArray(body.upcoming));
  assert.equal(typeof body.month, 'number');
  assert.equal(typeof body.year, 'number');
});
test('R098 happy: mọi field số trong overview đều là number thật (không phải string do SUM()/COUNT() driver khác nhau — F14-style hotspot)', async () => {
  const body = await (await call('GET', '/api/dashboard')).json();
  for (const group of Object.values(body.overview)) {
    for (const v of Object.values(group)) assert.equal(typeof v, 'number', `field phải là number, thực tế ${typeof v} (${v})`);
  }
  assert.equal(typeof body.overview.events.keynoteMonth, 'number');
});
test('R098 happy: charts.*Monthly là mảng 12 phần tử, mọi phần tử là number (assocActivityMonthly UNION 2 subquery + SUM ngoài — F14-style hotspot)', async () => {
  const body = await (await call('GET', '/api/dashboard')).json();
  for (const key of ['reportersMonthly', 'assocActivityMonthly', 'eventsHostMonthly', 'eventsJoinMonthly']) {
    assert.equal(body.charts[key].length, 12, `${key} phải có đúng 12 phần tử`);
    for (const v of body.charts[key]) assert.equal(typeof v, 'number', `${key} phải toàn number, thực tế ${typeof v} (${v})`);
  }
});
test('R098 happy: charts.assocActivityMonthly có phần tử number ĐÚNG khi thực sự có dữ liệu khớp tháng hiện tại (bug F14-style chỉ lộ khi SUM() gộp ≥1 dòng thật, không lộ lúc mảng toàn 0 mặc định — seed dữ liệu để không bỏ sót)', async () => {
  const org = await (await call('POST', '/api/partners', { body: { name: `Hiệp hội chart ${Date.now()}`, org_type: 'association' } })).json();
  // Dùng cùng mốc giờ Hà Nội (GMT+7) như production (routes.js: `new Date(Date.now() + 7 * 3600 * 1000)`)
  // — nếu seed theo UTC, gần nửa đêm VN 2 mốc có thể lệch tháng/ngày, khiến test flaky dù code đúng.
  const hanoiNow = new Date(Date.now() + 7 * 3600 * 1000);
  const today = hanoiNow.toISOString().slice(0, 10);
  const thisMonth = hanoiNow.getUTCMonth() + 1;
  await call('POST', '/api/interactions', { body: { partner_type: 'org', partner_id: org.id, date: today, summary: 'x' } });
  const body = await (await call('GET', '/api/dashboard')).json();
  const arr = body.charts.assocActivityMonthly;
  assert.equal(typeof arr[thisMonth - 1], 'number', `bucket tháng hiện tại phải là number, thực tế ${typeof arr[thisMonth - 1]}`);
  assert.ok(arr[thisMonth - 1] >= 1, `bucket tháng hiện tại phải >= 1, thực tế ${arr[thisMonth - 1]}`);
});
test('R098 happy: charts.reportersByBeat/assocByField là mảng {label, value}, value là number', async () => {
  const body = await (await call('GET', '/api/dashboard')).json();
  for (const key of ['reportersByBeat', 'assocByField']) {
    for (const row of body.charts[key]) assert.equal(typeof row.value, 'number', `${key}[].value phải là number`);
  }
});
test('R098 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/dashboard', { auth: false })).status, 401);
});
