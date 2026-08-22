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

### F2 — Session store = MemoryStore trên Cloud Run · **High / B / browser-production**
- `server/index.js:19-24` không khai báo `store` → MemoryStore; cookie thiếu `secure`; không regenerate session sau login (session fixation) — `server/auth.js`.
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
`server/rbac.js:12-15` chỉ có `super_admin`+`pr_staff`; seed 2 user (`server/db.js:665-666`); nhưng banner login (`server/index.js:50-55`) quảng cáo 5 tài khoản không tồn tại. Dọn banner + README + đồng bộ 1:1 sau khi owner chốt role model.

## E. Điểm mạnh nên bảo toàn
- Mô hình nghiệp vụ PR phong phú, liên hệ nhiều thực thể.
- RBAC server-side + audit + per-user `sensitive_perms` (biểu cảm hơn role cứng).
- AI human-in-the-loop (đưa vào form để duyệt trước khi lưu).
- Excel AI pipeline có worker isolation, magic-byte check, redaction email/phone, giới hạn tài nguyên.
- Report tính số **deterministic** ở server rồi mới cho Gemini viết narrative (`monitor.js:281-306`) — mẫu chống AI bịa số, nên nhân rộng.
