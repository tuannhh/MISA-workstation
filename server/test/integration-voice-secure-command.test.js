'use strict';
// W3.VOICE.SECURE-COMMAND + W3.VOICE.1 (D14.4, batch 23) — luồng AI "chuẩn bị hành động, người
// dùng xác nhận 1 lần": POST /ai/interaction-voice-propose (Gemini thật -> mock) rồi
// POST /ai/interaction-voice-confirm (thuần DB, không gọi Gemini). Không đụng route
// /interaction-voice cũ (test riêng ở integration-ai-golden.test.js AI-E001).
//
// Cách ly mạng theo đúng quy ước golden set: set GEMINI_API_KEY TRƯỚC mọi require (config.js đọc
// 1 lần lúc require), mock global.fetch bằng hàng đợi.
process.env.GEMINI_API_KEY = 'voice-secure-command-test-fake-key';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { createResourceStack } = require('../test-support/resource-stack');
const { startTestApp } = require('../test-support/app-harness');

const resources = createResourceStack();
let baseUrl, db, fixtures;
let adminCookie, execACookie, execBCookie, execAUsername;

function geminiJsonResponse(obj) {
  const text = JSON.stringify(obj);
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }), text: async () => text };
}

before(async () => {
  if (isMysql) {
    resources.acquire(dbHarness.setupTestDataDir().teardown);
    const dbName = await dbHarness.createMysqlTestDb();
    resources.acquire(() => dbHarness.dropMysqlTestDb(dbName));
  } else {
    const { teardown } = dbHarness.setupSqliteDb();
    resources.acquire(teardown);
  }
  const dbModule = require('../db');
  db = dbModule.db;
  resources.acquire(dbModule.closeDb);
  const { createApp } = require('../app');
  fixtures = require('../test-support/fixtures');
  const started = await startTestApp(createApp());
  baseUrl = started.baseUrl;
  resources.acquire(started.close);

  const admin = fixtures.createPrivilegedUser({ username: `voice_admin_${Date.now()}` });
  adminCookie = (await fixtures.login(baseUrl, { username: admin.username, password: admin.password })).cookie;
  const execA = fixtures.createUser('executor', { username: `voice_execA_${Date.now()}` });
  execAUsername = execA.username;
  execACookie = (await fixtures.login(baseUrl, { username: execA.username, password: execA.password })).cookie;
  const execB = fixtures.createUser('executor', { username: `voice_execB_${Date.now()}` });
  execBCookie = (await fixtures.login(baseUrl, { username: execB.username, password: execB.password })).cookie;
});

after(async () => {
  await resources.cleanupAll();
});

function insertPerson(fullName, relationshipScore) {
  const r = db.prepare('INSERT INTO people (full_name, relationship_score) VALUES (?,?)').run(fullName, relationshipScore);
  return Number(r.lastInsertRowid);
}
function insertOrg(name, orgType) {
  const r = db.prepare('INSERT INTO organizations (name, org_type) VALUES (?,?)').run(name, orgType || 'other');
  return Number(r.lastInsertRowid);
}
function getPerson(id) { return db.prepare('SELECT * FROM people WHERE id=?').get(id); }
function getOrg(id) { return db.prepare('SELECT * FROM organizations WHERE id=?').get(id); }
function countInteractions() { return db.prepare('SELECT COUNT(*) c FROM interactions').get().c; }
function getProposal(id) { return db.prepare('SELECT * FROM voice_proposals WHERE id=?').get(id); }

