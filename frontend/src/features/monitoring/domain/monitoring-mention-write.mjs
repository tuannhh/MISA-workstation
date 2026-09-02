export const MENTION_STATUS_OPTIONS = Object.freeze(['Mới', 'Đang xử lý', 'Đã duyệt', 'Bỏ qua']);
export const MENTION_SENTIMENT_OPTIONS = Object.freeze(['', 'positive', 'neutral', 'negative']);
export const MENTION_WRITE_FIELDS = Object.freeze(['sentiment', 'status', 'next_action', 'assignee', 'tags', 'note']);

export function toMentionReviewDraft(record = {}) {
  const tags = Array.isArray(record?.tags) ? record.tags : [];
  return Object.freeze({
    sentiment: MENTION_SENTIMENT_OPTIONS.includes(record?.sentiment) ? record.sentiment : '',
    status: MENTION_STATUS_OPTIONS.includes(record?.status) ? record.status : 'Mới',
    nextAction: String(record?.nextAction || ''),
    assignee: String(record?.assignee || ''),
    tags: tags.join(', '),
    note: String(record?.note || ''),
  });
}

export function toMentionReviewPayload(draft = {}) {
  const sentiment = MENTION_SENTIMENT_OPTIONS.includes(draft?.sentiment) ? draft.sentiment : '';
  const status = MENTION_STATUS_OPTIONS.includes(draft?.status) ? draft.status : 'Mới';
  return Object.freeze({ sentiment, status, next_action: String(draft?.nextAction || '').trim(), assignee: String(draft?.assignee || '').trim(), tags: String(draft?.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20), note: String(draft?.note || '').trim() });
}
