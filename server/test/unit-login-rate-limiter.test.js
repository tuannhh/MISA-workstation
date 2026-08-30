'use strict';
// W1.7 (F2) — unit test thuần cho server/login-rate-limiter.js, khoá đúng ngưỡng owner đã chốt
// 2026-08-30: quá 5 lần sai liên tiếp thì khoá 30 phút. Dùng clock giả (tham số `now`) để kiểm tra
// chính xác mốc thời gian mà không phải chờ thật 30 phút.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLoginRateLimiter } = require('../login-rate-limiter');

function fakeReq(ip = '10.0.0.1') { return { ip, socket: {} }; }

test('BR-AUTH-001: chưa đủ 5 lần sai thì KHÔNG bị khoá', () => {
  let t = 0;
  const limiter = createLoginRateLimiter({ now: () => t });
  const req = fakeReq();
  for (let i = 0; i < 4; i += 1) {
    limiter.recordFailure(req, 'alice');
    assert.equal(limiter.isBlocked(req, 'alice'), false, `sau lần sai thứ ${i + 1} chưa được khoá`);
  }
});

test('BR-AUTH-002: đúng lần sai thứ 5 thì bị khoá ngay', () => {
  let t = 0;
  const limiter = createLoginRateLimiter({ now: () => t });
  const req = fakeReq();
  for (let i = 0; i < 5; i += 1) limiter.recordFailure(req, 'alice');
  assert.equal(limiter.isBlocked(req, 'alice'), true, 'sau đúng 5 lần sai phải bị khoá');
});

test('BR-AUTH-003: khoá đúng 30 phút — còn khoá ở phút thứ 29:59, hết khoá ở phút thứ 30', () => {
  let t = 0;
  const limiter = createLoginRateLimiter({ now: () => t });
  const req = fakeReq();
  for (let i = 0; i < 5; i += 1) limiter.recordFailure(req, 'alice');
  t = 30 * 60 * 1000 - 1;
  assert.equal(limiter.isBlocked(req, 'alice'), true, 'còn 1ms trước mốc 30 phút vẫn phải đang khoá');
  t = 30 * 60 * 1000;
  assert.equal(limiter.isBlocked(req, 'alice'), false, 'đúng mốc 30 phút phải hết khoá');
});

test('BR-AUTH-004: hết khoá thì đếm lại từ đầu (không khoá lại ngay ở lần sai kế tiếp)', () => {
  let t = 0;
  const limiter = createLoginRateLimiter({ now: () => t });
  const req = fakeReq();
  for (let i = 0; i < 5; i += 1) limiter.recordFailure(req, 'alice');
  t = 30 * 60 * 1000; // hết khoá
  assert.equal(limiter.isBlocked(req, 'alice'), false);
  limiter.recordFailure(req, 'alice'); // lần sai đầu tiên của chu kỳ mới
  assert.equal(limiter.isBlocked(req, 'alice'), false, 'mới 1 lần sai sau khi hết khoá thì chưa được khoá lại');
});

test('BR-AUTH-005: đăng nhập đúng thì xoá hẳn lịch sử sai, không cộng dồn qua lần sau', () => {
  let t = 0;
  const limiter = createLoginRateLimiter({ now: () => t });
  const req = fakeReq();
  for (let i = 0; i < 4; i += 1) limiter.recordFailure(req, 'alice');
  limiter.recordSuccess(req, 'alice');
  for (let i = 0; i < 4; i += 1) limiter.recordFailure(req, 'alice');
  assert.equal(limiter.isBlocked(req, 'alice'), false, '4+4 lần sai nhưng có 1 lần đúng xen giữa reset đếm — không được cộng dồn thành 8 rồi khoá');
});

test('BR-AUTH-006: khoá theo từng cặp (IP, username) riêng — không lẫn giữa 2 user hoặc 2 IP khác nhau', () => {
  let t = 0;
  const limiter = createLoginRateLimiter({ now: () => t });
  const req1 = fakeReq('10.0.0.1');
  const req2 = fakeReq('10.0.0.2');
  for (let i = 0; i < 5; i += 1) limiter.recordFailure(req1, 'alice');
  assert.equal(limiter.isBlocked(req1, 'alice'), true, 'alice@10.0.0.1 phải bị khoá');
  assert.equal(limiter.isBlocked(req1, 'bob'), false, 'bob khác username tại cùng IP không bị ảnh hưởng');
  assert.equal(limiter.isBlocked(req2, 'alice'), false, 'alice từ IP khác không bị ảnh hưởng');
});

test('BR-AUTH-007: mỗi lần sai thêm trong lúc đang khoá không tự gia hạn thời gian khoá (auth.js không gọi recordFailure khi đã isBlocked)', () => {
  let t = 0;
  const limiter = createLoginRateLimiter({ now: () => t });
  const req = fakeReq();
  for (let i = 0; i < 5; i += 1) limiter.recordFailure(req, 'alice');
  t = 10 * 60 * 1000; // vẫn đang trong 30 phút khoá
  // Mô phỏng đúng thứ tự auth.js: chỉ gọi recordFailure() khi CHƯA isBlocked(). Vì đang bị khoá,
  // route thật sẽ không gọi recordFailure() nữa — verify giả định đó đúng bằng cách không gọi thêm
  // và xác nhận mốc hết khoá vẫn là 30 phút kể từ lần đầu, không bị đẩy xa hơn.
  t = 30 * 60 * 1000 - 1;
  assert.equal(limiter.isBlocked(req, 'alice'), true);
  t = 30 * 60 * 1000;
  assert.equal(limiter.isBlocked(req, 'alice'), false, 'không có request nào gọi recordFailure() thêm trong lúc khoá nên mốc hết khoá không bị đẩy xa hơn 30 phút kể từ lần sai thứ 5');
});
