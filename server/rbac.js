'use strict';
/**
 * RBAC + bảo mật trường dữ liệu nhạy cảm.
 *
 * Mô hình: Vai trò (role) -> tập quyền (permissions) trên từng module + cờ
 * "xem dữ liệu mật" (canSeeSensitive). Trường mật được khai báo theo từng
 * entity ở SENSITIVE_FIELDS; hàm maskRecord() sẽ che giá trị nếu user không
 * đủ quyền.
 */

// Các vai trò trong hệ thống
const ROLES = {
  super_admin: 'Quản lý phòng',
  pr_staff: 'Chuyên viên PR',
};

// Hành động chuẩn
const ACT = { VIEW: 'view', CREATE: 'create', EDIT: 'edit', DELETE: 'delete' };

// Module nghiệp vụ (gọn lại theo mô hình Cơ quan -> Nhân sự)
//  partners = cơ quan + nhân sự (CRM đối ngoại)
const MODULES = ['partners', 'awards', 'events', 'suppliers', 'reminders', 'interactions', 'monitoring', 'reports', 'admin', 'dashboard'];

/**
 * Ma trận quyền. Mỗi vai trò khai báo quyền theo module.
 * Giá trị là mảng hành động được phép. 'admin' = quản trị người dùng/hệ thống.
 */
const MATRIX = {
  super_admin: {
    partners: ['view', 'create', 'edit', 'delete'],
    awards: ['view', 'create', 'edit', 'delete'],
    events: ['view', 'create', 'edit', 'delete'],
    suppliers: ['view', 'create', 'edit', 'delete'],
    reminders: ['view', 'create', 'edit', 'delete', 'ack', 'run'],
    interactions: ['view', 'create', 'edit', 'delete'],
    monitoring: ['view', 'create', 'edit', 'delete', 'ack'],
    reports: ['view'],
    admin: ['view', 'create', 'edit', 'delete'],
    dashboard: ['view'],
    canSeeSensitive: true,
  },
  // Chuyên viên PR: được TẠO/SỬA/XÓA dữ liệu nghiệp vụ (để nhập liệu);
  // nhưng phần dữ liệu MẬT/CHI PHÍ chỉ XEM được nếu Quản lý phòng cho phép
  // (sensitive_perms theo từng người). Không vào Báo cáo & Quản trị.
  pr_staff: {
    partners: ['view', 'create', 'edit', 'delete'],
    awards: ['view', 'create', 'edit', 'delete'],
    events: ['view', 'create', 'edit', 'delete'],
    suppliers: ['view', 'create', 'edit', 'delete'],
    reminders: ['view', 'create', 'edit', 'delete', 'ack', 'run'],
    interactions: ['view', 'create', 'edit', 'delete'],
    monitoring: ['view', 'create', 'edit', 'delete', 'ack'],
    reports: [], // báo cáo tổng hợp chỉ Quản lý phòng
    admin: [],
    dashboard: ['view'],
    canSeeSensitive: false,
  },
};

/**
 * Khai báo trường mật theo entity. Các trường này bị che (●●●) với user
 * không có canSeeSensitive; việc xem giá trị thật được ghi audit log.
 */
/**
 * Nhóm dữ liệu mật — quản trị viên tick chọn cho từng người dùng được xem nhóm nào.
 * Mỗi nhóm khai báo các trường thuộc nhóm theo entity.
 */
const SENSITIVE_GROUPS = {
  contact: { label: 'SĐT cá nhân / khác / OTT', fields: { person: ['phone_personal', 'phone_other', 'phone_ott'] } },
  private: { label: 'Đời tư (ngày sinh, địa chỉ, tính cách, sở thích, người thân, quan điểm…)', fields: { person: ['dob', 'home_address', 'personal_notes', 'personality', 'hobbies', 'food_habits', 'family_info', 'media_stance', 'relationship_network', 'meeting_places', 'gift_rules'] } },
  social: { label: 'Mạng xã hội', fields: { person: ['social_facebook', 'social_instagram', 'social_tiktok', 'social_x', 'social_thread'] } },
  finance: { label: 'Tài khoản ngân hàng', fields: { person: ['bank_account_number', 'bank_name'] } },
  iddoc: { label: 'Giấy tờ tùy thân (CCCD/hộ chiếu)', fields: {} }, // theo file đính kèm
  org_fee: { label: 'Chi phí & Ngân sách (hội phí, tài trợ, booking, sự kiện, giải thưởng, báo giá NCC, quà tặng)', fields: { organization: ['membership_fee'], sponsorship: ['amount'], gift: ['value'] } },
};
const ALL_GROUPS = Object.keys(SENSITIVE_GROUPS);

