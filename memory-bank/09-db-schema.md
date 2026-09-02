# 09 — Lược đồ cơ sở dữ liệu

> Nguồn: `server/db.js` (schema SQLite gốc, hàm `init()` `db.js:22-534`, migration idempotent `migrate()` `db.js:572-655`) + `server/mysql-sync.js` (dịch DDL sang MySQL khi `DB_CLIENT=mysql`, mặc định — xem [`README.md`](README.md) và [`13-deployment-runbook.md`](13-deployment-runbook.md)).
>
> **Một schema nguồn duy nhất**: toàn bộ `CREATE TABLE`/`CREATE INDEX`/`ALTER TABLE` viết bằng cú pháp SQLite trong `db.js`; khi `DB_CLIENT=mysql`, hàm `translate()` (`mysql-sync.js:15-50`) dịch câu lệnh sang MySQL ngay trước khi chạy — không có file `.sql` MySQL riêng. Vì vậy đọc cột "Ghi chú dịch MySQL" dưới đây để biết type khi chạy trên MySQL. **Sửa lại (Codex round-3 re-audit, R3-02E):** "MySQL 8.4" chỉ xác nhận được cho **local Docker** (`docker-compose.yml:3`, `image: mysql:8.4`) — phiên bản engine thật của Cloud SQL production là **UNVERIFIED trong phạm vi repo** (không có artifact nào xác nhận), không suy ra bằng local Docker.

## A. Quy tắc dịch SQLite → MySQL (áp dụng cho MỌI bảng, đọc 1 lần)

Theo `mysql-sync.js:30-45`, khi gặp `CREATE TABLE`:
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `BIGINT AUTO_INCREMENT PRIMARY KEY`.
- `INTEGER` (còn lại) → `BIGINT`.
- `TEXT NOT NULL DEFAULT (datetime('now'))` → `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`.
- `` `key` TEXT PRIMARY KEY `` (chỉ `app_meta.key`) → `` `key` VARCHAR(191) PRIMARY KEY``.
- `TEXT UNIQUE` → `VARCHAR(768) UNIQUE` (đủ cho URL dài, vd `mentions.link`).
- `TEXT` đứng cạnh cột trong `UNIQUE(...)` (vd `assignments`) → `VARCHAR(191)`.
- `TEXT` có `DEFAULT '...'` (chuỗi) → `VARCHAR(191)` + giữ default.
- `TEXT` không rơi vào các trường hợp trên (đa số cột dữ liệu tự do dài) → **giữ nguyên `TEXT`** (MySQL cũng có kiểu `TEXT`).
- `CREATE INDEX` bị bỏ qua hoàn toàn trên nhánh MySQL (`translate()` trả `''` — dòng 29) — nghĩa là **các index khai báo trong `init()` chỉ tồn tại thật trên SQLite**; MySQL production **không có các index này** trừ khi tạo tay. Ghi rõ ở mục C.
- `ALTER TABLE ... ADD COLUMN` cũng dịch `INTEGER` → `BIGINT` (`mysql-sync.js:46-48`), TEXT giữ nguyên `TEXT`.
- Modifier ngày `datetime('now','-30 day')` / `date('now','-N day')` được dịch sang `INTERVAL` MySQL (`mysql-sync.js:18-19`); `strftime('%Y-%m', x)` → `DATE_FORMAT(x,'%Y-%m')` (dòng 22-24) — dùng nhiều trong `routes.js` (dashboard, report).
- `INSERT OR IGNORE` → `INSERT IGNORE`; ba mẫu `ON CONFLICT(...) DO UPDATE` đã có hợp đồng dịch riêng: `app_meta.key`, `budgets.period`, và `web_sessions.sid` → `ON DUPLICATE KEY UPDATE ...=VALUES(...)`. Thêm `upsert` mới theo cú pháp khác phải bổ sung contract dịch + test MySQL, nếu không sẽ lỗi trên MySQL.
- Prepared statement dùng object binding kiểu SQLite (`run({ name: value })` với placeholder `@name`) được adapter chuẩn hóa qua `bindSqliteNamedParams()` (`mysql-sync.js`) thành placeholder positional `?` trước khi gửi sang mysql2. Không truyền object named binding trực tiếp xuống worker: MySQL sẽ hiểu `@name` là session user variable và có thể ghi `NULL` mà không báo lỗi (F20).

