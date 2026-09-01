import { SupplierApiError } from './supplier-api.mjs';

// Explicit public allowlist for this UI slice. Commercial percentages, contact
// details and order group link deliberately stay outside until their policy UX
// is specified; the server remains the final authorization source for PUT.
export const SUPPLIER_CORE_EDIT_FIELDS = Object.freeze(['name', 'industry', 'address', 'services', 'tax_code', 'invoice_type', 'note']);

export function toSupplierEditDraft(record = {}) {
  return Object.freeze(Object.fromEntries(SUPPLIER_CORE_EDIT_FIELDS.map((field) => [field, record[field] ?? ''])));
}

export function validateSupplierEditDraft(draft) {
  const errors = {};
  if (!String(draft?.name || '').trim()) errors.name = 'Tên nhà cung cấp không được để trống.';
  return Object.freeze(errors);
}

export function toSupplierUpdatePayload(draft) {
  const errors = validateSupplierEditDraft(draft);
  if (Object.keys(errors).length) throw new SupplierApiError({ status: 400, code: 'SUPPLIER_EDIT_INVALID', message: Object.values(errors)[0] });
  return Object.freeze(Object.fromEntries(SUPPLIER_CORE_EDIT_FIELDS.map((field) => [field, draft[field] === '' ? null : draft[field]])));
}
