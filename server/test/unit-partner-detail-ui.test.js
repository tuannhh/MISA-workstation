'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..', '..');
const featureRoot = path.join(root, 'frontend', 'src', 'features', 'partners');
const appVue = fs.readFileSync(path.join(root, 'frontend', 'src', 'App.vue'), 'utf8');
const desktopPage = fs.readFileSync(path.join(featureRoot, 'desktop', 'PartnerDetailPage.vue'), 'utf8');
const mobilePage = fs.readFileSync(path.join(featureRoot, 'mobile', 'PartnerDetailPageMobile.vue'), 'utf8');
const desktopEdit = fs.readFileSync(path.join(featureRoot, 'desktop', 'PartnerEditFormDesktop.vue'), 'utf8');
const mobileEdit = fs.readFileSync(path.join(featureRoot, 'mobile', 'PartnerEditFormMobile.vue'), 'utf8');
const feature = fs.readFileSync(path.join(featureRoot, 'PartnerDetailFeature.vue'), 'utf8');
const desktopAgreementCreate = fs.readFileSync(path.join(featureRoot, 'desktop', 'PartnerAgreementCreateDesktop.vue'), 'utf8');
const desktopWorkLogCreate = fs.readFileSync(path.join(featureRoot, 'desktop', 'PartnerWorkLogCreateDesktop.vue'), 'utf8');
const mobileAgreementCreate = fs.readFileSync(path.join(featureRoot, 'mobile', 'PartnerAgreementCreateMobile.vue'), 'utf8');
const mobileWorkLogCreate = fs.readFileSync(path.join(featureRoot, 'mobile', 'PartnerWorkLogCreateMobile.vue'), 'utf8');
const mSelect = fs.readFileSync(path.join(root, 'frontend', 'src', 'components', 'mds', 'MSelect.vue'), 'utf8');
const cooperationFiles = fs.readFileSync(path.join(featureRoot, 'PartnerCooperationFilesPanel.vue'), 'utf8');

async function domain() {
  return import(pathToFileURL(path.join(featureRoot, 'domain', 'partner-detail.mjs')).href);
}
async function writeDomain() {
  return import(pathToFileURL(path.join(featureRoot, 'domain', 'partner-write.mjs')).href);
}
async function cooperationDomain() {
  return import(pathToFileURL(path.join(featureRoot, 'domain', 'partner-cooperation.mjs')).href);
}
async function partnerApiDomain() {
  return import(pathToFileURL(path.join(featureRoot, 'domain', 'partner-api.mjs')).href);
}

test('UI-PAR-001: Partner Detail chỉ claim route qua cờ host/local harness, trước legacy renderer', () => {
  assert.match(appVue, /partnerDetailRead === true/, 'partner pilot phải opt-in qua cờ host');
  assert.match(appVue, /uiPartnerPilot/, 'visual harness local phải có cờ riêng');
  assert.ok(appVue.includes('const match = /^partner\\/(\\d+)$/'), 'route partner/:id phải được claim tường minh');
  assert.doesNotMatch(appVue, /userAgent|innerWidth|matchMedia|role.*HostSurface|HostSurface.*role/, 'surface không được suy diễn từ UA, viewport hay role');
});

