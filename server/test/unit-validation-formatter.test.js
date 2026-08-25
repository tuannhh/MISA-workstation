'use strict';

// G1A.2 — Commit 1/4: Validation & formatter (rbac.js, routes.js testables,
// spreadsheet-parser.js#validateSignature, uploads.js file filters).
// Test này CHỈ đặc tả hành vi HIỆN TẠI — không sửa nghiệp vụ. Mọi dòng liên quan trong
// memory-bank/gate1-test-mapping.md dùng business_rule_id BR-VAL-001..034.
//
// require('../routes') kéo theo require('./db') chạy init()/seed() KHÔNG điều kiện ngay khi
// require (server/db.js không gate bằng require.main). Để test này không đụng file
// data/pr.db thật và không cần MySQL, ta ép DB_CLIENT=sqlite + trỏ DATA_DIR vào thư mục tạm
// TRƯỚC khi require bất kỳ module nào chạm db.js — đây KHÔNG phải harness tích hợp (không mở
// server, không login), chỉ chặn side-effect require-time. TZ=UTC vì nextOccurrence()/
// decorateDates() dùng new Date().getFullYear()/getMonth()/getDate() theo giờ hệ thống, còn
// deadlineInfo()/periodOf() tự cộng +7h để suy giờ VN — hai cách này chỉ khớp nhau khi process
// chạy ở UTC (đúng giả định của code khi deploy Cloud Run), nên fix TZ để test không phụ thuộc
// múi giờ máy chạy CI.
process.env.TZ = 'UTC';
process.env.DB_CLIENT = 'sqlite';
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-unit-val-'));

const test = require('node:test');
const assert = require('node:assert/strict');
const { useFixedClock } = require('../test-support/clock');

const rbac = require('../rbac');
const router = require('../routes');
const t = router.testables;
const { MAX_FILE_BYTES, validateSignature } = require('../spreadsheet-parser');
const { fileFilter, aiDocumentFileFilter } = require('../uploads');

test.after(() => { fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); });

// ===================== rbac.js =====================

test('BR-VAL-001/002/003: can() tra đúng ma trận quyền, false khi action/role không có', () => {
  assert.equal(rbac.can('super_admin', 'reports', 'view'), true);
  assert.equal(rbac.can('pr_staff', 'reports', 'view'), false); // reports: [] cho pr_staff
  assert.equal(rbac.can('super_admin', 'partners', 'archive'), false); // action lạ
  assert.equal(rbac.can('ghost_role', 'partners', 'view'), false); // role không tồn tại
});

test('BR-VAL-004: canSeeSensitive() đọc đúng cờ MATRIX theo role, false khi role lạ', () => {
  assert.equal(rbac.canSeeSensitive('super_admin'), true);
  assert.equal(rbac.canSeeSensitive('pr_staff'), false);
  assert.equal(rbac.canSeeSensitive('ghost_role'), false);
});

test('BR-VAL-005: allowedGroups() dùng sensitive_perms override khi là JSON array hợp lệ, lọc nhóm lạ', () => {
  const user = { role: 'pr_staff', sensitive_perms: JSON.stringify(['contact', 'khong-ton-tai']) };
  assert.deepEqual([...rbac.allowedGroups(user)], ['contact']);
});

test('BR-VAL-006: allowedGroups() fallback theo role khi sensitive_perms null hoặc JSON hỏng', () => {
  assert.deepEqual([...rbac.allowedGroups({ role: 'super_admin', sensitive_perms: null })], rbac.ALL_GROUPS);
  assert.deepEqual([...rbac.allowedGroups({ role: 'pr_staff', sensitive_perms: 'khong-phai-json' })], []);
});

test('BR-VAL-007: allowedGroups() trả rỗng khi user null hoặc role không canSeeSensitive', () => {
  assert.equal(rbac.allowedGroups(null).size, 0);
  assert.equal(rbac.allowedGroups({ role: 'pr_staff' }).size, 0);
});

