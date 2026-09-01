'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..', '..');
const featureRoot = path.join(root, 'frontend', 'src', 'features', 'suppliers');
const appVue = fs.readFileSync(path.join(root, 'frontend', 'src', 'App.vue'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const feature = fs.readFileSync(path.join(featureRoot, 'SupplierDetailFeature.vue'), 'utf8');
const desktopPage = fs.readFileSync(path.join(featureRoot, 'desktop', 'SupplierDetailPage.vue'), 'utf8');
const mobilePage = fs.readFileSync(path.join(featureRoot, 'mobile', 'SupplierDetailPageMobile.vue'), 'utf8');
const desktopEdit = fs.readFileSync(path.join(featureRoot, 'desktop', 'SupplierEditFormDesktop.vue'), 'utf8');
const mobileEdit = fs.readFileSync(path.join(featureRoot, 'mobile', 'SupplierEditFormMobile.vue'), 'utf8');
async function domain() { return import(pathToFileURL(path.join(featureRoot, 'domain', 'supplier-detail.mjs')).href); }
async function writeDomain() { return import(pathToFileURL(path.join(featureRoot, 'domain', 'supplier-write.mjs')).href); }

test('UI-SUP-001: Supplier Detail có Desktop MDS và Native mini-app độc lập', () => {
  assert.match(desktopPage, /shadow-\[var\(--mds-shadow-card\)\]/, 'desktop dùng card token MDS');
  assert.match(desktopPage, /<MButton/, 'desktop action dùng MDS control');
  assert.match(mobilePage, /class="mds-mobile-app/, 'native có root mini-app riêng');
  assert.match(mobilePage, /<MMobileTopBar/, 'native dùng top bar MDS');
  assert.doesNotMatch(mobilePage, /platform-header|sidebar|MHeaderBar|MSidebar|<button\b/, 'native không tái sử dụng desktop shell hay raw button');
});
test('UI-SUP-002: route Supplier chỉ claim feature flag và luôn đứng trước legacy renderer', () => {
  assert.match(appVue, /__MISA_UI_FEATURE_FLAGS__\?\.supplierDetailRead === true/, 'supplier pilot phải opt-in qua cờ host');
  assert.match(appVue, /uiSupplierPilot/, 'local harness dùng query flag tường minh');
  assert.match(appVue, /uiSupplierSurface/, 'surface native supplier dùng query flag riêng');
  assert.match(appVue, /surface !== HostSurface\.NATIVE[\s\S]*hostUnavailable: true/, 'native thiếu adapter fail-closed, không fallback desktop');
  const seam = appJs.indexOf('window.__misaUiFeatureRouter?.resolve?.(key)');
  const legacyRender = appJs.indexOf("$('#view').innerHTML");
  assert.ok(seam >= 0 && seam < legacyRender, 'feature seam phải chạy trước legacy DOM render');
  assert.match(appJs, /featureType === 'suppliers' \? 'suppliers' : null/, 'supplier route giữ active navigation đúng module');
});
test('UI-SUP-003: view model chỉ dùng record đã projection, không mang sub-resource hoặc fallback dữ liệu tiền', async () => {
  const { supplierDetailViewModel } = await domain();
  const model = supplierDetailViewModel({ record: { id: 4, name: 'NCC MISA', industry: 'Sự kiện', service_fee_pct: 5 }, transactions: [{ value: 9000000 }], quotes: [{ unit_price: 3000000 }], contacts: [{ phone: '0900000000' }] });
  assert.equal(model.name, 'NCC MISA');
  assert.ok(model.fields.some(([label, value]) => label === 'Phí phục vụ' && value === '5%'), 'chỉ property server trả về mới được hiện');
  assert.doesNotMatch(JSON.stringify(model), /9000000|3000000|0900000000/, 'slice read không được mang giao dịch, báo giá hay contact sang client model');
  const masked = supplierDetailViewModel({ record: { id: 5, name: 'NCC khác' } });
  assert.ok(masked.fields.every(([label]) => !/Phí phục vụ|đặt cọc/i.test(label)), 'không suy đoán field Confidential khi API không projection');
});
test('UI-SUP-004: lifecycle, deep link và Back đi qua host adapter contract', () => {
  for (const token of ['HostEvent.VIEWPORT', 'HostEvent.LIFECYCLE', 'HostEvent.DEEP_LINK', "adapter.goBack({ reason: 'supplier-detail' })"]) assert.match(feature, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${token} phải đi qua adapter`);
  assert.doesNotMatch(feature, /navigator\.mediaDevices|window\.addEventListener\(['"](resize|popstate)/, 'feature không tự gọi device/browser bridge ngoài contract');
});
test('UI-SUP-005: write chỉ gửi allowlist Public, không mang điều khoản thương mại hoặc đầu mối', async () => {
  const { SUPPLIER_CORE_EDIT_FIELDS, toSupplierEditDraft, toSupplierUpdatePayload, validateSupplierEditDraft } = await writeDomain();
  const payload = toSupplierUpdatePayload(toSupplierEditDraft({ name: 'NCC MISA', industry: 'In ấn', service_fee_pct: 10, deposit_pct: 50, contact_phone: '0900000000', order_group_link: 'secret' }));
  assert.deepEqual(SUPPLIER_CORE_EDIT_FIELDS, ['name', 'industry', 'address', 'services', 'tax_code', 'invoice_type', 'note']);
  for (const forbidden of ['service_fee_pct', 'deposit_pct', 'contact_phone', 'contact_email', 'order_group_link', 'owner_id']) assert.equal(forbidden in payload, false, `${forbidden} không được nằm trong payload`);
  assert.equal(validateSupplierEditDraft({ name: '' }).name, 'Tên nhà cung cấp không được để trống.');
});
test('UI-SUP-006: form Desktop/Native dùng MDS và PUT vẫn do server kiểm tra lại', () => {
  for (const form of [desktopEdit, mobileEdit]) {
    assert.match(form, /<MInput/, 'form dùng input MDS');
    assert.match(form, /<MSelect/, 'form dùng select MDS');
    assert.match(form, /<MTextarea/, 'form dùng textarea MDS');
    assert.doesNotMatch(form, /service_fee_pct|deposit_pct|contact_phone|contact_email|order_group_link|owner_id/, 'form không chạm field Confidential/ngoài scope');
  }
  assert.match(mobileEdit, /<MDialog/, 'native xác nhận bỏ draft theo MDS');
  assert.match(mobileEdit, /--mds-mobile-safe-bottom/, 'native footer tôn trọng safe area');
  assert.match(feature, /api\.update\(props\.supplierId, payload\)/, 'lưu luôn qua API server-enforced');
  assert.match(feature, /permissions\?\.modules\?\.suppliers\?\.includes\('edit'\)/, 'UI permission chỉ gợi ý UX');
});