## B. Danh sách bảng đầy đủ (37 bảng — 34 Gate-0 + `field_visibility`, `voice_proposals`, `web_sessions` thêm sau, xem §E)

Ký hiệu: **PK** khoá chính, **FK** khoá ngoại (kèm `ON DELETE`), **U** unique, cột không ghi rõ NOT NULL/DEFAULT nghĩa là cho phép NULL.

### users (`db.js:24-35`)
| Cột | Kiểu SQLite | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| username | TEXT NOT NULL, **U** | |
| password_hash | TEXT NOT NULL | bcrypt |
| full_name | TEXT NOT NULL | |
| role | TEXT NOT NULL | `super_admin` \| `pr_staff` (rbac.js:12-15) |
| email | TEXT | dùng nhận email nhắc (thêm qua migrate `db.js:575`) |
| notify_opt_in | INTEGER NOT NULL DEFAULT 1 | thêm qua migrate `db.js:576` |
| sensitive_perms | TEXT | JSON mảng nhóm mật được xem; NULL = mặc định theo role (thêm qua migrate `db.js:574`) |
| active | INTEGER NOT NULL DEFAULT 1 | soft-disable, không xoá |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

### organizations (`db.js:38-53`, mở rộng migrate `db.js:592-609,641-643`)
Cơ quan/đối tác (báo chí/hiệp hội/bộ ngành/khác).
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| name | TEXT NOT NULL | |
| org_type | TEXT NOT NULL | `press`\|`association`\|`gov`\|`other` |
| tier, founded_date, parent_org, website, address | TEXT | |
| press_types | TEXT | JSON array |
| misa_role, join_date | TEXT | (hiệp hội) |
| membership_fee | INTEGER | **org_fee** — hội phí, `03-data-classification.md` §A |
| note | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |
| admin_level, agency_block, contact_clerk, org_departments, org_leaders, focal_partner_dev, focal_pr | TEXT | gov (bộ ngành), migrate `db.js:592-598` |
| abbreviation, hotline, tax_code, field_area | TEXT | hiệp hội, migrate `db.js:600-603` |
| political_rank, charter, contract_term, contract_benefits, contract_staff | TEXT | báo chí, migrate `db.js:605-609` |
| misa_current_role, misa_events, misa_awards | TEXT | vị thế MISA tại tổ chức, migrate `db.js:641-643` |

Index: `idx_org_type(org_type)` (`db.js:190`, chỉ SQLite — xem mục C).

### people (`db.js:56-83`, mở rộng migrate `db.js:577,611-628`)
Nhân sự thuộc cơ quan — entity chứa nhiều nhất trường mật.
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| org_id | INTEGER FK→organizations(id) ON DELETE CASCADE | |
| full_name | TEXT NOT NULL | |
| level, position, beat, category, status | TEXT | status default `'Đang hợp tác'` |
| relationship_score | INTEGER DEFAULT 0 | |
| email_work, phone_work | TEXT | không mật |
| phone_personal, phone_other | TEXT | **nhóm mật `contact`** (phone_other thêm migrate `db.js:577`) |
| phone_ott | TEXT | JSON `{zalo,whatsapp,viber,telegram}` — **nhóm `contact`** |
| dob, home_address, personal_notes | TEXT | **nhóm `private`** |
| social_facebook/instagram/tiktok/x/thread | TEXT | **nhóm `social`** |
| bank_account_number, bank_name | TEXT | **nhóm `finance`** |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |
| gender, marital_status | TEXT | migrate `db.js:611-612` |
| personality, hobbies, food_habits, family_info, media_stance, relationship_network, meeting_places, gift_rules | TEXT | **nhóm `private`** mở rộng, migrate `db.js:613-620` |
| assoc_position, external_position, assoc_role, current_workplace, assoc_join_year (INTEGER), assoc_current_role, assoc_events, assoc_awards | TEXT/INTEGER | hồ sơ VIP hiệp hội, migrate `db.js:621-628` |

Index: `idx_p_org(org_id)` (`db.js:191`, chỉ SQLite).
Nhóm mật tra `rbac.js:66-73` (`SENSITIVE_GROUPS`); giấy tờ tuỳ thân (`iddoc`) không phải cột mà là `attachments.kind='id_doc'`.

