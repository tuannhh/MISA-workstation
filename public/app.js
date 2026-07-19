'use strict';
const MASK = '●●● (đã ẩn)';
let state = { user: null, perms: null };

// ---------------- API ----------------
async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { showLogin(); throw new Error('Chưa đăng nhập'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Lỗi máy chủ');
  return data;
}
// Upload nhiều file qua FormData (không set Content-Type để browser tự thêm boundary)
async function apiUpload(path, fileList) {
  const fd = new FormData();
  for (const f of fileList) fd.append('files', f);
  const res = await fetch('/api' + path, { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Lỗi tải lên');
  return data;
}

// ---------------- helpers ----------------
const $ = (s, r = document) => r.querySelector(s);
const el = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function val(v) {
  if (v === MASK) return `<span class="mask">${MASK}</span>`;
  return esc(v == null || v === '' ? '—' : v).replace(/\r?\n/g, '<br>');
}
function money(v) {
  if (v === MASK) return `<span class="mask">${MASK}</span>`;
  if (v == null || v === '') return '—';
  return Number(v).toLocaleString('vi-VN') + ' đ';
}
function valDate(v) { // ngày, tôn trọng masking
  if (v === MASK) return `<span class="mask">${MASK}</span>`;
  return v == null || v === '' ? '—' : esc(fmtDate(v));
}
function parseJSON(v, fb) { if (v == null || v === MASK || v === '') return fb; try { return JSON.parse(v); } catch { return fb; } }
// danh sách user để gán "người chăm sóc" (cache 1 lần/phiên)
let _assignableUsers = null;
async function getAssignableUsers() {
  if (!_assignableUsers) { try { _assignableUsers = (await api('GET', '/assignable-users')).rows; } catch { _assignableUsers = []; } }
  return _assignableUsers;
}
function caretakerField(r) {
  return { k: 'caretaker_ids', l: '👥 Nhân sự chăm sóc (chọn nhiều)', type: 'checks', opts: (_assignableUsers || []).map((u) => [u.id, u.full_name]), v: (r._caretakers || []).map(String), full: true };
}
function caretakerChips(list) {
  return (list && list.length) ? list.map((c) => `<span class="chip">${esc(c.full_name)}</span>`).join(' ') : '<span class="muted-sm">Chưa phân công người chăm sóc</span>';
}
// ---- thời gian: hiển thị theo GMT+7 (Hà Nội) ----
const TZ = 'Asia/Ho_Chi_Minh';
function fmtDate(s) { // 'YYYY-MM-DD' -> 'dd-mm-yyyy' (ngày thuần, không lệch TZ)
  if (!s) return '—';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
}
function fmtDateTime(s) { // datetime UTC của SQLite/ISO -> 'dd-mm-yyyy hh:mm' giờ Hà Nội
  if (!s) return '—';
  let iso = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(iso)) iso = iso.replace(' ', 'T') + 'Z'; // SQLite datetime('now') là UTC
  const d = new Date(iso);
  if (isNaN(d)) return s;
  const p = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const g = (t) => (p.find((x) => x.type === t) || {}).value || '';
  return `${g('day')}-${g('month')}-${g('year')} ${g('hour')}:${g('minute')}`;
}
function todayGMT7() { return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10); }
function parseViNumber(value) {
  const normalized = String(value == null ? '' : value).replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}
function formatViNumber(value) {
  const number = parseViNumber(value);
  return number == null ? '' : number.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}
window.addEventListener('beforeunload', (event) => {
  if (!document.querySelector('.modal[data-dirty="true"]')) return;
  event.preventDefault();
  event.returnValue = '';
});
function normalizeMisaLabels(root = document) {
  root.querySelectorAll?.('#view h1, #view h2, #view h3, #view h4, #view .grp-head, #view button').forEach((node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const cleaned = child.textContent.replace(/\p{Extended_Pictographic}|\uFE0F/gu, '').replace(/^\s+/, '');
        // Ch\u1EC9 xo\u00E1 emoji khi v\u1EABn c\u00F2n ch\u1EEF; tr\u00E1nh bi\u1EBFn n\u00FAt/ti\u00EAu \u0111\u1EC1 ch\u1EC9 c\u00F3 emoji th\u00E0nh r\u1ED7ng
        if (cleaned !== child.textContent && (cleaned.trim() !== '' || node.childElementCount > 0)) child.textContent = cleaned;
      }
    }
  });
}
const misaLabelObserver = new MutationObserver(() => normalizeMisaLabels());
if ($('#view')) misaLabelObserver.observe($('#view'), { childList: true, subtree: true });
function toast(msg, isErr) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (isErr ? ' err' : '');
  setTimeout(() => (t.className = 'toast'), 5000);
}
function can(mod, act) { return state.perms && (state.perms.modules[mod] || []).includes(act); }
function statusBadge(s) {
  const m = { 'Thân thiết': 'b-green', 'Đang hợp tác': 'b-blue', 'Cần kết nối': 'b-amber', 'Ngừng hợp tác': 'b-gray' };
  return `<span class="badge ${m[s] || 'b-gray'}">${esc(s || '—')}</span>`;
}
function resultBadge(s) {
  const m = { 'Tích cực': 'b-green', 'Trung lập': 'b-gray', 'Cần theo dõi': 'b-amber' };
  return `<span class="badge ${m[s] || 'b-gray'}">${esc(s || '—')}</span>`;
}
function tierBadge(t) {
  const c = t === 'Trọng điểm' ? 'b-red' : t === 'Quan trọng' ? 'b-amber' : 'b-gray';
  return `<span class="badge ${c}">${esc(t || '—')}</span>`;
}
function scoreBar(n) {
  n = Number(n) || 0;
  const c = n >= 75 ? 'var(--green)' : n >= 50 ? 'var(--amber)' : 'var(--red)';
  return `<span class="score"><span class="bar"><i style="width:${n}%;background:${c}"></i></span>${n}</span>`;
}
function avatarCell(photoId, name) {
  const initial = esc((name || '?').trim().slice(0, 1).toUpperCase());
  return photoId
    ? `<img class="avatar-sm" src="/api/files/${photoId}" alt="" />`
    : `<span class="avatar-sm letter">${initial}</span>`;
}

