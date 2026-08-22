# 06 — Threat Model, Data-flow, Gemini Egress Map (G0.8)

> Input cho O8 (chính sách data/voice ra Gemini) và cho W1.AI-POLICY/W1.8(SSRF)/R1(attachment). Dựa trên audit đã hội tụ (`01-audit-findings.md`) — không lặp lại evidence chi tiết, chỉ tổng hợp theo góc nhìn luồng dữ liệu.

## A. Data-flow tổng quan

```
Browser (session cookie, sameSite=lax)
   │
   ▼
Express (server/index.js) — requireAuth (auth.js) → requirePerm(module,action) (rbac.js)
   │
   ├─► MySQL/SQLite (server/db.js, mysql-sync.js) ── dữ liệu nghiệp vụ + tiền + PII
   ├─► Filesystem uploads (UPLOAD_DIR) ── ảnh/PDF/giấy tờ, phục vụ qua /files/:id
   ├─► Outbound network — Gemini (KHÔNG qua 1 cổng chung — 6 callsite rời rạc trong server/ai.js
   │     + 3 callsite trong server/monitor.js, xem §D đầy đủ)
   └─► Outbound network — SMTP (server/mailer.js, gọi từ server/scheduler.js:51-61)
         ── gửi tên sự kiện/subject_name/note (nội dung nghiệp vụ) + email người nhận (PII)
            tới SMTP provider ngoài (Brevo theo DEPLOY.md) — boundary egress riêng,
            KHÔNG phải Gemini nhưng cùng loại rủi ro "dữ liệu ra bên thứ 3"
```

## B. Actor & trust boundary

| Actor | Trust | Vào được gì |
|---|---|---|
| `super_admin` (đã đăng nhập) | Cao | Toàn bộ module + mọi sensitive_group (mặc định) |
| `pr_staff` (đã đăng nhập) | Trung bình | CRUD nghiệp vụ; sensitive_group theo `sensitive_perms` per-user |
| Chưa đăng nhập | Không | Chặn bởi `requireAuth` toàn `/api` (`routes.js:14`) — KHÔNG có route nghiệp vụ public |
| Nội dung web/RSS/Gemini-grounding trả về | **KHÔNG tin cậy** | Có thể là attacker-controlled (tin giả, URL độc, prompt injection trong tiêu đề bài báo) |
| Gemini (bên thứ 3) | Đối tác, không phải trust boundary nội bộ | Nhận dữ liệu ta gửi — xem §D |

## C. Rủi ro theo STRIDE (rút gọn, trỏ finding đã có)

| Loại | Rủi ro cụ thể | Finding |
|---|---|---|
| Spoofing | Session fixation (không regenerate sau login) | F2 |
| Tampering | Write bypass field tiền (thiếu `org_fee` vẫn ghi được) | F1 |
| Repudiation | Attachment không có classification → không audit được ai xem gì | F9 |
| Information disclosure | Money-doc read bypass qua `/files/:id`; SSRF đọc metadata Cloud Run | F1, F3 |
| Denial of service | `Atomics.wait` khóa event loop toàn instance dưới tải | F7 |
| Elevation of privilege | SSRF tới metadata server → lấy token service account → leo thang credential cloud | F3 |

## D. Gemini egress map — ĐẦY ĐỦ 9 callsite (6 trong `ai.js` + 3 trong `monitor.js`), sửa sau Codex G0-audit tìm ra 3 route thiếu + 1 mô tả sai

> Trước đây bảng này chỉ có 5 dòng (thiếu card-text/card-image/award-advice, và mô tả `evaluateCampaign` sai). Đã sửa đủ callsite theo evidence Codex: `rg -n 'gen(Text|JSON|Image)|groundedSearch' server/ai.js server/monitor.js`.

