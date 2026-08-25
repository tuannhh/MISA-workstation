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

**Từ đây, mọi thay đổi kiến trúc/schema/API/nghiệp vụ đáng chú ý PHẢI thêm 1 dòng vào file này kèm lý do — theo `BackEnd.SKILL/20-memory-bank-mandate.md` mục 3.**
