'use strict';
// W1.AI-POLICY (F4) — data-egress gateway cấu hình được cho TOÀN BỘ 12 luồng egress Gemini
// (AI-E001..AI-E012, `06-threat-model.md` §A/§D) + SMTP. KHÔNG phải hard-deny: O8 = PROVISIONAL
// (owner cho phép gửi Gemini tạm với dữ liệu test) nên mặc định CHO PHÉP mọi luồng — nhưng cơ chế
// deny-by-default có sẵn để siết chỉ bằng đổi cấu hình (app_meta `ai_egress_deny_ids`), không cần
// deploy code mới, khi có dữ liệu thật + Security/Legal duyệt.
//
// 4 trục theo `03-data-classification.md` §D + §E (`authorizeEgress(entity, purpose, provider)`):
// tier (Public/Internal/Confidential/Restricted, gắn CỐ ĐỊNH theo luồng — không đổi qua config) ×
// purpose (mô tả mục đích, để audit/allowlist theo use-case sau này) × provider (gemini|smtp) ×
// decision (allowed/denied-kill-switch/denied-policy).
const { db, audit, metaGet } = require('./db');

// Đăng ký DUY NHẤT — nguồn sự thật cho mọi luồng egress, đối chiếu 1:1 với AI-E001..AI-E012.
const REGISTRY = Object.freeze({
  'AI-E001': { name: 'interaction-voice', tier: 'Confidential', purpose: 'voice-extraction' },
  'AI-E002': { name: 'card-text', tier: 'Internal', purpose: 'content-generation' },
  'AI-E003': { name: 'card-image', tier: 'Internal', purpose: 'content-generation' },
  'AI-E004': { name: 'award-extract', tier: 'Internal', purpose: 'document-extraction' },
  'AI-E005': { name: 'award-advice', tier: 'Internal', purpose: 'advisory' },
  'AI-E006': { name: 'event-extract', tier: 'Internal', purpose: 'document-extraction' },
  'AI-E007': { name: 'analyzeBatch', tier: 'Public', purpose: 'sentiment-analysis' },
  'AI-E008': { name: 'groundIngest', tier: 'Internal', purpose: 'media-monitoring' },
  'AI-E009': { name: 'siteGroundIngest', tier: 'Internal', purpose: 'media-monitoring' },
  'AI-E010': { name: 'aiMisaHighlights', tier: 'Public', purpose: 'media-monitoring' },
  'AI-E011': { name: 'aiCompetitorAnalysis', tier: 'Internal', purpose: 'competitive-intel' },
  'AI-E012': { name: 'evaluateCampaign', tier: 'Internal', purpose: 'campaign-evaluation' },
  SMTP: { name: 'mailer', tier: 'Internal', purpose: 'notification' },
});

function providerOf(flowId) { return flowId === 'SMTP' ? 'smtp' : 'gemini'; }

// Kill-switch cứng — ưu tiên cao nhất, luôn thắng mọi cấu hình app_meta. AI_DISABLED chặn 12 luồng
// AI-E00x; SMTP_DISABLED chặn riêng luồng SMTP (2 công tắc độc lập, không dùng chung 1 biến vì tắt
// email không có nghĩa phải tắt AI và ngược lại).
function killSwitchOn(flowId) {
  if (flowId === 'SMTP') return process.env.SMTP_DISABLED === '1';
  return process.env.AI_DISABLED === '1';
}

// Deny-list động qua app_meta — Admin siết bằng cấu hình, không cần đổi code/deploy. Rỗng mặc định
// (O8 provisional = permissive). Lỗi parse JSON coi như rỗng (fail-open đúng theo O8 hiện tại, KHÔNG
// phải fail-closed — nếu sau này chuyển sang deny-by-default thật, đổi nhánh catch này trước).
function denyList() {
  try {
    const raw = JSON.parse(metaGet('ai_egress_deny_ids', '[]'));
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

// Ghi audit egress — CHỈ metadata (tier/purpose/provider/decision), TUYỆT ĐỐI không chứa nội dung
// payload thật đã/định gửi AI. principal null khi gọi từ job nền (không có req/session).
function logEgress(flowId, principal, decision) {
  const def = REGISTRY[flowId] || {};
  try {
    audit({
      user_id: principal?.id || null,
      username: principal?.username || 'system',
      action: 'AI_EGRESS',
      entity: flowId,
      detail: JSON.stringify({ tier: def.tier, purpose: def.purpose, provider: providerOf(flowId), decision }),
    });
  } catch (e) { console.error('[ai-policy] lỗi ghi audit egress:', e.message); }
}

// Gọi TRƯỚC mỗi lần thực sự gửi dữ liệu ra ngoài (Gemini hoặc SMTP). Throw nếu bị chặn — lỗi rơi
// thẳng vào catch() sẵn có của route/job gọi nó (không cần đổi cấu trúc xử lý lỗi hiện có).
function assertEgressAllowed(flowId, principal = null) {
  const def = REGISTRY[flowId];
  if (!def) throw new Error(`ai-policy: luồng egress không xác định trong registry: ${flowId}`);
  if (killSwitchOn(flowId)) {
    logEgress(flowId, principal, 'denied-kill-switch');
    throw new Error(`Egress bị chặn: ${flowId === 'SMTP' ? 'SMTP_DISABLED' : 'AI_DISABLED'} đang bật.`);
  }
  if (denyList().includes(flowId)) {
    logEgress(flowId, principal, 'denied-policy');
    throw new Error(`Egress bị chặn theo chính sách hiện tại cho luồng ${flowId}.`);
  }
  logEgress(flowId, principal, 'allowed');
  return def;
}

// Retention/delete — xoá RIÊNG log egress (action='AI_EGRESS') cũ hơn N ngày; KHÔNG đụng các dòng
// audit_log khác (LOGIN/LOGOUT/...). Trả về số dòng đã xoá.
function pruneEgressLog(days = 90) {
  const n = Math.max(1, Number(days) || 90);
  return db.prepare(`DELETE FROM audit_log WHERE action='AI_EGRESS' AND ts < datetime('now','-${n} day')`).run().changes;
}

// Sweep định kỳ nhẹ, cùng pattern setInterval+unref() đã dùng ở scheduler.js/monitor.js — không tạo
// cơ chế cron mới, tái dùng quy ước sẵn có của codebase.
let timer = null;
function startRetentionSweep() {
  if (timer) { clearInterval(timer); timer = null; }
  timer = setInterval(() => { try { pruneEgressLog(); } catch (e) { console.error('[ai-policy] lỗi sweep retention:', e.message); } }, 24 * 3600 * 1000);
  if (timer.unref) timer.unref();
}

module.exports = { REGISTRY, assertEgressAllowed, logEgress, pruneEgressLog, startRetentionSweep };
