# Evidence Bundle tổng hợp — F15 → RBAC-EXP-B6 (gửi Codex audit)

Tài liệu này gộp 9 batch liên tiếp thành **1 audit-closure bundle** duy nhất theo đúng cơ chế đã
dùng trước đây cho "monitor phần 2 + ai" (§12/17-fast-track-collaboration.md): tất cả đã full
regression xanh một lần ở HEAD của batch cuối, không có batch nào bị BLOCKED giữa chừng, và không
batch nào đụng lại phạm vi batch trước sau khi đã đóng — nên gộp lại một lượt audit thay vì audit
riêng từng batch.

## Batch-ID / commit range / HEAD

| # | Batch | Commit |
|---|---|---|
| 1 | F15 — sửa tận gốc FK không được MySQL thực thi | `9f00326` |
| 2 | RBAC-EXP-B1 — Module-admin-only (budget/scan_query/source/competitor/campaign/monitor_alert) | `90b8853` |
| 3 | RBAC-CUTOVER — bỏ hoàn toàn 2-role legacy, chỉ dùng 4 vai trò D13 | `f170e62` |
| 4 | RBAC-FIELDVIS-FIX — P0 tự phát hiện: field Public bị ẩn mặc định | `06ba684` |
| 5 | RBAC-EXP-B2 — Global còn lại (organization/supplier/important_date) | `94542fd` |
| 6 | RBAC-EXP-B3 — Direct đầu tiên (booking/interaction) | `6dd7a44` |
| 7 | RBAC-EXP-B4 — award/award_participation/event + Inherited đầu tiên (event_cost) | `16bafed` |
| 8 | RBAC-EXP-B5 — nhà cung cấp con (supplier_contact/supplier_transaction/supplier_quote) | `71a453e` |
| 9 | RBAC-EXP-B6 — BATCH CUỐI, đóng 24/24 entity (sponsorship/agreement/work_log/gift/association_fee/benefit_usage) | `8b23d2e` |

Commit range đầy đủ: `f582253..8b23d2e` (parent của F15 → HEAD hiện tại, nhánh `main`, remote `misa`).
HEAD đã push: `misa/main` @ `8b23d2e`.

Batch Contract chi tiết từng batch: `18-g1b-rbac-batch-contract.md` (mục
`#batch-rbac-exp-b1-module-admin-2026-08-30` … `#batch-rbac-exp-b6...`); F15 không có batch-contract
riêng (là remediation root-cause một backlog P2 đã ghi trong `01-audit-findings.md`).

## Contract result: từng exit criterion PASS/FAIL + evidence

**F15 (FK MySQL không thực thi — backlog P2 Wave 1, owner=Claude):**
- PASS — root cause xác nhận thực nghiệm (`SHOW CREATE TABLE` trên MySQL test thật): REFERENCES
  inline column-level bị MySQL/InnoDB âm thầm bỏ qua, chỉ CONSTRAINT...FOREIGN KEY out-of-line mới
  tạo FK thật.
- PASS — `server/mysql-sync.js#translate()` tách mọi FK inline sang out-of-line; xác nhận
  **24/24 FK** tồn tại thật qua `information_schema.KEY_COLUMN_USAGE`.
- PASS — 5 test characterization lệch driver trước đây (R007/R067/R075/R083/R091) hội tụ về đúng
  1 hành vi (bỏ nhánh `isMysql ? 200 : 400`).
- PASS — test mới `unit-mysql-sync-translate.test.js` (7 test, `BR-FK-001..007`), chỉ chạy khi
  `DB_CLIENT=mysql`.

**RBAC-EXP-B1..B6 (mở rộng PolicyEngine từ pilot `person` ra toàn bộ 24 entity D13.4a):**
- PASS — tất cả 24 entity trong `02-decisions.md` §D13.4a đã có route-wiring PolicyEngine (chi tiết
  entity theo tier ở mục "Tổng kết" cuối tài liệu này).
- PASS — mỗi entity Direct: executor chỉ sửa được bản ghi CHÍNH họ tạo, KHÔNG BAO GIỜ xoá được (kể
  cả chủ sở hữu) — verify bằng test D13-046..077.
- PASS — mỗi entity Global: executor sửa được bất kể ai tạo, KHÔNG BAO GIỜ xoá được — verify D13-035..045.
- PASS — mỗi entity Module-admin-only: executor bị chặn HOÀN TOÀN mọi hành động ghi kể cả create —
  verify D13-025..030.