// ---------------- tiền (định dạng gọn) + biểu đồ SVG thuần ----------------
function fmtMoney(v) {
  v = Number(v) || 0;
  if (v >= 1e9) return (v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tỷ';
  if (v >= 1e6) return (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr';
  return v.toLocaleString('vi-VN') + ' đ';
}
const CHART_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

function svgBar(items, { money = false } = {}) {
  if (!items.length) return '<div class="empty">Không có dữ liệu</div>';
  const max = Math.max(...items.map((i) => i.value), 1);
  return `<div class="hbars">${items.map((it, i) => {
    const w = Math.max(2, (it.value / max) * 100);
    const c = it.color || CHART_COLORS[i % CHART_COLORS.length];
    return `<div class="hbar-row">
      <div class="hbar-label" title="${esc(it.label)}">${esc(it.label)}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${w}%;background:${c}"></div></div>
      <div class="hbar-val">${money ? fmtMoney(it.value) : it.value}</div>
    </div>`;
  }).join('')}</div>`;
}

function svgDonut(items) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return '<div class="empty">Không có dữ liệu</div>';
  let acc = 0; const R = 16, C = 2 * Math.PI * R;
  const segs = items.map((it, i) => {
    const frac = it.value / total, len = frac * C, off = acc * C; acc += frac;
    const c = it.color || CHART_COLORS[i % CHART_COLORS.length];
    return `<circle r="${R}" cx="21" cy="21" fill="transparent" stroke="${c}" stroke-width="8"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 21 21)"></circle>`;
  }).join('');
  const legend = items.map((it, i) => `<div class="lg-item"><span class="lg-dot" style="background:${it.color || CHART_COLORS[i % CHART_COLORS.length]}"></span>${esc(it.label)} <b>${it.value}</b></div>`).join('');
  return `<div class="donut-wrap"><svg viewBox="0 0 42 42" class="chart-donut">${segs}
    <text x="21" y="22.5" text-anchor="middle" class="cd-total">${total}</text></svg><div class="donut-legend">${legend}</div></div>`;
}

function svgLine(items, { money = false } = {}) {
  if (items.length < 1) return '<div class="empty">Không có dữ liệu</div>';
  const max = Math.max(...items.map((i) => i.value), 1);
  const n = items.length, W = 620, H = 200, padX = 36, padTop = 30, padBot = 26;
  const x = (i) => n === 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (n - 1);
  const y = (v) => H - padBot - (v / max) * (H - padTop - padBot);
  const pts = items.map((it, i) => `${x(i)},${y(it.value)}`).join(' ');
  const area = `${x(0)},${H - padBot} ${pts} ${x(n - 1)},${H - padBot}`;
  // tỷ lệ cố định + xMidYMid meet => không méo, dot tròn, chữ rõ
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="chart-line">
    <polygon points="${area}" fill="#2563eb1f"></polygon>
    <polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round"></polyline>
    ${items.map((it, i) => `<circle cx="${x(i)}" cy="${y(it.value)}" r="3.6" fill="#2563eb"></circle>
      <text x="${x(i)}" y="${y(it.value) - 9}" text-anchor="middle" class="cl-val">${money ? fmtMoney(it.value) : it.value}</text>
      <text x="${x(i)}" y="${H - 7}" text-anchor="middle" class="cl-lab">${esc(it.label)}</text>`).join('')}
  </svg>`;
}

// ---------------- option lists ----------------
const OPT = {
  pressTypes: ['Báo điện tử', 'Báo in', 'Tạp chí', 'Truyền hình', 'Phát thanh'],
  tier: ['Trọng điểm', 'Quan trọng', 'Thường'],
  level: ['Lãnh đạo', 'Quản lý', 'Phóng viên', 'Chuyên viên', 'Nhân viên', 'Khác'],
  jStatus: ['Thân thiết', 'Đang hợp tác', 'Cần kết nối', 'Ngừng hợp tác'],
  category: ['Phóng viên', 'VIP', 'Đối tác', 'Khác'],
  channel: ['Gặp mặt', 'Điện thoại', 'Email', 'Sự kiện', 'Khác'],
  result: ['Tích cực', 'Trung lập', 'Cần theo dõi'],
  sponsorType: ['Tài trợ', 'Giải thưởng', 'Hoạt động'],
  ott: [['zalo', 'Zalo'], ['whatsapp', 'WhatsApp'], ['viber', 'Viber'], ['telegram', 'Telegram']],
  partnerType: [['person', 'Nhân sự'], ['org', 'Cơ quan']],
  dateType: [['birthday', 'Sinh nhật'], ['founding', 'Ngày thành lập'], ['anniversary', 'Kỷ niệm ngành'], ['other', 'Khác']],
  recurring: [[1, 'Hằng năm'], [0, 'Một lần']],
  bookingType: ['Bài viết', 'Lên tin', 'Phóng sự', 'Bài PR', 'Khác'],
  bookingStatus: ['Đã đặt', 'Đã đăng', 'Đã nghiệm thu', 'Hủy'],
  awardStatus: ['Sắp mở', 'Đang nhận hồ sơ', 'Đã đóng'],
  organizerType: [['gov', 'Bộ/Ban/Ngành'], ['association', 'Hiệp hội/Hội'], ['other', 'Tổ chức khác']],
  scope: ['Trong nước', 'Quốc tế'],
  reviewStatus: ['Thô', 'Đã duyệt', 'Chuẩn hóa'],
  partStatus: ['Đang cân nhắc', 'Quyết định tham gia', 'Đã nộp', 'Đạt giải', 'Trượt', 'Không tham gia'],
  eventMode: [['join', 'MISA tham gia'], ['host', 'MISA tổ chức']],
  eventField: ['Công nghệ', 'Tài chính - Thuế', 'Quản trị', 'An ninh mạng', 'Khác'],
  eventFormat: ['Offline', 'Online', 'Hybrid'],
  eventStatus: ['Sắp diễn ra', 'Đang diễn ra', 'Đã kết thúc'],
  sponsorTier: ['Kim cương', 'Vàng', 'Bạc', 'Đồng', 'Đồng hành', 'Khác'],
  invoiceType: ['VAT', 'Trực tiếp 0%'],
  eventDocKind: ['Hợp đồng', 'Biên bản nghiệm thu', 'Hóa đơn', 'Agenda', 'Checklist', 'Danh sách phóng viên', 'Dự toán', 'Kế hoạch truyền thông', 'Bài diễn giả', 'Tổng quan sự kiện', 'Hợp đồng diễn giả', 'Khác'],
  // Đối tác bộ ngành (gov)
  adminLevel: ['Trung ương', 'Địa phương'],
  agencyBlock: ['Đảng', 'Chính phủ', 'Thuế', 'Tài chính', 'CNTT', 'Tư pháp', 'Khác'],
  workCategory: ['Tiếp đón đoàn', 'Làm việc tại cơ quan', 'Công văn phối hợp', 'Đối ngoại'],
  workStatus: ['Đang xử lý', 'Hoàn thành', 'Theo dõi'],
  // Hiệp hội
  assocField: ['Công nghệ', 'Kế toán', 'Nhân sự', 'Tài chính', 'Thương mại', 'Marketing', 'Khác'],
  giftType: ['Hoa', 'Quà', 'Tiền mặt'],
  supplierIndustry: ['Tổ chức sự kiện', 'In ấn', 'Quà tặng', 'Truyền thông', 'Thiết kế', 'Âm thanh ánh sáng', 'Nhân sự thời vụ', 'Khác'],
  supplierRemindKind: ['Hạn thanh toán', 'Hạn báo giá', 'Hạn hợp đồng', 'Hạn thi công', 'Hạn nghiệm thu', 'Hạn mua sắm'],
  transStatus: ['Chưa thực hiện', 'Đang thực hiện', 'Đã hoàn thành'],
};
const COST_CAT = { sponsor: 'Tài trợ', organization: 'Tổ chức', media: 'Truyền thông' };
const ORG_TYPE = {
  press: { label: 'Cơ quan báo chí', ic: '' },
  association: { label: 'Hiệp hội', ic: '' },
  gov: { label: 'Đối tác bộ ngành', ic: '' },
  other: { label: 'Khác', ic: '' },
};
const POLITICAL_RANK_DESC = {
  C1: 'C1 — Báo Đảng / Cơ quan Trung ương',
  C2: 'C2 — Báo thuộc Bộ / Ban / Ngành',
  C3: 'C3 — Tạp chí chuyên ngành / trang tin tổ chức, hiệp hội',
};
const LEVEL_ORDER = ['Lãnh đạo', 'Quản lý', 'Phóng viên', 'Chuyên viên', 'Nhân viên', 'Khác'];
const DATE_TYPE_LABEL = { birthday: 'Sinh nhật', founding: 'Ngày thành lập', anniversary: 'Kỷ niệm ngành', other: 'Khác' };

// ---------------- NAV ----------------
const NAV = [
  { key: 'dashboard', mod: null, ic: 'layout-dashboard', label: 'Tổng quan' },
  { group: 'Quan hệ đối tác' },
  { key: 'press', mod: 'partners', type: 'press', ic: 'news', label: 'Cơ quan báo chí' },
  { key: 'association', mod: 'partners', type: 'association', ic: 'building-community', label: 'Hiệp hội' },
  { key: 'gov', mod: 'partners', type: 'gov', ic: 'building-estate', label: 'Đối tác bộ ngành' },
  { key: 'other', mod: 'partners', type: 'other', ic: 'building', label: 'Khác' },
  { key: 'people', mod: 'partners', ic: 'address-book', label: 'Danh bạ nhân sự' },
  { group: 'Theo dõi' },
  { key: 'events', mod: 'events', ic: 'calendar-event', label: 'Sự kiện' },
  { key: 'awards', mod: 'awards', ic: 'trophy', label: 'Giải thưởng' },
  { key: 'suppliers', mod: 'suppliers', ic: 'building-factory', label: 'Nhà cung cấp' },
  { key: 'interactions', mod: 'interactions', ic: 'messages', label: 'Lịch sử tương tác' },
  { key: 'monitor', mod: 'monitoring', ic: 'radar', label: 'Giám sát truyền thông' },
  { key: 'reminders', mod: 'reminders', ic: 'calendar-clock', label: 'Lịch nhắc' },
  { key: 'reports', mod: 'reports', ic: 'chart-bar', label: 'Báo cáo' },
  { group: 'Hệ thống' },
  { key: 'admin', mod: 'admin', ic: 'shield-cog', label: 'Quản trị' },
];
function buildNav() {
  const nav = $('#nav'); nav.innerHTML = '';
  for (const item of NAV) {
    if (item.group) { nav.appendChild(el(`<div class="group">${item.group}</div>`)); continue; }
    if (item.mod && !can(item.mod, 'view')) continue;
    nav.appendChild(el(`<a href="#${item.key}" data-key="${item.key}"><m-icon class="ic" name="${item.ic}" size="20"></m-icon>${item.label}</a>`));
  }
}
function setActive(key) {
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.key === key));
}

// ---------------- ROUTER ----------------
const VIEWS = {};
async function route() {
  const key = (location.hash.replace('#', '') || 'dashboard');
  const base = key.split('/')[0];
  const navItem = NAV.find((n) => n.key === base);
  if (navItem && navItem.mod && !can(navItem.mod, 'view')) return (location.hash = 'dashboard');
  setActive(base);
  const fn = VIEWS[base] || VIEWS.dashboard;
  $('#view').innerHTML = '<div class="empty">Đang tải…</div>';
  try { await fn(key); } catch (e) { $('#view').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
window.addEventListener('hashchange', route);

// ---------------- generic LIST view ----------------
function pageState() { return { page: 1, search: '', total: 0, pageSize: 20 }; }
function renderTable({ head, title, desc, mod, ps, onSearch, rowsHtml, sensitiveNote, addLabel }) {
  const canCreate = can(mod, 'create');
  $('#crumb').textContent = title;
  const html = `
    <div class="page-head">
      <div><h2>${title}</h2><div class="desc">${desc || ''}</div></div>
      ${canCreate ? `<button class="btn primary" id="addBtn">+ ${addLabel || 'Thêm mới'}</button>` : ''}
    </div>
    ${sensitiveNote || ''}
    <div class="toolbar">
      <input type="search" id="search" placeholder="🔎 Tìm kiếm…" value="${esc(ps.search)}" />
    </div>
    <div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody id="tbody">${rowsHtml}</tbody></table></div>
    <div class="pager">
      <span id="pageInfo"></span>
      <span class="pg-btns"><button class="btn sm" id="prev">‹ Trước</button><button class="btn sm" id="next">Sau ›</button></span>
    </div>`;
  $('#view').innerHTML = html;
  let timer;
  $('#search').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { ps.search = e.target.value; ps.page = 1; onSearch(); }, 300); });
  $('#prev').onclick = () => { if (ps.page > 1) { ps.page--; onSearch(); } };
  $('#next').onclick = () => { if (ps.page * ps.pageSize < ps.total) { ps.page++; onSearch(); } };
  const from = ps.total ? (ps.page - 1) * ps.pageSize + 1 : 0;
  const to = Math.min(ps.page * ps.pageSize, ps.total);
  $('#pageInfo').textContent = `Hiển thị ${from}–${to} / ${ps.total} bản ghi`;
}
function sensitiveBanner(visible) {
  if (visible) return '';
  return `<div class="banner lock">🔒 <div>Bạn không có quyền xem <b>dữ liệu mật</b> (SĐT cá nhân, đời tư, mạng xã hội, tài khoản ngân hàng, giấy tờ tùy thân, hội phí…). Các trường này hiển thị dạng <span class="mask">${MASK}</span>. Liên hệ Trưởng phòng PR nếu cần truy cập.</div></div>`;
}

// ==================== BIỂU ĐỒ TRANG TỔNG QUAN (tái dùng svgDonut/svgLine) ====================
const MONTH_LABELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
// mảng 12 số -> items cho biểu đồ đường theo tháng
const monthlyItems = (arr) => MONTH_LABELS.map((l, i) => ({ label: l, value: (arr && arr[i]) || 0 }));
const chartBox = (title, body) => `<div class="chart-box"><h4 class="chart-title">${title}</h4>${body}</div>`;

// ==================== DASHBOARD (Trang tổng quan) ====================
VIEWS.dashboard = async () => {
  $('#crumb').textContent = 'Tổng quan';
  const d = await api('GET', '/dashboard');
  const o = d.overview, ch = d.charts, M = `tháng ${d.month}`;
  // Thẻ số liệu: bấm được -> mở trang theo dõi tương ứng
  const stat = (v, l, go) => `<div class="stat${go ? ' stat-go' : ''}"${go ? ` data-go="${go}"` : ''}>
    <div class="v">${v}</div><div class="l">${l}</div></div>`;
  const statNA = (l) => `<div class="stat stat-na"><div class="v">—</div><div class="l">${l}</div>
    <div class="stat-hint">Theo quét tin (anh V.Anh)</div></div>`;
  const grp = (icon, title, cards) => `<div class="grp-block"><div class="grp-head">${icon} ${title}</div><div class="cards">${cards}</div></div>`;

  const pressCards = [
    stat(o.press.total, 'Tổng số tòa soạn', 'press'),
    stat(o.press.reporters, 'Phóng viên đang làm việc', 'people'),
    stat(o.press.vipBdMonth, `VIP sinh nhật ${M}`, 'reminders'),
    stat(o.press.reporterBdMonth, `Phóng viên sinh nhật ${M}`, 'reminders'),
    stat(o.press.annivMonth, `Tòa soạn kỷ niệm thành lập ${M}`, 'reminders'),
  ].join('');
  const assocCards = [
    stat(o.assoc.total, 'Tổng số Hiệp hội/Hội', 'association'),
    stat(o.assoc.annivMonth, `Đơn vị có ngày kỷ niệm ${M}`, 'reminders'),
    stat(o.assoc.leaderBdMonth, `Lãnh đạo hiệp hội sinh nhật ${M}`, 'reminders'),
    stat(o.assoc.feeDueMonth, `Hiệp hội đến kỳ đóng phí ${M}`, 'association'),
  ].join('');
  const eventCards = [
    stat(o.events.hostMonth, `Sự kiện MISA tổ chức ${M}`, 'events'),
    stat(o.events.sponsorMonth, `Sự kiện MISA tham gia/tài trợ ${M}`, 'events'),
    stat(o.events.keynoteMonth, `Bài keynote lãnh đạo MISA ${M}`, 'events'),
    statNA('Sự kiện cấp quốc gia (công nghệ)'),
    statNA('Sự kiện cấp Bộ/Ban/Ngành (công nghệ)'),
  ].join('');

  const upcomingHtml = d.upcoming.length
    ? d.upcoming.map((r) => reminderItem(r)).join('')
    : '<div class="empty">Không có sự kiện trong 60 ngày tới</div>';

  $('#view').innerHTML = `
    <div class="page-head"><div><h2>Xin chào, ${esc(state.user.full_name)} 👋</h2>
      <div class="desc">Tổng quan quan hệ đối ngoại truyền thông · số liệu tính cho ${M}/${d.year}.</div></div></div>

    ${grp('📰', 'Quan hệ cơ quan báo chí', pressCards)}
    ${grp('🏛️', 'Quan hệ Hiệp hội / Hội', assocCards)}
    ${grp('🎪', 'Các sự kiện của công ty', eventCards)}

    <div class="panel"><h3>📊 Biểu đồ thống kê &amp; cảnh báo</h3>
      <div class="chart-sub">Quan hệ cơ quan báo chí</div>
      <div class="chart-grid">
        ${chartBox('Phóng viên phân loại theo mảng', svgDonut(ch.reportersByBeat))}
        ${chartBox(`Số phóng viên đưa tin về MISA theo tháng (${d.year})`, svgLine(monthlyItems(ch.reportersMonthly)))}
      </div>
      <div class="chart-sub">Quan hệ Hiệp hội / Hội</div>
      <div class="chart-grid">
        ${chartBox('Phân bổ theo lĩnh vực hoạt động', svgDonut(ch.assocByField))}
        ${chartBox(`Tần suất MISA hợp tác/tham gia/tài trợ theo tháng (${d.year})`, svgLine(monthlyItems(ch.assocActivityMonthly)))}
      </div>
      <div class="chart-sub">Hoạt động sự kiện</div>
      <div class="chart-grid">
        ${chartBox(`Sự kiện do MISA tổ chức theo tháng (${d.year})`, svgLine(monthlyItems(ch.eventsHostMonthly)))}
        ${chartBox(`Sự kiện MISA tham gia/tài trợ theo tháng (${d.year})`, svgLine(monthlyItems(ch.eventsJoinMonthly)))}
      </div>
      <div class="chart-sub">Tin bài <span class="muted-sm">· sẽ tích hợp khi có dữ liệu quét tin (anh V.Anh)</span></div>
      <div class="chart-grid">
        ${chartBox('Thị phần thảo luận về MISA (báo chí, Facebook, LinkedIn, TikTok…)', '<div class="empty">Chưa tích hợp nguồn quét tin</div>')}
        ${chartBox('Cảnh báo khẩn cấp (Ủng hộ · Trung lập · Rủi ro cao)', '<div class="empty">Chưa tích hợp nguồn quét tin</div>')}
      </div>
    </div>

    <div class="panel"><h3>🔔 Sự kiện sắp tới</h3>${upcomingHtml}
      <div style="margin-top:10px"><a href="#reminders" class="btn sm">Xem tất cả →</a></div>
    </div>`;
  $('#view').querySelectorAll('[data-go]').forEach((r) => r.onclick = () => (location.hash = r.dataset.go));
};

// ==================== GIÁM SÁT TRUYỀN THÔNG (Social Listening) ====================
const psMonitor = { tab: 'dashboard', days: 30, mentions: pageState(), mf: {}, from: '', to: '', dateField: 'published_at', selected: new Set(), scanQuerySel: null };
const psCamp = { view: 'list', id: null };
const SENT_DEF = { positive: ['Tích cực', 'b-green'], neutral: ['Trung tính', 'b-gray'], negative: ['Tiêu cực', 'b-red'] };
const sentBadge = (s) => { const x = SENT_DEF[s]; return x ? `<span class="badge ${x[1]}">${x[0]}</span>` : '<span class="badge b-amber">Chưa chấm</span>'; };
const CAT_DEF = { brand: ['Thương hiệu', 'b-red'], industry: ['Tin ngành', 'b-blue'], competitor: ['Đối thủ', 'b-amber'] };
const catBadge = (c) => { const x = CAT_DEF[c]; return x ? `<span class="badge ${x[1]}">${x[0]}</span>` : '—'; };
const SRC_LBL = { news: 'Báo chí', facebook: 'Facebook', tiktok: 'TikTok', linkedin: 'LinkedIn', instagram: 'Instagram', youtube: 'YouTube', web: 'Web/Search', website: 'Website' };
const MON_STATUS = ['Mới', 'Đang xử lý', 'Đã duyệt', 'Bỏ qua'];
const dayAgo = (n) => new Date(Date.now() + 7 * 3600 * 1000 - (n - 1) * 86400000).toISOString().slice(0, 10);

VIEWS.monitor = async () => {
  $('#crumb').textContent = 'Giám sát truyền thông';
  const tabs = [['dashboard', '📊 Dashboard'], ['mentions', '📰 Tin bài'], ['campaigns', '🎯 Chiến dịch'], ['config', '⚙️ Cấu hình'], ['runs', '🕘 Lịch sử quét']];
  $('#view').innerHTML = `
    <div class="page-head"><div><h2>📡 Giám sát truyền thông</h2>
      <div class="desc">Social listening: quét báo chí VN theo từ khóa, chấm sắc thái (NSR) &amp; cảnh báo khủng hoảng. <i>Phần mạng xã hội sẽ bổ sung sau.</i></div></div>
      ${can('monitoring', 'create') ? `<button class="btn primary" id="scanNow">🔍 Quét ngay</button>` : ''}</div>
    <div class="rview-tabs">${tabs.map(([k, t]) => `<button class="btn sm ${psMonitor.tab === k ? 'primary' : ''}" data-mtab="${k}">${t}</button>`).join('')}</div>
    <div id="monBody"><div class="empty">Đang tải…</div></div>`;
  $('#view').querySelectorAll('[data-mtab]').forEach((b) => b.onclick = () => { psMonitor.tab = b.dataset.mtab; psCamp.view = 'list'; VIEWS.monitor(); });
  if ($('#scanNow')) $('#scanNow').onclick = doScan;
  const fn = { dashboard: monDashboard, mentions: monMentions, campaigns: monCampaigns, config: monConfig, runs: monRuns }[psMonitor.tab] || monDashboard;
  try { await fn(); } catch (e) { $('#monBody').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
};

async function doScan() {
  let queries;
  try { queries = (await api('GET', '/monitor/queries')).rows.filter((r) => r.enabled); } catch (e) { toast(e.message, true); return; }
  if (!queries.length) { toast('Chưa có bộ từ khóa nào đang Bật. Vào tab Cấu hình để thêm.', true); return; }
  const defSel = (psMonitor.scanQuerySel || []).filter((id) => queries.some((q) => String(q.id) === id));
  openForm({
    title: '🔍 Chọn bộ từ khóa để quét', mod: 'monitoring',
    note: 'Chỉ quét các bộ từ khóa được chọn — nhanh hơn và tiết kiệm chi phí AI so với quét toàn bộ.',
    fields: [
      { k: 'query_ids', l: 'Bộ từ khóa', type: 'checks', full: true,
        opts: queries.map((q) => [String(q.id), `${q.name}${q.grounding ? ' 🔎 AI' : ''}`]),
        v: defSel.length ? defSel : queries.map((q) => String(q.id)) },
    ],
    save: async (data) => {
      const ids = (data.query_ids || []).map(Number).filter(Boolean);
      if (!ids.length) { toast('Vui lòng chọn ít nhất 1 bộ từ khóa', true); throw new Error('Chưa chọn bộ từ khóa'); }
      psMonitor.scanQuerySel = data.query_ids;
      runScanNow(ids);
    },
  });
}
async function runScanNow(ids) {
  const btn = $('#scanNow'); if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang quét…'; }
  try { const r = await api('POST', '/monitor/scan', { query_ids: ids }); toast(`Quét xong: +${r.new_mentions} tin mới (đã chấm ${r.analyzed}).`); VIEWS.monitor(); }
  catch (e) { toast(e.message, true); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '🔍 Quét ngay'; } }
}

async function monDashboard() {
  const qs = psMonitor.from && psMonitor.to ? `from=${psMonitor.from}&to=${psMonitor.to}` : `from=${dayAgo(psMonitor.days)}`;
  const d = await api('GET', `/monitor/dashboard?${qs}`);
  const s = d.sentiment, tot = s.positive + s.neutral + s.negative;
  const custom = !!(psMonitor.from && psMonitor.to);
  const rangeBtn = (dd, t) => `<button class="btn sm ${!custom && psMonitor.days === dd ? 'primary' : ''}" data-mrange="${dd}">${t}</button>`;
  const periodBar = `<div class="rng-custom" style="margin-bottom:14px;flex-wrap:wrap">
      <span class="muted-sm">Kỳ báo cáo:</span>${rangeBtn(7, '7 ngày')}${rangeBtn(30, '30 ngày')}${rangeBtn(90, '90 ngày')}
      <input type="date" id="mFrom" value="${esc(psMonitor.from || '')}" /><span class="muted-sm">→</span><input type="date" id="mTo" value="${esc(psMonitor.to || '')}" />
      <button class="btn sm ${custom ? 'primary' : ''}" id="mApply">Áp dụng</button>
      <span class="muted-sm" style="margin-left:auto">Đang xem: ${fmtDate(d.from)} → ${fmtDate(d.to)}</span></div>`;
  const banner = d.crisis
    ? `<div class="mon-banner crisis"><div><b>⚠️ CẢNH BÁO KHỦNG HOẢNG</b><div class="muted-sm">Phát hiện ${d.neg24} bài tiêu cực về MISA trong 24h qua — cần xử lý ngay.</div></div><span class="badge b-red">RỦI RO CAO</span></div>`
    : `<div class="mon-banner safe"><div><b>✅ THƯƠNG HIỆU BÌNH THƯỜNG — KHÔNG CÓ KHỦNG HOẢNG</b><div class="muted-sm">Không phát hiện bài tiêu cực bất thường về MISA trong 24h qua.</div></div><span class="badge b-green">AN TOÀN</span></div>`;
  const card = (v, l, sub, cls) => `<div class="stat ${cls || ''}"><div class="v">${v}</div><div class="l">${esc(l)}</div>${sub ? `<div class="muted-sm">${sub}</div>` : ''}</div>`;
  const sentBar = svgBar([
    { label: 'Tích cực', value: s.positive, color: '#1a8a52' },
    { label: 'Tiêu cực', value: s.negative, color: '#C8102E' },
    { label: 'Trung tính', value: s.neutral, color: '#9ca3af' },
  ]);
  const volItems = d.trend.map((t) => ({ label: t.date.slice(5), value: t.total }));
  const view = can('monitoring', 'view');
  $('#monBody').innerHTML = `
    ${periodBar}
    ${banner}
    <div class="two-col">
      <div class="panel"><h3>🌟 Tổng hợp hoạt động MISA ${view ? `<button class="btn sm" id="hlBtn" style="float:right">Tạo (AI)</button>` : ''}</h3>
        <div id="hlBody"><div class="muted-sm">Tối đa 10 tin/hoạt động ấn tượng nhất của MISA (AI quét Google, có trích nguồn).</div></div></div>
      <div class="panel"><h3>🏁 Hoạt động đối thủ &amp; ảnh hưởng ${view ? `<button class="btn sm" id="cbBtn" style="float:right">Tạo (AI)</button>` : ''}</h3>
        <div id="cbBody"><div class="muted-sm">AI tổng hợp hoạt động đối thủ (theo đối thủ + từ khóa đã khai báo) và phân tích ảnh hưởng tới MISA.</div></div></div>
    </div>
    <div class="cards">
      ${card(d.counts.total, 'Tổng bài quét', `${d.sourceCount} nguồn · ↑ ${d.counts.newest24h} bài mới (24h)`)}
      ${card(d.counts.brand, 'Đề cập MISA', 'Thương hiệu / Sản phẩm')}
      ${card(d.neg24, 'Crisis Alert', 'Bài tiêu cực về MISA (24h)', d.crisis ? 'stat-crisis' : '')}
      ${card(d.counts.industry, 'Tin ngành liên quan', 'HĐĐT · Hộ KD · CĐS')}
      ${card(d.counts.competitor, 'Đề cập đối thủ', 'Trong kỳ')}
    </div>
    <div class="two-col">
      <div class="panel"><h3>📊 Phân tích cảm xúc (Sentiment) — đề cập MISA</h3>
        ${tot ? sentBar : '<div class="empty">Chưa có dữ liệu sắc thái (cần quét có khóa Gemini hoặc chấm tay)</div>'}
        <div class="nsr-box"><div class="nsr-v ${d.nsr > 0 ? 'pos' : d.nsr < 0 ? 'neg' : ''}">${d.nsr > 0 ? '+' : ''}${d.nsr.toFixed(2)}</div>
          <div><b>Chỉ số cảm xúc (NSR)</b><div class="muted-sm">NSR = (Tích cực − Tiêu cực) / (Tích cực + Tiêu cực) = (${s.positive}−${s.negative})/(${s.positive}+${s.negative})</div></div></div>
      </div>
      <div class="panel"><h3>📈 Lượng đề cập MISA theo ngày (14 ngày)</h3>${svgLine(volItems)}</div>
    </div>
    <div class="panel"><h3>🚨 Cảnh báo gần đây</h3>
      ${d.alerts.length ? d.alerts.map((a) => `<div class="sub-list"><div class="item"><span class="badge ${a.level === 'critical' ? 'b-red' : a.level === 'warning' ? 'b-amber' : 'b-blue'}">${esc(a.level)}</span> <b>${esc(a.title)}</b><br><span class="muted-sm">${esc(a.detail || '')} · ${fmtDateTime(a.created_at)}</span></div></div>`).join('') : '<div class="empty">Chưa có cảnh báo</div>'}
    </div>
    ${d.lastRun ? `<div class="muted-sm">Lần quét gần nhất: ${fmtDateTime(d.lastRun.started_at)} · ${d.lastRun.fetched || 0} bài, +${d.lastRun.new_mentions || 0} mới, chấm ${d.lastRun.analyzed || 0} · ${esc(d.lastRun.status)}</div>` : ''}`;
  $('#monBody').querySelectorAll('[data-mrange]').forEach((b) => b.onclick = () => { psMonitor.days = +b.dataset.mrange; psMonitor.from = ''; psMonitor.to = ''; monDashboard(); });
  if ($('#mApply')) $('#mApply').onclick = () => { const f = $('#mFrom').value, t = $('#mTo').value; if (!f || !t) { toast('Chọn cả 2 mốc ngày', true); return; } if (f > t) { toast('Ngày bắt đầu phải trước', true); return; } psMonitor.from = f; psMonitor.to = t; monDashboard(); };
  if ($('#hlBtn')) $('#hlBtn').onclick = () => aiPanel('#hlBtn', '#hlBody', '/monitor/highlights');
  if ($('#cbBtn')) $('#cbBtn').onclick = () => aiPanel('#cbBtn', '#cbBody', '/monitor/competitor-brief');
}

// Hiển thị kết quả 1 lệnh AI grounding vào panel
async function aiPanel(btnSel, bodySel, url) {
  const btn = $(btnSel), body = $(bodySel), old = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳…'; }
  body.innerHTML = '<div class="empty">⏳ AI đang quét Google &amp; tổng hợp…</div>';
  try {
    const d = await api('GET', url);
    const text = esc(d.text || '').replace(/\n/g, '<br>');
    const src = (d.sources || []).map((s, i) => `<div class="muted-sm">${i + 1}. <a href="${esc(s.uri)}" target="_blank" rel="noopener">${esc(s.title || s.uri)}</a></div>`).join('');
    body.innerHTML = `<div class="brief-text">${text || 'Không có nội dung.'}</div>${src ? `<h4 class="sub-h">Nguồn</h4>${src}` : ''}`;
  } catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  finally { if (btn) { btn.disabled = false; btn.textContent = old || 'Tạo lại'; } }
}

async function monMentions() {
  const mf = psMonitor.mf, ps = psMonitor.mentions;
  const qs = new URLSearchParams({ page: ps.page, search: ps.search || '', date_field: psMonitor.dateField });
  ['category', 'sentiment', 'status', 'source_type', 'query_id', 'keyword'].forEach((k) => { if (mf[k]) qs.set(k, mf[k]); });
  if (mf.from) qs.set('from', mf.from);
  if (mf.to) qs.set('to', mf.to);
  const kwQs = new URLSearchParams({ date_field: psMonitor.dateField });
  if (mf.from) kwQs.set('from', mf.from);
  if (mf.to) kwQs.set('to', mf.to);
  const [d, kw] = await Promise.all([
    api('GET', `/monitor/mentions?${qs.toString()}`),
    api('GET', `/monitor/keyword-stats?${kwQs.toString()}`).catch(() => ({ rows: [] })),
  ]);
  ps.total = d.total;
  psMonitor.selected.clear();
  const canDel = can('monitoring', 'delete');
  const sel = (id, ph, opts, cur) => `<select id="${id}" class="filter-sel"><option value="">${ph}</option>${opts.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${cur === String(v) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select>`;

  // ---- Hiệu quả từ khóa: bài quét được theo từng nhóm từ khóa, bấm để lọc bảng ----
  const kwRows = (kw.rows || []).filter((r) => r.c > 0).slice(0, 20);
  const kwPanel = `<div class="panel" style="margin-bottom:14px">
    <h3>🔑 Hiệu quả từ khóa <span class="muted-sm">(số bài quét được theo từng nhóm — bấm để xem danh sách bài, kèm link nguồn)</span></h3>
    <div class="kw-stats">
      ${kwRows.length ? kwRows.map((r) => `<button class="kw-chip ${mf.query_id === String(r.query_id || '') && (mf.keyword || '') === (r.matched_group || '') ? 'active' : ''}" data-kw-q="${r.query_id || ''}" data-kw-g="${esc(r.matched_group || '')}">${esc(r.query_name || 'Khác (Google Search)')}${r.matched_group ? ': ' + esc(r.matched_group) : ''} <b>${r.c}</b></button>`).join('')
        : '<span class="muted-sm">Chưa có dữ liệu — bấm "Quét ngay" để bắt đầu</span>'}
      ${(mf.query_id || mf.keyword) ? `<button class="btn sm" id="kwClear">✕ Bỏ lọc từ khóa</button>` : ''}
    </div>
  </div>`;

  // ---- Lọc theo khoảng thời gian: đăng bài / quét ----
  const dateBar = `<div class="rng-custom" style="margin-bottom:10px">
    <span class="muted-sm">Lọc theo:</span>
    <select id="mDateField">
      <option value="published_at" ${psMonitor.dateField === 'published_at' ? 'selected' : ''}>Ngày đăng bài</option>
      <option value="created_at" ${psMonitor.dateField === 'created_at' ? 'selected' : ''}>Ngày quét (crawl)</option>
    </select>
    <input type="date" id="mFrom2" value="${esc(mf.from || '')}" /><span class="muted-sm">→</span><input type="date" id="mTo2" value="${esc(mf.to || '')}" />
    <button class="btn sm" id="mApply2">Áp dụng</button>
    ${(mf.from || mf.to) ? `<button class="btn sm" id="mClearDate">✕ Bỏ lọc ngày</button>` : ''}
  </div>`;

  const bulkBar = canDel ? `<div class="rng-custom" id="mBulkBar" style="display:none;margin-bottom:10px">
    <span class="muted-sm"><b id="mSelCount">0</b> tin đã chọn</span>
    <button class="btn sm danger" id="mBulkDel">🗑 Xóa khỏi kết quả quét</button>
  </div>` : '';

  const rows = d.rows.map((m) => `<tr data-id="${m.id}">
      ${canDel ? `<td><input type="checkbox" class="mchk" data-id="${m.id}"/></td>` : ''}
      <td class="wrap-col">
        ${m.link ? `<a href="${esc(m.link)}" target="_blank" rel="noopener"><b>${esc(m.title || '—')}</b></a>` : `<b>${esc(m.title || '—')}</b>`}
        <div class="muted-sm">${esc(m.source_name || '—')} · ${valDate(m.published_at)}${m.matched_group ? ' · 🔑 ' + esc(m.matched_group) : ''}</div>
        ${m.ai_summary ? `<div class="muted-sm">${esc(m.ai_summary)}</div>` : ''}
        ${(parseJSON(m.tags, []) || []).map((t) => `<span class="chip">${esc(t)}</span>`).join(' ')}
      </td>
      <td>${esc(SRC_LBL[m.source_type] || m.source_type || '—')}<br>${catBadge(m.category)}</td>
      <td>${sentBadge(m.sentiment)}</td>
      <td><span class="badge b-gray">${esc(m.status)}</span>${m.assignee ? `<div class="muted-sm">${esc(m.assignee)}</div>` : ''}
        ${can('monitoring', 'edit') ? `<div><button class="btn sm" data-medit="${m.id}">✎ Cập nhật</button></div>` : ''}</td>
    </tr>`).join('') || `<tr><td colspan="${canDel ? 5 : 4}" class="empty">Chưa có tin. Bấm "Quét ngay" để lấy tin báo chí.</td></tr>`;
  $('#monBody').innerHTML = `
    ${kwPanel}
    ${dateBar}
    ${bulkBar}
    <div class="toolbar" style="flex-wrap:wrap;gap:8px">
      <input type="search" id="mSearch" placeholder="🔎 Tìm tiêu đề/nguồn/nội dung…" value="${esc(ps.search)}" />
      ${sel('mCat', 'Mọi phân loại', [['brand', 'Thương hiệu'], ['industry', 'Tin ngành'], ['competitor', 'Đối thủ']], mf.category || '')}
      ${sel('mSent', 'Mọi sắc thái', [['positive', 'Tích cực'], ['neutral', 'Trung tính'], ['negative', 'Tiêu cực']], mf.sentiment || '')}
      ${sel('mStatus', 'Mọi trạng thái', MON_STATUS, mf.status || '')}
    </div>
    <div class="table-wrap no-row-click"><table><thead><tr>${canDel ? '<th></th>' : ''}<th>Tiêu đề / Tóm tắt</th><th>Nguồn</th><th>Sắc thái</th><th>Trạng thái</th></tr></thead><tbody id="mtbody">${rows}</tbody></table></div>
    <div class="pager"><span id="mPageInfo"></span><span class="pg-btns"><button class="btn sm" id="mPrev">‹ Trước</button><button class="btn sm" id="mNext">Sau ›</button></span></div>`;
  let timer;
  $('#mSearch').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { ps.search = e.target.value; ps.page = 1; monMentions(); }, 300); });
  $('#mCat').onchange = (e) => { mf.category = e.target.value; ps.page = 1; monMentions(); };
  $('#mSent').onchange = (e) => { mf.sentiment = e.target.value; ps.page = 1; monMentions(); };
  $('#mStatus').onchange = (e) => { mf.status = e.target.value; ps.page = 1; monMentions(); };
  $('#mPrev').onclick = () => { if (ps.page > 1) { ps.page--; monMentions(); } };
  $('#mNext').onclick = () => { if (ps.page * ps.pageSize < ps.total) { ps.page++; monMentions(); } };
  const from = ps.total ? (ps.page - 1) * ps.pageSize + 1 : 0, to = Math.min(ps.page * ps.pageSize, ps.total);
  $('#mPageInfo').textContent = `Hiển thị ${from}–${to} / ${ps.total} tin`;
  $('#monBody').querySelectorAll('[data-medit]').forEach((b) => b.onclick = () => mentionForm(d.rows.find((x) => String(x.id) === b.dataset.medit)));
  $('#mApply2').onclick = () => { mf.from = $('#mFrom2').value; mf.to = $('#mTo2').value; ps.page = 1; monMentions(); };
  $('#mDateField').onchange = (e) => { psMonitor.dateField = e.target.value; ps.page = 1; monMentions(); };
  if ($('#mClearDate')) $('#mClearDate').onclick = () => { mf.from = ''; mf.to = ''; ps.page = 1; monMentions(); };
  if ($('#kwClear')) $('#kwClear').onclick = () => { delete mf.query_id; delete mf.keyword; ps.page = 1; monMentions(); };
  $('#monBody').querySelectorAll('[data-kw-q]').forEach((b) => b.onclick = () => {
    mf.query_id = b.dataset.kwQ || ''; mf.keyword = b.dataset.kwG || '';
    if (!mf.query_id) delete mf.query_id; if (!mf.keyword) delete mf.keyword;
    ps.page = 1; monMentions();
  });
  if (canDel) {
    const updateBulkBar = () => { const n = psMonitor.selected.size; $('#mBulkBar').style.display = n ? '' : 'none'; $('#mSelCount').textContent = n; };
    $('#monBody').querySelectorAll('.mchk').forEach((c) => c.onchange = (e) => {
      const id = +e.target.dataset.id;
      if (e.target.checked) psMonitor.selected.add(id); else psMonitor.selected.delete(id);
      updateBulkBar();
    });
    $('#mBulkDel').onclick = async () => {
      if (!confirm(`Xóa ${psMonitor.selected.size} tin đã chọn khỏi kết quả quét?`)) return;
      try { await api('POST', '/monitor/mentions/bulk-delete', { ids: [...psMonitor.selected] }); toast('Đã xóa'); monMentions(); }
      catch (e) { toast(e.message, true); }
    };
  }
}

function mentionForm(m) {
  if (!m) return;
  openForm({
    title: 'Cập nhật tin', mod: 'monitoring', note: `${m.source_name || ''} — ${m.title || ''}`,
    fields: [
      { k: 'sentiment', l: 'Sắc thái (sửa nếu AI chấm sai)', type: 'select', opts: [['', 'Chưa chấm'], ['positive', 'Tích cực'], ['neutral', 'Trung tính'], ['negative', 'Tiêu cực']], v: m.sentiment || '' },
      { k: 'status', l: 'Tình trạng xử lý', type: 'select', opts: MON_STATUS, v: m.status || 'Mới' },
      { k: 'next_action', l: 'Trạng thái làm việc tiếp theo', full: true, v: m.next_action },
      { k: 'assignee', l: 'Nhân sự phụ trách', v: m.assignee },
      { k: 'tags', l: 'Tag (phẩy ngăn cách)', full: true, v: (parseJSON(m.tags, []) || []).join(', ') },
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: m.note },
    ],
    save: async (data) => {
      data.tags = String(data.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
      await api('PUT', `/monitor/mentions/${m.id}`, data);
      monMentions();
    },
  });
}

async function monConfig() {
  const [q, c, s, st] = await Promise.all([api('GET', '/monitor/queries'), api('GET', '/monitor/competitors'), api('GET', '/monitor/sources'), api('GET', '/monitor/settings').catch(() => ({}))]);
  const grp = (inc) => (parseJSON(inc, []) || []).map((g) => g.join(' + ')).join('  ·  ');
  const ed = can('monitoring', 'edit'), del = can('monitoring', 'delete');
  const settingsPanel = `<div class="panel"><h3>⏱️ Thiết lập quét</h3>
      <div class="form-grid">
        <div class="field"><label>Tự động quét định kỳ</label>
          <select id="setAuto"><option value="0" ${st.autoscan ? '' : 'selected'}>Tắt (quét thủ công)</option><option value="1" ${st.autoscan ? 'selected' : ''}>Bật</option></select></div>
        <div class="field"><label>Chu kỳ quét (giờ)</label><input type="number" id="setInterval" min="1" max="168" value="${st.interval_hours || 4}" /></div>
        <div class="field"><label>Khoảng thời gian lấy tin (ngày gần nhất)</label><input type="number" id="setDays" min="1" max="365" value="${st.scan_days || 30}" /></div>
        <div class="field" style="align-self:end">${ed ? `<button class="btn primary" id="setSave">Lưu thiết lập</button>` : ''}</div>
      </div>
      <div class="muted-sm">Bật tự động quét sẽ tốn phí Gemini (chấm sắc thái + grounding). "Khoảng thời gian lấy tin" áp dụng cho Google News &amp; grounding.</div>
    </div>`;
  const qRows = q.rows.map((r) => `<tr>
      <td><b>${esc(r.name)}</b>${r.grounding ? ' <span class="badge b-blue" title="Quét mở rộng Google Search (AI)">🔎 AI</span>' : ''}</td><td>${catBadge(r.category)}</td>
      <td>${esc(grp(r.include)) || '—'}</td><td>${(parseJSON(r.exclude, []) || []).join(', ') || '—'}</td>
      <td><span class="badge ${r.enabled ? 'b-green' : 'b-gray'}">${r.enabled ? 'Bật' : 'Tắt'}</span></td>
      <td>${ed ? `<button class="btn sm" data-qedit="${r.id}">Sửa</button>` : ''} ${del ? `<button class="btn sm danger" data-qdel="${r.id}">✕</button>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="empty">Chưa có bộ từ khóa</td></tr>';
  const cRows = c.rows.map((r) => `<tr>
      <td><b>${esc(r.name)}</b></td><td>${r.website ? `<a href="${esc(r.website)}" target="_blank" rel="noopener">web</a>` : '—'}</td>
      <td>${esc(r.fanpage || '—')}</td><td>${(parseJSON(r.channels, []) || []).join(', ') || '—'}</td>
      <td>${ed ? `<button class="btn sm" data-cedit="${r.id}">Sửa</button>` : ''} ${del ? `<button class="btn sm danger" data-cdel="${r.id}">✕</button>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty">Chưa có đối thủ</td></tr>';
  const sRows = s.rows.map((r) => `<tr>
      <td><b>${esc(r.name)}</b></td>
      <td>${r.mode === 'site' ? '<span class="badge b-blue" title="Không có RSS — quét bằng Google Search giới hạn site: này">🔎 Website (AI)</span>' : '<span class="badge b-gray">RSS</span>'}</td>
      <td class="muted-sm" style="max-width:340px;overflow:hidden;text-overflow:ellipsis">${esc(r.url || '')}</td>
      <td><span class="badge ${r.enabled ? 'b-green' : 'b-gray'}">${r.enabled ? 'Bật' : 'Tắt'}</span></td>
      <td>${del ? `<button class="btn sm danger" data-sdel="${r.id}">✕</button>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty">Chưa có nguồn</td></tr>';
  $('#monBody').innerHTML = `
    ${settingsPanel}
    <div class="panel"><h3>🔑 Bộ từ khóa quét ${can('monitoring', 'create') ? `<button class="btn sm" id="addQuery" style="float:right">+ Thêm bộ từ khóa</button>` : ''}</h3>
      <div class="muted-sm" style="margin-bottom:8px">Mỗi dòng "Từ khóa" là một nhóm <b>AND</b> (nối bằng dấu <b>+</b>); nhiều dòng = <b>OR</b>. Ví dụ: <code>MISA + hóa đơn điện tử</code></div>
      <div class="table-wrap"><table><thead><tr><th>Tên</th><th>Phân loại</th><th>Từ khóa (OR các nhóm AND)</th><th>Loại trừ</th><th>TT</th><th></th></tr></thead><tbody>${qRows}</tbody></table></div>
    </div>
    <div class="panel"><h3>🏢 Đối thủ cạnh tranh ${can('monitoring', 'create') ? `<button class="btn sm" id="addComp" style="float:right">+ Thêm đối thủ</button>` : ''}</h3>
      <div class="table-wrap"><table><thead><tr><th>Tên</th><th>Website</th><th>Fanpage</th><th>Kênh vệ tinh</th><th></th></tr></thead><tbody>${cRows}</tbody></table></div>
    </div>
    <div class="panel"><h3>📰 Nguồn báo chí ${can('monitoring', 'create') ? `<button class="btn sm" id="addSrc" style="float:right">+ Thêm nguồn</button>` : ''}</h3>
      <div class="muted-sm" style="margin-bottom:8px">Chỉ cần dán link trang báo/chuyên mục — hệ thống tự dò RSS; nếu không có RSS sẽ tự chuyển sang quét bằng Google Search (giới hạn đúng trang đó).</div>
      <div class="table-wrap"><table><thead><tr><th>Tên</th><th>Cách quét</th><th>URL</th><th>TT</th><th></th></tr></thead><tbody>${sRows}</tbody></table></div>
    </div>`;
  if ($('#setSave')) $('#setSave').onclick = async () => {
    try { await api('PUT', '/monitor/settings', { autoscan: $('#setAuto').value === '1', interval_hours: +$('#setInterval').value, scan_days: +$('#setDays').value }); toast('Đã lưu thiết lập quét'); }
    catch (e) { toast(e.message, true); }
  };
  if ($('#addQuery')) $('#addQuery').onclick = () => queryForm({});
  if ($('#addComp')) $('#addComp').onclick = () => competitorForm({});
  if ($('#addSrc')) $('#addSrc').onclick = () => sourceForm({});
  $('#monBody').querySelectorAll('[data-qedit]').forEach((b) => b.onclick = () => queryForm(q.rows.find((x) => String(x.id) === b.dataset.qedit)));
  $('#monBody').querySelectorAll('[data-qdel]').forEach((b) => b.onclick = () => delConfirm(`/monitor/queries/${b.dataset.qdel}`, monConfig, 'Xóa bộ từ khóa này?'));
  $('#monBody').querySelectorAll('[data-cedit]').forEach((b) => b.onclick = () => competitorForm(c.rows.find((x) => String(x.id) === b.dataset.cedit)));
  $('#monBody').querySelectorAll('[data-cdel]').forEach((b) => b.onclick = () => delConfirm(`/monitor/competitors/${b.dataset.cdel}`, monConfig, 'Xóa đối thủ này?'));
  $('#monBody').querySelectorAll('[data-sdel]').forEach((b) => b.onclick = () => delConfirm(`/monitor/sources/${b.dataset.sdel}`, monConfig, 'Xóa nguồn này?'));
}

function queryForm(r = {}) {
  const inc = (parseJSON(r.include, []) || []).map((g) => g.join(' + ')).join('\n');
  const exc = (parseJSON(r.exclude, []) || []).join(', ');
  openForm({
    title: r.id ? 'Sửa bộ từ khóa' : 'Thêm bộ từ khóa', mod: 'monitoring',
    fields: [
      { k: 'name', l: 'Tên bộ từ khóa', full: true, v: r.name, req: true },
      { k: 'category', l: 'Phân loại', type: 'select', opts: [['brand', 'Thương hiệu'], ['industry', 'Tin ngành'], ['competitor', 'Đối thủ']], v: r.category || 'brand' },
      { k: 'include', l: 'Từ khóa — mỗi dòng 1 nhóm AND (nối bằng +)', type: 'textarea', full: true, v: inc },
      { k: 'exclude', l: 'Loại trừ (phẩy ngăn cách)', full: true, v: exc },
      { k: 'grounding', l: 'Quét mở rộng bằng Google Search (AI)', type: 'select', opts: [['0', 'Không'], ['1', 'Có — tốn phí Gemini grounding']], v: String(r.grounding || 0) },
    ],
    save: async (data) => {
      const include = String(data.include || '').split('\n').map((line) => line.split('+').map((x) => x.trim()).filter(Boolean)).filter((g) => g.length);
      const exclude = String(data.exclude || '').split(',').map((x) => x.trim()).filter(Boolean);
      const body = { name: data.name, category: data.category, include, exclude, grounding: data.grounding === '1' };
      if (r.id) await api('PUT', `/monitor/queries/${r.id}`, body); else await api('POST', '/monitor/queries', body);
      monConfig();
    },
  });
}
function competitorForm(r = {}) {
  openForm({
    title: r.id ? 'Sửa đối thủ' : 'Thêm đối thủ', mod: 'monitoring',
    fields: [
      { k: 'name', l: 'Tên đối thủ', full: true, v: r.name, req: true },
      { k: 'website', l: 'Website', full: true, v: r.website, ph: 'https://...' },
      { k: 'fanpage', l: 'Fanpage', full: true, v: r.fanpage, ph: 'https://facebook.com/...' },
      { k: 'channels', l: 'Kênh vệ tinh (mỗi ô 1 link, bấm "+ Thêm ô")', type: 'list', full: true, v: (parseJSON(r.channels, []) || []), ph: 'Link fanpage/website/kênh…' },
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note },
    ],
    save: async (data) => {
      // channels đã là mảng (type list)
      if (r.id) await api('PUT', `/monitor/competitors/${r.id}`, data); else await api('POST', '/monitor/competitors', data);
      monConfig();
    },
  });
}
function sourceForm(r = {}) {
  openForm({
    title: 'Thêm nguồn báo chí', mod: 'monitoring',
    note: 'Dán link trang chủ/chuyên mục bất kỳ — không cần biết đó có phải RSS hay không, hệ thống tự xử lý.',
    fields: [
      { k: 'name', l: 'Tên nguồn', full: true, v: r.name, req: true },
      { k: 'url', l: 'Website', full: true, v: r.url, req: true, ph: 'vd: vnexpress.net hoặc https://vnexpress.net/kinh-doanh' },
    ],
    save: async (data) => {
      const res = await api('POST', '/monitor/sources', data);
      monConfig();
      setTimeout(() => toast(res.mode === 'rss' ? 'Đã thêm — tìm thấy RSS, sẽ quét qua RSS' : 'Đã thêm — không có RSS, sẽ quét bằng Google Search giới hạn trang này'), 200);
    },
  });
}

async function monRuns() {
  const d = await api('GET', '/monitor/runs');
  const rows = d.rows.map((r) => `<tr><td>${fmtDateTime(r.started_at)}</td><td>${r.new_mentions}</td>
      <td><span class="badge b-green">${r.pos || 0}</span> <span class="badge b-gray">${r.neu || 0}</span> <span class="badge b-red">${r.neg || 0}</span></td>
      <td>${r.fetched}</td><td>${r.analyzed}</td>
      <td><span class="badge ${r.status === 'done' ? 'b-green' : r.status === 'error' ? 'b-red' : 'b-amber'}">${esc(r.status)}</span>${r.error ? `<div class="muted-sm">${esc(r.error)}</div>` : ''}</td>
      <td>${esc(r.triggered_by || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Chưa có lượt quét</td></tr>';
  $('#monBody').innerHTML = `<div class="panel"><h3>🕘 Lịch sử quét <span class="muted-sm">(tin tốt/bình thường/xấu của mỗi lượt)</span></h3>
    <div class="table-wrap"><table><thead><tr><th>Bắt đầu</th><th>Tin mới</th><th>Tốt / TT / Xấu</th><th>Bài quét</th><th>Đã chấm</th><th>Trạng thái</th><th>Bởi</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

// ---- Chiến dịch truyền thông ----
async function monCampaigns() {
  if (psCamp.view === 'results' && psCamp.id) return campaignResults(psCamp.id);
  const d = await api('GET', '/monitor/campaigns');
  const ed = can('monitoring', 'edit'), del = can('monitoring', 'delete');
  const rows = d.rows.map((r) => `<tr>
      <td><b>${esc(r.name)}</b>${r.message ? `<div class="muted-sm">${esc(r.message)}</div>` : ''}</td>
      <td>${r.start_date ? fmtDate(r.start_date) : '—'} → ${r.end_date ? fmtDate(r.end_date) : '—'}</td>
      <td>${(r.keywords || []).map((k) => `<span class="chip">${esc(k)}</span>`).join(' ') || '—'}</td>
      <td>${(r.competitors || []).map((c) => esc(typeof c === 'string' ? c : c.name)).join(', ') || '—'}</td>
      <td><span class="badge b-blue">${esc(r.status || '')}</span></td>
      <td><button class="btn sm primary" data-cres="${r.id}">Kết quả</button> ${ed ? `<button class="btn sm" data-cedit="${r.id}">Sửa</button>` : ''} ${del ? `<button class="btn sm danger" data-cdel="${r.id}">✕</button>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="empty">Chưa có chiến dịch. Bấm "+ Thêm chiến dịch".</td></tr>';
  $('#monBody').innerHTML = `<div class="panel"><h3>🎯 Chiến dịch truyền thông ${can('monitoring', 'create') ? `<button class="btn sm" id="addCamp" style="float:right">+ Thêm chiến dịch</button>` : ''}</h3>
    <div class="table-wrap"><table><thead><tr><th>Tên / Thông điệp</th><th>Thời gian</th><th>Từ khóa</th><th>Đối thủ</th><th>TT</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  if ($('#addCamp')) $('#addCamp').onclick = () => campaignForm({});
  $('#monBody').querySelectorAll('[data-cres]').forEach((b) => b.onclick = () => { psCamp.view = 'results'; psCamp.id = +b.dataset.cres; monCampaigns(); });
  $('#monBody').querySelectorAll('[data-cedit]').forEach((b) => b.onclick = () => campaignForm(d.rows.find((x) => String(x.id) === b.dataset.cedit)));
  $('#monBody').querySelectorAll('[data-cdel]').forEach((b) => b.onclick = () => delConfirm(`/monitor/campaigns/${b.dataset.cdel}`, monCampaigns, 'Xóa chiến dịch này?'));
}
function campaignForm(r = {}) {
  openForm({
    title: r.id ? 'Sửa chiến dịch' : 'Thêm chiến dịch truyền thông', mod: 'monitoring',
    fields: [
      { k: 'name', l: 'Tên chiến dịch', full: true, v: r.name, req: true },
      { k: 'start_date', l: 'Thời gian bắt đầu', type: 'date', v: r.start_date ? String(r.start_date).slice(0, 10) : '' },
      { k: 'end_date', l: 'Thời gian kết thúc', type: 'date', v: r.end_date ? String(r.end_date).slice(0, 10) : '' },
      { k: 'message', l: 'Thông điệp chiến dịch', type: 'textarea', full: true, v: r.message },
      { k: 'content', l: 'Nội dung chiến dịch', type: 'textarea', full: true, v: r.content },
      { k: 'audience', l: 'Đối tượng tác động', full: true, v: r.audience },
      { k: 'keywords', l: 'Từ khóa chiến dịch (mỗi ô 1 từ khóa)', type: 'list', full: true, v: (r.keywords || []), ph: 'vd: MISA AMIS' },
      { k: 'competitors', l: 'Đối thủ trong chiến dịch (mỗi ô 1 tên)', type: 'list', full: true, v: (r.competitors || []).map((c) => typeof c === 'string' ? c : c.name), ph: 'Tên đối thủ' },
      { k: 'status', l: 'Trạng thái', type: 'select', opts: ['Đang chạy', 'Đã kết thúc', 'Tạm dừng'], v: r.status || 'Đang chạy' },
    ],
    save: async (data) => {
      if (r.id) await api('PUT', `/monitor/campaigns/${r.id}`, data); else await api('POST', '/monitor/campaigns', data);
      psCamp.view = 'list'; monCampaigns();
    },
  });
}
async function campaignResults(id) {
  const d = await api('GET', `/monitor/campaigns/${id}/results`);
  const cp = d.campaign, s = d.sentiment;
  const sBar = svgBar([{ label: 'Tích cực', value: s.positive, color: '#1a8a52' }, { label: 'Tiêu cực', value: s.negative, color: '#C8102E' }, { label: 'Trung tính', value: s.neutral, color: '#9ca3af' }]);
  const tItems = d.timeline.map((t) => ({ label: (t.date || '').slice(5), value: t.total }));
  const compRows = (d.competitors || []).map((c) => `<tr><td>${esc(c.name)}</td><td>${c.mentions}</td></tr>`).join('') || '<tr><td colspan="2" class="empty">—</td></tr>';
  const srcRows = Object.entries(d.bySource || {}).map(([k, v]) => `<span class="chip">${esc(SRC_LBL[k] || k)}: ${v}</span>`).join(' ') || '—';
  const sample = (d.sample || []).map((m) => `<div class="sub-list"><div class="item"><b>${esc(m.title || '')}</b> ${sentBadge(m.sentiment)}<br><span class="muted-sm">${esc(m.source_name || '')} · ${valDate(m.published_at)} ${m.link ? `· <a href="${esc(m.link)}" target="_blank" rel="noopener">mở ↗</a>` : ''}</span></div></div>`).join('') || '<div class="empty">Không có tin khớp từ khóa trong kỳ</div>';
  $('#monBody').innerHTML = `
    <div class="page-head"><div><h2 style="font-size:18px">🎯 ${esc(cp.name)}</h2><div class="desc">${fmtDate(d.from)} → ${fmtDate(d.to)} · Từ khóa: ${(cp.keywords || []).join(', ') || '—'}</div></div>
      <button class="btn" id="campBack">‹ Danh sách</button></div>
    <div class="cards">
      <div class="stat"><div class="v">${d.total}</div><div class="l">Tin/bài khớp từ khóa</div></div>
      <div class="stat"><div class="v nsr-v ${d.nsr > 0 ? 'pos' : d.nsr < 0 ? 'neg' : ''}" style="font-size:28px">${d.nsr > 0 ? '+' : ''}${d.nsr.toFixed(2)}</div><div class="l">NSR</div></div>
      <div class="stat"><div class="v">${s.positive}</div><div class="l">Tích cực</div></div>
      <div class="stat"><div class="v">${s.negative}</div><div class="l">Tiêu cực</div></div>
    </div>
    <div class="two-col">
      <div class="panel"><h3>📊 Sắc thái</h3>${d.total ? sBar : '<div class="empty">Chưa có dữ liệu</div>'}<div class="muted-sm" style="margin-top:8px">Theo nguồn: ${srcRows}</div></div>
      <div class="panel"><h3>📈 Lượng tin theo ngày</h3>${tItems.length ? svgLine(tItems) : '<div class="empty">—</div>'}</div>
    </div>
    <div class="two-col">
      <div class="panel"><h3>🏁 Đối thủ trong chiến dịch</h3><div class="table-wrap"><table><thead><tr><th>Đối thủ</th><th>Số tin (kèm từ khóa CD)</th></tr></thead><tbody>${compRows}</tbody></table></div></div>
      <div class="panel"><h3>🤖 Đánh giá hiệu quả (AI) <button class="btn sm" id="campEval" style="float:right">Tạo đánh giá</button></h3><div id="campEvalBody"><div class="muted-sm">AI đánh giá hiệu quả chiến dịch dựa trên số liệu + bối cảnh Google.</div></div></div>
    </div>
    <div class="panel"><h3>📰 Tin tiêu biểu (${(d.sample || []).length})</h3>${sample}</div>`;
  $('#campBack').onclick = () => { psCamp.view = 'list'; psCamp.id = null; monCampaigns(); };
  $('#campEval').onclick = () => aiPanel('#campEval', '#campEvalBody', `/monitor/campaigns/${id}/evaluate`);
}

// ==================== ORGANIZATIONS (4 loại) ====================
const psPartners = { press: pageState(), association: pageState(), gov: pageState(), other: pageState() };
function makePartnerView(type) {
  return async () => {
    const ps = psPartners[type];
    const meta = ORG_TYPE[type];
    await getAssignableUsers();
    let url = `/partners?type=${type}&page=${ps.page}&search=${encodeURIComponent(ps.search)}`;
    if (ps.caretaker_id) url += `&caretaker_id=${encodeURIComponent(ps.caretaker_id)}`;
    if (type === 'press') {
      if (ps.ptype) url += `&ptype=${encodeURIComponent(ps.ptype)}`;
      if (ps.tier) url += `&tier=${encodeURIComponent(ps.tier)}`;
    }
    if (type === 'gov') {
      if (ps.admin_level) url += `&admin_level=${encodeURIComponent(ps.admin_level)}`;
      if (ps.agency_block) url += `&agency_block=${encodeURIComponent(ps.agency_block)}`;
    }
    if (type === 'association') {
      if (ps.admin_level) url += `&admin_level=${encodeURIComponent(ps.admin_level)}`;
      if (ps.field_area) url += `&field_area=${encodeURIComponent(ps.field_area)}`;
      if (ps.fee_status) url += `&fee_status=${encodeURIComponent(ps.fee_status)}`;
    }
    const d = await api('GET', url);
    ps.total = d.total;
    let head, rows;
    if (type === 'press') {
      head = '<th>Tên cơ quan</th><th>Loại hình</th><th>Cơ quan chủ quản</th><th>Tầm ảnh hưởng</th><th>Ngày thành lập</th>';
      rows = d.rows.map((r) => `<tr data-id="${r.id}">
        <td><b>${esc(r.name)}</b>${r.political_rank ? ` <span class="badge b-gray">${esc(r.political_rank)}</span>` : ''}</td>
        <td>${(parseJSON(r.press_types, []) || []).map((t) => `<span class="badge b-blue">${esc(t)}</span>`).join(' ') || '—'}</td>
        <td>${val(r.parent_org)}</td><td>${tierBadge(r.tier)}</td><td>${valDate(r.founded_date)}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">Không có dữ liệu</td></tr>`;
    } else if (type === 'gov') {
      head = '<th>Tên cơ quan</th><th>Cấp quản lý</th><th>Khối cơ quan</th><th>Ngày thành lập</th>';
      rows = d.rows.map((r) => `<tr data-id="${r.id}">
        <td><b>${esc(r.name)}</b>${r.parent_org ? `<div class="muted-sm">CQ chủ quản: ${esc(r.parent_org)}</div>` : ''}</td>
        <td>${val(r.admin_level)}</td><td>${r.agency_block ? `<span class="badge b-blue">${esc(r.agency_block)}</span>` : '—'}</td>
        <td>${valDate(r.founded_date)}</td></tr>`).join('') || `<tr><td colspan="4" class="empty">Không có dữ liệu</td></tr>`;
    } else if (type === 'association') {
      head = '<th>Tên cơ quan</th><th>Phân loại</th><th>Lĩnh vực</th><th>Vai trò MISA</th><th>Nghĩa vụ hội phí</th><th>Ngày thành lập</th>';
      rows = d.rows.map((r) => `<tr data-id="${r.id}">
        <td><b>${esc(r.name)}</b>${r.abbreviation ? ` <span class="muted-sm">(${esc(r.abbreviation)})</span>` : ''}</td>
        <td>${val(r.admin_level)}</td><td>${r.field_area ? `<span class="badge b-blue">${esc(r.field_area)}</span>` : '—'}</td>
        <td>${val(r.misa_role)}</td>
        <td><span class="badge ${r.fee_overdue > 0 ? 'b-red' : 'b-green'}">${r.fee_overdue > 0 ? 'Quá hạn' : 'Đầy đủ'}</span></td>
        <td>${valDate(r.founded_date)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">Không có dữ liệu</td></tr>`;
    } else {
      const col2 = (r) => {
        if (type === 'press') return (parseJSON(r.press_types, []) || []).map((t) => `<span class="badge b-blue">${esc(t)}</span>`).join(' ') || '—';
        if (type === 'association') return val(r.misa_role);
        return val(r.address);
      };
      const col2Head = type === 'press' ? 'Loại hình' : type === 'association' ? 'Vai trò MISA' : 'Địa chỉ';
      head = `<th>Tên cơ quan</th><th>${col2Head}</th><th>Mức độ</th><th>Ngày thành lập</th><th>Số nhân sự</th>`;
      rows = d.rows.map((r) => `<tr data-id="${r.id}">
        <td><b>${esc(r.name)}</b>${r.parent_org ? `<div class="muted-sm">CQ chủ quản: ${esc(r.parent_org)}</div>` : ''}</td>
        <td>${col2(r)}</td><td>${tierBadge(r.tier)}</td>
        <td>${valDate(r.founded_date)}</td><td>${r.people_count}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">Không có dữ liệu</td></tr>`;
    }
    renderTable({
      title: meta.label, desc: `Danh sách ${meta.label.toLowerCase()} và nhân sự bên trong.`, mod: 'partners', ps,
      onSearch: () => VIEWS[type](type), addLabel: `Thêm ${meta.label.toLowerCase()}`,
      head, rowsHtml: rows, sensitiveNote: sensitiveBanner(d.sensitiveVisible),
    });
    const mkSel = (id, ph, opts, cur) => `<select id="${id}" class="filter-sel"><option value="">${ph}</option>${opts.map((o) => `<option value="${esc(o)}"${cur === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    if ($('.toolbar')) {
      const caretakerOptions = (_assignableUsers || []).map((u) => [String(u.id), u.full_name]);
      const caretakerSelect = `<select id="fCaretaker" class="filter-sel"><option value="">Mọi người chăm sóc</option>${caretakerOptions.map(([id, name]) => `<option value="${esc(id)}"${String(ps.caretaker_id || '') === id ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select>`;
      $('.toolbar').appendChild(el(`<span class="caretaker-filter">${caretakerSelect}</span>`));
      $('#fCaretaker').onchange = (e) => { ps.caretaker_id = e.target.value; ps.page = 1; VIEWS[type](type); };
    }
    if (type === 'press' && $('.toolbar')) {
      const wrap = el(`<span style="display:flex;gap:8px">${mkSel('fPtype', 'Mọi loại hình', OPT.pressTypes, ps.ptype || '')}${mkSel('fTier', 'Mọi tầm ảnh hưởng', OPT.tier, ps.tier || '')}</span>`);
      $('.toolbar').appendChild(wrap);
      $('#fPtype').onchange = (e) => { ps.ptype = e.target.value; ps.page = 1; VIEWS.press('press'); };
      $('#fTier').onchange = (e) => { ps.tier = e.target.value; ps.page = 1; VIEWS.press('press'); };
    }
    if (type === 'gov' && $('.toolbar')) {
      const wrap = el(`<span style="display:flex;gap:8px">${mkSel('fLevel', 'Mọi cấp quản lý', OPT.adminLevel, ps.admin_level || '')}${mkSel('fBlock', 'Mọi khối', OPT.agencyBlock, ps.agency_block || '')}</span>`);
      $('.toolbar').appendChild(wrap);
      $('#fLevel').onchange = (e) => { ps.admin_level = e.target.value; ps.page = 1; VIEWS.gov('gov'); };
      $('#fBlock').onchange = (e) => { ps.agency_block = e.target.value; ps.page = 1; VIEWS.gov('gov'); };
    }
    if (type === 'association' && $('.toolbar')) {
      const wrap = el(`<span style="display:flex;gap:8px">${mkSel('fLevel', 'Mọi phân loại', OPT.adminLevel, ps.admin_level || '')}${mkSel('fField', 'Mọi lĩnh vực', OPT.assocField, ps.field_area || '')}${mkSel('fFee', 'Mọi nghĩa vụ phí', ['Đầy đủ', 'Quá hạn'], ps.fee_status || '')}</span>`);
      $('.toolbar').appendChild(wrap);
      $('#fLevel').onchange = (e) => { ps.admin_level = e.target.value; ps.page = 1; VIEWS.association('association'); };
      $('#fField').onchange = (e) => { ps.field_area = e.target.value; ps.page = 1; VIEWS.association('association'); };
      $('#fFee').onchange = (e) => { ps.fee_status = e.target.value; ps.page = 1; VIEWS.association('association'); };
    }
    if ($('#addBtn')) $('#addBtn').onclick = () => orgForm(type, {});
    $('#tbody').querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => (location.hash = `partner/${tr.dataset.id}`));
    // Trang Báo chí: tổng quan nhân sự + tương tác gần đây (lọc theo báo chí)
    if (type === 'press') renderPressOverview();
  };
}

async function renderPressOverview() {
  let d;
  try { d = await api('GET', '/press-overview'); } catch { return; }
  const top = (d.topPeople || []).length
    ? d.topPeople.map((p) => `<tr data-go="person/${p.id}"><td><b>${esc(p.full_name)}</b><div class="muted-sm">${esc(p.position || p.level || '')}${p.beat ? ' · ' + esc(p.beat) : ''}</div></td><td>${esc(p.org_name)}</td><td>${scoreBar(p.relationship_score)}</td><td>${statusBadge(p.status)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="empty">Chưa có dữ liệu</td></tr>';
  const inter = (d.recentInteractions || []).length
    ? d.recentInteractions.map((i) => `<div class="sub-list"><div class="item"><b>${esc(i.partner_name)}</b> · ${esc(i.channel || '')} · ${fmtDate(i.date)} ${resultBadge(i.result)}<br><span class="muted-sm">${esc(i.summary || '')}</span></div></div>`).join('')
    : '<div class="empty">Chưa có tương tác</div>';
  const wrap = el(`<div class="two-col" style="margin-top:18px">
    <div class="panel"><h3>⭐ Nhà báo/Phóng viên quan hệ tốt nhất</h3>
      <div class="table-wrap"><table><thead><tr><th>Họ tên</th><th>Cơ quan</th><th>Điểm</th><th>Trạng thái</th></tr></thead>
      <tbody>${top}</tbody></table></div>
    </div>
    <div class="panel"><h3>💬 Tương tác gần đây</h3>${inter}</div>
  </div>`);
  $('#view').appendChild(wrap);
  wrap.querySelectorAll('[data-go]').forEach((r) => r.onclick = () => (location.hash = r.dataset.go));
}
['press', 'association', 'gov', 'other'].forEach((t) => { VIEWS[t] = makePartnerView(t); });

VIEWS.partner = async (key) => {
  const id = key.split('/')[1];
  const d = await api('GET', `/partners/${id}`);
  const r = d.record;
  r._caretakers = (d.caretakers || []).map((c) => c.id);
  const meta = ORG_TYPE[r.org_type] || ORG_TYPE.other;
  setActive(r.org_type);
  $('#crumb').textContent = `${meta.label} · ${r.name}`;
  const row = (k, v) => `<div class="k">${k}</div><div>${v}</div>`;
  if (r.org_type === 'gov') { renderGovPartner(d, r, meta, row); return; }
  const isAssocTop = r.org_type === 'association';
  const typeRows = r.org_type === 'press'
    ? row('Loại hình', (parseJSON(r.press_types, []) || []).map((t) => `<span class="badge b-blue">${esc(t)}</span>`).join(' ') || '—')
    : isAssocTop
      ? row('Tên viết tắt', val(r.abbreviation)) + row('Phân loại', val(r.admin_level)) + row('Lĩnh vực hoạt động', val(r.field_area))
        + row('Hotline', val(r.hotline)) + row('Mã số thuế', val(r.tax_code))
        + row('Vai trò MISA', val(r.misa_role)) + row('Ngày tham gia', valDate(r.join_date)) + row('Hội phí 🔒', money(r.membership_fee))
      : '';
  // Nhóm nhân sự theo cấp
  const groups = {};
  for (const p of d.people) { const lv = p.level || 'Khác'; (groups[lv] = groups[lv] || []).push(p); }
  const peopleHtml = LEVEL_ORDER.filter((lv) => groups[lv]).map((lv) => `
    <div class="lvl-group"><div class="lvl-head">${esc(lv)} <span class="muted-sm">(${groups[lv].length})</span></div>
    ${groups[lv].map((p) => `<div class="person-row" data-go="person/${p.id}">
      ${avatarCell(p.primary_photo_id, p.full_name)}
      <div class="pr-main"><b>${esc(p.full_name)}</b><div class="muted-sm">${esc(p.position || '')}${p.beat ? ' · ' + esc(p.beat) : ''}</div></div>
      <div class="pr-meta">${scoreBar(p.relationship_score)}</div>
      <div class="pr-meta">${val(p.phone_personal)}</div></div>`).join('')}</div>`).join('') || '<div class="empty">Chưa có nhân sự. Bấm "+ Thêm nhân sự".</div>';

  // Ban lãnh đạo (báo chí): nhân sự cấp Lãnh đạo hoặc giữ chức danh chủ chốt
  const BOARD_TITLES = ['tổng biên tập', 'phó tổng biên tập', 'thư ký tòa soạn', 'trưởng ban'];
  const board = (d.people || []).filter((p) => p.level === 'Lãnh đạo' || (p.position && BOARD_TITLES.some((t) => String(p.position).toLowerCase().includes(t))));
  const boardHtml = board.length ? board.map((p) => `<div class="person-row" data-go="person/${p.id}">${avatarCell(p.primary_photo_id, p.full_name)}
      <div class="pr-main"><b>${esc(p.full_name)}</b><div class="muted-sm">${esc(p.position || p.level || '')}</div></div>
      <div class="pr-meta">${val(p.phone_personal)}</div></div>`).join('') : '<div class="empty">Chưa có (thêm nhân sự cấp Lãnh đạo / Trưởng ban)</div>';

  const isAssoc = r.org_type === 'association';
  const associationPeopleHtml = (() => {
    if (!isAssoc) return peopleHtml;
    const renderAssocRows = (rows) => rows.length ? rows.map((p) => `<div class="person-row" data-go="person/${p.id}">
      ${avatarCell(p.primary_photo_id, p.full_name)}<div class="pr-main"><b>${esc(p.full_name)}</b><div class="muted-sm">${esc(p.assoc_position || p.position || p.level || '')}${p.current_workplace ? ' · ' + esc(p.current_workplace) : ''}</div></div>
      <div class="pr-meta">${val(p.phone_work || p.phone_personal)}</div><div class="pr-meta">${val(p.email_work)}</div></div>`).join('') : '<div class="empty">Chưa có nhân sự trong nhóm này.</div>';
    const roleText = (p) => `${p.level || ''} ${p.position || ''} ${p.assoc_position || ''} ${p.assoc_role || ''}`.toLowerCase();
    const secretariat = (d.people || []).filter((p) => /thư ký|ban hội viên/.test(roleText(p)));
    const boardMembers = (d.people || []).filter((p) => !secretariat.includes(p) && (/lãnh đạo|quản lý|chủ tịch|phó chủ tịch|ủy viên|ban chấp hành/.test(roleText(p))));
    const others = (d.people || []).filter((p) => !secretariat.includes(p) && !boardMembers.includes(p));
    return `<div class="network-group"><h4 class="sub-h">Ban chấp hành</h4>${renderAssocRows(boardMembers)}</div>
      <div class="network-group"><h4 class="sub-h">Thư ký Ban hội viên</h4>${renderAssocRows(secretariat)}</div>
      ${others.length ? `<div class="network-group"><h4 class="sub-h">Thành viên khác</h4>${renderAssocRows(others)}</div>` : ''}`;
  })();
  $('#view').innerHTML = `
    <div class="page-head"><div><h2>${meta.ic} ${esc(r.name)}</h2>
      <div class="desc">${esc(meta.label)}${r.tier ? ' · ' : ''}${r.tier ? r.tier : ''}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><a href="#${r.org_type}" class="btn">‹ Danh sách</a>
      ${can('partners', 'edit') ? `<button class="btn primary" id="editBtn">Sửa cơ quan</button>` : ''}
      ${can('partners', 'delete') ? `<button class="btn danger" id="delBtn">Xóa</button>` : ''}</div></div>
    ${sensitiveBanner(d.sensitiveVisible)}
    <div class="two-col">
      <div class="panel"><h3>Thông tin cơ quan</h3><div class="detail-rows">
        ${row('Ngày thành lập', valDate(r.founded_date))}${isAssocTop ? '' : row('Đơn vị chủ quản', val(r.parent_org))}
        ${row('Website', r.website ? `<a href="https://${esc(r.website)}" target="_blank">${esc(r.website)}</a>` : '—')}
        ${row(isAssocTop ? 'Trụ sở văn phòng' : 'Địa chỉ', val(r.address))}${typeRows}${r.org_type === 'press' ? '' : row('Ghi chú', val(r.note))}
        ${r.org_type === 'press' ? '' : row('👥 Người chăm sóc', caretakerChips(d.caretakers))}
      </div></div>
      <div class="panel"><h3>📅 Ngày nhắc liên quan</h3>
        ${d.dates.length ? d.dates.map((x) => `<div class="sub-list"><div class="item"><b>${esc(x.title)}</b><br><span class="muted-sm">${fmtDate(x.event_date)}${x.recurring ? ' · hằng năm' : ''}</span></div></div>`).join('') : '<div class="empty">Chưa có</div>'}
      </div>
    </div>
    ${isAssocTop ? `<div class="panel"><h3>🏛️ Hồ sơ vị thế của MISA</h3><div class="detail-rows">
        ${row('Năm tham gia', valDate(r.join_date))}${row('Vai trò hội viên', val(r.misa_role))}
        ${row('Vai trò hiện tại', val(r.misa_current_role))}
        ${row('Các sự kiện trong năm', val(r.misa_events))}${row('Các giải thưởng trong năm', val(r.misa_awards))}
      </div><div class="muted-sm" style="margin-top:6px">Sự kiện & giải thưởng có thể nhập tay tại đây; phần đồng bộ tự động từ công cụ tổng hợp (anh V.Anh) sẽ bổ sung sau.</div></div>` : ''}
    ${r.org_type === 'press' ? `<div class="panel"><h3>Thông tin Ban lãnh đạo ${can('partners', 'create') ? '<button class="btn sm" id="addLeader" style="float:right">+ Thêm lãnh đạo</button>' : ''}</h3>${boardHtml}</div>
      <div class="panel"><h3>Thông tin đánh giá</h3><div class="detail-rows">
        ${row('Tôn chỉ hoạt động', val(r.charter))}
        ${row('Mức độ ảnh hưởng', r.political_rank ? `<span class="eval-rank">${esc(r.political_rank)}</span> <span class="muted-sm">${esc((POLITICAL_RANK_DESC[r.political_rank] || '').replace(/^C\d+ — /, ''))}</span>` : '—')}
      </div></div>
      <div class="panel"><h3>Hợp tác đổi hàng ${can('partners', 'edit') ? `<button class="btn sm" id="addBenefit" style="float:right">+ Ghi sử dụng quyền lợi</button>` : ''}</h3>
        <div class="detail-rows">${row('Thời hạn hợp đồng', val(r.contract_term))}${row('Quyền lợi hợp đồng', val(r.contract_benefits))}${row('Nhân sự phụ trách', val(r.contract_staff))}</div>
        <h4 class="sub-h">Lịch sử sử dụng quyền lợi</h4>
        ${(d.benefitUsages || []).length ? d.benefitUsages.map((b) => `<div class="sub-list"><div class="item"><b>${esc(b.title)}</b> <span class="muted-sm">${b.used_date ? fmtDate(b.used_date) : ''}</span>${b.note ? '<br><span class="muted-sm">' + esc(b.note) + '</span>' : ''}${can('partners', 'edit') ? `<span style="float:right;display:flex;gap:6px"><button class="btn sm" data-edit-benefit="${b.id}">Sửa</button><button class="btn sm danger" data-del-benefit="${b.id}">Xóa</button></span>` : ''}</div></div>`).join('') : '<div class="empty">Chưa có</div>'}
      </div>` : ''}
    <div class="panel"><h3>${r.org_type === 'press' ? 'Danh sách Nhà báo/Phóng viên' : r.org_type === 'association' ? 'Mạng lưới nhân sự' : 'Nhân sự'} ${can('partners', 'create') ? `<button class="btn sm" id="addPerson" style="float:right">+ ${r.org_type === 'press' ? 'Thêm thông tin phóng viên' : 'Thêm nhân sự'}</button>` : ''}</h3>
      ${associationPeopleHtml}
    </div>
    ${isAssoc ? `<div class="panel"><h3>💳 Hội phí theo năm ${can('partners', 'edit') ? `<button class="btn sm" id="addFee" style="float:right">+ Thêm năm</button>` : ''}</h3>
      <div class="table-wrap"><table><thead><tr><th>Năm</th><th>Số tiền 🔒</th><th>Hạn đóng</th><th>Trạng thái</th><th>Ngày đóng</th><th>Nhân sự</th>${can('partners', 'edit') ? '<th></th>' : ''}</tr></thead><tbody>
      ${(d.fees || []).length ? d.fees.map((f) => { const dl = f.status !== 'Đã đóng' ? deadlineBadge(daysUntil(f.due_date)) : ''; return `<tr><td><b>${esc(f.year || '—')}</b></td><td>${money(f.amount)}</td><td>${valDate(f.due_date)} ${dl}</td>
        <td><span class="badge ${f.status === 'Đã đóng' ? 'b-green' : 'b-amber'}">${esc(f.status || 'Chưa đóng')}</span></td><td>${valDate(f.paid_date)}</td><td>${esc(f.staff || '—')}</td>
        ${can('partners', 'edit') ? `<td><button class="btn sm" data-fedit="${f.id}">Sửa</button> ${f.due_date && f.status !== 'Đã đóng' ? `<button class="btn sm" data-fremind="${f.id}" title="Thêm nhắc hạn đóng">Nhắc hạn</button>` : ''} <button class="btn sm danger" data-fdel="${f.id}">✕</button></td>` : ''}</tr>`; }).join('') : `<tr><td colspan="${can('partners', 'edit') ? 7 : 6}" class="empty">Chưa có dữ liệu hội phí</td></tr>`}
      </tbody></table></div></div>
    <div class="panel"><h3>🏆 Lịch sử tham gia Giải thưởng & tài trợ Sự kiện ${can('partners', 'edit') ? `<button class="btn sm" id="addSp" style="float:right">+ Thêm</button>` : ''}</h3>
      ${d.sponsorships.length ? d.sponsorships.map(spItem).join('') : '<div class="empty">Chưa có</div>'}
    </div>` : ''}
    <div class="panel"><h3>🎁 Quà tặng đối ngoại / Lịch sử chúc mừng ${can('partners', 'edit') ? `<button class="btn sm" id="addGift" style="float:right">+ Thêm</button>` : ''}</h3>
      ${(d.gifts || []).length ? d.gifts.map((g) => giftItem(g, can('partners', 'edit'))).join('') : '<div class="empty">Chưa có</div>'}
    </div>
    ${r.org_type === 'press' ? `<div class="panel"><h3>🤝 Lịch sử tài trợ hoạt động của Tòa soạn ${can('partners', 'edit') ? `<button class="btn sm" id="addSp" style="float:right">+ Thêm</button>` : ''}</h3>
      ${(d.sponsorships || []).length ? d.sponsorships.map(spItem).join('') : '<div class="empty">Chưa có</div>'}
    </div>` : ''}
    <div class="panel"><h3>💬 Lịch sử tương tác ${can('interactions', 'create') ? `<button class="btn sm" id="addInter" style="float:right">+ Ghi tương tác</button>` : ''}</h3>
      ${d.interactions.length ? d.interactions.map((i) => `<div class="sub-list"><div class="item"><b>${fmtDate(i.date)}</b> · ${esc(i.channel)} ${resultBadge(i.result)}<br>${esc(i.summary)}${i.next_task ? `<br><span class="muted-sm">➡ Tiếp theo: ${esc(i.next_task)}${i.next_due ? ' (hạn ' + fmtDate(i.next_due) + ')' : ''}${i.next_status ? ' · ' + esc(i.next_status) : ''}</span>` : ''}</div></div>`).join('') : '<div class="empty">Chưa có tương tác</div>'}
    </div>`;
  if ($('#addBenefit')) $('#addBenefit').onclick = () => benefitForm(r.id, () => VIEWS.partner(`partner/${r.id}`));
  if ($('#addGift')) $('#addGift').onclick = () => giftForm('partners', r.id, () => VIEWS.partner(`partner/${r.id}`));
  $('#view').querySelectorAll('[data-del-benefit]').forEach((b) => b.onclick = () => delConfirm(`/benefit-usages/${b.dataset.delBenefit}`, () => VIEWS.partner(`partner/${r.id}`), 'Xóa mục này?'));
  $('#view').querySelectorAll('[data-del-gift]').forEach((b) => b.onclick = () => delConfirm(`/gifts/${b.dataset.delGift}`, () => VIEWS.partner(`partner/${r.id}`), 'Xóa quà tặng này?'));
  const reloadPartner = () => VIEWS.partner(`partner/${r.id}`);
  $('#view').querySelectorAll('[data-sp-edit]').forEach((b) => b.onclick = () => sponsorshipForm(r.id, (d.sponsorships || []).find((x) => String(x.id) === b.dataset.spEdit)));
  $('#view').querySelectorAll('[data-sp-del]').forEach((b) => b.onclick = () => delConfirm(`/sponsorships/${b.dataset.spDel}`, reloadPartner, 'Xóa mục tài trợ/giải thưởng này?'));
  $('#view').querySelectorAll('[data-edit-gift]').forEach((b) => b.onclick = () => giftForm('partners', r.id, reloadPartner, (d.gifts || []).find((x) => String(x.id) === b.dataset.editGift)));
  $('#view').querySelectorAll('[data-edit-benefit]').forEach((b) => b.onclick = () => benefitForm(r.id, reloadPartner, (d.benefitUsages || []).find((x) => String(x.id) === b.dataset.editBenefit)));
  if ($('#editBtn')) $('#editBtn').onclick = () => orgForm(r.org_type, r);
  if ($('#delBtn')) $('#delBtn').onclick = async () => {
    if (!confirm(`Xóa cơ quan "${r.name}"? Toàn bộ nhân sự, booking, tương tác thuộc cơ quan này cũng bị xóa.`)) return;
    try { await api('DELETE', `/partners/${r.id}`); toast('Đã xóa cơ quan'); location.hash = r.org_type; } catch (e) { toast(e.message, true); }
  };
  if ($('#addPerson')) $('#addPerson').onclick = () => personForm({ org_id: r.id }, r.id);
  if ($('#addLeader')) $('#addLeader').onclick = () => personForm({ org_id: r.id, level: 'Lãnh đạo', category: 'VIP' }, r.id);
  if ($('#addSp')) $('#addSp').onclick = () => sponsorshipForm(r.id);
  if ($('#addFee')) $('#addFee').onclick = () => feeForm(r.id, {});
  $('#view').querySelectorAll('[data-fedit]').forEach((b) => b.onclick = () => feeForm(r.id, (d.fees || []).find((x) => String(x.id) === b.dataset.fedit)));
  $('#view').querySelectorAll('[data-fdel]').forEach((b) => b.onclick = async () => { if (!confirm('Xóa khoản hội phí này?')) return; try { await api('DELETE', `/partners/${r.id}/fees/${b.dataset.fdel}`); VIEWS.partner(`partner/${r.id}`); } catch (e) { toast(e.message, true); } });
  $('#view').querySelectorAll('[data-fremind]').forEach((b) => b.onclick = async () => { try { await api('POST', `/partners/${r.id}/fees/${b.dataset.fremind}/remind`, {}); toast('Đã thêm nhắc hạn đóng vào Lịch nhắc'); } catch (e) { toast(e.message, true); } });
  if ($('#addInter')) $('#addInter').onclick = () => interactionForm({ partner_type: 'org', partner_id: r.id, partner_name: r.name }, {}, () => VIEWS.partner(`partner/${r.id}`));
  if (r.org_type === 'press') mountBookings('org', r.id, r.name);
  $('#view').querySelectorAll('[data-go]').forEach((x) => x.onclick = () => (location.hash = x.dataset.go));
};

async function orgForm(type, r = {}) {
  const meta = ORG_TYPE[type] || ORG_TYPE.other;
  await getAssignableUsers();
  const fields = [{ k: 'name', l: 'Tên cơ quan', full: true, v: r.name, req: true }];
  if (type !== 'gov') fields.push({ k: 'tier', l: 'Mức độ quan hệ', type: 'select', opts: OPT.tier, v: r.tier });
  fields.push({ k: 'founded_date', l: 'Ngày thành lập', type: 'date', v: r.founded_date });
  if (type !== 'association') fields.push({ k: 'parent_org', l: 'Đơn vị chủ quản', v: r.parent_org });
  fields.push(
    { k: 'website', l: 'Website', v: r.website },
    { k: 'address', l: type === 'gov' ? 'Địa chỉ trụ sở' : type === 'association' ? 'Trụ sở văn phòng' : 'Địa chỉ', full: true, v: r.address },
  );
  if (type === 'gov') fields.push(
    { k: 'admin_level', l: 'Cấp quản lý', type: 'select', opts: ['', ...OPT.adminLevel], v: r.admin_level },
    { k: 'agency_block', l: 'Khối cơ quan', type: 'select', opts: ['', ...OPT.agencyBlock], v: r.agency_block },
    { k: 'contact_clerk', l: 'Đầu mối / văn thư tiếp nhận công văn', full: true, v: r.contact_clerk },
    { k: 'org_departments', l: 'Sơ đồ tổ chức — Phòng / Ban', type: 'textarea', full: true, v: r.org_departments },
    { k: 'org_leaders', l: 'Sơ đồ tổ chức — Lãnh đạo', type: 'textarea', full: true, v: r.org_leaders },
    { k: 'focal_partner_dev', l: 'Đầu mối: Ban Phát triển đối tác', v: r.focal_partner_dev },
    { k: 'focal_pr', l: 'Đầu mối: PR (nếu có)', v: r.focal_pr },
  );
  if (type === 'press') fields.push(
    { k: 'press_types', l: 'Loại hình (chọn nhiều)', type: 'checks', opts: OPT.pressTypes, v: parseJSON(r.press_types, []), full: true },
    { k: 'political_rank', l: 'Mức độ ảnh hưởng (xếp hạng)', type: 'select', opts: [['', '— Chưa xếp —'], ...['C1', 'C2', 'C3'].map((c) => [c, POLITICAL_RANK_DESC[c]])], v: r.political_rank },
    { k: 'charter', l: 'Tôn chỉ hoạt động', type: 'textarea', full: true, v: r.charter },
    { k: 'contract_term', l: 'Thời hạn hợp đồng đổi hàng', v: r.contract_term },
    { k: 'contract_staff', l: 'Nhân sự phụ trách', v: r.contract_staff },
    { k: 'contract_benefits', l: 'Quyền lợi hợp đồng', type: 'textarea', full: true, v: r.contract_benefits },
  );
  if (type === 'association') fields.push(
    { k: 'abbreviation', l: 'Tên viết tắt', v: r.abbreviation },
    { k: 'admin_level', l: 'Phân loại', type: 'select', opts: ['', ...OPT.adminLevel], v: r.admin_level },
    { k: 'field_area', l: 'Lĩnh vực hoạt động', v: r.field_area },
    { k: 'hotline', l: 'Hotline', v: r.hotline },
    { k: 'tax_code', l: 'Mã số thuế', v: r.tax_code },
    { k: 'misa_role', l: 'Vai trò MISA (loại hình hội viên)', v: r.misa_role },
    { k: 'join_date', l: 'Ngày/năm tham gia', type: 'date', v: r.join_date },
    { k: 'membership_fee', l: 'Hội phí (đ)', type: 'number', v: r.membership_fee === MASK ? '' : r.membership_fee, sens: true },
    { k: 'misa_current_role', l: 'Vai trò hiện tại của MISA', v: r.misa_current_role },
    { k: 'misa_events', l: 'Các sự kiện MISA tham gia trong năm', type: 'textarea', full: true, v: r.misa_events },
    { k: 'misa_awards', l: 'Các giải thưởng MISA đạt trong năm', type: 'textarea', full: true, v: r.misa_awards },
  );
  fields.push(caretakerField(r));
  fields.push({ k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note });
  openForm({
    title: r.id ? `Sửa ${meta.label.toLowerCase()}` : `Thêm ${meta.label.toLowerCase()}`, mod: 'partners',
    note: (type === 'press' && !r.id) ? 'Sau khi lưu, hệ thống mở trang chi tiết cơ quan — bấm "+ Thêm lãnh đạo" ở mục "Thông tin Ban lãnh đạo" để nhập ban lãnh đạo/phóng viên.' : undefined,
    fields,
    save: async (data) => {
      data.org_type = type;
      if (r.id) await api('PUT', `/partners/${r.id}`, data); else await api('POST', '/partners', data);
      if (r.id) VIEWS.partner(`partner/${r.id}`); else { location.hash = type; VIEWS[type](type); }
    },
  });
}
function sponsorshipForm(orgId, r = {}) {
  openForm({
    title: r.id ? 'Sửa tài trợ / giải thưởng' : 'Thêm tài trợ / giải thưởng', mod: 'partners',
    fields: [
      { k: 'title', l: 'Tên giải thưởng / sự kiện', full: true, req: true, v: r.title },
      { k: 'type', l: 'Loại', type: 'select', opts: OPT.sponsorType, v: r.type },
      { k: 'product', l: 'Sản phẩm tham gia (giải thưởng)', v: r.product },
      { k: 'category', l: 'Hạng mục tham gia', v: r.category },
      { k: 'scale', l: 'Quy mô (sự kiện)', v: r.scale },
      { k: 'sponsor_package', l: 'Gói tài trợ', v: r.sponsor_package },
      { k: 'amount', l: 'Chi phí tham gia / tài trợ (đ)', type: 'money', sens: true, v: r.amount === MASK ? '' : r.amount },
      { k: 'sponsor_benefits', l: 'Quyền lợi tài trợ', type: 'textarea', full: true, v: r.sponsor_benefits },
      { k: 'submit_deadline', l: 'Thời hạn nộp hồ sơ', type: 'date', v: r.submit_deadline },
      { k: 'present_deadline', l: 'Thời hạn thuyết trình', type: 'date', v: r.present_deadline },
      { k: 'event_date', l: 'Thời gian giải thưởng / ngày tổ chức', type: 'date', v: r.event_date },
      { k: 'result', l: 'Kết quả đạt giải', v: r.result },
      { k: 'contact_point', l: 'Đầu mối làm việc', v: r.contact_point },
      { k: 'staff', l: 'Nhân sự phụ trách', v: r.staff },
      { k: 'status', l: 'Trạng thái', type: 'select', opts: ['', 'Chưa thực hiện', 'Đang thực hiện', 'Đã hoàn thành'], v: r.status },
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note },
    ],
    save: async (data) => { if (r.id) await api('PUT', `/sponsorships/${r.id}`, data); else await api('POST', `/partners/${orgId}/sponsorships`, data); VIEWS.partner(`partner/${orgId}`); },
  });
}
function feeForm(orgId, r = {}) {
  openForm({
    title: r.id ? 'Sửa hội phí năm' : 'Thêm hội phí theo năm', mod: 'partners',
    fields: [
      { k: 'year', l: 'Năm', type: 'number', v: r.year || new Date(Date.now() + 7 * 3600 * 1000).getUTCFullYear(), req: true },
      { k: 'amount', l: 'Số tiền hội phí (đ)', type: 'money', v: r.amount === MASK ? '' : r.amount, sens: true },
      { k: 'due_date', l: 'Hạn đóng', type: 'date', v: r.due_date },
      { k: 'status', l: 'Trạng thái', type: 'select', opts: ['Chưa đóng', 'Đã đóng'], v: r.status || 'Chưa đóng' },
      { k: 'paid_date', l: 'Ngày đã đóng (nếu có)', type: 'date', v: r.paid_date },
      { k: 'staff', l: 'Nhân sự chạy quy trình', v: r.staff },
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note },
    ],
    save: async (data) => { if (r.id) await api('PUT', `/partners/${orgId}/fees/${r.id}`, data); else await api('POST', `/partners/${orgId}/fees`, data); VIEWS.partner(`partner/${orgId}`); },
  });
}

// ==================== ĐỐI TÁC BỘ NGÀNH (gov) — layout riêng ====================
function renderGovPartner(d, r, meta, row) {
  const canEdit = can('partners', 'edit');
  const reload = () => VIEWS.partner(`partner/${r.id}`);
  const fileLinks = (files) => (files || []).map((f) => `<a class="filechip" href="/api/files/${f.id}" target="_blank">📎 ${esc(f.original_name || 'Tệp')}</a>${canEdit ? ` <button class="btn sm danger micro" data-del-file="${f.id}">×</button>` : ''}`).join(' ');
  const agItem = (a) => `<div class="sub-list"><div class="item">
      <b>${esc(a.title)}</b>${canEdit ? `<span style="float:right;display:flex;gap:6px"><button class="btn sm" data-edit-ag="${a.id}">Sửa</button><button class="btn sm danger" data-del-ag="${a.id}">Xóa</button></span>` : ''}
      <div class="muted-sm">Ký: ${a.signed_date ? fmtDate(a.signed_date) : '—'} · Hiệu lực đến: ${a.valid_until ? fmtDate(a.valid_until) : '—'}</div>
      ${a.terms ? `<div style="margin-top:4px">${esc(a.terms)}</div>` : ''}${a.note ? `<div class="muted-sm">${esc(a.note)}</div>` : ''}
      <div class="doc-line">${fileLinks(a.files)}${canEdit ? `<button class="btn sm" data-up-ag="${a.id}">+ Tệp</button>` : ''}</div></div></div>`;
  const wlItem = (w) => `<div class="sub-list"><div class="item">
      <span class="badge b-blue">${esc(w.category || '—')}</span> <b>${esc(w.topic || '')}</b>${canEdit ? `<span style="float:right;display:flex;gap:6px"><button class="btn sm" data-edit-wl="${w.id}">Sửa</button><button class="btn sm danger" data-del-wl="${w.id}">Xóa</button></span>` : ''}
      <div class="muted-sm">${w.work_date ? fmtDate(w.work_date) : ''}${w.staff ? ' · ' + esc(w.staff) : ''}${w.status ? ` · <span class="badge b-gray">${esc(w.status)}</span>` : ''}</div>
      ${w.result ? `<div style="margin-top:2px">Kết quả: ${esc(w.result)}</div>` : ''}${w.note ? `<div class="muted-sm">${esc(w.note)}</div>` : ''}
      <div class="doc-line">${fileLinks(w.files)}${canEdit ? `<button class="btn sm" data-up-wl="${w.id}">+ Tệp</button>` : ''}</div></div></div>`;
  const peopleRows = (d.people || []).map((p) => `<div class="person-row" data-go="person/${p.id}">${avatarCell(p.primary_photo_id, p.full_name)}
    <div class="pr-main"><b>${esc(p.full_name)}</b><div class="muted-sm">${esc(p.position || p.level || '')}${p.phone_work ? ' · ' + esc(p.phone_work) : ''}</div></div></div>`).join('') || '<div class="empty">Chưa có thông tin lãnh đạo / đầu mối.</div>';
  $('#view').innerHTML = `
    <div class="page-head"><div><h2>${meta.ic} ${esc(r.name)}</h2>
      <div class="desc">${esc(meta.label)}${r.admin_level ? ' · ' + esc(r.admin_level) : ''}${r.agency_block ? ' · ' + esc(r.agency_block) : ''}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><a href="#gov" class="btn">‹ Danh sách</a>
      ${canEdit ? `<button class="btn primary" id="editBtn">Sửa cơ quan</button>` : ''}
      ${can('partners', 'delete') ? `<button class="btn danger" id="delBtn">Xóa</button>` : ''}</div></div>
    <div class="two-col">
      <div class="panel"><h3>Thông tin hành chính</h3><div class="detail-rows">
        ${row('Cấp quản lý', val(r.admin_level))}${row('Khối cơ quan', val(r.agency_block))}
        ${row('Ngày thành lập', valDate(r.founded_date))}${row('Đơn vị chủ quản', val(r.parent_org))}
        ${row('Địa chỉ trụ sở', val(r.address))}
        ${row('Website', r.website ? `<a href="https://${esc(r.website)}" target="_blank">${esc(r.website)}</a>` : '—')}
        ${row('Đầu mối / văn thư', val(r.contact_clerk))}${row('Ghi chú', val(r.note))}
      </div></div>
      <div class="panel"><h3>📅 Ngày cần nhắc / theo dõi</h3>
        <div class="muted-sm" style="margin-bottom:8px">Các mốc thời gian đã đặt nhắc cho cơ quan này (hạn gửi công văn, lịch làm việc, ngày kỷ niệm…). Tự đồng bộ sang mục <b>Lịch nhắc</b>.</div>
        ${d.dates.length ? d.dates.map((x) => `<div class="sub-list"><div class="item"><b>${esc(x.title)}</b><br><span class="muted-sm">${fmtDate(x.event_date)}${x.recurring ? ' · hằng năm' : ''}${x.note ? ' · ' + esc(x.note) : ''}</span></div></div>`).join('') : '<div class="empty">Chưa có mốc nhắc nào</div>'}
      </div>
    </div>
    <div class="panel"><h3>Sơ đồ tổ chức</h3><div class="detail-rows">
      ${row('Phòng / Ban', val(r.org_departments))}${row('Lãnh đạo', val(r.org_leaders))}
      ${row('Đầu mối: Ban PT đối tác', val(r.focal_partner_dev))}${row('Đầu mối: PR', val(r.focal_pr))}
    </div></div>
    <div class="panel"><h3>Lãnh đạo và đầu mối làm việc ${canEdit ? '<button class="btn sm" id="addGovPerson" style="float:right">+ Thêm đầu mối</button>' : ''}</h3>${peopleRows}</div>
    <div class="panel"><h3>Hồ sơ hợp tác &amp; thỏa thuận (MOU) ${canEdit ? `<button class="btn sm" id="addAg" style="float:right">+ Thêm</button>` : ''}</h3>
      ${d.agreements.length ? d.agreements.map(agItem).join('') : '<div class="empty">Chưa có thỏa thuận</div>'}
    </div>
    <div class="panel"><h3>Lịch sử làm việc ${canEdit ? `<button class="btn sm" id="addWl" style="float:right">+ Ghi làm việc</button>` : ''}</h3>
      ${d.workLogs.length ? d.workLogs.map(wlItem).join('') : '<div class="empty">Chưa có</div>'}
    </div>`;
  if ($('#editBtn')) $('#editBtn').onclick = () => orgForm('gov', r);
  if ($('#delBtn')) $('#delBtn').onclick = async () => { if (!confirm(`Xóa cơ quan "${r.name}"?`)) return; try { await api('DELETE', `/partners/${r.id}`); toast('Đã xóa'); location.hash = 'gov'; } catch (e) { toast(e.message, true); } };
  if ($('#addAg')) $('#addAg').onclick = () => agreementForm(r.id, reload);
  if ($('#addWl')) $('#addWl').onclick = () => workLogForm(r.id, reload);
  if ($('#addGovPerson')) $('#addGovPerson').onclick = () => personForm({ org_id: r.id }, r.id);
  $('#view').querySelectorAll('[data-go]').forEach((item) => item.onclick = () => (location.hash = item.dataset.go));
  $('#view').querySelectorAll('[data-del-ag]').forEach((b) => b.onclick = () => delConfirm(`/agreements/${b.dataset.delAg}`, reload, 'Xóa thỏa thuận này?'));
  $('#view').querySelectorAll('[data-del-wl]').forEach((b) => b.onclick = () => delConfirm(`/work-logs/${b.dataset.delWl}`, reload, 'Xóa mục làm việc này?'));
  $('#view').querySelectorAll('[data-edit-ag]').forEach((b) => b.onclick = () => agreementForm(r.id, reload, (d.agreements || []).find((x) => String(x.id) === b.dataset.editAg)));
  $('#view').querySelectorAll('[data-edit-wl]').forEach((b) => b.onclick = () => workLogForm(r.id, reload, (d.workLogs || []).find((x) => String(x.id) === b.dataset.editWl)));
  $('#view').querySelectorAll('[data-del-file]').forEach((b) => b.onclick = () => delConfirm(`/attachments/${b.dataset.delFile}`, reload, 'Xóa tệp này?'));
  $('#view').querySelectorAll('[data-up-ag]').forEach((b) => b.onclick = () => uploadFilesFor('agreements', b.dataset.upAg, reload));
  $('#view').querySelectorAll('[data-up-wl]').forEach((b) => b.onclick = () => uploadFilesFor('work-logs', b.dataset.upWl, reload));
}
async function delConfirm(path, after, msg) {
  if (!confirm(msg || 'Xóa mục này?')) return;
  try { await api('DELETE', path); if (after) after(); } catch (e) { toast(e.message, true); }
}
function uploadFilesFor(ownerKind, ownerId, after) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.multiple = true;
  inp.accept = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
  inp.onchange = async () => {
    if (!inp.files.length) return;
    try { await apiUpload(`/${ownerKind}/${ownerId}/files`, inp.files); toast('Đã tải tệp'); if (after) after(); }
    catch (e) { toast(e.message, true); }
  };
  inp.click();
}
function agreementForm(orgId, after, r = {}) {
  openForm({
    title: r.id ? 'Sửa thỏa thuận / MOU' : 'Thêm thỏa thuận / Biên bản ghi nhớ (MOU)', mod: 'partners',
    fields: [
      { k: 'title', l: 'Tên thỏa thuận / MOU', full: true, req: true, v: r.title },
      { k: 'signed_date', l: 'Ngày ký', type: 'date', v: r.signed_date },
      { k: 'valid_until', l: 'Hiệu lực đến', type: 'date', v: r.valid_until },
      { k: 'terms', l: 'Điều khoản quan trọng (hạn mức, nghĩa vụ, quyền lợi)', type: 'textarea', full: true, v: r.terms },
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note },
    ],
    save: async (data) => { if (r.id) await api('PUT', `/agreements/${r.id}`, data); else await api('POST', `/partners/${orgId}/agreements`, data); if (after) after(); },
  });
}
function workLogForm(orgId, after, r = {}) {
  openForm({
    title: r.id ? 'Sửa lịch sử làm việc' : 'Ghi lịch sử làm việc', mod: 'partners',
    fields: [
      { k: 'category', l: 'Phân loại', type: 'select', opts: OPT.workCategory, v: r.category },
      { k: 'work_date', l: 'Ngày thực hiện', type: 'date', v: r.work_date || todayGMT7() },
      { k: 'topic', l: 'Nội dung / Chủ đề trao đổi', full: true, req: true, v: r.topic },
      { k: 'result', l: 'Kết quả', full: true, v: r.result },
      { k: 'status', l: 'Trạng thái xử lý', type: 'select', opts: OPT.workStatus, v: r.status },
      { k: 'staff', l: 'Nhân sự phụ trách', v: r.staff || state.user.full_name },
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note },
    ],
    save: async (data) => { if (r.id) await api('PUT', `/work-logs/${r.id}`, data); else await api('POST', `/partners/${orgId}/work-logs`, data); if (after) after(); },
  });
}
// Quà tặng đối ngoại + lịch sử quyền lợi hợp đồng (báo chí)
function spItem(s) {
  const canEdit = can('partners', 'edit');
  const meta = [
    s.product ? `SP: ${esc(s.product)}` : '', s.category ? `Hạng mục: ${esc(s.category)}` : '',
    s.scale ? `Quy mô: ${esc(s.scale)}` : '', s.sponsor_package ? `Gói: ${esc(s.sponsor_package)}` : '',
    s.result ? `Kết quả: ${esc(s.result)}` : '', s.contact_point ? `Đầu mối: ${esc(s.contact_point)}` : '',
    s.staff ? `Phụ trách: ${esc(s.staff)}` : '',
  ].filter(Boolean).join(' · ');
  const deadlines = [
    s.submit_deadline ? `Nộp HS: ${fmtDate(s.submit_deadline)}` : '', s.present_deadline ? `Thuyết trình: ${fmtDate(s.present_deadline)}` : '',
  ].filter(Boolean).join(' · ');
  return `<div class="sub-list"><div class="item"><b>${esc(s.title)}</b> <span class="badge b-blue">${esc(s.type)}</span>${s.status ? ` <span class="badge b-gray">${esc(s.status)}</span>` : ''}${canEdit ? `<span style="float:right;display:flex;gap:6px"><button class="btn sm" data-sp-edit="${s.id}">Sửa</button><button class="btn sm danger" data-sp-del="${s.id}">Xóa</button></span>` : ''}<br><span class="muted-sm">${s.event_date ? fmtDate(s.event_date) : 'Chưa có ngày'} · ${money(s.amount)}</span>${meta ? `<br><span class="muted-sm">${meta}</span>` : ''}${deadlines ? `<br><span class="muted-sm">${deadlines}</span>` : ''}${s.sponsor_benefits ? `<br><span>Quyền lợi: ${esc(s.sponsor_benefits)}</span>` : ''}${s.note ? `<br><span class="muted-sm">${esc(s.note)}</span>` : ''}</div></div>`;
}
function giftItem(g, canEdit) {
  return `<div class="sub-list"><div class="item"><b>${esc(g.gift_type || 'Quà')}</b>${g.occasion ? ' <span class="badge b-gray">' + esc(g.occasion) + '</span>' : ''} · ${money(g.value)}${canEdit ? `<span style="float:right;display:flex;gap:6px"><button class="btn sm" data-edit-gift="${g.id}">Sửa</button><button class="btn sm danger" data-del-gift="${g.id}">Xóa</button></span>` : ''}<br><span class="muted-sm">${g.event_date ? fmtDate(g.event_date) : ''}${g.giver ? ' · ' + esc(g.giver) : ''}${g.note ? ' · ' + esc(g.note) : ''}</span></div></div>`;
}
function giftForm(scope, id, after, r = {}) {
  openForm({
    title: r.id ? 'Sửa quà tặng / chúc mừng' : 'Thêm quà tặng / chúc mừng', mod: 'partners',
    fields: [
      { k: 'occasion', l: 'Dịp', full: true, v: r.occasion },
      { k: 'gift_type', l: 'Loại', type: 'select', opts: OPT.giftType, v: r.gift_type },
      { k: 'value', l: 'Giá trị (đ)', type: 'money', sens: true, v: r.value === MASK ? '' : r.value },
      { k: 'giver', l: 'Nhân sự tặng', v: r.giver || state.user.full_name },
      { k: 'event_date', l: 'Ngày', type: 'date', v: r.event_date || todayGMT7() },
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note },
    ],
    save: async (data) => { if (r.id) await api('PUT', `/gifts/${r.id}`, data); else await api('POST', `/${scope}/${id}/gifts`, data); if (after) after(); },
  });
}
function benefitForm(orgId, after, r = {}) {
  openForm({
    title: r.id ? 'Sửa quyền lợi đã dùng' : 'Ghi sử dụng quyền lợi hợp đồng', mod: 'partners',
    fields: [
      { k: 'title', l: 'Nội dung quyền lợi đã dùng', full: true, req: true, v: r.title },
      { k: 'used_date', l: 'Ngày sử dụng', type: 'date', v: r.used_date || todayGMT7() },
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note },
    ],
    save: async (data) => { if (r.id) await api('PUT', `/benefit-usages/${r.id}`, data); else await api('POST', `/partners/${orgId}/benefit-usages`, data); if (after) after(); },
  });
}

// ==================== PEOPLE (danh bạ tổng + chi tiết) ====================
const psPeople = pageState();
VIEWS.people = async () => {
  await getAssignableUsers();
  let url = `/people?page=${psPeople.page}&search=${encodeURIComponent(psPeople.search)}`;
  if (psPeople.caretaker_id) url += `&caretaker_id=${encodeURIComponent(psPeople.caretaker_id)}`;
  const d = await api('GET', url);
  psPeople.total = d.total;
  const rows = d.rows.map((p) => `<tr data-id="${p.id}">
    <td class="cell-person">${avatarCell(p.primary_photo_id, p.full_name)}<span><b>${esc(p.full_name)}</b><div class="muted-sm">${esc(p.position || '')}</div></span></td>
    <td>${esc(p.org_name)}</td><td>${esc(p.level || '—')}</td><td>${esc(p.beat || '—')}</td>
    <td>${scoreBar(p.relationship_score)}</td><td>${val(p.phone_personal)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">Không có dữ liệu</td></tr>`;
  renderTable({
    title: 'Danh bạ nhân sự', desc: 'Tra cứu toàn bộ nhân sự (lãnh đạo, phóng viên, chuyên viên…) của mọi cơ quan.',
    mod: 'partners', ps: psPeople, onSearch: VIEWS.people, addLabel: 'Thêm nhân sự',
    head: '<th>Họ tên</th><th>Cơ quan</th><th>Cấp bậc</th><th>Mảng</th><th>Điểm QH</th><th>SĐT cá nhân 🔒</th>',
    rowsHtml: rows, sensitiveNote: sensitiveBanner(d.sensitiveVisible),
  });
  if ($('.toolbar')) {
    const caretakerOptions = (_assignableUsers || []).map((u) => [String(u.id), u.full_name]);
    const caretakerSelect = `<select id="fCaretaker" class="filter-sel"><option value="">Mọi người chăm sóc</option>${caretakerOptions.map(([id, name]) => `<option value="${esc(id)}"${String(psPeople.caretaker_id || '') === id ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select>`;
    $('.toolbar').appendChild(el(`<span class="caretaker-filter">${caretakerSelect}</span>`));
    $('#fCaretaker').onchange = (e) => { psPeople.caretaker_id = e.target.value; psPeople.page = 1; VIEWS.people(); };
  }
  if ($('#addBtn')) $('#addBtn').onclick = () => personForm({});
  $('#tbody').querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => (location.hash = `person/${tr.dataset.id}`));
};

VIEWS.person = async (key) => {
  const id = key.split('/')[1];
  const d = await api('GET', `/people/${id}`);
  const r = d.record;
  r._caretakers = (d.caretakers || []).map((c) => c.id);
  $('#crumb').textContent = `Nhân sự · ${r.full_name}`;
  const row = (k, v) => `<div class="k">${k}</div><div>${v}</div>`;
  const ottHtml = (() => {
    if (r.phone_ott === MASK) return `<span class="mask">${MASK}</span>`;
    const o = parseJSON(r.phone_ott, {}); const on = OPT.ott.filter(([k]) => o[k]);
    return on.length ? on.map(([, lbl]) => `<span class="chip ott">${esc(lbl)}</span>`).join('') : '—';
  })();
  const social = (label, v) => v ? row(label, val(v)) : '';
  const socialBlock = [['Facebook', r.social_facebook], ['Instagram', r.social_instagram], ['TikTok', r.social_tiktok], ['X (Twitter)', r.social_x], ['Threads', r.social_thread]];
  const anySocial = socialBlock.some(([, v]) => v) || !d.sensitiveVisible;
  const primaryPhoto = d.portraits.find((p) => p.is_primary) || d.portraits[0];

  $('#view').innerHTML = `
    <div class="page-head"><div style="display:flex;gap:14px;align-items:center">
      ${primaryPhoto ? `<img class="avatar-lg" src="/api/files/${primaryPhoto.id}" alt="" />` : `<span class="avatar-lg letter">${esc(r.full_name.trim().slice(0, 1).toUpperCase())}</span>`}
      <div><h2>${esc(r.full_name)}</h2><div class="desc">${esc(r.position || r.level || '')}${r.org_name ? ' · ' : ''}${r.org_id ? `<a href="#partner/${r.org_id}">${esc(r.org_name)}</a>` : ''}</div></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><a href="#people" class="btn">‹ Danh bạ</a>
      ${can('partners', 'edit') ? `<button class="btn primary" id="editBtn">Sửa</button>` : ''}
      ${can('partners', 'delete') ? `<button class="btn danger" id="delBtn">Xóa</button>` : ''}</div></div>
    ${sensitiveBanner(d.sensitiveVisible)}
    <div class="two-col">
      <div class="panel"><h3>Thông tin công khai</h3><div class="detail-rows">
        ${row('Cấp bậc', val(r.level))}${row('Chức vụ', val(r.position))}
        ${r.org_type === 'association' && r.assoc_position ? row('Chức vụ trong tổ chức', val(r.assoc_position)) : ''}${r.org_type === 'association' && r.external_position ? row('Chức vụ ngoài tổ chức', val(r.external_position)) : ''}${r.assoc_role ? row(r.org_type === 'association' ? 'Vai trò trong tổ chức' : 'Mô tả vai trò trong cơ quan', val(r.assoc_role)) : ''}
        ${r.org_type === 'association' ? row('Đơn vị công tác hiện tại', val(r.current_workplace)) + row('Năm tham gia tổ chức', val(r.assoc_join_year)) + row('Vai trò hiện tại', val(r.assoc_current_role)) + row('Sự kiện đã tham gia', val(r.assoc_events)) + row('Giải thưởng / ghi nhận', val(r.assoc_awards)) : ''}
        ${row('Mảng phụ trách', val(r.beat))}${row('Nhóm', val(r.category))}
        ${row('Giới tính', val(r.gender))}${row('Tình trạng hôn nhân', val(r.marital_status))}
        ${row('Điểm quan hệ', scoreBar(r.relationship_score))}${row('Trạng thái', statusBadge(r.status))}
        ${row('Email công việc', val(r.email_work))}${row('ĐT công việc', val(r.phone_work))}
        ${row('👥 Người chăm sóc', caretakerChips(d.caretakers))}
      </div></div>
      <div class="panel"><h3>🔒 Thông tin bảo mật</h3><div class="detail-rows">
        ${row('ĐT cá nhân', val(r.phone_personal))}${row('SĐT khác', val(r.phone_other))}
        ${row('OTT', ottHtml)}
        ${row('Ngày sinh', valDate(r.dob))}${row('Địa chỉ nhà', val(r.home_address))}
        ${row('STK ngân hàng', val(r.bank_account_number))}${row('Ngân hàng', val(r.bank_name))}
        ${row('Ghi chú đời tư', val(r.personal_notes))}
      </div>
      <h4 class="sub-h">Đặc điểm cá nhân</h4><div class="detail-rows">
        ${row('Tính cách', val(r.personality))}${row('Sở thích', val(r.hobbies))}
        ${row('Thói quen ăn uống', val(r.food_habits))}${row('Thông tin người thân', val(r.family_info))}
      </div>
      <h4 class="sub-h">Quan điểm &amp; quan hệ</h4><div class="detail-rows">
        ${row('Quan điểm truyền thông', val(r.media_stance))}${row('Mạng lưới quan hệ', val(r.relationship_network))}
        ${row('Địa điểm tiếp khách', val(r.meeting_places))}${row('Nguyên tắc tặng quà', val(r.gift_rules))}
      </div>
      <h4 class="sub-h">Mạng xã hội</h4><div class="detail-rows">
        ${d.sensitiveVisible ? socialBlock.map(([l, v]) => row(l, val(v))).join('') : row('Tài khoản MXH', `<span class="mask">${MASK}</span>`)}
      </div></div>
    </div>
    <div class="panel"><h3>📷 Ảnh chân dung <span class="muted-sm">(tối đa 5, bấm để chọn ảnh chính)</span>
      ${can('partners', 'edit') ? `<button class="btn sm" id="addPhoto" style="float:right">+ Tải ảnh</button>` : ''}</h3>
      <div class="gallery" id="gallery">${galleryHtml(d.portraits)}</div>
      <input type="file" id="photoInput" accept="image/*" multiple hidden />
    </div>
    <div class="panel"><h3>🪪 Giấy tờ tùy thân (CCCD / Hộ chiếu) — dữ liệu mật
      ${d.sensitiveVisible && can('partners', 'edit') ? `<button class="btn sm" id="addDoc" style="float:right">+ Tải giấy tờ</button>` : ''}</h3>
      ${d.sensitiveVisible
      ? (d.idDocs.length ? `<div class="doc-list">${d.idDocs.map((x) => `<div class="doc-item"><a href="/api/files/${x.id}" target="_blank">📄 ${esc(x.original_name || 'Tệp')}</a> ${can('partners', 'edit') ? `<button class="btn sm danger" data-del-doc="${x.id}">Xóa</button>` : ''}</div>`).join('')}</div>` : '<div class="empty">Chưa có giấy tờ</div>')
      : `<div class="empty">🔒 Bạn không có quyền xem giấy tờ tùy thân${d.idDocCount ? ` (${d.idDocCount} tệp đã ẩn)` : ''}.</div>`}
      <input type="file" id="docInput" accept="image/*,application/pdf" multiple hidden />
    </div>
    <div class="panel"><h3>🎁 Quà tặng / Chúc mừng ${can('partners', 'edit') ? `<button class="btn sm" id="addGiftP" style="float:right">+ Thêm</button>` : ''}</h3>
      ${(d.gifts || []).length ? d.gifts.map((g) => giftItem(g, can('partners', 'edit'))).join('') : '<div class="empty">Chưa có</div>'}
    </div>
    <div class="panel"><h3>💬 Lịch sử tương tác ${can('interactions', 'create') ? `<button class="btn sm" id="addInter" style="float:right">+ Ghi tương tác</button>` : ''}</h3>
      ${d.interactions.length ? d.interactions.map((i) => `<div class="sub-list"><div class="item"><b>${fmtDate(i.date)}</b> · ${esc(i.channel)} ${resultBadge(i.result)}<br>${esc(i.summary)}${i.next_task ? `<br><span class="muted-sm">➡ Tiếp theo: ${esc(i.next_task)}${i.next_due ? ' (hạn ' + fmtDate(i.next_due) + ')' : ''}${i.next_status ? ' · ' + esc(i.next_status) : ''}</span>` : ''}</div></div>`).join('') : '<div class="empty">Chưa có tương tác</div>'}
    </div>`;

  if ($('#addGiftP')) $('#addGiftP').onclick = () => giftForm('people', id, () => VIEWS.person(`person/${id}`));
  $('#view').querySelectorAll('[data-del-gift]').forEach((b) => b.onclick = () => delConfirm(`/gifts/${b.dataset.delGift}`, () => VIEWS.person(`person/${id}`), 'Xóa quà tặng này?'));
  if ($('#editBtn')) $('#editBtn').onclick = () => personForm(r, r.org_id);
  if ($('#delBtn')) $('#delBtn').onclick = async () => {
    if (!confirm(`Xóa nhân sự "${r.full_name}"? Ảnh/giấy tờ đính kèm cũng bị xóa.`)) return;
    try { await api('DELETE', `/people/${id}`); toast('Đã xóa nhân sự'); location.hash = r.org_id ? `partner/${r.org_id}` : 'people'; } catch (e) { toast(e.message, true); }
  };
  if ($('#addInter')) $('#addInter').onclick = () => interactionForm({ partner_type: 'person', partner_id: Number(id), partner_name: r.full_name }, {}, () => VIEWS.person(`person/${id}`));
  mountBookings('person', Number(id), r.full_name);
  bindGallery(id);
  // upload ảnh
  if ($('#addPhoto')) $('#addPhoto').onclick = () => $('#photoInput').click();
  if ($('#photoInput')) $('#photoInput').onchange = async (e) => {
    if (!e.target.files.length) return;
    try { await apiUpload(`/people/${id}/attachments?kind=portrait`, e.target.files); toast('Đã tải ảnh'); VIEWS.person(`person/${id}`); }
    catch (err) { toast(err.message, true); }
  };
  if ($('#addDoc')) $('#addDoc').onclick = () => $('#docInput').click();
  if ($('#docInput')) $('#docInput').onchange = async (e) => {
    if (!e.target.files.length) return;
    try { await apiUpload(`/people/${id}/attachments?kind=id_doc`, e.target.files); toast('Đã tải giấy tờ'); VIEWS.person(`person/${id}`); }
    catch (err) { toast(err.message, true); }
  };
  $('#view').querySelectorAll('[data-del-doc]').forEach((b) => b.onclick = async () => {
    if (!confirm('Xóa giấy tờ này?')) return;
    try { await api('DELETE', `/attachments/${b.dataset.delDoc}`); VIEWS.person(`person/${id}`); } catch (e) { toast(e.message, true); }
  });
};
function galleryHtml(portraits) {
  if (!portraits.length) return '<div class="empty">Chưa có ảnh chân dung</div>';
  return portraits.map((p) => `<div class="thumb ${p.is_primary ? 'primary' : ''}" data-att="${p.id}">
    <img src="/api/files/${p.id}" alt="" />
    ${p.is_primary ? '<span class="badge b-red tag">Ảnh chính</span>' : ''}
    ${can('partners', 'edit') ? `<div class="thumb-actions">${!p.is_primary ? `<button class="btn sm" data-primary="${p.id}">Đặt chính</button>` : ''}<button class="btn sm danger" data-del="${p.id}">Xóa</button></div>` : ''}
  </div>`).join('');
}
function bindGallery(personId) {
  $('#gallery').querySelectorAll('[data-primary]').forEach((b) => b.onclick = async (e) => {
    e.stopPropagation();
    try { await api('PUT', `/people/${personId}/attachments/${b.dataset.primary}/primary`); VIEWS.person(`person/${personId}`); } catch (err) { toast(err.message, true); }
  });
  $('#gallery').querySelectorAll('[data-del]').forEach((b) => b.onclick = async (e) => {
    e.stopPropagation();
    if (!confirm('Xóa ảnh này?')) return;
    try { await api('DELETE', `/attachments/${b.dataset.del}`); VIEWS.person(`person/${personId}`); } catch (err) { toast(err.message, true); }
  });
}

async function personForm(r = {}, lockOrg) {
  const orgs = (await api('GET', '/partners?pageSize=200')).rows;
  const orgOpts = orgs.map((o) => [o.id, `${o.name} (${(ORG_TYPE[o.org_type] || {}).label || o.org_type})`]);
  const selectedOrg = orgs.find((o) => String(o.id) === String(r.org_id || lockOrg));
  const orgType = selectedOrg && selectedOrg.org_type;
  await getAssignableUsers();
  const sv = (v) => (v === MASK ? '' : v);
  openForm({
    title: r.id ? 'Sửa nhân sự' : orgType === 'press' ? 'Thêm thông tin phóng viên' : 'Thêm nhân sự', mod: 'partners',
    note: !state.perms.canSeeSensitive ? 'Bạn không có quyền sửa các trường mật (để trống sẽ không thay đổi).' : '',
    fields: [
      { k: 'full_name', l: 'Họ tên', v: r.full_name, req: true },
      { k: 'org_id', l: 'Cơ quan', type: 'select', opts: orgOpts, v: r.org_id || lockOrg },
      { k: 'level', l: 'Cấp bậc', type: 'select', opts: OPT.level, v: r.level },
      { k: 'position', l: 'Chức vụ', v: r.position },
      { k: 'beat', l: 'Mảng phụ trách', v: r.beat },
      { k: 'category', l: 'Nhóm', type: 'select', opts: OPT.category, v: r.category },
      { k: 'gender', l: 'Giới tính', type: 'select', opts: ['', 'Nam', 'Nữ', 'Khác'], v: r.gender },
      { k: 'marital_status', l: 'Tình trạng hôn nhân', type: 'select', opts: ['', 'Độc thân', 'Đã kết hôn', 'Khác'], v: r.marital_status },
      ...(orgType === 'association' ? [
        { k: 'assoc_position', l: 'Chức vụ trong tổ chức', v: r.assoc_position },
        { k: 'external_position', l: 'Chức vụ ngoài tổ chức', v: r.external_position },
        { k: 'assoc_role', l: 'Vai trò trong tổ chức', v: r.assoc_role },
        { k: 'current_workplace', l: 'Đơn vị công tác hiện tại', v: r.current_workplace },
        { k: 'assoc_join_year', l: 'Năm tham gia tổ chức', type: 'number', v: r.assoc_join_year },
        { k: 'assoc_current_role', l: 'Vai trò hiện tại', v: r.assoc_current_role },
        { k: 'assoc_events', l: 'Sự kiện đã tham gia', type: 'textarea', full: true, v: r.assoc_events },
        { k: 'assoc_awards', l: 'Giải thưởng / ghi nhận', type: 'textarea', full: true, v: r.assoc_awards },
      ] : [{ k: 'assoc_role', l: 'Mô tả vai trò trong cơ quan', v: r.assoc_role }]),
      { k: 'relationship_score', l: 'Điểm quan hệ (0-100)', type: 'number', v: r.relationship_score },
      { k: 'status', l: 'Trạng thái', type: 'select', opts: OPT.jStatus, v: r.status },
      { k: 'email_work', l: 'Email công việc', v: r.email_work },
      { k: 'phone_work', l: 'ĐT công việc', v: r.phone_work },
      { k: 'phone_personal', l: 'ĐT cá nhân', v: sv(r.phone_personal), sens: true },
      { k: 'phone_other', l: 'SĐT khác', v: sv(r.phone_other), sens: true },
      { k: 'phone_ott', l: 'SĐT có dùng (OTT)', type: 'checks', opts: OPT.ott, v: (() => { const o = parseJSON(r.phone_ott, {}); return OPT.ott.map(([k]) => k).filter((k) => o[k]); })(), sens: true, full: true },
      { k: 'dob', l: 'Ngày sinh', type: 'date', v: sv(r.dob), sens: true },
      { k: 'home_address', l: 'Địa chỉ nhà riêng', v: sv(r.home_address), sens: true, full: true },
      { k: 'social_facebook', l: 'Facebook', v: sv(r.social_facebook), sens: true },
      { k: 'social_instagram', l: 'Instagram', v: sv(r.social_instagram), sens: true },
      { k: 'social_tiktok', l: 'TikTok', v: sv(r.social_tiktok), sens: true },
      { k: 'social_x', l: 'X (Twitter)', v: sv(r.social_x), sens: true },
      { k: 'social_thread', l: 'Threads', v: sv(r.social_thread), sens: true },
      { k: 'bank_account_number', l: 'Số tài khoản ngân hàng', v: sv(r.bank_account_number), sens: true },
      { k: 'bank_name', l: 'Ngân hàng', v: sv(r.bank_name), sens: true },
      { k: 'personal_notes', l: 'Ghi chú đời tư', type: 'textarea', v: sv(r.personal_notes), sens: true, full: true },
      { k: 'personality', l: 'Đặc điểm / Tính cách', v: sv(r.personality), sens: true },
      { k: 'hobbies', l: 'Sở thích', v: sv(r.hobbies), sens: true },
      { k: 'food_habits', l: 'Thói quen ăn uống', v: sv(r.food_habits), sens: true },
      { k: 'family_info', l: 'Thông tin người thân (sinh nhật con/vợ chồng…)', type: 'textarea', v: sv(r.family_info), sens: true, full: true },
      { k: 'media_stance', l: 'Quan điểm truyền thông', type: 'textarea', v: sv(r.media_stance), sens: true, full: true },
      { k: 'relationship_network', l: 'Mạng lưới quan hệ (Bộ/Ban/Ngành…)', type: 'textarea', v: sv(r.relationship_network), sens: true, full: true },
      { k: 'meeting_places', l: 'Địa điểm tiếp khách quen', v: sv(r.meeting_places), sens: true },
      { k: 'gift_rules', l: 'Nguyên tắc tặng quà', v: sv(r.gift_rules), sens: true },
      caretakerField(r),
    ],
    save: async (data) => {
      // OTT: mảng -> object {zalo:true,...}
      if (Array.isArray(data.phone_ott)) { const o = {}; data.phone_ott.forEach((k) => o[k] = true); data.phone_ott = o; }
      // Trường mật ngoài quyền được server tự bỏ qua (stripDisallowed) nên không lo ghi đè.
      let pid = r.id;
      if (r.id) await api('PUT', `/people/${r.id}`, data); else pid = (await api('POST', '/people', data)).id;
      location.hash = `person/${pid}`;
      if (location.hash === `#person/${pid}`) VIEWS.person(`person/${pid}`);
    },
  });
}

// ==================== REMINDERS (Sự kiện sắp tới) ====================
function reminderItem(r, withCard) {
  const dleft = r.daysUntil === 0 ? 'Hôm nay' : `Còn ${r.daysUntil} ngày`;
  const badgeCls = r.daysUntil <= 3 ? 'b-red' : r.daysUntil <= (r.lead_days || 7) ? 'b-amber' : 'b-gray';
  const tag = DATE_TYPE_LABEL[r.date_type] || 'Sự kiện';
  const extra = r.years && r.date_type === 'founding' ? ` · tròn ${r.years} năm` : (r.years && r.date_type === 'birthday' ? ` · ${r.years} tuổi` : '');
  let extraBtns = '';
  if (withCard) {
    const occ = (r.occurDate || '').replace(/-/g, '');
    const occEnd = occ ? (() => { const dt = new Date(Date.parse(r.occurDate) + 86400000); const p = (n) => String(n).padStart(2, '0'); return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}`; })() : '';
    const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(r.title || '')}&dates=${occ}/${occEnd}&details=${encodeURIComponent(r.note || '')}`;
    extraBtns = `<a class="btn sm" href="${gcal}" target="_blank" rel="noopener">📅 Calendar</a>
      <a class="btn sm" href="/api/reminders/${r.id}/ics">⬇ .ics</a>
      <button class="btn sm" data-card="1" data-title="${esc(r.title)}" data-dtype="${esc(r.date_type || '')}" data-subj="${esc(r.subject_name || '')}">🎁 Tạo thiệp</button>`;
  }
  return `<div class="sub-list"><div class="item rem-item">
    <div><b>${esc(r.title)}</b> <span class="badge b-blue">${esc(tag)}</span>
      <div class="muted-sm">${fmtDate(r.occurDate)}${extra}${r.subject_name ? ' · ' + esc(r.subject_name) : ''}${r.note ? ' · ' + esc(r.note) : ''}</div></div>
    <div class="rem-right"><span class="badge ${badgeCls}">${dleft}</span>${extraBtns}</div>
  </div></div>`;
}
VIEWS.reminders = async () => {
  $('#crumb').textContent = 'Sự kiện sắp tới';
  const [up, all] = await Promise.all([api('GET', '/reminders/upcoming?days=120'), api('GET', '/reminders')]);
  const canCreate = can('reminders', 'create');
  const canEdit = can('reminders', 'edit');
  const manageRows = all.rows.map((r) => `<tr>
    <td><b>${esc(r.title)}</b></td><td><span class="badge b-blue">${esc(DATE_TYPE_LABEL[r.date_type] || '—')}</span></td>
    <td>${fmtDate(r.event_date)}</td><td>${r.recurring ? 'Hằng năm' : 'Một lần'}</td><td>${r.lead_days} ngày</td>
    <td>${esc(r.subject_name || '—')}</td>
    <td><button class="btn sm" data-card="1" data-title="${esc(r.title)}" data-dtype="${esc(r.date_type || '')}" data-subj="${esc(r.subject_name || '')}">🎁 Thiệp</button>
      ${canEdit ? `<button class="btn sm" data-edit="${r.id}">Sửa</button> ${can('reminders', 'delete') ? `<button class="btn sm danger" data-del="${r.id}">Xóa</button>` : ''}` : ''}</td></tr>`).join('') || `<tr><td colspan="7" class="empty">Chưa có</td></tr>`;
  $('#view').innerHTML = `
    <div class="page-head"><div><h2>🔔 Sự kiện sắp tới</h2>
      <div class="desc">Nhắc sinh nhật, ngày thành lập, kỷ niệm ngành… để chăm sóc đối tác kịp thời.</div></div>
      ${canCreate ? `<button class="btn primary" id="addRem">+ Thêm ngày nhắc</button>` : ''}</div>
    <div class="banner">📌 <div>Đang hiển thị các sự kiện trong <b>120 ngày tới</b>. (Gửi email / đồng bộ Google Calendar / app mobile sẽ bổ sung ở giai đoạn sau.)</div></div>
    <div class="panel"><h3>Sắp diễn ra</h3>
      ${up.rows.length ? up.rows.map((r) => reminderItem(r, true)).join('') : '<div class="empty">Không có sự kiện nào trong 120 ngày tới</div>'}
    </div>
    <div class="panel"><h3>📋 Tất cả ngày nhắc</h3>
      <div class="table-wrap"><table><thead><tr><th>Tiêu đề</th><th>Loại</th><th>Ngày</th><th>Lặp</th><th>Báo trước</th><th>Đối tượng</th><th></th></tr></thead><tbody>${manageRows}</tbody></table></div>
    </div>`;
  if ($('#addRem')) $('#addRem').onclick = () => reminderForm({});
  $('#view').querySelectorAll('[data-card]').forEach((b) => b.onclick = () => cardModal({ title: b.dataset.title, date_type: b.dataset.dtype, subject_name: b.dataset.subj }));
  $('#view').querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => reminderForm(all.rows.find((x) => String(x.id) === b.dataset.edit)));
  $('#view').querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (!confirm('Xóa ngày nhắc này?')) return;
    try { await api('DELETE', `/reminders/${b.dataset.del}`); VIEWS.reminders(); } catch (e) { toast(e.message, true); }
  });
};
function reminderForm(r = {}) {
  openForm({
    title: r.id ? 'Sửa ngày nhắc' : 'Thêm ngày nhắc', mod: 'reminders',
    fields: [
      { k: 'title', l: 'Tiêu đề', full: true, v: r.title, req: true },
      { k: 'date_type', l: 'Loại sự kiện', type: 'select', opts: OPT.dateType, v: r.date_type },
      { k: 'event_date', l: 'Ngày sự kiện', type: 'date', v: r.event_date, req: true },
      { k: 'recurring', l: 'Lặp lại', type: 'select', opts: OPT.recurring, v: r.recurring == null ? 1 : r.recurring },
      { k: 'lead_days', l: 'Báo trước (ngày)', type: 'number', v: r.lead_days == null ? 7 : r.lead_days },
      { k: 'notify_repeat_count', l: 'Số lần nhắc', type: 'number', v: r.notify_repeat_count == null ? 1 : r.notify_repeat_count },
      { k: 'notify_repeat_every', l: 'Cách nhau (ngày)', type: 'number', v: r.notify_repeat_every == null ? 0 : r.notify_repeat_every },
      { k: 'subject_name', l: 'Đối tượng (người/cơ quan)', v: r.subject_name },
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note },
    ],
    save: async (data) => {
      data.subject_type = data.subject_type || 'general';
      if (r.id) await api('PUT', `/reminders/${r.id}`, data); else await api('POST', '/reminders', data);
      VIEWS.reminders();
    },
  });
}

// ---- Tạo thiệp chúc mừng bằng AI ----
function cardModal(ctx) {
  const modal = el(`<div class="modal-bg"><div class="modal" style="max-width:760px">
    <div class="mhead"><h3>🎁 Tạo thiệp chúc mừng — ${esc(ctx.title || '')}</h3><button class="x">&times;</button></div>
    <div class="mbody">
      <div class="field full"><label>Ý tưởng của bạn (tùy chọn)</label>
        <textarea id="cIdea" placeholder="VD: nhấn mạnh sự đồng hành nhiều năm, chúc sức khỏe & thành công…"></textarea></div>
      <div style="margin:6px 0 12px"><button class="btn" id="cSuggest">✨ AI gợi ý nội dung</button></div>
      <div class="field full"><label>Nội dung lời chúc (có thể sửa)</label>
        <textarea id="cText" style="min-height:140px" placeholder="Bấm 'AI gợi ý nội dung' hoặc tự nhập…"></textarea></div>
      <div style="margin:6px 0"><button class="btn primary" id="cGenImg">🎨 Tạo ảnh thiệp</button>
        <span class="muted-sm" id="cImgNote" style="margin-left:8px"></span></div>
      <div id="cViewer" class="card-viewer hidden">
        <div class="cv-toolbar">
          <button class="btn sm" id="cZoomOut">－</button><span id="cZoomLbl" class="muted-sm">100%</span><button class="btn sm" id="cZoomIn">＋</button>
          <span style="flex:1"></span>
          <a class="btn sm" id="cDownload" download="thiep-misa.jpg">⬇ Tải về</a>
          <button class="btn sm" id="cRegen">↻ Tạo lại</button>
        </div>
        <div class="cv-canvas"><img id="cImg" alt="Thiệp" /></div>
      </div>
    </div>
    <div class="mfoot"><button class="btn" data-close>Đóng</button></div>
  </div></div>`);
  $('#modalRoot').appendChild(modal);
  const q = (s) => modal.querySelector(s);
  const close = () => modal.remove();
  q('.x').onclick = close; q('[data-close]').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
  const context = `Thiệp ${(DATE_TYPE_LABEL[ctx.date_type] || 'chúc mừng').toLowerCase()}${ctx.subject_name ? ' gửi ' + ctx.subject_name : ''} — đại diện công ty công nghệ MISA. Sự kiện: ${ctx.title || ''}.`;

  q('#cSuggest').onclick = async () => {
    const btn = q('#cSuggest'); btn.disabled = true; const old = btn.textContent; btn.textContent = '⏳ Đang viết…';
    try {
      const d = await api('POST', '/ai/card-text', { title: ctx.title, date_type: ctx.date_type, subject_name: ctx.subject_name, idea: q('#cIdea').value });
      q('#cText').value = d.text || '';
    } catch (e) { toast(e.message, true); } finally { btn.disabled = false; btn.textContent = old; }
  };

  let zoom = 1;
  const applyZoom = () => { q('#cImg').style.width = (zoom * 100) + '%'; q('#cZoomLbl').textContent = Math.round(zoom * 100) + '%'; };
  q('#cZoomIn').onclick = () => { zoom = Math.min(4, zoom + 0.25); applyZoom(); };
  q('#cZoomOut').onclick = () => { zoom = Math.max(0.5, zoom - 0.25); applyZoom(); };

  const genImage = async () => {
    const text = q('#cText').value.trim();
    if (!text) { toast('Hãy tạo/nhập nội dung lời chúc trước.', true); return; }
    const btns = [q('#cGenImg'), q('#cRegen')];
    btns.forEach((b) => b && (b.disabled = true));
    q('#cImgNote').textContent = '⏳ Đang tạo ảnh (có thể mất ~10s)…';
    try {
      const d = await api('POST', '/ai/card-image', { text, context });
      q('#cImg').src = d.dataUrl; q('#cDownload').href = d.dataUrl;
      q('#cViewer').classList.remove('hidden'); zoom = 1; applyZoom();
      q('#cImgNote').textContent = d.usedLogo ? 'Đã dùng logo MISA chính thức.' : 'Logo do AI dựng (thả file public/assets/misa-logo.png để dùng logo thật).';
    } catch (e) { toast(e.message, true); q('#cImgNote').textContent = ''; }
    finally { btns.forEach((b) => b && (b.disabled = false)); }
  };
  q('#cGenImg').onclick = genImage;
  q('#cRegen').onclick = genImage;
}

// ==================== BOOKING ====================
function bookingBadge(s) {
  const m = { 'Đã đặt': 'b-amber', 'Đã đăng': 'b-blue', 'Đã nghiệm thu': 'b-green', 'Hủy': 'b-gray' };
  return `<span class="badge ${m[s] || 'b-gray'}">${esc(s || '—')}</span>`;
}
async function mountBookings(subjectType, subjectId, subjectName) {
  const panel = el(`<div class="panel" id="bookingPanel"><h3>📝 Booking bài viết ${can('partners', 'create') ? `<button class="btn sm" id="addBooking" style="float:right">+ Thêm booking</button>` : ''}</h3><div id="bookingBody"><div class="empty">Đang tải…</div></div></div>`);
  $('#view').appendChild(panel);
  const reload = async () => {
    const d = await api('GET', `/bookings?subject_type=${subjectType}&subject_id=${subjectId}`);
    const body = panel.querySelector('#bookingBody');
    if (!d.rows.length) { body.innerHTML = '<div class="empty">Chưa có booking</div>'; return; }
    body.innerHTML = `<div class="muted-sm" style="margin-bottom:8px">Tổng chi: <b>${money(d.total_amount)}</b> · ${d.rows.length} hợp đồng</div>
      <div class="table-wrap"><table><thead><tr><th>Nội dung</th><th>Loại</th><th>Số tiền</th><th>Book</th><th>Đăng</th><th>Trạng thái</th><th>Bài</th>${can('partners', 'edit') ? '<th></th>' : ''}</tr></thead><tbody>
      ${d.rows.map((b) => `<tr><td><b>${esc(b.title)}</b></td><td>${esc(b.content_type || '—')}</td><td>${money(b.amount)}</td><td>${valDate(b.booked_date)}</td><td>${valDate(b.publish_date)}</td><td>${bookingBadge(b.status)}</td>
        <td>${b.article_link ? `<a href="${esc(b.article_link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">link</a>` : '—'}</td>
        ${can('partners', 'edit') ? `<td><button class="btn sm" data-bk="${b.id}">Sửa</button></td>` : ''}</tr>`).join('')}
      </tbody></table></div>`;
    body.querySelectorAll('[data-bk]').forEach((btn) => btn.onclick = () => { const rec = d.rows.find((x) => String(x.id) === btn.dataset.bk); bookingForm(subjectType, subjectId, subjectName, rec, reload); });
  };
  if (panel.querySelector('#addBooking')) panel.querySelector('#addBooking').onclick = () => bookingForm(subjectType, subjectId, subjectName, {}, reload);
  reload();
}
async function bookingForm(subjectType, subjectId, subjectName, r = {}, after) {
  const awards = (await api('GET', '/awards?pageSize=200').catch(() => ({ rows: [] }))).rows || [];
  openForm({
    title: r.id ? 'Sửa booking' : 'Thêm booking bài viết', mod: 'partners', id: r.id,
    fields: [
      { k: 'title', l: 'Nội dung / Tên bài', full: true, v: r.title, req: true },
      { k: 'content_type', l: 'Loại', type: 'select', opts: OPT.bookingType, v: r.content_type },
      { k: 'amount', l: 'Số tiền (đ)', type: 'number', v: r.amount },
      { k: 'status', l: 'Trạng thái', type: 'select', opts: OPT.bookingStatus, v: r.status || 'Đã đặt' },
      { k: 'booked_date', l: 'Ngày book', type: 'date', v: r.booked_date },
      { k: 'publish_date', l: 'Ngày đăng', type: 'date', v: r.publish_date },
      { k: 'award_id', l: 'Truyền thông cho giải thưởng (nếu có)', type: 'select', opts: [['', '— Không —']].concat(awards.map((a) => [a.id, a.name])), v: r.award_id },
      { k: 'article_link', l: 'Link bài đã nghiệm thu', full: true, v: r.article_link },
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note },
    ],
    save: async (data) => {
      data.subject_type = subjectType; data.subject_id = subjectId; data.subject_name = subjectName;
      if (r.id) await api('PUT', `/bookings/${r.id}`, data); else await api('POST', '/bookings', data);
      if (after) after();
    },
  });
}

// ==================== REPORTS (Báo cáo) ====================
const psReports = (() => {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const y = now.getUTCFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: 'year' };
})();
function setReportRange(kind) {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const pad = (n) => String(n + 1).padStart(2, '0');
  if (kind === 'month') { psReports.from = `${y}-${pad(m)}-01`; psReports.to = `${y}-${pad(m)}-31`; }
  else if (kind === 'quarter') { const q = Math.floor(m / 3) * 3; psReports.from = `${y}-${pad(q)}-01`; psReports.to = `${y}-${pad(q + 2)}-31`; }
  else { psReports.from = `${y}-01-01`; psReports.to = `${y}-12-31`; }
  psReports.label = kind;
}
const RISK_BADGE = { 5: 'b-red', 4: 'b-red', 3: 'b-amber', 2: 'b-blue', 1: 'b-green' };

const REPORT_VIEWS = [['overview', 'Tổng quan'], ['staff', 'Theo nhân sự'], ['unit', 'Theo đơn vị'], ['budget', 'Ngân sách'], ['events', 'Sự kiện'], ['awards', 'Giải thưởng'], ['alerts', 'Cảnh báo']];
const ROLE_VI = { super_admin: 'Super Admin', pr_lead: 'Trưởng phòng PR', pr_staff: 'Chuyên viên PR', leader: 'Ban Lãnh đạo', viewer: 'Cộng tác viên' };
const kpiCard = (v, l, sub) => `<div class="stat"><div class="v">${v}</div><div class="l">${esc(l)}</div>${sub ? `<div class="muted-sm">${sub}</div>` : ''}</div>`;
const repQS = () => `from=${psReports.from}&to=${psReports.to}`;

VIEWS.reports = async () => {
  $('#crumb').textContent = 'Báo cáo';
  if (!psReports.view) psReports.view = 'overview';
  const periodBtn = (k, t) => `<button class="btn sm ${psReports.label === k ? 'primary' : ''}" data-range="${k}">${t}</button>`;
  const viewBtn = (k, t) => `<button class="btn sm ${psReports.view === k ? 'primary' : ''}" data-rview="${k}">${t}</button>`;
  $('#view').innerHTML = `
    <div class="page-head"><div><h2>📈 Báo cáo &amp; Dashboard</h2>
      <div class="desc">Góc nhìn đa chiều theo nhân sự, đơn vị, ngân sách, giải thưởng & cảnh báo.</div></div>
      <div class="rng-btns">${periodBtn('month', 'Tháng này')}${periodBtn('quarter', 'Quý này')}${periodBtn('year', 'Năm nay')}
        <button class="btn sm" id="rngPrint">🖨 In/PDF</button></div></div>
    <div class="rng-custom">
      <span class="muted-sm">Tùy chọn kỳ:</span>
      <input type="date" id="rngFrom" value="${esc(psReports.from)}" /><span class="muted-sm">→</span>
      <input type="date" id="rngTo" value="${esc(psReports.to)}" />
      <button class="btn sm primary" id="rngApply">Áp dụng</button>
      <span class="muted-sm" style="margin-left:auto">Đang xem: ${fmtDate(psReports.from)} → ${fmtDate(psReports.to)}</span>
    </div>
    <div class="rview-tabs">${REPORT_VIEWS.map(([k, t]) => viewBtn(k, t)).join('')}</div>
    <div id="repBody"><div class="empty">Đang tải…</div></div>`;
  $('#view').querySelectorAll('[data-range]').forEach((b) => b.onclick = () => { setReportRange(b.dataset.range); VIEWS.reports(); });
  $('#view').querySelectorAll('[data-rview]').forEach((b) => b.onclick = () => { psReports.view = b.dataset.rview; VIEWS.reports(); });
  if ($('#rngPrint')) $('#rngPrint').onclick = () => window.print();
  if ($('#rngApply')) $('#rngApply').onclick = () => {
    const f = $('#rngFrom').value, t = $('#rngTo').value;
    if (!f || !t) { toast('Chọn cả ngày bắt đầu và kết thúc', true); return; }
    if (f > t) { toast('Ngày bắt đầu phải trước ngày kết thúc', true); return; }
    psReports.from = f; psReports.to = t; psReports.label = 'custom'; VIEWS.reports();
  };
  const fn = { overview: repOverview, staff: repByStaff, unit: repByUnit, budget: repBudget, events: repEvents, awards: repAwards, alerts: repAlerts }[psReports.view] || repOverview;
  try { $('#repBody').innerHTML = await fn(); } catch (e) { $('#repBody').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
};

async function repOverview() {
  const d = await api('GET', `/reports?${repQS()}`); const sp = d.spend;
  const budgetPct = sp.budget ? Math.round((sp.total / sp.budget) * 100) : 0;
  const tierItems = [
    { label: 'Đồng hành chiến lược', value: d.tiers.t1 || 0, color: '#16a34a' },
    { label: 'Ủng hộ / Thiện chí', value: d.tiers.t2 || 0, color: '#2563eb' },
    { label: 'Trung lập cần nuôi dưỡng', value: d.tiers.t3 || 0, color: '#9ca3af' },
    { label: 'Theo dõi / Rủi ro cao', value: d.tiers.t4 || 0, color: '#dc2626' },
  ];
  return `
    <div class="cards">
      ${kpiCard(fmtMoney(d.grandTotal), 'TỔNG CHI (booking + sự kiện)', `Booking ${fmtMoney(sp.total)} · Sự kiện ${fmtMoney(d.events.total)}`)}
      ${kpiCard(fmtMoney(sp.budget), 'Ngân sách kỳ', sp.budget ? `Đã dùng ${budgetPct}%` : 'Chưa đặt')}
      ${kpiCard(d.network.press + '/' + d.network.people, 'Cơ quan báo chí / Nhân sự')}
      ${kpiCard('+' + d.network.newPeople, 'Nhân sự tạo mới trong kỳ')}
    </div>
    <div class="two-col">
      <div class="panel"><h3>💸 Chi tiêu theo tháng</h3>${svgLine(sp.byMonth.map((x) => ({ label: x.period.slice(5), value: x.amount })), { money: true })}</div>
      <div class="panel"><h3>🏢 Chi theo cơ quan</h3>${svgBar(sp.byOrg.map((o) => ({ label: o.name, value: o.amount })), { money: true })}</div>
    </div>
    <div class="two-col">
      <div class="panel"><h3>⭐ Phân cấp chất lượng mối quan hệ</h3>${svgDonut(tierItems)}</div>
      <div class="panel"><h3>🗂 Phân bổ theo Mảng phụ trách</h3>${svgBar(d.byBeat.map((b) => ({ label: b.name, value: b.cnt })))}</div>
    </div>
    <div class="panel"><h3>⚠️ Đầu mối lâu chưa tương tác</h3>
      <div class="table-wrap"><table><thead><tr><th>Phóng viên</th><th>Cơ quan</th><th>Mảng</th><th>Lần gần nhất</th><th>Mức độ</th><th>Gợi ý</th></tr></thead><tbody>
      ${d.careRisk.length ? d.careRisk.map((p) => `<tr><td><b>${esc(p.full_name)}</b></td><td>${esc(p.org_name || '—')}</td><td>${esc(p.beat || '—')}</td>
        <td>${p.days >= 999 ? 'Chưa có' : p.days + ' ngày trước'}</td><td><span class="badge ${RISK_BADGE[p.level]}">${esc(p.label)}</span></td><td>${esc(p.action || '')}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">Không có rủi ro</td></tr>'}
      </tbody></table></div>
    </div>`;
}

async function repByStaff() {
  const d = await api('GET', `/reports/by-staff?${repQS()}`);
  if (!d.rows.length) return '<div class="empty">Chưa có phân công/hoạt động trong kỳ.</div>';
  return `<div class="two-col"><div class="panel"><h3>💸 Chi phí booking theo nhân sự PR</h3>
      ${svgBar(d.rows.filter((r) => r.spend > 0).map((r) => ({ label: r.full_name, value: r.spend })), { money: true })}</div>
    <div class="panel"><h3>📋 Số đầu mối được giao</h3>
      ${svgBar(d.rows.map((r) => ({ label: r.full_name, value: r.assigned })))}</div></div>
    <div class="panel"><h3>👥 Chi tiết theo nhân sự</h3><div class="table-wrap"><table>
      <thead><tr><th>Nhân sự</th><th>Vai trò</th><th>Đầu mối (CQ/Người/Giải)</th><th>Chi phí booking</th><th>Lượt tương tác</th><th>Điểm QH TB</th><th>Quá hạn chăm</th></tr></thead><tbody>
      ${d.rows.map((r) => `<tr><td><b>${esc(r.full_name)}</b></td><td>${esc(ROLE_VI[r.role] || r.role)}</td>
        <td>${r.assigned} <span class="muted-sm">(${r.orgs}/${r.people}/${r.awards})</span></td>
        <td>${money(r.spend)}</td><td>${r.interactions}</td><td>${r.avgScore != null ? scoreBar(r.avgScore) : '—'}</td>
        <td>${r.overdue ? `<span class="badge b-amber">${r.overdue}</span>` : '0'}</td></tr>`).join('')}
      </tbody></table></div></div>`;
}

async function repByUnit() {
  const d = await api('GET', `/reports/by-unit?${repQS()}`);
  return `<div class="two-col"><div class="panel"><h3>💸 Chi theo đơn vị</h3>
      ${svgBar(d.rows.filter((r) => r.spend > 0).map((r) => ({ label: r.name, value: r.spend })), { money: true })}</div>
    <div class="panel"><h3>💬 Tương tác theo đơn vị</h3>
      ${svgBar(d.rows.filter((r) => r.inter_cnt > 0).map((r) => ({ label: r.name, value: r.inter_cnt })))}</div></div>
    <div class="panel"><h3>🏢 Chi tiết theo đơn vị</h3><div class="table-wrap"><table>
      <thead><tr><th>Đơn vị</th><th>Loại</th><th>Nhân sự</th><th>Tương tác</th><th>Booking</th><th>Chi</th><th>Người chăm sóc</th><th>Tương tác gần nhất</th></tr></thead><tbody>
      ${d.rows.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td>${esc((ORG_TYPE[r.org_type] || {}).label || r.org_type)}</td>
        <td>${r.people_cnt}</td><td>${r.inter_cnt}</td><td>${r.book_cnt}</td><td>${money(r.spend)}</td>
        <td>${r.caretakers.length ? r.caretakers.map((c) => `<span class="chip">${esc(c)}</span>`).join(' ') : '<span class="muted-sm">— chưa giao</span>'}</td>
        <td>${r.last_inter ? fmtDate(r.last_inter) : '<span class="muted-sm">Chưa có</span>'}</td></tr>`).join('')}
      </tbody></table></div></div>`;
}

async function repBudget() {
  const d = await api('GET', `/reports?${repQS()}`); const sp = d.spend;
  const budgetPct = sp.budget ? Math.round((sp.total / sp.budget) * 100) : 0;
  return `<div class="cards">
      ${kpiCard(fmtMoney(d.grandTotal), 'TỔNG CHI (booking+sự kiện+hội phí)')}
      ${kpiCard(fmtMoney(sp.total), 'Chi booking', `${sp.count} hợp đồng`)}
      ${kpiCard(fmtMoney(d.events.total), 'Chi sự kiện')}
      ${kpiCard(fmtMoney(d.fees.total), 'Hội phí hiệp hội')}
    </div>
    <div class="two-col"><div class="panel"><h3>🏢 Theo cơ quan/đơn vị</h3>${svgBar(sp.byOrg.map((o) => ({ label: o.name, value: o.amount })), { money: true })}</div>
      <div class="panel"><h3>🧑‍💼 Theo nhân sự PR (người tạo booking)</h3>${svgBar(sp.byStaff.map((o) => ({ label: o.name, value: o.amount })), { money: true })}</div></div>
    <div class="two-col"><div class="panel"><h3>📰 Theo loại bài</h3>${svgBar(sp.byType.map((o) => ({ label: o.name || '(Khác)', value: o.amount })), { money: true })}</div>
      <div class="panel"><h3>💳 Hội phí theo hiệp hội</h3>${svgBar((d.fees.byOrg || []).map((o) => ({ label: o.name, value: o.amount })), { money: true })}</div></div>`;
}

async function repEvents() {
  const d = await api('GET', `/reports?${repQS()}`); const ev = d.events;
  const catLabel = { sponsor: 'Tài trợ', organization: 'Tổ chức', media: 'Truyền thông' };
  const byCat = (ev.byCategory || []).map((c) => ({ label: catLabel[c.category] || c.category, value: c.amount }));
  if (!ev.byEvent.length) return '<div class="empty">Chưa có chi phí sự kiện trong kỳ.</div>';
  return `<div class="cards">${kpiCard(fmtMoney(ev.total), 'Tổng chi sự kiện trong kỳ')}${kpiCard(ev.byEvent.length, 'Số sự kiện')}</div>
    <div class="two-col">
      <div class="panel"><h3>📊 Chi theo nhóm hạng mục</h3>${svgBar(byCat, { money: true })}</div>
      <div class="panel"><h3>🎪 Chi theo sự kiện</h3>${svgBar(ev.byEvent.map((e) => ({ label: e.name, value: e.amount })), { money: true })}</div>
    </div>
    <div class="panel"><h3>Chi tiết chi phí sự kiện</h3><div class="table-wrap"><table>
      <thead><tr><th>Sự kiện</th><th>Vai trò</th><th>Tổng chi</th></tr></thead><tbody>
      ${ev.byEvent.map((e) => `<tr><td><b>${esc(e.name)}</b></td><td>${eventModeLabel(e.mode)}</td><td>${money(e.amount)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
}

async function repAwards() {
  const d = await api('GET', `/reports/awards?${repQS()}`);
  if (!d.rows.length) return '<div class="empty">Chưa có hoạt động giải thưởng trong kỳ.</div>';
  const total = d.rows.reduce((s, a) => s + a.totalCost, 0);
  return `<div class="cards">${kpiCard(d.rows.length, 'Giải thưởng trong kỳ')}${kpiCard(fmtMoney(total), 'Tổng chi cho giải thưởng')}</div>
    <div class="panel"><h3>🏆 Chi tiết giải thưởng</h3><div class="table-wrap"><table>
      <thead><tr><th>Giải thưởng</th><th>Trạng thái</th><th>Kết quả (theo năm)</th><th>Phí giải</th><th>Dự toán</th><th>Truyền thông</th><th>Tổng chi</th><th>Người chăm</th></tr></thead><tbody>
      ${d.rows.map((a) => `<tr><td><b>${esc(a.name)}</b><div class="muted-sm">${esc(a.organizer || '')}</div></td>
        <td>${awardStatusBadge(a.status)}</td>
        <td>${a.participations.map((p) => `${p.year}: ${esc(p.result || p.status)}`).join('<br>') || '—'}</td>
        <td>${money(a.cost)}</td><td>${money(a.partBudget)}</td><td>${money(a.mediaCost)}</td><td><b>${money(a.totalCost)}</b></td>
        <td>${a.caretakers.length ? a.caretakers.map((c) => `<span class="chip">${esc(c)}</span>`).join(' ') : '<span class="muted-sm">—</span>'}</td></tr>`).join('')}
      </tbody></table></div></div>`;
}

async function repAlerts() {
  const d = await api('GET', '/reports/care-alerts');
  const c = d.counts;
  const bBadge = { '1m': 'b-blue', '3m': 'b-amber', '6m': 'b-amber', '12m': 'b-red' };
  const bLabel = { '1m': '> 1 tháng', '3m': '> 3 tháng', '6m': '> 6 tháng', '12m': '> 12 tháng / chưa có' };
  return `<div class="cards">
      ${kpiCard(c['1m'], '> 1 tháng')}${kpiCard(c['3m'], '> 3 tháng')}${kpiCard(c['6m'], '> 6 tháng')}${kpiCard(c['12m'], '> 12 tháng / chưa có')}
    </div>
    <div class="panel"><h3>🔔 Quan hệ cần chăm sóc lại (lâu không tương tác/booking)</h3>
      <div class="table-wrap"><table><thead><tr><th>Đối tượng</th><th>Phân loại</th><th>Mức cảnh báo</th><th>Hoạt động gần nhất</th><th>Người chăm sóc</th></tr></thead><tbody>
      ${d.rows.length ? d.rows.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.sub || (x.type === 'person' ? 'Nhân sự' : 'Cơ quan'))}</td>
        <td><span class="badge ${bBadge[x.bucket]}">${bLabel[x.bucket]}</span></td>
        <td>${x.last ? fmtDate(x.last) + ` (${x.days}d)` : 'Chưa có'}</td>
        <td>${x.caretakers.length ? x.caretakers.map((c) => `<span class="chip">${esc(c)}</span>`).join(' ') : '<span class="muted-sm">— chưa giao</span>'}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">Tất cả đầu mối đều được chăm sóc gần đây 👍</td></tr>'}
      </tbody></table></div></div>`;
}

// ==================== AWARDS (Giải thưởng) ====================
function awardStatusBadge(s) { const m = { 'Sắp mở': 'b-blue', 'Đang nhận hồ sơ': 'b-green', 'Đã đóng': 'b-gray' }; return `<span class="badge ${m[s] || 'b-gray'}">${esc(s || '—')}</span>`; }
function reviewBadge(s) { const m = { 'Thô': 'b-amber', 'Đã duyệt': 'b-blue', 'Chuẩn hóa': 'b-green' }; return `<span class="badge ${m[s] || 'b-gray'}">${esc(s || 'Thô')}</span>`; }
function partBadge(s) { const m = { 'Đạt giải': 'b-green', 'Quyết định tham gia': 'b-blue', 'Đã nộp': 'b-blue', 'Đang cân nhắc': 'b-amber', 'Trượt': 'b-gray', 'Không tham gia': 'b-gray' }; return `<span class="badge ${m[s] || 'b-gray'}">${esc(s || '—')}</span>`; }
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const today = new Date(Date.now() + 7 * 3600 * 1000); today.setUTCHours(0, 0, 0, 0);
  const due = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Math.round((due - today) / 86400000);
}
function deadlineBadge(days) {
  if (days == null) return '<span class="muted-sm">—</span>';
  if (days < 0) return `<span class="badge b-gray">Quá hạn ${-days}d</span>`;
  const cls = days <= 7 ? 'b-red' : days <= 30 ? 'b-amber' : 'b-green';
  return `<span class="badge ${cls}">${days === 0 ? 'Hôm nay' : 'Còn ' + days + 'd'}</span>`;
}
const orgTypeLabel = (t) => (OPT.organizerType.find((o) => o[0] === t) || [, '—'])[1];

const psAwards = { search: '', type: '', status: '', deadline: '' };
VIEWS.awards = async (key) => {
  const parts = key.split('/');
  if (parts[1]) return awardDetail(parts[1]);
  $('#crumb').textContent = 'Giải thưởng';
  const qs = `search=${encodeURIComponent(psAwards.search)}&type=${psAwards.type}&status=${encodeURIComponent(psAwards.status)}&deadline=${psAwards.deadline}&pageSize=200`;
  const d = await api('GET', `/awards?${qs}`);
  const opt = (list, cur, anyLabel) => `<option value="">${anyLabel}</option>` + list.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(t)}</option>`; }).join('');
  const rows = d.rows.map((a) => `<tr data-id="${a.id}">
    <td><b>${esc(a.name)}</b>${a.scope === 'Quốc tế' ? ' <span class="badge b-blue">Quốc tế</span>' : ''}</td>
    <td>${esc(a.org_name || a.organizer || '—')}<div class="muted-sm">${orgTypeLabel(a.organizer_type)}</div></td>
    <td>${valDate(a.submission_deadline)} ${deadlineBadge(a.deadlineDays)}</td>
    <td>${a.cost != null ? money(a.cost) : '—'}</td>
    <td>${awardStatusBadge(a.status)}</td><td>${reviewBadge(a.review_status)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">Chưa có giải thưởng</td></tr>`;
  $('#view').innerHTML = `
    <div class="page-head"><div><h2>🏆 Giải thưởng &amp; Danh hiệu</h2>
      <div class="desc">Kho dữ liệu giải thưởng công nghệ, danh hiệu doanh nghiệp, thương hiệu (trong nước &amp; quốc tế).</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${can('awards', 'create') ? `<button class="btn" id="aiExtract">✨ AI bóc tách</button>` : ''}
        ${can('awards', 'create') ? `<button class="btn primary" id="addAward">+ Thêm giải thưởng</button>` : ''}</div></div>
    <div class="toolbar" style="flex-wrap:wrap;gap:8px">
      <input type="search" id="aSearch" placeholder="🔎 Tìm giải thưởng…" value="${esc(psAwards.search)}" />
      <select id="aType">${opt(OPT.organizerType, psAwards.type, 'Mọi đơn vị tổ chức')}</select>
      <select id="aStatus">${opt(OPT.awardStatus, psAwards.status, 'Mọi trạng thái')}</select>
      <select id="aDeadline">${opt([['soon', 'Hạn sắp tới (≤30 ngày)'], ['overdue', 'Đã quá hạn']], psAwards.deadline, 'Mọi hạn nộp')}</select>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Tên giải thưởng</th><th>Đơn vị tổ chức</th><th>Hạn nộp</th><th>Chi phí</th><th>Trạng thái</th><th>Duyệt</th></tr></thead><tbody id="tbody">${rows}</tbody></table></div>`;
  let timer;
  $('#aSearch').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { psAwards.search = e.target.value; VIEWS.awards('awards'); }, 320); });
  $('#aType').onchange = (e) => { psAwards.type = e.target.value; VIEWS.awards('awards'); };
  $('#aStatus').onchange = (e) => { psAwards.status = e.target.value; VIEWS.awards('awards'); };
  $('#aDeadline').onchange = (e) => { psAwards.deadline = e.target.value; VIEWS.awards('awards'); };
  if ($('#addAward')) $('#addAward').onclick = () => awardForm();
  if ($('#aiExtract')) $('#aiExtract').onclick = () => awardExtractModal();
  $('#tbody').querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => (location.hash = `awards/${tr.dataset.id}`));
};

async function awardDetail(id) {
  const d = await api('GET', `/awards/${id}`);
  const r = d.record;
  r._caretakers = (d.caretakers || []).map((c) => c.id);
  $('#crumb').textContent = `Giải thưởng · ${r.name}`;
  const row = (k, v) => `<div class="k">${k}</div><div>${v}</div>`;
  const partRows = d.participations.map((p) => `<div class="sub-list"><div class="item">
    <b>Năm ${esc(p.year || '—')}</b> ${partBadge(p.status)} ${p.budget != null ? '· ' + money(p.budget) : ''}
    ${can('awards', 'edit') ? `<span style="float:right"><button class="btn sm" data-pedit="${p.id}">Sửa</button> <button class="btn sm danger" data-pdel="${p.id}">✕</button></span>` : ''}
    <div class="muted-sm">${[p.products && 'SP: ' + esc(p.products), p.categories && 'Hạng mục: ' + esc(p.categories), p.result && 'KQ: ' + esc(p.result)].filter(Boolean).join(' · ') || '—'}</div>
    ${p.capability ? `<div class="muted-sm">Năng lực: ${esc(p.capability)}</div>` : ''}${p.plan ? `<div class="muted-sm">KH: ${esc(p.plan)}</div>` : ''}
  </div></div>`).join('') || '<div class="empty">Chưa có hồ sơ tham gia</div>';
  const attRows = d.attachments.length ? d.attachments.map((a) => `<div class="att-row"><a href="/api/files/${a.id}" target="_blank" rel="noopener">📄 ${esc(a.original_name || 'tài liệu')}</a>
    ${can('awards', 'edit') ? `<button class="btn sm danger" data-adel="${a.id}">✕</button>` : ''}</div>`).join('') : '<div class="empty">Chưa có tài liệu</div>';
  $('#view').innerHTML = `
    <div class="page-head"><div><h2>${esc(r.name)} ${reviewBadge(r.review_status)}</h2>
      <div class="desc">${esc(r.org_name || r.organizer || '')} · ${orgTypeLabel(r.organizer_type)} · ${esc(r.scope || '')}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><a href="#awards" class="btn">‹ Danh sách</a>
        ${r.submission_deadline && can('awards', 'view') ? `<button class="btn" id="remindBtn">📅 Nhắc hạn nộp</button>` : ''}
        ${can('awards', 'edit') ? `<button class="btn primary" id="editBtn">Sửa</button>` : ''}
        ${can('awards', 'delete') ? `<button class="btn danger" id="delBtn">Xóa</button>` : ''}</div></div>
    <div class="two-col">
      <div class="panel"><h3>Thông tin giải thưởng</h3><div class="detail-rows">
        ${row('Trạng thái', awardStatusBadge(r.status))}${row('Hạn nộp HS', valDate(r.submission_deadline) + ' ' + deadlineBadge(r.deadlineDays))}
        ${row('Quy mô', val(r.scale))}${row('Thời gian diễn ra', val(r.event_time))}
        ${row('Chi phí tham gia', r.cost != null ? money(r.cost) : '—')}${row('Phạm vi', val(r.scope))}
        ${row('Điều kiện', val(r.eligibility))}${row('Bộ tiêu chí', val(r.criteria))}
        ${row('Hồ sơ gồm', val(r.required_docs))}${row('Cơ cấu giải', val(r.prize_structure))}
        ${row('Phương thức ĐG', val(r.evaluation_method))}${row('Nguồn', r.source_url ? `<a href="${esc(r.source_url)}" target="_blank" rel="noopener">link</a>` : '—')}
        ${r.ai_summary ? row('Tóm tắt (AI)', val(r.ai_summary)) : ''}${r.note ? row('Ghi chú', val(r.note)) : ''}
        ${row('👥 Người chăm sóc', caretakerChips(d.caretakers))}
      </div></div>
      <div class="panel"><h3>🎯 Đề xuất tham gia của MISA ${can('awards', 'create') ? `<span style="float:right;display:flex;gap:6px"><button class="btn sm" id="aiAdvice">✨ AI gợi ý</button><button class="btn sm" id="addPart">+ Năm</button></span>` : ''}</h3>
        ${partRows}
        <h3 style="margin-top:16px">📎 Tài liệu / thông báo ${can('awards', 'edit') ? `<button class="btn sm" id="addFile" style="float:right">+ Tải lên</button>` : ''}</h3>
        ${attRows}
      </div>
    </div>`;
  if ($('#editBtn')) $('#editBtn').onclick = () => awardForm(r);
  if ($('#delBtn')) $('#delBtn').onclick = async () => { if (!confirm(`Xóa giải thưởng "${r.name}"?`)) return; try { await api('DELETE', `/awards/${id}`); toast('Đã xóa'); location.hash = 'awards'; } catch (e) { toast(e.message, true); } };
  if ($('#addPart')) $('#addPart').onclick = () => participationForm(id, {});
  if ($('#aiAdvice')) $('#aiAdvice').onclick = () => awardAdvice(id, r);
  if ($('#remindBtn')) $('#remindBtn').onclick = async () => { try { await api('POST', `/awards/${id}/remind`, {}); toast('Đã thêm nhắc hạn nộp vào "Sự kiện sắp tới"'); } catch (e) { toast(e.message, true); } };
  if ($('#addFile')) $('#addFile').onclick = () => uploadAwardFile(id);
  $('#view').querySelectorAll('[data-pedit]').forEach((b) => b.onclick = () => participationForm(id, d.participations.find((x) => String(x.id) === b.dataset.pedit)));
  $('#view').querySelectorAll('[data-pdel]').forEach((b) => b.onclick = async () => { if (!confirm('Xóa hồ sơ năm này?')) return; try { await api('DELETE', `/awards/${id}/participations/${b.dataset.pdel}`); awardDetail(id); } catch (e) { toast(e.message, true); } });
  $('#view').querySelectorAll('[data-adel]').forEach((b) => b.onclick = async () => { if (!confirm('Xóa tài liệu?')) return; try { await api('DELETE', `/attachments/${b.dataset.adel}`); awardDetail(id); } catch (e) { toast(e.message, true); } });
}

async function awardForm(r = {}) {
  const orgs = (await api('GET', '/partners?pageSize=200')).rows;
  await getAssignableUsers();
  openForm({
    title: r.id ? 'Sửa giải thưởng' : 'Thêm giải thưởng', mod: 'awards', wide: true,
    fields: [
      { k: 'name', l: 'Tên giải thưởng', full: true, v: r.name, req: true },
      { k: 'organizer', l: 'Đơn vị tổ chức', v: r.organizer },
      { k: 'organizer_type', l: 'Loại đơn vị', type: 'select', opts: [['', '—']].concat(OPT.organizerType), v: r.organizer_type },
      { k: 'org_id', l: 'Liên kết cơ quan (nếu có)', type: 'select', opts: [['', '— Không —']].concat(orgs.map((o) => [o.id, o.name])), v: r.org_id },
      { k: 'scope', l: 'Phạm vi', type: 'select', opts: OPT.scope, v: r.scope || 'Trong nước' },
      { k: 'scale', l: 'Quy mô', v: r.scale },
      { k: 'event_time', l: 'Thời gian diễn ra', v: r.event_time },
      { k: 'submission_deadline', l: 'Hạn nộp hồ sơ', type: 'date', v: r.submission_deadline },
      { k: 'cost', l: 'Chi phí tham gia (đ)', type: 'number', v: r.cost },
      { k: 'status', l: 'Trạng thái giải', type: 'select', opts: OPT.awardStatus, v: r.status || 'Sắp mở' },
      { k: 'review_status', l: 'Trạng thái duyệt', type: 'select', opts: OPT.reviewStatus, v: r.review_status || 'Thô' },
      { k: 'source_url', l: 'Nguồn (URL)', full: true, v: r.source_url },
      { k: 'eligibility', l: 'Điều kiện tham gia', type: 'textarea', full: true, v: r.eligibility },
      { k: 'criteria', l: 'Bộ tiêu chí đánh giá', type: 'textarea', full: true, v: r.criteria },
      { k: 'required_docs', l: 'Hồ sơ bao gồm', type: 'textarea', full: true, v: r.required_docs },
      { k: 'prize_structure', l: 'Cơ cấu giải thưởng', type: 'textarea', full: true, v: r.prize_structure },
      { k: 'evaluation_method', l: 'Phương thức đánh giá', type: 'textarea', full: true, v: r.evaluation_method },
      { k: 'ai_summary', l: 'Tóm tắt', type: 'textarea', full: true, v: r.ai_summary },
      caretakerField(r),
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note },
    ],
    save: async (data) => {
      let aid = r.id;
      if (r.id) await api('PUT', `/awards/${r.id}`, data); else aid = (await api('POST', '/awards', data)).id;
      location.hash = `awards/${aid}`; if (location.hash === `#awards/${aid}`) awardDetail(aid);
    },
  });
}

function participationForm(awardId, r = {}) {
  openForm({
    title: r.id ? 'Sửa hồ sơ tham gia' : 'Thêm hồ sơ tham gia (theo năm)', mod: 'awards',
    fields: [
      { k: 'year', l: 'Năm', type: 'number', v: r.year || new Date(Date.now() + 7 * 3600 * 1000).getUTCFullYear(), req: true },
      { k: 'status', l: 'Tình trạng tham gia', type: 'select', opts: OPT.partStatus, v: r.status },
      { k: 'products', l: 'Sản phẩm tham gia', v: r.products },
      { k: 'categories', l: 'Hạng mục tham gia', v: r.categories },
      { k: 'goal', l: 'Mục tiêu', v: r.goal },
      { k: 'purpose', l: 'Mục đích', v: r.purpose },
      { k: 'budget', l: 'Dự toán chi phí (đ)', type: 'number', v: r.budget },
      { k: 'capability', l: 'Đánh giá năng lực đạt giải', type: 'textarea', full: true, v: r.capability },
      { k: 'plan', l: 'Kế hoạch triển khai dự kiến', type: 'textarea', full: true, v: r.plan },
      { k: 'result', l: 'Kết quả', full: true, v: r.result },
    ],
    save: async (data) => { if (r.id) await api('PUT', `/awards/${awardId}/participations/${r.id}`, data); else await api('POST', `/awards/${awardId}/participations`, data); awardDetail(awardId); },
  });
}

function uploadAwardFile(awardId) {
  const inp = el('<input type="file" accept="image/*,application/pdf" multiple style="display:none">');
  document.body.appendChild(inp);
  inp.onchange = async () => {
    if (!inp.files.length) { inp.remove(); return; }
    const fd = new FormData(); [...inp.files].forEach((f) => fd.append('files', f));
    try { const res = await fetch(`/api/awards/${awardId}/files`, { method: 'POST', body: fd }); const d = await res.json(); if (!res.ok) throw new Error(d.error || 'Lỗi'); toast('Đã tải lên'); awardDetail(awardId); }
    catch (e) { toast(e.message, true); } finally { inp.remove(); }
  };
  inp.click();
}

async function awardAdvice(awardId, r) {
  toast('AI đang phân tích…');
  try {
    const d = await api('POST', '/ai/award-advice', { name: r.name, organizer: r.organizer, criteria: r.criteria, prize_structure: r.prize_structure });
    participationForm(awardId, { capability: d.capability, plan: d.plan, status: 'Đang cân nhắc' });
  } catch (e) { toast(e.message, true); }
}

// Modal AI bóc tách giải thưởng (dán văn bản / URL / file) -> điền sẵn awardForm
function awardExtractModal() {
  const modal = el(`<div class="modal-bg"><div class="modal" style="max-width:600px">
    <div class="mhead"><h3>✨ AI bóc tách giải thưởng</h3><button class="x">&times;</button></div>
    <div class="mbody">
      <div class="muted-sm" style="margin-bottom:8px">Dán nội dung thông báo, hoặc nhập URL, hoặc tải file (ảnh/PDF) — AI sẽ bóc tách thành các trường để bạn duyệt.</div>
      <div class="field full"><label>Dán nội dung thông báo</label><textarea id="exText" style="min-height:120px" placeholder="Dán thể lệ/thông báo giải thưởng…"></textarea></div>
      <div class="field full"><label>hoặc URL trang giải thưởng</label><input id="exUrl" placeholder="https://…" /></div>
      <div class="field full"><label>hoặc tải file (ảnh/PDF)</label><input id="exFile" type="file" accept="image/*,application/pdf" /></div>
    </div>
    <div class="mfoot"><button class="btn" data-close>Hủy</button><button class="btn primary" id="exGo">Bóc tách</button></div>
  </div></div>`);
  $('#modalRoot').appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.x').onclick = close; modal.querySelector('[data-close]').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
  modal.querySelector('#exGo').onclick = async () => {
    const btn = modal.querySelector('#exGo'); btn.disabled = true; btn.textContent = '⏳ Đang bóc tách…';
    try {
      const file = modal.querySelector('#exFile').files[0];
      const text = modal.querySelector('#exText').value.trim();
      const url = modal.querySelector('#exUrl').value.trim();
      let d;
      if (file) { const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/ai/award-extract', { method: 'POST', body: fd }); d = await res.json(); if (!res.ok) throw new Error(d.error || 'Lỗi'); }
      else if (text || url) d = await api('POST', '/ai/award-extract', { text, url });
      else { toast('Nhập nội dung, URL hoặc chọn file', true); btn.disabled = false; btn.textContent = 'Bóc tách'; return; }
      close();
      toast('AI đã bóc tách — vui lòng kiểm tra & lưu');
      awardForm(d.extracted || {});
    } catch (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Bóc tách'; }
  };
}

// ==================== EVENTS (Sự kiện) ====================
const eventModeLabel = (m) => (OPT.eventMode.find((x) => x[0] === m) || [, m])[1];
const psEvents = { search: '', mode: '', field: '', status: '' };
VIEWS.events = async (key) => {
  const parts = key.split('/');
  if (parts[1]) return eventDetail(parts[1]);
  $('#crumb').textContent = 'Sự kiện';
  const qs = `search=${encodeURIComponent(psEvents.search)}&mode=${psEvents.mode}&field=${encodeURIComponent(psEvents.field)}&status=${encodeURIComponent(psEvents.status)}&pageSize=200`;
  const d = await api('GET', `/events?${qs}`);
  const opt = (list, cur, anyLabel) => `<option value="">${anyLabel}</option>` + list.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(t)}</option>`; }).join('');
  const rows = d.rows.map((e) => `<tr data-id="${e.id}">
    <td><b>${esc(e.name)}</b><div class="muted-sm">${esc(e.location || '')}</div></td>
    <td><span class="badge ${e.mode === 'host' ? 'b-red' : 'b-blue'}">${eventModeLabel(e.mode)}</span></td>
    <td>${esc(e.field || '—')}</td>
    <td>${valDate(e.start_time)} ${deadlineBadge(e.daysToStart)}</td>
    <td>${money(e.total_cost)}</td><td>${esc(e.status || '—')}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">Chưa có sự kiện</td></tr>`;
  $('#view').innerHTML = `
    <div class="page-head"><div><h2>🎪 Sự kiện</h2><div class="desc">Quản lý sự kiện MISA tham gia / tổ chức: thông tin, tài chính, tài liệu.</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${can('events', 'create') ? `<button class="btn" id="aiEvent">AI tự điền</button>` : ''}
        ${can('events', 'create') ? `<button class="btn primary" id="addEvent">+ Thêm sự kiện</button>` : ''}</div></div>
    <div class="toolbar" style="flex-wrap:wrap;gap:8px">
      <input type="search" id="eSearch" placeholder="🔎 Tìm sự kiện…" value="${esc(psEvents.search)}" />
      <select id="eMode">${opt(OPT.eventMode, psEvents.mode, 'Tham gia & Tổ chức')}</select>
      <select id="eField">${opt(OPT.eventField, psEvents.field, 'Mọi lĩnh vực')}</select>
      <select id="eStatus">${opt(OPT.eventStatus, psEvents.status, 'Mọi trạng thái')}</select>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Tên sự kiện</th><th>Vai trò</th><th>Lĩnh vực</th><th>Thời gian</th><th>Tổng chi</th><th>Trạng thái</th></tr></thead><tbody id="tbody">${rows}</tbody></table></div>`;
  let timer;
  $('#eSearch').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { psEvents.search = e.target.value; VIEWS.events('events'); }, 320); });
  $('#eMode').onchange = (e) => { psEvents.mode = e.target.value; VIEWS.events('events'); };
  $('#eField').onchange = (e) => { psEvents.field = e.target.value; VIEWS.events('events'); };
  $('#eStatus').onchange = (e) => { psEvents.status = e.target.value; VIEWS.events('events'); };
  if ($('#addEvent')) $('#addEvent').onclick = () => eventForm();
  if ($('#aiEvent')) $('#aiEvent').onclick = () => eventExtractModal();
  $('#tbody').querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => (location.hash = `events/${tr.dataset.id}`));
};

