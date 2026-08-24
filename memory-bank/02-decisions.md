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

> **Trạng thái theo Codex G0-audit (2026-08-22):** register trước đây thiếu cột Status/Approver/Date/Evidence. Đã sửa.
>
> **CẬP NHẬT 2026-08-24 — owner đã quyết TẤT CẢ O1-O8** (khác hẳn tình trạng round 2 khi chưa cái nào được duyệt): O6 APPROVED; O2/O7 SUPERSEDED bởi D13; **O3/O4/O5 DEFERRED-TO-DEVOPS** (owner giao DevOps, không còn là owner-submission); **O8 PROVISIONAL** (owner cho phép gửi Gemini tạm với dữ liệu test); O1 mặc định `private`. **Không còn owner-action treo.** Xem chi tiết từng dòng bảng dưới + D13/D14/D15 ở §D/§E/§F.

| # | Quyết định | Khuyến nghị mặc định | Ai quyết | Status | Approver/Recipient | Date | Evidence |
|---|---|---|---|---|---|---|---|
| O1 | Danh mục "cột tiền" + "tài liệu tiền" | Duyệt mặc định 03-data-classification.md §A; 2 field % + 4 nhóm document mơ hồ | Owner | **PROPOSED (rủi ro thấp hơn sau D13)** | — | — | Sau D13, đây chỉ là GIÁ TRỊ KHỞI ĐẦU cho cấu hình `field_visibility` (Admin đổi được sau) — đề xuất mặc định `private` cho cả 2 field % và 4 nhóm document, xem D13.2. Chưa cần owner xác nhận riêng nếu đồng ý mặc định an toàn này. |
| O2 | 1 `org_fee` hay tách view/edit | ~~1 `org_fee` + module action~~ | Owner | **SUPERSEDED bởi D13** | Owner | 2026-08-24 | Không còn 1 quyền `org_fee` riêng — tiền chỉ là 1 loại field trong cơ chế `field_visibility` chung ở D13.2, không cần quyết riêng nữa. |
| O3 | Contract auth MISA AMIS | Cần AMIS cung cấp: nguồn principal/session, issuer/audience, verify method, TTL, refresh/revoke, tenant claims, deep-link lifecycle | **DevOps MISA** (owner chuyển giao 2026-08-24) | **DEFERRED TO DEVOPS** | DevOps MISA | 2026-08-24 | "O3 để cho devops làm nhé. Đó là việc của họ." + làm rõ kiến trúc AMIS Mobile = **cầu nối WebView** (xem D15) — không phải native app riêng, nên bài toán auth là "host truyền session/token vào web app", DevOps + team AMIS Mobile định nghĩa bridge contract. |
| O4 | Durable web session store | **Bảng Cloud SQL** (async pool riêng, không qua Atomics adapter) nếu đội đang vận hành Cloud SQL; Redis chỉ khi SLO/multi-service cần | **DevOps MISA** (owner chuyển giao) | **DEFERRED TO DEVOPS** | — | 2026-08-24 | "devops sẽ tự quyết định việc đó" — owner không tự chốt, giao lại cho DevOps khi cấu hình hạ tầng production thật. Khuyến nghị (bảng Cloud SQL) vẫn giữ làm đề xuất kỹ thuật gửi kèm cho DevOps tham khảo, không phải quyết định đã chốt. |
| O5 | SLO + peak concurrency native | read p95 <500ms, write p95 <800ms, event-loop lag p99 <100ms, error <1% @ 10 concurrent DB-req/instance | **DevOps MISA** (owner chuyển giao) | **DEFERRED TO DEVOPS** | — | 2026-08-24 | "cũng tương tự O4" — giao DevOps quyết số liệu SLO/cấu hình thật. Owner cho biết cấu hình **hiện tại** (môi trường test, không phải cam kết production): **2 vCPU / 4GB RAM** — chỉ để tham khảo mức hiện có, KHÔNG phải ngân sách production đã duyệt. |
| O6 | Ngân sách Gemini smoke/golden eval | Corpus 60-100 ca tổng hợp (không dữ liệu thật); candidate × ≥3 repeat; **ngân sách cứng $200** | Owner | **APPROVED** | Owner | 2026-08-24 | "O6: Ngân sách test AI: 200$ nhé" — hội thoại chat 2026-08-24 |
| O7 | Role "Lãnh đạo — chỉ xem" | ~~Giữ 2 role + sensitive_perms~~ | Owner | **SUPERSEDED bởi D13** | Owner | 2026-08-24 | Owner chọn mô hình lớn hơn nhiều: 4 vai trò (Viewer/Nhân viên thực thi/Admin/Super Admin) + visibility cấu hình được — xem D13 đầy đủ ở §D. |
| O8 | Chính sách data/voice ra Gemini | Public gửi; Internal theo allowlist; Confidential redact/minimize + căn cứ; Restricted không gửi external. Voice cần consent/retention/quyền xóa | Owner (tạm) → **Security/Legal MISA (khi có dữ liệu thật)** | **PROVISIONAL — owner cho phép gửi Gemini tạm thời** | Owner | 2026-08-24 | "O8: Tạm thời cứ gửi cho Gemini xử lý nhé." **Hợp lệ trong bối cảnh dữ liệu HIỆN TẠI là test (bỏ được).** ⚠ Cảnh báo kỹ thuật giữ nguyên (không phải phản đối, chỉ ghi để không rơi): **trước khi có dữ liệu PRODUCTION thật** (danh bạ báo chí/đối tác thật, số liệu tài chính, ghi âm giọng nói, giấy tờ tùy thân) — nên xin Security/Legal duyệt lại, đặc biệt tier Confidential/Restricted. Vẫn XÂY `W1.AI-POLICY` như 1 gateway cấu hình được (mặc định cho phép theo quyết định này, nhưng có sẵn cơ chế deny-by-default để siết sau chỉ bằng đổi config, không phải viết lại). |

