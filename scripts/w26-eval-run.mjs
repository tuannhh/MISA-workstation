'use strict';
// W2.6 — Golden eval harness: gọi Gemini API THẬT (data/gemini.key), so sánh model đang pin
// (gemini-3.5-flash) với candidate (mặc định gemini-3.7-flash, đổi bằng --candidate=). Ghi từng
// kết quả ra JSONL ngay khi có (an toàn nếu bị ngắt giữa chừng), tự dừng cứng khi ước tính chi phí
// chạm ngưỡng (mặc định $200, đổi bằng --budget=). KHÔNG dùng module server/gemini.js vì cần gọi
// nhiều model khác nhau trong 1 lần chạy (gemini.js cố định theo cfg.GEMINI_TEXT_MODEL) — copy lại
// logic gọi/retry tối thiểu, PHẢI giữ đồng bộ cách dùng generationConfig/responseSchema với
// server/gemini.js nếu sau này gemini.js đổi cách gọi.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCorpus } from './w26-eval-corpus.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const KEY = fs.readFileSync(path.join(ROOT, 'data', 'gemini.key'), 'utf8').trim();
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const PIN_MODEL = 'gemini-3.5-flash';
const CANDIDATE_MODEL = args.candidate || 'gemini-3.7-flash';
const REPEATS = Number(args.repeats || 3);
const CASE_LIMIT = args.limit ? Number(args.limit) : Infinity;
// Ước lượng chi phí THẬN TRỌNG (chưa có bảng giá chính thức xác nhận cho model 2026 — dùng mức
// cao hơn thực tế nhiều lần của flash-tier để KHÔNG đánh giá thấp chi phí thật): $2/1M input token,
// $8/1M output token (gồm thinking token, vì Gemini tính phí thinking token như output).
const COST_PER_M_INPUT = Number(args.costInPerM || 2);
const COST_PER_M_OUTPUT = Number(args.costOutPerM || 8);
const BUDGET_USD = Number(args.budget || 200);

const OUT_DIR = path.join(ROOT, 'scripts', '.w26-eval-out');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_FILE = path.join(OUT_DIR, `results-${args.tag || 'run'}.jsonl`);

// --- Schema copy nguyên văn từ server/ai.js (giữ đồng bộ thủ công — ghi chú ở đầu file) ---
const AWARD_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' }, organizer: { type: 'string' }, organizer_type: { type: 'string' },
    scale: { type: 'string' }, event_time: { type: 'string' }, submission_deadline: { type: 'string' },
    eligibility: { type: 'string' }, cost: { type: 'integer' }, criteria: { type: 'string' },
    required_docs: { type: 'string' }, prize_structure: { type: 'string' }, evaluation_method: { type: 'string' },
    scope: { type: 'string' }, status: { type: 'string' }, ai_summary: { type: 'string' },
  },
  required: ['name', 'ai_summary'],
};
const EVENT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' }, organizer: { type: 'string' }, mode: { type: 'string' }, field: { type: 'string' },
    format: { type: 'string' }, start_time: { type: 'string' }, location: { type: 'string' },
    scale_attendees: { type: 'integer' }, guest_levels: { type: 'string' }, evaluation: { type: 'string' }, note: { type: 'string' },
  },
  required: ['name'],
};
const ADVICE_SCHEMA = {
  type: 'object',
  properties: { capability: { type: 'string' }, plan: { type: 'string' } },
  required: ['capability', 'plan'],
};

