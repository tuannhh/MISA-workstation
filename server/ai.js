'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const { db } = require('./db');
const gemini = require('./gemini');
const cfg = require('./config');
const { requireAuth, requirePerm } = require('./auth');
const { uploadAudio, uploadAiDocument } = require('./uploads');
const { isSpreadsheet, parseSpreadsheet, redactTextForAi } = require('./spreadsheet-parser');
const outbound = require('./safe-fetch');

const router = express.Router();
router.use(requireAuth);

// Hôm nay theo GMT+7 (YYYY-MM-DD)
function todayGMT7() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// Khớp tên người/cơ quan với DB (không phân biệt hoa thường, LIKE)
function matchPerson(name) {
  if (!name) return null;
  return db.prepare(`SELECT p.id, p.full_name, o.name AS org_name, o.org_type
    FROM people p LEFT JOIN organizations o ON o.id=p.org_id
    WHERE p.full_name LIKE ? ORDER BY p.relationship_score DESC LIMIT 1`).get(`%${name}%`);
}
function matchOrg(name) {
  if (!name) return null;
  return db.prepare(`SELECT id, name, org_type FROM organizations WHERE name LIKE ? LIMIT 1`).get(`%${name}%`);
}

const VOICE_SCHEMA = {
  type: 'object',
  properties: {
    transcript: { type: 'string', description: 'Lời nói đã gỡ băng đầy đủ' },
    summary: { type: 'string', description: 'Tóm tắt nội dung tương tác, ngắn gọn' },
    channel: { type: 'string', description: 'Một trong: Gặp mặt, Điện thoại, Email, Sự kiện, Khác' },
    result: { type: 'string', description: 'Một trong: Tích cực, Trung lập, Cần theo dõi' },
    person_name: { type: 'string', description: 'Tên người được nhắc đến (nếu có)' },
    org_name: { type: 'string', description: 'Tên cơ quan/đơn vị được nhắc đến (nếu có)' },
    date: { type: 'string', description: 'Ngày diễn ra dạng YYYY-MM-DD nếu nói rõ, nếu không để trống' },
  },
  required: ['transcript', 'summary'],
};

// Giọng nói -> trích xuất tương tác + khớp đối tác
router.post('/interaction-voice', requirePerm('interactions', 'create'), uploadAudio.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Không có dữ liệu ghi âm.' });
    const prompt = `Đây là đoạn ghi âm tiếng Việt của một nhân viên PR (quan hệ truyền thông) đang ghi nhận một hoạt động/tương tác với đối tác.
Hãy NGHE, gỡ băng (transcript) và TRÍCH XUẤT thông tin tương tác.
- channel chỉ chọn 1 trong: "Gặp mặt", "Điện thoại", "Email", "Sự kiện", "Khác".
- result chỉ chọn 1 trong: "Tích cực", "Trung lập", "Cần theo dõi" (mặc định "Tích cực" nếu không rõ).
- person_name: tên người được nhắc tới (ví dụ "chị Minh Anh" -> "Minh Anh").
- org_name: tên cơ quan/báo/đơn vị (ví dụ "báo VnExpress" -> "VnExpress").
- date: chỉ điền nếu trong lời nói nói rõ ngày, định dạng YYYY-MM-DD; nếu nói "hôm nay" hoặc không nói thì để trống.
- summary: mô tả ngắn gọn, lịch sự nội dung đã làm.`;
    const parts = [
      { text: prompt },
      { inlineData: { mimeType: req.file.mimetype || 'audio/webm', data: req.file.buffer.toString('base64') } },
    ];
    const ai = await gemini.genJSON(parts, VOICE_SCHEMA);
    const person = matchPerson(ai.person_name);
    const org = matchOrg(ai.org_name);
    res.json({
      extracted: {
        transcript: ai.transcript || '',
        summary: ai.summary || '',
        channel: ai.channel || 'Gặp mặt',
        result: ai.result || 'Tích cực',
        date: ai.date || todayGMT7(),
        person_name: ai.person_name || '',
        org_name: ai.org_name || '',
      },
      matchedPerson: person || null,
      matchedOrg: org || null,
    });
  } catch (e) {
    res.status(502).json({ error: 'Lỗi xử lý giọng nói: ' + e.message });
  }
});

// ---------- Thiệp chúc mừng ----------
const DATE_TYPE_VI = { birthday: 'sinh nhật', founding: 'ngày thành lập', anniversary: 'ngày kỷ niệm ngành', other: 'dịp đặc biệt' };

