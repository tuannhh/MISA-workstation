'use strict';
const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');

require('./db'); // khởi tạo + seed
const auth = require('./auth');
const apiRouter = require('./routes');
const aiRouter = require('./ai');

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

  // Xử lý lỗi (gồm lỗi upload của multer: quá dung lượng / sai định dạng)
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const msg = err && err.code === 'LIMIT_FILE_SIZE' ? 'File vượt quá 10MB.' : (err && err.message) || 'Lỗi máy chủ';
    res.status(400).json({ error: msg });
  });

  // Static frontend
  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}

module.exports = { createApp };
