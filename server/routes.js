'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db, audit, UPLOAD_DIR, metaGet, metaSet } = require('./db');
const rbac = require('./rbac');
const { requireAuth, requirePerm } = require('./auth');
const { upload } = require('./uploads');
const scheduler = require('./scheduler');
const monitor = require('./monitor');

const router = express.Router();
router.use(requireAuth);

// ---------- helpers ----------
function pageParams(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
function pick(obj, allowed) {
  const out = {};
  for (const k of allowed) if (k in obj) out[k] = obj[k] === '' ? null : obj[k];
  return out;
}
// JSON field: chấp nhận mảng/đối tượng từ client -> lưu chuỗi JSON
function jsonField(data, key) {
  if (key in data && data[key] != null && typeof data[key] !== 'string') {
    data[key] = JSON.stringify(data[key]);
  }
}
function buildInsert(table, data) {
  const keys = Object.keys(data);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  return db.prepare(sql).run(...keys.map((k) => data[k]));
}
function buildUpdate(table, id, data) {
  const keys = Object.keys(data);
  if (!keys.length) return;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`;
  return db.prepare(sql).run(...keys.map((k) => data[k]), id);
}
function logEdit(req, action, entity, id, detail) {
  const u = req.session.user;
  audit({ user_id: u.id, username: u.username, action, entity, entity_id: id, detail });
}
function senGroups(req) { return rbac.allowedGroups(req.session.user); }
function senVisible(set) { return set.size === rbac.ALL_GROUPS.length; }
// Có được xem số tiền/chi phí không (nhóm 'org_fee' = Chi phí & Ngân sách)
function canMoney(req) { return senGroups(req).has('org_fee'); }
function maskMoney(req, rows, ...fields) {
  if (canMoney(req)) return rows;
  const arr = Array.isArray(rows) ? rows : [rows];
  arr.forEach((r) => { if (r) fields.forEach((f) => { if (r[f] != null) r[f] = rbac.MASK; }); });
  return rows;
}
// Loại các trường mật mà user không được xem khỏi dữ liệu cập nhật (chống ghi đè/null hóa)
function stripDisallowed(entity, data, set) {
  for (const f of (rbac.SENSITIVE_FIELDS[entity] || [])) {
    const g = rbac.fieldGroup(entity, f);
    if (f in data && !(g && set.has(g))) delete data[f];
  }
  return data;
}
// ----- Phân công người chăm sóc (assignments) -----
function getCaretakers(type, id) {
  return db.prepare(`SELECT u.id, u.full_name, u.role FROM assignments a JOIN users u ON u.id=a.user_id
    WHERE a.subject_type=? AND a.subject_id=? ORDER BY u.full_name`).all(type, id);
}
function syncAssignments(type, id, ids) {
  if (!Array.isArray(ids)) return; // không gửi caretaker_ids => giữ nguyên
  db.prepare('DELETE FROM assignments WHERE subject_type=? AND subject_id=?').run(type, id);
  const ins = db.prepare('INSERT OR IGNORE INTO assignments (user_id, subject_type, subject_id) VALUES (?,?,?)');
  for (const uid of ids) { const n = Number(uid); if (n) ins.run(n, type, id); }
}

// =====================================================================
//  ORGANIZATIONS (Cơ quan đối tác: press / association / gov / other)
// =====================================================================
// Danh sách user để chọn người chăm sóc (mọi tài khoản đang hoạt động)
router.get('/assignable-users', requirePerm('partners', 'view'), (req, res) => {
  res.json({ rows: db.prepare('SELECT id, full_name, role FROM users WHERE active=1 ORDER BY full_name').all() });
});

const ORG_TYPES = ['press', 'association', 'gov', 'other'];
const ORG_COLS = ['name', 'org_type', 'tier', 'founded_date', 'parent_org', 'website', 'address',
  'press_types', 'misa_role', 'join_date', 'membership_fee', 'note',
  // Đối tác bộ ngành (gov)
  'admin_level', 'agency_block', 'contact_clerk', 'org_departments', 'org_leaders', 'focal_partner_dev', 'focal_pr',
  // Hiệp hội (association)
  'abbreviation', 'hotline', 'tax_code', 'field_area',
  'misa_current_role', 'misa_events', 'misa_awards',
  // Báo chí (press)
  'political_rank', 'charter', 'contract_term', 'contract_benefits', 'contract_staff'];

router.get('/partners', requirePerm('partners', 'view'), (req, res) => {
  const { page, pageSize, offset } = pageParams(req);
  const q = `%${(req.query.search || '').trim()}%`;
  const args = [q, q, q, q, q, q, q];
  let typeFilter = '';
  if (ORG_TYPES.includes(req.query.type)) { typeFilter = 'AND o.org_type = ?'; args.push(req.query.type); }
  if (req.query.tier) { typeFilter += ' AND o.tier = ?'; args.push(req.query.tier); }
  if (req.query.ptype) { typeFilter += ' AND o.press_types LIKE ?'; args.push(`%"${req.query.ptype}"%`); }
  if (req.query.admin_level) { typeFilter += ' AND o.admin_level = ?'; args.push(req.query.admin_level); }
  if (req.query.agency_block) { typeFilter += ' AND o.agency_block LIKE ?'; args.push(`%${req.query.agency_block}%`); }
  if (req.query.field_area) { typeFilter += ' AND o.field_area LIKE ?'; args.push(`%${req.query.field_area}%`); }
  if (req.query.caretaker_id) {
    typeFilter += " AND EXISTS (SELECT 1 FROM assignments a WHERE a.subject_type='org' AND a.subject_id=o.id AND a.user_id=?)";
    args.push(Number(req.query.caretaker_id));
  }
  const OVERDUE = "(SELECT COUNT(*) FROM association_fees f WHERE f.org_id=o.id AND f.status<>'Đã đóng' AND f.due_date IS NOT NULL AND f.due_date<date('now'))";
  if (req.query.fee_status === 'Quá hạn') typeFilter += ` AND ${OVERDUE}>0`;
  else if (req.query.fee_status === 'Đầy đủ') typeFilter += ` AND ${OVERDUE}=0`;
  const where = `WHERE (o.name LIKE ? OR o.parent_org LIKE ? OR o.address LIKE ? OR o.website LIKE ? OR o.misa_role LIKE ? OR o.abbreviation LIKE ? OR o.note LIKE ?) ${typeFilter}`;
  const total = db.prepare(`SELECT COUNT(*) c FROM organizations o ${where}`).get(...args).c;
  const rows = db.prepare(`
    SELECT o.*, (SELECT COUNT(*) FROM people p WHERE p.org_id = o.id) AS people_count,
      ${OVERDUE} AS fee_overdue
    FROM organizations o ${where} ORDER BY o.name LIMIT ? OFFSET ?`).all(...args, pageSize, offset);
  const allowed = senGroups(req);
  res.json({ rows: rbac.maskList('organization', rows, allowed), total, page, pageSize, sensitiveVisible: senVisible(allowed) });
});

router.get('/partners/:id', requirePerm('partners', 'view'), (req, res) => {
  const row = db.prepare('SELECT * FROM organizations WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy' });
  const allowed = senGroups(req);
  if (allowed.has('org_fee') && row.membership_fee) logEdit(req, 'VIEW_SENSITIVE', 'organization', row.id, `Xem hội phí: ${row.name}`);
  const { record } = rbac.maskRecord('organization', row, allowed);

  // Nhân sự thuộc cơ quan (kèm ảnh chính), che trường mật
  let people = db.prepare(`
    SELECT p.*, (SELECT a.id FROM attachments a WHERE a.owner_type='person' AND a.owner_id=p.id AND a.kind='portrait' AND a.is_primary=1 LIMIT 1) AS primary_photo_id
    FROM people p WHERE p.org_id=? ORDER BY p.relationship_score DESC, p.full_name`).all(row.id);
  people = rbac.maskList('person', people, allowed);

  let sponsorships = db.prepare('SELECT * FROM sponsorships WHERE org_id=? ORDER BY event_date DESC').all(row.id);
  sponsorships = rbac.maskList('sponsorship', sponsorships, allowed);

  const interactions = db.prepare(`SELECT * FROM interactions WHERE partner_type='org' AND partner_id=? ORDER BY date DESC`).all(row.id);
  const dates = db.prepare(`SELECT * FROM important_dates WHERE subject_type='organization' AND subject_id=? ORDER BY event_date`).all(row.id);
  // Hội phí theo năm (số tiền là dữ liệu mật nhóm org_fee)
  let fees = db.prepare('SELECT * FROM association_fees WHERE org_id=? ORDER BY year DESC').all(row.id);
  if (!allowed.has('org_fee')) fees = fees.map((f) => ({ ...f, amount: f.amount != null ? rbac.MASK : f.amount }));
  // Đối tác bộ ngành: MOU + lịch sử làm việc, kèm tệp đính kèm (attachments kind='file')
  const fileFor = (ot, oid) => db.prepare(`SELECT id, original_name, mime FROM attachments WHERE owner_type=? AND owner_id=? AND kind='file' ORDER BY id`).all(ot, oid);
  const agreements = db.prepare('SELECT * FROM agreements WHERE org_id=? ORDER BY signed_date DESC').all(row.id).map((a) => ({ ...a, files: fileFor('agreement', a.id) }));
  const workLogs = db.prepare('SELECT * FROM work_logs WHERE org_id=? ORDER BY work_date DESC').all(row.id).map((w) => ({ ...w, files: fileFor('work_log', w.id) }));
  // Quà tặng (giá trị mật nhóm org_fee) + lịch sử quyền lợi hợp đồng đổi hàng
  let gifts = rbac.maskList('gift', db.prepare(`SELECT * FROM gifts WHERE owner_type='org' AND owner_id=? ORDER BY event_date DESC`).all(row.id), allowed);
  const benefitUsages = db.prepare('SELECT * FROM benefit_usages WHERE org_id=? ORDER BY used_date DESC').all(row.id);
  res.json({ record, people, sponsorships, interactions, dates, fees, agreements, workLogs, gifts, benefitUsages, caretakers: getCaretakers('org', row.id), sensitiveVisible: senVisible(allowed) });
});

router.post('/partners', requirePerm('partners', 'create'), (req, res) => {
  const data = pick(req.body, ORG_COLS);
  jsonField(data, 'press_types');
  if (!ORG_TYPES.includes(data.org_type)) data.org_type = 'other';
  const r = buildInsert('organizations', data);
  syncAssignments('org', r.lastInsertRowid, req.body.caretaker_ids);
  logEdit(req, 'CREATE', 'organization', r.lastInsertRowid, req.body.name);
  res.json({ id: r.lastInsertRowid });
});
router.put('/partners/:id', requirePerm('partners', 'edit'), (req, res) => {
  const data = pick(req.body, ORG_COLS);
  jsonField(data, 'press_types');
  stripDisallowed('organization', data, senGroups(req));
  buildUpdate('organizations', req.params.id, data);
  syncAssignments('org', Number(req.params.id), req.body.caretaker_ids);
  logEdit(req, 'EDIT', 'organization', req.params.id, req.body.name);
  res.json({ ok: true });
});
router.delete('/partners/:id', requirePerm('partners', 'delete'), (req, res) => {
  db.prepare('DELETE FROM organizations WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'organization', req.params.id);
  res.json({ ok: true });
});

// Tài trợ / giải thưởng (gắn cơ quan, thường là hiệp hội)
const S_COLS = ['org_id', 'title', 'type', 'amount', 'event_date', 'sponsor_benefits', 'note',
  'product', 'category', 'submit_deadline', 'present_deadline', 'scale', 'sponsor_package', 'result', 'contact_point', 'staff', 'status'];
router.post('/partners/:id/sponsorships', requirePerm('partners', 'edit'), (req, res) => {
  const data = pick({ ...req.body, org_id: req.params.id }, S_COLS);
  const r = buildInsert('sponsorships', data);
  logEdit(req, 'CREATE', 'sponsorship', r.lastInsertRowid, req.body.title);
  res.json({ id: r.lastInsertRowid });
});
router.put('/sponsorships/:id', requirePerm('partners', 'edit'), (req, res) => {
  buildUpdate('sponsorships', req.params.id, pick(req.body, S_COLS.filter((c) => c !== 'org_id')));
  logEdit(req, 'EDIT', 'sponsorship', req.params.id, req.body.title);
  res.json({ ok: true });
});
router.delete('/sponsorships/:id', requirePerm('partners', 'edit'), (req, res) => {
  db.prepare('DELETE FROM sponsorships WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'sponsorship', req.params.id);
  res.json({ ok: true });
});

// === Đối tác bộ ngành: Hồ sơ hợp tác (MOU) + Lịch sử làm việc + tệp đính kèm ===
function delOwnerFiles(ot, oid) {
  const atts = db.prepare('SELECT filename FROM attachments WHERE owner_type=? AND owner_id=?').all(ot, oid);
  for (const a of atts) { try { fs.unlinkSync(path.join(UPLOAD_DIR, a.filename)); } catch {} }
  db.prepare('DELETE FROM attachments WHERE owner_type=? AND owner_id=?').run(ot, oid);
}
const AG_COLS = ['title', 'signed_date', 'valid_until', 'terms', 'note'];
router.post('/partners/:id/agreements', requirePerm('partners', 'edit'), (req, res) => {
  const data = pick({ ...req.body, org_id: req.params.id }, ['org_id', ...AG_COLS]);
  if (!data.title) return res.status(400).json({ error: 'Thiếu tên thỏa thuận' });
  const r = buildInsert('agreements', data);
  logEdit(req, 'CREATE', 'agreement', r.lastInsertRowid, req.body.title);
  res.json({ id: r.lastInsertRowid });
});
router.put('/agreements/:id', requirePerm('partners', 'edit'), (req, res) => {
  buildUpdate('agreements', req.params.id, pick(req.body, AG_COLS));
  logEdit(req, 'EDIT', 'agreement', req.params.id, req.body.title);
  res.json({ ok: true });
});
router.delete('/agreements/:id', requirePerm('partners', 'edit'), (req, res) => {
  delOwnerFiles('agreement', req.params.id);
  db.prepare('DELETE FROM agreements WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'agreement', req.params.id);
  res.json({ ok: true });
});
const WL_COLS = ['category', 'work_date', 'topic', 'result', 'status', 'staff', 'note'];
router.post('/partners/:id/work-logs', requirePerm('partners', 'edit'), (req, res) => {
  const data = pick({ ...req.body, org_id: req.params.id }, ['org_id', ...WL_COLS]);
  const r = buildInsert('work_logs', data);
  logEdit(req, 'CREATE', 'work_log', r.lastInsertRowid, req.body.topic);
  res.json({ id: r.lastInsertRowid });
});
router.put('/work-logs/:id', requirePerm('partners', 'edit'), (req, res) => {
  buildUpdate('work_logs', req.params.id, pick(req.body, WL_COLS));
  logEdit(req, 'EDIT', 'work_log', req.params.id, req.body.topic);
  res.json({ ok: true });
});
router.delete('/work-logs/:id', requirePerm('partners', 'edit'), (req, res) => {
  delOwnerFiles('work_log', req.params.id);
  db.prepare('DELETE FROM work_logs WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'work_log', req.params.id);
  res.json({ ok: true });
});
function govFileUpload(ownerType) {
  return (req, res) => {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'Không có file nào.' });
    const ins = db.prepare(`INSERT INTO attachments (owner_type, owner_id, kind, filename, original_name, mime, is_primary) VALUES (?,?,'file',?,?,?,0)`);
    for (const f of files) ins.run(ownerType, req.params.id, f.filename, f.originalname, f.mimetype);
    logEdit(req, 'EDIT', ownerType, req.params.id, `Tải lên ${files.length} tệp`);
    res.json({ ok: true });
  };
}
router.post('/agreements/:id/files', requirePerm('partners', 'edit'), upload.array('files', 8), govFileUpload('agreement'));
router.post('/work-logs/:id/files', requirePerm('partners', 'edit'), upload.array('files', 8), govFileUpload('work_log'));

// === Quà tặng đối ngoại (gắn cơ quan hoặc nhân sự) — giá trị mật nhóm org_fee ===
const GIFT_COLS = ['gift_type', 'value', 'giver', 'event_date', 'occasion', 'note'];
function addGift(ownerType) {
  return (req, res) => {
    const data = pick(req.body, GIFT_COLS);
    data.owner_type = ownerType; data.owner_id = req.params.id;
    const r = buildInsert('gifts', data);
    logEdit(req, 'CREATE', 'gift', r.lastInsertRowid, `Quà tặng ${ownerType} #${req.params.id}`);
    res.json({ id: r.lastInsertRowid });
  };
}
router.post('/partners/:id/gifts', requirePerm('partners', 'edit'), addGift('org'));
router.post('/people/:id/gifts', requirePerm('partners', 'edit'), addGift('person'));
router.put('/gifts/:id', requirePerm('partners', 'edit'), (req, res) => {
  buildUpdate('gifts', req.params.id, pick(req.body, GIFT_COLS));
  logEdit(req, 'EDIT', 'gift', req.params.id);
  res.json({ ok: true });
});
router.delete('/gifts/:id', requirePerm('partners', 'edit'), (req, res) => {
  db.prepare('DELETE FROM gifts WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'gift', req.params.id);
  res.json({ ok: true });
});

// === Lịch sử sử dụng quyền lợi hợp đồng đổi hàng (báo chí) ===
const BU_COLS = ['title', 'used_date', 'note'];
router.post('/partners/:id/benefit-usages', requirePerm('partners', 'edit'), (req, res) => {
  const data = pick({ ...req.body, org_id: req.params.id }, ['org_id', ...BU_COLS]);
  if (!data.title) return res.status(400).json({ error: 'Thiếu tiêu đề' });
  const r = buildInsert('benefit_usages', data);
  logEdit(req, 'CREATE', 'benefit_usage', r.lastInsertRowid, req.body.title);
  res.json({ id: r.lastInsertRowid });
});
router.put('/benefit-usages/:id', requirePerm('partners', 'edit'), (req, res) => {
  buildUpdate('benefit_usages', req.params.id, pick(req.body, BU_COLS));
  logEdit(req, 'EDIT', 'benefit_usage', req.params.id, req.body.title);
  res.json({ ok: true });
});
router.delete('/benefit-usages/:id', requirePerm('partners', 'edit'), (req, res) => {
  db.prepare('DELETE FROM benefit_usages WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'benefit_usage', req.params.id);
  res.json({ ok: true });
});

// Hội phí theo năm
const FEE_COLS = ['year', 'amount', 'due_date', 'paid_date', 'status', 'staff', 'note'];
router.post('/partners/:id/fees', requirePerm('partners', 'edit'), (req, res) => {
  const data = pick(req.body, FEE_COLS); data.org_id = req.params.id;
  const r = buildInsert('association_fees', data);
  logEdit(req, 'CREATE', 'association_fee', r.lastInsertRowid, `Hội phí ${req.body.year}`);
  res.json({ id: r.lastInsertRowid });
});
router.put('/partners/:id/fees/:fid', requirePerm('partners', 'edit'), (req, res) => {
  buildUpdate('association_fees', req.params.fid, pick(req.body, FEE_COLS));
  res.json({ ok: true });
});
router.delete('/partners/:id/fees/:fid', requirePerm('partners', 'edit'), (req, res) => {
  db.prepare('DELETE FROM association_fees WHERE id=? AND org_id=?').run(req.params.fid, req.params.id);
  res.json({ ok: true });
});
router.post('/partners/:id/fees/:fid/remind', requirePerm('partners', 'view'), (req, res) => {
  const f = db.prepare('SELECT f.*, o.name org_name FROM association_fees f JOIN organizations o ON o.id=f.org_id WHERE f.id=? AND f.org_id=?').get(req.params.fid, req.params.id);
  if (!f || !f.due_date) return res.status(400).json({ error: 'Khoản hội phí chưa có hạn đóng.' });
  const lead = Math.max(1, parseInt(req.body && req.body.lead_days) || 14);
  const r = db.prepare(`INSERT INTO important_dates (title, date_type, subject_type, subject_id, subject_name, event_date, recurring, lead_days, note)
    VALUES (?,?,?,?,?,?,0,?,?)`).run(`Hạn đóng hội phí ${f.year}: ${f.org_name}`, 'other', 'organization', f.org_id, f.org_name, f.due_date, lead, `Hội phí năm ${f.year}`);
  res.json({ id: r.lastInsertRowid });
});

// =====================================================================
//  PEOPLE (Nhân sự thuộc cơ quan) - nhiều trường nhạy cảm
// =====================================================================
const P_COLS = ['org_id', 'full_name', 'level', 'position', 'beat', 'category', 'relationship_score', 'status',
  'email_work', 'phone_work', 'phone_personal', 'phone_other', 'phone_ott', 'dob', 'home_address', 'personal_notes',
  'social_facebook', 'social_instagram', 'social_tiktok', 'social_x', 'social_thread',
  'bank_account_number', 'bank_name',
  // VIP profile mở rộng
  'gender', 'marital_status', 'personality', 'hobbies', 'food_habits', 'family_info',
  'media_stance', 'relationship_network', 'meeting_places', 'gift_rules',
  'assoc_position', 'external_position', 'assoc_role', 'current_workplace', 'assoc_join_year',
  'assoc_current_role', 'assoc_events', 'assoc_awards'];

router.get('/people', requirePerm('partners', 'view'), (req, res) => {
  const { page, pageSize, offset } = pageParams(req);
  const q = `%${(req.query.search || '').trim()}%`;
  const args = [q, q, q, q, q, q, q];
  let orgFilter = '';
  if (req.query.org_id) { orgFilter = 'AND p.org_id = ?'; args.push(req.query.org_id); }
  let caretakerFilter = '';
  if (req.query.caretaker_id) {
    caretakerFilter = `AND (EXISTS (SELECT 1 FROM assignments a WHERE a.subject_type='person' AND a.subject_id=p.id AND a.user_id=?)
      OR EXISTS (SELECT 1 FROM assignments a2 WHERE a2.subject_type='org' AND a2.subject_id=p.org_id AND a2.user_id=?))`;
    args.push(Number(req.query.caretaker_id), Number(req.query.caretaker_id));
  }
  const where = `WHERE (p.full_name LIKE ? OR p.beat LIKE ? OR p.position LIKE ? OR p.phone_work LIKE ? OR p.email_work LIKE ? OR p.phone_personal LIKE ? OR o.name LIKE ?) ${orgFilter} ${caretakerFilter}`;
  const total = db.prepare(`SELECT COUNT(*) c FROM people p LEFT JOIN organizations o ON o.id = p.org_id ${where}`).get(...args).c;
  const rows = db.prepare(`
    SELECT p.*, o.name AS org_name, o.org_type,
      (SELECT a.id FROM attachments a WHERE a.owner_type='person' AND a.owner_id=p.id AND a.kind='portrait' AND a.is_primary=1 LIMIT 1) AS primary_photo_id
    FROM people p LEFT JOIN organizations o ON o.id = p.org_id
    ${where} ORDER BY p.relationship_score DESC, p.full_name LIMIT ? OFFSET ?`).all(...args, pageSize, offset);
  const allowed = senGroups(req);
  res.json({ rows: rbac.maskList('person', rows, allowed), total, page, pageSize, sensitiveVisible: senVisible(allowed) });
});

router.get('/people/:id', requirePerm('partners', 'view'), (req, res) => {
  const row = db.prepare(`SELECT p.*, o.name AS org_name, o.org_type FROM people p
    LEFT JOIN organizations o ON o.id=p.org_id WHERE p.id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy' });
  const allowed = senGroups(req);
  const { record, maskedFields } = rbac.maskRecord('person', row, allowed);
  const hasSensitive = rbac.SENSITIVE_FIELDS.person.some((f) => row[f]);
  if (allowed.size > 0 && hasSensitive) {
    logEdit(req, 'VIEW_SENSITIVE', 'person', row.id, `Xem dữ liệu mật nhân sự: ${row.full_name}`);
  }
  // Ảnh chân dung: hiển thị cho mọi vai trò. Giấy tờ tùy thân: chỉ người đủ quyền mật.
  const portraits = db.prepare(`SELECT id, original_name, mime, is_primary FROM attachments
    WHERE owner_type='person' AND owner_id=? AND kind='portrait' ORDER BY is_primary DESC, id`).all(row.id);
  const idDocs = allowed.has('iddoc')
    ? db.prepare(`SELECT id, original_name, mime FROM attachments WHERE owner_type='person' AND owner_id=? AND kind='id_doc' ORDER BY id`).all(row.id)
    : [];
  const idDocCount = db.prepare(`SELECT COUNT(*) c FROM attachments WHERE owner_type='person' AND owner_id=? AND kind='id_doc'`).get(row.id).c;
  const interactions = db.prepare(`SELECT * FROM interactions WHERE partner_type='person' AND partner_id=? ORDER BY date DESC`).all(row.id);
  const gifts = rbac.maskList('gift', db.prepare(`SELECT * FROM gifts WHERE owner_type='person' AND owner_id=? ORDER BY event_date DESC`).all(row.id), allowed);
  res.json({ record, maskedFields, portraits, idDocs, idDocCount, interactions, gifts, caretakers: getCaretakers('person', row.id), sensitiveVisible: senVisible(allowed) });
});

router.post('/people', requirePerm('partners', 'create'), (req, res) => {
  const data = pick(req.body, P_COLS);
  jsonField(data, 'phone_ott');
  const r = buildInsert('people', data);
  syncAssignments('person', r.lastInsertRowid, req.body.caretaker_ids);
  logEdit(req, 'CREATE', 'person', r.lastInsertRowid, req.body.full_name);
  res.json({ id: r.lastInsertRowid });
});
router.put('/people/:id', requirePerm('partners', 'edit'), (req, res) => {
  const data = pick(req.body, P_COLS);
  jsonField(data, 'phone_ott');
  stripDisallowed('person', data, senGroups(req)); // không cho ghi đè trường mật ngoài quyền
  buildUpdate('people', req.params.id, data);
  syncAssignments('person', Number(req.params.id), req.body.caretaker_ids);
  logEdit(req, 'EDIT', 'person', req.params.id, req.body.full_name);
  res.json({ ok: true });
});
router.delete('/people/:id', requirePerm('partners', 'delete'), (req, res) => {
  // xóa file vật lý của nhân sự
  const atts = db.prepare(`SELECT filename FROM attachments WHERE owner_type='person' AND owner_id=?`).all(req.params.id);
  for (const a of atts) { try { fs.unlinkSync(path.join(UPLOAD_DIR, a.filename)); } catch {} }
  db.prepare(`DELETE FROM attachments WHERE owner_type='person' AND owner_id=?`).run(req.params.id);
  db.prepare('DELETE FROM people WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'person', req.params.id);
  res.json({ ok: true });
});

// ---------- Attachments: ảnh chân dung + giấy tờ tùy thân ----------
const PORTRAIT_MAX = 5;
router.post('/people/:id/attachments', requirePerm('partners', 'edit'), upload.array('files', 5), (req, res) => {
  const kind = req.query.kind === 'id_doc' ? 'id_doc' : 'portrait';
  // Giấy tờ tùy thân là dữ liệu mật: chỉ người đủ quyền được tải lên
  if (kind === 'id_doc' && !senGroups(req).has('iddoc')) {
    (req.files || []).forEach((f) => { try { fs.unlinkSync(f.path); } catch {} });
    return res.status(403).json({ error: 'Bạn không có quyền tải lên giấy tờ tùy thân (dữ liệu mật).' });
  }
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Không có file nào.' });

  if (kind === 'portrait') {
    const cur = db.prepare(`SELECT COUNT(*) c FROM attachments WHERE owner_type='person' AND owner_id=? AND kind='portrait'`).get(req.params.id).c;
    if (cur + files.length > PORTRAIT_MAX) {
      files.forEach((f) => { try { fs.unlinkSync(f.path); } catch {} });
      return res.status(400).json({ error: `Tối đa ${PORTRAIT_MAX} ảnh chân dung (hiện có ${cur}).` });
    }
  }
  const ins = db.prepare(`INSERT INTO attachments (owner_type, owner_id, kind, filename, original_name, mime, is_primary)
    VALUES ('person', ?, ?, ?, ?, ?, ?)`);
  const hasPrimary = db.prepare(`SELECT COUNT(*) c FROM attachments WHERE owner_type='person' AND owner_id=? AND kind='portrait' AND is_primary=1`).get(req.params.id).c;
  let madePrimary = hasPrimary > 0;
  const created = [];
  for (const f of files) {
    const primary = kind === 'portrait' && !madePrimary ? 1 : 0;
    if (primary) madePrimary = true;
    const r = ins.run(req.params.id, kind, f.filename, f.originalname, f.mimetype, primary);
    created.push(r.lastInsertRowid);
  }
  logEdit(req, 'EDIT', 'person', req.params.id, `Tải lên ${files.length} ${kind === 'id_doc' ? 'giấy tờ' : 'ảnh'}`);
  res.json({ ok: true, ids: created });
});

router.put('/people/:id/attachments/:aid/primary', requirePerm('partners', 'edit'), (req, res) => {
  const att = db.prepare(`SELECT * FROM attachments WHERE id=? AND owner_id=? AND owner_type='person' AND kind='portrait'`).get(req.params.aid, req.params.id);
  if (!att) return res.status(404).json({ error: 'Không tìm thấy ảnh' });
  db.prepare(`UPDATE attachments SET is_primary=0 WHERE owner_type='person' AND owner_id=? AND kind='portrait'`).run(req.params.id);
  db.prepare('UPDATE attachments SET is_primary=1 WHERE id=?').run(req.params.aid);
  res.json({ ok: true });
});

router.delete('/attachments/:aid', requirePerm('partners', 'edit'), (req, res) => {
  const att = db.prepare('SELECT * FROM attachments WHERE id=?').get(req.params.aid);
  if (!att) return res.status(404).json({ error: 'Không tìm thấy' });
  if (att.kind === 'id_doc' && !senGroups(req).has('iddoc')) return res.status(403).json({ error: 'Không đủ quyền' });
  try { fs.unlinkSync(path.join(UPLOAD_DIR, att.filename)); } catch {}
  db.prepare('DELETE FROM attachments WHERE id=?').run(req.params.aid);
  // nếu xóa ảnh chính, đặt ảnh khác làm chính
  if (att.kind === 'portrait' && att.is_primary) {
    const next = db.prepare(`SELECT id FROM attachments WHERE owner_type='person' AND owner_id=? AND kind='portrait' ORDER BY id LIMIT 1`).get(att.owner_id);
    if (next) db.prepare('UPDATE attachments SET is_primary=1 WHERE id=?').run(next.id);
  }
  res.json({ ok: true });
});

// Phục vụ file (có bảo vệ). Giấy tờ tùy thân yêu cầu quyền xem dữ liệu mật + ghi audit.
router.get('/files/:id', (req, res) => {
  const att = db.prepare('SELECT * FROM attachments WHERE id=?').get(req.params.id);
  if (!att) return res.status(404).json({ error: 'Không tìm thấy file' });
  if (att.kind === 'id_doc') {
    if (!senGroups(req).has('iddoc')) return res.status(403).json({ error: 'Không đủ quyền xem giấy tờ tùy thân' });
    logEdit(req, 'VIEW_SENSITIVE', 'person', att.owner_id, `Tải/giấy tờ tùy thân: ${att.original_name || att.filename}`);
  }
  const fp = path.join(UPLOAD_DIR, att.filename);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File không tồn tại' });
  if (att.mime) res.type(att.mime);
  res.sendFile(fp);
});

// =====================================================================
//  REMINDERS / IMPORTANT DATES (Sự kiện sắp tới)
// =====================================================================
const D_COLS = ['title', 'date_type', 'subject_type', 'subject_id', 'subject_name', 'event_date', 'recurring', 'lead_days', 'note'];

// Tính lần xuất hiện kế tiếp + số ngày còn lại
function nextOccurrence(eventDate, recurring) {
  const parts = String(eventDate || '').split('-').map(Number);
  const [y, m, d] = parts;
  if (!m || !d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let occ;
  if (recurring) {
    occ = new Date(today.getFullYear(), m - 1, d);
    if (occ < today) occ = new Date(today.getFullYear() + 1, m - 1, d);
  } else {
    occ = new Date(y, m - 1, d);
  }
  const diff = Math.round((occ - today) / 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  const years = (recurring && y) ? occ.getFullYear() - y : null;
  return { diff, occurDate: `${occ.getFullYear()}-${pad(occ.getMonth() + 1)}-${pad(occ.getDate())}`, years };
}
function decorateDates(rows) {
  return rows.map((r) => {
    const n = nextOccurrence(r.event_date, r.recurring);
    return n ? { ...r, daysUntil: n.diff, occurDate: n.occurDate, years: n.years, dueSoon: n.diff <= (r.lead_days || 7) } : { ...r, daysUntil: null };
  });
}

router.get('/reminders/upcoming', requirePerm('reminders', 'view'), (req, res) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 60));
  const rows = decorateDates(db.prepare('SELECT * FROM important_dates').all())
    .filter((r) => r.daysUntil != null && r.daysUntil >= 0 && r.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  res.json({ rows, days });
});
router.get('/reminders', requirePerm('reminders', 'view'), (req, res) => {
  const rows = decorateDates(db.prepare('SELECT * FROM important_dates ORDER BY title').all());
  res.json({ rows });
});
router.post('/reminders', requirePerm('reminders', 'create'), (req, res) => {
  const data = pick(req.body, D_COLS);
  if (!data.event_date) return res.status(400).json({ error: 'Thiếu ngày sự kiện' });
  if (data.recurring == null) data.recurring = 1;
  const r = buildInsert('important_dates', data);
  logEdit(req, 'CREATE', 'important_date', r.lastInsertRowid, req.body.title);
  res.json({ id: r.lastInsertRowid });
});
router.put('/reminders/:id', requirePerm('reminders', 'edit'), (req, res) => {
  buildUpdate('important_dates', req.params.id, pick(req.body, D_COLS));
  logEdit(req, 'EDIT', 'important_date', req.params.id, req.body.title);
  res.json({ ok: true });
});
router.delete('/reminders/:id', requirePerm('reminders', 'delete'), (req, res) => {
  db.prepare('DELETE FROM important_dates WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'important_date', req.params.id);
  res.json({ ok: true });
});

// =====================================================================
//  INTERACTIONS (Lịch sử tương tác)
// =====================================================================
// Tìm nhanh nhân sự + cơ quan để gắn tương tác (và để khớp tên từ AI)
router.get('/entities/search', requirePerm('interactions', 'view'), (req, res) => {
  const q = `%${(req.query.q || '').trim()}%`;
  const people = db.prepare(`SELECT p.id, p.full_name AS name, o.name AS sub FROM people p
    LEFT JOIN organizations o ON o.id=p.org_id WHERE p.full_name LIKE ? ORDER BY p.relationship_score DESC LIMIT 10`).all(q);
  const orgs = db.prepare(`SELECT id, name, org_type AS sub FROM organizations WHERE name LIKE ? ORDER BY name LIMIT 10`).all(q);
  const out = [
    ...people.map((p) => ({ type: 'person', id: p.id, name: p.name, sub: p.sub || 'Nhân sự' })),
    ...orgs.map((o) => ({ type: 'org', id: o.id, name: o.name, sub: ({ press: 'Cơ quan báo chí', association: 'Hiệp hội', gov: 'Đối tác bộ ngành', other: 'Khác' })[o.sub] || 'Cơ quan' })),
  ];
  res.json({ rows: out });
});

const I_COLS = ['partner_type', 'partner_id', 'partner_name', 'date', 'channel', 'summary', 'result', 'staff',
  'next_task', 'next_status', 'next_due', 'next_staff', 'work_mode'];
router.get('/interactions', requirePerm('interactions', 'view'), (req, res) => {
  const { page, pageSize, offset } = pageParams(req);
  const filters = [];
  const args = [];
  if (req.query.partner_type) { filters.push('partner_type=?'); args.push(req.query.partner_type); }
  if (req.query.partner_id) { filters.push('partner_id=?'); args.push(req.query.partner_id); }
  if (req.query.search) { filters.push('(summary LIKE ? OR partner_name LIKE ?)'); args.push(`%${req.query.search}%`, `%${req.query.search}%`); }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) c FROM interactions ${where}`).get(...args).c;
  const rows = db.prepare(`SELECT * FROM interactions ${where} ORDER BY date DESC LIMIT ? OFFSET ?`).all(...args, pageSize, offset);
  res.json({ rows, total, page, pageSize });
});
router.post('/interactions', requirePerm('interactions', 'create'), (req, res) => {
  const data = pick(req.body, I_COLS);
  if (!['person', 'org'].includes(data.partner_type)) data.partner_type = 'person';
  if (data.partner_id == null) data.partner_id = 0;
  data.created_by = req.session.user.id;
  const r = buildInsert('interactions', data);
  logEdit(req, 'CREATE', 'interaction', r.lastInsertRowid, req.body.summary);
  res.json({ id: r.lastInsertRowid });
});

// =====================================================================
//  BOOKINGS (Booking bài viết — đặt báo/phóng viên)
// =====================================================================
const B_COLS = ['subject_type', 'subject_id', 'subject_name', 'org_id', 'org_name', 'content_type',
  'title', 'amount', 'article_link', 'booked_date', 'publish_date', 'status', 'note', 'award_id'];

function resolveOrg(data) {
  // Với phóng viên: gom theo cơ quan của họ để báo cáo theo đơn vị báo chí
  if (data.subject_type === 'person' && data.subject_id) {
    const p = db.prepare('SELECT p.org_id, o.name org_name FROM people p LEFT JOIN organizations o ON o.id=p.org_id WHERE p.id=?').get(data.subject_id);
    if (p) { data.org_id = p.org_id; data.org_name = p.org_name; }
  } else if (data.subject_type === 'org' && data.subject_id) {
    const o = db.prepare('SELECT name FROM organizations WHERE id=?').get(data.subject_id);
    if (o) { data.org_id = data.subject_id; data.org_name = o.name; }
  }
  return data;
}

router.get('/bookings', requirePerm('partners', 'view'), (req, res) => {
  const filters = [], args = [];
  if (req.query.subject_type) { filters.push('subject_type=?'); args.push(req.query.subject_type); }
  if (req.query.subject_id) { filters.push('subject_id=?'); args.push(req.query.subject_id); }
  if (req.query.from) { filters.push('booked_date>=?'); args.push(req.query.from); }
  if (req.query.to) { filters.push('booked_date<=?'); args.push(req.query.to); }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM bookings ${where} ORDER BY booked_date DESC, id DESC`).all(...args);
  const total_amount = rows.reduce((s, r) => s + (r.amount || 0), 0);
  maskMoney(req, rows, 'amount');
  res.json({ rows, total_amount: canMoney(req) ? total_amount : rbac.MASK });
});
router.post('/bookings', requirePerm('partners', 'create'), (req, res) => {
  const data = resolveOrg(pick(req.body, B_COLS));
  data.created_by = req.session.user.id;
  const r = buildInsert('bookings', data);
  logEdit(req, 'CREATE', 'booking', r.lastInsertRowid, `${req.body.title} (${(req.body.amount || 0).toLocaleString('vi-VN')}đ)`);
  res.json({ id: r.lastInsertRowid });
});
router.put('/bookings/:id', requirePerm('partners', 'edit'), (req, res) => {
  buildUpdate('bookings', req.params.id, resolveOrg(pick(req.body, B_COLS)));
  logEdit(req, 'EDIT', 'booking', req.params.id, req.body.title);
  res.json({ ok: true });
});
router.delete('/bookings/:id', requirePerm('partners', 'delete'), (req, res) => {
  db.prepare('DELETE FROM bookings WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'booking', req.params.id);
  res.json({ ok: true });
});

// =====================================================================
//  BUDGETS (ngân sách theo tháng)
// =====================================================================
router.get('/budgets', requirePerm('reports', 'view'), (req, res) => {
  res.json({ rows: db.prepare('SELECT * FROM budgets ORDER BY period').all() });
});
router.post('/budgets', requirePerm('reports', 'view'), (req, res) => {
  const { period, amount, note } = req.body || {};
  if (!/^\d{4}-\d{2}$/.test(period || '')) return res.status(400).json({ error: 'Kỳ phải dạng YYYY-MM' });
  db.prepare(`INSERT INTO budgets (period, amount, note) VALUES (?,?,?)
    ON CONFLICT(period) DO UPDATE SET amount=excluded.amount, note=excluded.note`).run(period, Number(amount) || 0, note || null);
  logEdit(req, 'EDIT', 'budget', null, `${period}: ${amount}`);
  res.json({ ok: true });
});

// =====================================================================
//  REPORTS (Tab Báo cáo — chỉ lãnh đạo/quản lý)
// =====================================================================
router.get('/reports', requirePerm('reports', 'view'), (req, res) => {
  const from = req.query.from || '0000-01-01';
  const to = req.query.to || '9999-12-31';
  const bArgs = [from, to];
  const spendByMonth = db.prepare(`SELECT substr(booked_date,1,7) period, SUM(amount) amount, COUNT(*) cnt
    FROM bookings WHERE status!='Hủy' AND booked_date BETWEEN ? AND ? GROUP BY period ORDER BY period`).all(...bArgs);
  const spendByOrg = db.prepare(`SELECT org_name name, SUM(amount) amount, COUNT(*) cnt
    FROM bookings WHERE status!='Hủy' AND booked_date BETWEEN ? AND ? GROUP BY org_id ORDER BY amount DESC`).all(...bArgs);
  const spendByPerson = db.prepare(`SELECT subject_name name, org_name, SUM(amount) amount, COUNT(*) cnt
    FROM bookings WHERE status!='Hủy' AND subject_type='person' AND booked_date BETWEEN ? AND ? GROUP BY subject_id ORDER BY amount DESC`).all(...bArgs);
  const spendByType = db.prepare(`SELECT content_type name, SUM(amount) amount, COUNT(*) cnt
    FROM bookings WHERE status!='Hủy' AND booked_date BETWEEN ? AND ? GROUP BY content_type ORDER BY amount DESC`).all(...bArgs);
  const spendByStaff = db.prepare(`SELECT COALESCE(u.full_name,'(Không rõ)') name, SUM(b.amount) amount, COUNT(*) cnt
    FROM bookings b LEFT JOIN users u ON u.id=b.created_by
    WHERE b.status!='Hủy' AND b.booked_date BETWEEN ? AND ? GROUP BY b.created_by ORDER BY amount DESC`).all(...bArgs);
  const totalSpend = db.prepare(`SELECT COALESCE(SUM(amount),0) s, COUNT(*) c FROM bookings WHERE status!='Hủy' AND booked_date BETWEEN ? AND ?`).get(...bArgs);
  const fulfillment = db.prepare(`SELECT status, COUNT(*) cnt, COALESCE(SUM(amount),0) amount FROM bookings WHERE booked_date BETWEEN ? AND ? GROUP BY status`).all(...bArgs);
  const budget = db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM budgets WHERE period BETWEEN ? AND ?`).get(from.slice(0, 7), to.slice(0, 7));

  // Quan hệ
  const tiers = db.prepare(`SELECT
      SUM(CASE WHEN relationship_score>=75 THEN 1 ELSE 0 END) t1,
      SUM(CASE WHEN relationship_score>=50 AND relationship_score<75 THEN 1 ELSE 0 END) t2,
      SUM(CASE WHEN relationship_score>=25 AND relationship_score<50 THEN 1 ELSE 0 END) t3,
      SUM(CASE WHEN relationship_score<25 THEN 1 ELSE 0 END) t4 FROM people`).get();
  const byBeat = db.prepare(`SELECT COALESCE(NULLIF(beat,''),'(Khác)') name, COUNT(*) cnt FROM people GROUP BY name ORDER BY cnt DESC`).all();

  // Rủi ro chăm sóc: lâu chưa tương tác
  const careRisk = db.prepare(`SELECT p.id, p.full_name, p.relationship_score, o.name org_name, p.beat,
      (SELECT MAX(i.date) FROM interactions i WHERE i.partner_type='person' AND i.partner_id=p.id) last_date
    FROM people p LEFT JOIN organizations o ON o.id=p.org_id
    WHERE p.status!='Ngừng hợp tác'`).all()
    .map((p) => {
      const days = p.last_date ? Math.round((Date.now() - new Date(p.last_date + 'T00:00:00Z')) / 86400000) : 999;
      let level = 1, label = 'Cấp 1: Đồng hành', action = '';
      if (days >= 30) { level = 5; label = 'Cấp 5: Nguy hiểm'; action = 'Đối ngoại khẩn cấp'; }
      else if (days >= 21) { level = 4; label = 'Cấp 4: Cảnh báo'; action = 'Sắp xếp gặp/gọi ngay'; }
      else if (days >= 14) { level = 3; label = 'Cấp 3: Cần theo dõi'; action = 'Lên lịch chăm sóc'; }
      else if (days >= 7) { level = 2; label = 'Cấp 2: Ổn'; action = ''; }
      return { ...p, days, level, label, action };
    }).filter((p) => p.level >= 3).sort((a, b) => b.days - a.days).slice(0, 20);

  // Tương tác
  const interByMonth = db.prepare(`SELECT substr(date,1,7) period, COUNT(*) cnt FROM interactions WHERE date BETWEEN ? AND ? GROUP BY period ORDER BY period`).all(from, to);
  const interByChannel = db.prepare(`SELECT COALESCE(channel,'(Khác)') name, COUNT(*) cnt FROM interactions WHERE date BETWEEN ? AND ? GROUP BY name ORDER BY cnt DESC`).all(from, to);
  const interByResult = db.prepare(`SELECT COALESCE(result,'(Khác)') name, COUNT(*) cnt FROM interactions WHERE date BETWEEN ? AND ? GROUP BY name`).all(from, to);

  // Quy mô mạng lưới
  const network = {
    orgs: db.prepare('SELECT COUNT(*) c FROM organizations').get().c,
    press: db.prepare("SELECT COUNT(*) c FROM organizations WHERE org_type='press'").get().c,
    people: db.prepare('SELECT COUNT(*) c FROM people').get().c,
    newPeople: db.prepare('SELECT COUNT(*) c FROM people WHERE substr(created_at,1,10) BETWEEN ? AND ?').get(from, to).c,
    foundingsInRange: db.prepare(`SELECT COUNT(*) c FROM important_dates WHERE date_type='founding'`).get().c,
  };

  // Chi phí sự kiện (theo nhóm + theo sự kiện) — nối vào báo cáo cho chính xác
  const evByCategory = db.prepare(`SELECT ec.category, COALESCE(SUM(ec.amount),0) amount FROM event_costs ec
    JOIN events e ON e.id=ec.event_id WHERE e.start_time BETWEEN ? AND ? GROUP BY ec.category`).all(from, to);
  const evByEvent = db.prepare(`SELECT e.name, e.mode, COALESCE(SUM(ec.amount),0) amount FROM events e
    LEFT JOIN event_costs ec ON ec.event_id=e.id WHERE e.start_time BETWEEN ? AND ? GROUP BY e.id ORDER BY amount DESC`).all(from, to);
  const evTotal = db.prepare(`SELECT COALESCE(SUM(ec.amount),0) s FROM event_costs ec JOIN events e ON e.id=ec.event_id WHERE e.start_time BETWEEN ? AND ?`).get(from, to).s;

  // Hội phí hiệp hội (theo hạn đóng trong kỳ)
  const feeByOrg = db.prepare(`SELECT o.name, COALESCE(SUM(f.amount),0) amount FROM association_fees f JOIN organizations o ON o.id=f.org_id
    WHERE f.due_date BETWEEN ? AND ? GROUP BY f.org_id ORDER BY amount DESC`).all(from, to);
  const feeTotal = db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM association_fees WHERE due_date BETWEEN ? AND ?`).get(from, to).s;

  res.json({
    range: { from, to },
    spend: { byMonth: spendByMonth, byOrg: spendByOrg, byPerson: spendByPerson, byType: spendByType, byStaff: spendByStaff, total: totalSpend.s, count: totalSpend.c, budget: budget.s },
    events: { byCategory: evByCategory, byEvent: evByEvent, total: evTotal },
    fees: { byOrg: feeByOrg, total: feeTotal },
    grandTotal: totalSpend.s + evTotal + feeTotal,
    fulfillment, tiers, byBeat, careRisk,
    interactions: { byMonth: interByMonth, byChannel: interByChannel, byResult: interByResult },
    network,
  });
});

// ----- Báo cáo theo nhân sự PR -----
router.get('/reports/by-staff', requirePerm('reports', 'view'), (req, res) => {
  const from = req.query.from || '0000-01-01', to = req.query.to || '9999-12-31';
  const users = db.prepare("SELECT id, full_name, role FROM users WHERE active=1 ORDER BY full_name").all();
  const cnt = (t, uid) => db.prepare('SELECT COUNT(*) c FROM assignments WHERE user_id=? AND subject_type=?').get(uid, t).c;
  const rows = users.map((u) => {
    const orgs = cnt('org', u.id), people = cnt('person', u.id), awards = cnt('award', u.id);
    const spend = db.prepare(`SELECT COALESCE(SUM(amount),0) s, COUNT(*) c FROM bookings WHERE created_by=? AND status!='Hủy' AND booked_date BETWEEN ? AND ?`).get(u.id, from, to);
    const inter = db.prepare('SELECT COUNT(*) c FROM interactions WHERE created_by=? AND date BETWEEN ? AND ?').get(u.id, from, to).c;
    const avg = db.prepare(`SELECT ROUND(AVG(p.relationship_score)) a FROM assignments x JOIN people p ON p.id=x.subject_id WHERE x.user_id=? AND x.subject_type='person'`).get(u.id).a;
    // đầu mối người được giao quá 30 ngày không tương tác
    const overdue = db.prepare(`SELECT COUNT(*) c FROM assignments x JOIN people p ON p.id=x.subject_id WHERE x.user_id=? AND x.subject_type='person'
      AND COALESCE((SELECT MAX(date) FROM interactions i WHERE i.partner_type='person' AND i.partner_id=p.id),'0000') < date('now','-30 day')`).get(u.id).c;
    return { id: u.id, full_name: u.full_name, role: u.role, orgs, people, awards, assigned: orgs + people + awards, spend: spend.s, bookings: spend.c, interactions: inter, avgScore: avg, overdue };
  }).filter((r) => r.assigned > 0 || r.spend > 0 || r.interactions > 0).sort((a, b) => b.assigned - a.assigned);
  res.json({ rows });
});

// ----- Báo cáo theo đơn vị -----
router.get('/reports/by-unit', requirePerm('reports', 'view'), (req, res) => {
  const from = req.query.from || '0000-01-01', to = req.query.to || '9999-12-31';
  const rows = db.prepare(`SELECT o.id, o.name, o.org_type,
      (SELECT COUNT(*) FROM bookings b WHERE b.org_id=o.id AND b.status!='Hủy' AND b.booked_date BETWEEN ? AND ?) book_cnt,
      (SELECT COALESCE(SUM(amount),0) FROM bookings b WHERE b.org_id=o.id AND b.status!='Hủy' AND b.booked_date BETWEEN ? AND ?) spend,
      (SELECT COUNT(*) FROM interactions i WHERE i.partner_type='org' AND i.partner_id=o.id AND i.date BETWEEN ? AND ?) inter_cnt,
      (SELECT MAX(date) FROM interactions i WHERE i.partner_type='org' AND i.partner_id=o.id) last_inter,
      (SELECT COUNT(*) FROM people p WHERE p.org_id=o.id) people_cnt
    FROM organizations o ORDER BY spend DESC, inter_cnt DESC`).all(from, to, from, to, from, to);
  rows.forEach((r) => { r.caretakers = getCaretakers('org', r.id).map((u) => u.full_name); });
  res.json({ rows });
});

// ----- Báo cáo giải thưởng -----
router.get('/reports/awards', requirePerm('reports', 'view'), (req, res) => {
  const from = req.query.from || '0000-01-01', to = req.query.to || '9999-12-31';
  const yFrom = Number(from.slice(0, 4)) || 0, yTo = Number(to.slice(0, 4)) || 9999;
  const awards = db.prepare('SELECT * FROM awards ORDER BY submission_deadline').all();
  const rows = awards.map((a) => {
    const parts = db.prepare('SELECT * FROM award_participations WHERE award_id=? AND year BETWEEN ? AND ? ORDER BY year DESC').all(a.id, yFrom, yTo);
    const partBudget = parts.reduce((s, p) => s + (p.budget || 0), 0);
    const mediaCost = db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM bookings WHERE award_id=? AND status!='Hủy'`).get(a.id).s;
    return {
      id: a.id, name: a.name, organizer: a.organizer, status: a.status, scope: a.scope,
      cost: a.cost || 0, partBudget, mediaCost, totalCost: (a.cost || 0) + partBudget + mediaCost,
      participations: parts.map((p) => ({ year: p.year, status: p.status, result: p.result, budget: p.budget })),
      caretakers: getCaretakers('award', a.id).map((u) => u.full_name),
    };
  }).filter((a) => a.participations.length || a.mediaCost > 0);
  res.json({ rows });
});

