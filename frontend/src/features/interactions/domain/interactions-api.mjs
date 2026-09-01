export class InteractionsApiError extends Error { constructor({ status, code, message }) { super(message || 'Không thể tải tương tác.'); this.name = 'InteractionsApiError'; this.status = status; this.code = code || 'INTERACTIONS_REQUEST_FAILED'; } }
function errorOf(status, payload) { return new InteractionsApiError({ status, code: payload?.code, message: payload?.message || payload?.error }); }
export function createInteractionsApi({ fetchFn = globalThis.fetch, basePath = '/api' } = {}) {
  if (typeof fetchFn !== 'function') throw new TypeError('fetchFn phải là function.');
  return Object.freeze({
    async getCurrentUser() { const response = await fetchFn(`${basePath}/me`, { credentials: 'same-origin' }); const payload = await response.json().catch(() => null); if (!response.ok) throw errorOf(response.status, payload); return payload; },
    async getList({ page = 1, pageSize = 20, search = '' } = {}) { const query = new URLSearchParams({ page: String(Math.max(1, Number.parseInt(page, 10) || 1)), pageSize: String(Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 20))), search: String(search || '') }); const response = await fetchFn(`${basePath}/interactions?${query}`, { credentials: 'same-origin' }); const payload = await response.json().catch(() => null); if (!response.ok) throw errorOf(response.status, payload); if (!Array.isArray(payload?.rows)) throw new InteractionsApiError({ status: 502, code: 'INTERACTION_LIST_INVALID_RESPONSE', message: 'Danh sách tương tác trả về không hợp lệ.' }); return payload; },
  });
}
