# 02 — Quyết định

## A. Đã chốt (đồng thuận kỹ thuật Claude ↔ Codex — không cần thêm vòng debate)

| # | Chủ đề | Quyết định |
|---|---|---|
| D1 | Money policy | 1 `DATA_POLICY_REGISTRY` (nguồn phân loại duy nhất) + 1 `PolicyEngine` (nơi duy nhất diễn giải). Choke point authorization ở **tầng service/application**, **fail-closed 403**, KHÔNG silent-strip. SQL helper chỉ nhận dữ liệu đã authorize. |
| D2 | Entitlement tiền | **1 `org_fee`** cho v1. Công thức: `read = module.view ∧ org_fee`; `write = module.(create\|edit) ∧ org_fee`. "Xem tiền nhưng không sửa" biểu diễn qua trục module, không cần tách view/edit. |
| D3 | Attachment | Classification **server-derived** từ route/resource/loại tài liệu allowlist; client KHÔNG được tự khai `sensitive_group`/`kind`. `/files/:id` authorize theo resource+action, không chỉ `id_doc`. |
| D4 | Frontend legacy | **Strangler theo vertical slice**, KHÔNG big-bang tách `public/app.js`. Mỗi slice: characterization → mechanical extraction → policy/service → Desktop MDS → Native composition → test. Tách code và đổi nghiệp vụ ở **commit riêng**. |
| D5 | Pilot slice | **People Detail** trước (bề mặt mật lớn nhất: contact/private/social/finance/iddoc/org_fee). Partner Detail slice 2. Supplier/Booking/Event là acceptance suite money xuyên Wave 1. |
| D6 | Auth | Native auth = `UNVERIFIED` (chờ contract MISA AMIS). Dựng seam `resolvePrincipal(req)→req.principal` (Commit A), web session là provider đầu; harden web (Commit B); native provider sau (Commit C). Web session tồn tại vĩnh viễn → không phải làm 2 lần. |
| D7 | Session | Durable store + `secure` + session regenerate khi login + fail-fast secret. |
| D8 | Test-first | Dựng test net phủ 100% inventory route/business-rule **trước** refactor lớn. Không dùng line-coverage hình thức làm bằng chứng duy nhất. |
| D9 | Atomics/DB | Benchmark bắt buộc `DB_CLIENT=mysql` (SQLite chỉ là control). Async repository seam cho code mới; hạ Cloud Run concurrency chỉ là mitigation tạm có expiry. |
| D10 | Gemini | Pin `gemini-3.5-flash`; aiGateway + capability-map; chỉ đổi model sau golden eval + canary + rollback. |
| D11 | SSRF | 1 `safeFetch` seam chung cho monitor + award-extract + mọi outbound fetch. |
| D12 | Severity method | Theo 2 trục (retrofit-tier × target-gate); không thổi phồng theo target chưa cam kết. Target đã bật: browser-production + AMIS-native-host. |

## B. 8 quyết định OWNER cần chốt (kèm khuyến nghị mặc định 2 agent đồng thuận)

> **Trạng thái theo Codex G0-audit (2026-08-22):** register trước đây thiếu cột Status/Approver/Date/Evidence — không phân biệt được "đề xuất chờ duyệt" với "đã duyệt". Đã sửa. **Sự thật hiện tại: KHÔNG có quyết định nào trong O1-O8 đã được duyệt, và O3/O8 CHƯA hề được gửi đi** — Claude chỉ khuyến nghị "nên gửi sớm", không có kênh để tự gửi (không phải email/ticket tool). Việc gửi O3 cho team AMIS và O8 cho Security/Legal là hành động của **owner (người dùng)**, chưa xảy ra.

