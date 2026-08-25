'use strict';
// Failure-path tests cho pattern resource-stack dùng trong smoke.test.js (Codex re-audit round 2,
// R2-01): "after() không được tự require() DB mới; phải có failure test cho create/grant failure
// trước require, DB init failure sau worker spawn, và HTTP listen/start failure sau khi DB đã
// load — tất cả phải chứng minh không chạm DB mặc định và không sót schema/worker."
//
// Round 3 re-audit (R3-01) chỉ ra 2 test cũ ở đây có failure semantics khác thật: "listen/start
// failure" chỉ throw giả (không đụng DB/app/listen() thật) và "DB init failure" chạy như script
// thường (uncaught exception crash) chứ không phải before() hook thật của node:test, nơi test
// runner bắt exception và tiếp tục — đúng nơi mới lộ ra process treo thật. Giữ 2 test cũ làm bằng
// chứng bổ sung, thêm test mới dùng đúng `node --test` thật làm bằng chứng chính cho R3-01.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const { createResourceStack } = require('../test-support/resource-stack');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';

test('resource-stack: cleanupAll() chạy đúng thứ tự LIFO và gộp lỗi thành AggregateError', async () => {
  const order = [];
  const stack = createResourceStack();
  stack.acquire(async () => { order.push('first-acquired-cleaned-last'); });
  stack.acquire(async () => { order.push('second'); throw new Error('lỗi bước 2'); });
  stack.acquire(async () => { order.push('third-acquired-cleaned-first'); });

  await assert.rejects(() => stack.cleanupAll(), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors.length, 1);
    assert.equal(error.errors[0].message, 'lỗi bước 2');
    return true;
  });

  assert.deepEqual(order, ['third-acquired-cleaned-first', 'second', 'first-acquired-cleaned-last']);
});

test('resource-stack: stack rỗng (chưa acquire gì) thì cleanupAll() không làm gì, không lỗi', async () => {
  const stack = createResourceStack();
  assert.equal(stack.size, 0);
  await stack.cleanupAll();
});

test(
  'create/grant failure trước khi require DB: không đổi MYSQL_DATABASE mặc định, resource-stack rỗng',
  { skip: !isMysql },
  async () => {
    const dbHarness = require('../test-support/db-harness');
    const stack = createResourceStack();
    const originalDatabaseEnv = process.env.MYSQL_DATABASE;
    // Khôi phục env đúng semantics (S2): nếu MYSQL_USER ban đầu chưa được set, phải delete key
    // chứ không gán lại chuỗi "undefined" — nếu không, test kế tiếp trong cùng process sẽ dùng
    // literal string 'undefined' làm tên user MySQL và tự làm GRANT lỗi không liên quan gì tới
    // kịch bản đang test.
    const hadUser = Object.prototype.hasOwnProperty.call(process.env, 'MYSQL_USER');
    const originalUser = process.env.MYSQL_USER;
    process.env.MYSQL_USER = 'codex_missing_test_user_xyz';
    try {
      await assert.rejects(async () => {
        const dbName = await dbHarness.createMysqlTestDb();
        stack.acquire(() => dbHarness.dropMysqlTestDb(dbName));
      });
    } finally {
      if (hadUser) process.env.MYSQL_USER = originalUser;
      else delete process.env.MYSQL_USER;
    }
    // Đúng như R2-01 yêu cầu: nếu bước tạo DB test thất bại, KHÔNG được có bất kỳ resource nào
    // được acquire (nên after()/cleanupAll() không có gì để dọn), và biến môi trường trỏ database
    // mặc định của app không bị đổi bởi lần thử thất bại này.
    assert.equal(stack.size, 0, 'không được acquire resource nào khi createMysqlTestDb() thất bại');
    assert.equal(process.env.MYSQL_DATABASE, originalDatabaseEnv, 'MYSQL_DATABASE không được bị đổi khi setup thất bại');
  }
);

test(
  'listen/start failure sau khi DB đã load: resource-stack vẫn drop đúng DB đã tạo trước đó',
  { skip: !isMysql },
  async () => {
    const dbHarness = require('../test-support/db-harness');
    const mysql = require('mysql2/promise');
    const stack = createResourceStack();

    const dbName = await dbHarness.createMysqlTestDb();
    stack.acquire(() => dbHarness.dropMysqlTestDb(dbName));

    // Mô phỏng bước acquire kế tiếp thất bại (vd HTTP server listen lỗi sau khi DB đã sẵn sàng) —
    // đúng thứ tự thật trong smoke.test.js: DB được acquire trước app/server.
    await assert.rejects(async () => {
      throw new Error('mô phỏng listen() thất bại sau khi DB đã load');
    });

    // Resource DB đã acquire ở bước trước đó vẫn còn trong stack (before() không revert lại), nên
    // after() thật (cleanupAll()) vẫn phải drop đúng DB này — không được sót lại vĩnh viễn chỉ vì
    // một bước acquire SAU đó thất bại.
    await stack.cleanupAll();

    const conn = await mysql.createConnection({
      host: process.env.TEST_MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.TEST_MYSQL_PORT || 3306),
      user: process.env.TEST_MYSQL_ADMIN_USER || 'root',
      password: process.env.TEST_MYSQL_ADMIN_PASSWORD || 'change-root-password',
    });
    try {
      const [rows] = await conn.query('SHOW DATABASES LIKE ?', [dbName]);
      assert.equal(rows.length, 0, `database "${dbName}" phải bị drop bởi cleanupAll(), nhưng vẫn còn tồn tại`);
    } finally {
      await conn.end();
    }
  }
);