// Remediation F25 (Codex audit 2026-08-31): chan tam thoi insert co partner_name='FORCE_FAIL_MARKER'
// -- mo phong dung phong cach thi nghiem Codex da dung de bat loi "confirm thanh cong nua chung"
// that trong route, khong phai mock JS (mock khong the xac nhan duoc hanh vi transaction/rollback
// that o tang DB). MySQL: CREATE TRIGGER can quyen SUPER khi bat binary log (khong co trong test
// user) -- dung CHECK constraint qua ALTER TABLE thay the (khong can quyen dac biet). SQLite: khong
// ho tro ALTER TABLE ADD CONSTRAINT tren bang co san -- dung TRIGGER (da xac nhan hoat dong).
const FORCE_FAIL_NAME = 'force_insert_fail_f25_test';
function forceInsertFailure() {
  if (isMysql) {
    db.exec(`ALTER TABLE interactions ADD CONSTRAINT ${FORCE_FAIL_NAME} CHECK (partner_name <> 'FORCE_FAIL_MARKER')`);
  } else {
    db.exec(`CREATE TRIGGER ${FORCE_FAIL_NAME} BEFORE INSERT ON interactions
WHEN NEW.partner_name = 'FORCE_FAIL_MARKER'
BEGIN
  SELECT RAISE(ABORT, 'forced failure for F25 regression test');
END`);
  }
}
function clearInsertFailure() {
  if (isMysql) {
    db.exec(`ALTER TABLE interactions DROP CHECK ${FORCE_FAIL_NAME}`);
  } else {
    db.exec(`DROP TRIGGER IF EXISTS ${FORCE_FAIL_NAME}`);
  }
}

// Giu lai fetch THAT truoc khi bat ky test nao thay global.fetch -- dung de goi vao chinh server
// test cuc bo (baseUrl), TACH BIET khoi global.fetch bi mock (danh cho Gemini). Giong quy uoc
// integration-ai-golden.test.js -- xem comment o dau file do.
const realFetch = global.fetch;
let fetchQueue;
let origFetch;
function useQueue(...responses) {
  fetchQueue = responses;
  origFetch = global.fetch;
  global.fetch = async (url) => {
    if (!fetchQueue.length) throw new Error(`VOICE TEST: fetch không mong đợi tới ${url}`);
    return fetchQueue.shift();
  };
}
function restoreFetch() { if (origFetch) { global.fetch = origFetch; origFetch = null; } }

async function propose(cookie, aiResponse) {
  useQueue(geminiJsonResponse(aiResponse));
  try {
    const fd = new FormData();
    fd.append('audio', new Blob(['fake-audio'], { type: 'audio/webm' }), 'rec.webm');
    const res = await realFetch(`${baseUrl}/api/ai/interaction-voice-propose`, { method: 'POST', headers: { cookie }, body: fd });
    return { res, body: await res.json() };
  } finally { restoreFetch(); }
}
async function confirm(cookie, payload) {
  const res = await realFetch(`${baseUrl}/api/ai/interaction-voice-confirm`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  return { res, body: await res.json() };
}

test('propose: khớp đúng 1 candidate -> confidence high, đề xuất điểm được kẹp biên', async () => {
  const pid = insertPerson(`Nguyễn Thị Voice ${Date.now()}`, 50);
  const person = getPerson(pid);
  const { res, body } = await propose(execACookie, {
    transcript: 't', summary: 's', channel: 'Điện thoại', result: 'Tích cực',
    person_name: person.full_name, org_name: '', suggested_score_delta: 999, // vượt biên, phải bị kẹp
  });
  assert.equal(res.status, 200);
  assert.equal(body.matchConfidence.person, 'high');
  assert.equal(body.personCandidates.length, 1);
  assert.equal(body.personCandidates[0].id, pid);
  assert.equal(body.suggestedScoreDelta, 10); // SCORE_DELTA_MAX
  assert.ok(body.proposalId);
});

test('propose: 2 nguoi cung khop ten -> confidence ambiguous, tra ve ca 2 (khong tu chon)', async () => {
  const suffix = Date.now();
  const p1 = insertPerson(`Ambig Test ${suffix} A`, 40);
  const p2 = insertPerson(`Ambig Test ${suffix} B`, 60);
  const { body } = await propose(execACookie, {
    transcript: 't', summary: 's', person_name: `Ambig Test ${suffix}`, org_name: '',
  });
  assert.equal(body.matchConfidence.person, 'ambiguous');
  const ids = body.personCandidates.map((c) => c.id).sort();
  assert.deepEqual(ids, [p1, p2].sort());
});

test('propose->confirm happy path: tao interaction + doi relationship_score dung mot lan', async () => {
  const pid = insertPerson(`Happy Path ${Date.now()}`, 50);
  const before_ = countInteractions();
  const { body: p } = await propose(execACookie, {
    transcript: 'Gặp chị ấy rất vui vẻ', summary: 'Gặp mặt trao đổi hợp tác', channel: 'Gặp mặt', result: 'Tích cực',
    person_name: getPerson(pid).full_name, org_name: '', suggested_score_delta: 5,
  });
  const { res, body } = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'k1' });
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.ok(body.interactionId);
  assert.equal(body.person.scoreApplied, true);
  assert.equal(body.person.relationship_score, 55);
  assert.equal(countInteractions(), before_ + 1);
  assert.equal(getPerson(pid).relationship_score, 55);
  const row = db.prepare('SELECT * FROM interactions WHERE id=?').get(body.interactionId);
  assert.equal(Number(row.partner_id), pid);
  assert.equal(row.partner_type, 'person');
});

