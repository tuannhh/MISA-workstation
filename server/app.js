'use strict';
const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');

require('./db'); // khởi tạo + seed
const auth = require('./auth');
const apiRouter = require('./routes');
const aiRouter = require('./ai');
const { requestIdMiddleware, sendError } = require('./error-contract');

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

  // Xử lý lỗi (gồm lỗi upload của multer: quá dung lượng / sai định dạng). W2.1: thêm code/message/
  // requestId chuẩn hóa (05-error-contract.md) mà KHÔNG đổi status code hiện có — phần lớn route
  // POST/PUT dựa vào lỗi NOT NULL của DB bubble lên đúng middleware này để trả 400 làm validation
  // (đặc tả ở nhiều test R004/R007/R031/R045/R064/R089/R092/R047...); đổi mặc định "lỗi khác" sang
  // 500 sẽ phá vỡ hàng loạt characterization test đó — đây là việc lớn hơn, thuộc phạm vi thêm input
  // validation tường minh trước khi chạm DB (chưa làm ở batch W2.1 này, ghi nhận nợ kỹ thuật).
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return sendError(req, res, 400, 'FILE_TOO_LARGE', 'File vượt quá 10MB.');
    }
    if (err && err.name === 'MulterError') {
      return sendError(req, res, 400, 'UPLOAD_ERROR', err.message || 'Lỗi tải file lên.');
    }
    const msg = (err && err.message) || 'Lỗi máy chủ';
    return sendError(req, res, 400, 'UNCAUGHT_ERROR', msg);
  });

  // Static frontend
  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}

module.exports = { createApp };
