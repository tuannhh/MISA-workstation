'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../policy-engine');

const viewer = { id: 1, role: 'viewer' }, staff = { id: 2, role: 'executor' }, admin = { id: 3, role: 'admin' };
test('D13-001: classification tier bất biến cho tiền và PII; field lạ là Public', () => {
  assert.equal(policy.classification('person', 'bank_account_number'), 'Restricted');
  assert.equal(policy.classification('person', 'personality'), 'Confidential');
  assert.equal(policy.classification('person', 'gift_rules'), 'Confidential');
  assert.equal(policy.classification('booking', 'amount'), 'Confidential');
  assert.equal(policy.classification('person', 'full_name'), 'Public');
});
test('D13-002: viewer chỉ đọc field Public được public; config corrupt không public hóa Confidential', () => {
  assert.equal(policy.canReadField({ principal: viewer, entity: 'person', field: 'full_name', isPublic: true }), true);
  assert.equal(policy.canReadField({ principal: viewer, entity: 'person', field: 'phone_personal', isPublic: true }), false);
});
test('D13-003: executor đọc full record direct mình sở hữu, không đọc sensitive record người khác', () => {
  assert.equal(policy.canReadField({ principal: staff, entity: 'booking', field: 'amount', record: { owner_id: 2 } }), true);
  assert.equal(policy.canReadField({ principal: staff, entity: 'booking', field: 'amount', record: { owner_id: 9 } }), false);
});
test('D13-004: write matrix fail-closed: viewer không ghi, staff chỉ edit direct owner, admin bypass', () => {
  assert.equal(policy.canWrite({ principal: viewer, entity: 'booking', action: 'create' }), false);
  assert.equal(policy.canWrite({ principal: staff, entity: 'booking', action: 'edit', record: { owner_id: 2 } }), true);
  assert.equal(policy.canWrite({ principal: staff, entity: 'booking', action: 'edit', record: { owner_id: 9 } }), false);
  assert.equal(policy.canWrite({ principal: staff, entity: 'booking', action: 'delete', record: { owner_id: 2 } }), false);
  assert.equal(policy.canWrite({ principal: admin, entity: 'budget', action: 'edit' }), true);
});
test('D13-005: gifts dùng responsible_user_id, không nhầm owner_id người nhận quà', () => {
  assert.equal(policy.canWrite({ principal: staff, entity: 'gift', action: 'edit', record: { owner_id: 999, responsible_user_id: 2 } }), true);
});
