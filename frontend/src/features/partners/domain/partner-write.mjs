import { PartnerApiError } from './partner-api.mjs';

// Form compact cố ý chỉ chạm ba field Public chung của mọi loại cơ quan.
// Không đưa membership_fee hoặc field sub-resource vào client để không vô tình
// ghi đè dữ liệu mà principal không được projection.
export const PARTNER_COMPACT_EDIT_FIELDS = Object.freeze(['name', 'website', 'address']);

export function toPartnerEditDraft(record = {}) {
  return Object.freeze(Object.fromEntries(PARTNER_COMPACT_EDIT_FIELDS.map((field) => [field, record[field] ?? ''])));
}

export function validatePartnerEditDraft(draft) {
  const errors = {};
  if (!String(draft?.name || '').trim()) errors.name = 'Tên cơ quan không được để trống.';
  return Object.freeze(errors);
}

export function toPartnerUpdatePayload(draft) {
  const errors = validatePartnerEditDraft(draft);
  if (Object.keys(errors).length) throw new PartnerApiError({ status: 400, code: 'PARTNER_EDIT_INVALID', message: Object.values(errors)[0] });
  return Object.freeze(Object.fromEntries(PARTNER_COMPACT_EDIT_FIELDS.map((field) => [field, draft[field] === '' ? null : draft[field]])));
}
