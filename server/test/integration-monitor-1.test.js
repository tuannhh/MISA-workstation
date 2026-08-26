'use strict';
// G1A.3 Batch "monitor-1" (1/2) — integration test HTTP cho nhóm "Giám sát truyền thông" phần 1
// (R104-R120): dashboard, danh sách tin/bài, thống kê từ khóa, sửa/xoá tin, quét (scan), AI
// highlights/competitor-brief, cài đặt quét, cảnh báo, bộ từ khóa CRUD.
//
// AN TOÀN MẠNG: R110 (POST /monitor/scan) trong sản phẩm fetch RSS thật của TOÀN BỘ `sources`
// enabled (không lọc theo query_ids — xem monitor.js runScan() bước 2), nên test happy path phải
// TẮT hết sources + dùng 1 scan_queries riêng include=[] grounding=0 để không tạo request mạng
// thật nào trong lúc chạy test. R112/R113 (AI Gemini) không cần mock: `gemini.js` throw đồng bộ
// "Chưa cấu hình GEMINI_API_KEY" TRƯỚC khi gọi mạng khi không có data/gemini.key trong DATA_DIR
// tạm của test — characterize đúng lỗi 500 đó, không phải giả lập.
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
  const admin = fixtures.createPrivilegedUser({ username: `monitor_admin_${Date.now()}` });
  cookie = (await fixtures.login(baseUrl, { username: admin.username, password: admin.password })).cookie;
  // Tắt toàn bộ sources RSS thật (26 nguồn seed) để R110 không fetch mạng thật.
  db.prepare('UPDATE sources SET enabled=0').run();
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
    content: 'Nội dung test', sentiment: null, published_at: '2026-08-01', status: 'Mới',
    ...overrides,
  };
  const keys = Object.keys(data);
  const r = db.prepare(`INSERT INTO mentions (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => data[k]));
  return r.lastInsertRowid;
}
function insertAlert(overrides = {}) {
  const data = { level: 'warning', title: `Cảnh báo test ${Date.now()}`, detail: null, occur_date: '2026-08-01', ...overrides };
  const keys = Object.keys(data);
  const r = db.prepare(`INSERT INTO monitor_alerts (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => data[k]));
  return r.lastInsertRowid;
}

// ---------------------------------------------------------------------------
// R104 — GET /api/monitor/dashboard
// ---------------------------------------------------------------------------
test('R104 happy: trả counts/sentiment/nsr/crisis/trend(14 ngày)/alerts/lastRun/sourceCount', async () => {
  insertMention({ category: 'brand', published_at: '2026-08-01' });
  const res = await call('GET', '/api/monitor/dashboard?from=2026-08-01&to=2026-08-31');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(typeof body.counts.total, 'number');
  assert.equal(body.trend.length, 14);
  assert.ok(Array.isArray(body.alerts));
});
test('R104 happy CHARACTERIZATION: thiếu from/to tự dùng dải 30 ngày gần nhất (periodOf mặc định), không lỗi', async () => {
  const res = await call('GET', '/api/monitor/dashboard');
  assert.equal(res.status, 200);
});
test('R104 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/monitor/dashboard', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R105 — GET /api/monitor/mentions
// ---------------------------------------------------------------------------
test('R105 happy: lọc category/sentiment/status/source_type/query_id/keyword/from/to/tag/search, phân trang, kèm queries', async () => {
  const title = `Tìm mention ${Date.now()}`;
  insertMention({ title, category: 'brand' });
  const res = await call('GET', `/api/monitor/mentions?search=${encodeURIComponent(title)}&category=brand`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.rows.some((r) => r.title === title));
  assert.ok(Array.isArray(body.queries));
});
test('R105 happy CHARACTERIZATION: date_field=created_at đổi cột lọc ngày, không lỗi', async () => {
  const res = await call('GET', '/api/monitor/mentions?date_field=created_at&from=2026-01-01');
  assert.equal(res.status, 200);
});
test('R105 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/monitor/mentions', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R106 — GET /api/monitor/keyword-stats
// ---------------------------------------------------------------------------
test('R106 happy: trả rows gộp theo query_id+matched_group, count number thật', async () => {
  insertMention({ matched_group: 'MISA', published_at: '2026-08-05' });
  const res = await call('GET', '/api/monitor/keyword-stats?from=2026-08-01&to=2026-08-31');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.rows));
  if (body.rows.length) assert.equal(typeof body.rows[0].c, 'number');
});
test('R106 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/monitor/keyword-stats', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R107 — POST /api/monitor/mentions/bulk-delete
// ---------------------------------------------------------------------------
test('R107 happy: xoá nhiều tin cùng lúc trả 200 {ok:true, deleted:n}', async () => {
  const id1 = insertMention(); const id2 = insertMention();
  const res = await call('POST', '/api/monitor/mentions/bulk-delete', { body: { ids: [id1, id2] } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.deleted, 2);
});
test('R107 invalid: thiếu/rỗng ids trả 400', async () => {
  const res = await call('POST', '/api/monitor/mentions/bulk-delete', { body: { ids: [] } });
  assert.equal(res.status, 400);
});
test('R107 happy CHARACTERIZATION: id không tồn tại trong mảng không lỗi, vẫn đếm là "đã xoá" (DELETE 0 dòng không phân biệt)', async () => {
  const res = await call('POST', '/api/monitor/mentions/bulk-delete', { body: { ids: [9999999] } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).deleted, 1);
});
test('R107 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/monitor/mentions/bulk-delete', { auth: false, body: { ids: [1] } })).status, 401);
});

