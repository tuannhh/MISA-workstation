import { InteractionsApiError } from '../../interactions/domain/interactions-api.mjs';

function errorOf(status, payload) { return new InteractionsApiError({ status, code: payload?.code, message: payload?.message || payload?.error || 'Không thể tải giám sát truyền thông.' }); }

export function createMonitoringApi({ fetchFn = globalThis.fetch, basePath = '/api' } = {}) {
  if (typeof fetchFn !== 'function') throw new TypeError('fetchFn phải là function.');
  return Object.freeze({
    async getCurrentUser() { const response = await fetchFn(`${basePath}/me`, { credentials: 'same-origin' }); const payload = await response.json().catch(() => null); if (!response.ok) throw errorOf(response.status, payload); return payload; },
    async getDashboard({ days = 30 } = {}) { const normalizedDays = [7, 30, 90].includes(Number(days)) ? Number(days) : 30; const from = new Date(Date.now() - (normalizedDays - 1) * 86_400_000).toISOString().slice(0, 10); const response = await fetchFn(`${basePath}/monitor/dashboard?from=${encodeURIComponent(from)}`, { credentials: 'same-origin' }); const payload = await response.json().catch(() => null); if (!response.ok) throw errorOf(response.status, payload); if (!payload?.counts || !payload?.sentiment || !Array.isArray(payload?.alerts)) throw new InteractionsApiError({ status: 502, code: 'MONITOR_DASHBOARD_INVALID_RESPONSE', message: 'Dữ liệu giám sát trả về không hợp lệ.' }); return payload; },
  });
}
