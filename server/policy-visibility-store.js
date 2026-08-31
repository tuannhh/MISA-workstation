'use strict';
const policy = require('./policy-engine');
const ALLOWED_FIELDS = Object.freeze({
  partners: new Set(['full_name', 'phone_personal', 'phone_other', 'phone_ott', 'dob', 'home_address', 'personal_notes', 'personality', 'hobbies', 'food_habits', 'family_info', 'media_stance', 'relationship_network', 'meeting_places', 'gift_rules', 'social_facebook', 'social_instagram', 'social_tiktok', 'social_x', 'social_thread', 'bank_account_number', 'bank_name', 'membership_fee']),
});
function assertAllowed(module, field) { if (!ALLOWED_FIELDS[module]?.has(field)) throw new Error(`Field visibility không hợp lệ: ${module}.${field}`); }
function entityFor(module, field) { return module === 'partners' && field === 'membership_fee' ? 'organization' : 'person'; }
function createVisibilityStore(db) {
  const get = db.prepare('SELECT is_public FROM field_visibility WHERE module=? AND field=?');
  const set = db.prepare("INSERT INTO field_visibility (module,field,is_public,updated_by) VALUES (?,?,?,?) ON CONFLICT(module,field) DO UPDATE SET is_public=excluded.is_public, updated_by=excluded.updated_by, updated_at=datetime('now')");
  return {
    // undefined = chưa có dòng cấu hình nào (khác với is_public=0 đã cấu hình rõ private) —
    // PolicyEngine cần phân biệt 2 trạng thái này để áp mặc định D13.2b (Public-tier mặc định
    // hiển thị, chỉ ẩn khi CÓ dòng is_public=0 rõ ràng).
    isPublic(module, field) {
      assertAllowed(module, field);
      const row = get.get(module, field);
      return row ? Number(row.is_public) === 1 : undefined;
    },
    setPublic({ module, field, isPublic, principal }) {
      assertAllowed(module, field);
      if (!['admin', 'super_admin'].includes(principal?.role)) throw new Error('FORBIDDEN');
      if (isPublic && policy.classification(entityFor(module, field), field) !== 'Public') throw new Error('FORBIDDEN_TIER');
      set.run(module, field, isPublic ? 1 : 0, principal.id || null);
    },
  };
}
module.exports = { createVisibilityStore, assertAllowed, ALLOWED_FIELDS };
