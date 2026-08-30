#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const ok = (condition, message) => {
  if (!condition) throw new Error(message);
};
const pass = (message) => console.log(`PASS  ${message}`);
const clean = (value) => value.replaceAll('**', '').replaceAll('`', '').trim();

function expandRouteIds(value) {
  const ids = [];
  for (const match of value.matchAll(/R(\d{3})(?:-R(\d{3}))?/g)) {
    const first = Number(match[1]);
    const last = Number(match[2] || match[1]);
    ok(last >= first, `invalid route range ${match[0]}`);
    for (let id = first; id <= last; id += 1) ids.push(`R${String(id).padStart(3, '0')}`);
  }
  return ids;
}

function markdownRows(markdown, rowPattern) {
  return markdown.split('\n')
    .filter((line) => rowPattern.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

function assertPartition(actual, expected, label) {
  const counts = new Map();
  for (const id of actual) counts.set(id, (counts.get(id) || 0) + 1);
  const missing = expected.filter((id) => !counts.has(id));
  const duplicate = [...counts].filter(([, count]) => count !== 1).map(([id, count]) => `${id}×${count}`);
  const unknown = [...counts.keys()].filter((id) => !expected.includes(id));
  ok(!missing.length && !duplicate.length && !unknown.length,
    `${label}: missing=[${missing}] duplicate=[${duplicate}] unknown=[${unknown}]`);
}

// authKind cho 3 route auth trực tiếp (không qua router. nào) — đây vẫn là tri thức nghiệp vụ
// phải hard-code (route nào công khai/route nào tự check session), NHƯNG chính route đó
// (method+path+handler) được PARSE THẬT từ server/app.js, không hard-code khống — nếu route bị
// đổi/xoá/đổi tên handler, hàm này FAIL thay vì im lặng báo PASS (Codex G1A1-audit A5).
const DIRECT_AUTH_ROUTE_KIND = { login: 'public', logout: 'no-middleware', me: 'handler-session-check' };

function parseDirectAppRoutes(appSource = read('server/app.js')) {
  const regex = /app\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]\s*,\s*auth\.(\w+)\)/g;
  const routes = [];
  for (const match of appSource.matchAll(regex)) {
    const [, method, fullPath, handler] = match;
    const authKind = DIRECT_AUTH_ROUTE_KIND[handler];
    ok(authKind, `server/app.js có route auth.${handler} chưa khai báo authKind trong DIRECT_AUTH_ROUTE_KIND — cập nhật verify-g0.mjs`);
    routes.push({ method: method.toUpperCase(), fullPath, module: null, authKind });
  }
  ok(routes.length === 3, `server/app.js phải có đúng 3 route auth trực tiếp (login/logout/me), parse được ${routes.length}`);
  return routes;
}

