export class DashboardApiError extends Error {
  constructor({ status, code, message }) {
    super(message || 'Không thể tải tổng quan.');
    this.name = 'DashboardApiError';
    this.status = Number(status) || 0;
    this.code = code || 'DASHBOARD_REQUEST_FAILED';
  }
}

function errorOf(status, payload) {
  return new DashboardApiError({ status, code: payload?.code, message: payload?.message || payload?.error });
}

export function createDashboardApi({ fetchFn = globalThis.fetch, basePath = '/api' } = {}) {
  if (typeof fetchFn !== 'function') throw new TypeError('fetchFn phải là function.');
  return Object.freeze({
    async getOverview() {
      const response = await fetchFn(`${basePath}/dashboard`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw errorOf(response.status, payload);
      if (!payload?.overview || !payload?.charts || !Array.isArray(payload?.upcoming)) {
        throw new DashboardApiError({ status: 502, code: 'DASHBOARD_INVALID_RESPONSE', message: 'Dữ liệu tổng quan trả về không hợp lệ.' });
      }
      return payload;
    },
  });
}
