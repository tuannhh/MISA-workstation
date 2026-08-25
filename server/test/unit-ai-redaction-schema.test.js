'use strict';

// G1A.2 — Commit 3/4: AI redaction & schema validation (gemini.js, ai.js schemas,
// monitor.js#analyzeBatch/SENT_SCHEMA). Đặc tả hành vi HIỆN TẠI qua fetch giả (DI) — KHÔNG gọi
// Gemini thật. gemini.js chỉ require('./config'), KHÔNG require('./db') — nhưng ai.js/monitor.js
// (nơi các schema/analyzeBatch sống) đều require('./db') gián tiếp, nên vẫn cần cách ly DATA_DIR
// tạm + DB_CLIENT=sqlite TRƯỚC khi require, giống Commit 1/2 (không đụng data/pr.db thật, không
// cần MySQL). GEMINI_API_KEY được set giả để ensureKey() không throw ở các test đường thành công;
// BR-AI-008 tự xoá cache require để test riêng nhánh THIẾU key mà không ảnh hưởng các test khác.
process.env.DB_CLIENT = 'sqlite';
process.env.GEMINI_API_KEY = 'test-gemini-key-unit';
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-unit-ai-'));

const test = require('node:test');
const assert = require('node:assert/strict');

const gemini = require('../gemini');
const aiRouter = require('../ai');
const { VOICE_SCHEMA, AWARD_SCHEMA, ADVICE_SCHEMA, EVENT_SCHEMA } = aiRouter.testables;
const monitor = require('../monitor');
const { SENT_SCHEMA, analyzeBatch } = monitor;

test.after(() => { fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); });

function fakeJsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}
function candidateText(text) { return { candidates: [{ content: { parts: [{ text }] } }] }; }

// ===================== gemini.js — genText/genJSON/genImage/groundedSearch/textOf =====================

test('BR-AI-001: genText() gửi đúng model/temperature/x-goog-api-key, trả text đã nối+trim', async (t) => {
  let seenUrl, seenOpts;
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    seenUrl = url; seenOpts = opts;
    return fakeJsonResponse({ candidates: [{ content: { parts: [{ text: 'Xin ' }, { text: 'chào  ' }] } }] });
  });
  const out = await gemini.genText('viết lời chúc', { temperature: 0.8 });
  assert.equal(out, 'Xin chào');
  assert.match(seenUrl, /:generateContent$/);
  assert.equal(seenOpts.headers['x-goog-api-key'], 'test-gemini-key-unit');
  const body = JSON.parse(seenOpts.body);
  assert.equal(body.generationConfig.temperature, 0.8);
  assert.equal(body.contents[0].parts[0].text, 'viết lời chúc');
});

test('BR-AI-002: genJSON() gửi đúng responseSchema/responseMimeType, parse JSON trả về', async (t) => {
  let seenBody;
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    seenBody = JSON.parse(opts.body);
    return fakeJsonResponse(candidateText(JSON.stringify({ name: 'Giải X', ai_summary: 'Tóm tắt' })));
  });
  const out = await gemini.genJSON([{ text: 'trích xuất' }], AWARD_SCHEMA);
  assert.deepEqual(out, { name: 'Giải X', ai_summary: 'Tóm tắt' });
  assert.equal(seenBody.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(seenBody.generationConfig.responseSchema, AWARD_SCHEMA); // đi qua JSON.stringify/parse -> so cấu trúc, không so reference
});

test('BR-AI-003: genJSON() throw "AI trả về dữ liệu không hợp lệ." khi text không parse được JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => fakeJsonResponse(candidateText('không phải JSON')));
  await assert.rejects(() => gemini.genJSON([{ text: 'x' }], AWARD_SCHEMA), /không hợp lệ/);
});

test('BR-AI-004: groundedSearch() trích text/chunks(chỉ giữ chunk có uri)/queries từ groundingMetadata', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => fakeJsonResponse({
    candidates: [{
      content: { parts: [{ text: 'kết quả tìm kiếm' }] },
      groundingMetadata: {
        groundingChunks: [{ web: { uri: 'https://a.example', title: 'A' } }, { web: null }, {}],
        webSearchQueries: ['misa pr'],
      },
    }],
  }));
  const out = await gemini.groundedSearch('tìm tin MISA');
  assert.equal(out.text, 'kết quả tìm kiếm');
  assert.deepEqual(out.chunks, [{ uri: 'https://a.example', title: 'A' }]);
  assert.deepEqual(out.queries, ['misa pr']);
});

test('BR-AI-005: genImage() trích ảnh base64 đầu tiên từ inlineData, gửi kèm refImages trong parts', async (t) => {
  let seenBody;
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    seenBody = JSON.parse(opts.body);
    return fakeJsonResponse({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'abc123' } }] } }] });
  });
  const out = await gemini.genImage('tạo thiệp', [{ mime: 'image/png', data: 'logo-base64' }]);
  assert.deepEqual(out, { mime: 'image/png', data: 'abc123' });
  assert.deepEqual(seenBody.contents[0].parts[1], { inlineData: { mimeType: 'image/png', data: 'logo-base64' } });
});

