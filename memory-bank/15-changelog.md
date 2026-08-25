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

## 2026-08-24 (tiếp) — Owner chốt O3/O8 + D14.2 + làm rõ D15 (AMIS Mobile = WebView bridge)
- **O3 → DevOps** (owner: "để devops làm, đó là việc của họ"). **O8 → PROVISIONAL** (owner: "tạm thời cứ gửi Gemini xử lý" — hợp lệ vì dữ liệu test; giữ cảnh báo xin Security/Legal khi có dữ liệu thật). **D14.2 chốt: GIỮ human-in-the-loop** (owner: "người dùng phải xác nhận, speech-to-text có thể sai").
- **D15 (mới, tác động lớn):** owner làm rõ AMIS Mobile chỉ là **cầu nối WebView** — mỗi app = 1 icon, bấm mở web app trong khung native, KHÔNG build native riêng. → "native composition" = web-in-WebView + bridge, làm NHẸ F5 + toàn bộ Wave native (không codebase native song song). Auth O3 = host bơm token vào web app qua bridge. **Vì sao ghi:** đây đổi bản chất khối việc lớn nhất còn lại (native), giảm rủi ro/khối lượng đáng kể, cần Codex biết khi re-audit.
- Cập nhật `02-decisions.md` (O3/O8/D14.2/D15) + `04-ROADMAP.md` (O3/O4/O5→DevOps, O8 gateway config-permissive, W3.VOICE giữ human-in-the-loop, Wave 4 = WebView-host không native riêng). **Không còn owner-action treo — điều kiện đóng G0 duy nhất còn lại là Codex re-audit round 3.**

## 2026-08-25 — Codex round-3 re-audit → `G0-CLOSE-CONTRACT.md` (C0.1-C0.8) — remediation lớn nhất từ đầu Gate 0
- Codex re-audit round 3 giữ `HOLD GATE 0`, ra 8 blocker cụ thể (C0.1-C0.8) thay vì finding tự do. Owner phân công **C0.3 (rebuild ma trận UI-flow G0.4) cho Codex trực tiếp làm**, không phải Claude — lần đầu tiên trong dự án 1 phần việc doc được chuyển hẳn sang Codex thay vì Claude sửa theo audit của Codex.
- **C0.1 (owner APPROVED trực tiếp, evidence trong `G0-CLOSE-CONTRACT.md`):** O1 chuyển PROPOSED→APPROVED (audience default, không hạ classification tier); D13 self-claim chốt KHÔNG cho tự nhận; N1 chốt dùng action tường minh (`ack`/`notify`/`run`); N2 chốt `dashboard:view` tường minh. Cả 4 ghi vào `02-decisions.md` §B/§B.1/§D D13.4c.
- **C0.2 (Claude viết lại D13 theo yêu cầu Codex, R3-03/R3-04):** phát hiện D13 bản 2026-08-24 dùng 1 cờ boolean cho cả classification lẫn visibility — lỗ hổng thật (Admin có thể lỡ tay công khai hoá tài khoản NH/giấy tờ tùy thân). Viết lại D13.2 thành 4 trục tách biệt: `classification_tier` (trần bất biến) / `audience_visibility` (cấu hình, chỉ siết) / `authorization` (role×ownership) / `AI-egress`. Mở rộng D13.4 thành ma trận ownership đủ nhóm resource (không chỉ 14 "hoạt động" — thêm global cho danh bạ/nhắc việc, module-admin-only cho budgets/monitoring, inherited cho event_costs). Đánh dấu D1 RETAINED (phạm vi AMENDED), D2 SUPERSEDED, D3 RETAINED (AMENDED thêm trần server-derived D13.3b).
- **C0.4 (source-fidelity, tự kiểm chứng lại từng claim bằng parser/grep trước khi sửa — không nhận nguyên claim Codex):** index 22 không phải 21 (`grep -c` xác nhận); `dropAll()` xoá đúng 28/34 bảng, 6 bảng bị bỏ sót đúng tên Codex nêu (`agreements`/`work_logs`/`gifts`/`benefit_usages`/`supplier_transactions`/`supplier_contacts`), `attachments`/`supplier_quotes` THỰC RA có bị xoá (bản cũ ghi sai ngược); reminder không có UNIQUE, chỉ check-then-insert (xác nhận qua đọc `scheduler.js`); partner detail trả về đúng 10 mảng (đếm lại từ `routes.js:153`); booking `B_COLS` chỉ có `award_id`, không có `event_id` — đăng ký finding mới **F12** ở `01-audit-findings.md`; sửa nhãn ước lượng %/diện tích UI; tách rõ MySQL 8.4 (local Docker xác nhận qua `docker-compose.yml`) vs Cloud SQL (UNVERIFIED).
- **C0.5:** thay "additive migration + seed sạch" bằng preflight/rollback gate `W1.RBAC.0` (DevOps attest + backup + fresh schema + giữ DB cũ tới khi acceptance pass) — vì `dropAll()` hiện tại không sạch (C0.4). Liệt kê O3/O4/O5 là 3 phụ thuộc DevOps song song, không gộp chung "bridge contract".
- **C0.6:** Gate 1 đổi từ "characterization chỉ phần giữ nguyên" sang **characterization-core phủ ĐỦ 145 route + job/scheduler/monitor**, thêm lớp G1C acceptance E2E, bắt buộc bảng ánh xạ machine-readable `route_id→test_id→trạng thái` làm exit criterion.
- **C0.7:** sửa D15 — không dùng "mobile-first responsive" (dễ hiểu lầm = desktop + CSS co giãn), đổi thành "composition Native-Mobile RIÊNG BIỆT trong WebView"; xác nhận D15 KHÔNG giảm severity F5 (P0 giữ nguyên), chỉ giảm khối lượng triển khai; thêm yêu cầu bridge security contract (origin allowlist, message schema versioned, token TTL/chống replay, không lưu token ở query/localStorage).
- **C0.8:** sửa 2 lỗi diễn đạt threat model — AI-E001 không còn "chặn bởi O8" (giờ provisional-permit cho dữ liệu test); AI-E012 làm rõ mention text chỉ dùng cục bộ để đếm, không vào prompt Gemini (xác nhận qua đọc `monitor.js:281-304`). `06-threat-model.md` lên v5.
- **Codex round 4 — C0.3:** thay Section B/C của `08-permission-matrix.md` bằng 34 UI/business flow phủ R001-R145 đúng một lần, đủ `super_admin`/`pr_staff` × Desktop/Native, state profile loading/empty/error/403 và runtime capability tách host/OS. Thêm `scripts/verify-g0.mjs` để kiểm catalog/auth/UI-flow/Gemini/schema/error/link. Verify cũng phát hiện và sửa drift auth R144/R145 trong `07-route-catalog.md`: logout không có auth middleware; `/me` tự check session trong handler.
- **Codex round 4 — focused decision:** C0.1/C0.3-C0.8 PASS; C0.2 HOLD vì hai semantics `Global` cho shared directories/`important_dates` được tài liệu thừa nhận chưa hỏi owner nhưng lại định dùng làm target-test expectation. Đăng ký D13-P1/P2 thay vì tuyên bố ngầm là approved.
- **Codex round 4 CLOSE:** owner duyệt D13-P1/P2 bằng câu “ok nhé, tôi nhất trí đề xuất của bạn”. Persist `Global edit` theo `module:edit` cho `organizations`/`people`/`suppliers` và `important_dates`, với field mật gate riêng, delete chỉ Admin/Super Admin, thay đổi có audit. C0.2 chuyển PASS; **C0.1-C0.8 đều PASS → CLOSE G0 / OPEN G1**. Native-Mobile vẫn FAIL/P0 và nằm trong wave UI, không bị hạ severity khi đóng gate tài liệu.
- **Thêm D14.4 (secure proposal/confirmation contract cho voice, R3-08):** server tạo proposal opaque/có hạn/gắn principal + optimistic concurrency + re-check PolicyEngine lúc xác nhận — chống tampering/replay/TOCTOU mà D14.2 (human-in-the-loop) một mình chưa đủ chặn.
- Chạy lại `git diff --check` (sạch) + `npm run test:security` (6/6 PASS) sau khi remediate — đúng yêu cầu Codex mục 4 của `G0-CLOSE-CONTRACT.md`.

