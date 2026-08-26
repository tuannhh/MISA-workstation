# 01 — Phát hiện audit đã hội tụ

> Kết quả 5 vòng debate Claude ↔ Codex @ commit `088fbb2`. Mọi finding kèm `file:line` đã kiểm chứng. Nhãn: **Severity / Retrofit-tier / Target-gate**.

## A. Nhóm P0 / High — phải xử lý trước khi mở rộng

### F1 — Money policy bypass (read + write + file) · **High / A / browser-production**
Root cause: **3 cơ chế che tiền song song, không có nguồn sự thật chung** + write-guard gắn thiếu.
- Registry nhóm-mật chỉ đăng ký 3 trường tiền: `organization.membership_fee`, `sponsorship.amount`, `gift.value` — `server/rbac.js:66-73`.
- Tiền supplier/booking/event **không** trong registry, che ad-hoc bằng `maskMoney()` — `server/routes.js:52-56`, dùng ở `:982-992` (supplier quote/transaction).
- File đính kèm `/files/:id` **không** map nhóm tiền — `server/routes.js:466-478` (chỉ gác `kind==='id_doc'`).
- **Read bypass:** user thiếu `org_fee` tải PDF hợp đồng/báo giá qua `/files/:id` → đọc được số tiền đã bị che ở JSON. (Xác nhận bằng thí nghiệm HTTP cô lập của Codex.)
- **Write bypass:** user thiếu `org_fee` vẫn ghi/sửa trường tiền qua API — `POST /api/suppliers/:id/quotes`, `POST/PUT /sponsorships` (`:180-192`), fee/booking/event cost.
- **Guard đã có nhưng gắn thiếu:** `stripDisallowed()` (`:58-64`) chỉ được gọi ở `PUT /partners/:id` (`:168`) và `PUT /people/:id` (`:394`) = **2/42 create-update call site**. Bỏ sót CREATE (`POST /partners` `:156-163`, `POST /people` `:383-389`) và toàn bộ sponsorship. Static: `buildInsert` 20 call site, `buildUpdate` 22, `stripDisallowed` 2.
- Ngoài helper còn đường ghi raw: `budgets.amount` upsert (`:635-641`), attachment insert (`:243-249, 429-438, 938-944, 1049-1053, 1129-1133`).
- Read leak còn ở **projection/tổng hợp** (không phải cột vật lý): `bookings.total_amount` (`:606-609`), `events.total_cost` (`:1073-1080`), report aggregates (`:647-724`), award `partBudget/mediaCost/totalCost` (`:759-775`).
- `stripDisallowed` **xóa âm thầm** → client nhận 200 mà dữ liệu không lưu (bug integrity/UX, che tấn công).
- **Fix hội tụ:** 1 `DATA_POLICY_REGISTRY` + 1 `PolicyEngine` ở tầng service, **fail-closed 403** (không silent-strip); SQL helper chỉ nhận dữ liệu đã authorize. Xem 03-data-classification.md.
- **CẬP NHẬT sau inventory G0.3 (`07-route-catalog.md`):** blast radius rộng hơn 2 ví dụ ban đầu. Write-bypass xác nhận ở **10 nhóm route**: `POST/PUT /partners` (membership_fee), sponsorships, fees, gifts, `POST /budgets` (raw SQL, ngoài helper `buildInsert/buildUpdate`), `POST/PUT /awards` (cost), award_participations (budget), supplier_transactions (value), supplier_quotes (unit_price), event_costs (amount). Củng cố quyết định D1 — vá per-route chắc chắn sót, cần PolicyEngine 1 choke-point.
- Read-bypass xác nhận nguồn gốc **duy nhất**: `GET /files/:id` (`routes.js:467-478`) — phục vụ nội dung mọi loại attachment, chỉ gate `kind==='id_doc'`.

### F2 — Session store = MemoryStore trên Cloud Run · **High / B / browser-production**
- `server/app.js:17-22` (sửa lại 2026-08-25, trước ở `index.js:19-24` khi chưa tách `createApp()`) không khai báo `store` → MemoryStore; cookie thiếu `secure`; không regenerate session sau login (session fixation) — `server/auth.js`.
- Cloud Run tái chế container / cold-start / scale >1 → **user bị đăng xuất ngẫu nhiên mỗi lần redeploy**. Bug đang xảy ra.
- Fix: durable store (khuyến nghị bảng Cloud SQL sẵn có), `secure:true`, session regenerate, fail-fast nếu production thiếu `SESSION_SECRET` (`:20` đang có default `'misa-pr-dev-secret-change-me'`).

