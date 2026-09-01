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

test('UI-VOICE-001: Voice API chỉ gửi audio qua propose và buộc idempotency khi confirm', async () => {
  const { createVoiceApi, createVoiceIdempotencyKey } = await import(pathToFileURL(path.join(root, 'frontend', 'src', 'features', 'voice', 'domain', 'voice-api.mjs')).href);
  const calls = []; const api = createVoiceApi({ fetchFn: async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify(url.endsWith('propose') ? { proposalId: 'p-1', expiresAt: '2026-09-01 12:00:00', extracted: {}, personCandidates: [], orgCandidates: [], matchConfidence: {}, suggestedScoreDelta: 0 } : { interactionId: 9 }), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  const proposal = await api.propose(new Blob(['audio'], { type: 'audio/webm' })); assert.equal(proposal.proposalId, 'p-1'); assert.equal(calls[0].init.headers, undefined); assert.ok(calls[0].init.body instanceof FormData);
  await api.confirm({ proposalId: 'p-1', idempotencyKey: 'key-1', edits: { summary: 'Đã sửa' } }); assert.match(calls[1].url, /interaction-voice-confirm$/); assert.match(calls[1].init.body, /key-1/); assert.equal(createVoiceIdempotencyKey(() => 'uuid-1'), 'uuid-1');
  await assert.rejects(() => api.confirm({ proposalId: 'p-1' }), /mã xác nhận an toàn/);
});

test('UI-VOICE-002: Voice review có hai composition MDS và luôn buộc user xác nhận', () => {
  const voiceRoot = path.join(root, 'frontend', 'src', 'features', 'voice'); const voiceDesktop = fs.readFileSync(path.join(voiceRoot, 'desktop', 'VoiceProposalDesktop.vue'), 'utf8'); const voiceMobile = fs.readFileSync(path.join(voiceRoot, 'mobile', 'VoiceProposalMobile.vue'), 'utf8');
  for (const component of [voiceDesktop, voiceMobile]) { assert.match(component, /<MUpload/); assert.match(component, /<MRadioGroup/); assert.match(component, /Xác nhận ghi tương tác/); assert.doesNotMatch(component, /owner_id|created_by/); }
  assert.match(voiceMobile, /<MMobileTopBar/); assert.match(voiceMobile, /<MDialog/); assert.match(voiceMobile, /--mds-mobile-safe-bottom/); assert.match(feature, /VoiceProposalDesktop/); assert.match(feature, /VoiceProposalMobile/); assert.match(feature, /createVoiceIdempotencyKey/);
});

test('UI-EVENT-001: Event core chỉ gửi Public allowlist, không nhận tiền/file/owner', async () => {
  const eventRoot = path.join(root, 'frontend', 'src', 'features', 'events', 'domain'); const { EVENT_PUBLIC_FIELDS, toEventDraft, toEventPayload } = await import(pathToFileURL(path.join(eventRoot, 'event-write.mjs')).href); const payload = toEventPayload({ ...toEventDraft(), name: 'Hội nghị truyền thông', owner_id: 99, total_cost: 9000000, attachments: ['x'] });
  assert.equal(payload.name, 'Hội nghị truyền thông'); for (const forbidden of ['owner_id', 'total_cost', 'attachments', 'caretaker_ids']) assert.equal(forbidden in payload, false); assert.ok(EVENT_PUBLIC_FIELDS.includes('start_time')); assert.throws(() => toEventPayload({}), /Tên sự kiện/);
});

test('UI-EVENT-001B: Event API tạo query list hợp lệ và chỉ nhận projection rows', async () => {
  const { createEventsApi } = await import(pathToFileURL(path.join(root, 'frontend', 'src', 'features', 'events', 'domain', 'events-api.mjs')).href); let url = ''; const api = createEventsApi({ fetchFn: async (value) => { url = value; return new Response(JSON.stringify({ rows: [], total: 0, page: 1, pageSize: 20 }), { status: 200, headers: { 'content-type': 'application/json' } }); } }); const payload = await api.getList({ page: 0, pageSize: 999, search: 'Hội nghị' }); assert.equal(payload.total, 0); assert.match(url, /page=1/); assert.match(url, /pageSize=100/); assert.match(url, /H%E1%BB%99i/);
});

test('UI-EVENT-002: Event List có hai composition MDS, Native không dùng desktop shell', () => {
  const eventRoot = path.join(root, 'frontend', 'src', 'features', 'events'); const desktopEvent = fs.readFileSync(path.join(eventRoot, 'desktop', 'EventsListDesktop.vue'), 'utf8'); const mobileEvent = fs.readFileSync(path.join(eventRoot, 'mobile', 'EventsListMobile.vue'), 'utf8'); const featureEvent = fs.readFileSync(path.join(eventRoot, 'EventsListFeature.vue'), 'utf8');
  for (const component of [desktopEvent, mobileEvent]) { assert.match(component, /<MInput/); assert.match(component, /<MButton/); assert.match(component, /<MEmptyState/); assert.doesNotMatch(component, /total_cost|owner_id|attachments/); }
  assert.match(mobileEvent, /<MMobileTopBar/); assert.match(mobileEvent, /--mds-mobile-safe-bottom/); assert.match(featureEvent, /Native host chưa sẵn sàng/); assert.match(appVue, /eventsListRead/); assert.match(appVue, /EventsListFeature/);
});

test('UI-EVENT-003: Event Create dùng MDS, có gate quyền và không đưa cost/file vào form', () => {
  const eventRoot = path.join(root, 'frontend', 'src', 'features', 'events'); const desktopCreate = fs.readFileSync(path.join(eventRoot, 'desktop', 'EventCreateDesktop.vue'), 'utf8'); const mobileCreate = fs.readFileSync(path.join(eventRoot, 'mobile', 'EventCreateMobile.vue'), 'utf8'); const featureEvent = fs.readFileSync(path.join(eventRoot, 'EventsListFeature.vue'), 'utf8');
  for (const component of [desktopCreate, mobileCreate]) { assert.match(component, /toEventPayload/); assert.match(component, /<MInput/); assert.match(component, /<MSelect/); assert.match(component, /<MTextarea/); assert.doesNotMatch(component, /total_cost|owner_id|attachments/); } assert.match(featureEvent, /events.*includes\('create'\)/); assert.match(desktopCreate, /sticky bottom-0/); assert.match(mobileCreate, /<MMobileTopBar/); assert.match(mobileCreate, /<MDialog/);
});

test('UI-EVENT-004: Event Detail dùng projection public, có route Desktop/Native riêng và không suy ra chi phí/tệp', async () => {
  const eventRoot = path.join(root, 'frontend', 'src', 'features', 'events'); const domainRoot = path.join(eventRoot, 'domain'); const desktopDetail = fs.readFileSync(path.join(eventRoot, 'desktop', 'EventDetailDesktop.vue'), 'utf8'); const mobileDetail = fs.readFileSync(path.join(eventRoot, 'mobile', 'EventDetailMobile.vue'), 'utf8'); const featureEvent = fs.readFileSync(path.join(eventRoot, 'EventsListFeature.vue'), 'utf8');
  const { eventDetailViewModel } = await import(pathToFileURL(path.join(domainRoot, 'event-detail.mjs')).href);
  const model = eventDetailViewModel({ record: { id: 4, name: 'Hội nghị PR', organizer: 'MISA', location: 'Hà Nội', owner_id: 99, status: 'Đang chuẩn bị' }, totals: { grand: '●●● (đã ẩn)' }, attachments: [{ id: 2 }] });
  assert.equal(model.title, 'Hội nghị PR'); assert.equal(model.totalCost, '●●● (đã ẩn)'); assert.equal('ownerId' in model, false); assert.equal('attachments' in model, false);
  for (const component of [desktopDetail, mobileDetail]) { assert.doesNotMatch(component, /owner_id|attachments|totalCost|event_cost/); }
  assert.match(desktopDetail, /shadow-\[var\(--mds-shadow-card\)\]/); assert.match(mobileDetail, /class="mds-mobile-app/); assert.match(mobileDetail, /<MMobileTopBar/); assert.doesNotMatch(mobileDetail, /MHeaderBar|MSidebar/);
  assert.match(featureEvent, /eventDetailViewModel/); assert.match(featureEvent, /location\.hash=`events\/\$\{Number\(id\)\}`/); assert.match(appVue, /\^events\(\?:\\\/\(\\d\+\)\)\?\$/);
});

test('UI-EVENT-005: Event Edit chỉ là affordance theo quyền và vẫn gửi allowlist về PUT PolicyEngine', () => {
  const eventRoot = path.join(root, 'frontend', 'src', 'features', 'events'); const featureEvent = fs.readFileSync(path.join(eventRoot, 'EventsListFeature.vue'), 'utf8'); const desktopDetail = fs.readFileSync(path.join(eventRoot, 'desktop', 'EventDetailDesktop.vue'), 'utf8'); const mobileDetail = fs.readFileSync(path.join(eventRoot, 'mobile', 'EventDetailMobile.vue'), 'utf8'); const desktopForm = fs.readFileSync(path.join(eventRoot, 'desktop', 'EventCreateDesktop.vue'), 'utf8'); const mobileForm = fs.readFileSync(path.join(eventRoot, 'mobile', 'EventCreateMobile.vue'), 'utf8');
  assert.match(featureEvent, /events\?\.includes\('edit'\)/); assert.match(featureEvent, /api\.save\(input, props\.eventId\)/); assert.match(featureEvent, /@edit="beginEdit"/);
  for (const component of [desktopDetail, mobileDetail]) assert.match(component, /v-if="canEdit"/);
  for (const component of [desktopForm, mobileForm]) { assert.match(component, /toEventDraft\(props\.record\)/); assert.match(component, /toEventPayload\(draft\)/); assert.doesNotMatch(component, /owner_id|caretaker_ids|total_cost|attachments/); }
  assert.match(mobileForm, /<MMobileTopBar/); assert.match(mobileForm, /<MDialog/); assert.match(desktopForm, /sticky bottom-0/);
});