// ---------------------------------------------------------------------------
// R108 — PUT /api/monitor/mentions/:id (sửa sentiment ghi audit + đánh dấu human)
// ---------------------------------------------------------------------------
test('R108 happy: sửa status/note trả 200 và thay đổi được ghi nhận', async () => {
  const id = insertMention();
  const res = await call('PUT', `/api/monitor/mentions/${id}`, { body: { status: 'Đã duyệt', note: 'ghi chú' } });
  assert.equal(res.status, 200);
  const row = db.prepare('SELECT status, note FROM mentions WHERE id=?').get(id);
  assert.equal(row.status, 'Đã duyệt');
});
test('R108 happy: sửa sentiment ghi sentiment_by=human + tạo sentiment_audit', async () => {
  const id = insertMention({ sentiment: 'neutral' });
  const res = await call('PUT', `/api/monitor/mentions/${id}`, { body: { sentiment: 'positive' } });
  assert.equal(res.status, 200);
  const row = db.prepare('SELECT sentiment, sentiment_by FROM mentions WHERE id=?').get(id);
  assert.equal(row.sentiment, 'positive');
  assert.equal(row.sentiment_by, 'human');
  const audit = db.prepare('SELECT * FROM sentiment_audit WHERE mention_id=?').get(id);
  assert.ok(audit);
  assert.equal(audit.old_sentiment, 'neutral');
});
test('R108 not-found: id không tồn tại trả 404', async () => {
  const res = await call('PUT', '/api/monitor/mentions/9999999', { body: { status: 'x' } });
  assert.equal(res.status, 404);
});
test('R108 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/monitor/mentions/1', { auth: false, body: {} })).status, 401);
});

