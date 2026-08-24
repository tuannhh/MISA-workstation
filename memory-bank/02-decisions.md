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
| D13 | **RBAC v2 — 4 cấp vai trò + visibility cấu hình được** (owner quyết trực tiếp trong hội thoại 2026-08-24, thay thế O2 + O7 cũ) | Xem chi tiết đầy đủ ở §D dưới — không tóm tắt 1 dòng vì đây là quyết định kiến trúc lớn nhất từ đầu dự án. |

## D. D13 — RBAC v2: 4 cấp vai trò + visibility cấu hình được (chốt 2026-08-24)

> **Nguồn: owner quyết trực tiếp qua hội thoại** (không phải khuyến nghị của Claude/Codex chờ duyệt) — Approver: Owner, Date: 2026-08-24, Evidence: "hội thoại chat 2026-08-24, loạt câu hỏi AskUserQuestion về mô hình phân quyền". Quyết định này **thay thế O2** (mô hình entitlement tiền) và **O7** (vai trò lãnh đạo chỉ xem) — cả 2 coi như `SUPERSEDED`, xem §B.

### D13.1 — 4 vai trò (thay thế hoàn toàn 2 role `super_admin`/`pr_staff` hiện tại)
| Vai trò | Quyền |
|---|---|
| **Viewer** | Chỉ xem field được đánh dấu "public" (xem D13.2) — không tạo/sửa gì. |
| **Nhân viên thực thi** | Như Viewer, **cộng**: tạo mới; sửa **bản ghi mà chính họ là `owner`** (xem D13.4); **tự xem đầy đủ mọi field** của bản ghi do chính họ đứng `owner` (không bị ẩn theo cấu hình public/private — ngoại lệ đã owner xác nhận). |
| **Admin** | Full CRUD mọi bản ghi của mọi người — **trừ**: không tạo được tài khoản Admin/Super Admin, không cấu hình API key (Gemini/SMTP), không xem log hệ thống (`audit_log`). |
| **Super Admin** (QTHT) | Admin + tạo/sửa tài khoản Admin, cấu hình API key, xem `audit_log`, phân quyền vai trò cho user khác. Full quyền, không giới hạn. |

### D13.2 — Visibility field-level, admin tự cấu hình (thay thế nhóm mật cố định `contact/private/social/finance/iddoc/org_fee`)
- Không hard-code nhóm mật nữa. Thay bằng **1 bảng cấu hình mới**: mỗi field của mỗi module (vd `people.phone_personal`, `organizations.membership_fee`) có 1 cờ `public`/`private` — **Admin tự bật/tắt qua 1 màn hình quản lý mới**, không phải Claude/Codex hard-code trong `rbac.js`.
- Phạm vi cấu hình: **theo field, không theo từng bản ghi cụ thể** (owner xác nhận: không quản được chi tiết theo từng sự kiện/mối quan hệ — cấu hình field chung áp dụng cho mọi bản ghi cùng module).
- Mặc định khi triển khai (owner chưa xác nhận riêng từng field, dùng làm điểm khởi đầu, Admin chỉnh sau): mọi field hiện đang nằm trong 6 nhóm mật cũ (`contact/private/social/finance/iddoc/org_fee` — xem `03-data-classification.md` §C) → **`private`** làm mặc định an toàn. 2 field `%` thương mại (`service_fee_pct`, `deposit_pct`) và 4 nhóm tài liệu mơ hồ ở O1 → cũng mặc định `private`, Admin nới ra `public` sau nếu cần (rủi ro thấp hơn nhiều so với mặc định `public` rồi lộ nhầm).
- **Ngoại lệ Admin/Super Admin**: luôn thấy mọi field, không bị lọc theo cấu hình `public`/`private` (2 vai trò này không phải "người ngoài" của dữ liệu).

### D13.3 — Tài liệu upload (attachments): visibility theo TỪNG FILE lúc upload
- Khác field dữ liệu (theo field/module chung), tài liệu đính kèm cấu hình **public/private cho từng file cụ thể**, người upload tự chọn ngay lúc tải lên — cần thêm 1 cột mới vào bảng `attachments` (schema migration, Tier B — không ảnh hưởng dữ liệu cũ, chỉ thêm cột có default).
- Mặc định cho file cũ đã upload trước khi có cột này: `private` (an toàn), Admin/người phụ trách tự đổi nếu cần công khai.