## E. D14 — Voice Assistant vision (owner mô tả 2026-08-24, MỞ RỘNG nhiều so với tính năng hiện có)

> Owner: *"Tôi muốn dùng AI để xử lý lệnh bằng voice, cho phép người dùng có thể ra lệnh bằng giọng nói. Ví dụ như trên mobile, đang ở 1 màn hình bất kỳ, có thể gọi AI Assistant ra lệnh và AI sẽ thực thi, update công việc đó (ví dụ vừa đi ăn trưa với chị Giang ở báo Đầu tư, mối quan hệ tốt thì AI sẽ tự động tìm đúng chị Giang, báo Đầu tư để ghi nhận hoạt động và tình trạng quan hệ)."*

### D14.1 — Khác gì so với `POST /ai/interaction-voice` hiện có
Tính năng hiện tại (`ai.js:48-82`, xem `11-business-flows.md` §F.5 gián tiếp liên quan): người dùng bấm 1 nút cụ thể trong màn "Tương tác", ghi âm, AI trích xuất field (transcript/summary/channel/result/date/person_name/org_name) + tự khớp tên với DB (`matchedPerson`/`matchedOrg`) — nhưng **người dùng phải tự bấm Lưu**, không có gì tự ghi vào DB.

Vision mới của owner **mở rộng theo 2 hướng lớn**:
1. **Gọi được từ BẤT KỲ màn hình nào** (không phải 1 nút cố định trong 1 form cụ thể) — cần 1 "AI Assistant" ở tầng ứng dụng (khả năng gợi ý: nút nổi/mic toàn cục trong app native MISA), không gắn với 1 route/form riêng.
2. **Tự động ghi nhận** (không chỉ trích xuất chờ duyệt) — ví dụ đủ để AI tự tìm đúng "chị Giang" + "báo Đầu tư" trong DB rồi **tự tạo bản ghi tương tác + có thể tự cập nhật `relationship_score`** ("mối quan hệ tốt" → tăng điểm quan hệ).

### D14.2 — CHỐT (owner trả lời 2026-08-24): GIỮ bước xác nhận human-in-the-loop
Owner: *"Người dùng phải xác nhận chứ. Vì speech to text có thể sai, người dùng phải xác nhận trước khi ghi dữ liệu."*

