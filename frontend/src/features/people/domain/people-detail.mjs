const EMPTY = '—';

export function text(value) {
  return value === null || value === undefined || value === '' ? EMPTY : String(value);
}

export function initials(fullName) {
  return String(fullName || '').trim().split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi-VN') || '?';
}

export function statusColor(status) {
  const value = String(status || '').toLocaleLowerCase('vi-VN');
  if (/(hoạt động|active|đang làm)/.test(value)) return 'success';
  if (/(tạm|chờ|pending)/.test(value)) return 'warning';
  if (/(ngừng|inactive|khóa)/.test(value)) return 'danger';
  return 'neutral';
}

export function fileUrl(attachmentId) {
  const id = Number(attachmentId);
  return Number.isInteger(id) && id > 0 ? `/api/files/${id}` : null;
}
function bookingDate(value) { const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || '')); return match ? `${match[3]}/${match[2]}/${match[1]}` : '—'; }
export function peopleBookingsViewModel(payload) {
  return Object.freeze({
    rows: Object.freeze((payload?.rows || []).map((row) => Object.freeze({ id: Number(row.id), title: text(row.title), contentType: text(row.content_type), bookedDate: bookingDate(row.booked_date), publishDate: bookingDate(row.publish_date), status: text(row.status), hasAmount: Object.prototype.hasOwnProperty.call(row, 'amount'), amount: row.amount })).filter((row) => Number.isInteger(row.id) && row.id > 0)),
    totalAmount: payload?.total_amount ?? null,
  });
}

export function peopleDetailViewModel(payload) {
  const record = payload?.record || {};
  const publicFields = [
    ['Cơ quan', record.org_name], ['Loại cơ quan', record.org_type], ['Cấp bậc', record.level], ['Chức vụ', record.position],
    ['Mảng phụ trách', record.beat], ['Nhóm', record.category], ['Điểm quan hệ', record.relationship_score],
    ['Email công việc', record.email_work], ['Điện thoại công việc', record.phone_work],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const portraits = Array.isArray(payload?.portraits) ? payload.portraits : [];
  const idDocs = Array.isArray(payload?.idDocs) ? payload.idDocs : [];
  return Object.freeze({
    id: record.id,
    name: text(record.full_name),
    subtitle: [record.position, record.org_name].filter(Boolean).join(' · ') || 'Chưa có thông tin chức danh',
    status: text(record.status),
    statusColor: statusColor(record.status),
    initials: initials(record.full_name),
    publicFields,
    primaryPortrait: portraits.find((portrait) => portrait.is_primary) || portraits[0] || null,
    portraitCount: portraits.length,
    portraits: Object.freeze(portraits.map((file) => Object.freeze({ ...file }))),
    idDocCount: Number(payload?.idDocCount || 0),
    idDocs: Object.freeze(idDocs.map((file) => Object.freeze({ ...file }))),
    interactions: Array.isArray(payload?.interactions) ? payload.interactions : [],
    gifts: Array.isArray(payload?.gifts) ? payload.gifts : [],
  });
}