### attachments (`db.js:86-97`)
Bảng đa owner (person/agreement/work_log/award/supplier/event). **F9 fixed:** `classification_tier` được server-derived + migration backfill; client không có input tier.
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| owner_type | TEXT NOT NULL DEFAULT `'person'` | `person`\|`agreement`\|`work_log`\|`award`\|`supplier`\|`event` (giá trị suy từ route ghi, không có CHECK constraint DB) |
| owner_id | INTEGER NOT NULL | không có FK thật (đa bảng đích, SQLite không hỗ trợ FK polymorphic) |
| kind | TEXT NOT NULL | `portrait`\|`id_doc`\|`file`\|`award_doc`\|`quote`\|event allowlist; kind lạ bị từ chối trước Multer |
| filename | TEXT NOT NULL | tên lưu đĩa (random, `uploads.js:10-13`) |
| original_name, mime | TEXT | |
| classification_tier | TEXT NOT NULL DEFAULT `Confidential` | server-derived: portrait=`Public`, id_doc=`Restricted`, còn lại=`Confidential`; migration backfill idempotent |
| audience_visibility | TEXT NOT NULL DEFAULT `private` | trần do attachment policy quyết định, không được public hoá file Confidential/Restricted |
| is_primary | INTEGER NOT NULL DEFAULT 0 | chỉ có ý nghĩa với `kind='portrait'` |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

Index: `idx_att_owner(owner_type, owner_id)` (`db.js:192`, chỉ SQLite).

### sponsorships (`db.js:98-106`, mở rộng migrate `db.js:639,644-654`)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| org_id | INTEGER FK→organizations(id) ON DELETE CASCADE | |
| title | TEXT NOT NULL | |
| type | TEXT | `Tài trợ`\|`Giải thưởng`\|`Hoạt động` |
| amount | INTEGER | **org_fee** |
| event_date, note | TEXT | |
| sponsor_benefits | TEXT | migrate `db.js:639` |
| product, category, submit_deadline, present_deadline, scale, sponsor_package, result, contact_point, staff, status | TEXT | migrate `db.js:644-654` |

### important_dates (`db.js:109-123`)
Ngày quan trọng để nhắc (sinh nhật/thành lập/kỷ niệm/tuỳ ý).
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| title | TEXT NOT NULL | |
| date_type | TEXT | `birthday`\|`founding`\|`anniversary`\|`other` |
| subject_type | TEXT | `person`\|`organization`\|`general` |
| subject_id | INTEGER | không FK (đa bảng) |
| subject_name | TEXT | |
| event_date | TEXT NOT NULL | `YYYY-MM-DD` |
| recurring | INTEGER NOT NULL DEFAULT 1 | lặp hằng năm |
| lead_days | INTEGER NOT NULL DEFAULT 7 | số ngày báo trước |
| notify_repeat_every | INTEGER NOT NULL DEFAULT 0 | 0 = không lặp thêm |
| notify_repeat_count | INTEGER NOT NULL DEFAULT 1 | tổng số lần nhắc |
| note | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

### bookings (`db.js:126-143`, mở rộng migrate `db.js:578-579`)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| subject_type | TEXT NOT NULL | `org`\|`person` |
| subject_id | INTEGER NOT NULL | không FK |
| subject_name, org_name | TEXT | denormalized để báo cáo nhanh |
| org_id | INTEGER | không FK (đơn vị báo chí gom báo cáo) |
| content_type | TEXT | |
| title | TEXT NOT NULL | |
| amount | INTEGER | **org_fee** |
| article_link, booked_date, publish_date | TEXT | |
| status | TEXT DEFAULT `'Đã đặt'` | |
| note | TEXT | |
| created_by | INTEGER FK→users(id) | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |
| award_id, event_id | INTEGER | migrate `db.js:578-579`, không FK — liên kết chi phí truyền thông với 1 giải thưởng/sự kiện |

Index: `idx_book_subj(subject_type, subject_id)`, `idx_book_org(org_id)` (`db.js:194-195`, chỉ SQLite).

### budgets (`db.js:146-151`)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| period | TEXT **U** NOT NULL | `'YYYY-MM'` — upsert theo cột này (`routes.js:638-639`) |
| amount | INTEGER NOT NULL | |
| note | TEXT | |

