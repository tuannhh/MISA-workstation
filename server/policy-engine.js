'use strict';

// D13 foundation. This module is intentionally pure: DB loading/cache and Express response
// shaping belong to the adapter/service slice, never inside authorization decisions.
const TIER = Object.freeze({ Public: 0, Internal: 1, Confidential: 2, Restricted: 3 });
const PRIVILEGED = new Set(['admin', 'super_admin']);
const DIRECT = new Set(['booking', 'interaction', 'award', 'event', 'sponsorship', 'agreement', 'work_log', 'gift', 'association_fee', 'supplier_quote', 'supplier_transaction', 'supplier_contact', 'award_participation', 'benefit_usage']);
const GLOBAL = new Set(['organization', 'person', 'supplier', 'important_date']);
const MODULE_ADMIN_ONLY = new Set(['budget', 'scan_query', 'source', 'competitor', 'campaign', 'monitor_alert']);
// D13.4a hàng "Chi phí sự kiện": event_cost không có người tạo độc lập, kế thừa owner_id của
// event cha (khác Direct — không tự có owner_id riêng trên chính bản ghi).
const INHERITED = new Set(['event_cost']);
const FIELD_TIER = Object.freeze({
  organization: { membership_fee: 'Confidential' },
  person: {
    phone_personal: 'Confidential', phone_other: 'Confidential', phone_ott: 'Confidential', dob: 'Confidential', home_address: 'Confidential', personal_notes: 'Confidential', personality: 'Confidential', hobbies: 'Confidential', food_habits: 'Confidential', family_info: 'Confidential', media_stance: 'Confidential', relationship_network: 'Confidential', meeting_places: 'Confidential', gift_rules: 'Confidential', social_facebook: 'Confidential', social_instagram: 'Confidential', social_tiktok: 'Confidential', social_x: 'Confidential', social_thread: 'Confidential', bank_account_number: 'Restricted', bank_name: 'Restricted',
  },
  sponsorship: { amount: 'Confidential' }, booking: { amount: 'Confidential' }, budget: { amount: 'Confidential' }, award: { cost: 'Confidential' }, award_participation: { budget: 'Confidential' }, supplier_quote: { unit_price: 'Confidential' }, supplier_transaction: { value: 'Confidential' }, event_cost: { amount: 'Confidential' }, association_fee: { amount: 'Confidential' }, gift: { value: 'Confidential' }, supplier: { service_fee_pct: 'Confidential', deposit_pct: 'Confidential' },
});

function classification(entity, field) { return FIELD_TIER[entity]?.[field] || 'Public'; }
function isPrivileged(principal) { return PRIVILEGED.has(principal?.role); }
function isDirectEntity(entity) { return DIRECT.has(entity); }
function isInheritedEntity(entity) { return INHERITED.has(entity); }
function ownerValue(entity, record) { return entity === 'gift' ? record?.responsible_user_id : record?.owner_id; }

// entity Inherited (event_cost) không có owner_id trên chính bản ghi; chủ sở hữu là owner_id của
// bản ghi cha (event chứa nó), truyền vào qua parentOwnerId thay vì đọc record.owner_id.
function canWrite({ principal, entity, action, record, parentOwnerId }) {
  if (!principal) return false;
  if (isPrivileged(principal)) return true;
  if (principal.role === 'viewer' || action === 'delete') return false;
  if (principal.role !== 'executor') return false;
  if (MODULE_ADMIN_ONLY.has(entity)) return false;
  if (isInheritedEntity(entity)) return (action === 'create' || action === 'edit') && parentOwnerId === principal.id;
  if (action === 'create') return DIRECT.has(entity) || GLOBAL.has(entity);
  if (GLOBAL.has(entity)) return action === 'edit';
  return DIRECT.has(entity) && ownerValue(entity, record) === principal.id && action === 'edit';
}

function canReadField({ principal, entity, field, record, isPublic, parentOwnerId }) {
  if (!principal) return false;
  if (isPrivileged(principal)) return true;
  const tier = classification(entity, field);
  if (principal.role === 'executor' && DIRECT.has(entity) && ownerValue(entity, record) === principal.id) return true;
  if (principal.role === 'executor' && isInheritedEntity(entity) && parentOwnerId === principal.id) return true;
  // A non-Public tier may never be made public by normal configuration; fail closed even if
  // a corrupt row says is_public=1.
  if (tier !== 'Public') return false;
  // D13.2b: Public-tier field mặc định HIỂN THỊ (audience_visibility chỉ dùng để SIẾT xuống
  // private, không phải để MỞ field mật) — isPublic===undefined nghĩa là chưa cấu hình gì,
  // không phải "đã cấu hình private". Chỉ isPublic===false (có dòng field_visibility rõ ràng
  // is_public=0) mới thực sự ẩn field Public này.
  return isPublic !== false;
}

// D13.3b: attachments are not scalar `person` fields, so they get their own ceiling table instead
// of FIELD_TIER. id_doc's ceiling is hard `private` — no role, including Admin, can raise it.
const ATTACHMENT_VISIBILITY_CEILING = Object.freeze({ id_doc: 'private', portrait: 'public' });
function attachmentVisibilityCeiling(kind) { return ATTACHMENT_VISIBILITY_CEILING[kind] || 'private'; }
function canSetAttachmentVisibility(kind, visibility) {
  if (visibility === 'private') return true;
  return attachmentVisibilityCeiling(kind) === 'public';
}
// person has no per-record owner (D13.4a Global), so unlike canReadField there is no
// executor-owns-this-record bypass here: only Admin/Super Admin see non-public attachments.
function canReadAttachment({ principal, kind, audienceVisibility }) {
  if (!principal) return false;
  if (isPrivileged(principal)) return true;
  if (kind === 'id_doc') return false;
  return audienceVisibility === 'public';
}

module.exports = {
  TIER, FIELD_TIER, classification, isPrivileged, isDirectEntity, isInheritedEntity, canWrite, canReadField, ownerValue,
  attachmentVisibilityCeiling, canSetAttachmentVisibility, canReadAttachment,
};
