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

export function toPeopleEditDraft(record = {}, fields = PEOPLE_COMPACT_EDIT_FIELDS) {
  return Object.freeze(Object.fromEntries(fields.map((field) => [field, record[field] ?? ''])));
}

export function validatePeopleEditDraft(draft) {
  const errors = {};
  if (!String(draft?.full_name || '').trim()) errors.full_name = 'Họ và tên không được để trống.';
  const score = draft?.relationship_score;
  if (score !== '' && score !== null && score !== undefined && !Number.isFinite(Number(score))) {
    errors.relationship_score = 'Điểm quan hệ phải là một số hợp lệ.';
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