### D13.4 — Sở hữu dữ liệu ("người tạo" bất biến vs "người phụ trách" đổi được)
Owner xác nhận 2 khái niệm **tách riêng**, không dùng chung 1 cột:
- **`created_by`** — sự thật lịch sử, ghi 1 lần lúc tạo, **không đổi**. Dùng để biết ai từng tạo, không dùng để tính quyền sửa.
- **`owner_id`** (mới) — người **đang** có quyền sửa bản ghi đó. **Admin/Super Admin gán hoặc gán lại được bất kỳ lúc nào** — dùng chung 1 cơ chế cho cả 2 tình huống owner đã nêu: (a) dữ liệu cũ chưa từng có ai gán owner, và (b) nhân viên tạo ra dữ liệu đã nghỉ việc, cần chuyển giao cho người khác tiếp quản.
- **Quyền sửa** = `user hiện tại có id = owner_id` HOẶC role Admin/Super Admin (luôn bypass).
- **Áp dụng cho đủ 14 loại "hoạt động"** (owner xác nhận không chỉ 4 bảng đã có `created_by` sẵn — tương tác/đặt bài/giải thưởng/sự kiện — mà cả 10 bảng còn chưa có: tài trợ, hợp đồng, lịch sử làm việc, quà tặng, hội phí, báo giá NCC, giao dịch NCC, liên hệ NCC, hồ sơ tham gia giải, cơ hội hưởng lợi). **Cần schema migration**: thêm 2 cột `created_by`+`owner_id` cho 10 bảng chưa có (Tier B — thêm cột mới, nullable, không phá dữ liệu cũ).
- **Dữ liệu cũ (trước migration)**: `owner_id = NULL` mặc định — chỉ Admin/Super Admin sửa được cho tới khi Admin **chủ động gán** 1 owner cụ thể bằng đúng cơ chế gán ở trên (không cần thêm 1 quy trình migration riêng — dùng lại tính năng "gán/gán lại owner" mà Admin sẽ dùng thường xuyên sau này).
- **Chưa xác nhận, để mặc định hợp lý cho tới khi owner sửa lại**: Nhân viên thực thi có tự "nhận" (self-claim) được 1 bản ghi `owner_id=NULL` không, hay chỉ Admin mới gán được? Mặc định đề xuất: **chỉ Admin/Super Admin gán được owner** (Nhân viên thực thi không tự nhận) — an toàn hơn, tránh tranh giành/nhận nhầm dữ liệu cũ không rõ ràng.

### D13.5 — Việc cần làm tiếp (không phải Gate 0 — đây là Wave-level implementation, đưa vào roadmap khi rewrite)
1. Schema migration: thêm `owner_id` (mọi 14 bảng "hoạt động", 10 bảng cần cả `created_by` mới) + cột visibility trên `attachments`.
2. Bảng cấu hình `field_visibility` (module, field, is_public) — thay thế `SENSITIVE_GROUPS` cứng trong `rbac.js`.
3. Màn hình Admin quản lý: (a) cấu hình field public/private theo module, (b) gán/gán lại `owner_id` cho bản ghi, (c) quản lý vai trò 4 cấp (thay 2 role cũ).
4. `PolicyEngine` (D1, không đổi nguyên tắc — chỉ đổi nguồn dữ liệu từ file cứng sang bảng `field_visibility` động) đọc bảng cấu hình này ở runtime, không hard-code.
5. `04-ROADMAP.md`/`08-permission-matrix.md` cần rewrite lớn để phản ánh D13 — **CHƯA làm trong lượt này**, cần 1 lượt riêng sau khi O5 (SLO) và phần voice (O8) cũng được owner trả lời đầy đủ.

## B. 8 quyết định OWNER cần chốt (kèm khuyến nghị mặc định 2 agent đồng thuận)

