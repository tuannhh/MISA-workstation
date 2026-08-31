'use strict';
// F24 remediation (Codex audit trên bundle đóng W1, 2026-08-31): authorization phải chạy TRƯỚC
// Multer, không phải sau — Multer dùng disk storage (uploads.js) nên trước batch này đã ghi file
// thật vào UPLOAD_DIR ngay trong middleware, TRƯỚC khi handler kịp gọi assertWritable(). Deny sau
// khi đã upload vẫn tạo file mồ côi trên đĩa (không có row `attachments` quản lý) — vi phạm
// nguyên tắc "deny phải không có side-effect". `requireFileWrite(entity, table, moduleLabel)`
// (routes.js) nay chạy TRƯỚC `upload.array()` cho cả 4 route award/event/agreement/work_log.
//
// Test table-driven: mỗi route xác nhận CẢ 3 điều kiện cùng lúc khi executor upload vào bản ghi
// KHÔNG phải của mình — 403, KHÔNG tăng row `attachments`, KHÔNG ghi thêm file vật lý vào
// UPLOAD_DIR — cộng 1 case đối chứng (upload vào bản ghi CHÍNH mình → 200 + CẢ 2 số liệu ĐỀU tăng)
// để xác nhận phép đếm trước/sau thật sự nhạy với thay đổi, không phải assertion luôn pass.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { startTestApp } = require('../test-support/app-harness');
const { createResourceStack } = require('../test-support/resource-stack');

let baseUrl;
let cookie; // super_admin — tạo bản ghi "của người khác" từ góc nhìn executor
let executorCookie;
let fixtures;
let db;
let UPLOAD_DIR;
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
  const dbModule = require('../db');
  resources.acquire(dbModule.closeDb);
  db = dbModule.db;
  UPLOAD_DIR = dbModule.UPLOAD_DIR;
  const { createApp } = require('../app');
  fixtures = require('../test-support/fixtures');
  const started = await startTestApp(createApp());
  baseUrl = started.baseUrl;
  resources.acquire(started.close);
  const admin = fixtures.createPrivilegedUser({ username: `f24_admin_${Date.now()}` });
  cookie = (await fixtures.login(baseUrl, { username: admin.username, password: admin.password })).cookie;
  const executor = fixtures.createUser('executor', { username: `f24_executor_${Date.now()}` });
  executorCookie = (await fixtures.login(baseUrl, { username: executor.username, password: executor.password })).cookie;
});

after(async () => {
  await resources.cleanupAll();
});

async function call(method, path, { body, as = cookie } = {}) {
  const opts = { method, headers: { cookie: as } };
  if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  return fetch(`${baseUrl}${path}`, opts);
}
async function uploadFiles(path, files, { as = cookie } = {}) {
  const form = new FormData();
  for (const f of files) form.append('files', new Blob([f.content || 'x'], { type: 'application/pdf' }), f.name);
  return fetch(`${baseUrl}${path}`, { method: 'POST', headers: { cookie: as }, body: form });
}
async function createOrgId() {
  const res = await call('POST', '/api/partners', { body: { name: `F24 Org ${Date.now()}_${Math.random()}`, org_type: 'press' } });
  assert.equal(res.status, 200);
  return (await res.json()).id;
}

const ENTITIES = [
  {
    key: 'award',
    uploadPath: (id) => `/api/awards/${id}/files`,
    createRecord: async (as) => {
      const res = await call('POST', '/api/awards', { body: { name: `F24 Award ${Date.now()}_${Math.random()}`, organizer_type: 'gov', submission_deadline: '2026-12-01', cost: 1000000 }, as });
      assert.equal(res.status, 200);
      return (await res.json()).id;
    },
  },
  {
    key: 'event',
    uploadPath: (id) => `/api/events/${id}/files`,
    createRecord: async (as) => {
      const res = await call('POST', '/api/events', { body: { name: `F24 Event ${Date.now()}_${Math.random()}`, mode: 'host', start_time: '2026-09-01T09:00:00Z' }, as });
      assert.equal(res.status, 200);
      return (await res.json()).id;
    },
  },
  {
    key: 'agreement',
    uploadPath: (id) => `/api/agreements/${id}/files`,
    createRecord: async (as) => {
      const orgId = await createOrgId();
      const res = await call('POST', `/api/partners/${orgId}/agreements`, { body: { title: `F24 MOU ${Date.now()}_${Math.random()}` }, as });
      assert.equal(res.status, 200);
      return (await res.json()).id;
    },
  },
  {
    key: 'work_log',
    uploadPath: (id) => `/api/work-logs/${id}/files`,
    createRecord: async (as) => {
      const orgId = await createOrgId();
      const res = await call('POST', `/api/partners/${orgId}/work-logs`, { body: { topic: `F24 WL ${Date.now()}_${Math.random()}` }, as });
      assert.equal(res.status, 200);
      return (await res.json()).id;
    },
  },
];

function counts() {
  return {
    attachments: db.prepare('SELECT COUNT(*) AS n FROM attachments').get().n,
    files: fs.readdirSync(UPLOAD_DIR).length,
  };
}

for (const { key, uploadPath, createRecord } of ENTITIES) {
  test(`F24 deny: ${key} — executor upload vào bản ghi KHÔNG phải của mình trả 403, KHÔNG tạo row attachments, KHÔNG ghi file vật lý vào UPLOAD_DIR`, async () => {
    const othersId = await createRecord(cookie); // tạo bởi admin
    const before2 = counts();
    const res = await uploadFiles(uploadPath(othersId), [{ name: 'khac.pdf' }], { as: executorCookie });
    assert.equal(res.status, 403);
    const after2 = counts();
    assert.equal(after2.attachments, before2.attachments, `${key}: deny không được tạo row attachments (F24)`);
    assert.equal(after2.files, before2.files, `${key}: deny không được ghi file vật lý vào UPLOAD_DIR — authorization phải chạy TRƯỚC Multer (F24)`);
  });

  test(`F24 đối chứng: ${key} — executor upload vào bản ghi CHÍNH mình trả 200, CẢ attachments lẫn UPLOAD_DIR đều tăng đúng 1 (xác nhận phép đếm thật sự nhạy)`, async () => {
    const myId = await createRecord(executorCookie);
    const before2 = counts();
    const res = await uploadFiles(uploadPath(myId), [{ name: 'cuaminh.pdf' }], { as: executorCookie });
    assert.equal(res.status, 200);
    const after2 = counts();
    assert.equal(after2.attachments, before2.attachments + 1, `${key}: upload hợp lệ phải tạo đúng 1 row attachments`);
    assert.equal(after2.files, before2.files + 1, `${key}: upload hợp lệ phải ghi đúng 1 file vật lý vào UPLOAD_DIR`);
  });
}
