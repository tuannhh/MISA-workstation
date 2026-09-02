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

// D13.3b/F9: attachment classification and its visibility ceiling are one server-owned
// registry. A client can choose only a recognized event-document label; it never chooses a tier.
const EVENT_DOCUMENT_KINDS = Object.freeze([
  'Hợp đồng', 'Biên bản nghiệm thu', 'Hóa đơn', 'Agenda', 'Checklist',
  'Danh sách phóng viên', 'Dự toán', 'Kế hoạch truyền thông', 'Bài diễn giả',
  'Tổng quan sự kiện', 'Hợp đồng diễn giả', 'Khác',
]);
const EVENT_DOCUMENT_KIND_ALIASES = Object.freeze({ doc: 'Khác', 'Tài liệu': 'Khác' });
const ATTACHMENT_POLICY = Object.freeze({
  person: Object.freeze({
    portrait: Object.freeze({ classificationTier: 'Public', visibilityCeiling: 'public' }),
    id_doc: Object.freeze({ classificationTier: 'Restricted', visibilityCeiling: 'private' }),
  }),
  award: Object.freeze({ award_doc: Object.freeze({ classificationTier: 'Confidential', visibilityCeiling: 'private' }) }),
  supplier: Object.freeze({ quote: Object.freeze({ classificationTier: 'Confidential', visibilityCeiling: 'private' }) }),
  agreement: Object.freeze({ file: Object.freeze({ classificationTier: 'Confidential', visibilityCeiling: 'private' }) }),
  work_log: Object.freeze({ file: Object.freeze({ classificationTier: 'Confidential', visibilityCeiling: 'private' }) }),
});
function attachmentPolicyFor(ownerType, requestedKind) {
  let kind = String(requestedKind || '').trim();
  if (ownerType === 'event') {
    kind = EVENT_DOCUMENT_KIND_ALIASES[kind] || kind || 'Khác';
    if (!EVENT_DOCUMENT_KINDS.includes(kind)) return null;
    return { kind, classificationTier: 'Confidential', visibilityCeiling: 'private' };
  }
  const spec = ATTACHMENT_POLICY[ownerType]?.[kind];
  return spec ? { kind, ...spec } : null;
}
function attachmentVisibilityCeiling(kind, ownerType) {
  return attachmentPolicyFor(ownerType, kind)?.visibilityCeiling || (kind === 'portrait' ? 'public' : 'private');
}
function canSetAttachmentVisibility(kind, visibility) {
  if (visibility === 'private') return true;
  return attachmentVisibilityCeiling(kind) === 'public';
}
// D13.3 mo rong (remediation P0 audit F19): attachment gan tren entity Direct (award/event/
// agreement/work_log...) hoac Inherited phai theo dung luat owner cua entity do, giong
// canReadField — khong con "khong instrument thi phuc vu luon" nhu truoc. Entity Global (person/
// supplier) khong co owner bypass, giu dung hanh vi cu: chi Admin/Super Admin xem duoc private.
function canReadAttachment({ principal, entity, kind, classificationTier, audienceVisibility, record, parentOwnerId }) {
  if (!principal) return false;
  if (isPrivileged(principal)) return true;
  // Missing/malformed historical data fails closed as Confidential. `id_doc` remains
  // Restricted independently while the backfill is deployed.
  const tier = classificationTier || (kind === 'id_doc' ? 'Restricted' : 'Confidential');
  if (tier === 'Restricted') return false;
  if (principal.role === 'executor' && isDirectEntity(entity) && ownerValue(entity, record) === principal.id) return true;
  if (principal.role === 'executor' && isInheritedEntity(entity) && parentOwnerId === principal.id) return true;
  return tier === 'Public' && audienceVisibility === 'public';
}

module.exports = {
  TIER, FIELD_TIER, classification, isPrivileged, isDirectEntity, isInheritedEntity, canWrite, canReadField, ownerValue,
  EVENT_DOCUMENT_KINDS, attachmentPolicyFor, attachmentVisibilityCeiling, canSetAttachmentVisibility, canReadAttachment,
};