test('BR-AI-006: genImage() throw "AI không tạo được ảnh. Thử lại." khi response không có ảnh', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => fakeJsonResponse(candidateText('chỉ có chữ, không có ảnh')));
  await assert.rejects(() => gemini.genImage('tạo thiệp'), /AI không tạo được ảnh/);
});

test('BR-AI-007: call() throw đúng message Gemini trả về, fallback "Gemini HTTP <status>" khi không có', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => fakeJsonResponse({ error: { message: 'Quota exceeded' } }, { ok: false, status: 429 }));
  await assert.rejects(() => gemini.genText('x'), /Quota exceeded/);

  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 500, json: async () => { throw new Error('not-json'); } }));
  await assert.rejects(() => gemini.genText('x'), /Gemini HTTP 500/);
});

test('BR-AI-008: ensureKey() (qua genText) throw khi thiếu GEMINI_API_KEY và không có file gemini.key', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete require.cache[require.resolve('../config')];
  delete require.cache[require.resolve('../gemini')];
  const freshGemini = require('../gemini');
  await assert.rejects(() => freshGemini.genText('x'), /Chưa cấu hình GEMINI_API_KEY/);
  process.env.GEMINI_API_KEY = savedKey;
  delete require.cache[require.resolve('../config')];
  delete require.cache[require.resolve('../gemini')];
});

test('BR-AI-009: textOf() nối các part.text và trim, an toàn khi thiếu candidates/parts', () => {
  assert.equal(gemini.textOf({ candidates: [{ content: { parts: [{ text: ' a ' }, { text: 'b' }] } }] }), 'a b'); // join('') rồi trim() 2 đầu -> khoảng trắng giữa part không bị gộp
  assert.equal(gemini.textOf({}), '');
  assert.equal(gemini.textOf({ candidates: [{}] }), '');
});

// ===================== Schema JSON — hình dạng/required =====================

test('BR-AI-010: VOICE_SCHEMA yêu cầu transcript+summary', () => {
  assert.deepEqual(VOICE_SCHEMA.required, ['transcript', 'summary']);
  assert.equal(VOICE_SCHEMA.type, 'object');
});

test('BR-AI-011: AWARD_SCHEMA yêu cầu name+ai_summary, cost là integer', () => {
  assert.deepEqual(AWARD_SCHEMA.required, ['name', 'ai_summary']);
  assert.equal(AWARD_SCHEMA.properties.cost.type, 'integer');
});

test('BR-AI-012: ADVICE_SCHEMA yêu cầu capability+plan', () => {
  assert.deepEqual(ADVICE_SCHEMA.required, ['capability', 'plan']);
});

test('BR-AI-013: EVENT_SCHEMA chỉ yêu cầu name', () => {
  assert.deepEqual(EVENT_SCHEMA.required, ['name']);
  assert.equal(EVENT_SCHEMA.properties.scale_attendees.type, 'integer');
});

test('BR-AI-014: SENT_SCHEMA (monitor.js) — mảng object yêu cầu i/sentiment/summary, sentiment giới hạn 3 giá trị enum', () => {
  assert.equal(SENT_SCHEMA.type, 'array');
  assert.deepEqual(SENT_SCHEMA.items.required, ['i', 'sentiment', 'summary']);
  assert.deepEqual(SENT_SCHEMA.items.properties.sentiment.enum, ['positive', 'neutral', 'negative']);
});

// ===================== monitor.js#analyzeBatch — đặc tả lỗ hổng KHÔNG redact trước khi gửi Gemini =====================

test('BR-AI-015 (đặc tả lỗ hổng hiện có, KHÔNG fix ở đây — chuyển W1.AI-POLICY): analyzeBatch() đưa content THÔ (chưa redact PII) vào prompt gửi Gemini', async (t) => {
  let seenPrompt;
  t.mock.method(gemini, 'genJSON', async (parts) => { seenPrompt = parts[0].text; return []; });
  await analyzeBatch([{ title: 'Tin có SĐT', content: 'Liên hệ 0912345678 hoặc pr@misa.vn để biết thêm' }]);
  // monitor.js KHÔNG gọi redactTextForAi() ở đường quét RSS/mention — toàn bộ nội dung thô (kể cả
  // SĐT/email nếu vô tình xuất hiện trong bài báo/scrape) được đưa nguyên vào prompt gửi Gemini.
  assert.match(seenPrompt, /0912345678/);
  assert.match(seenPrompt, /pr@misa\.vn/);
});

test('BR-AI-016: analyzeBatch() map kết quả theo đúng chỉ số "i", trả [] khi genJSON không trả mảng', async (t) => {
  t.mock.method(gemini, 'genJSON', async () => ([{ i: 1, sentiment: 'positive', summary: 'tốt' }]));
  const out = await analyzeBatch([{ title: 'A', content: 'a' }, { title: 'B', content: 'b' }]);
  assert.deepEqual(out, [{ i: 1, sentiment: 'positive', summary: 'tốt' }]);

  t.mock.method(gemini, 'genJSON', async () => ({ khong_phai: 'mang' }));
  assert.deepEqual(await analyzeBatch([{ title: 'A', content: 'a' }]), []);
});
