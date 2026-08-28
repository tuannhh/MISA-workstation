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

// G1B.1-engine-completeness (2026-08-28) — phủ đủ toàn bộ entity trong bảng D13.4a đã
// owner-approved (02-decisions.md), không chỉ mẫu booking/gift/budget như D13-001..005.
// Batch contract: memory-bank/18-g1b-rbac-batch-contract.md#batch-g1b1-engine-completeness-2026-08-28

const DIRECT_ENTITIES = [
  'booking', 'interaction', 'award', 'event', 'sponsorship', 'agreement', 'work_log', 'gift',
  'association_fee', 'supplier_quote', 'supplier_transaction', 'supplier_contact',
  'award_participation', 'benefit_usage',
];
const GLOBAL_ENTITIES = ['organization', 'person', 'supplier', 'important_date'];
const MODULE_ADMIN_ONLY_ENTITIES = ['budget', 'scan_query', 'source', 'competitor', 'campaign', 'monitor_alert'];

function ownerKeyFor(entity) { return entity === 'gift' ? 'responsible_user_id' : 'owner_id'; }

test('D13-012: mỗi 1/14 entity Direct — executor ghi được bản ghi mình sở hữu, không ghi được bản ghi người khác, admin bypass', () => {
  for (const entity of DIRECT_ENTITIES) {
    const own = { [ownerKeyFor(entity)]: staff.id };
    const other = { [ownerKeyFor(entity)]: 999 };
    assert.equal(policy.canWrite({ principal: staff, entity, action: 'edit', record: own }), true, `${entity}: executor phải sửa được bản ghi mình sở hữu`);
    assert.equal(policy.canWrite({ principal: staff, entity, action: 'edit', record: other }), false, `${entity}: executor không được sửa bản ghi người khác`);
    assert.equal(policy.canWrite({ principal: staff, entity, action: 'create' }), true, `${entity}: executor phải tạo được`);
    assert.equal(policy.canWrite({ principal: staff, entity, action: 'delete', record: own }), false, `${entity}: executor không bao giờ được xoá, kể cả bản ghi mình sở hữu`);
    assert.equal(policy.canWrite({ principal: admin, entity, action: 'edit', record: other }), true, `${entity}: admin bypass ownership`);
    assert.equal(policy.canWrite({ principal: viewer, entity, action: 'edit', record: own }), false, `${entity}: viewer không bao giờ ghi được`);
  }
});

test('D13-013: mỗi 1/4 entity Global (danh bạ/lịch dùng chung) — executor sửa được bất kể owner, không xoá được, admin xoá được', () => {
  for (const entity of GLOBAL_ENTITIES) {
    assert.equal(policy.canWrite({ principal: staff, entity, action: 'create' }), true, `${entity}: executor tạo được`);
    assert.equal(policy.canWrite({ principal: staff, entity, action: 'edit', record: { owner_id: 999 } }), true, `${entity}: Global không gate theo owner_id (D13-P1/P2)`);
    assert.equal(policy.canWrite({ principal: staff, entity, action: 'delete' }), false, `${entity}: executor không xoá được dùng chung`);
    assert.equal(policy.canWrite({ principal: admin, entity, action: 'delete' }), true, `${entity}: admin xoá được`);
  }
});

test('D13-014: mỗi 1/6 entity Module-admin-only — executor bị chặn hoàn toàn kể cả tạo mới, admin/super_admin bypass', () => {
  for (const entity of MODULE_ADMIN_ONLY_ENTITIES) {
    assert.equal(policy.canWrite({ principal: staff, entity, action: 'create' }), false, `${entity}: executor không được tạo (module-admin-only)`);
    assert.equal(policy.canWrite({ principal: staff, entity, action: 'edit', record: {} }), false, `${entity}: executor không được sửa`);
    assert.equal(policy.canWrite({ principal: admin, entity, action: 'edit', record: {} }), true, `${entity}: admin bypass`);
    assert.equal(policy.canWrite({ principal: { id: 9, role: 'super_admin' }, entity, action: 'create' }), true, `${entity}: super_admin bypass`);
  }
});

test('D13-015: event_cost (Inherited, D13.4a "Chi phí sự kiện") kế thừa owner_id của event cha, không có owner_id riêng trên chính nó', () => {
  const eventOwner = staff.id;
  assert.equal(policy.isInheritedEntity('event_cost'), true);
  assert.equal(policy.canWrite({ principal: staff, entity: 'event_cost', action: 'create', parentOwnerId: eventOwner }), true, 'executor sở hữu event cha phải tạo được event_cost cho event đó');
  assert.equal(policy.canWrite({ principal: staff, entity: 'event_cost', action: 'edit', record: {}, parentOwnerId: eventOwner }), true, 'executor sở hữu event cha phải sửa được event_cost của event đó');
  assert.equal(policy.canWrite({ principal: staff, entity: 'event_cost', action: 'edit', record: {}, parentOwnerId: 999 }), false, 'executor KHÔNG sở hữu event cha không được sửa event_cost của event đó');
  assert.equal(policy.canWrite({ principal: staff, entity: 'event_cost', action: 'delete', parentOwnerId: eventOwner }), false, 'executor không bao giờ xoá được, kể cả event cha của mình');
  assert.equal(policy.canWrite({ principal: admin, entity: 'event_cost', action: 'edit', record: {}, parentOwnerId: 999 }), true, 'admin bypass event_cost');
  assert.equal(
    policy.canReadField({ principal: staff, entity: 'event_cost', field: 'amount', record: {}, parentOwnerId: eventOwner }),
    true,
    'executor sở hữu event cha đọc được field Confidential (amount) của event_cost thuộc event đó'
  );
  assert.equal(
    policy.canReadField({ principal: staff, entity: 'event_cost', field: 'amount', record: {}, parentOwnerId: 999 }),
    false,
    'executor KHÔNG sở hữu event cha không đọc được field Confidential của event_cost đó'
  );
});

test('D13-016: classification() phủ đủ toàn bộ field tiền/mật còn thiếu trong FIELD_TIER', () => {
  const cases = [
    ['sponsorship', 'amount', 'Confidential'],
    ['budget', 'amount', 'Confidential'],
    ['award', 'cost', 'Confidential'],
    ['award_participation', 'budget', 'Confidential'],
    ['supplier_quote', 'unit_price', 'Confidential'],
    ['supplier_transaction', 'value', 'Confidential'],
    ['event_cost', 'amount', 'Confidential'],
    ['association_fee', 'amount', 'Confidential'],
    ['gift', 'value', 'Confidential'],
    ['supplier', 'service_fee_pct', 'Confidential'],
    ['supplier', 'deposit_pct', 'Confidential'],
    ['organization', 'membership_fee', 'Confidential'],
  ];
  for (const [entity, field, expected] of cases) {
    assert.equal(policy.classification(entity, field), expected, `${entity}.${field} phải là ${expected}`);
  }
});