test('confirm: nguoi khac (khong phai principal tao proposal) bi 403', async () => {
  const { body: p } = await propose(execACookie, { transcript: 't', summary: 's', person_name: '', org_name: '' });
  const { res, body } = await confirm(execBCookie, { proposalId: p.proposalId, idempotencyKey: 'k-403' });
  assert.equal(res.status, 403);
  assert.equal(body.code, 'FORBIDDEN_MODULE');
});

test('confirm: proposal het han bi tu choi 410, proposal khong bi khoa (van con pending trong DB)', async () => {
  const { body: p } = await propose(execACookie, { transcript: 't', summary: 's', person_name: '', org_name: '' });
  db.prepare("UPDATE voice_proposals SET expires_at='2020-01-01 00:00:00' WHERE id=?").run(p.proposalId);
  const { res, body } = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'k-410' });
  assert.equal(res.status, 410);
  assert.equal(body.code, 'PROPOSAL_EXPIRED');
  // Dieu kien TTL nam ngay trong cau UPDATE claim (khong chi kiem tra JS truoc do) -- xac nhan
  // claim that su khong "nuot" proposal dang pending du het han.
  assert.equal(getProposal(p.proposalId).status, 'pending');
});

test('confirm: thieu hoac rong idempotencyKey bi tu choi 400', async () => {
  const { body: p } = await propose(execACookie, { transcript: 't', summary: 's', person_name: '', org_name: '' });
  const missing = await confirm(execACookie, { proposalId: p.proposalId });
  assert.equal(missing.res.status, 400);
  assert.equal(missing.body.code, 'VALIDATION_FAILED');
  const empty = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: '   ' });
  assert.equal(empty.res.status, 400);
  assert.equal(empty.body.code, 'VALIDATION_FAILED');
  assert.equal(getProposal(p.proposalId).status, 'pending'); // khong bi claim boi request khong hop le
});

test('confirm: loi giua chung khi ghi interaction -> proposal ROLLBACK ve pending, retry sau khi het loi tao dung 1 interaction', async () => {
  const before_ = countInteractions();
  const { body: p } = await propose(execACookie, {
    transcript: 't', summary: 's', person_name: 'FORCE_FAIL_MARKER', org_name: '',
  });
  forceInsertFailure();
  let first;
  try {
    first = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'rollback-key' });
  } finally {
    clearInsertFailure();
  }
  assert.equal(first.res.status, 502); // loi that (INSERT bi trigger chan), khong phai thanh cong nua chung
  assert.equal(countInteractions(), before_); // KHONG co interaction mo coi nao duoc tao
  assert.equal(getProposal(p.proposalId).status, 'pending'); // ROLLBACK dung nghia -- van con dung lai duoc

  const retry = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'rollback-key' });
  assert.equal(retry.res.status, 200);
  assert.ok(retry.body.interactionId);
  assert.equal(countInteractions(), before_ + 1); // dung 1 interaction, khong tao trung
});

