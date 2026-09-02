const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

async function module() { return import(pathToFileURL(path.join(process.cwd(), 'frontend/src/features/monitoring/domain/monitoring-operations.mjs')).href); }

test('UI-MONITOR-006: vận hành giám sát có projection an toàn và payload allowlist', async () => {
  const { monitoringRunsViewModel, monitoringCompetitorsViewModel, monitoringCampaignsViewModel, monitoringSettingsViewModel, toCompetitorPayload, toCampaignPayload, toSettingsPayload } = await module();
  const runs = monitoringRunsViewModel([{ id: '4', status: 'done', fetched: '8', new_mentions: '2', analyzed: '2', pos: '1', neu: '1', neg: '0', triggered_by: 'admin' }, { id: 0 }]);
  assert.equal(runs.length, 1); assert.equal(runs[0].fetched, 8); assert.equal(runs[0].triggeredBy, 'admin');
  const competitors = monitoringCompetitorsViewModel([{ id: 2, name: 'Đối thủ A', channels: '["web"]', secret: 'drop' }]);
  assert.deepEqual(competitors[0], { id: 2, name: 'Đối thủ A', website: '', fanpage: '', channels: ['web'], note: '' });
  const campaigns = monitoringCampaignsViewModel([{ id: 3, name: 'Mùa thu', keywords: '["MISA"]', competitors: '["A"]' }]);
  assert.deepEqual(campaigns[0].keywords, ['MISA']); assert.deepEqual(campaigns[0].competitors, ['A']);
  assert.deepEqual(monitoringSettingsViewModel({ autoscan: true, interval_hours: 999, scan_days: 0 }), { autoscan: true, intervalHours: 168, scanDays: 1 });
  assert.deepEqual(toCompetitorPayload({ name: ' A ', channels: 'web, social', ignored: 'x' }), { name: 'A', website: null, fanpage: null, channels: ['web', 'social'], note: null });
  assert.deepEqual(toCampaignPayload({ name: 'Mùa thu', keywords: 'MISA, AMIS', competitors: 'A' }).keywords, ['MISA', 'AMIS']);
  assert.deepEqual(toSettingsPayload({ autoscan: true, intervalHours: 2, scanDays: 30 }), { autoscan: true, interval_hours: 2, scan_days: 30 });
  assert.throws(() => toCompetitorPayload({}), /Nhập tên đối thủ/); assert.throws(() => toCampaignPayload({}), /Nhập tên chiến dịch/);
});

test('UI-MONITOR-008: monitoring API gửi đúng method, path và chỉ nhận response hợp lệ', async () => {
  const { createMonitoringApi } = await import(pathToFileURL(path.join(process.cwd(), 'frontend/src/features/monitoring/domain/monitoring-api.mjs')).href);
  const calls = [];
  const fetchFn = async (url, options = {}) => {
    calls.push({ url, options });
    const body = url.endsWith('/monitor/scan') ? { runId: 9, fetched: '3', new_mentions: '1', analyzed: '1' }
      : url.endsWith('/monitor/settings') && options.method === 'PUT' ? { ok: true }
        : { rows: [] };
    return { ok: true, status: 200, json: async () => body };
  };
  const api = createMonitoringApi({ fetchFn, basePath: '/api' });
  assert.deepEqual(await api.runScan([3, '3', 0]), { runId: 9, fetched: 3, newMentions: 1, analyzed: 1 });
  await api.saveSettings({ autoscan: true, interval_hours: 999, scan_days: 0 });
  await api.getRuns();
  assert.equal(calls[0].url, '/api/monitor/scan');
  assert.deepEqual(JSON.parse(calls[0].options.body), { query_ids: [3] });
  assert.equal(calls[1].options.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[1].options.body), { autoscan: true, interval_hours: 168, scan_days: 1 });
  assert.equal(calls[2].url, '/api/monitor/runs');
  await assert.rejects(() => api.runScan([]), /Chọn ít nhất một bộ từ khóa/);
});