// Parse app.use(prefix, routerVar) + const routerVar = require('./file') từ server/app.js — thay
// vì hard-code cặp [file, prefix] (Codex re-audit round 2, R2-03): nếu mount thật sự đổi (vd
// '/api' -> '/v2'), hàm này phải phản ánh đúng giá trị đó, để verifyRoutesAndMatrices() bên dưới
// phát hiện route full path không còn khớp catalog — thay vì âm thầm PASS với prefix cũ hard-code.
function parseRouterMounts(appSource = read('server/app.js')) {
  const varToFile = new Map();
  for (const match of appSource.matchAll(/const\s+(\w+)\s*=\s*require\(\s*['"]\.\/(\w+)['"]\s*\)/g)) {
    varToFile.set(match[1], `server/${match[2]}.js`);
  }
  const mounts = [];
  for (const match of appSource.matchAll(/app\.use\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\s*\)/g)) {
    const file = varToFile.get(match[2]);
    if (file) mounts.push({ prefix: match[1], file });
  }
  return mounts;
}

function resolveRouterPrefix(file, appSource = read('server/app.js')) {
  const mount = parseRouterMounts(appSource).find((entry) => entry.file === file);
  ok(mount, `server/app.js không tìm thấy app.use(prefix, router) cho ${file} — parse mount thất bại`);
  return mount.prefix;
}

// Route nào KHÔNG còn requirePerm(module,action) ngay trong khai báo route (vì Wave-1 pilot D13
// chuyển kiểm quyền vào TRONG thân handler, rẽ nhánh legacy 2-role/PolicyEngine — vd
// server/routes.js:403 R030) phải khai TƯỜNG MINH ở đây, giống hệt tinh thần
// DIRECT_AUTH_ROUTE_KIND phía trên: script không tự suy diễn module từ thân hàm (dễ sai/im lặng
// PASS sai), người sửa route phải tự xác nhận bằng đọc code rồi khai đúng module/action thật —
// nếu quên khai, route sẽ rơi về module=null và FAIL rõ ràng ở Section A thay vì PASS ngầm.
const PILOT_INLINE_PERM_ROUTES = {
  'GET /api/people/:id': { module: 'partners', action: 'view' }, // D13 People Detail pilot, commit 3e8b299
  'PUT /api/people/:id': { module: 'partners', action: 'edit' }, // D13 People Detail write pilot (RBAC-PILOT2-people-write)
  'DELETE /api/people/:id': { module: 'partners', action: 'delete' }, // D13 People Detail write pilot (RBAC-PILOT2-people-write)
  'POST /api/people/:id/attachments': { module: 'partners', action: 'edit' }, // D13 People Detail file pilot (RBAC-PILOT3-people-file)
  'PUT /api/people/:id/attachments/:aid/primary': { module: 'partners', action: 'edit' }, // D13 People Detail file pilot (RBAC-PILOT3-people-file)
  'DELETE /api/attachments/:aid': { module: 'partners', action: 'edit' }, // D13 People Detail file pilot (RBAC-PILOT3-people-file)
  // D13 batch RBAC-EXP-B1 (module-admin-only 6 entity): moduleAdminOnlyGate(entity,module,action)
  // thay requirePerm(module,action) trực tiếp trên dòng đăng ký route — module/action giữ nguyên
  // ý nghĩa cũ (gate gọi lại đúng requirePerm(module,action) cho user legacy 2-role).
  'POST /api/budgets': { module: 'reports', action: 'view' },
  'POST /api/monitor/alerts/:id/read': { module: 'monitoring', action: 'ack' },
  'POST /api/monitor/queries': { module: 'monitoring', action: 'create' },
  'PUT /api/monitor/queries/:id': { module: 'monitoring', action: 'edit' },
  'DELETE /api/monitor/queries/:id': { module: 'monitoring', action: 'delete' },
  'POST /api/monitor/sources': { module: 'monitoring', action: 'create' },
  'PUT /api/monitor/sources/:id': { module: 'monitoring', action: 'edit' },
  'DELETE /api/monitor/sources/:id': { module: 'monitoring', action: 'delete' },
  'POST /api/monitor/competitors': { module: 'monitoring', action: 'create' },
  'PUT /api/monitor/competitors/:id': { module: 'monitoring', action: 'edit' },
  'DELETE /api/monitor/competitors/:id': { module: 'monitoring', action: 'delete' },
  'POST /api/monitor/campaigns': { module: 'monitoring', action: 'create' },
  'PUT /api/monitor/campaigns/:id': { module: 'monitoring', action: 'edit' },
  'DELETE /api/monitor/campaigns/:id': { module: 'monitoring', action: 'delete' },
  // D13 batch RBAC-EXP-B2 (2/6 entity Global còn lại: organization/supplier/important_date) —
  // PolicyEngine không điều kiện (không còn dual-branch legacy từ RBAC-CUTOVER), module/action giữ
  // nguyên ý nghĩa cũ để đối chiếu Section A.
  'PUT /api/partners/:id': { module: 'partners', action: 'edit' },
  'DELETE /api/partners/:id': { module: 'partners', action: 'delete' },
  'PUT /api/suppliers/:id': { module: 'suppliers', action: 'edit' },
  'DELETE /api/suppliers/:id': { module: 'suppliers', action: 'delete' },
  'PUT /api/reminders/:id': { module: 'reminders', action: 'edit' },
  'DELETE /api/reminders/:id': { module: 'reminders', action: 'delete' },
  // D13 batch RBAC-EXP-B3 (1/6 entity Direct — booking/interaction, ownership-gated qua owner_id) —
  // PolicyEngine không điều kiện, module/action giữ nguyên ý nghĩa cũ để đối chiếu Section A.
  'POST /api/interactions': { module: 'interactions', action: 'create' },
  'POST /api/bookings': { module: 'partners', action: 'create' },
  'PUT /api/bookings/:id': { module: 'partners', action: 'edit' },
  'DELETE /api/bookings/:id': { module: 'partners', action: 'delete' },
  // D13 batch RBAC-EXP-B4 (2/6 entity Direct — award/award_participation — + 1 entity Inherited —
  // event_cost, kế thừa owner_id của event cha qua parentOwnerId) — PolicyEngine không điều kiện.
  'POST /api/awards': { module: 'awards', action: 'create' },
  'PUT /api/awards/:id': { module: 'awards', action: 'edit' },
  'DELETE /api/awards/:id': { module: 'awards', action: 'delete' },
  'POST /api/awards/:id/participations': { module: 'awards', action: 'create' },
  'PUT /api/awards/:id/participations/:pid': { module: 'awards', action: 'edit' },
  // truoc batch nay map nham vao 'edit' (executor xoa duoc) -- sua dung 'delete' (Admin/Super Admin).
  'DELETE /api/awards/:id/participations/:pid': { module: 'awards', action: 'delete' },
  'POST /api/events': { module: 'events', action: 'create' },
  'PUT /api/events/:id': { module: 'events', action: 'edit' },
  'DELETE /api/events/:id': { module: 'events', action: 'delete' },
  'POST /api/events/:id/costs': { module: 'events', action: 'create' },
  'PUT /api/events/:id/costs/:cid': { module: 'events', action: 'edit' },
  'DELETE /api/events/:id/costs/:cid': { module: 'events', action: 'delete' },
  // D13 batch RBAC-EXP-B5 (3/6 entity Direct — supplier_contact/supplier_transaction/
  // supplier_quote) — PolicyEngine không điều kiện.
  'POST /api/suppliers/:id/contacts': { module: 'suppliers', action: 'create' },
  'PUT /api/suppliers/:id/contacts/:cid': { module: 'suppliers', action: 'edit' },
  // truoc batch nay map nham vao 'edit' (executor xoa duoc) -- sua dung 'delete' (Admin/Super Admin).
  'DELETE /api/suppliers/:id/contacts/:cid': { module: 'suppliers', action: 'delete' },
  'POST /api/suppliers/:id/transactions': { module: 'suppliers', action: 'create' },
  'PUT /api/suppliers/:id/transactions/:tid': { module: 'suppliers', action: 'edit' },
  'DELETE /api/suppliers/:id/transactions/:tid': { module: 'suppliers', action: 'delete' },
  'POST /api/suppliers/:id/quotes': { module: 'suppliers', action: 'create' },
  'DELETE /api/suppliers/:id/quotes/:qid': { module: 'suppliers', action: 'delete' },
  // D13 batch RBAC-EXP-B6 (batch CUOI CUNG, 6/6 entity Direct con lai) — PolicyEngine khong dieu
  // kien. Tat ca DELETE truoc batch nay map nham vao 'edit' (executor xoa duoc) -- sua dung
  // 'delete' (Admin/Super Admin).
  'POST /api/partners/:id/sponsorships': { module: 'partners', action: 'create' },
  'PUT /api/sponsorships/:id': { module: 'partners', action: 'edit' },
  'DELETE /api/sponsorships/:id': { module: 'partners', action: 'delete' },
  'POST /api/partners/:id/agreements': { module: 'partners', action: 'create' },
  'PUT /api/agreements/:id': { module: 'partners', action: 'edit' },
  'DELETE /api/agreements/:id': { module: 'partners', action: 'delete' },
  'POST /api/partners/:id/work-logs': { module: 'partners', action: 'create' },
  'PUT /api/work-logs/:id': { module: 'partners', action: 'edit' },
  'DELETE /api/work-logs/:id': { module: 'partners', action: 'delete' },
  'POST /api/partners/:id/gifts': { module: 'partners', action: 'create' },
  'POST /api/people/:id/gifts': { module: 'partners', action: 'create' },
  'PUT /api/gifts/:id': { module: 'partners', action: 'edit' },
  'DELETE /api/gifts/:id': { module: 'partners', action: 'delete' },
  'POST /api/partners/:id/benefit-usages': { module: 'partners', action: 'create' },
  'PUT /api/benefit-usages/:id': { module: 'partners', action: 'edit' },
  'DELETE /api/benefit-usages/:id': { module: 'partners', action: 'delete' },
  'POST /api/partners/:id/fees': { module: 'partners', action: 'create' },
  'PUT /api/partners/:id/fees/:fid': { module: 'partners', action: 'edit' },
  'DELETE /api/partners/:id/fees/:fid': { module: 'partners', action: 'delete' },
};

function sourceRoutes() {
  const routes = [];
  for (const file of ['server/routes.js', 'server/ai.js']) {
    const prefix = resolveRouterPrefix(file);
    const source = read(file);
    const regex = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]([^\n]*)/g;
    for (const match of source.matchAll(regex)) {
      const permission = match[3].match(/requirePerm\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
      const method = match[1].toUpperCase();
      const fullPath = `${prefix}${match[2]}`;
      const pilot = !permission ? PILOT_INLINE_PERM_ROUTES[`${method} ${fullPath}`] : null;
      routes.push({
        method,
        fullPath,
        module: permission ? permission[1] : (pilot ? pilot.module : null),
        action: permission ? permission[2] : (pilot ? pilot.action : null),
      });
    }
  }
  routes.push(...parseDirectAppRoutes());
  return routes;
}

function verifyRoutesAndMatrices() {
  const catalog = read('memory-bank/07-route-catalog.md');
  const matrix = read('memory-bank/08-permission-matrix.md');
  const catalogRows = markdownRows(catalog, /^\| R\d{3} \|/);
  ok(catalogRows.length === 145, `catalog rows=${catalogRows.length}, expected 145`);

  const ids = catalogRows.map((row) => row[0]);
  const expectedIds = Array.from({ length: 145 }, (_, index) => `R${String(index + 1).padStart(3, '0')}`);
  assertPartition(ids, expectedIds, 'route catalog IDs');

  const source = sourceRoutes();
  ok(source.length === 145, `source literal routes=${source.length}, expected 145`);
  const sourceByKey = new Map(source.map((route) => [`${route.method} ${route.fullPath}`, route]));
  ok(sourceByKey.size === 145, 'source contains duplicate method/path pairs');

  const catalogById = new Map();
  for (const row of catalogRows) {
    const [id, method, fullPath, auth] = row;
    const route = sourceByKey.get(`${method} ${fullPath}`);
    ok(route, `${id} ${method} ${fullPath} does not match source`);
    const authText = clean(auth);
    if (route.module) {
      ok(authText.includes(`requirePerm(${route.module},${route.action})`),
        `${id} auth mismatch: source=${route.module}:${route.action}, catalog=${authText}`);
    } else if (route.authKind === 'public') {
      ok(authText.includes('no-auth'), `${id} login must be documented public/no-auth`);
    } else if (route.authKind === 'no-middleware') {
      ok(authText.includes('no auth middleware'), `${id} logout has no auth middleware`);
    } else if (route.authKind === 'handler-session-check') {
      ok(authText.includes('handler tự kiểm tra session'), `${id} me auth is a handler check`);
    } else {
      ok(authText.includes('requireAuth'), `${id} is protected by router.use(requireAuth)`);
    }
    catalogById.set(id, route);
  }
  pass('route catalog: 145 unique IDs and exact source method/path/auth');

  const sectionA = matrix.slice(matrix.indexOf('## A.'), matrix.indexOf('## B.'));
  const sectionARows = markdownRows(sectionA, /^\| (partners|reminders|interactions|reports|awards|suppliers|events|admin|monitoring|dashboard|\*\(không)/);
  const sectionAIds = sectionARows.flatMap((row) => expandRouteIds(row[3]));
  assertPartition(sectionAIds, expectedIds, 'Section A authorization partition');
  for (const row of sectionARows) {
    const documentedModule = clean(row[0]).startsWith('*(không') ? null : clean(row[0]);
    for (const id of expandRouteIds(row[3])) {
      ok(catalogById.get(id).module === documentedModule,
        `${id} Section A module=${documentedModule}, source=${catalogById.get(id).module}`);
    }
  }
  pass('authorization matrix Section A: 145 unique IDs and exact source module partition');

  const flowRows = markdownRows(matrix, /^\| F\d{3} \|/);
  ok(flowRows.length === 34, `UI flow rows=${flowRows.length}, expected 34`);
  const flowIds = flowRows.map((row) => row[0]);
  ok(new Set(flowIds).size === flowRows.length, 'duplicate flow_id in UI-flow matrix');
  const mappedIds = [];
  for (const row of flowRows) {
    ok(row.length === 8, `${row[0]} must have 8 columns, got ${row.length}`);
    mappedIds.push(...expandRouteIds(row[2]));
    ok(row[3].includes('D-') && row[4].includes('D-'), `${row[0]} missing Desktop profile for a current role`);
    ok(row[5].includes('N-MISSING') && row[6].includes('N-MISSING'), `${row[0]} missing Native row/profile for a current role`);
    ok(row[7].length > 0, `${row[0]} missing disabled/masked evidence status`);
  }
  assertPartition(mappedIds, expectedIds, 'UI-flow route mapping');
  pass('UI-flow matrix: 145 routes -> exactly 1 of 34 flows; 2 roles x Desktop/Native present');
}

function verifyGemini() {
  const count = (file) => [...read(file).matchAll(/\bgemini\.(?:genJSON|genText|genImage|groundedSearch)\s*\(/g)].length;
  const ai = count('server/ai.js');
  const monitor = count('server/monitor.js');
  ok(ai === 6 && monitor === 7, `Gemini expressions ai=${ai}, monitor=${monitor}; expected 6/7`);
  ok(read('memory-bank/06-threat-model.md').includes('12 logical') || read('memory-bank/06-threat-model.md').includes('12 luồng'),
    'threat model must document 12 logical Gemini flows');
  pass('Gemini inventory: ai.js=6, monitor.js=7, 13 expressions / 12 logical flows');
}

function verifySchema() {
  const db = read('server/db.js');
  const tables = [...db.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/g)].map((match) => match[1]);
  const indexes = [...db.matchAll(/CREATE INDEX IF NOT EXISTS\s+([a-z_]+)/g)].map((match) => match[1]);
  const drops = [...db.matchAll(/DROP TABLE IF EXISTS\s+([a-z_]+)/g)].map((match) => match[1]);
  // Baseline Gate-0 là 34 bảng/28 drop-target. W1.RBAC.1 (commit 9ef286a, 2026-08-27) thêm bảng
  // `field_visibility` — KHÔNG đưa vào dropAll() vì W1.RBAC.0 đã chốt bỏ dropAll()/RESET_DB làm
  // cơ chế reset cho migration RBAC v2 (dùng fresh database/schema cutover thay thế, xem
  // 09-db-schema.md §E + 04-ROADMAP.md W1.RBAC.1) — nên đây là 1 omission MỚI có chủ ý, không
  // phải regression giống 6 omission Gate-0 cũ.
  ok(new Set(tables).size === 35, `tables=${new Set(tables).size}, expected 35`);
  ok(new Set(indexes).size === 22, `indexes=${new Set(indexes).size}, expected 22`);
  ok(new Set(drops).size === 28, `drop targets=${new Set(drops).size}, expected 28`);
  const omissions = [...new Set(tables)].filter((table) => !new Set(drops).has(table)).sort();
  const expected = ['agreements', 'benefit_usages', 'gifts', 'supplier_contacts', 'supplier_transactions', 'work_logs', 'field_visibility'].sort();
  ok(JSON.stringify(omissions) === JSON.stringify(expected), `drop omissions=${omissions}, expected=${expected}`);
  pass(`schema facts: 35 tables, 22 indexes, 28 drops; omissions=${omissions.join(',')}`);
}

function verifyErrorExample() {
  const contract = read('memory-bank/05-error-contract.md');
  const message = contract.match(/^\s*"message":\s*"([^"]+)"/m)?.[1];
  const error = contract.match(/^\s*"error":\s*"([^"]+)"/m)?.[1];
  ok(message && message === error, `error example mismatch: message=${message}, error=${error}`);
  pass('error contract example: message === error');
}

function verifyMarkdownLinks() {
  const docs = fs.readdirSync(path.join(root, 'memory-bank')).filter((name) => name.endsWith('.md'));
  const broken = [];
  for (const doc of docs) {
    const source = read(`memory-bank/${doc}`)
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`\n]+`/g, '');
    for (const match of source.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)) {
      let target = match[1].trim().replace(/^<|>$/g, '').split('#')[0];
      if (!target || /^(?:https?:|mailto:)/.test(target) || target.includes('://')) continue;
      target = decodeURIComponent(target);
      const resolved = path.resolve(root, 'memory-bank', target);
      if (!fs.existsSync(resolved)) broken.push(`${doc} -> ${target}`);
    }
  }
  ok(!broken.length, `broken Markdown links:\n${broken.join('\n')}`);
  pass(`Markdown internal links: 0 broken across ${docs.length} memory-bank files`);
}