router.post('/card-text', requirePerm('reminders', 'view'), async (req, res) => {
  try {
    const { title, date_type, subject_name, idea } = req.body || {};
    const dip = DATE_TYPE_VI[date_type] || 'dịp đặc biệt';
    const prompt = `Bạn viết lời chúc mừng đại diện cho MISA (công ty công nghệ, phần mềm hàng đầu Việt Nam) gửi tới đối tác truyền thông nhân ${dip}${subject_name ? ` của ${subject_name}` : ''}${title ? ` ("${title}")` : ''}.
Yêu cầu: văn phong trang trọng, chân thành, lịch sự; ngôi xưng đại diện MISA; độ dài khoảng 180-200 từ; tiếng Việt; không dùng emoji; không để chỗ trống dạng [tên].
${idea && idea.trim() ? `Bám theo ý tưởng người dùng đưa ra: "${idea.trim()}".` : 'Người dùng không nêu ý tưởng cụ thể, hãy viết nội dung phù hợp, ý nghĩa cho dịp này.'}
Chỉ trả về phần nội dung lời chúc, không thêm tiêu đề hay ghi chú.`;
    const text = await gemini.genText(prompt, { temperature: 0.8 });
    res.json({ text });
  } catch (e) {
    res.status(502).json({ error: 'Lỗi tạo nội dung: ' + e.message });
  }
});

function logoRef() {
  try {
    const p = path.join(__dirname, '..', 'public', 'assets', 'misa-logo.png');
    if (fs.existsSync(p)) return { mime: 'image/png', data: fs.readFileSync(p).toString('base64') };
  } catch {}
  return null;
}

router.post('/card-image', requirePerm('reminders', 'view'), async (req, res) => {
  try {
    const { text, context } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'Chưa có nội dung lời chúc.' });
    const ref = logoRef();
    const prompt = `Tạo một tấm thiệp chúc mừng chuyên nghiệp, tỷ lệ khung hình 3:2 (ngang).
NGỮ CẢNH: ${context || 'Thiệp chúc mừng của công ty công nghệ MISA gửi đối tác.'}
BỐ CỤC:
- Phần CHỮ (lời chúc) đặt bên trái, chiếm khoảng 1/2 đến 2/3 chiều ngang, chữ tiếng Việt rõ ràng, dễ đọc, trang trọng.
- Phần còn lại bên phải là HOẠ TIẾT công nghệ: đường nét vi mạch (circuit lines) thanh mảnh, hình con CHIP bán dẫn cách điệu (TUYỆT ĐỐI KHÔNG dùng hình bộ não), tinh tế, nhã nhặn.
- Tone màu TƯƠI SÁNG, nền SÁNG (light background). Có logo MISA ở trên cùng.
NỘI DUNG LỜI CHÚC cần thể hiện trên thiệp:
"${text.trim().slice(0, 600)}"
Phong cách: sang trọng, hiện đại, phù hợp doanh nghiệp công nghệ.`;
    const img = await gemini.genImage(prompt, ref ? [ref] : []);
    res.json({ mime: img.mime, dataUrl: `data:${img.mime};base64,${img.data}`, usedLogo: !!ref });
  } catch (e) {
    res.status(502).json({ error: 'Lỗi tạo ảnh: ' + e.message });
  }
});

// ---------- Giải thưởng: AI bóc tách từ văn bản / URL / file ----------
const AWARD_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Tên giải thưởng' },
    organizer: { type: 'string', description: 'Đơn vị tổ chức' },
    organizer_type: { type: 'string', description: 'Loại đơn vị: gov (bộ/ban/ngành) / association (hiệp hội/hội) / other' },
    scale: { type: 'string', description: 'Quy mô (vd Toàn quốc, Khu vực, Quốc tế)' },
    event_time: { type: 'string', description: 'Thời gian diễn ra (vd 2026-04 hoặc Quý II/2026)' },
    submission_deadline: { type: 'string', description: 'Hạn nộp hồ sơ dạng YYYY-MM-DD nếu xác định được' },
    eligibility: { type: 'string', description: 'Điều kiện tham gia' },
    cost: { type: 'integer', description: 'Chi phí tham gia (VNĐ, số nguyên; 0 nếu miễn phí; bỏ trống nếu không rõ)' },
    criteria: { type: 'string', description: 'Bộ tiêu chí đánh giá' },
    required_docs: { type: 'string', description: 'Hồ sơ bao gồm' },
    prize_structure: { type: 'string', description: 'Cơ cấu giải thưởng' },
    evaluation_method: { type: 'string', description: 'Phương thức đánh giá' },
    scope: { type: 'string', description: 'Trong nước hoặc Quốc tế' },
    status: { type: 'string', description: 'Sắp mở / Đang nhận hồ sơ / Đã đóng' },
    ai_summary: { type: 'string', description: 'Tóm tắt ngắn gọn về giải thưởng (2-3 câu)' },
  },
  required: ['name', 'ai_summary'],
};

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20000);
}

