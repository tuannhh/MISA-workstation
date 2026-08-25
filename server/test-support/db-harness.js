'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Không bao giờ require('../db') / require('../app') ở đây — file này chỉ chuẩn bị
// môi trường (DATA_DIR / MYSQL_DATABASE) TRƯỚC KHI test file tự require app ở trong before().

const TEST_DB_NAME_RE = /^pr_media_test_\d+_[0-9a-f]{8}$/;
const SAFE_TEST_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function setupSqliteDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-media-test-'));
  process.env.DATA_DIR = dir;
  return {
    teardown() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// Chốt fail-closed (Codex G1A1-audit A3): harness dùng tài khoản root để tạo/xoá database —
// nếu shell kế thừa MYSQL_HOST của một MySQL không phải máy test (vd Cloud SQL qua proxy local),
// việc này có thể tạo/xoá database ở nơi không mong muốn. Chặn trừ khi host nằm trong allowlist
// hoặc người gọi tự xác nhận qua ALLOW_TEST_DB_REMOTE_HOST=1.
function assertSafeHost(host) {
  if (SAFE_TEST_HOSTS.has(host) || process.env.ALLOW_TEST_DB_REMOTE_HOST === '1') return;
  throw new Error(
    `db-harness: MYSQL_HOST="${host}" không nằm trong allowlist test (127.0.0.1/localhost/::1). ` +
    'Đặt ALLOW_TEST_DB_REMOTE_HOST=1 nếu chắc chắn đây là MySQL test/CI riêng, không phải hạ tầng thật.'
  );
}

// Opt-in bắt buộc (A3): tránh code khác vô tình gọi createMysqlTestDb() ngoài đúng npm script
// test:integration:mysql (script đó tự set biến này).
function assertOptIn() {
  if (process.env.ALLOW_TEST_DB_CREATE !== '1') {
    throw new Error(
      'db-harness: cần ALLOW_TEST_DB_CREATE=1 để tạo/xoá database MySQL tạm — chốt fail-closed ' +
      'chống gọi nhầm ngoài npm run test:integration:mysql.'
    );
  }
}

function bootstrapConfig() {
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  assertSafeHost(host);
  return {
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_ADMIN_USER || 'root',
    password: process.env.MYSQL_ADMIN_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || 'change-root-password',
  };
}

async function createMysqlTestDb() {
  assertOptIn();
  const mysql = require('mysql2/promise');
  const name = `pr_media_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const admin = await mysql.createConnection(bootstrapConfig());
  let created = false;
  try {
    await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created = true;
    const appUser = process.env.MYSQL_USER || 'pr_media';
    // Cấp quyền đúng schema vừa tạo — KHÔNG dùng wildcard prefix (A3, Codex): giảm blast radius,
    // mỗi lần chạy chỉ cấp thêm quyền trên chính database vừa sinh ra.
    await admin.query(`GRANT ALL PRIVILEGES ON \`${name}\`.* TO '${appUser}'@'%'`);
    await admin.query('FLUSH PRIVILEGES');
  } catch (error) {
    // Rollback (A2): nếu CREATE đã thành công nhưng GRANT/FLUSH lỗi, dọn sạch schema vừa tạo
    // trước khi rethrow — không để sót database tạm chỉ vì setup thất bại giữa đường.
    if (created) {
      try { await admin.query(`DROP DATABASE IF EXISTS \`${name}\``); } catch { /* rollback tốt nhất có thể */ }
    }
    // Gắn tên đã (thử) tạo vào error để failure-path test kiểm tra ĐÚNG tên này còn tồn tại hay
    // không — không so toàn bộ danh sách pr_media_test_%, vì nhiều file test khác có thể đang
    // chạy đồng thời với database tạm riêng của chúng (mỗi file test là 1 process độc lập).
    error.attemptedDbName = name;
    throw error;
  } finally {
    await admin.end();
  }
  process.env.MYSQL_DATABASE = name;
  return name;
}

async function dropMysqlTestDb(name) {
  // Chặn drop tên tuỳ ý (A3): chỉ chấp nhận identifier đúng pattern do createMysqlTestDb() sinh,
  // để lỗi truyền nhầm biến/tên không thể DROP một database khác ngoài ý muốn.
  if (!TEST_DB_NAME_RE.test(name)) {
    throw new Error(`db-harness: tên "${name}" không khớp pattern database test tự sinh — từ chối DROP.`);
  }
  const mysql = require('mysql2/promise');
  const admin = await mysql.createConnection(bootstrapConfig());
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
  } finally {
    await admin.end();
  }
}

module.exports = { setupSqliteDb, createMysqlTestDb, dropMysqlTestDb, TEST_DB_NAME_RE };
