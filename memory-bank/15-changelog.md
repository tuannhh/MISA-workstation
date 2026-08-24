# 15 — Lịch sử phát triển (changelog)

> Dựng lại từ `git log --oneline --all --reverse` (commit đầu → mới nhất). Tóm tắt "vì sao" dựa trên message commit đã có sẵn — không bịa lý do mới. Mốc kiến trúc/tính năng lớn; không liệt kê từng commit nhỏ không đáng chú ý.

## 2026-06-19 — Khởi tạo & vòng nghiệp vụ CRM lõi
- `d7064c7` **Khởi tạo** Hệ thống Quản trị & Giám sát Truyền thông – PR MISA.
- `5ddff85` **Tái cấu trúc CRM Cơ quan→Nhân sự + AI giọng nói/thiệp + branding** — chốt mô hình dữ liệu "cơ quan chứa nhân sự" (organizations/people) làm trục chính CRM đối ngoại, thêm 2 tính năng AI đầu tiên (voice-intake tương tác, sinh thiệp chúc mừng).
- `d4c64a6` **Đợt 3: Booking + Báo cáo + nhắc lịch (email/Calendar) + deploy-ready** — thêm module đặt bài (bookings), báo cáo tổng hợp, và luồng nhắc việc qua email/.ics; chuẩn bị deploy.
- `82238e7` Sửa UI Báo cáo: biểu đồ cột HTML hết méo/đè chữ, sidebar rộng + tagline 1 dòng — sửa lỗi hiển thị biểu đồ SVG tự vẽ.
- `175fb7e` UI/UX đợt 4: line chart hết méo, lọc kỳ tùy chọn, nút xóa, **quyền mật theo người** (tiền đề cho `sensitive_perms` sau này), SĐT khác, refresh tên.

## 2026-06-20 — Giải thưởng, phân công, báo cáo đa chiều
- `1730ec0` **Đợt 5: Module Quản lý Giải thưởng + AI bóc tách** — thêm `awards`/`award_participations`, AI đọc thông báo giải thưởng để tự điền form (tiền thân `POST /ai/award-extract`).
- `ec765c0` **Đợt 6: Phân công người chăm sóc + Trung tâm Báo cáo đa chiều** — thêm bảng `assignments` (user↔org/person/award), mở rộng báo cáo theo nhân sự/đơn vị.

## 2026-06-21–2026-06-23 — Sự kiện, nhà cung cấp, hội phí, VIP profile
- `edbfc78` **Đợt 7: Module Sự kiện + Danh bạ Nhà cung cấp + AI tự điền từ Excel** — thêm `events`/`event_costs`/`suppliers`/`supplier_quotes`, AI đọc file Excel kế hoạch sự kiện (tiền thân `POST /ai/event-extract`).
- `19e0d9f` **Hội phí hiệp hội theo năm: mức + hạn đóng khác nhau mỗi năm, nhắc, nối báo cáo** — vì hội phí hiệp hội thay đổi mức/hạn mỗi năm, tách bảng `association_fees` theo năm thay vì 1 cột cố định trên `organizations`.
- `282d91a` Thêm tài liệu Hướng dẫn sử dụng (PDF).
- `01771bf` **Nâng cấp Đợt 1: dashboard nghiệp vụ, hồ sơ tòa soạn/VIP mở rộng, quà tặng** — thêm `gifts`, mở rộng field VIP profile cho `people`.

## 2026-06-24 — Gọn vai trò, mở rộng dữ liệu mật, port module theo loại đối tác
- `c1ce0ac` **Đợt 8: gọn 2 vai trò, mở rộng dữ liệu mật (chi phí), ẩn audit, seed sạch + RESET_DB** — quyết định kiến trúc quan trọng: rút mô hình vai trò về đúng 2 role (`super_admin`/`pr_staff`) thay vì nhiều role rời rạc trước đó, mở rộng nhóm mật để bao gồm chi phí/ngân sách (`org_fee`), thêm cơ chế `RESET_DB` để làm sạch dữ liệu môi trường live, seed mặc định sạch (không demo).
- `cdcd1c4` Port: Module Đối tác bộ ngành (gov) lên nền feature — thêm field `admin_level`/`agency_block`/`contact_clerk`… cho `organizations` (org_type=gov).
- `78f64da` Port: trường Hiệp hội (viết tắt/phân loại/lĩnh vực/hotline/MST) lên nền feature.
- `88111fa` Port: Báo chí (đánh giá C1/C2/C3 + hợp tác đổi hàng) + Quà tặng đối ngoại — thêm `political_rank`, `benefit_usages`.
- `40149f3` Đợt sửa theo bảng PR (B+C): Hiệp hội + Báo chí.
- `fdb325a` Đợt sửa theo bảng PR (A): Nhà cung cấp — thêm `supplier_transactions`, `supplier_contacts`.
- `3b83f7f` Đợt sửa theo bảng PR (D): VIP Profile nhân sự + mạng lưới Hiệp hội (B2) — mở rộng field cá nhân (personality/hobbies/family_info/relationship_network…).
- `867882e` Trang tổng quan: số liệu theo nhóm + biểu đồ thống kê — dựng `GET /dashboard` với các subquery tổng hợp theo tháng/loại.

