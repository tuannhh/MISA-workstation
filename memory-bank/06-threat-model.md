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
   └─► Outbound network (KHÔNG qua 1 cổng chung — nhiều điểm fetch rời rạc):
         ├─ server/monitor.js: fetch RSS/URL do user cấu hình + URL Gemini trả về (grounding)
         ├─ server/gemini.js: REST tới generativelanguage.googleapis.com (audio/text/excel/image)
         └─ award-extract (ai.js): nhận file ảnh/PDF, gửi Gemini
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

## D. Gemini egress map (input trực tiếp cho O8)

| Nguồn dữ liệu | Đường gửi | Chứa gì | Tier đề xuất (03-data-classification.md §D) |
|---|---|---|---|
| Tiêu đề/link tin tức công khai | `monitor.js` sentiment/highlight/campaign-eval | Public | Public — gửi được |
| Nội dung web do `groundedSearch` trả về | `monitor.js:186-232` (grounding) | Public (nhưng KHÔNG tin cậy nội dung — có thể prompt injection) | Public, nhưng cần tách rõ instruction/data trong prompt |
| Audio ghi âm tương tác | Voice-intake (chưa audit chi tiết route trong vòng này — cần G0.3 xác nhận) | **Confidential/Restricted** (giọng nói người thật, có thể chứa thông tin nhạy cảm) | Cần consent — chặn bởi O8 |
| File Excel/CSV sự kiện | AI event-extract | Nội dung nghiệp vụ, đã có redaction email/phone (điểm mạnh giữ) | Internal, redact trước khi gửi |
| Ảnh/PDF giải thưởng | award-extract | Có thể chứa thông tin tài chính/giải thưởng | Internal/Confidential tùy nội dung |
| Dữ liệu partner/person khi soạn prompt báo cáo | `evaluateCampaign` chỉ dùng title/content/source/sentiment đã lưu — KHÔNG thấy field cá nhân trực tiếp trong prompt hiện tại (`monitor.js:284`) | Đã hạn chế — giữ nguyên pattern | — |

**Nguyên tắc chưa được enforce (đưa vào W1.AI-POLICY):** hiện KHÔNG có chốt chặn kỹ thuật nào ngăn một route mới trong tương lai vô tình nhét field `Restricted` (CCCD, số tài khoản NH) vào prompt Gemini. Đây là lý do O8 + W1.AI-POLICY cần deny-by-default ở tầng gateway, không dựa vào "lập trình viên nhớ không gửi".

## E. SSRF surface (input cho W1.8)
- User-controlled: bảng `sources.url` (Settings UI).
- **Tự động, không cần user ác ý:** `resolveLink(ch.uri)` (`monitor.js:167`) fetch URL do chính Gemini grounding trả về — nghĩa là nếu Gemini (hoặc nội dung nó grounding tới) trả một URL nội bộ/metadata, server tự fetch nó. Đây là đường tấn công gián tiếp qua AI output, không chỉ qua form nhập URL.

## F. Việc cần làm tiếp (không thuộc Gate 0, ghi để không rơi)
- G0.3 (đang chạy) cần xác nhận chính xác route voice-intake để điền vào bảng D (hiện đánh dấu `UNVERIFIED` vị trí chính xác file:line).
- Threat model này là bản v1 — cập nhật lại sau khi G0.3 xong và sau khi O8 có chính sách chính thức từ Security/Legal.
