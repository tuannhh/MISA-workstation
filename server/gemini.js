'use strict';
const cfg = require('./config');

class GeminiContractError extends Error {
  constructor(message = 'AI trả về dữ liệu không đúng cấu trúc mong đợi.') {
    super(message);
    this.name = 'GeminiContractError';
  }
}

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

// Gemini responseSchema giúp model tạo JSON đúng ngay từ đầu, nhưng nó là ràng buộc của provider
// chứ không phải validation ở trust-boundary của ứng dụng. Chỉ dữ liệu được kiểm tra + pruned tại
// đây mới được phép đi tiếp sang route/UI/DB. Bộ schema trong dự án hiện chỉ dùng object/array,
// primitive, enum và các giới hạn số/chữ; hỗ trợ đúng tập đó để tránh thêm một dependency nặng.
function validateStructuredOutput(value, schema, path = '$') {
  if (!schema || typeof schema !== 'object') return value;
  const type = schema.type;
  if (type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GeminiContractError(`${path} phải là object.`);
    const properties = schema.properties || {};
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) throw new GeminiContractError(`${path}.${key} là bắt buộc.`);
    }
    const clean = {};
    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) clean[key] = validateStructuredOutput(value[key], childSchema, `${path}.${key}`);
    }
    return clean;
  }
  if (type === 'array') {
    if (!Array.isArray(value)) throw new GeminiContractError(`${path} phải là mảng.`);
    if (value.length > 100) throw new GeminiContractError(`${path} vượt quá số phần tử cho phép.`);
    return value.map((item, index) => validateStructuredOutput(item, schema.items || {}, `${path}[${index}]`));
  }
  if (type === 'string') {
    if (typeof value !== 'string') throw new GeminiContractError(`${path} phải là chuỗi.`);
    if (value.length > (schema.maxLength || 20000)) throw new GeminiContractError(`${path} quá dài.`);
    if (schema.minLength && value.trim().length < schema.minLength) throw new GeminiContractError(`${path} không được để trống.`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) throw new GeminiContractError(`${path} không đúng định dạng.`);
  } else if (type === 'integer') {
    if (!Number.isInteger(value)) throw new GeminiContractError(`${path} phải là số nguyên.`);
  } else if (type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new GeminiContractError(`${path} phải là số.`);
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) throw new GeminiContractError(`${path} nhỏ hơn mức cho phép.`);
    if (schema.maximum != null && value > schema.maximum) throw new GeminiContractError(`${path} lớn hơn mức cho phép.`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) throw new GeminiContractError(`${path} không thuộc tập giá trị cho phép.`);
  return value;
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

function safeGroundingChunk(web) {
  if (!web || typeof web.uri !== 'string') return null;
  try {
    const url = new URL(web.uri);
    // Kết quả Gemini là input không tin cậy. Chỉ trả về HTTPS URL hợp lệ để UI không biến output
    // model thành javascript:/data: link; safeFetch vẫn kiểm tra DNS/IP trước khi server tự mở URL.
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    // Preserve the provider URI verbatim after validation. Normalising with URL#toString()
    // changes a harmless URL such as https://example.com into https://example.com/, which makes
    // audit trails and source matching needlessly unstable.
    return { uri: web.uri, title: String(web.title || '').slice(0, 500) };
  } catch { return null; }
}

// Sinh văn bản thường
async function genText(prompt, { temperature = 0.7 } = {}) {
  const data = await call(cfg.GEMINI_TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: buildGenerationConfig(cfg.GEMINI_TEXT_MODEL, { temperature, maxOutputTokens: cfg.GEMINI_MAX_OUTPUT_TOKENS }),
  });
  return textOf(data);
}

// Sinh JSON theo schema (parts có thể gồm text + inline_data audio)
async function genJSON(parts, schema, { temperature = 0.2 } = {}) {
  const data = await call(cfg.GEMINI_TEXT_MODEL, {
    contents: [{ parts }],
    generationConfig: buildGenerationConfig(cfg.GEMINI_TEXT_MODEL, { temperature, maxOutputTokens: cfg.GEMINI_MAX_OUTPUT_TOKENS, responseMimeType: 'application/json', responseSchema: schema }),
  });
  const raw = textOf(data);
  try { return validateStructuredOutput(JSON.parse(raw), schema); }
  catch { throw new Error('AI trả về dữ liệu không hợp lệ.'); }
}

// Tìm kiếm có "grounding" Google Search: trả về văn bản + nguồn (web chunks) + truy vấn đã dùng
async function groundedSearch(prompt, { temperature = 0.3 } = {}) {
  const data = await call(cfg.GEMINI_TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: buildGenerationConfig(cfg.GEMINI_TEXT_MODEL, { temperature, maxOutputTokens: cfg.GEMINI_MAX_OUTPUT_TOKENS }),
  });
  const cand = data.candidates?.[0] || {};
  const gm = cand.groundingMetadata || {};
  const chunks = (gm.groundingChunks || []).map((c) => safeGroundingChunk(c.web)).filter(Boolean);
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

module.exports = { genText, genJSON, genImage, groundedSearch, textOf, safeGroundingChunk, supportsSamplingParams, buildGenerationConfig, validateStructuredOutput, GeminiContractError };
