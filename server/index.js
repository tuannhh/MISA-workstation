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
  if (process.env.NODE_ENV !== 'production' && process.env.LOCAL_DEMO === '1') {
    console.log('  Local demo: đủ 4 role D13. Xem README.md; không in mật khẩu vào log.\n');
  }
});
