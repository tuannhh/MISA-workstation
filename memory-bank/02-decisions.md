# 02 — Quyết định

## A. Đã chốt (đồng thuận kỹ thuật Claude ↔ Codex — không cần thêm vòng debate)

| # | Chủ đề | Quyết định |
|---|---|---|
| D1 | Money policy | **RETAINED, phạm vi AMENDED BY D13** (Codex C0.2, 2026-08-24): nguyên tắc không đổi — 1 `DATA_POLICY_REGISTRY` (nguồn phân loại duy nhất) + 1 `PolicyEngine` (nơi duy nhất diễn giải), choke point tầng service/application, **fail-closed 403**, KHÔNG silent-strip, SQL helper chỉ nhận dữ liệu đã authorize. Đổi ở **phạm vi**: registry giờ bao trùm mọi field mật (không chỉ tiền) qua mô hình `classification_tier` + `audience_visibility` ở D13.2b, không còn giới hạn ở `org_fee`. |
| D2 | Entitlement tiền | **SUPERSEDED BY D13** (2026-08-24). Không còn 1 quyền `org_fee` riêng biệt tách view/edit theo module — field tiền giờ chỉ là field có `classification_tier≥Confidential` trong cơ chế `field_visibility`+role+ownership chung (D13.2b), như mọi field mật khác. |
| D3 | Attachment | **RETAINED, AMENDED BY D13** (Codex C0.2, 2026-08-24 — Codex yêu cầu rõ giữ nguyên nguyên tắc server-derived). Classification **server-derived** từ route/resource/loại tài liệu allowlist; client KHÔNG được tự khai `sensitive_group`/`kind`. `/files/:id` authorize theo resource+action, không chỉ `id_doc`. **Thêm ở D13.3b**: server còn tính **trần (ceiling) audience_visibility tối đa** cho mỗi file theo route/resource/document type — người upload chỉ được chọn visibility **bằng hoặc chặt hơn** trần đó, không được chọn `public` nếu server đã tính trần là `private`. |
| D4 | Frontend legacy | **Strangler theo vertical slice**, KHÔNG big-bang tách `public/app.js`. Mỗi slice: characterization → mechanical extraction → policy/service → Desktop MDS → Native composition → test. Tách code và đổi nghiệp vụ ở **commit riêng**. |
| D5 | Pilot slice | **People Detail** trước (bề mặt mật lớn nhất: contact/private/social/finance/iddoc/org_fee). Partner Detail slice 2. Supplier/Booking/Event là acceptance suite money xuyên Wave 1. |
| D6 | Auth | Native auth = `UNVERIFIED` (chờ contract MISA AMIS). Dựng seam `resolvePrincipal(req)→req.principal` (Commit A), web session là provider đầu; harden web (Commit B); native provider sau (Commit C). Web session tồn tại vĩnh viễn → không phải làm 2 lần. |
| D7 | Session | Durable store + `secure` + session regenerate khi login + fail-fast secret. |
| D8 | Test-first | Dựng test net phủ 100% inventory route/business-rule **trước** refactor lớn. Không dùng line-coverage hình thức làm bằng chứng duy nhất. |
| D9 | Atomics/DB | Benchmark bắt buộc `DB_CLIENT=mysql` (SQLite chỉ là control). Async repository seam cho code mới; hạ Cloud Run concurrency chỉ là mitigation tạm có expiry. |
| D10 | Gemini | Pin `gemini-3.5-flash`; aiGateway + capability-map; chỉ đổi model sau golden eval + canary + rollback. **2026-08-30 (W2.6):** đã golden-eval candidate `gemini-3.7-flash` (360 call thật, $4.456/$200) — không thắng rõ (regression `event-extract` + latency tail 70.7s kèm output hỏng), **giữ nguyên pin**. Xem `04-ROADMAP.md` W2.6. |
| D11 | SSRF | 1 `safeFetch` seam chung cho monitor + award-extract + mọi outbound fetch. |
| D12 | Severity method | Theo 2 trục (retrofit-tier × target-gate); không thổi phồng theo target chưa cam kết. Target đã bật: browser-production + AMIS-native-host. |
| D13 | **RBAC v2 — 4 cấp vai trò + visibility cấu hình được** (owner quyết trực tiếp trong hội thoại 2026-08-24, thay thế O2 + O7 cũ) | Xem chi tiết đầy đủ ở §D dưới — không tóm tắt 1 dòng vì đây là quyết định kiến trúc lớn nhất từ đầu dự án. |

## D. D13 — RBAC v2: 4 cấp vai trò + visibility cấu hình được (chốt 2026-08-24; **security-complete hoá theo Codex C0.2 round-3, 2026-08-25**)

> **Nguồn: owner quyết trực tiếp qua hội thoại** (không phải khuyến nghị của Claude/Codex chờ duyệt) — Approver: Owner, Date: 2026-08-24, Evidence: "hội thoại chat 2026-08-24, loạt câu hỏi AskUserQuestion về mô hình phân quyền". Quyết định này **thay thế O2** (mô hình entitlement tiền) và **O7** (vai trò lãnh đạo chỉ xem) — cả 2 coi như `SUPERSEDED`, xem §B.
>
> **Cập nhật 2026-08-25 (Codex round-3 re-audit, finding R3-03/R3-04):** bản D13 ngày 2026-08-24 dùng **1 cờ boolean** (`public`/`private`) làm cả visibility LẪN classification — Codex chỉ ra đây là lỗ hổng thật: 1 Admin sơ ý bật `public` cho `people.bank_account_number` hay 1 giấy tờ tùy thân là hợp lệ theo mô tả cũ, mâu thuẫn D3 (server-derived, Restricted mặc định không gửi ra ngoài). D13.2/D13.3 dưới đây được viết lại theo yêu cầu C0.2: tách rõ 4 trục **classification_tier / audience_visibility / authorization / AI-egress**, không dùng 1 cờ duy nhất cho cả 4 việc. D13.4 bổ sung ma trận ownership cho các resource ngoài 14 "hoạt động" theo C0.2/R3-04.