### F3 — SSRF trong monitoring (metadata/internal) · **High / B / browser-production**
- `server/monitor.js:36` `fetchText(url)` và `:167` `resolveLink(uri)` fetch URL tùy ý: từ bảng `sources` (user cấu hình) **và** từ URL Gemini grounding trả về (đường tự động, `:197`). `:170` `redirect:'follow'` không kiểm lại per-hop.
- Rủi ro Cloud Run: fetch `http://169.254.169.254/...` → lấy token service account (leo thang credential).
- Fix 80/20: 1 hàm `safeFetch` dùng chung — protocol allowlist http/https; resolve DNS + chặn dải private/loopback/link-local/metadata; kiểm lại mỗi hop redirect; cap body. (Không cần full DNS-rebinding matrix cho v1.)

### F4 — AI data governance · **High / A / browser-production — OWNER-BLOCKED**
- Audio tương tác (giọng nói nội bộ) + dữ liệu Excel/partner có thể ra Gemini; monitoring chỉ gửi tiêu đề/link công khai (rủi ro thấp).
- Không phải bug code tự vá được — cần chính sách data-tier + consent voice do **Security/Legal MISA** duyệt. Dựng cơ chế enforce + kill-switch `AI_DISABLED`. Xem 03 §C.

### F5 — Mobile native chưa tồn tại · **P0 structural / — / AMIS-native-host (đã cam kết)**
- Hiện chỉ responsive web (media query ẩn sidebar ở 320px). Không có `.mds-mobile-app`, bottom nav, safe-area, native composition.
- Vì owner đã cam kết AMIS-native-host, đây là structural gate thật (không phải responsive-CSS). Kéo theo F6.

### F6 — `public/app.js` monolith cản shared contract · **High / B / native**
- Vue chỉ là shell nạp `/app.js` — `frontend/src/App.vue:47-54`. Logic nghiệp vụ dính vào HTML-string (37 `innerHTML`, 105 call `api()`, 12 views, ~2.889 dòng).
- Native cần dùng chung **domain + API contract**, không phải DOM. Phải trích logic ra khỏi app.js theo slice (không big-bang).

## B. Nhóm P1 / Medium

### F7 — `Atomics.wait` khóa event loop (chỉ đường MySQL) · **P1 → P0 nếu tải cao / B / browser+native**
- `server/mysql-sync.js:63` `Atomics.wait` chạy **main thread**; mọi `all/get/run` (`:81-90`) đi qua `_call` → mỗi query MySQL block cả event loop (tối đa 30s timeout `:7`).
- Cloud Run concurrency mặc định 80 → 1 query chậm đứng hình cả instance. Microbenchmark Codex (latency 25ms giả lập): p95 518ms @20 req, 1.291ms @50.
- **Bẫy:** đường SQLite (`node:sqlite`) **không** qua Atomics → dev thấy nhanh, prod MySQL serialize. Benchmark BẮT BUỘC pin `DB_CLIENT=mysql`.
- Fix: async repository seam cho code mới; migrate theo slice; hạ Cloud Run `--concurrency` chỉ là mitigation tạm có số đo.

### F8 — Gemini reliability + sampling params deprecated · **Medium / B**
- `server/gemini.js:8-21` `call()` dùng fetch trần: không timeout/AbortController, không retry, không circuit breaker (trớ trêu: `monitor.js` có AbortController, `gemini.js` không).
- `:29,38,49` gửi `temperature`; config pin `gemini-3.5-flash` (`server/config.js:19`). Gemini release note 2026-07-21 (Codex xác minh URL changelog): `temperature/top_p/top_k` **deprecated** — nhưng **chưa có live proof 3.6 luôn trả HTTP 400** (có thể bị bỏ qua âm thầm).
- Fix: aiGateway mỏng (timeout/retry/kill-switch/usage) + capability-map `supportsSamplingParams` để strip params theo model; giữ pin 3.5 tới khi golden eval thắng.

