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
function getPerson(id) { return db.prepare('SELECT * FROM people WHERE id=?').get(id); }
function countInteractions() { return db.prepare('SELECT COUNT(*) c FROM interactions').get().c; }

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
  const { res, body } = await confirm(execBCookie, { proposalId: p.proposalId });
  assert.equal(res.status, 403);
  assert.equal(body.code, 'FORBIDDEN_MODULE');
});

test('confirm: proposal het han bi tu choi 410', async () => {
  const { body: p } = await propose(execACookie, { transcript: 't', summary: 's', person_name: '', org_name: '' });
  db.prepare("UPDATE voice_proposals SET expires_at='2020-01-01 00:00:00' WHERE id=?").run(p.proposalId);
  const { res, body } = await confirm(execACookie, { proposalId: p.proposalId });
  assert.equal(res.status, 410);
  assert.equal(body.code, 'PROPOSAL_EXPIRED');
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

test('confirm: relationship_score bi doi song song (lost-update) -> van tao interaction, CHI phan diem bi tu choi', async () => {
  const pid = insertPerson(`Lost Update ${Date.now()}`, 50);
  const before_ = countInteractions();
  const { body: p } = await propose(execACookie, {
    transcript: 't', summary: 's', person_name: getPerson(pid).full_name, org_name: '', suggested_score_delta: 5,
  });
  // Giả lập ghi song song ngoài luồng proposal này (vd PUT /people/:id thủ công) xảy ra GIỮA lúc
  // chuẩn bị và lúc xác nhận.
  db.prepare('UPDATE people SET relationship_score=? WHERE id=?').run(70, pid);
  const { res, body } = await confirm(execACookie, { proposalId: p.proposalId });
  assert.equal(res.status, 200);
  assert.ok(body.interactionId);
  assert.equal(countInteractions(), before_ + 1);
  assert.equal(body.person.scoreApplied, false);
  assert.equal(body.person.reason, 'STALE_SCORE_SNAPSHOT');
  assert.equal(getPerson(pid).relationship_score, 70); // giữ nguyên giá trị ghi song song, KHÔNG bị đè bởi delta cũ
});

test('confirm: khong co suggested_score_delta -> chi tao interaction, khong dung toi people', async () => {
  const pid = insertPerson(`No Delta ${Date.now()}`, 50);
  const { body: p } = await propose(execACookie, { transcript: 't', summary: 's', person_name: getPerson(pid).full_name, org_name: '' });
  const { res, body } = await confirm(execACookie, { proposalId: p.proposalId });
  assert.equal(res.status, 200);
  assert.equal(body.person, null);
  assert.equal(getPerson(pid).relationship_score, 50);
});

test('confirm: quyen bi rut giua propose va confirm (downgrade role -> viewer, refresh session qua /me) -> 403', async () => {
  const { body: p } = await propose(execACookie, { transcript: 't', summary: 's', person_name: '', org_name: '' });
  db.prepare('UPDATE users SET role=? WHERE username=?').run('viewer', execAUsername);
  await realFetch(`${baseUrl}/api/me`, { headers: { cookie: execACookie } }); // refresh req.session.user.role tu DB
  const { res, body } = await confirm(execACookie, { proposalId: p.proposalId });
  assert.equal(res.status, 403);
  assert.equal(body.code, 'FORBIDDEN_MODULE');
  db.prepare('UPDATE users SET role=? WHERE username=?').run('executor', execAUsername); // trả lại cho test sau
  await realFetch(`${baseUrl}/api/me`, { headers: { cookie: execACookie } });
});
