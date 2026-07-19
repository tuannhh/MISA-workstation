'use strict';
const cfg = require('./config');

function ensureKey() {
  if (!cfg.GEMINI_API_KEY) throw new Error('Chưa cấu hình GEMINI_API_KEY (đặt vào data/gemini.key).');
}

async function call(model, body) {
  ensureKey();
  const res = await fetch(`${cfg.GEMINI_BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': cfg.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || `Gemini HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function textOf(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('').trim();
}

// Sinh văn bản thường
async function genText(prompt, { temperature = 0.7 } = {}) {
  const data = await call(cfg.GEMINI_TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature },
  });
  return textOf(data);
}

// Sinh JSON theo schema (parts có thể gồm text + inline_data audio)
async function genJSON(parts, schema, { temperature = 0.2 } = {}) {
  const data = await call(cfg.GEMINI_TEXT_MODEL, {
    contents: [{ parts }],
    generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema },
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
    generationConfig: { temperature },
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

module.exports = { genText, genJSON, genImage, groundedSearch, textOf };
