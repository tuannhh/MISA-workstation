'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
function read(relative) { return fs.readFileSync(path.join(root, relative), 'utf8'); }

test('UI-REM-001: Reminder slice có API allowlist, feature flag và hai composition MDS', async () => {
  const api = await import(path.join(root, 'frontend/src/features/reminders/domain/reminders-api.mjs'));
  const app = read('frontend/src/App.vue');
  const feature = read('frontend/src/features/reminders/RemindersFeature.vue');
  const desktop = read('frontend/src/features/reminders/desktop/RemindersListDesktop.vue');
  const mobile = read('frontend/src/features/reminders/mobile/RemindersListMobile.vue');
  const createPayload = api.reminderPayload({ title: ' Nhắc ', event_date: '2026-12-01', recurring: 1, lead_days: 9, subject_name: ' A ', note: ' B ' }, { creating: true });
  assert.deepEqual(createPayload, { title: 'Nhắc', date_type: 'other', event_date: '2026-12-01', recurring: 1, lead_days: 9, subject_name: 'A', note: 'B', subject_type: 'general' });
  assert.throws(() => api.reminderPayload({ title: 'Nhắc', event_date: '' }), /ngày sự kiện/);
  assert.equal(Object.hasOwn(createPayload, 'subject_id'), false, 'generic form không được nhận linkage entity do client tự gán');
  assert.match(app, /isRemindersPilotEnabled\(\).*remindersList/);
  assert.match(app, /resolveRemindersRoute\(key\).*key !== 'reminders'/);
  assert.match(feature, /permissions\?\.modules\?\.reminders\?\.includes\('delete'\)/);
  assert.match(feature, /markNotificationRead\(record\)/);
  assert.match(feature, /markAllNotificationsRead\(\)/);
  assert.match(read('frontend/src/features/reminders/desktop/ReminderNotificationsDesktop.vue'), /Đánh dấu đã đọc/);
  assert.match(read('frontend/src/features/reminders/mobile/ReminderNotificationsMobile.vue'), /--mds-mobile-touch-target/);
  assert.match(desktop, /<section class="min-h-0 bg-\[var\(--mds-bg-page\)\]/);
  assert.match(mobile, /class="mds-mobile-app flex h-\[100dvh\]/);
  assert.match(mobile, /--mds-mobile-touch-target/);
});
