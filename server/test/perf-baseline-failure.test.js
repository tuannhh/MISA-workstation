'use strict';
// G1.8 remediation round 2 (Codex): scripts/perf-baseline.mjs từng đặt
// resources.acquire(setupTestDataDir().teardown) + createMysqlTestDb() TRƯỚC try/finally — nếu
// bootstrap MySQL lỗi (vd sai mật khẩu admin), finally không chạy nên thư mục DATA_DIR tạm bị rò
// (Codex tái hiện bằng TEST_MYSQL_ADMIN_PASSWORD sai, đo được số thư mục pr-media-test-* tăng 1).
// Sau fix, cả 2 dòng nằm TRONG try — resource-stack.cleanupAll() ở finally luôn dọn được dir đã
// acquire dù bước tạo DB sau đó thất bại. Test này spawn thật script (không phải harness đơn lẻ)
// để chứng minh đúng hành vi end-to-end: exit khác 0 + không rò thư mục tạm.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const root = path.join(__dirname, '..', '..');

function countPerfTestTempDirs() {
  return fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('pr-media-test-')).length;
}

test(
  'scripts/perf-baseline.mjs: bootstrap MySQL lỗi -> exit khác 0, không rò DATA_DIR tạm',
  { skip: !isMysql },
  () => {
    const before = countPerfTestTempDirs();

    const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'perf-baseline.mjs')], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000,
      env: {
        ...process.env,
        DB_CLIENT: 'mysql',
        ALLOW_TEST_DB_CREATE: '1',
        // Sai mật khẩu admin -> connection bootstrap trong createMysqlTestDb() phải reject ngay,
        // trước khi kịp CREATE DATABASE/GRANT (đúng thí nghiệm Codex dùng để tái hiện lỗi rò).
        TEST_MYSQL_ADMIN_PASSWORD: 'sai-mat-khau-co-y-de-that-bai',
      },
    });

    assert.equal(result.signal, null, `script không được bị kill (signal=${result.signal})`);
    assert.notEqual(result.status, 0, 'script phải exit khác 0 khi bootstrap MySQL thất bại');

    const after = countPerfTestTempDirs();
    assert.equal(
      after, before,
      `không được rò thư mục DATA_DIR tạm (pr-media-test-*) khi createMysqlTestDb() thất bại — trước=${before}, sau=${after}`
    );
  }
);
