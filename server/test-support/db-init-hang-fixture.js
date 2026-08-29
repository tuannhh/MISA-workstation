'use strict';
// Fixture chạy qua `node --test <file này>` như MỘT FILE node:test THẬT (không phải script
// thường) — dùng bởi server/test/smoke-failure.test.js để tái hiện chính xác kịch bản Codex nêu
// (re-audit round 3, R3-01): "before() throw vẫn được node:test bắt và tiếp tục chạy after();
// nếu require('../db') làm before() throw sau khi worker đã spawn, process có treo hay không?"
// Không đặt trong server/test/ để tránh bị `test:integration:*` (glob server/test/*.test.js) tự
// nhặt vào suite chính — file này chỉ được gọi tường minh qua đường dẫn đầy đủ.
const { test, before, after } = require('node:test');

before(() => {
  require('../db');
});

after(() => {
  console.log('DB_INIT_HANG_FIXTURE_AFTER_RAN');
});

test('không được tới được đây nếu before() lỗi', () => {
  console.log('DB_INIT_HANG_FIXTURE_TEST_RAN');
});