test(
  'DB init failure sau khi worker đã spawn (script thường): require("../db") phải crash rõ ràng (exit khác 0), không âm thầm seed nhầm',
  { skip: !isMysql },
  () => {
    // Chạy trong process con riêng (không phải test process chính): server/db.js có side-effect
    // module-scope (spawn worker + init() + seed() ngay khi require), nếu chạy trong process test
    // hiện tại sẽ làm hỏng module cache/worker cho các test khác trong cùng file. Trỏ MYSQL_DATABASE
    // tới một schema CHƯA TỪNG được tạo (không qua createMysqlTestDb()) để buộc init() thất bại
    // đúng lúc worker đã tồn tại. LƯU Ý (Codex re-audit round 3, R3-01): test này dùng semantics
    // "uncaught exception làm process chết" của MỘT SCRIPT THƯỜNG — không đại diện cho hành vi
    // thật của một before() hook trong node:test (nơi test runner BẮT exception và tiếp tục chạy,
    // không tự crash process). Giữ lại làm bằng chứng bổ sung; bằng chứng CHÍNH cho R3-01 là test
    // kế tiếp dưới đây, dùng đúng `node --test` thật.
    const fixture = path.join(__dirname, '..', 'test-support', 'require-db-fixture.js');
    const result = spawnSync(process.execPath, [fixture], {
      encoding: 'utf8',
      timeout: 15000,
      env: {
        ...process.env,
        DB_CLIENT: 'mysql',
        MYSQL_HOST: process.env.TEST_MYSQL_HOST || '127.0.0.1',
        MYSQL_PORT: process.env.TEST_MYSQL_PORT || '3306',
        MYSQL_USER: 'pr_media',
        MYSQL_PASSWORD: 'pr_media',
        MYSQL_DATABASE: `pr_media_test_never_created_${Date.now()}`,
      },
    });

    assert.equal(result.signal, null, 'process con không được bị kill do treo (timeout) — init failure phải crash nhanh, không hang');
    assert.notEqual(result.status, 0, 'require("../db") với database chưa tồn tại phải làm process thoát khác 0, không âm thầm PASS');
    assert.ok(!result.stdout.includes('DB_LOADED_OK'), 'không được in DB_LOADED_OK khi init() thất bại');
    assert.match(result.stderr, /Unknown database/i, 'lỗi phải nêu rõ nguyên nhân (database không tồn tại), không phải lỗi mơ hồ');
  }
);

test(
  'DB init failure NGAY TRONG before() thật của node:test không được làm test-runner treo (Codex re-audit round 3, R3-01)',
  { skip: !isMysql },
  () => {
    // Bằng chứng CHÍNH cho R3-01: Codex tái hiện đúng kịch bản before(() => require('../db'))
    // trong MỘT file node:test thật, trỏ MYSQL_DATABASE tới schema chưa tồn tại, và phải SIGKILL
    // process sau 6 giây vì trước round 4, init() throw mà không đóng worker khiến after() chạy
    // xong nhưng process không tự thoát. Test này spawn `node --test <fixture thật>` — không phải
    // script thường — để tái hiện đúng semantics đó và chứng minh fix ở server/db.js (đóng worker
    // trong catch trước khi rethrow lỗi init/seed) khiến process tự thoát nhanh, không cần kill.
    const fixture = path.join(__dirname, '..', 'test-support', 'db-init-hang-fixture.js');
    // Bản thân test này ĐANG chạy bên trong một `node --test` khác (npm run test:integration:*) —
    // Node tự set NODE_TEST_CONTEXT/NODE_TEST_WORKER_ID trong process.env của process hiện tại.
    // Nếu vô tình kế thừa 2 biến này vào env của node --test con (`...process.env`), con sẽ tưởng
    // nó đang chạy đệ quy bên trong 1 test file và tự SKIP toàn bộ (in cảnh báo "run() is being
    // called recursively", không chạy fixture nào, exit code 0) — làm test này tưởng nhầm là xanh
    // trong khi chẳng chứng minh được gì. Phải loại bỏ 2 biến này trước khi spawn con.
    const childEnv = { ...process.env };
    delete childEnv.NODE_TEST_CONTEXT;
    delete childEnv.NODE_TEST_WORKER_ID;
    const startedAtMs = Date.now();
    const result = spawnSync(process.execPath, ['--test', fixture], {
      encoding: 'utf8',
      timeout: 6000, // đúng ngưỡng Codex dùng để phải SIGKILL trên bản lỗi — với fix phải xong sớm hơn nhiều
      env: {
        ...childEnv,
        DB_CLIENT: 'mysql',
        MYSQL_HOST: process.env.TEST_MYSQL_HOST || '127.0.0.1',
        MYSQL_PORT: process.env.TEST_MYSQL_PORT || '3306',
        MYSQL_USER: 'pr_media',
        MYSQL_PASSWORD: 'pr_media',
        MYSQL_DATABASE: `pr_media_test_never_created_${Date.now()}`,
      },
    });
    const elapsedMs = Date.now() - startedAtMs;

    assert.equal(result.signal, null, `node --test không được bị kill (signal=${result.signal}) — DB-init lỗi trong before() phải tự khiến process thoát, không treo tới timeout`);
    assert.ok(elapsedMs < 4000, `node --test phải tự thoát nhanh (đo được ${elapsedMs}ms) — worker mồ côi không còn giữ event loop sống`);
    assert.notEqual(result.status, 0, 'test runner phải báo fail (exit khác 0) vì before() lỗi');
    assert.ok(result.stdout.includes('DB_INIT_HANG_FIXTURE_AFTER_RAN'), 'after() phải chạy đúng theo hành vi thật của node:test dù before() lỗi (đúng thứ tự thật Codex tái hiện)');
    assert.ok(!result.stdout.includes('DB_INIT_HANG_FIXTURE_TEST_RAN'), 'test bên trong không được chạy vì before() đã lỗi');
  }
);
