export const PARTNER_TYPES = Object.freeze([
  Object.freeze({ value: 'press', label: 'Báo chí' }),
  Object.freeze({ value: 'association', label: 'Hiệp hội' }),
  Object.freeze({ value: 'gov', label: 'Bộ ngành' }),
  Object.freeze({ value: 'other', label: 'Khác' }),
]);

const EMPTY = '—';
export function partnerTypeMeta(type) { return PARTNER_TYPES.find((item) => item.value === type) || PARTNER_TYPES[3]; }
function text(value) { return value === null || value === undefined || value === '' ? EMPTY : String(value); }
function valueOrEmpty(value) { return value === null || value === undefined ? '' : String(value); }

export function partnerListViewModel(payload, type) {
  return Object.freeze({
    type: partnerTypeMeta(type).value,
    rows: Object.freeze((payload?.rows || []).map((row) => Object.freeze({
      id: Number(row.id), name: text(row.name), tier: text(row.tier), parent: text(row.parent_org),
      secondary: type === 'association' ? text(row.field_area) : type === 'gov' ? text(row.admin_level) : type === 'press' ? text(row.press_types ? 'Đa dạng loại hình' : '') : text(row.address),
      peopleCount: Math.max(0, Number(row.people_count) || 0), feeOverdue: Math.max(0, Number(row.fee_overdue) || 0),
    })).filter((row) => Number.isInteger(row.id) && row.id > 0)),
    total: Math.max(0, Number(payload?.total) || 0), page: Math.max(1, Number(payload?.page) || 1), pageSize: Math.max(1, Number(payload?.pageSize) || 20),
  });
}

export function partnerCreateDraft(type = 'press') {
  return Object.freeze({ name: '', org_type: partnerTypeMeta(type).value, tier: '', founded_date: '', parent_org: '', website: '', address: '', abbreviation: '', field_area: '', admin_level: '', agency_block: '', note: '' });
}

export function validatePartnerCreateDraft(draft) {
  const errors = {};
  if (!String(draft?.name || '').trim()) errors.name = 'Tên cơ quan là bắt buộc.';
  if (!PARTNER_TYPES.some((item) => item.value === draft?.org_type)) errors.org_type = 'Loại cơ quan không hợp lệ.';
  return errors;
}

export function toPartnerCreatePayload(draft) {
  return Object.freeze({
    name: String(draft.name || '').trim(), org_type: partnerTypeMeta(draft.org_type).value,
    tier: valueOrEmpty(draft.tier), founded_date: valueOrEmpty(draft.founded_date), parent_org: valueOrEmpty(draft.parent_org),
    website: valueOrEmpty(draft.website), address: valueOrEmpty(draft.address), abbreviation: valueOrEmpty(draft.abbreviation),
    field_area: valueOrEmpty(draft.field_area), admin_level: valueOrEmpty(draft.admin_level), agency_block: valueOrEmpty(draft.agency_block), note: valueOrEmpty(draft.note),
  });
}
