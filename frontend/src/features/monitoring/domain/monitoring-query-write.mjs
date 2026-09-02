export const MONITOR_QUERY_FIELDS = Object.freeze(['name', 'category', 'query_type', 'include', 'exclude', 'enabled', 'grounding']);

export function toMonitoringQueryDraft(record = {}) {
  return Object.freeze({
    name: String(record?.name || ''),
    category: ['brand', 'industry', 'competitor'].includes(record?.category) ? record.category : 'brand',
    queryType: ['news', 'social', 'web'].includes(record?.queryType) ? record.queryType : 'news',
    include: Array.isArray(record?.include) ? record.include.join(', ') : '',
    exclude: Array.isArray(record?.exclude) ? record.exclude.join(', ') : '',
    enabled: record?.enabled !== false,
    grounding: record?.grounding === true
  });
}

export function toMonitoringQueryPayload(draft = {}) {
  const terms = (value) => String(value || '').split(',').map((term) => term.trim()).filter(Boolean).slice(0, 50);
  const name = String(draft?.name || '').trim();
  if (!name) throw new TypeError('Nhập tên bộ từ khóa.');
  return Object.freeze({
    name,
    category: ['brand', 'industry', 'competitor'].includes(draft?.category) ? draft.category : 'brand',
    query_type: ['news', 'social', 'web'].includes(draft?.queryType) ? draft.queryType : 'news',
    include: terms(draft?.include),
    exclude: terms(draft?.exclude),
    enabled: draft?.enabled !== false,
    grounding: draft?.grounding === true
  });
}
