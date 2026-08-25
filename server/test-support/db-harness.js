'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Không bao giờ require('../db') / require('../app') ở đây — file này chỉ chuẩn bị
// môi trường (DATA_DIR / MYSQL_DATABASE) TRƯỚC KHI test file tự require app ở trong before().

function setupSqliteDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-media-test-'));
  process.env.DATA_DIR = dir;
  return {
    teardown() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function bootstrapConfig() {
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_ADMIN_USER || 'root',
    password: process.env.MYSQL_ADMIN_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || 'change-root-password',
  };
}

async function createMysqlTestDb() {
  const mysql = require('mysql2/promise');
  const name = `pr_media_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const admin = await mysql.createConnection(bootstrapConfig());
  try {
    await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    const appUser = process.env.MYSQL_USER || 'pr_media';
    // Wildcard theo prefix — app tiếp tục dùng đúng MYSQL_USER/MYSQL_PASSWORD hiện có,
    // chỉ đổi MYSQL_DATABASE để trỏ vào schema tạm.
    await admin.query(`GRANT ALL PRIVILEGES ON \`pr_media_test_%\`.* TO '${appUser}'@'%'`);
    await admin.query('FLUSH PRIVILEGES');
  } finally {
    await admin.end();
  }
  process.env.MYSQL_DATABASE = name;
  return name;
}

async function dropMysqlTestDb(name) {
  const mysql = require('mysql2/promise');
  const admin = await mysql.createConnection(bootstrapConfig());
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
  } finally {
    await admin.end();
  }
}

module.exports = { setupSqliteDb, createMysqlTestDb, dropMysqlTestDb };
