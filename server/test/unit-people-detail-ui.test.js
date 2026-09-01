'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..', '..');
const featureRoot = path.join(root, 'frontend', 'src', 'features', 'people');
const appVue = fs.readFileSync(path.join(root, 'frontend', 'src', 'App.vue'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const desktopPage = fs.readFileSync(path.join(featureRoot, 'desktop', 'PeopleDetailPage.vue'), 'utf8');
const mobilePage = fs.readFileSync(path.join(featureRoot, 'mobile', 'PeopleDetailPageMobile.vue'), 'utf8');
const mobileEditForm = fs.readFileSync(path.join(featureRoot, 'mobile', 'PeopleEditFormMobile.vue'), 'utf8');
const feature = fs.readFileSync(path.join(featureRoot, 'PeopleDetailFeature.vue'), 'utf8');
const editForm = fs.readFileSync(path.join(featureRoot, 'desktop', 'PeopleEditFormDesktop.vue'), 'utf8');
const attachmentPanel = fs.readFileSync(path.join(featureRoot, 'PeopleAttachmentsPanel.vue'), 'utf8');
const bookingsPanel = fs.readFileSync(path.join(featureRoot, 'PeopleBookingsPanel.vue'), 'utf8');

async function domain() {
  return import(pathToFileURL(path.join(featureRoot, 'domain', 'people-detail.mjs')).href);
}
async function writeDomain() {
  return import(pathToFileURL(path.join(featureRoot, 'domain', 'people-write.mjs')).href);
}

test('UI-PPL-001: People Detail có hai composition MDS độc lập, Native không chứa desktop shell', () => {
  assert.match(desktopPage, /shadow-\[var\(--mds-shadow-card\)\]/, 'desktop card phải dùng token shadow MDS');
  assert.match(desktopPage, /<MButton/, 'desktop action phải dùng MDS control');
  assert.match(mobilePage, /class="mds-mobile-app/, 'native phải có root mini-app riêng');
  assert.match(mobilePage, /<MMobileTopBar/, 'native phải dùng top bar mini-app');
  assert.doesNotMatch(mobilePage, /platform-header|sidebar|MHeaderBar|MSidebar/, 'native không được tái sử dụng desktop shell');
  assert.doesNotMatch(mobilePage, /<button\b/, 'page native không được tự chế raw button');
});

test('UI-PPL-002: route chỉ được strangler claim qua cờ host, trước legacy renderer', () => {
  assert.match(appVue, /__MISA_UI_FEATURE_FLAGS__\?\.peopleDetailRead === true/, 'pilot phải opt-in qua cờ host, mặc định không cướp write/file legacy');
  assert.doesNotMatch(appVue, /userAgent|innerWidth|matchMedia|role.*HostSurface|HostSurface.*role/, 'surface không được suy diễn từ UA, viewport hay role');
  assert.match(appVue, /surface !== HostSurface\.NATIVE[\s\S]*hostUnavailable: true/, 'Native thiếu adapter phải fail-closed, không fallback desktop');
  assert.match(appVue, /\['localhost', '127\.0\.0\.1'\]\.includes\(location\.hostname\)/, 'test harness chỉ được bật ở localhost');
  assert.match(appVue, /uiPeoplePilot/, 'visual review local phải dùng cờ query tường minh');
  const seam = appJs.indexOf('window.__misaUiFeatureRouter?.resolve?.(key)');
  const legacyRender = appJs.indexOf("$('#view').innerHTML");
  assert.ok(seam >= 0 && seam < legacyRender, 'feature seam phải chạy trước legacy DOM render');
});

test('UI-PPL-003: lifecycle, deep link và Back đều đi qua host adapter contract', () => {
  for (const token of ['HostEvent.VIEWPORT', 'HostEvent.LIFECYCLE', 'HostEvent.DEEP_LINK', "adapter.goBack({ reason: 'people-detail' })"]) {
    assert.match(feature, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${token} phải đi qua adapter`);
  }
  assert.doesNotMatch(feature, /navigator\.mediaDevices|window\.addEventListener\(['"](resize|popstate)/, 'feature không tự gọi device/browser bridge ngoài contract');
});

test('UI-PPL-004: view model chỉ hiển thị field API đã chiếu, không dựng field nhạy cảm', async () => {
  const { peopleDetailViewModel, fileUrl, initials } = await domain();
  const model = peopleDetailViewModel({
    record: { id: 8, full_name: 'Nguyễn Thu Hà', position: 'Phóng viên', org_name: 'Báo MISA', phone_personal: '0900000000', bank_account_number: '123' },
    portraits: [{ id: 12, is_primary: 1 }], idDocCount: 2,
  });
  assert.equal(model.initials, 'TH');
  assert.equal(fileUrl(model.primaryPortrait.id), '/api/files/12');
  assert.ok(model.publicFields.every(([label]) => !/cá nhân|ngân hàng|địa chỉ/i.test(label)), 'UI read không được tự đưa sensitive field vào view model');
  assert.equal(initials(''), '?');
  assert.equal(fileUrl('not-an-id'), null);
});

test('UI-PPL-005: write domain chỉ gửi nhóm field đã chọn, validate tên và không tự gắn owner/quyền', async () => {
  const { PEOPLE_EDIT_FIELDS, PEOPLE_COMPACT_EDIT_FIELDS, toPeopleEditDraft, toPeopleUpdatePayload, validatePeopleEditDraft } = await writeDomain();
  const draft = toPeopleEditDraft({ full_name: 'Nguyễn Thu Hà', relationship_score: '7', owner_id: 999 });
  const payload = toPeopleUpdatePayload(draft);
  assert.equal(payload.relationship_score, 7);
  assert.equal('owner_id' in payload, false);
  assert.ok(PEOPLE_EDIT_FIELDS.includes('phone_personal'), 'field có thể được request nhưng server vẫn quyết định quyền ghi');
  assert.equal('phone_personal' in payload, false, 'form compact không được ghi đè field nhạy cảm chưa được chiếu');
  assert.ok(PEOPLE_COMPACT_EDIT_FIELDS.every((field) => field in payload));
  assert.equal(validatePeopleEditDraft({ full_name: '', relationship_score: 'x' }).full_name, 'Họ và tên không được để trống.');
});

test('UI-PPL-006: Desktop edit dùng control MDS, payload tối thiểu và lỗi server hiển thị rõ', () => {
  assert.match(editForm, /<MInput/, 'form phải dùng MInput MDS');
  assert.match(editForm, /<MButton variant="primary"/, 'submit phải dùng MButton MDS');
  assert.match(editForm, /serverError/, 'lỗi quyền/validation từ server không được nuốt');
  assert.doesNotMatch(editForm, /owner_id|phone_personal|home_address|personal_notes/, 'form public không được đưa field nhạy cảm hoặc owner vào payload');
  assert.match(feature, /api\.update\(props\.personId, payload\)/, 'feature phải gọi API server-enforced khi lưu');
  assert.match(feature, /permissions\?\.modules\?\.partners\?\.includes\('edit'\)/, 'chỉ dùng permission để gợi ý UX; server vẫn là source of truth');
});

test('UI-PPL-007: Native edit là composition riêng, có footer safe-area và xác nhận bỏ draft', () => {
  assert.match(mobileEditForm, /class="mds-mobile-app/, 'native edit phải là mini-app riêng');
  assert.match(mobileEditForm, /MMobileTopBar/, 'native edit phải có top bar MDS');
  assert.match(mobileEditForm, /MDialog/, 'Back/Hủy có draft phải xác nhận theo MDS');
  assert.match(mobileEditForm, /--mds-mobile-safe-bottom/, 'footer phải tôn trọng safe area host');
  assert.doesNotMatch(mobileEditForm, /platform-header|sidebar|MHeaderBar|MSidebar/, 'native edit không tái sử dụng shell desktop');
  assert.match(feature, /state\.mode === 'read'/, 'foreground không được tự reload làm mất draft đang sửa');
});

test('UI-PPL-008: Tệp People Detail dùng MDS upload, chỉ nhận projection và luôn quay về API protected', async () => {
  const { peopleDetailViewModel } = await domain();
  const model = peopleDetailViewModel({ record: { id: 8, full_name: 'Nguyễn Thu Hà' }, portraits: [{ id: 12, kind: 'portrait' }], idDocs: [{ id: 13, kind: 'id_doc' }], idDocCount: 1 });
  assert.equal(model.portraits[0].id, 12);
  assert.equal(model.idDocs[0].id, 13);
  assert.match(attachmentPanel, /<MUpload/, 'file picker phải dùng MDS upload');
  assert.match(attachmentPanel, /<MDialog/, 'xóa file phải xác nhận');
  assert.match(attachmentPanel, /fileUrl\(file\.id\)/, 'mở file luôn qua /api/files/:id có bảo vệ');
  assert.match(feature, /api\.upload\(props\.personId/, 'upload phải đi qua API server-enforced');
  assert.match(feature, /api\.deleteAttachment\(attachmentId\)/, 'xóa phải đi qua API server-enforced');
});

test('UI-PPL-009: Xóa hồ sơ có UX confirm nhưng luôn thực thi lại qua API PolicyEngine', () => {
  assert.match(desktopPage, /Xóa hồ sơ nhân sự\?/);
  assert.match(mobilePage, /Xóa hồ sơ nhân sự\?/);
  assert.match(desktopPage, /<MDialog/);
  assert.match(mobilePage, /<MDialog/);
  assert.match(feature, /api\.deletePerson\(props\.personId\)/);
  assert.match(feature, /\['admin', 'super_admin'\]/, 'UI chỉ gợi ý delete cho role phù hợp, không thay thế policy server');
});

test('UI-PARTNER-ADD-001: bốn loại cơ quan đều mở đúng form và gửi POST /partners', () => {
  for (const type of ['press', 'association', 'gov', 'other']) {
    assert.match(appJs, new RegExp(`${type}: \\{ label:`), `${type} phải còn trong danh mục cơ quan`);
  }
  assert.match(appJs, /\$\('#addBtn'\)\.onclick = \(\) => orgForm\(type, \{\}\)/,
    'nút Thêm của màn danh sách cơ quan phải luôn mở form theo đúng loại');
  assert.match(appJs, /data\.org_type = type;[\s\S]*?api\('POST', '\/partners', data\)/,
    'form tạo mới phải gắn loại cơ quan ở client và gọi đúng API tạo');
});

test('UI-PPL-010: Booking trong People Detail chỉ nhận projection, không tự tổng hợp tiền ở client', async () => {
  const { peopleBookingsViewModel } = await domain();
  const viewer = peopleBookingsViewModel({ rows: [{ id: 7, title: 'Bài viết', status: 'Đã đặt' }], total_amount: '••••' });
  assert.equal(viewer.rows[0].hasAmount, false);
  assert.equal(viewer.totalAmount, '••••');
  const owner = peopleBookingsViewModel({ rows: [{ id: 8, title: 'Booking của tôi', amount: 1200000, status: 'Đã đăng' }], total_amount: '••••' });
  assert.equal(owner.rows[0].amount, 1200000, 'chỉ property API trả về mới được hiện');
  assert.equal(owner.totalAmount, '••••', 'aggregate giữ nguyên server response, không tính lại từ row');
  assert.match(bookingsPanel, /Số tiền chỉ hiển thị khi máy chủ đã projection/);
  assert.match(bookingsPanel, /Tổng tiền không được tự tính/);
  assert.doesNotMatch(bookingsPanel, /reduce\(|\.sum\(/, 'component không được tự tính tổng tiền');
  assert.match(feature, /api\.getBookings\(props\.personId\)/, 'booking luôn tải qua API có PolicyEngine');
});
