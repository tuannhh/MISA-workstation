'use strict';
// G1B.5 — target spec test cho N1/N2 (02-decisions.md §B.1, owner RESOLVED 2026-08-25, chưa
// implement). Batch contract: memory-bank/18-g1b-rbac-batch-contract.md#batch-g1b5-n1n2-2026-08-28.
//
// Vì sao đọc source thay vì gọi HTTP: model 2-role hiện tại cấp full CRUD trên
// reminders/monitoring cho CẢ 2 role, nên 1 request HTTP thật không phân biệt được action 'view'
// với action đích 'ack'/'run' — gap chỉ lộ ra khi có role tương lai (D13 Viewer) được cấp view
// nhưng không được cấp write side-effect. Test target vì vậy khoá đúng permission WIRING trong
// nguồn (route registration + rbac matrix), cùng cách tiếp cận verify-g0.mjs đã dùng cho route
// catalog.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { knownRed } = require('../test-support/known-red');

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
  const m = line.match(/requirePerm\('([^']+)',\s*'([^']+)'\)/);
  assert.ok(m, `route "${routeSignature}" không gọi requirePerm(...) trên đúng dòng đăng ký — không đo được`);
  return { module: m[1], action: m[2] };
}

for (const { route, targetAction } of N1_ROUTES) {
  knownRed(
    `N1-explicit-action`,
    `N1 route "${route}" PHẢI dùng action tường minh "${targetAction}" thay vì tái dùng "view"`,
    () => {
      const { action } = requirePermArgsFor(route);
      assert.equal(
        action,
        targetAction,
        `route side-effect vẫn dùng action='${action}' (tái dùng 'view' cho action ghi) — role tương lai chỉ có view sẽ vô tình ghi được`
      );
    },
    /vẫn dùng action='[^']*' \(tái dùng 'view' cho action ghi\)/
  );
}

knownRed(
  'N2-dashboard-permission',
  'N2 GET /dashboard PHẢI có requirePerm(dashboard,view) tường minh',
  () => {
    const idx = routesSrc.indexOf("router.get('/dashboard'");
    assert.ok(idx >= 0, 'không tìm thấy route GET /dashboard trong routes.js — route đã đổi, cập nhật test');
    const line = routesSrc.slice(idx, routesSrc.indexOf('\n', idx));
    assert.match(
      line,
      /requirePerm\('dashboard',\s*'view'\)/,
      'route /dashboard hiện không gọi requirePerm(dashboard,view) — mọi role đăng nhập đều xem được mà không qua permission module riêng'
    );
  },
  /route \/dashboard hiện không gọi requirePerm\(dashboard,view\)/
);

knownRed(
  'N2-dashboard-permission',
  "N2 rbac.js PHẢI khai module 'dashboard' và cấp view cho mọi role được phép xem",
  () => {
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
  },
  /chưa liệt kê 'dashboard'|chưa cấp dashboard:\['view'\] tường minh/
);

// Characterization — xác nhận đúng trạng thái source HIỆN TẠI mà 2 known-red ở trên dựa vào, để
// nếu ai đó sửa routes.js/rbac.js theo hướng khác (không phải theo target N1/N2) thì test này báo
// ngay thay vì để known-red âm thầm đổi ý nghĩa.
test('N1/N2 CHARACTERIZATION: xác nhận đúng dạng nguồn hiện tại mà known-red ở trên đang khoá', () => {
  for (const { route } of N1_ROUTES) {
    const { module, action } = requirePermArgsFor(route);
    assert.equal(action, 'view', `route "${route}" không còn dùng action='view' như characterization ghi nhận — nếu đã sửa đúng target, xoá known-red tương ứng`);
    assert.ok(['reminders', 'monitoring'].includes(module), `route "${route}" dùng module lạ: ${module}`);
  }
  const dashboardIdx = routesSrc.indexOf("router.get('/dashboard'");
  const dashboardLine = routesSrc.slice(dashboardIdx, routesSrc.indexOf('\n', dashboardIdx));
  assert.doesNotMatch(dashboardLine, /requirePerm/, 'route /dashboard đã có requirePerm — nếu đúng target N2, xoá known-red tương ứng');
  assert.doesNotMatch(rbacSrc, /'dashboard'/, "rbac.js đã nhắc tới 'dashboard' — nếu đúng target N2, xoá known-red tương ứng");
});
