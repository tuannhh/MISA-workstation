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
const filesPanel = fs.readFileSync(path.join(featureRoot, 'SupplierFilesPanel.vue'), 'utf8');
const desktopRecords = fs.readFileSync(path.join(featureRoot, 'desktop', 'SupplierDirectRecordsDesktop.vue'), 'utf8');
const mobileRecords = fs.readFileSync(path.join(featureRoot, 'mobile', 'SupplierDirectRecordsMobile.vue'), 'utf8');
async function domain() { return import(pathToFileURL(path.join(featureRoot, 'domain', 'supplier-detail.mjs')).href); }
async function writeDomain() { return import(pathToFileURL(path.join(featureRoot, 'domain', 'supplier-write.mjs')).href); }
async function apiDomain() { return import(pathToFileURL(path.join(featureRoot, 'domain', 'supplier-api.mjs')).href); }

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
  assert.match(appJs, /featureType === 'suppliers' \? 'suppliers'/, 'supplier route giữ active navigation đúng module');
});
test('UI-SUP-003: view model chỉ dùng dữ liệu server projection, không suy đoán trường tiền bị ẩn', async () => {
  const { supplierDetailViewModel } = await domain();
  const model = supplierDetailViewModel({ record: { id: 4, name: 'NCC MISA', industry: 'Sự kiện', service_fee_pct: 5 }, transactions: [{ id: 8, purpose: 'Thuê thiết bị', status: 'draft' }], quotes: [{ id: 7, item: 'Backdrop', unit: 'bộ', qty: 2 }], contacts: [{ id: 9, full_name: 'Nguyễn An', phone: '0900000000' }] });
  assert.equal(model.name, 'NCC MISA');
  assert.ok(model.fields.some(([label, value]) => label === 'Phí phục vụ' && value === '5%'), 'chỉ property server trả về mới được hiện');
  assert.equal(model.quotes[0].hasUnitPrice, false, 'không có unit_price trong projection thì browser không bịa giá');
  assert.equal(model.quotes[0].unitPrice, undefined);
  assert.equal(model.transactions[0].hasValue, false, 'không có value trong projection thì browser không bịa giá');
  assert.equal(model.transactions[0].value, undefined);
  assert.equal(model.contacts[0].phone, '0900000000', 'đầu mối chỉ dùng field server thực sự trả về');
  const privileged = supplierDetailViewModel({ record: { id: 4, name: 'NCC MISA' }, transactions: [{ id: 8, value: 9000000 }], quotes: [{ id: 7, unit_price: 3000000 }], contacts: [] });
  assert.equal(privileged.quotes[0].unitPrice, 3000000, 'giá chỉ hiện khi server đã projection');
  assert.equal(privileged.transactions[0].value, 9000000, 'giá trị giao dịch chỉ hiện khi server đã projection');
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
test('UI-SUP-007: metadata tệp hiện theo D13 existence/content, tải và upload đều do API kiểm tra lại', async () => {
  const { supplierDetailViewModel, fileUrl } = await domain();
  const model = supplierDetailViewModel({ record: { id: 4, name: 'NCC MISA' }, files: [{ id: 12, original_name: 'bao-gia.pdf', mime: 'application/pdf' }] });
  assert.equal(model.files[0].originalName, 'bao-gia.pdf');
  assert.equal(fileUrl(12), '/api/files/12');
  assert.match(filesPanel, /<MUpload/, 'picker dùng MDS upload');
  assert.match(filesPanel, /v-if="canOpen"/, 'link tải chỉ render theo policy UX');
  assert.match(filesPanel, /Hạn chế/, 'role không được tải thấy trạng thái rõ ràng');
  assert.match(feature, /api\.uploadFiles\(props\.supplierId, files\)/, 'upload qua API server-enforced');
  assert.match(feature, /\['admin', 'super_admin'\]/, 'Global supplier private file chỉ gợi ý mở cho quản trị');
  assert.doesNotMatch(JSON.stringify(model), /content|base64/i, 'model chỉ chứa metadata, không chứa nội dung tệp');
});
test('UI-SUP-008: Direct supplier records có Desktop/Native composition riêng và Admin reassignment gọi đúng endpoint allowlist', async () => {
  for (const page of [desktopPage, mobilePage]) {
    assert.match(page, /SupplierDirectRecords/, 'page dùng component chuyên biệt cho sub-resource');
    assert.match(page, /:can-reassign="canReassign"/, 'action chỉ được gợi ý theo admin.edit');
    assert.match(page, /supplier_quote|supplier_transaction|supplier_contact/, 'entity phát ra phải khớp allowlist backend');
  }
  for (const view of [desktopRecords, mobileRecords]) {
    assert.match(view, /<MButton/, 'action dùng control MDS');
    assert.match(view, /<MEmptyState/, 'empty state dùng component MDS');
    assert.doesNotMatch(view, /<button\b|<input\b|<select\b/, 'không dùng standard control thô');
  }
  assert.match(mobileRecords, /mds-mobile-gutter-x/, 'Native record list có mobile composition riêng');
  assert.match(feature, /OwnerReassignDesktop/, 'desktop dùng shared reassignment view');
  assert.match(feature, /OwnerReassignMobile/, 'native dùng shared reassignment view');
  assert.match(feature, /<MDialog/, 'mutation có bước confirmation MDS');
  assert.match(feature, /permissions\?\.modules\?\.admin\?\.includes\('edit'\)/, 'client gate chỉ là UX, server re-check');
  assert.match(feature, /api\.reassignOwner\(context\.entity, context\.id/, 'mutation đi qua API domain boundary');

  const { createSupplierApi } = await apiDomain();
  const calls = [];
  const api = createSupplierApi({ fetchFn: async (url, init = {}) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => url.endsWith('/admin/users') ? { rows: [{ id: 3, username: 'owner', active: 1 }] } : { ok: true } };
  } });
  const users = await api.getAdminUsers();
  assert.equal(users.rows[0].username, 'owner');
  for (const entity of ['supplier_quote', 'supplier_transaction', 'supplier_contact']) await api.reassignOwner(entity, 12, 3);
  assert.deepEqual(calls.slice(1).map(({ url, init }) => [url, init.method, init.body]), [
    ['/api/admin/records/supplier_quote/12/owner', 'PUT', '{"owner_id":3}'],
    ['/api/admin/records/supplier_transaction/12/owner', 'PUT', '{"owner_id":3}'],
    ['/api/admin/records/supplier_contact/12/owner', 'PUT', '{"owner_id":3}'],
  ]);
  await assert.rejects(() => api.reassignOwner('supplier', 12, 3), /Entity gán lại owner không hợp lệ/);
});