function costTable(eventId, cat, list, total, canEdit) {
  const head = cat === 'sponsor' ? '<th>Nội dung</th><th>Danh vị</th><th>Quyền lợi</th><th>Số tiền</th>'
    : cat === 'organization' ? '<th>Hạng mục</th><th>Nhà cung cấp</th><th>Số tiền</th>'
    : '<th>Nội dung</th><th>Báo</th><th>Phóng viên</th><th>Link</th><th>Số tiền</th>';
  const cols = cat === 'sponsor' ? 4 : cat === 'organization' ? 3 : 5;
  const rows = list.map((c) => {
    const cells = cat === 'sponsor' ? `<td><b>${esc(c.title || '—')}</b></td><td>${esc(c.sponsor_tier || '—')}</td><td>${esc(c.sponsor_benefits || '—')}</td><td>${money(c.amount)}</td>`
      : cat === 'organization' ? `<td><b>${esc(c.title || '—')}</b></td><td>${esc(c.supplier_name || '—')}</td><td>${money(c.amount)}</td>`
      : `<td><b>${esc(c.title || '—')}</b></td><td>${esc(c.press_org || '—')}</td><td>${esc(c.journalist_name || '—')}</td><td>${c.article_link ? `<a href="${esc(c.article_link)}" target="_blank" rel="noopener">link</a>` : '—'}</td><td>${money(c.amount)}</td>`;
    return `<tr>${cells}${canEdit ? `<td><button class="btn sm" data-cedit="${c.id}" data-cat="${cat}">Sửa</button> <button class="btn sm danger" data-cdel="${c.id}">✕</button></td>` : ''}</tr>`;
  }).join('') || `<tr><td colspan="${cols + (canEdit ? 1 : 0)}" class="empty">Chưa có</td></tr>`;
  return `<div class="panel"><h3>${cat === 'sponsor' ? '💰 Chi phí tài trợ' : cat === 'organization' ? '🏗️ Chi phí tổ chức' : '📣 Chi phí truyền thông'}
      ${canEdit ? `<button class="btn sm" data-caddcost="${cat}" style="float:right">+ Thêm</button>` : ''}</h3>
    <div class="table-wrap"><table><thead><tr>${head}${canEdit ? '<th></th>' : ''}</tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="${cols - 1}" style="text-align:right;font-weight:700">Tổng ${COST_CAT[cat]}</td><td style="font-weight:700">${money(total)}</td>${canEdit ? '<td></td>' : ''}</tr></tfoot></table></div></div>`;
}

