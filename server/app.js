'use strict';
const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');

require('./db'); // khởi tạo + seed
const auth = require('./auth');
const apiRouter = require('./routes');
const aiRouter = require('./ai');
const { requestIdMiddleware, sendError, isDbConstraintError, isUploadParseError } = require('./error-contract');

function createApp() {
  const isProduction = process.env.NODE_ENV === 'production';
  // F2: production KHÔNG được rơi về secret mặc định (mất tính bí mật của chữ ký cookie); dev/test
  // vẫn giữ fallback để không phá luồng local/CI hiện có.
  if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET bắt buộc phải đặt khi NODE_ENV=production (F2 fail-fast).');
  }

  const app = express();
  // Cloud Run/reverse proxy chấm dứt TLS trước app; cần trust proxy để express-session nhận đúng
  // request là HTTPS (qua X-Forwarded-Proto) và áp cookie.secure chính xác.
  if (isProduction) app.set('trust proxy', 1);

  app.use(requestIdMiddleware);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(session({
    secret: process.env.SESSION_SECRET || 'misa-pr-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: isProduction, httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 },
  }));

  // Auth endpoints
  app.post('/api/login', auth.login);
  app.post('/api/logout', auth.logout);
  app.get('/api/me', auth.me);

  // CRM + admin API
  app.use('/api', apiRouter);
  // AI (Gemini): giọng nói + tạo thiệp
  app.use('/api/ai', aiRouter);

  // Xử lý lỗi (gồm lỗi upload của multer: quá dung lượng / sai định dạng). W2.1 phần 2: phân biệt
  // lỗi ràng buộc dữ liệu (client thiếu/sai trường bắt buộc — vẫn 400 như characterization hiện có
  // ở R004/R007/R031/R045/R064/R089/R092/R047..., KHÔNG đổi status) khỏi lỗi server thật không xác
  // định (500, trước đây cũng rơi vào 400 kèm nguyên message driver — nay không còn lộ). Cả 2 nhánh
  // đều log đầy đủ chi tiết (message+code+stack) server-side kèm requestId để trace, không gửi cho
  // client. Xem `isDbConstraintError()` (error-contract.js) cho danh sách mã lỗi đã xác nhận bằng
  // thực nghiệm trên cả 2 driver, không phải đoán theo tài liệu.
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return sendError(req, res, 400, 'FILE_TOO_LARGE', 'File vượt quá 10MB.');
    }
    if (err && err.name === 'MulterError') {
      return sendError(req, res, 400, 'UPLOAD_ERROR', err.message || 'Lỗi tải file lên.');
    }
    if (err && err.code === 'UPLOAD_REJECTED') {
      return sendError(req, res, 400, 'UPLOAD_ERROR', err.message || 'Lỗi tải file lên.');
    }
    if (isUploadParseError(err)) {
      return sendError(req, res, 400, 'UPLOAD_ERROR', 'Dữ liệu tải file lên không hợp lệ.');
    }
    if (isDbConstraintError(err)) {
      console.error(`[error] requestId=${req.requestId} VALIDATION_FAILED:`, err.code, err.message);
      return sendError(req, res, 400, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ (thiếu trường bắt buộc hoặc vi phạm ràng buộc dữ liệu).');
    }
    console.error(`[error] requestId=${req.requestId} INTERNAL_ERROR:`, err && err.stack || err);
    return sendError(req, res, 500, 'INTERNAL_ERROR', 'Đã xảy ra lỗi ở máy chủ, vui lòng thử lại sau.');
  });

  // Static frontend
  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}

module.exports = { createApp };