## 2026-06-30–2026-07-01 — Giám sát truyền thông (Social Listening), Phase 0+1
- `0bf89e4` **Giám sát truyền thông (Social Listening) — Phase 0+1: Báo chí** — module lớn mới: `scan_queries`/`sources`/`mentions`/`scan_runs`, quét RSS báo chí theo bộ từ khoá boolean.
- `1466a5d` Giám sát: bổ sung 167 nguồn RSS báo chí VN (đã kiểm chứng còn sống) — seed `news_sources.js`.
- `06167f4` **Giám sát: mở rộng quét bằng Gemini Google Search grounding + AI tổng hợp** — thêm `groundIngest()`, `aiMisaHighlights()`/`aiCompetitorAnalysis()` (Gemini với tool `google_search`).
- `89428f5` Giám sát: nguồn theo đầu báo, thiết lập quét, lịch sử sắc thái, AI hoạt động MISA/đối thủ, chiến dịch truyền thông — thêm `competitors`/`campaigns`/`sentiment_audit`, settings UI (`app_meta`).
- `0eda478` Giám sát: tối ưu bảng Tin bài, lọc theo ngày quét/đăng bài, hiệu quả từ khóa, chọn bộ từ khóa khi quét, xóa nhiều, nguồn website tự dò RSS — thêm `matched_group`, `sources.mode` (rss/site), `detectFeed()`.

## 2026-07-19 — Chuyển sang MySQL/Cloud SQL + UI theo MDS
- `271dd7e` **UI theo MDS + tìm kiếm đa trường + hạ tầng Docker/Cloud Run** — bắt đầu đưa MDS 2.0 vào (khung Vue shell), thêm `Dockerfile`/`docker-compose.yml` hướng tới Cloud Run.
- `ed078fd` **Fix MySQL: `splitStatements` xoá comment inline chứa `;`** — vì SQL comment `-- ... ;` trong `db.js` khiến tách câu lệnh sai khi dịch sang MySQL; đây là bước đầu trong chuỗi 5 commit sửa lỗi dịch DDL SQLite→MySQL cùng ngày, cho thấy việc chuyển engine mặc định từ SQLite sang MySQL không suôn sẻ ngay lần đầu.
- `ca979b3` Fix MySQL: dịch cột backtick (`` `key` `` TEXT PRIMARY KEY) → `VARCHAR(191)` — MySQL không cho `TEXT` làm PRIMARY KEY.
- `b4decf3` Fix MySQL runtime: derived-table alias, LIMIT/OFFSET (dùng `query()` thay `execute()`), `date('now','-N day')` modifier — vì MySQL prepared statement (`execute()`) không nhận tham số LIMIT/OFFSET như SQLite.
- `f741752` Fix MySQL: tắt `ONLY_FULL_GROUP_BY` + `await createConnection` — vì code viết theo ngữ nghĩa GROUP BY tự do của SQLite, MySQL strict mode mặc định sẽ từ chối.
- `8e068ac` Fix MySQL: cột `TEXT UNIQUE` dùng `VARCHAR(768)` thay `VARCHAR(191)` — vì `mentions.link` (URL bài báo) có thể dài hơn 191 ký tự, cần khoá UNIQUE dài hơn.
- `3f598a0` MISA PR Workstation — bản đầy đủ (UI theo MDS + logo MISA, sửa theo tài liệu 16/07, port 3007).

## 2026-07-20 — Hoàn thiện chi tiết MDS khung ngoài
- `088fbb2` Fix icon chevron sidebar + control (select/checkbox/radio) đúng chuẩn MDS — phạm vi sửa chỉ ở khung Vue shell, không đụng `public/app.js` (xem [`12-frontend-architecture.md`](12-frontend-architecture.md) §D về trạng thái MDS thật của `app.js`).

