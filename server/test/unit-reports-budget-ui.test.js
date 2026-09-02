'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('UI-REPORT-003: Budget chỉ gửi allowlist, không suy diễn amount bị che và có Desktop/Native tách riêng', async () => {
  const reports = path.join(root, 'frontend', 'src', 'features', 'reports');
  const domain = path.join(reports, 'domain');
  const { budgetPayload, budgetsViewModel } = await import(pathToFileURL(path.join(domain, 'budget-write.mjs')).href);
  const { createReportsApi } = await import(pathToFileURL(path.join(domain, 'reports-api.mjs')).href);
  const payload = budgetPayload({ period: '2026-09', amount: '12500000', note: ' Kỳ chạy chiến dịch ' });
  assert.deepEqual(payload, { period: '2026-09', amount: 12500000, note: 'Kỳ chạy chiến dịch' });
  assert.throws(() => budgetPayload({ period: '2026-9', amount: 1 }), /YYYY-MM/);
  assert.throws(() => budgetPayload({ period: '2026-09', amount: 'không phải số' }), /số tiền/);
  const rows = budgetsViewModel([{ period: '2026-09', amount: '12500000', note: 'Có quyền' }, { period: '2026-10', note: 'Không có quyền xem số tiền' }]);
  assert.equal(rows[0].amount, 12500000); assert.equal(rows[0].amountVisible, true); assert.equal(rows[1].amount, null); assert.equal(rows[1].amountVisible, false);
  const calls = []; const api = createReportsApi({ fetchFn: async (url, init = {}) => { calls.push({ url, init }); const body = init.method === 'POST' ? { ok: true } : url.endsWith('/me') ? { user: { role: 'admin' } } : { rows: [{ period: '2026-09', amount: 1 }] }; return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  assert.equal((await api.getCurrentUser()).user.role, 'admin'); assert.equal((await api.getBudgets())[0].amount, 1); await api.saveBudget(payload);
  assert.deepEqual(calls.map(({ url, init }) => [url, init.method || 'GET']), [['/api/me', 'GET'], ['/api/budgets', 'GET'], ['/api/budgets', 'POST']]); assert.deepEqual(JSON.parse(calls[2].init.body), payload);
  const feature = read('frontend/src/features/reports/ReportsOverviewFeature.vue'); const desktop = read('frontend/src/features/reports/desktop/BudgetsDesktop.vue'); const mobile = read('frontend/src/features/reports/mobile/BudgetsMobile.vue');
  assert.match(feature, /api\.getBudgets/); assert.match(feature, /api\.saveBudget/); assert.match(feature, /canManageBudgets/); assert.match(feature, /BudgetsDesktop/); assert.match(feature, /BudgetsMobile/);
  for (const component of [desktop, mobile]) { assert.match(component, /budgetPayload/); assert.match(component, /amountVisible/); assert.match(component, /<MInput/); assert.match(component, /<MEmptyState/); assert.doesNotMatch(component, /owner_id|created_by|fetch\(/); }
  assert.match(desktop, /Intl\.NumberFormat/); assert.match(mobile, /<MMobileTopBar/); assert.match(mobile, /class="mds-mobile-app/); assert.match(mobile, /--mds-mobile-safe-bottom/);
});