// Danh sách trường mật theo entity (suy ra từ nhóm)
const SENSITIVE_FIELDS = (() => {
  const out = {};
  for (const def of Object.values(SENSITIVE_GROUPS)) {
    for (const [entity, fields] of Object.entries(def.fields)) {
      out[entity] = (out[entity] || []).concat(fields);
    }
  }
  return out;
})();

// Trường -> nhóm (theo entity)
function fieldGroup(entity, field) {
  for (const [g, def] of Object.entries(SENSITIVE_GROUPS)) {
    if ((def.fields[entity] || []).includes(field)) return g;
  }
  return null;
}

const MASK = '●●● (đã ẩn)';

// Tập nhóm mật mà 1 user được xem. sensitive_perms (JSON) override; null = mặc định theo vai trò.
function allowedGroups(user) {
  let perms = null;
  try { perms = user && user.sensitive_perms ? JSON.parse(user.sensitive_perms) : null; } catch {}
  if (Array.isArray(perms)) return new Set(perms.filter((g) => ALL_GROUPS.includes(g)));
  // fallback: vai trò có canSeeSensitive => xem tất cả, ngược lại không xem gì
  return new Set(user && MATRIX[user.role] && MATRIX[user.role].canSeeSensitive ? ALL_GROUPS : []);
}
function canSeeGroup(user, group) { return allowedGroups(user).has(group); }

function can(role, module, action) {
  const r = MATRIX[role];
  if (!r) return false;
  const perms = r[module];
  return Array.isArray(perms) && perms.includes(action);
}

function canSeeSensitive(role) {
  return !!(MATRIX[role] && MATRIX[role].canSeeSensitive);
}

/**
 * Trả về bản ghi đã che trường mật nếu cần.
 * @param {string} entity - khóa trong SENSITIVE_FIELDS
 * @param {object} record
 * @param {boolean} allowed - user có được xem dữ liệu mật không
 * @returns {object} { record, maskedFields: [...] }
 */
/**
 * Che trường mật theo nhóm user được phép xem.
 * @param {string} entity
 * @param {object} record
 * @param {Set<string>|true} allowed - tập nhóm được xem, hoặc true = xem tất cả
 */
function maskRecord(entity, record, allowed) {
  const fields = SENSITIVE_FIELDS[entity] || [];
  if (allowed === true || fields.length === 0 || !record) return { record, maskedFields: [] };
  const set = allowed instanceof Set ? allowed : new Set();
  const clone = { ...record };
  const maskedFields = [];
  for (const f of fields) {
    const g = fieldGroup(entity, f);
    const ok = g && set.has(g);
    if (!ok && f in clone && clone[f] !== null && clone[f] !== '' && clone[f] !== undefined) {
      clone[f] = MASK;
      maskedFields.push(f);
    }
  }
  return { record: clone, maskedFields };
}

function maskList(entity, records, allowed) {
  return records.map((r) => maskRecord(entity, r, allowed).record);
}

// Tóm tắt quyền gửi cho frontend để dựng menu + biết các nhóm mật được xem
function permissionSummary(user) {
  const role = typeof user === 'string' ? user : (user && user.role);
  const r = MATRIX[role] || {};
  const groups = [...allowedGroups(typeof user === 'string' ? { role } : user)];
  const out = {
    role, roleName: ROLES[role] || role,
    canSeeSensitive: groups.length === ALL_GROUPS.length,
    sensitiveGroups: groups, modules: {},
  };
  for (const m of MODULES) out.modules[m] = Array.isArray(r[m]) ? r[m] : [];
  return out;
}

module.exports = {
  ROLES, ACT, MODULES, MATRIX, SENSITIVE_FIELDS, SENSITIVE_GROUPS, ALL_GROUPS, MASK,
  can, canSeeSensitive, canSeeGroup, allowedGroups, fieldGroup, maskRecord, maskList, permissionSummary,
};
