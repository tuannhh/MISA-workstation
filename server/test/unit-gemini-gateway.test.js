'use strict';
// W1.9 (F8) — aiGateway reliability: timeout/AbortController, retry 429/5xx, capability-map strip
// sampling-params. Test THUẦN module server/gemini.js (không HTTP/DB) — mock global.fetch trực
// tiếp. GEMINI_API_KEY/GEMINI_TIMEOUT_MS/GEMINI_RETRY_BASE_DELAY_MS phải set TRƯỚC require vì
// config.js đọc env MỘT LẦN lúc require (đóng băng) — xem cùng quy ước ở integration-ai-golden.
process.env.GEMINI_API_KEY = 'gateway-test-fake-key-not-real';
process.env.GEMINI_TIMEOUT_MS = '50';
process.env.GEMINI_RETRY_BASE_DELAY_MS = '5';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const gemini = require('../gemini');

let origFetch;
beforeEach(() => { origFetch = global.fetch; });
afterEach(() => { global.fetch = origFetch; });

function okResult(text) {
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) };
}
function errResult(status, message) {
  return { ok: false, status, json: async () => ({ error: { message } }) };
}

// ---------------------------------------------------------------------------
// Capability-map: sampling params (temperature/top_p/top_k) chỉ gửi cho model đã biết hỗ trợ.
// ---------------------------------------------------------------------------
test('supportsSamplingParams: chỉ model đã biết hỗ trợ (gemini-3.5-flash, model pin hiện tại) trả true', () => {
  assert.equal(gemini.supportsSamplingParams('gemini-3.5-flash'), true);
  assert.equal(gemini.supportsSamplingParams('gemini-3.6-flash'), false, 'model chưa xác nhận hỗ trợ phải mặc định false (fail-safe), không đoán');
  assert.equal(gemini.supportsSamplingParams('unknown-model'), false);
});

test('buildGenerationConfig: model KHÔNG hỗ trợ sampling -> strip temperature/topP/topK, giữ nguyên field khác (responseSchema/responseMimeType không phải sampling param)', () => {
  const out = gemini.buildGenerationConfig('gemini-3.6-flash', {
    temperature: 0.5,
    topP: 0.9,
    responseMimeType: 'application/json',
    responseSchema: { type: 'object' },
  });
  assert.equal('temperature' in out, false);
  assert.equal('topP' in out, false);
  assert.equal(out.responseMimeType, 'application/json');
  assert.deepEqual(out.responseSchema, { type: 'object' });
});

test('buildGenerationConfig: model CÓ hỗ trợ sampling (gemini-3.5-flash, model pin hiện tại) -> giữ nguyên mọi field, không đổi hành vi hiện có', () => {
  const input = { temperature: 0.7 };
  assert.deepEqual(gemini.buildGenerationConfig('gemini-3.5-flash', input), input);
});

// ---------------------------------------------------------------------------
// Retry 429/5xx — CHỈ status transient mới retry, tối đa 3 lần thử (1 lần đầu + 2 lần retry).
// ---------------------------------------------------------------------------
test('retry 429: 2 lần 429 rồi thành công ở lần thử thứ 3 -> gemini.genText() tự phục hồi, không throw', async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return calls < 3 ? errResult(429, `429 lần ${calls}`) : okResult('phục hồi thành công');
  };
  const text = await gemini.genText('xin chào');
  assert.equal(text, 'phục hồi thành công');
  assert.equal(calls, 3);
});

test('retry 429 hết lượt: 429 liên tục -> ném đúng message của LẦN THỬ CUỐI sau khi hết 3 lần', async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return errResult(429, `429 lần ${calls}`);
  };
  await assert.rejects(() => gemini.genText('xin chào'), /429 lần 3/);
  assert.equal(calls, 3, 'phải thử đúng 3 lần (1 đầu + 2 retry) trước khi bỏ cuộc');
});

test('retry 5xx: lỗi 503 cũng được retry giống 429', async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return calls < 2 ? errResult(503, 'service unavailable') : okResult('ok sau retry 5xx');
  };
  const text = await gemini.genText('xin chào');
  assert.equal(text, 'ok sau retry 5xx');
  assert.equal(calls, 2);
});

test('4xx KHÔNG retry (vd 400 request sai) -> ném ngay lần đầu, không lặp lại vô ích', async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return errResult(400, 'yêu cầu không hợp lệ');
  };
  await assert.rejects(() => gemini.genText('xin chào'), /yêu cầu không hợp lệ/);
  assert.equal(calls, 1, '400 không phải lỗi transient — retry sẽ chỉ lặp lại đúng lỗi đó');
});

// ---------------------------------------------------------------------------
// Timeout/AbortController — request vượt GEMINI_TIMEOUT_MS (test env: 50ms) phải bị abort, không
// treo tiến trình chờ mạng vô thời hạn, và KHÔNG tự retry (chỉ retry dựa theo response status).
// ---------------------------------------------------------------------------
test('timeout: request treo vượt GEMINI_TIMEOUT_MS bị abort, gemini.call() ném lỗi trong thời gian ngắn, không retry', async () => {
  let calls = 0;
  global.fetch = (url, opts) => {
    calls += 1;
    return new Promise((resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        const e = new Error('The operation was aborted.');
        e.name = 'AbortError';
        reject(e);
      });
    });
  };
  const start = Date.now();
  await assert.rejects(() => gemini.genText('xin chào'), /aborted/i);
  assert.ok(Date.now() - start < 2000, 'phải abort quanh mốc GEMINI_TIMEOUT_MS test (50ms), không chờ tới default 30s thật');
  assert.equal(calls, 1, 'timeout không được tự retry ở batch W1.9 này (chỉ retry theo response status 429/5xx)');
});