async function eventDetail(id) {
  const d = await api('GET', `/events/${id}`);
  const r = d.record; r._caretakers = (d.caretakers || []).map((c) => c.id);
  $('#crumb').textContent = `Sự kiện · ${r.name}`;
  const row = (k, v) => `<div class="k">${k}</div><div>${v}</div>`;
  const canEdit = can('events', 'edit');
  const linkList = (arr, ic) => { const a = parseJSON(arr, []); return a.length ? a.map((u) => `<div class="att-row"><a href="${esc(u)}" target="_blank" rel="noopener">${ic} ${esc(u)}</a></div>`).join('') : '<div class="muted-sm">—</div>'; };
  const docKind = (k) => k || 'Tài liệu';
  const attRows = d.attachments.length ? d.attachments.map((a) => `<div class="att-row"><a href="/api/files/${a.id}" target="_blank" rel="noopener">📄 <b>${esc(docKind(a.kind))}</b> · ${esc(a.original_name || '')}</a>
    ${canEdit ? `<button class="btn sm danger" data-adel="${a.id}">✕</button>` : ''}</div>`).join('') : '<div class="empty">Chưa có tài liệu</div>';
  $('#view').innerHTML = `
    <div class="page-head"><div><h2>${esc(r.name)} <span class="badge ${r.mode === 'host' ? 'b-red' : 'b-blue'}">${eventModeLabel(r.mode)}</span></h2>
      <div class="desc">${esc(r.field || '')} · ${esc(r.format || '')} · ${valDate(r.start_time)}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><a href="#events" class="btn">‹ Danh sách</a>
        ${r.start_time && can('events', 'view') ? `<button class="btn" id="remindBtn">📅 Nhắc</button>` : ''}
        ${canEdit ? `<button class="btn primary" id="editBtn">Sửa</button>` : ''}
        ${can('events', 'delete') ? `<button class="btn danger" id="delBtn">Xóa</button>` : ''}</div></div>
    <div class="cards">
      <div class="stat"><div class="v">${money(d.totals.grand)}</div><div class="l">TỔNG CHI SỰ KIỆN</div></div>
      <div class="stat"><div class="v">${money(d.totals.sponsor)}</div><div class="l">Tài trợ</div></div>
      <div class="stat"><div class="v">${money(d.totals.organization)}</div><div class="l">Tổ chức</div></div>
      <div class="stat"><div class="v">${money(d.totals.media)}</div><div class="l">Truyền thông</div></div>
    </div>
    <div class="two-col">
      <div class="panel"><h3>Thông tin sự kiện</h3><div class="detail-rows">
        ${row('Vai trò MISA', eventModeLabel(r.mode))}${row('Đơn vị tổ chức', val(r.org_name || r.organizer))}
        ${row('Lĩnh vực', val(r.field))}${row('Hình thức', val(r.format))}
        ${row('Thời gian', valDate(r.start_time) + (r.end_time ? ' → ' + valDate(r.end_time) : ''))}${row('Địa điểm', val(r.location))}
        ${row('Quy mô', (r.scale_attendees != null ? r.scale_attendees + ' khách' : '—'))}${row('So với năm trước', val(r.scale_compare))}
        ${row('Thành phần khách', val(r.guest_levels))}${row('Keynote lãnh đạo MISA', r.misa_keynotes != null && r.misa_keynotes !== '' ? r.misa_keynotes + ' bài' : '—')}
        ${row('Đánh giá/Mục tiêu', val(r.evaluation))}
        ${row('Nguồn/Landing', r.source_url ? `<a href="${esc(r.source_url)}" target="_blank" rel="noopener">link</a>` : '—')}
        ${row('👥 Người chăm sóc', caretakerChips(d.caretakers))}
      </div></div>
      <div class="panel"><h3>🔗 Link tư liệu</h3>
        <div class="muted-sm" style="font-weight:700;margin-top:4px">Ảnh sự kiện</div>${linkList(r.image_links, '🖼️')}
        <div class="muted-sm" style="font-weight:700;margin-top:8px">Video sự kiện</div>${linkList(r.video_links, '🎬')}
        <div class="muted-sm" style="font-weight:700;margin-top:8px">Key visual gian hàng</div>${r.keyvisual_link ? `<div class="att-row"><a href="${esc(r.keyvisual_link)}" target="_blank" rel="noopener">🎨 ${esc(r.keyvisual_link)}</a></div>` : '<div class="muted-sm">—</div>'}
        <h3 style="margin-top:14px">📎 Tài liệu ${canEdit ? `<button class="btn sm" id="addFile" style="float:right">+ Tải lên</button>` : ''}</h3>${attRows}
      </div>
    </div>
    ${costTable(id, 'sponsor', d.costs.sponsor || [], d.totals.sponsor, canEdit)}
    ${costTable(id, 'organization', d.costs.organization || [], d.totals.organization, canEdit)}
    ${costTable(id, 'media', d.costs.media || [], d.totals.media, canEdit)}`;
  if ($('#editBtn')) $('#editBtn').onclick = () => eventForm(r);
  if ($('#delBtn')) $('#delBtn').onclick = async () => { if (!confirm(`Xóa sự kiện "${r.name}"?`)) return; try { await api('DELETE', `/events/${id}`); toast('Đã xóa'); location.hash = 'events'; } catch (e) { toast(e.message, true); } };
  if ($('#remindBtn')) $('#remindBtn').onclick = async () => { try { await api('POST', `/events/${id}/remind`, {}); toast('Đã thêm nhắc vào Lịch nhắc'); } catch (e) { toast(e.message, true); } };
  if ($('#addFile')) $('#addFile').onclick = () => uploadEventFile(id);
  const allCosts = [...(d.costs.sponsor || []), ...(d.costs.organization || []), ...(d.costs.media || [])];
  $('#view').querySelectorAll('[data-caddcost]').forEach((b) => b.onclick = () => costForm(id, b.dataset.caddcost, {}));
  $('#view').querySelectorAll('[data-cedit]').forEach((b) => b.onclick = () => costForm(id, b.dataset.cat, allCosts.find((x) => String(x.id) === b.dataset.cedit)));
  $('#view').querySelectorAll('[data-cdel]').forEach((b) => b.onclick = async () => { if (!confirm('Xóa dòng chi phí?')) return; try { await api('DELETE', `/events/${id}/costs/${b.dataset.cdel}`); eventDetail(id); } catch (e) { toast(e.message, true); } });
  $('#view').querySelectorAll('[data-adel]').forEach((b) => b.onclick = async () => { if (!confirm('Xóa tài liệu?')) return; try { await api('DELETE', `/attachments/${b.dataset.adel}`); eventDetail(id); } catch (e) { toast(e.message, true); } });
}