// ----- Cảnh báo quan hệ lâu không chăm sóc (1/3/6/12 tháng) -----
router.get('/reports/care-alerts', requirePerm('reports', 'view'), (req, res) => {
  const lastActivityPerson = (id) => {
    const i = db.prepare(`SELECT MAX(date) d FROM interactions WHERE partner_type='person' AND partner_id=?`).get(id).d;
    const b = db.prepare(`SELECT MAX(booked_date) d FROM bookings WHERE subject_type='person' AND subject_id=?`).get(id).d;
    return [i, b].filter(Boolean).sort().pop() || null;
  };
  const lastActivityOrg = (id) => {
    const i = db.prepare(`SELECT MAX(date) d FROM interactions WHERE partner_type='org' AND partner_id=?`).get(id).d;
    const b = db.prepare(`SELECT MAX(booked_date) d FROM bookings WHERE org_id=?`).get(id).d;
    return [i, b].filter(Boolean).sort().pop() || null;
  };
  const now = Date.now();
  const bucketOf = (days) => days >= 365 ? '12m' : days >= 180 ? '6m' : days >= 90 ? '3m' : days >= 30 ? '1m' : null;
  const build = (type, id, name, sub) => {
    const last = type === 'person' ? lastActivityPerson(id) : lastActivityOrg(id);
    const days = last ? Math.round((now - new Date(last + 'T00:00:00Z')) / 86400000) : 9999;
    const bucket = bucketOf(days);
    if (!bucket) return null;
    return { type, id, name, sub, last, days, bucket, caretakers: getCaretakers(type, id).map((u) => u.full_name) };
  };
  const people = db.prepare(`SELECT p.id, p.full_name name, o.name org FROM people p LEFT JOIN organizations o ON o.id=p.org_id WHERE p.status!='Ngừng hợp tác'`).all()
    .map((p) => build('person', p.id, p.name, p.org || 'Nhân sự')).filter(Boolean);
  const orgs = db.prepare('SELECT id, name, org_type FROM organizations').all()
    .map((o) => build('org', o.id, o.name, ({ press: 'Cơ quan báo chí', association: 'Hiệp hội', gov: 'Bộ ngành', other: 'Khác' })[o.org_type])).filter(Boolean);
  const all = [...people, ...orgs].sort((a, b) => b.days - a.days);
  res.json({ rows: all, counts: { '1m': all.filter((x) => x.bucket === '1m').length, '3m': all.filter((x) => x.bucket === '3m').length, '6m': all.filter((x) => x.bucket === '6m').length, '12m': all.filter((x) => x.bucket === '12m').length } });
});