### reminder_log (`db.js:154-163`)
Chống gửi trùng nhắc + đếm số lần lặp.
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| date_id | INTEGER FK→important_dates(id) ON DELETE CASCADE | |
| occur_date | TEXT NOT NULL | lần xuất hiện `YYYY-MM-DD` |
| seq | INTEGER NOT NULL | mốc nhắc thứ mấy |
| channel | TEXT NOT NULL | `inapp`\|`email` |
| recipient_user_id | INTEGER | không FK |
| read_at | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

Index: `idx_remlog(date_id, occur_date, seq)` (`db.js:240`, chỉ SQLite).

### interactions (`db.js:165-177`, mở rộng migrate `db.js:634-638`)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| partner_type | TEXT NOT NULL | `org`\|`person` |
| partner_id | INTEGER NOT NULL | không FK |
| partner_name | TEXT | |
| date | TEXT NOT NULL | |
| channel, summary, result, staff | TEXT | |
| created_by | INTEGER FK→users(id) | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |
| next_task, next_status, next_due, next_staff, work_mode | TEXT | migrate `db.js:634-638` (VIP profile: việc tiếp theo) |

Index: `idx_int_partner(partner_type, partner_id)` (`db.js:193`, chỉ SQLite).

### audit_log (`db.js:179-188`)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| user_id | INTEGER | không FK |
| username, action, entity | TEXT | `action` NOT NULL (vd `LOGIN`, `CREATE`, `EDIT`, `DELETE`, `VIEW_SENSITIVE`, `SCAN`) |
| entity_id | INTEGER | |
| detail | TEXT | |
| ts | TEXT NOT NULL DEFAULT datetime('now') | |

Không có index — `GET /api/admin/audit` luôn `ORDER BY id DESC LIMIT 200` full-scan trên bảng lớn dần (ghi ở [`01-audit-findings.md`](01-audit-findings.md) R103).

### awards (`db.js:197-220`)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| name | TEXT NOT NULL | |
| organizer | TEXT | tên tự do |
| org_id | INTEGER FK→organizations(id) ON DELETE SET NULL | link cơ quan nếu có |
| organizer_type | TEXT | `gov`\|`association`\|`other` |
| scale, event_time | TEXT | |
| submission_deadline | TEXT | `YYYY-MM-DD` |
| eligibility | TEXT | |
| cost | INTEGER | **org_fee** — chi phí tham gia |
| criteria, required_docs, prize_structure, evaluation_method, scope | TEXT | scope: `Trong nước`\|`Quốc tế` |
| status | TEXT DEFAULT `'Sắp mở'` | |
| source_url, ai_summary | TEXT | |
| review_status | TEXT DEFAULT `'Thô'` | `Thô`\|`Đã duyệt`\|`Chuẩn hóa` |
| note | TEXT | |
| created_by | INTEGER FK→users(id) | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

Index: `idx_award_status(status)` (`db.js:241`, chỉ SQLite).

### award_participations (`db.js:223-238`)
Hồ sơ MISA đề xuất tham gia 1 giải, tách theo năm.
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| award_id | INTEGER FK→awards(id) ON DELETE CASCADE | |
| year | INTEGER | |
| status | TEXT DEFAULT `'Đang cân nhắc'` | |
| products, categories, goal, purpose, capability, plan | TEXT | |
| budget | INTEGER | **org_fee** — dự toán chi phí |
| result, note | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

Index: `idx_part_award(award_id)` (`db.js:242`, chỉ SQLite).

### assignments (`db.js:245-252`)
Phân công "nhân sự chăm sóc": user ↔ (org/person/award/event).
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| user_id | INTEGER NOT NULL FK→users(id) ON DELETE CASCADE | |
| subject_type | TEXT NOT NULL | `org`\|`person`\|`award`\|`event` |
| subject_id | INTEGER NOT NULL | không FK |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |
| — | **U**(user_id, subject_type, subject_id) | idempotent gán (dùng `INSERT OR IGNORE`) |

Index: `idx_assign_subject`, `idx_assign_user` (`db.js:253-254`, chỉ SQLite).

### suppliers (`db.js:257-271`, mở rộng migrate `db.js:632`)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| name | TEXT NOT NULL | |
| address, contact_phone, contact_email, tax_code, services | TEXT | |
| invoice_type | TEXT | `VAT`\|`Trực tiếp 0%` |
| service_fee_pct | INTEGER | % phí phục vụ 0-100 (chưa xếp `org_fee`, xem `03-data-classification.md` §B) |
| order_group_link | TEXT | |
| deposit_pct | INTEGER | % đặt cọc |
| note | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |
| industry | TEXT | migrate `db.js:632` |

