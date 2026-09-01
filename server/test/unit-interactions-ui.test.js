'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path'); const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..', '..'); const featureRoot = path.join(root, 'frontend', 'src', 'features', 'interactions'); const appVue = fs.readFileSync(path.join(root, 'frontend', 'src', 'App.vue'), 'utf8'); const feature = fs.readFileSync(path.join(featureRoot, 'InteractionsListFeature.vue'), 'utf8'); const desktop = fs.readFileSync(path.join(featureRoot, 'desktop', 'InteractionsListDesktop.vue'), 'utf8'); const mobile = fs.readFileSync(path.join(featureRoot, 'mobile', 'InteractionsListMobile.vue'), 'utf8'); const desktopCreate = fs.readFileSync(path.join(featureRoot, 'desktop', 'InteractionCreateDesktop.vue'), 'utf8'); const mobileCreate = fs.readFileSync(path.join(featureRoot, 'mobile', 'InteractionCreateMobile.vue'), 'utf8');
test('UI-INT-001: Interaction List chỉ render R044 projection và có hai composition MDS', async () => {
  const { interactionsListViewModel } = await import(pathToFileURL(path.join(featureRoot, 'domain', 'interactions-view.mjs')).href);
  const model = interactionsListViewModel({ rows: [{ id: 4, date: '2026-09-01', partner_name: 'Báo Ví dụ', partner_type: 'org', channel: 'Gặp trực tiếp', result: 'Tốt', staff: 'PR', summary: 'Trao đổi kế hoạch', owner_id: 2 }], total: 1, page: 1, pageSize: 20 });
  assert.equal(model.rows[0].partnerType, 'Cơ quan'); assert.equal('ownerId' in model.rows[0], false);
  for (const component of [desktop, mobile]) { assert.match(component, /<MInput/); assert.match(component, /<MButton/); assert.match(component, /<MEmptyState/); assert.doesNotMatch(component, /owner_id|created_by/); }
  assert.match(mobile, /<MMobileTopBar/); assert.match(mobile, /--mds-mobile-safe-bottom/); assert.match(appVue, /interactionsListRead/);
});

test('UI-INT-002: Interaction Create bind đối tác từ picker, không gửi owner/created_by', async () => {
  const { toInteractionCreateDraft, toInteractionCreatePayload } = await import(pathToFileURL(path.join(featureRoot, 'domain', 'interaction-write.mjs')).href);
  const payload = toInteractionCreatePayload({ ...toInteractionCreateDraft(), summary: 'Trao đổi kế hoạch' }, { type: 'org', id: 9, name: 'Báo Ví dụ' });
  assert.equal(payload.partner_type, 'org'); assert.equal(payload.partner_id, 9); assert.equal(payload.partner_name, 'Báo Ví dụ');
  for (const forbidden of ['owner_id', 'created_by', 'caretaker_ids']) assert.equal(forbidden in payload, false);
  assert.throws(() => toInteractionCreatePayload(toInteractionCreateDraft(), null), /chọn một đối tác/);
});

test('UI-INT-003: Interaction Create có action theo quyền và hai composition MDS riêng', () => {
  assert.match(desktop, /v-if="canCreate"/); assert.match(mobile, /v-if="canCreate"/); assert.match(feature, /:can-create="canCreate"/); assert.match(feature, /@create="beginCreate"/); assert.match(feature, /api\.searchEntities/); assert.match(feature, /api\.create/);
  for (const component of [desktopCreate, mobileCreate]) { assert.match(component, /<MInput/); assert.match(component, /<MSelect/); assert.match(component, /<MTextarea/); assert.match(component, /toInteractionCreatePayload/); assert.doesNotMatch(component, /owner_id|created_by|caretaker_ids/); }
  assert.match(desktopCreate, /sticky bottom-0/); assert.match(mobileCreate, /<MMobileTopBar/); assert.match(mobileCreate, /<MDialog/); assert.match(mobileCreate, /--mds-mobile-safe-bottom/);
});
