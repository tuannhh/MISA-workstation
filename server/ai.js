'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, withTransaction } = require('./db');
const gemini = require('./gemini');
const cfg = require('./config');
const { requireAuth, requirePerm } = require('./auth');
const { uploadAudio, uploadAiDocument } = require('./uploads');
const { isSpreadsheet, parseSpreadsheet, redactTextForAi } = require('./spreadsheet-parser');
const outbound = require('./safe-fetch');
const aiPolicy = require('./ai-policy');
const { buildInsert, buildUpdate, logEdit } = require('./db-helpers');
const { createPolicyService, PolicyForbiddenError } = require('./policy-service');
const { createVisibilityStore } = require('./policy-visibility-store');
const { sendError } = require('./error-contract');

const router = express.Router();
router.use(requireAuth);
// W3.VOICE.SECURE-COMMAND: instance rieng, khong dung chung voi routes.js (khong co state noi bo,
// visibilityStore doc thang tu DB moi lan goi -- xem policy-visibility-store.js).
const policyService = createPolicyService({ visibilityStore: createVisibilityStore(db) });

// Hôm nay theo GMT+7 (YYYY-MM-DD)
function todayGMT7() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// Khớp tên người/cơ quan với DB (không phân biệt hoa thường, LIKE)
function matchPerson(name) {
  if (!name) return null;
  return db.prepare(`SELECT p.id, p.full_name, o.name AS org_name, o.org_type
    FROM people p LEFT JOIN organizations o ON o.id=p.org_id
    WHERE p.full_name LIKE ? ORDER BY p.relationship_score DESC LIMIT 1`).get(`%${name}%`);
}
function matchOrg(name) {
  if (!name) return null;
  return db.prepare(`SELECT id, name, org_type FROM organizations WHERE name LIKE ? LIMIT 1`).get(`%${name}%`);
}

const VOICE_SCHEMA = {
  type: 'object',
  properties: {
    transcript: { type: 'string', description: 'Lời nói đã gỡ băng đầy đủ' },
    summary: { type: 'string', description: 'Tóm tắt nội dung tương tác, ngắn gọn' },
    channel: { type: 'string', description: 'Một trong: Gặp mặt, Điện thoại, Email, Sự kiện, Khác' },
    result: { type: 'string', description: 'Một trong: Tích cực, Trung lập, Cần theo dõi' },
    person_name: { type: 'string', description: 'Tên người được nhắc đến (nếu có)' },
    org_name: { type: 'string', description: 'Tên cơ quan/đơn vị được nhắc đến (nếu có)' },
    date: { type: 'string', description: 'Ngày diễn ra dạng YYYY-MM-DD nếu nói rõ, nếu không để trống' },
  },
  required: ['transcript', 'summary'],
};

// Giọng nói -> trích xuất tương tác + khớp đối tác
router.post('/interaction-voice', requirePerm('interactions', 'create'), uploadAudio.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Không có dữ liệu ghi âm.' });
    aiPolicy.assertEgressAllowed('AI-E001', req.principal);
    const prompt = `Đây là đoạn ghi âm tiếng Việt của một nhân viên PR (quan hệ truyền thông) đang ghi nhận một hoạt động/tương tác với đối tác.
Hãy NGHE, gỡ băng (transcript) và TRÍCH XUẤT thông tin tương tác.
- channel chỉ chọn 1 trong: "Gặp mặt", "Điện thoại", "Email", "Sự kiện", "Khác".
- result chỉ chọn 1 trong: "Tích cực", "Trung lập", "Cần theo dõi" (mặc định "Tích cực" nếu không rõ).
- person_name: tên người được nhắc tới (ví dụ "chị Minh Anh" -> "Minh Anh").
- org_name: tên cơ quan/báo/đơn vị (ví dụ "báo VnExpress" -> "VnExpress").
- date: chỉ điền nếu trong lời nói nói rõ ngày, định dạng YYYY-MM-DD; nếu nói "hôm nay" hoặc không nói thì để trống.
- summary: mô tả ngắn gọn, lịch sự nội dung đã làm.`;
    const parts = [
      { text: prompt },
      { inlineData: { mimeType: req.file.mimetype || 'audio/webm', data: req.file.buffer.toString('base64') } },
    ];
    const ai = await gemini.genJSON(parts, VOICE_SCHEMA);
    const person = matchPerson(ai.person_name);
    const org = matchOrg(ai.org_name);
    res.json({
      extracted: {
        transcript: ai.transcript || '',
        summary: ai.summary || '',
        channel: ai.channel || 'Gặp mặt',
        result: ai.result || 'Tích cực',
        date: ai.date || todayGMT7(),
        person_name: ai.person_name || '',
        org_name: ai.org_name || '',
      },
      matchedPerson: person || null,
      matchedOrg: org || null,
    });
  } catch (e) {
    res.status(502).json({ error: 'Lỗi xử lý giọng nói: ' + e.message });
  }
});

