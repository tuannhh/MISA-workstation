'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..', '..');
const featureRoot = path.join(root, 'frontend', 'src', 'features', 'partners');
const app = fs.readFileSync(path.join(root, 'frontend', 'src', 'App.vue'), 'utf8');
const feature = fs.readFileSync(path.join(featureRoot, 'PartnerListFeature.vue'), 'utf8');
const desktop = fs.readFileSync(path.join(featureRoot, 'desktop', 'PartnerListDesktop.vue'), 'utf8');
const mobile = fs.readFileSync(path.join(featureRoot, 'mobile', 'PartnerListMobile.vue'), 'utf8');
const createDesktop = fs.readFileSync(path.join(featureRoot, 'desktop', 'PartnerCreateDesktop.vue'), 'utf8');
const createMobile = fs.readFileSync(path.join(featureRoot, 'mobile', 'PartnerCreateMobile.vue'), 'utf8');

test('UI-PARTNER-LIST-001: list/create chỉ dùng API PolicyEngine và projection không mang trường mật', async () => {
  const { createPartnerApi } = await import(pathToFileURL(path.join(featureRoot, 'domain', 'partner-api.mjs')).href);
  const { partnerListViewModel, partnerCreateDraft, toPartnerCreatePayload, validatePartnerCreateDraft } = await import(pathToFileURL(path.join(featureRoot, 'domain', 'partner-list.mjs')).href);
  const calls = [];
  const api = createPartnerApi({ fetchFn: async (url, init = {}) => { calls.push({ url, init }); return new Response(JSON.stringify(init.method === 'POST' ? { id: 19 } : { rows: [{ id: 5, name: 'Báo MISA', org_type: 'press', people_count: 2, membership_fee: 999999 }], total: 1, page: 1, pageSize: 20 }), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  const list = await api.getList({ type: 'press', page: 1, search: 'MISA' });
  const model = partnerListViewModel(list, 'press');
  assert.equal(calls[0].url, '/api/partners?type=press&page=1&pageSize=20&search=MISA');
  assert.equal(model.rows[0].name, 'Báo MISA');
  assert.equal('membershipFee' in model.rows[0], false);
  const draft = { ...partnerCreateDraft('association'), name: 'Hội Truyền thông', field_area: 'Công nghệ', membership_fee: 1_000_000 };
  assert.deepEqual(validatePartnerCreateDraft(draft), {});
  const payload = toPartnerCreatePayload(draft);
  assert.equal('membership_fee' in payload, false, 'tạo base profile không gửi field Confidential');
  await api.createPartner(payload);
  assert.equal(calls[1].url, '/api/partners'); assert.equal(calls[1].init.method, 'POST');
  for (const component of [desktop, mobile, createDesktop, createMobile]) { assert.match(component, /<MButton/); assert.doesNotMatch(component, /<button\b/); assert.doesNotMatch(component, /membership_fee|caretaker_ids|owner_id/); }
});

test('UI-PARTNER-LIST-002: native route không rơi về legacy và tạo chỉ qua action server kiểm quyền', () => {
  assert.match(app, /partnerListRead/); assert.match(app, /resolvePartnerListRoute\(key\)/); assert.match(app, /uiPartnerSurface/); assert.match(app, /nativePartnerListFeature/); assert.match(feature, /api\.createPartner/); assert.match(feature, /permissions\?\.modules\?\.partners\?\.includes\('create'\)/); assert.match(mobile, /class="mds-mobile-app/); assert.match(mobile, /<MMobileBottomNav/); assert.match(mobile, /--mds-mobile-safe-bottom/); assert.doesNotMatch(mobile, /MHeaderBar|MSidebar/);
});
