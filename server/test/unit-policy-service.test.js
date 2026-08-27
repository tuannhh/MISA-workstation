'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPolicyService, PolicyForbiddenError } = require('../policy-service');

const service = createPolicyService({ visibilityStore: { isPublic: (_module, field) => field === 'full_name' || field === 'phone_personal' } });
const viewer = { id: 1, role: 'viewer' }, executor = { id: 2, role: 'executor' }, admin = { id: 3, role: 'admin' };

test('D13-008: create derives created_by/owner server-side and rejects client owner claim', () => {
  assert.deepEqual(service.prepareCreate({ principal: executor, entity: 'booking', input: { title: 'A' } }), { title: 'A', created_by: 2, owner_id: 2 });
  assert.throws(() => service.prepareCreate({ principal: executor, entity: 'booking', input: { owner_id: 9 } }), PolicyForbiddenError);
  assert.throws(() => service.prepareCreate({ principal: viewer, entity: 'booking', input: {} }), PolicyForbiddenError);
});
test('D13-009: owner transfer is explicit admin-only; created_by is immutable', () => {
  const record = { owner_id: 2, created_by: 2 };
  assert.throws(() => service.prepareUpdate({ principal: executor, entity: 'booking', record, input: { owner_id: 9 } }), /OWNER_TRANSFER_ADMIN_ONLY/);
  assert.deepEqual(service.prepareUpdate({ principal: admin, entity: 'booking', record, input: { owner_id: 9 } }), { owner_id: 9 });
  assert.throws(() => service.prepareUpdate({ principal: admin, entity: 'booking', record, input: { created_by: 9 } }), /CREATED_BY_IMMUTABLE/);
});
test('D13-010: projection omits private/Confidential fields before response shaping', () => {
  const record = { full_name: 'Nguyen A', phone_personal: '0900', bank_name: 'MISA Bank', owner_id: 2 };
  assert.deepEqual(service.projectRecord({ principal: viewer, entity: 'person', module: 'partners', record }), { full_name: 'Nguyen A' });
  assert.deepEqual(service.projectRecord({ principal: executor, entity: 'booking', module: 'partners', record: { ...record, owner_id: 2 } }), record);
});