router.post('/award-extract', requirePerm('awards', 'create'), uploadAudio.single('file'), async (req, res) => {
  try {
    const instruction = `Đây là thông báo/thể lệ một GIẢI THƯỞNG (hoặc bằng khen, danh hiệu). Hãy đọc và trích xuất thông tin theo schema.
- organizer_type: "gov" nếu là Bộ/Ban/Ngành/cơ quan nhà nước; "association" nếu Hiệp hội/Hội; còn lại "other".
- submission_deadline: định dạng YYYY-MM-DD nếu suy ra được, nếu không thì để trống.
- Chỉ điền thông tin có trong nội dung; trường không rõ thì để trống. ai_summary: tóm tắt 2-3 câu.`;
    const parts = [{ text: instruction }];
    let sourceUrl = null;
    if (req.file) {
      parts.push({ inlineData: { mimeType: req.file.mimetype || 'application/pdf', data: req.file.buffer.toString('base64') } });
    } else if (req.body.text && req.body.text.trim()) {
      parts.push({ text: 'NỘI DUNG:\n' + req.body.text.trim().slice(0, 20000) });
    } else if (req.body.url && /^https?:\/\//.test(req.body.url)) {
      sourceUrl = req.body.url.trim();
      const r = await outbound.safeFetch(sourceUrl, { timeoutMs: 12000, headers: { 'User-Agent': 'Mozilla/5.0 MISA-PR' } });
      const html = await r.text();
      parts.push({ text: 'NỘI DUNG TỪ TRANG WEB:\n' + stripHtml(html) });
    } else {
      return res.status(400).json({ error: 'Cần dán văn bản, nhập URL, hoặc tải lên file.' });
    }
    const extracted = await gemini.genJSON(parts, AWARD_SCHEMA);
    if (sourceUrl) extracted.source_url = sourceUrl;
    extracted.review_status = 'Thô';
    res.json({ extracted });
  } catch (e) {
    if (e instanceof outbound.SafeFetchError) return res.status(400).json({ error: e.message });
    res.status(502).json({ error: 'Lỗi bóc tách: ' + e.message });
  }
});

const ADVICE_SCHEMA = {
  type: 'object',
  properties: {
    capability: { type: 'string', description: 'Đánh giá năng lực đạt giải của MISA (2-4 câu, có nêu điểm mạnh/rủi ro)' },
    plan: { type: 'string', description: 'Nháp kế hoạch triển khai tham gia (các bước chính, mốc thời gian)' },
  },
  required: ['capability', 'plan'],
};
router.post('/award-advice', requirePerm('awards', 'view'), async (req, res) => {
  try {
    const a = req.body || {};
    const prompt = `MISA (công ty phần mềm/công nghệ hàng đầu Việt Nam, sản phẩm tiêu biểu: MISA AMIS, MISA SME, hóa đơn điện tử...) đang cân nhắc tham gia giải thưởng sau:
- Tên: ${a.name || ''}
- Đơn vị tổ chức: ${a.organizer || ''}
- Tiêu chí: ${a.criteria || ''}
- Cơ cấu giải: ${a.prize_structure || ''}
${a.products ? `- Sản phẩm dự kiến tham gia: ${a.products}` : ''}
Hãy đưa ra: (1) đánh giá năng lực đạt giải của MISA, (2) nháp kế hoạch triển khai tham gia. Văn phong chuyên nghiệp, ngắn gọn, tiếng Việt.`;
    const out = await gemini.genJSON([{ text: prompt }], ADVICE_SCHEMA, { temperature: 0.6 });
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: 'Lỗi gợi ý: ' + e.message });
  }
});

