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

async function domain() {
  return import(pathToFileURL(path.join(featureRoot, 'domain', 'partner-detail.mjs')).href);
}
async function writeDomain() {
  return import(pathToFileURL(path.join(featureRoot, 'domain', 'partner-write.mjs')).href);
}
async function cooperationDomain() {
  return import(pathToFileURL(path.join(featureRoot, 'domain', 'partner-cooperation.mjs')).href);
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
  assert.deepEqual(model.agreements[0], { id: 2, ownerId: null, title: 'MOU 2026', signedDate: '02/01/2026', signedDateValue: '2026-01-02', validUntil: '02/01/2027', validUntilValue: '2027-01-02', terms: '', note: '' });
  assert.deepEqual(model.workLogs[0], { id: 3, title: 'Làm việc định kỳ', category: 'Làm việc', date: '03/02/2026', status: 'Hoàn thành' });
  assert.doesNotMatch(desktopPage, /\/api\/files\//, 'file phải đợi slice Policy/File riêng');
  assert.doesNotMatch(mobilePage, /\/api\/files\//, 'native cũng không được bypass policy file');
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
