'use strict';
// G1B.5 — N1/N2 (02-decisions.md §B.1, owner RESOLVED 2026-08-25). Implement thật XONG (Wave 1
// nhánh security, 2026-08-30) — promote từ known-red sang assertion xanh thật, entry đã xoá khỏi
// memory-bank/g1b-allowlist.json (đúng quy trình G1B.6: known-red chỉ pass khi hành vi đích còn
// sai; khi đã sửa đúng target, test cha phải chuyển thành assertion trực tiếp, không giữ wrapper
// knownRed() nữa).
//
// Vẫn đọc source thay vì gọi HTTP (lý do không đổi so với bản trước): model 2-role hiện tại cấp
// full CRUD trên reminders/monitoring cho CẢ 2 role, nên request HTTP thật không phân biệt được
// action 'view' với action đích 'ack'/'run' — gap chỉ lộ ra khi có role tương lai (D13 Viewer)
// được cấp view nhưng không được cấp write side-effect. Test khoá đúng permission WIRING trong
// nguồn (route registration + rbac matrix), cùng cách tiếp cận verify-g0.mjs dùng cho route
// catalog.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const routesSrc = fs.readFileSync(path.join(__dirname, '..', 'routes.js'), 'utf8');
const rbacSrc = fs.readFileSync(path.join(__dirname, '..', 'rbac.js'), 'utf8');

const N1_ROUTES = [
  { route: "router.post('/notifications/:id/read'", targetAction: 'ack' },
  { route: "router.post('/notifications/read-all'", targetAction: 'ack' },
  { route: "router.post('/reminders/run'", targetAction: 'run' },
  { route: "router.post('/monitor/alerts/:id/read'", targetAction: 'ack' },
];

function requirePermArgsFor(routeSignature) {
  const idx = routesSrc.indexOf(routeSignature);
  assert.ok(idx >= 0, `không tìm thấy route "${routeSignature}" trong routes.js — route đã đổi vị trí/tên, cập nhật test`);
  const line = routesSrc.slice(idx, routesSrc.indexOf('\n', idx));
  const direct = line.match(/requirePerm\('([^']+)',\s*'([^']+)'\)/);
  if (direct) return { module: direct[1], action: direct[2] };
  // D13 batch RBAC-EXP-B1: route module-admin-only đi qua moduleAdminOnlyGate(entity, module,
  // action) thay vì requirePerm trực tiếp — gate này tự gọi lại requirePerm(module, action) y hệt
  // cho user legacy (server/routes.js), nên action tường minh vẫn đo được ở đây, chỉ khác vị trí.
  const wrapped = line.match(/moduleAdminOnlyGate\('[^']+',\s*'([^']+)',\s*'([^']+)'\)/);
  assert.ok(wrapped, `route "${routeSignature}" không gọi requirePerm(...)/moduleAdminOnlyGate(...) trên đúng dòng đăng ký — không đo được`);
  return { module: wrapped[1], action: wrapped[2] };
}

for (const { route, targetAction } of N1_ROUTES) {
  test(`N1-explicit-action (ĐÃ SỬA): route "${route}" dùng action tường minh "${targetAction}" thay vì tái dùng "view"`, () => {
    const { action } = requirePermArgsFor(route);
    assert.equal(action, targetAction);
  });
}

test("N2-dashboard-permission (ĐÃ SỬA): GET /dashboard có requirePerm(dashboard,view) tường minh", () => {
  const idx = routesSrc.indexOf("router.get('/dashboard'");
  assert.ok(idx >= 0, 'không tìm thấy route GET /dashboard trong routes.js — route đã đổi, cập nhật test');
  const line = routesSrc.slice(idx, routesSrc.indexOf('\n', idx));
  assert.match(line, /requirePerm\('dashboard',\s*'view'\)/);
});

test("N2-dashboard-permission (ĐÃ SỬA): rbac.js khai module 'dashboard' và cấp view cho mọi role hiện có", () => {
  assert.match(rbacSrc, /MODULES\s*=\s*\[[^\]]*'dashboard'[^\]]*\]/, "MODULES trong rbac.js chưa liệt kê 'dashboard'");
  for (const role of ['super_admin', 'pr_staff']) {
    const roleBlockMatch = rbacSrc.match(new RegExp(`${role}:\\s*\\{([\\s\\S]*?)\\n  \\},`));
    assert.ok(roleBlockMatch, `không tìm thấy khối MATRIX.${role} trong rbac.js`);
    assert.match(
      roleBlockMatch[1],
      /dashboard:\s*\[[^\]]*'view'[^\]]*\]/,
      `MATRIX.${role} chưa cấp dashboard:['view'] tường minh`
    );
  }
});

// N1 runtime: can() fail-closed thật cho action lạ không có trong ma trận quyền (không tự suy ra
// action ghi từ 'view') — đặc tả hành vi runtime, không chỉ khoá wiring nguồn.
test('N1-explicit-action runtime: rbac.can() trả false cho action không có trong ma trận quyền của module', () => {
  const rbac = require('../rbac');
  assert.equal(rbac.can('super_admin', 'reminders', 'khong-ton-tai'), false);
  assert.equal(rbac.can('pr_staff', 'monitoring', 'khong-ton-tai'), false);
});