### F9 — Attachment thiếu cột phân loại · **Medium / A / browser-production**
- `server/db.js:85-96` schema attachment chỉ có `owner_type/owner_id/kind/filename/mime`, không có `sensitive_group`. Event lấy `kind` từ query string (`:1129-1133`) — không được dùng làm quyết định security.
- Fix: thêm cột classification server-derived + migration backfill (xem roadmap F1/Wave 1 và cảnh báo thứ-tự §C dưới).

## C. Rủi ro thứ-tự-thực-thi (Tier A — vì dữ liệu prod đã sống)

### R1 — Backfill TRƯỚC khi flip fail-closed
Wave 1 thêm classification attachment + bật download/write gate fail-closed. File/tiền cũ trên prod chưa có nhãn. **Bắt buộc:** (1) migration backfill classification cho mọi attachment cũ theo kind/owner/route allowlist → (2) verify 0 hàng NULL → (3) mới flip gate. Nếu flip trước: hoặc khóa nhầm user, hoặc để hở đúng lỗ đang vá. Backfill idempotent + báo cáo số hàng.

## D. Việc lẻ dễ rơi

### F10 — Chuỗi giống credential trong `DEPLOY.md` · **P1 / — / all**
Brief Codex §4.4-P1: kiểm tra lịch sử Git; nếu là key thật → **rotate** (không chỉ xóa HEAD). Đưa vào Gate 0.

### F11 — RBAC drift 2-role vs banner 5-tài-khoản · **Low / — / browser-production**
`server/rbac.js:12-15` chỉ có `super_admin`+`pr_staff`; seed 2 user (`server/db.js:665-666`); nhưng banner login (`server/index.js:13-18` — sửa lại 2026-08-25, trước ở `:50-55` khi chưa tách `server/app.js`) quảng cáo 5 tài khoản không tồn tại. Dọn banner + README + đồng bộ 1:1 sau khi owner chốt role model.

### F12 — Schema/API mismatch: `event_id` không tồn tại trong allowlist ghi của booking · **Medium / B / browser-production** (Codex round-3 re-audit, R3-02D)
`server/routes.js:584-585` khai `B_COLS` cho phép ghi `award_id` nhưng **không có `event_id`** — trong khi `10-api-contract.md` (bản trước) và ý định nghiệp vụ (booking liên kết được với 1 sự kiện, dùng tính `mediaCost` theo sự kiện tương tự `award_id`) ngụ ý cả 2 field cùng được hỗ trợ. `pick(req.body, B_COLS)` (`routes.js:22-26`) âm thầm loại `event_id` client gửi lên — không lỗi, không log (cùng cơ chế silent-drop ở `16-coding-rules.md` §13). Client tưởng đã liên kết booking với sự kiện nhưng dữ liệu không được lưu.
- **Không tự sửa code ở Gate 0** (đúng nguyên tắc "không đổi nghiệp vụ khi đang audit tài liệu") — chỉ đăng ký finding, chờ owner xác nhận ý định: (a) thêm `event_id` vào `B_COLS` + migration liên kết nếu đây là tính năng còn thiếu, hay (b) bỏ hẳn ý tưởng liên kết booking↔event nếu chưa từng dùng thật.
- Đưa vào Wave 1 (cùng nhóm sửa contract chính xác, không phải P0 bảo mật).

