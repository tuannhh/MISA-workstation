'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..', '..');
const featureRoot = path.join(root, 'frontend', 'src', 'features', 'suppliers');
const app = fs.readFileSync(path.join(root, 'frontend', 'src', 'App.vue'), 'utf8');
const feature = fs.readFileSync(path.join(featureRoot, 'SupplierListFeature.vue'), 'utf8');
const desktop = fs.readFileSync(path.join(featureRoot, 'desktop', 'SupplierListDesktop.vue'), 'utf8');
const mobile = fs.readFileSync(path.join(featureRoot, 'mobile', 'SupplierListMobile.vue'), 'utf8');
const createDesktop = fs.readFileSync(path.join(featureRoot, 'desktop', 'SupplierCreateDesktop.vue'), 'utf8');
const createMobile = fs.readFileSync(path.join(featureRoot, 'mobile', 'SupplierCreateMobile.vue'), 'utf8');

test('UI-SUPPLIER-LIST-001: list/create chỉ nhận projection và không gửi dữ liệu thương mại', async () => {
  const { createSupplierApi } = await import(pathToFileURL(path.join(featureRoot, 'domain', 'supplier-api.mjs')).href);
  const { supplierListViewModel, supplierCreateDraft, toSupplierCreatePayload, validateSupplierCreateDraft } = await import(pathToFileURL(path.join(featureRoot, 'domain', 'supplier-list.mjs')).href);
  const calls = [];
  const api = createSupplierApi({ fetchFn: async (url, init = {}) => { calls.push({ url, init }); return new Response(JSON.stringify(init.method === 'POST' ? { id: 21 } : { rows: [{ id: 5, name: 'MISA Media', industry: 'Truyền thông', services: 'Sản xuất', service_fee_pct: 15, deposit_pct: 30 }], total: 1, page: 1, pageSize: 20 }), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  const model = supplierListViewModel(await api.getList({ page: 1, search: 'MISA' }));
  assert.equal(calls[0].url, '/api/suppliers?page=1&pageSize=20&search=MISA');
  assert.equal(model.rows[0].name, 'MISA Media'); assert.equal('service_fee_pct' in model.rows[0], false); assert.equal('deposit_pct' in model.rows[0], false);
  const draft = { ...supplierCreateDraft(), name: 'Nhà cung cấp mới', service_fee_pct: 15, deposit_pct: 30 };
  assert.deepEqual(validateSupplierCreateDraft(draft), {});
  const payload = toSupplierCreatePayload(draft);
  assert.equal('service_fee_pct' in payload, false); assert.equal('deposit_pct' in payload, false);
  await api.createSupplier(payload); assert.equal(calls[1].url, '/api/suppliers'); assert.equal(calls[1].init.method, 'POST');
  for (const component of [desktop, mobile, createDesktop, createMobile]) { assert.match(component, /<MButton/); assert.doesNotMatch(component, /<button\b/); assert.doesNotMatch(component, /service_fee_pct|deposit_pct/); }
});

test('UI-SUPPLIER-LIST-002: route Native fail-closed, có safe area/taskbar và action tạo qua API server', () => {
  assert.match(app, /supplierListRead/); assert.match(app, /resolveSupplierListRoute\(key\)/); assert.match(app, /uiSupplierSurface/); assert.match(app, /nativeSupplierListFeature/); assert.match(app, /suppliers: \{ label: 'Nhà cung cấp'/);
  assert.match(feature, /api\.createSupplier/); assert.match(feature, /permissions\?\.modules\?\.suppliers\?\.includes\('create'\)/);
  assert.match(mobile, /class="mds-mobile-app/); assert.match(mobile, /<MMobileBottomNav/); assert.match(mobile, /--mds-mobile-safe-bottom/); assert.doesNotMatch(mobile, /MHeaderBar|MSidebar/);
});
