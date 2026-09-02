# 15 — Lịch sử phát triển (changelog)

## 2026-09-01 — W3 Event Detail read pilot (Codex)

- Mở rộng strangler Event List từ `#events` sang `#events/:id`, giữ feature flag `eventsListRead`.
- Thêm `event-detail.mjs` cùng hai composition `EventDetailDesktop`/`EventDetailMobile`; chỉ hiển thị
  projection public đã chọn, không suy diễn owner, assignment, raw cost hay attachment ở client.
- List/Desktop và Native list mở route detail bằng thao tác có bàn phím/touch; build UI và test
  `UI-EVENT-004` đã chạy xanh. Runtime trong native AMIS, deep link host và accessibility OS còn
  **UNVERIFIED** cho tới O3/W4, nên không ghi là hoàn thành release mobile.
- Mở Event Edit cho người có `events:edit`: action chỉ là UX, request vẫn qua `PUT /events/:id`
  PolicyEngine; Desktop/Native form chỉ gửi public allowlist. `UI-EVENT-005` khóa route/permission/
  payload, còn cost/file/delete và Smart Intake không bị kéo vào patch này.
- Mở Event Delete với dialog xác nhận MDS riêng ở Desktop/Native. Nút theo `events:delete` chỉ là
  affordance; client gọi `DELETE /events/:id` và hiển thị lỗi từ server, không suy diễn ownership.
  `UI-EVENT-006` khóa contract API và confirm trước thao tác phá hủy.
- Detail hiển thị tổng chi phí theo projection `R088` (bao gồm giá trị MASK) mà không tự cộng row
  ở client. Đây chỉ là cost-read; cost line/file metadata và mọi thao tác ghi giữ ở slice policy riêng.
- Mở slice Event file: cả Desktop và Native composition chỉ hiển thị metadata tệp đã được server
  projection và action tải lên theo `events:edit`; request mở/tải tệp luôn qua endpoint server có
  PolicyEngine. Không hiện nút xóa vì route xoá hiện fail-closed với Event, tránh hành vi UI không
  thực hiện được.
- Mở slice dòng chi phí Event: giữ nguyên projection/mask từ API, form create/edit Desktop và Native
  tách composition, và yêu cầu xác nhận MDS trước xoá. Client chỉ gửi allowlist chi phí và không
  suy diễn owner; server vẫn áp inherited ownership cho create/edit và Admin-only cho delete.
- Mở pilot read-only cho Award List/Detail qua R062/R063. UI giữ nguyên mask do PolicyEngine trả về,
  không render owner/caretaker/budget participation; dữ liệu file chỉ là metadata tồn tại và nội dung
  vẫn phải đi qua endpoint được server kiểm quyền. CRUD/AI/reminder Award chưa bị kéo vào pilot này.
- Mở Award create/edit qua R064/R065 ở hai composition MDS riêng. Nút tạo/sửa chỉ hiện theo
  permission từ `/api/me`; payload core chỉ dùng allowlist và không chứa owner, caretaker hay file,
  nên máy chủ/PolicyEngine vẫn là nơi quyết định cuối cùng. Các trường nâng cao và flow
  participation/file/reminder/AI extract tiếp tục tách sang slice sau để không làm mờ ranh giới
  authorization hoặc mất dữ liệu nghiệp vụ trong một lần thay đổi lớn.
- Sửa F29: các form từng chuyển draft `Object.freeze` thẳng vào `Vue.reactive`, khiến Vue giữ object
  không proxy được và `v-model` không nhận giá trị mới. Form Event, Award, Interaction, Person và
  Booking nay sao chép draft trước khi reactive; `UI-FORM-001` tái hiện lỗi bằng Vue thật và khóa 14
  composition Desktop/Native. Đây là nguyên nhân trực tiếp có thể làm người dùng tưởng chức năng
  "Thêm" bị thiếu dù route/API đã tồn tại.
- Sửa F30: Award/Event create chuyển `record=null` vào draft đọc thuộc tính trực tiếp, nên form có
  thể lỗi ngay lúc bấm Thêm. Chuẩn hóa `null` tại domain boundary và thêm regression test gọi đúng
  nhánh này.
- Mở Award Participation qua R066/R067/R068 với panel/form MDS Desktop và Native tách riêng. Payload
  chỉ theo allowlist, UI không render owner; quyền owner/delete là affordance dựa trên projection,
  còn server PolicyEngine kiểm tra lại. Budget không được API projection sẽ không bị gửi `null` khi
  cập nhật.
- Mở Award file upload ở hai composition MDS riêng. UI gửi `FormData` đến route protected, không tự
  quyết owner hoặc quyền xem; nội dung file luôn mở qua endpoint server kiểm quyền. Không thêm nút
  xóa khi chưa có contract backend để tránh affordance không thực hiện được.

## 2026-09-01 — W2.5 host-adapter contract-ready (Codex)

- Thêm `frontend/src/platform/host-adapter.mjs`: contract không mang `principal`/token, chọn Desktop/Native bằng `surface` tường minh, capability state có recovery rõ, lifecycle/safe-area/deep-link/Back/gesture quy về một adapter.
- Thêm hai provider test `fake-browser` và `fake-native`; registry fail-closed nếu Native không có provider riêng, không suy diễn desktop responsive hoặc Browser fallback là Native UI.
- Thêm `server/test/unit-host-adapter.test.js` (`W25-001..004`) và tài liệu `25-w2-host-adapter-contract.md`. Đây là infrastructure cho People Detail, chưa đụng `public/app.js`, chưa tạo Native route và **không** đóng F5/O3/W4 device evidence.

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

### 2026-08-28 — Ngoại lệ thứ tự phạm vi hẹp (owner) + sync verify-g0.mjs sau pilot

- Phát hiện khi resume phiên: Wave 1 (`W1.RBAC.0/W1.1`/registry/`W1.POLICY`) và pilot Wave 3 đầu
  tiên (`3e8b299`) đã lên trước khi G1B/G1C/G1.8 đóng đủ Exit gate G1 — ngược ghi chú roadmap
  2026-08-27 "Không chuyển sang Wave 1 implementation chỉ vì test characterization đã xanh". Hỏi
  lại owner trực tiếp thay vì tự suy đoán hay tự revert.
- **Owner xác nhận đây là ngoại lệ chủ ý, phạm vi hẹp:** cho phép foundation/pilot fail-closed của
  Wave 1 chạy trước để rút ngắn tiến độ, nhưng cấm cutover role hàng loạt/bật RBAC v2 mặc định toàn
  hệ thống/chuyển production/tuyên bố Wave 1 hay Gate 1 "hoàn tất" trước khi G1B/G1C/G1.8 đóng đúng
  Exit gate G1. Ghi vào `02-decisions.md` §G (commit `598b535`) — slice pilot mới ngoài People
  Detail phải hỏi lại owner trước khi implement.
- Trong lúc kiểm tra, phát hiện `node scripts/verify-g0.mjs` đã FAIL kể từ `3e8b299` (không commit
  nào sau đó chạy lại verifier) — 2 nguyên nhân: (1) pilot bỏ `requirePerm()` literal khỏi khai báo
  `GET /people/:id`, làm parser regex không còn suy ra được module/action; (2) `W1.RBAC.1` thêm
  bảng `field_visibility` (có chủ ý không đưa vào `dropAll()` — xem `09-db-schema.md` §E) làm lệch
  số bảng kỳ vọng 34→35. Sửa ở commit `6aa31bd`: thêm `PILOT_INLINE_PERM_ROUTES` (cùng tinh thần
  `DIRECT_AUTH_ROUTE_KIND` có sẵn) khai tường minh module/action thật thay vì suy diễn ngầm, đồng
  bộ `07-route-catalog.md`/`09-db-schema.md`. Verify: `verify-g0.mjs` PASS 7/7,
  `test:verify-gate1-mapping` PASS (145/145, TODO=2), `test:security` 6/6,
  `test:integration:sqlite` 602 pass/7 skip, `test:integration:mysql` 608 pass/1 skip.
- Bài học quy trình: mọi commit chạm route/schema vẫn phải chạy `verify-g0.mjs` trong checklist
  full regression trước handoff, kể cả sau khi Gate 0 đã đóng từ lâu — verifier vẫn là nguồn sự
  thật máy-kiểm-được cho route catalog/permission matrix/schema facts, không "hết hạn dùng" chỉ vì
  gate đã CLOSE.

## 2026-08-28 — G1B.3 session target (F2) + cơ chế known-red allowlist (G1B.6)

- Batch contract: `18-g1b-rbac-batch-contract.md#batch-g1b3-session-2026-08-28`. G1B.6 (cơ chế
  allowlist known-red `{id, owner, expiry}`) trước đó **chưa tồn tại** trong repo dù roadmap đã ghi
  yêu cầu từ G1A.2 — không có cơ chế này thì không có RED test nào được viết an toàn (RED trực
  tiếp làm build đỏ vô thời hạn, không phân biệt được gap-đã-biết với bug thật). Dựng
  `server/test-support/known-red.js` (`validateEntry(id)` tra `memory-bank/g1b-allowlist.json`,
  fail nếu thiếu/hết hạn; `knownRed(id, name, fn)` bọc `test()` — test CHA chỉ pass khi `fn` bên
  trong vẫn fail đúng như allowlist mô tả; nếu `fn` bất ngờ pass, test CHA tự fail để buộc promote
  thành assertion xanh thật + xoá khỏi allowlist, không được để known-red mãi mãi).
- 2 target test đầu tiên dùng cơ chế này (`server/test/target-session-f2.test.js`):
  `F2-fixation` (session id phải đổi khi login lại trên cookie có sẵn — hiện KHÔNG đổi vì
  `auth.login()` không gọi `req.session.regenerate()`) và `F2-ratelimit` (`/api/login` phải chặn
  brute-force — hiện không có giới hạn). Cả 2 RED đúng lý do, allowlist
  `{owner:backend, expiry:2026-12-31, wave:W1.7}`. Implement thật (regenerate + rate-limit) vẫn
  thuộc W1.7, không làm trong batch này.
- Nhân tiện kiểm tra `F2-logout-invalidation` (đăng nhập → logout → cookie cũ gọi `/api/me`) —
  hoá ra ĐÃ đúng từ trước (`req.session.destroy()` vô hiệu session phía server), ghi nhận
  characterization GREEN, không đưa vào allowlist.
- Sửa `scripts/verify-gate1-mapping.mjs`: regex nhận diện ID trước đó chỉ khớp
  `R\d{3}|JOB-*|AI-|BR-`, không khớp vocabulary `{F-id/D13-target/N-id}` mà chính header
  `gate1-test-mapping.md` đã ghi cho G1B — khiến 2 dòng known-red mới bị đếm ẩn (verifier PASS giả,
  vẫn báo `known-red=0`). Thêm `F\d+-|D13-|N\d+-` vào regex; sau sửa verifier báo đúng
  `known-red=2`, `247 mapped rows`.
- Verify: `known-red self-test` xanh (xác nhận cơ chế thật sự phát hiện id thiếu/hết hạn/hành vi
  bất ngờ pass); `target-session-f2.test.js` 7/7 cả SQLite lẫn MySQL;
  `test:integration:sqlite` 616 total/609 pass/7 skip (tăng đúng 7 so với batch trước);
  `test:integration:mysql` 616 total/615 pass/1 skip (tăng đúng 7); `test:security` 6/6;
  `verify-g0.mjs` PASS 7/7; `test:verify-gate1-mapping` PASS 145/145, TODO=2, known-red=2;
  `git diff --check` sạch. Chưa gửi Codex audit — vẫn là 1 batch trong loạt G1B, sẽ gộp cùng các
  batch G1B khác trước khi đóng Bundle A/B theo giao thức fast-track.

## 2026-08-28 — G1B.5 target N1/N2 (source-introspection)

- Batch contract: `18-g1b-rbac-batch-contract.md#batch-g1b5-n1n2-2026-08-28`. N1/N2 đã RESOLVED
  bởi owner từ 2026-08-25 (`02-decisions.md` §B.1, C0.1.3/C0.1.4) nhưng target chưa implement.
  Đặc điểm riêng của batch này: model 2-role hiện tại cấp full CRUD trên reminders/monitoring cho
  CẢ 2 role, nên gọi HTTP thật hôm nay không phân biệt được action `view` với action đích
  `ack`/`run` — gap chỉ lộ ra khi có role tương lai (D13 Viewer) được cấp view nhưng không được cấp
  write side-effect. Vì vậy test target đọc trực tiếp nguồn (route registration trong `routes.js` +
  `MODULES`/`MATRIX` trong `rbac.js`) thay vì gọi HTTP — cùng cách tiếp cận `verify-g0.mjs` đã dùng
  cho route catalog, không phải giảm chuẩn.
- `server/test/target-n1-n2-explicit-permission.test.js` (7 test, không cần DB harness — thuần đọc
  file nguồn nên chạy được cả 2 driver không khác biệt): `N1-explicit-action` (4 route side-effect
  — `POST /notifications/:id/read`, `POST /notifications/read-all`, `POST /reminders/run`,
  `POST /monitor/alerts/:id/read` — đều còn `requirePerm(module,'view')`, target `ack`/`run`) và
  `N2-dashboard-permission` (`GET /dashboard` chưa có `requirePerm` nào; `rbac.js` chưa có module
  `'dashboard'` trong `MODULES`/`MATRIX`). Cả 2 RED đúng lý do, allowlist
  `{owner:backend, expiry:2026-12-31, wave:W1}`. Kèm 1 test characterization khoá đúng dạng nguồn
  hiện tại mà known-red đang dựa vào, để nếu ai sửa theo hướng khác (không phải target N1/N2) thì
  báo ngay thay vì để known-red âm thầm đổi ý nghĩa.
- Verify: `target-n1-n2-explicit-permission.test.js` 7/7; `test:integration:sqlite` 623 total/616
  pass/7 skip (tăng đúng 7); `test:integration:mysql` 623 total/622 pass/1 skip (tăng đúng 7);
  `test:security` 6/6; `verify-g0.mjs` PASS 7/7; `test:verify-gate1-mapping` PASS 145/145, TODO=2,
  known-red=4; `git diff --check` sạch. Chưa gửi Codex audit — gộp cùng các batch G1B khác trước
  Bundle B.

## 2026-08-28 — G1B.1 engine completeness: nhóm Inherited (event_cost) + phủ đủ D13.4a

- Batch contract: `18-g1b-rbac-batch-contract.md#batch-g1b1-engine-completeness-2026-08-28`.
  Phát hiện khi rà soát: bảng D13.4a đã owner-approved đủ 6 nhóm ownership (Direct/Global/
  Module-admin-only/**Inherited**/"Global theo role"), nhưng `policy-engine.js` trước đó chỉ
  model 3/6 nhóm — thiếu hẳn `INHERITED` cho `event_costs` ("Chi phí sự kiện", kế thừa `owner_id`
  của `events` cha, không có người tạo độc lập). Hệ quả trước khi sửa: `event_cost` không nằm
  trong `DIRECT`/`GLOBAL` nên `canWrite()` luôn trả `false` cho executor dù họ sở hữu chính event
  cha — chặt hơn cả D13.4a yêu cầu (over-restrictive so với spec đã duyệt, không phải lỗ hổng lộ
  dữ liệu, nhưng vẫn là sai lệch giữa quyết định owner và code).
- Sửa `server/policy-engine.js`: thêm `INHERITED = Set(['event_cost'])`; `canWrite`/
  `canReadField` nhận thêm tham số `parentOwnerId` (optional, backward-compatible — mọi call
  site cũ như `policy-service.js`/People Detail pilot không đổi hành vi vì không truyền tham số
  này). Executor ghi/đọc đủ `event_cost` khi `parentOwnerId === principal.id`.
- Mở rộng `unit-policy-engine.test.js` (giữ nguyên D13-001..005 không sửa): D13-012 (14/14 Direct
  — executor ghi bản ghi mình sở hữu, không ghi bản ghi người khác, không bao giờ xoá, admin
  bypass), D13-013 (4/4 Global — executor sửa bất kể owner theo D13-P1/P2, không xoá được),
  D13-014 (6/6 Module-admin-only — executor bị chặn hoàn toàn kể cả tạo mới), D13-015 (event_cost
  Inherited — cả canWrite lẫn canReadField theo parentOwnerId), D13-016 (12 field tiền/mật còn
  thiếu trong `FIELD_TIER` — trước đó chỉ test person + booking + generic "field lạ").
- "Tài nguyên quản trị" (users/field_visibility config/audit_log — hàng cuối D13.4a) không cần
  set riêng: hành vi đã đúng ngầm định vì các entity này không nằm trong Direct/Global nên
  executor không ghi được, khớp "Global theo role" (quyết định hoàn toàn bởi D13.1) — ghi chú
  trong batch contract, không thêm code.
- Không đưa D13-012..016 vào `gate1-test-mapping.md` — theo đúng tiền lệ D13-001..010 (test nền
  tảng PolicyEngine thuần, không gắn `route_id`/`business_rule_id`, tracked ở `18-g1b-rbac-batch-
  contract.md`, không phải bảng route/job mapping).
- Verify: `unit-policy-engine.test.js` + `unit-policy-service.test.js` 13/13 (bao gồm D13-008..010
  cũ không đổi, xác nhận tương thích ngược); `test:integration:sqlite` 628 total/621 pass/7 skip
  (tăng đúng 5); `test:integration:mysql` 628 total/627 pass/1 skip (tăng đúng 5); `test:security`
  6/6; `verify-g0.mjs` PASS 7/7; `test:verify-gate1-mapping` PASS 145/145, TODO=2, known-red=4
  (không đổi — D13 không nằm trong mapping); `git diff --check` sạch.
- **Vẫn còn mở sau batch này (ghi rõ để không hiểu nhầm G1B.1/.2 đã đóng):** PolicyEngine hoàn
  tất đủ ngữ nghĩa D13.4a ở tầng THUẦN LOGIC, nhưng chưa route nào khác ngoài People Detail (GET)
  thật sự gọi tới nó — 24/25 entity trong bảng D13.4a vẫn 100% legacy 2-role ở tầng HTTP. Việc
  gắn route là Wave 1 strangler slice tiếp theo, không phải phạm vi batch này.

## 2026-08-28 — Remediation Bundle A theo Codex audit (PARTIAL ACCEPT → 2 MUST-FIX)

- Codex audit Bundle A (G1A.4/G1A.5/G1A.8/G1B.3/G1B.4/G1B.5/G1B.1-G1B.2 engine, commit range
  `19f9d33`/`99ddbec`/`8c99c1a`/`d2412a8`/`a4350ba`) trả **PARTIAL ACCEPT**, nêu 2 MUST-FIX:
- **#1 — `REQUIRED_COLUMNS.bookings` khai báo trùng 2 lần** trong
  `server/test/integration-db-contract.test.js` (dòng 29 và 43 cũ) — JavaScript object literal
  giữ khai báo SAU, nên `owner_id` ở khai báo đầu (đầy đủ hơn) bị đè mất khỏi cột bắt buộc, dù
  cột thật vẫn tồn tại trong DB (test không catch được nếu ai vô tình xoá `bookings.owner_id`
  thật). Đã gộp thành 1 khai báo duy nhất giữ `owner_id`. Verify bằng đúng thực nghiệm Codex đề
  xuất: tạm xoá `owner_id` khỏi `REQUIRED_COLUMNS.bookings` → test **fail** đúng như kỳ vọng;
  khôi phục lại → xanh. Nhân tiện sửa `04-ROADMAP.md` dòng G1A.5 ghi nhầm "34 bảng" (test
  `DB-CONTRACT-001` đã luôn xác nhận đúng 35 bảng từ trước, chỉ prose bị lệch).