> **Trạng thái theo Codex G0-audit (2026-08-22):** register trước đây thiếu cột Status/Approver/Date/Evidence — không phân biệt được "đề xuất chờ duyệt" với "đã duyệt". Đã sửa. **Sự thật hiện tại: KHÔNG có quyết định nào trong O1-O8 đã được duyệt, và O3/O8 CHƯA hề được gửi đi** — Claude chỉ khuyến nghị "nên gửi sớm", không có kênh để tự gửi (không phải email/ticket tool). Việc gửi O3 cho team AMIS và O8 cho Security/Legal là hành động của **owner (người dùng)**, chưa xảy ra.

| # | Quyết định | Khuyến nghị mặc định | Ai quyết | Status | Approver/Recipient | Date | Evidence |
|---|---|---|---|---|---|---|---|
| O1 | Danh mục "cột tiền" + "tài liệu tiền" | Duyệt mặc định 03-data-classification.md §A; 2 field % + 4 nhóm document mơ hồ | Owner | **PROPOSED (rủi ro thấp hơn sau D13)** | — | — | Sau D13, đây chỉ là GIÁ TRỊ KHỞI ĐẦU cho cấu hình `field_visibility` (Admin đổi được sau) — đề xuất mặc định `private` cho cả 2 field % và 4 nhóm document, xem D13.2. Chưa cần owner xác nhận riêng nếu đồng ý mặc định an toàn này. |
| O2 | 1 `org_fee` hay tách view/edit | ~~1 `org_fee` + module action~~ | Owner | **SUPERSEDED bởi D13** | Owner | 2026-08-24 | Không còn 1 quyền `org_fee` riêng — tiền chỉ là 1 loại field trong cơ chế `field_visibility` chung ở D13.2, không cần quyết riêng nữa. |
| O3 | Contract auth MISA AMIS | Cần AMIS cung cấp: nguồn principal/session, issuer/audience, verify method, TTL, refresh/revoke, tenant claims, deep-link lifecycle. Trước đó `UNVERIFIED` | **Team AMIS Mobile** | **NOT SUBMITTED** | Team AMIS Mobile (chưa xác định người/kênh cụ thể) | — | Chưa có — owner cần tự gửi hoặc chỉ định người gửi |
| O4 | Durable web session store | **Bảng Cloud SQL** (async pool riêng, không qua Atomics adapter) nếu đội đang vận hành Cloud SQL; Redis chỉ khi SLO/multi-service cần | Owner | **PROPOSED (đã giải thích, chờ owner gật đầu)** | — | — | Đã giải thích chi tiết trong hội thoại 2026-08-24, owner chưa phản hồi trực tiếp — không tự coi là duyệt tới khi có xác nhận rõ. |
| O5 | SLO + peak concurrency native | read p95 <500ms, write p95 <800ms, event-loop lag p99 <100ms, error <1% @ 10 concurrent DB-req/instance; owner xác nhận peak + ngân sách instance | Owner | **PROPOSED — cần số liệu hạ tầng thật** | — | — | Đã giải thích trong hội thoại 2026-08-24; còn thiếu: RAM/CPU thật mỗi instance production (sẽ do DevOps MISA cấu hình, chưa tồn tại — xem cập nhật hạ tầng ở `13-deployment-runbook.md`). |
| O6 | Ngân sách Gemini smoke/golden eval | Corpus 60-100 ca tổng hợp (không dữ liệu thật); candidate × ≥3 repeat; **ngân sách cứng $200** | Owner | **APPROVED** | Owner | 2026-08-24 | "O6: Ngân sách test AI: 200$ nhé" — hội thoại chat 2026-08-24 |
| O7 | Role "Lãnh đạo — chỉ xem" | ~~Giữ 2 role + sensitive_perms~~ | Owner | **SUPERSEDED bởi D13** | Owner | 2026-08-24 | Owner chọn mô hình lớn hơn nhiều: 4 vai trò (Viewer/Nhân viên thực thi/Admin/Super Admin) + visibility cấu hình được — xem D13 đầy đủ ở §D. |
| O8 | Chính sách data/voice ra Gemini | Public gửi; Internal theo allowlist; Confidential redact/minimize + căn cứ; Restricted không gửi external. Voice cần consent/retention/quyền xóa | **Security/Legal MISA** | **NOT SUBMITTED — owner đang mô tả mong muốn riêng cho voice, chưa hoàn tất câu** | Security/Legal MISA (chưa xác định người/kênh cụ thể) | — | Owner bắt đầu trả lời "Chỗ phần voice, mong muốn của tôi là người dùng có thể..." nhưng câu bị ngắt — đang chờ owner hoàn tất ý trước khi ghi tiếp. |