test('confirm 2 lan cung idempotencyKey: lan 2 tra ket qua cu, KHONG tao them interaction', async () => {
  const { body: p } = await propose(execACookie, { transcript: 't', summary: 's', person_name: '', org_name: '' });
  const before_ = countInteractions();
  const first = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'dup-key' });
  assert.equal(first.res.status, 200);
  const second = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'dup-key' });
  assert.equal(second.res.status, 200);
  assert.equal(second.body.idempotent, true);
  assert.equal(second.body.interactionId, first.body.interactionId);
  assert.equal(countInteractions(), before_ + 1);
});

test('confirm 2 lan KHONG cung idempotencyKey: lan 2 bi tu choi 409, khong tao them interaction', async () => {
  const { body: p } = await propose(execACookie, { transcript: 't', summary: 's', person_name: '', org_name: '' });
  const before_ = countInteractions();
  const first = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'key-A' });
  assert.equal(first.res.status, 200);
  const second = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'key-B' });
  assert.equal(second.res.status, 409);
  assert.equal(second.body.code, 'PROPOSAL_ALREADY_CONFIRMED');
  assert.equal(countInteractions(), before_ + 1);
});

test('confirm: relationship_score bi doi song song (stale) -> TU CHOI TOAN BO 409, KHONG tao interaction (D14.4, remediation F26)', async () => {
  const pid = insertPerson(`Stale Score ${Date.now()}`, 50);
  const before_ = countInteractions();
  const { body: p } = await propose(execACookie, {
    transcript: 't', summary: 's', person_name: getPerson(pid).full_name, org_name: '', suggested_score_delta: 5,
  });
  // Giả lập ghi song song ngoài luồng proposal này (vd PUT /people/:id thủ công) xảy ra GIỮA lúc
  // chuẩn bị và lúc xác nhận.
  db.prepare('UPDATE people SET relationship_score=? WHERE id=?').run(70, pid);
  const { res, body } = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'k-stale' });
  assert.equal(res.status, 409);
  assert.equal(body.code, 'PROPOSAL_STALE');
  assert.equal(countInteractions(), before_); // KHONG tao interaction mo coi khi chi ghi duoc mot nua
  assert.equal(getPerson(pid).relationship_score, 70); // giữ nguyên giá trị ghi song song, KHÔNG bị đè
  // F27: trang thai terminal 'stale' (KHONG con la 'pending') -- khong the "song lai" du du lieu vo
  // tinh quay ve dung snapshot cu; client phai tao proposal moi, khong retry proposal nay.
  assert.equal(getProposal(p.proposalId).status, 'stale');
  const retry = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'k-stale-retry' });
  assert.equal(retry.res.status, 409);
  assert.equal(retry.body.code, 'PROPOSAL_STALE');
});

test('confirm: person bi XOA giua propose va confirm (khong co score delta) -> 409 PROPOSAL_STALE, khong tao interaction (remediation F27)', async () => {
  const pid = insertPerson(`To Be Deleted ${Date.now()}`, 50);
  const before_ = countInteractions();
  const { body: p } = await propose(execACookie, { transcript: 't', summary: 's', person_name: getPerson(pid).full_name, org_name: '' });
  db.prepare('DELETE FROM people WHERE id=?').run(pid);
  const { res, body } = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'k-person-deleted' });
  assert.equal(res.status, 409);
  assert.equal(body.code, 'PROPOSAL_STALE');
  assert.equal(countInteractions(), before_); // KHONG duoc tao interaction tro toi person da mat
  assert.equal(getProposal(p.proposalId).status, 'stale');
});

test('confirm: organization bi XOA giua propose va confirm -> 409 PROPOSAL_STALE, khong tao interaction (remediation F27)', async () => {
  const oid = insertOrg(`To Be Deleted Org ${Date.now()}`, 'press');
  const before_ = countInteractions();
  const { body: p } = await propose(execACookie, { transcript: 't', summary: 's', person_name: '', org_name: getOrg(oid).name });
  db.prepare('DELETE FROM organizations WHERE id=?').run(oid);
  const { res, body } = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'k-org-deleted' });
  assert.equal(res.status, 409);
  assert.equal(body.code, 'PROPOSAL_STALE');
  assert.equal(countInteractions(), before_);
  assert.equal(getProposal(p.proposalId).status, 'stale');
});