test('BR-VAL-008: canSeeGroup() bọc đúng allowedGroups()', () => {
  const user = { role: 'pr_staff', sensitive_perms: JSON.stringify(['finance']) };
  assert.equal(rbac.canSeeGroup(user, 'finance'), true);
  assert.equal(rbac.canSeeGroup(user, 'contact'), false);
});

test('BR-VAL-009: fieldGroup() tra đúng nhóm theo entity+field, null khi không thuộc nhóm nào', () => {
  assert.equal(rbac.fieldGroup('person', 'dob'), 'private');
  assert.equal(rbac.fieldGroup('organization', 'membership_fee'), 'org_fee');
  assert.equal(rbac.fieldGroup('person', 'full_name'), null);
});

test('BR-VAL-010: maskRecord() không che gì khi allowed===true', () => {
  const record = { dob: '2000-01-01', phone_personal: '0900000000' };
  const out = rbac.maskRecord('person', record, true);
  assert.deepEqual(out, { record, maskedFields: [] });
});

test('BR-VAL-011: maskRecord() che field mật thiếu nhóm (giá trị truthy), giữ nguyên null/rỗng và field ngoài entity', () => {
  const record = {
    dob: '2000-01-01', // nhóm private — được phép
    phone_personal: '0900000000', // nhóm contact — KHÔNG được phép, có giá trị -> phải che
    social_facebook: null, // nhóm social — KHÔNG được phép nhưng null -> KHÔNG che
    home_address: '', // nhóm private — được phép, cũng là chuỗi rỗng
    full_name: 'Nguyễn Văn A', // không thuộc SENSITIVE_FIELDS.person -> không đụng
  };
  const out = rbac.maskRecord('person', record, new Set(['private']));
  assert.equal(out.record.dob, '2000-01-01');
  assert.equal(out.record.phone_personal, rbac.MASK);
  assert.equal(out.record.social_facebook, null);
  assert.equal(out.record.home_address, '');
  assert.equal(out.record.full_name, 'Nguyễn Văn A');
  assert.deepEqual(out.maskedFields, ['phone_personal']);
  assert.notEqual(out.record, record); // phải clone, không sửa record gốc
});

test('BR-VAL-012: maskRecord() trả nguyên record khi entity không có field mật hoặc record null', () => {
  assert.deepEqual(rbac.maskRecord('unknown_entity', { a: 1 }, new Set()), { record: { a: 1 }, maskedFields: [] });
  assert.deepEqual(rbac.maskRecord('person', null, new Set()), { record: null, maskedFields: [] });
});

test('BR-VAL-013: maskList() áp maskRecord cho từng bản ghi trong danh sách', () => {
  const rows = [{ dob: '2000-01-01' }, { dob: '1999-05-05' }];
  const out = rbac.maskList('person', rows, new Set());
  assert.deepEqual(out.map((r) => r.dob), [rbac.MASK, rbac.MASK]);
});

test('BR-VAL-014: permissionSummary() nhận string role hoặc user object, canSeeSensitive suy từ số nhóm xem được', () => {
  const staff = rbac.permissionSummary('pr_staff');
  assert.equal(staff.canSeeSensitive, false);
  assert.deepEqual(staff.modules.reports, []);
  assert.deepEqual(staff.modules.partners, ['view', 'create', 'edit', 'delete']);

  const admin = rbac.permissionSummary({ role: 'super_admin', sensitive_perms: null });
  assert.equal(admin.canSeeSensitive, true);
  assert.equal(admin.roleName, 'Quản lý phòng');

  const ghost = rbac.permissionSummary({ role: 'ghost_role' });
  assert.equal(ghost.canSeeSensitive, false);
  assert.equal(ghost.roleName, 'ghost_role'); // không có trong ROLES -> trả lại chính role
  assert.deepEqual(ghost.modules.partners, []); // module không xác định -> luôn []
});

// ===================== routes.js — helpers thuần (router.testables) =====================

