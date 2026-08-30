'use strict';
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const { MySQLSyncDatabase } = require('./mysql-sync');

// DATA_DIR có thể trỏ vào volume bền khi deploy (vd Railway: DATA_DIR=/data)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'pr.db');

const DB_CLIENT = String(process.env.DB_CLIENT || 'mysql').toLowerCase();
const db = DB_CLIENT === 'mysql' ? new MySQLSyncDatabase() : new DatabaseSync(DB_PATH);
if (DB_CLIENT !== 'mysql') {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
}

function init() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT,
    notify_opt_in INTEGER NOT NULL DEFAULT 1,
    sensitive_perms TEXT,   -- JSON mảng nhóm dữ liệu mật được xem (null = mặc định theo vai trò)
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Cơ quan / đối tác (gộp báo chí + hiệp hội + bộ ngành + khác)
  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    org_type TEXT NOT NULL,    -- press / association / gov / other
    tier TEXT,                 -- Trọng điểm / Quan trọng / Thường
    founded_date TEXT,         -- Ngày thành lập
    parent_org TEXT,           -- Đơn vị chủ quản
    website TEXT,
    address TEXT,
    press_types TEXT,          -- JSON array loại hình báo chí (tick nhiều)
    misa_role TEXT,            -- vai trò MISA (hiệp hội)
    join_date TEXT,            -- ngày tham gia (hiệp hội)
    membership_fee INTEGER,    -- hội phí (nhạy cảm)
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Nhân sự thuộc cơ quan (gộp phóng viên + danh bạ + đầu mối)
  CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    level TEXT,                -- Lãnh đạo / Quản lý / Phóng viên / Chuyên viên / Nhân viên / Khác
    position TEXT,             -- chức danh tự do (Tổng biên tập, Trưởng ban...)
    beat TEXT,                 -- mảng phụ trách
    category TEXT,             -- Phóng viên / VIP / Đối tác
    relationship_score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Đang hợp tác',
    email_work TEXT,
    phone_work TEXT,
    -- trường nhạy cảm:
    phone_personal TEXT,
    phone_other TEXT,          -- SĐT khác (người dùng nhiều số)
    phone_ott TEXT,            -- JSON {zalo,whatsapp,viber,telegram}
    dob TEXT,
    home_address TEXT,
    personal_notes TEXT,
    social_facebook TEXT,
    social_instagram TEXT,
    social_tiktok TEXT,
    social_x TEXT,
    social_thread TEXT,
    bank_account_number TEXT,
    bank_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Ảnh chân dung + giấy tờ tùy thân
  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_type TEXT NOT NULL DEFAULT 'person',
    owner_id INTEGER NOT NULL,
    kind TEXT NOT NULL,        -- portrait / id_doc
    filename TEXT NOT NULL,    -- tên file lưu trên đĩa
    original_name TEXT,
    mime TEXT,
    audience_visibility TEXT NOT NULL DEFAULT 'private', -- D13: public/private, server enforces ceiling
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sponsorships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT,                 -- Tài trợ / Giải thưởng / Hoạt động
    amount INTEGER,            -- ngân sách (nhạy cảm)
    event_date TEXT,
    note TEXT
  );

  -- Ngày quan trọng để nhắc (sinh nhật, thành lập, kỷ niệm ngành...)
  CREATE TABLE IF NOT EXISTS important_dates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date_type TEXT,            -- birthday / founding / anniversary / other
    subject_type TEXT,         -- person / organization / general
    subject_id INTEGER,
    subject_name TEXT,
    event_date TEXT NOT NULL,  -- YYYY-MM-DD
    recurring INTEGER NOT NULL DEFAULT 1,  -- lặp hằng năm
    lead_days INTEGER NOT NULL DEFAULT 7,  -- số ngày báo trước (mốc nhắc đầu)
    notify_repeat_every INTEGER NOT NULL DEFAULT 0,  -- lặp nhắc mỗi N ngày (0 = không lặp)
    notify_repeat_count INTEGER NOT NULL DEFAULT 1,  -- tổng số lần nhắc
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Booking truyền thông: đặt báo/phóng viên viết bài, lên tin, phóng sự...
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_type TEXT NOT NULL,   -- org / person
    subject_id INTEGER NOT NULL,
    subject_name TEXT,
    org_id INTEGER,               -- đơn vị báo chí (để gom báo cáo); với person = cơ quan của họ
    org_name TEXT,
    content_type TEXT,            -- Bài viết / Lên tin / Phóng sự / Bài PR / Khác
    title TEXT NOT NULL,
    amount INTEGER,               -- số tiền (đ)
    article_link TEXT,            -- link bài đã nghiệm thu
    booked_date TEXT,             -- thời điểm book
    publish_date TEXT,            -- thời điểm đăng
    status TEXT DEFAULT 'Đã đặt', -- Đã đặt / Đã đăng / Đã nghiệm thu / Hủy
    note TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Ngân sách theo kỳ (YYYY-MM hoặc YYYY) cho báo cáo ngân sách vs đã chi
  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT UNIQUE NOT NULL,  -- 'YYYY-MM'
    amount INTEGER NOT NULL,
    note TEXT
  );

  -- Nhật ký nhắc (chống gửi trùng + đếm số lần lặp)
  CREATE TABLE IF NOT EXISTS reminder_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_id INTEGER REFERENCES important_dates(id) ON DELETE CASCADE,
    occur_date TEXT NOT NULL,     -- YYYY-MM-DD lần xuất hiện
    seq INTEGER NOT NULL,         -- mốc nhắc thứ mấy (1..count)
    channel TEXT NOT NULL,        -- inapp / email
    recipient_user_id INTEGER,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partner_type TEXT NOT NULL,  -- org / person
    partner_id INTEGER NOT NULL,
    partner_name TEXT,
    date TEXT NOT NULL,
    channel TEXT,
    summary TEXT,
    result TEXT,
    staff TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id INTEGER,
    detail TEXT,
    ts TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_org_type ON organizations(org_type);
  CREATE INDEX IF NOT EXISTS idx_p_org ON people(org_id);
  CREATE INDEX IF NOT EXISTS idx_att_owner ON attachments(owner_type, owner_id);
  CREATE INDEX IF NOT EXISTS idx_int_partner ON interactions(partner_type, partner_id);
  CREATE INDEX IF NOT EXISTS idx_book_subj ON bookings(subject_type, subject_id);
  CREATE INDEX IF NOT EXISTS idx_book_org ON bookings(org_id);
  -- Giải thưởng / bằng khen / danh hiệu MISA theo dõi & tham gia
  CREATE TABLE IF NOT EXISTS awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    organizer TEXT,                 -- đơn vị tổ chức (text)
    org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,  -- link cơ quan nếu có
    organizer_type TEXT,            -- gov / association / other
    scale TEXT,                     -- quy mô
    event_time TEXT,                -- thời gian diễn ra
    submission_deadline TEXT,       -- hạn nộp hồ sơ (YYYY-MM-DD)
    eligibility TEXT,               -- điều kiện tham gia
    cost INTEGER,                   -- chi phí tham gia
    criteria TEXT,                  -- bộ tiêu chí đánh giá
    required_docs TEXT,             -- hồ sơ bao gồm
    prize_structure TEXT,           -- cơ cấu giải thưởng
    evaluation_method TEXT,         -- phương thức đánh giá
    scope TEXT,                     -- Trong nước / Quốc tế
    status TEXT DEFAULT 'Sắp mở',   -- Sắp mở / Đang nhận hồ sơ / Đã đóng
    source_url TEXT,
    ai_summary TEXT,
    review_status TEXT DEFAULT 'Thô',  -- Thô / Đã duyệt / Chuẩn hóa
    note TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Hồ sơ MISA đề xuất tham gia 1 giải (tách theo năm)
  CREATE TABLE IF NOT EXISTS award_participations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    award_id INTEGER REFERENCES awards(id) ON DELETE CASCADE,
    year INTEGER,
    status TEXT DEFAULT 'Đang cân nhắc',  -- Đang cân nhắc/Quyết định tham gia/Đã nộp/Đạt giải/Trượt/Không tham gia
    products TEXT,                  -- sản phẩm tham gia
    categories TEXT,                -- hạng mục tham gia
    goal TEXT,                      -- mục tiêu
    purpose TEXT,                   -- mục đích
    capability TEXT,                -- đánh giá năng lực đạt giải
    plan TEXT,                      -- kế hoạch triển khai dự kiến
    budget INTEGER,                 -- dự toán chi phí
    result TEXT,                    -- kết quả
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_remlog ON reminder_log(date_id, occur_date, seq);
  CREATE INDEX IF NOT EXISTS idx_award_status ON awards(status);
  CREATE INDEX IF NOT EXISTS idx_part_award ON award_participations(award_id);

  -- Phân công "nhân sự chăm sóc": user ↔ (cơ quan / nhân sự / giải thưởng)
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_type TEXT NOT NULL,   -- org / person / award
    subject_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, subject_type, subject_id)
  );
  CREATE INDEX IF NOT EXISTS idx_assign_subject ON assignments(subject_type, subject_id);
  CREATE INDEX IF NOT EXISTS idx_assign_user ON assignments(user_id);

  -- Danh bạ nhà cung cấp
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    tax_code TEXT,
    services TEXT,
    invoice_type TEXT,           -- VAT / Trực tiếp 0%
    service_fee_pct INTEGER,     -- phí phục vụ 0-100
    order_group_link TEXT,
    deposit_pct INTEGER,         -- đặt cọc 0-100
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS supplier_quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    stt INTEGER, item TEXT, unit TEXT, qty REAL, unit_price INTEGER
  );

  -- Sự kiện (MISA tham gia / tổ chức)
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source_url TEXT,
    mode TEXT NOT NULL DEFAULT 'join',  -- join (tham gia) / host (tổ chức)
    organizer TEXT,
    organizer_org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    field TEXT,                  -- Công nghệ / Tài chính - Thuế / Quản trị / An ninh mạng / Khác
    format TEXT,                 -- Online / Offline / Hybrid
    start_time TEXT,
    end_time TEXT,
    location TEXT,
    scale_attendees INTEGER,
    scale_compare TEXT,
    guest_levels TEXT,
    evaluation TEXT,
    image_links TEXT,            -- JSON array
    video_links TEXT,            -- JSON array
    keyvisual_link TEXT,
    status TEXT DEFAULT 'Sắp diễn ra',  -- Sắp diễn ra / Đang diễn ra / Đã kết thúc
    note TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Chi phí sự kiện (1 bảng cho 3 nhóm: sponsor / organization / media)
  CREATE TABLE IF NOT EXISTS event_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    category TEXT NOT NULL,      -- sponsor / organization / media
    title TEXT,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    amount INTEGER,
    sponsor_tier TEXT,          -- Kim cương / Vàng / Bạc / Đồng / Đồng hành
    sponsor_benefits TEXT,
    press_org TEXT,
    journalist_name TEXT,
    article_link TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_evcost_event ON event_costs(event_id);

  -- Hội phí hiệp hội theo năm (mức đóng + hạn đóng khác nhau mỗi năm)
  CREATE TABLE IF NOT EXISTS association_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    year INTEGER,
    amount INTEGER,              -- mật (nhóm org_fee)
    due_date TEXT,              -- hạn đóng YYYY-MM-DD
    paid_date TEXT,            -- ngày đã đóng
    status TEXT DEFAULT 'Chưa đóng',  -- Chưa đóng / Đã đóng
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_fee_org ON association_fees(org_id);

  -- Đối tác bộ ngành: Hồ sơ hợp tác & thỏa thuận (MOU)
  CREATE TABLE IF NOT EXISTS agreements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    signed_date TEXT,
    valid_until TEXT,
    terms TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Đối tác bộ ngành: Lịch sử làm việc (thay cho "tương tác" với cơ quan nhà nước)
  CREATE TABLE IF NOT EXISTS work_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    category TEXT,        -- Tiếp đón đoàn / Làm việc tại cơ quan / Công văn phối hợp / Đối ngoại
    work_date TEXT,
    topic TEXT,
    result TEXT,
    status TEXT,          -- Đang xử lý / Hoàn thành / Theo dõi
    staff TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_agree_org ON agreements(org_id);
  CREATE INDEX IF NOT EXISTS idx_wl_org ON work_logs(org_id);

  -- Quà tặng đối ngoại / lịch sử chúc mừng (gắn nhân sự hoặc cơ quan)
  CREATE TABLE IF NOT EXISTS gifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_type TEXT NOT NULL,   -- person / org
    owner_id INTEGER NOT NULL,
    gift_type TEXT,             -- Hoa / Quà / Tiền mặt
    value INTEGER,              -- giá trị (mật, nhóm org_fee)
    giver TEXT,
    event_date TEXT,
    occasion TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Lịch sử sử dụng quyền lợi hợp đồng đổi hàng (báo chí)
  CREATE TABLE IF NOT EXISTS benefit_usages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    used_date TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_gift_owner ON gifts(owner_type, owner_id);
  CREATE INDEX IF NOT EXISTS idx_benefit_org ON benefit_usages(org_id);

  -- Nhà cung cấp: lịch sử giao dịch (hợp đồng/đơn hàng)
  CREATE TABLE IF NOT EXISTS supplier_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    service_type TEXT,     -- loại dịch vụ
    purpose TEXT,          -- mục đích
    contract_no TEXT,      -- số hợp đồng/đơn hàng
    value INTEGER,         -- giá trị (mật nhóm org_fee)
    signed_date TEXT,      -- ngày ký/yêu cầu
    exec_deadline TEXT,    -- thời hạn thực hiện/thi công
    status TEXT,           -- tình trạng thực hiện
    staff TEXT,            -- nhân sự phụ trách
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_strans_sup ON supplier_transactions(supplier_id);
  CREATE TABLE IF NOT EXISTS supplier_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    full_name TEXT,        -- họ tên
    position TEXT,         -- chức vụ
    phone TEXT,            -- SĐT
    email TEXT,            -- email
    role TEXT,             -- vai trò
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_scontact_sup ON supplier_contacts(supplier_id);

  -- =================== GIÁM SÁT TRUYỀN THÔNG (Social Listening) ===================
  -- Bộ từ khóa quét (hỗ trợ boolean: include = OR của các nhóm AND; exclude = NOT)
  CREATE TABLE IF NOT EXISTS scan_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'brand',   -- brand / industry / competitor
    query_type TEXT NOT NULL DEFAULT 'news',   -- news / social (social để sau)
    include TEXT,                              -- JSON: [["MISA","Hóa đơn điện tử"], ["MISA"]]  (OR của các nhóm AND)
    exclude TEXT,                              -- JSON: ["tuyển dụng"]
    competitor_id INTEGER,                     -- nếu category=competitor
    enabled INTEGER NOT NULL DEFAULT 1,
    grounding INTEGER NOT NULL DEFAULT 0,      -- quét mở rộng bằng Gemini Google Search
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Nguồn tin (RSS báo chí / sau này social)
  CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'news',         -- news / facebook / tiktok / ...
    url TEXT,                                  -- link RSS / feed
    enabled INTEGER NOT NULL DEFAULT 1,
    auto INTEGER NOT NULL DEFAULT 1,           -- 1 = do hệ thống seed (được reconcile); 0 = user tự thêm (giữ nguyên)
    mode VARCHAR(20) NOT NULL DEFAULT 'rss',   -- rss / site (quét RSS feed hay quét trực tiếp trang web)
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Tin/bài quét được
  CREATE TABLE IF NOT EXISTS mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_id INTEGER REFERENCES scan_queries(id) ON DELETE SET NULL,
    source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
    source_type TEXT,                          -- news / facebook / ...
    source_name TEXT,                          -- Báo Tuổi Trẻ / Fanpage CafeF / ...
    category TEXT,                             -- brand / industry / competitor
    title TEXT,
    link TEXT UNIQUE,                          -- dedup theo link
    content TEXT,                              -- mô tả/nội dung thô
    ai_summary TEXT,                           -- tóm tắt AI
    tags TEXT,                                 -- JSON mảng tag
    sentiment TEXT,                            -- positive / neutral / negative / null
    sentiment_score REAL,                      -- -1..1
    sentiment_by TEXT,                         -- ai / human
    published_at TEXT,                         -- YYYY-MM-DD (ngày xuất bản)
    status TEXT NOT NULL DEFAULT 'Mới',        -- Mới / Đang xử lý / Đã duyệt / Bỏ qua
    next_action TEXT,                          -- trạng thái làm việc tiếp theo
    assignee TEXT,                             -- nhân sự phụ trách
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_mention_pub ON mentions(published_at);
  CREATE INDEX IF NOT EXISTS idx_mention_cat ON mentions(category);
  CREATE INDEX IF NOT EXISTS idx_mention_sent ON mentions(sentiment);
  -- Đối thủ cạnh tranh
  CREATE TABLE IF NOT EXISTS competitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    website TEXT,
    fanpage TEXT,
    channels TEXT,                             -- JSON mảng kênh vệ tinh
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Cảnh báo (khủng hoảng…)
  CREATE TABLE IF NOT EXISTS monitor_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL DEFAULT 'warning',     -- info / warning / critical
    title TEXT NOT NULL,
    detail TEXT,
    occur_date TEXT,                           -- YYYY-MM-DD (gom 1 cảnh báo/ngày)
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Nhật ký mỗi lần quét
  CREATE TABLE IF NOT EXISTS scan_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    queries INTEGER DEFAULT 0,
    fetched INTEGER DEFAULT 0,
    new_mentions INTEGER DEFAULT 0,
    analyzed INTEGER DEFAULT 0,
    pos INTEGER DEFAULT 0,                      -- breakdown sắc thái tin MỚI của lượt quét
    neu INTEGER DEFAULT 0,
    neg INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',             -- running / done / error
    error TEXT,
    triggered_by TEXT
  );
  -- Audit khi sửa nhãn sắc thái (ai sửa / khi nào)
  CREATE TABLE IF NOT EXISTS sentiment_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mention_id INTEGER REFERENCES mentions(id) ON DELETE CASCADE,
    old_sentiment TEXT,
    new_sentiment TEXT,
    user_id INTEGER,
    username TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Khóa/giá trị cấu hình (settings quét, phiên bản seed nguồn…)
  CREATE TABLE IF NOT EXISTS app_meta (
    \`key\` TEXT PRIMARY KEY,
    value TEXT
  );
  -- D13: cấu hình hiển thị theo field. Thiếu dòng luôn được PolicyEngine coi là private.
  CREATE TABLE IF NOT EXISTS field_visibility (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    field TEXT NOT NULL,
    is_public INTEGER NOT NULL DEFAULT 0,
    updated_by INTEGER REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(module, field)
  );
  -- Chiến dịch truyền thông
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    message TEXT,                              -- thông điệp chiến dịch
    content TEXT,                              -- nội dung chiến dịch
    audience TEXT,                             -- đối tượng tác động
    keywords TEXT,                             -- JSON mảng từ khóa chiến dịch
    competitors TEXT,                          -- JSON [{name, keywords:[...]}]
    status TEXT DEFAULT 'Đang chạy',
    note TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `);
  migrate();
  seedMonitoringDefaults();
}

