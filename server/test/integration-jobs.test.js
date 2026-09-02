'use strict';
// Bundle A (1/N) — G1A.4 (concurrency/idempotency characterization) + G1A.8 (background job
// side-effect, không chỉ verify route HTTP) cho 2 job còn TODO trong gate1-test-mapping.md:
// JOB-REMINDER (scheduler.js runOnce()) và JOB-MONITOR-SCAN (monitor.js runScan()/applySchedule()).
//
// Khác với integration-reminders.test.js (R060, đã characterize route HTTP POST /reminders/run),
// file này gọi THẲNG hàm job (scheduler.runOnce(), monitor.runScan()) để kiểm side-effect DB sâu
// hơn: idempotency khi gọi tuần tự, và — theo đúng yêu cầu G1A.4 — XÁC NHẬN hành vi HIỆN TẠI CÓ
// RACE (không phải test hành vi đích): reminder_log KHÔNG có ràng buộc UNIQUE (chỉ có index
// thường idx_remlog(date_id,occur_date,seq), không bao gồm channel/recipient_user_id — xem
// memory-bank/11-business-flows.md §E, R3-02C), nên check-then-insert của runOnce() an toàn khi
// gọi tuần tự nhưng KHÔNG an toàn khi 2 lệnh gọi thật sự đồng thời (đa tiến trình/đa replica).
// Test không thể tái hiện race thật trong 1 tiến trình Node đơn luồng (runOnce() không có điểm
// yield giữa SELECT-check và INSERT nên 2 lệnh gọi trong cùng process luôn chạy tuần tự) — thay
// vào đó chứng minh TRỰC TIẾP tiền đề của race: DB schema cho phép chèn 2 dòng trùng hệt nhau mà
// không lỗi UNIQUE, đây là bằng chứng DB-level trung thực cho race đã ghi trong tài liệu.
//
// JOB-MONITOR-SCAN dùng lại chiến lược an toàn mạng đã áp dụng ở R110 (batch monitor phần 1): tắt
// hết sources thật + xoá include của scan_queries seed sẵn — nhưng ở đây gọi runScan() KHÔNG có
// queryIds (giống hệt cách monitor.applySchedule()'s setInterval callback gọi: runScan({triggeredBy:
// 'auto'})), để characterize đúng hành vi "auto job quét TẤT CẢ query đang bật" — khác route thủ
// công POST /monitor/scan luôn yêu cầu query_ids tường minh (400 nếu rỗng).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// BR-AI-018 mock Gemini ở đúng boundary module trong test bên dưới. Giá trị giả này chỉ giúp
// cfg.hasKey() cho phép job đi vào hàng đợi; không có request ra mạng vì mọi lệnh genJSON đều
// được t.mock.method() thay thế trong từng case.
process.env.GEMINI_API_KEY = 'test-gemini-key-integration-jobs';

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { createResourceStack } = require('../test-support/resource-stack');

let db;
let scheduler;
let monitor;
let gemini;
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
  scheduler = require('../scheduler');
  monitor = require('../monitor');
  gemini = require('../gemini');
});

after(async () => {
  await resources.cleanupAll();
});

