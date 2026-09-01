export class PartnerApiError extends Error {
  constructor({ status, code, message, requestId }) {
    super(message || 'Không thể tải hồ sơ cơ quan.');
    this.name = 'PartnerApiError';
    this.status = status;
    this.code = code || 'PARTNER_DETAIL_REQUEST_FAILED';
    this.requestId = requestId || null;
  }
}

function parseError(status, payload) {
  return new PartnerApiError({ status, code: payload?.code, message: payload?.message || payload?.error, requestId: payload?.requestId });
}

export function createPartnerApi({ fetchFn = globalThis.fetch, basePath = '/api' } = {}) {
  if (typeof fetchFn !== 'function') throw new TypeError('fetchFn phải là một function.');
  return Object.freeze({
    async getDetail(partnerId) {
      const id = Number(partnerId);
      if (!Number.isInteger(id) || id < 1) throw new TypeError('partnerId phải là số nguyên dương.');
      const response = await fetchFn(`${basePath}/partners/${id}`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      if (!payload?.record || typeof payload.record !== 'object') {
        throw new PartnerApiError({ status: 502, code: 'PARTNER_DETAIL_INVALID_RESPONSE', message: 'Dữ liệu hồ sơ cơ quan trả về không hợp lệ.' });
      }
      return payload;
    },
    async getCurrentUser() {
      const response = await fetchFn(`${basePath}/me`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async update(partnerId, input) {
      const id = Number(partnerId);
      const response = await fetchFn(`${basePath}/partners/${id}`, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async deletePartner(partnerId) {
      const response = await fetchFn(`${basePath}/partners/${Number(partnerId)}`, { method: 'DELETE', credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async createAgreement(partnerId, input) {
      const response = await fetchFn(`${basePath}/partners/${Number(partnerId)}/agreements`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async createWorkLog(partnerId, input) {
      const response = await fetchFn(`${basePath}/partners/${Number(partnerId)}/work-logs`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async deleteAgreement(agreementId) {
      const response = await fetchFn(`${basePath}/agreements/${Number(agreementId)}`, { method: 'DELETE', credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async updateAgreement(agreementId, input) {
      const response = await fetchFn(`${basePath}/agreements/${Number(agreementId)}`, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async deleteWorkLog(workLogId) {
      const response = await fetchFn(`${basePath}/work-logs/${Number(workLogId)}`, { method: 'DELETE', credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async updateWorkLog(workLogId, input) {
      const response = await fetchFn(`${basePath}/work-logs/${Number(workLogId)}`, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
  });
}
