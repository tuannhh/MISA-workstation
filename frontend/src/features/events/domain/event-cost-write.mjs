import { InteractionsApiError } from '../../interactions/domain/interactions-api.mjs';

export const EVENT_COST_CATEGORIES = Object.freeze([
  Object.freeze({ value: 'sponsor', label: 'Tài trợ' }),
  Object.freeze({ value: 'organization', label: 'Tổ chức' }),
  Object.freeze({ value: 'media', label: 'Truyền thông' }),
]);
export const EVENT_COST_FIELDS = Object.freeze(['category', 'title', 'supplier_id', 'amount', 'sponsor_tier', 'sponsor_benefits', 'press_org', 'journalist_name', 'article_link', 'note']);

function categoryOf(value) {
  const category = String(value || '');
  if (!EVENT_COST_CATEGORIES.some((item) => item.value === category)) throw new InteractionsApiError({ status: 400, code: 'EVENT_COST_CATEGORY_INVALID', message: 'Nhóm chi phí không hợp lệ.' });
  return category;
}

export function toEventCostDraft(record = {}, category = record?.category || 'sponsor') {
  const resolvedCategory = categoryOf(category);
  return Object.freeze({
    category: resolvedCategory,
    title: String(record?.title || ''),
    supplier_id: record?.supplierId ? String(record.supplierId) : '',
    amount: typeof record?.amount === 'number' ? String(record.amount) : '',
    sponsor_tier: String(record?.sponsorTier || ''), sponsor_benefits: String(record?.sponsorBenefits || ''),
    press_org: String(record?.pressOrg || ''), journalist_name: String(record?.journalistName || ''),
    article_link: String(record?.articleLink || ''), note: String(record?.note || ''),
  });
}

export function validateEventCostDraft(draft) {
  const errors = {};
  try { categoryOf(draft?.category); } catch (error) { errors.category = error.message; }
  if (!String(draft?.title || '').trim()) errors.title = 'Nội dung chi phí là bắt buộc.';
  if (draft?.amount !== '' && draft?.amount != null && (!Number.isFinite(Number(draft.amount)) || Number(draft.amount) < 0)) errors.amount = 'Số tiền phải là số không âm.';
  if (draft?.supplier_id !== '' && draft?.supplier_id != null && (!Number.isInteger(Number(draft.supplier_id)) || Number(draft.supplier_id) < 1)) errors.supplier_id = 'Nhà cung cấp không hợp lệ.';
  return Object.freeze(errors);
}

export function toEventCostPayload(draft) {
  const errors = validateEventCostDraft(draft);
  if (Object.keys(errors).length) throw new InteractionsApiError({ status: 400, code: 'EVENT_COST_INVALID', message: Object.values(errors)[0] });
  const value = (key) => String(draft[key] ?? '').trim() || null;
  return Object.freeze({
    category: categoryOf(draft.category), title: String(draft.title).trim(),
    supplier_id: value('supplier_id') === null ? null : Number(value('supplier_id')),
    amount: value('amount') === null ? null : Number(value('amount')),
    sponsor_tier: value('sponsor_tier'), sponsor_benefits: value('sponsor_benefits'), press_org: value('press_org'),
    journalist_name: value('journalist_name'), article_link: value('article_link'), note: value('note'),
  });
}