→ **Nguyên tắc an toàn giữ nguyên, KHÔNG bỏ human-in-the-loop.** Vision "AI sẽ thực thi" nghĩa là AI **chuẩn bị sẵn hành động** (tìm entity, soạn bản ghi tương tác, đề xuất thay đổi điểm quan hệ) rồi **trình cho người dùng xác nhận** — không tự ghi thẳng. Điều này đồng thời giải quyết cả 3 lo ngại ban đầu:
- Speech-to-text sai → người dùng thấy transcript + dữ liệu AI hiểu, sửa/hủy trước khi lưu.
- Match sai/nhập nhằng entity ("chị Giang" trùng 2 người) → bước xác nhận hiển thị entity AI chọn, người dùng đổi nếu sai; **thiết kế: khi confidence thấp hoặc >1 khớp, BẮT BUỘC người dùng chọn** (không tự chọn khớp gần nhất).
- `relationship_score` → AI **đề xuất** mức thay đổi, người dùng thấy và xác nhận; quy tắc cụ thể AI đề xuất bao nhiêu điểm vẫn cần BA định nghĩa (giữ mở, nhưng không còn rủi ro ghi tự động vì có bước xác nhận).

**Khác biệt thực chất với tính năng hiện tại** vì thế thu hẹp còn: (a) gọi từ mọi màn hình (không phải 1 nút cố định) + (b) AI tự **chuẩn bị đầy đủ hành động đa bước** để người dùng chỉ cần xác nhận 1 lần — chứ KHÔNG phải "AI tự ghi không hỏi". Đây là mở rộng an toàn hơn nhiều so với lo ngại ban đầu.

### D14.3 — Việc cần làm tiếp (không phải Gate 0, ghi để không rơi — đưa vào roadmap khi rewrite theo D13)
- Gắn với **kiến trúc host AMIS Mobile = WebView bridge (D15)** — "gọi từ bất kỳ màn hình nào" nghĩa là trong ngữ cảnh web app đang chạy trong WebView, cần trigger toàn cục (nút nổi/mic) ở tầng web app + có thể cần host bridge cấp quyền mic OS. Không phải xây native app riêng.
- Route AI voice: giữ "trích-xuất-chờ-duyệt" (D14.2 đã chốt human-in-the-loop) nhưng mở rộng thành **hành động đa bước chờ-xác-nhận-1-lần**; rào chắn: confidence threshold khi match entity (thấp/nhiều khớp → bắt người dùng chọn), log mọi lần ghi để audit.
- O8: owner đã cho phép gửi Gemini tạm thời (dữ liệu test) — nhưng khi có dữ liệu thật, khía cạnh "AI ghi dữ liệu nghiệp vụ sau xác nhận" nhẹ rủi ro hơn vì đã có human-in-the-loop; khía cạnh "gửi voice/PII cho Gemini" vẫn là cái cần Security/Legal cân nhắc nhất.

## F. D15 — Kiến trúc host AMIS Mobile = cầu nối WebView (owner làm rõ 2026-08-24)

> Owner: *"phần trên AMIS Mobile, nó chỉ là cầu nối trung gian thôi. Thay vì phải build riêng bộ cài cho từng app thì mỗi app sẽ có icon trên AMIS Mobile. Khi người dùng bấm vào thì nó giống như 1 web app, chạy với native app UI."* (kèm ảnh chụp launcher AMIS Mobile: Chấm công, Phòng họp, Mail, Công việc, OneAI, CRM, WeSign, MCP Monitor, MISA Ticket, Partner Manager…).

**Đây là làm rõ có tác động lớn tới cách hiểu target `AMIS-native-host` và toàn bộ khối "native" trong roadmap:**
- AMIS Mobile **KHÔNG phải** nơi ta build 1 app native (Swift/Kotlin) riêng. Nó là **host launcher + WebView**: mỗi app (kể cả PR Workstation) xuất hiện dưới dạng 1 icon; bấm vào → mở **web app của chính app đó** bên trong khung native (WebView + chrome native của host).
- Nghĩa là **"native composition" trong ngữ cảnh này = web UI chạy trong WebView host, làm cho đúng/đẹp/đúng hành vi mobile** (mobile-first responsive, bottom-nav/safe-area/back/gesture, tích hợp bridge cho session/mic/camera/file/deep-link) — **KHÔNG phải viết lại bằng code native riêng**. Điều này **khớp** với yêu cầu MDS "native mini-app trong host MISA AMIS" (mini-app = web app trong host, đúng như owner mô tả), và **giảm rủi ro/khối lượng đáng kể** cho F5 và các Wave native (không có codebase native song song để đồng bộ).
- **Auth (O3)**: host truyền session/token vào web app qua bridge — đây chính là nội dung O3, giờ giao DevOps + team AMIS Mobile định nghĩa. Seam `resolvePrincipal(req)→req.principal` (D6) vẫn đúng: web provider hiện tại + AMIS-host provider (đọc token do host bơm vào) là 2 adapter cùng contract.
- **Tác động roadmap**: W2.5 (host-adapter interface + fake providers) và Wave 3 "native composition" vẫn cần, nhưng hiểu đúng là **web-in-WebView + bridge integration**, không phải build native. W4 device-test vẫn cần (test thật trong WebView host trên thiết bị: safe-area, back, mic permission, deep-link) nhưng không có "native shell code" riêng để test.
- **Chưa xác minh (UNVERIFIED, chờ DevOps/AMIS)**: bridge API cụ thể của AMIS Mobile (cách bơm token, cách xin quyền OS mic/camera/file qua host, cách xử lý back/deep-link) — đây là phần O3 mà DevOps sẽ làm rõ với team AMIS Mobile.