### supplier_quotes (`db.js:272-276`)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| supplier_id | INTEGER FK→suppliers(id) ON DELETE CASCADE | |
| stt | INTEGER | số thứ tự |
| item, unit | TEXT | |
| qty | REAL | |
| unit_price | INTEGER | **org_fee** |

### events (`db.js:279-302`, mở rộng migrate `db.js:581`)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| name | TEXT NOT NULL | |
| source_url | TEXT | |
| mode | TEXT NOT NULL DEFAULT `'join'` | `join`\|`host` |
| organizer | TEXT | tên tự do |
| organizer_org_id | INTEGER FK→organizations(id) ON DELETE SET NULL | |
| field, format | TEXT | |
| start_time, end_time, location | TEXT | |
| scale_attendees | INTEGER | |
| scale_compare, guest_levels, evaluation | TEXT | |
| image_links, video_links | TEXT | JSON array |
| keyvisual_link | TEXT | |
| status | TEXT DEFAULT `'Sắp diễn ra'` | |
| note | TEXT | |
| created_by | INTEGER FK→users(id) | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |
| misa_keynotes | INTEGER | migrate `db.js:581` — số bài keynote lãnh đạo MISA |

### event_costs (`db.js:305-319`)
1 bảng cho 3 nhóm chi phí sự kiện.
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| event_id | INTEGER FK→events(id) ON DELETE CASCADE | |
| category | TEXT NOT NULL | `sponsor`\|`organization`\|`media` |
| title | TEXT | |
| supplier_id | INTEGER FK→suppliers(id) ON DELETE SET NULL | |
| amount | INTEGER | **org_fee** |
| sponsor_tier, sponsor_benefits | TEXT | (category=sponsor) |
| press_org, journalist_name, article_link | TEXT | (category=media) |
| note | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

Index: `idx_evcost_event(event_id)` (`db.js:320`, chỉ SQLite).

### association_fees (`db.js:323-333`, mở rộng migrate `db.js:630`)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| org_id | INTEGER FK→organizations(id) ON DELETE CASCADE | |
| year | INTEGER | |
| amount | INTEGER | **org_fee** |
| due_date, paid_date | TEXT | |
| status | TEXT DEFAULT `'Chưa đóng'` | |
| note | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |
| staff | TEXT | migrate `db.js:630` |

Index: `idx_fee_org(org_id)` (`db.js:334`, chỉ SQLite).

### agreements (`db.js:337-346`)
Đối tác bộ ngành: hồ sơ hợp tác/MOU.
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| org_id | INTEGER FK→organizations(id) ON DELETE CASCADE | |
| title | TEXT NOT NULL | |
| signed_date, valid_until, terms, note | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

Index: `idx_agree_org(org_id)` (`db.js:360`, chỉ SQLite). Tệp đính kèm qua `attachments` với `owner_type='agreement'`.

### work_logs (`db.js:348-359`)
Đối tác bộ ngành: lịch sử làm việc.
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| org_id | INTEGER FK→organizations(id) ON DELETE CASCADE | |
| category | TEXT | `Tiếp đón đoàn`\|`Làm việc tại cơ quan`\|`Công văn phối hợp`\|`Đối ngoại` |
| work_date, topic, result | TEXT | |
| status | TEXT | `Đang xử lý`\|`Hoàn thành`\|`Theo dõi` |
| staff, note | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

Index: `idx_wl_org(org_id)` (`db.js:361`, chỉ SQLite). Tệp qua `attachments` với `owner_type='work_log'`.

### gifts (`db.js:364-375`)
Quà tặng đối ngoại (gắn person hoặc org).
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| owner_type | TEXT NOT NULL | `person`\|`org` |
| owner_id | INTEGER NOT NULL | không FK |
| gift_type | TEXT | `Hoa`\|`Quà`\|`Tiền mặt` |
| value | INTEGER | **org_fee** |
| giver, event_date, occasion, note | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

Index: `idx_gift_owner(owner_type, owner_id)` (`db.js:385`, chỉ SQLite).

### benefit_usages (`db.js:377-384`)
Lịch sử dùng quyền lợi hợp đồng đổi hàng (báo chí).
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| org_id | INTEGER FK→organizations(id) ON DELETE CASCADE | |
| title | TEXT NOT NULL | |
| used_date, note | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

