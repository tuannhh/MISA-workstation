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
const feature = fs.readFileSync(path.join(featureRoot, 'PartnerDetailFeature.vue'), 'utf8');

async function domain() {
  return import(pathToFileURL(path.join(featureRoot, 'domain', 'partner-detail.mjs')).href);
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
});