## 2026-08-22 — Bắt đầu quy trình audit 2 agent (Gate 0)
- `0a6f8e3` Thêm memory-bank: audit findings, decisions, data classification, roadmap — khởi tạo `memory-bank/` lần đầu (file 01-04), vì dự án chuyển sang mô hình Claude triển khai + Codex audit độc lập trước khi mở rộng thêm.
- `b8b8f4f` Áp dụng 6 amendment của Codex vào roadmap; thêm error contract + threat model — Codex review độc lập roadmap, yêu cầu 6 sửa đổi trước khi APPROVE, đồng thời bổ sung file 05/06.
- `d1e2eaa` Gate 0: inventory route/job/AI/UI + ma trận permission (G0.3, G0.4) — dựng file 07/08 (route catalog + permission matrix), lần đầu.

## 2026-08-22 — Remediation vòng 2-3 sau audit Codex phát hiện lỗi thật
- `7a21b6a` **Gate 0 remediation round 2: sửa 5/6 blocker Codex audit tìm ra** — Codex audit vòng 1 tìm được: ma trận G0.4 vi phạm MDS P0, inventory G0.3 nén bằng wildcard làm lọt 47/135 route, error contract mâu thuẫn, egress map Gemini thiếu callsite, fact drift (DB_CLIENT default ghi sai, đếm route sai).
- `b531d52` **Gate 0 remediation round 3: sửa 4/5 blocker Codex re-audit round 2** — Codex audit vòng 2 vẫn `HOLD GATE 1`: xác nhận G0.3 PASS (145/145 route khớp máy) nhưng G0.4 vẫn FAIL (route bị che lấp bởi range), G0.8 vẫn FAIL (đếm sai số lời gọi Gemini, phân loại sai tier 1 hàm AI); sửa lại bằng cách bỏ hẳn cách chia route theo module tuỳ ý, dùng 1 phân hoạch duy nhất tự-verify bằng `awk`.

## 2026-08-24 — G0.2: bổ sung phần memory-bank còn thiếu theo mandate (file này)
- Codex xác nhận qua 2 vòng audit rằng `memory-bank/` (file 01-08) vẫn thiếu các chủ đề bắt buộc theo `BackEnd.SKILL/20-memory-bank-mandate.md` mục 2: lược đồ DB, API contract, luồng nghiệp vụ, kiến trúc frontend/MDS, triển khai/runbook, bẫy kỹ thuật, changelog, quy tắc code. Bổ sung file 09-16 (đợt viết tài liệu doc-only này) — không sửa code, chỉ đọc `server/`+`public/`+`frontend/` để trích xuất fact có `file:line`.

## 2026-08-24 — Owner-decisions + roadmap v3 (thay đổi kiến trúc lớn nhất từ đầu dự án)
- Owner quyết trực tiếp qua hội thoại: **D13** (RBAC v2 — 4 vai trò + visibility field-level cấu hình được + tách created_by/owner_id cho 14 bảng), **D14** (Voice Assistant vision — gọi từ mọi màn hình + AI tự tìm entity + tự ghi nhận), O6 APPROVED $200, O2/O7 SUPERSEDED, O4/O5 DEFERRED-TO-DEVOPS. **Vì sao đổi lớn:** thay cả hệ vai trò → không "vá" money-policy `org_fee` cũ nữa mà xây PolicyEngine đọc `field_visibility` động; đây thành khối việc nền tảng lớn nhất.
- Owner xác nhận **dữ liệu Cloud Run = test, bỏ được** → chuỗi migration R1.0-R1.7 (dual-write/backfill/reconcile/canary — thiết kế cho dữ liệu sống) BỎ, thay bằng seed lại sạch. Target `browser-production` lùi thời điểm. **Vì sao:** không còn dữ liệu thật để mất, nhiều Tier-A giãn ưu tiên (bản v2 §R1 giữ trong git history nếu về sau production có dữ liệu sống).
- `04-ROADMAP.md` viết lại **v2→v3**: Wave 1 tái cấu trúc quanh RBAC v2 (gộp F1/F9/F11), R1 bỏ, thêm track W3.VOICE/W4.VOICE (D14), O4/O5 chuyển DevOps, thêm fork chiến lược §0.1 (spec-first cho phần viết lại vs characterization phần giữ). `08-permission-matrix.md` thêm cảnh báo "hiện trạng 2 vai trò, đích 4 vai trò theo D13".

---

**Từ đây, mọi thay đổi kiến trúc/schema/API/nghiệp vụ đáng chú ý PHẢI thêm 1 dòng vào file này kèm lý do — theo `BackEnd.SKILL/20-memory-bank-mandate.md` mục 3.**
