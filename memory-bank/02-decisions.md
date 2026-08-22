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

| # | Quyết định | Khuyến nghị mặc định | Ai quyết |
|---|---|---|---|
| O1 | Danh mục "cột tiền" + "tài liệu tiền" | Duyệt mặc định 03-data-classification.md §A; xác nhận 2 field % + 4 nhóm document mơ hồ | Owner |
| O2 | 1 `org_fee` hay tách view/edit | **1 `org_fee`** + module action. Chỉ tách nếu có workflow "nhập tiền nhưng không được xem tiền" (hiếm) | Owner (1 câu nghiệp vụ) |
| O3 | Contract auth MISA AMIS | Cần AMIS cung cấp: nguồn principal/session, issuer/audience, verify method, TTL, refresh/revoke, tenant claims, deep-link lifecycle. Trước đó `UNVERIFIED` | **Team AMIS Mobile** |
| O4 | Durable web session store | **Bảng Cloud SQL** (async pool riêng, không qua Atomics adapter) nếu đội đang vận hành Cloud SQL; Redis chỉ khi SLO/multi-service cần | Owner |
| O5 | SLO + peak concurrency native | read p95 <500ms, write p95 <800ms, event-loop lag p99 <100ms, error <1% @ 10 concurrent DB-req/instance; owner xác nhận peak + ngân sách instance | Owner |
| O6 | Ngân sách Gemini smoke/golden eval | Corpus 60-100 ca tổng hợp (không dữ liệu thật); candidate × ≥3 repeat; hard cap request/cost; tiêu chí accuracy/valid-schema/latency | Owner |
| O7 | Role "Lãnh đạo — chỉ xem" | Giữ 2 role + `sensitive_perms`, dọn banner (F11). Thêm 1 role read-only NẾU owner cần | Owner |
| O8 | Chính sách data/voice ra Gemini | Public gửi; Internal theo allowlist; Confidential redact/minimize + căn cứ; Restricted không gửi external. Voice cần consent/retention/quyền xóa | **Security/Legal MISA** |

> O3 và O8 **không thuộc tầm quyết của owner một mình** — cần team AMIS + Security/Legal. 6 cái còn lại owner duyệt được ngay. O3/O8 chặn Wave 4 và Wave 1-AI, KHÔNG chặn Gate 0/Gate 1.

## C. Nguyên tắc completion (chống báo cáo ảo)
Không tuyên bố "đạt 100% MDS/native" khi còn thiếu: owner decision, contract native host, hoặc runtime evidence trên thiết bị/host thật. Unknown ghi `UNVERIFIED`.