## 2026-08-25 — Gate 1 mở: G1A.1 harness + khung G1A.9

- **G1A.1 (harness):** tách `server/app.js` (`createApp()`) khỏi `server/index.js` — thuần
  extract, không đổi hành vi (đã verify thủ công: login/logout/`/api/me`, log khởi động
  scheduler/monitor giống hệt trước). Thêm `server/test-support/{app-harness,db-harness,clock,
  fixtures}.js`: MySQL ephemeral database tạo/xoá riêng theo từng file test qua bootstrap
  connection `root` (không dùng `dropAll()` — đúng quyết định C0.5), `t.mock.timers` của
  `node:test` giả lập `Date` cho scheduler/monitor mà không cần sửa code nguồn (đã đọc trực tiếp
  `scheduler.js`/`monitor.js` xác nhận mọi lời gọi `Date`/`Date.now()` đều ở call-time). Thêm
  `ports: 3306:3306` cho service `db` trong `docker-compose.yml` (trước đó không truy cập được
  từ host). Smoke test `server/test/smoke.test.js` PASS 2/2 cả `test:integration:sqlite` và
  `test:integration:mysql`; đã xác nhận teardown drop sạch database `pr_media_test_*` sau khi
  chạy (không rò rỉ database tạm). Phát hiện phụ trong lúc dựng harness: `node --test <thư mục>`
  KHÔNG tự động discover file trên Node 24.15.0 — phải dùng glob rõ ràng
  (`server/test/*.test.js`), đã sửa lại 2 script trong `package.json` cho đúng.
- **G1A.9 (khung, CHƯA xong):** tạo `memory-bank/gate1-test-mapping.md` — 145/145 route (sinh từ
  `07-route-catalog.md`, không lọt/trùng) + `JOB-REMINDER`/`JOB-MONITOR-SCAN`, mọi dòng
  `status=TODO`. Đây chỉ là khung rỗng, KHÔNG phải exit criterion Gate 1 đã đạt — còn phải điền
  `test_id`/`file`/`status` thật khi G1A.2-G1A.8 lần lượt hoàn thành.
- Verify: `npm run test:security` vẫn 6/6 PASS (không regression do tách `index.js`/`app.js`),
  `git diff --check` sạch.

---

**Từ đây, mọi thay đổi kiến trúc/schema/API/nghiệp vụ đáng chú ý PHẢI thêm 1 dòng vào file này kèm lý do — theo `BackEnd.SKILL/20-memory-bank-mandate.md` mục 3.**