// ========================================================================
//  W3.VOICE.SECURE-COMMAND + W3.VOICE.1 (D14.4, batch 23): AI chuan bi hanh
//  dong (propose) -- nguoi dung xac nhan 1 lan (confirm). KHONG doi route
//  /interaction-voice o tren (giu nguyen cho luong thu cong hien co).
// ========================================================================
const VOICE_PROPOSAL_TTL_MS = Number(process.env.VOICE_PROPOSAL_TTL_MS) || 10 * 60 * 1000;
const SCORE_DELTA_MIN = -10;
const SCORE_DELTA_MAX = 10;

// AI tu de xuat muc doi diem trong loi noi (khong phai quy tac cung cua Claude -- BA chua dinh
// nghia chinh thuc theo D14.3). Server chi kep bien an toan tren so AI tu goi y, mac dinh 0.
function clampScoreDelta(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(SCORE_DELTA_MIN, Math.min(SCORE_DELTA_MAX, Math.round(n)));
}
function expiresAtString(ttlMs) {
  return new Date(Date.now() + ttlMs).toISOString().slice(0, 19).replace('T', ' ');
}
function isExpired(proposal, nowMs = Date.now()) {
  return new Date(proposal.expires_at.replace(' ', 'T') + 'Z').getTime() <= nowMs;
}
// D14.4 guardrail: KHONG tu chon candidate gan nhat khi >=2 khop -- tra ve toan bo de client/nguoi
// dung tu chon. confidence: none (0 khop) | high (dung 1) | ambiguous (>=2).
function matchCandidates(name, kind) {
  if (!name) return { confidence: 'none', candidates: [] };
  const like = `%${name}%`;
  const rows = kind === 'person'
    ? db.prepare(`SELECT p.id, p.full_name AS name, o.name AS org_name, p.relationship_score
        FROM people p LEFT JOIN organizations o ON o.id=p.org_id
        WHERE p.full_name LIKE ? ORDER BY p.relationship_score DESC LIMIT 5`).all(like)
    : db.prepare(`SELECT id, name, org_type FROM organizations WHERE name LIKE ? ORDER BY name LIMIT 5`).all(like);
  if (rows.length === 0) return { confidence: 'none', candidates: [] };
  if (rows.length === 1) return { confidence: 'high', candidates: rows };
  return { confidence: 'ambiguous', candidates: rows };
}

const VOICE_PROPOSAL_SCHEMA = {
  type: 'object',
  properties: {
    ...VOICE_SCHEMA.properties,
    suggested_score_delta: { type: 'integer', description: `Mức đề xuất TĂNG/GIẢM điểm quan hệ (relationship_score) dựa trên sắc thái cuộc nói chuyện, số nguyên trong khoảng ${SCORE_DELTA_MIN}..${SCORE_DELTA_MAX}. 0 nếu không có căn cứ rõ ràng để đề xuất.` },
  },
  required: VOICE_SCHEMA.required,
};

// Buoc 1: AI nghe + trich xuat + khop candidate, tao 1 proposal opaque gan voi principal hien tai,
// het han sau VOICE_PROPOSAL_TTL_MS. KHONG ghi interactions/people o buoc nay.
router.post('/interaction-voice-propose', requirePerm('interactions', 'create'), uploadAudio.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Không có dữ liệu ghi âm.' });
    aiPolicy.assertEgressAllowed('AI-E001', req.principal);
    const prompt = `Đây là đoạn ghi âm tiếng Việt của một nhân viên PR (quan hệ truyền thông) đang ghi nhận một hoạt động/tương tác với đối tác.
Hãy NGHE, gỡ băng (transcript) và TRÍCH XUẤT thông tin tương tác.
- channel chỉ chọn 1 trong: "Gặp mặt", "Điện thoại", "Email", "Sự kiện", "Khác".
- result chỉ chọn 1 trong: "Tích cực", "Trung lập", "Cần theo dõi" (mặc định "Tích cực" nếu không rõ).
- person_name: tên người được nhắc tới (ví dụ "chị Minh Anh" -> "Minh Anh").
- org_name: tên cơ quan/báo/đơn vị (ví dụ "báo VnExpress" -> "VnExpress").
- date: chỉ điền nếu trong lời nói nói rõ ngày, định dạng YYYY-MM-DD; nếu nói "hôm nay" hoặc không nói thì để trống.
- summary: mô tả ngắn gọn, lịch sự nội dung đã làm.
- suggested_score_delta: nếu lời nói thể hiện rõ mối quan hệ tốt lên/xấu đi, đề xuất mức tăng/giảm điểm quan hệ hợp lý (vd tương tác rất tích cực, hợp tác tốt -> số dương nhỏ; căng thẳng/từ chối hợp tác -> số âm nhỏ); nếu không rõ ràng, để 0.`;
    const parts = [
      { text: prompt },
      { inlineData: { mimeType: req.file.mimetype || 'audio/webm', data: req.file.buffer.toString('base64') } },
    ];
    const ai = await gemini.genJSON(parts, VOICE_PROPOSAL_SCHEMA);
    const personMatch = matchCandidates(ai.person_name, 'person');
    const orgMatch = matchCandidates(ai.org_name, 'org');
    const extracted = {
      transcript: ai.transcript || '',
      summary: ai.summary || '',
      channel: ai.channel || 'Gặp mặt',
      result: ai.result || 'Tích cực',
      date: ai.date || todayGMT7(),
      person_name: ai.person_name || '',
      org_name: ai.org_name || '',
    };
    const suggestedScoreDelta = clampScoreDelta(ai.suggested_score_delta);
    const id = crypto.randomBytes(16).toString('hex');
    const expiresAt = expiresAtString(VOICE_PROPOSAL_TTL_MS);
    const payload = {
      ...extracted,
      personCandidates: personMatch.candidates,
      orgCandidates: orgMatch.candidates,
      suggested_score_delta: suggestedScoreDelta,
    };
    buildInsert('voice_proposals', { id, user_id: req.principal.id, payload_json: JSON.stringify(payload), expires_at: expiresAt });
    res.json({
      proposalId: id,
      expiresAt,
      extracted,
      personCandidates: personMatch.candidates,
      orgCandidates: orgMatch.candidates,
      matchConfidence: { person: personMatch.confidence, org: orgMatch.confidence },
      suggestedScoreDelta,
    });
  } catch (e) {
    res.status(502).json({ error: 'Lỗi xử lý giọng nói: ' + e.message });
  }
});

