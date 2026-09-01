const EMPTY = '—';

export const PARTNER_TYPE_META = Object.freeze({
  press: Object.freeze({ label: 'Cơ quan báo chí', listingHash: 'press' }),
  association: Object.freeze({ label: 'Hiệp hội', listingHash: 'association' }),
  gov: Object.freeze({ label: 'Đối tác bộ ngành', listingHash: 'gov' }),
  other: Object.freeze({ label: 'Cơ quan đối tác', listingHash: 'other' }),
});

function text(value) {
  return value === null || value === undefined || value === '' ? EMPTY : String(value);
}

function formatDate(value) {
  if (value === null || value === undefined || value === '') return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text(value);
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${new Intl.NumberFormat('vi-VN').format(numeric)} đ` : text(value);
}

function parseStringList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

function present(fields) {
  return Object.freeze(fields.filter(([, value]) => value !== null && value !== undefined && value !== ''));
}

export function partnerDetailViewModel(payload) {
  const record = payload?.record || {};
  const type = PARTNER_TYPE_META[record.org_type] ? record.org_type : 'other';
  const commonFields = [
    ['Cấp độ quan hệ', record.tier], ['Ngày thành lập', formatDate(record.founded_date)],
    ...(type === 'association' ? [] : [['Đơn vị chủ quản', record.parent_org]]),
    ['Website', record.website], ['Địa chỉ', record.address], ['Ghi chú', record.note],
  ];
  const fieldsByType = {
    press: [['Loại hình', parseStringList(record.press_types).join(', ')], ['Mức độ ảnh hưởng', record.political_rank], ['Tôn chỉ hoạt động', record.charter]],
    association: [['Tên viết tắt', record.abbreviation], ['Phân loại', record.admin_level], ['Lĩnh vực hoạt động', record.field_area], ['Hotline', record.hotline], ['Mã số thuế', record.tax_code], ['Vai trò MISA', record.misa_role], ['Ngày tham gia', formatDate(record.join_date)]],
    gov: [['Cấp quản lý', record.admin_level], ['Khối cơ quan', record.agency_block], ['Đầu mối / văn thư', record.contact_clerk], ['Đầu mối Ban Phát triển đối tác', record.focal_partner_dev], ['Đầu mối PR', record.focal_pr]],
    other: [],
  };
  // membership_fee chỉ xuất hiện khi API đã projection cho principal hiện tại;
  // client không có fallback nào để suy đoán hay khôi phục dữ liệu Confidential.
  if (type === 'association' && Object.prototype.hasOwnProperty.call(record, 'membership_fee')) {
    fieldsByType.association.push(['Hội phí', formatMoney(record.membership_fee)]);
  }
  const people = Array.isArray(payload?.people) ? payload.people.map((person) => Object.freeze({
    id: Number(person.id), name: text(person.full_name), role: [person.position, person.level].filter(Boolean).join(' · ') || 'Chưa có chức danh',
  })) : [];
  const dates = Array.isArray(payload?.dates) ? payload.dates.map((date) => Object.freeze({
    id: Number(date.id), title: text(date.title), date: formatDate(date.event_date), recurring: Boolean(date.recurring),
  })) : [];
  // Agreements/work logs là dữ liệu không có field Confidential trong registry.
  // Không đưa file metadata/nội dung vào slice read này: GET /files/:id phải tiếp
  // tục đi qua policy file riêng ở slice W3.PARTNER.FILE.
  const agreements = Array.isArray(payload?.agreements) ? payload.agreements.map((agreement) => Object.freeze({
    id: Number(agreement.id), title: text(agreement.title), signedDate: formatDate(agreement.signed_date), validUntil: formatDate(agreement.valid_until),
  })) : [];
  const workLogs = Array.isArray(payload?.workLogs) ? payload.workLogs.map((workLog) => Object.freeze({
    id: Number(workLog.id), title: text(workLog.topic), category: text(workLog.category), date: formatDate(workLog.work_date), status: text(workLog.status),
  })) : [];
  return Object.freeze({
    id: Number(record.id), name: text(record.name), type, typeLabel: PARTNER_TYPE_META[type].label,
    listingHash: PARTNER_TYPE_META[type].listingHash,
    subtitle: [PARTNER_TYPE_META[type].label, record.tier].filter(Boolean).join(' · '),
    fields: present([...commonFields, ...(fieldsByType[type] || [])]),
    people: Object.freeze(people), dates: Object.freeze(dates), agreements: Object.freeze(agreements), workLogs: Object.freeze(workLogs),
  });
}
