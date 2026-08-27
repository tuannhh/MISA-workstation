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
  chạy ở **happy path** (chưa test failure-path lúc này — Codex audit round sau chỉ ra claim
  "không rò rỉ" ở mức này là quá rộng khi chưa chứng minh cả đường lỗi; xem mục remediation dưới).
  Phát hiện phụ trong lúc dựng harness: `node --test <thư mục>`
  KHÔNG tự động discover file trên Node 24.15.0 — phải dùng glob rõ ràng
  (`server/test/*.test.js`), đã sửa lại 2 script trong `package.json` cho đúng.
- **G1A.9 (khung, CHƯA xong):** tạo `memory-bank/gate1-test-mapping.md` — 145/145 route (sinh từ
  `07-route-catalog.md`, không lọt/trùng) + `JOB-REMINDER`/`JOB-MONITOR-SCAN`, mọi dòng
  `status=TODO`. Đây chỉ là khung rỗng, KHÔNG phải exit criterion Gate 1 đã đạt — còn phải điền
  `test_id`/`file`/`status` thật khi G1A.2-G1A.8 lần lượt hoàn thành.
- Verify: `npm run test:security` vẫn 6/6 PASS (không regression do tách `index.js`/`app.js`),
  `git diff --check` sạch.

## 2026-08-25 — Codex audit G1A.1 round 1: HOLD/PARTIAL → remediation round 2

Codex audit `PR-WORKSTATION-CODEX-G1A1-AUDIT.md` trả G1A.1 **HOLD/PARTIAL** (không phải HOLD toàn
bộ Gate 1 — G1A.9 scaffold vẫn PASS AS SCAFFOLD) với 5 blocker (A1-A5) + 2 process fix (N1-N2).
Đã tự tái hiện độc lập trước khi sửa (đúng nề nếp dự án): A1 (process treo) và A3 (port
`0.0.0.0:3306`) tái hiện y hệt Codex; A2 chỉ tái hiện được đúng cách sau khi phát hiện lỗi trong
chính failure-path test của Claude (xem dưới).

- **A1 (blocker):** thêm `MySQLSyncDatabase.close()` (`server/mysql-sync.js`) — gửi message
  `shutdown` cho worker, `worker.postMessage({shutdown:true})` → worker `connection.end()` rồi
  `process.exit(0)` (`server/mysql-worker.js`), có timeout 3s force-`terminate()` nếu worker không
  tự thoát. Thêm `closeDb()` ở `server/db.js` (dùng chung cho SQLite qua `DatabaseSync.close()` có
  sẵn của Node). Gọi `closeDb()` trong teardown TRƯỚC khi drop schema. Verify: đo trực tiếp
  `npm run test:integration:mysql` từ 3 lần chạy round 1 để lại **3 process/npm zombie** (từ
  9:24, 9:32, 9:52 sáng) không tự thoát — đã kill tay; sau fix, đo lại bằng `date +%s` trước/sau:
  exit code 0 thật, ~2 giây, không cần force-exit.
- **A2 (blocker):** `createMysqlTestDb()` giờ rollback (`DROP DATABASE`) khi `GRANT`/`FLUSH` lỗi
  sau khi `CREATE DATABASE` đã thành công. Thêm failure-path test
  `server/test/db-harness-failure.test.js` tái hiện đúng thí nghiệm Codex (`MYSQL_USER` không tồn
  tại → `GRANT` lỗi `ER_CANT_CREATE_USER_WITH_GRANT`). **Tự bắt được 1 lỗi trong chính test này**:
  bản đầu so toàn bộ `SHOW DATABASES LIKE 'pr_media_test_%'` trước/sau — false positive vì
  `smoke.test.js` chạy đồng thời (process riêng) có thể đang có database tạm hợp lệ của riêng nó
  tại đúng thời điểm kiểm tra. Sửa: `error.attemptedDbName` gắn tên cụ thể vào lỗi, test chỉ kiểm
  tra đúng tên đó còn tồn tại hay không — độc lập với các file test khác đang chạy song song.
- **A3 (blocker an toàn):** `dropMysqlTestDb()` validate tên bằng regex
  `^pr_media_test_\d+_[0-9a-f]{8}$`, từ chối DROP tên không khớp. `GRANT` đổi từ wildcard
  `pr_media_test_%` sang đúng tên database vừa tạo. Thêm `assertSafeHost()` chặn
  `MYSQL_HOST` ngoài allowlist `127.0.0.1`/`localhost`/`::1` trừ khi
  `ALLOW_TEST_DB_REMOTE_HOST=1`. Thêm opt-in bắt buộc `ALLOW_TEST_DB_CREATE=1` (đặt sẵn trong
  script `test:integration:mysql`). `docker-compose.yml`: đổi `"3306:3306"` → `"127.0.0.1:3306:
  3306"` — verify bằng `docker port`: trước fix thấy cả `0.0.0.0:3306`+`[::]:3306`, sau fix chỉ
  còn `127.0.0.1:3306`.
- **A4 (contract):** thêm `fixtures.createPrivilegedUser()` — dùng `super_admin` sẵn có (đã có
  CRUD mọi module + `canSeeSensitive`) làm fixture "privileged" đúng nghĩa roadmap G1A.1 yêu cầu,
  thay vì để roadmap ghi `XONG` khi tự thừa nhận thiếu. Đồng thời đổi trạng thái roadmap G1A.1 từ
  `XONG` (round 1, bị Codex chỉ ra là premature) thành `PARTIAL — chờ Codex re-audit`, không tự
  tuyên bố `XONG` lần này dù đã fix hết 5 blocker — chỉ Codex mới đóng gate theo đúng mô hình 2
  agent của dự án.
- **A5 (evidence):** sửa 8 file memory-bank có line-number trỏ vào `index.js` cho các phần đã
  chuyển sang `app.js` (`07-route-catalog.md`, `05-error-contract.md`, `13-deployment-runbook.md`,
  `README.md`, `01-audit-findings.md`, `14-known-traps.md`, `06-threat-model.md`). Sửa
  `scripts/verify-g0.mjs`: `sourceRoutes()` không còn hard-code 3 route auth — hàm
  `parseDirectAppRoutes()` mới parse thật từ `server/app.js` (route + handler), chỉ giữ lại tri
  thức nghiệp vụ tối thiểu (handler nào → authKind nào) dưới dạng map hằng, fail loudly nếu route
  bị đổi/xoá/handler lạ. Thêm negative self-test `scripts/verify-g0.selftest.mjs` (script
  `test:verify-g0-selftest`) chứng minh parser thật sự FAIL khi xoá route `/api/login` hoặc đổi
  tên handler — trước đây verifier luôn PASS vì hard-code, không phát hiện được chính drift này.
- **N1/N2 (process):** thêm rule bắt buộc `DATA_DIR` tạm cho manual smoke vào
  `16-coding-rules.md` §B.8. `app-harness.close()` không còn nuốt lỗi đóng server + có timeout 5s
  báo lỗi rõ nếu socket còn mở. Thêm self-test cho clock helper
  (`server/test/clock-selftest.test.js`).
- Verify cuối round: `npm run test:security` 6/6 PASS, `npm run test:integration:sqlite` 4 pass +
  1 skip (đúng — test failure-path chỉ chạy ở mysql mode), `npm run test:integration:mysql` 5/5
  PASS với exit code 0 thật (~2s), `npm run test:verify-g0-selftest` 3/3 PASS,
  `node scripts/verify-g0.mjs` vẫn PASS toàn bộ (giờ đáng tin hơn vì không còn hard-code auth
  route), `git diff --check` sạch, `SHOW DATABASES LIKE 'pr_media_test_%'` rỗng và không còn
  process `node --test` nào sống sau khi chạy xong cả 2 chế độ.

---

## 2026-08-25 — Codex re-audit G1A.1 round 2: HOLD/PARTIAL (gần CLOSE) → remediation round 3

Codex re-audit round 2 (`PR-WORKSTATION-CODEX-G1A1-REAUDIT-ROUND-2.md`) xác nhận phần lớn root
cause round 2 đã sửa đúng (MySQL 5/5 exit 0 thật ~2,11s, rollback GRANT đúng, Compose loopback,
privileged fixture, doc line-reference) nhưng vẫn giữ `HOLD/PARTIAL` vì 3 blocker còn lại:

- **R2-01 (isolation):** `smoke.test.js` `after()` luôn gọi `require('../db').closeDb()` kể cả khi
  `before()` throw TRƯỚC khi DB module từng được require (vd `createMysqlTestDb()` lỗi ở bước
  GRANT) — node:test vẫn chạy `after()` sau khi `before()` lỗi, nên nhánh này có thể tự load
  `server/db.js` với `MYSQL_DATABASE` mặc định và chạy `init()`/`seed()` lên DB dev/kế thừa.
  **Sửa:** thêm `server/test-support/resource-stack.js` — `acquire(cleanup)` chỉ push cleanup
  SAU KHI một bước setup thật sự thành công; `cleanupAll()` pop theo LIFO, không bao giờ tự tạo
  resource mới. `smoke.test.js` đổi hẳn sang pattern này: lấy `closeDb` trực tiếp từ
  `require('../db')` ngay tại `before()` và `acquire()` ngay lúc đó — không còn require lại trong
  `after()`. Thêm `server/test/smoke-failure.test.js` với 5 test: 2 test đơn vị cho chính
  resource-stack (thứ tự LIFO + gộp lỗi thành `AggregateError` + stack rỗng không lỗi) và 3 test
  tái hiện đúng 3 kịch bản Codex nêu — (1) create/grant failure trước require: xác nhận
  `MYSQL_DATABASE` không đổi + resource-stack rỗng sau lỗi; (2) listen/start failure SAU khi DB đã
  load: dùng thật `createMysqlTestDb()` rồi mô phỏng bước kế tiếp throw, xác nhận `cleanupAll()`
  vẫn drop đúng DB đã tạo; (3) DB init failure SAU khi worker đã spawn: chạy
  `server/test-support/require-db-fixture.js` trong **process con riêng** (`child_process.spawnSync`)
  với `MYSQL_DATABASE` trỏ tới schema chưa từng tồn tại — vì `db.js` có side-effect module-scope
  (spawn worker + `init()`/`seed()` ngay khi require), không thể chạy an toàn trong chính test
  process mà không làm hỏng module cache cho các test khác. **Residual risk ghi nhận rõ ràng
  (không che giấu):** ở kịch bản (3), nếu `init()` throw thì `module.exports` của `db.js` chưa
  từng chạy tới, nên không có handle nào để gọi `closeDb()` graceful cho worker vừa spawn —
  nhưng vì toàn bộ kịch bản chạy trong 1 process con độc lập, worker đó chỉ sống trong đúng vòng
  đời process con này; test xác nhận process con thoát với exit code khác 0 (`Unknown database`
  rõ ràng, không mơ hồ) và **không bị treo** (`result.signal === null`, không cần kill do timeout)
  — tức là residual leak, nếu có, tự dọn theo vòng đời OS process, không phải leak vĩnh viễn.
- **R2-02 (DB safety/resilience):** `assertOptIn()` trước đây chỉ áp dụng cho `createMysqlTestDb()`,
  `dropMysqlTestDb()` chạy DROP với bất kỳ tên hợp regex nào mà không cần opt-in; rollback DROP khi
  GRANT lỗi và `connection.end()` lúc worker shutdown đều nuốt lỗi (catch rỗng); harness dùng chung
  `MYSQL_HOST`/`MYSQL_PORT`/`MYSQL_ADMIN_USER`/`MYSQL_ROOT_PASSWORD` của app — không phân biệt được
  Docker MySQL test với một Cloud SQL Proxy local đang chạy trên cùng `127.0.0.1:3306`; `MYSQL_USER`
  được nối thẳng vào câu `GRANT` mà chưa validate identifier. **Sửa:** `dropMysqlTestDb()` gọi
  `assertOptIn()` (có test `db-harness-failure.test.js` xác nhận từ chối đúng thông báo trước khi
  mở connection); rollback lỗi gắn vào `error.cleanupError` thay vì nuốt; `mysql-worker.js` gửi
  `shutdownAck` kèm lỗi (nếu có) trước khi `process.exit`, `mysql-sync.js` `close()` reject nếu
  `shutdownAck` báo lỗi HOẶC phải force-terminate sau 3s (trước đây cả hai trường hợp đều
  `resolve()` êm xuôi); bootstrap admin connection đổi sang namespace biến riêng
  `TEST_MYSQL_HOST/PORT/ADMIN_USER/ADMIN_PASSWORD` — không còn đọc `MYSQL_HOST`/`MYSQL_ADMIN_*`/
  `MYSQL_ROOT_PASSWORD` của app; thêm `assertNoProductionSocket()` từ chối chạy nếu
  `MYSQL_SOCKET_PATH` đang được set (Cloud SQL production); thêm `assertSafeAppUser()` validate
  `MYSQL_USER` bằng regex `^[A-Za-z0-9_]{1,32}$` trước khi dùng trong `GRANT`.
- **R2-03 (evidence/false-positive):** `scripts/verify-g0.mjs` đã parse thật 3 route auth trực
  tiếp từ round 2, nhưng `sourceRoutes()` vẫn hard-code cặp `['server/routes.js', '/api']` và
  `['server/ai.js', '/api/ai']` — nếu mount thật đổi (vd `/api` → `/v2`), verifier vẫn dùng `/api`
  hard-code và có thể báo PASS sai (đúng loại false-positive A5 round 1 vốn đã yêu cầu loại bỏ).
  **Sửa:** thêm `parseRouterMounts()`/`resolveRouterPrefix()` — parse `const routerVar =
  require('./file')` + `app.use(prefix, routerVar)` từ `server/app.js` thật, `sourceRoutes()`
  dùng `resolveRouterPrefix()` thay vì hard-code. Thêm 3 self-test mới trong
  `scripts/verify-g0.selftest.mjs`: positive xác nhận `/api`→routes.js, `/api/ai`→ai.js đúng thật;
  negative đổi mount `/api`→`/v2` xác nhận hàm phản ánh đúng `/v2` (không còn kẹt ở `/api`); negative
  xoá hẳn dòng `app.use('/api', apiRouter)` xác nhận parser FAIL thay vì âm thầm dùng giá trị mặc
  định.
- **S1/S2 (nên sửa cùng round, Codex xếp "SHOULD FIX"):** `app-harness.js` đổi
  `app.listen(0, ...)` → `app.listen(0, '127.0.0.1', ...)` — trước đây bind mọi interface dù chỉ
  cần truy cập từ chính process test. Sửa restore env dùng "delete nếu ban đầu chưa set, gán lại
  nếu đã có giá trị" thay vì luôn gán — **phát hiện đây KHÔNG phải rủi ro lý thuyết**: khi tự chạy
  lại `npm run test:integration:mysql` sau khi thêm test mới (`smoke-failure.test.js`), một test
  fail thật với lỗi `GRANT ... TO 'undefined'@'%'` vì một test trước đó trong cùng file process đã
  gán `MYSQL_USER` rồi restore bằng `process.env.MYSQL_USER = originalUser` với `originalUser`
  là `undefined`, khiến Node ghi chuỗi literal `'undefined'`. Sửa cả `db-harness-failure.test.js`
  và `smoke-failure.test.js` dùng đúng pattern "delete nếu chưa từng có key", chạy lại xác nhận
  xanh.
