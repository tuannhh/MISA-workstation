'use strict';

// require('../../db') LUÔN ở bên trong thân hàm, không ở top-level của module này — nếu require
// ở top-level, chỉ việc require('./fixtures') ở đầu file test (trước khi before() tạo xong DB
// tạm) sẽ spawn worker MySQL trỏ vào database mặc định/sai. Xem server/mysql-sync.js:54.

function createUser(role, overrides = {}) {
  const bcrypt = require('bcryptjs');
  const { db } = require('../db');
  const user = {
    username: overrides.username || `test_${role}_${Date.now()}`,
    password: overrides.password || 'test-pass-123',
    full_name: overrides.full_name || `Test ${role}`,
    role,
    email: overrides.email ?? null,
    sensitive_perms: overrides.sensitive_perms ? JSON.stringify(overrides.sensitive_perms) : null,
  };
  const insUser = db.prepare(
    'INSERT INTO users (username, password_hash, full_name, role, email, sensitive_perms) VALUES (?,?,?,?,?,?)'
  );
  insUser.run(user.username, bcrypt.hashSync(user.password, 10), user.full_name, user.role, user.email, user.sensitive_perms);
  return { username: user.username, password: user.password, role };
}

// Fixture principal "chế độ privileged" mà G1A.1 yêu cầu (04-ROADMAP.md G1A.1) — dùng để cô lập
// hành vi non-security (mà G1A.3 đi test) khỏi lỗi RBAC 2-role đã biết, KHÔNG dùng để che giấu
// lỗ hổng thật. `super_admin` hiện đã có CRUD trên mọi module + canSeeSensitive=true
// (`server/rbac.js:12-15`), nên tự nhiên thoả vai "privileged" trong model 2-role hiện tại —
// không cần tạo cơ chế bypass auth riêng. Khi D13 (4 role) lên Wave 1, hàm này phải đổi theo.
function createPrivilegedUser(overrides = {}) {
  return createUser('super_admin', overrides);
}

async function login(baseUrl, { username, password }) {
  const res = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.status !== 200) {
    throw new Error(`login thất bại: ${res.status} ${await res.text()}`);
  }
  const setCookie = res.headers.getSetCookie();
  if (!setCookie.length) throw new Error('login không trả Set-Cookie');
  const cookie = setCookie[0].split(';')[0];
  return { cookie, body: await res.json() };
}

module.exports = { createUser, createPrivilegedUser, login };