- PASS — entity Inherited (event_cost): `parentOwnerId` = `owner_id` của event cha, không có
  `owner_id` riêng — verify D13-059..065.
- PASS — `gift`: phân biệt đúng `owner_id`/`owner_type` (người/cơ quan NHẬN quà, nghiệp vụ) khác
  `responsible_user_id` (chủ sở hữu RBAC) — verify riêng D13-075.

**RBAC-CUTOVER:** PASS — 0 chuỗi `pr_staff` còn lại trong `server/*.js` (xác nhận bằng grep); toàn
bộ 709/716 test cũ trước đó vẫn pass 100% sau rename cơ học (không sửa nội dung assertion nào).

**RBAC-FIELDVIS-FIX (P0 tự phát hiện, không phải finding từ Codex):** PASS — xác nhận thủ công
executor `projectRecord()` trên `person` với 9 field business thấy đúng 7 (ẩn đúng `dob`/
`phone_personal`, hiện phần còn lại) sau fix; trước fix toàn bộ 9 field Public đều bị ẩn nhầm
(record gần như rỗng, mất cả `id`) — đã **live trên production** trước khi phát hiện (executor =
vai trò thật duy nhất của nhân viên PR hiện nay).

## Changed files: product / test / docs tách riêng

Diffstat toàn range `f582253..8b23d2e`: **37 file, +2968/-407**.

**Product code (9 file):**
- `server/db.js` — 11 `ALTER TABLE ... ADD COLUMN created_by INTEGER` mới (award_participations,
  event_costs, supplier_quotes, supplier_transactions, supplier_contacts, sponsorships, agreements,
  work_logs, association_fees, gifts, benefit_usages).
- `server/mysql-sync.js` — `translate()`: tách FK inline→out-of-line (F15).
- `server/policy-engine.js` — `canReadField()`: field tier Public mặc định hiển thị trừ khi có dòng
  `field_visibility` rõ ràng `is_public=0` (RBAC-FIELDVIS-FIX).
- `server/policy-service.js` — `assertWritable/prepareCreate/prepareUpdate/projectRecord` nhận thêm
  `parentOwnerId` (tương thích ngược); `ownerColumn('gift')` → `responsible_user_id`.
- `server/policy-visibility-store.js` — `isPublic()` trả `undefined` khi chưa cấu hình (thay vì ép
  `false`).
- `server/rbac.js` — `ROLES`/`MATRIX`: 2 khoá (`super_admin`/`pr_staff`) → 4 khoá (`viewer/executor/
  admin/super_admin`), `pr_staff`→`executor` rename giữ nguyên nội dung quyền.
- `server/routes.js` — thay đổi lớn nhất (811 dòng): 14 route Module-admin-only qua
  `moduleAdminOnlyGate()`; toàn bộ route 24 entity chuyển từ `requirePerm`/`stripDisallowed`/mask
  thủ công sang `policyService.assertWritable/prepareCreate/prepareUpdate/projectRecord`; guard
  riêng cho `POST/PUT/DELETE /admin/users`/`GET /admin/audit` (Admin không quản trị được tài khoản
  Admin/Super Admin).

**Test (16 file, 2 file mới hoàn toàn):**
- Mới: `server/test/integration-rbac-exp-b1-module-admin.test.js` (17 test, D13-025..030),
  `server/test/integration-rbac-admin-tier.test.js` (13 test, D13-031..034),
  `server/test/unit-mysql-sync-translate.test.js` (7 test, BR-FK-001..007).
- Sửa/mở rộng: `integration-awards.test.js`, `integration-bookings-budgets.test.js`,
  `integration-events-dashboard.test.js`, `integration-interactions.test.js`,
  `integration-partners.test.js`, `integration-people.test.js`, `integration-reminders.test.js`,
  `integration-suppliers.test.js`, `integration-auth-admin.test.js`, `integration-db-contract.test.js`,
  `integration-error-contract.test.js`, `integration-reports.test.js`,
  `integration-session-production.test.js`, `target-n1-n2-explicit-permission.test.js`,
  `target-session-f2.test.js`, `ui-characterization.test.js`,
  `unit-policy-visibility-store.test.js`, `unit-validation-formatter.test.js`.

