const EMPTY = '—';
function text(value) { return value === null || value === undefined || value === '' ? EMPTY : String(value); }
function present(fields) { return Object.freeze(fields.filter(([, value]) => value !== null && value !== undefined && value !== '')); }
function formatPercent(value) { const numeric = Number(value); return Number.isFinite(numeric) ? `${numeric}%` : text(value); }
export function fileUrl(id) { return Number.isInteger(Number(id)) && Number(id) > 0 ? `/api/files/${Number(id)}` : null; }
function files(value) { return Array.isArray(value) ? Object.freeze(value.map((file) => Object.freeze({ id: Number(file.id), originalName: text(file.original_name), mime: text(file.mime) })).filter((file) => Number.isInteger(file.id) && file.id > 0)) : Object.freeze([]); }

export function supplierDetailViewModel(payload) {
  const record = payload?.record || {};
  // Chỉ đọc record sau PolicyEngine projection. Báo giá, giao dịch, contacts,
  // dates và file là sub-resource có policy/ownership riêng nên không được
  // đưa vào read slice này hay suy đoán ở client.
  const fields = [
    ['Lĩnh vực hoạt động', record.industry], ['Dịch vụ cung cấp', record.services],
    ['Địa chỉ', record.address], ['Mã số thuế', record.tax_code],
    ['Loại hóa đơn', record.invoice_type], ['Ghi chú', record.note],
  ];
  // Các tỷ lệ chỉ được hiện khi server đã cho property qua projection. Không
  // có fallback để suy ra hoặc mở khóa dữ liệu Confidential.
  if (Object.prototype.hasOwnProperty.call(record, 'service_fee_pct')) fields.push(['Phí phục vụ', formatPercent(record.service_fee_pct)]);
  if (Object.prototype.hasOwnProperty.call(record, 'deposit_pct')) fields.push(['Yêu cầu đặt cọc', formatPercent(record.deposit_pct)]);
  return Object.freeze({ id: Number(record.id), name: text(record.name), subtitle: [record.industry, record.services].filter(Boolean).join(' · ') || 'Thông tin nhà cung cấp', fields: present(fields), files: files(payload?.files) });
}