function buildPrompt(kase) {
  if (kase.family === 'award-extract') {
    const instruction = `Đây là thông báo/thể lệ một GIẢI THƯỞNG (hoặc bằng khen, danh hiệu). Hãy đọc và trích xuất thông tin theo schema.
- organizer_type: "gov" nếu là Bộ/Ban/Ngành/cơ quan nhà nước; "association" nếu Hiệp hội/Hội; còn lại "other".
- submission_deadline: định dạng YYYY-MM-DD nếu suy ra được, nếu không thì để trống.
- Chỉ điền thông tin có trong nội dung; trường không rõ thì để trống. ai_summary: tóm tắt 2-3 câu.`;
    return { parts: [{ text: instruction }, { text: kase.input }], schema: AWARD_SCHEMA, temperature: 0.2 };
  }
  if (kase.family === 'event-extract') {
    const instruction = `Đây là tài liệu KẾ HOẠCH một SỰ KIỆN của MISA. Đọc và trích xuất thông tin tổng quan theo schema.
- mode: "host" nếu MISA là đơn vị tổ chức chính; "join" nếu MISA chỉ tham gia/tài trợ.
- start_time: YYYY-MM-DD nếu suy ra được. Chỉ điền thông tin có trong tài liệu; trường không rõ để trống.`;
    return { parts: [{ text: instruction }, { text: kase.input }], schema: EVENT_SCHEMA, temperature: 0.2 };
  }
  if (kase.family === 'award-advice') {
    const a = kase.input;
    const prompt = `MISA (công ty phần mềm/công nghệ hàng đầu Việt Nam, sản phẩm tiêu biểu: MISA AMIS, MISA SME, hóa đơn điện tử...) đang cân nhắc tham gia giải thưởng sau:
- Tên: ${a.name || ''}
- Đơn vị tổ chức: ${a.organizer || ''}
- Tiêu chí: ${a.criteria || ''}
- Cơ cấu giải: ${a.prize_structure || ''}
${a.products ? `- Sản phẩm dự kiến tham gia: ${a.products}` : ''}
Hãy đưa ra: (1) đánh giá năng lực đạt giải của MISA, (2) nháp kế hoạch triển khai tham gia. Văn phong chuyên nghiệp, ngắn gọn, tiếng Việt.`;
    return { parts: [{ text: prompt }], schema: ADVICE_SCHEMA, temperature: 0.6 };
  }
  if (kase.family === 'card-text') {
    const DATE_TYPE_VI = { birthday: 'sinh nhật', founding: 'ngày thành lập', anniversary: 'ngày kỷ niệm ngành', other: 'dịp đặc biệt' };
    const { title, date_type, subject_name, idea } = kase.input;
    const dip = DATE_TYPE_VI[date_type] || 'dịp đặc biệt';
    const prompt = `Bạn viết lời chúc mừng đại diện cho MISA (công ty công nghệ, phần mềm hàng đầu Việt Nam) gửi tới đối tác truyền thông nhân ${dip}${subject_name ? ` của ${subject_name}` : ''}${title ? ` ("${title}")` : ''}.
Yêu cầu: văn phong trang trọng, chân thành, lịch sự; ngôi xưng đại diện MISA; độ dài khoảng 180-200 từ; tiếng Việt; không dùng emoji; không để chỗ trống dạng [tên].
${idea && idea.trim() ? `Bám theo ý tưởng người dùng đưa ra: "${idea.trim()}".` : 'Người dùng không nêu ý tưởng cụ thể, hãy viết nội dung phù hợp, ý nghĩa cho dịp này.'}
Chỉ trả về phần nội dung lời chúc, không thêm tiêu đề hay ghi chú.`;
    return { parts: [{ text: prompt }], schema: null, temperature: 0.8 };
  }
  throw new Error(`unknown family ${kase.family}`);
}

async function callGemini(model, { parts, schema, temperature }) {
  const generationConfig = schema
    ? { temperature, responseMimeType: 'application/json', responseSchema: schema }
    : { temperature };
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig }),
    });
  } catch (e) {
    // Lỗi mạng (ECONNRESET/timeout...) — coi là transient, retry ở vòng gọi (main loop), KHÔNG để
    // throw làm crash cả script (đã xảy ra thật 1 lần khi chạy full corpus, mất tiến độ giữa chừng).
    return { ok: false, status: 0, error: `network: ${e.message}`, latencyMs: Date.now() - t0, networkError: true };
  }
  const latencyMs = Date.now() - t0;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: data.error?.message || `HTTP ${res.status}`, latencyMs };
  const textParts = data.candidates?.[0]?.content?.parts || [];
  const text = textParts.map((p) => p.text || '').join('').trim();
  const usage = data.usageMetadata || {};
  return { ok: true, text, latencyMs, promptTokens: usage.promptTokenCount || 0, outputTokens: (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0) };
}