// key/value config
function metaGet(key, def) { try { const r = db.prepare('SELECT value FROM app_meta WHERE `key`=?').get(key); return r ? r.value : def; } catch { return def; } }
function metaSet(key, value) { db.prepare('INSERT INTO app_meta (`key`,value) VALUES (?,?) ON CONFLICT(`key`) DO UPDATE SET value=excluded.value').run(key, String(value)); }

// Nguồn RSS + bộ từ khóa mặc định — idempotent, tạo cả trên DB cũ (không cần reseed)
const NEWS_SOURCES_VER = '3'; // tăng khi đổi danh sách news_sources.js -> reconcile lại
function seedMonitoringDefaults() {
  try {
    // Nguồn RSS THEO ĐẦU BÁO (server/news_sources.js). Reconcile: khi đổi version thì
    // xóa nguồn auto=1 (do hệ thống seed) rồi seed lại, GIỮ nguồn user tự thêm (auto=0).
    let NEWS_SOURCES = [];
    try { NEWS_SOURCES = require('./news_sources'); } catch {}
    if (metaGet('news_sources_ver') !== NEWS_SOURCES_VER && NEWS_SOURCES.length) {
      db.prepare('DELETE FROM sources WHERE auto=1').run();
      const insSrc = db.prepare('INSERT INTO sources (name, type, url, auto) VALUES (?,?,?,1)');
      const have = new Set(db.prepare('SELECT url FROM sources').all().map((r) => r.url));
      let added = 0;
      for (const [name, url] of NEWS_SOURCES) if (url && !have.has(url)) { insSrc.run(name, 'news', url); have.add(url); added++; }
      metaSet('news_sources_ver', NEWS_SOURCES_VER);
      console.log(`[seed] reconcile nguồn RSS theo đầu báo: ${added} nguồn (ver ${NEWS_SOURCES_VER}).`);
    }
    const nQ = db.prepare('SELECT COUNT(*) c FROM scan_queries').get().c;
    if (nQ === 0) {
      const ins = db.prepare('INSERT INTO scan_queries (name, category, query_type, include, exclude, grounding) VALUES (?,?,?,?,?,?)');
      ins.run('Thương hiệu MISA', 'brand', 'news', JSON.stringify([['MISA']]), JSON.stringify(['tuyển dụng', 'tuyển sinh']), 1);
      ins.run('Hóa đơn điện tử', 'industry', 'news', JSON.stringify([['hóa đơn điện tử']]), null, 0);
      ins.run('Hộ kinh doanh', 'industry', 'news', JSON.stringify([['hộ kinh doanh']]), null, 0);
      ins.run('Chuyển đổi số doanh nghiệp', 'industry', 'news', JSON.stringify([['chuyển đổi số', 'doanh nghiệp']]), null, 0);
    }
  } catch (e) { console.error('[seedMonitoringDefaults]', e.message); }
}

