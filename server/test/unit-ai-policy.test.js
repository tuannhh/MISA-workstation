'use strict';
// W1.AI-POLICY (F4) — unit test cho gateway egress mới server/ai-policy.js. Cách ly DATA_DIR tạm +
// DB_CLIENT=sqlite (giống unit-ai-redaction-schema.test.js) vì ai-policy.js require('./db') để ghi
// audit_log/đọc app_meta — KHÔNG cần app/HTTP, chỉ cần db thật (sqlite tmp) đứng sau.
process.env.DB_CLIENT = 'sqlite';
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-unit-ai-policy-'));

const test = require('node:test');
const assert = require('node:assert/strict');

const { db, metaSet } = require('../db');
const aiPolicy = require('../ai-policy');

test.after(() => { fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); });

function lastEgressLog(flowId) {
  const row = db.prepare("SELECT * FROM audit_log WHERE action='AI_EGRESS' AND entity=? ORDER BY id DESC LIMIT 1").get(flowId);
  return row ? { ...row, detail: JSON.parse(row.detail) } : null;
}

test('AI-POLICY-001: REGISTRY có đúng 13 luồng (AI-E001..AI-E012 + SMTP), mỗi luồng có tier+purpose', () => {
  const keys = Object.keys(aiPolicy.REGISTRY);
  assert.equal(keys.length, 13);
  for (let i = 1; i <= 12; i++) {
    const id = `AI-E${String(i).padStart(3, '0')}`;
    assert.ok(keys.includes(id), `thiếu ${id}`);
  }
  assert.ok(keys.includes('SMTP'));
  for (const [id, def] of Object.entries(aiPolicy.REGISTRY)) {
    assert.ok(def.tier, `${id} thiếu tier`);
    assert.ok(def.purpose, `${id} thiếu purpose`);
  }
});

test('AI-POLICY-002: assertEgressAllowed() đường mặc định (O8 permissive) cho phép, ghi audit "allowed" KHÔNG chứa payload', () => {
  const out = aiPolicy.assertEgressAllowed('AI-E001', { id: 7, username: 'nv1' });
  assert.equal(out.name, 'interaction-voice');
  const log = lastEgressLog('AI-E001');
  assert.equal(log.username, 'nv1');
  assert.equal(log.user_id, 7);
  assert.equal(log.detail.decision, 'allowed');
  assert.equal(log.detail.tier, 'Confidential');
  assert.equal(log.detail.provider, 'gemini');
  assert.ok(!('text' in log.detail) && !('payload' in log.detail) && !('content' in log.detail));
});

test('AI-POLICY-003: assertEgressAllowed() với flowId không có trong REGISTRY thì throw', () => {
  assert.throws(() => aiPolicy.assertEgressAllowed('AI-E999'), /không xác định/);
});

test('AI-POLICY-004: principal null (job nền) log username "system"', () => {
  aiPolicy.assertEgressAllowed('AI-E007');
  const log = lastEgressLog('AI-E007');
  assert.equal(log.username, 'system');
  assert.equal(log.user_id, null);
});

test('AI-POLICY-005: AI_DISABLED=1 chặn TẤT CẢ 12 luồng AI-E00x nhưng KHÔNG chặn SMTP; ghi "denied-kill-switch"', () => {
  process.env.AI_DISABLED = '1';
  try {
    for (let i = 1; i <= 12; i++) {
      const id = `AI-E${String(i).padStart(3, '0')}`;
      assert.throws(() => aiPolicy.assertEgressAllowed(id), /AI_DISABLED/);
      assert.equal(lastEgressLog(id).detail.decision, 'denied-kill-switch');
    }
    assert.doesNotThrow(() => aiPolicy.assertEgressAllowed('SMTP'));
  } finally { delete process.env.AI_DISABLED; }
});

test('AI-POLICY-006: SMTP_DISABLED=1 chặn RIÊNG luồng SMTP, không ảnh hưởng AI-E00x', () => {
  process.env.SMTP_DISABLED = '1';
  try {
    assert.throws(() => aiPolicy.assertEgressAllowed('SMTP'), /SMTP_DISABLED/);
    assert.equal(lastEgressLog('SMTP').detail.decision, 'denied-kill-switch');
    assert.doesNotThrow(() => aiPolicy.assertEgressAllowed('AI-E002'));
  } finally { delete process.env.SMTP_DISABLED; }
});

test('AI-POLICY-007: app_meta ai_egress_deny_ids chặn đúng luồng bị liệt kê, ghi "denied-policy"; luồng khác vẫn allowed', () => {
  metaSet('ai_egress_deny_ids', JSON.stringify(['AI-E003']));
  try {
    assert.throws(() => aiPolicy.assertEgressAllowed('AI-E003'), /chính sách/);
    assert.equal(lastEgressLog('AI-E003').detail.decision, 'denied-policy');
    assert.doesNotThrow(() => aiPolicy.assertEgressAllowed('AI-E004'));
  } finally { metaSet('ai_egress_deny_ids', '[]'); }
});

test('AI-POLICY-008: app_meta ai_egress_deny_ids JSON hỏng -> fail-open (coi như rỗng, không chặn gì)', () => {
  metaSet('ai_egress_deny_ids', 'khong-phai-json');
  try {
    assert.doesNotThrow(() => aiPolicy.assertEgressAllowed('AI-E005'));
  } finally { metaSet('ai_egress_deny_ids', '[]'); }
});

test('AI-POLICY-009: pruneEgressLog() chỉ xoá dòng action=AI_EGRESS cũ hơn N ngày, KHÔNG đụng LOGIN/LOGOUT', () => {
  db.prepare("INSERT INTO audit_log (username, action, entity, detail, ts) VALUES ('u','LOGIN','session','{}', datetime('now','-200 day'))").run();
  db.prepare("INSERT INTO audit_log (username, action, entity, detail, ts) VALUES ('u','AI_EGRESS','AI-E001','{}', datetime('now','-200 day'))").run();
  const deleted = aiPolicy.pruneEgressLog(90);
  assert.ok(deleted >= 1);
  const remainingLogin = db.prepare("SELECT COUNT(*) c FROM audit_log WHERE action='LOGIN'").get().c;
  assert.ok(remainingLogin >= 1);
  const oldEgress = db.prepare("SELECT COUNT(*) c FROM audit_log WHERE action='AI_EGRESS' AND ts < datetime('now','-90 day')").get().c;
  assert.equal(oldEgress, 0);
});