| # | Quyết định | Khuyến nghị mặc định | Ai quyết | Status | Approver/Recipient | Date | Evidence |
|---|---|---|---|---|---|---|---|
| O1 | Danh mục "cột tiền" + "tài liệu tiền" | Duyệt mặc định 03-data-classification.md §A; xác nhận 2 field % + 4 nhóm document mơ hồ | Owner | **PROPOSED** | — | — | — |
| O2 | 1 `org_fee` hay tách view/edit | **1 `org_fee`** + module action. Chỉ tách nếu có workflow "nhập tiền nhưng không được xem tiền" (hiếm) | Owner (1 câu nghiệp vụ) | **PROPOSED** | — | — | — |
| O3 | Contract auth MISA AMIS | Cần AMIS cung cấp: nguồn principal/session, issuer/audience, verify method, TTL, refresh/revoke, tenant claims, deep-link lifecycle. Trước đó `UNVERIFIED` | **Team AMIS Mobile** | **NOT SUBMITTED** | Team AMIS Mobile (chưa xác định người/kênh cụ thể) | — | Chưa có — owner cần tự gửi hoặc chỉ định người gửi |
| O4 | Durable web session store | **Bảng Cloud SQL** (async pool riêng, không qua Atomics adapter) nếu đội đang vận hành Cloud SQL; Redis chỉ khi SLO/multi-service cần | Owner | **PROPOSED** | — | — | — |
| O5 | SLO + peak concurrency native | read p95 <500ms, write p95 <800ms, event-loop lag p99 <100ms, error <1% @ 10 concurrent DB-req/instance; owner xác nhận peak + ngân sách instance | Owner | **PROPOSED** | — | — | — |
| O6 | Ngân sách Gemini smoke/golden eval | Corpus 60-100 ca tổng hợp (không dữ liệu thật); candidate × ≥3 repeat; hard cap request/cost; tiêu chí accuracy/valid-schema/latency | Owner | **PROPOSED** | — | — | — |
| O7 | Role "Lãnh đạo — chỉ xem" | Giữ 2 role + `sensitive_perms`, dọn banner (F11). Thêm 1 role read-only NẾU owner cần | Owner | **PROPOSED** | — | — | — |
| O8 | Chính sách data/voice ra Gemini | Public gửi; Internal theo allowlist; Confidential redact/minimize + căn cứ; Restricted không gửi external. Voice cần consent/retention/quyền xóa | **Security/Legal MISA** | **NOT SUBMITTED** | Security/Legal MISA (chưa xác định người/kênh cụ thể) | — | Chưa có — owner cần tự gửi hoặc chỉ định người gửi |

**Semantics Status:** `PROPOSED` (khuyến nghị đã viết, chờ owner APPROVED/REJECTED/quyết định khác) → `APPROVED`/`REJECTED` (owner đã quyết, ghi ngày+cách xác nhận ở Evidence — vd "Slack thread", "email 2026-08-25", "họp 2026-08-26") → cho O3/O8: `PROPOSED` → `SUBMITTED` (đã gửi, có recipient/channel/date/tracking) → `RESOLVED` (bên nhận đã trả lời, nội dung contract/policy hết `UNVERIFIED`).

> O3 và O8 không thuộc tầm quyết của owner một mình — cần team AMIS + Security/Legal, nhưng **hành động "gửi" thuộc về owner** vì AI không có kênh liên hệ nội bộ MISA. 6 cái còn lại (O1/O2/O4/O5/O6/O7) owner duyệt trực tiếp được. O3/O8 chặn Wave 4 và W1.AI-POLICY/Wave 3 slice voice, KHÔNG chặn Gate 0/Gate 1.

## B.1 — Findings phụ N1-N3 (từ G0.3/G0.4, cần ID + owner riêng — theo yêu cầu Codex)

| ID | Nội dung | Status | Owner | Cách đóng |
|---|---|---|---|---|
| N1 | 4 route dùng perm `view` cho action có side-effect ghi (`/notifications/:id/read`, `/notifications/read-all`, `/reminders/run`, `/monitor/alerts/:id/read`) | OPEN | Owner (quyết định thiết kế RBAC) | Owner xác nhận: giữ nguyên (rủi ro thấp, chỉ semantics) hay tách action `notify`/`ack` riêng trong `rbac.js` |
| N2 | `GET /dashboard` không có `requirePerm` module cụ thể — mọi role đăng nhập xem được | OPEN | Owner (xác nhận chủ ý) | Owner xác nhận: chủ ý (dashboard chung) → ghi rõ vào rbac design note; hoặc thiếu sót → thêm requirePerm |
| N3 | `uploadAudio` (dùng cho `/ai/award-extract`) không có `fileFilter` — chấp nhận MIME tùy ý tới 25MB, lưu RAM | **RESOLVED bằng source evidence** | — | Đã xác nhận trực tiếp qua `server/uploads.js:39-43` — không cần owner, đã đưa vào `06-threat-model.md` §D và cần fix ở Wave 1 (upload security, không chờ owner quyết) |

## C. Nguyên tắc completion (chống báo cáo ảo)
Không tuyên bố "đạt 100% MDS/native" khi còn thiếu: owner decision, contract native host, hoặc runtime evidence trên thiết bị/host thật. Unknown ghi `UNVERIFIED`.