// W1.POLICY.2: PolicyEngine (policyService.projectRecord/canReadField) la choke point DUY NHAT cho
// moi field mat (D1) -- chan tai su dung co che mask legacy da bi thay the (rbac.maskList/maskRecord,
// senGroups/senVisible, canMoney/maskMoney SUPERSEDED boi D13, xem 02-decisions.md O7). rbac.js van
// giu dinh nghia + unit test thuan cho lich su, chi cam CALL SITE that trong routes.js.
function verifyNoLegacyMasking() {
  const source = read('server/routes.js');
  const banned = ['rbac.maskList(', 'rbac.maskRecord(', 'maskMoney(', 'canMoney(', 'senGroups(', 'senVisible('];
  const found = banned.filter((needle) => source.includes(needle));
  ok(!found.length, `legacy masking con trong routes.js (phai qua policyService.projectRecord): ${found.join(', ')}`);
  pass('routes.js: 0 legacy masking call (rbac.maskList/maskRecord/maskMoney/senGroups/senVisible/canMoney) -- PolicyEngine la choke point duy nhat');
}

function verifyRemediationScope() {
  const baseArg = process.argv.find((arg) => arg.startsWith('--base='));
  if (!baseArg) return;
  const base = baseArg.slice('--base='.length);
  const changed = execFileSync('git', ['diff', '--name-only', base], { cwd: root, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const names = [...new Set([...changed, ...untracked])];
  const scoped = names.filter((name) => name !== '.DS_Store');
  const invalid = scoped.filter((name) => !name.startsWith('memory-bank/') && name !== 'scripts/verify-g0.mjs');
  ok(!invalid.length, `remediation touched product files: ${invalid.join(',')}`);
  pass(`remediation scope from ${base}: memory-bank + verification script only (${scoped.length} files; unrelated .DS_Store ignored)`);
}

// Export để scripts/verify-g0.selftest.mjs có thể import và chứng minh parser thật sự FAIL
// khi route auth bị đổi/xoá (Codex G1A1-audit A5, "negative test chống false-positive") —
// guard khối chạy-thật dưới đây để import không tự chạy toàn bộ verify.
export { parseDirectAppRoutes, DIRECT_AUTH_ROUTE_KIND, parseRouterMounts, resolveRouterPrefix };

function main() {
  try {
    verifyRoutesAndMatrices();
    verifyGemini();
    verifySchema();
    verifyErrorExample();
    verifyNoLegacyMasking();
    verifyMarkdownLinks();
    verifyRemediationScope();
    console.log('\nG0 verification checks passed.');
  } catch (error) {
    console.error(`FAIL  ${error.message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
