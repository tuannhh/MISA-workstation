'use strict';
const { createApp } = require('./app');
const scheduler = require('./scheduler');
const monitor = require('./monitor');

const app = createApp();
const PORT = process.env.PORT || 3007;

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
