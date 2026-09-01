const EMPTY = '—';
function text(value) { return value === null || value === undefined || value === '' ? EMPTY : String(value); }
function present(fields) { return Object.freeze(fields.filter(([, value]) => value !== null && value !== undefined && value !== '')); }
function formatPercent(value) { const numeric = Number(value); return Number.isFinite(numeric) ? `${numeric}%` : text(value); }
export function fileUrl(id) { return Number.isInteger(Number(id)) && Number(id) > 0 ? `/api/files/${Number(id)}` : null; }
function files(value) { return Array.isArray(value) ? Object.freeze(value.map((file) => Object.freeze({ id: Number(file.id), originalName: text(file.original_name), mime: text(file.mime) })).filter((file) => Number.isInteger(file.id) && file.id > 0)) : Object.freeze([]); }
function date(value) { const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || '')); return match ? `${match[3]}/${match[2]}/${match[1]}` : text(value); }
function directRows(rows, map) { return Object.freeze((Array.isArray(rows) ? rows : []).map(map).filter((row) => Number.isInteger(row.id) && row.id > 0)); }

export function supplierDetailViewModel(payload) {
  const record = payload?.record || {};
  // Chỉ đọc record sau PolicyEngine projection. Các field tiền của báo giá/giao
  // dịch chỉ xuất hiện nếu chính response đã có property tương ứng; browser
  // tuyệt đối không suy đoán/khôi phục giá trị bị policy ẩn.
  const fields = [
    ['Lĩnh vực hoạt động', record.industry], ['Dịch vụ cung cấp', record.services],
    ['Địa chỉ', record.address], ['Mã số thuế', record.tax_code],
    ['Loại hóa đơn', record.invoice_type], ['Ghi chú', record.note],
  ];
  // Các tỷ lệ chỉ được hiện khi server đã cho property qua projection. Không
  // có fallback để suy ra hoặc mở khóa dữ liệu Confidential.
  if (Object.prototype.hasOwnProperty.call(record, 'service_fee_pct')) fields.push(['Phí phục vụ', formatPercent(record.service_fee_pct)]);
  if (Object.prototype.hasOwnProperty.call(record, 'deposit_pct')) fields.push(['Yêu cầu đặt cọc', formatPercent(record.deposit_pct)]);
  const quotes = directRows(payload?.quotes, (quote) => Object.freeze({ id: Number(quote.id), ownerId: Number.isInteger(Number(quote.owner_id)) ? Number(quote.owner_id) : null, item: text(quote.item), unit: text(quote.unit), qty: text(quote.qty), hasUnitPrice: Object.prototype.hasOwnProperty.call(quote, 'unit_price'), unitPrice: quote.unit_price }));
  const transactions = directRows(payload?.transactions, (transaction) => Object.freeze({ id: Number(transaction.id), ownerId: Number.isInteger(Number(transaction.owner_id)) ? Number(transaction.owner_id) : null, title: text(transaction.contract_no || transaction.purpose || transaction.service_type), serviceType: text(transaction.service_type), purpose: text(transaction.purpose), status: text(transaction.status), signedDate: date(transaction.signed_date), deadline: date(transaction.exec_deadline), hasValue: Object.prototype.hasOwnProperty.call(transaction, 'value'), value: transaction.value }));
  const contacts = directRows(payload?.contacts, (contact) => Object.freeze({ id: Number(contact.id), ownerId: Number.isInteger(Number(contact.owner_id)) ? Number(contact.owner_id) : null, name: text(contact.full_name), position: text(contact.position), role: text(contact.role), phone: text(contact.phone), email: text(contact.email) }));
  return Object.freeze({ id: Number(record.id), name: text(record.name), subtitle: [record.industry, record.services].filter(Boolean).join(' · ') || 'Thông tin nhà cung cấp', fields: present(fields), files: files(payload?.files), quotes, transactions, contacts });
}
