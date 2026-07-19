'use strict';
const bcrypt = require('bcryptjs');
const { db, audit } = require('./db');
const rbac = require('./rbac');

function findUser(username) {
  return db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
}

function login(req, res) {
  const { username, password } = req.body || {};
  const user = findUser(String(username || '').trim());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu.' });
  }
  req.session.user = { id: user.id, username: user.username, full_name: user.full_name, role: user.role, sensitive_perms: user.sensitive_perms };
  audit({ user_id: user.id, username: user.username, action: 'LOGIN', detail: 'Đăng nhập thành công' });
  res.json({ user: req.session.user, permissions: rbac.permissionSummary(req.session.user) });
}

function logout(req, res) {
  req.session.destroy(() => res.json({ ok: true }));
}

function me(req, res) {
  if (!req.session.user) return res.status(401).json({ error: 'Chưa đăng nhập' });
  // làm tươi từ DB (tên/quyền có thể vừa đổi)
  const u = db.prepare('SELECT id, username, full_name, role, sensitive_perms FROM users WHERE id=? AND active=1').get(req.session.user.id);
  if (u) req.session.user = { id: u.id, username: u.username, full_name: u.full_name, role: u.role, sensitive_perms: u.sensitive_perms };
  res.json({ user: req.session.user, permissions: rbac.permissionSummary(req.session.user) });
}

// Bắt buộc đăng nhập
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Chưa đăng nhập' });
  next();
}

// Yêu cầu quyền trên module + hành động
function requirePerm(module, action) {
  return (req, res, next) => {
    const u = req.session.user;
    if (!u) return res.status(401).json({ error: 'Chưa đăng nhập' });
    if (!rbac.can(u.role, module, action)) {
      return res.status(403).json({ error: `Bạn không có quyền ${action} trên ${module}.` });
    }
    next();
  };
}

module.exports = { login, logout, me, requireAuth, requirePerm };