async function eventForm(r = {}) {
  const orgs = (await api('GET', '/partners?pageSize=200')).rows;
  await getAssignableUsers();
  openForm({
    title: r.id ? 'Sửa sự kiện' : 'Thêm sự kiện', mod: 'events', wide: true,
    fields: [
      { k: 'name', l: 'Tên sự kiện', full: true, v: r.name, req: true },
      { k: 'mode', l: 'Vai trò MISA', type: 'select', opts: OPT.eventMode, v: r.mode || 'join' },
      { k: 'field', l: 'Lĩnh vực', type: 'select', opts: OPT.eventField, v: r.field },
      { k: 'organizer', l: 'Đơn vị tổ chức', v: r.organizer },
      { k: 'organizer_org_id', l: 'Liên kết cơ quan (nếu có)', type: 'select', opts: [['', '— Không —']].concat(orgs.map((o) => [o.id, o.name])), v: r.organizer_org_id },
      { k: 'format', l: 'Hình thức', type: 'select', opts: OPT.eventFormat, v: r.format || 'Offline' },
      { k: 'start_time', l: 'Ngày bắt đầu', type: 'date', v: r.start_time ? String(r.start_time).slice(0, 10) : '' },
      { k: 'end_time', l: 'Ngày kết thúc', type: 'date', v: r.end_time ? String(r.end_time).slice(0, 10) : '' },
      { k: 'location', l: 'Địa điểm', full: true, v: r.location },
      { k: 'scale_attendees', l: 'Quy mô (số khách)', type: 'number', v: r.scale_attendees },
      { k: 'scale_compare', l: 'So với năm trước', v: r.scale_compare },
      { k: 'misa_keynotes', l: 'Số bài keynote/phát biểu của lãnh đạo MISA', type: 'number', v: r.misa_keynotes },
      { k: 'guest_levels', l: 'Thành phần khách mời', full: true, v: r.guest_levels },
      { k: 'status', l: 'Trạng thái', type: 'select', opts: OPT.eventStatus, v: r.status || 'Sắp diễn ra' },
      { k: 'source_url', l: 'Link nguồn / landing', full: true, v: r.source_url },
      { k: 'evaluation', l: 'Đánh giá / Mục tiêu / Thông điệp', type: 'textarea', full: true, v: r.evaluation },
      { k: 'image_links', l: 'Link ảnh sự kiện (mỗi dòng 1 link)', type: 'textarea', full: true, v: parseJSON(r.image_links, []).join('\n') },
      { k: 'video_links', l: 'Link video sự kiện (mỗi dòng 1 link)', type: 'textarea', full: true, v: parseJSON(r.video_links, []).join('\n') },
      { k: 'keyvisual_link', l: 'Link key visual gian hàng', full: true, v: r.keyvisual_link },
      caretakerField(r),
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note },
    ],
    save: async (data) => {
      data.image_links = String(data.image_links || '').split('\n').map((s) => s.trim()).filter(Boolean);
      data.video_links = String(data.video_links || '').split('\n').map((s) => s.trim()).filter(Boolean);
      let eid = r.id;
      if (r.id) await api('PUT', `/events/${r.id}`, data); else eid = (await api('POST', '/events', data)).id;
      location.hash = `events/${eid}`; if (location.hash === `#events/${eid}`) eventDetail(eid);
    },
  });
}

