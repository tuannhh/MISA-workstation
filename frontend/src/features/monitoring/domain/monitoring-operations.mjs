function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function jsonArray(value) {
  if (Array.isArray(value)) return value.map(String);
  try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
}

export function monitoringRunsViewModel(rows = []) {
  return Object.freeze((Array.isArray(rows) ? rows : []).map((row) => Object.freeze({
    id: asNumber(row?.id), status: String(row?.status || ''), startedAt: String(row?.started_at || ''), finishedAt: String(row?.finished_at || ''),
    queries: asNumber(row?.queries), fetched: asNumber(row?.fetched), newMentions: asNumber(row?.new_mentions), analyzed: asNumber(row?.analyzed),
    positive: asNumber(row?.pos), neutral: asNumber(row?.neu), negative: asNumber(row?.neg), error: String(row?.error || ''), triggeredBy: String(row?.triggered_by || '')
  })).filter((row) => Number.isInteger(row.id) && row.id > 0));
}

export function monitoringCompetitorsViewModel(rows = []) {
  return Object.freeze((Array.isArray(rows) ? rows : []).map((row) => Object.freeze({
    id: asNumber(row?.id), name: String(row?.name || ''), website: String(row?.website || ''), fanpage: String(row?.fanpage || ''),
    channels: jsonArray(row?.channels), note: String(row?.note || '')
  })).filter((row) => Number.isInteger(row.id) && row.id > 0));
}

export function monitoringCampaignsViewModel(rows = []) {
  return Object.freeze((Array.isArray(rows) ? rows : []).map((row) => Object.freeze({
    id: asNumber(row?.id), name: String(row?.name || ''), startDate: String(row?.start_date || ''), endDate: String(row?.end_date || ''),
    message: String(row?.message || ''), content: String(row?.content || ''), audience: String(row?.audience || ''), status: String(row?.status || ''),
    note: String(row?.note || ''), keywords: jsonArray(row?.keywords), competitors: jsonArray(row?.competitors)
  })).filter((row) => Number.isInteger(row.id) && row.id > 0));
}

export function monitoringSettingsViewModel(payload = {}) {
  return Object.freeze({ autoscan: payload?.autoscan === true, intervalHours: Math.max(1, Math.min(168, asNumber(payload?.interval_hours, 4))), scanDays: Math.max(1, Math.min(365, asNumber(payload?.scan_days, 30))) });
}

export function toCompetitorPayload(draft = {}) {
  const name = String(draft?.name || '').trim();
  if (!name) throw new TypeError('Nhập tên đối thủ.');
  const split = (value) => String(value || '').split(',').map((part) => part.trim()).filter(Boolean).slice(0, 30);
  return Object.freeze({ name, website: String(draft?.website || '').trim() || null, fanpage: String(draft?.fanpage || '').trim() || null, channels: split(draft?.channels), note: String(draft?.note || '').trim() || null });
}

export function toCampaignPayload(draft = {}) {
  const name = String(draft?.name || '').trim();
  if (!name) throw new TypeError('Nhập tên chiến dịch.');
  const split = (value) => String(value || '').split(',').map((part) => part.trim()).filter(Boolean).slice(0, 50);
  return Object.freeze({ name, start_date: String(draft?.startDate || '').trim() || null, end_date: String(draft?.endDate || '').trim() || null, message: String(draft?.message || '').trim() || null, content: String(draft?.content || '').trim() || null, audience: String(draft?.audience || '').trim() || null, status: String(draft?.status || '').trim() || null, note: String(draft?.note || '').trim() || null, keywords: split(draft?.keywords), competitors: split(draft?.competitors) });
}

export function toSettingsPayload(draft = {}) {
  const interval = Number.parseInt(draft?.intervalHours, 10); const days = Number.parseInt(draft?.scanDays, 10);
  return Object.freeze({ autoscan: draft?.autoscan === true, interval_hours: Number.isInteger(interval) ? Math.max(1, Math.min(168, interval)) : 4, scan_days: Number.isInteger(days) ? Math.max(1, Math.min(365, days)) : 30 });
}
