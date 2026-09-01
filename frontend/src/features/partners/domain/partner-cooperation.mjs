const today = () => new Date().toISOString().slice(0, 10);
const trim = (value) => String(value ?? '').trim();
const textOrNull = (value) => trim(value) || null;

export const WORK_LOG_CATEGORY_OPTIONS = Object.freeze([
  Object.freeze({ value: 'Tiếp đón đoàn', label: 'Tiếp đón đoàn' }),
  Object.freeze({ value: 'Làm việc tại cơ quan', label: 'Làm việc tại cơ quan' }),
  Object.freeze({ value: 'Công văn phối hợp', label: 'Công văn phối hợp' }),
  Object.freeze({ value: 'Đối ngoại', label: 'Đối ngoại' }),
]);

export function toAgreementDraft() { return { title: '', signed_date: today(), valid_until: '' }; }
export function validateAgreementDraft(draft) {
  const errors = {};
  if (!trim(draft?.title)) errors.title = 'Tên thỏa thuận không được để trống.';
  if (draft?.signed_date && draft?.valid_until && draft.valid_until < draft.signed_date) errors.valid_until = 'Ngày hết hiệu lực phải sau hoặc bằng ngày ký.';
  return errors;
}
export function toAgreementCreatePayload(draft) {
  return { title: trim(draft.title), signed_date: textOrNull(draft.signed_date), valid_until: textOrNull(draft.valid_until) };
}

export function toWorkLogDraft() { return { category: 'Làm việc tại cơ quan', work_date: today(), topic: '', status: 'Đang xử lý' }; }
export function validateWorkLogDraft(draft) {
  const errors = {};
  if (!WORK_LOG_CATEGORY_OPTIONS.some((option) => option.value === draft?.category)) errors.category = 'Vui lòng chọn loại làm việc.';
  if (!draft?.work_date) errors.work_date = 'Ngày làm việc không được để trống.';
  if (!trim(draft?.topic)) errors.topic = 'Nội dung làm việc không được để trống.';
  return errors;
}
export function toWorkLogCreatePayload(draft) {
  return { category: draft.category, work_date: draft.work_date, topic: trim(draft.topic), status: 'Đang xử lý' };
}
