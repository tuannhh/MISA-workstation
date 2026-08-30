'use strict';

// W1.7 (F2): chặn brute-force /api/login. Store trong tiến trình — đủ cho single-instance hiện
// tại (chưa cam kết target multi-replica); nếu sau này chạy nhiều instance, thay implementation
// bằng store dùng chung (Redis) sau interface này, không cần đổi call site ở auth.js.
function createLoginRateLimiter({ windowMs = 15 * 60 * 1000, maxAttempts = 5 } = {}) {
  const attempts = new Map(); // key -> { count, resetAt }

  function keyFor(req, username) {
    return `${req.ip || req.socket?.remoteAddress || 'unknown'}:${username}`;
  }

  function isBlocked(req, username) {
    const entry = attempts.get(keyFor(req, username));
    if (!entry) return false;
    if (Date.now() >= entry.resetAt) {
      attempts.delete(keyFor(req, username));
      return false;
    }
    return entry.count >= maxAttempts;
  }

  function recordFailure(req, username) {
    const key = keyFor(req, username);
    const entry = attempts.get(key);
    if (!entry || Date.now() >= entry.resetAt) {
      attempts.set(key, { count: 1, resetAt: Date.now() + windowMs });
    } else {
      entry.count += 1;
    }
  }

  function recordSuccess(req, username) {
    attempts.delete(keyFor(req, username));
  }

  return { isBlocked, recordFailure, recordSuccess };
}

module.exports = { createLoginRateLimiter };
