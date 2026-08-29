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
  const app = express();

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(session({
    secret: process.env.SESSION_SECRET || 'misa-pr-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 },
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
