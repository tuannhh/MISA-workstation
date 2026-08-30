'use strict';
const cfg = require('./config');

function ensureKey() {
  if (!cfg.GEMINI_API_KEY) throw new Error('Chưa cấu hình GEMINI_API_KEY (đặt vào data/gemini.key).');
}

// F8 (W1.9): model nào còn hỗ trợ sampling params (temperature/top_p/top_k). Gemini deprecate dần
// các tham số này ở model mới hơn (changelog Gemini 2026-07-21, xem 01-audit-findings.md#F8) —
// model ngoài danh sách vẫn gọi được, chỉ không kèm sampling params để không lỗi HTTP 400 âm thầm
// nếu sau này đổi GEMINI_TEXT_MODEL (W2.6) mà quên rà lại chỗ này.
const SAMPLING_PARAMS_SUPPORTED_MODELS = new Set(['gemini-3.5-flash']);
function supportsSamplingParams(model) { return SAMPLING_PARAMS_SUPPORTED_MODELS.has(model); }
function buildGenerationConfig(model, config = {}) {
  if (supportsSamplingParams(model)) return config;
  const { temperature, topP, topK, top_p, top_k, ...rest } = config;
  return rest;
}

// F8 (W1.9): retry CHỈ áp dụng lỗi transient thật (429 rate-limit, 5xx phía Gemini) — KHÔNG retry
// lỗi 4xx khác (400 request sai/403 thiếu quyền...) vì retry sẽ chỉ lặp lại đúng lỗi đó vô ích.
// Lỗi mạng/timeout (fetch reject, kể cả AbortError) cũng KHÔNG tự retry ở batch này — chỉ retry
// dựa trên response HTTP status đã nhận được, không đoán một lỗi network là transient.
const MAX_ATTEMPTS = 3;
function isRetryableStatus(status) { return status === 429 || (status >= 500 && status <= 599); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function fetchOnce(model, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.GEMINI_TIMEOUT_MS);
  try {
    return await fetch(`${cfg.GEMINI_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': cfg.GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function call(model, body) {
  ensureKey();
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const res = await fetchOnce(model, body);
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    lastErr = new Error(data.error?.message || `Gemini HTTP ${res.status}`);
    if (!isRetryableStatus(res.status) || attempt === MAX_ATTEMPTS) throw lastErr;
    await sleep(cfg.GEMINI_RETRY_BASE_DELAY_MS * attempt);
  }
  throw lastErr;
}

function textOf(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('').trim();
}

// Sinh văn bản thường
async function genText(prompt, { temperature = 0.7 } = {}) {
  const data = await call(cfg.GEMINI_TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: buildGenerationConfig(cfg.GEMINI_TEXT_MODEL, { temperature }),
  });
  return textOf(data);
}

// Sinh JSON theo schema (parts có thể gồm text + inline_data audio)
async function genJSON(parts, schema, { temperature = 0.2 } = {}) {
  const data = await call(cfg.GEMINI_TEXT_MODEL, {
    contents: [{ parts }],
    generationConfig: buildGenerationConfig(cfg.GEMINI_TEXT_MODEL, { temperature, responseMimeType: 'application/json', responseSchema: schema }),
  });
  const raw = textOf(data);
  try { return JSON.parse(raw); }
  catch { throw new Error('AI trả về dữ liệu không hợp lệ.'); }
}

// Tìm kiếm có "grounding" Google Search: trả về văn bản + nguồn (web chunks) + truy vấn đã dùng
async function groundedSearch(prompt, { temperature = 0.3 } = {}) {
  const data = await call(cfg.GEMINI_TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: buildGenerationConfig(cfg.GEMINI_TEXT_MODEL, { temperature }),
  });
  const cand = data.candidates?.[0] || {};
  const gm = cand.groundingMetadata || {};
  const chunks = (gm.groundingChunks || []).map((c) => c.web).filter((w) => w && w.uri);
  return { text: textOf(data), chunks, queries: gm.webSearchQueries || [] };
}

// Trích xuất ảnh (base64) đầu tiên từ phản hồi image model
function imageOf(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    const inline = p.inlineData || p.inline_data;
    if (inline && inline.data) return { mime: inline.mimeType || inline.mime_type || 'image/png', data: inline.data };
  }
  return null;
}

// Tạo ảnh; refImages: [{mime, data(base64)}] để model tham chiếu (vd logo)
async function genImage(prompt, refImages = []) {
  const parts = [{ text: prompt }];
  for (const r of refImages) parts.push({ inlineData: { mimeType: r.mime, data: r.data } });
  const data = await call(cfg.GEMINI_IMAGE_MODEL, { contents: [{ parts }] });
  const img = imageOf(data);
  if (!img) throw new Error('AI không tạo được ảnh. Thử lại.');
  return img; // {mime, data}
}

module.exports = { genText, genJSON, genImage, groundedSearch, textOf, supportsSamplingParams, buildGenerationConfig };