### D13.1 — 4 vai trò (thay thế hoàn toàn 2 role `super_admin`/`pr_staff` hiện tại)
| Vai trò | Quyền |
|---|---|
| **Viewer** | Chỉ xem field/bản ghi có `audience_visibility=public` (xem D13.2b) — không tạo/sửa/xoá gì. |
| **Nhân viên thực thi** | Như Viewer, **cộng**: tạo mới; sửa **bản ghi mà chính họ là `owner`** (xem D13.4); **tự xem đầy đủ mọi field** của bản ghi do chính họ đứng `owner` (không bị ẩn theo cấu hình public/private — ngoại lệ đã owner xác nhận). **KHÔNG có quyền xoá** (delete) kể cả bản ghi mình `owner` — mặc định an toàn vì owner chưa cấp quyền này rõ ràng; chỉ Admin/Super Admin xoá được (xem D13.4 mục "delete"). |
| **Admin** | Full CRUD (kể cả delete) mọi bản ghi của mọi người — **trừ**: không tạo được tài khoản Admin/Super Admin, không cấu hình API key (Gemini/SMTP), không xem log hệ thống (`audit_log`), **không tự hạ `classification_tier` hay nới `audience_visibility` vượt trần tier** (xem D13.2a — việc này cần Super Admin/quy trình duyệt riêng). |
| **Super Admin** (QTHT) | Admin + tạo/sửa tài khoản Admin, cấu hình API key, xem `audit_log`, phân quyền vai trò cho user khác, duyệt nới `audience_visibility` vượt trần `Confidential`/`Restricted`. Full quyền, không giới hạn. |

### D13.2 — 4 trục tách biệt (KHÔNG dùng 1 cờ boolean cho cả 4 việc — sửa theo Codex C0.2)

**D13.2a — `classification_tier` (trần bảo mật, server-controlled, KHÔNG phải Admin UI thường)**
- Tái dùng đúng 4 mức đã có ở `03-data-classification.md` §D (`Public`/`Internal`/`Confidential`/`Restricted`) — mở rộng phạm vi dùng: không chỉ để quyết định AI-egress (O8) mà còn là **trần tối thiểu bắt buộc** cho `audience_visibility` (D13.2b) của field/tài liệu đó.
- Gán cứng theo nhóm field đã biết (nguồn: `03-data-classification.md` §A/§C, hard-code trong migration/seed, KHÔNG qua màn hình Admin thường):
  - `finance` (bank_account_number, bank_name), `iddoc` (giấy tờ tùy thân) → **Restricted**.
  - `org_fee` (mọi field tiền §A), `contact`/`private`/`social` (person) → **Confidential**.
  - 2 field `%` thương mại (`service_fee_pct`, `deposit_pct`) và 4 nhóm tài liệu mơ hồ (O1) → **Confidential** (owner APPROVED 2026-08-24, xem §B O1 — đây là quyết định về **tier**, không phải chỉ "giá trị khởi tạo visibility" như bản ghi trước, theo đúng yêu cầu Codex C0.1: "audience default, không phải cho phép hạ classification tier bất biến").
  - Field nghiệp vụ không thuộc nhóm mật nào ở trên → **Public** (trần thấp nhất, `audience_visibility` được tự do public/private).
- **Hạ `classification_tier`** của 1 field (vd đưa 1 field từ Confidential xuống Internal) **không phải thao tác Admin UI thông thường** — cần migration/seed thay đổi + ghi lý do (không có UI "1 click" cho việc này ở D13 — đây là bảo vệ chống Admin lỡ tay biến dữ liệu mật thành field thường).

**D13.2b — `audience_visibility` (cấu hình được, Admin tự bật/tắt) — CHỈ ĐƯỢC SIẾT, KHÔNG ĐƯỢC NỚI DƯỚI TRẦN TIER**
- Bảng cấu hình `field_visibility(module, field, is_public)` — Admin tự bật/tắt qua 1 màn hình quản lý mới, thay `SENSITIVE_GROUPS` cứng trong `rbac.js` cũ.
- Phạm vi cấu hình: **theo field, không theo từng bản ghi cụ thể** (owner xác nhận: không quản được chi tiết theo từng sự kiện/mối quan hệ — cấu hình field chung áp dụng cho mọi bản ghi cùng module).
- **Ràng buộc bắt buộc (mới, theo C0.2):** `audience_visibility=public` chỉ hợp lệ nếu `classification_tier` của field đó là `Public` **HOẶC** đã qua quy trình duyệt Super Admin/Security cho tier cao hơn (D13.1). Với field tier `Confidential`/`Restricted`, Admin **không thể** tự bật `public` qua màn hình cấu hình thường — UI phải chặn lựa chọn này (fail-closed ở cả UI lẫn server, không chỉ ẩn nút).
- Mặc định khi triển khai: mọi field tier `Confidential`/`Restricted` → seed `audience_visibility=private`. Field tier `Public` → Admin tự chọn, mặc định `public` hợp lý cho field nghiệp vụ thường.
- **Ngoại lệ Admin/Super Admin**: luôn thấy mọi field bất kể `audience_visibility`, không bị lọc (2 vai trò này không phải "người ngoài" của dữ liệu) — nhưng vẫn bị D13.2a chặn khi thao tác đổi chính cấu hình visibility vượt trần.
- **Fail-closed khi thiếu cấu hình:** field chưa có dòng nào trong `field_visibility` → coi như `private` (không mặc định `public` khi thiếu config).
- **Governance của bảng `field_visibility`** (theo C0.2 mục 5): unique key `(module, field)`; validate field nằm trong allowlist cột thật của module (đối chiếu `XXX_COLS`/schema, từ chối cấu hình cho field không tồn tại — chống config-drift); mọi thay đổi ghi `audit_log` (ai đổi field nào, từ gì sang gì, khi nào); nếu `PolicyEngine` cache bảng này trong bộ nhớ để tăng tốc, **phải invalidate/reload ngay khi Admin đổi** — không có cửa sổ trễ mà cấu hình cũ vẫn còn hiệu lực.
- **`authorization`** (trục thứ 3, tách khỏi 2 trục trên) = D13.1 (role) × D13.4 (ownership) × action — quyết định CRUD, không liên quan gì tới việc field đó public hay private (1 field `public` vẫn có thể không sửa được nếu user không phải `owner`).
- **`AI-egress policy`** (trục thứ 4) = `classification_tier` × purpose × provider, theo `03-data-classification.md` §D + O8 (không đổi bởi D13 — `audience_visibility` KHÔNG được dùng làm căn cứ egress; 1 field owner cho Viewer xem `public` không có nghĩa được tự động gửi Gemini nếu tier là Confidential/Restricted).

