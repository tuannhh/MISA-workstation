'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Không bao giờ require('../db') / require('../app') ở đây — file này chỉ chuẩn bị
// môi trường (DATA_DIR / MYSQL_DATABASE) TRƯỚC KHI test file tự require app ở trong before().

const TEST_DB_NAME_RE = /^pr_media_test_\d+_[0-9a-f]{8}$/;
const SAFE_TEST_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const SAFE_APP_USER_RE = /^[A-Za-z0-9_]{1,32}$/;

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
// nếu shell kế thừa host của một MySQL không phải máy test (vd Cloud SQL qua proxy local),
// việc này có thể tạo/xoá database ở nơi không mong muốn. Chặn trừ khi host nằm trong allowlist
// hoặc người gọi tự xác nhận qua ALLOW_TEST_DB_REMOTE_HOST=1.
function assertSafeHost(host) {
  if (SAFE_TEST_HOSTS.has(host) || process.env.ALLOW_TEST_DB_REMOTE_HOST === '1') return;
  throw new Error(
    `db-harness: TEST_MYSQL_HOST="${host}" không nằm trong allowlist test (127.0.0.1/localhost/::1). ` +
    'Đặt ALLOW_TEST_DB_REMOTE_HOST=1 nếu chắc chắn đây là MySQL test/CI riêng, không phải hạ tầng thật.'
  );
}

// Opt-in bắt buộc (A3/R2-02): tránh code khác vô tình gọi tạo/xoá database MySQL tạm ngoài đúng
// npm script test:integration:mysql (script đó tự set biến này). Áp dụng cho CẢ tạo LẪN xoá —
// trước đây chỉ createMysqlTestDb() gọi assertOptIn(), dropMysqlTestDb() có thể chạy DROP với tên
// hợp regex mà không cần opt-in (Codex re-audit round 2, R2-02).
function assertOptIn() {
  if (process.env.ALLOW_TEST_DB_CREATE !== '1') {
    throw new Error(
      'db-harness: cần ALLOW_TEST_DB_CREATE=1 để tạo/xoá database MySQL tạm — chốt fail-closed ' +
      'chống gọi nhầm ngoài npm run test:integration:mysql.'
    );
  }
}

// Cloud Run production dùng unix socket (/cloudsql/...) để nối Cloud SQL — harness test tích hợp
// không có lý do hợp lệ nào để chạy qua socket đó. Chặn tuyệt đối để một shell đang cấu hình cho
// production/Cloud SQL không vô tình khiến harness tạo/xoá database trên đúng instance đó
// (Codex re-audit round 2, R2-02: "reject MYSQL_SOCKET_PATH trong integration harness").
function assertNoProductionSocket() {
  if (process.env.MYSQL_SOCKET_PATH) {
    throw new Error(
      'db-harness: biến MYSQL_SOCKET_PATH đang được set (dùng cho Cloud SQL/production qua unix ' +
      'socket) — harness test tích hợp không được kết nối qua socket đó. Bỏ biến này khỏi shell ' +
      'trước khi chạy test tích hợp MySQL.'
    );
  }
}

function assertSafeAppUser(user) {
  if (!SAFE_APP_USER_RE.test(user)) {
    throw new Error(
      `db-harness: MYSQL_USER="${user}" không phải identifier hợp lệ (chỉ chữ/số/_, tối đa 32 ký ` +
      'tự) — từ chối dùng trực tiếp trong câu GRANT.'
    );
  }
}

// Bootstrap connection (tài khoản admin tạo/xoá database) dùng biến TEST_MYSQL_* RIÊNG — KHÔNG
// đọc MYSQL_HOST/MYSQL_ADMIN_*/MYSQL_ROOT_PASSWORD của app. Lý do (Codex re-audit round 2,
// R2-02): các biến MYSQL_* có thể đang được một shell dev set để trỏ tới Cloud SQL Proxy chạy
// local trên cùng host/port loopback — allowlist host một mình không phân biệt được "Docker MySQL
// test" với "proxy tới production". Dùng namespace biến riêng buộc người chạy phải tự khai báo rõ
// ràng nếu muốn trỏ nơi khác ngoài Docker Compose mặc định của repo.
function bootstrapConfig() {
  assertNoProductionSocket();
  const host = process.env.TEST_MYSQL_HOST || '127.0.0.1';
  assertSafeHost(host);
  return {
    host,
    port: Number(process.env.TEST_MYSQL_PORT || 3306),
    user: process.env.TEST_MYSQL_ADMIN_USER || 'root',
    password: process.env.TEST_MYSQL_ADMIN_PASSWORD || 'change-root-password',
  };
}

async function createMysqlTestDb() {
  assertOptIn();
  const mysql = require('mysql2/promise');
  const name = `pr_media_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const appUser = process.env.MYSQL_USER || 'pr_media';
  assertSafeAppUser(appUser);
  const admin = await mysql.createConnection(bootstrapConfig());
  let created = false;
  try {
    await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created = true;
    // Cấp quyền đúng schema vừa tạo — KHÔNG dùng wildcard prefix (A3, Codex): giảm blast radius,
    // mỗi lần chạy chỉ cấp thêm quyền trên chính database vừa sinh ra.
    await admin.query(`GRANT ALL PRIVILEGES ON \`${name}\`.* TO '${appUser}'@'%'`);
    await admin.query('FLUSH PRIVILEGES');
  } catch (error) {
    // Rollback (A2): nếu CREATE đã thành công nhưng GRANT/FLUSH lỗi, dọn sạch schema vừa tạo
    // trước khi rethrow — không để sót database tạm chỉ vì setup thất bại giữa đường.
    if (created) {
      try {
        await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
      } catch (rollbackError) {
        // Không nuốt lỗi rollback (Codex re-audit round 2, R2-02): gắn làm cleanupError để caller
        // (và AggregateError ở smoke.test.js after()) thấy được cả lỗi gốc lẫn lỗi dọn dẹp.
        error.cleanupError = rollbackError;
      }
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
  // Opt-in bắt buộc cho cả DROP (R2-02) — trước đây chỉ CREATE yêu cầu, DROP có thể chạy với một
  // tên hợp regex mà không cần xác nhận.
  assertOptIn();
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
