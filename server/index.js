'use strict';
const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');

require('./db'); // khởi tạo + seed
const auth = require('./auth');
const apiRouter = require('./routes');
const aiRouter = require('./ai');
const scheduler = require('./scheduler');
const monitor = require('./monitor');

const app = express();
const PORT = process.env.PORT || 3007;

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

app.listen(PORT, () => {
  scheduler.start(); // động cơ nhắc sự kiện (in-app + email nếu có SMTP)
  monitor.start();   // giám sát truyền thông (auto-scan nếu MONITOR_AUTOSCAN=1)
  console.log(`\n  ➜  Hệ thống PR MISA chạy tại: http://localhost:${PORT}\n`);
  console.log('  Tài khoản demo:');
  console.log('   admin / admin123        (Super Admin)');
  console.log('   truongphong / 123456    (Trưởng phòng PR - xem được dữ liệu mật)');
  console.log('   chuyenvien / 123456     (Chuyên viên PR - bị ẩn dữ liệu mật)');
  console.log('   lanhdao / 123456        (Ban Lãnh đạo - chỉ xem)');
  console.log('   xem / 123456            (Cộng tác viên)\n');
});