// ---------------------------------------------------------------------------
// R109 — DELETE /api/monitor/mentions/:id
// ---------------------------------------------------------------------------
test('R109 happy: xoá tin trả 200, không còn truy vấn được', async () => {
  const id = insertMention();
  const res = await call('DELETE', `/api/monitor/mentions/${id}`);
  assert.equal(res.status, 200);
  assert.equal(db.prepare('SELECT id FROM mentions WHERE id=?').get(id), undefined);
});
test('R109 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/monitor/mentions/9999999');
  assert.equal(res.status, 200);
});
test('R109 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/monitor/mentions/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R110 — POST /api/monitor/scan (F3 SSRF hotspot — xem ghi chú an toàn mạng đầu file)
// ---------------------------------------------------------------------------
test('R110 happy (network-safe): dùng scan_queries include=[] grounding=0 + toàn bộ sources đã tắt -> fetched=0, không có request mạng thật', async () => {
  const qId = db.prepare(`INSERT INTO scan_queries (name, category, query_type, include, exclude, grounding) VALUES (?,?,?,?,?,0)`)
    .run('Bộ test network-safe', 'brand', 'news', '[]', '[]').lastInsertRowid;
  const res = await call('POST', '/api/monitor/scan', { body: { query_ids: [qId] } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.fetched, 0);
  assert.equal(body.new_mentions, 0);
  const run = db.prepare('SELECT status FROM scan_runs WHERE id=?').get(body.runId);
  assert.equal(run.status, 'done');
});
test('R110 invalid: thiếu/rỗng query_ids trả 400 (không chạm DB/mạng)', async () => {
  const res = await call('POST', '/api/monitor/scan', { body: { query_ids: [] } });
  assert.equal(res.status, 400);
});
test('R110 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/monitor/scan', { auth: false, body: { query_ids: [1] } })).status, 401);
});

// ---------------------------------------------------------------------------
// R111 — GET /api/monitor/runs
// ---------------------------------------------------------------------------
test('R111 happy: trả tối đa 50 lượt quét gần nhất', async () => {
  const res = await call('GET', '/api/monitor/runs');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray((await res.json()).rows));
});
test('R111 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/monitor/runs', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R112 — GET /api/monitor/highlights (Gemini grounding — không có GEMINI_API_KEY trong DATA_DIR
// tạm của test -> throw đồng bộ TRƯỚC khi gọi mạng, characterize đúng lỗi 500, không mock)
// ---------------------------------------------------------------------------
test('R112 happy CHARACTERIZATION: thiếu GEMINI_API_KEY -> 500 {error} (không gọi mạng thật)', async () => {
  const res = await call('GET', '/api/monitor/highlights');
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /GEMINI_API_KEY/);
});
test('R112 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/monitor/highlights', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R113 — GET /api/monitor/competitor-brief (cùng cơ chế R112)
// ---------------------------------------------------------------------------
test('R113 happy CHARACTERIZATION: thiếu GEMINI_API_KEY -> 500 {error} (không gọi mạng thật)', async () => {
  const res = await call('GET', '/api/monitor/competitor-brief');
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /GEMINI_API_KEY/);
});
test('R113 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/monitor/competitor-brief', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R114 — GET /api/monitor/settings
// ---------------------------------------------------------------------------
test('R114 happy: trả autoscan/interval_hours/scan_days với giá trị mặc định hợp lệ', async () => {
  const res = await call('GET', '/api/monitor/settings');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(typeof body.autoscan, 'boolean');
  assert.equal(typeof body.interval_hours, 'number');
  assert.equal(typeof body.scan_days, 'number');
});
test('R114 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/monitor/settings', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R115 — PUT /api/monitor/settings (bật autoscan tạo setInterval unref — tắt lại ngay trong test)
// ---------------------------------------------------------------------------
test('R115 happy: cập nhật interval_hours/scan_days, kẹp trong khoảng cho phép (clamp)', async () => {
  const res = await call('PUT', '/api/monitor/settings', { body: { interval_hours: 999, scan_days: 500 } });
  assert.equal(res.status, 200);
  const body = await (await call('GET', '/api/monitor/settings')).json();
  assert.equal(body.interval_hours, 168);
  assert.equal(body.scan_days, 365);
});
test('R115 happy CHARACTERIZATION: scan_days=0 bị coi là falsy nên rơi về mặc định 30 (KHÔNG bị kẹp thành 1) do `parseInt(...) || 30` chạy trước Math.max/min', async () => {
  const res = await call('PUT', '/api/monitor/settings', { body: { scan_days: 0 } });
  assert.equal(res.status, 200);
  const body = await (await call('GET', '/api/monitor/settings')).json();
  assert.equal(body.scan_days, 30);
});
test('R115 happy: bật rồi tắt lại autoscan ngay (an toàn - timer.unref(), không giữ process sống)', async () => {
  await call('PUT', '/api/monitor/settings', { body: { autoscan: true } });
  const on = await (await call('GET', '/api/monitor/settings')).json();
  assert.equal(on.autoscan, true);
  await call('PUT', '/api/monitor/settings', { body: { autoscan: false } });
  const off = await (await call('GET', '/api/monitor/settings')).json();
  assert.equal(off.autoscan, false);
});
test('R115 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/monitor/settings', { auth: false, body: {} })).status, 401);
});

