'use strict';
// Fixture riêng cho self-test known-red.js (server/test/target-session-f2.test.js) — CHẠY QUA
// CHILD PROCESS, không phải file *.test.js nên không bị `node --test server/test/` tự động nhặt.
// Dùng lại entry allowlist thật (F2-fixation) vì nó luôn hợp lệ/chưa hết hạn, không cần entry
// test-only riêng. Chọn kịch bản qua biến môi trường KNOWN_RED_FIXTURE_SCENARIO.
const { knownRed } = require('./known-red');

const scenario = process.env.KNOWN_RED_FIXTURE_SCENARIO;

if (scenario === 'mismatch') {
  // Lỗi KHÔNG khớp expectedError — mô phỏng bug setup/fixture (DB không kết nối, TypeError...).
  // knownRed() phải ném lại nguyên văn, khiến tiến trình này fail (exit != 0).
  knownRed(
    'F2-fixation',
    'fixture mismatch: lỗi không liên quan không được nuốt thành known-red',
    () => {
      throw new TypeError('fixture broken - unrelated setup error, not the real target assertion');
    },
    /session id \(cookie\) phải đổi sau khi login lại/
  );
} else if (scenario === 'match') {
  // Lỗi khớp đúng expectedError — known-red phải PASS bình thường (exit = 0).
  knownRed(
    'F2-fixation',
    'fixture match: lỗi đúng target assertion phải được coi là known-red hợp lệ',
    () => {
      throw new Error('session id (cookie) phải đổi sau khi login lại trên cookie có sẵn');
    },
    /session id \(cookie\) phải đổi sau khi login lại/
  );
} else if (scenario === 'missing-expected-error') {
  // Thiếu expectedError — knownRed() phải throw ngay lúc đăng ký (đồng bộ), làm require() ở đây
  // ném ra, khiến tiến trình fail trước khi node:test kịp chạy gì.
  knownRed('F2-fixation', 'fixture missing expectedError', () => {});
} else {
  throw new Error(`known-red-fixture.js: KNOWN_RED_FIXTURE_SCENARIO không hợp lệ: "${scenario}"`);
}
