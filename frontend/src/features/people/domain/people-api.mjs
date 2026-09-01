export class PeopleApiError extends Error {
  constructor({ status, code, message, requestId }) {
    super(message || 'Không thể tải hồ sơ nhân sự.');
    this.name = 'PeopleApiError';
    this.status = status;
    this.code = code || 'PEOPLE_DETAIL_REQUEST_FAILED';
    this.requestId = requestId || null;
  }
}

function parseError(status, payload) {
  return new PeopleApiError({
    status,
    code: payload?.code,
    message: payload?.message || payload?.error,
    requestId: payload?.requestId,
  });
}

export function createPeopleApi({ fetchFn = globalThis.fetch, basePath = '/api' } = {}) {
  if (typeof fetchFn !== 'function') throw new TypeError('fetchFn phải là một function.');
  return Object.freeze({
    async getCurrentUser() {
      const response = await fetchFn(`${basePath}/me`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async getDetail(personId) {
      const id = Number(personId);
      if (!Number.isInteger(id) || id < 1) throw new TypeError('personId phải là số nguyên dương.');
      const response = await fetchFn(`${basePath}/people/${id}`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      if (!payload?.record || typeof payload.record !== 'object') {
        throw new PeopleApiError({ status: 502, code: 'PEOPLE_DETAIL_INVALID_RESPONSE', message: 'Dữ liệu hồ sơ trả về không hợp lệ.' });
      }
      return payload;
    },
    async getBookings(personId) {
      const id = Number(personId);
      if (!Number.isInteger(id) || id < 1) throw new TypeError('personId phải là số nguyên dương.');
      const response = await fetchFn(`${basePath}/bookings?subject_type=person&subject_id=${id}`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      if (!Array.isArray(payload?.rows)) throw new PeopleApiError({ status: 502, code: 'BOOKING_LIST_INVALID_RESPONSE', message: 'Dữ liệu booking trả về không hợp lệ.' });
      return payload;
    },
    async getAdminUsers() {
      const response = await fetchFn(`${basePath}/admin/users`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      if (!Array.isArray(payload?.rows)) throw new PeopleApiError({ status: 502, code: 'OWNER_USERS_INVALID_RESPONSE', message: 'Danh sách người phụ trách trả về không hợp lệ.' });
      return payload;
    },
    async reassignBookingOwner(bookingId, ownerId) {
      const id = Number(bookingId); const target = Number(ownerId);
      if (!Number.isInteger(id) || id < 1) throw new TypeError('bookingId phải là số nguyên dương.');
      if (!Number.isInteger(target) || target < 1) throw new TypeError('Hãy chọn người phụ trách đang hoạt động.');
      const response = await fetchFn(`${basePath}/admin/records/booking/${id}/owner`, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ owner_id: target }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload || Object.freeze({ ok: true });
    },
    async getList({ page = 1, pageSize = 20, search = '' } = {}) {
      const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
      const safePageSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 20));
      const query = new URLSearchParams({ page: String(safePage), pageSize: String(safePageSize), search: String(search || '') });
      const response = await fetchFn(`${basePath}/people?${query}`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      if (!Array.isArray(payload?.rows)) throw new PeopleApiError({ status: 502, code: 'PEOPLE_LIST_INVALID_RESPONSE', message: 'Danh sách nhân sự trả về không hợp lệ.' });
      return payload;
    },
    async getOrganizations({ pageSize = 100 } = {}) {
      const safePageSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 100));
      const response = await fetchFn(`${basePath}/partners?pageSize=${safePageSize}`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      if (!Array.isArray(payload?.rows)) throw new PeopleApiError({ status: 502, code: 'PEOPLE_ORGANIZATION_LIST_INVALID_RESPONSE', message: 'Danh sách cơ quan trả về không hợp lệ.' });
      return payload.rows;
    },
    async createPerson(input) {
      const response = await fetchFn(`${basePath}/people`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      const id = Number(payload?.id);
      if (!Number.isInteger(id) || id < 1) throw new PeopleApiError({ status: 502, code: 'PEOPLE_CREATE_INVALID_RESPONSE', message: 'Máy chủ không trả về mã nhân sự hợp lệ.' });
      return Object.freeze({ id });
    },
    async createBooking(input) {
      const response = await fetchFn(`${basePath}/bookings`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async updateBooking(bookingId, input) {
      const id = Number(bookingId);
      if (!Number.isInteger(id) || id < 1) throw new TypeError('bookingId phải là số nguyên dương.');
      const response = await fetchFn(`${basePath}/bookings/${id}`, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async deleteBooking(bookingId) {
      const id = Number(bookingId);
      if (!Number.isInteger(id) || id < 1) throw new TypeError('bookingId phải là số nguyên dương.');
      const response = await fetchFn(`${basePath}/bookings/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async update(personId, input) {
      const id = Number(personId);
      const response = await fetchFn(`${basePath}/people/${id}`, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async deletePerson(personId) {
      const response = await fetchFn(`${basePath}/people/${Number(personId)}`, { method: 'DELETE', credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async upload(personId, files, { kind = 'portrait', visibility = 'private' } = {}) {
      const id = Number(personId);
      const form = new FormData();
      for (const file of files || []) form.append('files', file);
      const response = await fetchFn(`${basePath}/people/${id}/attachments?kind=${encodeURIComponent(kind)}&visibility=${encodeURIComponent(visibility)}`, { method: 'POST', credentials: 'same-origin', body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async setPrimary(personId, attachmentId) {
      const response = await fetchFn(`${basePath}/people/${Number(personId)}/attachments/${Number(attachmentId)}/primary`, { method: 'PUT', credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async deleteAttachment(attachmentId) {
      const response = await fetchFn(`${basePath}/attachments/${Number(attachmentId)}`, { method: 'DELETE', credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
  });
}