**Semantics Status:** `PROPOSED` (khuyến nghị đã viết, chờ owner APPROVED/REJECTED/quyết định khác) → `APPROVED`/`REJECTED` (owner đã quyết, ghi ngày+cách xác nhận ở Evidence — vd "Slack thread", "email 2026-08-25", "họp 2026-08-26") → cho O3/O8: `PROPOSED` → `SUBMITTED` (đã gửi, có recipient/channel/date/tracking) → `RESOLVED` (bên nhận đã trả lời, nội dung contract/policy hết `UNVERIFIED`).

> O3 và O8 không thuộc tầm quyết của owner một mình — cần team AMIS + Security/Legal, nhưng **hành động "gửi" thuộc về owner** vì AI không có kênh liên hệ nội bộ MISA. 6 cái còn lại (O1/O2/O4/O5/O6/O7) owner duyệt trực tiếp được.
>
> **Semantics gate đã chốt (sửa mâu thuẫn Codex re-audit round 2 tìm ra, F4):** trước đây câu này ghi "KHÔNG chặn Gate 0/Gate 1" trong khi `04-ROADMAP.md` G0.1 lại ghi "gửi O3/O8 ngay" là một phần exit của G0.1 — hai câu tự mâu thuẫn semantics gate. Chốt lại theo khuyến nghị Codex: **SUBMISSION (đã gửi, có recipient/channel/date) là điều kiện exit G0** — vì G0.1 yêu cầu "gửi ngay" đúng nghĩa phải làm trong Gate 0, không phải tùy chọn. **RESOLUTION (bên nhận đã trả lời, policy/contract hết UNVERIFIED) KHÔNG chặn Gate 1** — chỉ chặn `W1.AI-POLICY`, Wave 3 slice voice, và Wave 4 (native auth). Vậy: G0.1 chỉ đóng được khi O3/O8 đạt tối thiểu `SUBMITTED`; hiện tại cả hai đang `NOT SUBMITTED` → **G0.1 vẫn BLOCKED, Gate 1 vẫn HOLD** theo đúng roadmap literal.

## B.1 — Findings phụ N1-N3 (từ G0.3/G0.4, cần ID + owner riêng — theo yêu cầu Codex)

| ID | Nội dung | Status | Owner | Cách đóng |
|---|---|---|---|---|
| N1 | 4 route dùng perm `view` cho action có side-effect ghi (`/notifications/:id/read`, `/notifications/read-all`, `/reminders/run`, `/monitor/alerts/:id/read`) | OPEN | Owner (quyết định thiết kế RBAC) | Owner xác nhận: giữ nguyên (rủi ro thấp, chỉ semantics) hay tách action `notify`/`ack` riêng trong `rbac.js` |
| N2 | `GET /dashboard` không có `requirePerm` module cụ thể — mọi role đăng nhập xem được | OPEN | Owner (xác nhận chủ ý) | Owner xác nhận: chủ ý (dashboard chung) → ghi rõ vào rbac design note; hoặc thiếu sót → thêm requirePerm |
| N3 | `uploadAudio` (dùng cho `/ai/award-extract`) không có `fileFilter` — chấp nhận MIME tùy ý tới 25MB, lưu RAM | **RESOLVED bằng source evidence** | — | Đã xác nhận trực tiếp qua `server/uploads.js:39-43` — không cần owner, đã đưa vào `06-threat-model.md` §D và cần fix ở Wave 1 (upload security, không chờ owner quyết) |

## C. Nguyên tắc completion (chống báo cáo ảo)
Không tuyên bố "đạt 100% MDS/native" khi còn thiếu: owner decision, contract native host, hoặc runtime evidence trên thiết bị/host thật. Unknown ghi `UNVERIFIED`.