// Buoc 2: nguoi dung xac nhan -- CHI gui proposalId + idempotencyKey + edits tuong minh (khong gui
// lai toan bo payload). Server doc lai proposal, re-check PolicyEngine + optimistic concurrency,
// roi moi ghi 1 lan (D14.4).
// Remediation F25/F26/P2 (Codex audit 2026-08-31, xem 25-audit-remediation-f25-f26.md):
// - idempotencyKey nay BAT BUOC (P2) -- khong co no thi retry sau network timeout khong the phan
//   biet duoc voi 1 lan confirm moi.
// - Loi giua chung claim va ghi (vd INSERT interactions that bai) truoc day de proposal ket thuc o
//   trang thai 'confirmed' MO COI (khong co interaction, khong the retry that) -- F25. Nay bao boc
//   claim + insert interaction + audit + cap nhat result_interaction_id + CAS diem trong 1
//   withTransaction(): loi o buoc nao cung ROLLBACK ve nguyen trang 'pending', proposal dung nghia
//   con dung lai duoc.
// - CAS diem quan he stale (F26): truoc day chi bo qua phan diem, van tao interaction -- trai
//   D14.4 ("tu choi va yeu cau chuan bi lai" khi snapshot khac hien tai). Nay ROLLBACK toan bo,
//   tra 409 PROPOSAL_STALE. Phan biet ro voi truong hop KHONG co quyen sua diem (PolicyForbidden)
//   -- truong hop do van giu hanh vi cu (tao interaction, bo qua phan diem), vi khong phai loi du
//   lieu dua-tren-thoi-diem, ma la thieu quyen tu dau.
class ConfirmConflictError extends Error {}

// Remediation F27 (Codex audit 2026-08-31, xem 25-audit-remediation-f25-f26.md muc F27): snapshot
// candidate luc propose chi co id/name/org_name/relationship_score, KHONG duoc doc lai luc confirm
// -- person/org bi xoa hoac doi giua propose/confirm khong bi phat hien, interaction van duoc tao
// tro toi 1 ban ghi da mat/da doi. Doc lai dung field da snapshot va so sanh truoc khi ghi bat ky
// gi -- coi day la "revision" thuc te (toan bo field nguoi dung da thay khi xac nhan), khong can
// them cot revision rieng + instrument moi duong ghi people/organizations trong toan bo code base.
function fetchPersonSnapshot(id) {
  return db.prepare(`SELECT p.id, p.full_name AS name, o.name AS org_name, p.relationship_score
    FROM people p LEFT JOIN organizations o ON o.id=p.org_id WHERE p.id=?`).get(id);
}
function fetchOrgSnapshot(id) {
  return db.prepare('SELECT id, name, org_type FROM organizations WHERE id=?').get(id);
}
function snapshotDrifted(fresh, snap, fields) {
  if (!fresh) return true;
  return fields.some((f) => String(fresh[f] ?? '') !== String(snap[f] ?? ''));
}