- **Verify cuối round 3:** `npm run test:security` 6/6 PASS (0,79s); `npm run test:integration:sqlite`
  6 pass + 5 skip đúng (5 test mysql-only skip khi `DB_CLIENT=sqlite`), exit 0; `npm run
  test:integration:mysql` 11/11 PASS, exit code 0 thật, `real 1,90s`; `npm run
  test:verify-g0-selftest` 6/6 PASS; `node scripts/verify-g0.mjs` PASS toàn bộ; `git diff --check`
  sạch; `SHOW DATABASES LIKE 'pr_media_test_%'` rỗng sau suite; `ps aux` xác nhận không còn process
  `node --test`/`mysql-worker` nào sống sau khi cả 2 chế độ test chạy xong.
- Cập nhật roadmap G1A.1 (`04-ROADMAP.md`) sang trạng thái PARTIAL round 3, liệt kê đủ R2-01/R2-02/
  R2-03 đã remediate — vẫn KHÔNG tự ghi `XONG`, chờ Codex re-audit lần 3 theo đúng mô hình 2 agent.

---

## 2026-08-25 — Codex re-audit G1A.1 round 3: HOLD/PARTIAL (2 blocker sâu hơn) → remediation round 4

Codex re-audit round 3 (`PR-WORKSTATION-CODEX-G1A1-REAUDIT-ROUND-3.md`) xác nhận R2-01/R2-02/R2-03
+ S1/S2 của round 3 đều đúng hướng và CLOSE (resource-stack, CREATE/DROP guard đầy đủ, router-mount
verifier, loopback bind, restore-env) — nhưng phát hiện 2 blocker MỚI, sâu hơn, nằm ngay trong đúng
2 mảng vừa sửa, cộng 1 mục Codex tự đề xuất hạ từ blocker xuống backlog:

- **R3-01 (treo thật trong `before()` node:test):** test cũ cho "DB init failure sau worker spawn"
  dùng semantics của MỘT SCRIPT THƯỜNG (uncaught exception làm process chết ngay) — khác hẳn hành
  vi thật của `before()` trong `node:test`, nơi test runner BẮT exception và tiếp tục chạy `after()`
  mà KHÔNG tự crash process. Codex tái hiện đúng bằng `before(() => require('../db'))` trong 1 file
  `node:test` thật, trỏ `MYSQL_DATABASE` tới schema chưa tồn tại: `after()` chạy xong nhưng process
  không tự thoát — phải `SIGKILL` sau 6 giây, vì worker MySQL spawn trước `init()`/`seed()` mồ côi
  hoàn toàn (không handle nào để đóng) khi `init()` throw trước khi `module.exports` của `db.js`
  từng chạy tới. **Sửa:** bọc `try/catch` quanh `dropAll()/init()/seed()` ngay trong `server/db.js`
  — nếu throw, gọi `db.close()` (không `await`, vì đây là code đồng bộ module-scope) TRƯỚC khi
  rethrow lỗi gốc. Vì `db` (và worker của nó) đã được construct xong ở dòng trước `init()`/`seed()`,
  `db.close()` luôn có handle hợp lệ để gọi — worker tự đóng graceful hoặc bị force-terminate sau
  3s, và vì đây vẫn là các async operation có ref, event loop tiếp tục sống ĐỦ LÂU để tự dọn sạch
  rồi mới thoát — không cần `await` đồng bộ tại đây, không cần ai ở tầng gọi phải nhớ đóng gì thêm.
  Thêm fixture `server/test-support/db-init-hang-fixture.js` (1 file `node:test` thật, có
  `before()`/`after()`/`test()` với sentinel qua `console.log`) + test mới trong
  `server/test/smoke-failure.test.js` spawn `node --test <fixture>` (không phải script thường) và
  đo elapsed time, xác nhận: không bị `SIGKILL` (`result.signal === null`), tự thoát trong < 4s,
  `after()` có chạy (đúng thứ tự thật node:test), `test()` bên trong không chạy (đúng vì `before()`
  lỗi). **Phát hiện thêm 1 bug trong lúc viết chính test này** (không phải do Codex chỉ ra): khi
  test nằm bên trong MỘT `node --test` khác (`npm run test:integration:mysql`), Node tự set
  `NODE_TEST_CONTEXT`/`NODE_TEST_WORKER_ID` trong `process.env` của process hiện tại — kế thừa 2
  biến này vào env của `node --test` con (`...process.env`) khiến con tưởng nó đang chạy đệ quy bên
  trong 1 test file, tự in cảnh báo "run() is being called recursively" và SKIP toàn bộ fixture (exit
  0, stdout rỗng) — làm test tưởng nhầm là xanh trong khi chẳng chạy gì cả. Đã xoá 2 biến này khỏi
  env trước khi spawn con, chạy lại xác nhận test thật sự tái hiện đúng kịch bản và pass vì fix
  thật, không phải vì bị skip ngầm.
- **R3-02 (`close()` false-success + TDZ che lỗi gốc):** `server/mysql-sync.js`'s `close()` cũ có
  2 lỗi: (1) TDZ — `timer` được khai báo bằng `const` SAU nhánh `catch` của `postMessage()`; nếu
  `postMessage()` throw đồng bộ, nhánh catch gọi `clearTimeout(timer)` trong khi `timer` còn ở
  temporal dead zone → `ReferenceError` che mất lỗi worker gốc; (2) false-success — listener
  `worker.once('exit', ...)` chỉ dựa vào "có nhận được `shutdownAck` báo lỗi hay không", bỏ qua
  hẳn exit code; Codex chứng minh bằng fake worker: exit code 1 mà không gửi `shutdownAck` (ack bị
  mất/worker crash trước khi kịp gửi) vẫn được `close()` coi là thành công (`resolve()`). **Sửa:**
  tách state machine thành hàm thuần `closeWorker(worker, timeoutMs)` (export cùng
  `MySQLSyncDatabase`) — khai báo VÀ gán `timer` TRƯỚC khi gọi `postMessage()` (hết TDZ hoàn toàn,
  không còn thứ tự khai báo nào có thể gây ReferenceError); chỉ `resolve()` khi ĐỦ CẢ HAI: đã nhận
  đúng 1 `shutdownAck` KHÔNG lỗi VÀ exit code === 0 — mọi tổ hợp khác (ack báo lỗi, exit khác 0 dù
  có/không có ack, exit trước khi từng nhận ack, worker phát `error`, `postMessage()` throw đồng
  bộ, hoặc phải force-terminate sau timeout) đều `reject()`. Thêm 8 unit test bằng fake worker
  (EventEmitter, `server/test/mysql-sync-close.test.js`) phủ đúng từng nhánh: success, ack-error,
  exit-non-zero-không-ack (repro chính xác false-success Codex phát hiện), exit-0-trước-ack,
  worker error, `postMessage()` throw đồng bộ (xác nhận lỗi gốc được giữ nguyên, không còn bị TDZ
  che), timeout/force-terminate, và lỗi ngay trong `terminate()`.
- **R3-03 (nhận diện Docker test vs Cloud SQL Proxy) — Codex tự hạ từ MUST-FIX xuống SHOULD-FIX:**
  sau khi trao đổi lại tiêu chí đánh giá (chỉ giữ blocker nếu có thể gây treo CI/mất dữ liệu/hở bảo
  mật/regression thực tế), Codex xác nhận guard hiện tại (`assertSafeHost`, opt-in, regex tên DB,
  namespace `TEST_MYSQL_*`) đã đủ để tiếp tục làm việc trong môi trường local kiểm soát — kịch bản
  "Cloud SQL Proxy chiếm đúng `127.0.0.1:3306`" là rủi ro hiếm, không đáng giữ gate G1A.1. Chuyển
  thành backlog DevOps ghi rõ trong `04-ROADMAP.md` dòng `G1A.10` (pin Docker test sang cổng riêng
  + sentinel identity check khi làm CI/deploy hardening thật) — KHÔNG implement trong round này.
- **Verify cuối round 4:** `npm run test:security` 6/6 PASS; `npm run test:integration:sqlite` 14
  pass + 6 skip (6 test mysql-only), exit 0; `npm run test:integration:mysql` **20/20 PASS**, exit
  code 0 thật, `real ~1,8-2,0s`; `npm run test:verify-g0-selftest` 6/6 PASS; `node scripts/verify-g0.mjs`
  PASS toàn bộ; `git diff --check` sạch; `SHOW DATABASES LIKE 'pr_media_test_%'` rỗng sau suite;
  `ps aux` xác nhận không còn process `node --test`/`mysql-worker` nào sống.
- Cập nhật roadmap G1A.1 (`04-ROADMAP.md`) sang PARTIAL round 4, liệt kê đủ R3-01/R3-02 đã
  remediate + R3-03 chuyển backlog `G1A.10` — vẫn KHÔNG tự ghi `XONG`, chờ Codex re-audit lần 4.

---

## 2026-08-25 — Codex CLOSE G1A.1 (round 4) + vá N4-01 (SQLite close() trả undefined)

Codex re-audit round 4 (`PR-WORKSTATION-CODEX-G1A1-REAUDIT-ROUND-4-CLOSE.md`) xác nhận cả R3-01 và
R3-02 đã sửa đúng và tái kiểm chứng độc lập:

- R3-01: chạy độc lập `node --test db-init-hang-fixture.js` với schema không tồn tại + watchdog
  6 giây → `code=1, signal=null, killed=false, elapsedMs=241, afterRan=true, testRan=false`. Bản
  trước phải SIGKILL sau 6 giây; bản này tự thoát trong 241ms.
- R3-02: fake worker Codex chạy độc lập — success→RESOLVED; exit 1/no ack→REJECTED đúng exit code;
  `postMessage()` throw đồng bộ→REJECTED đúng lỗi gốc, không còn `ReferenceError`. 8/8 unit test
  PASS ở cả SQLite và MySQL.
- R3-03: ACCEPT AS BACKLOG — ghi nhận đúng ở `G1A.10`, không chặn CLOSE.

**Quyết định: G1A.1 = CLOSED. OPEN G1A.2.** Đây là gate đầu tiên trong dự án cần 4 vòng
audit/remediation liên tiếp mới CLOSE — bài học giữ lại: harness test tưởng đơn giản (chỉ là
"tạo/xoá DB tạm + đóng connection") hoá ra có rất nhiều đường lỗi (setup fail, cleanup fail, lỗi
lồng lỗi khi cleanup của cleanup cũng lỗi, semantics khác nhau giữa script thường và hook thật của
test framework) mà mỗi vòng audit độc lập của Codex lần lượt lật ra — đúng giá trị của mô hình
2 agent (Claude tự tin đã sửa xong, Codex luôn tìm ra một lớp lỗi sâu hơn) hơn là ngồi tự review.

Codex đồng thời báo 1 follow-up không chặn:

- **N4-01:** `node:sqlite` `DatabaseSync.close()` trả `undefined` (không phải Promise như MySQL
  worker's `close()`) — dòng `db.close().catch(() => {})` thêm ở round 4 (R3-01) gọi `.catch()`
  trực tiếp lên `undefined` sẽ ném `TypeError`, CHE MẤT lỗi init/seed gốc khi SQLite khởi động thất
  bại (chỉ ảnh hưởng chẩn đoán startup-failure, không gây treo CI, không sai nghiệp vụ hiện tại).
  **Vá ngay cùng lượt** (Codex cho phép ghép vào commit đầu G1A.2, không cần audit riêng — nhưng
  vá liền vì rẻ và tránh mang nợ kỹ thuật sang G1A.2): `server/db.js` đổi
  `db.close().catch(() => {})` → `Promise.resolve(db.close()).catch(() => {})` bọc trong
  `try/catch` (phòng `db.close()` throw đồng bộ) — an toàn cho cả trường hợp `close()` trả
  `undefined` (SQLite) và trả Promise thật (MySQL). Thêm regression test trong
  `server/test/smoke-failure.test.js` (chạy khi `DB_CLIENT=sqlite`): đặt sẵn 1 file `pr.db` không
  hợp lệ tại `DATA_DIR` để ép `init()` throw `"file is not a database"`, xác nhận lỗi gốc này vẫn
  xuất hiện nguyên vẹn ở `stderr`, không còn bị thay bằng `TypeError: Cannot read properties of
  undefined`.
- Verify sau khi vá N4-01: `npm run test:integration:sqlite` 15 pass + 6 skip (tăng 1 test so với
  round 4); `npm run test:integration:mysql` 20 pass + 1 skip (test N4-01 skip đúng ở mysql mode),
  exit code 0 thật, `real ~1,8-2s`; `npm run test:security` 6/6; `npm run test:verify-g0-selftest`
  6/6; `node scripts/verify-g0.mjs` PASS; `git diff --check` sạch; 0 database `pr_media_test_%`
  sót lại; 0 process còn sống.
- Roadmap G1A.1 (`04-ROADMAP.md`) đổi trạng thái từ `PARTIAL` sang `XONG` — đây là lần đầu tiên
  trong dự án roadmap được phép ghi `XONG` cho G1A.1, vì lần này chính Codex xác nhận CLOSE, không
  phải Claude tự tuyên bố. `G1A.10` giữ nguyên ghi chú backlog R3-03. **G1A.2 chính thức mở.**

---

## 2026-08-25 — Codex CLOSE G1A.2 (round 2, commit `82d181d`) — OPEN G1A.3

G1A.2 (unit test validation/formatter, SSRF/security, AI redaction/schema, projection/tính toán)
làm theo đúng 4 commit tách biệt do Codex chỉ đạo: `427eb65` (validation & formatter — rbac.js,
17 helper mới export từ routes.js, spreadsheet-parser.js#validateSignature, uploads.js file
filters), `f7f8cde` (SSRF/security utilities — monitor.js/ai.js), `b015251` (AI redaction &
schema — gemini.js, 5 schema JSON), `47b5c8d` (projection/tính toán — trích 6 hàm thuần khỏi
routes.js, gộp công thức NSR đang lặp 3 nơi).

**Round 1 audit — CONDITIONAL PASS**, 3 điểm cần remediation:

- 3 dòng gắn `known-red` (`BR-SSRF-010/011`, `BR-AI-015`) thực ra là characterization test ĐANG
  XANH — contract định nghĩa `known-red` là target test đang đỏ có owner+expiry, không phải test
  pass mô tả gap hiện có. Sửa: đổi cả 3 sang `green`, thêm quy ước rõ ở đầu
  `gate1-test-mapping.md` (`green` = đang pass kể cả khi mô tả 1 gap; `known-red` chỉ dùng cho
  target/guard test thật sự đỏ) — characterization xanh và target đỏ giờ luôn là 2 dòng riêng
  (`BR-SSRF-016`/`BR-AI-017` giữ vai trò "hàng target thật" cho 2 gap này).
- Inventory "mọi module" còn thiếu `monitor.parseFeed()`/`matchTerms()` (đã export từ trước,
  chưa có test) và 6 test có sẵn ở `server/security.test.js` (predate G1A.2) chưa vào mapping.
  Sửa: thêm 4 test mới (`BR-SSRF-017..020`, gồm 1 đặc tả đáng chú ý — `decodeEntities()` chạy
  TRƯỚC `stripTags()` trong `parseFeed()`, nên text đã escape dạng `&lt;x&gt;` bị hiểu nhầm thành
  tag HTML thật và bị xoá nguyên khối); đổi title 6 test cũ trong `security.test.js` để gắn
  `BR-VAL-035..040` (chỉ đổi chuỗi mô tả, không đổi assert/logic).
- `test_id` dùng scheme `UT-*` không xuất hiện trong source nên không join máy được. Sửa: bỏ
  scheme riêng, `test_id` = `business_rule_id` (đã nằm verbatim trong mô tả `test()`) — tự viết
  script xác nhận cả 83 dòng `green` đều tìm thấy đúng `test_id` trong file nguồn tương ứng.

Cả 3 xử lý trong 1 commit remediation `82d181d`, không mở vòng audit riêng theo từng điểm.

**Round 2 (re-audit remediation) — CLOSE.** Codex kiểm chứng độc lập: mapping 83 `green`/5
`TODO`/0 `known-red`, 83/83 rule nối được tới test thật; `test:security` 6/6; SQLite 90 pass + 6
skip; MySQL 95 pass + 1 skip; verifier G0 + self-test đều pass; diff chỉ gồm mapping + test,
không đổi logic sản phẩm. Còn 1 ghi chú câu chữ không chặn: `BR-VAL-002/003` dùng chung `test()`
với `BR-VAL-001` nên câu "`test_id` luôn bằng `business_rule_id`" chưa tuyệt đối đúng — sửa lại
câu chữ trong `gate1-test-mapping.md` cùng lúc mở G1A.3 (không cần vòng remediation riêng).

**Quyết định: G1A.2 = CLOSED. OPEN G1A.3.** Đáng chú ý: đây là gate đầu tiên trong dự án Gate 1
mà việc characterization (viết test đặc tả hành vi hiện tại, không sửa nghiệp vụ) TỰ nó phát hiện
2 lỗ hổng an ninh có thực (thiếu SSRF guard ở `resolveLink()`/`detectFeed()`; thiếu redact PII
trước khi gửi Gemini ở `monitor.js#analyzeBatch()`) — cả hai đã được ghi `green`/`TODO` đúng vai
trò và định tuyến sang `G1B.4`/`W1.AI-POLICY`, không bị sửa lẫn vào lúc viết test (đúng chỉ đạo
"không tranh thủ sửa nghiệp vụ trong characterization").

---

## 2026-08-25 — G1A.3 commit 1/~12: integration test auth + admin (R143,R144,R145,R099-R103)
- Khởi động G1A.3 (integration test mức HTTP cho đủ 145 route) theo kế hoạch chia commit theo
  module, mirroring nhóm view đã có ở `07-route-catalog.md` (auth/admin → partners → people →
  reminders → interactions → reports/bookings/budgets → awards → suppliers → events/dashboard →
  monitor (2 commit) → ai). Chọn auth+admin làm commit đầu vì `fixtures.login()`/`createUser()`
  (hạ tầng G1A.1) phụ thuộc trực tiếp vào các route này — xác nhận đúng hành vi trước khi mọi
  commit sau tái dùng.
- File mới `server/test/integration-auth-admin.test.js`, 28 test, dùng lại đúng harness G1A.1
  (`app-harness`/`db-harness`/`fixtures`/`resource-stack`, pattern gốc ở `smoke.test.js`). Case
  tối thiểu mỗi route: happy/invalid/unauthenticated/forbidden(403 theo RBAC 2-role)/not-found;
  route không có `:id`/body thì bỏ case tương ứng có ghi chú lý do (quy ước mới ghi ở
  `gate1-test-mapping.md`, mục "Quy ước riêng cho dòng route_id").
- 2 CHARACTERIZATION đáng chú ý (test xanh, không sửa hành vi): (1) `PUT`/`DELETE
  /admin/users/:id` với id không tồn tại vẫn trả `200 {ok:true}` — không có 404, chỉ là no-op
  lặng lẽ; (2) `POST /logout` không có middleware `requireAuth` nên gọi không cookie vẫn `200`.
  Không phải lỗ hổng an ninh (không rò dữ liệu), chỉ là gap UX/API-contract — không định tuyến
  sang G1B, giữ nguyên `green` ở G1A.3.
- Mapping `gate1-test-mapping.md`: 8 dòng route chuyển `TODO`→`green` (137 dòng route còn `TODO`).
  Verify đủ: `test:security` 6/6, `test:integration:sqlite` 118 pass+6 skip, `test:integration:mysql`
  123 pass+1 skip, `verify-g0.mjs` + self-test đều PASS, `git diff --check` sạch.
- Chưa gửi Codex audit — theo quy mô ~12 commit của G1A.3, gộp báo cáo sau vài commit thay vì
  từng commit một (khác G1A.2 vốn chỉ 4 commit rồi audit 1 lần).

## 2026-08-25 — G1A.3 commit 2/~12: integration test nhóm "Cơ quan đối tác" (R001-R028)
- File mới `server/test/integration-partners.test.js`, 86 test: assignable-users, organizations
  CRUD, sponsorships, agreements(+upload file), work-logs(+upload file), gifts, benefit-usages,
  association_fees(+remind).
- Phát hiện đáng chú ý (đưa vào G1A.5, KHÔNG sửa ở đây): **lệch hành vi FK giữa SQLite và MySQL**.
  `server/db.js` khai báo cột con bằng cú pháp `INTEGER REFERENCES table(id) ON DELETE CASCADE`;
  SQLite thật sự enforce (nhờ `PRAGMA foreign_keys=ON` ở `db.js:19`) nên insert với `org_id` mồ
  côi bị chặn (`sponsorships` ví dụ). `server/mysql-sync.js#translate()` chỉ đổi `INTEGER`→`BIGINT`
  cho khối `CREATE TABLE`, KHÔNG chuyển cú pháp `REFERENCES` cột thành mệnh đề `FOREIGN KEY` thật
  — MySQL parse rồi bỏ qua reference kiểu này, nên insert mồ côi tương tự vẫn thành công (200) ở
  MySQL. Test `R007` viết driver-aware (`isMysql ? 200 : 400`) để phản ánh đúng thực trạng thay vì
  che giấu bằng cách chỉ chạy 1 driver.
- Xác nhận lại quy tắc hệ thống: NGOẠI TRỪ `GET /partners/:id` (có 404 thật), mọi route CRUD lồng
  cấp-con (sponsorships/agreements/work-logs/gifts/benefit-usages/fees) đều KHÔNG kiểm tồn tại
  trước khi UPDATE/DELETE — id lạ vẫn trả `200 {ok:true}` (no-op lặng lẽ, không lỗi). Đặc tả đúng
  bằng test `CHARACTERIZATION not-found`, không phải bug được che.
- Xác nhận: rbac.js MATRIX cho `pr_staff` đủ quyền `partners: view/create/edit/delete` giống
  `super_admin` — với đúng 2 role hiện có, mọi route thuộc module `partners` KHÔNG có case
  "forbidden" thật (chỉ "unauthenticated"); sẽ bổ sung khi D13 (RBAC v2) lên Wave 1.
- Mapping: 28 dòng route `TODO`→`green` (109 dòng route còn `TODO`). Verify: `test:security` 6/6,
  `test:integration:sqlite` 204 pass+6 skip, `test:integration:mysql` 209 pass+1 skip,
  `verify-g0.mjs` + self-test PASS, `git diff --check` sạch.

## 2026-08-25 — G1A.3 commit 3/~12: integration test nhóm "Nhân sự" (R029-R037)
- File mới `server/test/integration-people.test.js`, 33 test: people CRUD, upload ảnh chân
  dung/giấy tờ tùy thân, đặt ảnh chính, xoá attachment (auto-reassign primary), phục vụ file.
- Đáng chú ý: đây là nhóm ĐẦU TIÊN trong G1A.3 có case "forbidden" THẬT với đúng 2 role hiện có
  (khác partners/awards/... vốn chỉ có "unauthenticated") — nhóm dữ liệu mật `iddoc` (giấy tờ tùy
  thân) gate riêng theo `senGroups(req).has('iddoc')` ở R034 (upload)/R036 (xoá)/R037 (tải file);
  `pr_staff` có `canSeeSensitive=false` nên không có nhóm này khi không override `sensitive_perms`
  — dùng trực tiếp, không cần vai trò giả lập.
- 2 route có 404 thật hiếm gặp trong hệ thống (khác đa số CRUD lồng cấp-con ở commit 2): R035 (PUT
  primary — 404 "Không tìm thấy ảnh" khi aid/kind không khớp) và R036 (DELETE attachment — 404
  "Không tìm thấy" khi aid lạ).
- CHARACTERIZATION: R034 (upload attachment) không kiểm `person_id` có tồn tại trước khi insert —
  upload cho `person_id` không tồn tại vẫn 200.
- Mapping: 9 dòng route `TODO`→`green` (100 dòng route còn `TODO`). Verify: `test:security` 6/6,
  `test:integration:sqlite` 237 pass+6 skip, `test:integration:mysql` 242 pass+1 skip,
  `verify-g0.mjs` + self-test PASS, `git diff --check` sạch.

## 2026-08-25 — G1A.3 commit 4/~12: integration test nhóm "Nhắc việc & thông báo" (R038-R042,R057-R061)
- File mới `server/test/integration-reminders.test.js`, 24 test: important_dates CRUD, danh sách
  nhắc sắp tới, chạy thủ công bộ nhắc (side-effect job nền qua route), notification in-app
  (đọc 1/đọc tất cả), xuất `.ics`.
- **Phát hiện nghiêm trọng — F13 (đăng ký đầy đủ ở `01-audit-findings.md` §D):** viết
  characterization cho `POST /api/reminders/run` (R060) phát hiện `scheduler.js:28` dùng cú pháp
  `WHERE ... (recipient_user_id IS ? OR recipient_user_id=?)` — SQLite chấp nhận `IS ?` như so
  sánh tổng quát, **MySQL không cho `IS` nhận placeholder tham số** → `runOnce()` ném lỗi cú pháp
  SQL (`ER_PARSE_ERROR`) ngay khi có user `notify_opt_in=1` + mốc nhắc đến hạn. Vì
  `scheduler.start()` bọc `try/catch` chỉ `console.error` rồi tiếp tục lịch 6h/lần, lỗi bị nuốt
  hoàn toàn — **production Cloud Run chạy `DB_CLIENT=mysql` nên tính năng nhắc việc/thông báo
  in-app+email nhiều khả năng chưa từng tạo ra bản ghi nào từ lúc deploy**. Route thủ công không
  có `try/catch` riêng nên rơi vào error handler chung (`app.js:35-39`), trả `400` kèm message SQL
  thô ra client. Test R060 viết driver-aware (`isMysql ? 400 : 200`, giống pattern `R007` ở commit
  2) để đặc tả đúng cả 2 nhánh — **KHÔNG sửa `scheduler.js` ở đây**, đúng nguyên tắc không đổi
  nghiệp vụ khi characterization; đề xuất ưu tiên cao hơn các finding F1-F12 vì đang ảnh hưởng
  production thật, không chỉ là rủi ro tiềm ẩn.
- Test R057/R058/R059 (đọc notification) được viết seed trực tiếp `reminder_log` qua `db.prepare`
  thay vì gọi `POST /api/reminders/run`, để đặc tả 3 route này (bản thân không dính F13) độc lập
  với bug của scheduler ở cả 2 driver.
- Xác nhận thêm 2 quy tắc hệ thống đã thấy ở các commit trước vẫn đúng cho nhóm này: `PUT/DELETE
  /api/reminders/:id` và `POST /api/notifications/:id/read` với id lạ đều trả `200 {ok:true}`
  no-op lặng lẽ (không 404); `GET /api/reminders/:id/ics` là route hiếm có 404 thật trong hệ thống.
- Mapping: 10 dòng route `TODO`→`green` (90 dòng route còn `TODO`). Verify: `test:security` 6/6,
  `test:integration:sqlite` 261 pass+6 skip, `test:integration:mysql` 266 pass+1 skip,
  `verify-g0.mjs` + self-test PASS, `git diff --check` sạch.

## 2026-08-25 — G1A.3 commit 5/~12: fix F13 ngay theo yêu cầu owner (chuẩn bị Codex audit)
- Owner yêu cầu sửa luôn F13 (thay vì chờ Wave riêng) trước khi gửi Codex audit gộp các commit
  G1A.3. Khác lệ thường của characterization (chỉ đặc tả, không đổi nghiệp vụ) — đây là ngoại lệ
  có chỉ đạo rõ ràng từ owner cho 1 bug cụ thể đã xác nhận đang ảnh hưởng production.
- Root cause xác nhận lại: cả 2 call site `has.get(...)` trong `scheduler.js` (`:46` in-app,
  `:54` email) luôn truyền `u.id` — một số nguyên thật, KHÔNG BAO GIỜ `null` — nên nhánh
  `recipient_user_id IS ?` chưa từng có tác dụng, chỉ tồn tại làm cú pháp `IS ?` (không hợp lệ
  trên MySQL) chặn toàn bộ hàm. Fix: xoá hẳn nhánh `IS ?`, giữ lại đúng 1 điều kiện
  `recipient_user_id=?` với 1 tham số (bỏ luôn tham số trùng thứ 2 ở cả 2 call site) —
  `server/scheduler.js`.
- Test `server/test/integration-reminders.test.js` (R060, R057-R059) trở lại dạng đơn giản không
  cần driver-aware nữa (bỏ nhánh `isMysql ? 400 : 200` và bỏ cách seed trực tiếp DB cho
  R057-R059) — cả 2 route giờ pass 200 tự nhiên trên SQLite VÀ MySQL bằng đúng luồng HTTP thật
  (`POST /api/reminders/run`), đúng như ý định ban đầu của test.
- Cập nhật `01-audit-findings.md` F13 sang trạng thái ĐÃ FIX + `04-ROADMAP.md` bảng Finding→Wave
  (không còn nằm trong backlog) + `gate1-test-mapping.md` R060 (bỏ ghi chú CHARACTERIZATION).
- Verify: `test:security` 6/6, `test:integration:sqlite` 261 pass+6 skip, `test:integration:mysql`
  266 pass+1 skip, `verify-g0.mjs` + self-test PASS, `git diff --check` sạch. Không route/schema
  nào khác đổi — diff chỉ gồm `scheduler.js` (5 dòng) + test + 4 file memory-bank (bản ghi trước ở
  đây từng nói "3 file" — sai, Codex audit A4 chỉ ra `git show --stat 22dd04d` thực tế là 4 file:
  `01-audit-findings.md`, `04-ROADMAP.md`, `15-changelog.md`, `gate1-test-mapping.md`).

## 2026-08-25 — G1A.3 (không tính vào ~12 commit module): Codex audit F13 + 2 việc không chặn tiến độ
- Codex audit độc lập 2 commit `10a981e`+`22dd04d`: **ACCEPTED cả 2, F13 code CLOSED**, không cần
  vòng remediation riêng. Biên bản đầy đủ trên Desktop user
  (`PR-WORKSTATION-CODEX-G1A3-F13-AUDIT.md`). Kiểm chứng độc lập của Codex khớp với kết quả đã ghi
  ở commit 5: reminders 24/24 cả 2 driver, toàn suite SQLite 261 pass+6 skip, security 6/6, G0
  verifier + diff check sạch; Codex còn tái hiện trực tiếp lỗi cú pháp cũ trên MySQL 8.4 (`SELECT 1
  WHERE 1 IS 1` → `ERROR 1064`) để xác nhận root cause đúng như mô tả. Mapping xác nhận 55/145
  route `green`, 90 `TODO`, G1A.3 vẫn OPEN.
- **2 việc không chặn tiến độ, xử lý ngay trong commit này:**
  1. **Drift thuật ngữ "production" (Codex A4):** `01-audit-findings.md` F13 và bản ghi changelog
     trước gọi Cloud Run hiện tại là "production" — nhưng `13-deployment-runbook.md` §B đã ghi rõ
     (owner xác nhận 2026-08-24): Cloud Run + Cloud SQL hiện tại **CHỈ LÀ MÔI TRƯỜNG TEST**, hạ
     tầng production MISA thật **CHƯA tồn tại**. Đã sửa `01-audit-findings.md` (severity giữ
     `High`, đổi ngữ cảnh "đã ảnh hưởng môi trường test MySQL hiện tại + sẽ chặn production
     tương lai nếu không sửa trước"). Không sửa lại các entry changelog trước đó (giữ nguyên làm
     bản ghi lịch sử đúng với thời điểm viết — sửa số file ở entry ngay trên thay vì viết lại toàn
     bộ đoạn).
  2. **Cách ly `DATA_DIR` cho MySQL integration harness (Codex A3, SHOULD-FIX trước khi đóng
     G1A.3):** `createMysqlTestDb()` (`server/test-support/db-harness.js`) trước đây chỉ cách ly
     database, KHÔNG cách ly `DATA_DIR` như `setupSqliteDb()` đã làm — khi chạy
     `test:integration:mysql` mà quên tự set `DATA_DIR`, mọi test upload (partners/people/...)
     ghi thẳng vào `data/uploads` thật của máy dev. **Xác nhận bằng chứng thật trong session này:**
     tìm thấy 88 file rác (1-16 byte, rõ ràng là fixture test, khác hẳn file thật 173KB có sẵn)
     trong `data/uploads` do các lần chạy `test:integration:mysql` trước khi có fix này — đúng như
     Codex cảnh báo. Fix: `createMysqlTestDb()` giờ tự tạo 1 `DATA_DIR` tạm (giống
     `setupSqliteDb()`) và set `process.env.DATA_DIR` trước khi mở connection tạo database;
     `dropMysqlTestDb()` dọn lại thư mục đó trong `finally`. Dùng 1 biến module-level
     (`activeMysqlDataDir`) vì `node --test` chạy mỗi file test trong 1 process riêng, không có
     rủi ro 2 cặp create/drop chạy đồng thời chung process. Không cần sửa 7 file test đang gọi
     `createMysqlTestDb()`/`dropMysqlTestDb()` — API giữ nguyên chữ ký, chỉ thêm side-effect nội
     bộ.
  - Verify lại: chạy `DB_CLIENT=mysql ALLOW_TEST_DB_CREATE=1 node --test server/test/*.test.js`
    **KHÔNG set `DATA_DIR` thủ công** → 266 pass, 1 skip, 0 fail (trước fix sẽ EPERM/ghi nhầm vào
    `data/uploads` thật). `test:security` 6/6, `test:integration:sqlite` 261 pass+6 skip,
    `verify-g0.mjs` + self-test PASS, `git diff --check` sạch.
  - 88 file rác đã phát hiện trong `data/uploads` (thư mục cục bộ, nằm trong `.gitignore`, không
    phải dữ liệu Git) — CHƯA xoá (lệnh xoá hàng loạt bị chặn bởi permission classifier của harness,
    cần owner tự xác nhận/xoá tay hoặc cấp quyền).

## 2026-08-25 — G1A.3: remediation harness sau Codex re-audit `cefd6b3` (PARTIAL PASS, R1) + dọn 88 file rác
- Codex re-audit độc lập `cefd6b3`: **PARTIAL PASS** — F13 vẫn CLOSED, reminders slice vẫn
  ACCEPTED, không có lỗi sản phẩm mới; nhưng lifecycle `DATA_DIR` của MySQL harness còn 1 blocker
  hẹp (R1, chỉ ở test harness, không phải code sản phẩm). Biên bản đầy đủ trên Desktop user
  (`PR-WORKSTATION-CODEX-CEFD6B3-AUDIT.md`).
- **R1 — Lifecycle `DATA_DIR` MySQL harness:** bản `cefd6b3` tạo `DATA_DIR` NGAY ĐẦU
  `createMysqlTestDb()`, trước mọi bước có thể throw (`assertSafeAppUser`, `bootstrapConfig`,
  `createConnection`, CREATE/GRANT/FLUSH) — nếu bước sau đó lỗi, caller không nhận được `dbName`
  nên không gọi được `dropMysqlTestDb()`, dir bị rò (Codex đo được: chạy lại failure test làm số
  thư mục tmp tăng từ 7 lên 8). Ngoài ra success path xoá dir nhưng không restore
  `process.env.DATA_DIR`, để biến trỏ tới đường dẫn đã xoá.
- Fix theo đúng phương án Codex đề xuất (tách resource độc lập, không giữ state module-level):
  thêm `setupTestDataDir()` trong `server/test-support/db-harness.js` — trả `{dir, teardown}`,
  `teardown()` xoá dir VÀ khôi phục đúng `process.env.DATA_DIR` về giá trị trước đó (hoặc xoá hẳn
  key nếu trước đó chưa từng set, đúng semantics S2 đã áp dụng ở nơi khác trong test-support).
  `createMysqlTestDb()`/`dropMysqlTestDb()` quay lại nguyên bản trước `cefd6b3` (chỉ quản lý
  database, không đụng `DATA_DIR`). `setupSqliteDb()` nay chỉ là alias của `setupTestDataDir()`
  (cùng 1 resource, không có lifecycle database riêng để tách).
- Cập nhật 5 file test đang gọi `createMysqlTestDb()` trong nhánh `if (isMysql)` để tự
  `resources.acquire(dbHarness.setupTestDataDir().teardown)` **TRƯỚC** khi gọi
  `createMysqlTestDb()` — đúng nguyên tắc resource-stack "chỉ dọn đúng những gì đã acquire thành
  công": `integration-auth-admin.test.js`, `integration-partners.test.js`,
  `integration-people.test.js`, `integration-reminders.test.js`, `smoke.test.js`. Không cần sửa
  `smoke-failure.test.js` (2 test ở đó chỉ kiểm lifecycle database, không đụng filesystem/upload).
- Thêm 3 test mới trong `db-harness-failure.test.js` theo đúng yêu cầu Codex ("test cleanup và
  restore environment ở cả success/failure path"): 2 test lifecycle `setupTestDataDir()` thành
  công (khôi phục đúng giá trị `DATA_DIR` trước đó / xoá hẳn key nếu trước đó chưa set), và 1 test
  tái hiện chính xác thí nghiệm Codex đã đo (`GRANT` lỗi qua `MYSQL_USER` không tồn tại) nhưng với
  pattern acquire-trước-khi-tạo-DB mới — xác nhận resource dir KHÔNG rò (`stack.size` giữ nguyên
  qua thất bại, `cleanupAll()` xoá dir thành công).
- Verify: chạy đúng thí nghiệm Codex lặp lại (đếm thư mục `pr-media-test-*` trước/sau
  `db-harness-failure.test.js`) → **không tăng** (trên máy dev lúc verify: 0→0, thư mục
  `os.tmpdir()` sạch sẵn từ đầu; Codex re-audit độc lập trên máy khác đo được 7→7 — cùng kết luận
  cốt lõi "không rò thêm", chỉ khác con số tuyệt đối vì khác trạng thái máy). `test:security` 6/6,
  `test:integration:sqlite` 263 pass+7 skip, MySQL không set `DATA_DIR` tay 269 pass+1 skip,
  `verify-g0.mjs` + self-test PASS, `git diff --check` sạch.
- **R4 — dọn 88 file rác trong `data/uploads`:** theo đúng phương án Codex (KHÔNG xoá theo tiêu
  chí kích thước — 1 trong 5 file cũ prefix `1781862...` cũng chỉ 8 byte, dễ xoá nhầm nếu lọc theo
  size). Xác nhận đúng 88 file có prefix timestamp `>=1787640000000` khớp fixture test (72 file
  `x`, 8 file `noi-dung`, 8 file `noi-dung-pdf-gia`), KHÁC hẳn 5 file cũ (4 JPG 173-544KB + 1 PDF
  8 byte, giữ nguyên không đụng). Đã **MOVE** (không xoá) 88 file vào
  `data/_quarantine-2026-08-25-mysql-test-leak/` kèm `MANIFEST.md` + `FILE-LIST.txt` (danh sách
  đầy đủ tên+size+mtime gốc) — thư mục này nằm trong `data/` (đã `.gitignore`), không phải dữ liệu
  Git, owner tự xoá quarantine sau khi xác nhận không thiếu gì. `data/uploads/` nay chỉ còn đúng 5
  file cũ.
- **Codex re-audit `ab558c7` (2026-08-26) — PASS/CLOSE.** R1 CLOSED (evidence độc lập: failure
  suite 5/5, đếm thư mục `pr-media-test-*` trước/sau toàn suite MySQL trên máy Codex = 7→7, không
  rò thêm). R4 CLOSED (đối chiếu 2 chiều manifest↔filesystem, nội dung 88 file khớp đúng 3 nhóm
  fixture, 5 file cũ giữ nguyên). F13 vẫn CLOSED. Không cần vòng remediation/audit nào thêm cho
  `ab558c7`. Ghi chú 1 doc nit không chặn: bản ghi trước ở đây nói phép đo là "0/0" — con số đó
  chỉ đúng trên máy verify tại thời điểm viết (thư mục tmp sạch sẵn), đã sửa lại thành "không tăng"
  ở đoạn phía trên để không phụ thuộc trạng thái máy. Biên bản đầy đủ trên Desktop user
  (`PR-WORKSTATION-CODEX-AB558C7-CLOSE.md`). **G1A.3 tiếp tục — chuyển sang commit nhóm
  interactions (R043-R045).**

## 2026-08-26 — G1A.3 commit 8/~12: integration test nhóm "Lịch sử tương tác" (R043-R045)
- File mới `server/test/integration-interactions.test.js`, 10 test: tìm nhanh nhân sự+cơ quan
  (`GET /entities/search`), danh sách tương tác phân trang+filter (`GET /interactions`), tạo
  tương tác (`POST /interactions`).
- Không phát hiện lệch hành vi driver nào ở nhóm này (khác commit 2/6) — cả 10 test pass đồng
  nhất trên SQLite lẫn MySQL.
- CHARACTERIZATION đáng chú ý: `POST /interactions` không validate `partner_type`/`partner_id` —
  `partner_type` lạ tự động về `'person'`, `partner_id` thiếu tự về `0`, không lỗi; nhưng `date`
  (cột `NOT NULL` không có `DEFAULT`) thiếu thì `buildInsert()` ném lỗi ràng buộc DB thẳng ra
  ngoài, rơi vào error handler chung → `400` (không có check tường minh `if (!data.date)` như
  reminders — khác cơ chế nhưng cùng kết quả HTTP). `GET /entities/search` không có case "invalid"
  thật: `q` rỗng chỉ khớp `LIKE '%%'`, trả tối đa 10+10 kết quả bất kỳ, không lỗi.
- Cả 2 role hiện có (`super_admin`/`pr_staff`) đều full quyền `interactions` (giống `partners`) —
  không có case "forbidden" thật ở nhóm này.
- Mapping: 3 dòng route `TODO`→`green` (87 dòng route còn `TODO`). Verify: `test:security` 6/6,
  `test:integration:sqlite` 273 pass+7 skip, `test:integration:mysql` 279 pass+1 skip,
  `verify-g0.mjs` + self-test PASS, `git diff --check` sạch.

## 2026-08-26 — Owner duyệt Fast-track protocol Claude ↔ Codex
- Thêm `CLAUDE.md` ở root để Claude Code luôn được dẫn tới quy trình bắt buộc, và thêm
  `17-fast-track-collaboration.md` làm nguồn sự thật cho cách phối hợp từ phần còn lại của G1A.3:
  bàn giao theo batch thay vì từng commit, chốt Batch Contract trước code, Evidence Bundle trước
  audit, Codex audit theo rủi ro và chỉ P0/P1 hoặc exit criterion chưa đạt mới giữ gate.
- Tốc độ được cải thiện bằng targeted test trong các commit trung gian và full regression đúng một
  lần trước handoff; không bỏ full regression, không hạ chuẩn security/resilience. P2/P3 đi backlog
  thay vì mở remediation riêng. Phân công hiện tại được ghi rõ: Claude phụ trách backend/kiến
  trúc/test, Codex phụ trách UI/MDS theo quyết định owner.
- Cập nhật mục lục `memory-bank/README.md` và neo quy tắc từ `16-coding-rules.md` §C. Đây là thay đổi
  tài liệu/process thuần, không tác động code/test contract; verify bằng `verify-g0.mjs` (0 broken
  link, toàn bộ check PASS) và `git diff --check` sạch.

## 2026-08-26 — G1A.3 Batch "reports-awards" (21 route) — batch đầu tiên theo fast-track protocol

**Batch Contract**
```
Batch-ID: reports-awards
Goal: characterization HTTP cho nhóm bookings/budgets/reports/awards
In scope: R046-R056 (bookings, budgets, reports), R062-R071 (awards + participations + files + remind)
Out of scope: suppliers/events/monitor/ai (batch sau); F12 (event_id mismatch, đã đăng ký riêng)
Behavior mode: characterization (trừ P0/P1 phát sinh giữa batch, xử lý như F13)
Risk hotspots: org_fee write-gap F1 (R047/R048/R051/R064/R065/R067/R068 — đã biết, không sửa),
  file delete vật lý (R066), file upload ≤8 (R070), RBAC-forbidden thật đầu tiên ở reports (R050-R056,
  pr_staff MATRIX.reports=[])
Required tests: happy + invalid + unauthenticated + not-found + forbidden (khi áp dụng) mỗi route
Allowed known-red/TODO: không có known-red mới; F15 (FK MySQL) ghi backlog P2, owner=Claude, wave=Wave 1
Exit criteria: 21/21 route green trong mapping; full regression cả 2 driver + security + verifier PASS
Expected commit range/count: 3 commit độc lập (bookings-budgets / reports+F14 / awards)
```

- **Commit 1** (`f40be9c`) — bookings+budgets (R046-R051), 19 test. `POST /budgets` dùng
  `ON CONFLICT` (đã có bản dịch MySQL sẵn ở `mysql-sync.js`, không phải bug mới). Bổ sung case
  forbidden đầu tiên cho `pr_staff` (MATRIX.reports=[]).
- **Commit 2** (`119f81a`) — reports (R052-R056), 17 test. **Phát hiện + fix ngay F14**: `grandTotal`
  (`routes.js:752` cũ) cộng trực tiếp 3 giá trị `SELECT SUM(...)`; `mysql2` trả `SUM()` dạng string
  (DECIMAL) trong khi `better-sqlite3` trả number → `+` nối chuỗi thay vì cộng số trên MySQL, sai
  lệch âm thầm tổng tiền hiển thị cho lãnh đạo (không ném lỗi, khác F13). Owner duyệt fix ngay cùng
  cơ chế F13 — bọc `Number()` quanh 4 giá trị SUM tại điểm đọc query. Xem `01-audit-findings.md` F14.
- **Commit 3** (`c0270a1`) — awards CRUD + participations + files + remind (R062-R071), 33 test.
  **Phát hiện F15** (P2, backlog, KHÔNG sửa — đúng scope-freeze batch): FK
  `award_participations.award_id` chỉ SQLite thực thi (insert award_id không tồn tại → 400), MySQL
  không thực thi (→ 200, participation mồ côi). Test R067 characterize đúng cả 2 driver bằng nhánh
  `isMysql`. Xem `01-audit-findings.md` F15.

**Evidence Bundle**
```
Batch-ID / commit range / HEAD: reports-awards / f40be9c^..c0270a1 / c0270a1
Contract result: 21/21 route exit criterion PASS — mapping 79/145 green (66 TODO), 0 known-red sai nghĩa
Changed files: product: server/routes.js (F14 fix, 4 dòng); test: 3 file mới
  (integration-bookings-budgets/integration-reports/integration-awards.test.js, 69 test);
  docs: 01-audit-findings.md (F14+F15), gate1-test-mapping.md (21 dòng TODO->green), 04-ROADMAP.md
Route-job-rule mapping delta: R046-R056, R062-R071 TODO -> green
Behavior changes: có — F14 fix tại routes.js:699,701,740,745 (Number() quanh 4 giá trị SUM),
  không đổi business logic/contract nào khác
Tests added/changed: 69 test HTTP mới (19+17+33), 0 test cũ bị sửa
Commands and exact results:
  npm run test:integration:sqlite -> 342 pass, 7 skip, 0 fail
  npm run test:integration:mysql (ALLOW_TEST_DB_CREATE=1) -> 348 pass, 1 skip, 0 fail
  npm run test:security -> 6 pass, 0 fail
  node scripts/verify-g0.mjs -> PASS toàn bộ 7 check (route catalog, auth matrix, UI-flow,
    Gemini inventory, schema facts, error contract, 0 broken link)
  git diff --check (toàn batch) -> sạch
Known-red/TODO: 66 route TODO còn lại thuộc batch sau (suppliers/events/monitor/ai), đều có wave
  đích trong 04-ROADMAP.md; F15 backlog P2 owner=Claude wave=Wave 1, expiry=khi root-cause xong
Out-of-scope findings/backlog: F15 (chi tiết trên)
Rollback path: revert 3 commit độc lập theo thứ tự ngược (c0270a1 -> 119f81a -> f40be9c); F14 fix
  tách riêng khỏi test nên có thể revert riêng nếu cần
Worktree status and unrelated pre-existing changes: sạch, chỉ `.DS_Store` không liên quan (không track)
```

**READY FOR ONE-SHOT AUDIT — Batch reports-awards, commits f40be9c^..c0270a1**
Contract: PASS 21/21 exit criteria
Tests: targeted từng commit đã pass lúc code; full MySQL 348 pass/1 skip; full SQLite 342 pass/7 skip;
  security 6/6; verify-g0.mjs PASS
Hotspots: F14 (money aggregate type, đã fix), RBAC-forbidden mới (reports), file delete/upload (awards)
Known gaps/backlog: F15 (FK MySQL không thực thi, P2, Wave 1)
Evidence Bundle: mục này (`15-changelog.md`, entry 2026-08-26 "Batch reports-awards")

**Codex ONE-SHOT AUDIT — Decision: ACCEPTED WITH BACKLOG**
- Không P0/P1. 21/21 route được chấp nhận. F14 CLOSED (Codex xác nhận độc lập root cause mysql2
  trả `SUM()` string + bản sửa cộng đúng). Focused audit: SQLite 69/69, MySQL 69/69, security 6/6,
  verifier PASS. Không cần remediation hay re-audit batch này.
- **F15 mở rộng theo Codex** (vẫn P2, nhưng phạm vi lớn hơn ghi nhận ban đầu): MySQL không chỉ cho
  tạo `award_participations` mồ côi khi `award_id` không tồn tại — **xoá `awards` cũng KHÔNG cascade
  xoá `award_participations` liên quan trên MySQL** (dù schema khai `ON DELETE CASCADE`), để lại
  participation mồ côi vĩnh viễn thay vì chỉ tạm thời lúc insert sai. Wave 1 phải inventory FK toàn
  schema (không chỉ bảng này) và sửa root cause tại tầng DB/migration, **không phải thêm `if` kiểm
  tồn tại thủ công ở từng route** (route-level check chỉ vá triệu chứng, không đồng bộ hành vi 2
  driver cho các quan hệ FK khác chưa được kiểm). Đã cập nhật `01-audit-findings.md` F15.
- Doc nit không chặn (đã sửa trong bản này): commit range dùng `f40be9c^..c0270a1` (inclusive từ
  commit đầu) thay vì `f40be9c..c0270a1` (loại mất `f40be9c`).
- Báo cáo đầy đủ: `PR-WORKSTATION-CODEX-REPORTS-AWARDS-ONE-SHOT-AUDIT.md` (owner giữ ngoài repo).
- **Batch reports-awards CLOSED. G1A.3 tiếp tục sang batch kế tiếp** (suppliers R072-R086, theo kế
  hoạch ở `04-ROADMAP.md`).

## 2026-08-26 — G1A.3 Batch "suppliers" (15 route)

**Batch Contract**
```
Batch-ID: suppliers
Goal: characterization HTTP cho nhóm nhà cung cấp
In scope: R072-R086 (suppliers CRUD, contacts, transactions, quotes, file upload)
Out of scope: events/dashboard/monitor/ai (batch sau)
Behavior mode: characterization
Risk hotspots: org_fee write-gap F1 (R078/R079/R084 — đã biết, không sửa), file delete vật lý
  (R083), file upload không kiểm files.length (R086, khác R034/R070), F15 (FK MySQL) — dự kiến chạm
  lại đúng pattern đã biết ở supplier_quotes/supplier_transactions/supplier_contacts, không phải mở
  rộng điều tra mới
Required tests: happy + invalid + unauthenticated + not-found mỗi route (không có case forbidden
  thật — cả 2 role full CRUD suppliers, giống bookings/partners/interactions/awards)
Allowed known-red/TODO: không có known-red mới; F15 evidence bổ sung ghi vào finding đã có, không
  tạo finding mới trùng lặp
Exit criteria: 15/15 route green trong mapping; full regression cả 2 driver + security + verifier PASS
Expected commit range/count: 1 commit
```

- **Commit** (`21fffc3`) — suppliers CRUD + contacts + transactions + quotes + files (R072-R086),
  43 test. Phát hiện R086 KHÔNG kiểm `files.length` (khác R034 people/R070 awards) — 0 file vẫn
  200, ghi CHARACTERIZATION, không sửa (đúng behavior mode batch).
  Xác nhận thêm bằng chứng cho **F15** đã biết (không phải phát hiện mới, chỉ đo lại đúng phạm vi
  Codex đã cảnh báo khi routes trong batch này tình cờ chạm cùng pattern FK): R075
  `supplier_contacts.supplier_id` không tồn tại → SQLite 400/MySQL 200; R083 xoá supplier có
  quotes/transactions/contacts liên quan → SQLite cascade đúng, MySQL để lại cả 3 bảng con mồ côi
  (xác nhận bằng query trực tiếp qua `db` sau khi cha đã xoá, không chỉ suy luận qua response HTTP).
  Xem `01-audit-findings.md` F15 (đã cập nhật, không tạo F16 trùng).

**Evidence Bundle**
```
Batch-ID / commit range / HEAD: suppliers / 21fffc3^..350982e / 350982e (test tại 21fffc3, doc sync tại 350982e — HEAD thực tế lúc gửi audit là 350982e, đã sửa theo Codex nêu)
Contract result: 15/15 route exit criterion PASS — mapping 94/145 green (51 TODO), 0 known-red sai nghĩa
Changed files: product: không có; test: 1 file mới (integration-suppliers.test.js, 43 test);
  docs: 01-audit-findings.md (F15 bổ sung evidence), gate1-test-mapping.md (15 dòng TODO->green),
  04-ROADMAP.md
Route-job-rule mapping delta: R072-R086 TODO -> green
Behavior changes: không — batch thuần characterization, không sửa product code
Tests added/changed: 43 test HTTP mới, 0 test cũ bị sửa
Commands and exact results:
  npm run test:integration:sqlite -> 385 pass, 7 skip, 0 fail
  npm run test:integration:mysql (ALLOW_TEST_DB_CREATE=1) -> 391 pass, 1 skip, 0 fail
  npm run test:security -> 6 pass, 0 fail
  node scripts/verify-g0.mjs -> PASS toàn bộ 7 check
  git diff --check (toàn batch) -> sạch
Known-red/TODO: 51 route TODO còn lại thuộc batch sau (events/monitor/ai), đều có wave đích trong
  04-ROADMAP.md; F15 vẫn P2/Wave 1/owner=Claude, evidence mở rộng nhưng không đổi severity
Out-of-scope findings/backlog: không có finding mới ngoài F15 evidence bổ sung
Rollback path: revert 1 commit (21fffc3), không có product code để rollback riêng
Worktree status and unrelated pre-existing changes: sạch, chỉ `.DS_Store` không liên quan (không track)
```

**READY FOR ONE-SHOT AUDIT — Batch suppliers, commit 21fffc3^..350982e**
Contract: PASS 15/15 exit criteria
Tests: targeted lúc code đã pass; full MySQL 391 pass/1 skip; full SQLite 385 pass/7 skip; security
  6/6; verify-g0.mjs PASS
Hotspots: file upload không kiểm files.length rỗng (R086, characterization, không sửa), F15 evidence
  bổ sung (không đổi severity/scope, chỉ củng cố phạm vi đã biết)
Known gaps/backlog: F15 (không đổi — vẫn P2/Wave 1, evidence mở rộng sang suppliers)
Evidence Bundle: mục này (`15-changelog.md`, entry 2026-08-26 "Batch suppliers")

**Codex ONE-SHOT AUDIT — Decision: ACCEPTED WITH BACKLOG**
- Không P0/P1. 15/15 route R072-R086 đạt characterization. Focused audit: SQLite 43/43, MySQL
  43/43. Mapping chính xác 94/145 green, 51 TODO. Không có product code thay đổi. Không cần
  remediation hay re-audit; tiếp tục batch kế tiếp.
- **F15 được củng cố đúng theo Codex:** MySQL không cascade ở ít nhất 4 quan hệ FK (đã xác nhận qua
  `award_participations`, `supplier_quotes`, `supplier_transactions`, `supplier_contacts`) — đủ bằng
  chứng để coi đây là vấn đề tầng DDL/migration MySQL, không phải ngẫu nhiên 1-2 bảng. Wave 1 phải
  inventory FK toàn schema và sửa migration/DDL tập trung (không phải vá từng route). Đã cập nhật
  `01-audit-findings.md` F15 từ "chưa root-cause" thành "đã có bằng chứng mạnh tại tầng DDL/migration,
  chờ inventory toàn schema" theo đúng gợi ý Codex.
- Doc nit đã sửa trong bản này: HEAD thực tế lúc audit là `350982e` (doc sync), không phải `21fffc3`
  (chỉ commit test) — commit range/HEAD ở Evidence Bundle trên đã cập nhật.
- Báo cáo đầy đủ: `PR-WORKSTATION-CODEX-SUPPLIERS-ONE-SHOT-AUDIT.md` (owner giữ ngoài repo).
- **Batch suppliers CLOSED. G1A.3 tiếp tục sang batch kế tiếp** (events+dashboard R087-R098).

## 2026-08-26 — G1A.3 Batch "events-dashboard" (12 route)

**Batch Contract**
```
Batch-ID: events-dashboard
Goal: characterization HTTP cho nhóm sự kiện + dashboard tổng hợp
In scope: R087-R098 (events CRUD, event_costs, file upload, remind, press-overview, dashboard)
Out of scope: monitor/ai (batch sau); R099-R103 admin đã green từ trước, không thuộc batch này
Behavior mode: characterization (trừ P0/P1 cùng root cause đã owner duyệt trước — xử lý như F14/F16)
Risk hotspots: org_fee write-gap F1 (R092/R093 — đã biết, không sửa), file delete vật lý (R091),
  file upload kind từ query không whitelist (F9, R095), F15 (FK MySQL, dự kiến chạm event_costs),
  SUM() aggregate type trên MySQL (F14-style, dashboard có nhiều SUM/COUNT tổng hợp — hotspot mới
  xác định ngay trong lúc đọc code trước khi viết test)
Required tests: happy + invalid + unauthenticated + not-found mỗi route (không có forbidden thật —
  cả 2 role full CRUD events, R098 dashboard chỉ requireAuth không requirePerm module)
Allowed known-red/TODO: không có known-red mới
Exit criteria: 12/12 route green; full regression cả 2 driver + security + verifier PASS
Expected commit range/count: 1 commit (test + fix P0/P1 cùng root cause đã duyệt, nếu phát sinh)
```

- **Commit** (`8baa28d`) — events CRUD + costs + files + remind, press-overview, dashboard
  (R087-R098), 42 test HTTP. **Phát hiện + fix ngay F16** (cùng root cause F14, không hỏi lại
  owner lần 3): `total_cost` (`GET /api/events`, correlated `SUM()` subquery) và
  `overview.events.keynoteMonth` + `charts.assocActivityMonthly` (`GET /api/dashboard`) trả string
  trên MySQL do cùng cơ chế mysql2 SUM()→DECIMAL→string. `assocActivityMonthly` là ca khó nhất: bug
  chỉ lộ khi GROUP BY sinh dòng khớp thật (có dữ liệu tương tác/tài trợ hiệp hội đúng tháng/năm hiện
  tại) — môi trường test trống dữ liệu che giấu bug hoàn toàn; test mới chủ động seed dữ liệu để lộ
  đúng nhánh. Sửa tận gốc 3 helper dùng chung ở dashboard (`one`/`grouped`/`monthly`) bằng `Number()`
  bọc quanh — phòng ngừa cả field hiện đang an toàn (COUNT()) nếu sau này đổi sang SUM(). Xem
  `01-audit-findings.md` F16.
- Xác nhận thêm bằng chứng F15 (R091): xoá `events` có `event_costs` liên quan — SQLite cascade
  đúng, MySQL để lại mồ côi. Nâng tổng số quan hệ FK đã xác nhận lỗi lên 5.
- Phát hiện F9 tái xuất hiện dạng khác ở R095 (`kind` từ query string không whitelist, cắt 40 ký
  tự) — đã có trong `07-route-catalog.md`, không phải finding mới, chỉ characterize lại đúng route.

**Evidence Bundle**
```
Batch-ID / commit range / HEAD: events-dashboard / 8baa28d^..8baa28d / 8baa28d
Contract result: 12/12 route exit criterion PASS — mapping 106/145 green (39 TODO), 0 known-red sai nghĩa
Changed files: product: server/routes.js (F16 fix, 5 chỗ: total_cost + 3 helper + keynoteMonth);
  test: 1 file mới (integration-events-dashboard.test.js, 42 test);
  docs: 01-audit-findings.md (F16 mới + F15 bổ sung), gate1-test-mapping.md (12 dòng TODO->green)
Route-job-rule mapping delta: R087-R098 TODO -> green
Behavior changes: có — F16 fix tại routes.js (total_cost, one/grouped/monthly helper, keynoteMonth),
  không đổi business logic/contract nào khác (chỉ sửa type, giá trị số không đổi)
Tests added/changed: 42 test HTTP mới, 0 test cũ bị sửa
Commands and exact results:
  npm run test:integration:sqlite -> 427 pass, 7 skip, 0 fail
  npm run test:integration:mysql (ALLOW_TEST_DB_CREATE=1) -> 433 pass, 1 skip, 0 fail
  npm run test:security -> 6 pass, 0 fail
  node scripts/verify-g0.mjs -> PASS toàn bộ 7 check
  git diff --check (toàn batch) -> sạch
Known-red/TODO: 39 route TODO còn lại thuộc batch sau (monitor/ai), đều có wave đích trong
  04-ROADMAP.md; F15 vẫn P2/Wave 1/owner=Claude, evidence mở rộng lên 5 quan hệ FK
Out-of-scope findings/backlog: không có finding mới ngoài F16 (đã fix trong batch) và F15 evidence
Rollback path: revert 1 commit (8baa28d); F16 fix nằm trong cùng commit với test, không tách riêng
  được nhưng có thể cherry-pick ngược nếu cần giữ lại phần test
Worktree status and unrelated pre-existing changes: sạch, chỉ `.DS_Store` không liên quan (không track)
```

**READY FOR ONE-SHOT AUDIT — Batch events-dashboard, commit 8baa28d^..8baa28d**
Contract: PASS 12/12 exit criteria
Tests: targeted lúc code đã pass; full MySQL 433 pass/1 skip; full SQLite 427 pass/7 skip; security
  6/6; verify-g0.mjs PASS
Hotspots: F16 (SUM() type trên MySQL, cùng root cause F14, đã fix + test seed dữ liệu để không bỏ
  sót ca ẩn), F15 evidence bổ sung (event_costs, không đổi severity), F9 tái xuất hiện dạng khác (đã
  có sẵn trong route-catalog, không phải finding mới)
Known gaps/backlog: F15 (không đổi — vẫn P2/Wave 1, evidence mở rộng lên 5 quan hệ FK)
Evidence Bundle: mục này (`15-changelog.md`, entry 2026-08-26 "Batch events-dashboard")

**Auditor ONE-SHOT AUDIT (ChatGPT thay Codex CLI hết token, cùng vai trò/luồng làm việc, xem
[[pr-workstation-fasttrack-branch-push]]) — Decision: ACCEPT — PASS WITH 1 MINOR TEST ISSUE**
- F16 fix ĐÚNG hướng: chuẩn hoá tại tầng helper dùng chung (`one`/`grouped`/`monthly`) tốt hơn chỉ
  vá field đang lỗi, vì tự động bảo vệ cả các aggregate tương lai nếu đổi từ `COUNT()` sang `SUM()`.
  Giữ nguyên (KEEP), không rollback.
- Test regression `assocActivityMonthly` được đánh giá thiết kế tốt: tránh false-green khi dataset
  rỗng bằng cách chủ động seed dữ liệu khớp tháng hiện tại thay vì dựa vào giá trị mặc định 0.
- F15 evidence đáng tin cậy, đủ để coi là **vấn đề hệ thống ở tầng schema/migration MySQL** (5 quan
  hệ FK: `award_participations`, `supplier_quotes`, `supplier_transactions`, `supplier_contacts`,
  `event_costs`). Xác nhận lại yêu cầu Wave 1: **không** sửa bằng cách thêm DELETE thủ công dọn dẹp
  từng route (`DELETE FROM event_costs WHERE event_id=?` trước `DELETE FROM events...`) làm giải
  pháp chính — phải inventory FK toàn schema, so sánh SQLite vs MySQL schema thật, kiểm MySQL có tạo
  constraint hay không, root-cause + sửa tại tầng migration, rồi thêm test xác minh schema-level.
- `GET /api/dashboard` xác nhận vẫn có `router.use(requireAuth)` bảo vệ dù route không khai
  `requirePerm` module — không có regression lộ public-access.
- **Finding D (Low, đã sửa trong bản này):** test R098 seed `assocActivityMonthly` dùng mốc giờ UTC
  (`new Date().toISOString()`) trong khi production tính "tháng hiện tại" theo giờ Hà Nội GMT+7
  (`new Date(Date.now() + 7*3600*1000)`, `routes.js`) — gần nửa đêm VN 2 mốc có thể lệch ngày/tháng,
  khiến test flaky dù code sản phẩm đúng. Đã sửa test dùng cùng mốc `hanoiNow` như production. Không
  chặn batch (non-blocking), sửa ngay theo đúng khuyến nghị "Must do" của audit.
- Audit note: GitHub không có commit status/check cho SHA này nên auditor không tự chạy lại được
  full regression qua CI, chỉ xác nhận qua đọc code + số liệu Claude báo cáo — không phải batch fail,
  chỉ là giới hạn evidence, không cần xử lý thêm.
- **Batch events-dashboard CLOSED (ACCEPT). G1A.3 tiếp tục sang batch kế tiếp** (monitor phần 1
  R104-R120).

---

## Batch monitor phần 1 (2026-08-26)

```
Batch-ID / commit range / HEAD: monitor-1 / 0bf0f5f^..0bf0f5f / 0bf0f5f
Contract result: 17/17 route exit criterion PASS — mapping 123/145 green (22 TODO), 0 known-red sai nghĩa
Changed files: product: server/db.js (F17 fix: cột sources.mode VARCHAR(20) + add() log lỗi thay vì nuốt);
  test: 1 file mới (integration-monitor-1.test.js, 47 test);
  docs: 01-audit-findings.md (F17 mới), 04-ROADMAP.md (G1A.3 + bảng F-tracking), gate1-test-mapping.md (17 dòng TODO->green)
Route-job-rule mapping delta: R104-R120 TODO -> green
Behavior changes: có — F17 fix tại db.js (kiểu cột sources.mode đổi TEXT->VARCHAR(20),
  helper add() log lỗi không phải "đã tồn tại"); không đổi business logic/contract nào khác
Tests added/changed: 47 test HTTP mới, 0 test cũ bị sửa
Commands and exact results:
  npm run test:integration:sqlite -> 474 pass, 7 skip, 0 fail
  npm run test:integration:mysql (ALLOW_TEST_DB_CREATE=1) -> 480 pass, 1 skip, 0 fail
  npm run test:security -> 6 pass, 0 fail
  node scripts/verify-g0.mjs -> PASS toàn bộ 7 check
Known-red/TODO: 22 route TODO còn lại (monitor phần 2 + ai), đều có wave đích trong 04-ROADMAP.md;
  F15 không đổi (P2/Wave 1/owner=Claude, 5 quan hệ FK)
Out-of-scope findings/backlog: không có finding mới ngoài F17 (đã fix trong batch)
Rollback path: revert 1 commit (0bf0f5f); F17 fix nằm trong cùng commit với test, có thể cherry-pick
  ngược riêng phần server/db.js nếu cần giữ lại test
Worktree status and unrelated pre-existing changes: sạch, chỉ `.DS_Store` không liên quan (không track)
```

**READY FOR ONE-SHOT AUDIT — Batch monitor phần 1, commit 0bf0f5f^..0bf0f5f**
Contract: PASS 17/17 exit criteria
Tests: targeted lúc code đã pass; full MySQL 480 pass/1 skip; full SQLite 474 pass/7 skip; security
  6/6; verify-g0.mjs PASS
Hotspots: F17 (cột `sources.mode` không tồn tại trên MySQL do ALTER TABLE TEXT DEFAULT fail âm thầm,
  khiến POST /monitor/scan trả 500 trên MỌI lượt quét thật trên MySQL — đã fix tận gốc: đổi kiểu cột
  + sửa migrate() không còn nuốt lỗi im lặng), R110 network-isolation (tắt sources + scan_queries
  include rỗng để characterize an toàn, không gọi RSS/Gemini thật)
Known gaps/backlog: F15 (không đổi — vẫn P2/Wave 1, evidence mở rộng lên 5 quan hệ FK, chưa chạm
  trong batch này vì nhóm monitor không có quan hệ FK cascade liên quan)
Evidence Bundle: mục này (`15-changelog.md`, entry 2026-08-26 "Batch monitor phần 1")

**Auditor ONE-SHOT AUDIT (ChatGPT, cùng vai trò/luồng làm việc, xem
[[pr-workstation-fasttrack-branch-push]]) — Decision: ACCEPT WITH 1 MEDIUM HARDENING ISSUE**
- F17 diagnosis/fix/test: PASS, KEEP nguyên (`VARCHAR(20)` đúng hướng cho field enum-like `rss`/`site`,
  tương thích MySQL tốt hơn `TEXT`; test R110 xác nhận thực sự bắt được missing-column dù đã tắt
  network — network isolation không che giấu bug).
- **Finding D (Medium, REQUIRED FOLLOW-UP):** helper `add()` sau fix F17 chỉ `console.error()` lỗi lạ
  rồi vẫn tiếp tục migrate/boot — audit chỉ rõ đây **vẫn cùng class failure đã gây F17**, chỉ khác là
  nay có log thay vì im lặng hoàn toàn; app vẫn có thể chạy với schema thiếu, route liên quan mới fail
  sau đó lúc request thật tới. Acceptance criterion: lỗi migration syntax/type/permission/connection
  phải làm app init fail, không được boot với schema chưa hoàn chỉnh.
- **Finding E (Low, RECOMMENDED):** nên thêm `mode VARCHAR(20) NOT NULL DEFAULT 'rss'` trực tiếp vào
  canonical `CREATE TABLE sources` (không chỉ dựa migration `ALTER TABLE`), giữ migration cho DB cũ.
- Must do: rethrow mọi migration error không thuộc duplicate/idempotency case; must not do: không quay
  lại nuốt toàn bộ lỗi, không bỏ migration backward-compat chỉ vì fresh schema đã có `mode`.
- **Remediation đã thực hiện ngay (commit `e684918`, cùng phiên, không hỏi lại vì đây là bug hardening
  rõ ràng theo đúng tiền lệ F13/F14/F16/F17):**
  - `add()` rethrow mọi lỗi không phải duplicate column/already exists — fail-fast thật thay vì chỉ log.
  - Tách `isIgnorableMigrationError()` thành hàm thuần, export từ `db.js` để test được logic phân loại
    mà không cần re-run `migrate()` thật (đúng gợi ý audit "extract riêng helper để test").
  - Thêm `mode VARCHAR(20) NOT NULL DEFAULT 'rss'` vào canonical `CREATE TABLE sources`, giữ nguyên
    `ALTER TABLE` cho DB cũ — xác nhận bằng script tạo DB mới hoàn toàn, `PRAGMA table_info(sources)`
    đã có cột `mode` ngay từ `init()`, không cần qua `migrate()`.
  - Test mới `BR-VAL-041/042` (`server/test/unit-validation-formatter.test.js`): `isIgnorableMigrationError()`
    nhận đúng message duplicate của cả SQLite/MySQL, trả `false` cho lỗi lạ; `migrate()` thật xác nhận
    ALTER trùng cột không throw còn ALTER cú pháp sai vẫn throw ra ngoài.
  - Đã rà toàn bộ dòng `add("ALTER TABLE ...")` khác trong `migrate()` — không còn pattern `TEXT+DEFAULT`
    nào khác, rethrow không phá vỡ migration hiện có nào.
  - Regression sau remediation: SQLite 477 pass/7 skip, MySQL 483 pass/1 skip, security 6/6,
    `verify-g0.mjs` PASS — không hồi quy.
- **Batch monitor phần 1 CLOSED (ACCEPT, hardening issue đã remediate cùng phiên). G1A.3 tiếp tục sang
  batch monitor phần 2 (R121-R135).**

---

## Batch monitor phần 2 (2026-08-26)

```
Batch-ID / commit range / HEAD: monitor-2 / 13501da^..13501da / 13501da
Contract result: 15/15 route exit criterion PASS — mapping 138/145 green (7 TODO), 0 known-red sai nghĩa
Changed files: product: không có (batch này không sửa product code, chỉ characterize);
  test: 1 file mới (integration-monitor-2.test.js, 41 test);
  docs: gate1-test-mapping.md (15 dòng TODO->green)
Route-job-rule mapping delta: R121-R135 TODO -> green
Behavior changes: không có — chỉ characterization, không sửa business logic
Tests added/changed: 41 test HTTP mới, 0 test cũ bị sửa
Commands and exact results:
  npm run test:integration:sqlite -> 518 pass, 7 skip, 0 fail
  npm run test:integration:mysql (ALLOW_TEST_DB_CREATE=1) -> 524 pass, 1 skip, 0 fail
  npm run test:security -> 6 pass, 0 fail
  node scripts/verify-g0.mjs -> PASS toàn bộ 7 check
Known-red/TODO: 7 route TODO còn lại (batch "ai" R136-R142, batch cuối cùng của G1A.3); F15 không đổi
Out-of-scope findings/backlog: không có finding mới trong batch này (F3 SSRF ở R122 đã ghi sẵn trong
  route-catalog từ trước, KHÔNG phải phát hiện mới — chỉ đo đúng hành vi hiện có, không sửa)
Rollback path: revert 1 commit (13501da), không ảnh hưởng product code
Worktree status and unrelated pre-existing changes: sạch, chỉ `.DS_Store` không liên quan (không track)
```

**READY FOR ONE-SHOT AUDIT — Batch monitor phần 2, commit 13501da^..13501da**
Contract: PASS 15/15 exit criteria
Tests: targeted lúc code đã pass; full MySQL 524 pass/1 skip; full SQLite 518 pass/7 skip; security
  6/6; verify-g0.mjs PASS
Hotspots: R122 network-safety (POST /monitor/sources gọi detectFeed() -> fetch() thật không
  allowlist host — F3 SSRF đã biết, characterize bằng URL loopback cổng đóng để không gọi Internet
  thật, không sửa), R135 tái dùng cơ chế an toàn Gemini đã xác nhận ở batch monitor phần 1
  (R112/R113: thiếu GEMINI_API_KEY throw trước khi gọi mạng)
Known gaps/backlog: F15 (không đổi — vẫn P2/Wave 1); F3 SSRF (không đổi — vẫn ghi trong route-catalog,
  không thuộc phạm vi characterization G1A.3, cần guard thật ở G1B.4 cùng nhóm BR-SSRF-016)
Evidence Bundle: mục này (`15-changelog.md`, entry 2026-08-26 "Batch monitor phần 2")

**Batch monitor phần 2 KHÔNG phát hiện bug production mới** (khác 2 batch monitor phần 1/
events-dashboard trước liên tiếp có F16/F17) — batch "sạch" thuần characterization. Sau batch này
G1A.3 chỉ còn đúng 1 batch cuối: "ai" (R136-R142, 7 route).

---

## Audit-closure bundle: monitor phần 2 + ai + F18 (2026-08-26)

> Theo amendment §14 `17-fast-track-collaboration.md` (owner approved 2026-08-26): "monitor-2"
> (R121-R135) và "ai" (R136-R142) là **1 audit-closure bundle** — audit một lần trên toàn range,
> không review xen giữa các commit. F18 (phát hiện lúc kiểm tra tính đầy đủ trước khi đóng route
> mapping, không thuộc phạm vi ban đầu của batch "ai") được gộp vào cùng bundle này thay vì mở
> audit riêng, theo đúng tinh thần "hợp nhất handoff, không hợp nhất rủi ro" của amendment.

```
Batch-ID / commit range / HEAD: monitor-2+ai+F18 / 13501da..4d133d9 / 4d133d9
Contract result: 22/22 route exit criterion PASS (15 monitor-2 + 7 ai) — mapping 145/145 GREEN,
  0 known-red sai nghĩa; F18 (P1, ngoài phạm vi route ban đầu) đã fix + test trong cùng bundle
Changed files: product: server/routes.js (F18 fix: numField() helper dùng chung cho GET /reports 9
  mảng breakdown + tiers, Number() wrap spend/avgScore ở by-staff, spend ở by-unit, mediaCost ở
  awards);
  test: 2 file mới (integration-monitor-2.test.js 41 test, integration-ai.test.js 25 test),
  1 file mở rộng (integration-reports.test.js +10 test cho F18/BR-CALC-009/010);
  docs: 01-audit-findings.md (F18 mới), 04-ROADMAP.md (G1A.3 status + F-tracking F18),
  gate1-test-mapping.md (22 dòng route TODO->green, BR-CALC-009/010 TODO->green)
Route-job-rule mapping delta: R121-R142 TODO -> green (145/145 route); BR-CALC-009/010 TODO -> green
Behavior changes: có — F18 fix tại routes.js (3 route report: /reports, /reports/by-staff,
  /reports/by-unit, /reports/awards — kiểu dữ liệu số trả về đổi từ string sang number đúng trên
  MySQL, giá trị số không đổi trên SQLite); không đổi business logic/contract nào khác
Tests added/changed: 41+25+10 = 76 test mới, 0 test cũ bị sửa (ngoại trừ mở rộng, không xoá case nào)
Commands and exact results (chạy MỘT LẦN ở HEAD 4d133d9, đúng amendment §14):
  npm run test:integration:sqlite -> 548 pass, 7 skip, 0 fail
  npm run test:integration:mysql (ALLOW_TEST_DB_CREATE=1) -> 554 pass, 1 skip, 0 fail
  npm run test:security -> 6 pass, 0 fail
  node scripts/verify-g0.mjs -> PASS toàn bộ 7 check
Known-red/TODO: 0 route TODO còn lại — 145/145 GREEN. F15 không đổi (P2/Wave 1, 5 quan hệ FK); F3
  SSRF không đổi (route-catalog đã ghi, guard thật thuộc G1B.4)
Out-of-scope findings/backlog: F18 (P1, đã fix trong cùng bundle theo tiền lệ F13/F14/F16/F17 —
  không mở remediation riêng theo đúng amendment §14 "P0/P1 vẫn phải tách remediation hẹp" nhưng ở
  đây fix + gộp báo cáo cùng bundle vì phát hiện trước khi audit, không phải sau khi Codex/ChatGPT
  đã audit xong)
Rollback path: revert riêng từng commit độc lập — 13501da (monitor-2), fc77674 (ai), 4d133d9 (F18) —
  không phụ thuộc lẫn nhau, có thể rollback từng phần
Worktree status and unrelated pre-existing changes: sạch, chỉ `.DS_Store` không liên quan (không track)
```

**READY FOR ONE-SHOT AUDIT — Bundle monitor-2+ai+F18, commit range 13501da..4d133d9**
Contract: PASS 22/22 route exit criteria + F18 remediation
Tests: targeted lúc code đã pass; full MySQL 554 pass/1 skip; full SQLite 548 pass/7 skip; security
  6/6; verify-g0.mjs PASS — TẤT CẢ chạy một lần ở HEAD theo amendment §14
Hotspots:
  - R122 network-safety (POST /monitor/sources gọi detectFeed() thật, F3 SSRF đã biết, characterize
    bằng loopback cổng đóng)
  - R135/R136-R141 tái dùng cơ chế Gemini no-key-throw-before-network đã xác nhận batch trước
  - R139 nhánh url (F3 SSRF/BR-SSRF-016, cùng characterize bằng loopback)
  - **F18** (P1): SUM()/AVG() trả string trên MySQL ở 3 route report chưa từng sửa, nghiêm trọng
    nhất ở `/reports/awards` totalCost nối chuỗi (`"0300000"` thay vì `300000`) — sai số liệu báo
    cáo tài chính. Đã fix + 10 test xác nhận cộng số đúng (không chỉ kiểm `typeof`)
Known gaps/backlog: F15 (không đổi — P2/Wave 1); F3 SSRF (không đổi — G1B.4)
Evidence Bundle: mục này (`15-changelog.md`, entry 2026-08-26 "Audit-closure bundle: monitor phần
  2 + ai + F18")

**145/145 route đã GREEN — đóng phần HTTP-route của G1A.3.** Theo amendment §14, đây CHƯA phải đóng
toàn bộ G1A hay Gate 1: còn lại phải gộp thành tối đa 2 Evidence Bundle tiếp theo — (A) jobs/
concurrency/DB contract/AI golden/target security tests; (B) UI smoke, E2E skeleton, CI-mapping
verifier, performance artifact — trước khi có thể tuyên bố CLOSE G1A/Gate 1.

**Auditor ONE-SHOT AUDIT (ChatGPT, cùng vai trò/luồng làm việc, xem
[[pr-workstation-fasttrack-branch-push]]) — Decision: ACCEPT — G1A.3 HTTP ROUTE COVERAGE 145/145
IS VALIDLY CLOSED** (closure HEAD `227a33c`, product range `13501da..4d133d9`)
- Finding A: remediation F17 trước đó (fail-fast migration + canonical `sources.mode`) xác nhận đúng
  — Medium finding trước CLOSED.
- Finding B/C: F18 là bug P1 thật, fix `numField()` + Number()-wrap đúng hướng, đặc biệt tránh đúng
  lỗi nối chuỗi `totalCost`; test regression đủ mạnh (kiểm cộng số thực tế, không chỉ `typeof`), giữ
  đúng ngữ nghĩa `avgScore = null` khi AVG() rỗng. **Decision: KEEP toàn bộ thay đổi F18.**
- Finding D: monitor phần 2 characterization chấp nhận được, SSRF gap được ghi backlog đúng, không
  "tô xanh giả".
- Finding E (ghi chú phạm vi, không phải blocker): AI route characterization (no-key-throw-trước-mạng
  + loopback cho nhánh URL) hợp lý cho route-level, nhưng **không được hiểu là đã test thành công
  Gemini thật** — live-AI coverage vẫn thuộc AI golden set (G1A.7) và các unit test mock/DI cấp thấp
  hơn.
- Finding F/G: 145/145 route closure đáng tin cậy; mapping vẫn giữ đúng phân biệt route đã
  characterize vs target security/AI policy còn TODO (không xoá TODO chỉ để mapping trông xanh hết).
- **Must not do (audit nhấn mạnh):** không tuyên bố Gate 1 đóng chỉ vì 145/145 route xanh; không gọi
  AI characterization no-key là đã test Gemini thật thành công; không xoá TODO security/AI target chỉ
  để mapping trông đẹp; không thay Number()-wrap bằng coercion phía client — API phải trả đúng kiểu số.
- **Next bundles (theo đúng amendment §14):** Bundle A = jobs + concurrency/idempotency
  characterization + DB contract + AI golden tests + security target tests (≈ G1A.4/G1A.5/G1A.7 +
  phần G1B target). Bundle B = UI smoke + E2E skeleton + CI/mapping verifier + performance (≈
  G1A.6/G1.8 + verifier). Chỉ sau khi cả 2 bundle này đạt exit gate mới được coi G1A/Gate 1 CLOSE.
- **Batch monitor-2+ai+F18 CLOSED (ACCEPT). Chuyển sang Bundle A.**

### Bundle A phần 1 — jobs (JOB-REMINDER + JOB-MONITOR-SCAN), 2026-08-26

**Batch Contract:** G1A.4 (concurrency/idempotency characterization của `reminder_log` check-then-
insert race, R3-02C) + G1A.8 (background job side-effect DB thật — `scheduler.runOnce()` và
`monitor.runScan()/applySchedule()` — không chỉ verify qua route HTTP). Theo amendment §14, đây là
sub-batch đầu tiên của Bundle A (jobs/concurrency/DB contract/AI golden/security target), gộp
handoff cùng các sub-batch còn lại của Bundle A trước khi gửi audit một lần.

**Nội dung:** file mới `server/test/integration-jobs.test.js` (6 test, gọi thẳng hàm job, không
qua route HTTP):
- `JOB-REMINDER` happy: `scheduler.runOnce()` sinh đúng dòng `reminder_log` (in-app) đúng
  `occur_date`/`seq`, `emailed=0` vì `mailer.enabled()=false` trong test (không cấu hình SMTP).
- `JOB-REMINDER` happy: gọi `runOnce()` lần 2 ngay sau (tuần tự) không tạo dòng trùng — check-then-
  insert an toàn khi tuần tự (không có race trong 1 process vì không có điểm yield giữa SELECT-check
  và INSERT).
- `JOB-REMINDER` CHARACTERIZATION (G1A.4, R3-02C — xác nhận hành vi HIỆN TẠI CÓ RACE, không phải
  test hành vi đích): chèn trực tiếp 2 dòng `reminder_log` giống hệt nhau (cùng
  `date_id,occur_date,seq,channel,recipient_user_id`) — DB KHÔNG báo lỗi vì không có ràng buộc
  UNIQUE (chỉ có index thường `idx_remlog(date_id,occur_date,seq)`, thiếu `channel`/
  `recipient_user_id`). Đây là bằng chứng DB-level trực tiếp cho tiền đề race đã ghi ở
  `11-business-flows.md` §E — không mô phỏng race đồng thời thật (không khả thi trong 1 tiến trình
  Node đơn luồng với code không có `await` giữa check và insert).
- `JOB-REMINDER` happy: `notify_repeat_count>1` sinh đủ các `seq` khi tất cả đều đến hạn.
- `JOB-MONITOR-SCAN` happy (network-safe): `monitor.runScan({triggeredBy:'auto'})` KHÔNG truyền
  `queryIds` — đúng đường job tự động thật (khác route thủ công `POST /monitor/scan` luôn yêu cầu
  `query_ids` tường minh, 400 nếu rỗng) — characterize đúng hành vi "auto job quét TẤT CẢ
  `scan_queries` đang `enabled=1`". An toàn mạng bằng cách tắt hết `sources` + rỗng `include`/
  `grounding=0` của `scan_queries` (không gọi mạng thật). Verify `scan_runs.queries` = đúng số query
  enabled, `status='done'`, `fetched=0`, `new_mentions=0`.
- `JOB-MONITOR-SCAN` happy: `monitor.applySchedule()` gọi lặp lại (bật autoscan 3 lần liên tiếp)
  không leak timer — theo dõi `setInterval`/`clearInterval` thật: 3 lần tạo timer, 2 lần clear (lần
  đầu chưa có timer cũ để clear vì `timer=null` lúc module mới load).

Không có bug code nào được phát hiện trong batch này — thuần characterization theo đúng scope đã
audit-approved (G1A.4 chỉ yêu cầu xác nhận race hiện tại, không sửa; G1A.8 chỉ yêu cầu verify side-
effect, không đổi hành vi job).

**Evidence:**
```
DB_CLIENT=sqlite node --test server/test/integration-jobs.test.js -> 6 pass, 0 fail
DB_CLIENT=mysql ALLOW_TEST_DB_CREATE=1 node --test server/test/integration-jobs.test.js -> 6 pass, 0 fail
npm run test:integration:sqlite -> 554 pass, 0 fail, 7 skip (561 total)
npm run test:integration:mysql -> 560 pass, 0 fail, 1 skip (561 total)
npm run test:security -> 6 pass, 0 fail
node scripts/verify-g0.mjs -> PASS toàn bộ 7 check
```
Mapping: `gate1-test-mapping.md` — `JOB-REMINDER` và `JOB-MONITOR-SCAN` chuyển từ `TODO` sang
`green`. Không còn dòng `TODO` nào thuộc phạm vi route/job đã lên khung ở G1A.9 ngoài các mục
target thật (AI golden set G1A.7, security target G1B, UI/E2E Bundle B).

Rollback path: revert 1 commit độc lập (chỉ thêm file test mới + 2 dòng mapping/roadmap, không đổi
code sản phẩm).

Worktree status: sạch, chỉ `.DS_Store` không liên quan (không track).

**Chưa gửi audit** — theo amendment §14, chờ gộp tiếp các sub-batch còn lại của Bundle A (DB
contract G1A.5, AI golden set G1A.7, security target tests G1B) thành 1 Evidence Bundle trước khi
audit một lần.

### Bundle A phần 2 — AI golden set (G1A.7), BÀN GIAO Codex (hết token phiên Claude), 2026-08-26

**Batch Contract:** G1A.7 — AI golden set cho ĐỦ 12 luồng egress Gemini (`06-threat-model.md` §A,
AI-E001..AI-E012), dùng fake/fixture (KHÔNG gọi Gemini/Internet thật), cộng malformed/timeout/quota.
Owner đã chốt phạm vi Bundle A ở tin nhắn trước: G1A.4+G1A.5+G1A.7+G1A.8 là test cho code hiện hữu,
"phải GREEN"; G1B (RBAC v2/session/SSRF target) là spec-first riêng, CHƯA làm ở batch này.

**Nội dung:** file mới `server/test/integration-ai-golden.test.js` (18 test). Kỹ thuật cách ly mạng:
`process.env.GEMINI_API_KEY` set TRƯỚC mọi require (mỗi file test là 1 subprocess riêng theo quy
ước `node --test server/test/*.test.js`, không ảnh hưởng file khác đang characterize nhánh
không-key); `global.fetch` thay bằng hàng đợi (queue) response cố định theo ĐÚNG thứ tự lời gọi
mạng thật của từng luồng (kể cả lời gọi không phải Gemini — `resolveLink()`, URL-fetch trực tiếp
trong award-extract nhánh url) — lời gọi vượt hàng đợi throw ngay, đảm bảo không lọt ra mạng thật.
`realFetch` (fetch gốc, lưu TRƯỚC khi mock) dùng riêng để gọi vào chính server test cục bộ, tách
biệt khỏi `global.fetch` bị mock dùng cho lời gọi ra ngoài của server — nhầm lẫn 2 cái này ban đầu
khiến toàn bộ 18 test lỗi `.listen undefined`, đã sửa.

**Kết quả:**
```
DB_CLIENT=sqlite node --test server/test/integration-ai-golden.test.js -> 18 pass, 0 fail
DB_CLIENT=mysql ALLOW_TEST_DB_CREATE=1 node --test server/test/integration-ai-golden.test.js -> 15 pass, 3 fail
npm run test:integration:sqlite -> 572 pass, 0 fail, 7 skip (579 total, có file mới)
npm run test:integration:mysql -> 575 pass, 3 fail, 1 skip (579 total)
```
**MySQL 3 fail là bug THẬT, không phải lỗi viết test — đã xác nhận trực tiếp, không suy đoán:**
- **F19** (P1, root cause đã xác định rõ, CHƯA SỬA): `POST /ai/interaction-voice` (AI-E001) trả 502
  `Unknown collation: 'NOCASE'` — `ai.js:26,30` (`matchPerson`/`matchOrg`) dùng `COLLATE NOCASE`
  (cú pháp SQLite) trên MySQL không hỗ trợ. Route hỏng bất kỳ khi nào Gemini trả `person_name`/
  `org_name` khác rỗng (gần như luôn luôn — đúng mục đích route). Hướng sửa đã đề xuất ở
  `01-audit-findings.md` §F19 (bỏ `COLLATE NOCASE` hoặc thêm rule dịch vào `mysql-sync.js
  translate()`), CHƯA thực thi.
- **F20** (nghi vấn, CHƯA XÁC ĐỊNH ROOT CAUSE): `groundIngest()`/`siteGroundIngest()` (AI-E008/
  AI-E009) báo `added>0` (ghi thành công) nhưng `SELECT ... WHERE query_id=?` NGAY SAU không thấy
  dòng vừa lưu — CHỈ trên MySQL, SQLite ổn định 100%. Đã loại trừ lỗi cú pháp SQL bị nuốt (thêm log
  trực tiếp vào `saveMention()` không in ra gì) và lỗi FK (đã xác nhận dòng `scan_queries` cha tồn
  tại thật trước khi insert). Có dấu hiệu KHÔNG ổn định giữa các lần chạy y hệt — nghi cơ chế đồng
  bộ hoá worker thread của `mysql-worker.js`/`mysql-sync.js`. **CHƯA đủ bằng chứng kết luận** đây là
  bug hẹp (riêng `saveMention()`) hay bug RỘNG (mọi ghi-rồi-đọc-ngay trên MySQL) — cần Codex đọc kỹ
  `mysql-worker.js` (đường đi `run()`/`get()`/`all()` qua worker thread có đúng đợi ghi xong trước
  khi trả `changes` không) trước khi vá.

Không sửa code sản phẩm trong batch này (chỉ thêm test) — theo đúng nguyên tắc thà bàn giao nguyên
trạng với bằng chứng đầy đủ còn hơn vá vội khi chưa hiểu hết root cause của F20 (rủi ro vá sai vị
trí nếu F20 thực ra là lỗi hạ tầng rộng).

Mapping: `gate1-test-mapping.md` — dòng `AI-E001..E012 (G1A.7 AI golden set)` set **PARTIAL**
(không phải `green`, không phải `TODO`) — mô tả rõ SQLite green/MySQL red + trỏ `01-audit-findings.md`
§F19/§F20. `04-ROADMAP.md` G1A.7 cập nhật cùng nội dung, đánh dấu **KHÔNG được coi CLOSE**.

**BÀN GIAO CODEX (owner hết token quota phiên Claude, chuyển tiếp — KHÔNG phải audit-closure bundle,
đây là bàn giao công việc DANG DỞ):**
1. Sửa **F19** (thấp rủi ro, root cause rõ) — bỏ `COLLATE NOCASE` hoặc thêm rule dịch, chạy lại
   `integration-ai-golden.test.js` cả 2 driver tới khi AI-E001 xanh.
2. Điều tra **F20** tới khi xác định rõ root cause (đọc `mysql-worker.js`) — QUAN TRỌNG: nếu xác
   nhận đây là lỗi rộng ở tầng `mysql-worker.js`/`mysql-sync.js` (không riêng `saveMention()`), phải
   nâng mức độ ưu tiên vì có thể ảnh hưởng bất kỳ route/job nào ghi-rồi-đọc-ngay trên MySQL — không
   chỉ vá riêng `groundIngest()`.
3. Sau khi cả 2 fix xong + `integration-ai-golden.test.js` đạt 18/18 cả 2 driver, chạy lại full
   regression 1 lần (SQLite/MySQL/security/verify-g0.mjs), cập nhật mapping G1A.7 thành `green`.
4. Tiếp tục G1A.5 (DB contract dual-driver) — CHƯA làm ở phiên này; lưu ý F20 có thể là tiền đề
   quan trọng cho thiết kế test G1A.5 (nếu F20 là bug hạ tầng thật, DB contract cần test riêng cho
   đúng tình huống ghi-rồi-đọc-ngay).
5. G1B (RBAC v2 D13 target-red + session F2 + SSRF F3) theo đúng phạm vi owner đã chốt: chỉ viết
   target specification test (CHƯA implement feature), tách CI `security-gap` riêng khỏi
   `regression`, đối chiếu allowlist {finding/decision ID, owner, expiry=Wave 1} — CHƯA bắt đầu.
6. Theo amendment §14: Bundle A vẫn CHƯA gửi audit (đang dở dang G1A.5/G1B) — chỉ gửi 1 Evidence
   Bundle khi TOÀN BỘ Bundle A (G1A.4/G1A.5/G1A.7/G1A.8 + G1B.1/G1B.3/G1B.4 target-spec) hoàn tất.

Rollback path: revert 1 commit độc lập (chỉ thêm file test mới + cập nhật mapping/roadmap/findings,
không đổi code sản phẩm — an toàn revert bất kỳ lúc nào).

Worktree status: sạch, chỉ `.DS_Store` không liên quan (không track).

**Từ đây, mọi thay đổi kiến trúc/schema/API/nghiệp vụ đáng chú ý PHẢI thêm 1 dòng vào file này kèm lý do — theo `BackEnd.SKILL/20-memory-bank-mandate.md` mục 3.**

### 2026-08-27 — Codex remediation F19/F20 (G1A.7)

- **F19:** bỏ `COLLATE NOCASE` khỏi hai query khớp người/cơ quan trong `server/ai.js`; `AI-E001` xanh trên SQLite và MySQL.
- **F20:** xác định không phải race worker; adapter `server/mysql-sync.js` chưa bind SQLite-style object placeholders `@name`, khiến MySQL ghi user variable/`NULL`. Thêm `bindSqliteNamedParams()` chuyển sang positional binding và regression unit cho literal/comment/lặp tên/thiếu binding.
- Verify focused: `node --test server/test/mysql-sync-close.test.js` 10/10; MySQL AI golden 18/18.
- **G1A.5 DB contract:** thêm `server/test/integration-db-contract.test.js` (4 test: 34 bảng, cột migration lõi, unique username/round-trip, app_meta upsert) — xanh cả SQLite/MySQL; F15 FK parity vẫn để Wave 1.
- **G1A.9 mapping verifier:** thêm `scripts/verify-gate1-mapping.mjs` + npm script `test:verify-gate1-mapping`; kiểm tra 145/145 route, không trùng/thiếu, file/status hợp lệ. Kết quả `236 rows, TODO=3, known-red=0`; 3 TODO đều là target có owner/wave, không phải characterization bị bỏ sót.
- Verify full sau remediation + DB contract: `npm run test:integration:sqlite` 578 pass / 0 fail / 7 skip; `npm run test:integration:mysql` 584 pass / 0 fail / 1 skip; `npm run test:security` 6/6; `node scripts/verify-g0.mjs` PASS; `git diff --check` sạch. Bundle A vẫn cần một lượt audit closure; G1B target chưa hoàn tất.

### 2026-08-27 — G1B.4 / F3 SSRF guard

- Thêm `server/safe-fetch.js` làm seam outbound dùng chung; áp dụng `monitor.fetchText`, `monitor.resolveLink`, create/update monitor source và `POST /ai/award-extract`.
- Fail-closed `400` với URL localhost/private/link-local/metadata/IPv6 private, DNS có bất kỳ IP không an toàn hoặc redirect không an toàn; không ghi source/mention, không gọi Gemini. HTTP(S) transport pin IP vừa kiểm tra bằng custom lookup để tránh DNS rebinding TOCTOU, giới hạn response 2 MiB.
- Thêm `unit-safe-fetch.test.js` BR-SSRF-021..028; chuyển BR-SSRF-010/011 và target route BR-SSRF-016 thành green. Focused unit 27/27, route HTTP R122/R139 và AI golden SQLite xanh. Full dual-driver: SQLite 586 pass/7 skip; MySQL 592 pass/1 skip; security 6/6; G0 + mapping verifier PASS (`244 rows`, `TODO=2`).

### 2026-08-27 — W1.RBAC.0 data-readiness preflight

- Siết `scripts/rbac-preflight.mjs`: không còn coi việc **có cột** là đủ. Script read-only đếm
  `NULL` của owner staff trên đủ 14 resource direct (riêng `gifts.responsible_user_id`) và
  `attachments.audience_visibility`; chỉ trả `readyToFlipFailClosed=true` khi schema đủ **và** mọi
  giá trị thiếu đều bằng 0.
- Thêm regression `BR-RBAC-001/002`: một booking chưa gán owner bắt buộc giữ exit code 2; sau khi
  gán owner thì fresh schema được qua gate. Không có route/runtime RBAC nào được bật ở slice này.
- Verify: SQLite 596 pass/7 skip; MySQL 602 pass/1 skip; mapping verifier 145/145, TODO=2.
  Preflight local cũ vẫn expected-red (thiếu schema); MySQL/production chỉ được flip sau artifact
  preflight, DevOps attestation, backup và smoke cutover theo W1.RBAC.0.

### 2026-08-27 — W1.1 principal seam

- Thêm `auth.resolvePrincipal(req)` với provider hiện tại là web session; `requireAuth`/`requirePerm`
  gắn `req.principal` trước khi handler chạy. Đây là seam server-side cho PolicyEngine và AMIS
  bridge tương lai, không nhận principal từ request body/header và không đổi quyền của matrix cũ.
- Các handler legacy vẫn tương thích qua `req.session.user`; vertical slice RBAC mới sẽ dùng
  `req.principal` thay vì tự đọc session. Regression `BR-RBAC-003/004` và auth HTTP 28/28 xanh.

### 2026-08-27 — RBAC classification registry correction

- Đối chiếu `03-data-classification.md` với `PolicyEngine` phát hiện 8 trường đời tư đã được owner
  phân loại Confidential nhưng bị thiếu khỏi registry chạy thực tế. Bổ sung tier và allowlist cấu
  hình cho toàn bộ 8 trường; engine/adapter tiếp tục fail-closed, nên Admin/Super Admin không thể
  công khai chúng chỉ qua `field_visibility`.
- Regression D13-001/D13-007 bao phủ đủ representative Confidential và Restricted fields. Chưa có
  route runtime nào sử dụng field visibility ở slice này.

### 2026-08-27 — W1.POLICY service choke point foundation

- Thêm `policy-service` dùng chung cho vertical slice: server tự gán owner lúc tạo record direct,
  `created_by` bất biến, chuyển owner chỉ Admin/Super Admin, và projection lọc field trước khi trả
  response. Mọi deny là lỗi tường minh để handler trả 403, không xoá field âm thầm.
- Tests D13-008..010 xanh. Chưa wire route legacy; bước tiếp theo là pilot People Detail dual-driver.

### 2026-08-27 — D13 People Detail read pilot

- Chuyển `GET /api/people/:id` cho đúng target role D13 qua PolicyEngine; field thiếu cấu hình bị coi private. Test HTTP D13-011 xác nhận Viewer chỉ thấy `full_name` khi field này được public rõ ràng; phone, ngân hàng, file, interactions và gifts không lộ.
- Role 2-role legacy giữ nguyên nhánh cũ để migration không big-bang. Focused dual-driver: SQLite 34/34, MySQL 34/34.
