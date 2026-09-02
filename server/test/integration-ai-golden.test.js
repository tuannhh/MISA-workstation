'use strict';
// Bundle A (2/N) — G1A.7 AI golden set: characterize TẤT CẢ 12 luồng logic egress Gemini
// (AI-E001..AI-E012, `memory-bank/06-threat-model.md` §A) khi API KEY CÓ CẤU HÌNH, dùng
// fake/fixture — KHÔNG gọi Gemini/Internet thật. Khác với integration-ai.test.js (R136-R142)
// vốn characterize nhánh "chưa cấu hình key -> throw trước khi gọi mạng", file này giả lập
// Gemini TRẢ VỀ THÀNH CÔNG (và các nhánh lỗi malformed/quota/timeout) để xác nhận tầng parse/
// schema/response-shaping phía trên `gemini.js` đúng — đây là phần logic KHÔNG được phủ bởi
// R136-R142.
//
// Cách ly mạng: `config.js` đọc `GEMINI_API_KEY` MỘT LẦN lúc require (biến `cfg.GEMINI_API_KEY`
// đóng băng) nên phải set `process.env.GEMINI_API_KEY` TRƯỚC mọi require — file test này chạy
// trong 1 subprocess riêng (quy ước `node --test server/test/*.test.js`, mỗi file 1 process) nên
// không ảnh hưởng các file test khác đang characterize nhánh không-key. `global.fetch` được thay
// bằng 1 hàng đợi (queue) fixture đáp ứng ĐÚNG THỨ TỰ lời gọi mạng thật sự xảy ra (kể cả lời gọi
// không phải Gemini — vd `resolveLink()`/URL-fetch trực tiếp trong award-extract nhánh url,
// `groundIngest`) — bất kỳ lời gọi nào vượt hàng đợi sẽ throw ngay, đảm bảo test thất bại rõ ràng
// thay vì âm thầm lọt ra ngoài chạm mạng thật.
process.env.GEMINI_API_KEY = 'golden-test-fake-key-not-real';

const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { createResourceStack } = require('../test-support/resource-stack');
const { startTestApp } = require('../test-support/app-harness');
const fixtures = require('../test-support/fixtures');
const outbound = require('../safe-fetch');

// Lưu lại fetch THẬT trước khi bất kỳ test nào thay global.fetch — dùng để gọi vào chính server
// test cục bộ (baseUrl), TÁCH BIỆT khỏi global.fetch bị mock (dùng cho lời gọi mạng ra ngoài của
// server, vd gemini.js/resolveLink()). Cả 2 đều là "fetch" nhưng khác mục đích, nếu dùng chung 1
// biến sẽ tự mock luôn cả lời gọi HTTP tới chính server test (đã xảy ra và làm mọi test lỗi).
const realFetch = global.fetch;
let baseUrl, cookie, db, monitor;
const resources = createResourceStack();

before(async () => {
  // Golden set tự mock outbound fetch nhưng vẫn cần DNS public giả để safeFetch không gọi mạng.
  outbound.__setTestDependencies({ lookup: async () => [{ address: '93.184.216.34', family: 4 }] });
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
  monitor = require('../monitor');
  const { createApp } = require('../app');
  const started = await startTestApp(createApp());
  baseUrl = started.baseUrl;
  resources.acquire(started.close);
  const u = fixtures.createPrivilegedUser({ username: `ai_golden_${Date.now()}` });
  cookie = (await fixtures.login(baseUrl, { username: u.username, password: u.password })).cookie;
});

after(async () => {
  outbound.__resetTestDependencies();
  await resources.cleanupAll();
});

// ---------------------------------------------------------------------------
// Fetch-queue mock — thay global.fetch, trả lần lượt các response đã xếp hàng theo ĐÚNG thứ tự
// lời gọi thật của luồng đang test. Bất kỳ lời gọi vượt hàng đợi -> throw ngay (fail rõ ràng).
// ---------------------------------------------------------------------------
let origFetch;
let queue;
beforeEach(() => { origFetch = global.fetch; queue = []; });
afterEach(() => { global.fetch = origFetch; });
function useQueue(...responses) {
  queue = responses;
  global.fetch = async (url) => {
    if (!queue.length) throw new Error(`GOLDEN TEST: fetch KHÔNG mong đợi (hàng đợi rỗng) tới ${url} — có lời gọi mạng thật sự không được mock`);
    return queue.shift();
  };
}
function geminiOk(bodyObj) { return { ok: true, status: 200, json: async () => bodyObj, text: async () => JSON.stringify(bodyObj) }; }
function textResult(text) { return geminiOk({ candidates: [{ content: { parts: [{ text }] } }] }); }
function jsonResult(obj) { return textResult(JSON.stringify(obj)); }
function imageResult(base64, mime = 'image/png') { return geminiOk({ candidates: [{ content: { parts: [{ inlineData: { mimeType: mime, data: base64 } }] } }] }); }
function groundedResult(text, chunks = [], queries = []) {
  return geminiOk({ candidates: [{ content: { parts: [{ text }] }, groundingMetadata: { groundingChunks: chunks.map((c) => ({ web: { uri: c.uri, title: c.title } })), webSearchQueries: queries } }] });
}
function httpError(status, message) { return { ok: false, status, json: async () => ({ error: { message } }), text: async () => JSON.stringify({ error: { message } }) }; }
function htmlPage(title) { return { ok: true, status: 200, text: async () => `<html><head><title>${title}</title></head><body></body></html>`, json: async () => ({}) }; }

