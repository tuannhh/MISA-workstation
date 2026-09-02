export class RemindersApiError extends Error {
  constructor({ status, code, message }) { super(message || 'Không thể xử lý lịch nhắc.'); this.name = 'RemindersApiError'; this.status = status; this.code = code || 'REMINDERS_REQUEST_FAILED'; }
}
function errorOf(status, payload) { return new RemindersApiError({ status, code: payload?.code, message: payload?.message || payload?.error }); }
function positiveId(value, label) { const id = Number(value); if (!Number.isInteger(id) || id < 1) throw new TypeError(`${label} không hợp lệ.`); return id; }

export function reminderPayload(input = {}, { creating = false } = {}) {
  const title = String(input.title || '').trim(); const eventDate = String(input.event_date || '').trim();
  if (!title) throw new TypeError('Nhập tiêu đề ngày nhắc.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new TypeError('Chọn ngày sự kiện hợp lệ.');
  const leadDays = Number(input.lead_days);
  const payload = { title, date_type: ['birthday', 'founding', 'anniversary', 'other'].includes(input.date_type) ? input.date_type : 'other', event_date: eventDate, recurring: Number(input.recurring) === 0 ? 0 : 1, lead_days: Number.isFinite(leadDays) && leadDays >= 1 ? Math.floor(leadDays) : 7, subject_name: String(input.subject_name || '').trim(), note: String(input.note || '').trim() };
  // Không nhận subject_id từ browser; PUT giữ linkage entity hiện có ở server.
  if (creating) payload.subject_type = 'general';
  return Object.freeze(payload);
}

export function createRemindersApi({ fetchFn = globalThis.fetch, basePath = '/api' } = {}) {
  if (typeof fetchFn !== 'function') throw new TypeError('fetchFn phải là function.');
  async function request(path, options = {}) { const response = await fetchFn(`${basePath}${path}`, { credentials: 'same-origin', ...options }); const payload = await response.json().catch(() => null); if (!response.ok) throw errorOf(response.status, payload); return payload; }
  return Object.freeze({
    getCurrentUser: () => request('/me'),
    async getAll() { const payload = await request('/reminders'); if (!Array.isArray(payload?.rows)) throw new RemindersApiError({ status: 502, code: 'REMINDERS_LIST_INVALID_RESPONSE', message: 'Danh sách lịch nhắc trả về không hợp lệ.' }); return payload.rows; },
    async getUpcoming(days = 120) { const safeDays = Math.min(365, Math.max(1, Number.parseInt(days, 10) || 120)); const payload = await request(`/reminders/upcoming?days=${safeDays}`); if (!Array.isArray(payload?.rows)) throw new RemindersApiError({ status: 502, code: 'REMINDERS_UPCOMING_INVALID_RESPONSE', message: 'Danh sách sắp diễn ra trả về không hợp lệ.' }); return Object.freeze({ rows: payload.rows, days: Number(payload.days) || safeDays }); },
    async save(input, id = null) { const updating = id != null; const reminderId = updating ? positiveId(id, 'Mã ngày nhắc') : null; const payload = reminderPayload(input, { creating: !updating }); const result = await request(updating ? `/reminders/${reminderId}` : '/reminders', { method: updating ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }); if (!updating && !Number.isInteger(Number(result?.id))) throw new RemindersApiError({ status: 502, code: 'REMINDER_CREATE_INVALID_RESPONSE', message: 'Máy chủ chưa trả mã ngày nhắc hợp lệ.' }); return Object.freeze({ id: updating ? reminderId : Number(result.id) }); },
    async remove(id) { await request(`/reminders/${positiveId(id, 'Mã ngày nhắc')}`, { method: 'DELETE' }); return Object.freeze({ ok: true }); },
    async getNotifications() { const payload = await request('/notifications'); if (!Array.isArray(payload?.rows)) throw new RemindersApiError({ status: 502, code: 'NOTIFICATIONS_INVALID_RESPONSE', message: 'Hộp thư nhắc trả về không hợp lệ.' }); return Object.freeze({ rows: payload.rows, unread: Math.max(0, Number(payload.unread) || 0) }); },
    async markNotificationRead(id) { await request(`/notifications/${positiveId(id, 'Mã thông báo')}/read`, { method: 'POST' }); return Object.freeze({ ok: true }); },
    async markAllNotificationsRead() { await request('/notifications/read-all', { method: 'POST' }); return Object.freeze({ ok: true }); },
  });
}