router.post('/interaction-voice-confirm', requirePerm('interactions', 'create'), (req, res) => {
  try {
    const { proposalId, idempotencyKey, edits } = req.body || {};
    if (!proposalId) return sendError(req, res, 400, 'VALIDATION_FAILED', 'Thiếu proposalId.');
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 200) {
      return sendError(req, res, 400, 'VALIDATION_FAILED', 'Thiếu hoặc sai định dạng idempotencyKey.');
    }
    const proposal = db.prepare('SELECT * FROM voice_proposals WHERE id=?').get(proposalId);
    if (!proposal) return sendError(req, res, 404, 'NOT_FOUND', 'Không tìm thấy đề xuất, có thể đã hết hạn từ lâu.');
    // D14.4: proposal gan voi dung 1 principal -- user khac khong xac nhan duoc, ke ca cung role.
    if (Number(proposal.user_id) !== Number(req.principal.id)) {
      return sendError(req, res, 403, 'FORBIDDEN_MODULE', 'Đề xuất này không thuộc về bạn.');
    }
    if (proposal.status === 'confirmed') {
      if (proposal.idempotency_key && idempotencyKey && proposal.idempotency_key === idempotencyKey) {
        return res.json({ ok: true, interactionId: proposal.result_interaction_id, idempotent: true });
      }
      return sendError(req, res, 409, 'PROPOSAL_ALREADY_CONFIRMED', 'Đề xuất đã được xác nhận trước đó.');
    }
    // F27: proposal da bi danh dau stale o lan confirm truoc (parent bi xoa/doi hoac diem stale) --
    // trang thai terminal, KHONG duoc "song lai" du dieu kien pending gia tao lai (vd score vo tinh
    // quay ve dung snapshot cu) -- phai tao proposal moi.
    if (proposal.status === 'stale') {
      return sendError(req, res, 409, 'PROPOSAL_STALE', 'Dữ liệu người liên hệ/cơ quan đã thay đổi kể từ lúc chuẩn bị, vui lòng tạo lại đề xuất.');
    }
    if (isExpired(proposal)) return sendError(req, res, 410, 'PROPOSAL_EXPIRED', 'Đề xuất đã hết hạn, vui lòng ghi âm lại.');

    const payload = JSON.parse(proposal.payload_json);
    const e = edits || {};

    // Tampering guard: chi duoc chon trong dung candidate da de xuat, khong nhan id tuy y tu client.
    let selectedPerson = null;
    if (e.selected_person_id != null) {
      selectedPerson = (payload.personCandidates || []).find((c) => Number(c.id) === Number(e.selected_person_id)) || null;
      if (!selectedPerson) return sendError(req, res, 400, 'VALIDATION_FAILED', 'selected_person_id không nằm trong danh sách đề xuất.');
    } else if ((payload.personCandidates || []).length === 1) {
      selectedPerson = payload.personCandidates[0];
    }
    let selectedOrg = null;
    if (e.selected_org_id != null) {
      selectedOrg = (payload.orgCandidates || []).find((c) => Number(c.id) === Number(e.selected_org_id)) || null;
      if (!selectedOrg) return sendError(req, res, 400, 'VALIDATION_FAILED', 'selected_org_id không nằm trong danh sách đề xuất.');
    } else if ((payload.orgCandidates || []).length === 1) {
      selectedOrg = payload.orgCandidates[0];
    }

    const partnerType = selectedPerson ? 'person' : (selectedOrg ? 'org' : 'person');
    const partnerId = selectedPerson ? selectedPerson.id : (selectedOrg ? selectedOrg.id : 0);
    const partnerName = selectedPerson ? selectedPerson.name : (selectedOrg ? selectedOrg.name : (payload.person_name || payload.org_name || ''));
    const interactionInput = {
      partner_type: partnerType,
      partner_id: partnerId,
      partner_name: partnerName,
      date: e.date || payload.date,
      channel: e.channel || payload.channel,
      summary: e.summary != null ? e.summary : payload.summary,
      result: e.result || payload.result,
    };
    let preparedInteraction;
    try {
      preparedInteraction = policyService.prepareCreate({ principal: req.principal, entity: 'interaction', input: interactionInput });
    } catch (err) {
      if (err instanceof PolicyForbiddenError) return sendError(req, res, 403, 'FORBIDDEN_MODULE', 'Bạn không có quyền create trên interactions.');
      throw err;
    }

    const scoreDelta = clampScoreDelta(e.score_delta != null ? e.score_delta : payload.suggested_score_delta);
    let personEditAllowed = false;
    if (scoreDelta !== 0 && selectedPerson) {
      try {
        policyService.assertWritable({ principal: req.principal, entity: 'person', action: 'edit' });
        personEditAllowed = true;
      } catch (err) {
        if (!(err instanceof PolicyForbiddenError)) throw err;
        // Khong tu choi ca request vi 1 phan (doi diem) khong du quyen -- van cho tao interaction,
        // chi bo qua phan doi diem (an toan hon: khong mat du lieu tuong tac vi 1 quyen phu).
      }
    }

    // Claim + (F27) re-check parent con ton tai/khong doi + ghi interaction + audit + CAS diem
    // trong 1 transaction: loi that o bat ky buoc nao (vd INSERT interactions that bai) deu
    // ROLLBACK ve dung 'pending' -- proposal khong bao gio ket thuc o trang thai 'confirmed' mo coi
    // (F25). Dieu kien TTL dua vao chinh cau UPDATE claim (khong chi dua vao isExpired() da kiem
    // tra JS truoc do) de het han dung luc claim cung duoc coi la mot loai xung dot claim.
    let result;
    try {
      result = withTransaction(() => {
        const claimed = db.prepare(
          `UPDATE voice_proposals SET status='confirmed', confirmed_at=datetime('now'), idempotency_key=? WHERE id=? AND status='pending' AND expires_at > datetime('now')`
        ).run(idempotencyKey, proposalId).changes;
        if (claimed !== 1) {
          const fresh = db.prepare('SELECT * FROM voice_proposals WHERE id=?').get(proposalId);
          const err = new ConfirmConflictError();
          err.proposal = fresh;
          throw err;
        }

        // F27: doc lai dung field da snapshot luc propose CHO TOAN BO parent da chon (ke ca khi
        // khong doi diem) TRUOC khi ghi bat ky gi -- bat ca truong hop bi xoa lan doi ten/doi diem.
        // Khac voi loi that (nhanh catch ben duoi): stale KHONG duoc rollback claim ve 'pending' (co
        // the "song lai" neu du lieu vo tinh quay ve dung snapshot cu) -- chuyen sang trang thai
        // terminal 'stale' va COMMIT, khong bao gio insert interaction.
        let stale = false;
        if (selectedPerson) {
          const freshPerson = fetchPersonSnapshot(selectedPerson.id);
          if (snapshotDrifted(freshPerson, selectedPerson, ['name', 'org_name', 'relationship_score'])) stale = true;
        }
        if (!stale && selectedOrg) {
          const freshOrg = fetchOrgSnapshot(selectedOrg.id);
          if (snapshotDrifted(freshOrg, selectedOrg, ['name', 'org_type'])) stale = true;
        }
        if (stale) {
          db.prepare(`UPDATE voice_proposals SET status='stale' WHERE id=?`).run(proposalId);
          return { stale: true };
        }

        const r = buildInsert('interactions', preparedInteraction);
        logEdit(req, 'CREATE', 'interaction', r.lastInsertRowid, interactionInput.summary);
        buildUpdate('voice_proposals', proposalId, { result_interaction_id: r.lastInsertRowid });

        let personResult = null;
        if (personEditAllowed) {
          const newScore = Math.max(0, Math.min(100, Number(selectedPerson.relationship_score || 0) + scoreDelta));
          // Da xac nhan snapshot con dung nguyen (khong stale) o buoc tren TRONG CUNG transaction
          // nay -- khong co ghi nao khac chen duoc vao giua (xem giai thich withTransaction trong
          // db.js). CAS van giu lam luoi an toan thu 2 (defense-in-depth): neu no THAT BAI o day du
          // vua xac nhan fresh, do la bat thuong that (vi pham gia dinh 1-connection dong bo), nem
          // loi that de ROLLBACK toan bo + 502 thay vi coi la "stale" binh thuong.
          const cas = db.prepare('UPDATE people SET relationship_score=? WHERE id=? AND relationship_score=?')
            .run(newScore, selectedPerson.id, selectedPerson.relationship_score);
          if (cas.changes !== 1) throw new Error('CAS relationship_score that bai ngay sau khi xac nhan fresh -- vi pham gia dinh dong bo cua withTransaction()');
          logEdit(req, 'EDIT', 'person', selectedPerson.id, `AI voice: relationship_score ${selectedPerson.relationship_score} -> ${newScore} (proposal ${proposalId})`);
          personResult = { id: selectedPerson.id, relationship_score: newScore, scoreApplied: true };
        }

        return { interactionId: r.lastInsertRowid, person: personResult };
      });
    } catch (err) {
      if (err instanceof ConfirmConflictError) {
        const fresh = err.proposal;
        if (fresh && fresh.status === 'confirmed' && fresh.idempotency_key === idempotencyKey) {
          return res.json({ ok: true, interactionId: fresh.result_interaction_id, idempotent: true });
        }
        if (fresh && fresh.status === 'stale') {
          return sendError(req, res, 409, 'PROPOSAL_STALE', 'Dữ liệu người liên hệ/cơ quan đã thay đổi kể từ lúc chuẩn bị, vui lòng tạo lại đề xuất.');
        }
        if (fresh && isExpired(fresh)) return sendError(req, res, 410, 'PROPOSAL_EXPIRED', 'Đề xuất đã hết hạn, vui lòng ghi âm lại.');
        return sendError(req, res, 409, 'PROPOSAL_ALREADY_CONFIRMED', 'Đề xuất đã được xác nhận hoặc hết hạn.');
      }
      throw err;
    }

    if (result.stale) {
      return sendError(req, res, 409, 'PROPOSAL_STALE', 'Dữ liệu người liên hệ/cơ quan đã thay đổi kể từ lúc chuẩn bị, vui lòng tạo lại đề xuất.');
    }
    res.json({ ok: true, interactionId: result.interactionId, person: result.person });
  } catch (e) {
    res.status(502).json({ error: 'Lỗi xác nhận: ' + e.message });
  }
});