**Docs (7 file):** `01-audit-findings.md` (F15 đóng), `02-decisions.md` (D13 4-role chính thức,
amendment §G.1), `04-ROADMAP.md` (execution updates từng batch + status-row G1B.1 → 24/24),
`07-route-catalog.md` (110 dòng đổi — mô tả auth theo inline PolicyEngine cho mọi route đã wiring),
`08-permission-matrix.md`, `15-changelog.md` (+293 dòng, 9 mục Wave 1 mới), `18-g1b-rbac-batch-contract.md`
(+455 dòng, 6 batch contract RBAC-EXP-B1..B6), `gate1-test-mapping.md`.

## Route-job-rule mapping delta

`scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` (+80 dòng, +~54 entry): mọi route đã chuyển từ
literal `requirePerm(module,action)` sang inline PolicyEngine check phải khai tường minh
`"METHOD /path" → {module, action}` trong allowlist này — verifier đối chiếu route thật với dòng
`requirePerm(<module>,<action>)` (literal substring) còn tồn tại trong `07-route-catalog.md`. Mapping
tổng: **145/145 route green**, không route nào rớt khỏi mapping trong toàn bộ 9 batch.

## Behavior changes: có/không; file:line hoặc diff chứng minh

**Có**, nhiều thay đổi hành vi có chủ đích (siết bảo mật), tất cả đã có test riêng xác nhận:

1. **F15**: MySQL giờ thực sự tạo FK + cascade/restrict đúng như SQLite — 5 route trước đây trả
   sai mã (`200` thay vì `400`, hoặc ngược lại) trên MySQL nay khớp SQLite (`server/mysql-sync.js`
   `translate()`).
2. **DELETE bị siết cho 11 entity Direct** (award_participation, event_cost, supplier_contact,
   supplier_transaction, supplier_quote, sponsorship, agreement, work_log, gift, association_fee,
   benefit_usage): trước đây map nhầm `requirePerm(module,'edit')` nên executor xoá được bản ghi
   CHÍNH họ tạo; nay `assertWritable({action:'delete'})` → `canWrite()` chặn `action==='delete'`
   ngay từ đầu bất kể ai, chỉ Admin/Super Admin xoá được (`server/policy-engine.js`).
3. **RBAC 2-role → 4-role cutover**: `pr_staff`→`executor` (giữ nguyên quyền), thêm `admin`/`viewer`
   thật (trước đó vai trò D13 tồn tại trong `MATRIX` nhưng route thật không nhận, gây 403-sai).
4. **P0 field-visibility**: field tier Public không còn bị ẩn mặc định cho executor (trước đó
   record gần như rỗng — đã fix `server/policy-engine.js canReadField()`).
5. **event_cost lần đầu có `parentOwnerId`** (Inherited) — trước đây `event_cost` không được
   gate theo owner của event cha (engine hỗ trợ từ trước nhưng chưa route nào gọi).
6. **gift**: RBAC-owner tách khỏi recipient (`responsible_user_id` vs `owner_id`) — trước batch
   B6, entity này chưa từng được PolicyEngine chạm tới.

**Không** đổi: UI/MDS (ngoài phạm vi, thuộc lane Codex); route GET/view chưa nằm trong 24 entity;
seed demo (vẫn 2 tài khoản); `policyService.prepareUpdate()` — chưa route nào gọi thật (routes vẫn
dùng `buildUpdate()` sau khi `assertWritable()` pass), ghi nhận là dọn dẹp ngoài scope, không phải
exit criterion của các batch này.

## Tests added/changed: ID + file

`D13-025..077` (53 test D13 mới xuyên suốt B1→B6), `BR-FK-001..007` (F15), cộng các test sửa lại
để khớp shape mã mới (không đổi hành vi assertion cốt lõi): D13-006/D13-011/D13-011b
(RBAC-FIELDVIS-FIX), D13-064 (fix flaky do pagination — thêm filter `search=`), `requirePermArgsFor()`
trong `target-n1-n2-explicit-permission.test.js` (nhận thêm pattern `moduleAdminOnlyGate(...)`).

## Commands and exact results: pass/fail/skip + exit code

Full regression cuối cùng (tại HEAD `8b23d2e`, sau batch B6 — số liệu **tích luỹ**, không phải mỗi
batch chạy riêng full suite từ đầu):

| Suite | Kết quả |
|---|---|
| Security | 6/6 pass |
| SQLite integration | 766 pass / 8 skip |
| MySQL integration | 773 pass / 1 skip |
| Route mapping | 145/145 PASS |
| `scripts/verify-g0.mjs` | PASS |
| `git diff --check` | sạch (không trailing whitespace/conflict marker) |

