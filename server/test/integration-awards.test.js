'use strict';
// G1A.3 Batch "reports-awards" (3/3) — integration test HTTP cho nhóm "Giải thưởng" (R062-R071):
// CRUD giải thưởng, hồ sơ tham gia theo năm, upload tài liệu đính kèm, tạo nhắc hạn nộp hồ sơ.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

let baseUrl;
let cookie;
let viewerCookie; // D13 target role
let executorCookie; // D13 target role
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
  const admin = fixtures.createPrivilegedUser({ username: `awards_admin_${Date.now()}` });
  cookie = (await fixtures.login(baseUrl, { username: admin.username, password: admin.password })).cookie;
  const viewer = fixtures.createUser('viewer', { username: `awards_viewer_${Date.now()}` });
  viewerCookie = (await fixtures.login(baseUrl, { username: viewer.username, password: viewer.password })).cookie;
  const executor = fixtures.createUser('executor', { username: `awards_executor_${Date.now()}` });
  executorCookie = (await fixtures.login(baseUrl, { username: executor.username, password: executor.password })).cookie;
});

after(async () => {
  await resources.cleanupAll();
});

async function call(method, path, { body, auth = true, as = cookie, headers } = {}) {
  const opts = { method, headers: { ...(auth ? { cookie: as } : {}), ...(headers || {}) } };
  if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  return fetch(`${baseUrl}${path}`, opts);
}
async function uploadFiles(path, files, { as = cookie, auth = true } = {}) {
  const form = new FormData();
  for (const f of files) form.append('files', new Blob([f.content || 'x'], { type: f.type || 'application/pdf' }), f.name);
  const headers = auth ? { cookie: as } : {};
  return fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: form });
}
async function createAward(overrides = {}) {
  const res = await call('POST', '/api/awards', { body: { name: `Giải Sao Khuê ${Date.now()}_${Math.random()}`, organizer_type: 'gov', submission_deadline: '2026-12-01', cost: 5000000, ...overrides } });
  assert.equal(res.status, 200);
  return (await res.json()).id;
}

