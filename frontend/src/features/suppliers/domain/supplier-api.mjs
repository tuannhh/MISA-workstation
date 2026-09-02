export class SupplierApiError extends Error {
  constructor({ status, code, message, requestId }) {
    super(message || 'Không thể tải hồ sơ nhà cung cấp.');
    this.name = 'SupplierApiError';
    this.status = status;
    this.code = code || 'SUPPLIER_DETAIL_REQUEST_FAILED';
    this.requestId = requestId || null;
  }
}

function parseError(status, payload) {
  return new SupplierApiError({ status, code: payload?.code, message: payload?.message || payload?.error, requestId: payload?.requestId });
}

export function createSupplierApi({ fetchFn = globalThis.fetch, basePath = '/api' } = {}) {
  if (typeof fetchFn !== 'function') throw new TypeError('fetchFn phải là một function.');
  return Object.freeze({
    async getList({ page = 1, pageSize = 20, search = '', industry = '' } = {}) {
      const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
      const safePageSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 20));
      const query = new URLSearchParams({ page: String(safePage), pageSize: String(safePageSize), search: String(search || '') });
      if (String(industry || '').trim()) query.set('industry', String(industry).trim());
      const response = await fetchFn(`${basePath}/suppliers?${query}`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      if (!Array.isArray(payload?.rows)) throw new SupplierApiError({ status: 502, code: 'SUPPLIER_LIST_INVALID_RESPONSE', message: 'Danh sách nhà cung cấp trả về không hợp lệ.' });
      return payload;
    },
    async getDetail(supplierId) {
      const id = Number(supplierId);
      if (!Number.isInteger(id) || id < 1) throw new TypeError('supplierId phải là số nguyên dương.');
      const response = await fetchFn(`${basePath}/suppliers/${id}`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      if (!payload?.record || typeof payload.record !== 'object') {
        throw new SupplierApiError({ status: 502, code: 'SUPPLIER_DETAIL_INVALID_RESPONSE', message: 'Dữ liệu hồ sơ nhà cung cấp trả về không hợp lệ.' });
      }
      return payload;
    },
    async getCurrentUser() {
      const response = await fetchFn(`${basePath}/me`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async getAdminUsers() {
      const response = await fetchFn(`${basePath}/admin/users`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      if (!Array.isArray(payload?.rows)) throw new SupplierApiError({ status: 502, code: 'OWNER_USERS_INVALID_RESPONSE', message: 'Danh sách người phụ trách trả về không hợp lệ.' });
      return payload;
    },
    async reassignOwner(entity, recordId, ownerId) {
      if (!['supplier_quote', 'supplier_transaction', 'supplier_contact'].includes(entity)) throw new TypeError('Entity gán lại owner không hợp lệ.');
      const id = Number(recordId); const target = Number(ownerId);
      if (!Number.isInteger(id) || id < 1) throw new TypeError('Mã bản ghi không hợp lệ.');
      if (!Number.isInteger(target) || target < 1) throw new TypeError('Hãy chọn người phụ trách đang hoạt động.');
      const response = await fetchFn(`${basePath}/admin/records/${entity}/${id}/owner`, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ owner_id: target }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload || Object.freeze({ ok: true });
    },
    async update(supplierId, input) {
      const id = Number(supplierId);
      if (!Number.isInteger(id) || id < 1) throw new TypeError('supplierId phải là số nguyên dương.');
      const response = await fetchFn(`${basePath}/suppliers/${id}`, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async createSupplier(input) {
      const response = await fetchFn(`${basePath}/suppliers`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      const id = Number(payload?.id);
      if (!Number.isInteger(id) || id < 1) throw new SupplierApiError({ status: 502, code: 'SUPPLIER_CREATE_INVALID_RESPONSE', message: 'Máy chủ không trả về mã nhà cung cấp hợp lệ.' });
      return Object.freeze({ id });
    },
    async uploadFiles(supplierId, files) {
      const id = Number(supplierId);
      if (!Number.isInteger(id) || id < 1) throw new TypeError('supplierId phải là số nguyên dương.');
      const form = new FormData();
      for (const file of files || []) form.append('files', file);
      const response = await fetchFn(`${basePath}/suppliers/${id}/files`, { method: 'POST', credentials: 'same-origin', body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
  });
}