// ---------------------------------------------------------------------------
// R116 — POST /api/monitor/alerts/:id/read
// ---------------------------------------------------------------------------
test('R116 happy: đánh dấu đã đọc trả 200, read_at được set', async () => {
  const id = insertAlert();
  const res = await call('POST', `/api/monitor/alerts/${id}/read`);
  assert.equal(res.status, 200);
  const row = db.prepare('SELECT read_at FROM monitor_alerts WHERE id=?').get(id);
  assert.ok(row.read_at);
});
test('R116 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (UPDATE 0 dòng không lỗi)', async () => {
  const res = await call('POST', '/api/monitor/alerts/9999999/read');
  assert.equal(res.status, 200);
});
test('R116 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/monitor/alerts/1/read', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R117 — GET /api/monitor/queries
// ---------------------------------------------------------------------------
test('R117 happy: trả danh sách bộ từ khóa sắp theo category+name', async () => {
  const res = await call('GET', '/api/monitor/queries');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray((await res.json()).rows));
});
test('R117 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/monitor/queries', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R118 — POST /api/monitor/queries
// ---------------------------------------------------------------------------
test('R118 happy: tạo bộ từ khóa hợp lệ trả 200 + id', async () => {
  const res = await call('POST', '/api/monitor/queries', { body: { name: `Bộ test ${Date.now()}`, category: 'brand', include: [['MISA']] } });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).id);
});
test('R118 invalid: thiếu name trả 400', async () => {
  const res = await call('POST', '/api/monitor/queries', { body: { category: 'brand' } });
  assert.equal(res.status, 400);
});
test('R118 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/monitor/queries', { auth: false, body: { name: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R119 — PUT /api/monitor/queries/:id
// ---------------------------------------------------------------------------
test('R119 happy: cập nhật bộ từ khóa trả 200 và thay đổi được ghi nhận', async () => {
  const id = (await (await call('POST', '/api/monitor/queries', { body: { name: 'Bộ gốc' } })).json()).id;
  const res = await call('PUT', `/api/monitor/queries/${id}`, { body: { name: 'Bộ đã sửa' } });
  assert.equal(res.status, 200);
  const row = db.prepare('SELECT name FROM scan_queries WHERE id=?').get(id);
  assert.equal(row.name, 'Bộ đã sửa');
});
test('R119 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/monitor/queries/1', { auth: false, body: {} })).status, 401);
});

// ---------------------------------------------------------------------------
// R120 — DELETE /api/monitor/queries/:id
// ---------------------------------------------------------------------------
test('R120 happy: xoá bộ từ khóa trả 200, không còn truy vấn được', async () => {
  const id = (await (await call('POST', '/api/monitor/queries', { body: { name: 'Bộ để xoá' } })).json()).id;
  const res = await call('DELETE', `/api/monitor/queries/${id}`);
  assert.equal(res.status, 200);
  assert.equal(db.prepare('SELECT id FROM scan_queries WHERE id=?').get(id), undefined);
});
test('R120 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/monitor/queries/9999999');
  assert.equal(res.status, 200);
});
test('R120 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/monitor/queries/1', { auth: false })).status, 401);
});