### F13 — Bộ nhắc việc/thông báo KHÔNG chạy được trên MySQL · **High / B / browser-production (sẽ chặn production tương lai) — ĐÃ FIX** (G1A.3 commit 4, phát hiện qua characterization; sửa ngay trong G1A.3 commit 5 theo yêu cầu owner; câu chữ "production" sửa lại theo Codex audit A4)
`server/scheduler.js:28` (cũ) dùng `WHERE ... AND (recipient_user_id IS ? OR recipient_user_id=?)` — cú pháp `IS ?` chỉ hợp lệ với driver SQLite (`node:sqlite` chấp nhận `IS` như so sánh tổng quát có xử lý NULL); MySQL chỉ cho `IS` đi với từ khoá `NULL/TRUE/FALSE/UNKNOWN`, không cho placeholder tham số → mọi lần gọi thực sự chạm nhánh này ném `ER_PARSE_ERROR` ("You have an error in your SQL syntax ... near '1 OR recipient_user_id=1)'").
- `scheduler.runOnce()` ném lỗi ngay tại vòng lặp đầu tiên có user opt-in + mốc nhắc đến hạn — nghĩa là **toàn bộ pipeline in-app notification + email nhắc việc không tạo được bản ghi nào** khi `DB_CLIENT=mysql`.
- `scheduler.start()` (`:73-74`) bọc `try/catch` chỉ `console.error` rồi tiếp tục lịch 6h/lần — lỗi bị nuốt hoàn toàn, không có alert/log tồn trữ nào cho vận hành thấy. Route thủ công `POST /api/reminders/run` (`routes.js:859-862`) không có `try/catch` riêng nên rơi vào error handler chung của `app.js:35-39` → trả `400 {error: "<SQL syntax error>"}`, lộ luôn thông báo lỗi SQL thô ra client.
- **Cloud Run hiện tại chạy `DB_CLIENT=mysql`, nhưng đây CHỈ LÀ MÔI TRƯỜNG TEST, chưa phải production thật** (owner xác nhận `13-deployment-runbook.md` §B — hạ tầng production MISA chính thức chưa tồn tại) — bug này đã ảnh hưởng môi trường test MySQL hiện tại (nếu đã từng có mốc nhắc + user `notify_opt_in=1` đến hạn từ khi deploy test, tính năng này chưa từng tạo ra thông báo nào ở đó trước khi có bản fix này) và **sẽ chặn production MySQL thật khi hạ tầng đó lên**, nếu không sửa trước.
- Phát hiện qua characterization G1A.3 commit 4 (`server/test/integration-reminders.test.js`, test `R060`). **Đã sửa trong G1A.3 commit 5** (owner yêu cầu fix ngay để Codex audit luôn, không đợi Wave riêng): xoá hẳn nhánh `IS ?` — cả 2 call site (`:46`,`:54`) luôn truyền `u.id` là số thật (không bao giờ NULL), nên vế `IS ?` là nhánh chết chưa từng cần tới; đơn giản còn lại `recipient_user_id=?` với 1 tham số (bỏ tham số trùng thứ 2). Test `R060`/`R057-059` không cần driver-aware nữa — pass 200 nguyên bản ở cả SQLite/MySQL. Verify: `test:security` 6/6, `test:integration:sqlite` 261 pass+6 skip, `test:integration:mysql` 266 pass+1 skip.

### F14 — `grandTotal` báo cáo tổng hợp tính SAI trên MySQL (nối chuỗi thay vì cộng số) · **High / B / browser-production (sẽ chặn production tương lai) — ĐÃ FIX** (G1A.3 batch reports-awards, phát hiện qua characterization R052; sửa ngay theo yêu cầu owner cùng cơ chế F13)
`server/routes.js:752` (cũ) `grandTotal: totalSpend.s + evTotal + feeTotal` — cả 3 giá trị đều lấy trực tiếp từ `SELECT COALESCE(SUM(...),0) s` (aggregate SQL). Driver `mysql2` trả kết quả `SUM()` (kiểu `DECIMAL` do MySQL suy ra, dù cột gốc là `BIGINT`) dưới dạng **string** theo mặc định (để không mất độ chính xác số lớn), trong khi `better-sqlite3` trả `number`. Toán tử `+` trên 3 string do đó thực hiện **nối chuỗi**, không cộng số — ví dụ 2 booking `300000`+`700000` cho ra `grandTotal = "300000700000"` thay vì `1000000`.
- Đây là tổng tiền hiển thị ở màn báo cáo tổng hợp cho lãnh đạo (`GET /api/reports`, dashboard chính) — sai lệch **âm thầm, không ném lỗi**, khác F13 (F13 ném lỗi rõ ràng, F14 trả dữ liệu sai mà trông như hợp lệ).
- Không chỉ `grandTotal` — `spend.total` (`totalSpend.s`), `events.total` (`evTotal`), `fees.total` (`feeTotal`), `spend.budget` (`budget.s`) đều cùng nguồn gốc (aggregate SUM), cùng bị sai type trên MySQL dù giá trị hiển thị riêng lẻ (không cộng) vẫn đúng chữ số.
- Cloud Run hiện tại chạy `DB_CLIENT=mysql` nhưng **chỉ là môi trường test** (như F13) — bug đã ảnh hưởng môi trường test này và sẽ chặn production MySQL thật khi hạ tầng đó lên, nếu không sửa trước.
- Phát hiện qua characterization batch "reports-awards" (`server/test/integration-reports.test.js`, test R052 chạy MySQL). **Đã sửa ngay** (owner yêu cầu, cùng cơ chế đã áp dụng cho F13): bọc `Number(...)` quanh 4 giá trị SUM (`totalSpend.s`, `budget.s`, `evTotal`, `feeTotal`) ngay tại điểm đọc kết quả query — sửa tận gốc kiểu dữ liệu thay vì chỉ sửa phép cộng, để mọi chỗ dùng lại các giá trị này (hiện tại và tương lai) đều nhận `number` đúng trên cả 2 driver. Test mới xác nhận `typeof === 'number'` cho cả 3 field + `grandTotal === spend.total + events.total + fees.total` đúng bằng số trên cả SQLite và MySQL.