// ---------- Thiệp chúc mừng ----------
const DATE_TYPE_VI = { birthday: 'sinh nhật', founding: 'ngày thành lập', anniversary: 'ngày kỷ niệm ngành', other: 'dịp đặc biệt' };

router.post('/card-text', requirePerm('reminders', 'view'), async (req, res) => {
  try {
    aiPolicy.assertEgressAllowed('AI-E002', req.principal);
    const { title, date_type, subject_name, idea } = req.body || {};
    const dip = DATE_TYPE_VI[date_type] || 'dịp đặc biệt';
    const prompt = `Bạn viết lời chúc mừng đại diện cho MISA (công ty công nghệ, phần mềm hàng đầu Việt Nam) gửi tới đối tác truyền thông nhân ${dip}${subject_name ? ` của ${subject_name}` : ''}${title ? ` ("${title}")` : ''}.
Yêu cầu: văn phong trang trọng, chân thành, lịch sự; ngôi xưng đại diện MISA; độ dài khoảng 180-200 từ; tiếng Việt; không dùng emoji; không để chỗ trống dạng [tên].
${idea && idea.trim() ? `Bám theo ý tưởng người dùng đưa ra: "${idea.trim()}".` : 'Người dùng không nêu ý tưởng cụ thể, hãy viết nội dung phù hợp, ý nghĩa cho dịp này.'}
Chỉ trả về phần nội dung lời chúc, không thêm tiêu đề hay ghi chú.`;
    const text = await gemini.genText(prompt, { temperature: 0.8 });
    res.json({ text });
  } catch (e) {
    res.status(502).json({ error: 'Lỗi tạo nội dung: ' + e.message });
  }
});