Index: `idx_benefit_org(org_id)` (`db.js:386`, chỉ SQLite).

### supplier_transactions (`db.js:389-402`)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| supplier_id | INTEGER FK→suppliers(id) ON DELETE CASCADE | |
| service_type, purpose, contract_no | TEXT | |
| value | INTEGER | **org_fee** |
| signed_date, exec_deadline, status, staff, note | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

Index: `idx_strans_sup(supplier_id)` (`db.js:403`, chỉ SQLite).

### supplier_contacts (`db.js:404-414`)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| supplier_id | INTEGER FK→suppliers(id) ON DELETE CASCADE | |
| full_name, position, phone, email, role, note | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

Index: `idx_scontact_sup(supplier_id)` (`db.js:415`, chỉ SQLite).

### scan_queries (`db.js:419-430`, mở rộng migrate `db.js:583`)
Bộ từ khoá quét giám sát truyền thông (boolean include/exclude).
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| name | TEXT NOT NULL | |
| category | TEXT NOT NULL DEFAULT `'brand'` | `brand`\|`industry`\|`competitor` |
| query_type | TEXT NOT NULL DEFAULT `'news'` | `news`\|`social` (social chưa dùng) |
| include | TEXT | JSON `[["MISA","Hóa đơn điện tử"],["MISA"]]` — OR của các nhóm AND |
| exclude | TEXT | JSON mảng loại trừ |
| competitor_id | INTEGER | không FK, dùng khi category=competitor |
| enabled | INTEGER NOT NULL DEFAULT 1 | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |
| grounding | INTEGER NOT NULL DEFAULT 0 | migrate `db.js:583` — bật quét mở rộng Gemini Google Search |

### sources (`db.js:432-440`, mở rộng migrate `db.js:584,590`)
Nguồn tin (RSS báo chí, sau này social).
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| name | TEXT NOT NULL | |
| type | TEXT NOT NULL DEFAULT `'news'` | |
| url | TEXT | link RSS/feed |
| enabled | INTEGER NOT NULL DEFAULT 1 | |
| auto | INTEGER NOT NULL DEFAULT 1 | migrate `db.js:584` — 1=seed hệ thống (bị reconcile khi đổi `NEWS_SOURCES_VER`), 0=user tự thêm (giữ nguyên) |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |
| mode | TEXT NOT NULL DEFAULT `'rss'` | migrate `db.js:590` — `rss`\|`site` (site = không có RSS, quét bằng Google Search `site:domain`) |

### mentions (`db.js:442-463`, mở rộng migrate `db.js:589`)
Tin/bài quét được (bảng trung tâm module giám sát).
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| query_id | INTEGER FK→scan_queries(id) ON DELETE SET NULL | |
| source_id | INTEGER FK→sources(id) ON DELETE SET NULL | |
| source_type, source_name, category | TEXT | |
| title | TEXT | |
| link | TEXT **U** | dedup theo link |
| content, ai_summary | TEXT | |
| tags | TEXT | JSON mảng |
| sentiment | TEXT | `positive`\|`neutral`\|`negative`\|NULL |
| sentiment_score | REAL | -1..1 |
| sentiment_by | TEXT | `ai`\|`human` |
| published_at | TEXT | `YYYY-MM-DD` |
| status | TEXT NOT NULL DEFAULT `'Mới'` | `Mới`\|`Đang xử lý`\|`Đã duyệt`\|`Bỏ qua` |
| next_action, assignee, note | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |
| matched_group | TEXT | migrate `db.js:589` — nhóm từ khoá AND đầu tiên khớp, dùng đo hiệu quả từ khoá |

Index: `idx_mention_pub`, `idx_mention_cat`, `idx_mention_sent` (`db.js:464-466`, chỉ SQLite — trên MySQL production bảng này **không có index ngoài PK/UNIQUE(link)**, dù được lọc/sort theo `published_at`, `category`, `sentiment` trong hầu hết truy vấn monitor).

### competitors (`db.js:468-476`)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| name | TEXT NOT NULL | |
| website, fanpage | TEXT | |
| channels | TEXT | JSON mảng |
| note | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

