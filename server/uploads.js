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

// W2.1: gắn `.code` để global error middleware (app.js) phân biệt được đây là lỗi validate input
// (client chọn sai loại file — 400 đúng), không phải lỗi server thật không xác định (500).
function fileFilter(req, file, cb) {
  if (ALLOWED.has(file.mimetype)) return cb(null, true);
  const err = new Error('Chỉ chấp nhận ảnh, PDF hoặc tài liệu Word/Excel/PowerPoint.');
  err.code = 'UPLOAD_REJECTED';
  cb(err);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const AUDIO_MIMES = new Set(['audio/webm', 'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/aiff', 'audio/x-aiff']);
const AUDIO_EXTENSIONS = new Set(['.webm', '.wav', '.mp3', '.m4a', '.mp4', '.ogg', '.aif', '.aiff']);
function audioFileFilter(req, file, cb) {
  const mime = String(file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (AUDIO_MIMES.has(mime) && AUDIO_EXTENSIONS.has(ext)) return cb(null, true);
  const err = new Error('Chỉ chấp nhận tệp ghi âm WebM, WAV, MP3, M4A, OGG hoặc AIFF.');
  err.code = 'UPLOAD_REJECTED';
  return cb(err);
}
function hasAudioSignature(file) {
  const bytes = file?.buffer;
  if (!bytes || bytes.length < 4) return false;
  const head = bytes.subarray(0, 12);
  return head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) // WebM/EBML
    || (head.subarray(0, 4).equals(Buffer.from('RIFF')) && head.subarray(8, 12).equals(Buffer.from('WAVE')))
    || head.subarray(0, 4).equals(Buffer.from('OggS'))
    || head.subarray(0, 3).equals(Buffer.from('ID3'))
    || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) // MP3 frame
    || (head.subarray(0, 4).equals(Buffer.from('FORM')) && (head.subarray(8, 12).equals(Buffer.from('AIFF')) || head.subarray(8, 12).equals(Buffer.from('AIFC'))))
    || (head.subarray(4, 8).equals(Buffer.from('ftyp'))); // M4A/MP4
}
function validateAudioFile(file) {
  if (!file || !hasAudioSignature(file)) {
    const err = new Error('Tệp ghi âm không đúng định dạng âm thanh hợp lệ.');
    err.code = 'UPLOAD_REJECTED';
    throw err;
  }
}

// Ghi âm: giữ trong RAM (không lưu đĩa), chỉ chuyển cho Gemini sau type + magic-byte validation.
const uploadAudio = multer({
  storage: multer.memoryStorage(),
  fileFilter: audioFileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

const AI_SPREADSHEET_MIMES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.binary.macroenabled.12',
  'text/csv', 'application/csv', 'text/plain', 'application/octet-stream',
]);
const AI_SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls', '.xlsb', '.csv']);
function aiDocumentFileFilter(req, file, cb) {
  if (AI_SPREADSHEET_MIMES.has(String(file.mimetype || '').toLowerCase())
    && AI_SPREADSHEET_EXTENSIONS.has(path.extname(file.originalname || '').toLowerCase())) {
    return cb(null, true);
  }
  const err = new Error('Chỉ chấp nhận file Excel hoặc CSV.');
  err.code = 'UPLOAD_REJECTED';
  cb(err);
}
const uploadAiDocument = multer({
  storage: multer.memoryStorage(),
  fileFilter: aiDocumentFileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

module.exports = { upload, uploadAudio, uploadAiDocument, UPLOAD_DIR, fileFilter, audioFileFilter, validateAudioFile, aiDocumentFileFilter };