function logoRef() {
  try {
    const p = path.join(__dirname, '..', 'public', 'assets', 'misa-logo.png');
    if (fs.existsSync(p)) return { mime: 'image/png', data: fs.readFileSync(p).toString('base64') };
  } catch {}
  return null;
}

router.post('/card-image', requirePerm('reminders', 'view'), async (req, res) => {
  try {
    const { text, context } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'Chưa có nội dung lời chúc.' });
    aiPolicy.assertEgressAllowed('AI-E003', req.principal);
    const ref = logoRef();
    const prompt = `Tạo một tấm thiệp chúc mừng chuyên nghiệp, tỷ lệ khung hình 3:2 (ngang).
NGỮ CẢNH: ${context || 'Thiệp chúc mừng của công ty công nghệ MISA gửi đối tác.'}
BỐ CỤC:
- Phần CHỮ (lời chúc) đặt bên trái, chiếm khoảng 1/2 đến 2/3 chiều ngang, chữ tiếng Việt rõ ràng, dễ đọc, trang trọng.
- Phần còn lại bên phải là HOẠ TIẾT công nghệ: đường nét vi mạch (circuit lines) thanh mảnh, hình con CHIP bán dẫn cách điệu (TUYỆT ĐỐI KHÔNG dùng hình bộ não), tinh tế, nhã nhặn.
- Tone màu TƯƠI SÁNG, nền SÁNG (light background). Có logo MISA ở trên cùng.
NỘI DUNG LỜI CHÚC cần thể hiện trên thiệp:
"${text.trim().slice(0, 600)}"
Phong cách: sang trọng, hiện đại, phù hợp doanh nghiệp công nghệ.`;
    const img = await gemini.genImage(prompt, ref ? [ref] : []);
    res.json({ mime: img.mime, dataUrl: `data:${img.mime};base64,${img.data}`, usedLogo: !!ref });
  } catch (e) {
    res.status(502).json({ error: 'Lỗi tạo ảnh: ' + e.message });
  }
});

// ---------- Giải thưởng: AI bóc tách từ văn bản / URL / file ----------
const AWARD_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Tên giải thưởng' },
    organizer: { type: 'string', description: 'Đơn vị tổ chức' },
    organizer_type: { type: 'string', description: 'Loại đơn vị: gov (bộ/ban/ngành) / association (hiệp hội/hội) / other' },
    scale: { type: 'string', description: 'Quy mô (vd Toàn quốc, Khu vực, Quốc tế)' },
    event_time: { type: 'string', description: 'Thời gian diễn ra (vd 2026-04 hoặc Quý II/2026)' },
    submission_deadline: { type: 'string', description: 'Hạn nộp hồ sơ dạng YYYY-MM-DD nếu xác định được' },
    eligibility: { type: 'string', description: 'Điều kiện tham gia' },
    cost: { type: 'integer', description: 'Chi phí tham gia (VNĐ, số nguyên; 0 nếu miễn phí; bỏ trống nếu không rõ)' },
    criteria: { type: 'string', description: 'Bộ tiêu chí đánh giá' },
    required_docs: { type: 'string', description: 'Hồ sơ bao gồm' },
    prize_structure: { type: 'string', description: 'Cơ cấu giải thưởng' },
    evaluation_method: { type: 'string', description: 'Phương thức đánh giá' },
    scope: { type: 'string', description: 'Trong nước hoặc Quốc tế' },
    status: { type: 'string', description: 'Sắp mở / Đang nhận hồ sơ / Đã đóng' },
    ai_summary: { type: 'string', description: 'Tóm tắt ngắn gọn về giải thưởng (2-3 câu)' },
  },
  required: ['name', 'ai_summary'],
};

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20000);
}

