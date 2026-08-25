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
   ├─► Outbound network — Gemini (KHÔNG qua 1 cổng chung — 12 luồng logic / 13 lời gọi trực tiếp,
   │     6 trong server/ai.js + 6 trong server/monitor.js, xem §D đầy đủ)
   ├─► Outbound network — HTTP/RSS/user-URL (KHÔNG qua Gemini) — `resolveLink()` fetch URL do
   │     Gemini grounding trả về (monitor.js:170), `detectFeed()` fetch nguồn RSS user khai báo
   │     (monitor.js:40), và fetch URL user dán ở award-extract (ai.js:174) — boundary SSRF, xem §E
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

## D. Gemini egress map — 12 LUỒNG LOGICAL (13 lời gọi trực tiếp) — PASS ở Codex round-3 re-audit (2 sửa diễn đạt P2 ở AI-E001/AI-E012)

> **Lần sửa thứ 2.** Round 1 sửa từ 5 dòng lên "9 callsite" — vẫn SAI. Codex đối chiếu máy: `rg -n 'genJSON|genText|genImage|groundedSearch' server/ai.js server/monitor.js` → **`ai.js` có 6 lời gọi, `monitor.js` có 7 lời gọi trực tiếp** (dòng `:141,:191,:192,:218,:259,:276,:304`) = **13 lời gọi trực tiếp, không phải 9**. Gộp `:191`+`:192` (cùng 1 hàm `groundIngest`, gọi lần 2 chỉ khi lần 1 rỗng chunk — cùng 1 luồng logic, 2 lời gọi) → **12 luồng logic** (`ai.js`=6, `monitor.js`=6). Bảng dưới dùng ID ổn định `AI-E001..AI-E012` theo khuyến nghị Codex, để test deny-by-default sau này trỏ đúng 1:1.

| ID | Route/hàm (trigger) | file:line | Gemini method | Dữ liệu gửi thực tế (input, không phải output nhận về) | Tier đề xuất |
|---|---|---|---|---|---|
| AI-E001 | `POST /ai/interaction-voice` (HTTP) | `ai.js:48-82`, gọi `:63` | `genJSON` | **voice/audio** — file ghi âm base64 gửi thẳng | **Confidential/Restricted** — cần chính sách consent/retention trước khi có dữ liệu thật; **hiện PROVISIONAL-PERMIT chỉ cho dữ liệu test** (O8, owner 2026-08-24 — sửa lại, không còn "chặn bởi O8" như bản trước) |
| AI-E002 | `POST /ai/card-text` (HTTP) | `ai.js:87-100`, gọi `:95` | `genText` | text — `title`, `date_type`, `subject_name` (tên người/tổ chức đối tác), `idea` (user nhập) | Internal |
| AI-E003 | `POST /ai/card-image` (HTTP) | `ai.js:110-129`, gọi `:124` | `genImage` | image — logo tĩnh + `text` (nội dung lời chúc, thường do AI-E002 sinh ra) | Internal |
| AI-E004 | `POST /ai/award-extract` (HTTP) | `ai.js:160-187`, gọi `:180` | `genJSON` | text/image/excel — file upload (base64 buffer, KHÔNG phải "file path" — xem cảnh báo uploader dưới) hoặc text dán hoặc fetch URL (`:174`) rồi `stripHtml` | Internal/Confidential tùy nội dung file thật (fileFilter thiếu — chưa kiểm soát được) |
| AI-E005 | `POST /ai/award-advice` (HTTP) | `ai.js:200-211`, gọi `:207` | `genJSON` | text — `a.name`,`a.organizer`,`a.criteria`,`a.prize_structure`,`a.products` (client tự nhập); **KHÔNG gửi `a.cost`** | Internal |
| AI-E006 | `POST /ai/event-extract` (HTTP) | `ai.js:244-273`, gọi `:265` | `genJSON` | excel/text — có `redactTextForAi()` (điểm mạnh, giữ nguyên) + rate-limit 8/phút/user | Internal, đã redact |
| AI-E007 | `analyzeBatch` — nền cho `analyzePending` (background job, không phải HTTP route) | `monitor.js:131-141`, gọi `:141` | `genJSON` | **`title` + 400 ký tự đầu `content`** của tối đa 8 mention/lần (KHÔNG chỉ "tiêu đề/link" như mô tả round 1) | Public (nội dung tin tức đã crawl công khai) |
| AI-E008 | `groundIngest` (background job, chạy trong `/monitor/scan`) | `monitor.js:186-201`, gọi `:191` + fallback `:192` (2 lời gọi, cùng 1 luồng) | `groundedSearch` | `q.include`/`q.name` — **bộ từ khóa theo dõi đã cấu hình nội bộ** | Internal (chiến lược từ khóa giám sát, không phải Public) |
| AI-E009 | `siteGroundIngest` (background job) | `monitor.js:213-221`, gọi `:218` | `groundedSearch` | host, `source.name`, và `q.include`/`q.name` — cùng loại dữ liệu nội bộ như AI-E008, thêm tên nguồn cụ thể | Internal |
| AI-E010 | `aiMisaHighlights` — "AI (1)" (background job/on-demand `/monitor/highlights`) | `monitor.js:255-260`, gọi `:259` | `groundedSearch` | Chỉ prompt tìm tin công khai về MISA — **không có dữ liệu nội bộ nào trong prompt** | Public — đây là luồng DUY NHẤT trong nhóm monitor thực sự Public |
| AI-E011 | `aiCompetitorAnalysis` — "AI (2)" (`/monitor/competitor-brief`) | `monitor.js:263-277`, gọi `:276` | `groundedSearch` | **Danh sách tên đối thủ từ DB (`competitors`) + toàn bộ từ khóa scan đang enable (`scan_queries.include`)** — chiến lược giám sát đối thủ, KHÔNG phải Public | **Internal** — sửa lại (round 1 gộp nhầm vào "Public grounding") |
| AI-E012 | `evaluateCampaign` (`/monitor/campaigns/:id/evaluate`) | `monitor.js:281-305`, gọi `:304` | `groundedSearch` | `cp.name`,`cp.message`,`cp.content`,`cp.audience`,`kws` (field chiến dịch nội bộ, có thể chứa thông điệp truyền thông chưa công bố) **cộng** số liệu THỐNG KÊ tổng hợp (`stats.total`, số lượng tích cực/trung tính/tiêu cực, `nsr`) — **sửa lại (Codex round-3 re-audit, R3-09):** `title`/`content`/`source_name` của `mentions` chỉ dùng CỤC BỘ trong `matchTerms()` để lọc/đếm (`monitor.js:285-286`), **KHÔNG được đưa vào prompt gửi Gemini** (`monitor.js:292-303` chỉ ghép số liệu đã tổng hợp, không ghép text mention thô) | **Internal** (thông điệp chiến dịch chưa công bố) |