async function post(path, body) {
  return realFetch(`${baseUrl}${path}`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
async function get(path) { return realFetch(`${baseUrl}${path}`, { headers: { cookie } }); }

// ---------------------------------------------------------------------------
// AI-E001..AI-E006 — 6 route HTTP trong ai.js (golden happy path)
// ---------------------------------------------------------------------------
test('AI-E001 golden happy: POST /ai/interaction-voice — genJSON trả voice hợp lệ được parse đúng + gắn matchedPerson/matchedOrg null khi không khớp tên nào trong DB', async () => {
  useQueue(jsonResult({ transcript: 'Chị Minh Anh báo VnExpress hẹn gặp tuần sau.', summary: 'Ghi nhận cuộc gọi hẹn gặp.', channel: 'Điện thoại', result: 'Tích cực', person_name: 'Minh Anh', org_name: 'VnExpress' }));
  const fd = new FormData();
  fd.append('audio', new Blob([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86, 0x81, 0x01])], { type: 'audio/webm' }), 'rec.webm');
  fd.append('aiConsent', 'true');
  const res = await realFetch(`${baseUrl}/api/ai/interaction-voice`, { method: 'POST', headers: { cookie }, body: fd });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.extracted.transcript, 'Chị Minh Anh báo VnExpress hẹn gặp tuần sau.');
  assert.equal(body.extracted.channel, 'Điện thoại');
  assert.equal(body.matchedPerson, null);
  assert.equal(body.matchedOrg, null);
});
test('AI-E002 golden happy: POST /ai/card-text — genText trả thẳng text lời chúc, route trả nguyên văn không qua parse JSON', async () => {
  useQueue(textResult('Kính chúc quý báo một năm mới an khang thịnh vượng.'));
  const res = await post('/api/ai/card-text', { title: 'Chúc mừng năm mới', date_type: 'other', subject_name: 'Báo Tuổi Trẻ', idea: '' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).text, 'Kính chúc quý báo một năm mới an khang thịnh vượng.');
});
test('AI-E003 golden happy: POST /ai/card-image — genImage trả inlineData base64, route trả {mime, dataUrl: "data:<mime>;base64,<data>", usedLogo}', async () => {
  useQueue(imageResult('ZmFrZS1wbmctYnl0ZXM=', 'image/png'));
  const res = await post('/api/ai/card-image', { text: 'Chúc mừng năm mới' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.mime, 'image/png');
  assert.equal(body.dataUrl, 'data:image/png;base64,ZmFrZS1wbmctYnl0ZXM=');
  assert.equal(typeof body.usedLogo, 'boolean');
});
test('AI-E004 golden happy: POST /ai/award-extract (nhánh text) — genJSON trả AWARD_SCHEMA, route gắn thêm review_status="Thô"', async () => {
  useQueue(jsonResult({ name: 'Giải thưởng Sao Khuê', organizer: 'VINASA', organizer_type: 'association', cost: 0, ai_summary: 'Giải thưởng công nghệ do VINASA tổ chức.' }));
  const res = await post('/api/ai/award-extract', { text: 'Thông báo giải thưởng Sao Khuê 2026 do VINASA tổ chức, miễn phí tham gia.' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.extracted.name, 'Giải thưởng Sao Khuê');
  assert.equal(body.extracted.review_status, 'Thô');
  assert.equal(body.extracted.source_url, undefined, 'nhánh text không set source_url (chỉ nhánh url mới có)');
});
test('AI-E004 golden happy (nhánh url): POST /ai/award-extract fetch trang thật (fake) rồi genJSON — 2 lời gọi mạng đúng thứ tự (fetch trang -> Gemini), route gắn source_url', async () => {
  useQueue(
    htmlPage('Thông báo giải thưởng ABC'),
    jsonResult({ name: 'Giải ABC', organizer: 'Bộ X', ai_summary: 'Giải ABC.' }),
  );
  const res = await post('/api/ai/award-extract', { url: 'https://award-source.example/notice-fake-but-mocked' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.extracted.name, 'Giải ABC');
  assert.equal(body.extracted.source_url, 'https://award-source.example/notice-fake-but-mocked');
});
test('AI-E005 golden happy: POST /ai/award-advice — genJSON trả ADVICE_SCHEMA {capability,plan}', async () => {
  useQueue(jsonResult({ capability: 'MISA có năng lực cạnh tranh tốt.', plan: 'Bước 1: chuẩn bị hồ sơ. Bước 2: nộp trước hạn.' }));
  const res = await post('/api/ai/award-advice', { name: 'Giải Sao Khuê', organizer: 'VINASA', criteria: 'Đổi mới sáng tạo', prize_structure: 'Giải Vàng/Bạc' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.capability, /năng lực/);
  assert.match(body.plan, /Bước/);
});
test('AI-E006 golden happy: POST /ai/event-extract (nhánh text) — genJSON trả EVENT_SCHEMA, route tính "missing" cho field còn thiếu so với danh sách mong muốn', async () => {
  useQueue(jsonResult({ name: 'Hội nghị Chiến lược 2026', organizer: 'MISA', mode: 'host' }));
  const res = await post('/api/ai/event-extract', { text: 'Kế hoạch tổ chức Hội nghị Chiến lược 2026 do MISA chủ trì.' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.extracted.name, 'Hội nghị Chiến lược 2026');
  assert.ok(body.missing.includes('start_time'), 'start_time không có trong response giả lập -> phải liệt kê vào missing');
  assert.ok(!body.missing.includes('name'), 'name có trong response -> không được liệt kê vào missing');
});

// ---------------------------------------------------------------------------
// AI-E007 — analyzeBatch (background job nền, gọi thẳng hàm export, không qua HTTP route)
// ---------------------------------------------------------------------------
test('AI-E007 golden happy: monitor.analyzeBatch() — genJSON trả mảng sentiment theo index "i", route/job map ngược đúng vào từng mention theo thứ tự', async () => {
  const rows = [{ id: 101, title: 'Tin tích cực về MISA', content: 'Nội dung...' }, { id: 102, title: 'Tin tiêu cực về đối thủ', content: 'Nội dung...' }];
  useQueue(jsonResult([{ i: 0, sentiment: 'positive', score: 0.8, summary: 'Tóm tắt 1', tags: ['amis'] }, { i: 1, sentiment: 'negative', score: -0.5, summary: 'Tóm tắt 2', tags: [] }]));
  const out = await monitor.analyzeBatch(rows);
  assert.equal(out.length, 2);
  assert.equal(out[0].sentiment, 'positive');
  assert.equal(out[1].i, 1);
});

// ---------------------------------------------------------------------------
// AI-E008 — groundIngest (background job nền trong /monitor/scan, gọi thẳng hàm export)
// ---------------------------------------------------------------------------
function insertQuery(overrides = {}) {
  const data = { name: 'Test query', category: 'general', include: JSON.stringify([['MISA', 'AMIS']]), exclude: '[]', enabled: 1, query_type: 'news', grounding: 0, ...overrides };
  const keys = Object.keys(data);
  const id = db.prepare(`INSERT INTO scan_queries (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => data[k])).lastInsertRowid;
  return { id, name: data.name, include: JSON.parse(data.include), exclude: JSON.parse(data.exclude), category: data.category };
}
test('AI-E008 golden happy: monitor.groundIngest() — groundedSearch trả chunks có kết quả (không cần fallback lần 2), resolveLink() fetch từng chunk.uri (2 lời gọi mạng: 1 Gemini + 1 resolveLink), lưu mention nếu khớp include', async () => {
  const q = insertQuery({ name: 'Test query E008' });
  useQueue(
    groundedResult('kết quả', [{ uri: 'https://grounded.example/bai-viet-misa', title: 'Bài viết về MISA' }]),
    htmlPage('MISA ra mắt tính năng mới AMIS'),
  );
  const r = await monitor.groundIngest(q);
  assert.equal(r.fetched, 1);
  assert.equal(r.added, 1);
  const row = db.prepare('SELECT * FROM mentions WHERE query_id=?').get(q.id);
  assert.equal(row.title, 'MISA ra mắt tính năng mới AMIS');
});
test('AI-E008 golden CHARACTERIZATION: groundedSearch trả chunks RỖNG ở lần gọi 1 -> tự động fallback gọi lần 2 (prompt khác) — đúng 2 lời gọi Gemini, không có resolveLink nào vì lần 2 cũng rỗng', async () => {
  const q = insertQuery({ name: 'Test query E008 rỗng', include: JSON.stringify([['XYZ không tồn tại']]) });
  useQueue(groundedResult('không có kết quả', []), groundedResult('vẫn không có', []));
  const r = await monitor.groundIngest(q);
  assert.equal(r.fetched, 0);
  assert.equal(r.added, 0);
  assert.equal(queue.length, 0, 'phải tiêu thụ đúng 2 response đã xếp hàng (2 lần gọi Gemini, không thừa/thiếu)');
});

// ---------------------------------------------------------------------------
// AI-E009 — siteGroundIngest (background, không export trực tiếp) — characterize qua runScan()
// với 1 source mode='site' + query enabled, dùng lại queue mock (network-safe, không gọi mạng
// thật vì mọi fetch đều đi qua global.fetch đã mock)
// ---------------------------------------------------------------------------
test('AI-E009 golden happy: runScan() với source mode="site" -> gọi siteGroundIngest() nội bộ -> groundedSearch site:<host> rồi resolveLink() từng chunk khớp đúng host mới lưu mention', async () => {
  db.prepare("UPDATE sources SET enabled=0").run();
  db.prepare("UPDATE scan_queries SET enabled=0").run();
  const srcId = db.prepare(`INSERT INTO sources (name, url, type, mode, enabled) VALUES (?,?,?,?,1)`).run('Trang mẫu', 'https://trangmau.example', 'news', 'site').lastInsertRowid;
  // include='[]' -> vô hiệu hoá phase 1 (Google News, chạy KHÔNG ĐIỀU KIỆN theo q.include, không
  // liên quan tới nguồn mode='site') để không tiêu tốn nhầm response đã xếp hàng cho Gemini —
  // siteGroundIngest() vẫn hoạt động bình thường vì fallback dùng q.name khi include rỗng.
  const qId = db.prepare(`INSERT INTO scan_queries (name, category, include, exclude, enabled, query_type, grounding) VALUES (?,?,?,?,1,'news',0)`).run('Q site', 'general', '[]', '[]').lastInsertRowid;
  useQueue(
    groundedResult('kết quả site', [{ uri: 'https://trangmau.example/bai-viet', title: 'Bài viết trên trang mẫu' }]),
    htmlPage('MISA hợp tác chiến lược'),
  );
  // analyze:false — AI-E007 đã characterize riêng analyzeBatch()/analyzePending(); ở đây chỉ tập
  // trung vào siteGroundIngest(), tránh log nhiễu "hàng đợi rỗng" vô hại khi analyzePending() tự
  // gọi thêm 1 lượt genJSON cho mention vừa lưu (mention mới -> sentiment NULL -> đủ điều kiện).
  const r = await monitor.runScan({ triggeredBy: 'auto', analyze: false });
  assert.equal(r.new_mentions, 1);
  const row = db.prepare('SELECT * FROM mentions WHERE source_id=?').get(srcId);
  assert.ok(row, 'phải lưu được mention khớp đúng host site: đã khai báo');
  assert.equal(row.title, 'MISA hợp tác chiến lược');
});

// ---------------------------------------------------------------------------
// AI-E010/AI-E011 — 2 route GET on-demand groundedSearch (monitor.js)
// ---------------------------------------------------------------------------
test('AI-E010 golden happy: GET /monitor/highlights — groundedSearch trả text+chunks, route map chunks -> sources {title,uri}', async () => {
  useQueue(groundedResult('1. MISA ra mắt AMIS mới — nổi bật vì...', [{ uri: 'https://grounded.example/tin1', title: 'Tin 1' }]));
  const res = await get('/api/monitor/highlights');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.text, /MISA ra mắt/);
  assert.equal(body.sources.length, 1);
  assert.equal(body.sources[0].uri, 'https://grounded.example/tin1');
});
test('AI-E011 golden happy: GET /monitor/competitor-brief — groundedSearch trả text+chunks, route trả kèm danh sách competitors từ DB', async () => {
  useQueue(groundedResult('1. Đối thủ A vừa ra mắt sản phẩm mới.', []));
  const res = await get('/api/monitor/competitor-brief');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.text, /Đối thủ/);
  assert.ok(Array.isArray(body.competitors));
});

// ---------------------------------------------------------------------------
// AI-E012 — GET /monitor/campaigns/:id/evaluate (groundedSearch, đã có route test R135 nhánh
// không-key; đây là golden happy nhánh CÓ key)
// ---------------------------------------------------------------------------
test('AI-E012 golden happy: GET /monitor/campaigns/:id/evaluate — groundedSearch được gọi (không throw), route trả về đủ field số liệu + không phụ thuộc chunks rỗng hay không', async () => {
  const campId = db.prepare(`INSERT INTO campaigns (name, keywords, start_date, end_date) VALUES (?,?,?,?)`).run('Chiến dịch Test', JSON.stringify(['misa']), '2026-01-01', '2026-12-31').lastInsertRowid;
  useQueue(groundedResult('Đánh giá hiệu quả chiến dịch...', []));
  const res = await get(`/api/monitor/campaigns/${campId}/evaluate`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.text, /Đánh giá/);
  assert.equal(typeof body.stats.total, 'number');
  assert.ok(Array.isArray(body.sources));
});

// ---------------------------------------------------------------------------
// Nhánh lỗi malformed/quota/timeout — test 1 LẦN trên tầng `gemini.js call()` dùng chung (genJSON
// qua event-extract) thay vì lặp lại ở cả 12 luồng, vì mọi genJSON/genText/genImage/groundedSearch
// đều đi qua CÙNG 1 hàm `call()` xử lý lỗi HTTP + `catch(e)=>502` là CÙNG 1 pattern lặp lại y hệt ở
// mọi route ai.js (đã xác nhận đọc code) — test lặp ở từng route sẽ không phát hiện thêm bug nào,
// chỉ tốn thời gian chạy. Quyết định này theo đúng tiền lệ "cùng root cause, test 1 lần" đã dùng ở
// F13-F18.
// ---------------------------------------------------------------------------
test('AI golden CHARACTERIZATION (malformed): Gemini trả text KHÔNG PHẢI JSON hợp lệ cho genJSON -> ném "AI trả về dữ liệu không hợp lệ." -> route 502', async () => {
  useQueue(textResult('Đây không phải JSON, chỉ là văn bản thường.'));
  const res = await post('/api/ai/event-extract', { text: 'Kế hoạch sự kiện...' });
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /không hợp lệ/);
});
test('AI golden (quota/HTTP error, W1.9): Gemini trả HTTP 429 liên tục -> gemini.call() tự retry (F8) rồi ném message của LẦN THỬ CUỐI -> route 502 forward nguyên message', async () => {
  // W1.9 thêm retry cho 429/5xx (server/gemini.js) — trước đây gemini.call() ném ngay ở lần gọi
  // đầu, nay retry tối đa 3 lần nên hàng đợi cần đủ 3 response để không rơi vào nhánh "hàng đợi
  // rỗng" của useQueue().
  useQueue(
    httpError(429, 'Resource has been exhausted (lần 1).'),
    httpError(429, 'Resource has been exhausted (lần 2).'),
    httpError(429, 'Resource has been exhausted (lần 3).')
  );
  const res = await post('/api/ai/event-extract', { text: 'Kế hoạch sự kiện...' });
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /lần 3/);
});

test('AI golden (quota/HTTP error, W1.9): Gemini trả 429 rồi 200 ở lần retry -> gemini.call() tự phục hồi, route trả 200 thay vì 502', async () => {
  useQueue(
    httpError(429, 'Resource has been exhausted (tạm thời).'),
    jsonResult({ name: 'Hội nghị phục hồi sau retry', organizer: 'MISA', mode: 'host' })
  );
  const res = await post('/api/ai/event-extract', { text: 'Kế hoạch sự kiện...' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).extracted.name, 'Hội nghị phục hồi sau retry');
});
test('AI golden CHARACTERIZATION (timeout/network): fetch() reject (mô phỏng AbortError khi hết thời gian) -> route bắt lỗi -> 502, không crash process', async () => {
  global.fetch = async () => { const e = new Error('The operation was aborted'); e.name = 'AbortError'; throw e; };
  const res = await post('/api/ai/event-extract', { text: 'Kế hoạch sự kiện...' });
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /aborted/);
});
test('AI golden CHARACTERIZATION (genImage không trả ảnh): Gemini trả candidates rỗng parts (không có inlineData) -> genImage() ném "AI không tạo được ảnh. Thử lại." -> route 502', async () => {
  useQueue(geminiOk({ candidates: [{ content: { parts: [{ text: 'xin lỗi, tôi không thể tạo ảnh này' }] } }] }));
  const res = await post('/api/ai/card-image', { text: 'Chúc mừng năm mới' });
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /không tạo được ảnh/);
});
