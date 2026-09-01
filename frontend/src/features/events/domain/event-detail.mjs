const DETAIL_FIELDS = Object.freeze([
  'name', 'mode', 'status', 'organizer', 'org_name', 'field', 'format',
  'start_time', 'end_time', 'location', 'scale_attendees', 'scale_compare',
  'guest_levels', 'evaluation', 'note', 'misa_keynotes', 'source_url',
]);

function text(value, fallback = '—') {
  const result = String(value ?? '').trim();
  return result || fallback;
}

// Chỉ render public projection. owner_id, caretaker assignment, raw cost rows
// và metadata tệp vẫn thuộc các slice PolicyEngine/file sau, không được suy ra
// ở client từ payload chi tiết.
export function eventDetailViewModel(payload = {}) {
  const record = payload?.record || {};
  const fields = Object.fromEntries(DETAIL_FIELDS.map((key) => [key, text(record[key]) ]));
  const totals = payload?.totals || {};
  // Không cộng từ row ở client: tổng có thể là sentinel MASK do PolicyEngine
  // trả về. Mỗi giá trị giữ nguyên đúng projection của API.
  const costTotals = Object.freeze([
    Object.freeze({ label: 'Tài trợ', value: totals.sponsor ?? '—' }),
    Object.freeze({ label: 'Tổ chức', value: totals.organization ?? '—' }),
    Object.freeze({ label: 'Truyền thông', value: totals.media ?? '—' }),
    Object.freeze({ label: 'Tổng chi phí', value: totals.grand ?? '—' }),
  ]);
  return Object.freeze({
    id: Number(record.id) || null,
    title: fields.name,
    status: fields.status,
    time: [fields.start_time, fields.end_time].filter((value) => value !== '—').join(' — ') || 'Chưa cập nhật thời gian',
    location: fields.location,
    organizer: fields.organizer !== '—' ? fields.organizer : fields.org_name,
    fields: Object.freeze(fields),
    // Có thể là số hoặc sentinel MASK do API quyết định. Không cộng/tính lại ở UI.
    totalCost: totals.grand ?? '—',
    costTotals,
  });
}