// =====================================================================
//  NOTIFICATIONS (chuông nhắc in-app) + ICS
// =====================================================================
router.get('/notifications', requirePerm('reminders', 'view'), (req, res) => {
  const uid = req.session.user.id;
  const rows = db.prepare(`SELECT rl.id, rl.occur_date, rl.seq, rl.read_at, rl.created_at,
      d.title, d.date_type, d.subject_name, d.note, d.id date_id
    FROM reminder_log rl JOIN important_dates d ON d.id=rl.date_id
    WHERE rl.channel='inapp' AND rl.recipient_user_id=? ORDER BY rl.id DESC LIMIT 50`).all(uid);
  const unread = rows.filter((r) => !r.read_at).length;
  res.json({ rows, unread });
});
router.post('/notifications/:id/read', requirePerm('reminders', 'view'), (req, res) => {
  db.prepare("UPDATE reminder_log SET read_at=datetime('now') WHERE id=? AND recipient_user_id=?").run(req.params.id, req.session.user.id);
  res.json({ ok: true });
});
router.post('/notifications/read-all', requirePerm('reminders', 'view'), (req, res) => {
  db.prepare("UPDATE reminder_log SET read_at=datetime('now') WHERE recipient_user_id=? AND read_at IS NULL AND channel='inapp'").run(req.session.user.id);
  res.json({ ok: true });
});
// chạy thủ công bộ nhắc (tiện kiểm thử / cập nhật ngay)
router.post('/reminders/run', requirePerm('reminders', 'view'), (req, res) => {
  const r = scheduler.runOnce();
  res.json({ ok: true, ...r });
});
// Xuất .ics cho 1 ngày nhắc
router.get('/reminders/:id/ics', requirePerm('reminders', 'view'), (req, res) => {
  const d = db.prepare('SELECT * FROM important_dates WHERE id=?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Không tìm thấy' });
  const [y, m, day] = String(d.event_date).split('-');
  const dt = `${y}${m}${day}`;
  const pad = (n) => String(n).padStart(2, '0');
  const nd = new Date(Date.parse(d.event_date) + 86400000);
  const dtEnd = `${nd.getUTCFullYear()}${pad(nd.getUTCMonth() + 1)}${pad(nd.getUTCDate())}`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MISA PR Workstation//VI', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:misa-pr-${d.id}@misa`, `SUMMARY:${(d.title || '').replace(/\n/g, ' ')}`,
    `DTSTART;VALUE=DATE:${dt}`, `DTEND;VALUE=DATE:${dtEnd}`,
    d.recurring ? 'RRULE:FREQ=YEARLY' : '',
    d.note ? `DESCRIPTION:${String(d.note).replace(/\n/g, ' ')}` : '',
    `BEGIN:VALARM`, `TRIGGER:-P${d.lead_days || 7}D`, 'ACTION:DISPLAY', `DESCRIPTION:${(d.title || '').replace(/\n/g, ' ')}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  res.type('text/calendar').set('Content-Disposition', `attachment; filename="su-kien-${d.id}.ics"`).send(ics);
});

// =====================================================================
//  AWARDS (Giải thưởng / bằng khen / danh hiệu)
// =====================================================================
const AW_COLS = ['name', 'organizer', 'org_id', 'organizer_type', 'scale', 'event_time', 'submission_deadline',
  'eligibility', 'cost', 'criteria', 'required_docs', 'prize_structure', 'evaluation_method', 'scope', 'status',
  'source_url', 'ai_summary', 'review_status', 'note'];
const PART_COLS = ['year', 'status', 'products', 'categories', 'goal', 'purpose', 'capability', 'plan', 'budget', 'result', 'note'];

function deadlineInfo(d) {
  if (!d) return { days: null };
  const today = new Date(Date.now() + 7 * 3600 * 1000); today.setUTCHours(0, 0, 0, 0);
  const due = new Date(d + 'T00:00:00Z');
  if (isNaN(due)) return { days: null };
  return { days: Math.round((due - today) / 86400000) };
}

router.get('/awards', requirePerm('awards', 'view'), (req, res) => {
  const { page, pageSize, offset } = pageParams(req);
  const q = `%${(req.query.search || '').trim()}%`;
  const args = [q, q];
  const filters = ['(a.name LIKE ? OR a.organizer LIKE ?)'];
  if (['gov', 'association', 'other'].includes(req.query.type)) { filters.push('a.organizer_type=?'); args.push(req.query.type); }
  if (req.query.status) { filters.push('a.status=?'); args.push(req.query.status); }
  if (req.query.scope) { filters.push('a.scope=?'); args.push(req.query.scope); }
  const where = 'WHERE ' + filters.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) c FROM awards a ${where}`).get(...args).c;
  let rows = db.prepare(`SELECT a.*, o.name AS org_name FROM awards a LEFT JOIN organizations o ON o.id=a.org_id
    ${where} ORDER BY (a.submission_deadline IS NULL), a.submission_deadline LIMIT ? OFFSET ?`).all(...args, pageSize, offset);
  rows = rows.map((r) => ({ ...r, deadlineDays: deadlineInfo(r.submission_deadline).days }));
  if (req.query.deadline === 'soon') rows = rows.filter((r) => r.deadlineDays != null && r.deadlineDays >= 0 && r.deadlineDays <= 30);
  if (req.query.deadline === 'overdue') rows = rows.filter((r) => r.deadlineDays != null && r.deadlineDays < 0);
  maskMoney(req, rows, 'cost');
  res.json({ rows, total, page, pageSize });
});

