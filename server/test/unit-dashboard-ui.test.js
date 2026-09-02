'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..', '..');
const featureRoot = path.join(root, 'frontend', 'src', 'features', 'dashboard');
const app = fs.readFileSync(path.join(root, 'frontend', 'src', 'App.vue'), 'utf8');
const feature = fs.readFileSync(path.join(featureRoot, 'DashboardFeature.vue'), 'utf8');
const desktop = fs.readFileSync(path.join(featureRoot, 'desktop', 'DashboardDesktop.vue'), 'utf8');
const mobile = fs.readFileSync(path.join(featureRoot, 'mobile', 'DashboardMobile.vue'), 'utf8');

test('UI-DASH-001: Dashboard chỉ render projection /api/dashboard và có hai composition MDS độc lập', async () => {
  const { createDashboardApi } = await import(pathToFileURL(path.join(featureRoot, 'domain', 'dashboard-api.mjs')).href);
  const { dashboardViewModel } = await import(pathToFileURL(path.join(featureRoot, 'domain', 'dashboard-view.mjs')).href);
  let request;
  const api = createDashboardApi({ fetchFn: async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      month: 9, year: 2026,
      overview: { press: { total: '7', reporters: '9', vipBdMonth: 1 }, assoc: { total: 3, annivMonth: 2, feeDueMonth: 1 }, events: { hostMonth: 4, sponsorMonth: 5, keynoteMonth: 6 } },
      charts: { reportersByBeat: [{ label: 'Công nghệ', value: '5' }], assocByField: [] },
      upcoming: [{ title: 'Kỷ niệm thành lập', event_date: '2026-09-10', daysUntil: 8, note: 'không render' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  const payload = await api.getOverview();
  assert.equal(request.url, '/api/dashboard');
  assert.equal(request.options.credentials, 'same-origin');
  const model = dashboardViewModel(payload);
  assert.equal(model.groups[0].stats[0].value, 7);
  assert.equal(model.charts[0].rows[0].value, 5);
  assert.equal('note' in model.upcoming[0], false, 'view model không giữ metadata/note ngoài nhu cầu render');
  for (const component of [desktop, mobile]) {
    assert.match(component, /<MButton/);
    assert.match(component, /<MEmptyState/);
    assert.doesNotMatch(component, /<button\b/, 'mọi control tương tác của dashboard phải đi qua MDS');
    assert.doesNotMatch(component, /membership_fee|amountMasked|owner_id|created_by|note/);
  }
  assert.match(mobile, /class="mds-mobile-app/);
  assert.match(mobile, /<MMobileBottomNav/);
  assert.match(mobile, /--mds-mobile-safe-bottom/);
  assert.doesNotMatch(mobile, /MHeaderBar|MSidebar/);
  assert.match(feature, /api\.getOverview/);
  assert.match(feature, /Native host chưa sẵn sàng/);
  assert.match(app, /dashboardOverviewRead/);
  assert.match(app, /uiDashboardPilot/);
  assert.match(app, /uiDashboardSurface/);
});

test('UI-DASH-002: taskbar Native có entry Tổng quan và không rơi về legacy desktop', () => {
  assert.match(app, /dashboard: \{ label: 'Tổng quan', icon: 'layout-dashboard'/);
  assert.match(app, /url\.searchParams\.set\(target\.pilotParam, '1'\)/);
  assert.match(app, /url\.searchParams\.set\(target\.surfaceParam, HostSurface\.NATIVE\)/);
  assert.match(app, /resolveDashboardRoute\(key\)/);
  assert.match(app, /nativeDashboardFeature/);
  assert.match(mobile, /new Set\(\['dashboard', 'people', 'interactions', 'events'\]\)/);
});
