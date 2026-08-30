'use strict';
const bcrypt = require('bcryptjs');
const { db, audit } = require('./db');
const rbac = require('./rbac');
const { createLoginRateLimiter } = require('./login-rate-limiter');
const { sendError } = require('./error-contract');

const loginRateLimiter = createLoginRateLimiter();

function findUser(username) {
  return db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
}

function login(req, res) {
  const username = String((req.body || {}).username || '').trim();
  const password = String((req.body || {}).password || '');
  if (loginRateLimiter.isBlocked(req, username)) {
    return sendError(req, res, 429, 'RATE_LIMITED', 'Tài khoản tạm khoá do nhập sai mật khẩu quá 5 lần, vui lòng thử lại sau 30 phút.');
  }
  const user = findUser(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    loginRateLimiter.recordFailure(req, username);
    audit({ user_id: user?.id, username, action: 'LOGIN_FAILED', detail: 'Sai tài khoản hoặc mật khẩu' });
    return sendError(req, res, 401, 'UNAUTHENTICATED', 'Sai tài khoản hoặc mật khẩu.');
  }
  loginRateLimiter.recordSuccess(req, username);
  // F2-fixation: đổi hẳn session id sau khi xác thực thành công, không tái dùng cookie đã tồn tại
  // trước đó (attacker có thể đã cắm sẵn cookie cho nạn nhân trước khi nạn nhân đăng nhập).
  req.session.regenerate((err) => {
    if (err) return sendError(req, res, 500, 'INTERNAL_ERROR', 'Lỗi máy chủ');
    req.session.user = { id: user.id, username: user.username, full_name: user.full_name, role: user.role, sensitive_perms: user.sensitive_perms };
    req.principal = req.session.user;
    audit({ user_id: user.id, username: user.username, action: 'LOGIN', detail: 'Đăng nhập thành công' });
    res.json({ user: req.session.user, permissions: rbac.permissionSummary(req.session.user) });
  });
}

function logout(req, res) {
  const u = req.session.user;
  if (u) audit({ user_id: u.id, username: u.username, action: 'LOGOUT', detail: 'Đăng xuất' });
  req.session.destroy(() => res.json({ ok: true }));
}

function me(req, res) {
  if (!req.session.user) return sendError(req, res, 401, 'UNAUTHENTICATED', 'Chưa đăng nhập');
  // làm tươi từ DB (tên/quyền có thể vừa đổi)
  const u = db.prepare('SELECT id, username, full_name, role, sensitive_perms FROM users WHERE id=? AND active=1').get(req.session.user.id);
  if (u) {
    req.session.user = { id: u.id, username: u.username, full_name: u.full_name, role: u.role, sensitive_perms: u.sensitive_perms };
    req.principal = req.session.user;
  }
  res.json({ user: req.session.user, permissions: rbac.permissionSummary(req.session.user) });
}

// Principal seam W1.1. Web session là provider duy nhất hiện tại; PolicyEngine/AMIS bridge
// sau này chỉ đọc req.principal, không được tự suy quyền từ client input.
function resolvePrincipal(req) {
  return req.principal || req.session?.user || null;
}

// Bắt buộc đăng nhập
function requireAuth(req, res, next) {
  const principal = resolvePrincipal(req);
  if (!principal) return sendError(req, res, 401, 'UNAUTHENTICATED', 'Chưa đăng nhập');
  req.principal = principal;
  next();
}

// Yêu cầu quyền trên module + hành động
function requirePerm(module, action) {
  return (req, res, next) => {
    const u = resolvePrincipal(req);
    if (!u) return sendError(req, res, 401, 'UNAUTHENTICATED', 'Chưa đăng nhập');
    req.principal = u;
    if (!rbac.can(u.role, module, action)) {
      return sendError(req, res, 403, 'FORBIDDEN_MODULE', `Bạn không có quyền ${action} trên ${module}.`);
    }
    next();
  };
}

module.exports = { login, logout, me, resolvePrincipal, requireAuth, requirePerm };