test('BR-VAL-015: pageParams() clamp page>=1, pageSize trong [1,200], mặc định 1/20', () => {
  assert.deepEqual(t.pageParams({ query: {} }), { page: 1, pageSize: 20, offset: 0 });
  assert.deepEqual(t.pageParams({ query: { page: '3', pageSize: '10' } }), { page: 3, pageSize: 10, offset: 20 });
  assert.deepEqual(t.pageParams({ query: { page: '0', pageSize: '500' } }), { page: 1, pageSize: 200, offset: 0 });
  assert.deepEqual(t.pageParams({ query: { page: '-5' } }).page, 1);
});

test('BR-VAL-016: pick() chỉ giữ field allowed, chuỗi rỗng chuyển thành null', () => {
  assert.deepEqual(t.pick({ a: 1, b: '', c: 3 }, ['a', 'b', 'd']), { a: 1, b: null });
});

test('BR-VAL-017: jsonField() stringify giá trị non-string, bỏ qua khi thiếu/null/đã là string', () => {
  const d1 = { x: [1, 2] }; t.jsonField(d1, 'x'); assert.equal(d1.x, '[1,2]');
  const d2 = { x: null }; t.jsonField(d2, 'x'); assert.equal(d2.x, null);
  const d3 = {}; t.jsonField(d3, 'x'); assert.equal('x' in d3, false);
  const d4 = { x: 'already' }; t.jsonField(d4, 'x'); assert.equal(d4.x, 'already');
});

test('BR-VAL-018: senGroups()/senVisible() bọc đúng rbac.allowedGroups + so ALL_GROUPS.length', () => {
  const req = { session: { user: { role: 'super_admin', sensitive_perms: null } } };
  assert.equal(t.senVisible(t.senGroups(req)), true);
  assert.equal(t.senVisible(new Set(['contact'])), false);
});

test('BR-VAL-019: canMoney()/maskMoney() che field tiền khi thiếu nhóm org_fee, giữ nguyên khi đủ quyền', () => {
  const noMoney = { session: { user: { role: 'pr_staff', sensitive_perms: null } } };
  const hasMoney = { session: { user: { role: 'pr_staff', sensitive_perms: JSON.stringify(['org_fee']) } } };
  assert.equal(t.canMoney(noMoney), false);
  assert.equal(t.canMoney(hasMoney), true);

  const single = { cost: 5000 };
  t.maskMoney(noMoney, single, 'cost');
  assert.equal(single.cost, rbac.MASK);

  const rows = [{ cost: 5000 }, { cost: null }];
  t.maskMoney(noMoney, rows, 'cost');
  assert.equal(rows[0].cost, rbac.MASK);
  assert.equal(rows[1].cost, null); // giá trị null -> không đụng

  const untouched = [{ cost: 5000 }];
  t.maskMoney(hasMoney, untouched, 'cost');
  assert.equal(untouched[0].cost, 5000);
});

test('BR-VAL-020: stripDisallowed() xoá field mật không thuộc nhóm được phép khỏi payload cập nhật', () => {
  const data = { dob: '2000-01-01', phone_personal: 'x', full_name: 'A' };
  const out = t.stripDisallowed('person', data, new Set(['private']));
  assert.deepEqual(out, { dob: '2000-01-01', full_name: 'A' });
});

test('BR-VAL-021: isValidBudgetPeriod() chỉ nhận đúng dạng YYYY-MM', () => {
  assert.equal(t.isValidBudgetPeriod('2026-08'), true);
  assert.equal(t.isValidBudgetPeriod('2026-8'), false);
  assert.equal(t.isValidBudgetPeriod(''), false);
  assert.equal(t.isValidBudgetPeriod(undefined), false);
});

