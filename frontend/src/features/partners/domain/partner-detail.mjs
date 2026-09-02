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
export function fileUrl(id) { return Number.isInteger(Number(id)) && Number(id) > 0 ? `/api/files/${Number(id)}` : null; }
function files(value) { return Array.isArray(value) ? value.map((file) => Object.freeze({ id: Number(file.id), original_name: file.original_name || '', mime: file.mime || '' })).filter((file) => Number.isInteger(file.id) && file.id > 0) : []; }

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
    id: Number(agreement.id), ownerId: Number.isInteger(Number(agreement.owner_id)) ? Number(agreement.owner_id) : null, title: text(agreement.title), signedDate: formatDate(agreement.signed_date), signedDateValue: agreement.signed_date || '', validUntil: formatDate(agreement.valid_until), validUntilValue: agreement.valid_until || '', terms: agreement.terms || '', note: agreement.note || '', files: Object.freeze(files(agreement.files)),
  })) : [];
  const workLogs = Array.isArray(payload?.workLogs) ? payload.workLogs.map((workLog) => Object.freeze({
    id: Number(workLog.id), ownerId: Number.isInteger(Number(workLog.owner_id)) ? Number(workLog.owner_id) : null, title: text(workLog.topic), category: text(workLog.category), date: formatDate(workLog.work_date), workDateValue: workLog.work_date || '', status: text(workLog.status), result: workLog.result || '', staff: workLog.staff || '', note: workLog.note || '', files: Object.freeze(files(workLog.files)),
  })) : [];
  // Bốn entity Direct dưới đây chỉ giữ context cần cho Admin chuyển giao. Giá trị tiền là
  // Confidential và chỉ xuất hiện nếu server projection đã đưa vào response; panel không render
  // hoặc suy diễn chúng, kể cả khi data legacy chứa giá trị.
  const sponsorships = Array.isArray(payload?.sponsorships) ? payload.sponsorships.map((record) => Object.freeze({
    id: Number(record.id), ownerId: Number.isInteger(Number(record.owner_id)) ? Number(record.owner_id) : null, title: text(record.title, 'Khoản tài trợ'), subtitle: [record.type, formatDate(record.event_date), record.status].filter(Boolean).join(' · ') || 'Chưa cập nhật', type: record.type || '', event_date: record.event_date || '', status: record.status || '', note: record.note || '', ...(Object.prototype.hasOwnProperty.call(record, 'amount') ? { amount: record.amount } : {}),
  })) : [];
  const gifts = Array.isArray(payload?.gifts) ? payload.gifts.map((record) => Object.freeze({
    id: Number(record.id), ownerId: Number.isInteger(Number(record.responsible_user_id)) ? Number(record.responsible_user_id) : null, title: [record.gift_type, record.occasion].filter(Boolean).join(' · ') || 'Quà tặng', subtitle: [record.giver, formatDate(record.event_date)].filter(Boolean).join(' · ') || 'Chưa cập nhật', gift_type: record.gift_type || '', giver: record.giver || '', event_date: record.event_date || '', occasion: record.occasion || '', note: record.note || '', ...(Object.prototype.hasOwnProperty.call(record, 'value') ? { value: record.value } : {}),
  })) : [];
  const associationFees = Array.isArray(payload?.fees) ? payload.fees.map((record) => Object.freeze({
    id: Number(record.id), ownerId: Number.isInteger(Number(record.owner_id)) ? Number(record.owner_id) : null, title: `Hội phí ${text(record.year, 'chưa xác định')}`, subtitle: [record.status, formatDate(record.due_date)].filter(Boolean).join(' · ') || 'Chưa cập nhật', year: record.year || '', due_date: record.due_date || '', paid_date: record.paid_date || '', status: record.status || '', staff: record.staff || '', note: record.note || '', ...(Object.prototype.hasOwnProperty.call(record, 'amount') ? { amount: record.amount } : {}),
  })) : [];
  const benefitUsages = Array.isArray(payload?.benefitUsages) ? payload.benefitUsages.map((record) => Object.freeze({
    id: Number(record.id), ownerId: Number.isInteger(Number(record.owner_id)) ? Number(record.owner_id) : null, title: text(record.title, 'Quyền lợi hợp đồng'), subtitle: formatDate(record.used_date) || 'Chưa cập nhật ngày sử dụng', used_date: record.used_date || '', note: record.note || '',
  })) : [];
  return Object.freeze({
    id: Number(record.id), name: text(record.name), type, typeLabel: PARTNER_TYPE_META[type].label,
    listingHash: PARTNER_TYPE_META[type].listingHash,
    subtitle: [PARTNER_TYPE_META[type].label, record.tier].filter(Boolean).join(' · '),
    fields: present([...commonFields, ...(fieldsByType[type] || [])]),
    people: Object.freeze(people), dates: Object.freeze(dates), agreements: Object.freeze(agreements), workLogs: Object.freeze(workLogs),
    sponsorships: Object.freeze(sponsorships), gifts: Object.freeze(gifts), associationFees: Object.freeze(associationFees), benefitUsages: Object.freeze(benefitUsages),
  });
}