**Semantics Status:** `PROPOSED` (khuyến nghị đã viết, chờ owner APPROVED/REJECTED/quyết định khác) → `APPROVED`/`REJECTED` (owner đã quyết, ghi ngày+cách xác nhận ở Evidence — vd "Slack thread", "email 2026-08-25", "họp 2026-08-26") → cho O3/O8: `PROPOSED` → `SUBMITTED` (đã gửi, có recipient/channel/date/tracking) → `RESOLVED` (bên nhận đã trả lời, nội dung contract/policy hết `UNVERIFIED`).

> **Cập nhật 2026-08-24 — semantics gate O3/O8 đã được owner giải quyết trực tiếp (thay cho phân tích F4 cũ ở dưới):**
> - **O3 → DevOps** (owner giao). Không còn là owner-submission chặn G0; là việc DevOps làm khi tới W2.5/W4.1.
> - **O8 → PROVISIONAL** (owner cho phép gửi Gemini tạm với dữ liệu test). Không còn `NOT SUBMITTED` chặn G0; `W1.AI-POLICY` xây ngay dạng gateway cấu hình được.
> - **G0 không còn bị chặn bởi owner-action** — điều kiện đóng G0 duy nhất còn lại là Codex re-audit round 3 (xem `04-ROADMAP.md` Gate 0).
>
> *(Lưu vết phân tích F4 cũ — nay đã bị owner-decision thay: trước đây chốt "SUBMISSION O3/O8 là exit G0, cả hai đang NOT SUBMITTED → G0.1 BLOCKED". Đúng tại thời điểm round 2, nhưng owner 2026-08-24 đã quyết khác: O3 giao DevOps, O8 cho phép tạm → không còn BLOCKED vì owner-action.)*

## B.1 — Findings phụ N1-N3 (từ G0.3/G0.4, cần ID + owner riêng — theo yêu cầu Codex)

| ID | Nội dung | Status | Owner | Cách đóng |
|---|---|---|---|---|
| N1 | 4 route dùng perm `view` cho action có side-effect ghi (`/notifications/:id/read`, `/notifications/read-all`, `/reminders/run`, `/monitor/alerts/:id/read`) | OPEN | Owner (quyết định thiết kế RBAC) | Owner xác nhận: giữ nguyên (rủi ro thấp, chỉ semantics) hay tách action `notify`/`ack` riêng trong `rbac.js` |
| N2 | `GET /dashboard` không có `requirePerm` module cụ thể — mọi role đăng nhập xem được | OPEN | Owner (xác nhận chủ ý) | Owner xác nhận: chủ ý (dashboard chung) → ghi rõ vào rbac design note; hoặc thiếu sót → thêm requirePerm |
| N3 | `uploadAudio` (dùng cho `/ai/award-extract`) không có `fileFilter` — chấp nhận MIME tùy ý tới 25MB, lưu RAM | **RESOLVED bằng source evidence** | — | Đã xác nhận trực tiếp qua `server/uploads.js:39-43` — không cần owner, đã đưa vào `06-threat-model.md` §D và cần fix ở Wave 1 (upload security, không chờ owner quyết) |

## C. Nguyên tắc completion (chống báo cáo ảo)
Không tuyên bố "đạt 100% MDS/native" khi còn thiếu: owner decision, contract native host, hoặc runtime evidence trên thiết bị/host thật. Unknown ghi `UNVERIFIED`.