async function costForm(eventId, cat, r = {}) {
  let supplierOpts = [];
  if (cat === 'organization') supplierOpts = [['', '— Chọn NCC —']].concat(((await api('GET', '/suppliers/list')).rows).map((s) => [s.id, s.name]));
  const fields = [{ k: 'title', l: cat === 'organization' ? 'Hạng mục' : 'Nội dung', full: true, v: r.title, req: true }];
  if (cat === 'sponsor') { fields.push({ k: 'sponsor_tier', l: 'Danh vị tài trợ', type: 'select', opts: OPT.sponsorTier, v: r.sponsor_tier }); fields.push({ k: 'sponsor_benefits', l: 'Quyền lợi tài trợ', type: 'textarea', full: true, v: r.sponsor_benefits }); }
  if (cat === 'organization') fields.push({ k: 'supplier_id', l: 'Nhà cung cấp', type: 'select', opts: supplierOpts, v: r.supplier_id });
  if (cat === 'media') { fields.push({ k: 'press_org', l: 'Đơn vị báo chí', v: r.press_org }); fields.push({ k: 'journalist_name', l: 'Phóng viên', v: r.journalist_name }); fields.push({ k: 'article_link', l: 'Link nghiệm thu', full: true, v: r.article_link }); }
  fields.push({ k: 'amount', l: 'Số tiền (đ)', type: 'number', v: r.amount });
  fields.push({ k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note });
  openForm({
    title: `${r.id ? 'Sửa' : 'Thêm'} chi phí ${COST_CAT[cat]}`, mod: 'events', fields,
    save: async (data) => { data.category = cat; if (r.id) await api('PUT', `/events/${eventId}/costs/${r.id}`, data); else await api('POST', `/events/${eventId}/costs`, data); eventDetail(eventId); },
  });
}

