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
    async update(supplierId, input) {
      const id = Number(supplierId);
      if (!Number.isInteger(id) || id < 1) throw new TypeError('supplierId phải là số nguyên dương.');
      const response = await fetchFn(`${basePath}/suppliers/${id}`, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
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
