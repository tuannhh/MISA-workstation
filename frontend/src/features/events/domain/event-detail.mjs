const DETAIL_FIELDS = Object.freeze([
  'name', 'mode', 'status', 'organizer', 'org_name', 'field', 'format',
  'start_time', 'end_time', 'location', 'scale_attendees', 'scale_compare',
  'guest_levels', 'evaluation', 'note', 'misa_keynotes', 'source_url',
]);

function text(value, fallback = '—') {
  const result = String(value ?? '').trim();
  return result || fallback;
}

export function eventFileUrl(id) {
  return Number.isInteger(Number(id)) && Number(id) > 0 ? `/api/files/${Number(id)}` : null;
}

function files(value) {
  return Array.isArray(value) ? Object.freeze(value.map((file) => Object.freeze({
    id: Number(file.id), kind: text(file.kind, 'Tài liệu'), originalName: text(file.original_name), mime: text(file.mime),
  })).filter((file) => Number.isInteger(file.id) && file.id > 0)) : Object.freeze([]);
}

const COST_GROUPS = Object.freeze([
  Object.freeze({ category: 'sponsor', label: 'Tài trợ', totalKey: 'sponsor' }),
  Object.freeze({ category: 'organization', label: 'Tổ chức', totalKey: 'organization' }),
  Object.freeze({ category: 'media', label: 'Truyền thông', totalKey: 'media' }),
]);

function costItem(value, category) {
  return Object.freeze({
    id: Number(value?.id), category, title: text(value?.title), amount: value?.amount ?? '—',
    supplierId: Number(value?.supplier_id) || null, supplierName: text(value?.supplier_name),
    sponsorTier: text(value?.sponsor_tier), sponsorBenefits: text(value?.sponsor_benefits),
    pressOrg: text(value?.press_org), journalistName: text(value?.journalist_name), articleLink: text(value?.article_link, ''), note: text(value?.note),
    amountMasked: typeof value?.amount !== 'number',
  });
}

function costGroups(value, totals) {
  return Object.freeze(COST_GROUPS.map(({ category, label, totalKey }) => Object.freeze({
    category, label, total: totals?.[totalKey] ?? '—',
    items: Object.freeze((Array.isArray(value?.[category]) ? value[category] : []).map((item) => costItem(item, category)).filter((item) => Number.isInteger(item.id) && item.id > 0)),
  })));
}

// Chỉ render projection do server quyết định. owner_id, caretaker assignment và raw cost rows
// không được suy ra ở client; file chỉ giữ metadata tồn tại đã projection, còn nội dung luôn
// phải đi lại qua GET /files/:id để PolicyEngine kiểm tra quyền.
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
    costGroups: costGroups(payload?.costs, totals),
    files: files(payload?.attachments),
  });
}
