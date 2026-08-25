'use strict';
// Fixture chạy trong process con riêng (xem server/test/smoke-failure.test.js) — chỉ require
// server/db.js và in DB_LOADED_OK nếu init()/seed() thành công. Dùng để chứng minh: nếu init()
// thất bại (vd MYSQL_DATABASE trỏ tới schema chưa tồn tại), lỗi phải làm process crash rõ ràng
// (exit code khác 0), không được âm thầm seed nhầm dữ liệu vào một database khác.
require('../db');
console.log('DB_LOADED_OK');