function uploadEventFile(eventId) {
  const kind = prompt('Loại tài liệu (vd: Hợp đồng, Hóa đơn, Agenda, Dự toán, Bài diễn giả…):', 'Tài liệu');
  if (kind === null) return;
  const inp = el('<input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" multiple style="display:none">');
  document.body.appendChild(inp);
  inp.onchange = async () => {
    if (!inp.files.length) { inp.remove(); return; }
    const fd = new FormData(); [...inp.files].forEach((f) => fd.append('files', f));
    try { const res = await fetch(`/api/events/${eventId}/files?kind=${encodeURIComponent(kind || 'Tài liệu')}`, { method: 'POST', body: fd }); const d = await res.json(); if (!res.ok) throw new Error(d.error || 'Lỗi'); toast('Đã tải lên'); eventDetail(eventId); }
    catch (e) { toast(e.message, true); } finally { inp.remove(); }
  };
  inp.click();
}

function eventExtractModal() {
  const modal = el(`<div class="modal-bg"><div class="modal" style="max-width:600px">
    <div class="mhead"><h3>AI tự điền thông tin sự kiện</h3><button class="x" aria-label="Đóng">&times;</button></div>
    <div class="mbody">
      <div class="extract-help">Bạn chỉ cần chọn file Excel đang sử dụng. File gốc không được lưu lại; email, số điện thoại và trang danh sách liên hệ sẽ được ẩn trước khi phân tích.</div>
      <div class="field full"><label for="exFile">Chọn file Excel hoặc CSV</label><input id="exFile" type="file" accept=".xlsx,.xls,.xlsb,.csv" /><div id="exFileInfo" class="muted-sm">Dung lượng tối đa 10 MB.</div></div>
      <div class="field full"><label>hoặc dán nội dung</label><textarea id="exText" style="min-height:110px" placeholder="Dán nội dung kế hoạch sự kiện…"></textarea></div>
      <div id="exProgress" class="extract-progress hidden" role="status" aria-live="polite"><div class="extract-progress-track"><span></span></div><div id="exProgressText">Đang đọc tài liệu và tự điền thông tin…</div></div>
    </div>
    <div class="mfoot"><button class="btn" data-close>Hủy</button><button class="btn primary" id="exGo">Tự điền</button></div>
  </div></div>`);
  $('#modalRoot').appendChild(modal);
  let controller = null;
  const close = () => { if (controller) controller.abort(); modal.remove(); };
  modal.querySelector('.x').onclick = close; modal.querySelector('[data-close]').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) toast('Bấm Hủy hoặc nút Đóng để thoát cửa sổ này.'); };
  modal.querySelector('#exFile').onchange = (e) => {
    const file = e.target.files[0];
    const info = modal.querySelector('#exFileInfo');
    if (!file) { info.textContent = 'Dung lượng tối đa 10 MB.'; return; }
    if (file.size > 10 * 1024 * 1024) {
      e.target.value = '';
      info.textContent = 'File vượt quá 10 MB. Hãy xóa bớt ảnh hoặc chọn bản rút gọn.';
      toast(info.textContent, true);
      return;
    }
    info.textContent = `${file.name} · ${(file.size / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`;
  };
  modal.querySelector('#exGo').onclick = async () => {
    const btn = modal.querySelector('#exGo');
    const progress = modal.querySelector('#exProgress');
    const progressText = modal.querySelector('#exProgressText');
    btn.disabled = true; btn.textContent = 'Đang tự điền…'; progress.classList.remove('hidden');
    controller = new AbortController();
    const slowTimer = setTimeout(() => { progressText.textContent = 'Tài liệu có nhiều dữ liệu, hệ thống vẫn đang xử lý…'; }, 5000);
    try {
      const file = modal.querySelector('#exFile').files[0];
      const text = modal.querySelector('#exText').value.trim();
      let d;
      if (file) { const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/ai/event-extract', { method: 'POST', body: fd, signal: controller.signal }); d = await res.json(); if (!res.ok) throw new Error(d.error || 'Không thể đọc tài liệu.'); }
      else if (text) d = await api('POST', '/ai/event-extract', { text });
      else { toast('Chọn file hoặc dán nội dung', true); btn.disabled = false; btn.textContent = 'Tự điền'; return; }
      close();
      const miss = (d.missing || []).length;
      if ((d.warnings || []).length) toast(d.warnings[0]);
      else toast(miss ? `Đã tự điền. Còn ${miss} trường cần bạn bổ sung.` : 'Đã tự điền. Bạn hãy kiểm tra trước khi lưu.');
      eventForm(d.extracted || {});
    } catch (e) {
      if (e.name !== 'AbortError') toast(e.message, true);
      btn.disabled = false; btn.textContent = 'Tự điền';
    } finally {
      clearTimeout(slowTimer);
      controller = null;
      progress.classList.add('hidden');
      progressText.textContent = 'Đang đọc tài liệu và tự điền thông tin…';
    }
  };
}

