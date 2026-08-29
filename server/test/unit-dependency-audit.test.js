'use strict';
// G1A.10 — npm audit: 3 lỗ hổng transitive (body-parser/nanoid/postcss) đã vá bằng version bump
// (không "audit fix mù" — xem memory-bank/15-changelog.md mục tương ứng để biết version cũ/mới
// và lý do). File này là bằng chứng "vá kèm test" cho lỗ hổng duy nhất có đường chạy runtime thật
// trong app này.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const bodyParser = require('body-parser');

test('GHSA-v422-hmwv-36x6 (body-parser): limit không hợp lệ phải throw ngay lúc setup (fail-fast), không âm thầm tắt giới hạn kích thước', () => {
  // Trước bản vá (<1.20.6): bytes.parse('not-a-real-limit') trả null -> body-parser coi limit=null
  // -> raw-body bỏ qua MỌI kiểm tra kích thước (length>limit / received>limit đều skip vì
  // `limit !== null` false) -> DoS: body lớn tuỳ ý được chấp nhận dù cấu hình limit là lỗi gõ.
  // Bản vá throw TypeError ngay khi đăng ký middleware thay vì để lọt xuống runtime.
  assert.throws(
    () => bodyParser.json({ limit: 'not-a-real-limit' }),
    /option limit ".*" is invalid/,
    'body-parser phiên bản đang cài chưa vá GHSA-v422-hmwv-36x6 — limit không hợp lệ không throw'
  );
});

test('body-parser: limit hợp lệ (cấu hình thật của app, "2mb") vẫn hoạt động bình thường sau khi vá — không regression', () => {
  assert.doesNotThrow(() => bodyParser.json({ limit: '2mb' }));
});

test('nanoid/postcss (GHSA-2v37-7h3g-55p8, GHSA-fxqj-rqcc-2cmp): chỉ là devDependency của build tool (postcss/tailwind/vite), không có đường chạy runtime trong server Express — đã vá bằng version bump, không cần test hành vi runtime vì server không require() trực tiếp 2 package này', () => {
  assert.equal(
    /require\(['"]nanoid|require\(['"]postcss/.test(require('fs').readFileSync(__dirname + '/../app.js', 'utf8')), // sanity: app.js không đụng 2 package này
    false
  );
});
