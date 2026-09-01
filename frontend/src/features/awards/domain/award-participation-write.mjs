import { InteractionsApiError } from '../../interactions/domain/interactions-api.mjs';

export const AWARD_PARTICIPATION_FIELDS = Object.freeze(['year', 'status', 'products', 'categories', 'goal', 'purpose', 'capability', 'plan', 'budget', 'result', 'note']);

export function toAwardParticipationDraft(record = {}) {
  const source = record || {};
  return Object.freeze(Object.fromEntries(AWARD_PARTICIPATION_FIELDS.map((key) => [key, key === 'budget' && typeof source[key] === 'number' ? String(source[key]) : (source[key] ?? '')])));
}

export function toAwardParticipationPayload(draft, { existingRecord = null } = {}) {
  const year = draft?.year === '' || draft?.year == null ? null : Number(draft.year);
  if (year !== null && (!Number.isInteger(year) || year < 2000 || year > 2100)) throw new InteractionsApiError({ status: 400, code: 'AWARD_PARTICIPATION_YEAR_INVALID', message: 'Năm tham gia phải nằm trong khoảng 2000–2100.' });
  const budget = draft?.budget === '' || draft?.budget == null ? null : Number(draft.budget);
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) throw new InteractionsApiError({ status: 400, code: 'AWARD_PARTICIPATION_BUDGET_INVALID', message: 'Dự toán phải là số không âm.' });
  return Object.freeze(Object.fromEntries(AWARD_PARTICIPATION_FIELDS.filter((key) => !existingRecord || Object.hasOwn(existingRecord, key)).map((key) => [key, key === 'year' ? year : key === 'budget' ? budget : (draft[key] === '' ? null : draft[key])])));
}