// ==================== SUPPLIERS (Nhà cung cấp) ====================
const psSup = pageState();
VIEWS.suppliers = async (key) => {
  const parts = key.split('/');
  if (parts[1]) return supplierDetail(parts[1]);
  let url = `/suppliers?page=${psSup.page}&search=${encodeURIComponent(psSup.search)}`;
  if (psSup.industry) url += `&industry=${encodeURIComponent(psSup.industry)}`;
  const d = await api('GET', url);
  psSup.total = d.total;
  const rows = d.rows.map((s) => `<tr data-id="${s.id}"><td><b>${esc(s.name)}</b></td>
    <td>${esc(s.address || '—')}</td>
    <td>${s.industry ? `<span class="badge b-blue">${esc(s.industry)}</span>` : '—'}</td>
    <td>${esc(s.services || '—')}</td><td>${esc(s.tax_code || '—')}</td><td>${esc(s.invoice_type || '—')}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">Chưa có nhà cung cấp</td></tr>`;
  renderTable({ title: 'Nhà cung cấp', desc: 'Danh bạ nhà cung cấp dịch vụ tổ chức sự kiện (lĩnh vực, dịch vụ, báo giá, hóa đơn).', mod: 'suppliers', ps: psSup, onSearch: () => VIEWS.suppliers('suppliers'),
    head: '<th>Tên NCC</th><th>Địa chỉ</th><th>Lĩnh vực</th><th>Dịch vụ</th><th>MST</th><th>Xuất hóa đơn</th>', rowsHtml: rows });
  if ($('.toolbar')) {
    const sel = el(`<select id="fInd" class="filter-sel"><option value="">Mọi lĩnh vực</option>${OPT.supplierIndustry.map((o) => `<option value="${esc(o)}"${psSup.industry === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`);
    $('.toolbar').appendChild(sel);
    $('#fInd').onchange = (e) => { psSup.industry = e.target.value; psSup.page = 1; VIEWS.suppliers('suppliers'); };
  }
  if ($('#addBtn')) $('#addBtn').onclick = () => supplierForm();
  $('#tbody').querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => (location.hash = `suppliers/${tr.dataset.id}`));
};
async function supplierDetail(id) {
  const d = await api('GET', `/suppliers/${id}`); const r = d.record;
  $('#crumb').textContent = `Nhà cung cấp · ${r.name}`;
  const row = (k, v) => `<div class="k">${k}</div><div>${v}</div>`;
  const canEdit = can('suppliers', 'edit');
  const qRows = d.quotes.map((q) => `<tr><td>${q.stt || ''}</td><td>${esc(q.item || '')}</td><td>${esc(q.unit || '')}</td><td>${q.qty || ''}</td><td>${money(q.unit_price)}</td>
    ${canEdit ? `<td><button class="btn sm danger" data-qdel="${q.id}">✕</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="${canEdit ? 6 : 5}" class="empty">Chưa có báo giá</td></tr>`;
  const fRows = d.files.length ? d.files.map((f) => `<div class="att-row"><a href="/api/files/${f.id}" target="_blank" rel="noopener">📄 ${esc(f.original_name || 'báo giá')}</a>
    ${canEdit ? `<button class="btn sm danger" data-fdel="${f.id}">✕</button>` : ''}</div>`).join('') : '<div class="muted-sm">Chưa có file báo giá</div>';
  $('#view').innerHTML = `
    <div class="page-head"><div><h2>🏭 ${esc(r.name)}</h2><div class="desc">${esc(r.services || '')}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><a href="#suppliers" class="btn">‹ Danh sách</a>
        ${canEdit ? `<button class="btn primary" id="editBtn">Sửa</button>` : ''}
        ${can('suppliers', 'delete') ? `<button class="btn danger" id="delBtn">Xóa</button>` : ''}</div></div>
    <div class="two-col">
      <div class="panel"><h3>Thông tin</h3><div class="detail-rows">
        ${row('Lĩnh vực hoạt động', val(r.industry))}${row('Địa chỉ', val(r.address))}${row('Mã số thuế', val(r.tax_code))}
        ${row('Điện thoại', val(r.contact_phone))}${row('Email', val(r.contact_email))}
        ${row('Loại hóa đơn', val(r.invoice_type))}${row('Phí phục vụ', r.service_fee_pct ? r.service_fee_pct + '%' : 'Không')}
        ${row('Đặt cọc', r.deposit_pct ? r.deposit_pct + '%' : 'Không')}${row('Link nhóm đặt hàng', r.order_group_link ? `<a href="${esc(r.order_group_link)}" target="_blank" rel="noopener">link</a>` : '—')}
        ${r.note ? row('Ghi chú', val(r.note)) : ''}
      </div></div>
      <div class="panel"><h3>💵 Báo giá ${canEdit ? `<span style="float:right;display:flex;gap:6px"><button class="btn sm" id="addQuote">+ Dòng</button><button class="btn sm" id="addQuoteFile">+ File</button></span>` : ''}</h3>
        <div class="table-wrap"><table><thead><tr><th>STT</th><th>Dịch vụ/Thiết bị</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th>${canEdit ? '<th></th>' : ''}</tr></thead><tbody>${qRows}</tbody></table></div>
        <div style="margin-top:10px"><div class="muted-sm" style="margin-bottom:4px">Hồ sơ năng lực &amp; báo giá:</div>${fRows}</div>
      </div>
    </div>
    <div class="panel"><h3>👤 Đầu mối làm việc ${canEdit ? `<button class="btn sm" id="addContact" style="float:right">+ Thêm đầu mối</button>` : ''}</h3>
      ${(d.contacts || []).length ? `<div class="table-wrap"><table><thead><tr><th>Họ tên</th><th>Chức vụ</th><th>SĐT</th><th>Email</th><th>Vai trò</th>${canEdit ? '<th></th>' : ''}</tr></thead><tbody>
      ${d.contacts.map((c) => `<tr><td><b>${esc(c.full_name || '—')}</b></td><td>${esc(c.position || '—')}</td><td>${esc(c.phone || '—')}</td><td>${esc(c.email || '—')}</td><td>${esc(c.role || '—')}</td>${canEdit ? `<td><button class="btn sm" data-cedit="${c.id}">Sửa</button> <button class="btn sm danger" data-cdel="${c.id}">✕</button></td>` : ''}</tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">Chưa có đầu mối làm việc</div>'}
    </div>
    <div class="panel"><h3>🔔 Ngày nhắc liên quan ${canEdit ? `<button class="btn sm" id="addSupRem" style="float:right">+ Thêm</button>` : ''}</h3>
      ${(d.dates || []).length ? d.dates.map((x) => `<div class="sub-list"><div class="item"><b>${esc(x.title)}</b> ${x.daysUntil != null ? deadlineBadge(x.daysUntil) : ''}<br><span class="muted-sm">${fmtDate(x.event_date)}${x.note ? ' · ' + esc(x.note) : ''}</span></div></div>`).join('') : '<div class="empty">Chưa có (hạn thanh toán/báo giá/hợp đồng/thi công/nghiệm thu)</div>'}
    </div>
    <div class="panel"><h3>📒 Lịch sử giao dịch ${canEdit ? `<button class="btn sm" id="addTrans" style="float:right">+ Thêm</button>` : ''}</h3>
      <div class="table-wrap"><table><thead><tr><th>Loại DV / Mục đích</th><th>Số HĐ</th><th>Giá trị 🔒</th><th>Ngày ký</th><th>Hạn thực hiện</th><th>Tình trạng</th><th>Nhân sự</th>${canEdit ? '<th></th>' : ''}</tr></thead><tbody>
      ${(d.transactions || []).length ? d.transactions.map((t) => `<tr><td><b>${esc(t.service_type || '—')}</b>${t.purpose ? `<div class="muted-sm">${esc(t.purpose)}</div>` : ''}</td><td>${esc(t.contract_no || '—')}</td><td>${money(t.value)}</td><td>${valDate(t.signed_date)}</td><td>${valDate(t.exec_deadline)}</td><td>${t.status ? `<span class="badge b-gray">${esc(t.status)}</span>` : '—'}</td><td>${esc(t.staff || '—')}</td>${canEdit ? `<td><button class="btn sm" data-tedit="${t.id}">Sửa</button> <button class="btn sm danger" data-tdel="${t.id}">✕</button></td>` : ''}</tr>`).join('') : `<tr><td colspan="${canEdit ? 8 : 7}" class="empty">Chưa có giao dịch</td></tr>`}
      </tbody></table></div>
    </div>`;
  if ($('#addSupRem')) $('#addSupRem').onclick = () => supplierReminderForm(id, r.name, () => supplierDetail(id));
  if ($('#addTrans')) $('#addTrans').onclick = () => transactionForm(id, () => supplierDetail(id));
  if ($('#addContact')) $('#addContact').onclick = () => supplierContactForm(id, () => supplierDetail(id));
  $('#view').querySelectorAll('[data-cedit]').forEach((b) => b.onclick = () => supplierContactForm(id, () => supplierDetail(id), (d.contacts || []).find((x) => String(x.id) === b.dataset.cedit)));
  $('#view').querySelectorAll('[data-cdel]').forEach((b) => b.onclick = async () => { if (!confirm('Xóa đầu mối này?')) return; try { await api('DELETE', `/suppliers/${id}/contacts/${b.dataset.cdel}`); supplierDetail(id); } catch (e) { toast(e.message, true); } });
  $('#view').querySelectorAll('[data-tedit]').forEach((b) => b.onclick = () => transactionForm(id, () => supplierDetail(id), (d.transactions || []).find((x) => String(x.id) === b.dataset.tedit)));
  $('#view').querySelectorAll('[data-tdel]').forEach((b) => b.onclick = async () => { if (!confirm('Xóa giao dịch này?')) return; try { await api('DELETE', `/suppliers/${id}/transactions/${b.dataset.tdel}`); supplierDetail(id); } catch (e) { toast(e.message, true); } });
  if ($('#editBtn')) $('#editBtn').onclick = () => supplierForm(r);
  if ($('#delBtn')) $('#delBtn').onclick = async () => { if (!confirm(`Xóa nhà cung cấp "${r.name}"?`)) return; try { await api('DELETE', `/suppliers/${id}`); toast('Đã xóa'); location.hash = 'suppliers'; } catch (e) { toast(e.message, true); } };
  if ($('#addQuote')) $('#addQuote').onclick = () => quoteForm(id, d.quotes.length + 1);
  if ($('#addQuoteFile')) $('#addQuoteFile').onclick = () => uploadSupplierFile(id);
  $('#view').querySelectorAll('[data-qdel]').forEach((b) => b.onclick = async () => { try { await api('DELETE', `/suppliers/${id}/quotes/${b.dataset.qdel}`); supplierDetail(id); } catch (e) { toast(e.message, true); } });
  $('#view').querySelectorAll('[data-fdel]').forEach((b) => b.onclick = async () => { if (!confirm('Xóa file?')) return; try { await api('DELETE', `/attachments/${b.dataset.fdel}`); supplierDetail(id); } catch (e) { toast(e.message, true); } });
}
function supplierForm(r = {}) {
  openForm({ title: r.id ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp', mod: 'suppliers', wide: true,
    fields: [
      { k: 'name', l: 'Tên nhà cung cấp', full: true, v: r.name, req: true },
      { k: 'industry', l: 'Lĩnh vực hoạt động', type: 'select', opts: ['', ...OPT.supplierIndustry], v: r.industry },
      { k: 'address', l: 'Địa chỉ', full: true, v: r.address },
      { k: 'contact_phone', l: 'Điện thoại đầu mối', v: r.contact_phone },
      { k: 'contact_email', l: 'Email đầu mối', type: 'email', v: r.contact_email },
      { k: 'tax_code', l: 'Mã số thuế', v: r.tax_code },
      { k: 'invoice_type', l: 'Loại hóa đơn', type: 'select', opts: OPT.invoiceType, v: r.invoice_type || 'VAT' },
      { k: 'services', l: 'Dịch vụ cung cấp', type: 'textarea', full: true, v: r.services },
      { k: 'service_fee_pct', l: 'Phí phục vụ (%) 0-100', type: 'number', v: r.service_fee_pct },
      { k: 'deposit_pct', l: 'Yêu cầu đặt cọc (%) 0-100', type: 'number', v: r.deposit_pct },
      { k: 'order_group_link', l: 'Link nhóm đặt hàng', full: true, v: r.order_group_link },
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note },
    ],
    save: async (data) => { let sid = r.id; if (r.id) await api('PUT', `/suppliers/${r.id}`, data); else sid = (await api('POST', '/suppliers', data)).id; location.hash = `suppliers/${sid}`; if (location.hash === `#suppliers/${sid}`) supplierDetail(sid); },
  });
}
function quoteForm(supplierId, nextStt) {
  openForm({ title: 'Thêm dòng báo giá', mod: 'suppliers',
    fields: [
      { k: 'stt', l: 'STT', type: 'number', v: nextStt },
      { k: 'item', l: 'Dịch vụ / Thiết bị', full: true, v: '', req: true },
      { k: 'unit', l: 'Đơn vị tính', v: '' },
      { k: 'qty', l: 'Số lượng', type: 'number', v: 1 },
      { k: 'unit_price', l: 'Đơn giá (đ)', type: 'money', v: '' },
    ],
    save: async (data) => { await api('POST', `/suppliers/${supplierId}/quotes`, data); supplierDetail(supplierId); },
  });
}
function uploadSupplierFile(supplierId) {
  const inp = el('<input type="file" accept="image/*,application/pdf,.xls,.xlsx,.doc,.docx" multiple style="display:none">');
  document.body.appendChild(inp);
  inp.onchange = async () => {
    if (!inp.files.length) { inp.remove(); return; }
    const fd = new FormData(); [...inp.files].forEach((f) => fd.append('files', f));
    try { const res = await fetch(`/api/suppliers/${supplierId}/files`, { method: 'POST', body: fd }); const d = await res.json(); if (!res.ok) throw new Error(d.error || 'Lỗi'); toast('Đã tải lên'); supplierDetail(supplierId); }
    catch (e) { toast(e.message, true); } finally { inp.remove(); }
  };
  inp.click();
}
function transactionForm(supplierId, after, r = {}) {
  openForm({
    title: r.id ? 'Sửa giao dịch' : 'Thêm giao dịch (hợp đồng/đơn hàng)', mod: 'suppliers', wide: true,
    fields: [
      { k: 'service_type', l: 'Loại dịch vụ', v: r.service_type || '' },
      { k: 'purpose', l: 'Mục đích', full: true, v: r.purpose || '' },
      { k: 'contract_no', l: 'Số hợp đồng / đơn hàng', v: r.contract_no || '' },
      { k: 'value', l: 'Giá trị (đ)', type: 'money', v: r.value === MASK ? '' : (r.value || ''), sens: true },
      { k: 'signed_date', l: 'Ngày ký / yêu cầu', type: 'date', v: r.signed_date },
      { k: 'exec_deadline', l: 'Thời hạn thực hiện / thi công', type: 'date', v: r.exec_deadline },
      { k: 'status', l: 'Tình trạng thực hiện', type: 'select', opts: OPT.transStatus, v: r.status || 'Đang thực hiện' },
      { k: 'staff', l: 'Nhân sự phụ trách', v: r.staff || state.user.full_name },
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note },
    ],
    save: async (data) => { if (r.id) await api('PUT', `/suppliers/${supplierId}/transactions/${r.id}`, data); else await api('POST', `/suppliers/${supplierId}/transactions`, data); if (after) after(); },
  });
}
function supplierContactForm(supplierId, after, r = {}) {
  openForm({
    title: r.id ? 'Sửa đầu mối làm việc' : 'Thêm đầu mối làm việc', mod: 'suppliers',
    fields: [
      { k: 'full_name', l: 'Họ tên', full: true, req: true, v: r.full_name },
      { k: 'position', l: 'Chức vụ', v: r.position },
      { k: 'phone', l: 'SĐT', v: r.phone },
      { k: 'email', l: 'Email', type: 'email', v: r.email },
      { k: 'role', l: 'Vai trò', full: true, v: r.role },
      { k: 'note', l: 'Ghi chú', type: 'textarea', full: true, v: r.note },
    ],
    save: async (data) => { if (r.id) await api('PUT', `/suppliers/${supplierId}/contacts/${r.id}`, data); else await api('POST', `/suppliers/${supplierId}/contacts`, data); if (after) after(); },
  });
}
function supplierReminderForm(supplierId, supplierName, after) {
  openForm({
    title: 'Thêm ngày nhắc (nhà cung cấp)', mod: 'suppliers',
    fields: [
      { k: '_kind', l: 'Loại hạn nhắc', type: 'select', opts: OPT.supplierRemindKind },
      { k: 'event_date', l: 'Ngày đến hạn', type: 'date', req: true, v: todayGMT7() },
      { k: '_content', l: 'Nội dung công việc', full: true },
      { k: '_staff', l: 'Nhân sự phụ trách', v: state.user.full_name },
    ],
    save: async (data) => {
      const title = `${data._kind || 'Hạn'}${data._content ? ' — ' + data._content : ''} · ${supplierName}`;
      await api('POST', '/reminders', { title, date_type: 'other', subject_type: 'supplier', subject_id: supplierId, subject_name: supplierName, event_date: data.event_date, recurring: 0, note: data._staff ? 'Phụ trách: ' + data._staff : '' });
      if (after) after();
    },
  });
}

// ==================== INTERACTIONS ====================
const psI = pageState();
VIEWS.interactions = async () => {
  const d = await api('GET', `/interactions?page=${psI.page}&search=${encodeURIComponent(psI.search)}`);
  psI.total = d.total;
  const ptLabel = (t) => (OPT.partnerType.find((p) => p[0] === t) || [, t])[1];
  const rows = d.rows.map((r) => `<tr><td>${fmtDate(r.date)}</td><td><b>${esc(r.partner_name)}</b></td><td>${esc(ptLabel(r.partner_type))}</td><td>${esc(r.channel)}</td><td>${resultBadge(r.result)}</td><td>${esc(r.staff)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">Không có dữ liệu</td></tr>`;
  renderTable({
    title: 'Lịch sử tương tác', desc: 'Nhật ký trao đổi, làm việc với các đối tác truyền thông.', mod: 'interactions', ps: psI, onSearch: VIEWS.interactions, addLabel: 'Ghi nhận tương tác',
    head: '<th>Ngày</th><th>Đối tác</th><th>Loại</th><th>Kênh</th><th>Kết quả</th><th>Người thực hiện</th>', rowsHtml: rows,
  });
  // nút giọng nói + ghi thủ công (đều gắn đối tác cụ thể)
  if (can('interactions', 'create')) {
    const addBtn = $('#addBtn');
    const voiceBtn = el('<button class="btn" id="voiceBtn" style="margin-right:8px">🎤 Ghi bằng giọng nói</button>');
    addBtn.parentNode.insertBefore(voiceBtn, addBtn);
    voiceBtn.onclick = () => voiceCapture(() => VIEWS.interactions());
    addBtn.onclick = () => entityPicker((ent) => interactionForm(ent, {}, () => VIEWS.interactions()));
  }
};

// Modal chọn đối tác (nhân sự / cơ quan) trước khi ghi tương tác
function entityPicker(onPick) {
  const modal = el(`<div class="modal-bg"><div class="modal" style="max-width:520px">
    <div class="mhead"><h3>Chọn đối tác để ghi tương tác</h3><button class="x">&times;</button></div>
    <div class="mbody"><input id="entSearch" type="search" placeholder="🔎 Tìm nhân sự hoặc cơ quan…" style="width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:8px" />
      <div id="entResults" class="pick-list"><div class="empty">Nhập để tìm…</div></div></div>
  </div></div>`);
  $('#modalRoot').appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.x').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
  let timer;
  const search = modal.querySelector('#entSearch');
  search.oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = search.value.trim();
      if (!q) { modal.querySelector('#entResults').innerHTML = '<div class="empty">Nhập để tìm…</div>'; return; }
      const d = await api('GET', `/entities/search?q=${encodeURIComponent(q)}`);
      modal.querySelector('#entResults').innerHTML = d.rows.length
        ? d.rows.map((r) => `<div class="pick-item" data-type="${r.type}" data-id="${r.id}" data-name="${esc(r.name)}">
            <span class="badge ${r.type === 'person' ? 'b-blue' : 'b-gray'}">${r.type === 'person' ? 'Nhân sự' : 'Cơ quan'}</span>
            <b>${esc(r.name)}</b> <span class="muted-sm">${esc(r.sub)}</span></div>`).join('')
        : '<div class="empty">Không tìm thấy</div>';
      modal.querySelectorAll('.pick-item').forEach((it) => it.onclick = () => {
        close();
        onPick({ partner_type: it.dataset.type, partner_id: Number(it.dataset.id), partner_name: it.dataset.name });
      });
    }, 280);
  };
  setTimeout(() => search.focus(), 50);
}

// Form ghi tương tác — luôn gắn 1 đối tác cụ thể (bind)
function interactionForm(bind, prefill = {}, after) {
  const subLabel = bind.partner_type === 'person' ? 'Nhân sự' : 'Cơ quan';
  openForm({
    title: 'Ghi nhận tương tác', mod: 'interactions',
    note: prefill.transcript ? `📝 Đã nghe: "${prefill.transcript}"` : '',
    fields: [
      { k: '_partner', l: 'Đối tác', type: 'static', v: `${bind.partner_name} (${subLabel})`, full: true },
      { k: 'date', l: 'Ngày', type: 'date', v: prefill.date || todayGMT7(), req: true },
      { k: 'channel', l: 'Kênh', type: 'select', opts: OPT.channel, v: prefill.channel },
      { k: 'result', l: 'Kết quả', type: 'select', opts: OPT.result, v: prefill.result },
      { k: 'staff', l: 'Người thực hiện', v: prefill.staff || state.user.full_name },
      { k: 'work_mode', l: 'Hình thức làm việc', type: 'select', opts: ['', ...OPT.channel], v: prefill.work_mode },
      { k: 'summary', l: 'Nội dung trao đổi', type: 'textarea', full: true, v: prefill.summary },
      { k: 'next_task', l: 'Công việc tiếp theo', type: 'textarea', full: true, v: '' },
      { k: 'next_status', l: 'Trạng thái việc tiếp theo', type: 'select', opts: ['', 'Chưa làm', 'Đang làm', 'Hoàn thành'], v: '' },
      { k: 'next_due', l: 'Thời hạn xử lý', type: 'date', v: '' },
      { k: 'next_staff', l: 'Nhân sự phụ trách (việc tiếp theo)', v: state.user.full_name },
    ],
    save: async (data) => {
      delete data._partner;
      data.partner_type = bind.partner_type; data.partner_id = bind.partner_id; data.partner_name = bind.partner_name;
      await api('POST', '/interactions', data);
      if (after) after();
    },
  });
}

// Ghi âm -> Gemini -> điền sẵn -> xác nhận
function voiceCapture(after) {
  if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Trình duyệt không hỗ trợ ghi âm.', true); return; }
  const modal = el(`<div class="modal-bg"><div class="modal" style="max-width:480px">
    <div class="mhead"><h3>🎤 Ghi nhận bằng giọng nói</h3><button class="x">&times;</button></div>
    <div class="mbody"><div class="voice-box">
      <div class="voice-status" id="vStatus">Bấm để bắt đầu nói…</div>
      <button class="btn primary voice-mic" id="vMic">● Bắt đầu</button>
      <div class="muted-sm" style="margin-top:10px;text-align:center">Ví dụ: "Hôm nay đi ăn với chị Minh Anh ở báo VnExpress nhân dịp sinh nhật chị ấy"</div>
    </div></div>
  </div></div>`);
  $('#modalRoot').appendChild(modal);
  const close = () => { try { if (rec && rec.state !== 'inactive') rec.stop(); stream && stream.getTracks().forEach((t) => t.stop()); } catch {} modal.remove(); };
  modal.querySelector('.x').onclick = close;
  let rec, stream, chunks = [], recording = false;
  const mic = modal.querySelector('#vMic'); const status = modal.querySelector('#vStatus');
  mic.onclick = async () => {
    if (!recording) {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch { toast('Không truy cập được micro.', true); return; }
      chunks = []; rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        status.textContent = '⏳ Đang nghe & phân tích…'; mic.disabled = true;
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        const fd = new FormData(); fd.append('audio', blob, 'voice.webm');
        try {
          const res = await fetch('/api/ai/interaction-voice', { method: 'POST', body: fd });
          const d = await res.json();
          if (!res.ok) throw new Error(d.error || 'Lỗi xử lý');
          close();
          const bind = d.matchedPerson
            ? { partner_type: 'person', partner_id: d.matchedPerson.id, partner_name: d.matchedPerson.full_name }
            : d.matchedOrg ? { partner_type: 'org', partner_id: d.matchedOrg.id, partner_name: d.matchedOrg.name } : null;
          const prefill = { date: d.extracted.date, channel: d.extracted.channel, result: d.extracted.result, summary: d.extracted.summary, transcript: d.extracted.transcript };
          if (bind) { interactionForm(bind, prefill, after); }
          else { toast('Chưa khớp được đối tác, vui lòng chọn.', false); entityPicker((ent) => interactionForm(ent, prefill, after)); }
        } catch (e) { toast(e.message, true); close(); }
      };
      rec.start(); recording = true;
      mic.textContent = '■ Dừng & xử lý'; mic.classList.add('rec'); status.textContent = '🔴 Đang ghi âm… nói rõ nội dung';
    } else {
      recording = false; rec.stop();
    }
  };
}

// ==================== ADMIN ====================
VIEWS.admin = async () => {
  $('#crumb').textContent = 'Quản trị hệ thống';
  const u = await api('GET', '/admin/users');
  const canCreate = can('admin', 'create');
  const roleName = (r) => u.roles[r] || r;
  const userRows = u.rows.map((x) => `<tr>
    <td>${esc(x.username)}</td><td>${esc(x.full_name)}</td>
    <td>${esc(x.email || '—')}${x.email ? (x.notify_opt_in ? ' <span class="badge b-green">nhận nhắc</span>' : ' <span class="badge b-gray">tắt nhắc</span>') : ''}</td>
    <td><span class="badge b-blue">${esc(roleName(x.role))}</span></td>
    <td>${x.active ? '<span class="badge b-green">Hoạt động</span>' : '<span class="badge b-gray">Khóa</span>'}</td>
    <td>${can('admin', 'edit') ? `<button class="btn sm" data-edit="${x.id}">Sửa</button>` : ''}
      ${can('admin', 'delete') && x.id !== state.user.id ? `<button class="btn sm danger" data-deluser="${x.id}" data-uname="${esc(x.username)}">✕</button>` : ''}</td></tr>`).join('');
  $('#view').innerHTML = `
    <div class="page-head"><div><h2>Quản trị hệ thống</h2><div class="desc">Người dùng &amp; phân quyền.</div></div>
      ${canCreate ? `<button class="btn primary" id="addUser">+ Thêm người dùng</button>` : ''}</div>
    <div class="panel"><h3>👥 Người dùng &amp; phân quyền</h3>
      <div class="table-wrap"><table><thead><tr><th>Tài khoản</th><th>Họ tên</th><th>Email (nhắc)</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead><tbody>${userRows}</tbody></table></div>
    </div>
    <div style="margin-top:12px"><button class="btn sm" id="toggleAudit">🛠️ Nhật ký kỹ thuật (IT) ▾</button></div>
    <div id="auditBox" class="hidden" style="margin-top:10px"></div>`;
  if ($('#addUser')) $('#addUser').onclick = () => userForm(u.roles, {}, u.sensitiveGroups);
  if ($('#toggleAudit')) $('#toggleAudit').onclick = async () => {
    const box = $('#auditBox');
    if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden'); box.innerHTML = '<div class="empty">Đang tải…</div>';
    try {
      const a = await api('GET', '/admin/audit');
      const auditRows = a.rows.map((r) => `<tr><td>${esc(fmtDateTime(r.ts))}</td><td>${esc(r.username || '')}</td><td><span class="badge ${r.action === 'VIEW_SENSITIVE' ? 'b-red' : 'b-gray'}">${esc(r.action)}</span></td><td>${esc(r.entity || '')}</td><td>${esc(r.detail || '')}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">Chưa có log</td></tr>`;
      box.innerHTML = `<div class="panel"><h3>📜 Nhật ký truy cập (audit log) — <span style="color:var(--red)">đỏ = xem/tải dữ liệu mật</span></h3>
        <div class="table-wrap" style="max-height:360px"><table><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead><tbody>${auditRows}</tbody></table></div></div>`;
    } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  };
  $('#view').querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => userForm(u.roles, u.rows.find((x) => String(x.id) === b.dataset.edit) || {}, u.sensitiveGroups));
  $('#view').querySelectorAll('[data-deluser]').forEach((b) => b.onclick = async () => {
    if (!confirm(`Xóa người dùng "${b.dataset.uname}"? Hành động không thể hoàn tác.`)) return;
    try { await api('DELETE', `/admin/users/${b.dataset.deluser}`); toast('Đã xóa người dùng'); VIEWS.admin(); } catch (e) { toast(e.message, true); }
  });
};
function userForm(roles, r = {}, sensitiveGroups = {}) {
  const roleOpts = Object.entries(roles);
  const groupOpts = Object.entries(sensitiveGroups).map(([k, def]) => [k, def.label]);
  const curPerms = parseJSON(r.sensitive_perms, null) || [];
  openForm({
    title: r.id ? 'Sửa người dùng' : 'Thêm người dùng', mod: 'admin',
    fields: [
      ...(r.id ? [] : [{ k: 'username', l: 'Tài khoản', v: '', req: true }]),
      { k: 'full_name', l: 'Họ tên', v: r.full_name, req: true },
      { k: 'email', l: 'Email (nhận nhắc sự kiện)', type: 'email', v: r.email },
      { k: 'role', l: 'Vai trò', type: 'select', opts: roleOpts, v: r.role },
      { k: 'notify_opt_in', l: 'Nhận nhắc sự kiện', type: 'select', opts: [[1, 'Có'], [0, 'Không']], v: r.notify_opt_in == null ? 1 : r.notify_opt_in },
      { k: 'sensitive_perms', l: 'Cho phép xem dữ liệu mật (tick nhóm)', type: 'checks', opts: groupOpts, v: curPerms, full: true },
      { k: 'password', l: r.id ? 'Đặt lại mật khẩu (để trống nếu giữ nguyên)' : 'Mật khẩu', type: 'password', v: '', req: !r.id },
      ...(r.id ? [{ k: 'active', l: 'Trạng thái', type: 'select', opts: [[1, 'Hoạt động'], [0, 'Khóa']], v: r.active == null ? 1 : r.active }] : []),
    ],
    note: 'Tick các nhóm thông tin mật mà người dùng này được phép xem (SĐT, đời tư, mạng xã hội, ngân hàng, giấy tờ, hội phí). Không tick = không xem được nhóm đó.',
    save: async (data) => {
      if (r.id) await api('PUT', `/admin/users/${r.id}`, data); else await api('POST', '/admin/users', data);
      // nếu sửa chính mình: làm tươi tên/avatar/quyền góc phải
      if (r.id && Number(r.id) === state.user.id) { try { const me = await api('GET', '/me'); state.user = me.user; state.perms = me.permissions; refreshIdentity(); buildNav(); } catch {} }
      VIEWS.admin();
    },
  });
}

// ---------------- FORM MODAL ----------------
function openForm({ title, fields, save, note, draftKey }) {
  const storageKey = `misa-pr:draft:${draftKey || `${location.hash || 'dashboard'}:${title}`}`;
  let draft = null;
  try { draft = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch {}
  if (draft && draft.values) fields = fields.map((f) => Object.prototype.hasOwnProperty.call(draft.values, f.k) ? { ...f, v: draft.values[f.k] } : f);
  const listRow = (v = '', ph = '') => `<div class="list-row"><input type="text" value="${esc(v)}" placeholder="${esc(ph)}"/><button type="button" class="btn sm danger list-del" title="Xóa">×</button></div>`;
  const fieldHtml = fields.map((f) => {
    const id = 'f_' + f.k;
    const lab = `<label for="${id}">${esc(f.l)}${f.req ? ' <span class="req">*</span>' : ''}${f.sens ? '<span class="sens">Dữ liệu mật</span>' : ''}</label>`;
    let input;
    if (f.type === 'list') {
      const vals = (Array.isArray(f.v) && f.v.length) ? f.v : [''];
      input = `<div id="${id}" class="list-field">${vals.map((v) => listRow(v, f.ph)).join('')}<button type="button" class="btn sm list-add">+ Thêm ô</button></div>`;
    } else if (f.type === 'select') {
      const opts = f.opts.map((o) => Array.isArray(o) ? [o[0], o[1]] : [o, o]);
      input = `<select id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(f.v) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    } else if (f.type === 'checks') {
      const opts = f.opts.map((o) => Array.isArray(o) ? [o[0], o[1]] : [o, o]);
      const sel = new Set((f.v || []).map(String));
      input = `<div id="${id}" class="checks">${opts.map(([v, t]) => `<label class="chk"><input type="checkbox" value="${esc(v)}" ${sel.has(String(v)) ? 'checked' : ''}/> ${esc(t)}</label>`).join('')}</div>`;
    } else if (f.type === 'static') {
      input = `<div id="${id}" class="static-field">${esc(f.v)}</div>`;
    } else if (f.type === 'textarea') {
      input = `<textarea id="${id}">${esc(f.v)}</textarea>`;
    } else if (f.type === 'money') {
      input = `<input id="${id}" class="money-input" type="text" inputmode="decimal" value="${esc(formatViNumber(f.v))}" ${f.req ? 'required' : ''} />`;
    } else {
      input = `<input id="${id}" type="${f.type || 'text'}" value="${esc(f.v == null ? '' : f.v)}" ${f.req ? 'required' : ''} />`;
    }
    return `<div class="field ${f.full ? 'full' : ''}" data-field="${esc(f.k)}">${lab}${input}<p class="field-error hidden" id="err_${id}"></p></div>`;
  }).join('');
  const modal = el(`<div class="modal-bg"><div class="modal">
    <div class="mhead"><h3>${esc(title)}</h3><button class="x">&times;</button></div>
    <div class="mbody">${note ? `<div class="banner">${esc(note)}</div>` : ''}<div class="form-grid">${fieldHtml}</div></div>
    <div class="mfoot"><span class="draft-note">${draft ? 'Đã khôi phục bản nháp gần nhất' : 'Tự động lưu bản nháp khi nhập'}</span><button class="btn" data-close>Hủy</button><button class="btn primary" id="saveBtn">Lưu</button></div>
  </div></div>`);
  $('#modalRoot').appendChild(modal);
  const dialog = modal.querySelector('.modal');
  const readData = () => {
    const data = {};
    for (const f of fields) {
      if (f.type === 'static') { data[f.k] = f.v; continue; }
      if (f.type === 'checks') data[f.k] = [...modal.querySelectorAll('#f_' + f.k + ' input:checked')].map((i) => i.value);
      else if (f.type === 'list') data[f.k] = [...modal.querySelectorAll('#f_' + f.k + ' .list-row input')].map((i) => i.value.trim()).filter(Boolean);
      else if (f.type === 'money') data[f.k] = parseViNumber(modal.querySelector('#f_' + f.k).value);
      else data[f.k] = modal.querySelector('#f_' + f.k).value;
    }
    return data;
  };
  const persistDraft = () => {
    dialog.dataset.dirty = 'true';
    sessionStorage.setItem(storageKey, JSON.stringify({ savedAt: new Date().toISOString(), values: readData() }));
    const noteEl = modal.querySelector('.draft-note');
    if (noteEl) noteEl.textContent = 'Đã lưu bản nháp';
  };
  const close = () => {
    if (dialog.dataset.dirty === 'true') toast('Bản nháp đã được giữ lại để bạn tiếp tục sau.');
    modal.remove();
  };
  modal.querySelector('.x').onclick = close;
  modal.querySelector('[data-close]').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) toast('Hãy bấm Hủy hoặc nút Đóng để rời biểu mẫu.'); };
  // list-field: thêm/xóa ô
  fields.filter((f) => f.type === 'list').forEach((f) => {
    const box = modal.querySelector('#f_' + f.k);
    box.querySelector('.list-add').onclick = () => { const r = el(listRow('', f.ph)); box.insertBefore(r, box.querySelector('.list-add')); r.querySelector('input').focus(); persistDraft(); };
    box.addEventListener('click', (e) => { if (e.target.classList.contains('list-del')) { e.target.closest('.list-row').remove(); persistDraft(); } });
  });
  modal.addEventListener('input', (e) => {
    if (e.target.classList.contains('money-input')) {
      const value = formatViNumber(e.target.value);
      e.target.value = value;
      requestAnimationFrame(() => e.target.setSelectionRange(value.length, value.length));
    }
    persistDraft();
  });
  modal.addEventListener('change', persistDraft);
  setTimeout(() => {
    const first = modal.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
    if (first) { first.focus(); if (first.select) first.select(); }
  }, 40);
  modal.querySelector('#saveBtn').onclick = async () => {
    const data = readData();
    modal.querySelectorAll('.field-error').forEach((item) => { item.textContent = ''; item.classList.add('hidden'); });
    const invalid = fields.find((f) => f.req && (data[f.k] == null || data[f.k] === '' || (Array.isArray(data[f.k]) && !data[f.k].length)));
    if (invalid) {
      const control = modal.querySelector('#f_' + invalid.k);
      const error = modal.querySelector('#err_f_' + invalid.k);
      if (error) { error.textContent = `Vui lòng nhập ${invalid.l.toLowerCase()}.`; error.classList.remove('hidden'); }
      if (control) { control.scrollIntoView({ block: 'center', behavior: 'smooth' }); control.focus(); }
      toast(`Vui lòng nhập ${invalid.l.toLowerCase()}.`, true);
      return;
    }
    const button = modal.querySelector('#saveBtn');
    const oldLabel = button.textContent;
    button.disabled = true; button.textContent = 'Đang lưu…';
    try {
      await save(data);
      sessionStorage.removeItem(storageKey);
      dialog.dataset.dirty = 'false';
      modal.remove();
      toast('Đã lưu thành công');
    } catch (e) {
      toast(e.message, true);
      button.disabled = false; button.textContent = oldLabel;
    }
  };
}

// ---------------- AUTH FLOW ----------------
function showLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); }
function refreshIdentity() {
  $('#userName').textContent = state.user.full_name;
  $('#userRole').textContent = state.perms.roleName;
  $('#avatar').textContent = state.user.full_name.trim().slice(0, 1).toUpperCase();
}
function showApp() {
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  refreshIdentity();
  buildNav();
  initBell();
  if (!location.hash) location.hash = 'dashboard'; else route();
}

// ---------------- chuông nhắc in-app ----------------
async function loadNotifications() {
  if (!can('reminders', 'view')) return;
  try {
    const d = await api('GET', '/notifications');
    const badge = $('#bellBadge');
    badge.textContent = d.unread;
    badge.classList.toggle('hidden', !d.unread);
    const panel = $('#bellPanel');
    panel.innerHTML = `<div class="bell-head">Thông báo nhắc ${d.unread ? `<button class="btn sm" id="bellReadAll">Đọc hết</button>` : ''}</div>` +
      (d.rows.length ? d.rows.slice(0, 15).map((r) => `<div class="bell-item ${r.read_at ? '' : 'unread'}">
        <b>${esc(r.title)}</b><div class="muted-sm">${fmtDate(r.occur_date)}${r.subject_name ? ' · ' + esc(r.subject_name) : ''}</div></div>`).join('')
        : '<div class="empty">Chưa có nhắc nào</div>');
    if ($('#bellReadAll')) $('#bellReadAll').onclick = async (e) => { e.stopPropagation(); await api('POST', '/notifications/read-all'); loadNotifications(); };
  } catch {}
}
function initBell() {
  const bell = $('#bell'); if (!bell) return;
  bell.classList.toggle('hidden', !can('reminders', 'view'));
  bell.onclick = async (e) => {
    e.stopPropagation();
    const panel = $('#bellPanel'); const wasHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    if (wasHidden) { await api('POST', '/notifications/read-all').catch(() => {}); setTimeout(loadNotifications, 400); }
  };
  document.addEventListener('click', () => $('#bellPanel') && $('#bellPanel').classList.add('hidden'));
  loadNotifications();
}
async function doLogin(username, password) {
  $('#loginErr').textContent = '';
  try {
    const d = await api('POST', '/login', { username, password });
    state.user = d.user; state.perms = d.permissions; showApp();
  } catch (e) { $('#loginErr').textContent = e.message; }
}
$('#loginForm').addEventListener('submit', (e) => { e.preventDefault(); doLogin($('#username').value, $('#password').value); });
document.querySelectorAll('.quick button').forEach((b) => b.onclick = () => { $('#username').value = b.dataset.u; $('#password').value = b.dataset.p; doLogin(b.dataset.u, b.dataset.p); });
$('#logoutBtn').addEventListener('click', async () => { await api('POST', '/logout'); state = { user: null, perms: null }; location.hash = ''; showLogin(); });

// ---------------- boot ----------------
(async () => {
  try { const d = await api('GET', '/me'); state.user = d.user; state.perms = d.permissions; showApp(); }
  catch { showLogin(); }
})();
