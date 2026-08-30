'use strict';
// Fixture riêng cho self-test known-red.js (server/test/target-session-f2.test.js) — CHẠY QUA
// CHILD PROCESS, không phải file *.test.js nên không bị `node --test server/test/` tự động nhặt.
// Dùng entry allowlist riêng cho infra self-test (`INFRA-known-red-selftest`, expiry 2099) —
// KHÔNG gắn với bất kỳ finding thật nào, để không phụ thuộc còn known-red thật nào đang mở (trước
// đây dùng tạm N1-explicit-action, gãy khi N1 được sửa xong và xoá khỏi allowlist). Chọn kịch bản
// qua biến môi trường KNOWN_RED_FIXTURE_SCENARIO.
const { knownRed } = require('./known-red');

const scenario = process.env.KNOWN_RED_FIXTURE_SCENARIO;

if (scenario === 'mismatch') {
  // Lỗi KHÔNG khớp expectedError — mô phỏng bug setup/fixture (DB không kết nối, TypeError...).
  // knownRed() phải ném lại nguyên văn, khiến tiến trình này fail (exit != 0).
  knownRed(
    'INFRA-known-red-selftest',
    'fixture mismatch: lỗi không liên quan không được nuốt thành known-red',
    () => {
      throw new TypeError('fixture broken - unrelated setup error, not the real target assertion');
    },
    /session id \(cookie\) phải đổi sau khi login lại/
  );
} else if (scenario === 'match') {
  // Lỗi khớp đúng expectedError — known-red phải PASS bình thường (exit = 0).
  knownRed(
    'INFRA-known-red-selftest',
    'fixture match: lỗi đúng target assertion phải được coi là known-red hợp lệ',
    () => {
      throw new Error('session id (cookie) phải đổi sau khi login lại trên cookie có sẵn');
    },
    /session id \(cookie\) phải đổi sau khi login lại/
  );
} else if (scenario === 'missing-expected-error') {
  // Thiếu expectedError — knownRed() phải throw ngay lúc đăng ký (đồng bộ), làm require() ở đây
  // ném ra, khiến tiến trình fail trước khi node:test kịp chạy gì.
  knownRed('INFRA-known-red-selftest', 'fixture missing expectedError', () => {});
} else {
  throw new Error(`known-red-fixture.js: KNOWN_RED_FIXTURE_SCENARIO không hợp lệ: "${scenario}"`);
}