### D13.3 — Tài liệu upload (attachments): visibility theo TỪNG FILE, có trần server-derived

**D13.3a** — Tài liệu đính kèm cấu hình **public/private cho từng file cụ thể**, người upload tự chọn ngay lúc tải lên — cần thêm 1 cột mới vào bảng `attachments` (schema migration, Tier B — không ảnh hưởng dữ liệu cũ, chỉ thêm cột có default). Mặc định cho file cũ đã upload trước khi có cột này: `private` (an toàn), Admin/người phụ trách tự đổi nếu cần công khai.

**D13.3b (mới, theo C0.2/D3 AMENDED)** — Server tính **trần (ceiling) visibility tối đa** cho mỗi file theo route/resource/document type (D3 server-derived, không đổi nguyên tắc):
- Giấy tờ tùy thân (`kind='id_doc'`), tài liệu tài chính/hợp đồng có số tiền → trần = `private` cứng, người upload **không có lựa chọn** `public` trên UI cho các loại này (không phải "mặc định private nhưng đổi được").
- Ảnh chân dung, tài liệu sự kiện công khai (banner, tài liệu truyền thông không mật) → trần = `public`, người upload tự do chọn public/private trong phạm vi đó.
- Người upload chỉ được chọn visibility **bằng hoặc chặt hơn trần** (private luôn hợp lệ; public chỉ hợp lệ nếu trần cho phép) — không có đường nào để 1 Nhân viên thực thi "lỡ tay" công khai hoá 1 giấy tờ tùy thân chỉ bằng cách bấm chọn `public` lúc upload.

### D13.4 — Sở hữu dữ liệu: ma trận đầy đủ (mở rộng theo Codex C0.2/R3-04, không chỉ 14 "hoạt động")

**Khái niệm cơ bản (giữ nguyên từ 2026-08-24):**
- **`created_by`** — sự thật lịch sử, ghi 1 lần lúc tạo, **không đổi**. Dùng để biết ai từng tạo, không dùng để tính quyền sửa.
- **`owner_id`** (mới) — người **đang** có quyền sửa bản ghi đó. **Admin/Super Admin gán hoặc gán lại được bất kỳ lúc nào** — dùng chung 1 cơ chế cho cả 2 tình huống owner đã nêu: (a) dữ liệu cũ chưa từng có ai gán owner, và (b) nhân viên tạo ra dữ liệu đã nghỉ việc, cần chuyển giao cho người khác tiếp quản.
- **Quyền sửa (không delete)** = `user hiện tại có id = owner_id` HOẶC role Admin/Super Admin (luôn bypass).

**D13.4a — Ma trận nguồn sở hữu theo NHÓM resource (theo yêu cầu C0.2 mục 3 — phủ hết resource mutable, không chỉ 14 "hoạt động"):**