### monitor_alerts (`db.js:478-486`)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| level | TEXT NOT NULL DEFAULT `'warning'` | `info`\|`warning`\|`critical` |
| title | TEXT NOT NULL | |
| detail | TEXT | |
| occur_date | TEXT | `YYYY-MM-DD`, gom 1 cảnh báo/ngày |
| read_at | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

### scan_runs (`db.js:488-502`)
Nhật ký mỗi lượt quét.
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| started_at | TEXT NOT NULL DEFAULT datetime('now') | |
| finished_at | TEXT | |
| queries, fetched, new_mentions, analyzed | INTEGER DEFAULT 0 | |
| pos, neu, neg | INTEGER DEFAULT 0 | breakdown sắc thái tin MỚI của lượt |
| status | TEXT DEFAULT `'running'` | `running`\|`done`\|`error` |
| error | TEXT | |
| triggered_by | TEXT | username hoặc `system`/`auto` |

### sentiment_audit (`db.js:504-512`)
Audit khi người sửa nhãn sắc thái AI.
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| mention_id | INTEGER FK→mentions(id) ON DELETE CASCADE | |
| old_sentiment, new_sentiment | TEXT | |
| user_id | INTEGER | không FK |
| username | TEXT | |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

### app_meta (`db.js:514-517`)
Key/value cấu hình (autoscan, scan_days, version seed nguồn…).
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `key` | TEXT PK | dịch MySQL → `VARCHAR(191) PRIMARY KEY` |
| value | TEXT | |

### campaigns (`db.js:519-533`)
Chiến dịch truyền thông.
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| name | TEXT NOT NULL | |
| start_date, end_date | TEXT | |
| message, content, audience | TEXT | gửi cho Gemini khi evaluate (xem `06-threat-model.md` §D AI-E012) |
| keywords | TEXT | JSON mảng |
| competitors | TEXT | JSON `[{name, keywords:[...]}]` |
| status | TEXT DEFAULT `'Đang chạy'` | |
| note | TEXT | |
| created_by | INTEGER | không FK |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |

### voice_proposals (`db.js`, thêm W3.VOICE.SECURE-COMMAND 2026-08-31)
Proposal opaque cho luồng AI voice "chuẩn bị hành động, người dùng xác nhận 1 lần" (D14.4). Không có UI (route backend/API-only, lane Codex chưa dựng UI).
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | TEXT PK | token đối ngẫu (crypto random hex), không phải AUTOINCREMENT — id chính là "opaque identifier" theo D14.4 |
| user_id | INTEGER NOT NULL, FK users(id) | gắn đúng 1 principal — confirm bởi user khác bị từ chối |
| status | TEXT NOT NULL DEFAULT `'pending'` | `pending`\|`confirmed`\|`expired` (expired kiểm tra lazy qua `expires_at`, không có job dọn riêng) |
| payload_json | TEXT NOT NULL | JSON: interaction đề xuất + candidate đã khớp (entity-match, có thể nhiều — mỗi candidate kèm `relationship_score` snapshot lúc chuẩn bị, dùng optimistic concurrency lúc xác nhận) + `suggested_score_delta` đã kẹp biên |
| idempotency_key | TEXT | key client gửi kèm lúc xác nhận, chống double-submit |
| result_interaction_id | INTEGER | gán sau khi xác nhận thành công |
| created_at | TEXT NOT NULL DEFAULT datetime('now') | |
| expires_at | TEXT NOT NULL | hạn dùng ngắn (mặc định 10 phút, `VOICE_PROPOSAL_TTL_MS`) |
| confirmed_at | TEXT | |

Index: `idx_voiceprop_user_status(user_id,status)`.

### web_sessions (`db.js`, F2 durable-session 2026-09-02)

Session store dùng chung giữa các app instance. Cookie chỉ mang session id có chữ ký; principal/payload nằm trong DB, vì vậy restart/scale-out không làm mất session.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| sid | TEXT PK | id opaque do `express-session` tạo; không chứa principal |
| data | TEXT NOT NULL | JSON session server-side |
| expires_at | TEXT NOT NULL | `SqlSessionStore` kiểm tra/lazy-delete trước khi restore |

## C. Index chỉ tồn tại trên SQLite — KHÔNG có trên MySQL production