- **#2 — `known-red()` bắt MỌI exception, không phân biệt lỗi target thật với lỗi setup/fixture.**
  Bản đầu (`server/test-support/known-red.js`): bất kỳ throw nào bên trong `fn` (kể cả
  `TypeError` do fixture hỏng, DB không kết nối, hay chính assertion sai câu chữ) đều bị coi là
  "hành vi đích sai như mong đợi" → known-red PASS giả. Sửa: thêm tham số bắt buộc `expectedError`
  (RegExp hoặc predicate `(err) => boolean`); lỗi không khớp bị **ném lại nguyên văn** thay vì
  nuốt, làm test thật sự đỏ để lộ đúng bug thay vì bị che giấu bởi known-red. Cập nhật cả 6 call
  site (`target-session-f2.test.js` 2 chỗ, `target-n1-n2-explicit-permission.test.js` 6 chỗ) với
  regex khớp đúng message target-assertion, loại trừ message lỗi setup (ví dụ "không tìm thấy
  route..."/"không tìm thấy khối MATRIX...").
- Self-test hành vi thật (không chỉ test logic thuần) cho remediation #2: `server/test-support/
  known-red-fixture.js` (file riêng, KHÔNG khớp glob `*.test.js` nên không bị `node --test`
  nhặt nhầm) mô phỏng 3 kịch bản (lỗi khớp / lỗi không khớp / thiếu `expectedError`), chạy qua
  **child process thật** (`execFileSync` trong `target-session-f2.test.js`) và assert đúng exit
  code — vì `test()` của `node:test` luôn RESOLVE promise kể cả khi test con fail (chỉ đổi exit
  code tiến trình), nên không thể tự-introspect pass/fail trong cùng process. **Bài học quy trình
  phát hiện giữa chừng:** khi tiến trình cha VÀ tiến trình con đều chạy `node --test`, cờ `--test`
  ở con làm sai lệch exit code (không phản ánh đúng pass/fail) — sửa bằng cách bỏ cờ `--test` ở
  con, chạy bare `node <file>` (file tự gọi `require('node:test').test()` nên không cần cờ CLI).
- **Codex remediation #2 phần 2 — mở rộng verifier**: `scripts/verify-gate1-mapping.mjs` trước đó
  chỉ ĐẾM số dòng known-red trong mapping, không đối chiếu với `g1b-allowlist.json`. Thêm: mỗi
  entry allowlist phải có đủ `id/owner/expiry/wave`, `expiry` chưa hết hạn, không trùng `id`; mỗi
  known-red row trong mapping phải có entry allowlist tương ứng; mỗi entry allowlist phải được ít
  nhất 1 known-red row tham chiếu (không mồ côi). Verify bằng thực nghiệm: xoá tạm `owner` khỏi 1
  entry → verifier FAIL đúng lý do; khôi phục → PASS.
- Verify tổng: `target-session-f2.test.js` 11/11 (SQLite), `target-n1-n2-explicit-permission.test.js`
  7/7; `test:integration:sqlite` 632 total/625 pass/7 skip (tăng đúng 4);
  `test:integration:mysql` 632 total/631 pass/1 skip (tăng đúng 4); `test:security` 6/6;
  `verify-g0.mjs` PASS 7/7; `test:verify-gate1-mapping` PASS 145/145, TODO=2, known-red=4
  (allowlist 4 entry, đã đối chiếu); `git diff --check` sạch. Chờ Codex re-audit theo 2 remediation
  trên để ACCEPT Bundle A chính thức.

## 2026-08-28 — Bundle A: Codex ACCEPT chính thức (sau remediation `163093b`)

- Codex re-audit remediation `163093b` và trả **ACCEPT** — không mở thêm vòng remediation nào.
  Xác nhận cả 2 MUST-FIX đã đúng: `bookings.owner_id` giờ được kiểm tra thật trong DB contract
  (khai báo trùng đã loại bỏ); known-red chỉ xanh khi lỗi khớp đúng target expectation, lỗi
  fixture/setup bị ném lại — self-test child-process đã kiểm chứng đủ 3 chiều (match/mismatch/
  thiếu expectation); mapping verifier đã đối chiếu 2 chiều với allowlist (thiếu field/hết hạn/
  trùng/mồ côi đều fail). Re-verify tại HEAD: SQLite 625 pass/7 skip, MySQL 631 pass/1 skip,
  security 6/6, G0 verifier PASS, gate-1 mapping 145/145 TODO=2 known-red=4 allowlist=4,
  `git diff --check` sạch (chỉ `.DS_Store` untracked).
- **Đóng chính thức (Codex ACCEPT Bundle A 2026-08-28):** G1A.4, G1A.5, G1A.8, G1B.3, G1B.4,
  G1B.5, G1B.6, và phần ENGINE của G1B.1/G1B.2 (không phải route-wiring — Codex nhấn mạnh rõ
  ràng trong verdict: "G1B.1/G1B.2 mới hoàn tất phần engine; chưa được đánh dấu đóng toàn gate
  cho tới khi có strangler route-wiring và target tests tương ứng").
- **Vẫn giữ nguyên phạm vi, không tự ý mở rộng theo verdict này:** F2/N1/N2 vẫn là target-red có
  kiểm soát (chưa phải lỗ hổng đã sửa — implement thật vẫn thuộc W1.7/Wave 1); route-wiring RBAC
  v2 cho 24/25 entity ngoài People Detail vẫn chưa làm, thuộc Wave 1 strangler slice tiếp theo,
  có thể cần xin owner nếu vượt phạm vi pilot đã duyệt (`02-decisions.md` §G).
- Cập nhật `04-ROADMAP.md`: đánh dấu XONG/Codex ACCEPT cho G1A.4/G1A.5/G1A.8/G1B.3/G1B.4/G1B.5/
  G1B.6; G1B.1/G1B.2 ghi rõ "ACCEPT phần engine, CHƯA đóng cả gate" để không hiểu nhầm sau này.

## 2026-08-28 — G1A.10: npm audit vá + regression test + CI `regression` job

- `npm audit` trước khi sửa: 3 lỗ hổng transitive — `body-parser<1.20.6` (DoS, GHSA-v422-hmwv-36x6),
  `nanoid<3.3.18` (High, vòng lặp vô hạn khi size=0, GHSA-2v37-7h3g-55p8),
  `postcss<=8.5.22` (Moderate, đọc file `.map` tuỳ ý, GHSA-fxqj-rqcc-2cmp). Không chạy
  `npm audit fix` mù: đọc source từng lỗ hổng trước.
- `body-parser` (duy nhất có đường chạy runtime thật — 2 gói kia chỉ là devDependency của
  postcss/tailwind/vite, `grep` xác nhận server không `require()` trực tiếp): đọc
  `node_modules/raw-body/index.js` xác nhận cơ chế đúng như advisory — `bytes.parse(limit)` trả
  `null` khi limit không hợp lệ, sau đó `readStream()` bỏ qua CẢ HAI điều kiện kiểm tra kích thước
  (`limit !== null && ...`) vì `limit === null` → size enforcement bị tắt hoàn toàn, không phải
  lỗi ở `raw-body` (không đổi version) mà ở `body-parser` không validate trước khi truyền `null`
  xuống. Bản vá 1.20.6 thêm `if (limit === null) throw new TypeError(...)` ngay lúc setup
  middleware (fail-fast).
- Áp dụng `npm audit fix` sau khi hiểu rõ cơ chế (patch-level, không đổi range trong
  `package.json`: body-parser 1.20.5→1.20.6, nanoid 3.3.16→3.3.18, postcss 8.5.19→8.5.26).
  `npm audit` sau vá: **0 vulnerabilities**.
- `server/test/unit-dependency-audit.test.js` (3 test): xác nhận `bodyParser.json({limit:
  'not-a-real-limit'})` throw đúng `TypeError` (bản vá hoạt động thật, không chỉ tin theo advisory
  suông); xác nhận cấu hình thật của app (`limit:'2mb'`) không bị ảnh hưởng (không regression);
  ghi chú rõ nanoid/postcss không cần test hành vi runtime vì không có đường chạy trong server.
- `.github/workflows/regression.yml` (mới) — job tên đúng `regression` khớp roadmap: service
  container MySQL 8.4 cấu hình khớp `docker-compose.yml` (user/password/database/root-password),
  chạy tuần tự `npm audit --audit-level=high` → `test:security` → `verify-g0.mjs` →
  `verify-g0-selftest` → `verify-gate1-mapping` → `test:integration:sqlite` →
  `test:integration:mysql` → `git diff --check`. Trigger `push` (main) + `pull_request`.
  **Chưa verify chạy thật trên GitHub Actions** (cần push/PR đầu tiên) — mọi lệnh bên trong đã
  verify xanh cục bộ riêng lẻ, nhưng bản thân workflow YAML (runner, service networking, cache)
  chỉ xác nhận được khi thực sự chạy trên GitHub.
- Verify cục bộ: `unit-dependency-audit.test.js` 3/3; `test:integration:sqlite` 635 total/628
  pass/7 skip (tăng đúng 3); `test:integration:mysql` 635 total/634 pass/1 skip (tăng đúng 3);
  `test:security` 6/6; `verify-g0.mjs` PASS 7/7; `test:verify-g0-selftest` 6/6;
  `test:verify-gate1-mapping` PASS 145/145 TODO=2 known-red=4; `npm audit` 0 vulnerabilities.

## 2026-08-29 — G1A.10 remediation: Codex CONDITIONAL ACCEPT, 2 MUST-FIX trên CI workflow

- Codex audit độc lập batch G1A.10 (commit `fdbd858`): xác nhận `npm ci` sạch, `npm audit` 0
  vulnerabilities, dependency test 3/3, production build Vite pass (6182 module), full
  regression khớp số liệu đã báo cáo, YAML parse hợp lệ. Verdict: **CONDITIONAL ACCEPT** — cần
  1 commit remediation nhỏ trên `.github/workflows/regression.yml` trước khi coi phần code/config
  là ACCEPT.
- **C1 (MUST-FIX):** `npm audit --audit-level=high` không khớp exit criterion "0 vulnerabilities"
  — một lỗ hổng mức low/moderate phát sinh sau này sẽ không làm CI fail. Sửa: bỏ `--audit-level`,
  dùng `npm audit` thuần (fail với bất kỳ vulnerability nào).
- **C2 (MUST-FIX):** CI chưa có step chạy build tool thật (`npm run build`) dù vừa nâng version
  nanoid/postcss — test `unit-dependency-audit.test.js` chỉ xác nhận server không `require()`
  trực tiếp 2 gói này, không chứng minh Vite/PostCSS build thật vẫn chạy được trên runner GitHub.
  Sửa: thêm step `npm run build` ngay sau `npm ci`.
- Vá cả 2 trong commit `09a40c3`. Verify local trước khi commit: `npm run build` → 6182 module
  transformed, output `public/assets/` khớp byte-for-byte bản đã commit (`git diff` sạch, build
  không làm bẩn working tree vì `outDir` build lại đúng nội dung đã có); `npm audit` (không
  audit-level) vẫn 0 vulnerabilities; YAML re-parse bằng `python3 yaml.safe_load` xác nhận cấu
  trúc/thứ tự step đúng, `on:` vẫn là string key (đã quote từ G1A.10 gốc). Không chạy lại full
  integration suite — remediation chỉ đổi CI-workflow config, không chạm server code/test contract
  (khớp `17-fast-track-collaboration.md` §4 dòng "remediation chỉ sửa tài liệu": broken-link/
  parser/verifier/diff check tương ứng là đủ).
- **Chưa CLOSE G1A.10:** Codex nêu rõ điều kiện đóng cuối cùng là owner phải `push` và có ít nhất
  1 GitHub Actions run xanh thật — YAML parse/verify cục bộ không thể xác nhận MySQL service
  container hay runner Actions hoạt động đúng. Việc này cần owner action (push), không phải việc
  Claude có thể tự làm mà không xin phép.

## 2026-08-30 — G1A.10 CLOSED: GitHub Actions run xanh thật + fix lệch môi trường MySQL

- Owner đồng ý push nhánh `ci/g1a10-regression-workflow` lên remote `misa` và mở PR #1
  (`ci/g1a10-regression-workflow` → `main`) để kích hoạt trigger `pull_request` của
  `regression.yml` (trigger `push` chỉ áp dụng nhánh `main`, không tự chạy khi push nhánh khác).
- **Lần chạy đầu tiên FAIL thật** (run
  [`33264742127`](https://github.com/tuannhh/MISA-workstation/actions/runs/33264742127), commit
  `3d26864`): `test:integration:mysql` fail đúng 1 test —
  `server/test/smoke-failure.test.js` ("DB init failure sau khi worker đã spawn"), kỳ vọng
  `stderr` khớp `/Unknown database/i` nhưng thực tế nhận `Access denied for user 'pr_media'@'%'
  to database 'pr_media_test_never_created_...'`.
- Điều tra root cause bằng `docker compose exec db mysql -uroot ... -e "SHOW GRANTS FOR
  'pr_media'@'%'"` trên máy dev cục bộ: phát hiện 1 `GRANT ALL PRIVILEGES ON
  \`pr_media_test_%\`.* TO 'pr_media'@'%'` — GRANT wildcard này là tàn dư từ một thiết kế cũ hơn
  (bản kế hoạch ban đầu của G1A.1 từng đề xuất grant wildcard idempotent kiểu này trước khi
  `db-harness.js` được refactor sang grant đúng tên database cụ thể mỗi lần
  `createMysqlTestDb()`), không nằm trong code/harness/docker-compose hiện tại — chỉ tồn tại vì
  container MySQL dev cục bộ đã chạy liên tục nhiều ngày, chưa từng bị xoá volume.
  Container MySQL của GitHub Actions luôn khởi tạo sạch từ `services.mysql` trong
  `regression.yml`, chỉ có đúng quyền `MYSQL_USER=pr_media`/`MYSQL_DATABASE=pr_media` do MySQL
  Docker image tự cấp — đúng mô hình least-privilege khớp `docker-compose.yml`/production thật.
  Với quyền đó, MySQL trả `Access denied` TRƯỚC khi kịp kiểm tra database có tồn tại hay không
  (vì user chưa từng có bất kỳ privilege nào khớp tên database ngẫu nhiên đó) — đây là hành vi
  MySQL đúng, không phải bug trong `body-parser`/`db.js`/harness.
- **Quyết định của owner:** đây là khác biệt môi trường hợp lệ (container sạch theo
  least-privilege ⇒ `Access denied`; máy dev có GRANT thừa cũ ⇒ `Unknown database`), cả 2 đều
  chứng minh đúng mục tiêu test (DB init thất bại rõ ràng, process thoát khác 0, không âm thầm
  seed nhầm/PASS giả). Sửa assertion chấp nhận cả 2 thông điệp
  (`/Access denied|Unknown database/i`). **Không sửa GRANT MySQL, không nới quyền, không đổi
  harness/docker-compose** — giữ nguyên mô hình least-privilege hiện tại làm chuẩn.
- Vá trong commit `f9c57ee`. Verify lại trước khi push: `smoke-failure.test.js` chạy riêng 6/6
  pass (1 skip SQLite-only); `test:integration:sqlite` 628/635 pass 7 skip;
  `test:integration:mysql` 634/635 pass 1 skip; `git diff --check` sạch.
- **Run xanh thật:**
  [`33264995903`](https://github.com/tuannhh/MISA-workstation/actions/runs/33264995903), commit
  `f9c57ee`, `conclusion: success` — job `regression` (npm audit, npm run build, test:security,
  verify-g0, verify-gate1-mapping, test:integration:sqlite/mysql, git diff --check) đều pass trên
  runner GitHub Actions thật, không chỉ verify cục bộ.
- **G1A.10 CLOSED 2026-08-30.** Không có backlog P2/P3 mới phát sinh từ đợt fix này — GRANT thừa
  trên máy dev cục bộ là môi trường cá nhân, không phải trạng thái cần dọn theo yêu cầu owner.

## 2026-08-30 — G1C.1: khung E2E acceptance theo 4 vai trò (định nghĩa, chưa viết test)

- `memory-bank/19-g1c-e2e-acceptance-framework.md` (mới) — đúng yêu cầu roadmap "không viết test
  trước W1, chỉ định nghĩa khung ở Gate 1". Chốt công cụ Playwright (lý do: multi-context test RBAC
  chéo vai trò, device emulation trùng ma trận viewport W4.2, `APIRequestContext` seed dữ liệu qua
  API thật giống triết lý integration test hiện có, không phụ thuộc router cụ thể — hoạt động được
  cả với `location.hash` hiện tại của `app.js` lẫn router thật nếu Wave 3 đổi kiến trúc).
  **Chưa cài `@playwright/test`** vào `package.json` — để dành cho lúc viết test thật đầu tiên
  (Wave 3, slice People Detail), tránh tải browser binary ~500MB cho một quyết định thuần tài liệu.
- Quy ước thư mục `e2e/journeys/<role>.spec.js` + 4 journey đại diện đúng ranh giới D13.1
  (`02-decisions.md` §D) mỗi vai trò — không lặp lại toàn bộ CRUD (đã phủ G1A/G1B), chỉ chứng minh
  UI thật sự gọi đúng PolicyEngine qua 1 đại diện/vai trò. Khối `Native-Mobile` mỗi journey giữ
  `test.fixme()` tới khi W4.1 (WebView-host runtime) hạ cánh — Native-Mobile composition hiện chưa
  tồn tại cho bất kỳ flow nào (F5, `FAIL/MISSING` toàn bộ, xem `08-permission-matrix.md` §B.3).
- Cố tình **không** thêm `e2e/` hay script `test:e2e` vào `.github/workflows/regression.yml` — chạy
  CI cho một bộ toàn `test.fixme()` không chứng minh gì thêm ngoài "file tồn tại", trong khi cài đặt
  Playwright thật nên làm cùng lúc với slice có test thật đầu tiên.
- Verify: `node scripts/verify-g0.mjs` vẫn PASS sau khi thêm file thứ 21 vào `memory-bank/`
  (`docs.length` đọc động bằng `readdirSync`, không hardcode số lượng); `git diff --check` sạch.
- Cập nhật `04-ROADMAP.md` dòng G1C.1: "khung ĐÃ ĐỊNH NGHĨA", không đổi Exit Contract (vẫn "GREEN
  sau W1, không phải điều kiện mở W1" — chưa tuyên bố G1C xong).

## 2026-08-30 — G1.8: harness đo baseline hiệu năng F7 (artifact thật, không kết luận pass/fail)

- `scripts/perf-baseline.mjs` (mới, `npm run perf:baseline`): fail-closed `DB_CLIENT=mysql` +
  `ALLOW_TEST_DB_CREATE=1` (đúng lý do F7 — SQLite không đi qua `Atomics.wait`, đo trên SQLite sẽ
  cho số liệu không đại diện); tạo database MySQL test tạm qua `db-harness.js`, seed 50 tổ chức/200
  người/500 tương tác/1 file, chạy workload trọng số read 55/write 15/report 20/file 10 ở 5 mức
  concurrency (1/5/10/20/50), mỗi mức warm-up 3s (bỏ số liệu) rồi sustained 8s (đo thật); dùng
  `monitorEventLoopDelay()` (`node:perf_hooks`) đo lag event-loop song song với latency HTTP.
- **Bug tự phát hiện khi chạy thật (không phải lúc smoke-test tham số nhỏ):** process không bao giờ
  tự thoát sau khi ghi artifact + drop xong database test — do `main()` không gọi `closeDb()`
  (`server/db.js`), nên worker thread MySQL (`mysql-sync.js`) vẫn giữ 1 connection sống, giữ event
  loop chạy vô thời hạn. Phát hiện qua `SHOW FULL PROCESSLIST` thấy connection `Sleep` không đóng dù
  script đã in dòng `Artifact: ...` cuối cùng. Sửa: gọi `closeDb()` trong khối `finally`, TRƯỚC
  `dropMysqlTestDb()`. Đã kill 2 process treo từ trước khi sửa (1 từ smoke-test tham số nhỏ chạy
  đầu phiên, 1 từ lần chạy thật đầu tiên) — xác nhận cả hai đều đã cleanup xong dữ liệu (database
  test đã bị drop, không rò tài nguyên) trước khi bị treo, chỉ là process không thoát; không có mất
  dữ liệu hay rò rỉ.
- Artifact thật (`memory-bank/perf-baseline/2026-08-30T02-28-53-029Z.json`, Apple M1 Pro 8 core/16GB,
  `gitSha=2b7076b`): throughput plateau quanh 44-55rps bất kể concurrency tăng 1→50 (không tăng
  tuyến tính theo tải), latency p50 tăng gần tuyến tính 6.31ms (c=1) → 912.36ms (c=50), errorRate=0
  ở mọi mức. Khớp đúng dự đoán F7 trong `01-audit-findings.md`: nghẽn cổ chai không phải do lỗi
  ứng dụng mà do kiến trúc — `server/mysql-worker.js:25` dùng **đúng 1 `mysql.createConnection()`**
  (không phải pool) cộng `Atomics.wait` chặn main thread mỗi query, nên mọi request serialize qua
  1 connection dù concurrency HTTP tăng bao nhiêu.
- Đây là công cụ ĐO, không kết luận pass/fail (đúng Evidence Contract G1.8) — ngưỡng SLO/topology
  production thật do DevOps chốt ở W2.3; artifact này chỉ cung cấp số đo trung thực để tham chiếu.
- Verify: `node scripts/verify-g0.mjs` PASS, `git diff --check` sạch.
- Cập nhật `04-ROADMAP.md` dòng G1.8: "XONG 2026-08-30" kèm số liệu tóm tắt.

## 2026-08-30 — G1.8 remediation: Codex round 1 PARTIAL → 3 vấn đề đã sửa (commit `436bbe4`)

Codex audit artifact/harness G1.8 ở trên, kết luận **PARTIAL** với 3 việc cần sửa:

1. **Rò file test vào dữ liệu thật.** Script không gọi `setupTestDataDir()` trước khi require
   `server/db.js`, nên `UPLOAD_DIR` trỏ thẳng vào `data/uploads/` thật của repo thay vì thư mục
   tạm — mỗi lần chạy (kể cả 2 lần smoke-test tham số nhỏ trước đó) ghi 1 file dummy thật vào đây.
   Đã quarantine cả 4 file (không xoá, theo yêu cầu Codex) tại
   `data/uploads/.quarantine-perf-baseline-leak/` kèm `MANIFEST.md` giải thích nguyên nhân + xác
   nhận không có row `attachments` nào trong database `pr_media` thật tham chiếu tới (bảng đó
   chưa tồn tại trên MySQL local — rò rỉ chỉ là file vật lý mồ côi, không kèm dữ liệu DB).
2. **`closeDb()` bị nuốt lỗi.** Bản trước dùng `.catch(() => {})` — nếu worker đóng lỗi, script
   vẫn báo thành công. Sửa: dùng `server/test-support/resource-stack.js` đúng pattern chuẩn của
   dự án (`server/test/integration-ai.test.js`) — `acquire()` theo đúng thứ tự
   `setupTestDataDir()` → `createMysqlTestDb()` → `closeDb` → `startTestApp().close`, sau đó
   `cleanupAll()` dọn LIFO (đóng HTTP → đóng worker MySQL → drop DB tạm → dọn `DATA_DIR`) và
   **không nuốt lỗi** — ném `AggregateError` nếu bất kỳ bước dọn nào thất bại.
3. **Số liệu roadmap ghi hơi sai.** Artifact cũ có throughput 43.51/34.85/44.98/53.72/44.05rps
   (dải thật ~35–54), nhưng roadmap ghi "~44-55rps" — đã xoá artifact đó (SHA không khớp commit
   remediation), chạy lại theo harness đã sửa, ghi đúng số đo mới của artifact cuối cùng.

Verify sau fix (đúng 4 tiêu chí Codex yêu cầu): smoke-test tham số nhỏ + full run thật đều
`exit code 0` (process tự thoát, không cần kill); `SHOW DATABASES LIKE 'pr_media_test_%'` không
còn database của lần chạy; `data/uploads/*.txt` (ngoài quarantine) rỗng sau khi chạy; artifact mới
`memory-bank/perf-baseline/2026-08-30T03-21-15-737Z.json` có `gitSha=436bbe4` khớp đúng commit
remediation. Kết quả đo cuối: throughput ~47–69 rps không tăng theo concurrency (1→50), latency p50
tăng tuyến tính 3.4ms→832ms, errorRate=0 — kết luận F7 (nghẽn cổ chai 1 connection + Atomics.wait)
không đổi.

## 2026-08-30 — G1.8 remediation round 2: Codex re-audit PARTIAL → rò DATA_DIR khi bootstrap MySQL lỗi (commit `018c7af`)

Codex re-audit round 2 phát hiện 1 MUST-FIX còn sót từ round 1: `resources.acquire(dbHarness
.setupTestDataDir().teardown)` và `await dbHarness.createMysqlTestDb()` vẫn nằm **NGOÀI**
`try/finally` trong `main()`. Nếu bootstrap MySQL lỗi (vd sai mật khẩu admin) ngay ở bước
`createMysqlTestDb()`, exception ném ra TRƯỚC khi vào `try`, nên khối `finally { await resources
.cleanupAll() }` không bao giờ chạy — thư mục `DATA_DIR` tạm (`pr-media-test-*`) đã tạo ở dòng
trước đó bị rò. Codex tái hiện bằng cách set `TEST_MYSQL_ADMIN_PASSWORD` sai, đo được số thư mục
tăng thêm 1 sau mỗi lần chạy lỗi (tự dọn sau khi audit xong).

Fix hẹp đúng như Codex đề nghị: chuyển cả 2 dòng (`setupTestDataDir().teardown` + `createMysqlTestDb()`)
vào bên trong `try`, giữ nguyên toàn bộ phần còn lại và `finally { await resources.cleanupAll() }`
— giờ dù lỗi xảy ra ở bất kỳ bước nào (kể cả bootstrap MySQL), resource-stack vẫn dọn đúng những gì
đã acquire thành công trước đó.

Thêm regression failure-path mới `server/test/perf-baseline-failure.test.js`: spawn thật
`scripts/perf-baseline.mjs` (không phải gọi hàm harness đơn lẻ) với `TEST_MYSQL_ADMIN_PASSWORD` sai,
assert `exit code != 0` VÀ số thư mục `pr-media-test-*` trong `os.tmpdir()` trước/sau không đổi —
chứng minh đúng hành vi end-to-end, không chỉ đơn vị. Test này vào `server/test/`, chạy tự động
trong `test:integration:mysql`, skip dưới SQLite.

Verify sau fix: `test:security` 6/6, `test:integration:sqlite` 632 pass/8 skip,
`test:integration:mysql` 639 pass/1 skip (đã cộng thêm 1 test failure-path mới),
`test:verify-gate1-mapping` 145/145 route + 253 rows, `verify-g0.mjs` PASS, `git diff --check`
sạch — không hồi quy so với baseline Codex đo trước đó (632/638). Chạy lại full baseline thật lần
cuối sau commit `018c7af`: artifact mới `memory-bank/perf-baseline/2026-08-30T03-44-04-278Z.json`
(`gitSha=018c7af` khớp đúng commit remediation round 2) — cả 4 tiêu chí Codex yêu cầu đều đạt: process
tự thoát (exit 0), không còn database test sót lại, không có file mới trong `data/uploads/`, SHA
khớp commit. Kết quả đo: throughput ~49–61 rps không tăng theo concurrency, latency p50 tăng tuyến
tính 4.4ms→889ms, errorRate=0 — kết luận F7 không đổi qua cả 3 lần chạy (round gốc, round 1, round 2).

## 2026-08-30 — G1A.6: UI characterization smoke toàn bộ module (Codex)

- Thêm `server/test/ui-characterization.test.js` với 4 rule `UI-CHAR-001..004`, script
  `npm run test:ui-characterization` và mapping join được trong `gate1-test-mapping.md`.
  Test khóa 14 module desktop, contract Vue shell ↔ legacy `app.js`, 34 flow/145 route và trạng
  thái `N-MISSING` cho hai role; nó chủ đích phân biệt **characterization xanh** với MDS/native pass.
- Runtime browser với `DATA_DIR` tạm: quản lý phòng mở đủ 14 hash root; chuyên viên bị ẩn Báo cáo/
  Quản trị và direct hash quay về Dashboard; ở 375×812 vẫn là desktop shell responsive, không có
  `.mds-mobile-app` hay bottom nav. Evidence và đường đi Wave 3/4 ở
  [`20-ui-characterization.md`](20-ui-characterization.md).
- Checkpoint: SQLite 632/639 pass (7 skip), MySQL 638/639 pass (1 skip), security 6/6,
  `verify-g0.mjs` và Gate-1 mapping đều PASS (145/145 route, 253 rows, TODO=2, known-red=4).
  G1A.6/Gate 1 test-net đóng; **F5 Native-Mobile vẫn P0 FAIL/MISSING**, không thay đổi điều kiện
  release MDS/native thật.

## 2026-08-30 — G1.8 CLOSED: Codex ACCEPT sau 2 vòng remediation

Codex re-audit round 2 (commit `018c7af`): **ACCEPTED — G1.8 CLOSED.** Chạy độc lập
`server/test/perf-baseline-failure.test.js` 1/1 pass (ép MySQL bootstrap lỗi, script exit khác 0,
số thư mục `pr-media-test-*` không đổi); `verify-g0.mjs` + Gate 1 mapping xanh (145/145 route, 253
mapped, TODO=2, known-red=4 có allowlist); artifact `2026-08-30T03-44-04-278Z.json` có `gitSha=
018c7af` đúng commit sửa; throughput 48.84–61.24rps, p50 tăng 4.38ms→889.4ms khi concurrency 1→50.
**Chốt rõ:** F7 (1 connection MySQL + `Atomics.wait` chặn main thread) **vẫn là backlog hiệu năng
cho Wave 2.3/2.4** — có artifact đo không có nghĩa là đã xử lý tận gốc; ngưỡng SLO/topology
production do DevOps chốt ở W2.3, quyết định fix/không fix (pool hoá, worker pool, v.v.) thuộc
W2.4 nếu SLO không đạt. Không cần sửa thêm trong phạm vi G1.8.

**Exit gate G1 — soát lại lần cuối sau khi G1A.6 + G1.8 đều CLOSED:** (a) mapping 145/145 — PASS;
(b) G1A GREEN đầy đủ — **G1A.1–.10 đều XONG/CLOSED, bao gồm cả G1A.6 (Codex)**; (c) G1B mọi RED có
allowlist hợp lệ — PASS (Bundle A 2026-08-28); (d) G1C khung đã định nghĩa — PASS (G1C.1); (e)
G1.8 có artifact — PASS (CLOSED, Codex ACCEPT). **Không còn mục nào treo — toàn bộ 5 điều kiện Exit
gate G1 đã đạt**, cả phần Claude lẫn phần Codex (G1A.6). Chuyển sang Wave 1 theo phạm vi owner đã
duyệt (`02-decisions.md` §G: foundation fail-closed + pilot slice People Detail).

## 2026-08-30 — Wave 1 bắt đầu: batch RBAC-PILOT2-people-write (People Detail chuyển sang WRITE)

Trước khi code, soát lại state hiện có (vì `02-decisions.md` §G ghi rõ nhiều phần Wave 1 nền tảng
đã lên TRƯỚC khi Gate 1 đóng, theo ngoại lệ phạm vi hẹp): `field_visibility` table,
`owner_id`/`created_by` trên 13/14 bảng "hoạt động", `policy-engine.js`/`policy-service.js`/
`policy-visibility-store.js` (PolicyEngine + choke point command/projection), `auth.resolvePrincipal`
(W1.1) và pilot `GET /api/people/:id` (D13-011, đọc field theo `field_visibility`) đều đã tồn tại
và có test — tài liệu đầy đủ ở `18-g1b-rbac-batch-contract.md`. `npm run rbac:preflight` xác nhận
`readyToFlipFailClosed=false` (đúng dự kiến — chưa backfill owner/visibility cho dữ liệu thật, và
database MySQL local `pr_media` thật ra CHƯA từng được khởi tạo ngoài các database test tạm dùng-rồi-xoá
của harness — không có dữ liệu thật cục bộ nào ở rủi ro).

Theo đúng thứ tự bắt buộc trong batch contract ("Chuyển People Detail end-to-end: read, write,
file"), viết Batch Contract `RBAC-PILOT2-people-write` rồi mở rộng pilot sang WRITE:

- `server/routes.js`: bỏ `requirePerm('partners','edit'|'delete')` khỏi khai báo route `PUT`/
  `DELETE /people/:id` (y hệt cách R030/GET đã làm), chuyển kiểm tra vào trong handler — role D13
  (`viewer`/`executor`/`admin`) đi qua `policyService.assertWritable({principal, entity:'person',
  action})` (throw `PolicyForbiddenError` → 403 rõ ràng, không silent-strip, đúng nguyên tắc D1);
  role legacy (`super_admin`/`pr_staff`) giữ nguyên 100% nhánh `rbac.can()` + `stripDisallowed()` cũ.
- `person` là **Global** (D13.4a, danh bạ dùng chung) — `canWrite` không đọc `owner_id` của bản ghi
  (people không có cột này), chỉ xét role+action: executor PUT luôn 200 (Global edit, không cần là
  "chủ" bản ghi — D13-P1 owner-approved), executor DELETE luôn 403 (D13.1: Nhân viên thực thi không
  có quyền xoá dù là Global — chỉ Admin/Super Admin). Field-level write KHÔNG bị gate theo
  `classification_tier` (D13.2b: authorization tách khỏi audience_visibility — quyết định có chủ
  đích, không phải lỗ hổng).
- 4 test dual-driver mới (`D13-012..015`, `server/test/integration-people.test.js`): viewer PUT/DELETE
  403; executor PUT 200 + DELETE 403; admin (target role, khác `super_admin` legacy) PUT+DELETE đều
  200. Test R032/R033 cũ giữ nguyên nguyên văn, xác nhận vẫn pass (legacy không đổi hành vi).
- Route catalog: cập nhật R032/R033 trong `07-route-catalog.md` theo đúng carve-out đã dùng cho
  R030, đăng ký `PUT`/`DELETE /api/people/:id` vào `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES`
  (thiếu bước này làm `verify-g0.mjs` FAIL đúng như thiết kế — script không tự suy diễn module/action
  từ thân handler).

Verify: `test:security` 6/6, `test:integration:sqlite` 636 pass/8 skip, `test:integration:mysql`
643 pass/1 skip (+4 so với trước batch), `test:verify-gate1-mapping` 145/145, `verify-g0.mjs` PASS,
`git diff --check` sạch. Không đổi hành vi UI (Codex lane), không đổi bất kỳ pilot slice nào ngoài
People Detail, không cutover role hàng loạt.

**Còn lại của "People Detail end-to-end"**: W1.FILE (visibility gate cho attachments của person) —
batch kế tiếp.

## Wave 1 tiếp tục: batch RBAC-PILOT3-people-file (attachments person chuyển sang WRITE + gate đọc)

Theo đúng thứ tự bắt buộc trong batch contract, viết Batch Contract `RBAC-PILOT3-people-file` rồi
nối nốt phần "file" của "People Detail end-to-end":

- `server/policy-engine.js`: thêm `ATTACHMENT_VISIBILITY_CEILING` (`id_doc: 'private'`, `portrait:
  'public'`) + `attachmentVisibilityCeiling(kind)` + `canSetAttachmentVisibility(kind, visibility)`
  (trần D13.3b — **tuyệt đối, không có nhánh bypass cho Admin/Super Admin**, khác hẳn `canWrite`) +
  `canReadAttachment({principal, kind, audienceVisibility})` (Admin/Super Admin bypass; `id_doc`
  luôn false cho vai trò khác; `portrait` chỉ đọc được nếu `audience_visibility='public'`). Vì
  `person` là Global (D13.4a) — không có `owner_id` — hàm này **không có nhánh executor-owns-record**
  như `canReadField` dành cho Direct/Inherited: file `private` chỉ Admin/Super Admin xem được, kể cả
  chính người vừa upload.
- `server/routes.js`: `POST /people/:id/attachments`, `PUT /people/:id/attachments/:aid/primary` đổi
  middleware `requirePerm('partners','edit')` → `personEditGate` (dual-branch: role D13 gọi
  `policyService.assertWritable(entity:'person',action:'edit')`, legacy giữ nguyên `requirePerm` cũ).
  `DELETE /attachments/:aid` bỏ hẳn middleware, chuyển kiểm INLINE trong handler — route này phục vụ
  **nhiều owner_type** (award/supplier/event...), nên role D13 đụng attachment không phải của
  `person` bị **fail-closed 403** (chưa có policy slice riêng cho các entity đó, không tự suy diễn).
  `GET /files/:id` thêm nhánh D13 dùng `canReadAttachment` (đồng thời giữ audit `VIEW_SENSITIVE` khi
  Admin/Super Admin xem `id_doc`, y hệt tinh thần audit cũ). `POST /people/:id/attachments` cho role
  D13 nhận thêm `?visibility=public|private` (seam kỹ thuật, KHÔNG phải UI — UI thuộc lane Codex),
  validate qua `canSetAttachmentVisibility` trước khi ghi, từ chối rõ ràng (400) nếu vượt trần —
  không silent-clamp.
- `GET /people/:id` nhánh D13 (trước đây trả `portraits:[]/idDocs:[]` tạm ở batch RBAC-PILOT2) nay
  trả dữ liệu attachments thật, lọc qua `canReadAttachment`; `idDocCount` vẫn đúng số lượng cho mọi
  role (đúng D13.4b "mọi role thấy sự tồn tại bản ghi") nhưng mảng `idDocs` rỗng nếu không phải
  Admin/Super Admin (không thấy nội dung).
- 9 test dual-driver mới (`D13-016..024`, `server/test/integration-people.test.js`): viewer 403 trên
  upload/set-primary/delete; executor upload private mặc định → chính executor cũng không thấy lại
  (không có owner bypass trên Global); upload `visibility=public` → thấy lại được; executor upload
  id_doc → 403 (chỉ Admin/Super Admin); admin upload id_doc → executor thấy `idDocCount` nhưng
  `idDocs` rỗng, admin thấy đủ; admin upload id_doc kèm `visibility=public` vẫn 400 (trần D13.3b
  không có ngoại lệ Admin); `GET /files/:id` executor 403 trên id_doc + 200 trên portrait public,
  admin 200 cả hai; executor set-primary/delete ảnh chân dung OK (Global edit) nhưng DELETE id_doc
  vẫn 403; `DELETE /attachments/:aid` fail-closed 403 khi `owner_type` khác person (test tự insert
  1 row `owner_type='award'` qua `db` để xác nhận). Test R034/R035/R036/R037 cũ giữ nguyên nguyên
  văn, xác nhận vẫn pass (legacy không đổi hành vi).
- Route catalog: cập nhật R034/R035/R036 trong `07-route-catalog.md` theo đúng carve-out đã dùng cho
  R030/R032/R033, đăng ký cả 3 route vào `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES`; sửa lại
  line-number tham chiếu của R030/R032/R033 cho khớp vị trí mới trong `routes.js` (bị dịch do thêm
  code populate portraits/idDocs vào `GET /people/:id`).

Verify: `test:security` 6/6, `test:integration:sqlite` 645 pass/8 skip, `test:integration:mysql`
652 pass/1 skip (+9 so với trước batch), `test:verify-gate1-mapping` 145/145, `verify-g0.mjs` PASS,
`verify-g0-selftest` 6/6, `git diff --check` sạch. Không đổi hành vi UI (Codex lane), không đổi bất
kỳ pilot slice nào ngoài People Detail, không cutover role hàng loạt.

**"People Detail end-to-end" (read, write, file) nay đã đủ cả 3 phần.** Bước tiếp theo theo đúng
thứ tự `18-g1b-rbac-batch-contract.md`: acceptance money/supplier/booking/event — cần hỏi lại owner
trước khi mở rộng pilot slice mới (`02-decisions.md` §G).

## Codex ACCEPT: People Detail end-to-end (read/write/file) CLOSED cho phạm vi pilot D13

Codex xác nhận batch `ace15fc..b291b41` đúng scope, legacy 2-role giữ nguyên, role mới đi qua
PolicyEngine và fail-closed. Evidence tự kiểm: write gate `routes.js:452`; file upload/primary/
delete `routes.js:496`; file download chặn owner_type ngoài `person` `routes.js:591`; trần
`id_doc=private`/`portrait=public` server-derived `policy-engine.js:52`. Experiment: 47/47 pass
`integration-people.test.js` cả SQLite lẫn MySQL, unit PolicyEngine 10/10, security 6/6, mapping +
G0 xanh. Risk ghi nhận (không phải do batch này tạo ra): `R034` cho phép upload với person ID
không tồn tại là hành vi legacy đã characterization từ trước — không mở rộng sửa trong pilot để
tránh đổi contract ngoài scope. Quyết định: dừng trước slice money/supplier/booking/event là đúng
§G, cần owner xác nhận trước khi mở slice mới.

## Wave 1 nhánh security: batch W1.7 session hardening (F2 — implement thật seam đã có target-red)

Vì slice pilot mới cần owner xác nhận trước, tiếp tục nhánh W1 độc lập với quyết định đó: implement
thật F2 (session hardening) mà G1B.3 đã viết target-red từ trước (`server/test/target-session-f2.
test.js`, known-red `F2-fixation`/`F2-ratelimit`).

- `server/app.js`: fail-fast (`throw`) nếu `NODE_ENV=production` mà thiếu `SESSION_SECRET` — không
  còn âm thầm rơi về default `'misa-pr-dev-secret-change-me'` trên production. `app.set('trust
  proxy', 1)` + `cookie.secure=true` khi production (Cloud Run/reverse proxy chấm dứt TLS trước
  app, cần trust proxy để express-session nhận đúng request là HTTPS qua `X-Forwarded-Proto`).
- `server/auth.js`: `login()` gọi `req.session.regenerate()` SAU khi xác thực thành công, trước khi
  gán `req.session.user` — đổi hẳn session id, chặn session fixation (attacker cắm sẵn cookie cho
  nạn nhân trước khi nạn nhân đăng nhập). Audit mở rộng: thêm `LOGIN_FAILED` (trước chỉ audit
  `LOGIN` thành công) và `LOGOUT` (ghi trước khi `session.destroy()` vì sau đó không còn đọc được
  `req.session.user`).
- `server/login-rate-limiter.js` (mới, pure): chặn brute-force `/api/login` — 429 sau 5 lần sai
  liên tiếp trong 15 phút theo khoá `IP:username` (không chỉ IP, để không khoá nhầm cả văn phòng
  dùng chung 1 IP khi chỉ 1 tài khoản bị tấn công). In-memory, đủ cho single-instance hiện tại;
  seam tách riêng để thay bằng store dùng chung (Redis) sau này nếu cần multi-replica — quyết định
  đó thuộc DevOps (O4), không phải batch này.
- `F2-fixation`/`F2-ratelimit` promote từ known-red (G1B.6) sang assertion xanh thật trong
  `target-session-f2.test.js`; xoá 2 entry khỏi `memory-bank/g1b-allowlist.json`. Đồng thời sửa
  self-test khung known-red (dùng `N1-explicit-action`/`N2-dashboard-permission` làm ví dụ hợp lệ
  thay vì 2 entry F2 vừa xoá) và `known-red-fixture.js` (đổi id fixture nội bộ sang
  `N1-explicit-action`) — cả hai vẫn valid vì chỉ dùng id để test khung, không phụ thuộc nội dung
  F2 thật.
- 2 test mới trong `target-session-f2.test.js`: login sai mật khẩu ghi `audit_log` action=
  `LOGIN_FAILED`; logout ghi `audit_log` action=`LOGOUT`.
- File mới `server/test/integration-session-production.test.js` (2 test, cô lập tiến trình vì phải
  toggle `NODE_ENV`/`SESSION_SECRET` + xoá `require.cache`): `createApp()` throw khi production
  thiếu secret; cookie session có thuộc tính `Secure` khi production (gửi kèm header
  `x-forwarded-proto: https` để mô phỏng đúng hành vi Cloud Run thật — express-session chỉ set
  `cookie.secure` khi `req.secure===true`, không set được nếu test chỉ gọi qua HTTP trần).
- Route catalog / mapping: cập nhật `memory-bank/gate1-test-mapping.md` (F2-fixation/F2-ratelimit
  chuyển `known-red`→`green`, thêm 4 dòng mới F2-audit-login/F2-audit-logout/F2-failfast-secret/
  F2-secure-cookie); `memory-bank/01-audit-findings.md` §F2 đánh dấu "MỘT PHẦN CLOSED" (durable
  session store vẫn chờ DevOps O4); `memory-bank/13-deployment-runbook.md` thêm hàng `NODE_ENV` và
  sửa hàng `SESSION_SECRET` (không còn "KHÔNG fail-fast").

**Còn lại của F2 (không thuộc batch này, đã ghi rõ trong roadmap):** durable session store (SQL/
Redis) thay MemoryStore — chờ DevOps chọn implementation (O4→DevOps), chỉ thật sự cần khi
multi-replica hoặc muốn tránh mất session lúc Cloud Run redeploy/cold-start.

Verify: `test:security` 6/6, `test:integration:sqlite` 649 pass/8 skip, `test:integration:mysql`
656 pass/1 skip (+7 so với trước batch: 2 promote known-red→green + 5 test mới), `test:verify-
gate1-mapping` PASS (257 mapped rows, known-red còn lại N1/N2 — không liên quan F2), `verify-g0.mjs`
PASS, `verify-g0-selftest` 6/6, `git diff --check` sạch. Không đổi UI (Codex lane), không đổi RBAC
pilot slice nào — batch này độc lập hoàn toàn với D13/PolicyEngine.

## Wave 1 nhánh security: batch W1.9 aiGateway reliability (F8 — timeout/retry/capability-map)

Tiếp tục nhánh W1 security (độc lập RBAC, không cần owner quyết định gì thêm — roadmap ghi rõ
"không cần O8"): implement F8 (Gemini reliability), phần còn lại của aiGateway sau W1.7.

- `server/gemini.js` `call()`: thêm `AbortController` timeout mỗi lời gọi (`GEMINI_TIMEOUT_MS`,
  mặc định 30s) — trước đây `fetch` trần không timeout, có thể treo vô thời hạn nếu Gemini không
  phản hồi. Thêm retry tối đa 3 lần (1 lần đầu + 2 retry) CHỈ cho HTTP 429 (rate-limit) và 5xx (lỗi
  phía Gemini) — backoff `GEMINI_RETRY_BASE_DELAY_MS * lần_thử` (mặc định 250ms). KHÔNG retry lỗi
  4xx khác (400/403...) vì sẽ chỉ lặp lại đúng lỗi đó vô ích; KHÔNG tự retry lỗi mạng/timeout
  (fetch reject, kể cả AbortError) vì batch này chỉ retry dựa trên response status đã nhận được,
  không đoán một lỗi network là transient.
- Capability-map (F8 phần "sampling params deprecated"): `supportsSamplingParams(model)` — allowlist
  hiện chỉ có `gemini-3.5-flash` (model pin hiện tại); `buildGenerationConfig(model, config)` strip
  `temperature`/`topP`/`topK` (và alias snake_case) khỏi `generationConfig` cho model ngoài
  allowlist, giữ nguyên field khác (`responseMimeType`/`responseSchema` không phải sampling param).
  `genText`/`genJSON`/`groundedSearch` đi qua hàm này; `genImage` không đổi (chưa từng gửi sampling
  params). Vì model pin hiện tại NẰM TRONG allowlist, hành vi hiện có không đổi — capability-map chỉ
  có tác dụng khi W2.6 đổi model mà quên cập nhật allowlist (fail-safe mặc định false, không đoán
  model mới hỗ trợ).
- `server/config.js` thêm `GEMINI_TIMEOUT_MS`/`GEMINI_RETRY_BASE_DELAY_MS` (env-configurable, cùng
  quy ước `MYSQL_QUERY_TIMEOUT_MS`).
- File test mới `server/test/unit-gemini-gateway.test.js` (8 test, thuần module không HTTP/DB):
  capability-map (2 test), retry 429 phục hồi giữa chừng + hết lượt (2 test), retry 5xx (1 test),
  4xx không retry (1 test), timeout/AbortController (1 test — set `GEMINI_TIMEOUT_MS=50` qua env
  trước require để không chờ default 30s thật).
- Test cũ cập nhật để khớp hành vi mới (không phải bug, là thay đổi hành vi có chủ đích của batch
  này): `integration-ai-golden.test.js` nhánh 429 cũ (1 response, ném ngay) tách thành 2 test — hết
  lượt retry (3 response 429 liên tục, route vẫn 502 với message của lần thử cuối) và phục hồi giữa
  chừng (429 rồi 200, route trả 200 thay vì 502). `unit-ai-redaction-schema.test.js` BR-AI-007 (mock
  trả 429/500 cho MỌI lần gọi, không phải 1 lần) nhân tiện đặc tả đúng nhánh retry-hết-lượt — thêm
  comment giải thích + `GEMINI_RETRY_BASE_DELAY_MS=5` ở đầu file để backoff thật không tốn ~1.5s mỗi
  lần chạy suite (production vẫn dùng default 250ms qua env, chỉ test set nhanh hơn).
- `memory-bank/01-audit-findings.md` §F8 đánh dấu "CLOSED phần reliability+capability-map" (circuit
  breaker/usage-tracking/data-egress vẫn chưa làm, không thuộc batch này — data-egress + kill-switch
  `AI_DISABLED` thuộc `W1.AI-POLICY`/F4). `13-deployment-runbook.md` thêm 2 hàng env mới.
  `gate1-test-mapping.md` thêm 6 dòng mới (F8-capability-map/F8-retry-429/F8-retry-5xx/
  F8-no-retry-4xx/F8-timeout/F8-retry-golden) + cập nhật ghi chú BR-AI-007.

Verify: `test:security` 6/6, `test:integration:sqlite` 658 pass/8 skip, `test:integration:mysql`
665 pass/1 skip (+9 so với trước batch), `test:verify-gate1-mapping` PASS (263 mapped rows),
`verify-g0.mjs` PASS, `git diff --check` sạch. Không đổi UI (Codex lane), không đổi RBAC pilot slice
nào — batch này độc lập hoàn toàn với D13/PolicyEngine, chỉ chạm tầng Gemini gateway.

## Wave 1 nhánh security: batch W1.AI-POLICY data-egress gateway (F4 — XONG)

Batch Contract: F4 data-egress gateway theo `03-data-classification.md` §D/§E, O8 = PROVISIONAL
(owner cho phép gửi Gemini tạm với dữ liệu test) → xây gateway **cấu hình được** (permissive mặc
định, siết được sau bằng config), KHÔNG phải hard-deny. Phải bao cả 12 luồng AI-E001..E012
(`06-threat-model.md` §A/§D) + SMTP. Không đụng RBAC v2 pilot (vẫn khoá `person`-only theo
`02-decisions.md` §G).

- Module mới `server/ai-policy.js`: `REGISTRY` (đăng ký duy nhất, 13 khoá `AI-E001`..`AI-E012` +
  `SMTP`, mỗi khoá gắn cố định `tier`/`purpose`) — `assertEgressAllowed(flowId, principal)` gọi
  TRƯỚC mỗi lần thật sự gửi dữ liệu ra ngoài, thứ tự: (1) kill-switch cứng — `AI_DISABLED` chặn 12
  luồng AI-E00x, `SMTP_DISABLED` chặn riêng SMTP (2 công tắc ĐỘC LẬP, tắt email không kéo theo tắt
  AI và ngược lại); (2) deny-list động qua `app_meta.ai_egress_deny_ids` (JSON array flow ID, Admin
  siết chỉ bằng đổi config — không cần deploy code mới; mặc định rỗng = permissive đúng O8; JSON
  hỏng → fail-open, có comment cảnh báo phải đổi nhánh này nếu sau này chuyển deny-by-default);
  (3) mặc định `allowed`. Mọi quyết định ghi vào bảng `audit_log` CÓ SẴN (tái dùng, không tạo bảng
  mới) với `action='AI_EGRESS'`, `detail` CHỈ chứa `{tier,purpose,provider,decision}` — KHÔNG bao
  giờ chứa nội dung payload thật đã/định gửi AI. `pruneEgressLog(days)` (mặc định 90 ngày) +
  `startRetentionSweep()` dùng lại đúng pattern `setInterval`+`timer.unref()` đã có ở
  `scheduler.js`/`monitor.js` — không thêm cơ chế cron mới; xoá scope CHỈ `action='AI_EGRESS'`,
  không đụng LOGIN/LOGOUT hay các loại audit khác.
- Lắp `assertEgressAllowed()` vào TẤT CẢ điểm egress đã biết: 6 route `server/ai.js` (AI-E001
  interaction-voice, AI-E002 card-text, AI-E003 card-image, AI-E004 award-extract, AI-E005
  award-advice, AI-E006 event-extract); 6 luồng logic `server/monitor.js` (AI-E007 analyzeBatch,
  AI-E008 groundIngest, AI-E009 siteGroundIngest, AI-E010 aiMisaHighlights, AI-E011
  aiCompetitorAnalysis, AI-E012 evaluateCampaign); `server/mailer.js#send()` (SMTP, đặt SAU nhánh
  "SMTP chưa cấu hình" có sẵn để giữ nguyên hành vi characterization cũ khi SMTP tắt).
- Nhân dịp lắp gateway, đóng luôn 2 gap redact đã ghi sẵn trong `gate1-test-mapping.md` làm target
  của batch này: **BR-AI-017** (`ai.js` POST /award-extract — nhánh text và nhánh URL/stripHtml đều
  nay gọi `redactTextForAi()` trước khi đưa vào prompt, cùng chuẩn với /event-extract đã có sẵn) và
  **BR-AI-015** (`monitor.js#analyzeBatch()` nay redact content trước khi gửi Gemini, thay vì đưa
  content thô như trước).
- Test mới `server/test/unit-ai-policy.test.js` (9 test, DB sqlite tmp cách ly, không HTTP): registry
  đủ 13 khoá + đủ tier/purpose; audit "allowed" không chứa payload; throw khi flowId lạ; principal
  null (job nền) → `username='system'`; `AI_DISABLED` chặn đủ 12 luồng AI-E00x nhưng KHÔNG chặn
  SMTP; `SMTP_DISABLED` chặn riêng SMTP; deny-list app_meta chặn đúng luồng bị liệt kê + fail-open
  khi JSON hỏng; `pruneEgressLog()` chỉ xoá `AI_EGRESS`, không đụng LOGIN/LOGOUT.
- Test cũ cập nhật để khớp hành vi ĐÃ SỬA (không còn "known gap, chưa fix"): `unit-ai-redaction-
  schema.test.js` BR-AI-015 (đổi từ assert PII xuất hiện thô sang assert PII đã bị thay bằng
  placeholder `[SĐT ĐÃ ẨN]`/`[EMAIL ĐÃ ẨN]`, đổi tiêu đề test từ "đặc tả lỗ hổng" sang "ĐÃ SỬA").
  `integration-ai.test.js` thêm test R139/BR-AI-017 mới (set `GEMINI_API_KEY` tạm + mock
  `gemini.genJSON` để đọc được prompt thật route xây dựng, xác nhận SĐT/email không còn xuất hiện
  thô) — sửa 1 lỗi restore env trong chính test này khi viết (gán `process.env.X = undefined` tạo
  ra string `"undefined"` thay vì xoá biến — sửa bằng `delete` khi giá trị gốc là `undefined`).
- `memory-bank/gate1-test-mapping.md`: BR-AI-015 và BR-AI-017 chuyển từ characterization/TODO sang
  `green` với ghi chú "ĐÃ SỬA — W1.AI-POLICY". `memory-bank/04-ROADMAP.md` hàng `W1.AI-POLICY` đánh
  dấu XONG + thêm execution update chi tiết.

Verify: `test:security` 6/6, `test:integration:sqlite` 668 pass/8 skip, `test:integration:mysql`
675 pass/1 skip (+10 so với trước batch: 9 test `unit-ai-policy` mới + 1 test `R139/BR-AI-017`
mới), `test:verify-gate1-mapping` PASS (263 mapped rows, TODO giảm còn 1), `verify-g0.mjs` PASS.
Không đổi UI (Codex lane), không mở rộng RBAC v2 pilot ngoài `person` (giữ nguyên khoá phạm vi theo
`02-decisions.md` §G) — batch này độc lập hoàn toàn với D13/PolicyEngine, chỉ chạm tầng AI-egress.
O8 vẫn PROVISIONAL: gateway hiện permissive theo đúng chỉ đạo owner, siết được bất kỳ lúc nào qua
`AI_DISABLED`/`SMTP_DISABLED`/`ai_egress_deny_ids` khi có dữ liệu thật + Security/Legal duyệt.

## Wave 1 nhánh security: batch G1B.5 N1/N2 implement thật (action tường minh + dashboard permission)

Batch Contract: implement thật 2 mục RESOLVED từ `02-decisions.md` §B.1 (owner APPROVED 2026-08-25,
C0.1.3/C0.1.4) mà `18-g1b-rbac-batch-contract.md#batch-g1b5-n1n2-2026-08-28` mới chỉ khoá target-red,
chưa sửa code. Không phụ thuộc owner/DevOps — chạy độc lập nhánh security, không đụng RBAC v2 pilot.

- **N1** (4 route side-effect tái dùng action `view` cho hành động ghi): `server/rbac.js` MATRIX
  thêm action `ack` (`reminders`, `monitoring`) và `run` (`reminders`) cho cả `super_admin` lẫn
  `pr_staff` — giữ nguyên đúng quyền thực tế đã cấp cho từng role (không role nào bị thu hẹp/mở
  rộng quyền), chỉ tách rõ tên action. `server/routes.js`: `POST /notifications/:id/read` và
  `POST /notifications/read-all` đổi sang `requirePerm('reminders','ack')`; `POST /reminders/run`
  đổi sang `requirePerm('reminders','run')`; `POST /monitor/alerts/:id/read` đổi sang
  `requirePerm('monitoring','ack')`.
- **N2** (`GET /dashboard` không có `requirePerm` module riêng): `rbac.js` thêm module `dashboard`
  vào `MODULES` + MATRIX cấp `['view']` cho cả 2 role; `routes.js` route `/dashboard` thêm
  `requirePerm('dashboard','view')` tường minh.
- `server/test/target-n1-n2-explicit-permission.test.js`: xoá wrapper `knownRed()`, promote 6 test
  cũ (4 N1 wiring + 2 N2 wiring) thành assertion xanh thật; thêm 1 test mới đặc tả hành vi runtime
  (`rbac.can()` trả `false` cho action không có trong ma trận quyền của module — fail-closed, không
  tự suy action ghi từ `view`). 2 entry `N1-explicit-action`/`N2-dashboard-permission` xoá khỏi
  `memory-bank/g1b-allowlist.json` (đúng quy trình G1B.6: known-red chỉ giữ khi hành vi đích còn
  sai).
- Đồng bộ tài liệu G0 theo đúng nguồn đã sửa (bắt buộc để `verify-g0.mjs` không rớt): `07-route-
  catalog.md` (R058/R059/R060/R098/R116 đổi cột auth + ghi "ĐÃ SỬA — Wave 1, 2026-08-30");
  `08-permission-matrix.md` (tách `dashboard` thành module riêng — trước đây gộp vào hàng "không
  thuộc module nào — đặc biệt"; cập nhật flow F003/F020/F029 và state-profile `D-DASH`);
  `scripts/verify-g0.mjs` (thêm `dashboard` vào whitelist regex Section A).
- **Sự cố phụ phát hiện khi promote (đã sửa trong cùng batch):** cơ chế tự-test của chính
  `known-red()` (`server/test-support/known-red-fixture.js`, chạy qua child-process trong
  `target-session-f2.test.js`) trước đây mượn tạm entry allowlist `N1-explicit-action` làm dữ liệu
  fixture — hợp lý lúc đó vì luôn tồn tại ít nhất 1 known-red thật chưa sửa để mượn, nhưng gãy ngay
  khi N1 được sửa xong và entry bị xoá khỏi allowlist. Sửa triệt để: tách hẳn thành id infra riêng
  `INFRA-known-red-selftest` (allowlist ghi rõ "KHÔNG phải finding thật", `expiry:2099-12-31`,
  không gắn với vòng đời sửa lỗi bảo mật nào) — không còn phụ thuộc việc có finding thật nào đang
  mở hay không. Mở rộng prefix hợp lệ của `scripts/verify-gate1-mapping.mjs` (thêm `INFRA-`) +
  `memory-bank/gate1-test-mapping.md` thêm 1 dòng mapping cho id này, ghi chú rõ ràng để không bị
  hiểu nhầm là còn gap bảo mật mở.

Verify: `test:security` 6/6, `test:integration:sqlite` 668 pass/8 skip, `test:integration:mysql`
675 pass/1 skip (không đổi tổng — đổi hành vi known-red→green không đổi số lượng test net),
`test:verify-gate1-mapping` PASS (264 mapped rows, `known-red=1` — đúng 1 entry infra self-test,
KHÔNG còn finding thật nào known-red), `verify-g0.mjs` PASS, `test:verify-g0-selftest` 6/6,
`git diff --check` sạch. Không đổi UI (Codex lane), không đụng RBAC v2 pilot (`person`-only,
`02-decisions.md` §G). **G1B (toàn bộ target-red batch G1B.1-G1B.6) nay đã xong phần "viết test
target-red + implement N1/N2/F2/F3"** — phần còn thiếu để đóng hẳn G1B.1/G1B.2 là route-wiring
PolicyEngine cho 24 entity ngoài `person`, chờ owner xác nhận mở rộng pilot theo §G.

## Wave 2: batch W2.1 chuẩn hóa error envelope (phần nền tảng — requestId + code ổn định)

Batch Contract: implement phần đầu của `05-error-contract.md` cho Wave 2 — `message` là field
canonical, `error` là alias tương thích ngược (luôn `=== message`); thêm `code` ổn định + `requestId`
cho response lỗi MỚI mà không phá vỡ hợp đồng ngầm hiện tại (frontend đọc `data.error` khắp nơi).
Không đổi status code của bất kỳ response nào đang tồn tại — chỉ thêm field mới (additive).

- Module mới `server/error-contract.js`: `requestIdMiddleware(req,res,next)` gắn `req.requestId`
  (`req_<24-hex>`, `crypto.randomBytes`) + header `X-Request-Id` cho MỌI request kể cả thành công;
  `sendError(req,res,status,code,message,details)` là điểm serialize DUY NHẤT cho response lỗi mới
  — luôn tự đặt `error = message` (không để từng call site tự gán `error` riêng, tránh lệch giá trị
  giữa 2 field — đúng lỗi mà Codex re-audit round 2 F3 từng phải sửa ở chính tài liệu đặc tả).
- `server/app.js`: thêm `requestIdMiddleware` là middleware đầu tiên (trước `express.json`); viết
  lại global error middleware dùng `sendError()`, phân biệt `multer.MulterError` (400 đúng —
  `LIMIT_FILE_SIZE`→code `FILE_TOO_LARGE`, các lỗi multer khác→`UPLOAD_ERROR`) khỏi lỗi khác (giữ
  nguyên 400 + code `UNCAUGHT_ERROR` — xem nợ kỹ thuật bên dưới, KHÔNG đổi thành 500).
- `server/auth.js`: toàn bộ 7 điểm `res.status(401/403/429/500).json({error:...})` (login sai mật
  khẩu, rate-limit, session-regenerate lỗi, `me`, `requireAuth`, `requirePerm`) đổi sang
  `sendError()` với code chuẩn `UNAUTHENTICATED`/`RATE_LIMITED`/`INTERNAL_ERROR`/`FORBIDDEN_MODULE`.
  Vì `requireAuth`/`requirePerm` là middleware dùng chung bởi ~140/145 route, batch này phủ được
  phần lớn 401/403 của toàn hệ thống chỉ qua 1 file.
- `server/routes.js`: 14 điểm `res.status(403)` rải rác (D13 PolicyEngine pilot People Detail +
  attachment gate — `PolicyForbiddenError`, `rbac.can()` inline, kiểm tra nhóm mật `iddoc`) đổi sang
  `sendError()`, phân loại `FORBIDDEN_MODULE` (denial chung) vs `FORBIDDEN_SENSITIVE_GROUP` (giấy tờ
  tùy thân/dữ liệu mật — đúng ví dụ 2 code trong bảng `05-error-contract.md`).
- **Nợ kỹ thuật cố ý chưa làm (quyết định có cân nhắc, ghi rõ để không lẫn với bỏ sót):** đặc tả gốc
  muốn middleware toàn cục trả 500 cho "lỗi khác" ngoài multer, không lộ raw DB error. Khảo sát
  trước khi code phát hiện: ít nhất 8 route (R004/R007/R031/R045/R064/R089/R092/R047, có thể nhiều
  hơn không gắn nhãn "(NOT NULL)" trong tên test) dựa hẳn vào lỗi ràng buộc NOT NULL của DB bubble
  lên đúng middleware này để trả 400 làm cơ chế validation hiện tại — đổi mặc định sang 500 phá vỡ
  hàng loạt characterization test cùng lúc, và đòi hỏi thêm validation tường minh trước khi chạm DB
  cho từng route (quy mô ngang đợt sửa F13/F16 trước đây). Đây là việc lớn hơn phạm vi "chuẩn hóa
  envelope" — để lại làm batch kế tiếp của W2.1, chưa đóng exit criterion "không lộ raw DB error".
- Test mới: `server/test/unit-error-contract.test.js` (5 test thuần module) + `server/test/
  integration-error-contract.test.js` (5 test HTTP thật qua `app-harness`) — cả 10 gắn id
  `BR-ERR-001..010`, thêm vào `gate1-test-mapping.md`.

Verify: `test:security` 6/6, `test:integration:sqlite` 678 pass/8 skip (+10), `test:integration:
mysql` 685 pass/1 skip (+10), `test:verify-gate1-mapping` PASS (274 mapped rows), `verify-g0.mjs`
PASS, `test:verify-g0-selftest` 6/6, `git diff --check` sạch. Không route/test cũ nào cần sửa ngoài
phạm vi đã liệt kê — mọi thay đổi field là additive (`code`/`message`/`requestId` thêm mới, `error`
giữ nguyên giá trị cũ ký tự-cho-ký tự). Không đổi UI (Codex lane), không đụng RBAC v2 pilot.

## Wave 2: batch W2.1 phần 2 — đóng nợ kỹ thuật (DB-error phân loại 400/500, không lộ raw, XONG hẳn)

Batch Contract: đóng nốt exit criterion còn lại của `05-error-contract.md` — middleware toàn cục
phải trả 500 cho lỗi server thật KHÔNG xác định, không lộ raw DB/driver error message ra client,
trong khi VẪN giữ nguyên 400 cho các route hiện đang dựa vào lỗi ràng buộc NOT NULL của DB làm cơ
chế validation (không phá vỡ characterization test hiện có).

- Chọn cách phân loại bằng **mã lỗi driver DB** (`err.code`/`err.errcode`) thay vì thêm validation
  tường minh trước DB cho từng route (refactor lớn hơn, rủi ro cao hơn) — xác nhận mã lỗi bằng
  **thực nghiệm trực tiếp** (script probe chạy thật, không đoán theo tài liệu driver).
  `error-contract.js` thêm `isDbConstraintError(err)`: SQLite (`node:sqlite`) dùng
  `err.code==='ERR_SQLITE_ERROR'` + `err.errcode % 256===19` (SQLITE_CONSTRAINT, phủ NOT NULL/
  UNIQUE/FK/CHECK); MySQL dùng tập mã cố định `ER_BAD_NULL_ERROR`/`ER_NO_DEFAULT_FOR_FIELD`/
  `ER_DUP_ENTRY`/`ER_NO_REFERENCED_ROW*`/`ER_ROW_IS_REFERENCED*`/`ER_DATA_TOO_LONG`/
  `WARN_DATA_TRUNCATED`/`ER_TRUNCATED_WRONG_VALUE`.
- **Bug phụ phát hiện khi thực nghiệm:** `server/mysql-sync.js`'s `_call()` bỏ qua `result.code` dù
  worker thread (`mysql-worker.js`) đã gửi kèm — sửa để `err.code` MySQL đến được middleware (trước
  đó luôn `undefined`, không thể phân loại lỗi MySQL).
- `server/uploads.js`: `fileFilter`/`aiDocumentFileFilter` nay gắn `err.code='UPLOAD_REJECTED'` khi
  từ chối file sai loại — phân biệt với lỗi thật không xác định.
- `error-contract.js` thêm `isUploadParseError(err)`: nhận diện lỗi parse `multipart/form-data` của
  busboy (thiếu boundary, cắt ngang form...) qua tập message literal cố định của thư viện (đọc trực
  tiếp `node_modules/busboy/lib`, xác nhận các message này không chứa dữ liệu client nên lộ ra vẫn
  an toàn).
- `server/app.js`: global error middleware nay có thứ tự phân loại đầy đủ: `LIMIT_FILE_SIZE`→400,
  `MulterError`→400, `UPLOAD_REJECTED`→400, `isUploadParseError`→400, `isDbConstraintError`→400
  `VALIDATION_FAILED` (message chung, không lộ raw), **còn lại**→500 `INTERNAL_ERROR` (message
  chung cố định, log stack đầy đủ server-side kèm requestId, KHÔNG lộ raw DB/driver error ra client
  — exit criterion cuối cùng của `05-error-contract.md`).
- 2 regression phát hiện ngay sau khi đổi mặc định 400→500 (`R136`/`R141`, cả 2 do lỗi upload thiếu
  mã phân loại) — sửa đúng gốc (gắn `.code` ở nơi phát sinh lỗi), không patch vá ở middleware.

Verify: `test:security` 6/6, `test:integration:sqlite` 678 pass/8 skip (0 fail), `test:integration:
mysql` 685 pass/1 skip (0 fail — xác nhận bug `mysql-sync.js` đã sửa đúng bằng lỗi ràng buộc MySQL
thật), `test:verify-gate1-mapping` PASS (274 mapped rows), `verify-g0.mjs` PASS,
`test:verify-g0-selftest` 6/6, `git diff --check` sạch. Không thêm test đơn vị riêng cho
`isDbConstraintError`/`isUploadParseError` ở batch này (đã phủ gián tiếp qua ~40+ route
characterization test dựa vào NOT NULL→400 + R136/R141 tự sửa) — có thể bổ sung như việc nhỏ sau,
không phải exit criterion. Không đổi UI (Codex lane), không đụng RBAC v2 pilot. **W2.1 nay đã đóng
hẳn (không còn nợ kỹ thuật).**

## Wave 2: batch W2.6 Gemini eval/model migration (O6 $200 — XONG, kết luận GIỮ PIN)

Batch Contract: golden eval THẬT (gọi Gemini API thật, không mock) so sánh pin `gemini-3.5-flash`
với candidate do owner chỉ định `gemini-3.7-flash` — corpus 60-100 ca tổng hợp (không dữ liệu
thật), ≥3 repeat/candidate, hard cap ngân sách $200 (O6 đã duyệt), quyết định giữ/đổi model dựa
trên threshold quality/schema-validity/latency/cost.

- Xác nhận `gemini-3.7-flash` là model id hợp lệ bằng 1 lệnh gọi thật trước khi cam kết chạy corpus.
- Corpus 60 ca tổng hợp (`scripts/w26-eval-corpus.mjs`) x 4 nhóm nghiệp vụ (award-extract/
  event-extract/award-advice/card-text — 15 ca/nhóm, mỗi ca ràng buộc sẵn ground-truth để chấm điểm
  tự động, không cần người chấm tay) — che 4/6 route Gemini text hiện có (2 route còn lại:
  voice-extract cần input audio thật, card-image dùng model ảnh riêng — ngoài phạm vi so sánh model
  text của batch này).
- Harness `scripts/w26-eval-run.mjs`: gọi trực tiếp Gemini API (không qua `gemini.js` vì cần đổi
  model linh hoạt trong 1 lần chạy), retry transient (429/5xx + lỗi mạng), tự dừng cứng nếu chi phí
  ước tính chạm ngân sách, ghi từng dòng JSONL ngay khi có (an toàn khi bị ngắt giữa chừng) + cơ chế
  resume (bỏ qua tổ hợp case/model/rep đã xong, không gọi/tính tiền lại).
- Chạy pilot 8 call đo chi phí thật ($0.0094/call trung bình) trước khi cam kết full batch (an toàn
  rõ ràng trong $200). Full batch: 60 ca x 2 model x 3 repeat = 360 call thật. Gặp 1 lần
  `ECONNRESET` (lỗi mạng thật) làm crash giữa chừng — sửa harness retry network error + resume, chạy
  lại hoàn tất đủ 360/360 không mất tiến độ, không tốn thêm tiền cho phần đã xong.
- **Kết quả:** pin `gemini-3.5-flash` — schema-validity 100%, field-accuracy TB 99.9%, latency
  p50=6.6s/p90=13.3s/max=26s, chi phí $2.865. Candidate `gemini-3.7-flash` — schema-validity 99.4%,
  field-accuracy TB 99.0%, latency p50=7.96s/p90=16.9s/**max=70.7s**, chi phí $1.591 (rẻ hơn ~45%).
  Candidate THUA rõ ở nhóm `event-extract` (schema 98% vs 100%, acc 96% vs 100%, latency p50 8.5s
  vs 3.6s) — 1 ca cụ thể (`EVT-01` rep2) mất 70.7s VÀ JSON hỏng luôn, cho thấy đuôi latency dài
  tương quan với rủi ro output hỏng, không chỉ chậm đơn thuần.
- **Quyết định (đúng D10 "candidate không thắng rõ thì giữ pin"):** candidate rẻ hơn nhưng KHÔNG
  thắng rõ (regression thật + rủi ro tail latency/output hỏng chưa từng thấy ở pin). **GIỮ NGUYÊN
  pin `gemini-3.5-flash`**, không đổi `cfg.GEMINI_TEXT_MODEL`, không cần canary/rollback (không đổi
  production). Chi phí thật toàn batch: **$4.456/$200** (ngân sách O6 còn dư $195.544).
- Evidence: `scripts/w26-eval-corpus.mjs`, `scripts/w26-eval-run.mjs`, `scripts/w26-eval-analyze.mjs`
  + dữ liệu thô 360 dòng `scripts/.w26-eval-out/results-full.jsonl` — đã commit để chạy lại đối
  chiếu khi có candidate mới hoặc `gemini-3.7-flash` cải thiện đuôi latency.

Không đổi UI (Codex lane), không đụng RBAC v2 pilot, không tốn ngân sách ngoài batch này. **W2.6 nay
đã đóng — Exit gate W2 hoàn tất phần model migration.**

## Wave 1: batch W1.7 tune rate-limit theo owner (quá 5 lần sai → khoá 30 phút)

Batch Contract: rà roadmap phát hiện F2-fixation/F2-ratelimit (W1.7) thật ra ĐÃ implement thật từ
commit `70e9f93` cùng ngày (regenerate session + rate-limit) — tài liệu roadmap (dòng W1.7/G1B.3)
chưa cập nhật theo kịp, đã sửa lại cho khớp thực tế. Owner chốt cụ thể ngưỡng: quá 5 lần sai liên
tiếp thì khoá tài khoản (IP+username) 30 phút — khác cấu hình mặc định cũ (cửa sổ 15 phút tính từ
lần sai đầu tiên, ngữ nghĩa khác: có thể hết khoá sớm hơn 15 phút tuỳ thời điểm).

- `server/login-rate-limiter.js` viết lại đúng ngữ nghĩa "khoá 30 phút kể từ lần sai LÀM CHẠM
  NGƯỠNG" (không phải từ lần sai đầu tiên): `lockedUntil` thay `resetAt`, chỉ đặt mốc khoá khi
  `count>=maxAttempts`. Thêm tham số `now` (mặc định `Date.now`) để test được chính xác mốc thời
  gian mà không cần chờ thật 30 phút — không đổi hành vi production.
- `server/auth.js`: message lỗi 429 nói rõ "quá 5 lần... 30 phút" (đã grep xác nhận không test nào
  khoá cứng theo text cũ trước khi đổi).
- Test mới `server/test/unit-login-rate-limiter.test.js` (7 test, `BR-AUTH-001..007`): ngưỡng 5
  lần, khoá đúng 30 phút (biên 29:59/30:00), reset sau khi hết khoá, `recordSuccess()` xoá sạch lịch
  sử, khoá theo từng cặp IP+username riêng, không tự gia hạn khi không có request nào gọi thêm
  trong lúc đang khoá. Mapping thêm 8 dòng.

Verify: security 6/6, SQLite 685 pass/8 skip (+7), MySQL 692 pass/1 skip (+7), mapping 281 rows
PASS, `verify-g0.mjs` PASS, `verify-g0-selftest` 6/6, `git diff --check` sạch. Không đổi UI, không
đụng RBAC v2 pilot, không đổi durable session store (vẫn chờ DevOps O4).

## Wave 1: batch F15 sửa tận gốc — FK không được MySQL thực thi (backlog data-integrity)

Batch Contract: root-cause + sửa tận gốc F15 (5 quan hệ FK đã xác nhận `award_participations.
award_id`, `supplier_quotes/transactions/contacts.supplier_id`, `event_costs.event_id/supplier_id`
không được MySQL thực thi dù `db.js` khai `REFERENCES ... ON DELETE ...`) — không phải thêm `if`
kiểm tồn tại thủ công ở từng route (chỉ che 1 route, không đồng bộ hành vi cho FK khác).

- Điều tra thực nghiệm trực tiếp trên MySQL test thật (`SHOW CREATE TABLE`): xác nhận REFERENCES
  biến mất hoàn toàn khỏi DDL. Root cause: MySQL/InnoDB PARSE nhưng ÂM THẦM BỎ QUA cú pháp
  REFERENCES gắn trực tiếp vào cột (inline column-level, cách SQLite chấp nhận) — hành vi đã tài
  liệu hoá của MySQL, chỉ tạo FK thật khi có CONSTRAINT...FOREIGN KEY tách riêng (out-of-line).
- `server/mysql-sync.js`'s `translate()` (điểm dịch DDL dùng chung cho MỌI CREATE TABLE) nay tách
  mọi cột `col TYPE REFERENCES tbl(refCol) [ON DELETE action]` inline thành `CONSTRAINT
  fk_<table>_<col> FOREIGN KEY (col) REFERENCES tbl(refCol) [ON DELETE action]` out-of-line, giữ
  nguyên kiểu cột + NOT NULL. Xác nhận không bảng nào tham chiếu bảng chưa tạo (rà thứ tự khai báo
  CREATE TABLE trong db.js) nên áp dụng ngay lúc tạo bảng, không cần 2-pass ALTER TABLE.
- Xác nhận thật qua `information_schema.KEY_COLUMN_USAGE`: **24/24 FK được tạo** trên MySQL, khớp
  đúng số dòng REFERENCES trong db.js.
- 5 test characterization từng ghi nhận lệch driver (R007/R067/R075/R083/R091) nay hội tụ đúng 1
  hành vi — bỏ nhánh `isMysql ? 200 : 400` kiểu cũ, khẳng định thẳng 400/cascade như SQLite.
- Test mới `server/test/unit-mysql-sync-translate.test.js` (7 test, `BR-FK-001..007`): tách FK
  inline→out-of-line, giữ ON DELETE SET NULL/không có ON DELETE, nhiều FK cùng bảng, bảng không FK
  không đổi gì, giữ NOT NULL, round-trip thật qua information_schema (chỉ chạy DB_CLIENT=mysql).

Verify: security 6/6, SQLite 692 pass/8 skip (+7), MySQL 699 pass/1 skip (+7), mapping 281 rows
PASS, `verify-g0.mjs` PASS, `git diff --check` sạch. Không đổi UI, không đụng RBAC v2 pilot. **F15
đóng hẳn.**

## Wave 1: batch RBAC-EXP-B1 — mở rộng PolicyEngine sang 6 entity Module-admin-only (1/6 batch)

Batch Contract: `18-g1b-rbac-batch-contract.md#batch-rbac-exp-b1-module-admin-2026-08-30`. Owner
duyệt mở rộng route-wiring PolicyEngine từ pilot 1 entity (`person`) ra toàn bộ 24 entity còn lại
(`02-decisions.md` §D13.4a), tự chọn cách chia batch. Chọn Module-admin-only (budget/scan_query/
source/competitor/campaign/monitor_alert) làm batch 1/6 vì luật đơn giản nhất: executor bị chặn
HOÀN TOÀN mọi hành động ghi kể cả create, không có khái niệm chủ sở hữu cần so sánh.

- Khảo sát hiện trạng trước khi code (agent riêng, chỉ báo cáo) phát hiện 2 khoảng trống hệ thống
  không thuộc phạm vi batch này nhưng cần ghi nhận: (1) `rbac.js` MATRIX chưa có entry cho 3 role
  D13 (viewer/executor/admin) → user mang role D13 bị 403 trên MỌI route chưa gắn PolicyEngine, kể
  cả GET/view; (2) hiện không có cách tạo user mang role D13 qua API/UI thật (chỉ qua
  `fixtures.createUser()` insert thẳng DB). Cả 2 cần quyết định owner riêng ở batch khác.
- `server/routes.js`: thêm hàm dùng chung `moduleAdminOnlyGate(entity, legacyModule, action)` —
  route-level middleware thay `requirePerm` trực tiếp trên 14 route ghi (POST/PUT/DELETE) của 6
  entity trên; dùng 1 hàm chung thay vì chép tay 14 khối dual-branch vì cả 6 entity chung đúng 1
  luật (an toàn hơn, ít rủi ro copy-paste sai). Nhánh legacy (super_admin/pr_staff) gọi lại đúng
  `requirePerm(legacyModule, action)` nguyên bản, giữ nguyên action string gốc (budgets dùng
  `'view'`, monitor_alerts dùng `'ack'` — không đổi so với trước) vì PolicyEngine.canWrite() cho
  Module-admin-only không phân biệt theo action (executor luôn false, admin/super_admin luôn true
  bất kể action) nên đổi action cho nhánh PolicyEngine an toàn nhưng KHÔNG được đổi cho nhánh
  legacy. Không đụng route GET/view của 6 entity này (vẫn `requirePerm` cũ, khoảng trống MATRIX ở
  trên vẫn còn với GET — ngoài phạm vi batch).
- Test mới `server/test/integration-rbac-exp-b1-module-admin.test.js` (17 test, `D13-025..030`):
  mỗi entity — viewer/executor create-edit-delete đều 403 (executor bị chặn cả create, đúng điểm
  khác D13.4a so với Direct/Global); admin (target role) full CRUD 200. Riêng `source`: tách test
  create (chỉ xác nhận vượt cổng PolicyEngine — 400 SSRF, không phải 403 — vì
  `outbound.validateOutboundUrl` chặn URL loopback bất kể role) khỏi edit/delete (dựng bản ghi nền
  qua DB trực tiếp, tránh phụ thuộc SSRF thật).
- 2 test có sẵn sửa theo khớp shape mã mới (không đổi hành vi, chỉ đổi cách đo): `scripts/
  verify-g0.mjs` thêm 14 route vào `PILOT_INLINE_PERM_ROUTES` (route dùng `moduleAdminOnlyGate(...)`
  thay literal `requirePerm(...)` nên phải khai tường minh, giống cách pilot `person` đã làm);
  `server/test/target-n1-n2-explicit-permission.test.js` mở rộng `requirePermArgsFor()` nhận dạng
  thêm pattern `moduleAdminOnlyGate(...)`.

Verify: security 6/6, SQLite 709 pass/8 skip (+17), MySQL 716 pass/1 skip (+17), mapping 145/145
route + 288 dòng PASS, `verify-g0.mjs` PASS, `git diff --check` sạch. Không đổi UI, không regression
trên route legacy (R050/R051/R116-R134 vẫn xanh nguyên). **Batch 2/6 (Global còn lại) tiếp theo.**

## Wave 1: batch RBAC-CUTOVER — bỏ hoàn toàn 2-role legacy, chỉ dùng 4 vai trò D13

Batch Contract: `18-g1b-rbac-batch-contract.md#batch-rbac-cutover-2026-08-30`. Owner chốt trực tiếp
(2026-08-30, ghi đè `02-decisions.md` §G 2026-08-28, xem §G.1 amendment): bỏ hẳn `super_admin`/
`pr_staff` (2-role legacy chỉ là demo ban đầu), dùng DUY NHẤT 4 vai trò D13 (`viewer/executor/admin/
super_admin`). 2 quyết định owner kèm theo: `pr_staff`→`executor` là ánh xạ cố định cho user thật;
`super_admin`/`admin`/`viewer` owner tự gán theo cấp bậc thật từng người (không migrate tự động);
dữ liệu nghiệp vụ cũ chỉ là demo, không cần backfill `owner_id`.

- `server/rbac.js`: `ROLES`/`MATRIX` đổi từ 2 khoá sang 4 khoá — `pr_staff` RENAME thẳng thành
  `executor` (giữ nguyên nội dung quyền); thêm mới `MATRIX.admin` (copy `super_admin`) và
  `MATRIX.viewer` (chỉ `'view'` mọi module, trừ `admin`).
- Global rename cơ học `pr_staff`→`executor` toàn repo (67 chỗ, 15 file code+test, 1:1 không đổi
  nội dung).
- `server/routes.js`: bỏ hẳn `TARGET_RBAC_ROLES`/nhánh dual-branch. Route đã gắn PolicyEngine
  (`person` + 6 entity Module-admin-only) nay chạy PolicyEngine KHÔNG ĐIỀU KIỆN cho cả 4 vai trò
  (kể cả `super_admin`); route chưa gắn PolicyEngine dùng `requirePerm`/`rbac.can` — nay đúng cho cả
  4 vai trò nhờ MATRIX mở rộng, đóng khoảng trống 403-sai cho viewer/admin.
- **Phát hiện + vá giữa batch:** copy `MATRIX.admin` từ `super_admin` vô tình cấp Admin full quyền
  module `admin` (tạo/sửa/xoá tài khoản bất kỳ role + xem `audit_log`) — trái D13.1 đã chốt (Admin
  không quản trị được tài khoản Admin/Super Admin, không xem audit log). Vá bằng guard riêng trong
  handler `POST/PUT/DELETE /admin/users`/`GET /admin/audit` (MATRIX thô không phân biệt được "quản
  lý user thường" với "quản lý user đặc quyền"): Admin bị chặn thao tác tài khoản có role hiện tại
  HOẶC role đích là admin/super_admin (trừ tự sửa chính mình không đổi role); audit log chỉ đúng
  `role==='super_admin'`.
- `isValidNewUserPayload`/`POST /api/admin/users` tự động nhận đủ 4 role qua `rbac.ROLES` — đóng
  khoảng trống "không có cách tạo user role D13 qua API thật".
- Test mới `server/test/integration-rbac-admin-tier.test.js` (13 test, `D13-031..034`).

Verify: security 6/6, SQLite 722 pass/8 skip (+13), MySQL 729 pass/1 skip (+13), mapping 145/145
route PASS, `verify-g0.mjs` PASS, `git diff --check` sạch, grep xác nhận 0 chuỗi `pr_staff` còn lại
trong `server/*.js`. Toàn bộ 709/716 test cũ vẫn pass 100% sau rename (không sửa nội dung assertion).
**Chưa làm:** 18 entity D13.4a còn lại (batch RBAC-EXP-B2..B6, độc lập với việc bỏ 2-role); UI-flow
matrix §B.2 (Codex lane); seed demo vẫn 2 tài khoản.

## Wave 1: batch RBAC-FIELDVIS-FIX — P0 tự phát hiện: field Public bị ẩn mặc định cho viewer/executor

Trước khi bắt đầu Batch RBAC-EXP-B2 (mở rộng organization/supplier/important_date), kiểm tra thủ
công `projectRecord()` cho entity `person` với `principal.role='executor'` phát hiện: **mọi field
Public-tier** (không thuộc nhóm mật nào — vd `email_work`/`phone_work`/`position`/`org_id`/`beat`)
bị **ẩn mặc định**, không chỉ field mật thật sự. Vì batch RBAC-CUTOVER (cùng ngày, trước batch này)
đã xoá nhánh legacy và cho GET `/people/:id` chạy PolicyEngine không điều kiện cho **executor**
(vai trò thật duy nhất của toàn bộ nhân viên PR thật hiện nay, sau khi đổi tên `pr_staff`→
`executor`), bug này **đã live trên production**: nhân viên PR mở 1 người trong danh bạ sẽ thấy
record gần như rỗng (`{}` — mất cả `id`), không còn xem được tên/điện thoại/chức vụ/cơ quan.

- `server/policy-engine.js canReadField()`: field tier `Public` giờ mặc định **hiển thị** trừ khi
  có dòng `field_visibility` rõ ràng `is_public=0` (`isPublic !== false` thay vì `!!isPublic`) —
  đúng D13.2b ("audience_visibility chỉ được SIẾT, không được NỚI dưới trần"). Field tier
  Confidential/Restricted giữ nguyên fail-closed (luôn `false`, không đổi — an toàn không đụng).
- `server/policy-visibility-store.js isPublic()`: trả `undefined` khi chưa có dòng cấu hình (thay
  vì ép về `false`) — phân biệt "chưa cấu hình" với "đã cấu hình rõ private".
- **Phát hiện thêm giữa batch:** `server/mysql-sync.js translate()` chưa từng dịch đúng câu UPSERT
  `field_visibility` (`ON CONFLICT...DO UPDATE...`) sang MySQL — `setPublic()` (cách duy nhất cấu
  hình `field_visibility` qua code thật) **chưa từng được test trên MySQL** trước batch này (unit
  test cũ ép cứng `DB_CLIENT=sqlite`). Thêm 1 rule translate theo đúng mẫu các rule khác.
- Test sửa lại: `integration-people.test.js` D13-011 (bỏ INSERT thủ công, field Public giờ thấy
  mặc định) + D13-011b mới (SIẾT `full_name` xuống private qua `setPublic()` thật); D13-006 sửa kỳ
  vọng `false`→`undefined`.

Verify: security 6/6, SQLite 723 pass/8 skip, MySQL 730 pass/1 skip, mapping 145/145 PASS,
`verify-g0.mjs` PASS, `git diff --check` sạch. Xác nhận thủ công: executor `projectRecord()` trên
person 9 field business giờ thấy 7 (đúng ẩn `dob`/`phone_personal`, hiện phần còn lại).

## Wave 1: batch RBAC-EXP-B2 — gắn PolicyEngine cho 2/6 entity Global còn lại (organization/supplier/important_date)

Tiếp Batch 2/6 mở rộng 24 entity D13.4a, trên nền engine đã sửa đúng ở RBAC-FIELDVIS-FIX (nếu làm
trước khi sửa sẽ lặp lại đúng bug ẩn field Public mặc định cho 2 entity dùng hàng ngày nhiều hơn
`person`: organization/supplier).

- `organization` (`GET/PUT/DELETE /api/partners/:id`): GET dùng `policyService.projectRecord()`
  (che `membership_fee`); PUT/DELETE bỏ `requirePerm`+`stripDisallowed` cũ, thay
  `policyService.assertWritable()` không điều kiện — executor sửa được bất kể ai tạo, KHÔNG bao giờ
  xoá được (Global, chỉ Admin/Super Admin). Collection lồng (people/sponsorships/gifts/fees/
  agreements/workLogs) giữ nguyên masking cũ — thuộc Direct entity khác, ngoài phạm vi batch này.
- `supplier` (`GET/PUT/DELETE /api/suppliers/:id`): tương tự — che `service_fee_pct`/`deposit_pct`.
- `important_date` (`PUT/DELETE /api/reminders/:id`): không có field mật nào nên chỉ cần gate
  ghi/xoá, không cần `projectRecord` cho GET.
- Dọn rác: `stripDisallowed()` hết call site thật sau khi bỏ ở `organization` (person đã bỏ từ batch
  trước) — xoá định nghĩa + khỏi `router.testables` + unit test đã mồ côi (`BR-VAL-020`).
- `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` + `07-route-catalog.md` (R005/R006/R041/R042/
  R082/R083) cập nhật mô tả auth theo đúng mẫu inline-check đã dùng cho person (R032/R033).
- **Phát hiện giữa batch:** `call()` helper trong `integration-partners/suppliers/reminders.test.js`
  chưa hỗ trợ tham số `as` (chỉ có 1 cookie `super_admin` cho cả file) — test D13 mới ban đầu chạy
  "xanh giả" (viewer/executor thực chất gọi bằng cookie super_admin). Sửa cả 3 file thêm `as = cookie`.

Test mới: D13-035..038 (organization), D13-039..042 (supplier), D13-043..045 (important_date) — mỗi
entity: viewer thấy field Public mặc định + field mật ẩn, viewer PUT/DELETE 403, executor PUT 200
nhưng DELETE 403, admin (target role D13) PUT+DELETE đều 200.

Verify: security 6/6, SQLite 733 pass/8 skip (+10), MySQL 740 pass/1 skip (+10... trừ 1 test xoá),
mapping 145/145 route PASS, `verify-g0.mjs` PASS, `git diff --check` sạch. **Còn lại: 14 Direct
entity + 1 Inherited (event_cost) — batch RBAC-EXP-B3..B6 tiếp theo.**

## Wave 1: batch RBAC-EXP-B3 — gắn PolicyEngine cho 2 entity Direct đầu tiên (booking/interaction)

Batch 3/6, khác pattern Global của B2: mỗi record có `owner_id` riêng, executor CHỈ sửa được bản
ghi CHÍNH họ tạo, KHÔNG BAO GIỜ xoá được (kể cả chủ sở hữu). Trước khi làm, chủ đặt câu hỏi ngược
lại nghĩa "executor sửa được bất kể ai tạo" (tưởng lầm sang cho tất cả entity) — xác nhận lại qua
`AskUserQuestion`: Global (organization/supplier/important_date, batch B2) giữ nguyên như cũ,
Direct (batch này) đúng là phải gate `owner_id` như thiết kế ban đầu.

- `interaction` (`POST /api/interactions`): chỉ có create/view (log lịch sử, không PUT/DELETE) —
  đổi `pick()` thô sang `policyService.prepareCreate()`, tự gán `owner_id`/`created_by` = principal
  hiện tại (trước batch này `owner_id` luôn NULL).
- `booking` (`GET/POST/PUT/DELETE /api/bookings`, `/api/bookings/:id`): GET dùng `projectRecord()`
  che `amount` nếu không phải chủ sở hữu/không privileged; POST dùng `prepareCreate()`; PUT dùng
  `assertWritable()` — chỉ qua khi `owner_id` = chính principal HOẶC Admin/Super Admin; DELETE
  không điều kiện owner — Direct entity thì xoá CHỈ dành cho Admin/Super Admin, kể cả chủ sở hữu
  cũng không xoá được (siết chặt hơn hành vi cũ — trước batch này DELETE chỉ gate theo role, không
  gate theo owner).
- `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` + `07-route-catalog.md` (R045/R047/R048/R049)
  cập nhật mô tả auth theo đúng mẫu inline-check đã dùng ở B2.

Test mới: D13-046..047 (`interaction`: viewer POST 403, executor POST 200 + owner_id/created_by
đúng); D13-048..051 (`booking`: viewer POST 403, executor POST 200 + owner_id đúng, executor PUT
booking của người khác 403, executor DELETE booking CỦA CHÍNH MÌNH vẫn 403, admin DELETE 200).

Verify: security 6/6, SQLite 748 pass/8 skip, MySQL 747 pass/1 skip, mapping 145/145 PASS,
`verify-g0.mjs` PASS, `git diff --check` sạch. **Còn lại: 12 Direct entity + 1 Inherited
(event_cost) — batch RBAC-EXP-B4..B6 tiếp theo (nhóm tạm thời, chưa chốt với chủ).**

## Wave 1: batch RBAC-EXP-B4 — gắn PolicyEngine cho award/award_participation/event + entity Inherited đầu tiên (event_cost)

Batch 4/6. Trước khi wiring, mở rộng `policy-service.js` để `assertWritable/prepareCreate/
prepareUpdate/projectRecord` nhận thêm `parentOwnerId` (tương thích ngược, forward thẳng vào
`policy.canWrite`/`policy.canReadField`) — cần thiết vì đây là lần đầu service layer thật sự gọi
tới nhánh Inherited (engine đã hỗ trợ sẵn từ G1B.1 nhưng chưa route nào dùng).

- **Phát hiện trước khi viết code:** `award_participations`/`event_costs` chưa từng có cột
  `created_by` thật (chỉ có `owner_id` gán qua migration trước; `awards`/`events` có sẵn
  `created_by` từ lúc `CREATE TABLE`) — `prepareCreate()` luôn gán `created_by` không điều kiện,
  thiếu cột sẽ làm INSERT lỗi ngay lập tức. Fix bằng 2 dòng `ALTER TABLE ... ADD COLUMN
  created_by INTEGER` **trước khi wiring**, không phải vá lại sau khi gặp lỗi.
- `award` (`GET/POST/PUT/DELETE /api/awards`, `/api/awards/:id`): GET dùng `projectRecord()` che
  `cost`; PUT dùng `assertWritable()` theo owner_id; DELETE không điều kiện owner (chỉ Admin/Super
  Admin).
- `award_participation`: entity Direct **riêng** — KHÔNG kế thừa owner của award cha (dễ nhầm vì là
  "con" của award về route path, nhưng D13.4a liệt kê rõ nó thuộc nhóm 14 Direct, có `owner_id`
  riêng). DELETE **sửa đúng**: trước batch này map nhầm vào quyền `edit` (executor xoá được), nay
  đúng `delete` (chỉ Admin/Super Admin).
- `event`: không có field Confidential riêng của chính nó, nhưng `total_cost`/`costs`/`totals` là
  tổng hợp từ `event_cost` (Inherited) nên vẫn phải che theo `owner_id` của CHÍNH EVENT ở mỗi
  row — dùng `policy.canReadField()` trực tiếp (không qua `projectRecord()`, vì đây là trường tổng
  hợp, không phải field thật trên record).
- `event_cost` (Inherited): `parentOwnerId` = `owner_id` của event cha; POST dùng action `create`
  cho đúng thực tế (trước batch này map nhầm sang `edit`); DELETE không điều kiện owner (chỉ
  Admin/Super Admin — `canWrite()` chặn `action==='delete'` ngay từ đầu bất kể Direct/Inherited).
- `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` + `07-route-catalog.md` (R064-R069, R089-R094 +
  sửa mô tả masking R062/R063/R087/R088) cập nhật theo mẫu đã dùng ở B2/B3.

Test mới: `integration-awards.test.js` D13-052..058 (award + award_participation: viewer POST
403, executor POST 200 + owner_id đúng + che cost theo owner, executor PUT người khác 403/của
mình 200, executor DELETE luôn 403 kể cả của mình, viewer PUT/DELETE 403, admin DELETE 200);
`integration-events-dashboard.test.js` D13-059..065 (event + event_cost: cùng pattern, riêng
event_cost — executor tạo cost cho event NGƯỜI KHÁC sở hữu 403, thấy amount/total_cost đúng theo
chủ sở hữu CỦA EVENT CHA, viewer không bao giờ thấy amount).

Verify: security 6/6, SQLite 754 pass/8 skip, MySQL 761 pass/1 skip, mapping 145/145 PASS,
`verify-g0.mjs` PASS, `git diff --check` sạch. **Còn lại: 9 Direct entity (sponsorship/agreement/
work_log/gift/association_fee/supplier_quote/supplier_transaction/supplier_contact/benefit_usage)
— batch RBAC-EXP-B5..B6 tiếp theo.**

## Wave 1: batch RBAC-EXP-B5 — gắn PolicyEngine cho 3 entity Direct "nhà cung cấp con" (supplier_contact/supplier_transaction/supplier_quote)

Batch 5/6, đúng y hệt mẫu đã lặp lại 3 lần trước (award_participation B4, booking/interaction B3)
— không còn rủi ro thiết kế mới, chỉ còn đúng nghĩa entity/cột.

- `supplier_quotes`/`supplier_transactions`/`supplier_contacts` cũng thiếu `created_by` thật
  (giống `award_participations`/`event_costs` ở B4) — thêm `ALTER TABLE` trước khi wiring.
- `GET /api/suppliers/:id`: quotes/transactions đổi từ maskMoney/org_fee legacy sang
  `projectRecord()` (che `unit_price`/`value`); contacts không có field Confidential nên giữ
  nguyên, chỉ cần gate ghi/xoá.
- Cả 3 entity: CRUD owner_id-gate đúng mẫu B3/B4; **cả 3 DELETE đều sửa đúng** từ map nhầm 'edit'
  (executor xoá được) sang 'delete' thật (chỉ Admin/Super Admin) — cùng pattern đã lặp lại ở B4
  cho award_participation/event_cost. `supplier_quote` không có route PUT (CHARACTERIZATION có
  sẵn, chỉ POST+DELETE) nên không cần wiring PUT.
- `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` + `07-route-catalog.md` (R075-R080, R084-R085 +
  sửa mô tả masking R074) cập nhật theo mẫu đã dùng.

Test mới: D13-066 (viewer tạo cả 3 loại đều 403), D13-067 (supplier_contact: executor tạo 200 +
owner_id đúng, PUT người khác 403/của mình 200, DELETE luôn 403), D13-068+D13-069
(supplier_transaction: che `value` theo owner, PUT người khác 403/của mình 200, DELETE luôn 403,
admin DELETE 200), D13-070 (supplier_quote: che `unit_price` theo owner, DELETE luôn 403, admin
DELETE 200).

Verify: security 6/6, SQLite 759 pass/8 skip, MySQL 766 pass/1 skip, mapping 145/145 PASS,
`verify-g0.mjs` PASS, `git diff --check` sạch. **Còn lại: 6 Direct entity (sponsorship/agreement/
work_log/gift/association_fee/benefit_usage) — batch RBAC-EXP-B6 (batch cuối cùng) tiếp theo.**

## Wave 1: batch RBAC-EXP-B6 — BATCH CUỐI CÙNG, đóng 24/24 entity D13.4a (sponsorship/agreement/work_log/gift/association_fee/benefit_usage)

Batch 6/6 — batch cuối cùng của kế hoạch owner đã duyệt 2026-08-30 (mở rộng route-wiring PolicyEngine
từ pilot `person` ra toàn bộ 24 entity). Sau batch này, **không còn entity D13.4a nào chưa wiring**.

- 6 bảng này cũng thiếu `created_by` thật (giống 9 entity trước ở B4/B5) — thêm `ALTER TABLE`
  trước khi wiring.
- `GET /api/partners/:id`: sponsorships/fees/gifts đổi từ `rbac.maskList`/org_fee legacy sang
  `projectRecord()` (che `amount`/`amount`/`value` theo owner-bypass); agreements/workLogs/
  benefitUsages không có field Confidential nên giữ nguyên, chỉ cần gate ghi/xoá.
- **`gift` cẩn thận**: `owner_id`/`owner_type` trên bảng `gifts` là NGƯỜI/CƠ QUAN NHẬN quà (nghiệp
  vụ), KHÁC với chủ sở hữu RBAC — PolicyEngine dùng cột riêng `responsible_user_id` (đã có sẵn từ
  `ownerColumn('gift')` trong `policy-service.js`, không cần sửa engine).
- Cả 6 entity: CRUD owner_id-gate đúng mẫu B3/B4/B5; **TẤT CẢ DELETE đều sửa đúng** từ map nhầm
  'edit' (executor xoá được) sang 'delete' thật (chỉ Admin/Super Admin) — cùng pattern đã lặp lại
  3 lần trước, không còn phát hiện mới.
- `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` + `07-route-catalog.md` (R007-R015, R018-R027 +
  sửa mô tả masking R003) cập nhật theo mẫu đã dùng.

Test mới: D13-071 (viewer tạo cả 6 loại đều 403), D13-072..077 (mỗi entity: executor tạo 200 +
owner_id/responsible_user_id đúng, PUT người khác 403/của mình 200, DELETE luôn 403 kể cả của
mình, admin DELETE 200; D13-075 xác nhận riêng 2 cột `owner_id` (người nhận) vs
`responsible_user_id` (chủ sở hữu RBAC) của gift KHÁC nhau).

Verify: security 6/6, SQLite 766 pass/8 skip, MySQL 773 pass/1 skip, mapping 145/145 PASS,
`verify-g0.mjs` PASS, `git diff --check` sạch.

**TỔNG KẾT: 24/24 entity D13.4a đã có PolicyEngine wiring** (Global 4: person/organization/
supplier/important_date; Module-admin-only 6: budget/scan_query/source/competitor/campaign/
monitor_alert; Inherited 1: event_cost; Direct 13: booking/interaction/award/award_participation/
event/supplier_quote/supplier_transaction/supplier_contact/sponsorship/agreement/work_log/gift/
association_fee/benefit_usage). Kế hoạch 6 batch RBAC-EXP-B1..B6 owner duyệt 2026-08-30 đã HOÀN
TẤT. Còn lại ngoài scope entity-wiring: UI-flow matrix SS B.2 (Codex lane); `policyService.
prepareUpdate()` chưa route nào gọi thật (routes vẫn `buildUpdate()` sau `assertWritable()`) —
không phải exit criterion của RBAC-EXP-B1..B6, ghi nhận riêng nếu cần dọn sau.

## Wave 1: remediation F21 (P0)/F22 (P1) — Codex audit trên Evidence Bundle F15→RBAC-EXP-B6 BLOCKED

Batch remediation hẹp theo đúng 2 điểm Codex audit trả BLOCKED trên
`18-audit-bundle` (`21-audit-bundle-f15-rbac-exp-b1-b6.md`) — không mở rộng phạm vi sang các phát
hiện Backlog Codex đã liệt kê không chặn bundle (`prepareUpdate()` chưa route nào gọi, mapping
`TODO=1`/`known-red=1` là fixture infra).

- **F21 (P0):** `GET /api/files/:id` trước đây chỉ gate `owner_type='person'`; 5 owner_type còn lại
  (award/supplier/event/agreement/work_log) phục vụ file `private` mặc định không qua bất kỳ policy
  check nào — Viewer tải được tài liệu private của award/supplier/event người khác (bypass D13.3,
  IDOR). Xem chi tiết root cause + resolution đầy đủ ở `01-audit-findings.md` §F21.
  - `server/policy-engine.js#canReadAttachment()`: thêm `entity`/`record`/`parentOwnerId`, owner-
    bypass giống hệt `canReadField()` (Direct: `ownerValue()===principal.id`; Inherited:
    `parentOwnerId===principal.id`; Global/lạ: chỉ Admin/Super Admin).
  - `server/routes.js`: `ATTACHMENT_OWNER_ENTITY` map cố định 6 owner_type có thật →
    `{entity, module, table}`. owner_type KHÔNG có trong map → 403 fail-closed cho MỌI role kể cả
    Admin/Super Admin (không suy diễn). owner_type hợp lệ: check `rbac.can(role,module,'view')`
    rồi fetch bản ghi cha thật, truyền vào `canReadAttachment()`.
  - `person` giữ nguyên 100% hành vi cũ (test D13-011 cũ không sửa, vẫn xanh).
- **F22 (P1):** batch RBAC-CUTOVER (`f170e62`) chỉ rename khoá MATRIX trong code, không migrate dữ
  liệu `users.role='pr_staff'` cũ sang `'executor'` — user thật mang role legacy bị lockout 403 toàn
  bộ route sau deploy (`rbac.MATRIX` không còn khoá `pr_staff`). Fix: `server/db.js#migrate()` thêm
  `UPDATE users SET role='executor' WHERE role='pr_staff'` (tự nhiên idempotent, không cần bọc
  `add()`/`isIgnorableMigrationError()` vì không phải DDL). Export thêm `migrate` từ `db.js` để test
  gọi trực tiếp (tiền lệ giống export `isIgnorableMigrationError` ở F17).
- Test mới: `integration-awards.test.js` D13-078 (award Direct, owner-bypass đúng cả 2 chiều),
  D13-079 (owner_type lạ fail-closed); `integration-suppliers.test.js` D13-080 (supplier Global,
  private luôn Admin-only kể cả người tự upload); `integration-db-contract.test.js` DB-CONTRACT-006
  (migrate() chuyển role + idempotent qua 2 lần gọi).
- Out-of-scope tự phát hiện, KHÔNG sửa (báo cáo theo `12-phase-maintenance.md` mục 4, không phải
  P0/P1 nên không giữ gate theo `CLAUDE.md` mục 5): upload file cho award/supplier/event/agreement/
  work_log vẫn `requirePerm(module,'edit')` thô theo role, chưa gate owner_id của Direct entity (P2,
  backlog); metadata attachment (`id/original_name/mime`, không phải nội dung) trong
  `GET /awards/:id`/`GET /suppliers/:id`/... vẫn trả không lọc theo owner (P3, backlog).

Verify: security 6/6, SQLite 770 pass/8 skip (+4), MySQL 777 pass/1 skip (+4), mapping 145/145
route PASS (route đã tồn tại từ trước, không route mới), `verify-g0.mjs` PASS, `git diff --check`
sạch. Không đổi UI, không đụng route/entity nào ngoài `GET /api/files/:id` và `migrate()`.

**Codex ACCEPTED WITH BACKLOG (2026-08-31, re-audit commit `051a9f9`) — đóng chính thức bundle
`F15 → RBAC-EXP-B6`:** không còn P0/P1 trong phạm vi re-audit. Verify độc lập: tái hiện restart
thật (`pr_staff`→`executor`, có lại `partners:view`); focused SQLite 101/101, focused MySQL 101/101;
full security/SQLite/MySQL/mapping/G0 verifier/diff-check đều exit 0; F15 xác nhận lại vẫn đúng (24
FK thật trên MySQL tạm). Backlog hợp lệ không chặn (đã có owner+wave sẵn trong roadmap, không phải
finding mới): **P2/P3 W1.FILE** (upload chưa gate owner_id của Direct entity; metadata file chưa
lọc theo visibility — xem `01-audit-findings.md` §F21, `04-ROADMAP.md` hàng `W1.FILE`); **W1.ADMIN**
(UI/API gán lại owner) đã có sẵn trong roadmap, không phải việc mới phát sinh. Chuyển sang batch
riêng (W1.FILE) khi owner quyết định ưu tiên tiếp theo.

## Wave 1: batch W1.POLICY.2 — dọn choke point mask read cho list route + CI guard chống tái phát

Theo `/goal` "làm hết các vấn đề của W1" — batch contract đầy đủ ở
`18-g1b-rbac-batch-contract.md#batch-w1policy2-2026-08-31`. Rà soát CÓ HỆ THỐNG (không đợi phát
hiện tình cờ) toàn bộ route GET dùng entity có `FIELD_TIER` Confidential/Restricted, tìm nốt chỗ
còn dùng cơ chế mask cũ (`rbac.maskList`/`senGroups`, SUPERSEDED bởi D13 — `02-decisions.md` hàng
O7) hoặc KHÔNG mask gì cả — mục W1.POLICY.2 đã có sẵn trong `04-ROADMAP.md` từ trước batch F21/F22,
chỉ chưa làm vì ưu tiên P0/P1 trước.

- `GET /api/partners` (list) + nested `people` trong `GET /api/partners/:id`: đổi từ
  `rbac.maskList('organization'|'person', rows, senGroups(req))` sang `projectRecord()` — khớp
  đúng hành vi detail route đã dùng từ RBAC-EXP-B2/B6, tránh lộ field Confidential qua
  `sensitive_perms` cũ mà PolicyEngine không công nhận.
- `GET /api/people` (list): tương tự.
- `GET /api/suppliers` (list): trước đây **KHÔNG mask gì cả** (khác hẳn `GET /suppliers/:id` đã
  dùng `projectRecord()` từ RBAC-EXP-B2, D13-039) — thêm `projectRecord()`.
- `GET /api/budgets`: trước đây **KHÔNG mask gì cả** — `budget.amount` là Confidential nhưng
  `viewer` có `reports:view` (MATRIX) nên thấy hết số tiền. Quyết định thiết kế: Confidential =
  Module-admin-only (chỉ Admin/Super Admin), KHÔNG phụ thuộc quyền `view` module — nhất quán với
  `supplier.service_fee_pct`/`deposit_pct` đã làm ở RBAC-EXP-B2, không phải ngoại lệ riêng của
  budget.
- Dọn rác: xoá hẳn `senGroups/senVisible/canMoney/maskMoney` khỏi `server/routes.js` (hết call
  site thật sau các thay đổi trên) + khỏi `router.testables` + xoá 2 unit test đã mồ côi
  (`BR-VAL-018`/`BR-VAL-019` trong `unit-validation-formatter.test.js`).
- CI guard mới: `scripts/verify-g0.mjs#verifyNoLegacyMasking()` — cấm literal 6 tên hàm
  (`rbac.maskList(`/`rbac.maskRecord(`/`maskMoney(`/`canMoney(`/`senGroups(`/`senVisible(`) xuất
  hiện bất kỳ đâu trong `server/routes.js`, ngăn tái phát pattern này ở route mới về sau.
- `07-route-catalog.md`: cập nhật mô tả mask cho R002/R003/R029/R050/R051/R072 + sửa 1 ghi chú sai
  đã cũ (R051 từng ghi "KHÔNG gate — F1", thực tế RBAC-EXP-B1 đã gắn `moduleAdminOnlyGate` từ
  trước — xác nhận qua `verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` trước khi sửa).
- Test mới: `integration-partners.test.js` D13-081 (list che `membership_fee`), D13-082 (nested
  `people` che `bank_name`/`phone_personal`); `integration-people.test.js` D13-083 (list che
  `bank_name`/`phone_personal`); `integration-suppliers.test.js` D13-084 (list che
  `service_fee_pct`/`deposit_pct`); `integration-bookings-budgets.test.js` D13-085
  (`budget.amount` ẩn với viewer dù có `reports:view`, đầy đủ với admin).
- **Out-of-scope xác định là WON'T-FIX, không phải bug bỏ sót:** P3 backlog của F21 (metadata
  attachment — `id/original_name/mime`, không phải nội dung — chưa lọc theo
  `audience_visibility` khi list file đính kèm trên các entity). Xem lại theo đúng nguyên tắc D13
  "existence vs content" (`02-decisions.md` dòng 96: mọi role ≥ Viewer thấy SỰ TỒN TẠI bản ghi +
  field public; chỉ NỘI DUNG/tải file mới gate) — filename/id của một attachment là "sự tồn tại",
  không phải "nội dung", nên việc mọi role thấy được filename trong khi chỉ owner/Admin tải được
  nội dung là **đúng thiết kế D13**, không phải lỗ hổng. Ghi nhận rõ ở `01-audit-findings.md` §F21
  để không bị hiểu nhầm là backlog treo mãi.
- Verify: `test:security` 6/6, SQLite 781 total/773 pass/8 skip (+5 test mới so với baseline
  F21/F22), MySQL 781 total/780 pass/1 skip (+5), `test:verify-gate1-mapping` 145/145,
  `verify-g0.mjs` PASS (bao gồm `verifyNoLegacyMasking` mới), `verify-g0-selftest` 6/6, `git diff
  --check` sạch. Không đổi route path/method nào, không đổi UI.

## Wave 1: batch W1.FILE-P2 — gate upload attachment theo owner_id cho entity Direct (đóng backlog P2 của F21)

Theo `/goal` "làm hết các vấn đề của W1" — batch contract đầy đủ ở
`18-g1b-rbac-batch-contract.md#batch-w1file-p2-2026-08-31`. Đóng backlog **P2** đã ghi từ batch
F21/F22 (2026-08-31): upload file cho `award`/`event`/`agreement`/`work_log` (entity Direct, có
`owner_id`) trước đây CHỈ gate thô theo role qua `requirePerm(module,'edit')`, không kiểm
`owner_id` — bất kỳ executor nào cũng upload được vào hồ sơ người khác tạo, khác hẳn PUT/DELETE
của chính 4 entity này đã gate `owner_id` từ lâu (RBAC-EXP-B4/B6).

- `POST /awards/:id/files`, `POST /events/:id/files`: thêm fetch record thật + gọi
  `policyService.assertWritable({principal, entity, action:'edit', record})` trước khi insert
  attachment — giống hệt pattern `PUT /awards/:id`/`PUT /events/:id` đã dùng.
- `govFileUpload(ownerType)` (dùng chung cho agreement/work_log) đổi thành
  `govFileUpload(entity, table)` — thêm fetch record từ đúng bảng + `assertWritable()` trước khi
  insert.
- Bỏ `requirePerm(module,'edit')` khỏi cả 4 khai báo route (`assertWritable()` đã tự đủ: viewer
  luôn false, executor cần `owner_id` đúng, admin/super_admin luôn true) — giống cách PUT/DELETE
  của 4 entity này đã làm từ trước.
- **Ngoài phạm vi có chủ đích:** `POST /suppliers/:id/files` (owner_type=`supplier`, kind=`quote`)
  — supplier là entity **Global** (không có owner-bypass trên PUT/DELETE của chính nó, executor
  sửa được bất kể ai tạo), nên gate thô theo role hiện tại là ĐÚNG thiết kế, không phải backlog P2
  — xác nhận qua đọc `GLOBAL` set trong `policy-engine.js` trước khi kết luận, không tự suy diễn.
- `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` thêm 4 route mới; `07-route-catalog.md` cập
  nhật R016/R017/R070/R095 sang mô tả "kiểm INLINE" giống pattern PUT/DELETE của 4 entity này.
- Test mới: `integration-awards.test.js` D13-089 (executor upload vào award người khác trả 403,
  trước đây 200); `integration-events-dashboard.test.js` D13-086 (tương tự cho event, kèm case
  upload vào event của chính mình 200 và admin luôn 200); `integration-partners.test.js` D13-087
  (agreement), D13-088 (work_log).
- Verify: `test:security` 6/6, SQLite 785 total/777 pass/8 skip (+4), MySQL 785 total/784 pass/1
  skip (+4), `test:verify-gate1-mapping` 145/145, `verify-g0.mjs` PASS, `verify-g0-selftest` 6/6,
  `git diff --check` sạch. Đóng backlog P2 của `W1.FILE` — xem `01-audit-findings.md` §F21,
  `04-ROADMAP.md` hàng `W1.FILE`.

## Wave 1: batch W1.POLICY.2-write-side — đóng phần WRITE còn lại của W1.POLICY.2 (F23, tự phát hiện)

Theo `/goal` "làm hết các vấn đề của W1" — batch contract đầy đủ ở
`18-g1b-rbac-batch-contract.md#batch-w1policy2-write-side-2026-08-31`. Trước khi code, chạy 1 audit
độc lập (agent) quét toàn bộ route ghi trong `routes.js`, đối chiếu module khai ở `requirePerm()`
với bảng thực sự bị ghi — đúng tinh thần "CI static rule cấm raw SQL ghi field ngoài policy" mà
roadmap `W1.POLICY.2` mô tả.

- **F23 (P2, tự phát hiện):** `POST /partners/:id/fees/:fid/remind` (R028), `POST
  /awards/:id/remind` (R071), `POST /events/:id/remind` (R096) đều `INSERT INTO important_dates`
  nhưng gate theo `requirePerm(<module cha>,'view')` thay vì `requirePerm('reminders','create')`
  như route chính thống `POST /reminders` (R040) đã dùng đúng — `viewer` (có `<module cha>:view`
  nhưng KHÔNG có `reminders:create` theo MATRIX) tạo được `important_dates` qua lối tắt này, sai
  ranh giới quyền. Đã sửa cả 3 route; không ảnh hưởng executor/admin/super_admin (đã có sẵn
  `reminders:create`). Chi tiết root-cause đầy đủ: `01-audit-findings.md` §F23.
- CI guard mới: `scripts/verify-g0.mjs#verifyImportantDatesGate()` — mọi route có thân hàm chứa
  `INSERT INTO important_dates` phải đăng ký `requirePerm('reminders',*)`. Phạm vi hẹp có chủ đích
  (1 bảng, không phải bộ máy tổng quát map bảng→module) — đã thử nghiệm revert tạm 1 route để xác
  nhận verifier bắt được lỗi trước khi coi là đủ.
- `07-route-catalog.md` sửa R028/R071/R096; `08-permission-matrix.md` Section A: chuyển 3 route
  này từ partners/awards/events sang reminders (đếm lại: partners 41→40, awards 12→11, events
  11→10, reminders 12→15, tổng vẫn 145).
- Test mới: `integration-partners.test.js` D13-090, `integration-awards.test.js` D13-091,
  `integration-events-dashboard.test.js` D13-092 (viewer trả 403 — trước đây 200 — executor vẫn
  200, không regression).
- **Quyết định KHÔNG làm (ghi rõ, không âm thầm bỏ qua):** không xây wrapper
  `authorizedInsert/Update` tổng quát (phần còn lại của mô tả gốc roadmap `W1.POLICY.2`) — audit
  độc lập xác nhận KHÔNG còn write-bypass nào khác trong `routes.js` (10 nhóm bypass gốc của F1 đã
  đóng hết qua RBAC-EXP-B1..B6). Xây thêm 1 lớp wrapper thuần kiến trúc, không có bug cụ thể nào
  thúc đẩy, là premature abstraction theo đúng nguyên tắc kỹ thuật của dự án — xem quyết định đầy
  đủ ở `01-audit-findings.md` §F23, `04-ROADMAP.md` hàng `W1.POLICY.2`.
- Verify: `test:security` 6/6, SQLite 788 total/780 pass/8 skip (+3), MySQL 788 total/787 pass/1
  skip (+3), `test:verify-gate1-mapping` 145/145, `verify-g0.mjs` PASS (bao gồm
  `verifyImportantDatesGate` mới), `verify-g0-selftest` 6/6, `git diff --check` sạch. **Không còn
  backlog nào của `W1.POLICY.2`.**

## Wave 1: batch W1.ADMIN — đóng sub-item cuối cùng của W1 (field-visibility + gán lại owner, backend/API-only)

Theo `/goal` "làm hết các vấn đề của W1" — batch contract đầy đủ ở
`18-g1b-rbac-batch-contract.md#batch-w1admin-2026-08-31`.

- **2 route mới:** `GET /api/admin/field-visibility` (`requirePerm(admin,view)`) và `PUT
  /api/admin/field-visibility` (`requirePerm(admin,edit)`) — expose `policy-visibility-store.js`
  (có sẵn từ trước nhưng chưa từng được gọi qua HTTP) qua API thật. `PUT` enforce D13.2b "chỉ siết
  không nới": chỉ được bật `is_public=true` cho field đã là Public-tier theo
  `policy.classification()`, trả 400 `FORBIDDEN_TIER` nếu không — chặn đúng kịch bản nới lỏng field
  Confidential/Restricted (vd `bank_name`) thành public qua API cấu hình.
- **1 route mới:** `PUT /api/admin/records/:entity/:id/owner` (`requirePerm(admin,edit)`) — gán lại
  owner cho 14 entity Direct qua `REASSIGNABLE_OWNER_TABLE` (entity→tên bảng thật, allowlist cố
  định, fail-closed 400 nếu entity lạ). Phát hiện: `policyService.prepareUpdate()` đã có sẵn logic
  `OWNER_TRANSFER_ADMIN_ONLY` từ các batch RBAC trước, nhưng KHÔNG route nào từng lọt field
  owner_id/responsible_user_id qua `pick()` allowlist — logic tồn tại nhưng không thể gọi tới trong
  thực tế cho đến batch này. Route mới đi qua `prepareUpdate()` làm defense-in-depth dù
  `requirePerm(admin,edit)` (gate thô hơn) đã giới hạn admin/super_admin.
- **Rà soát role management (mục thứ 3 của `W1.ADMIN`):** xác nhận `PUT /admin/users/:id` đã có sẵn
  bảo vệ D13.1 escalation (Admin không sửa được tài khoản Admin-trở-lên, chỉ Super Admin) — không
  cần code thêm.
- **Lần đầu tiên trong session thêm route MỚI** (các batch trước chỉ re-gate route có sẵn) — kéo
  theo cập nhật toàn bộ hệ thống tài liệu tự-verify: `07-route-catalog.md` (+R146/R147/R148, header
  145→148), `08-permission-matrix.md` (Section A admin 5→8 route, tổng 145→148; Section B thêm flow
  F035 + token mới `D-MISSING` cho route backend/API chưa có UI — khác `D-403` vốn dành cho route
  CÓ UI nhưng thiếu trang 403 chuẩn; 34→35 flow), `scripts/verify-g0.mjs` và
  `scripts/verify-gate1-mapping.mjs` (hằng số 145/34→148/35) + `gate1-test-mapping.md` (+3 dòng),
  `server/test/ui-characterization.test.js` (assertion 34/145→35/148), `16-coding-rules.md` và
  `README.md` (đếm endpoint/route song hành).
- **Quyết định không dựng UI:** UI/MDS thuộc lane Codex theo `CLAUDE.md` mục 6, chưa được owner
  giao lại — không tự dựng view giả để "có bằng chứng" `D-LIST`/`D-EMBED`; dùng token `D-MISSING`
  ghi trung thực hiện trạng thay vì bịa bằng chứng.
- Test mới: `server/test/integration-auth-admin.test.js` R146/R147/R148 — 15 test (happy/invalid/
  not-found/unauthenticated/forbidden), cả SQLite lẫn MySQL driver.
- Verify: `test:security` 6/6, SQLite 803 total/795 pass/8 skip (+15), MySQL 803 total/802 pass/1
  skip (+15), `test:verify-gate1-mapping` 148/148, `verify-g0.mjs` PASS toàn bộ 9 check,
  `verify-g0-selftest` 6/6, `git diff --check` sạch.
- **`W1.ADMIN` là sub-item cuối cùng còn mở của `W1`** — sau khi rà soát lại toàn bộ bảng `W1.*`
  trong `04-ROADMAP.md`, không còn sub-item nào khác ở trạng thái mở: **W1 đóng hoàn toàn.**

## Wave 1: batch F24-remediation — Codex audit BLOCKED hẹp trên bundle đóng W1 (P1: deny upload có side-effect)

Codex audit `22-audit-bundle-w1-close.md` trả **BLOCKED hẹp** (không mở lại toàn batch, đúng
`17-fast-track-collaboration.md` §8): **F24 (P1)** — 4 route upload file (award/event/agreement/
work_log) chạy `assertWritable()` SAU khi Multer đã ghi file thật vào `UPLOAD_DIR` — tái hiện thật:
executor upload vào award của admin nhận đúng `403` nhưng số file trên đĩa vẫn tăng `0→1`, tạo file
mồ côi không có row `attachments` quản lý, vi phạm nguyên tắc "deny phải không có side-effect".

- **Root cause:** batch `W1.FILE-P2` đặt `policyService.assertWritable()` BÊN TRONG handler, đứng
  SAU `upload.array(...)` (Multer, disk storage) trong thứ tự middleware Express — Multer luôn chạy
  trước, ghi file xong mới tới lượt authorization.
- **Fix:** middleware mới `requireFileWrite(entity, table, moduleLabel)` (`server/routes.js`) — fetch
  record thật + `assertWritable()` TRƯỚC `upload.array()`, chỉ `next()` khi hợp lệ. Đặt middleware
  này làm bước đầu tiên cho cả 4 route; xoá check trùng lặp trong `govFileUpload()` và 2 handler
  inline award/event. Giữ nguyên message lỗi 403 gốc từng route qua tham số `moduleLabel`.
- Test mới: `server/test/integration-file-write-authz.test.js` (8 test table-driven, cả 2 driver) —
  mỗi entity: case deny (executor upload vào record người khác → 403 + `attachments` KHÔNG tăng +
  file vật lý trong `UPLOAD_DIR` KHÔNG tăng) và case đối chứng (upload vào record chính mình → 200
  + cả 2 số liệu tăng đúng 1, xác nhận phép đếm thật sự nhạy). Đã thí nghiệm revert tạm fix để xác
  nhận test bắt đúng lỗi F24 (403 vẫn đúng nhưng file-count tăng `0→1`) trước khi coi test là đủ.
- Verify: `test:security` 6/6, SQLite 811 total/803 pass/8 skip (+8), MySQL 811 total/810 pass/1
  skip (+8), `test:verify-gate1-mapping` 148/148, `verify-g0.mjs` PASS toàn bộ 9 check,
  `verify-g0-selftest` 6/6, `git diff --check` sạch.
- **Đã fix, chờ Codex re-audit tập trung đúng F24** — chưa tự tuyên bố W1 CLOSED chính thức trong
  tài liệu cho tới khi có kết quả re-audit (bundle `22-audit-bundle-w1-close.md` cập nhật kèm fix).

## Wave 1: Codex ACCEPTED re-audit F24 — W1 (backend/security) CHÍNH THỨC CLOSED

Codex re-audit tập trung đúng F24 (không mở lại 4 batch gốc trong `22-audit-bundle-w1-close.md`,
theo `17-fast-track-collaboration.md` §8): xác nhận độc lập `requireFileWrite()` chạy authorization
TRƯỚC Multer ở đủ 4 route (`routes.js:365,391,1333,1657`); chạy lại độc lập 8 test F24 trên cả
SQLite/MySQL — mọi upload trái quyền đều 403 không tăng `attachments`/`UPLOAD_DIR`, upload đúng
quyền tăng đúng 1 ở cả hai nơi; G0 verifier, mapping 148/148, `git diff --check` đều xanh.
**Decision: ACCEPTED — chấp nhận remediation `0e0c2d6`/docs `707cc45`.** UI Native-MDS cho
`W1.ADMIN` vẫn là lane UI riêng (chưa giao lại Claude), không ảnh hưởng kết luận đóng W1 backend.

**→ W1 (D13 RBAC v2 + security F1/F2/F3/F4/F8/F9/F11) nay CHÍNH THỨC CLOSED phía backend/security,
Codex xác nhận (2026-08-31).** Toàn bộ khối việc lớn nhất của roadmap (Gate 0 → Gate 1 → Wave 1) đã
đóng qua 2 bundle audit (`21-audit-bundle-f15-rbac-exp-b1-b6.md`, `22-audit-bundle-w1-close.md`) +
1 vòng remediation P0/P1 mỗi bundle (F21/F22, rồi F24) — không còn P0/P1 nào mở. Chuyển ưu tiên
sang **Wave 2** (`04-ROADMAP.md`).

## W2.6 recheck theo yêu cầu owner — chạy lại eval độc lập, xác nhận lại quyết định GIỮ PIN

Owner đề nghị đổi `GEMINI_TEXT_MODEL` sang `gemini-3.7-flash`, tin rằng đây là model mới/chưa từng
test. Chỉ ra W2.6 gốc (2026-08-30) đã test đúng model này bằng 360 lệnh gọi thật và kết luận giữ pin
do regression ở `event-extract` + đuôi latency xấu. Owner chọn chạy lại eval trước khi quyết định
thay vì đổi ngay hoặc giữ nguyên theo dữ liệu cũ.

Chạy lại độc lập đủ 360 lệnh gọi thật (tag `recheck`, cách bản gốc 1 ngày), thêm `--tag=` cho
`scripts/w26-eval-analyze.mjs` để phân tích song song không ghi đè dữ liệu cũ. Kết quả lặp lại gần
như y hệt: `gemini-3.5-flash` schema=100%/acc=99.7%, `gemini-3.7-flash` schema=100%/acc=98.8% nhưng
**event-extract riêng vẫn thua rõ** (95%/95% so với pin 100%/100%, khớp mẫu regression gốc). Latency
trung vị của candidate cải thiện (4.2s so với 8.0s) nhưng **đuôi xấu nhất tệ hơn** (max 96.7s so với
70.7s gốc) — rủi ro đuôi latency dài không phải nhiễu một lần, tái hiện độc lập.

**Quyết định (không đổi so với gốc): GIỮ NGUYÊN pin `gemini-3.5-flash`**, không đổi
`cfg.GEMINI_TEXT_MODEL`. Owner đồng ý sau khi xem dữ liệu recheck. Dữ liệu thô
`scripts/.w26-eval-out/results-recheck.jsonl` commit cùng bản gốc làm evidence. Tổng chi phí 2 lần
eval: $4.456 + $4.531 = $8.987/$200 (O6). Không đổi code sản phẩm/test, chỉ thêm tham số `--tag=`
tương thích ngược.

## W3.VOICE.SECURE-COMMAND + W3.VOICE.1 — luồng propose/confirm an toàn cho voice command (backend/API-only)

Owner giao `/goal`: làm việc Wave 2/3/4 thuộc lane Claude, để lại việc lane Codex. Rà toàn bộ
Wave 2-4 theo `17-fast-track-collaboration.md` §1: mọi slice UI Wave 3 + toàn bộ Wave 4 là
lane Codex (UI/MDS/WebView-host); W2.2 chạm `frontend/` — lane Codex; W2.3/W2.4 chặn ngoài bởi O5
(DevOps, chưa có việc mới). W3.VOICE.SECURE-COMMAND + W3.VOICE.1 là backend thuần, thiết kế đã
chốt sẵn ở D14.4 (`02-decisions.md` §E) từ round-3 re-audit Codex — chọn làm batch kế tiếp. Batch
Contract: `23-w3voice-securecommand-batch-contract.md`.

Mechanical trước (commit riêng, không đổi hành vi): tách `buildInsert`/`buildUpdate`/`logEdit` từ
`routes.js` sang `server/db-helpers.js` dùng chung với `ai.js`.

Feature: bảng mới `voice_proposals` (đối tượng đề xuất bất biến, gắn `user_id`, TTL 10 phút, chứa
snapshot toàn bộ candidate đã khớp kèm `relationship_score` tại thời điểm đề xuất). `POST
/ai/interaction-voice-propose` (R149) chạy Gemini y hệt `/interaction-voice` cũ (route cũ giữ
nguyên, không đụng) nhưng không tự chọn khi ≥2 candidate trùng tên — trả `proposalId` thay vì để
client giữ payload thô. `POST /ai/interaction-voice-confirm` (R150) chỉ nhận
`proposalId`+`idempotencyKey`+`edits` tường minh (chống tamper — không nhận lại toàn payload); chọn
candidate ngoài danh sách đã đề xuất bị 400; re-chạy `policyService.prepareCreate`/`assertWritable`
tại confirm (không tin quyền đã kiểm lúc propose); atomic claim
(`UPDATE voice_proposals SET status='confirmed' WHERE status='pending'`, check `changes===1`) là
gate duy nhất chống double-confirm; đổi `relationship_score` là bước riêng dùng CAS
(`UPDATE people SET relationship_score=? WHERE id=? AND relationship_score=snapshot`) — stale thì
chỉ phần điểm bị từ chối (`scoreApplied:false`), interaction đã tạo không mất (codebase không có
transaction đa-câu-lệnh, xem comment trong `ai.js`). `suggested_score_delta` do Gemini tự đề xuất
trong lời nói (không phải quy tắc BA của Claude — D14.3 vẫn treo), server chỉ kẹp biên an toàn
`[-10,10]`.

Test mới `server/test/integration-voice-secure-command.test.js` (10 test): happy path, principal
binding (403 khi user khác confirm), hết hạn (410), double-confirm cùng key (idempotent) và khác
key (409), lost-update `relationship_score` (CAS reject, interaction vẫn còn), không có score
delta, quyền bị rút giữa propose/confirm (403). Bug tự phát hiện: helper test gọi `fetch()` không
định danh trong lúc `global.fetch` đang bị mock để chặn Gemini — vô tình bắt luôn lời gọi tới local
test server; sửa bằng cách chốt `realFetch` trước khi mock, theo đúng khuôn mẫu
`integration-ai-golden.test.js`.

Cập nhật toàn bộ apparatus tự-kiểm-chứng (route catalog/permission matrix/UI-flow/gate1-mapping/
schema/verify-g0/verify-gate1-mapping, lặp lại tiền lệ `W1.ADMIN`): route 148→150, UI-flow 35→36
(`F036`), bảng 35→36 (`voice_proposals`, không vào `dropAll()` — đúng quyết định `W1.RBAC.0`), index
22→23. Full regression: security 6/6, SQLite 821/8 skip (0 fail), MySQL 821/1 skip (0 fail),
`verify-g0.mjs` PASS, `verify-gate1-mapping` 150/150 PASS, `git diff --check` sạch.

**Không dựng UI cho R149/R150** — lane Codex, chưa được giao lại; contract sẵn sàng cho slice UI
Voice ở Wave 3 khi tới lượt. Commit `506311a` (mechanical), `b6ba61e` (feature+test). **Chưa gửi
Codex audit** — batch đứng riêng, sẽ chuẩn bị Evidence Bundle riêng.

## Remediation F25/F26/P2 — Codex audit BLOCKED hẹp trên bundle W3.VOICE.SECURE-COMMAND, đã fix

Codex audit `24-audit-bundle-w3voice-securecommand.md` trả BLOCKED với 2 MUST-FIX P1 + 1 P2 gộp
chung, sau khi xác nhận phần lớn thiết kế đúng hướng (10/10 test cũ xanh, principal binding/
tampering/quyền-re-check/score-clamp đều đúng): **F25** route confirm claim proposal `confirmed`
trước rồi mới ghi interaction — không bọc transaction, nên lỗi giữa chừng (Codex tự tạo trigger ép
`INSERT` lỗi, tái hiện HTTP thật) làm proposal kẹt vĩnh viễn ở `confirmed` mồ côi (không có
interaction), retry trả `200` giả vờ thành công — mất lệnh người dùng thật. **F26** CAS
`relationship_score` stale trước đây chỉ bỏ qua phần điểm, vẫn tạo interaction — trái nguyên văn
D14.4 ("từ chối và yêu cầu chuẩn bị lại" khi snapshot khác hiện tại). **P2** `idempotencyKey` không
bắt buộc, ghi `null` khi thiếu — mất khả năng retry đáng tin cậy.

Fix (commit `05826b4`): thêm `withTransaction(fn)` (`server/db.js`) — bọc `BEGIN`/`COMMIT`/
`ROLLBACK` thô qua `db.exec()`; an toàn dùng được vì cả 2 driver (`DatabaseSync` SQLite,
`MySQLSyncDatabase` MySQL qua worker 1-connection) đều gọi đồng bộ, không `await` xen giữa trong 1
request handler nên không request nào khác chen vào giữa transaction được. Route confirm nay bọc
claim + insert interaction + audit + cập nhật `result_interaction_id` + CAS điểm trong 1
`withTransaction()` — lỗi ở bước nào cũng ROLLBACK về đúng `pending`, retry thật sự tạo lại được.
CAS điểm stale nay ROLLBACK toàn bộ (kể cả interaction vừa insert), trả `409 PROPOSAL_STALE` — phân
biệt rõ với nhánh thiếu QUYỀN sửa điểm (`PolicyForbiddenError`, giữ nguyên hành vi cũ vì đó là thiếu
quyền chứ không phải dữ liệu lệch thời điểm). TTL claim chuyển vào ngay câu `UPDATE`
(`AND expires_at > datetime('now')`) thay vì chỉ dựa `isExpired()` JS trước đó. `idempotencyKey` nay
bắt buộc (string không rỗng, ≤200 ký tự), thiếu/sai trả `400 VALIDATION_FAILED`.

Test: sửa 5 test hiện có (thêm `idempotencyKey` bắt buộc vào mọi lời gọi `confirm()`; đổi kỳ vọng
test stale-score từ `200`/`scoreApplied:false` sang `409 PROPOSAL_STALE`/không tạo interaction);
thêm 2 test mới — thiếu/rỗng `idempotencyKey` → 400; lỗi giữa chừng dùng CHECK constraint (MySQL,
vì `CREATE TRIGGER` cần quyền SUPER khi bật binary log) / TRIGGER (SQLite) tạm thời ép thật sự
`INSERT` lỗi có điều kiện, không dùng mock JS (mock không xác nhận được hành vi transaction/rollback
thật ở tầng DB) — xác nhận proposal quay về `pending`, retry sau khi gỡ lỗi tạo đúng 1 interaction.
12/12 test xanh cả SQLite/MySQL.

Full regression: security 6/6, SQLite 823 total/815 pass/8 skip (+2), MySQL 823 total/822 pass/1
skip (+2), `verify-g0.mjs` PASS, `verify-gate1-mapping` 150/150 PASS, `git diff --check` sạch. Chi
tiết: `01-audit-findings.md` §F25/§F26/P2, `24-audit-bundle-w3voice-securecommand.md` mục
"Remediation F25/F26/P2". **Chờ Codex re-audit đúng 5 hành vi đã yêu cầu**, không mở rộng sang UI
Voice/MDS trong vòng backend này (đúng phạm vi Codex đã giới hạn).

## F25/F26/P2 ACCEPTED — remediation F27 (parent entity TOCTOU) sau re-audit Codex

Codex re-audit xác nhận **ACCEPTED F25/F26/P2**: chạy lại độc lập 12/12 test voice cả SQLite/MySQL,
tự xác nhận transaction bọc claim→interaction→audit→result pointer→CAS đúng (`server/ai.js`),
`PROPOSAL_STALE` không tạo interaction, `idempotencyKey` bắt buộc + validate đúng, `verify-g0`/route
mapping/`git diff --check` đều xanh — không mở lại phần này.

Cùng lúc phát hiện **F27 (P1 mới)**: cơ chế snapshot batch gốc chỉ bảo vệ `relationship_score` (dùng
cho CAS) và chỉ chạy khi có score delta — KHÔNG có cơ chế nào đọc lại/so sánh person hoặc
organization đã chọn khi KHÔNG sửa điểm. Codex tái hiện HTTP thật: propose 1 interaction với person
hợp lệ (không score delta) → xoá person trước confirm → confirm vẫn trả `200`, proposal `confirmed`,
interaction mới giữ `partner_id` trỏ tới person đã bị xoá — trái D14.4 (server phải đọc lại bản ghi
hiện tại và so snapshot/revision trước khi ghi).

Fix (commit `340e4a8`): đọc lại ĐÚNG các field đã snapshot cho person (`name`/`org_name`/
`relationship_score`) và org (`name`/`org_type`) TRƯỚC khi ghi bất kỳ gì, cho MỌI parent đã chọn —
không chỉ khi có score delta. Coi toàn bộ snapshot candidate (đã trả cho người dùng lúc propose) là
"revision" thực tế, thay vì thêm cột `revision` riêng cho `people`/`organizations` + instrument mọi
đường ghi 2 bảng đó trong toàn bộ code base — phạm vi hẹp hơn nhiều, và so sánh trực tiếp bản ghi
hiện tại đã bao phủ hết mọi đường ghi có thể (không phụ thuộc việc có nhớ tăng `revision` đúng chỗ
hay không). Khi phát hiện stale (row bị xoá HOẶC bất kỳ field snapshot nào khác đi), proposal chuyển
sang trạng thái **terminal `stale`** và `COMMIT` (khác với lỗi thật — vẫn `ROLLBACK` về `pending`,
retry được) — không bao giờ insert interaction, và không thể "sống lại" nếu dữ liệu vô tình quay về
đúng snapshot cũ (vd điểm đổi rồi đổi lại) — đúng đề xuất #3 của Codex.

Test: 3 test mới (person bị xoá không score delta, organization bị xoá, person đổi tên — cả 3 đều
`409 PROPOSAL_STALE`, không tạo interaction, proposal chuyển `stale`); sửa test stale-score cũ (assert
`status='stale'` thay vì `'pending'`, thêm bước retry vẫn `409`). 15/15 test xanh cả 2 driver (tăng
từ 12).

Full regression: security 6/6, SQLite 826 total/818 pass/8 skip (+3), MySQL 826 total/825 pass/1
skip (+3), `verify-g0.mjs` PASS, `verify-gate1-mapping` 150/150 PASS, `git diff --check` sạch. Chi
tiết: `01-audit-findings.md` §F27, `24-audit-bundle-w3voice-securecommand.md` mục "Remediation F27".
**Chờ Codex re-audit đúng 3 case đã yêu cầu** (person xoá, org xoá, revision stale), không mở lại
F25/F26/P2 đã ACCEPTED.

## F27 ACCEPTED — remediation F28 (row lock MySQL nhiều instance) sau chính vòng re-audit đó

Codex re-audit xác nhận **ACCEPTED F27**: chạy lại độc lập đúng 3 case bắt buộc (person bị xoá,
organization bị xoá, revision/snapshot drift) trên 15/15 test cả SQLite/MySQL — F27 đóng, không mở
lại.

Cùng lúc phát hiện **F28 (P1 release blocker)**: freshness re-check F27 vừa thêm
(`fetchPersonSnapshot`/`fetchOrgSnapshot`, `server/ai.js`) chỉ dùng plain `SELECT`, không giữ row
lock. Trong 1 process không sao — `withTransaction()` đảm bảo không handler nào khác của CHÍNH
process đó chen được vào giữa. Nhưng trên MySQL khi triển khai **nhiều Cloud Run instance** (mỗi
instance là 1 process/connection MySQL riêng), 1 instance khác vẫn `UPDATE`/`DELETE` được đúng row
parent giữa lúc instance A đọc snapshot và lúc A `INSERT` interaction — race **liên-process** thật,
khác hẳn F27 (chỉ trong cùng 1 process). Codex chốt: không chặn việc đóng F27, nhưng phải sửa trước
khi deploy/scaling nhiều instance; không cần mở rộng sang UI hoặc thêm schema revision.

Fix (commit `d8ff14b`): export `isMysql` từ `server/db.js` (dựa vào `DB_CLIENT` module-level sẵn
có). `fetchPersonSnapshot`/`fetchOrgSnapshot` dùng `SELECT ... FOR UPDATE` khi `isMysql`, giữ nguyên
plain `SELECT` cho SQLite — claim `UPDATE` đã lấy write lock toàn DB (SQLite chỉ có 1 writer tại 1
thời điểm) và SQLite cũng không hỗ trợ cú pháp `FOR UPDATE`. Đúng đề xuất Codex, không thêm cột
`revision`.

Test mới (`integration-voice-secure-command.test.js`, tăng 15→17, 2 test MySQL-only qua
`{ skip: !isMysql }`): dùng 2 connection `mysql2/promise` **độc lập với app** — connA giữ
`SELECT ... FOR UPDATE` (đúng câu SQL fix vừa thêm) trên row person, connB thử `UPDATE`/`DELETE`
cùng row phải bị **CHẶN** cho tới khi connA `COMMIT`/`ROLLBACK`. Không đi qua HTTP route thật được:
`MySQLSyncDatabase` (`server/mysql-sync.js`) chặn đồng bộ chính main thread bằng `Atomics.wait` khi
gọi MySQL — nếu giữ lock trước rồi gọi HTTP confirm() trên cùng 1 process test, main thread sẽ đóng
băng chờ MySQL cấp lock, nhưng chính main thread đó lại là nơi duy nhất chạy được code JS để
COMMIT/ROLLBACK connection đang giữ lock → tự deadlock chính test process (không phải lỗi của fix).
Vì vậy test xác minh trực tiếp cơ chế khoá mà fix dựa vào, bằng đúng câu SQL production dùng.

Full regression: SQLite 826 total/818 pass/8 skip (không đổi — 2 test mới skip trên SQLite), MySQL
828 total/827 pass/1 skip (+2), `verify-g0.mjs` + `verify-gate1-mapping` 150/150 PASS, `git diff
--check` sạch. Chi tiết: `01-audit-findings.md` §F28, `24-audit-bundle-w3voice-securecommand.md` mục
"Remediation F28". **Chờ Codex re-audit F28**, không mở lại F25/F26/P2/F27 đã ACCEPTED.

## F28 ACCEPTED — W3.VOICE.SECURE-COMMAND backend CLOSED

Codex re-audit xác nhận **ACCEPTED F28**: tự chạy lại độc lập SQLite 15/15 và MySQL 17/17 (bao gồm
2 test 2-connection chứng minh `SELECT ... FOR UPDATE` chặn `UPDATE` từ connection khác tới khi
`COMMIT`, và chặn `DELETE` tới khi `ROLLBACK`), `verify-g0`/route mapping/`git diff --check` đều pass.

Quyết định của Codex: **`W3.VOICE.SECURE-COMMAND` backend đủ điều kiện CLOSED** — toàn bộ chuỗi
remediation của batch này đã có bằng chứng: transaction rollback lỗi giữa chừng (F25), TTL claim
atomic + CAS điểm đúng D14.4 (F26), `idempotencyKey` bắt buộc (P2), parent person/organization
re-check trước khi ghi + trạng thái terminal `stale` (F27), row lock MySQL nhiều instance (F28).
Không còn P1/MUST-FIX nào mở trên batch W3.VOICE.SECURE-COMMAND + W3.VOICE.1. Chi tiết:
`01-audit-findings.md` §F28, `24-audit-bundle-w3voice-securecommand.md`.

## W3.SMART-INTAKE.AWARD — UI đề xuất AI cho giải thưởng (Desktop MDS + Native composition)

Thêm luồng `Bóc tách AI` từ Award List, dùng endpoint hiện hữu `POST /api/ai/award-extract`. Đây
là luồng **draft-first**: người dùng chọn đúng một nguồn (dán nội dung, URL HTTPS hoặc tệp
ảnh/PDF), nhận object `extracted`, sau đó được chuyển sang Award create form để xem, sửa và bấm
lưu một cách chủ động. Không có request `POST /awards` nào từ màn Intake.

- `frontend/src/features/awards/domain/awards-api.mjs`: thêm `extract()` với credential
  same-origin, JSON cho text/URL và `FormData` cho file; từ chối thiếu hoặc nhiều nguồn để không có
  thứ tự ưu tiên ngầm ở client.
- `AwardIntakeDesktop.vue` và `AwardIntakeMobile.vue`: hai composition MDS riêng; Native có
  `MMobileTopBar`, discard dialog và safe-area sticky action, không fallback sang desktop shell.
- `AwardsListFeature.vue`: kết quả AI chỉ tạo `state.record` rồi chuyển `state.mode='create'`.
  Khi principal không có `sensitiveGroups.org_fee`, `cost` bị bỏ khỏi bản nháp trước khi render,
  tránh mở rộng bề mặt tiết lộ dữ liệu nhạy cảm qua UI. Quyền API/AI policy vẫn do server quyết định.
- `UI-AWARD-005`: khóa endpoint/payload, FormData, single-source validation, draft-first,
  redaction UI affordance và hai composition MDS.

Kiểm chứng: `node --test server/test/unit-interactions-ui.test.js` **20/20 pass**; `npm run
build:ui` pass; `git diff --check` sạch. Event Smart Intake, native AMIS host runtime, bridge và
device accessibility chưa nằm trong slice này.

## W3.SMART-INTAKE.EVENT — UI đề xuất AI cho sự kiện (Desktop MDS + Native composition)

Thêm luồng draft-first cho `POST /api/ai/event-extract`, đúng hợp đồng backend: một văn bản **hoặc**
một tệp Excel/CSV. Client không gửi URL, PDF hay ảnh cho endpoint Event và không tự ghi `POST /events`.
Kết quả `extracted` chỉ mở Event create form để người dùng kiểm tra, sửa rồi chủ động lưu.

- `events-api.mjs#extract()` tách JSON text / `FormData` file, từ chối thiếu hoặc nhiều nguồn và
  giữ nguyên `missing`/`warnings` từ server.
- `EventIntakeDesktop.vue`/`EventIntakeMobile.vue` là hai composition MDS riêng; Native có top bar,
  discard dialog và safe-area action, không fallback desktop.
- `EventCreateDesktop.vue`/`EventCreateMobile.vue` nhận và hiển thị cảnh báo đọc file/trường AI
  chưa thấy ngay trong form review; tránh lỗi chuyển màn hình làm mất tín hiệu để người dùng đối
  chiếu trước khi lưu. Chuỗi ngày `YYYY-MM-DD` được đổi thành `YYYY-MM-DDT00:00` cho control
  `datetime-local`, không bịa giờ thực tế.
- `UI-EVENT-009` khóa contract endpoint, input type, single-source, warning/missing retention,
  draft-first, MDS Desktop/Native và normalized date.

Kiểm chứng: `node --test server/test/unit-interactions-ui.test.js` **21/21 pass**; `npm run
build:ui` pass; `git diff --check` sạch. AI policy/validation/authorization vẫn ở server;
native AMIS bridge, thiết bị và accessibility runtime tiếp tục **UNVERIFIED** tới O3/W4.

## W3.MONITOR.DASHBOARD.READ — Monitoring Dashboard MDS (Desktop + Native)

Thêm dashboard giám sát read-only, feature-flagged `monitoringDashboardRead` (local harness:
`uiMonitoringPilot=1`), qua `GET /api/monitor/dashboard`. Người dùng có thể đổi khoảng 7/30/90 ngày;
dashboard chỉ hiển thị KPI tổng quan, crisis state, sentiment/NSR, lần quét và cảnh báo projection.
Không có scan, mutation mentions, cấu hình nguồn/từ khóa/campaign hoặc action AI grounding trong slice này.

- `monitoring-api.mjs` chỉ gọi `/api/me` và `/monitor/dashboard`; `monitoring-view.mjs` chuẩn hóa
  số để không lặp lỗi MySQL trả numeric string.
- Có hai composition Desktop/Native riêng với `MMobileTopBar`, safe area và fail-closed khi không có
  Native host; không render desktop shell trên mobile.
- Award và Monitoring được `defineAsyncComponent()` lazy-load. Build giảm entry `vue-app.js` từ
  khoảng 500 kB xuống **436.99 kB** và tạo chunk độc lập cho từng feature — không tăng ngưỡng để che
  warning performance.
- `UI-MONITOR-001` khóa API/projection, MDS/native split, feature flag và lazy-load.

Kiểm chứng: `node --test server/test/unit-interactions-ui.test.js` **22/22 pass**; `npm run
build:ui` pass (entry 436.99 kB, không warning chunk size); `git diff --check` sạch. Các lane
Monitoring write/AI và native device/bridge vẫn chưa được mở.

## W3.REPORTS.OVERVIEW.READ — Reports Overview MDS (Desktop + Native)

Thêm Reports Overview read-only, feature-flagged `reportsOverviewRead` (local harness:
`uiReportsPilot=1`), dùng duy nhất projection `GET /api/reports`. UI hiển thị tổng chi, ngân sách,
chi booking/sự kiện/hội phí, quy mô mạng lưới và đầu mối cần chăm sóc theo kỳ tháng/quý/năm; không
tự tổng hợp tiền từ dữ liệu dòng ở client và không đưa action write/print/export vào pilot.

- `dateRange()` tạo ngày đầu/cuối tháng, quý, năm. Test phát hiện và sửa lỗi cuối tháng từng ra
  chuỗi không hợp lệ `2026-03-00`; giờ dùng ngày cuối thực của calendar, phủ cả tháng 2/quý.
- `reports-view.mjs` chuyển numeric string từ MySQL về number ở view-model, trong khi tổng tiền vẫn
  là giá trị server trả về — tránh tái diễn F14/F16.
- Desktop/Native là hai composition MDS riêng, Native có topbar + safe area; feature lazy-load thành
  `vue-ReportsOverviewFeature.js` 10.53 kB. Entry bundle giữ **437.98 kB**.
- `UI-REPORT-001` khóa phạm vi ngày, endpoint, numeric projection, không tính lại tiền, MDS/native
  split và flag/lazy-load.

Kiểm chứng: `node --test server/test/unit-interactions-ui.test.js` **23/23 pass**; `npm run
build:ui` pass (không warning chunk size); `git diff --check` sạch. Báo cáo chi tiết và native
runtime evidence vẫn là slice sau/O3-W4.

## W3.ADMIN.USERS.READ — Admin Users MDS (Desktop + Native)

Thêm danh sách người dùng read-only, feature-flagged `adminUsersRead` (local harness:
`uiAdminPilot=1`), qua `GET /api/admin/users`. View-model chỉ giữ id/tài khoản/tên/email/role/trạng
thái/nhắc; đặc biệt **không** đưa `sensitive_perms` vào model hoặc render mặc dù endpoint được Admin
đọc. Desktop/Native là hai composition MDS riêng, Native có topbar/safe-area; feature lazy-load thành
chunk 5.95 kB, không nở entry bundle.

`UI-ADMIN-001` khóa endpoint/projection omission, cấm mutation, MDS/native split và route flag.
Create/edit/delete user, audit log, field visibility và reassign owner không bị giả lập ở UI read
pilot — sẽ đi batch mutation có confirmation, server 403 và PolicyEngine evidence riêng.

## W3.ADMIN.AUDIT.READ — Audit log MDS (Desktop + Native)

Mở audit log read-only trong Admin feature qua `GET /api/admin/audit`. Client đọc `/api/me` chỉ để
gợi affordance `Nhật ký audit` cho Super Admin; không coi role UI là authorization. Server tiếp tục
trả 403 cho Admin thường hoặc principal bị thu hồi quyền sau khi màn hình đã render.

- `admin-api.mjs` thêm `getCurrentUser()` và `getAudit()` với `credentials: 'same-origin'`; payload
  audit không có `rows` bị coi là lỗi hợp đồng 502, không render state dở dang.
- `adminAuditViewModel()` chỉ chuẩn hóa đúng các trường audit (`actor/action/entity/entityId/detail/
  timestamp`), tách khỏi view model user để `sensitive_perms` không thể vô tình chảy qua màn Users.
- `AdminAuditDesktop.vue` dùng table MDS trên nền trang xám, card shadow và action Quay lại;
  `AdminAuditMobile.vue` là native mini-app list riêng với top bar/safe-area, không dùng desktop
  header/sidebar. Users Desktop/Native chỉ hiện entry point khi principal là `super_admin`.
- `UI-ADMIN-002` kiểm chứng endpoint protected, projection, affordance Super Admin, hai composition
  MDS và recovery 403; không có mutation UI trong slice này.

Kiểm chứng: `node --test server/test/unit-interactions-ui.test.js` **25/25 pass**; `npm run
build:ui` pass (Admin lazy chunk 11.45 kB, entry 438.97 kB); `git diff --check` sạch. User CRUD,
field visibility và reassign owner vẫn là các mutation slice kế tiếp; native AMIS host/device test
vẫn **UNVERIFIED** tới O3/W4.

## W3.ADMIN.USERS.WRITE — User CRUD MDS (Desktop + Native)

Mở create/edit/delete User trên API hiện hữu `POST/PUT/DELETE /api/admin/users`. Đây là UI
affordance theo `/api/me`, không thay thế D13.1 ở server: Admin thường không thể tạo/nâng/sửa/xóa
tài khoản Admin/Super Admin trái quyền; mọi thay đổi quyền giữa lúc form mở vẫn trả 403 từ API.

- `admin-user-write.mjs` tạo draft có thể reactive và payload allowlist. Create chỉ gửi
  `username/password/full_name/role/email`; update chỉ gửi `full_name/role/email/active/
  notify_opt_in/password`, không đưa `sensitive_perms`, `owner_id` hay `created_by` vào browser.
- Desktop dùng form page MDS có footer sticky; Native có mini-app form/top bar/safe-area/footer và
  discard confirmation. Người dùng sửa không phải nhập lại mật khẩu; để trống nghĩa là không đổi.
- Action list chỉ hiện khi permission summary cho phép. Role picker của Admin thường chỉ có Viewer/
  Executor (hoặc đúng role hiện tại khi sửa chính mình); Super Admin mới nhìn thấy đủ bốn role.
  Delete không hiện cho chính mình và luôn qua `MDialog` danger trước khi gọi API.
- `UI-ADMIN-003` kiểm chứng payload, POST/PUT/DELETE protected, confirmation, hai composition MDS
  và server-authority copy.

Kiểm chứng: `node --test server/test/unit-interactions-ui.test.js` **26/26 pass**; `npm run
build:ui` pass (Admin lazy chunk 24.99 kB, entry 438.96 kB); `git diff --check` sạch. Field
visibility và reassign owner còn là mutation slice riêng; Native AMIS runtime/device test vẫn
**UNVERIFIED** tới O3/W4.

## W3.ADMIN.FIELD-VISIBILITY — Field visibility MDS (Desktop + Native)

Mở cấu hình hiển thị field cho module `partners` trên hai composition MDS riêng. Desktop dùng card/
table; Native dùng mini-app, `MMobileTopBar` và safe-area — không dùng desktop shell trên mobile.

- Browser chỉ gọi `GET /api/admin/field-visibility?module=partners` để đọc projection và `PUT
  /api/admin/field-visibility` khi đã xác nhận. Payload write được khóa ở client thành
  `{ module, field, is_public: false }`.
- Không có action “công khai” hay khôi phục visibility trong UI. Đây là lựa chọn an toàn: client chỉ
  có thể siết exposure; PolicyEngine/server vẫn quyết định role, classification tier và phản hồi
  403/400 nếu principal hoặc hợp đồng thay đổi.
- `UI-ADMIN-004` khóa endpoint/payload một chiều, MDialog confirmation, view model không lẫn dữ liệu
  nhạy cảm và MDS Desktop/Native split.

Reassign owner chưa được gộp vào đây: nó cần UI đặt trong context của từng record để Admin nhìn thấy
entity/current owner/new owner trước khi xác nhận. Native AMIS runtime/device evidence vẫn
**UNVERIFIED** tới O3/W4.

## W3.ADMIN.REASSIGN-OWNER — Award Detail pilot (Desktop + Native)

Mở pilot gán lại người phụ trách cho **Award** — một entity Direct — ngay tại Award Detail, không
tạo form generic mù cho 14 loại record.

- Chỉ role có `admin.edit` mới thấy affordance. Khi mở, browser lấy roster qua
  `GET /api/admin/users`, project xuống `id/label/active` và chỉ cho chọn tài khoản active;
  metadata quyền ngoài scope không đi vào form.
- Gán lại gọi duy nhất `PUT /api/admin/records/award/:id/owner` với allowlist `{ owner_id }`.
  UI hiển thị owner hiện tại, chặn no-op và yêu cầu MDialog danger trước request. Server vẫn là
  authority cho principal, target active, record tồn tại và `PolicyEngine.prepareUpdate()`.
- `UI-AWARD-006` kiểm chứng payload, endpoint, roster projection, affordance `admin.edit`,
  confirmation và hai MDS composition. Award lazy chunk sau build: **73.29 kB** (gzip 14.37 kB);
  entry bundle giữ 438.96 kB.

Các entity Direct khác chưa được nhân rộng tự động: mỗi entity cần đưa action vào đúng detail context
và re-check projection/owner column (đặc biệt `gift.responsible_user_id`). Native AMIS runtime/device
evidence vẫn **UNVERIFIED** tới O3/W4.

## W2.2 + W3.ADMIN.REASSIGN-OWNER — Shared ownership flow và Event Detail

Sau khi Award pilot hoạt động, luồng gán owner được tách thành `features/ownership/` để tái sử dụng
đúng ranh giới: domain chỉ project owner hiện tại + roster active; Desktop/Native có composition MDS
riêng; từng feature giữ permission gate, context bản ghi và route mutation riêng.

- Event Detail mở action khi `/api/me` có `admin.edit`, nạp roster protected và gọi đúng
  `PUT /api/admin/records/event/:id/owner`. Payload chỉ `{ owner_id }`; UI chặn chọn chính owner
  hiện tại và buộc MDialog danger trước write.
- Award được chuyển sang shared flow không đổi contract; Event/Award đều reload record sau khi máy
  chủ chấp nhận. Không có quyền hay policy nào được quyết ở client.
- `UI-EVENT-010` kiểm chứng endpoint/payload, guard `admin.edit`, confirmation và Native MDS;
  cùng `UI-AWARD-006` bảo vệ shared flow. UI characterization: **29/29 pass**. Production build
  pass; entry `vue-app.js` 448.93 kB (gzip 107.45 kB), còn dưới ngưỡng 500 kB.

Nhân rộng sang entity Direct khác vẫn cần audit context của từng feature, nhất là `gift` dùng
`responsible_user_id` thay vì `owner_id`. Native AMIS runtime/device evidence vẫn **UNVERIFIED** tới
O3/W4.

## W3.ADMIN.REASSIGN-OWNER — Partner Detail (Agreement + Work log)

Mở gán lại người phụ trách trong đúng ngữ cảnh Partner Detail cho hai record Direct đã có
projection `ownerId`: Thỏa thuận/MOU (`agreement`) và Lịch sử làm việc (`work_log`). Không có màn
hình gán lại chung thiếu bối cảnh.

- `partner-api.mjs` chỉ lấy roster protected từ `GET /api/admin/users`, và chỉ chấp nhận hai entity
  allowlist rồi gọi `PUT /api/admin/records/:entity/:id/owner` với duy nhất `{ owner_id }`.
- Desktop và Native thêm action `Gán` tại từng dòng khi principal có `admin.edit`; flow dùng shared
  `features/ownership/`, hiển thị record/current owner/target active, chặn no-op và buộc MDialog
  danger trước request. Sau success feature reload Partner Detail; 403/error từ server được hiển thị
  thay vì suy diễn quyền tại browser.
- `UI-PAR-013` kiểm chứng hai endpoint, payload, entity allowlist, permission gate, MDS confirmation
  và hai composition riêng. `node --test server/test/unit-partner-detail-ui.test.js
  server/test/unit-interactions-ui.test.js` **42/42 pass**; `npm run build:ui` pass (entry
  `vue-app.js` 454,39 kB, gzip 109,33 kB); `git diff --check` sạch.

Rollout reassign owner chưa coi là phủ hết 14 entity Direct: Booking, Interaction, Award
participation, Sponsorship, Gift, Association fee, Supplier quote/transaction/contact và Benefit
usage tiếp tục cần được mở theo detail/projection riêng. Runtime Native AMIS trên thiết bị thật vẫn
**UNVERIFIED** tới O3/W4.

## W3.ADMIN.REASSIGN-OWNER — People Detail Booking

Mở gán lại người phụ trách từ từng dòng Booking bài viết trong People Detail. Luồng không dựa vào
form generic: feature giữ `booking.id`/title cục bộ, còn shared ownership flow chỉ nhận projection
owner và roster active.

- `people-api.mjs` thêm roster protected `GET /api/admin/users` và mutation allowlist duy nhất
  `PUT /api/admin/records/booking/:id/owner` với `{ owner_id }`.
- People Detail Desktop/Native truyền action vào Booking panel khi principal có `admin.edit`; chọn
  chính owner bị chặn, MDialog danger là bước bắt buộc và màn hình reload dữ liệu sau success.
  Amount/tổng booking vẫn giữ nguyên projection server, không tính lại hoặc mở rộng dữ liệu ở
  browser.
- `UI-PPL-017` kiểm chứng endpoint, payload, record context, permission gate, confirmation và hai
  composition MDS. `node --test server/test/unit-people-detail-ui.test.js
  server/test/unit-partner-detail-ui.test.js server/test/unit-interactions-ui.test.js` **61/61
  pass**; `npm run build:ui` pass (entry `vue-app.js` 458,76 kB, gzip 110,08 kB); `git diff --check`
  sạch.

Các entity Direct chưa có rollout UI vẫn là Interaction, Award participation, Sponsorship, Gift,
Association fee, Supplier quote/transaction/contact và Benefit usage; mỗi entity cần projection và
detail context riêng trước khi mở transfer. Runtime Native AMIS vẫn **UNVERIFIED** tới O3/W4.

## W3.SUPPLIER.READ + ADMIN.REASSIGN-OWNER — Supplier Detail sub-resources

Mở tiếp Supplier Detail theo context thật thay vì tạo màn hình mutation chung: Báo giá, Giao dịch
và Đầu mối có tab read-only Desktop MDS/Native riêng, rồi mới có affordance `Gán` tại chính dòng
record cho người có `admin.edit`.

- View model chỉ dùng `GET /suppliers/:id` projection. `unit_price` và `value` được hiển thị khi,
  và chỉ khi, response đã có property đó; không có fallback hay tính toán client để suy ra số tiền.
- `supplier-api.mjs` chỉ allowlist `supplier_quote`, `supplier_transaction` và
  `supplier_contact`, tải roster protected và gửi duy nhất `{ owner_id }` tới
  `PUT /admin/records/:entity/:id/owner`. Shared Desktop/Native owner flow chặn chọn lại chính
  owner, buộc MDialog và reload dữ liệu khi server chấp nhận.
- `UI-SUP-008` khóa projection, endpoint/payload allowlist, `admin.edit`, confirmation và Native
  composition. UI characterization liên quan **69/69 pass**; build/host device evidence chưa thể
  kết luận trước O3/W4.

Rollout owner Direct còn lại là Interaction, Award participation, Sponsorship, Gift, Association
fee và Benefit usage; từng slice phải có projection owner và context chi tiết đủ rõ trước khi mở
mutation.

## W3.INTERACTION.READ + ADMIN.REASSIGN-OWNER — Interaction list

Hoàn thành Interaction như một slice an toàn trước khi thêm mutation: R044 không còn trả raw
database row mà chạy mọi record qua `PolicyEngine.projectRecord()` với entity/module Interaction.

- View model giữ `ownerId` chỉ làm context cho Admin transfer; UI không render định danh owner mặc
  định. Desktop row và Native card đều có đủ đối tác, ngày và nội dung để tránh thao tác gán lại
  không có ngữ cảnh.
- Chỉ principal có `admin.edit` mới thấy `Gán`. Flow tái dùng hai composition owner Desktop/Native,
  tải roster từ endpoint protected, chặn no-op, yêu cầu MDialog rồi gọi duy nhất
  `PUT /api/admin/records/interaction/:id/owner` bằng payload allowlist `{ owner_id }`.
- `D13-081` xác nhận R044 projection vẫn giữ owner server-derived cho context Direct: SQLite
  **13/13 pass**, MySQL **13/13 pass**. `UI-INT-004` khóa affordance, confirmation và contract API.

Direct UI chưa rollout: Award participation, Sponsorship, Gift, Association fee và Benefit usage.
Native AMIS runtime/device evidence vẫn **UNVERIFIED** tới O3/W4.

## W3.ADMIN.REASSIGN-OWNER — Award Participation

Hoàn thiện reassignment cho `award_participation`, entity Direct còn thiếu trong Award Detail, bằng
context của chính kỳ tham gia thay vì một màn hình mutation chung.

- `awards-api.mjs` chỉ nhận award/participation/owner id hợp lệ và gọi `PUT
  /api/admin/records/award_participation/:id/owner` với payload allowlist `{ owner_id }`.
- Desktop và Native gắn `Gán` tại card Kỳ tham gia khi principal có `admin.edit`; shared flow hiển
  thị năm/trạng thái, owner hiện tại và roster active, chặn no-op rồi yêu cầu MDialog danger. Native
  là composition riêng, toàn bộ thao tác card dùng touch target MDS 48px.
- `D13-082` kiểm chứng executor bị 403, Admin chuyển được owner và response Award sau đó chỉ lấy
  owner từ projection server; `UI-AWARD-007` kiểm chứng API, gate, confirmation và hai composition.
  `integration-awards` đạt **45/45** trên SQLite và MySQL; runtime AMIS/device vẫn **UNVERIFIED** tới
  O3/W4.

## W3.ADMIN.REASSIGN-OWNER — Partner Direct records (14/14 hoàn tất)

Hoàn thiện bốn entity Direct cuối cùng trong tab Hợp tác của Partner Detail: `sponsorship`, `gift`,
`association_fee`, và `benefit_usage`.

- Thêm panel Desktop và Native riêng. Chúng chỉ render title/ngày/trạng thái đã được server
  projection; `amount`/`value` Confidential không đi qua view model hoặc UI.
- Action `Gán` chỉ dành cho `admin.edit`, giữ context cụ thể của bản ghi, tải roster active, chặn
  no-op và dùng shared MDS confirmation trước R148. `gift` chuyển đúng `responsible_user_id`, không
  nhầm với `owner_id` là chủ thể nhận quà.
- `D13-092` xác nhận executor bị 403, Admin chuyển được đủ bốn entity và response Partner phản ánh
  owner từ server; Partner integration đạt **103/103** trên SQLite và MySQL. `UI-PAR-014` khóa API
  allowlist, projection, permission và hai composition. Tổng reassignment UI: **14/14 Direct entity**;
  Native AMIS runtime/device vẫn **UNVERIFIED** tới O3/W4.

## 2026-09-02 — W3.VOICE UI review: selection không mơ hồ + Native MDS baseline

- Sửa luồng review Voice để chỉ auto-chọn candidate khi có đúng **một candidate tổng cộng**. Khi AI
  trả nhiều candidate, hai picker person/organization loại trừ nhau và UI yêu cầu người dùng chọn đúng
  một trước khi xác nhận. R150 xác nhận lại cùng invariant, trả `400 VALIDATION_FAILED` trước write
  nếu thiếu selection hoặc gửi cả hai id.
- Khôi phục token/guard `.mds-mobile-app` theo MDS: touch target 48px, top bar 56px, safe-area,
  input 16px, gutter và chống overflow. Runtime fake-native: Back/Hủy đạt 48px ở 390×844;
  320×700 không overflow ngang.
- Verify: `UI-VOICE-003`, `integration-voice-secure-command` SQLite 16/16, security 6/6,
  mapping 150/150, G0 verifier và Vite production build PASS. Đây không phải evidence AMIS host
  thật; O3/W4 về bridge, thiết bị và OS accessibility vẫn `UNVERIFIED`.

## 2026-09-02 — W3.VOICE.2: global entry contract-ready

- Native slice có entry Voice toàn cục khi và chỉ khi `/api/me` cho phép `interactions:create`.
  Entry dùng safe-area từ host adapter và deep-link có kiểm soát `#interactions?voice=1`; direct
  link không quyền fail-closed `VOICE_FORBIDDEN`.
- Không tích hợp mic/browser API, không đoán token hay AMIS bridge schema. Runtime fake-native từ
  Events sang Voice đạt nút 48px và không overflow. `unit-host-adapter`, UI characterization và
  UI interactions đạt 41/41; Vite build PASS. O3/W4 device evidence vẫn còn mở.

## 2026-09-02 — F31: reset native strangler route trước hash resolver

- Sửa lỗi UI browser/fake-native: chuỗi resolver short-circuit có thể bỏ sót route ref của màn hình
  cũ, khiến nhiều `.mds-mobile-app` đồng thời nằm trên DOM sau khi chuyển hash. `App.vue` reset toàn
  bộ ref trước khi resolve route mới; không thay API, auth hoặc PolicyEngine.
- `UI-CHAR-005` khóa contract; runtime 390×844 chuyển 10 route native liên tiếp xác nhận mỗi bước
  chỉ có một root visible và không overflow ngang. AMIS WebView/device lifecycle vẫn chờ O3/W4.

## 2026-09-02 — W3.REMINDERS: Desktop MDS + Native composition

- Thay legacy `#reminders` bằng strangler slice feature-flagged `remindersList` (`uiRemindersPilot=1`
  ở harness). Dùng R038-R042 cho list/upcoming/create/edit/delete; notification inbox, ICS và AI
  thiệp giữ ngoài scope vì chưa có contract UI tương ứng.
- Generic payload chỉ có field ngày nhắc công khai, không nhận `subject_id` từ client; action hiển thị
  theo permission `/api/me`, còn API/PolicyEngine là authority cuối. `UI-REM-001` và fake-native
  390×844 xác nhận list/form có Native MDS riêng, root duy nhất, touch action 48px, không overflow.

## 2026-09-02 — W3.REMINDERS.NOTIFICATIONS: inbox MDS

- Bổ sung inbox Desktop/Native cho R057-R059, load projection theo principal và chỉ ack từng/tất cả
  khi server cấp `reminders:ack`. Mở inbox không tự đánh dấu đã đọc như legacy bell.
- Runtime fake-native 390×844: inbox có một native root, topbar/touch 48px, không overflow hay lỗi
  console. Scheduler run, ICS và AI card được giữ ở slice riêng thay vì gộp vào UI CRUD/inbox.
