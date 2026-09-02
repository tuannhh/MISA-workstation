function amountOf(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new TypeError('Nhập số tiền ngân sách hợp lệ.');
  return amount;
}

export function budgetPayload(input = {}) {
  const period = String(input.period || '').trim();
  if (!/^\d{4}-\d{2}$/.test(period)) throw new TypeError('Chọn kỳ ngân sách dạng YYYY-MM.');
  return Object.freeze({ period, amount: amountOf(input.amount), note: String(input.note || '').trim() });
}

export function budgetsViewModel(rows = []) {
  return Object.freeze((Array.isArray(rows) ? rows : []).map((row) => {
    const amountVisible = Object.hasOwn(row || {}, 'amount') && Number.isFinite(Number(row.amount));
    return Object.freeze({ period: String(row?.period || ''), amount: amountVisible ? Number(row.amount) : null, amountVisible, note: String(row?.note || '') });
  }));
}