test('confirm: person DOI TEN (khong phai diem) giua propose va confirm -> 409 PROPOSAL_STALE (remediation F27, "revision" that su la toan bo snapshot)', async () => {
  const pid = insertPerson(`Original Name ${Date.now()}`, 50);
  const before_ = countInteractions();
  const { body: p } = await propose(execACookie, { transcript: 't', summary: 's', person_name: getPerson(pid).full_name, org_name: '' });
  db.prepare('UPDATE people SET full_name=? WHERE id=?').run(`Changed Name ${Date.now()}`, pid);
  const { res, body } = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'k-person-renamed' });
  assert.equal(res.status, 409);
  assert.equal(body.code, 'PROPOSAL_STALE');
  assert.equal(countInteractions(), before_);
});

test('confirm: khong co suggested_score_delta -> chi tao interaction, khong dung toi people', async () => {
  const pid = insertPerson(`No Delta ${Date.now()}`, 50);
  const { body: p } = await propose(execACookie, { transcript: 't', summary: 's', person_name: getPerson(pid).full_name, org_name: '' });
  const { res, body } = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'k-nodelta' });
  assert.equal(res.status, 200);
  assert.equal(body.person, null);
  assert.equal(getPerson(pid).relationship_score, 50);
});

test('confirm: quyen bi rut giua propose va confirm (downgrade role -> viewer, refresh session qua /me) -> 403', async () => {
  const { body: p } = await propose(execACookie, { transcript: 't', summary: 's', person_name: '', org_name: '' });
  db.prepare('UPDATE users SET role=? WHERE username=?').run('viewer', execAUsername);
  await realFetch(`${baseUrl}/api/me`, { headers: { cookie: execACookie } }); // refresh req.session.user.role tu DB
  const { res, body } = await confirm(execACookie, { proposalId: p.proposalId, idempotencyKey: 'k-role' });
  assert.equal(res.status, 403);
  assert.equal(body.code, 'FORBIDDEN_MODULE');
  db.prepare('UPDATE users SET role=? WHERE username=?').run('executor', execAUsername); // trả lại cho test sau
  await realFetch(`${baseUrl}/api/me`, { headers: { cookie: execACookie } });
});

