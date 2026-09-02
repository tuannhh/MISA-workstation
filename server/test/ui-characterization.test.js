'use strict';

// G1A.6 là characterization: các test này khóa bằng chứng về UI ĐANG có,
// không coi Desktop smoke xanh là MDS/native-mobile đã đạt. Khi Wave 3/4 thay
// composition, cập nhật test + matrix cùng slice thay vì để evidence cũ xanh giả.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const appJs = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const appVue = fs.readFileSync(path.join(root, 'frontend', 'src', 'App.vue'), 'utf8');
const style = fs.readFileSync(path.join(root, 'frontend', 'src', 'style.css'), 'utf8');
const matrix = fs.readFileSync(path.join(root, 'memory-bank', '08-permission-matrix.md'), 'utf8');

const DESKTOP_NAV_KEYS = [
  'dashboard', 'press', 'association', 'gov', 'other', 'people', 'events',
  'awards', 'suppliers', 'interactions', 'monitor', 'reminders', 'reports', 'admin',
];

function tableRows(text, prefix) {
  return text.split('\n').filter((line) => new RegExp(`^\\|\\s*${prefix}`).test(line));
}

test('UI-CHAR-001: 14 module desktop có nav và legacy view resolver tương ứng', () => {
  const navKeys = [...appJs.matchAll(/\{ key: '([a-z]+)', mod:/g)].map((match) => match[1]);
  assert.deepEqual(navKeys, DESKTOP_NAV_KEYS, 'NAV desktop thay đổi phải cập nhật smoke/evidence G1A.6');

  for (const key of DESKTOP_NAV_KEYS) {
    const isPartnerVariant = ['press', 'association', 'gov', 'other'].includes(key);
    const resolver = isPartnerVariant
      ? new RegExp(`\\['press', 'association', 'gov', 'other'\\]\\.forEach[\\s\\S]*VIEWS\\[t\\] = makePartnerView`)
      : new RegExp(`VIEWS\\.${key}\\s*=`);
    assert.match(appJs, resolver, `${key} phải có resolver để hash route không rơi về dashboard`);
  }
});

test('UI-CHAR-002: Vue shell nạp legacy UI sau khi tạo đủ DOM mount points', () => {
  for (const id of ['login', 'app', 'nav', 'view', 'crumb', 'bellPanel', 'modalRoot', 'toast']) {
    assert.match(appVue, new RegExp(`id=["']${id}["']`), `thiếu #${id}; app.js không thể render đúng`);
  }
  assert.match(appVue, /onMounted\(async \(\) => \{[\s\S]*await nextTick\(\);[\s\S]*legacy\.src = '\/app\.js';[\s\S]*appendChild\(legacy\)/,
    'legacy app.js phải chỉ nạp sau khi Vue shell render xong');
});

test('UI-CHAR-003: ma trận hiện trạng phủ 36 flow/150 route và ghi Native-Mobile là missing cho hai role', () => {
  const flowRows = tableRows(matrix, 'F\\d{3}\\s*\\|');
  assert.equal(flowRows.length, 36, 'G1A.6 phải kiểm soát toàn bộ 36 business/UI flow, không chỉ nav');

  const routeIds = flowRows.flatMap((line) => [...line.matchAll(/R\d{3}/g)].map((match) => match[0]));
  assert.equal(routeIds.length, 150, '36 flow phải ánh xạ đủ 150 route');
  assert.equal(new Set(routeIds).size, 150, 'không route nào được trùng flow UI');
  for (const row of flowRows) {
    assert.equal((row.match(/N-MISSING/g) || []).length, 2,
      `${row.match(/F\d{3}/)?.[0]} phải ghi missing cho cả super_admin và executor, không suy diễn PASS`);
  }
});

test('UI-CHAR-004: compact hiện là desktop responsive, chưa phải native composition MDS', () => {
  // Đây là expected current-state để chặn mọi báo cáo "mobile pass" trước W4.1.
  assert.doesNotMatch(`${appVue}\n${appJs}\n${style}`, /mds-mobile-app|MMobileTopBar|MMobileBottomNav/,
    'nếu native composition đã được thêm, thay assertion bằng contract/runtime test native thật');
  assert.match(appVue, /class="platform-header"/, 'compact đang giữ platform header của desktop shell');
  assert.match(appVue, /class="sidebar"/, 'compact đang tái dùng desktop sidebar/drawer');
  assert.match(style, /@media\s*\(\s*max-width:\s*599px\s*\)[\s\S]*?\.sidebar\s*\{\s*display:\s*none/,
    'baseline responsive hiện chỉ ẩn sidebar dưới 600px');
  assert.doesNotMatch(style, /mds-mobile-app|mobile-bottom-nav/,
    'không được diễn giải CSS responsive hiện tại thành native bottom navigation');
});

test('UI-CHAR-005: đổi hash chỉ được giữ đúng một Vue strangler route, không để mini-app cũ còn trên DOM', () => {
  for (const routeRef of ['peopleFeatureRoute', 'peopleListFeatureRoute', 'partnerFeatureRoute', 'partnerListFeatureRoute', 'supplierFeatureRoute', 'supplierListFeatureRoute', 'interactionsFeatureRoute', 'eventsFeatureRoute', 'awardsFeatureRoute', 'monitoringFeatureRoute', 'reportsFeatureRoute', 'adminFeatureRoute', 'remindersFeatureRoute', 'dashboardFeatureRoute']) {
    assert.match(appVue, new RegExp(`uiFeatureRouteRefs = Object\\.freeze\\(\\[[\\s\\S]*${routeRef}`), `${routeRef} phải vào cùng tập reset`);
  }
  assert.match(appVue, /function clearUiFeatureRoutes\(\) \{ for \(const routeRef of uiFeatureRouteRefs\) routeRef\.value = null; \}/,
    'router phải clear mọi mini-app trước khi claim hash mới');
  assert.match(appVue, /const resolveUiFeatureRoute = \(key\) => \{ clearUiFeatureRoutes\(\); return resolveDashboardRoute/,
    'reset phải chạy trước chuỗi resolver, không phụ thuộc thứ tự route cũ');
});

test('UI-LOGIN-001: màn hình không có lối tắt/bypass đăng nhập demo', () => {
  assert.doesNotMatch(appVue, /Đăng nhập nhanh|class="quick"|data-u=|data-p=/,
    'login Vue chỉ được nhận tài khoản/mật khẩu người dùng tự nhập');
  assert.doesNotMatch(appJs, /querySelectorAll\('\.quick button'\)|doLogin\(b\.dataset\.u, b\.dataset\.p\)/,
    'legacy app.js không được giữ handler tự điền/tự đăng nhập demo');
  assert.doesNotMatch(style, /\.quick(?:\s|\.|\{)/,
    'CSS của lối tắt cũ phải được xoá cùng UI');
  assert.match(appVue, /<form id="loginForm">[\s\S]*?id="username"[\s\S]*?id="password"[\s\S]*?type="submit"/,
    'login chuẩn vẫn yêu cầu đủ hai credential do người dùng nhập');
});