router.post('/award-extract', requirePerm('awards', 'create'), uploadAudio.single('file'), async (req, res) => {
  try {
    aiPolicy.assertEgressAllowed('AI-E004', req.principal);
    const instruction = `Đây là thông báo/thể lệ một GIẢI THƯỞNG (hoặc bằng khen, danh hiệu). Hãy đọc và trích xuất thông tin theo schema.
- organizer_type: "gov" nếu là Bộ/Ban/Ngành/cơ quan nhà nước; "association" nếu Hiệp hội/Hội; còn lại "other".
- submission_deadline: định dạng YYYY-MM-DD nếu suy ra được, nếu không thì để trống.
- Chỉ điền thông tin có trong nội dung; trường không rõ thì để trống. ai_summary: tóm tắt 2-3 câu.`;
    const parts = [{ text: instruction }];
    let sourceUrl = null;
    if (req.file) {
      parts.push({ inlineData: { mimeType: req.file.mimetype || 'application/pdf', data: req.file.buffer.toString('base64') } });
    } else if (req.body.text && req.body.text.trim()) {
      parts.push({ text: 'NỘI DUNG ĐÃ ẨN THÔNG TIN LIÊN HỆ:\n' + redactTextForAi(req.body.text.trim()).slice(0, 20000) });
    } else if (req.body.url && /^https?:\/\//.test(req.body.url)) {
      sourceUrl = req.body.url.trim();
      const r = await outbound.safeFetch(sourceUrl, { timeoutMs: 12000, headers: { 'User-Agent': 'Mozilla/5.0 MISA-PR' } });
      const html = await r.text();
      parts.push({ text: 'NỘI DUNG TỪ TRANG WEB (ĐÃ ẨN THÔNG TIN LIÊN HỆ):\n' + redactTextForAi(stripHtml(html)) });
    } else {
      return res.status(400).json({ error: 'Cần dán văn bản, nhập URL, hoặc tải lên file.' });
    }
    const extracted = await gemini.genJSON(parts, AWARD_SCHEMA);
    if (sourceUrl) extracted.source_url = sourceUrl;
    extracted.review_status = 'Thô';
    res.json({ extracted });
  } catch (e) {
    if (e instanceof outbound.SafeFetchError) return res.status(400).json({ error: e.message });
    res.status(502).json({ error: 'Lỗi bóc tách: ' + e.message });
  }
});

const ADVICE_SCHEMA = {
  type: 'object',
  properties: {
    capability: { type: 'string', description: 'Đánh giá năng lực đạt giải của MISA (2-4 câu, có nêu điểm mạnh/rủi ro)' },
    plan: { type: 'string', description: 'Nháp kế hoạch triển khai tham gia (các bước chính, mốc thời gian)' },
  },
  required: ['capability', 'plan'],
};
router.post('/award-advice', requirePerm('awards', 'view'), async (req, res) => {
  try {
    aiPolicy.assertEgressAllowed('AI-E005', req.principal);
    const a = req.body || {};
    const prompt = `MISA (công ty phần mềm/công nghệ hàng đầu Việt Nam, sản phẩm tiêu biểu: MISA AMIS, MISA SME, hóa đơn điện tử...) đang cân nhắc tham gia giải thưởng sau:
- Tên: ${a.name || ''}
- Đơn vị tổ chức: ${a.organizer || ''}
- Tiêu chí: ${a.criteria || ''}
- Cơ cấu giải: ${a.prize_structure || ''}
${a.products ? `- Sản phẩm dự kiến tham gia: ${a.products}` : ''}
Hãy đưa ra: (1) đánh giá năng lực đạt giải của MISA, (2) nháp kế hoạch triển khai tham gia. Văn phong chuyên nghiệp, ngắn gọn, tiếng Việt.`;
    const out = await gemini.genJSON([{ text: prompt }], ADVICE_SCHEMA, { temperature: 0.6 });
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: 'Lỗi gợi ý: ' + e.message });
  }
});

