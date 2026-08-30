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

module.exports = { requestIdMiddleware, sendError };