test('BR-VAL-022: isValidNewUserPayload() bắt buộc đủ username/password/full_name + role hợp lệ', () => {
  assert.equal(t.isValidNewUserPayload({ username: 'a', password: 'b', full_name: 'c', role: 'pr_staff' }), true);
  assert.equal(t.isValidNewUserPayload({ username: 'a', password: '', full_name: 'c', role: 'pr_staff' }), false);
  assert.equal(t.isValidNewUserPayload({ username: 'a', password: 'b', full_name: 'c', role: 'ghost_role' }), false);
});

test('BR-VAL-023: sanitizeSensitivePerms() lọc bỏ tên nhóm không có trong ALL_GROUPS', () => {
  assert.deepEqual(t.sanitizeSensitivePerms(['contact', 'bogus', 'finance']), ['contact', 'finance']);
});

test('BR-VAL-024: nextOccurrence() một lần dùng đúng ngày, lặp lại tự cộng năm khi ngày trong năm đã qua', (ctx) => {
  useFixedClock(ctx, '2026-08-25T00:00:00.000Z');
  assert.deepEqual(t.nextOccurrence('2026-09-10', 0), { diff: 16, occurDate: '2026-09-10', years: null });

  const upcoming = t.nextOccurrence('2020-09-01', 1); // còn tới trong năm nay -> không cộng năm
  assert.deepEqual(upcoming, { diff: 7, occurDate: '2026-09-01', years: 6 });

  const rolled = t.nextOccurrence('2020-08-01', 1); // đã qua trong năm nay -> cộng sang năm sau
  assert.deepEqual(rolled, { diff: 341, occurDate: '2027-08-01', years: 7 });

  assert.equal(t.nextOccurrence('2026-08', 0), null); // thiếu ngày -> null
  assert.equal(t.nextOccurrence('', 0), null);
});

test('BR-VAL-025: decorateDates() dueSoon theo lead_days (mặc định 7), daysUntil=null khi ngày rỗng', (ctx) => {
  useFixedClock(ctx, '2026-08-25T00:00:00.000Z');
  const rows = t.decorateDates([
    { id: 1, event_date: '2026-09-01', recurring: 0, lead_days: 5 }, // diff=7 > 5 -> không dueSoon
    { id: 2, event_date: '2026-08-27', recurring: 0, lead_days: null }, // diff=2 <= mặc định 7 -> dueSoon
    { id: 3, event_date: '', recurring: 0 },
  ]);
  assert.equal(rows[0].dueSoon, false);
  assert.equal(rows[1].dueSoon, true);
  assert.equal(rows[2].daysUntil, null);
});

test('BR-VAL-026: deadlineInfo() null khi thiếu/sai ngày, tính days theo giờ VN (UTC+7)', (ctx) => {
  useFixedClock(ctx, '2026-08-25T00:00:00.000Z');
  assert.deepEqual(t.deadlineInfo(null), { days: null });
  assert.deepEqual(t.deadlineInfo('2026-13-40'), { days: null }); // ngày không hợp lệ
  assert.deepEqual(t.deadlineInfo('2026-08-25'), { days: 0 });
  assert.deepEqual(t.deadlineInfo('2026-08-24'), { days: -1 });
  assert.deepEqual(t.deadlineInfo('2026-09-10'), { days: 16 });
});

test('BR-VAL-027: jarr() nhận mảng, parse chuỗi JSON thành mảng, trả [] khi không phải mảng/parse lỗi', () => {
  const arr = [1, 2];
  assert.equal(t.jarr(arr), arr); // trả lại đúng reference, không clone
  assert.deepEqual(t.jarr('[1,2]'), [1, 2]);
  assert.deepEqual(t.jarr('khong-phai-json'), []);
  assert.deepEqual(t.jarr('{"a":1}'), []); // JSON hợp lệ nhưng không phải mảng
  assert.deepEqual(t.jarr(null), []);
  assert.deepEqual(t.jarr(undefined), []);
});