// ---------------------------------------------------------------------------
// R062 — GET /api/awards
// ---------------------------------------------------------------------------
test('R062 happy: tìm theo tên/organizer, lọc type/status/scope, phân trang', async () => {
  const name = `Giải Test Tìm ${Date.now()}`;
  const id = await createAward({ name });
  const res = await call('GET', `/api/awards?search=${encodeURIComponent(name)}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.rows.some((r) => r.id === id));
  assert.equal(typeof body.total, 'number');
});
test('R062 happy CHARACTERIZATION: type lạ (ngoài gov/association/other) bị bỏ qua filter, không lỗi', async () => {
  const res = await call('GET', '/api/awards?type=khong-hop-le');
  assert.equal(res.status, 200);
});
test('R062 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/awards', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R063 — GET /api/awards/:id
// ---------------------------------------------------------------------------
test('R063 happy: trả record + participations + attachments + caretakers', async () => {
  const id = await createAward();
  const res = await call('GET', `/api/awards/${id}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.record.id, id);
  assert.ok(Array.isArray(body.participations));
  assert.ok(Array.isArray(body.attachments));
});
test('R063 not-found: id không tồn tại trả 404', async () => {
  const res = await call('GET', '/api/awards/9999999');
  assert.equal(res.status, 404);
});
test('R063 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('GET', '/api/awards/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R064 — POST /api/awards
// ---------------------------------------------------------------------------
test('R064 happy: tạo giải thưởng hợp lệ trả 200 + id', async () => {
  const id = await createAward({ name: 'Giải Sao Khuê 2026' });
  const res = await call('GET', `/api/awards/${id}`);
  assert.equal((await res.json()).record.name, 'Giải Sao Khuê 2026');
});
test('R064 invalid: thiếu name (NOT NULL) trả 400', async () => {
  const res = await call('POST', '/api/awards', { body: { organizer_type: 'gov' } });
  assert.equal(res.status, 400);
});
test('R064 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/awards', { auth: false, body: { name: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R065 — PUT /api/awards/:id
// ---------------------------------------------------------------------------
test('R065 happy: cập nhật giải thưởng trả 200 và thay đổi được ghi nhận', async () => {
  const id = await createAward();
  const res = await call('PUT', `/api/awards/${id}`, { body: { name: 'Đã sửa tên giải', cost: 999 } });
  assert.equal(res.status, 200);
  const rec = (await (await call('GET', `/api/awards/${id}`)).json()).record;
  assert.equal(rec.name, 'Đã sửa tên giải');
});
test('R065 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (UPDATE 0 dòng không lỗi)', async () => {
  const res = await call('PUT', '/api/awards/9999999', { body: { name: 'x' } });
  assert.equal(res.status, 200);
});
test('R065 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/awards/1', { auth: false, body: { name: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R066 — DELETE /api/awards/:id (xoá file vật lý attachments trước khi xoá record)
// ---------------------------------------------------------------------------
test('R066 happy: xoá giải thưởng kèm attachments trả 200, không còn truy vấn được', async () => {
  const id = await createAward();
  await uploadFiles(`/api/awards/${id}/files`, [{ name: 'ho-so.pdf' }]);
  const res = await call('DELETE', `/api/awards/${id}`);
  assert.equal(res.status, 200);
  assert.equal((await call('GET', `/api/awards/${id}`)).status, 404);
});
test('R066 not-found CHARACTERIZATION: id không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/awards/9999999');
  assert.equal(res.status, 200);
});
test('R066 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/awards/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R067 — POST /api/awards/:id/participations
// ---------------------------------------------------------------------------
test('R067 happy: tạo hồ sơ tham gia theo năm trả 200 + id', async () => {
  const id = await createAward();
  const res = await call('POST', `/api/awards/${id}/participations`, { body: { year: 2026, status: 'Đang cân nhắc', budget: 1000000 } });
  assert.equal(res.status, 200);
  const parts = (await (await call('GET', `/api/awards/${id}`)).json()).participations;
  assert.equal(parts.length, 1);
});
test('R067 not-found: award_id không tồn tại bị FK chặn, trả 400 (F15 đã sửa — MySQL nay có FOREIGN KEY thật, đồng nhất SQLite)', async () => {
  const res = await call('POST', '/api/awards/9999999/participations', { body: { year: 2026 } });
  assert.equal(res.status, 400);
});
test('R067 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/awards/1/participations', { auth: false, body: { year: 2026 } })).status, 401);
});

// ---------------------------------------------------------------------------
// R068 — PUT /api/awards/:id/participations/:pid
// ---------------------------------------------------------------------------
test('R068 happy: cập nhật hồ sơ tham gia trả 200 và thay đổi được ghi nhận', async () => {
  const id = await createAward();
  const pid = (await (await call('POST', `/api/awards/${id}/participations`, { body: { year: 2026 } })).json()).id;
  const res = await call('PUT', `/api/awards/${id}/participations/${pid}`, { body: { status: 'Đã nộp' } });
  assert.equal(res.status, 200);
  const parts = (await (await call('GET', `/api/awards/${id}`)).json()).participations;
  assert.equal(parts.find((p) => p.id === pid).status, 'Đã nộp');
});
test('R068 not-found CHARACTERIZATION: pid không tồn tại vẫn trả 200 {ok:true} (UPDATE 0 dòng không lỗi)', async () => {
  const res = await call('PUT', '/api/awards/1/participations/9999999', { body: { status: 'x' } });
  assert.equal(res.status, 200);
});
test('R068 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('PUT', '/api/awards/1/participations/1', { auth: false, body: { status: 'x' } })).status, 401);
});

// ---------------------------------------------------------------------------
// R069 — DELETE /api/awards/:id/participations/:pid
// ---------------------------------------------------------------------------
test('R069 happy: xoá hồ sơ tham gia trả 200, không còn trong danh sách', async () => {
  const id = await createAward();
  const pid = (await (await call('POST', `/api/awards/${id}/participations`, { body: { year: 2026 } })).json()).id;
  const res = await call('DELETE', `/api/awards/${id}/participations/${pid}`);
  assert.equal(res.status, 200);
  const parts = (await (await call('GET', `/api/awards/${id}`)).json()).participations;
  assert.ok(!parts.some((p) => p.id === pid));
});
test('R069 not-found CHARACTERIZATION: pid không tồn tại vẫn trả 200 {ok:true} (DELETE 0 dòng không lỗi)', async () => {
  const res = await call('DELETE', '/api/awards/1/participations/9999999');
  assert.equal(res.status, 200);
});
test('R069 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('DELETE', '/api/awards/1/participations/1', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R070 — POST /api/awards/:id/files (upload ≤8 file, kind=award_doc, không kiểm loại nội dung)
// ---------------------------------------------------------------------------
test('R070 happy: upload 1 tài liệu đính kèm trả 200', async () => {
  const id = await createAward();
  const res = await uploadFiles(`/api/awards/${id}/files`, [{ name: 'ho-so.pdf' }]);
  assert.equal(res.status, 200);
  const atts = (await (await call('GET', `/api/awards/${id}`)).json()).attachments;
  assert.equal(atts.length, 1);
  assert.equal(atts[0].kind, 'award_doc');
});
test('R070 happy: upload nhiều file cùng lúc (tối đa 8) đều được lưu', async () => {
  const id = await createAward();
  const res = await uploadFiles(`/api/awards/${id}/files`, [{ name: 'a.pdf' }, { name: 'b.pdf' }, { name: 'c.pdf' }]);
  assert.equal(res.status, 200);
  const atts = (await (await call('GET', `/api/awards/${id}`)).json()).attachments;
  assert.equal(atts.length, 3);
});
test('R070 invalid: không gửi file nào trả 400', async () => {
  const id = await createAward();
  const res = await uploadFiles(`/api/awards/${id}/files`, []);
  assert.equal(res.status, 400);
});
test('R070 happy CHARACTERIZATION: award_id không tồn tại vẫn 200 (route không kiểm tồn tại trước khi insert attachment, giống R034 với people)', async () => {
  const res = await uploadFiles('/api/awards/9999999/files', [{ name: 'x.pdf' }]);
  assert.equal(res.status, 200);
});
test('R070 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await uploadFiles('/api/awards/1/files', [{ name: 'x.pdf' }], { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// R071 — POST /api/awards/:id/remind (side-effect: tạo important_dates)
// ---------------------------------------------------------------------------
test('R071 happy: tạo nhắc hạn nộp hồ sơ trả 200 + id', async () => {
  const id = await createAward({ submission_deadline: '2026-12-15' });
  const res = await call('POST', `/api/awards/${id}/remind`, { body: { lead_days: 10 } });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).id);
});
test('R071 invalid: giải thưởng chưa có submission_deadline trả 400', async () => {
  const id = await createAward({ submission_deadline: null });
  const res = await call('POST', `/api/awards/${id}/remind`);
  assert.equal(res.status, 400);
});
test('R071 not-found: award_id không tồn tại trả 404', async () => {
  const res = await call('POST', '/api/awards/9999999/remind');
  assert.equal(res.status, 404);
});
test('R071 unauthenticated: không cookie trả 401', async () => {
  assert.equal((await call('POST', '/api/awards/1/remind', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// D13-052..058 — batch RBAC-EXP-B4 (2/6 entity Direct — award/award_participation): award.cost là
// Confidential — che theo owner-bypass; executor chỉ sửa được award/participation CHÍNH mình sở
// hữu, không bao giờ xoá được (memory-bank/18-g1b-rbac-batch-contract.md#batch-rbac-exp-b4)
// ---------------------------------------------------------------------------
test('D13-052: viewer tạo award trả 403', async () => {
  const res = await call('POST', '/api/awards', { body: { name: 'x' }, as: viewerCookie });
  assert.equal(res.status, 403);
});
test('D13-053: executor tạo award trả 200, owner_id = chính executor đó; thấy cost trên award mình tạo, không thấy cost award người khác', async () => {
  const { db } = require('../db');
  const myId = (await (await call('POST', '/api/awards', { body: { name: 'Của executor', cost: 111 }, as: executorCookie })).json()).id;
  const row = db.prepare('SELECT owner_id, created_by FROM awards WHERE id=?').get(myId);
  const me = db.prepare("SELECT id FROM users WHERE username LIKE 'awards_executor_%' ORDER BY id DESC LIMIT 1").get();
  assert.equal(row.owner_id, me.id);
  assert.equal(row.created_by, me.id);
  const othersId = await createAward({ name: 'Của người khác', cost: 222 });
  const mine = await (await call('GET', `/api/awards/${myId}`, { as: executorCookie })).json();
  assert.equal('cost' in mine.record, true);
  const theirs = await (await call('GET', `/api/awards/${othersId}`, { as: executorCookie })).json();
  assert.equal('cost' in theirs.record, false);
});
test('D13-054: executor PUT award của người khác trả 403; PUT award mình sở hữu trả 200', async () => {
  const myId = (await (await call('POST', '/api/awards', { body: { name: 'Trước sửa' }, as: executorCookie })).json()).id;
  const putOwn = await call('PUT', `/api/awards/${myId}`, { body: { name: 'Executor tự sửa' }, as: executorCookie });
  assert.equal(putOwn.status, 200);
  const othersId = await createAward({ name: 'Của người khác 2' });
  assert.equal((await call('PUT', `/api/awards/${othersId}`, { body: { name: 'x' }, as: executorCookie })).status, 403);
});
test('D13-055: executor DELETE award (kể cả của chính mình) luôn 403', async () => {
  const myId = (await (await call('POST', '/api/awards', { body: { name: 'Của executor để xoá' }, as: executorCookie })).json()).id;
  assert.equal((await call('DELETE', `/api/awards/${myId}`, { as: executorCookie })).status, 403);
});
test('D13-056: viewer PUT/DELETE award đều 403', async () => {
  const id = await createAward();
  assert.equal((await call('PUT', `/api/awards/${id}`, { body: { name: 'x' }, as: viewerCookie })).status, 403);
  assert.equal((await call('DELETE', `/api/awards/${id}`, { as: viewerCookie })).status, 403);
});
test('D13-057: award_participation là entity Direct riêng — executor tạo participation trả 200, owner_id = chính executor; viewer tạo trả 403', async () => {
  const id = await createAward();
  const resViewer = await call('POST', `/api/awards/${id}/participations`, { body: { year: 2026 }, as: viewerCookie });
  assert.equal(resViewer.status, 403);
  const pid = (await (await call('POST', `/api/awards/${id}/participations`, { body: { year: 2027 }, as: executorCookie })).json()).id;
  const { db } = require('../db');
  const row = db.prepare('SELECT owner_id, created_by FROM award_participations WHERE id=?').get(pid);
  const me = db.prepare("SELECT id FROM users WHERE username LIKE 'awards_executor_%' ORDER BY id DESC LIMIT 1").get();
  assert.equal(row.owner_id, me.id);
  assert.equal(row.created_by, me.id);
});
test('D13-058: executor DELETE award_participation (kể cả của chính mình) luôn 403; admin xoá 200', async () => {
  const id = await createAward();
  const pid = (await (await call('POST', `/api/awards/${id}/participations`, { body: { year: 2028 }, as: executorCookie })).json()).id;
  assert.equal((await call('DELETE', `/api/awards/${id}/participations/${pid}`, { as: executorCookie })).status, 403);
  assert.equal((await call('DELETE', `/api/awards/${id}/participations/${pid}`)).status, 200);
});

// ---------------------------------------------------------------------------
// D13-078..079 — remediation P0 audit F19: GET /api/files/:id trước đây phục vụ file private của
// MỌI owner_type khác 'person' (award/supplier/event/agreement/work_log) mà không gate gì — Viewer
// tải được tài liệu private của award người khác. Nay award (entity Direct) theo đúng luật
// owner-bypass giống canReadField; owner_type lạ fail-closed 403 cho MỌI role.
// ---------------------------------------------------------------------------
test('D13-078: award là entity Direct — file private của award chỉ owner (executor tạo ra nó) hoặc Admin/Super Admin tải được; viewer và executor không sở hữu luôn 403', async () => {
  const myId = (await (await call('POST', '/api/awards', { body: { name: 'Award của executor (file mật)' }, as: executorCookie })).json()).id;
  assert.equal((await uploadFiles(`/api/awards/${myId}/files`, [{ name: 'ho-so-mat.pdf' }], { as: executorCookie })).status, 200);
  const myFileId = (await (await call('GET', `/api/awards/${myId}`, { as: executorCookie })).json()).attachments[0].id;
  assert.equal((await call('GET', `/api/files/${myFileId}`, { as: viewerCookie })).status, 403);
  assert.equal((await call('GET', `/api/files/${myFileId}`, { as: executorCookie })).status, 200);
  assert.equal((await call('GET', `/api/files/${myFileId}`)).status, 200); // cookie mặc định = super_admin

  const othersId = await createAward({ name: 'Award của người khác (file mật)' });
  assert.equal((await uploadFiles(`/api/awards/${othersId}/files`, [{ name: 'khac.pdf' }])).status, 200);
  const othersFileId = (await (await call('GET', `/api/awards/${othersId}`)).json()).attachments[0].id;
  assert.equal((await call('GET', `/api/files/${othersFileId}`, { as: executorCookie })).status, 403);
});
test('D13-079: attachment có owner_type lạ (không khai trong ATTACHMENT_OWNER_ENTITY) fail-closed 403 cho MỌI role kể cả Admin/Super Admin', async () => {
  const { db } = require('../db');
  const fileId = db.prepare(`INSERT INTO attachments (owner_type, owner_id, kind, filename, original_name, mime, is_primary)
    VALUES ('khong_ton_tai', 1, 'file', 'x.pdf', 'x.pdf', 'application/pdf', 0)`).run().lastInsertRowid;
  assert.equal((await call('GET', `/api/files/${fileId}`, { as: viewerCookie })).status, 403);
  assert.equal((await call('GET', `/api/files/${fileId}`, { as: executorCookie })).status, 403);
  assert.equal((await call('GET', `/api/files/${fileId}`)).status, 403);
});
// D13-089 — batch W1.FILE P2: upload (khác D13-078 là download) nay cũng gate theo owner_id —
// trước đây bất kỳ executor nào cũng upload được vào award người khác tạo (chỉ gate thô theo role).
test('D13-089: executor upload file vào award KHÔNG phải của mình trả 403 (trước đây 200, P2 đã sửa)', async () => {
  const othersId = await createAward({ name: 'Award của admin (P2)' });
  assert.equal((await uploadFiles(`/api/awards/${othersId}/files`, [{ name: 'khac.pdf' }], { as: executorCookie })).status, 403);
});
