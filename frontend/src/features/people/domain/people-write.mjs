import { PeopleApiError } from './people-api.mjs';

// Chỉ các trường của form compact. Danh sách này không cấp quyền: API vẫn
// allowlist và PolicyEngine là nguồn quyết định sau cùng.
export const PEOPLE_EDIT_FIELDS = Object.freeze([
  'full_name', 'level', 'position', 'beat', 'category', 'relationship_score',
  'status', 'email_work', 'phone_work', 'phone_personal', 'phone_other',
  'home_address', 'personal_notes',
]);

// Form People Detail đầu tiên chỉ sửa nhóm thông tin công khai. Đừng đưa
// field nhạy cảm không nằm trong projection vào payload vì giá trị rỗng ở
// client có thể vô tình ghi đè dữ liệu mà người dùng không được xem.
export const PEOPLE_COMPACT_EDIT_FIELDS = Object.freeze([
  'full_name', 'level', 'position', 'beat', 'category', 'relationship_score',
  'status', 'email_work', 'phone_work',
]);

export const PEOPLE_CREATE_FIELDS = Object.freeze(['org_id', ...PEOPLE_COMPACT_EDIT_FIELDS]);

export function toPeopleCreateDraft() {
  return Object.freeze({ org_id: '', full_name: '', level: '', position: '', beat: '', category: '', relationship_score: '', status: 'Đang hoạt động', email_work: '', phone_work: '' });
}

export function toPeopleEditDraft(record = {}, fields = PEOPLE_COMPACT_EDIT_FIELDS) {
  return Object.freeze(Object.fromEntries(fields.map((field) => [field, record[field] ?? ''])));
}

export function validatePeopleEditDraft(draft) {
  const errors = {};
  if (!String(draft?.full_name || '').trim()) errors.full_name = 'Họ và tên không được để trống.';
  const score = draft?.relationship_score;
  if (score !== '' && score !== null && score !== undefined
    && (!Number.isInteger(Number(score)) || Number(score) < 0 || Number(score) > 100)) {
    errors.relationship_score = 'Điểm quan hệ phải là số nguyên từ 0 đến 100.';
  }
  return Object.freeze(errors);
}

export function toPeopleUpdatePayload(draft, fields = Object.keys(draft || {})) {
  const errors = validatePeopleEditDraft(draft);
  if (Object.keys(errors).length) throw new PeopleApiError({ status: 400, code: 'PEOPLE_EDIT_INVALID', message: Object.values(errors)[0] });
  const allowedFields = fields.filter((field) => PEOPLE_EDIT_FIELDS.includes(field));
  return Object.freeze(Object.fromEntries(allowedFields.map((field) => {
    const value = draft[field];
    return [field, field === 'relationship_score' && value !== '' ? Number(value) : (value === '' ? null : value)];
  })));
}

export function toPeopleCreatePayload(draft) {
  const errors = { ...validatePeopleEditDraft(draft) };
  const orgId = Number(draft?.org_id);
  if (!Number.isInteger(orgId) || orgId < 1) errors.org_id = 'Cơ quan là bắt buộc.';
  if (Object.keys(errors).length) throw new PeopleApiError({ status: 400, code: 'PEOPLE_CREATE_INVALID', message: Object.values(errors)[0] });
  return Object.freeze(Object.fromEntries(PEOPLE_CREATE_FIELDS.map((field) => {
    const value = draft[field];
    if (field === 'org_id') return [field, orgId];
    return [field, field === 'relationship_score' && value !== '' ? Number(value) : (value === '' ? null : value)];
  })));
}
