import { InteractionsApiError } from '../../interactions/domain/interactions-api.mjs';

function errorOf(status, payload) { return new InteractionsApiError({ status, code: payload?.code, message: payload?.message || payload?.error || 'Không thể tải giải thưởng.' }); }
export function createAwardsApi({ fetchFn = globalThis.fetch, basePath = '/api' } = {}) {
  if (typeof fetchFn !== 'function') throw new TypeError('fetchFn phải là function.');
  return Object.freeze({
    async getList({ page = 1, pageSize = 20, search = '' } = {}) { const query = new URLSearchParams({ page: String(Math.max(1, Number(page) || 1)), pageSize: String(Math.min(100, Math.max(1, Number(pageSize) || 20))), search: String(search || '') }); const response = await fetchFn(`${basePath}/awards?${query}`, { credentials: 'same-origin' }); const payload = await response.json().catch(() => null); if (!response.ok) throw errorOf(response.status, payload); if (!Array.isArray(payload?.rows)) throw new InteractionsApiError({ status: 502, code: 'AWARD_LIST_INVALID_RESPONSE', message: 'Danh sách giải thưởng trả về không hợp lệ.' }); return payload; },
    async get(id) { const awardId = Number(id); if (!Number.isInteger(awardId) || awardId < 1) throw new InteractionsApiError({ status: 400, code: 'AWARD_ID_INVALID', message: 'Mã giải thưởng không hợp lệ.' }); const response = await fetchFn(`${basePath}/awards/${awardId}`, { credentials: 'same-origin' }); const payload = await response.json().catch(() => null); if (!response.ok) throw errorOf(response.status, payload); if (!payload?.record) throw new InteractionsApiError({ status: 502, code: 'AWARD_INVALID_RESPONSE', message: 'Chi tiết giải thưởng trả về không hợp lệ.' }); return payload; },
  });
}
