'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

let baseUrl;
let fixtureUser;
// Stack tài nguyên đã acquire thành công (Codex re-audit round 2, R2-01): after() KHÔNG BAO GIỜ
// tự require()/tạo mới resource — chỉ pop đúng những cleanup đã được push tại đúng thời điểm
// acquire tương ứng thành công. Nếu before() throw giữa chừng (vd tạo database test lỗi trước
// khi kịp require('../db')), after() vẫn chạy (hành vi thật của node:test) nhưng stack lúc đó
// chỉ chứa những gì đã thật sự acquire — không có nhánh nào "tiện thể" require lại server/db.js
// với MYSQL_DATABASE mặc định chỉ để có cái gọi closeDb().
const resources = createResourceStack();

before(async () => {
  if (isMysql) {
    resources.acquire(dbHarness.setupTestDataDir().teardown);
    const dbName = await dbHarness.createMysqlTestDb();
    resources.acquire(() => dbHarness.dropMysqlTestDb(dbName));
  } else {
    const { teardown } = dbHarness.setupSqliteDb();
    resources.acquire(teardown);
  }

  // Chỉ require app/db SAU KHI database tạm đã sẵn sàng (xem ràng buộc ở db-harness.js). Lấy
  // closeDb() NGAY tại đây (không require lại trong after()) và chỉ push cleanup nếu require
  // thành công.
  const { closeDb } = require('../db');
  resources.acquire(closeDb);

  const { createApp } = require('../app');
  const fixtures = require('../test-support/fixtures');

  const started = await startTestApp(createApp());
  baseUrl = started.baseUrl;
  resources.acquire(started.close);

  fixtureUser = fixtures.createPrivilegedUser({ username: `smoke_admin_${Date.now()}` });
});

after(async () => {
  // Thứ tự dọn dẹp = ngược thứ tự acquire (LIFO): đóng HTTP server trước -> đóng connection/
  // worker DB (A1, bắt buộc trước khi drop schema) -> drop schema tạm / xoá thư mục sqlite tạm.
  // Mỗi bước chạy độc lập (N2): 1 bước lỗi không được cản các bước sau.
  await resources.cleanupAll();
});

test('login + GET /api/me trả đúng session user', async () => {
  const fixtures = require('../test-support/fixtures');
  const { cookie } = await fixtures.login(baseUrl, {
    username: fixtureUser.username,
    password: fixtureUser.password,
  });

  const res = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user.username, fixtureUser.username);
  assert.equal(body.user.role, 'super_admin');
  assert.ok(body.permissions, 'phải có object permissions');
});

test('GET /api/me không có cookie trả 401', async () => {
  const res = await fetch(`${baseUrl}/api/me`);
  assert.equal(res.status, 401);
});