// F28 (Codex re-audit 2026-08-31, P1 release blocker): fetchPersonSnapshot/fetchOrgSnapshot
// (server/ai.js) doc plain SELECT trong transaction confirm -- trong 1 process (test suite nay,
// SQLite, hoac MySQL 1 instance) khong sao vi withTransaction dam bao khong co code handler nao
// khac chen vao giua CUNG process. Nhung tren MySQL nhieu instance (vd nhieu Cloud Run replica),
// moi instance la 1 process/connection RIENG -- plain SELECT khong giu lock nen instance khac
// van UPDATE/DELETE duoc parent giua luc doc va luc INSERT interaction. Fix: SELECT ... FOR UPDATE
// cho MySQL (server/ai.js fetchPersonSnapshot/fetchOrgSnapshot).
//
// Khong the dung ngay HTTP route /interaction-voice-confirm de "khoa truoc, request khac cho" y
// het nhu production: MySQLSyncDatabase (server/mysql-sync.js) chan CHINH main thread cua process
// test bang Atomics.wait dong bo cho toi khi query MySQL xong. Neu 1 connection khac (vd connA)
// giu lock TRUOC roi goi HTTP confirm() (chay tren CUNG process, cung main thread), main thread se
// dong bang trong luc cho MySQL cap lock -- nhung chinh main thread đó lai la noi duy nhat co the
// chay code JS de COMMIT/ROLLBACK connA (mysql2/promise cung can main thread event loop) => tu
// deadlock chinh test process, khong phai loi cua fix. Vi vay test nay xac minh dung co che ma fix
// dua vao (SELECT ... FOR UPDATE tren MySQL that su khoa row toi cap dong bo giua 2 connection doc
// lap) bang 2 connection mysql2/promise RIENG BIET khoi app -- dung dung cau SQL fix da them.
if (isMysql) {
  const mysql2 = require('mysql2/promise');
  function rawMysqlConnConfig() {
    const cfg = {
      user: process.env.MYSQL_USER || 'pr_media',
      password: process.env.MYSQL_PASSWORD || 'pr_media',
      database: process.env.MYSQL_DATABASE || 'pr_media',
      charset: 'utf8mb4',
    };
    cfg.host = process.env.MYSQL_HOST || '127.0.0.1';
    cfg.port = Number(process.env.MYSQL_PORT || 3306);
    return cfg;
  }
  function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
  // Race 1 promise voi timeout: neu promise chua settle sau `ms`, coi la "van dang bi chan"
  // (khong reject -- chi bao hieu bang sentinel rieng, promise goc van tiep tuc cho ket qua that).
  async function stillPendingAfter(promise, ms) {
    const PENDING = Symbol('pending');
    const winner = await Promise.race([promise, sleep(ms).then(() => PENDING)]);
    return winner === PENDING;
  }

  test('F28: MySQL nhieu instance -- connection khac bi CHAN UPDATE parent cho toi khi transaction giu FOR UPDATE COMMIT', { skip: !isMysql }, async () => {
    const pid = insertPerson(`F28 Lock Update ${Date.now()}`, 50);
    const connA = await mysql2.createConnection(rawMysqlConnConfig());
    try {
      await connA.query('START TRANSACTION');
      // Dung dung cau SQL fix da them (server/ai.js fetchPersonSnapshot) -- khoa row nay toi khi
      // connA COMMIT/ROLLBACK.
      await connA.query('SELECT relationship_score FROM people WHERE id=? FOR UPDATE', [pid]);

      const connB = await mysql2.createConnection(rawMysqlConnConfig());
      let blockedUpdateSettled = false;
      const blockedUpdate = connB.query('UPDATE people SET relationship_score=? WHERE id=?', [99, pid])
        .then((r) => { blockedUpdateSettled = true; return r; });

      const stillBlocked = await stillPendingAfter(blockedUpdate, 400);
      assert.equal(stillBlocked, true, 'connB.UPDATE phai con bi CHAN trong khi connA giu FOR UPDATE lock');
      assert.equal(blockedUpdateSettled, false);

      await connA.commit(); // giai phong lock -- dung luc nay connB.UPDATE moi duoc tiep tuc
      await blockedUpdate; // phai resolve (khong con bi chan) ngay sau khi connA COMMIT
      assert.equal(blockedUpdateSettled, true);
      assert.equal(getPerson(pid).relationship_score, 99);
      await connB.end();
    } finally {
      await connA.end();
    }
  });

  test('F28: MySQL nhieu instance -- connection khac bi CHAN DELETE parent cho toi khi transaction giu FOR UPDATE ROLLBACK', { skip: !isMysql }, async () => {
    const pid = insertPerson(`F28 Lock Delete ${Date.now()}`, 40);
    const connA = await mysql2.createConnection(rawMysqlConnConfig());
    try {
      await connA.query('START TRANSACTION');
      await connA.query('SELECT relationship_score FROM people WHERE id=? FOR UPDATE', [pid]);

      const connB = await mysql2.createConnection(rawMysqlConnConfig());
      let blockedDeleteSettled = false;
      const blockedDelete = connB.query('DELETE FROM people WHERE id=?', [pid])
        .then((r) => { blockedDeleteSettled = true; return r; });

      const stillBlocked = await stillPendingAfter(blockedDelete, 400);
      assert.equal(stillBlocked, true, 'connB.DELETE phai con bi CHAN trong khi connA giu FOR UPDATE lock');
      assert.equal(blockedDeleteSettled, false);

      await connA.rollback(); // giai phong lock qua ROLLBACK (khong phai chi COMMIT moi tha lock)
      await blockedDelete;
      assert.equal(blockedDeleteSettled, true);
      assert.equal(getPerson(pid), undefined); // connB.DELETE da chay xong sau khi lock duoc tha
      await connB.end();
    } finally {
      await connA.end();
    }
  });
}
