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
  });
}