function todayGMT7() { return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10); }
function insertDate(overrides = {}) {
  const data = { title: `Nhắc job ${Date.now()}_${Math.random()}`, event_date: todayGMT7(), recurring: 0, lead_days: 0, notify_repeat_every: 0, notify_repeat_count: 1, ...overrides };
  const keys = Object.keys(data);
  return db.prepare(`INSERT INTO important_dates (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => data[k])).lastInsertRowid;
}

function insertPendingMention(overrides = {}) {
  const nonce = `${Date.now()}_${Math.random()}`;
  const data = {
    query_id: null,
    source_id: null,
    source_type: 'news',
    source_name: 'Báo test job AI',
    category: 'brand',
    title: `Mention pending ${nonce}`,
    link: `https://job-ai-test.example/${nonce}`,
    content: 'Nội dung bài báo để job phân tích sắc thái.',
    sentiment: null,
    published_at: '2026-08-30',
    status: 'Mới',
    ...overrides,
  };
  const keys = Object.keys(data);
  const r = db.prepare(`INSERT INTO mentions (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
    .run(...keys.map((key) => data[key]));
  return Number(r.lastInsertRowid);
}

// ---------------------------------------------------------------------------
// JOB-REMINDER — scheduler.runOnce()
// ---------------------------------------------------------------------------
test('JOB-REMINDER happy: reminder đến hạn hôm nay sinh đúng 1 dòng reminder_log (in-app) cho user active+notify_opt_in=1, email=0 vì mailer chưa cấu hình SMTP trong môi trường test', async () => {
  const dateId = insertDate();
  const r = scheduler.runOnce();
  assert.equal(typeof r.created, 'number');
  assert.ok(r.created >= 1, 'phải sinh >=1 log in-app cho 2 tài khoản seed sẵn (notify_opt_in=1 mặc định)');
  assert.equal(r.emailed, 0, 'mailer.enabled()=false trong test (không cấu hình SMTP) -> luôn 0, characterize đúng nhánh an toàn này');
  const rows = db.prepare('SELECT * FROM reminder_log WHERE date_id=? AND channel=?').all(dateId, 'inapp');
  assert.ok(rows.length >= 1);
  assert.equal(rows[0].occur_date, todayGMT7());
  assert.equal(rows[0].seq, 1);
});
test('JOB-REMINDER happy: gọi runOnce() lần 2 NGAY SAU (tuần tự, không đồng thời) không tạo dòng trùng — check-then-insert an toàn khi tuần tự', async () => {
  const dateId = insertDate();
  const r1 = scheduler.runOnce();
  const before = db.prepare('SELECT COUNT(*) c FROM reminder_log WHERE date_id=?').get(dateId).c;
  const r2 = scheduler.runOnce();
  const after = db.prepare('SELECT COUNT(*) c FROM reminder_log WHERE date_id=?').get(dateId).c;
  assert.equal(after, before, 'lần gọi thứ 2 tuần tự không được thêm dòng mới cho cùng date_id');
  assert.ok(r1.created >= 1);
});
test('JOB-REMINDER CHARACTERIZATION (G1A.4, R3-02C — hành vi HIỆN TẠI CÓ RACE, không phải hành vi đích): reminder_log KHÔNG có ràng buộc UNIQUE trên (date_id,occur_date,seq,channel,recipient_user_id) — DB cho phép chèn 2 dòng identical mà không lỗi, đây là tiền đề trực tiếp khiến check-then-insert của runOnce() KHÔNG an toàn khi 2 lệnh gọi thật sự đồng thời (vd cron 6h trùng POST /reminders/run tay, đa tiến trình/đa replica)', async () => {
  const dateId = insertDate();
  const uid = db.prepare('SELECT id FROM users LIMIT 1').get().id;
  const ins = () => db.prepare('INSERT INTO reminder_log (date_id, occur_date, seq, channel, recipient_user_id) VALUES (?,?,?,?,?)')
    .run(dateId, '2026-08-01', 1, 'inapp', uid);
  assert.doesNotThrow(() => ins(), 'chèn lần 1 phải thành công');
  assert.doesNotThrow(() => ins(), 'chèn lần 2 CÙNG hệt (date_id,occur_date,seq,channel,recipient_user_id) vẫn KHÔNG lỗi -> xác nhận thiếu UNIQUE, đây chính là lỗ hổng cho phép race tạo bản ghi trùng khi 2 lệnh runOnce() chạy đồng thời');
  const count = db.prepare('SELECT COUNT(*) c FROM reminder_log WHERE date_id=? AND occur_date=? AND seq=1 AND channel=?').get(dateId, '2026-08-01', 'inapp').c;
  assert.equal(count, 2, 'DB thực sự lưu 2 dòng trùng — đúng là hành vi race tài liệu đã ghi, không phải suy đoán');
});
test('JOB-REMINDER happy: notify_repeat_count>1 sinh nhiều seq nếu đều đã đến hạn (lead_days=0, notify_repeat_every=0 -> mọi seq cùng rơi vào hôm nay)', async () => {
  const dateId = insertDate({ notify_repeat_count: 3, notify_repeat_every: 0, lead_days: 0 });
  scheduler.runOnce();
  const seqs = db.prepare('SELECT DISTINCT seq FROM reminder_log WHERE date_id=? AND channel=?').all(dateId, 'inapp').map((r) => r.seq).sort();
  assert.deepEqual(seqs, [1, 2, 3]);
});

// ---------------------------------------------------------------------------
// JOB-MONITOR-SCAN — monitor.runScan({triggeredBy:'auto'}) (đường auto job thật, không phải qua
// route thủ công) + monitor.applySchedule() (lifecycle timer)
// ---------------------------------------------------------------------------
test('JOB-MONITOR-SCAN happy (network-safe): runScan({triggeredBy:"auto"}) KHÔNG truyền queryIds -> tự quét TẤT CẢ scan_queries đang enabled=1 (khác route thủ công POST /monitor/scan luôn yêu cầu query_ids tường minh, 400 nếu rỗng) — dùng sources tắt hết + include rỗng để không gọi mạng thật', async () => {
  db.prepare("UPDATE sources SET enabled=0").run();
  db.prepare("UPDATE scan_queries SET include='[]', grounding=0").run();
  const enabledCount = db.prepare("SELECT COUNT(*) c FROM scan_queries WHERE enabled=1 AND query_type='news'").get().c;
  assert.ok(enabledCount >= 1, 'seed mặc định phải có >=1 scan_queries enabled để test có ý nghĩa (không phải case rỗng)');
  const r = await monitor.runScan({ triggeredBy: 'auto' });
  assert.equal(r.fetched, 0);
  assert.equal(r.new_mentions, 0);
  const run = db.prepare('SELECT triggered_by, status, queries FROM scan_runs WHERE id=?').get(r.runId);
  assert.equal(run.triggered_by, 'auto');
  assert.equal(run.status, 'done');
  assert.equal(run.queries, enabledCount, 'scan_runs.queries phải bằng đúng số scan_queries enabled thật sự được quét (không bị giới hạn bởi query_ids vì không truyền)');
});
test('JOB-MONITOR-SCAN happy: applySchedule() gọi lặp lại (bật rồi bật lại autoscan) không leak timer — thay timer cũ bằng clearInterval() trước khi tạo timer mới', async () => {
  const dbMod = require('../db');
  dbMod.metaSet('autoscan', '1');
  dbMod.metaSet('autoscan_interval_h', '4');
  let created = 0, cleared = 0;
  const origSetInterval = global.setInterval, origClearInterval = global.clearInterval;
  global.setInterval = (...a) => { created++; return origSetInterval(...a); };
  global.clearInterval = (...a) => { cleared++; return origClearInterval(...a); };
  try {
    monitor.applySchedule();
    monitor.applySchedule();
    monitor.applySchedule();
  } finally {
    global.setInterval = origSetInterval;
    global.clearInterval = origClearInterval;
    dbMod.metaSet('autoscan', '0');
    monitor.applySchedule(); // tắt lại, không để timer thật sống sau test này
  }
  assert.equal(created, 3, 'mỗi lần applySchedule() với autoscan=1 phải tạo đúng 1 timer mới');
  assert.equal(cleared, 2, 'lần đầu chưa có timer cũ (module timer=null lúc test bắt đầu) nên không clear; 2 lần gọi sau đó phải clearInterval() timer CŨ trước khi tạo timer mới -> không leak');
});

// ---------------------------------------------------------------------------
// BR-AI-018 — monitor.analyzePending(): job AI thật ở tầng DB queue
// ---------------------------------------------------------------------------
test('BR-AI-018 happy: analyzePending() trả 0 khi queue rỗng và không gọi Gemini', async (t) => {
  db.prepare('DELETE FROM mentions').run();
  let calls = 0;
  t.mock.method(gemini, 'genJSON', async () => { calls += 1; return []; });

  assert.equal(await monitor.analyzePending(), 0);
  assert.equal(calls, 0, 'queue rỗng phải short-circuit trước boundary Gemini');
});

test('BR-AI-018 happy: job chia queue >8 theo lô, map index trong từng lô và chỉ ghi đúng mention được Gemini trả về', async (t) => {
  db.prepare('DELETE FROM mentions').run();
  // DESC theo id khiến 9 là lô đầu, 1 là lô sau. Lưu mảng ID theo thứ tự đọc thật để assertion
  // không phụ thuộc vào giả định về auto-increment giữa SQLite/MySQL.
  for (let i = 0; i < 10; i += 1) insertPendingMention({ title: `Queue ${i}`, content: `Nội dung ${i}` });
  const ordered = db.prepare('SELECT id FROM mentions WHERE sentiment IS NULL ORDER BY id DESC').all().map((r) => Number(r.id));
  const calls = [];
  t.mock.method(gemini, 'genJSON', async () => {
    calls.push(true);
    if (calls.length === 1) return [
      { i: 0, sentiment: 'positive', score: 2, summary: 'Lô đầu, score bị chặn biên', tags: ['misa'] },
      { i: 7, sentiment: 'negative', score: -2, summary: 'Cuối lô đầu', tags: ['cảnh báo'] },
      { i: 1, sentiment: 'unsupported', score: 0, summary: 'Không được ghi', tags: ['sai'] },
    ];
    return [{ i: 1, sentiment: 'neutral', summary: 'Lô sau, score mặc định', tags: [] }];
  });

  assert.equal(await monitor.analyzePending(), 3);
  assert.equal(calls.length, 2, '10 rows phải chia 8 + 2, không dồn thành một prompt lớn');

  const rows = db.prepare('SELECT id, sentiment, sentiment_score, ai_summary, tags, sentiment_by FROM mentions ORDER BY id').all();
  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  const first = byId.get(ordered[0]);
  const lastOfFirstChunk = byId.get(ordered[7]);
  const secondOfLastChunk = byId.get(ordered[9]);
  assert.deepEqual(
    { sentiment: first.sentiment, score: Number(first.sentiment_score), summary: first.ai_summary, tags: JSON.parse(first.tags), by: first.sentiment_by },
    { sentiment: 'positive', score: 1, summary: 'Lô đầu, score bị chặn biên', tags: ['misa'], by: 'ai' },
  );
  assert.equal(lastOfFirstChunk.sentiment, 'negative');
  assert.equal(Number(lastOfFirstChunk.sentiment_score), -1);
  assert.deepEqual(
    { sentiment: secondOfLastChunk.sentiment, score: Number(secondOfLastChunk.sentiment_score), summary: secondOfLastChunk.ai_summary, tags: JSON.parse(secondOfLastChunk.tags), by: secondOfLastChunk.sentiment_by },
    { sentiment: 'neutral', score: 0, summary: 'Lô sau, score mặc định', tags: [], by: 'ai' },
  );
  assert.equal(rows.filter((row) => row.sentiment === null).length, 7, 'index Gemini không trả hoặc output sai schema phải giữ nguyên pending, không bị gán bừa');
});

test('BR-AI-018 resilience: Gemini lỗi một lô thì job bỏ lô đó nhưng tiếp tục xử lý lô sau, không ghi dở dang', async (t) => {
  db.prepare('DELETE FROM mentions').run();
  for (let i = 0; i < 16; i += 1) insertPendingMention({ title: `Retry queue ${i}` });
  const ordered = db.prepare('SELECT id FROM mentions WHERE sentiment IS NULL ORDER BY id DESC').all().map((r) => Number(r.id));
  let call = 0;
  t.mock.method(gemini, 'genJSON', async () => {
    call += 1;
    if (call === 1) throw new Error('Gemini batch failed intentionally');
    return [{ i: 0, sentiment: 'negative', score: -0.4, summary: 'Lô sau vẫn chạy', tags: ['retry'] }];
  });

  assert.equal(await monitor.analyzePending(), 1);
  assert.equal(call, 2, 'lỗi ở lô đầu không được abort toàn bộ queue');
  assert.equal(db.prepare('SELECT sentiment FROM mentions WHERE id=?').get(ordered[0]).sentiment, null, 'lô lỗi không được ghi một phần');
  const processed = db.prepare('SELECT sentiment, ai_summary, sentiment_by FROM mentions WHERE id=?').get(ordered[8]);
  assert.equal(processed.sentiment, 'negative');
  assert.equal(processed.ai_summary, 'Lô sau vẫn chạy');
  assert.equal(processed.sentiment_by, 'ai');
  assert.equal(db.prepare('SELECT COUNT(*) c FROM mentions WHERE sentiment IS NULL').get().c, 15);
});
