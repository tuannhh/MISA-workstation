'use strict';
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { UPLOAD_DIR } = require('./db');

// Lưu file vật lý vào data/uploads với tên ngẫu nhiên, giữ phần mở rộng gốc.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'application/pdf',
  // tài liệu văn phòng (hồ sơ hợp tác MOU, lịch sử làm việc, hồ sơ giải thưởng...)
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);

function fileFilter(req, file, cb) {
  if (ALLOWED.has(file.mimetype)) return cb(null, true);
  cb(new Error('Chỉ chấp nhận ảnh, PDF hoặc tài liệu Word/Excel/PowerPoint.'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Ghi âm: giữ trong RAM (không lưu đĩa), chuyển thẳng cho Gemini.
const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

const AI_SPREADSHEET_MIMES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.binary.macroenabled.12',
  'text/csv', 'application/csv', 'text/plain', 'application/octet-stream',
]);
const AI_SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls', '.xlsb', '.csv']);
const uploadAiDocument = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => AI_SPREADSHEET_MIMES.has(String(file.mimetype || '').toLowerCase())
    && AI_SPREADSHEET_EXTENSIONS.has(path.extname(file.originalname || '').toLowerCase())
    ? cb(null, true)
    : cb(new Error('Chỉ chấp nhận file Excel hoặc CSV.')),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

module.exports = { upload, uploadAudio, uploadAiDocument, UPLOAD_DIR };
