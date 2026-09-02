function asNumber(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
export function monitoringDashboardViewModel(payload) {
  const sentiment = Object.freeze({ positive: asNumber(payload?.sentiment?.positive), neutral: asNumber(payload?.sentiment?.neutral), negative: asNumber(payload?.sentiment?.negative) });
  const counts = Object.freeze(Object.fromEntries(['total', 'brand', 'industry', 'competitor', 'newest24h'].map((key) => [key, asNumber(payload?.counts?.[key])])));
  return Object.freeze({ from: String(payload?.from || ''), to: String(payload?.to || ''), counts, sentiment, nsr: asNumber(payload?.nsr), crisis: Boolean(payload?.crisis), neg24: asNumber(payload?.neg24), sourceCount: asNumber(payload?.sourceCount), trend: Object.freeze((payload?.trend || []).map((row) => Object.freeze({ date: String(row?.date || ''), total: asNumber(row?.total), nsr: asNumber(row?.nsr) }))), alerts: Object.freeze((payload?.alerts || []).map((row) => Object.freeze({ id: Number(row?.id), level: String(row?.level || 'info'), title: String(row?.title || ''), detail: String(row?.detail || ''), createdAt: String(row?.created_at || '') }))), lastRun: payload?.lastRun ? Object.freeze({ status: String(payload.lastRun.status || ''), startedAt: String(payload.lastRun.started_at || ''), fetched: asNumber(payload.lastRun.fetched), newMentions: asNumber(payload.lastRun.new_mentions), analyzed: asNumber(payload.lastRun.analyzed) }) : null });
}

export function monitoringSourcesViewModel(rows = []) {
  return Object.freeze((Array.isArray(rows) ? rows : []).map((row) => Object.freeze({ id: Number(row?.id), name: String(row?.name || ''), type: String(row?.type || 'news'), url: String(row?.url || ''), enabled: Number(row?.enabled) !== 0, mode: String(row?.mode || '') })).filter((row) => Number.isInteger(row.id) && row.id > 0));
}
