'use strict';

// W1.7 (F2): chặn brute-force /api/login — owner chốt 2026-08-30: quá 5 lần sai liên tiếp thì
// khoá tài khoản (theo IP+username) trong 30 phút. Lock tính từ ĐÚNG lần thất bại làm count chạm
// ngưỡng (không phải từ lần sai đầu tiên trong 1 cửa sổ cố định) — nhập sai từ lần thứ 6 trở đi
// trong lúc đang khoá sẽ KHÔNG gọi tới recordFailure() (auth.js chặn ở isBlocked() trước), nên lock
// không tự gia hạn ngoài ý muốn chỉ vì có thêm request tới trong lúc đang khoá. Store trong tiến
// trình — đủ cho single-instance hiện tại (chưa cam kết target multi-replica); nếu sau này chạy
// nhiều instance, thay implementation bằng store dùng chung (Redis) sau interface này, không cần
// đổi call site ở auth.js.
function createLoginRateLimiter({ maxAttempts = 5, lockoutMs = 30 * 60 * 1000, now = () => Date.now() } = {}) {
  const attempts = new Map(); // key -> { count, lockedUntil: number|null }

  function keyFor(req, username) {
    return `${req.ip || req.socket?.remoteAddress || 'unknown'}:${username}`;
  }

  function isBlocked(req, username) {
    const key = keyFor(req, username);
    const entry = attempts.get(key);
    if (!entry || !entry.lockedUntil) return false;
    if (now() >= entry.lockedUntil) {
      attempts.delete(key);
      return false;
    }
    return true;
  }

  function recordFailure(req, username) {
    const key = keyFor(req, username);
    const entry = attempts.get(key) || { count: 0, lockedUntil: null };
    entry.count += 1;
    if (entry.count >= maxAttempts) entry.lockedUntil = now() + lockoutMs;
    attempts.set(key, entry);
  }

  function recordSuccess(req, username) {
    attempts.delete(keyFor(req, username));
  }

  return { isBlocked, recordFailure, recordSuccess };
}

module.exports = { createLoginRateLimiter };