// Lỗi "duplicate column" (đã có cột từ lần chạy trước) là idempotency bình thường của add() bên
// dưới — mỗi lần app khởi động lại chạy qua toàn bộ migrate(), các ALTER TABLE của những lần chạy
// trước chắc chắn khớp mẫu này, phải bỏ qua âm thầm. Mọi lỗi KHÁC (cú pháp không tương thích MySQL,
// quyền, mất kết nối...) PHẢI làm app dừng khởi động ngay — không được chỉ log rồi tiếp tục chạy
// với schema thiếu, vì đó chính là cơ chế đã khiến F17 (cột sources.mode) biến mất hoàn toàn trên
// MySQL trong thời gian dài mà không ai biết (xem 01-audit-findings.md §F17).
function isIgnorableMigrationError(message) {
  return /duplicate column|already exists/i.test(String(message || ''));
}

// Thêm cột còn thiếu cho DB cũ (idempotent) — để deploy không cần reseed, không mất dữ liệu
function migrate() {
  const add = (sql) => {
    try { db.exec(sql); }
    catch (e) {
      const msg = String(e.message || '');
      if (isIgnorableMigrationError(msg)) return;
      console.error('[migrate] lỗi ALTER TABLE (dừng khởi động):', sql, '->', msg);
      throw e;
    }
  };
  add("ALTER TABLE users ADD COLUMN sensitive_perms TEXT");
  add("ALTER TABLE users ADD COLUMN email TEXT");
  add("ALTER TABLE users ADD COLUMN notify_opt_in INTEGER NOT NULL DEFAULT 1");
  // RBAC v2 foundation. Existing files start private; no route reads this value until the
  // PolicyEngine + backfill gate is complete, so this additive migration cannot expose data.
  add("ALTER TABLE attachments ADD COLUMN audience_visibility VARCHAR(20) NOT NULL DEFAULT 'private'");
  // D13 ownership foundation. Gifts đã dùng owner_id cho người/cơ quan nhận quà nên dùng tên
  // responsible_user_id cho nhân viên phụ trách (owner policy), tránh đổi nghĩa dữ liệu legacy.
  for (const table of ['bookings', 'interactions', 'awards', 'events', 'sponsorships', 'agreements', 'work_logs', 'association_fees', 'supplier_quotes', 'supplier_transactions', 'supplier_contacts', 'award_participations', 'benefit_usages']) {
    add(`ALTER TABLE ${table} ADD COLUMN owner_id INTEGER`);
  }
  add('ALTER TABLE gifts ADD COLUMN responsible_user_id INTEGER');
  // D13 batch RBAC-EXP-B4: award_participations/event_costs chua tung co created_by that (chi
  // awards/events co san tu CREATE TABLE ban dau) -- policyService.prepareCreate() luon gan
  // created_by, thieu cot se lam INSERT loi. event_costs KHONG duoc them owner_id (Inherited,
  // ke thua owner_id cua event cha, khong tu co chu so huu rieng — D13.4a).
  add('ALTER TABLE award_participations ADD COLUMN created_by INTEGER');
  add('ALTER TABLE event_costs ADD COLUMN created_by INTEGER');
  // D13 batch RBAC-EXP-B5: cung ly do nhu tren, cho 3 entity Direct nhom supplier con lai.
  for (const table of ['supplier_quotes', 'supplier_transactions', 'supplier_contacts']) {
    add(`ALTER TABLE ${table} ADD COLUMN created_by INTEGER`);
  }
  // D13 batch RBAC-EXP-B6 (batch cuoi cung): cung ly do nhu tren, cho 6 entity Direct con lai.
  for (const table of ['sponsorships', 'agreements', 'work_logs', 'association_fees', 'gifts', 'benefit_usages']) {
    add(`ALTER TABLE ${table} ADD COLUMN created_by INTEGER`);
  }
  add("ALTER TABLE people ADD COLUMN phone_other TEXT");
  add("ALTER TABLE bookings ADD COLUMN award_id INTEGER");
  add("ALTER TABLE bookings ADD COLUMN event_id INTEGER");
  // Sự kiện: số bài keynote/phát biểu của lãnh đạo MISA (cho thống kê Trang tổng quan)
  add("ALTER TABLE events ADD COLUMN misa_keynotes INTEGER");
  // Giám sát: quét mở rộng bằng Google Search grounding (per bộ từ khóa)
  add("ALTER TABLE scan_queries ADD COLUMN grounding INTEGER NOT NULL DEFAULT 0");
  add("ALTER TABLE sources ADD COLUMN auto INTEGER NOT NULL DEFAULT 1");
  add("ALTER TABLE scan_runs ADD COLUMN pos INTEGER DEFAULT 0");
  add("ALTER TABLE scan_runs ADD COLUMN neu INTEGER DEFAULT 0");
  add("ALTER TABLE scan_runs ADD COLUMN neg INTEGER DEFAULT 0");
  // Giám sát: nhóm từ khóa đã khớp (để đo hiệu quả từng từ khóa) + nguồn dạng website thường (quét qua Google Search)
  add("ALTER TABLE mentions ADD COLUMN matched_group TEXT");
  // Dùng VARCHAR (không phải TEXT) vì MySQL không cho phép cột TEXT/BLOB có DEFAULT literal
  // (lỗi "BLOB, TEXT, GEOMETRY or JSON column can't have a default value") — với TEXT, ALTER TABLE
  // này từng fail SILENT trên MySQL (add() nuốt hết lỗi), khiến cột `mode` không tồn tại và mọi
  // lượt quét thật (POST /api/monitor/scan) trả 500 "Unknown column 'mode' in 'where clause'".
  add("ALTER TABLE sources ADD COLUMN mode VARCHAR(20) NOT NULL DEFAULT 'rss'");
  // Đối tác bộ ngành (gov)
  add("ALTER TABLE organizations ADD COLUMN admin_level TEXT");
  add("ALTER TABLE organizations ADD COLUMN agency_block TEXT");
  add("ALTER TABLE organizations ADD COLUMN contact_clerk TEXT");
  add("ALTER TABLE organizations ADD COLUMN org_departments TEXT");
  add("ALTER TABLE organizations ADD COLUMN org_leaders TEXT");
  add("ALTER TABLE organizations ADD COLUMN focal_partner_dev TEXT");
  add("ALTER TABLE organizations ADD COLUMN focal_pr TEXT");
  // Hiệp hội (association)
  add("ALTER TABLE organizations ADD COLUMN abbreviation TEXT");
  add("ALTER TABLE organizations ADD COLUMN hotline TEXT");
  add("ALTER TABLE organizations ADD COLUMN tax_code TEXT");
  add("ALTER TABLE organizations ADD COLUMN field_area TEXT");
  // Báo chí (press): đánh giá + hợp tác đổi hàng
  add("ALTER TABLE organizations ADD COLUMN political_rank TEXT");
  add("ALTER TABLE organizations ADD COLUMN charter TEXT");
  add("ALTER TABLE organizations ADD COLUMN contract_term TEXT");
  add("ALTER TABLE organizations ADD COLUMN contract_benefits TEXT");
  add("ALTER TABLE organizations ADD COLUMN contract_staff TEXT");
  // VIP Profile + mạng lưới nhân sự (người)
  add("ALTER TABLE people ADD COLUMN gender TEXT");
  add("ALTER TABLE people ADD COLUMN marital_status TEXT");
  add("ALTER TABLE people ADD COLUMN personality TEXT");
  add("ALTER TABLE people ADD COLUMN hobbies TEXT");
  add("ALTER TABLE people ADD COLUMN food_habits TEXT");
  add("ALTER TABLE people ADD COLUMN family_info TEXT");
  add("ALTER TABLE people ADD COLUMN media_stance TEXT");
  add("ALTER TABLE people ADD COLUMN relationship_network TEXT");
  add("ALTER TABLE people ADD COLUMN meeting_places TEXT");
  add("ALTER TABLE people ADD COLUMN gift_rules TEXT");
  add("ALTER TABLE people ADD COLUMN assoc_position TEXT");   // chức vụ trong Hiệp hội
  add("ALTER TABLE people ADD COLUMN external_position TEXT"); // chức vụ ngoài Hiệp hội
  add("ALTER TABLE people ADD COLUMN assoc_role TEXT");        // vai trò trong Hiệp hội
  add("ALTER TABLE people ADD COLUMN current_workplace TEXT");
  add("ALTER TABLE people ADD COLUMN assoc_join_year INTEGER");
  add("ALTER TABLE people ADD COLUMN assoc_current_role TEXT");
  add("ALTER TABLE people ADD COLUMN assoc_events TEXT");
  add("ALTER TABLE people ADD COLUMN assoc_awards TEXT");
  // Hội phí: nhân sự chạy quy trình
  add("ALTER TABLE association_fees ADD COLUMN staff TEXT");
  // Nhà cung cấp: lĩnh vực hoạt động
  add("ALTER TABLE suppliers ADD COLUMN industry TEXT");
  // Lịch sử tương tác: công việc tiếp theo (VIP profile)
  add("ALTER TABLE interactions ADD COLUMN next_task TEXT");
  add("ALTER TABLE interactions ADD COLUMN next_status TEXT");
  add("ALTER TABLE interactions ADD COLUMN next_due TEXT");
  add("ALTER TABLE interactions ADD COLUMN next_staff TEXT");
  add("ALTER TABLE interactions ADD COLUMN work_mode TEXT");
  add("ALTER TABLE sponsorships ADD COLUMN sponsor_benefits TEXT");
  // Hiệp hội: Hồ sơ vị thế của MISA (cấp tổ chức)
  add("ALTER TABLE organizations ADD COLUMN misa_current_role TEXT"); // vai trò hiện tại của MISA tại tổ chức
  add("ALTER TABLE organizations ADD COLUMN misa_events TEXT");       // các sự kiện MISA tham gia trong năm
  add("ALTER TABLE organizations ADD COLUMN misa_awards TEXT");       // các giải thưởng MISA đạt trong năm
  // Lịch sử tham gia Giải thưởng & tài trợ Sự kiện (mở rộng sponsorships)
  add("ALTER TABLE sponsorships ADD COLUMN product TEXT");          // sản phẩm tham gia (giải thưởng)
  add("ALTER TABLE sponsorships ADD COLUMN category TEXT");         // hạng mục tham gia
  add("ALTER TABLE sponsorships ADD COLUMN submit_deadline TEXT");  // thời hạn nộp hồ sơ
  add("ALTER TABLE sponsorships ADD COLUMN present_deadline TEXT"); // thời hạn thuyết trình
  add("ALTER TABLE sponsorships ADD COLUMN scale TEXT");            // quy mô (sự kiện)
  add("ALTER TABLE sponsorships ADD COLUMN sponsor_package TEXT");  // gói tài trợ
  add("ALTER TABLE sponsorships ADD COLUMN result TEXT");           // kết quả đạt giải
  add("ALTER TABLE sponsorships ADD COLUMN contact_point TEXT");    // đầu mối làm việc
  add("ALTER TABLE sponsorships ADD COLUMN staff TEXT");            // nhân sự phụ trách
  add("ALTER TABLE sponsorships ADD COLUMN status TEXT");           // trạng thái
  // D13 RBAC-CUTOVER (2026-08-30, remediation P1 audit F19): anh xa co dinh owner da duyet —
  // user cu con mang role legacy 'pr_staff' phai duoc chuyen thanh 'executor' THAT trong DB,
  // khong chi doi ten trong code. rbac.js MATRIX khong con key 'pr_staff' tu sau RBAC-CUTOVER
  // (90b8853/f170e62) nen thieu migration nay se khoa hoan toan user cu sau deploy (moi
  // requirePerm/rbac.can deu tra false). UPDATE tu than idempotent (chay lai anh huong 0 dong),
  // khong can boc qua add()/isIgnorableMigrationError.
  db.exec("UPDATE users SET role='executor' WHERE role='pr_staff'");
}