function scoreExtract(text, truth) {
  let json;
  try { json = JSON.parse(text); } catch { return { schemaValid: false, fieldAccuracy: 0 }; }
  if (!json || typeof json !== 'object') return { schemaValid: false, fieldAccuracy: 0 };
  const requiredOk = 'name' in json && !!json.name;
  if (!requiredOk) return { schemaValid: false, fieldAccuracy: 0 };
  const keys = Object.keys(truth);
  let hits = 0;
  for (const k of keys) {
    const expected = String(truth[k]).toLowerCase();
    const actual = String(json[k] ?? '').toLowerCase();
    if (actual && (actual.includes(expected) || expected.includes(actual))) hits += 1;
  }
  return { schemaValid: true, fieldAccuracy: hits / keys.length };
}
function scoreAdvice(text) {
  let json;
  try { json = JSON.parse(text); } catch { return { schemaValid: false, fieldAccuracy: 0 }; }
  const ok = json && typeof json.capability === 'string' && json.capability.length > 20
    && typeof json.plan === 'string' && json.plan.length > 20;
  return { schemaValid: !!ok, fieldAccuracy: ok ? 1 : 0 };
}
function scoreCardText(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const hasPlaceholder = /\[[^\]]{1,20}\]/.test(text);
  const hasEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text);
  const lengthOk = words >= 100 && words <= 320;
  const ok = lengthOk && !hasPlaceholder && !hasEmoji;
  return { schemaValid: ok, fieldAccuracy: ok ? 1 : 0, words };
}

function score(kase, text) {
  if (kase.family === 'award-extract' || kase.family === 'event-extract') return scoreExtract(text, kase.truth);
  if (kase.family === 'award-advice') return scoreAdvice(text);
  if (kase.family === 'card-text') return scoreCardText(text);
  return { schemaValid: false, fieldAccuracy: 0 };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function loadDone() {
  const done = new Set();
  let costSoFar = 0;
  if (!fs.existsSync(OUT_FILE)) return { done, costSoFar };
  for (const line of fs.readFileSync(OUT_FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.ok) { done.add(`${row.id}|${row.model}|${row.rep}`); costSoFar += row.costUsd || 0; }
    } catch { /* dòng hỏng, bỏ qua */ }
  }
  return { done, costSoFar };
}

async function main() {
  const corpus = buildCorpus().slice(0, CASE_LIMIT);
  const models = [PIN_MODEL, CANDIDATE_MODEL];
  // Resume: bỏ qua tổ hợp (case,model,rep) đã có kết quả ok=true trong file cũ (an toàn nếu lần
  // chạy trước bị ngắt giữa chừng do lỗi mạng — không gọi lại, không tốn thêm tiền cho phần đã xong).
  const { done, costSoFar: resumedCost } = loadDone();
  const out = fs.createWriteStream(OUT_FILE, { flags: 'a' });
  let costSoFar = resumedCost;
  let calls = 0;
  console.log(`corpus=${corpus.length} models=${models.join(',')} repeats=${REPEATS} budget=$${BUDGET_USD} resumed=${done.size} resumedCost=$${resumedCost.toFixed(3)} -> ${OUT_FILE}`);
  for (const kase of corpus) {
    const built = buildPrompt(kase);
    for (const model of models) {
      for (let rep = 1; rep <= REPEATS; rep += 1) {
        if (done.has(`${kase.id}|${model}|${rep}`)) continue;
        if (costSoFar >= BUDGET_USD) { console.error(`DỪNG: chi phí ước tính $${costSoFar.toFixed(2)} đã chạm ngân sách $${BUDGET_USD}`); out.end(); process.exit(1); }
        let attempt = 0;
        let result;
        for (;;) {
          attempt += 1;
          result = await callGemini(model, built);
          if (result.ok) break;
          const retryable = result.networkError || result.status === 429 || (result.status >= 500 && result.status <= 599);
          if (!retryable || attempt >= 5) break;
          await sleep(500 * attempt);
        }
        calls += 1;
        let row = { id: kase.id, family: kase.family, model, rep, ok: result.ok, latencyMs: result.latencyMs };
        if (result.ok) {
          const costUsd = (result.promptTokens / 1e6) * COST_PER_M_INPUT + (result.outputTokens / 1e6) * COST_PER_M_OUTPUT;
          costSoFar += costUsd;
          const sc = score(kase, result.text);
          row = { ...row, promptTokens: result.promptTokens, outputTokens: result.outputTokens, costUsd, ...sc };
        } else {
          row = { ...row, error: result.error, status: result.status };
        }
        out.write(JSON.stringify(row) + '\n');
        if (calls % 20 === 0) console.log(`[${calls}] cost~$${costSoFar.toFixed(3)}`);
      }
    }
  }
  out.end();
  console.log(`XONG. total calls=${calls} cost ước tính=$${costSoFar.toFixed(3)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