test('BR-VAL-028: periodOf() mặc định 30 ngày gần nhất khi query.from/to thiếu hoặc sai định dạng', (ctx) => {
  useFixedClock(ctx, '2026-08-25T00:00:00.000Z');
  assert.deepEqual(t.periodOf({ query: {} }), { from: '2026-07-27', to: '2026-08-25' });
  // "from" mặc định KHÔNG phụ thuộc "to" đã truyền — đặc tả đúng hành vi hiện tại, không phải bug cần sửa ở đây.
  assert.deepEqual(t.periodOf({ query: { to: '2026-08-01' } }), { from: '2026-07-27', to: '2026-08-01' });
  assert.deepEqual(t.periodOf({ query: { from: '2026-08-01', to: 'khong-hop-le' } }), { from: '2026-08-01', to: '2026-08-25' });
});

test('BR-VAL-029: campOut() bọc keywords/competitors qua jarr()', () => {
  const out = t.campOut({ id: 1, name: 'X', keywords: '["a","b"]', competitors: null });
  assert.deepEqual(out, { id: 1, name: 'X', keywords: ['a', 'b'], competitors: [] });
});

// ===================== spreadsheet-parser.js — validateSignature() =====================

test('BR-VAL-030: validateSignature() từ chối file vượt quá MAX_FILE_BYTES', () => {
  const file = { originalname: 'lon.xlsx', buffer: Buffer.alloc(MAX_FILE_BYTES + 1) };
  assert.throws(() => validateSignature(file), /vượt quá 10 MB/);
});

test('BR-VAL-031: validateSignature() từ chối CSV chứa byte NUL, chấp nhận CSV văn bản thuần', () => {
  assert.throws(() => validateSignature({ originalname: 'x.csv', buffer: Buffer.from('a,b\0c') }), /không đúng định dạng văn bản/);
  assert.doesNotThrow(() => validateSignature({ originalname: 'x.csv', buffer: Buffer.from('a,b,c') }));
});

test('BR-VAL-032: validateSignature() chỉ chấp nhận đúng signature ZIP(xlsx)/OLE(xls)', () => {
  assert.doesNotThrow(() => validateSignature({ originalname: 'x.xlsx', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]) }));
  assert.doesNotThrow(() => validateSignature({ originalname: 'x.xls', buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) }));
  assert.throws(() => validateSignature({ originalname: 'x.xlsx', buffer: Buffer.from('khong-phai-zip') }), /không đúng định dạng Excel/);
});

// ===================== uploads.js — file filters =====================

function captured() {
  const calls = [];
  const cb = (err, ok) => calls.push({ err, ok });
  return { cb, calls };
}

test('BR-VAL-033: fileFilter() chỉ nhận mimetype trong danh sách ALLOWED', () => {
  const ok = captured();
  fileFilter(null, { mimetype: 'application/pdf' }, ok.cb);
  assert.deepEqual(ok.calls, [{ err: null, ok: true }]);

  const bad = captured();
  fileFilter(null, { mimetype: 'application/zip' }, bad.cb);
  assert.equal(bad.calls.length, 1);
  assert.equal(bad.calls[0].ok, undefined);
  assert.match(bad.calls[0].err.message, /Chỉ chấp nhận ảnh, PDF/);
});

test('BR-VAL-034: aiDocumentFileFilter() yêu cầu ĐỒNG THỜI mimetype hợp lệ VÀ đuôi file hợp lệ', () => {
  const ok = captured();
  aiDocumentFileFilter(null, { mimetype: 'text/csv', originalname: 'a.csv' }, ok.cb);
  assert.deepEqual(ok.calls, [{ err: null, ok: true }]);

  const wrongExt = captured();
  aiDocumentFileFilter(null, { mimetype: 'text/csv', originalname: 'a.txt' }, wrongExt.cb);
  assert.match(wrongExt.calls[0].err.message, /Chỉ chấp nhận file Excel hoặc CSV/);

  const wrongMime = captured();
  aiDocumentFileFilter(null, { mimetype: 'application/zip', originalname: 'a.xlsx' }, wrongMime.cb);
  assert.match(wrongMime.calls[0].err.message, /Chỉ chấp nhận file Excel hoặc CSV/);
});