test('UI-PAR-002: Desktop và Native là hai composition MDS độc lập', () => {
  assert.match(desktopPage, /shadow-\[var\(--mds-shadow-card\)\]/, 'desktop card phải dùng token shadow MDS');
  assert.match(desktopPage, /<MButton/, 'desktop action phải dùng MDS control');
  assert.match(mobilePage, /class="mds-mobile-app/, 'native phải có root mini-app riêng');
  assert.match(mobilePage, /<MMobileTopBar/, 'native phải dùng top bar mini-app');
  assert.doesNotMatch(mobilePage, /platform-header|sidebar|MHeaderBar|MSidebar/, 'native không được tái sử dụng desktop shell');
  assert.doesNotMatch(mobilePage, /<button\b/, 'native không được tự chế raw button');
});

test('UI-PAR-003: view model chỉ dùng projection API, không có fallback cho hội phí', async () => {
  const { partnerDetailViewModel } = await domain();
  const unprivileged = partnerDetailViewModel({
    record: { id: 4, name: 'Hiệp hội Công nghệ', org_type: 'association', field_area: 'CNTT', phone_personal: '0900' },
    people: [{ id: 9, full_name: 'Nguyễn Thu Hà', position: 'Điều phối viên', phone_personal: '0900' }],
  });
  assert.equal(unprivileged.typeLabel, 'Hiệp hội');
  assert.ok(!unprivileged.fields.some(([label]) => label === 'Hội phí'), 'client không được suy đoán hội phí khi server không chiếu');
  assert.deepEqual(unprivileged.people[0], { id: 9, name: 'Nguyễn Thu Hà', role: 'Điều phối viên' }, 'danh sách người không đưa số cá nhân vào view model');
  const privileged = partnerDetailViewModel({ record: { id: 4, name: 'Hiệp hội Công nghệ', org_type: 'association', membership_fee: 1250000 } });
  assert.equal(privileged.fields.find(([label]) => label === 'Hội phí')?.[1], '1.250.000 đ');
});

test('UI-PAR-004: lifecycle, deep link và Back đều đi qua host adapter contract', () => {
  for (const token of ['HostEvent.VIEWPORT', 'HostEvent.LIFECYCLE', 'HostEvent.DEEP_LINK', "adapter.goBack({ reason: 'partner-detail' })"]) {
    assert.match(feature, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${token} phải đi qua adapter`);
  }
  assert.doesNotMatch(feature, /navigator\.mediaDevices|window\.addEventListener\(['"](resize|popstate)/, 'feature không tự gọi device/browser bridge ngoài contract');
  assert.match(feature, /state\.mode === 'read'/, 'foreground không được tự reload làm mất draft đang sửa');
});

test('UI-PAR-005: write compact chỉ gửi field công khai chung, không ghi đè hội phí hay type', async () => {
  const { PARTNER_COMPACT_EDIT_FIELDS, toPartnerEditDraft, toPartnerUpdatePayload, validatePartnerEditDraft } = await writeDomain();
  const draft = toPartnerEditDraft({ name: 'Cơ quan MISA', website: 'https://misa.vn', membership_fee: 999, org_type: 'association' });
  const payload = toPartnerUpdatePayload(draft);
  assert.deepEqual(PARTNER_COMPACT_EDIT_FIELDS, ['name', 'website', 'address']);
  assert.equal('membership_fee' in payload, false);
  assert.equal('org_type' in payload, false);
  assert.equal(validatePartnerEditDraft({ name: '' }).name, 'Tên cơ quan không được để trống.');
});

test('UI-PAR-006: write Desktop/Native dùng MDS form, confirm destructive và server vẫn là source quyền', () => {
  assert.match(desktopEdit, /<MInput/);
  assert.match(desktopEdit, /<MButton variant="primary"/);
  assert.match(mobileEdit, /class="mds-mobile-app/);
  assert.match(mobileEdit, /<MMobileTopBar/);
  assert.match(mobileEdit, /<MDialog/);
  assert.match(desktopPage, /<MDialog/);
  assert.match(mobilePage, /<MDialog/);
  assert.match(feature, /api\.update\(props\.partnerId, payload\)/);
  assert.match(feature, /api\.deletePartner\(props\.partnerId\)/);
  assert.match(feature, /permissions\?\.modules\?\.partners\?\.includes\('edit'\)/);
});

test('UI-PAR-007: MOU/work log chỉ hiển thị metadata đã có trong API, không đưa file vào slice read', async () => {
  const { partnerDetailViewModel } = await domain();
  const model = partnerDetailViewModel({ record: { id: 4, name: 'Bộ MISA', org_type: 'gov' }, agreements: [{ id: 2, title: 'MOU 2026', signed_date: '2026-01-02', valid_until: '2027-01-02', files: [{ id: 99 }] }], workLogs: [{ id: 3, topic: 'Làm việc định kỳ', category: 'Làm việc', work_date: '2026-02-03', status: 'Hoàn thành', files: [{ id: 100 }] }] });
  assert.deepEqual(model.agreements[0], { id: 2, ownerId: null, title: 'MOU 2026', signedDate: '02/01/2026', signedDateValue: '2026-01-02', validUntil: '02/01/2027', validUntilValue: '2027-01-02', terms: '', note: '', files: [{ id: 99, original_name: '', mime: '' }] });
  assert.deepEqual(model.workLogs[0], { id: 3, ownerId: null, title: 'Làm việc định kỳ', category: 'Làm việc', date: '03/02/2026', workDateValue: '2026-02-03', status: 'Hoàn thành', result: '', staff: '', note: '', files: [{ id: 100, original_name: '', mime: '' }] });
  assert.doesNotMatch(desktopPage, /window\.open|location\.assign/, 'desktop không bypass protected file route bằng imperative navigation');
  assert.doesNotMatch(mobilePage, /window\.open|location\.assign/, 'native không bypass protected file route bằng imperative navigation');
});

test('UI-PAR-008: tạo MOU/lịch sử là slice create hẹp, dùng MDS desktop/native và không gửi owner hay tệp', async () => {
  const { WORK_LOG_CATEGORY_OPTIONS, toAgreementCreatePayload, toAgreementDraft, toWorkLogCreatePayload, toWorkLogDraft, validateAgreementDraft, validateWorkLogDraft } = await cooperationDomain();
  assert.equal(WORK_LOG_CATEGORY_OPTIONS.length, 4, 'bốn lựa chọn phải dùng Dropdown MDS');
  assert.equal(validateAgreementDraft({ title: '', signed_date: '2026-02-01', valid_until: '2026-01-01' }).title, 'Tên thỏa thuận không được để trống.');
  assert.equal(validateAgreementDraft({ title: 'MOU', signed_date: '2026-02-01', valid_until: '2026-01-01' }).valid_until, 'Ngày hết hiệu lực phải sau hoặc bằng ngày ký.');
  assert.equal(validateWorkLogDraft({ category: 'Khác', work_date: '', topic: '' }).category, 'Vui lòng chọn loại làm việc.');
  assert.deepEqual(toAgreementCreatePayload({ ...toAgreementDraft(), title: '  MOU 2026  ', owner_id: 9, files: ['x'] }), { title: 'MOU 2026', signed_date: toAgreementDraft().signed_date, valid_until: null });
  assert.deepEqual(toWorkLogCreatePayload({ ...toWorkLogDraft(), topic: '  Làm việc định kỳ ', owner_id: 9, result: 'không gửi' }), { category: 'Làm việc tại cơ quan', work_date: toWorkLogDraft().work_date, topic: 'Làm việc định kỳ', status: 'Đang xử lý' });
  for (const component of [desktopAgreementCreate, desktopWorkLogCreate]) {
    assert.match(component, /sticky bottom-0/, 'Desktop form phải ghim footer Lưu/Hủy');
    assert.match(component, /<MButton variant="primary"/, 'Desktop có một hành động Lưu primary');
    assert.doesNotMatch(component, /<button\b/, 'Desktop không tự chế button');
  }
  for (const component of [mobileAgreementCreate, mobileWorkLogCreate]) {
    assert.match(component, /class="mds-mobile-app/, 'Native phải có composition mini-app riêng');
    assert.match(component, /<MMobileTopBar/, 'Native dùng top bar host-safe');
    assert.match(component, /pb-\[calc\(12px\+var\(--mds-mobile-safe-bottom\)\)\]/, 'Native footer phải chừa safe-area');
    assert.doesNotMatch(component, /<button\b/, 'Native không tự chế button');
  }
  assert.match(desktopWorkLogCreate, /<MSelect/, 'loại làm việc phải dùng Dropdown MDS thay select gốc');
  assert.match(mSelect, /role="combobox"/, 'MSelect có semantics keyboard/accessibility');
  assert.match(feature, /api\.createAgreement\(props\.partnerId, payload\)/);
  assert.match(feature, /api\.createWorkLog\(props\.partnerId, payload\)/);
  assert.match(feature, /state\.detail\?\.type === 'gov'/, 'create chỉ hiện cho loại đối tác bộ ngành như legacy');
});

test('UI-PAR-009: chỉ quản trị viên mới thấy xoá MOU/lịch sử và thao tác luôn có confirm MDS', () => {
  for (const component of [desktopPage, mobilePage]) {
    assert.match(component, /canDeleteCooperation/, 'nút xoá phải được tách khỏi quyền create');
    assert.match(component, /requestCooperationDelete\('agreement'/, 'MOU phải qua confirm trước khi emit xoá');
    assert.match(component, /requestCooperationDelete\('work-log'/, 'lịch sử phải qua confirm trước khi emit xoá');
    assert.match(component, /<MDialog v-model="cooperationDeleteOpen"/, 'xoá phải dùng dialog MDS');
    assert.doesNotMatch(component, /<button\b/, 'không tự chế control xoá');
  }
  assert.match(feature, /can-delete-cooperation="canDelete"/, 'UI chỉ gợi ý xoá cùng chính sách Admin/Super Admin của partner');
  assert.match(feature, /api\.deleteAgreement\(agreementId\)/, 'server phải nhận DELETE agreement');
  assert.match(feature, /api\.deleteWorkLog\(workLogId\)/, 'server phải nhận DELETE work log');
});

test('UI-PAR-010: chỉnh sửa MOU chỉ là gợi ý ownership UX, dùng MDS form và PUT do server quyết định', async () => {
  const { toAgreementEditDraft, toAgreementUpdatePayload } = await cooperationDomain();
  const draft = toAgreementEditDraft({ title: 'MOU cũ', signedDateValue: '2026-01-02', validUntilValue: '2027-01-02', terms: ' Phạm vi ', note: '' });
  assert.deepEqual(toAgreementUpdatePayload(draft), { title: 'MOU cũ', signed_date: '2026-01-02', valid_until: '2027-01-02', terms: 'Phạm vi', note: null });
  for (const component of [fs.readFileSync(path.join(featureRoot, 'desktop', 'PartnerAgreementEditDesktop.vue'), 'utf8'), fs.readFileSync(path.join(featureRoot, 'mobile', 'PartnerAgreementEditMobile.vue'), 'utf8')]) {
    assert.match(component, /<MTextarea/, 'nội dung dài phải dùng control MDS');
    assert.match(component, /Lưu thay đổi/, 'form phải có hành động lưu rõ ràng');
    assert.doesNotMatch(component, /<button\b/, 'form không tự chế button');
  }
  assert.match(feature, /Number\(item\?\.ownerId\) === Number\(state\.currentUser\?\.id\)/, 'executor chỉ được gợi ý sửa bản ghi của mình');
  assert.match(feature, /api\.updateAgreement\(state\.editingAgreement\.id, payload\)/, 'máy chủ là nơi quyết định PUT');
  assert.match(desktopPage, /canEditCooperation\(agreement\)/);
  assert.match(mobilePage, /canEditCooperation\(agreement\)/);
});

test('UI-PAR-011: chỉnh sửa work log dùng đúng MDS dropdown/radio và PUT do PolicyEngine quyết định', async () => {
  const { WORK_LOG_STATUS_OPTIONS, toWorkLogEditDraft, toWorkLogUpdatePayload } = await cooperationDomain();
  const draft = toWorkLogEditDraft({ category: 'Đối ngoại', workDateValue: '2026-03-01', title: 'Họp báo', status: 'Hoàn thành', result: 'Đã thống nhất', staff: 'Mai An', note: '' });
  assert.equal(WORK_LOG_STATUS_OPTIONS.length, 3, 'ba trạng thái phải dùng radio, không dùng select');
  assert.deepEqual(toWorkLogUpdatePayload(draft), { category: 'Đối ngoại', work_date: '2026-03-01', topic: 'Họp báo', result: 'Đã thống nhất', status: 'Hoàn thành', staff: 'Mai An', note: null });
  for (const file of ['desktop/PartnerWorkLogEditDesktop.vue', 'mobile/PartnerWorkLogEditMobile.vue']) {
    const component = fs.readFileSync(path.join(featureRoot, file), 'utf8');
    assert.match(component, /<MSelect/, 'bốn loại làm việc phải dùng Dropdown MDS');
    assert.match(component, /<MRadioGroup/, 'ba trạng thái phải dùng Radio MDS');
    assert.match(component, /<MTextarea/, 'trường nội dung dài phải dùng MDS Textarea');
    assert.doesNotMatch(component, /<button\b/, 'không tự chế button');
  }
  assert.match(feature, /api\.updateWorkLog\(state\.editingWorkLog\.id, payload\)/);
  assert.match(desktopPage, /canEditCooperation\(work\)/);
  assert.match(mobilePage, /canEditCooperation\(work\)/);
});

test('UI-PAR-012: tệp MOU/work log dùng MDS upload, chỉ mở API protected và không dựng xóa khi API chưa có policy', async () => {
  const { fileUrl, partnerDetailViewModel } = await domain();
  const model = partnerDetailViewModel({ record: { id: 4, name: 'Bộ MISA', org_type: 'gov' }, agreements: [{ id: 2, title: 'MOU', files: [{ id: 22, original_name: 'mou.pdf', mime: 'application/pdf' }] }], workLogs: [{ id: 3, topic: 'Họp', files: [{ id: 23, original_name: 'hop.pdf' }] }] });
  assert.equal(fileUrl(22), '/api/files/22');
  assert.equal(fileUrl('x'), null);
  assert.equal(model.agreements[0].files[0].original_name, 'mou.pdf');
  assert.equal(model.workLogs[0].files[0].id, 23);
  assert.match(cooperationFiles, /<MUpload/, 'chọn tệp phải dùng MDS upload');
  assert.match(cooperationFiles, /fileUrl\(file\.id\)/, 'mở tệp phải đi qua GET /api/files/:id protected');
  assert.match(cooperationFiles, /Xóa tệp chưa có API chính sách/, 'không dựng action xóa không được backend hỗ trợ');
  assert.doesNotMatch(cooperationFiles, /deleteAttachment|\/attachments\//, 'panel không gọi delete route không hỗ trợ owner agreement/work-log');
  assert.match(feature, /api\.uploadAgreementFiles\(id, files\)/);
  assert.match(feature, /api\.uploadWorkLogFiles\(id, files\)/);
  assert.match(desktopPage, /<PartnerCooperationFilesPanel/);
  assert.match(mobilePage, /<PartnerCooperationFilesPanel/);
});

test('UI-PAR-013: Agreement/Work log chỉ Admin mới có gán owner theo context và luôn dùng shared MDS confirmation', async () => {
  const { createPartnerApi } = await partnerApiDomain();
  const ownershipRoot = path.join(root, 'frontend', 'src', 'features', 'ownership');
  const calls = []; const api = createPartnerApi({ fetchFn: async (url, init = {}) => { calls.push({ url, init }); const payload = url.endsWith('/admin/users') ? { rows: [] } : { ok: true }; return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  await api.getAdminUsers(); await api.reassignOwner('agreement', 12, 4); await api.reassignOwner('work_log', 15, 4);
  assert.deepEqual(calls.map(({ url, init }) => [url, init.method || 'GET']), [['/api/admin/users', 'GET'], ['/api/admin/records/agreement/12/owner', 'PUT'], ['/api/admin/records/work_log/15/owner', 'PUT']]);
  assert.deepEqual(JSON.parse(calls[1].init.body), { owner_id: 4 }); assert.deepEqual(JSON.parse(calls[2].init.body), { owner_id: 4 }); await assert.rejects(() => api.reassignOwner('supplier_quote', 1, 4), /Entity gán lại owner/);
  for (const component of [desktopPage, mobilePage]) { assert.match(component, /canReassignCooperation/); assert.match(component, /reassign-agreement/); assert.match(component, /reassign-work-log/); assert.match(component, /Gán/); }
  assert.match(feature, /\(item\) => Boolean\(item\?\.id\) && state\.permissions\?\.modules\?\.admin\?\.includes\('edit'\)/); assert.match(feature, /canReassignCooperation\.value\(record\)/); assert.match(feature, /api\.getAdminUsers/); assert.match(feature, /api\.reassignOwner/); assert.match(feature, /OwnerReassignDesktop/); assert.match(feature, /OwnerReassignMobile/); assert.match(feature, /Xác nhận gán lại người phụ trách/); assert.match(fs.readFileSync(path.join(ownershipRoot, 'desktop', 'OwnerReassignDesktop.vue'), 'utf8'), /<MSelect/); assert.match(fs.readFileSync(path.join(ownershipRoot, 'mobile', 'OwnerReassignMobile.vue'), 'utf8'), /class="mds-mobile-app/);
});

test('UI-PAR-014: Direct records Partner chỉ dùng projection và gán owner theo context Desktop/Native', async () => {
  const { partnerDetailViewModel } = await domain();
  const model = partnerDetailViewModel({ record: { id: 12, name: 'Báo MISA', org_type: 'press' }, sponsorships: [{ id: 1, title: 'Đồng hành hội nghị', type: 'Tài trợ', amount: 7000000, owner_id: 9 }], gifts: [{ id: 2, gift_type: 'Hoa', occasion: 'Kỷ niệm', value: 900000, responsible_user_id: 8 }], fees: [{ id: 3, year: 2026, status: 'Chưa đóng', amount: 1200000, owner_id: 7 }], benefitUsages: [{ id: 4, title: 'Banner truyền thông', used_date: '2026-09-02', owner_id: 6 }] });
  for (const record of [model.sponsorships[0], model.gifts[0], model.associationFees[0], model.benefitUsages[0]]) assert.deepEqual(Object.keys(record).sort(), ['id', 'ownerId', 'subtitle', 'title'], 'view model không mang amount/value Confidential sang UI');
  assert.equal(model.gifts[0].ownerId, 8, 'gift dùng responsible_user_id làm owner policy');
  const { createPartnerApi } = await partnerApiDomain(); const calls = []; const api = createPartnerApi({ fetchFn: async (url, init = {}) => { calls.push({ url, init }); return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  for (const [entity, id] of [['sponsorship', 21], ['gift', 22], ['association_fee', 23], ['benefit_usage', 24]]) await api.reassignOwner(entity, id, 5);
  assert.deepEqual(calls.map(({ url, init }) => [url, init.method, init.body]), [['/api/admin/records/sponsorship/21/owner', 'PUT', '{"owner_id":5}'], ['/api/admin/records/gift/22/owner', 'PUT', '{"owner_id":5}'], ['/api/admin/records/association_fee/23/owner', 'PUT', '{"owner_id":5}'], ['/api/admin/records/benefit_usage/24/owner', 'PUT', '{"owner_id":5}']]);
  const desktopDirect = fs.readFileSync(path.join(featureRoot, 'desktop', 'PartnerDirectOwnershipDesktop.vue'), 'utf8'); const mobileDirect = fs.readFileSync(path.join(featureRoot, 'mobile', 'PartnerDirectOwnershipMobile.vue'), 'utf8');
  for (const component of [desktopDirect, mobileDirect]) { assert.match(component, /<MButton/); assert.match(component, /sponsorship|gift|association_fee|benefit_usage/); assert.doesNotMatch(component, /<button\b|amount|value|owner_id|responsible_user_id/); }
  assert.match(mobileDirect, /mds-mobile-touch-target/, 'mọi action Native phải đạt touch target MDS');
  for (const component of [desktopPage, mobilePage]) { assert.match(component, /PartnerDirectOwnership/); assert.match(component, /reassign-direct/); }
  assert.match(feature, /OWNER_RESOURCE_LABEL/); assert.match(feature, /responsible_user_id: record\.ownerId/); assert.match(feature, /@reassign-direct="beginOwnerReassign\(\$event\.entity, \$event\.record\)"/);
});
