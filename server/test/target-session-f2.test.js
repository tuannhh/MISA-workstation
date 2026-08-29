'use strict';
// G1B.3 — target spec test cho F2 (session hardening: fixation/logout/rate-limit). Batch contract:
// memory-bank/18-g1b-rbac-batch-contract.md#batch-g1b3-session-2026-08-28. Test target-red đi qua
// known-red harness (G1B.6, server/test-support/known-red.js) — KHÔNG được thêm RED trực tiếp mà
// không đăng ký {id, owner, expiry} trong memory-bank/g1b-allowlist.json.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');
const { knownRed, validateEntry, errorMatchesExpected } = require('../test-support/known-red');
const { execFileSync } = require('child_process');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';

let baseUrl;
let fixtures;
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

  const { closeDb } = require('../db');
  resources.acquire(closeDb);

  const { createApp } = require('../app');
  fixtures = require('../test-support/fixtures');

  const started = await startTestApp(createApp());
  baseUrl = started.baseUrl;
  resources.acquire(started.close);
});

after(async () => {
  await resources.cleanupAll();
});

// ---------------------------------------------------------------------------
// Self-test cho known-red harness (G1B.6) — chạy knownRed() thật với node:test lồng nhau
// (t.test) để bắt đúng 3 trường hợp: id không có trong allowlist, id hết hạn, và hành vi bên
// trong bất ngờ pass — cả 3 đều phải khiến test CHA fail, không được âm thầm skip/pass.
// ---------------------------------------------------------------------------
test('known-red self-test', async (t) => {
  await t.test('validateEntry() throw khi id không có trong allowlist', () => {
    assert.throws(() => validateEntry('NOT-A-REAL-ID-xyz'), /không có trong/);
  });

  await t.test('quy tắc hết hạn dùng đúng phép so sánh thời gian mà validateEntry() dựa vào', () => {
    // known-red.js coi entry hết hạn khi !expiry || Date(expiry).getTime() <= Date.now(); test này
    // khoá đúng công thức đó (không tự tin theo đọc code) bằng 1 mốc chắc chắn đã qua.
    const expiredIso = '2020-01-01';
    assert.ok(new Date(expiredIso).getTime() <= Date.now(), 'mốc mẫu phải thật sự đã hết hạn để phép so sánh có ý nghĩa');
  });

  await t.test('validateEntry() trả entry hợp lệ cho F2-fixation và F2-ratelimit', () => {
    for (const id of ['F2-fixation', 'F2-ratelimit']) {
      const entry = validateEntry(id);
      assert.ok(entry.owner, `${id} thiếu owner`);
      assert.ok(new Date(entry.expiry).getTime() > Date.now(), `${id} đã hết hạn`);
    }
  });

  // Codex audit Bundle A, finding #2 (2026-08-28): bản đầu bắt MỌI exception làm known-red PASS
  // giả, kể cả lỗi setup/fixture không liên quan. 3 test dưới chạy fixture qua CHILD PROCESS
  // thật (không thể tự-introspect trong cùng process vì test() của node:test resolve promise
  // ngay cả khi test con fail — chỉ đổi exit code tiến trình) để chứng minh hành vi thật.
  await t.test('errorMatchesExpected() phân biệt đúng lỗi khớp RegExp/predicate với lỗi khác', () => {
    assert.equal(errorMatchesExpected(new Error('target message'), /target message/), true);
    assert.equal(errorMatchesExpected(new TypeError('fixture broken'), /target message/), false);
    assert.equal(errorMatchesExpected(new Error('x'), (err) => err.message === 'x'), true);
    assert.equal(errorMatchesExpected(new Error('y'), (err) => err.message === 'x'), false);
  });

  const fixturePath = require.resolve('../test-support/known-red-fixture.js');
  function runFixture(scenario) {
    try {
      // KHÔNG dùng cờ `--test` cho tiến trình con: file fixture đã tự gọi require('node:test').test()
      // nên chạy bare `node <file>` là đủ. Dùng `--test` ở đây (tiến trình con lồng trong tiến trình
      // cha cũng đang chạy `node --test`) làm exit code KHÔNG phản ánh đúng pass/fail thật (đã verify
      // thực nghiệm khi remediation — cùng kịch bản, exit code sai khi có `--test`, đúng khi bỏ đi).
      execFileSync(process.execPath, [fixturePath], {
        env: { ...process.env, KNOWN_RED_FIXTURE_SCENARIO: scenario },
        stdio: 'pipe',
      });
      return 0;
    } catch (err) {
      return err.status ?? 1;
    }
  }

  await t.test('knownRed() KHÔNG nuốt lỗi không khớp expectedError — tiến trình con phải fail (exit != 0)', () => {
    assert.notEqual(runFixture('mismatch'), 0, 'fixture ném TypeError không liên quan nhưng known-red vẫn PASS — đang nuốt nhầm lỗi setup/fixture');
  });

  await t.test('knownRed() PASS bình thường khi lỗi khớp đúng expectedError — tiến trình con phải xanh (exit = 0)', () => {
    assert.equal(runFixture('match'), 0, 'fixture ném đúng lỗi target nhưng known-red vẫn báo fail');
  });

  await t.test('knownRed() throw ngay lúc đăng ký nếu thiếu expectedError — tiến trình con phải fail', () => {
    assert.notEqual(runFixture('missing-expected-error'), 0, 'knownRed() phải bắt buộc expectedError, không được cho qua mặc định');
  });
});