// ---------- Sự kiện: AI tự điền từ file kế hoạch (Excel/PDF) hoặc văn bản ----------
const EVENT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Tên sự kiện/chương trình' },
    organizer: { type: 'string', description: 'Đơn vị tổ chức' },
    mode: { type: 'string', description: '"host" nếu MISA là đơn vị tổ chức; "join" nếu MISA chỉ tham gia' },
    field: { type: 'string', description: 'Lĩnh vực: Công nghệ / Tài chính - Thuế / Quản trị / An ninh mạng / Khác' },
    format: { type: 'string', description: 'Online / Offline / Hybrid' },
    start_time: { type: 'string', description: 'Ngày bắt đầu YYYY-MM-DD nếu xác định được' },
    location: { type: 'string', description: 'Địa điểm' },
    scale_attendees: { type: 'integer', description: 'Quy mô số người tham dự (số)' },
    guest_levels: { type: 'string', description: 'Thành phần/cấp độ khách mời (C-Level, M-Level, DN nhỏ/vừa/lớn, Khối chính phủ...)' },
    evaluation: { type: 'string', description: 'Mục tiêu/đánh giá/thông điệp chính (tóm tắt)' },
    note: { type: 'string', description: 'Ghi chú khác (ngân sách dự kiến, đơn vị đồng hành...)' },
  },
  required: ['name'],
};

const eventExtractUsage = new Map();
function limitEventExtract(req, res, next) {
  const key = String(req.session.user.id);
  const now = Date.now();
  const recent = (eventExtractUsage.get(key) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 8) return res.status(429).json({ error: 'Bạn đã tự điền nhiều file liên tiếp. Vui lòng chờ khoảng 1 phút rồi thử lại.' });
  recent.push(now);
  eventExtractUsage.set(key, recent);
  next();
}

router.post('/event-extract', requirePerm('events', 'create'), limitEventExtract, uploadAiDocument.single('file'), async (req, res) => {
  try {
    aiPolicy.assertEgressAllowed('AI-E006', req.principal);
    const instruction = `Đây là tài liệu KẾ HOẠCH một SỰ KIỆN của MISA. Đọc và trích xuất thông tin tổng quan theo schema.
- mode: "host" nếu MISA là đơn vị tổ chức chính; "join" nếu MISA chỉ tham gia/tài trợ.
- start_time: YYYY-MM-DD nếu suy ra được. Chỉ điền thông tin có trong tài liệu; trường không rõ để trống.`;
    const parts = [{ text: instruction }];
    let fileWarnings = [];
    let fileMetadata = null;
    if (req.file) {
      if (!isSpreadsheet(req.file)) return res.status(422).json({ error: 'Chỉ chấp nhận file Excel hoặc CSV.' });
      let parsed;
      try { parsed = await parseSpreadsheet(req.file); }
      catch (error) { return res.status(422).json({ error: error.message }); }
      fileWarnings = parsed.warnings || [];
      fileMetadata = parsed.metadata || null;
      parts.push({ text: 'NỘI DUNG FILE EXCEL ĐÃ ĐƯỢC ĐỌC AN TOÀN:\n' + parsed.text });
    } else if (req.body.text && req.body.text.trim()) {
      parts.push({ text: 'NỘI DUNG ĐÃ ẨN THÔNG TIN LIÊN HỆ:\n' + redactTextForAi(req.body.text.trim()).slice(0, 40000) });
    } else {
      return res.status(400).json({ error: 'Cần tải lên file Excel/CSV hoặc dán văn bản.' });
    }
    const extracted = await gemini.genJSON(parts, EVENT_SCHEMA);
    // các trường cần khai báo nhưng AI chưa thấy -> đánh dấu thiếu (chấm cảnh báo)
    const wanted = ['name', 'organizer', 'mode', 'field', 'format', 'start_time', 'location', 'scale_attendees', 'guest_levels', 'evaluation'];
    const missing = wanted.filter((k) => !extracted[k] && extracted[k] !== 0);
    res.json({ extracted, missing, warnings: fileWarnings, file: fileMetadata });
  } catch (e) {
    res.status(502).json({ error: 'Lỗi tự điền: ' + e.message });
  }
});

router.get('/status', (req, res) => res.json({ enabled: cfg.hasKey(), textModel: cfg.GEMINI_TEXT_MODEL, imageModel: cfg.GEMINI_IMAGE_MODEL }));

// Thêm để unit test (G1A.2) — hàm thuần/DI-được + schema JSON (đối tượng bất biến, không có
// hành vi để "đổi"), không đổi hành vi router (giống routes.js.testables).
router.testables = {
  stripHtml, limitEventExtract, VOICE_SCHEMA, AWARD_SCHEMA, ADVICE_SCHEMA, EVENT_SCHEMA,
  VOICE_PROPOSAL_SCHEMA, clampScoreDelta, matchCandidates, isExpired, expiresAtString,
  SCORE_DELTA_MIN, SCORE_DELTA_MAX, VOICE_PROPOSAL_TTL_MS,
};

module.exports = router;