`translate()` bỏ toàn bộ `CREATE INDEX` khi `DB_CLIENT=mysql` (`mysql-sync.js:29`). **23 index** khai báo trong `init()` (22 Gate-0 + `idx_voiceprop_user_status` thêm W3.VOICE.SECURE-COMMAND 2026-08-31; xác nhận bằng parser trực tiếp trên `server/db.js`: `grep -c "CREATE INDEX IF NOT EXISTS" server/db.js`) **không tồn tại trên MySQL/Cloud SQL**. Ngoại lệ: cột `UNIQUE`/PK (`budgets.period`, `mentions.link`, `assignments(user_id,subject_type,subject_id)`, `voice_proposals.id`, `web_sessions.sid`) vẫn có index ngầm vì MySQL tự tạo index cho `UNIQUE`/`PRIMARY KEY`. Đây là bẫy hiệu năng — xem [`14-known-traps.md`](14-known-traps.md).

## D. Idempotent migration — cơ chế và rủi ro

`migrate()` (`db.js:572-655`) chạy mỗi lần khởi động server, gọi `ALTER TABLE ... ADD COLUMN` bọc trong `try/catch` nuốt lỗi (hàm `add()`, `db.js:573`) — cách này cho phép chạy lại vô hạn lần trên schema đã có cột (lỗi bị nuốt) mà không cần bảng version. **Rủi ro:** lỗi ALTER TABLE vì nguyên nhân khác (vd hết quyền, cột trùng kiểu không tương thích) cũng bị nuốt im lặng — không có log cảnh báo, ứng dụng cứ chạy tiếp dù migration đó thất bại. Không có cơ chế rollback hay kiểm tra "migration đã áp dụng đủ chưa" ngoài việc tự chạy lại `ALTER TABLE` mỗi lần boot.

`seedMonitoringDefaults()` (`db.js:545-569`) có version riêng cho seed nguồn RSS (`NEWS_SOURCES_VER`, hiện `'3'`, `db.js:544`) — khi tăng version, xoá toàn bộ `sources` có `auto=1` rồi seed lại theo `server/news_sources.js`, giữ nguyên nguồn `auto=0` (user tự thêm).

## E. `dropAll()` và biến môi trường phá dữ liệu (đọc trước khi test)

**Sửa lại toàn bộ (Codex round-3 re-audit, R3-02B — bản trước sai và tự mâu thuẫn: nói "22 bảng" rồi liệt kê chính các bảng giám sát bị DROP như bằng chứng "không đụng tới", và nói sai `attachments`/`supplier_quotes` không bị DROP dù thực tế có):**

`dropAll()` chứa đúng **29 lệnh `DROP TABLE`** trên tổng **37 bảng**. `web_sessions` được drop có chủ ý vì dữ liệu session là ephemeral; vẫn còn **8 bảng không DROP**: `agreements`, `work_logs`, `gifts`, `benefit_usages`, `supplier_transactions`, `supplier_contacts`, `field_visibility`, `voice_proposals`. `dropAll()` không phải reset production/migration mechanism.

**Rủi ro vận hành cụ thể:** nếu dùng `dropAll()`/`RESET_DB=1`/`npm run seed` làm cơ chế "xoá sạch + seed lại" cho W1 (RBAC v2 redesign, xem `04-ROADMAP.md` W1.RBAC.1), 6 bảng trên sẽ **giữ lại dữ liệu cũ** trong khi 28 bảng kia đã sạch — dữ liệu con mồ côi, khả năng vỡ FK khi seed lại theo thứ tự mới trên MySQL, hoặc lẫn dữ liệu cũ/mới không nhất quán. **Không dùng `dropAll()` hiện tại làm cơ chế reset sạch cho W1** — cần chuyển hẳn sang tạo database/schema mới rồi áp migration từ đầu (xem `04-ROADMAP.md` §C0.5 reset strategy).

Được gọi khi:
- CLI `node server/db.js --reseed [--demo]` (`db.js:887-891`).
- **Biến môi trường `RESET_DB=1` khi khởi động server** (`db.js:895-898`) — xoá 28/34 bảng nếu đặt nhầm trên môi trường có dữ liệu cần giữ (hiện tại Cloud Run/Cloud SQL là môi trường test, dữ liệu bỏ được — xem `13-deployment-runbook.md` §B; nguyên tắc này vẫn phải giữ khi DevOps đưa production thật vào). Xem quy trình an toàn ở [`13-deployment-runbook.md`](13-deployment-runbook.md) và bẫy ở [`14-known-traps.md`](14-known-traps.md).