router.get('/awards/:id', requirePerm('awards', 'view'), (req, res) => {
  const row = db.prepare(`SELECT a.*, o.name AS org_name FROM awards a LEFT JOIN organizations o ON o.id=a.org_id WHERE a.id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy' });
  row.deadlineDays = deadlineInfo(row.submission_deadline).days;
  const participations = db.prepare('SELECT * FROM award_participations WHERE award_id=? ORDER BY year DESC, id DESC').all(row.id);
  const attachments = db.prepare(`SELECT id, original_name, mime, kind FROM attachments WHERE owner_type='award' AND owner_id=? ORDER BY id`).all(row.id);
  if (!canMoney(req)) { maskMoney(req, row, 'cost'); maskMoney(req, participations, 'budget'); }
  res.json({ record: row, participations, attachments, caretakers: getCaretakers('award', row.id) });
});

router.post('/awards', requirePerm('awards', 'create'), (req, res) => {
  const data = pick(req.body, AW_COLS);
  data.created_by = req.session.user.id;
  const r = buildInsert('awards', data);
  syncAssignments('award', r.lastInsertRowid, req.body.caretaker_ids);
  logEdit(req, 'CREATE', 'award', r.lastInsertRowid, req.body.name);
  res.json({ id: r.lastInsertRowid });
});
router.put('/awards/:id', requirePerm('awards', 'edit'), (req, res) => {
  buildUpdate('awards', req.params.id, pick(req.body, AW_COLS));
  syncAssignments('award', Number(req.params.id), req.body.caretaker_ids);
  logEdit(req, 'EDIT', 'award', req.params.id, req.body.name);
  res.json({ ok: true });
});
router.delete('/awards/:id', requirePerm('awards', 'delete'), (req, res) => {
  const atts = db.prepare(`SELECT filename FROM attachments WHERE owner_type='award' AND owner_id=?`).all(req.params.id);
  for (const a of atts) { try { fs.unlinkSync(path.join(UPLOAD_DIR, a.filename)); } catch {} }
  db.prepare(`DELETE FROM attachments WHERE owner_type='award' AND owner_id=?`).run(req.params.id);
  db.prepare('DELETE FROM awards WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'award', req.params.id);
  res.json({ ok: true });
});

// Hồ sơ tham gia theo năm
router.post('/awards/:id/participations', requirePerm('awards', 'create'), (req, res) => {
  const data = pick(req.body, PART_COLS); data.award_id = req.params.id;
  const r = buildInsert('award_participations', data);
  logEdit(req, 'CREATE', 'award_participation', r.lastInsertRowid, `Năm ${req.body.year}`);
  res.json({ id: r.lastInsertRowid });
});
router.put('/awards/:id/participations/:pid', requirePerm('awards', 'edit'), (req, res) => {
  buildUpdate('award_participations', req.params.pid, pick(req.body, PART_COLS));
  res.json({ ok: true });
});
router.delete('/awards/:id/participations/:pid', requirePerm('awards', 'edit'), (req, res) => {
  db.prepare('DELETE FROM award_participations WHERE id=? AND award_id=?').run(req.params.pid, req.params.id);
  res.json({ ok: true });
});

// Đính kèm thông báo (ảnh/PDF) — phục vụ qua /files/:id sẵn có, xóa qua /attachments/:aid
router.post('/awards/:id/files', requirePerm('awards', 'edit'), upload.array('files', 8), (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Không có file nào.' });
  const ins = db.prepare(`INSERT INTO attachments (owner_type, owner_id, kind, filename, original_name, mime, is_primary)
    VALUES ('award', ?, 'award_doc', ?, ?, ?, 0)`);
  for (const f of files) ins.run(req.params.id, f.filename, f.originalname, f.mimetype);
  logEdit(req, 'EDIT', 'award', req.params.id, `Tải lên ${files.length} tài liệu`);
  res.json({ ok: true });
});

// Tạo nhanh nhắc hạn nộp hồ sơ -> vào "Sự kiện sắp tới"
router.post('/awards/:id/remind', requirePerm('awards', 'view'), (req, res) => {
  const a = db.prepare('SELECT * FROM awards WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Không tìm thấy' });
  if (!a.submission_deadline) return res.status(400).json({ error: 'Giải thưởng chưa có hạn nộp hồ sơ.' });
  const lead = Math.max(1, parseInt(req.body && req.body.lead_days) || 7);
  const r = db.prepare(`INSERT INTO important_dates (title, date_type, subject_type, subject_id, subject_name, event_date, recurring, lead_days, note)
    VALUES (?,?,?,?,?,?,0,?,?)`).run(`Hạn nộp hồ sơ: ${a.name}`, 'other', 'general', a.id, a.name, a.submission_deadline, lead, `Giải thưởng do ${a.organizer || '—'} tổ chức`);
  logEdit(req, 'CREATE', 'important_date', r.lastInsertRowid, `Nhắc hạn nộp ${a.name}`);
  res.json({ id: r.lastInsertRowid });
});

// =====================================================================
//  SUPPLIERS (Danh bạ nhà cung cấp)
// =====================================================================
const SUP_COLS = ['name', 'address', 'industry', 'contact_phone', 'contact_email', 'tax_code', 'services',
  'invoice_type', 'service_fee_pct', 'order_group_link', 'deposit_pct', 'note'];
const QUOTE_COLS = ['stt', 'item', 'unit', 'qty', 'unit_price'];
const STRANS_COLS = ['service_type', 'purpose', 'contract_no', 'value', 'signed_date', 'exec_deadline', 'status', 'staff', 'note'];

router.get('/suppliers', requirePerm('suppliers', 'view'), (req, res) => {
  const { page, pageSize, offset } = pageParams(req);
  const q = `%${(req.query.search || '').trim()}%`;
  const args = [q, q, q, q, q, q, q];
  let extra = '';
  if (req.query.industry) { extra = ' AND industry LIKE ?'; args.push(`%${req.query.industry}%`); }
  const where = `WHERE (name LIKE ? OR services LIKE ? OR tax_code LIKE ? OR address LIKE ? OR industry LIKE ? OR contact_phone LIKE ? OR contact_email LIKE ?)${extra}`;
  const total = db.prepare(`SELECT COUNT(*) c FROM suppliers ${where}`).get(...args).c;
  const rows = db.prepare(`SELECT * FROM suppliers ${where} ORDER BY name LIMIT ? OFFSET ?`).all(...args, pageSize, offset);
  res.json({ rows, total, page, pageSize });
});
router.get('/suppliers/list', requirePerm('suppliers', 'view'), (req, res) => {
  res.json({ rows: db.prepare('SELECT id, name FROM suppliers ORDER BY name').all() });
});
router.get('/suppliers/:id', requirePerm('suppliers', 'view'), (req, res) => {
  const row = db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy' });
  const quotes = db.prepare('SELECT * FROM supplier_quotes WHERE supplier_id=? ORDER BY stt, id').all(row.id);
  const files = db.prepare(`SELECT id, original_name, mime FROM attachments WHERE owner_type='supplier' AND owner_id=? ORDER BY id`).all(row.id);
  maskMoney(req, quotes, 'unit_price');
  let transactions = db.prepare('SELECT * FROM supplier_transactions WHERE supplier_id=? ORDER BY signed_date DESC').all(row.id);
  if (!senGroups(req).has('org_fee')) transactions = transactions.map((t) => ({ ...t, value: t.value != null ? rbac.MASK : t.value }));
  const dates = decorateDates(db.prepare(`SELECT * FROM important_dates WHERE subject_type='supplier' AND subject_id=? ORDER BY event_date`).all(row.id));
  const contacts = db.prepare('SELECT * FROM supplier_contacts WHERE supplier_id=? ORDER BY id').all(row.id);
  res.json({ record: row, quotes, files, transactions, dates, contacts });
});
const SCONTACT_COLS = ['full_name', 'position', 'phone', 'email', 'role', 'note'];
router.post('/suppliers/:id/contacts', requirePerm('suppliers', 'edit'), (req, res) => {
  const data = pick(req.body, SCONTACT_COLS); data.supplier_id = req.params.id;
  const r = buildInsert('supplier_contacts', data);
  logEdit(req, 'CREATE', 'supplier_contact', r.lastInsertRowid, req.body.full_name);
  res.json({ id: r.lastInsertRowid });
});
router.put('/suppliers/:id/contacts/:cid', requirePerm('suppliers', 'edit'), (req, res) => {
  buildUpdate('supplier_contacts', req.params.cid, pick(req.body, SCONTACT_COLS));
  logEdit(req, 'EDIT', 'supplier_contact', req.params.cid, req.body.full_name);
  res.json({ ok: true });
});
router.delete('/suppliers/:id/contacts/:cid', requirePerm('suppliers', 'edit'), (req, res) => {
  db.prepare('DELETE FROM supplier_contacts WHERE id=? AND supplier_id=?').run(req.params.cid, req.params.id);
  logEdit(req, 'DELETE', 'supplier_contact', req.params.cid);
  res.json({ ok: true });
});
const STX = STRANS_COLS;
router.post('/suppliers/:id/transactions', requirePerm('suppliers', 'edit'), (req, res) => {
  const data = pick(req.body, STX); data.supplier_id = req.params.id;
  const r = buildInsert('supplier_transactions', data);
  logEdit(req, 'CREATE', 'supplier_transaction', r.lastInsertRowid, req.body.contract_no || req.body.purpose);
  res.json({ id: r.lastInsertRowid });
});
router.put('/suppliers/:id/transactions/:tid', requirePerm('suppliers', 'edit'), (req, res) => {
  buildUpdate('supplier_transactions', req.params.tid, pick(req.body, STX));
  logEdit(req, 'EDIT', 'supplier_transaction', req.params.tid, req.body.contract_no || req.body.purpose);
  res.json({ ok: true });
});
router.delete('/suppliers/:id/transactions/:tid', requirePerm('suppliers', 'edit'), (req, res) => {
  db.prepare('DELETE FROM supplier_transactions WHERE id=? AND supplier_id=?').run(req.params.tid, req.params.id);
  res.json({ ok: true });
});
router.post('/suppliers', requirePerm('suppliers', 'create'), (req, res) => {
  const r = buildInsert('suppliers', pick(req.body, SUP_COLS));
  logEdit(req, 'CREATE', 'supplier', r.lastInsertRowid, req.body.name); res.json({ id: r.lastInsertRowid });
});
router.put('/suppliers/:id', requirePerm('suppliers', 'edit'), (req, res) => {
  buildUpdate('suppliers', req.params.id, pick(req.body, SUP_COLS));
  logEdit(req, 'EDIT', 'supplier', req.params.id, req.body.name); res.json({ ok: true });
});
router.delete('/suppliers/:id', requirePerm('suppliers', 'delete'), (req, res) => {
  const atts = db.prepare(`SELECT filename FROM attachments WHERE owner_type='supplier' AND owner_id=?`).all(req.params.id);
  for (const a of atts) { try { fs.unlinkSync(path.join(UPLOAD_DIR, a.filename)); } catch {} }
  db.prepare(`DELETE FROM attachments WHERE owner_type='supplier' AND owner_id=?`).run(req.params.id);
  db.prepare('DELETE FROM suppliers WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'supplier', req.params.id); res.json({ ok: true });
});
router.post('/suppliers/:id/quotes', requirePerm('suppliers', 'edit'), (req, res) => {
  const data = pick(req.body, QUOTE_COLS); data.supplier_id = req.params.id;
  const r = buildInsert('supplier_quotes', data); res.json({ id: r.lastInsertRowid });
});
router.delete('/suppliers/:id/quotes/:qid', requirePerm('suppliers', 'edit'), (req, res) => {
  db.prepare('DELETE FROM supplier_quotes WHERE id=? AND supplier_id=?').run(req.params.qid, req.params.id); res.json({ ok: true });
});
router.post('/suppliers/:id/files', requirePerm('suppliers', 'edit'), upload.array('files', 5), (req, res) => {
  const files = req.files || [];
  const ins = db.prepare(`INSERT INTO attachments (owner_type, owner_id, kind, filename, original_name, mime, is_primary) VALUES ('supplier', ?, 'quote', ?, ?, ?, 0)`);
  for (const f of files) ins.run(req.params.id, f.filename, f.originalname, f.mimetype);
  res.json({ ok: true });
});

// =====================================================================
//  EVENTS (Sự kiện)
// =====================================================================
const EVENT_COLS = ['name', 'source_url', 'mode', 'organizer', 'organizer_org_id', 'field', 'format',
  'start_time', 'end_time', 'location', 'scale_attendees', 'scale_compare', 'guest_levels', 'evaluation',
  'image_links', 'video_links', 'keyvisual_link', 'status', 'note', 'misa_keynotes'];
const EC_COLS = ['category', 'title', 'supplier_id', 'amount', 'sponsor_tier', 'sponsor_benefits',
  'press_org', 'journalist_name', 'article_link', 'note'];

router.get('/events', requirePerm('events', 'view'), (req, res) => {
  const { page, pageSize, offset } = pageParams(req);
  const q = `%${(req.query.search || '').trim()}%`;
  const args = [q, q]; const filters = ['(e.name LIKE ? OR e.organizer LIKE ?)'];
  if (['join', 'host'].includes(req.query.mode)) { filters.push('e.mode=?'); args.push(req.query.mode); }
  if (req.query.field) { filters.push('e.field=?'); args.push(req.query.field); }
  if (req.query.status) { filters.push('e.status=?'); args.push(req.query.status); }
  const where = 'WHERE ' + filters.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) c FROM events e ${where}`).get(...args).c;
  let rows = db.prepare(`SELECT e.*, o.name AS org_name,
      (SELECT COALESCE(SUM(amount),0) FROM event_costs ec WHERE ec.event_id=e.id) AS total_cost
    FROM events e LEFT JOIN organizations o ON o.id=e.organizer_org_id
    ${where} ORDER BY (e.start_time IS NULL), e.start_time DESC LIMIT ? OFFSET ?`).all(...args, pageSize, offset);
  rows = rows.map((r) => ({ ...r, daysToStart: deadlineInfo(r.start_time).days }));
  maskMoney(req, rows, 'total_cost');
  res.json({ rows, total, page, pageSize });
});