**Đối chiếu số lượng (tự-verify, chạy lại được):**
```text
Direct call expressions: ai.js=6, monitor.js=7 (141,191,192,218,259,276,304), total=13
Logical flows: ai.js=6, monitor.js=6 (191+192 gộp 1 luồng groundIngest), total=12
```

**Cảnh báo uploader (AI-E004, sửa lại mô tả sai round 1):** `uploadAudio` (dùng chung tên gây nhầm cho cả audio VÀ file award-extract) là `multer.memoryStorage()`, **KHÔNG có `fileFilter`**, giới hạn 25MB (`server/uploads.js:39-43`). Route `/ai/award-extract` thực tế nhận file qua `req.file.buffer.toString('base64')` rồi gửi `inlineData` cho Gemini (`server/ai.js:168-170`) — **là buffer base64 trong RAM, KHÔNG phải "gửi thẳng Gemini nếu là file path"** như bản trước ghi sai. MIME tùy ý tới 25MB. Input cho Wave 1 upload-security, không chờ owner quyết.

**Nguyên tắc chưa được enforce (đưa vào W1.AI-POLICY):** hiện KHÔNG có chốt chặn kỹ thuật nào ngăn một route mới trong tương lai vô tình nhét field `Restricted` (CCCD, số tài khoản NH) vào prompt Gemini. Đây là lý do O8 + W1.AI-POLICY cần deny-by-default ở tầng gateway, không dựa vào "lập trình viên nhớ không gửi".

## D.1 SMTP egress (boundary riêng, không phải Gemini — trước đây bỏ sót hoàn toàn)

- `server/scheduler.js:51-61` gọi `mailer.send()` với `subject` chứa `r.title` (tên sự kiện/dịp) và `text` chứa `r.title`, `r.subject_name`, `r.note` — nội dung nghiệp vụ, có thể nhạy cảm tùy `note`.
- `to: u.email` — gửi PII (email nội bộ user) ra ngoài qua SMTP provider thứ 3 (Brevo, theo `DEPLOY.md`).
- `server/mailer.js:24-33` transporter cấu hình `disableFileAccess/disableUrlAccess` + `tls.rejectUnauthorized:true` (điểm mạnh, giữ — sửa lại line số cho đúng, round 1 ghi lệch `:23-33`). `validateRecipient()` (`:39-44`, sửa lại từ `:37-42`) chặn header injection cơ bản.
- **Chưa có trong policy hiện tại:** retention của email đã gửi (phía Brevo), consent của người nhận nếu `note` chứa thông tin cá nhân bên thứ 3. Đưa vào O8 cùng với Gemini (cùng loại quyết định "dữ liệu nào được ra ngoài").

## E. SSRF surface (input cho W1.8)
- User-controlled: bảng `sources.url` (Settings UI).
- **Tự động, không cần user ác ý:** `resolveLink(ch.uri)` (`monitor.js:167`) fetch URL do chính Gemini grounding trả về — nghĩa là nếu Gemini (hoặc nội dung nó grounding tới) trả một URL nội bộ/metadata, server tự fetch nó. Đây là đường tấn công gián tiếp qua AI output, không chỉ qua form nhập URL.

## F. Việc cần làm tiếp (không thuộc Gate 0, ghi để không rơi)
- Threat model này là bản **v5** (v4 sau Codex re-audit round 2; **v5 sau Codex round-3 re-audit R3-09**: G0.8 core inventory PASS — 12 luồng logic/13 lời gọi trực tiếp đúng, SMTP boundary đúng — chỉ còn 2 sửa diễn đạt P2: AI-E001 không còn "chặn bởi O8" mà là provisional-permit cho dữ liệu test; AI-E012 làm rõ mention text chỉ dùng cục bộ để lọc/đếm, không vào prompt) — cập nhật lại sau khi O8 có chính sách chính thức từ Security/Legal khi có dữ liệu thật.
- Còn thiếu (đưa vào Wave sau, không phải Gate 0): retention/consent cho SMTP recipient, threat model cho background job failure mode (nếu scheduler/monitor crash giữa batch).