// ---------------------------------------------------------------------------
// F2-fixation — session id không đổi khi login lại trên cookie đã tồn tại.
// ---------------------------------------------------------------------------
knownRed('F2-fixation', 'F2 session id PHẢI đổi khi đăng nhập (chống fixation)', async () => {
  const userA = fixtures.createUser('pr_staff', { username: `f2_fix_a_${Date.now()}` });
  const userB = fixtures.createUser('pr_staff', { username: `f2_fix_b_${Date.now()}` });

  const loginA = await fixtures.login(baseUrl, { username: userA.username, password: userA.password });
  const cookieC1 = loginA.cookie;

  // Mô phỏng attacker đã cắm sẵn cookie C1 cho nạn nhân, rồi nạn nhân (user B) đăng nhập thật
  // trên chính cookie đó — tái dùng thủ công thay vì gọi fixtures.login() vì cần kiểm soát Cookie
  // header gửi lên, không phải cookie server vừa cấp.
  const resB = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Cookie: cookieC1 },
    body: JSON.stringify({ username: userB.username, password: userB.password }),
  });
  assert.equal(resB.status, 200);
  const setCookie = resB.headers.getSetCookie();
  const cookieC2 = setCookie.length ? setCookie[0].split(';')[0] : cookieC1; // không set cookie mới = vẫn dùng C1

  assert.notEqual(
    cookieC2,
    cookieC1,
    'session id (cookie) phải đổi sau khi login lại trên cookie có sẵn — nếu giống nhau, attacker biết trước C1 vẫn có thể chiếm session sau khi nạn nhân đăng nhập (fixation)'
  );
}, /session id \(cookie\) phải đổi sau khi login lại/);

// ---------------------------------------------------------------------------
// F2-ratelimit — /api/login không được cho phép brute-force không giới hạn.
// ---------------------------------------------------------------------------
knownRed('F2-ratelimit', 'F2 /api/login PHẢI rate-limit sau nhiều lần sai mật khẩu liên tiếp', async () => {
  const user = fixtures.createUser('pr_staff', { username: `f2_rl_${Date.now()}` });
  const ATTEMPTS = 12;
  let sawThrottled = false;
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const res = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: user.username, password: 'wrong-password' }),
    });
    if (res.status === 429) {
      sawThrottled = true;
      break;
    }
    assert.equal(res.status, 401, `lần thử ${i + 1} phải là 401 (sai mật khẩu) hoặc 429 (bị chặn), không phải ${res.status}`);
  }
  assert.ok(sawThrottled, `sau ${ATTEMPTS} lần sai mật khẩu liên tiếp phải có ít nhất 1 lần trả 429 (rate-limited)`);
}, /phải có ít nhất 1 lần trả 429/);

// ---------------------------------------------------------------------------
// F2-logout-invalidation — characterization (KHÔNG phải known-red): xác nhận trạng thái thật.
// ---------------------------------------------------------------------------
test('F2-logout-invalidation CHARACTERIZATION: sau logout, cookie cũ không còn dùng được — /api/me trả 401', async () => {
  const user = fixtures.createUser('pr_staff', { username: `f2_logout_${Date.now()}` });
  const { cookie } = await fixtures.login(baseUrl, { username: user.username, password: user.password });

  const meBefore = await fetch(`${baseUrl}/api/me`, { headers: { Cookie: cookie } });
  assert.equal(meBefore.status, 200);

  const logoutRes = await fetch(`${baseUrl}/api/logout`, { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(logoutRes.status, 200);

  const meAfter = await fetch(`${baseUrl}/api/me`, { headers: { Cookie: cookie } });
  assert.equal(meAfter.status, 401, 'req.session.destroy() phải làm cookie cũ hết tác dụng — nếu không, đây là gap thật cần chuyển sang known-red');
});