router.get('/events/:id', requirePerm('events', 'view'), (req, res) => {
  const row = db.prepare(`SELECT e.*, o.name AS org_name FROM events e LEFT JOIN organizations o ON o.id=e.organizer_org_id WHERE e.id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy' });
  row.daysToStart = deadlineInfo(row.start_time).days;
  const costRows = db.prepare(`SELECT ec.*, s.name AS supplier_name FROM event_costs ec LEFT JOIN suppliers s ON s.id=ec.supplier_id WHERE ec.event_id=? ORDER BY ec.id`).all(row.id);
  const costs = { sponsor: [], organization: [], media: [] };
  const totals = { sponsor: 0, organization: 0, media: 0, grand: 0 };
  for (const c of costRows) { (costs[c.category] || (costs[c.category] = [])).push(c); totals[c.category] = (totals[c.category] || 0) + (c.amount || 0); totals.grand += (c.amount || 0); }
  const attachments = db.prepare(`SELECT id, original_name, mime, kind FROM attachments WHERE owner_type='event' AND owner_id=? ORDER BY id`).all(row.id);
  if (!canMoney(req)) {
    Object.values(costs).forEach((arr) => maskMoney(req, arr, 'amount'));
    ['sponsor', 'organization', 'media', 'grand'].forEach((k) => { totals[k] = rbac.MASK; });
  }
  res.json({ record: row, costs, totals, attachments, caretakers: getCaretakers('event', row.id) });
});

router.post('/events', requirePerm('events', 'create'), (req, res) => {
  const data = pick(req.body, EVENT_COLS); jsonField(data, 'image_links'); jsonField(data, 'video_links');
  data.created_by = req.session.user.id;
  const r = buildInsert('events', data);
  syncAssignments('event', r.lastInsertRowid, req.body.caretaker_ids);
  logEdit(req, 'CREATE', 'event', r.lastInsertRowid, req.body.name); res.json({ id: r.lastInsertRowid });
});
router.put('/events/:id', requirePerm('events', 'edit'), (req, res) => {
  const data = pick(req.body, EVENT_COLS); jsonField(data, 'image_links'); jsonField(data, 'video_links');
  buildUpdate('events', req.params.id, data);
  syncAssignments('event', Number(req.params.id), req.body.caretaker_ids);
  logEdit(req, 'EDIT', 'event', req.params.id, req.body.name); res.json({ ok: true });
});
router.delete('/events/:id', requirePerm('events', 'delete'), (req, res) => {
  const atts = db.prepare(`SELECT filename FROM attachments WHERE owner_type='event' AND owner_id=?`).all(req.params.id);
  for (const a of atts) { try { fs.unlinkSync(path.join(UPLOAD_DIR, a.filename)); } catch {} }
  db.prepare(`DELETE FROM attachments WHERE owner_type='event' AND owner_id=?`).run(req.params.id);
  db.prepare('DELETE FROM events WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'event', req.params.id); res.json({ ok: true });
});
router.post('/events/:id/costs', requirePerm('events', 'edit'), (req, res) => {
  const data = pick(req.body, EC_COLS); data.event_id = req.params.id;
  const r = buildInsert('event_costs', data); res.json({ id: r.lastInsertRowid });
});
router.put('/events/:id/costs/:cid', requirePerm('events', 'edit'), (req, res) => {
  buildUpdate('event_costs', req.params.cid, pick(req.body, EC_COLS)); res.json({ ok: true });
});
router.delete('/events/:id/costs/:cid', requirePerm('events', 'edit'), (req, res) => {
  db.prepare('DELETE FROM event_costs WHERE id=? AND event_id=?').run(req.params.cid, req.params.id); res.json({ ok: true });
});
router.post('/events/:id/files', requirePerm('events', 'edit'), upload.array('files', 10), (req, res) => {
  const kind = (req.query.kind || 'doc').slice(0, 40);
  const ins = db.prepare(`INSERT INTO attachments (owner_type, owner_id, kind, filename, original_name, mime, is_primary) VALUES ('event', ?, ?, ?, ?, ?, 0)`);
  for (const f of (req.files || [])) ins.run(req.params.id, kind, f.filename, f.originalname, f.mimetype);
  res.json({ ok: true });
});
router.post('/events/:id/remind', requirePerm('events', 'view'), (req, res) => {
  const e = db.prepare('SELECT * FROM events WHERE id=?').get(req.params.id);
  if (!e || !e.start_time) return res.status(400).json({ error: 'Sự kiện chưa có ngày bắt đầu.' });
  const lead = Math.max(1, parseInt(req.body && req.body.lead_days) || 7);
  const r = db.prepare(`INSERT INTO important_dates (title, date_type, subject_type, subject_id, subject_name, event_date, recurring, lead_days, note)
    VALUES (?,?,?,?,?,?,0,?,?)`).run(`Sự kiện: ${e.name}`, 'other', 'general', e.id, e.name, String(e.start_time).slice(0, 10), lead, e.location || '');
  res.json({ id: r.lastInsertRowid });
});

// =====================================================================
//  DASHBOARD
// =====================================================================
// Tổng quan cho TRANG BÁO CHÍ: nhân sự quan hệ tốt nhất + tương tác gần đây (lọc theo báo chí)
router.get('/press-overview', requirePerm('partners', 'view'), (req, res) => {
  const topPeople = db.prepare(`SELECT p.id, p.full_name, p.relationship_score, p.status, p.level, p.beat, o.name org_name
    FROM people p JOIN organizations o ON o.id=p.org_id
    WHERE o.org_type='press' ORDER BY p.relationship_score DESC LIMIT 5`).all();
  const recentInteractions = db.prepare(`SELECT i.* FROM interactions i
    WHERE (i.partner_type='org' AND i.partner_id IN (SELECT id FROM organizations WHERE org_type='press'))
       OR (i.partner_type='person' AND i.partner_id IN (
         SELECT p.id FROM people p JOIN organizations o ON o.id=p.org_id WHERE o.org_type='press'))
    ORDER BY i.date DESC LIMIT 6`).all();
  res.json({ topPeople, recentInteractions });
});

router.get('/dashboard', (req, res) => {
  // Mốc thời gian theo giờ Hà Nội (GMT+7) để "trong tháng" đúng với người dùng
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const year = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ym = `${year}-${mm}`;
  const yr = String(year);
  const one = (sql, ...a) => db.prepare(sql).get(...a).c;
  // Phóng viên (báo chí): nhân sự cấp/loại "Phóng viên" thuộc cơ quan báo chí
  const PV = `o.org_type='press' AND (p.level='Phóng viên' OR p.category='Phóng viên')`;

  const overview = {
    press: {
      total: one(`SELECT COUNT(*) c FROM organizations WHERE org_type='press'`),
      reporters: one(`SELECT COUNT(*) c FROM people p JOIN organizations o ON o.id=p.org_id
        WHERE ${PV} AND (p.status IS NULL OR p.status NOT LIKE '%Ngừng%')`),
      vipBdMonth: one(`SELECT COUNT(*) c FROM people WHERE category='VIP' AND dob IS NOT NULL AND strftime('%m', dob)=?`, mm),
      reporterBdMonth: one(`SELECT COUNT(*) c FROM people p JOIN organizations o ON o.id=p.org_id
        WHERE ${PV} AND p.dob IS NOT NULL AND strftime('%m', p.dob)=?`, mm),
      annivMonth: one(`SELECT COUNT(*) c FROM organizations WHERE org_type='press'
        AND founded_date IS NOT NULL AND strftime('%m', founded_date)=?`, mm),
    },
    assoc: {
      total: one(`SELECT COUNT(*) c FROM organizations WHERE org_type='association'`),
      annivMonth: one(`SELECT COUNT(*) c FROM organizations WHERE org_type='association'
        AND founded_date IS NOT NULL AND strftime('%m', founded_date)=?`, mm),
      leaderBdMonth: one(`SELECT COUNT(*) c FROM people p JOIN organizations o ON o.id=p.org_id
        WHERE o.org_type='association' AND p.level='Lãnh đạo' AND p.dob IS NOT NULL AND strftime('%m', p.dob)=?`, mm),
      feeDueMonth: one(`SELECT COUNT(DISTINCT org_id) c FROM association_fees
        WHERE due_date IS NOT NULL AND strftime('%Y-%m', due_date)=? AND status<>'Đã đóng'`, ym),
    },
    events: {
      hostMonth: one(`SELECT COUNT(*) c FROM events WHERE mode='host' AND start_time IS NOT NULL AND strftime('%Y-%m', start_time)=?`, ym),
      sponsorMonth: one(`SELECT COUNT(*) c FROM events WHERE mode='join' AND start_time IS NOT NULL AND strftime('%Y-%m', start_time)=?`, ym),
      keynoteMonth: db.prepare(`SELECT COALESCE(SUM(misa_keynotes),0) c FROM events
        WHERE start_time IS NOT NULL AND strftime('%Y-%m', start_time)=?`).get(ym).c,
    },
  };

  // Biểu đồ: gom theo tháng (mảng 12 phần tử) hoặc theo nhóm phân loại
  const monthly = (rows) => { const a = Array(12).fill(0); rows.forEach((r) => { const m = parseInt(r.m, 10); if (m >= 1 && m <= 12) a[m - 1] = r.c; }); return a; };
  const grouped = (sql, ...a) => db.prepare(sql).all(...a).map((r) => ({ label: r.label, value: r.c }));

  const charts = {
    reportersByBeat: grouped(`SELECT COALESCE(NULLIF(p.beat,''),'Chưa phân loại') label, COUNT(*) c
      FROM people p JOIN organizations o ON o.id=p.org_id WHERE ${PV} GROUP BY label ORDER BY c DESC`),
    reportersMonthly: monthly(db.prepare(`SELECT strftime('%m', publish_date) m, COUNT(DISTINCT subject_id) c
      FROM bookings WHERE subject_type='person' AND publish_date IS NOT NULL AND strftime('%Y', publish_date)=? GROUP BY m`).all(yr)),
    assocByField: grouped(`SELECT COALESCE(NULLIF(field_area,''),'Chưa phân loại') label, COUNT(*) c
      FROM organizations WHERE org_type='association' GROUP BY label ORDER BY c DESC`),
    assocActivityMonthly: monthly(db.prepare(`SELECT m, SUM(c) c FROM (
        SELECT strftime('%m', i.date) m, COUNT(*) c FROM interactions i JOIN organizations o ON o.id=i.partner_id
          WHERE i.partner_type='org' AND o.org_type='association' AND i.date IS NOT NULL AND strftime('%Y', i.date)=? GROUP BY m
        UNION ALL
        SELECT strftime('%m', s.event_date) m, COUNT(*) c FROM sponsorships s JOIN organizations o ON o.id=s.org_id
          WHERE o.org_type='association' AND s.event_date IS NOT NULL AND strftime('%Y', s.event_date)=? GROUP BY m
      ) t GROUP BY m`).all(yr, yr)),
    eventsHostMonthly: monthly(db.prepare(`SELECT strftime('%m', start_time) m, COUNT(*) c FROM events
      WHERE mode='host' AND start_time IS NOT NULL AND strftime('%Y', start_time)=? GROUP BY m`).all(yr)),
    eventsJoinMonthly: monthly(db.prepare(`SELECT strftime('%m', start_time) m, COUNT(*) c FROM events
      WHERE mode='join' AND start_time IS NOT NULL AND strftime('%Y', start_time)=? GROUP BY m`).all(yr)),
  };

  const upcoming = decorateDates(db.prepare('SELECT * FROM important_dates').all())
    .filter((r) => r.daysUntil != null && r.daysUntil >= 0 && r.daysUntil <= 60)
    .sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 6);
  res.json({ overview, charts, upcoming, month: now.getUTCMonth() + 1, year });
});

// =====================================================================
//  ADMIN (Quản trị người dùng + audit log)
// =====================================================================
router.get('/admin/users', requirePerm('admin', 'view'), (req, res) => {
  const rows = db.prepare('SELECT id, username, full_name, role, email, notify_opt_in, sensitive_perms, active, created_at FROM users ORDER BY id').all();
  res.json({ rows, roles: rbac.ROLES, sensitiveGroups: rbac.SENSITIVE_GROUPS });
});
router.post('/admin/users', requirePerm('admin', 'create'), (req, res) => {
  const { username, password, full_name, role, email, sensitive_perms } = req.body || {};
  if (!username || !password || !full_name || !rbac.ROLES[role]) return res.status(400).json({ error: 'Thiếu thông tin hợp lệ' });
  if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) return res.status(409).json({ error: 'Tài khoản đã tồn tại' });
  const sp = Array.isArray(sensitive_perms) ? JSON.stringify(sensitive_perms.filter((g) => rbac.ALL_GROUPS.includes(g))) : null;
  const r = db.prepare('INSERT INTO users (username,password_hash,full_name,role,email,sensitive_perms) VALUES (?,?,?,?,?,?)')
    .run(username, bcrypt.hashSync(String(password), 10), full_name, role, email || null, sp);
  logEdit(req, 'CREATE', 'user', r.lastInsertRowid, username);
  res.json({ id: r.lastInsertRowid });
});
router.put('/admin/users/:id', requirePerm('admin', 'edit'), (req, res) => {
  const { full_name, role, active, password, email, notify_opt_in, sensitive_perms } = req.body || {};
  const fields = [], vals = [];
  if (full_name != null) { fields.push('full_name=?'); vals.push(full_name); }
  if (role && rbac.ROLES[role]) { fields.push('role=?'); vals.push(role); }
  if (email != null) { fields.push('email=?'); vals.push(email || null); }
  if (notify_opt_in != null) { fields.push('notify_opt_in=?'); vals.push(Number(notify_opt_in) ? 1 : 0); }
  if (Array.isArray(sensitive_perms)) { fields.push('sensitive_perms=?'); vals.push(JSON.stringify(sensitive_perms.filter((g) => rbac.ALL_GROUPS.includes(g)))); }
  if (active != null) { fields.push('active=?'); vals.push(Number(active) ? 1 : 0); }
  if (password) { fields.push('password_hash=?'); vals.push(bcrypt.hashSync(String(password), 10)); }
  if (fields.length) { db.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).run(...vals, req.params.id); }
  // nếu sửa chính mình: cập nhật session để tên/quyền mật đổi ngay
  if (Number(req.params.id) === req.session.user.id) {
    const u = db.prepare('SELECT id, username, full_name, role, sensitive_perms FROM users WHERE id=?').get(req.params.id);
    if (u) req.session.user = { id: u.id, username: u.username, full_name: u.full_name, role: u.role, sensitive_perms: u.sensitive_perms };
  }
  logEdit(req, 'EDIT', 'user', req.params.id);
  res.json({ ok: true });
});
router.delete('/admin/users/:id', requirePerm('admin', 'delete'), (req, res) => {
  if (Number(req.params.id) === req.session.user.id) return res.status(400).json({ error: 'Không thể xóa chính mình' });
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'user', req.params.id);
  res.json({ ok: true });
});
router.get('/admin/audit', requirePerm('admin', 'view'), (req, res) => {
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all();
  res.json({ rows });
});

// =====================================================================
//  GIÁM SÁT TRUYỀN THÔNG (Social Listening) — Phase 0+1: Báo chí
// =====================================================================
function jarr(v) { if (Array.isArray(v)) return v; try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch { return []; } }
function periodOf(req) {
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  let from = req.query.from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '')) { const d = new Date(Date.now() + 7 * 3600 * 1000 - 29 * 86400000); from = d.toISOString().slice(0, 10); }
  return { from, to };
}

router.get('/monitor/dashboard', requirePerm('monitoring', 'view'), (req, res) => {
  const { from, to } = periodOf(req);
  const inP = 'published_at>=? AND published_at<=?';
  const c = (sql, ...a) => db.prepare(sql).get(...a).c;
  const counts = {
    total: c(`SELECT COUNT(*) c FROM mentions WHERE ${inP}`, from, to),
    brand: c(`SELECT COUNT(*) c FROM mentions WHERE category='brand' AND ${inP}`, from, to),
    industry: c(`SELECT COUNT(*) c FROM mentions WHERE category='industry' AND ${inP}`, from, to),
    competitor: c(`SELECT COUNT(*) c FROM mentions WHERE category='competitor' AND ${inP}`, from, to),
    newest24h: c(`SELECT COUNT(*) c FROM mentions WHERE created_at>=datetime('now','-1 day')`),
  };
  // sắc thái thương hiệu
  const sent = { positive: 0, neutral: 0, negative: 0 };
  db.prepare(`SELECT sentiment, COUNT(*) c FROM mentions WHERE category='brand' AND sentiment IS NOT NULL AND ${inP} GROUP BY sentiment`)
    .all(from, to).forEach((r) => { sent[r.sentiment] = r.c; });
  const denom = sent.positive + sent.negative;
  const nsr = denom ? +((sent.positive - sent.negative) / denom).toFixed(2) : 0;
  // khủng hoảng: tiêu cực thương hiệu 24h
  const since24 = new Date(Date.now() + 7 * 3600 * 1000 - 86400000).toISOString().slice(0, 10);
  const neg24 = c(`SELECT COUNT(*) c FROM mentions WHERE category='brand' AND sentiment='negative' AND published_at>=?`, since24);
  const crisis = neg24 >= 3;
  // trend 14 ngày: volume thương hiệu + NSR ngày
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() + 7 * 3600 * 1000 - i * 86400000).toISOString().slice(0, 10));
  const byDay = {};
  db.prepare(`SELECT published_at d, sentiment, COUNT(*) c FROM mentions WHERE category='brand' AND published_at>=? GROUP BY published_at, sentiment`)
    .all(days[0]).forEach((r) => { (byDay[r.d] = byDay[r.d] || { p: 0, n: 0, z: 0 }); if (r.sentiment === 'positive') byDay[r.d].p = r.c; else if (r.sentiment === 'negative') byDay[r.d].n = r.c; else byDay[r.d].z = r.c; });
  const trend = days.map((d) => { const x = byDay[d] || { p: 0, n: 0, z: 0 }; const tot = x.p + x.n + x.z; const dn = x.p + x.n; return { date: d, total: tot, nsr: dn ? +((x.p - x.n) / dn).toFixed(2) : 0 }; });
  const alerts = db.prepare(`SELECT * FROM monitor_alerts ORDER BY id DESC LIMIT 10`).all();
  const lastRun = db.prepare(`SELECT * FROM scan_runs ORDER BY id DESC LIMIT 1`).get();
  const sourceCount = c(`SELECT COUNT(*) c FROM sources WHERE enabled=1`);
  res.json({ from, to, counts, sentiment: sent, nsr, crisis, neg24, trend, alerts, lastRun, sourceCount });
});

const MENTION_EDIT = ['status', 'next_action', 'assignee', 'note'];
router.get('/monitor/mentions', requirePerm('monitoring', 'view'), (req, res) => {
  const { page, pageSize, offset } = pageParams(req);
  const dateCol = req.query.date_field === 'created_at' ? 'DATE(created_at)' : 'published_at';
  const filters = [], args = [];
  if (req.query.category) { filters.push('category=?'); args.push(req.query.category); }
  if (req.query.sentiment) { filters.push('sentiment=?'); args.push(req.query.sentiment); }
  if (req.query.status) { filters.push('status=?'); args.push(req.query.status); }
  if (req.query.source_type) { filters.push('source_type=?'); args.push(req.query.source_type); }
  if (req.query.query_id) { filters.push('query_id=?'); args.push(req.query.query_id); }
  if (req.query.keyword) { filters.push('matched_group=?'); args.push(req.query.keyword); }
  if (req.query.from) { filters.push(`${dateCol}>=?`); args.push(req.query.from); }
  if (req.query.to) { filters.push(`${dateCol}<=?`); args.push(req.query.to); }
  if (req.query.tag) { filters.push('tags LIKE ?'); args.push(`%${req.query.tag}%`); }
  if (req.query.search) { filters.push('(title LIKE ? OR source_name LIKE ? OR content LIKE ? OR tags LIKE ?)'); const q = `%${req.query.search}%`; args.push(q, q, q, q); }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) c FROM mentions ${where}`).get(...args).c;
  const rows = db.prepare(`SELECT * FROM mentions ${where} ORDER BY (published_at IS NULL), published_at DESC, id DESC LIMIT ? OFFSET ?`).all(...args, pageSize, offset);
  res.json({ rows, total, page, pageSize, queries: db.prepare('SELECT id, name, category FROM scan_queries ORDER BY name').all() });
});
// Hiệu quả từ khóa: số bài theo từng bộ/nhóm từ khóa đã khớp (để biết từ khóa nào hiệu quả)
router.get('/monitor/keyword-stats', requirePerm('monitoring', 'view'), (req, res) => {
  const dateField = req.query.date_field === 'created_at' ? 'created_at' : 'published_at';
  res.json({ rows: monitor.keywordStats({ from: req.query.from, to: req.query.to, dateField }) });
});
// Xóa nhiều tin khỏi kết quả quét cùng lúc
router.post('/monitor/mentions/bulk-delete', requirePerm('monitoring', 'delete'), (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((x) => parseInt(x, 10)).filter(Number.isInteger) : [];
  if (!ids.length) return res.status(400).json({ error: 'Thiếu danh sách tin cần xóa' });
  const del = db.prepare('DELETE FROM mentions WHERE id=?');
  ids.forEach((id) => del.run(id));
  logEdit(req, 'DELETE', 'mention', null, `xóa ${ids.length} tin`);
  res.json({ ok: true, deleted: ids.length });
});
router.put('/monitor/mentions/:id', requirePerm('monitoring', 'edit'), (req, res) => {
  const cur = db.prepare('SELECT * FROM mentions WHERE id=?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Không tìm thấy' });
  // sửa sắc thái -> ghi audit + đánh dấu human
  if ('sentiment' in req.body && req.body.sentiment !== cur.sentiment) {
    const ns = req.body.sentiment || null;
    const score = ns === 'positive' ? 0.6 : ns === 'negative' ? -0.6 : ns === 'neutral' ? 0 : null;
    db.prepare(`UPDATE mentions SET sentiment=?, sentiment_score=?, sentiment_by='human' WHERE id=?`).run(ns, score, cur.id);
    const u = req.session.user;
    db.prepare(`INSERT INTO sentiment_audit (mention_id, old_sentiment, new_sentiment, user_id, username) VALUES (?,?,?,?,?)`)
      .run(cur.id, cur.sentiment, ns, u.id, u.username);
  }
  if ('tags' in req.body) db.prepare('UPDATE mentions SET tags=? WHERE id=?').run(JSON.stringify(jarr(req.body.tags)), cur.id);
  const data = pick(req.body, MENTION_EDIT);
  if (Object.keys(data).length) buildUpdate('mentions', cur.id, data);
  logEdit(req, 'EDIT', 'mention', cur.id);
  res.json({ ok: true });
});
router.delete('/monitor/mentions/:id', requirePerm('monitoring', 'delete'), (req, res) => {
  db.prepare('DELETE FROM mentions WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'mention', req.params.id);
  res.json({ ok: true });
});

router.post('/monitor/scan', requirePerm('monitoring', 'create'), async (req, res) => {
  const ids = Array.isArray(req.body?.query_ids) ? req.body.query_ids.map(Number).filter(Number.isFinite) : [];
  if (!ids.length) return res.status(400).json({ error: 'Vui lòng chọn ít nhất 1 bộ từ khóa để quét' });
  try {
    const r = await monitor.runScan({ triggeredBy: req.session.user.username, queryIds: ids });
    logEdit(req, 'SCAN', 'monitor', r.runId, `quét ${r.fetched} bài, +${r.new_mentions} mới`);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/monitor/runs', requirePerm('monitoring', 'view'), (req, res) => {
  res.json({ rows: db.prepare('SELECT * FROM scan_runs ORDER BY id DESC LIMIT 50').all() });
});
// AI: Tổng hợp tin hoạt động MISA (tối đa 10 tin ấn tượng) — Gemini grounding
router.get('/monitor/highlights', requirePerm('monitoring', 'view'), async (req, res) => {
  try { res.json(await monitor.aiMisaHighlights()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
// AI: Hoạt động đối thủ + phân tích ảnh hưởng tới MISA
router.get('/monitor/competitor-brief', requirePerm('monitoring', 'view'), async (req, res) => {
  try { res.json(await monitor.aiCompetitorAnalysis()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
// Thiết lập quét (chu kỳ + lookback)
router.get('/monitor/settings', requirePerm('monitoring', 'view'), (req, res) => {
  res.json({
    autoscan: metaGet('autoscan', '0') === '1',
    interval_hours: parseInt(metaGet('autoscan_interval_h', '4'), 10) || 4,
    scan_days: parseInt(metaGet('scan_days', '30'), 10) || 30,
  });
});
router.put('/monitor/settings', requirePerm('monitoring', 'edit'), (req, res) => {
  const b = req.body || {};
  if ('autoscan' in b) metaSet('autoscan', b.autoscan ? '1' : '0');
  if ('interval_hours' in b) metaSet('autoscan_interval_h', String(Math.max(1, Math.min(168, parseInt(b.interval_hours, 10) || 4))));
  if ('scan_days' in b) metaSet('scan_days', String(Math.max(1, Math.min(365, parseInt(b.scan_days, 10) || 30))));
  monitor.applySchedule();
  logEdit(req, 'EDIT', 'monitor_settings', null);
  res.json({ ok: true });
});
router.post('/monitor/alerts/:id/read', requirePerm('monitoring', 'view'), (req, res) => {
  db.prepare(`UPDATE monitor_alerts SET read_at=datetime('now') WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// --- Bộ từ khóa ---
router.get('/monitor/queries', requirePerm('monitoring', 'view'), (req, res) => {
  res.json({ rows: db.prepare('SELECT * FROM scan_queries ORDER BY category, name').all() });
});
router.post('/monitor/queries', requirePerm('monitoring', 'create'), (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Thiếu tên bộ từ khóa' });
  const r = db.prepare(`INSERT INTO scan_queries (name, category, query_type, include, exclude, enabled, grounding) VALUES (?,?,?,?,?,?,?)`)
    .run(b.name, b.category || 'brand', b.query_type || 'news', JSON.stringify(jarr(b.include)), JSON.stringify(jarr(b.exclude)), b.enabled === false ? 0 : 1, b.grounding ? 1 : 0);
  logEdit(req, 'CREATE', 'scan_query', r.lastInsertRowid, b.name);
  res.json({ id: r.lastInsertRowid });
});
router.put('/monitor/queries/:id', requirePerm('monitoring', 'edit'), (req, res) => {
  const b = req.body || {};
  const data = {};
  ['name', 'category', 'query_type'].forEach((k) => { if (k in b) data[k] = b[k]; });
  if ('include' in b) data.include = JSON.stringify(jarr(b.include));
  if ('exclude' in b) data.exclude = JSON.stringify(jarr(b.exclude));
  if ('enabled' in b) data.enabled = b.enabled ? 1 : 0;
  if ('grounding' in b) data.grounding = b.grounding ? 1 : 0;
  if (Object.keys(data).length) buildUpdate('scan_queries', req.params.id, data);
  logEdit(req, 'EDIT', 'scan_query', req.params.id, b.name);
  res.json({ ok: true });
});
router.delete('/monitor/queries/:id', requirePerm('monitoring', 'delete'), (req, res) => {
  db.prepare('DELETE FROM scan_queries WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'scan_query', req.params.id);
  res.json({ ok: true });
});

// --- Nguồn tin ---
router.get('/monitor/sources', requirePerm('monitoring', 'view'), (req, res) => {
  res.json({ rows: db.prepare('SELECT * FROM sources ORDER BY type, name').all() });
});
router.post('/monitor/sources', requirePerm('monitoring', 'create'), async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.url) return res.status(400).json({ error: 'Thiếu tên/URL' });
  // Người dùng chỉ cần dán link website bình thường — tự dò xem có RSS không, nếu không thì quét bằng Google Search (site:)
  let feedUrl = null;
  try { feedUrl = await monitor.detectFeed(b.url); } catch {}
  const mode = feedUrl ? 'rss' : 'site';
  const finalUrl = feedUrl || (/^https?:\/\//i.test(b.url) ? b.url : `https://${b.url}`);
  const r = db.prepare('INSERT INTO sources (name, type, url, enabled, auto, mode) VALUES (?,?,?,?,0,?)').run(b.name, b.type || 'news', finalUrl, b.enabled === false ? 0 : 1, mode);
  logEdit(req, 'CREATE', 'source', r.lastInsertRowid, b.name);
  res.json({ id: r.lastInsertRowid, mode });
});
router.put('/monitor/sources/:id', requirePerm('monitoring', 'edit'), (req, res) => {
  const b = req.body || {}; const data = {};
  ['name', 'type', 'url'].forEach((k) => { if (k in b) data[k] = b[k]; });
  if ('enabled' in b) data.enabled = b.enabled ? 1 : 0;
  if (Object.keys(data).length) buildUpdate('sources', req.params.id, data);
  logEdit(req, 'EDIT', 'source', req.params.id); res.json({ ok: true });
});
router.delete('/monitor/sources/:id', requirePerm('monitoring', 'delete'), (req, res) => {
  db.prepare('DELETE FROM sources WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'source', req.params.id); res.json({ ok: true });
});

// --- Đối thủ ---
router.get('/monitor/competitors', requirePerm('monitoring', 'view'), (req, res) => {
  res.json({ rows: db.prepare('SELECT * FROM competitors ORDER BY name').all() });
});
router.post('/monitor/competitors', requirePerm('monitoring', 'create'), (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Thiếu tên đối thủ' });
  const r = db.prepare('INSERT INTO competitors (name, website, fanpage, channels, note) VALUES (?,?,?,?,?)')
    .run(b.name, b.website || null, b.fanpage || null, JSON.stringify(jarr(b.channels)), b.note || null);
  logEdit(req, 'CREATE', 'competitor', r.lastInsertRowid, b.name);
  res.json({ id: r.lastInsertRowid });
});
router.put('/monitor/competitors/:id', requirePerm('monitoring', 'edit'), (req, res) => {
  const b = req.body || {}; const data = {};
  ['name', 'website', 'fanpage', 'note'].forEach((k) => { if (k in b) data[k] = b[k] || null; });
  if ('channels' in b) data.channels = JSON.stringify(jarr(b.channels));
  if (Object.keys(data).length) buildUpdate('competitors', req.params.id, data);
  logEdit(req, 'EDIT', 'competitor', req.params.id); res.json({ ok: true });
});
router.delete('/monitor/competitors/:id', requirePerm('monitoring', 'delete'), (req, res) => {
  db.prepare('DELETE FROM competitors WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'competitor', req.params.id); res.json({ ok: true });
});

// --- Chiến dịch truyền thông ---
const CAMP_COLS = ['name', 'start_date', 'end_date', 'message', 'content', 'audience', 'status', 'note'];
function campOut(r) {
  return { ...r, keywords: jarr(r.keywords), competitors: jarr(r.competitors) };
}
router.get('/monitor/campaigns', requirePerm('monitoring', 'view'), (req, res) => {
  res.json({ rows: db.prepare('SELECT * FROM campaigns ORDER BY (start_date IS NULL), start_date DESC, id DESC').all().map(campOut) });
});
router.get('/monitor/campaigns/:id', requirePerm('monitoring', 'view'), (req, res) => {
  const r = db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Không tìm thấy' });
  res.json({ record: campOut(r) });
});
router.post('/monitor/campaigns', requirePerm('monitoring', 'create'), (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Thiếu tên chiến dịch' });
  const data = pick(b, CAMP_COLS);
  data.keywords = JSON.stringify(jarr(b.keywords));
  data.competitors = JSON.stringify(Array.isArray(b.competitors) ? b.competitors : []);
  data.created_by = req.session.user.id;
  const r = buildInsert('campaigns', data);
  logEdit(req, 'CREATE', 'campaign', r.lastInsertRowid, b.name);
  res.json({ id: r.lastInsertRowid });
});
router.put('/monitor/campaigns/:id', requirePerm('monitoring', 'edit'), (req, res) => {
  const b = req.body || {};
  const data = pick(b, CAMP_COLS);
  if ('keywords' in b) data.keywords = JSON.stringify(jarr(b.keywords));
  if ('competitors' in b) data.competitors = JSON.stringify(Array.isArray(b.competitors) ? b.competitors : []);
  if (Object.keys(data).length) buildUpdate('campaigns', req.params.id, data);
  logEdit(req, 'EDIT', 'campaign', req.params.id, b.name);
  res.json({ ok: true });
});
router.delete('/monitor/campaigns/:id', requirePerm('monitoring', 'delete'), (req, res) => {
  db.prepare('DELETE FROM campaigns WHERE id=?').run(req.params.id);
  logEdit(req, 'DELETE', 'campaign', req.params.id); res.json({ ok: true });
});
// Tổng hợp kết quả chiến dịch: mention khớp từ khóa trong khoảng thời gian + breakdown + đối thủ
router.get('/monitor/campaigns/:id/results', requirePerm('monitoring', 'view'), (req, res) => {
  const cp = db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id);
  if (!cp) return res.status(404).json({ error: 'Không tìm thấy' });
  const kws = jarr(cp.keywords);
  const comps = jarr(cp.competitors);
  const from = req.query.from || cp.start_date || '0000-01-01';
  const to = req.query.to || cp.end_date || '9999-12-31';
  const rows = db.prepare(`SELECT * FROM mentions WHERE published_at>=? AND published_at<=?`).all(from, to);
  const inc = kws.map((k) => [k]);
  const hit = kws.length ? rows.filter((m) => monitor.matchTerms(`${m.title} ${m.content} ${m.source_name}`, inc, [])) : [];
  const bd = { positive: 0, neutral: 0, negative: 0, none: 0 };
  const bySource = {};
  hit.forEach((m) => { bd[m.sentiment || 'none']++; bySource[m.source_type || 'khác'] = (bySource[m.source_type || 'khác'] || 0) + 1; });
  const denom = bd.positive + bd.negative;
  const nsr = denom ? +((bd.positive - bd.negative) / denom).toFixed(2) : 0;
  // đối thủ trong chiến dịch: tin nhắc TÊN đối thủ KÈM từ khóa chiến dịch (lọc trong 'hit')
  const compRes = comps.map((c) => {
    const name = typeof c === 'string' ? c : (c && c.name) || '';
    if (!name) return null;
    const n = hit.filter((m) => monitor.matchTerms(`${m.title} ${m.content} ${m.source_name}`, [[name]], [])).length;
    return { name, mentions: n };
  }).filter(Boolean);
  // timeline theo ngày
  const byDay = {};
  hit.forEach((m) => { const d = m.published_at || '—'; byDay[d] = (byDay[d] || 0) + 1; });
  const timeline = Object.entries(byDay).sort().map(([date, total]) => ({ date, total }));
  res.json({
    campaign: campOut(cp), from, to,
    total: hit.length, sentiment: bd, nsr, bySource, competitors: compRes, timeline,
    sample: hit.slice(0, 30).map((m) => ({ id: m.id, title: m.title, link: m.link, source_name: m.source_name, source_type: m.source_type, sentiment: m.sentiment, published_at: m.published_at })),
  });
});
// AI đánh giá hiệu quả chiến dịch (dựa số liệu + grounding)
router.get('/monitor/campaigns/:id/evaluate', requirePerm('monitoring', 'view'), async (req, res) => {
  const cp = db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id);
  if (!cp) return res.status(404).json({ error: 'Không tìm thấy' });
  try { res.json(await monitor.evaluateCampaign(campOut(cp))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