function seed() {
  const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (userCount > 0) return;

  const hash = (p) => bcrypt.hashSync(p, 10);
  const ALL = JSON.stringify(['contact', 'private', 'social', 'finance', 'iddoc', 'org_fee']);
  const insUser = db.prepare('INSERT INTO users (username, password_hash, full_name, role, email, sensitive_perms) VALUES (?,?,?,?,?,?)');
  // Seed demo 2 tài khoản trong 4 vai trò D13 (viewer/executor/admin/super_admin): Quản lý phòng
  // (super_admin, toàn quyền) + Chuyên viên PR (executor, CRUD nghiệp vụ, xem mật theo phân quyền).
  // viewer/admin tạo qua POST /api/admin/users khi cần (rbac.ROLES đã khai đủ 4 vai trò).
  insUser.run('admin', hash('admin123'), 'Quản lý phòng PR', 'super_admin', 'tkmedia@misa.com.vn', ALL);
  insUser.run('chuyenvien', hash('123456'), 'Chuyên viên PR', 'executor', null, JSON.stringify(['contact']));

  // Dữ liệu mẫu demo chỉ tạo khi chạy với --demo (mặc định: sạch để nhập liệu thật)
  const DEMO = process.argv.includes('--demo') || process.env.SEED_DEMO === '1';
  if (DEMO) {
  // ---------- Cơ quan ----------
  const insOrg = db.prepare(`INSERT INTO organizations
    (name, org_type, tier, founded_date, parent_org, website, address, press_types, misa_role, join_date, membership_fee, note)
    VALUES (@name,@org_type,@tier,@founded_date,@parent_org,@website,@address,@press_types,@misa_role,@join_date,@membership_fee,@note)`);
  const org = (o) => insOrg.run({
    name: o.name, org_type: o.org_type, tier: o.tier || null, founded_date: o.founded_date || null,
    parent_org: o.parent_org || null, website: o.website || null, address: o.address || null,
    press_types: o.press_types ? JSON.stringify(o.press_types) : null,
    misa_role: o.misa_role || null, join_date: o.join_date || null,
    membership_fee: o.membership_fee ?? null, note: o.note || null,
  }).lastInsertRowid;

  const oVne = org({ name: 'Báo VnExpress', org_type: 'press', tier: 'Trọng điểm', founded_date: '2001-02-26', parent_org: 'Bộ Khoa học & Công nghệ', website: 'vnexpress.net', address: 'Tòa nhà FPT, Cầu Giấy, Hà Nội', press_types: ['Báo điện tử'], note: 'Đầu mối mảng công nghệ' });
  const oTuoiTre = org({ name: 'Báo Tuổi Trẻ', org_type: 'press', tier: 'Trọng điểm', founded_date: '1975-09-02', parent_org: 'Thành Đoàn TP.HCM', website: 'tuoitre.vn', address: '60A Hoàng Văn Thụ, Q.Phú Nhuận, TP.HCM', press_types: ['Báo in', 'Báo điện tử'] });
  const oVTV = org({ name: 'Đài Truyền hình Việt Nam (VTV)', org_type: 'press', tier: 'Trọng điểm', founded_date: '1970-09-07', parent_org: 'Chính phủ', website: 'vtv.vn', address: '43 Nguyễn Chí Thanh, Ba Đình, Hà Nội', press_types: ['Truyền hình', 'Báo điện tử'] });
  const oTTX = org({ name: 'Thông tấn xã Việt Nam', org_type: 'press', tier: 'Trọng điểm', founded_date: '1945-09-15', parent_org: 'Chính phủ', website: 'vnanet.vn', address: '5 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội', press_types: ['Báo điện tử', 'Báo in', 'Truyền hình', 'Phát thanh'], note: 'Cơ quan thông tấn đa loại hình' });
  const oSGT = org({ name: 'Tạp chí Kinh tế Sài Gòn', org_type: 'press', tier: 'Quan trọng', founded_date: '1991-01-01', parent_org: 'UBND TP.HCM', website: 'thesaigontimes.vn', address: '35 Nam Kỳ Khởi Nghĩa, Q.1, TP.HCM', press_types: ['Tạp chí', 'Báo điện tử'], note: 'Mảng kinh tế - tài chính' });

  const oVinasa = org({ name: 'Hiệp hội Phần mềm & Dịch vụ CNTT VN (VINASA)', org_type: 'association', tier: 'Trọng điểm', founded_date: '2002-04-27', website: 'vinasa.org.vn', address: 'Hà Nội', misa_role: 'Ủy viên BCH', join_date: '2015-03-01', membership_fee: 50000000, note: 'Tham gia tích cực các sự kiện Sao Khuê' });
  const oVcci = org({ name: 'Liên đoàn Thương mại & Công nghiệp VN (VCCI)', org_type: 'association', tier: 'Quan trọng', founded_date: '1963-04-27', website: 'vcci.com.vn', address: '9 Đào Duy Anh, Hà Nội', misa_role: 'Hội viên', join_date: '2016-01-10', membership_fee: 30000000, note: 'Quan hệ cấp cao' });

  const oBoTTTT = org({ name: 'Bộ Thông tin & Truyền thông', org_type: 'gov', tier: 'Trọng điểm', founded_date: '2007-08-01', parent_org: 'Chính phủ', website: 'mic.gov.vn', address: '18 Nguyễn Du, Hai Bà Trưng, Hà Nội', note: 'Quản lý nhà nước về báo chí' });
  const oThue = org({ name: 'Tổng cục Thuế', org_type: 'gov', tier: 'Quan trọng', founded_date: '1990-10-07', parent_org: 'Bộ Tài chính', website: 'gdt.gov.vn', address: '123 Lò Đúc, Hai Bà Trưng, Hà Nội', note: 'Liên quan hóa đơn điện tử' });

  const oTapDoanX = org({ name: 'Tập đoàn X', org_type: 'other', tier: 'Quan trọng', address: 'TP.HCM', note: 'Đối tác chiến lược' });
  org({ name: 'Trường Đại học Y', org_type: 'other', tier: 'Thường', address: 'Hà Nội' });

  // ---------- Nhân sự ----------
  const insP = db.prepare(`INSERT INTO people
    (org_id, full_name, level, position, beat, category, relationship_score, status, email_work, phone_work,
     phone_personal, phone_other, phone_ott, dob, home_address, personal_notes,
     social_facebook, social_instagram, social_tiktok, social_x, social_thread, bank_account_number, bank_name)
    VALUES (@org_id,@full_name,@level,@position,@beat,@category,@relationship_score,@status,@email_work,@phone_work,
     @phone_personal,@phone_other,@phone_ott,@dob,@home_address,@personal_notes,
     @social_facebook,@social_instagram,@social_tiktok,@social_x,@social_thread,@bank_account_number,@bank_name)`);
  const person = (p) => insP.run({
    org_id: p.org_id, full_name: p.full_name, level: p.level || null, position: p.position || null,
    beat: p.beat || null, category: p.category || null, relationship_score: p.relationship_score ?? 0,
    status: p.status || 'Đang hợp tác', email_work: p.email_work || null, phone_work: p.phone_work || null,
    phone_personal: p.phone_personal || null, phone_other: p.phone_other || null, phone_ott: p.phone_ott ? JSON.stringify(p.phone_ott) : null,
    dob: p.dob || null, home_address: p.home_address || null, personal_notes: p.personal_notes || null,
    social_facebook: p.social_facebook || null, social_instagram: p.social_instagram || null,
    social_tiktok: p.social_tiktok || null, social_x: p.social_x || null, social_thread: p.social_thread || null,
    bank_account_number: p.bank_account_number || null, bank_name: p.bank_name || null,
  }).lastInsertRowid;

  const pTbtVne = person({ org_id: oVne, full_name: 'Phạm Hồng Quân', level: 'Lãnh đạo', position: 'Tổng biên tập', category: 'VIP', relationship_score: 80, status: 'Thân thiết', email_work: 'tbt@vnexpress.net', phone_work: '024.3868xxxx', phone_personal: '0903 100 100', phone_ott: { zalo: true, telegram: true }, dob: '1972-06-21', home_address: 'Ba Đình, Hà Nội', personal_notes: 'Thích bóng đá, golf' });
  person({ org_id: oVne, full_name: 'Ngô Trưởng Ban', level: 'Quản lý', position: 'Trưởng ban Công nghệ', beat: 'Công nghệ', relationship_score: 78, status: 'Thân thiết', email_work: 'cn@vnexpress.net', phone_work: '024.3868xxxx', phone_personal: '0903 110 220', phone_ott: { zalo: true } });
  const pMinhAnh = person({ org_id: oVne, full_name: 'Hoàng Minh Anh', level: 'Phóng viên', position: 'Phóng viên', beat: 'Công nghệ', category: 'Phóng viên', relationship_score: 85, status: 'Thân thiết', email_work: 'minhanh@vnexpress.net', phone_work: '024.3868xxxx', phone_personal: '0903 111 222', phone_ott: { zalo: true, viber: true }, dob: '1990-05-12', home_address: 'Cầu Giấy, Hà Nội', personal_notes: 'Thích cà phê, hay viết bài cuối tuần', social_facebook: 'fb.com/hoangminhanh', social_x: '@minhanh_tech', bank_account_number: '0011000456789', bank_name: 'Vietcombank' });

  person({ org_id: oTuoiTre, full_name: 'Đỗ Thu Hà', level: 'Phóng viên', position: 'Biên tập viên', beat: 'Kinh tế', category: 'Phóng viên', relationship_score: 72, status: 'Đang hợp tác', email_work: 'thuha@tuoitre.vn', phone_work: '028.3997xxxx', phone_personal: '0908 333 444', phone_ott: { zalo: true, whatsapp: true }, dob: '1988-09-03', home_address: 'Quận 3, TP.HCM', personal_notes: 'Quan tâm chuyển đổi số', social_facebook: 'fb.com/dothuha', social_instagram: '@thuha.do' });
  person({ org_id: oTuoiTre, full_name: 'Lý Thư Ký', level: 'Quản lý', position: 'Thư ký tòa soạn', relationship_score: 65, status: 'Đang hợp tác', email_work: 'tkts@tuoitre.vn', phone_work: '028.3997xxxx' });

  person({ org_id: oVTV, full_name: 'Trần Biên Tập', level: 'Lãnh đạo', position: 'Phó Tổng Giám đốc', category: 'VIP', relationship_score: 70, status: 'Đang hợp tác', email_work: 'lanhdao@vtv.vn', phone_work: '024.3831xxxx', phone_personal: '0912 222 333', phone_ott: { zalo: true } });
  const pBaoVTV = person({ org_id: oVTV, full_name: 'Vũ Quốc Bảo', level: 'Phóng viên', position: 'Phóng viên', beat: 'Thời sự', category: 'Phóng viên', relationship_score: 60, status: 'Đang hợp tác', email_work: 'quocbao@vtv.vn', phone_work: '024.3831xxxx', phone_personal: '0912 555 666', phone_ott: { telegram: true }, dob: '1992-01-20', home_address: 'Bình Thạnh, TP.HCM' });

  person({ org_id: oSGT, full_name: 'Ngô Khánh Linh', level: 'Quản lý', position: 'Trưởng ban Tài chính', beat: 'Tài chính', category: 'Phóng viên', relationship_score: 90, status: 'Thân thiết', email_work: 'khanhlinh@thesaigontimes.vn', phone_work: '028.3829xxxx', phone_personal: '0987 777 888', phone_ott: { zalo: true, viber: true, telegram: true }, dob: '1985-11-30', home_address: 'Quận 1, TP.HCM', personal_notes: 'Đầu mối quan trọng mảng tài chính', bank_account_number: '19001234567', bank_name: 'Techcombank' });

  person({ org_id: oVinasa, full_name: 'Nguyễn Văn A', level: 'Lãnh đạo', position: 'Chủ tịch', category: 'VIP', relationship_score: 75, status: 'Thân thiết', phone_work: '024.xxxx', phone_personal: '0900 000 111', phone_ott: { zalo: true } });
  person({ org_id: oVinasa, full_name: 'Lê Tổng Thư Ký', level: 'Quản lý', position: 'Tổng thư ký', relationship_score: 68, status: 'Đang hợp tác', email_work: 'tongthuky@vinasa.org.vn', phone_work: '024.xxxx' });
  person({ org_id: oVcci, full_name: 'Phạm Văn E', level: 'Lãnh đạo', position: 'Phó Chủ tịch', category: 'VIP', relationship_score: 64, status: 'Đang hợp tác', phone_work: '024.xxxx' });

  person({ org_id: oBoTTTT, full_name: 'Ông Vụ Trưởng', level: 'Lãnh đạo', position: 'Vụ trưởng Vụ Báo chí', relationship_score: 55, status: 'Đang hợp tác', phone_work: '024.xxxx', phone_personal: '0911 000 222' });
  person({ org_id: oThue, full_name: 'Bà Phó Tổng Cục', level: 'Lãnh đạo', position: 'Phó Tổng cục trưởng', relationship_score: 50, status: 'Cần kết nối', phone_work: '024.xxxx' });

  person({ org_id: oTapDoanX, full_name: 'Lê Đại Diện', level: 'Lãnh đạo', position: 'Phó TGĐ', category: 'VIP', relationship_score: 80, status: 'Thân thiết', email_work: 'daidien@x.vn', phone_work: '024.xxx', phone_personal: '0901 234 567', phone_ott: { zalo: true, whatsapp: true }, personal_notes: 'Đối tác chiến lược' });

  // ---------- Tài trợ / giải thưởng ----------
  const insS = db.prepare('INSERT INTO sponsorships (org_id, title, type, amount, event_date, note) VALUES (?,?,?,?,?,?)');
  insS.run(oVinasa, 'Tài trợ Vàng Lễ trao giải Sao Khuê 2026', 'Tài trợ', 200000000, '2026-04-20', '');
  insS.run(oVinasa, 'Giải thưởng Sao Khuê cho sản phẩm AMIS', 'Giải thưởng', 0, '2026-04-20', 'Hạng mục xuất sắc');
  insS.run(oVcci, 'Tài trợ Diễn đàn Doanh nghiệp', 'Tài trợ', 80000000, '2026-05-10', '');

  // ---------- Ngày quan trọng để nhắc ----------
  const insD = db.prepare(`INSERT INTO important_dates
    (title, date_type, subject_type, subject_id, subject_name, event_date, recurring, lead_days, note)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  insD.run('Sinh nhật Tổng biên tập VnExpress', 'birthday', 'person', pTbtVne, 'Phạm Hồng Quân', '1972-06-21', 1, 10, 'Gửi hoa + thiệp');
  insD.run('Sinh nhật PV Hoàng Minh Anh', 'birthday', 'person', pMinhAnh, 'Hoàng Minh Anh', '1990-05-12', 1, 7, '');
  insD.run('Sinh nhật PV Vũ Quốc Bảo (VTV)', 'birthday', 'person', pBaoVTV, 'Vũ Quốc Bảo', '1992-01-20', 1, 7, '');
  insD.run('Kỷ niệm thành lập Báo Tuổi Trẻ', 'founding', 'organization', oTuoiTre, 'Báo Tuổi Trẻ', '1975-09-02', 1, 14, 'Gửi lẵng hoa chúc mừng');
  insD.run('Kỷ niệm thành lập VnExpress', 'founding', 'organization', oVne, 'Báo VnExpress', '2001-02-26', 1, 14, '');
  insD.run('Ngày Báo chí Cách mạng Việt Nam', 'anniversary', 'general', null, null, '2026-06-21', 1, 14, 'Chúc mừng toàn bộ cơ quan báo chí đối tác');

  // ---------- Tương tác mẫu ----------
  const insI = db.prepare(`INSERT INTO interactions
    (partner_type, partner_id, partner_name, date, channel, summary, result, staff, created_by)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  insI.run('person', pMinhAnh, 'Hoàng Minh Anh', '2026-06-10', 'Gặp mặt', 'Trao đổi định hướng bài về AMIS', 'Tích cực', 'Chuyên viên PR', 2);
  insI.run('org', oVinasa, 'VINASA', '2026-06-05', 'Sự kiện', 'Họp BCH chuẩn bị Sao Khuê', 'Tích cực', 'Quản lý phòng PR', 1);

  // ---------- Booking bài viết ----------
  const insB = db.prepare(`INSERT INTO bookings
    (subject_type, subject_id, subject_name, org_id, org_name, content_type, title, amount, article_link, booked_date, publish_date, status, created_by)
    VALUES (@subject_type,@subject_id,@subject_name,@org_id,@org_name,@content_type,@title,@amount,@article_link,@booked_date,@publish_date,@status,@created_by)`);
  const book = (b) => insB.run({ article_link: null, status: 'Đã đăng', created_by: 2, ...b });
  book({ subject_type: 'person', subject_id: pMinhAnh, subject_name: 'Hoàng Minh Anh', org_id: oVne, org_name: 'Báo VnExpress', content_type: 'Bài viết', title: 'Bài PR ra mắt AMIS Kế toán 2026', amount: 25000000, article_link: 'https://vnexpress.net/amis-2026', booked_date: '2026-04-08', publish_date: '2026-04-15', status: 'Đã nghiệm thu' });
  book({ subject_type: 'org', subject_id: oTuoiTre, subject_name: 'Báo Tuổi Trẻ', org_id: oTuoiTre, org_name: 'Báo Tuổi Trẻ', content_type: 'Phóng sự', title: 'Phóng sự chuyển đổi số DN nhỏ', amount: 40000000, article_link: 'https://tuoitre.vn/cds-dnnvv', booked_date: '2026-05-05', publish_date: '2026-05-20', status: 'Đã nghiệm thu' });
  book({ subject_type: 'org', subject_id: oVTV, subject_name: 'Đài Truyền hình Việt Nam (VTV)', org_id: oVTV, org_name: 'Đài Truyền hình Việt Nam (VTV)', content_type: 'Lên tin', title: 'Đưa tin lễ trao giải Sao Khuê', amount: 60000000, booked_date: '2026-06-02', publish_date: '2026-06-12', status: 'Đã đăng' });
  book({ subject_type: 'person', subject_id: pMinhAnh, subject_name: 'Hoàng Minh Anh', org_id: oVne, org_name: 'Báo VnExpress', content_type: 'Bài viết', title: 'Bài chuyên đề hóa đơn điện tử', amount: 20000000, booked_date: '2026-06-09', publish_date: null, status: 'Đã đặt' });
  book({ subject_type: 'org', subject_id: oSGT, subject_name: 'Tạp chí Kinh tế Sài Gòn', org_id: oSGT, org_name: 'Tạp chí Kinh tế Sài Gòn', content_type: 'Bài viết', title: 'Bài phân tích tài chính DN', amount: 15000000, article_link: 'https://thesaigontimes.vn/tcdn', booked_date: '2026-03-18', publish_date: '2026-03-28', status: 'Đã nghiệm thu' });

  // ---------- Ngân sách theo tháng ----------
  const insBud = db.prepare('INSERT INTO budgets (period, amount, note) VALUES (?,?,?)');
  [['2026-03', 100000000], ['2026-04', 120000000], ['2026-05', 120000000], ['2026-06', 150000000]].forEach(([p, a]) => insBud.run(p, a, null));

  // ---------- Giải thưởng ----------
  const insAw = db.prepare(`INSERT INTO awards
    (name, organizer, org_id, organizer_type, scale, event_time, submission_deadline, eligibility, cost,
     criteria, required_docs, prize_structure, evaluation_method, scope, status, source_url, ai_summary, review_status, created_by)
    VALUES (@name,@organizer,@org_id,@organizer_type,@scale,@event_time,@submission_deadline,@eligibility,@cost,
     @criteria,@required_docs,@prize_structure,@evaluation_method,@scope,@status,@source_url,@ai_summary,@review_status,1)`);
  const award = (a) => insAw.run({
    organizer: null, org_id: null, organizer_type: null, scale: null, event_time: null, submission_deadline: null,
    eligibility: null, cost: null, criteria: null, required_docs: null, prize_structure: null, evaluation_method: null,
    scope: 'Trong nước', status: 'Đang nhận hồ sơ', source_url: null, ai_summary: null, review_status: 'Chuẩn hóa', ...a,
  }).lastInsertRowid;
  const awSaoKhue = award({ name: 'Giải thưởng Sao Khuê 2026', organizer: 'VINASA', org_id: oVinasa, organizer_type: 'association', scale: 'Toàn quốc', event_time: '2026-04', submission_deadline: '2026-02-28', eligibility: 'Doanh nghiệp/sản phẩm CNTT Việt Nam', cost: 15000000, criteria: 'Tính sáng tạo, hiệu quả thị trường, công nghệ', required_docs: 'Hồ sơ sản phẩm, video demo, tài liệu kỹ thuật', prize_structure: 'Top 10 + danh hiệu chuyên đề', evaluation_method: 'Hội đồng chấm 2 vòng + thuyết trình', ai_summary: 'Giải uy tín nhất ngành phần mềm VN do VINASA tổ chức thường niên.' });
  const awChuyenDoiSo = award({ name: 'Giải thưởng Chuyển đổi số Việt Nam (VDA) 2026', organizer: 'Hội Truyền thông số Việt Nam', organizer_type: 'association', scale: 'Toàn quốc', event_time: '2026-10', submission_deadline: '2026-08-15', eligibility: 'Sản phẩm/giải pháp chuyển đổi số', cost: 10000000, prize_structure: 'Theo hạng mục', scope: 'Trong nước', status: 'Sắp mở', review_status: 'Đã duyệt' });
  award({ name: 'Asia-Pacific ICT Alliance Awards (APICTA) 2026', organizer: 'APICTA', organizer_type: 'other', scale: 'Khu vực châu Á - TBD', event_time: '2026-12', submission_deadline: '2026-09-30', cost: 0, scope: 'Quốc tế', status: 'Sắp mở', review_status: 'Thô', ai_summary: 'Giải CNTT khu vực châu Á - Thái Bình Dương, cần được tiến cử quốc gia.' });

  const insPart = db.prepare(`INSERT INTO award_participations
    (award_id, year, status, products, categories, goal, purpose, capability, plan, budget, result)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  insPart.run(awSaoKhue, 2025, 'Đạt giải', 'MISA AMIS', 'Phần mềm quản trị doanh nghiệp', 'Giữ vị thế Top 10', 'Khẳng định thương hiệu', 'Cao - sản phẩm đã có thị phần lớn', 'Chuẩn bị hồ sơ từ Q4/2025', 20000000, 'Top 10 Sao Khuê 2025');
  insPart.run(awSaoKhue, 2026, 'Quyết định tham gia', 'MISA AMIS Kế toán 2026', 'Phần mềm tài chính - kế toán', 'Đạt danh hiệu xuất sắc', 'PR sản phẩm mới', 'Cao', 'Nộp hồ sơ trước 28/02/2026', 25000000, null);
  insPart.run(awChuyenDoiSo, 2026, 'Đang cân nhắc', 'MISA AMIS', 'Doanh nghiệp chuyển đổi số tiêu biểu', 'Tăng nhận diện', 'Truyền thông', 'Trung bình - cạnh tranh cao', null, 10000000, null);

  // ---------- Phân công người chăm sóc ----------
  const insAssign = db.prepare('INSERT OR IGNORE INTO assignments (user_id, subject_type, subject_id) VALUES (?,?,?)');
  // user 3 = chuyenvien, 2 = truongphong
  insAssign.run(2, 'org', oVne); insAssign.run(2, 'person', pMinhAnh); insAssign.run(2, 'award', awSaoKhue);
  insAssign.run(2, 'org', oTuoiTre); insAssign.run(2, 'person', pMinhAnh); insAssign.run(2, 'award', awSaoKhue);
  insAssign.run(2, 'org', oVTV);

  // Liên kết 1 booking với giải Sao Khuê (demo "chi phí truyền thông cho giải")
  db.prepare(`UPDATE bookings SET award_id=? WHERE title LIKE 'Bài PR ra mắt AMIS%'`).run(awSaoKhue);

  // ---------- Nhà cung cấp ----------
  const insSup = db.prepare(`INSERT INTO suppliers (name, address, contact_phone, contact_email, tax_code, services, invoice_type, service_fee_pct, order_group_link, deposit_pct, note)
    VALUES (@name,@address,@contact_phone,@contact_email,@tax_code,@services,@invoice_type,@service_fee_pct,@order_group_link,@deposit_pct,@note)`);
  const sup = (s) => insSup.run({ address: null, contact_phone: null, contact_email: null, tax_code: null, services: null, invoice_type: 'VAT', service_fee_pct: 0, order_group_link: null, deposit_pct: 0, note: null, ...s }).lastInsertRowid;
  const supEvent = sup({ name: 'Công ty Sự kiện ABC', address: 'Hà Nội', contact_phone: '0901 222 333', contact_email: 'sales@abc-event.vn', tax_code: '0101234567', services: 'Booth, POSM, thiết bị, nhân sự sự kiện', invoice_type: 'VAT', service_fee_pct: 10, deposit_pct: 50, order_group_link: 'https://zalo.me/g/abcevent' });
  sup({ name: 'In ấn Nhanh 24h', address: 'TP.HCM', contact_phone: '0908 444 555', services: 'In ấn POSM, standee, backdrop', invoice_type: 'VAT', service_fee_pct: 0, deposit_pct: 0 });
  const insQuote = db.prepare('INSERT INTO supplier_quotes (supplier_id, stt, item, unit, qty, unit_price) VALUES (?,?,?,?,?,?)');
  insQuote.run(supEvent, 1, 'Thi công gian hàng 3x3m', 'Gian', 1, 35000000);
  insQuote.run(supEvent, 2, 'Màn hình LED P3 (4x2m)', 'Bộ', 1, 18000000);
  insQuote.run(supEvent, 3, 'Nhân sự lễ tân', 'Người/ngày', 4, 1200000);

  // ---------- Sự kiện ----------
  const insEv = db.prepare(`INSERT INTO events (name, source_url, mode, organizer, organizer_org_id, field, format, start_time, end_time, location, scale_attendees, scale_compare, guest_levels, evaluation, image_links, video_links, keyvisual_link, status, created_by)
    VALUES (@name,@source_url,@mode,@organizer,@organizer_org_id,@field,@format,@start_time,@end_time,@location,@scale_attendees,@scale_compare,@guest_levels,@evaluation,@image_links,@video_links,@keyvisual_link,@status,1)`);
  const ev = (e) => insEv.run({ source_url: null, organizer: null, organizer_org_id: null, field: 'Công nghệ', format: 'Offline', start_time: null, end_time: null, location: null, scale_attendees: null, scale_compare: null, guest_levels: null, evaluation: null, image_links: null, video_links: null, keyvisual_link: null, status: 'Sắp diễn ra', ...e }).lastInsertRowid;
  const evCEO = ev({ name: 'Hội thảo CEOxAI: Doanh nghiệp tự vận hành 24/7', mode: 'host', organizer: 'Tập đoàn MISA', field: 'Công nghệ', format: 'Offline', start_time: '2026-06-05', location: 'Trung tâm Hội nghị Quốc tế, 11 Lê Hồng Phong, Hà Nội', scale_attendees: 500, scale_compare: 'Tăng ~25% so với 2025', guest_levels: 'C-Level, M-Level, DN vừa & lớn', image_links: JSON.stringify(['https://drive.google.com/drive/folders/anh-ceoxai']), video_links: JSON.stringify(['https://youtube.com/ceoxai-recap']), keyvisual_link: 'https://drive.google.com/keyvisual-ceoxai', status: 'Sắp diễn ra' });
  ev({ name: 'Diễn đàn Chuyển đổi số Quốc gia 2026', mode: 'join', organizer: 'Bộ Thông tin & Truyền thông', organizer_org_id: oBoTTTT, field: 'Công nghệ', format: 'Offline', start_time: '2026-09-18', location: 'Hà Nội', scale_attendees: 1000, guest_levels: 'Khối chính phủ, C-Level', status: 'Sắp diễn ra' });

  const insEC = db.prepare(`INSERT INTO event_costs (event_id, category, title, supplier_id, amount, sponsor_tier, sponsor_benefits, press_org, journalist_name, article_link)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  insEC.run(evCEO, 'organization', 'Thi công gian hàng + LED', supEvent, 53000000, null, null, null, null, null);
  insEC.run(evCEO, 'organization', 'In ấn POSM, backdrop', null, 12000000, null, null, null, null, null);
  insEC.run(evCEO, 'sponsor', 'Tài trợ đơn vị đồng hành HanoiBA', null, 30000000, 'Đồng hành', 'Logo trên backdrop + 1 bài chia sẻ', null, null, null);
  insEC.run(evCEO, 'media', 'Bài PR sự kiện CEOxAI', null, 25000000, null, null, 'Báo VnExpress', 'Hoàng Minh Anh', 'https://vnexpress.net/ceoxai');

  insAssign.run(2, 'event', evCEO); insAssign.run(2, 'event', evCEO);

  // ---------- Hội phí hiệp hội theo năm ----------
  const insFee = db.prepare('INSERT INTO association_fees (org_id, year, amount, due_date, paid_date, status) VALUES (?,?,?,?,?,?)');
  insFee.run(oVinasa, 2025, 50000000, '2025-04-15', '2025-04-10', 'Đã đóng');
  insFee.run(oVinasa, 2026, 20000000, '2026-03-01', null, 'Chưa đóng');
  insFee.run(oVcci, 2026, 30000000, '2026-02-28', null, 'Chưa đóng');
  insFee.run(oVcci, 2026, 30000000, '2026-06-20', null, 'Chưa đóng');  // đến kỳ đóng trong tháng (demo)

  // ---------- Bổ sung cho Trang tổng quan (số liệu tháng + biểu đồ) ----------
  // Lĩnh vực hoạt động hiệp hội (biểu đồ phân bổ theo lĩnh vực)
  db.prepare("UPDATE organizations SET field_area=? WHERE id=?").run('Công nghệ', oVinasa);
  db.prepare("UPDATE organizations SET field_area=? WHERE id=?").run('Thương mại', oVcci);
  // Sinh nhật lãnh đạo hiệp hội trong tháng (demo: tháng 6)
  db.prepare("UPDATE people SET dob=? WHERE org_id=? AND full_name=?").run('1968-06-15', oVinasa, 'Nguyễn Văn A');
  db.prepare("UPDATE people SET dob=? WHERE org_id=? AND full_name=?").run('1970-06-25', oVcci, 'Phạm Văn E');
  // Keynote lãnh đạo MISA tại sự kiện tự tổ chức
  db.prepare("UPDATE events SET misa_keynotes=? WHERE id=?").run(2, evCEO);
  // Thêm sự kiện trải đều các tháng (biểu đồ sự kiện tổ chức / tham gia theo tháng)
  ev({ name: 'Tài trợ Diễn đàn CNTT miền Trung', mode: 'join', field: 'Công nghệ', start_time: '2026-03-12', status: 'Đã kết thúc' });
  ev({ name: 'Hội nghị Kế toán toàn quốc 2026', mode: 'join', field: 'Tài chính - Thuế', start_time: '2026-05-22', status: 'Đã kết thúc' });
  const evWebinar = ev({ name: 'Webinar AMIS CRM', mode: 'host', field: 'Công nghệ', format: 'Online', start_time: '2026-04-18', status: 'Đã kết thúc' });
  db.prepare("UPDATE events SET misa_keynotes=? WHERE id=?").run(1, evWebinar);
  } // end if (DEMO)

  console.log(DEMO ? '✓ Đã seed 2 tài khoản + dữ liệu mẫu (demo).' : '✓ Đã seed sạch: 2 tài khoản (Quản lý phòng + Chuyên viên PR), chưa có dữ liệu nghiệp vụ.');
}

function audit(entry) {
  db.prepare(
    'INSERT INTO audit_log (user_id, username, action, entity, entity_id, detail) VALUES (?,?,?,?,?,?)'
  ).run(entry.user_id || null, entry.username || null, entry.action, entry.entity || null, entry.entity_id || null, entry.detail || null);
}

function dropAll() {
  db.exec(`DROP TABLE IF EXISTS campaigns; DROP TABLE IF EXISTS app_meta;
    DROP TABLE IF EXISTS sentiment_audit; DROP TABLE IF EXISTS scan_runs;
    DROP TABLE IF EXISTS monitor_alerts; DROP TABLE IF EXISTS competitors;
    DROP TABLE IF EXISTS mentions; DROP TABLE IF EXISTS sources; DROP TABLE IF EXISTS scan_queries;
    DROP TABLE IF EXISTS association_fees;
    DROP TABLE IF EXISTS event_costs; DROP TABLE IF EXISTS events;
    DROP TABLE IF EXISTS supplier_quotes; DROP TABLE IF EXISTS suppliers;
    DROP TABLE IF EXISTS assignments;
    DROP TABLE IF EXISTS award_participations; DROP TABLE IF EXISTS awards;
    DROP TABLE IF EXISTS reminder_log; DROP TABLE IF EXISTS budgets;
    DROP TABLE IF EXISTS bookings; DROP TABLE IF EXISTS audit_log;
    DROP TABLE IF EXISTS interactions; DROP TABLE IF EXISTS important_dates;
    DROP TABLE IF EXISTS sponsorships; DROP TABLE IF EXISTS attachments;
    DROP TABLE IF EXISTS people; DROP TABLE IF EXISTS organizations;
    DROP TABLE IF EXISTS users;`);
}

// CLI: node server/db.js --reseed [--demo] => xóa & seed lại
if (require.main === module && process.argv.includes('--reseed')) {
  dropAll(); init(); seed();
  console.log('✓ Reseed xong.');
  process.exit(0);
}

// Khi khởi động server: nếu đặt RESET_DB=1 (env) thì XÓA SẠCH + seed lại rồi tiếp tục chạy.
// Dùng để làm sạch dữ liệu trên môi trường live: đặt RESET_DB=1, redeploy, sau đó gỡ về 0.
//
// Bọc try/catch quanh dropAll()/init()/seed() (Codex re-audit round 3, R3-01): connection/worker
// MySQL đã được tạo xong ở dòng khởi tạo `db` phía trên TRƯỚC khi các hàm này chạy — nếu một
// trong số chúng throw (vd MYSQL_DATABASE trỏ tới schema chưa tồn tại), phải đóng worker NGAY tại
// đây trước khi rethrow, vì sau khi throw thì `require('./db')` không hoàn tất và không ai ở tầng
// gọi nhận được `closeDb()` để tự đóng — worker mồ côi đó giữ event loop sống vô hạn, khiến một
// `before()` hook trong `node:test` gọi require() này không bao giờ tự thoát process (phải
// SIGKILL). Không `await` vì đây là code đồng bộ ở module-scope, nhưng worker/timer mà close()
// tạo ra vẫn giữ process sống đủ lâu để tự thoát sạch (graceful hoặc force-terminate sau 3s)
// trước khi phần còn lại của chương trình kết thúc — không cần chờ đồng bộ tại đây.
try {
  if (process.env.RESET_DB === '1') {
    console.log('⚠ RESET_DB=1 → đang xóa sạch & seed lại dữ liệu…');
    dropAll();
  }
  init();
  seed();
} catch (error) {
  // Không giả định db.close() luôn trả Promise (Codex re-audit round 4 CLOSE, N4-01): SQLite
  // (node:sqlite DatabaseSync.close()) trả `undefined` — gọi `.catch()` trực tiếp lên đó ném
  // TypeError và CHE MẤT lỗi init/seed gốc (đúng lỗi cần chẩn đoán). MySQL's close() trả Promise
  // thật. Bọc qua Promise.resolve(...) để cả hai trường hợp đều an toàn, và try/catch quanh chính
  // lệnh gọi để phòng db.close() throw đồng bộ — cleanup ở đây luôn là best-effort, không được để
  // lỗi cleanup thay thế lỗi gốc.
  if (typeof db.close === 'function') {
    try {
      Promise.resolve(db.close()).catch(() => {});
    } catch { /* best-effort, không che lỗi init/seed gốc */ }
  }
  throw error;
}

// Đóng connection/worker (MySQL) hoặc file handle (SQLite) — cần cho test harness teardown
// (Codex G1A1-audit A1); production không cần gọi, process tự thoát khi container bị kill.
function closeDb() {
  return typeof db.close === 'function' ? db.close() : undefined;
}

module.exports = { db, audit, UPLOAD_DIR, metaGet, metaSet, closeDb, isIgnorableMigrationError, migrate };
