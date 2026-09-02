import { InteractionsApiError } from '../../interactions/domain/interactions-api.mjs';

function errorOf(status, payload) {
  return new InteractionsApiError({ status, code: payload?.code, message: payload?.message || payload?.error || 'Không thể xử lý ghi âm.' });
}

function rows(value, code, message) {
  if (!Array.isArray(value)) throw new InteractionsApiError({ status: 502, code, message });
  return value;
}

export function createVoiceIdempotencyKey(randomUuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)) {
  if (typeof randomUuid !== 'function') throw new InteractionsApiError({ status: 503, code: 'VOICE_IDEMPOTENCY_UNAVAILABLE', message: 'Trình duyệt chưa sẵn sàng để xác nhận an toàn. Vui lòng thử lại.' });
  return randomUuid();
}

export function createVoiceApi({ fetchFn = globalThis.fetch, basePath = '/api' } = {}) {
  if (typeof fetchFn !== 'function') throw new TypeError('fetchFn phải là function.');
  return Object.freeze({
    async propose(audio, { consent = false } = {}) {
      if (!(audio instanceof Blob) || audio.size < 1) throw new InteractionsApiError({ status: 400, code: 'VOICE_AUDIO_REQUIRED', message: 'Hãy chọn một tệp ghi âm hợp lệ.' });
      if (consent !== true) throw new InteractionsApiError({ status: 422, code: 'AI_DATA_CONSENT_REQUIRED', message: 'Hãy xác nhận bạn được phép gửi bản ghi âm tới dịch vụ AI để xử lý.' });
      const form = new FormData();
      form.append('audio', audio, audio.name || 'voice.webm');
      form.append('aiConsent', 'true');
      const response = await fetchFn(`${basePath}/ai/interaction-voice-propose`, { method: 'POST', credentials: 'same-origin', body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw errorOf(response.status, payload);
      if (!String(payload?.proposalId || '').trim() || !String(payload?.expiresAt || '').trim()) throw new InteractionsApiError({ status: 502, code: 'VOICE_PROPOSAL_INVALID_RESPONSE', message: 'Máy chủ trả đề xuất ghi âm không hợp lệ.' });
      return Object.freeze({ proposalId: payload.proposalId, expiresAt: payload.expiresAt, extracted: Object.freeze(payload.extracted || {}), personCandidates: rows(payload.personCandidates, 'VOICE_PERSON_CANDIDATES_INVALID', 'Danh sách người liên hệ không hợp lệ.'), orgCandidates: rows(payload.orgCandidates, 'VOICE_ORG_CANDIDATES_INVALID', 'Danh sách cơ quan không hợp lệ.'), matchConfidence: Object.freeze(payload.matchConfidence || {}), suggestedScoreDelta: Number(payload.suggestedScoreDelta || 0) });
    },
    async confirm({ proposalId, idempotencyKey, edits = {} }) {
      if (!String(proposalId || '').trim() || !String(idempotencyKey || '').trim()) throw new InteractionsApiError({ status: 400, code: 'VOICE_CONFIRM_REQUIRED', message: 'Thiếu mã đề xuất hoặc mã xác nhận an toàn.' });
      const response = await fetchFn(`${basePath}/ai/interaction-voice-confirm`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proposalId, idempotencyKey, edits }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw errorOf(response.status, payload);
      if (!Number.isInteger(Number(payload?.interactionId))) throw new InteractionsApiError({ status: 502, code: 'VOICE_CONFIRM_INVALID_RESPONSE', message: 'Máy chủ chưa trả mã tương tác hợp lệ.' });
      return Object.freeze({ interactionId: Number(payload.interactionId), idempotent: payload.idempotent === true, person: payload.person || null });
    },
  });
}