// ---------- Sự kiện: AI tự điền từ file kế hoạch (Excel/PDF) hoặc văn bản ----------
const EVENT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Tên sự kiện/chương trình' },
    organizer: { type: 'string', description: 'Đơn vị tổ chức' },
    mode: { type: 'string', description: '"host" nếu MISA là đơn vị tổ chức; "join" nếu MISA chỉ tham gia' },
    field: { type: 'string', description: 'Lĩnh vực: Công nghệ / Tài chính - Thuế / Quản trị / An ninh mạng / Khác' },
    format: { type: 'string', description: 'Online / Offline / Hybrid' },
    start_time: { type: 'string', description: 'Ngày bắt đầu YYYY-MM-DD nếu xác định được' },
    location: { type: 'string', description: 'Địa điểm' },
    scale_attendees: { type: 'integer', description: 'Quy mô số người tham dự (số)' },
    guest_levels: { type: 'string', description: 'Thành phần/cấp độ khách mời (C-Level, M-Level, DN nhỏ/vừa/lớn, Khối chính phủ...)' },
    evaluation: { type: 'string', description: 'Mục tiêu/đánh giá/thông điệp chính (tóm tắt)' },
    note: { type: 'string', description: 'Ghi chú khác (ngân sách dự kiến, đơn vị đồng hành...)' },
  },
  required: ['name'],
};

const eventExtractUsage = new Map();
function limitEventExtract(req, res, next) {
  const key = String(req.session.user.id);
  const now = Date.now();
  const recent = (eventExtractUsage.get(key) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 8) return res.status(429).json({ error: 'Bạn đã tự điền nhiều file liên tiếp. Vui lòng chờ khoảng 1 phút rồi thử lại.' });
  recent.push(now);
  eventExtractUsage.set(key, recent);
  next();
}

router.post('/event-extract', requirePerm('events', 'create'), limitEventExtract, uploadAiDocument.single('file'), async (req, res) => {
  try {
    const instruction = `Đây là tài liệu KẾ HOẠCH một SỰ KIỆN của MISA. Đọc và trích xuất thông tin tổng quan theo schema.
- mode: "host" nếu MISA là đơn vị tổ chức chính; "join" nếu MISA chỉ tham gia/tài trợ.
- start_time: YYYY-MM-DD nếu suy ra được. Chỉ điền thông tin có trong tài liệu; trường không rõ để trống.`;
    const parts = [{ text: instruction }];
    let fileWarnings = [];
    let fileMetadata = null;
    if (req.file) {
      if (!isSpreadsheet(req.file)) return res.status(422).json({ error: 'Chỉ chấp nhận file Excel hoặc CSV.' });
      let parsed;
      try { parsed = await parseSpreadsheet(req.file); }
      catch (error) { return res.status(422).json({ error: error.message }); }
      fileWarnings = parsed.warnings || [];
      fileMetadata = parsed.metadata || null;
      parts.push({ text: 'NỘI DUNG FILE EXCEL ĐÃ ĐƯỢC ĐỌC AN TOÀN:\n' + parsed.text });
    } else if (req.body.text && req.body.text.trim()) {
      parts.push({ text: 'NỘI DUNG ĐÃ ẨN THÔNG TIN LIÊN HỆ:\n' + redactTextForAi(req.body.text.trim()).slice(0, 40000) });
    } else {
      return res.status(400).json({ error: 'Cần tải lên file Excel/CSV hoặc dán văn bản.' });
    }
    const extracted = await gemini.genJSON(parts, EVENT_SCHEMA);
    // các trường cần khai báo nhưng AI chưa thấy -> đánh dấu thiếu (chấm cảnh báo)
    const wanted = ['name', 'organizer', 'mode', 'field', 'format', 'start_time', 'location', 'scale_attendees', 'guest_levels', 'evaluation'];
    const missing = wanted.filter((k) => !extracted[k] && extracted[k] !== 0);
    res.json({ extracted, missing, warnings: fileWarnings, file: fileMetadata });
  } catch (e) {
    res.status(502).json({ error: 'Lỗi tự điền: ' + e.message });
  }
});

router.get('/status', (req, res) => res.json({ enabled: cfg.hasKey(), textModel: cfg.GEMINI_TEXT_MODEL, imageModel: cfg.GEMINI_IMAGE_MODEL }));

// Thêm để unit test (G1A.2) — hàm thuần/DI-được + schema JSON (đối tượng bất biến, không có
// hành vi để "đổi"), không đổi hành vi router (giống routes.js.testables).
router.testables = { stripHtml, limitEventExtract, VOICE_SCHEMA, AWARD_SCHEMA, ADVICE_SCHEMA, EVENT_SCHEMA };

module.exports = router;
