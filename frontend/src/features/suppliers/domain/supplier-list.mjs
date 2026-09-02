import { SupplierApiError } from './supplier-api.mjs';

const EMPTY = '—';
const safeText = (value) => value === null || value === undefined || value === '' ? EMPTY : String(value);
const valueOrEmpty = (value) => value === null || value === undefined ? '' : String(value);

// Commercial fees/deposits are deliberately absent. This is the smallest public
// create projection; PolicyEngine remains the authorization source on the API.
export const SUPPLIER_CREATE_FIELDS = Object.freeze(['name', 'industry', 'address', 'contact_phone', 'contact_email', 'tax_code', 'services', 'invoice_type', 'order_group_link', 'note']);

export function supplierListViewModel(payload) {
  return Object.freeze({
    rows: Object.freeze((payload?.rows || []).map((row) => Object.freeze({
      id: Number(row?.id), name: safeText(row?.name), industry: safeText(row?.industry),
      services: safeText(row?.services), contact: safeText(row?.contact_phone || row?.contact_email),
    })).filter((row) => Number.isInteger(row.id) && row.id > 0)),
    total: Math.max(0, Number(payload?.total) || 0), page: Math.max(1, Number(payload?.page) || 1), pageSize: Math.max(1, Number(payload?.pageSize) || 20),
  });
}

export function supplierCreateDraft() { return Object.freeze(Object.fromEntries(SUPPLIER_CREATE_FIELDS.map((field) => [field, '']))); }

export function validateSupplierCreateDraft(draft) {
  const errors = {};
  if (!String(draft?.name || '').trim()) errors.name = 'Tên nhà cung cấp là bắt buộc.';
  if (String(draft?.contact_email || '').trim() && !/^\S+@\S+\.\S+$/.test(String(draft.contact_email).trim())) errors.contact_email = 'Email liên hệ không hợp lệ.';
  return Object.freeze(errors);
}

export function toSupplierCreatePayload(draft) {
  const errors = validateSupplierCreateDraft(draft);
  if (Object.keys(errors).length) throw new SupplierApiError({ status: 400, code: 'SUPPLIER_CREATE_INVALID', message: Object.values(errors)[0] });
  return Object.freeze(Object.fromEntries(SUPPLIER_CREATE_FIELDS.map((field) => [field, field === 'name' ? String(draft.name || '').trim() : valueOrEmpty(draft?.[field])] )));
}