| # | Route/hàm | file:line | Dữ liệu gửi Gemini thực tế | Tier đề xuất |
|---|---|---|---|---|
| 1 | `POST /ai/interaction-voice` | `ai.js:48-82`, gọi Gemini `:63` | **voice/audio** — file ghi âm base64 gửi thẳng | **Confidential/Restricted** — cần consent, chặn bởi O8 |
| 2 | `POST /ai/card-text` | `ai.js:87-100`, gọi Gemini `:95` | text — `title`, `date_type`, `subject_name` (tên người/tổ chức đối tác), `idea` (user nhập) | Internal (tên đối tác không phải bí mật nhưng là dữ liệu quan hệ nội bộ) |
| 3 | `POST /ai/card-image` | `ai.js:110-129`, gọi Gemini `:124` | image — logo tĩnh + `text` (nội dung lời chúc, thường do card-text sinh ra) | Internal, không PII mới ngoài #2 |
| 4 | `POST /ai/award-extract` | `ai.js:160-187`, gọi Gemini `:180` | text/image/excel — file upload (**arbitrary MIME, xem cảnh báo uploader dưới**) hoặc text dán hoặc fetch URL rồi stripHtml | Internal/Confidential tùy nội dung file thật (chưa kiểm soát được vì fileFilter thiếu) |
| 5 | `POST /ai/award-advice` | `ai.js:200-211`, gọi Gemini `:207` | text — `a.name`,`a.organizer`,`a.criteria`,`a.prize_structure`,`a.products` (client tự nhập/form data); **KHÔNG gửi `a.cost`** | Internal |
| 6 | `POST /ai/event-extract` | `ai.js:244-273`, gọi Gemini `:265` | excel/text — có `redactTextForAi()` (điểm mạnh, giữ nguyên) + rate-limit 8/phút/user | Internal, đã redact |
| 7 | `monitor.js` sentiment/highlight | `monitor.js` `analyzeBatch`/`aiMisaHighlights` | Tiêu đề/link tin tức công khai | Public |
| 8 | `monitor.js` grounding | `monitor.js:186-232` | Nội dung web do `groundedSearch` trả về | Public, nhưng KHÔNG tin cậy nội dung — cần tách instruction/data trong prompt (prompt injection risk) |
| 9 | `monitor.js evaluateCampaign` | `monitor.js:280-305` | **SỬA LẠI (mô tả cũ SAI):** prompt gửi **`cp.name`, `cp.message`, `cp.content`, `cp.audience`, `keywords`** (field chiến dịch nội bộ, có thể chứa thông điệp truyền thông chưa công bố) **CỘNG** số liệu tổng hợp từ `mentions` (title/content/source/sentiment) đã lưu — KHÔNG chỉ dùng dữ liệu đã lưu như mô tả cũ | **Internal** (thông điệp chiến dịch chưa công bố — không phải Public như 3 dòng monitor khác) |

**Cảnh báo uploader (#4):** `uploadAudio` (dùng chung tên gây nhầm cho cả audio VÀ file award-extract) là `multer.memoryStorage()`, **KHÔNG có `fileFilter`**, giới hạn 25MB (`server/uploads.js:39-43`) — khác hẳn mô tả trước đây "ảnh/PDF". Route `/ai/award-extract` thực tế **chấp nhận MIME tùy ý tới 25MB, lưu RAM, gửi thẳng Gemini** nếu là file path. Đây là input cho Wave 1 upload-security, không chờ owner quyết.

**Nguyên tắc chưa được enforce (đưa vào W1.AI-POLICY):** hiện KHÔNG có chốt chặn kỹ thuật nào ngăn một route mới trong tương lai vô tình nhét field `Restricted` (CCCD, số tài khoản NH) vào prompt Gemini. Đây là lý do O8 + W1.AI-POLICY cần deny-by-default ở tầng gateway, không dựa vào "lập trình viên nhớ không gửi".

## D.1 SMTP egress (boundary riêng, không phải Gemini — trước đây bỏ sót hoàn toàn)

- `server/scheduler.js:51-61` gọi `mailer.send()` với `subject` chứa `r.title` (tên sự kiện/dịp) và `text` chứa `r.title`, `r.subject_name`, `r.note` — nội dung nghiệp vụ, có thể nhạy cảm tùy `note`.
- `to: u.email` — gửi PII (email nội bộ user) ra ngoài qua SMTP provider thứ 3 (Brevo, theo `DEPLOY.md`).
- `server/mailer.js:23-33` transporter cấu hình `disableFileAccess/disableUrlAccess` + `tls.rejectUnauthorized:true` (điểm mạnh, giữ). `validateRecipient()` (`:37-42`) chặn header injection cơ bản.
- **Chưa có trong policy hiện tại:** retention của email đã gửi (phía Brevo), consent của người nhận nếu `note` chứa thông tin cá nhân bên thứ 3. Đưa vào O8 cùng với Gemini (cùng loại quyết định "dữ liệu nào được ra ngoài").

## E. SSRF surface (input cho W1.8)
- User-controlled: bảng `sources.url` (Settings UI).
- **Tự động, không cần user ác ý:** `resolveLink(ch.uri)` (`monitor.js:167`) fetch URL do chính Gemini grounding trả về — nghĩa là nếu Gemini (hoặc nội dung nó grounding tới) trả một URL nội bộ/metadata, server tự fetch nó. Đây là đường tấn công gián tiếp qua AI output, không chỉ qua form nhập URL.

## F. Việc cần làm tiếp (không thuộc Gate 0, ghi để không rơi)
- Threat model này là bản v3 (sau Codex G0-audit sửa 3 route thiếu + evaluateCampaign sai + SMTP boundary bỏ sót + uploader mô tả sai) — cập nhật lại sau khi O8 có chính sách chính thức từ Security/Legal.
- Còn thiếu (đưa vào Wave sau, không phải Gate 0): retention/consent cho SMTP recipient, threat model cho background job failure mode (nếu scheduler/monitor crash giữa batch).