| Nhóm resource | Bảng | Nguồn sở hữu | Lý do |
|---|---|---|---|
| **14 "hoạt động"** (owner đã chốt 2026-08-24) | bookings, interactions, awards, events, sponsorships, agreements, work_logs, gifts, association_fees, supplier_quotes, supplier_transactions, supplier_contacts, award_participations, benefit_usages | **Direct** — `owner_id` riêng từng bản ghi (D13.4b) | Owner xác nhận rõ: "chỉ áp dụng cho việc/hoạt động của người đó tạo". |
| **Danh bạ dùng chung** (không phải "hoạt động") | organizations, people, suppliers | **Global** — mọi Nhân viên thực thi có quyền `module:edit` đều sửa được, không gate theo `owner_id` (field mật vẫn bị `audience_visibility` chặn như thường) | **Owner APPROVED 2026-08-25 (D13-P1):** danh bạ dùng chung được sửa theo quyền module; field mật vẫn gate riêng, delete vẫn chỉ Admin/Super Admin, mọi thay đổi phải audit. |
| **Nhắc việc dùng chung** | important_dates | **Global** — lịch toàn phòng; Nhân viên thực thi có quyền `module:edit` được sửa, `created_by` vẫn ghi để audit | **Owner APPROVED 2026-08-25 (D13-P2):** lịch nhắc dùng chung được sửa theo quyền module; delete vẫn chỉ Admin/Super Admin, mọi thay đổi phải audit. |
| **Kế hoạch tài chính cấp phòng** | budgets | **Module-admin-only** — chỉ Admin/Super Admin ghi (khớp hiện trạng: `POST /budgets` hiện chỉ gate `reports:view`, do `super_admin` mới có — xem N1 dưới và `14-known-traps.md` #11) | Ngân sách kỳ là quyết định cấp quản lý, không phải việc cá nhân từng nhân viên. |
| **Chi phí sự kiện** | event_costs | **Inherited** — kế thừa `owner_id` của `events` cha (event_costs không có "người tạo" độc lập với sự kiện chứa nó) | event_costs luôn thuộc 1 event cụ thể, không có vòng đời riêng. |
| **Cấu hình giám sát truyền thông** | scan_queries, sources, competitors, campaigns, monitor_alerts | **Module-admin-only** — chỉ Admin/Super Admin cấu hình (khớp hiện trạng module `monitoring` chủ yếu `super_admin`) | Cấu hình quét dùng chung toàn phòng, không phải dữ liệu cá nhân tạo ra. |
| **Tài nguyên quản trị** | users, field_visibility config, API key config, audit_log | **Global theo role** (không dùng `owner_id`) — quyết định hoàn toàn bởi D13.1 (Admin/Super Admin) | Đã có cơ chế phân quyền riêng ở D13.1, không cần lớp ownership thêm. |

> **Owner approval bổ sung 2026-08-25:** D13-P1/P2 đã được owner duyệt trực tiếp qua câu “ok nhé, tôi nhất trí đề xuất của bạn”, sau khi Codex trình bày rõ hai mặc định và rào chắn đi kèm. Hai rule `Global` trên là expected result chính thức cho G1B target tests; không còn product-decision gap ở C0.2.

> **Thứ tự áp dụng policy:** rule theo resource ở D13.4a là lớp cụ thể và **ưu tiên hơn** mô tả role tổng quát D13.1. Ví dụ Nhân viên thực thi được tạo bản ghi nói chung nhưng không được ghi `budgets` hay monitor configuration vì hai nhóm này là `Module-admin-only`; ngược lại họ được sửa shared-directory theo rule `Global` dù không có `owner_id`.

| Pending ID | Product semantics cần owner chốt | Khuyến nghị hiện tại | Status | Approver/Evidence |
|---|---|---|---|---|
| D13-P1 | Nhân viên thực thi có được sửa mọi `organizations`/`people`/`suppliers` dùng chung hay chỉ Admin/owner? | **Global edit** nếu có `module:edit`; field mật vẫn gate riêng | **APPROVED** | Owner, 2026-08-25 — “ok nhé, tôi nhất trí đề xuất của bạn” |
| D13-P2 | `important_dates` là lịch dùng chung mọi Nhân viên thực thi được sửa hay phải có owner/Admin? | **Global edit**; giữ `created_by` chỉ để audit | **APPROVED** | Owner, 2026-08-25 — “ok nhé, tôi nhất trí đề xuất của bạn” |

**D13.4b — Với nhóm "Direct" (14 hoạt động), đủ ngữ nghĩa CRUD + vòng đời (theo yêu cầu C0.2 mục 4):**
- **Create**: `owner_id` = chính người tạo, gán tự động (không cần Admin can thiệp lúc tạo mới).
- **Read**: mọi role ≥ Viewer thấy **sự tồn tại bản ghi** + field `audience_visibility=public`; owner thấy đầy đủ (D13.1); Admin/Super Admin thấy đầy đủ.
- **Update**: `user.id === owner_id` HOẶC Admin/Super Admin.
- **Delete**: **CHỈ Admin/Super Admin** (Nhân viên thực thi không có quyền xoá kể cả bản ghi mình `owner` — D13.1).
- **`created_by` immutable**: không route nào được phép ghi đè `created_by` sau khi tạo, kể cả Admin (chỉ đọc, không có API sửa field này).
- **Chuyển giao khi user bị vô hiệu hoá (deactivate, KHÔNG hard-delete — user có lịch sử tham chiếu)**: `owner_id` của các bản ghi user đó đang giữ **KHÔNG tự động đổi** khi tài khoản bị deactivate — vẫn trỏ tới user cũ (giữ tính toàn vẹn lịch sử) cho tới khi Admin **chủ động** dùng cơ chế gán/gán lại (D13.4c) để chuyển cho người tiếp quản. User bị deactivate mất quyền đăng nhập/sửa (tự động qua kiểm tra `active`), nhưng `owner_id` cũ không bị xoá/null hoá.
- **Rò rỉ qua derived/search/filter/sort/count/aggregate**: field bị `audience_visibility=private` với user hiện tại **phải bị loại khỏi** mọi kết quả search/filter/sort theo field đó, và khỏi mọi phép tính tổng hợp hiển thị cho user đó (vd không hiện `grandTotal` cộng cả field mật nếu user không có quyền xem field đó — sửa lỗi hiện tại ở `10-api-contract.md` §E `grandTotal` không check quyền). Đây là lý do `PolicyEngine` (D1) phải là choke point ở **tầng truy vấn/service**, không phải chỉ mask response sau khi đã tính xong — tính tổng/sắp xếp sai lệch cũng là 1 dạng rò rỉ.

**D13.4c — Self-claim: CHỐT (không còn "mặc định chờ owner sửa lại")**
> **Owner APPROVED 2026-08-25** (evidence: `PR-WORKSTATION-CODEX-G0-CLOSE-CONTRACT.md` — "tôi duyệt 4 mặc định C0.1 như bạn đề xuất nhé", ghi nhận owner approval record đầu file đó). Thay thế hoàn toàn câu hỏi mở trước đây.

**Nhân viên thực thi KHÔNG được tự nhận (self-claim) bản ghi `owner_id=NULL`. Chỉ Admin/Super Admin được gán hoặc chuyển `owner_id`** — dùng đúng 1 cơ chế "gán/gán lại owner" (màn hình Admin, D13.5) cho mọi tình huống: dữ liệu cũ chưa gán, nhân viên nghỉ việc cần chuyển giao, hoặc điều chỉnh phân công thông thường.

### D13.5 — Việc cần làm tiếp (không phải Gate 0 — đây là Wave-level implementation, đưa vào roadmap khi rewrite)
1. Schema migration: thêm `owner_id` (mọi 14 bảng "hoạt động", 10 bảng cần cả `created_by` mới) + cột visibility trên `attachments` (+ trần D13.3b tính server-side, không cần cột riêng nếu suy được từ route/kind).
2. Bảng cấu hình `field_visibility` (module, field, is_public) + cột/bảng `classification_tier` seed cứng theo D13.2a — thay thế `SENSITIVE_GROUPS` cứng trong `rbac.js`.
3. Màn hình Admin quản lý: (a) cấu hình `audience_visibility` public/private theo module (chặn UI nếu vượt trần tier), (b) gán/gán lại `owner_id` cho bản ghi, (c) quản lý vai trò 4 cấp (thay 2 role cũ).
4. `PolicyEngine` (D1, không đổi nguyên tắc — chỉ đổi nguồn dữ liệu từ file cứng sang bảng `field_visibility` động + `classification_tier` seed) đọc bảng cấu hình này ở runtime tại **tầng truy vấn/service** (không chỉ mask response), không hard-code.
5. Resource-policy table/spec cho D13.4a (organizations/people/suppliers/important_dates/budgets/event_costs/monitoring/admin) — cùng migration với mục 1-2.
6. `04-ROADMAP.md`/`08-permission-matrix.md` đã rewrite v3 phản ánh D13 — phần ma trận UI-flow (G0.4/C0.3) đang do **Codex trực tiếp thực hiện** (owner 2026-08-25: "phần chỉnh sửa UI/UX sẽ chuyển cho Codex thực hiện"), không phải Claude.

## B. 8 quyết định OWNER cần chốt (kèm khuyến nghị mặc định 2 agent đồng thuận)

> **Trạng thái theo Codex G0-audit (2026-08-22):** register trước đây thiếu cột Status/Approver/Date/Evidence. Đã sửa.
>
> **CẬP NHẬT 2026-08-24 — owner đã quyết TẤT CẢ O1-O8** (khác hẳn tình trạng round 2 khi chưa cái nào được duyệt): O6 APPROVED; O2/O7 SUPERSEDED bởi D13; **O3/O4/O5 DEFERRED-TO-DEVOPS** (owner giao DevOps, không còn là owner-submission); **O8 PROVISIONAL** (owner cho phép gửi Gemini tạm với dữ liệu test); O1 mặc định `private`. **Không còn owner-action treo.** Xem chi tiết từng dòng bảng dưới + D13/D14/D15 ở §D/§E/§F.
>
> **CẬP NHẬT 2026-08-25 — Codex `G0-CLOSE-CONTRACT` (C0.1), owner APPROVED 4 mặc định:** O1 chuyển từ "mặc định chưa hỏi lại" sang **APPROVED chính thức** (với ngữ nghĩa rõ hơn — audience default, không phải hạ classification tier, xem dòng O1 dưới); D13 self-claim **CHỐT: không self-claim** (D13.4c); N1 **CHỐT: dùng action tường minh** (`ack`/`notify`/`run`, không dùng `view` cho side-effect); N2 **CHỐT: `dashboard:view` tường minh, cấp cho mọi role được phép xem**. Evidence chung cho cả 4: `PR-WORKSTATION-CODEX-G0-CLOSE-CONTRACT.md`, Approver Owner, Date 2026-08-25, quote "tôi duyệt 4 mặc định C0.1 như bạn đề xuất nhé".
>
> **CẬP NHẬT 2026-09-02 — owner làm rõ O3:** khi DevOps đưa build vào môi trường MISA, AMIS Mobile
> tự thiết lập host/bridge và mở icon ứng dụng thẳng đến Native-Mobile UI. O3 là handoff deployment của
> DevOps/AMIS, **không phải blocker hoặc provider/device-test phải làm trong repository này**.

| # | Quyết định | Khuyến nghị mặc định | Ai quyết | Status | Approver/Recipient | Date | Evidence |
|---|---|---|---|---|---|---|---|
| O1 | Danh mục "cột tiền" + "tài liệu tiền" | Duyệt mặc định 03-data-classification.md §A; 2 field % + 4 nhóm document mơ hồ | Owner | **APPROVED** | Owner | 2026-08-25 | `PR-WORKSTATION-CODEX-G0-CLOSE-CONTRACT.md` C0.1.1 — "tôi duyệt 4 mặc định C0.1 như bạn đề xuất nhé". Quyết định cuối (theo yêu cầu Codex C0.1, khác cách ghi cũ): nhóm mật cũ (`contact/private/social/finance/iddoc/org_fee`), 2 field `%` thương mại, và 4 nhóm tài liệu mơ hồ **bắt đầu ở `audience_visibility=private`** — đây là **mặc định hiển thị (audience)**, KHÔNG phải quyền hạ `classification_tier` bất biến của field đó (finance/iddoc vẫn trần `Restricted`, org_fee/% vẫn trần `Confidential` — xem D13.2a). Admin chỉ nới `audience_visibility` trong giới hạn trần tier, không nới được vượt trần qua UI thường. |
| O2 | 1 `org_fee` hay tách view/edit | ~~1 `org_fee` + module action~~ | Owner | **SUPERSEDED bởi D13** | Owner | 2026-08-24 | Không còn 1 quyền `org_fee` riêng — tiền chỉ là 1 loại field trong cơ chế `field_visibility` chung ở D13.2, không cần quyết riêng nữa. |
| O3 | Contract auth MISA AMIS | Cần AMIS cung cấp: nguồn principal/session, issuer/audience, verify method, TTL, refresh/revoke, tenant claims, deep-link lifecycle | **DevOps MISA** (owner chuyển giao 2026-08-24) | **DEFERRED TO DEVOPS** | DevOps MISA | 2026-08-24 | "O3 để cho devops làm nhé. Đó là việc của họ." + làm rõ kiến trúc AMIS Mobile = **cầu nối WebView** (xem D15) — không phải native app riêng, nên bài toán auth là "host truyền session/token vào web app", DevOps + team AMIS Mobile định nghĩa bridge contract. |
| O4 | Durable web session store | **Bảng Cloud SQL** (async pool riêng, không qua Atomics adapter) nếu đội đang vận hành Cloud SQL; Redis chỉ khi SLO/multi-service cần | **DevOps MISA** (owner chuyển giao) | **DEFERRED TO DEVOPS** | — | 2026-08-24 | "devops sẽ tự quyết định việc đó" — owner không tự chốt, giao lại cho DevOps khi cấu hình hạ tầng production thật. Khuyến nghị (bảng Cloud SQL) vẫn giữ làm đề xuất kỹ thuật gửi kèm cho DevOps tham khảo, không phải quyết định đã chốt. |
| O5 | SLO + peak concurrency native | read p95 <500ms, write p95 <800ms, event-loop lag p99 <100ms, error <1% @ 10 concurrent DB-req/instance | **DevOps MISA** (owner chuyển giao) | **DEFERRED TO DEVOPS** | — | 2026-08-24 | "cũng tương tự O4" — giao DevOps quyết số liệu SLO/cấu hình thật. Owner cho biết cấu hình **hiện tại** (môi trường test, không phải cam kết production): **2 vCPU / 4GB RAM** — chỉ để tham khảo mức hiện có, KHÔNG phải ngân sách production đã duyệt. |
| O6 | Ngân sách Gemini smoke/golden eval | Corpus 60-100 ca tổng hợp (không dữ liệu thật); candidate × ≥3 repeat; **ngân sách cứng $200** | Owner | **APPROVED — ĐÃ DÙNG** | Owner | 2026-08-24 | "O6: Ngân sách test AI: 200$ nhé" — hội thoại chat 2026-08-24. **2026-08-30 (W2.6, Claude):** đã chạy 360 call thật (`gemini-3.5-flash` vs `gemini-3.7-flash`), chi phí thật $4.456/$200, kết luận GIỮ PIN — xem `04-ROADMAP.md` W2.6 execution update. |
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

### D14.4 — Secure proposal/confirmation contract (mới, theo Codex round-3 re-audit R3-08 — bắt buộc trước khi triển khai Wave 3 voice)
D14.2 chốt human-in-the-loop đúng hướng, nhưng "AI chuẩn bị, người dùng xác nhận 1 lần" **chưa đủ an toàn nếu chỉ mô tả ở mức ý tưởng** — Codex chỉ ra 3 lỗ hổng cụ thể nếu bước xác nhận không có hợp đồng kỹ thuật rõ:
1. **Tampering**: nếu client tự giữ payload đề xuất giữa lúc AI chuẩn bị và lúc xác nhận, client có thể sửa payload trước khi gửi xác nhận (vd đổi entity, đổi mức tăng `relationship_score`) mà server không biết đã bị đổi so với cái AI thực sự đề xuất.
2. **Replay/reuse across user**: nếu "proposal" chỉ là dữ liệu thô không có định danh + hạn dùng, có thể bị gửi lại nhiều lần (tạo trùng interaction) hoặc bị 1 user khác dùng lại nếu vô tình lộ.
3. **TOCTOU (time-of-check-to-time-of-use)**: quyền hạn hoặc trạng thái sở hữu bản ghi (`owner_id`) có thể đổi giữa lúc AI chuẩn bị và lúc người dùng xác nhận (vd Admin vừa chuyển owner cho người khác) — nếu server không kiểm tra lại tại thời điểm xác nhận, có thể ghi đè quyền đã đổi.

**Thiết kế bắt buộc (Wave 3, trước khi cho phép ghi thật):**
- Server tạo 1 **"proposal" opaque, có định danh riêng, gắn với đúng 1 principal, có hạn dùng (expiry ngắn)** — chứa command đã chuẩn hoá (entity đã match, nội dung bản ghi định tạo, mức đề xuất đổi `relationship_score`) + snapshot trạng thái/`revision` của bản ghi liên quan tại thời điểm chuẩn bị.
- Bước xác nhận của người dùng **chỉ gửi lại `proposal_id` + phần chỉnh sửa tường minh của người dùng (nếu có) + 1 idempotency key** — không gửi lại toàn bộ payload để client tự do sửa.
- Khi xác nhận: server **đọc lại bản ghi hiện tại**, kiểm tra optimistic concurrency (so `revision` lúc chuẩn bị với hiện tại — nếu khác, từ chối và yêu cầu chuẩn bị lại), **chạy lại `PolicyEngine`/`authorization`** (không tin quyền đã kiểm tra lúc chuẩn bị vẫn còn đúng), rồi mới ghi 1 lần + audit đầy đủ trước/sau.
- Idempotency key chống việc bấm xác nhận 2 lần tạo 2 bản ghi trùng.
- Quy tắc cụ thể AI đề xuất mức đổi `relationship_score` bao nhiêu vẫn là việc BA định nghĩa (D14.3) — không chặn thiết kế secure-command ở trên.

## F. D15 — Kiến trúc host AMIS Mobile = cầu nối WebView (owner làm rõ 2026-08-24)

> Owner: *"phần trên AMIS Mobile, nó chỉ là cầu nối trung gian thôi. Thay vì phải build riêng bộ cài cho từng app thì mỗi app sẽ có icon trên AMIS Mobile. Khi người dùng bấm vào thì nó giống như 1 web app, chạy với native app UI."* (kèm ảnh chụp launcher AMIS Mobile: Chấm công, Phòng họp, Mail, Công việc, OneAI, CRM, WeSign, MCP Monitor, MISA Ticket, Partner Manager…).

**Đây là làm rõ có tác động lớn tới cách hiểu target `AMIS-native-host` và toàn bộ khối "native" trong roadmap:**
- AMIS Mobile **KHÔNG phải** nơi ta build 1 app native (Swift/Kotlin) riêng. Nó là **host launcher + WebView**: mỗi app (kể cả PR Workstation) xuất hiện dưới dạng 1 icon; bấm vào → mở **web app của chính app đó** bên trong khung native (WebView + chrome native của host).
- **Sửa lại cách diễn đạt (Codex round-3 re-audit, R3-05 — bản trước dùng chữ "mobile-first responsive" dễ hiểu lầm thành "responsive CSS của trang desktop"):** đúng nghĩa là **công nghệ web chạy trong WebView của AMIS, NHƯNG vẫn phải có 1 composition trình bày Native-Mobile RIÊNG BIỆT**, được chọn tường minh theo host/surface capability — **KHÔNG phải re-render cây trang desktop rồi "co giãn" bằng CSS responsive**. MDS cấm rõ cách làm "desktop rồi responsive" cho mobile (`ui-compliance-gate.md:19-27,38-69`). "Native composition" ở đây = **1 cây UI/luồng trình bày khác cho mobile** (không phải cùng 1 component desktop chỉnh CSS), chạy bên trong WebView + tích hợp bridge (session/mic/camera/file/deep-link) — khác build native code (Swift/Kotlin) ở chỗ NGÔN NGỮ/runtime vẫn là web, nhưng **không khác build native ở chỗ vẫn cần 1 bộ trình bày mobile riêng**.
- **Không giảm severity F5** (Codex round-3 quyết định rõ, R3-05): D15 chỉ giảm **độ phức tạp/khối lượng triển khai** (không cần đồng bộ 2 codebase Swift/Kotlin song song) — **không** giảm mức độ nghiêm trọng P0 hiện tại của F5 (mobile native chưa tồn tại). `app.js` hiện chỉ có 1 media query ẩn sidebar (responsive desktop, không phải composition riêng) — vẫn KHÔNG đạt yêu cầu MDS cho tới khi có 1 composition Native-Mobile thật trong WebView.
- **Auth (O3)**: host truyền session/token vào web app qua bridge — đây chính là nội dung O3, giờ giao DevOps + team AMIS Mobile định nghĩa. Seam `resolvePrincipal(req)→req.principal` (D6) vẫn đúng: web provider hiện tại + AMIS-host provider (đọc token do host bơm vào) là 2 adapter cùng contract. **Cơ chế bơm token cụ thể (bearer token, cookie, one-time code exchange, SDK assertion...) là `UNVERIFIED`** — không được trình bày như đã xác nhận ở bất kỳ đâu trong roadmap (sửa `04-ROADMAP.md` W4.1, xem C0.7) cho tới khi có bridge contract thật từ DevOps/AMIS.
- **Bridge security contract (mới, theo C0.7) — cần có trước khi tích hợp bridge thật, không phải "làm sau nếu có thời gian":** origin allowlist (chỉ chấp nhận message từ đúng origin host AMIS); versioned message schema (không parse message bridge tuỳ ý theo shape đoán được); token audience/TTL/chống replay; **không lưu token trong query string hay `localStorage`**; timeout fail-closed (không coi im lặng = đã xác thực); hành vi lifecycle/Back/deep-link/file/camera/mic/notification qua bridge phải có contract test riêng trước khi coi là "hoạt động".
- **Tác động roadmap**: W2.5 (host-adapter interface + fake providers) và Wave 3/4 "native composition" vẫn cần, nhưng hiểu đúng là **web-in-WebView + 1 composition Native-Mobile riêng + bridge integration**, không phải build native code riêng. W4 device-test vẫn cần (test thật trong WebView host trên thiết bị: safe-area, back, mic permission, deep-link) nhưng không có "native shell code" riêng để test.
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
| N1 | 4 route dùng perm `view` cho action có side-effect ghi (`/notifications/:id/read`, `/notifications/read-all`, `/reminders/run`, `/monitor/alerts/:id/read`) | **RESOLVED (owner APPROVED 2026-08-25, C0.1.3)** | Owner | Route gây side-effect **phải dùng action tường minh** (vd `ack` cho đánh dấu đã đọc, `run` cho chạy tay reminder) thay vì tái dùng `view` — sửa `rbac.js` là việc Wave 1 (đổi mã hành vi), Gate 0 chỉ ghi nhận mục tiêu đích; hành vi hiện tại (dùng `view`) vẫn giữ nguyên trong tài liệu characterization tới khi Wave 1 sửa. Evidence: `PR-WORKSTATION-CODEX-G0-CLOSE-CONTRACT.md` C0.1.3. |
| N2 | `GET /dashboard` không có `requirePerm` module cụ thể — mọi role đăng nhập xem được | **RESOLVED (owner APPROVED 2026-08-25, C0.1.4)** | Owner | **Chủ ý, không phải thiếu sót — nhưng phải tường minh**: dashboard dùng permission riêng `dashboard:view`, cấp cho **mọi role được phép xem dashboard** (không dựa vào "đăng nhập là đủ" như 1 policy module ngầm định). Sửa `rbac.js` thêm `dashboard:view` + gate route là việc Wave 1. Evidence: `PR-WORKSTATION-CODEX-G0-CLOSE-CONTRACT.md` C0.1.4. |
| N3 | `uploadAudio` (dùng cho `/ai/award-extract`) không có `fileFilter` — chấp nhận MIME tùy ý tới 25MB, lưu RAM | **RESOLVED bằng source evidence** | — | Đã xác nhận trực tiếp qua `server/uploads.js:39-43` — không cần owner, đã đưa vào `06-threat-model.md` §D và cần fix ở Wave 1 (upload security, không chờ owner quyết) |

## G. Ngoại lệ thứ tự phạm vi hẹp — Wave 1 foundation/pilot fail-closed được phép chạy trước khi G1B/G1C/G1.8 đóng (owner, 2026-08-28)

> **Bối cảnh:** `04-ROADMAP.md` Exit gate G1 (mục a-e) và execution update 2026-08-27 nói rõ
> *"Không chuyển sang Wave 1 implementation chỉ vì test characterization đã xanh"*. Nhưng commit
> history cho thấy các việc Wave 1 (`W1.RBAC.0` preflight, `W1.1` principal seam, RBAC
> classification registry, `W1.POLICY` service choke point) và pilot Wave 3 đầu tiên ("D13 People
> Detail read pilot" — chuyển `GET /api/people/:id` sang PolicyEngine) đã lên trước khi G1B.1/.2/.3/
> .5/.6, G1C.1, G1.8 đóng. Được hỏi lại trực tiếp trong phiên 2026-08-28 để xác nhận đây có phải
> chủ ý hay lỗi trình tự.

> **Owner quyết (2026-08-28, qua hội thoại chat, câu trả lời trực tiếp):** *"Owner cho phép triển
> khai trước các foundation/pilot fail-closed của Wave 1 để rút ngắn tiến độ, nhưng không cho phép
> bỏ exit gate. Không cutover role, không bật RBAC v2 toàn hệ thống, không chuyển production trước
> khi G1B/G1C/G1.8 đóng. [...] Claude có thể tiếp tục People pilot, PolicyEngine, test dual-driver;
> nhưng không được tuyên bố Wave 1/Gate 1 hoàn tất hay mở rộng quyền runtime hàng loạt."*

**Phạm vi được phép (trong khi G1B/G1C/G1.8 còn mở):**
- Foundation fail-closed: preflight read-only (`W1.RBAC.0`), seam (`W1.1` principal), registry dữ
  liệu phân loại, `W1.POLICY` service choke point — miễn KHÔNG đổi hành vi authorization cho route
  chưa pilot.
- ĐÚNG 1 pilot slice runtime tại một thời điểm (hiện là People Detail, `GET /api/people/:id`) — có
  test dual-driver (SQLite+MySQL) đi kèm mỗi thay đổi, nhánh 2-role legacy giữ nguyên song song
  (không big-bang).

**Phạm vi CẤM cho tới khi G1B/G1C/G1.8 đóng đúng Exit gate G1:**
- Cutover role hàng loạt (chuyển toàn bộ route/module sang RBAC v2 cùng lúc).
- Bật RBAC v2 làm đường mặc định cho mọi user/route (chỉ pilot slice đang chỉ định).
- Chuyển sang chạy trên môi trường production thật với RBAC v2.
- Tuyên bố Wave 1 hoặc Gate 1 "hoàn tất"/"CLOSE" — 2 việc này độc lập, không được gộp.

Mọi slice pilot mới (Partner Detail, Supplier/Booking/File, ...) ngoài People Detail phải hỏi lại
owner xác nhận nằm trong ngoại lệ này trước khi implement, không tự suy rộng phạm vi.

### G.1 — Amendment: owner CHỐT bỏ hoàn toàn 2-role, cutover thẳng sang 4 vai trò D13 (2026-08-30)

> **Ghi đè §G ở trên (2026-08-28) cho đúng phần "Phạm vi CẤM".** Owner xác nhận trực tiếp trong
> hội thoại chat 2026-08-30: *"2 vai trò cũ chỉ là demo trên bản code ban đầu, bạn loại bỏ hoàn
> toàn đi nhé. Chỉ thực hiện theo 4 vai trò mới."* — đây là quyết định MỚI, rộng hơn ngoại lệ §G
> (khi đó chỉ cho phép 1 pilot slice chạy song song 2-role, cấm cutover hàng loạt); §G áp dụng cho
> giai đoạn TRƯỚC quyết định này, không còn hiệu lực hạn chế "không cutover role"/"không bật RBAC v2
> làm đường mặc định" kể từ đây.

> **2 quyết định cụ thể kèm theo (hỏi trực tiếp, owner trả lời rõ trong cùng phiên):**
> 1. **Ánh xạ user thật:** `pr_staff` → `executor` là ánh xạ CỐ ĐỊNH, áp dụng cho MỌI user hiện có
>    role này (đã đổi tên thẳng trong `server/rbac.js` MATRIX, không phải 2 vai trò song song).
>    `super_admin`/`admin`/`viewer` KHÔNG có ánh xạ tự động 1-1 từ role cũ — owner tự quyết theo
>    cấp bậc thật của từng người khi gán role qua `POST/PUT /api/admin/users` (ví dụ owner đưa ra:
>    Ban Tổng Giám đốc → `viewer` — chỉ xem, không có nhu cầu sửa; trưởng nhóm truyền thông đối
>    ngoại → `admin`; trưởng ban truyền thông → `super_admin`). Không viết migration tự động gán
>    admin/viewer cho user hiện có — để nguyên role cũ (`super_admin` vẫn hợp lệ, là 1 trong 4 vai
>    trò mới) cho tới khi owner tự tay đổi.
> 2. **Dữ liệu nghiệp vụ cũ (owner_id đang NULL trên 13 bảng Direct):** owner xác nhận *"Dữ liệu cũ
>    chỉ là demo, bạn hoàn toàn có thể xoá được và ghi dữ liệu mới"* — KHÔNG cần backfill owner_id,
>    không cần giữ tương thích ngược cho dữ liệu demo hiện có.

> **Đã triển khai theo quyết định này (batch RBAC-CUTOVER, 2026-08-30):** `server/rbac.js` ROLES/
> MATRIX chuyển hẳn sang 4 khoá `viewer/executor/admin/super_admin` (không còn `pr_staff`); toàn bộ
> repo (code + test, ~67 chỗ) đổi `pr_staff`→`executor`; `server/routes.js` bỏ hẳn nhánh
> `TARGET_RBAC_ROLES`/dual-branch — mọi route đã gắn PolicyEngine (person + 6 entity Module-admin-
> only) nay chạy PolicyEngine KHÔNG ĐIỀU KIỆN cho cả 4 vai trò (kể cả `super_admin`, trước đây bị
> tách riêng vào nhánh "legacy"); route CHƯA gắn PolicyEngine tiếp tục dùng `requirePerm`/`rbac.can`
> — nay đã đúng cho cả 4 vai trò nhờ MATRIX mở rộng, không còn 403 sai cho `viewer`/`admin` (khoảng
> trống đã ghi nhận ở batch RBAC-EXP-B1). `isValidNewUserPayload`/`POST /api/admin/users` tự động
> chấp nhận đủ 4 role (đọc `rbac.ROLES`, không sửa thêm) — đóng khoảng trống "không có cách tạo user
> role D13 qua API thật" đã nêu ở batch trước. Chi tiết đầy đủ: `04-ROADMAP.md`/`15-changelog.md`
> execution update cùng ngày.

## C. Nguyên tắc completion (chống báo cáo ảo)
Không tuyên bố "đạt 100% MDS/native" khi còn thiếu: owner decision, contract native host, hoặc runtime evidence trên thiết bị/host thật. Unknown ghi `UNVERIFIED`.