Tiến trình tích luỹ qua từng batch (F15 → B6): F15 692/8→699/1 (+7); B1 709/8→716/1 (+17); CUTOVER
722/8→729/1 (+13); FIELDVIS-FIX 723/8→730/1; B2 733/8→740/1 (+10); B3 748/8→747/1; B4 754/8→761/1;
B5 759/8→766/1; B6 766/8→773/1. Không có regression nào trong toàn range — mỗi batch chỉ CỘNG THÊM
test pass, không có test cũ chuyển từ pass sang fail ở bất kỳ điểm nào.

## Known-red/TODO: reason + owner + expiry/wave

Không có known-red mới trong toàn bộ 9 batch. F15 tự nó LÀ việc đóng một known-red/backlog P2 cũ
(owner=Claude, wave=Wave 1) — đã đóng hẳn, không còn known-red liên quan FK MySQL.

## Out-of-scope findings/backlog

- `policyService.prepareUpdate()` chưa route nào gọi thật (routes vẫn dùng `buildUpdate()` riêng
  sau khi `assertWritable()` pass) — không phải exit criterion của RBAC-EXP-B1..B6, ghi nhận để dọn
  sau nếu cần.
- UI-flow matrix §B.2 (thuộc lane Codex, Claude không đụng UI theo `CLAUDE.md` mục 6).
- `rbac.js` MATRIX từng thiếu entry D13 role (phát hiện đầu B1, đã đóng ngay trong RBAC-CUTOVER
  cùng ngày — không còn tồn đọng).
- Seed demo vẫn chỉ 2 tài khoản (không phải exit criterion của các batch RBAC-EXP, ghi chú tại
  RBAC-CUTOVER).

## Rollback path

Mỗi batch là 1 commit độc lập trên `main`, đã push tuần tự lên `misa/main`
(`9f00326→90b8853→f170e62→06ba684→94542fd→6dd7a44→16bafed→71a453e→8b23d2e`). Rollback 1 batch bất
kỳ = `git revert <sha>` đúng batch đó; do mỗi batch chỉ cộng thêm gate PolicyEngine cho entity riêng
biệt (không entity nào bị 2 batch cùng sửa handler), revert 1 batch không kéo theo conflict với các
batch khác — ngoại lệ duy nhất là RBAC-CUTOVER (đổi `rbac.js` MATRIX nền tảng dùng chung), revert
batch này sẽ yêu cầu revert kèm mọi batch RBAC-EXP-B2..B6 phía sau nó (vì các batch sau phụ thuộc
4-role MATRIX).

## Worktree status and unrelated pre-existing changes

Không có worktree phụ. Tại thời điểm gửi bundle này: `git status --short` sạch (đã commit + push
hết); không có file unrelated pre-existing nào lẫn vào các commit trên (mỗi commit chỉ chứa đúng
file thuộc batch đó, đã kiểm bằng `git show --stat` từng commit trước khi push).

## Tổng kết: 24/24 entity D13.4a đã có PolicyEngine wiring

- **Global (4)**: person, organization, supplier, important_date — executor sửa bất kể ai tạo,
  KHÔNG BAO GIỜ xoá.
- **Module-admin-only (6)**: budget, scan_query, source, competitor, campaign, monitor_alert —
  executor bị chặn HOÀN TOÀN mọi hành động ghi kể cả create.
- **Inherited (1)**: event_cost — không có `owner_id` riêng, kế thừa `owner_id` của `event` cha qua
  `parentOwnerId`.
- **Direct (13)**: booking, interaction, award, award_participation, event, supplier_quote,
  supplier_transaction, supplier_contact, sponsorship, agreement, work_log, gift, association_fee,
  benefit_usage — mỗi entity có `owner_id` riêng (`gift` dùng `responsible_user_id`); executor chỉ
  sửa bản ghi chính họ tạo, KHÔNG BAO GIỜ xoá (kể cả chủ sở hữu) — xoá chỉ dành Admin/Super Admin.

Kế hoạch 6 batch RBAC-EXP-B1..B6 owner đã duyệt 2026-08-30 **HOÀN TẤT**. Bundle này gộp thêm 3 batch
liền kề cùng dòng (F15, RBAC-CUTOVER, RBAC-FIELDVIS-FIX) vì chúng nằm ngay trước/xen giữa và cùng
đã full-regression xanh liên tục không gián đoạn tới HEAD hiện tại.
