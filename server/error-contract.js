'use strict';
// W2.1 — Error contract chuẩn hóa (05-error-contract.md). `message` là field canonical; `error` là
// alias tương thích ngược (LUÔN = message ký tự-cho-ký tự) giữ tới khi frontend (Wave 3 strangler)
// chuyển hẳn sang đọc `code`/`message` — không được để mỗi call site tự gán `error` riêng, tránh
// lệch giá trị giữa 2 field (đây là lỗi Codex re-audit round 2 F3 đã sửa 1 lần ở tài liệu).
const crypto = require('crypto');

// Gắn req.requestId cho MỌI request (kể cả response thành công) + trả qua header X-Request-Id —
// nền tảng trace log tối thiểu cho W1.7/W1.AI-POLICY audit và W2.1 error envelope, không cần đổi
// từng route để có id trace.
function requestIdMiddleware(req, res, next) {
  const id = `req_${crypto.randomBytes(12).toString('hex')}`;
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

// Điểm serialize DUY NHẤT cho response lỗi mới — mọi call site chỉ truyền `code`+`message`, hàm
// này tự thêm `error = message` (không để handler tự gán `error` riêng, tránh lệch giá trị).
function sendError(req, res, status, code, message, details) {
  const body = { code, message, error: message, requestId: req?.requestId };
  if (details !== undefined) body.details = details;
  return res.status(status).json(body);
}

// W2.1 phần 2 — phân loại lỗi DB ràng buộc dữ liệu (client gửi thiếu/sai) khỏi lỗi server thật
// KHÔNG xác định (bug/kết nối/...), để middleware toàn cục trả đúng status mà KHÔNG lộ raw driver
// error message ra client. Xác nhận bằng thực nghiệm trực tiếp (không đoán theo tài liệu mysql2):
// SQLite (`node:sqlite`) ném lỗi constraint (NOT NULL/UNIQUE/CHECK/FK) với `err.code ===
// 'ERR_SQLITE_ERROR'` và `err.errcode` là extended result code — base code nằm ở byte thấp
// (`errcode % 256 === 19` = SQLITE_CONSTRAINT, đúng cho mọi biến thể NOTNULL/UNIQUE/FK/CHECK).
// MySQL (qua mysql-sync.js, nay đã forward `err.code` từ worker) dùng mã lỗi cố định của MySQL
// server, không đổi theo phiên bản: ER_BAD_NULL_ERROR/ER_NO_DEFAULT_FOR_FIELD (NOT NULL),
// ER_DUP_ENTRY (UNIQUE/PK), ER_NO_REFERENCED_ROW*/ER_ROW_IS_REFERENCED* (FK), ER_DATA_TOO_LONG/
// WARN_DATA_TRUNCATED/ER_TRUNCATED_WRONG_VALUE (kiểu dữ liệu/độ dài).
const MYSQL_CONSTRAINT_CODES = new Set([
  'ER_BAD_NULL_ERROR', 'ER_NO_DEFAULT_FOR_FIELD', 'ER_DUP_ENTRY',
  'ER_NO_REFERENCED_ROW', 'ER_NO_REFERENCED_ROW_2',
  'ER_ROW_IS_REFERENCED', 'ER_ROW_IS_REFERENCED_2',
  'ER_DATA_TOO_LONG', 'WARN_DATA_TRUNCATED', 'ER_TRUNCATED_WRONG_VALUE',
]);

function isDbConstraintError(err) {
  if (!err) return false;
  if (err.code === 'ERR_SQLITE_ERROR' && Number(err.errcode) % 256 === 19) return true;
  if (typeof err.code === 'string' && MYSQL_CONSTRAINT_CODES.has(err.code)) return true;
  return false;
}

// W2.1 phần 2 — busboy (dùng bởi multer để đọc multipart/form-data) ném lỗi parse body (client gửi
// request malformed: thiếu boundary, cắt ngang form...) dưới dạng `Error` thường, KHÔNG phải
// `MulterError` (xác nhận đọc trực tiếp node_modules/busboy/lib — các message này là literal cố
// định của thư viện, không chứa dữ liệu client nên lộ ra client vẫn an toàn). Đây vẫn là lỗi input
// của client (400), không phải lỗi server thật không xác định.
const BUSBOY_PARSE_ERROR_MESSAGES = new Set([
  'Malformed content type', 'Missing Content-Type', 'Multipart: Boundary not found',
  'Malformed part header', 'Unexpected end of form', 'Unexpected end of file',
  'Malformed urlencoded form',
]);

function isUploadParseError(err) {
  if (!err || typeof err.message !== 'string') return false;
  if (BUSBOY_PARSE_ERROR_MESSAGES.has(err.message)) return true;
  if (err.message.startsWith('Unsupported content type:')) return true;
  return false;
}

module.exports = { requestIdMiddleware, sendError, isDbConstraintError, isUploadParseError };
