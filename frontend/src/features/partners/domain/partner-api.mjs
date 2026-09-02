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
    async getList({ type = 'press', page = 1, pageSize = 20, search = '' } = {}) {
      const safeType = ['press', 'association', 'gov', 'other'].includes(type) ? type : 'other';
      const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
      const safePageSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 20));
      const query = new URLSearchParams({ type: safeType, page: String(safePage), pageSize: String(safePageSize), search: String(search || '') });
      const response = await fetchFn(`${basePath}/partners?${query}`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      if (!Array.isArray(payload?.rows)) throw new PartnerApiError({ status: 502, code: 'PARTNER_LIST_INVALID_RESPONSE', message: 'Danh sách cơ quan trả về không hợp lệ.' });
      return payload;
    },
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
    async getAdminUsers() {
      const response = await fetchFn(`${basePath}/admin/users`, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      if (!Array.isArray(payload?.rows)) throw new PartnerApiError({ status: 502, code: 'OWNER_USERS_INVALID_RESPONSE', message: 'Danh sách người phụ trách trả về không hợp lệ.' });
      return payload;
    },
    async reassignOwner(entity, recordId, ownerId) {
      if (!['agreement', 'work_log', 'sponsorship', 'gift', 'association_fee', 'benefit_usage'].includes(entity)) throw new TypeError('Entity gán lại owner không hợp lệ.');
      const id = Number(recordId); const target = Number(ownerId);
      if (!Number.isInteger(id) || id < 1) throw new TypeError('Mã bản ghi không hợp lệ.');
      if (!Number.isInteger(target) || target < 1) throw new TypeError('Hãy chọn người phụ trách đang hoạt động.');
      const response = await fetchFn(`${basePath}/admin/records/${entity}/${id}/owner`, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ owner_id: target }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload || Object.freeze({ ok: true });
    },
    async update(partnerId, input) {
      const id = Number(partnerId);
      const response = await fetchFn(`${basePath}/partners/${id}`, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async createPartner(input) {
      const response = await fetchFn(`${basePath}/partners`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      const id = Number(payload?.id);
      if (!Number.isInteger(id) || id < 1) throw new PartnerApiError({ status: 502, code: 'PARTNER_CREATE_INVALID_RESPONSE', message: 'Máy chủ không trả về mã cơ quan hợp lệ.' });
      return Object.freeze({ id });
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
    async uploadAgreementFiles(agreementId, files) {
      const form = new FormData();
      for (const file of files || []) form.append('files', file);
      const response = await fetchFn(`${basePath}/agreements/${Number(agreementId)}/files`, { method: 'POST', credentials: 'same-origin', body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async uploadWorkLogFiles(workLogId, files) {
      const form = new FormData();
      for (const file of files || []) form.append('files', file);
      const response = await fetchFn(`${basePath}/work-logs/${Number(workLogId)}/files`, { method: 'POST', credentials: 'same-origin', body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw parseError(response.status, payload);
      return payload;
    },
    async saveFinancial(partnerId, entity, input, recordId = null) {
      const partner = Number(partnerId); const record = Number(recordId); const updating = Number.isInteger(record) && record > 0;
      const endpoints = { sponsorship: updating ? `/sponsorships/${record}` : `/partners/${partner}/sponsorships`, gift: updating ? `/gifts/${record}` : `/partners/${partner}/gifts`, association_fee: updating ? `/partners/${partner}/fees/${record}` : `/partners/${partner}/fees`, benefit_usage: updating ? `/benefit-usages/${record}` : `/partners/${partner}/benefit-usages` };
      if (!Number.isInteger(partner) || partner < 1 || !endpoints[entity]) throw new TypeError('Khoản cơ quan không hợp lệ.');
      const response = await fetchFn(`${basePath}${endpoints[entity]}`, { method: updating ? 'PUT' : 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => null); if (!response.ok) throw parseError(response.status, payload);
      if (!updating && !Number.isInteger(Number(payload?.id))) throw new PartnerApiError({ status: 502, code: 'PARTNER_FINANCIAL_CREATE_INVALID_RESPONSE', message: 'Máy chủ chưa trả mã khoản hợp lệ.' });
      return Object.freeze({ id: updating ? record : Number(payload.id) });
    },
    async deleteFinancialForPartner(partnerId, entity, recordId) {
      const partner = Number(partnerId); const record = Number(recordId); const endpoints = { sponsorship: `/sponsorships/${record}`, gift: `/gifts/${record}`, association_fee: `/partners/${partner}/fees/${record}`, benefit_usage: `/benefit-usages/${record}` };
      if (!Number.isInteger(partner) || partner < 1 || !Number.isInteger(record) || record < 1 || !endpoints[entity]) throw new TypeError('Khoản cơ quan không hợp lệ.');
      const response = await fetchFn(`${basePath}${endpoints[entity]}`, { method: 'DELETE', credentials: 'same-origin' }); const payload = await response.json().catch(() => null); if (!response.ok) throw parseError(response.status, payload); return Object.freeze({ ok: true });
    },
  });
}