### F15 — FK không được MySQL thực thi cho `award_participations.award_id` (nghi ngờ lan rộng toàn schema) · **P2 Medium / — / backlog, Wave 1** (G1A.3 batch reports-awards, phát hiện qua characterization R067; PHẠM VI MỞ RỘNG theo Codex ONE-SHOT AUDIT `f40be9c^..c0270a1`)
`server/db.js` khai `award_id INTEGER REFERENCES awards(id) ON DELETE CASCADE` cho bảng `award_participations`. `POST /api/awards/9999999/participations` (award_id không tồn tại) trả **400** trên SQLite (FK constraint chặn insert) nhưng trả **200** trên MySQL (insert thành công, tạo participation "mồ côi") — route không tự kiểm tra award tồn tại trước khi insert, hành vi phụ thuộc hoàn toàn vào driver có/không thực thi FK.
- **Codex xác nhận độc lập và mở rộng phạm vi:** MySQL không chỉ bỏ qua FK lúc INSERT — **DELETE `awards` cũng KHÔNG cascade xoá `award_participations` liên quan** (dù schema khai `ON DELETE CASCADE`), để lại participation mồ côi **vĩnh viễn** (không chỉ tạm thời lúc insert sai award_id). Đây là dấu hiệu FK constraint có thể **không thực sự được tạo** trên MySQL cho quan hệ này (không phải chỉ `FOREIGN_KEY_CHECKS` tắt tạm thời lúc 1 câu lệnh), và khả năng ảnh hưởng **các FK khác trong schema**, chưa kiểm hết.
- Chưa root-cause (constraint không được tạo lúc migrate, charset/collation lệch, hay nguyên nhân khác) — đúng scope-freeze của batch "reports-awards" đã đóng, không điều tra thêm ngoài route đang test trong batch đó.
- Rủi ro: dữ liệu mồ côi tích luỹ trên MySQL (môi trường test/production tương lai); không mất dữ liệu thật, không phải P0/P1 vì participation mồ côi không tự hiển thị gây sai lệch nghiệp vụ trực tiếp (khác F14) — nhưng phạm vi rộng hơn ban đầu tưởng.
- Test hiện tại (`server/test/integration-awards.test.js`, R067) đã characterize đúng cả 2 driver bằng nhánh `isMysql ? 200 : 400`, không che giấu khác biệt.
- **Backlog Wave 1 (theo đúng hướng dẫn Codex, KHÔNG chỉ vá triệu chứng):** inventory FK toàn schema (không chỉ `award_participations`) để xác định constraint nào thực sự tồn tại trên MySQL vs SQLite, root-cause vì sao `ON DELETE CASCADE` không hoạt động, rồi sửa tận gốc ở tầng DB/migration — **không phải thêm `if` kiểm tồn tại thủ công ở từng route** (route-level check chỉ che 1 route, không đồng bộ hành vi cho các quan hệ FK khác).

## E. Điểm mạnh nên bảo toàn
- Mô hình nghiệp vụ PR phong phú, liên hệ nhiều thực thể.
- RBAC server-side + audit + per-user `sensitive_perms` (biểu cảm hơn role cứng).
- AI human-in-the-loop (đưa vào form để duyệt trước khi lưu).
- Excel AI pipeline có worker isolation, magic-byte check, redaction email/phone, giới hạn tài nguyên.
- Report tính số **deterministic** ở server rồi mới cho Gemini viết narrative (`monitor.js:281-306`) — mẫu chống AI bịa số, nên nhân rộng.
