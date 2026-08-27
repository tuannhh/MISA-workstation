'use strict';
// G1A.3 Batch "monitor-2" (2/2) — integration test HTTP cho nhóm "Giám sát truyền thông" phần 2
// (R121-R135): CRUD nguồn tin (sources), đối thủ (competitors), chiến dịch (campaigns) + kết
// quả/đánh giá chiến dịch.
//
// AN TOÀN MẠNG: R122 chặn URL internal/private fail-closed trước fetch. URL public bình thường
// vẫn được dò RSS qua outbound seam; các test integration chỉ dùng loopback để xác minh guard.
// R135 (GET /monitor/campaigns/:id/evaluate) gọi monitor.evaluateCampaign() -> gemini.groundedSearch()
// — throw đồng bộ "Chưa cấu hình GEMINI_API_KEY" TRƯỚC khi gọi mạng khi DATA_DIR tạm của test
// không có data/gemini.key, characterize đúng lỗi 500 đó, không phải giả lập (đã xác nhận ở batch
// monitor phần 1 cho R112/R113, cùng cơ chế).
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
  const dbMod = require('../db');
  db = dbMod.db;
  resources.acquire(dbMod.closeDb);
  const { createApp } = require('../app');
  fixtures = require('../test-support/fixtures');
  const started = await startTestApp(createApp());
  baseUrl = started.baseUrl;
  resources.acquire(started.close);
  const admin = fixtures.createPrivilegedUser({ username: `monitor2_admin_${Date.now()}` });
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
function insertMention(overrides = {}) {
  const data = {
    query_id: null, source_id: null, source_type: 'news', source_name: 'Báo Test',
    category: 'brand', title: `Tin test ${Date.now()}_${Math.random()}`, link: `https://test.local/${Date.now()}_${Math.random()}`,
    content: 'Nội dung test', sentiment: 'positive', published_at: '2026-08-10', status: 'Mới',
    ...overrides,
  };
  const keys = Object.keys(data);
  const r = db.prepare(`INSERT INTO mentions (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => data[k]));
  return r.lastInsertRowid;
}

// ---------------------------------------------------------------------------
// R121 — GET /api/monitor/sources
// ---------------------------------------------------------------------------
test('R121 happy: trả danh sách nguồn tin sắp theo type+name', async () => {
  const res = await call('GET', '/api/monitor/sources');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray((await res.json()).rows));
});
test('R121 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/monitor/sources', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R122 — POST /api/monitor/sources (F3 SSRF hotspot — xem ghi chú an toàn mạng đầu file)
// ---------------------------------------------------------------------------
test('R122 security: URL loopback bị chặn fail-closed, không tạo nguồn', async () => {
  const res = await call('POST', '/api/monitor/sources', { body: { name: `Nguồn test ${Date.now()}`, url: 'http://127.0.0.1:1/nofeed', type: 'news' } });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /URL không được phép/);
});
test('R122 invalid: thiếu name/url trả 400', async () => {
  assert.equal((await call('POST', '/api/monitor/sources', { body: { name: 'x' } })).status, 400);
  assert.equal((await call('POST', '/api/monitor/sources', { body: { url: 'http://127.0.0.1:1' } })).status, 400);
});
test('R122 security: URL không scheme dẫn tới loopback vẫn bị chặn sau normalize', async () => {
  const res = await call('POST', '/api/monitor/sources', { body: { name: `Nguồn không scheme ${Date.now()}`, url: '127.0.0.1:1/x' } });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /URL không được phép/);
});
test('R122 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/monitor/sources', { auth: false, body: { name: 'x', url: 'http://127.0.0.1:1' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R123 — PUT /api/monitor/sources/:id
// ---------------------------------------------------------------------------
test('R123 happy: sửa tên/enabled trả 200 và thay đổi được ghi nhận', async () => {
  const id = db.prepare(`INSERT INTO sources (name, type, url, enabled, auto, mode) VALUES (?,?,?,1,0,'rss')`)
    .run('Nguồn gốc', 'news', 'http://127.0.0.1:1/a').lastInsertRowid;
  const res = await call('PUT', `/api/monitor/sources/${id}`, { body: { name: 'Nguồn đã sửa', enabled: false } });
  assert.equal(res.status, 200);
  const row = db.prepare('SELECT name, enabled FROM sources WHERE id=?').get(id);
  assert.equal(row.name, 'Nguồn đã sửa');
  assert.equal(row.enabled, 0);
});
test('R123 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/monitor/sources/1', { auth: false, body: {} })).status, 401);
});

// ---------------------------------------------------------------------------
// R124 — DELETE /api/monitor/sources/:id
// ---------------------------------------------------------------------------
test('R124 happy: xoá nguồn tin trả 200, không còn truy vấn được', async () => {
  const id = db.prepare(`INSERT INTO sources (name, type, url, enabled, auto, mode) VALUES (?,?,?,1,0,'rss')`)
    .run('Nguồn để xoá', 'news', 'http://127.0.0.1:1/b').lastInsertRowid;
  const res = await call('DELETE', `/api/monitor/sources/${id}`);
  assert.equal(res.status, 200);
  assert.equal(db.prepare('SELECT id FROM sources WHERE id=?').get(id), undefined);
});
test('R124 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/monitor/sources/9999999');
  assert.equal(res.status, 200);
});
test('R124 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/monitor/sources/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R125 — GET /api/monitor/competitors
// ---------------------------------------------------------------------------
test('R125 happy: trả danh sách đối thủ sắp theo tên', async () => {
  const res = await call('GET', '/api/monitor/competitors');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray((await res.json()).rows));
});
test('R125 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/monitor/competitors', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R126 — POST /api/monitor/competitors
// ---------------------------------------------------------------------------
test('R126 happy: tạo đối thủ hợp lệ trả 200 + id', async () => {
  const res = await call('POST', '/api/monitor/competitors', { body: { name: `Đối thủ ${Date.now()}`, website: 'https://x.test', channels: ['Facebook'] } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.id);
  const row = db.prepare('SELECT channels FROM competitors WHERE id=?').get(body.id);
  assert.deepEqual(JSON.parse(row.channels), ['Facebook']);
});
test('R126 invalid: thiếu name trả 400', async () => {
  assert.equal((await call('POST', '/api/monitor/competitors', { body: { website: 'https://x.test' } })).status, 400);
});
test('R126 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/monitor/competitors', { auth: false, body: { name: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R127 — PUT /api/monitor/competitors/:id
// ---------------------------------------------------------------------------
test('R127 happy: sửa đối thủ trả 200 và thay đổi được ghi nhận', async () => {
  const id = (await (await call('POST', '/api/monitor/competitors', { body: { name: 'Đối thủ gốc' } })).json()).id;
  const res = await call('PUT', `/api/monitor/competitors/${id}`, { body: { name: 'Đối thủ đã sửa', note: 'ghi chú' } });
  assert.equal(res.status, 200);
  const row = db.prepare('SELECT name, note FROM competitors WHERE id=?').get(id);
  assert.equal(row.name, 'Đối thủ đã sửa');
});
test('R127 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/monitor/competitors/1', { auth: false, body: {} })).status, 401);
});

// ---------------------------------------------------------------------------
// R128 — DELETE /api/monitor/competitors/:id
// ---------------------------------------------------------------------------
test('R128 happy: xoá đối thủ trả 200, không còn truy vấn được', async () => {
  const id = (await (await call('POST', '/api/monitor/competitors', { body: { name: 'Đối thủ để xoá' } })).json()).id;
  const res = await call('DELETE', `/api/monitor/competitors/${id}`);
  assert.equal(res.status, 200);
  assert.equal(db.prepare('SELECT id FROM competitors WHERE id=?').get(id), undefined);
});
test('R128 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/monitor/competitors/9999999');
  assert.equal(res.status, 200);
});
test('R128 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/monitor/competitors/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R129 — GET /api/monitor/campaigns
// ---------------------------------------------------------------------------
test('R129 happy: trả danh sách chiến dịch, keywords/competitors đã parse JSON->mảng', async () => {
  await call('POST', '/api/monitor/campaigns', { body: { name: `CD ${Date.now()}`, keywords: ['MISA'] } });
  const res = await call('GET', '/api/monitor/campaigns');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.rows));
  assert.ok(Array.isArray(body.rows[0].keywords));
});
test('R129 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/monitor/campaigns', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R130 — GET /api/monitor/campaigns/:id
// ---------------------------------------------------------------------------
test('R130 happy: trả chi tiết chiến dịch', async () => {
  const id = (await (await call('POST', '/api/monitor/campaigns', { body: { name: 'CD chi tiết' } })).json()).id;
  const res = await call('GET', `/api/monitor/campaigns/${id}`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).record.name, 'CD chi tiết');
});
test('R130 not-found: id không tồn tại trả 404', async () => {
  assert.equal((await call('GET', '/api/monitor/campaigns/9999999')).status, 404);
});
test('R130 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/monitor/campaigns/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R131 — POST /api/monitor/campaigns
// ---------------------------------------------------------------------------
test('R131 happy: tạo chiến dịch hợp lệ trả 200 + id, created_by = user hiện tại', async () => {
  const res = await call('POST', '/api/monitor/campaigns', { body: { name: `CD tạo ${Date.now()}`, keywords: ['A', 'B'], competitors: [{ name: 'Đối thủ X' }] } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.id);
  const row = db.prepare('SELECT created_by, keywords, competitors FROM campaigns WHERE id=?').get(body.id);
  assert.ok(row.created_by);
  assert.deepEqual(JSON.parse(row.keywords), ['A', 'B']);
});
test('R131 invalid: thiếu name trả 400', async () => {
  assert.equal((await call('POST', '/api/monitor/campaigns', { body: { message: 'x' } })).status, 400);
});
test('R131 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/monitor/campaigns', { auth: false, body: { name: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R132 — PUT /api/monitor/campaigns/:id
// ---------------------------------------------------------------------------
test('R132 happy: sửa chiến dịch trả 200 và thay đổi được ghi nhận', async () => {
  const id = (await (await call('POST', '/api/monitor/campaigns', { body: { name: 'CD gốc' } })).json()).id;
  const res = await call('PUT', `/api/monitor/campaigns/${id}`, { body: { name: 'CD đã sửa', status: 'Kết thúc' } });
  assert.equal(res.status, 200);
  const row = db.prepare('SELECT name, status FROM campaigns WHERE id=?').get(id);
  assert.equal(row.name, 'CD đã sửa');
  assert.equal(row.status, 'Kết thúc');
});
test('R132 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/monitor/campaigns/1', { auth: false, body: {} })).status, 401);
});

// ---------------------------------------------------------------------------
// R133 — DELETE /api/monitor/campaigns/:id
// ---------------------------------------------------------------------------
test('R133 happy: xoá chiến dịch trả 200, không còn truy vấn được', async () => {
  const id = (await (await call('POST', '/api/monitor/campaigns', { body: { name: 'CD để xoá' } })).json()).id;
  const res = await call('DELETE', `/api/monitor/campaigns/${id}`);
  assert.equal(res.status, 200);
  assert.equal(db.prepare('SELECT id FROM campaigns WHERE id=?').get(id), undefined);
});
test('R133 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/monitor/campaigns/9999999');
  assert.equal(res.status, 200);
});
test('R133 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/monitor/campaigns/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R134 — GET /api/monitor/campaigns/:id/results
// ---------------------------------------------------------------------------
test('R134 happy: tổng hợp mention khớp từ khóa trong khoảng ngày, sentiment/nsr/timeline/sample đúng', async () => {
  const kw = `TuKhoaChienDich${Date.now()}`;
  insertMention({ title: `Tin về ${kw}`, published_at: '2026-08-10', sentiment: 'positive' });
  insertMention({ title: `Bài khác ${kw} tiêu cực`, published_at: '2026-08-11', sentiment: 'negative' });
  const id = (await (await call('POST', '/api/monitor/campaigns', {
    body: { name: 'CD kết quả', keywords: [kw], start_date: '2026-08-01', end_date: '2026-08-31' },
  })).json()).id;
  const res = await call('GET', `/api/monitor/campaigns/${id}/results`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.total, 2);
  assert.equal(body.sentiment.positive, 1);
  assert.equal(body.sentiment.negative, 1);
  assert.equal(typeof body.nsr, 'number');
  assert.ok(Array.isArray(body.timeline));
  assert.ok(Array.isArray(body.sample));
});
test('R134 happy CHARACTERIZATION: chiến dịch không có keywords -> total=0 (không match gì)', async () => {
  const id = (await (await call('POST', '/api/monitor/campaigns', { body: { name: 'CD không từ khóa' } })).json()).id;
  const res = await call('GET', `/api/monitor/campaigns/${id}/results`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).total, 0);
});
test('R134 not-found: id không tồn tại trả 404', async () => {
  assert.equal((await call('GET', '/api/monitor/campaigns/9999999/results')).status, 404);
});
test('R134 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/monitor/campaigns/1/results', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R135 — GET /api/monitor/campaigns/:id/evaluate (Gemini grounding — không có GEMINI_API_KEY
// trong DATA_DIR tạm của test -> throw đồng bộ TRƯỚC khi gọi mạng, characterize đúng lỗi 500)
// ---------------------------------------------------------------------------
test('R135 happy CHARACTERIZATION: thiếu GEMINI_API_KEY -> 500 {error} (không gọi mạng thật)', async () => {
  const id = (await (await call('POST', '/api/monitor/campaigns', { body: { name: 'CD đánh giá' } })).json()).id;
  const res = await call('GET', `/api/monitor/campaigns/${id}/evaluate`);
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /GEMINI_API_KEY/);
});
test('R135 not-found: id không tồn tại trả 404 (không chạm Gemini)', async () => {
  assert.equal((await call('GET', '/api/monitor/campaigns/9999999/evaluate')).status, 404);
});
test('R135 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/monitor/campaigns/1/evaluate', { auth: false })).status, 401);
});
