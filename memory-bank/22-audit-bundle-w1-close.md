# Evidence Bundle tổng hợp — đóng W1 (W1.POLICY.2 read+write, W1.FILE-P2, W1.ADMIN) — gửi Codex audit

> **KẾT QUẢ CUỐI CÙNG: W1 (backend/security) CLOSED — Codex ACCEPTED (2026-08-31).** Audit lần 1
> (trên bundle gốc dưới đây, commit range `2805020..70e5ed4`) trả **BLOCKED hẹp** với 1 finding P1
> tái hiện được: **F24** — 4 route upload file (award/event/agreement/work_log) chạy
> `assertWritable()` SAU khi Multer đã ghi file thật vào `UPLOAD_DIR`, deny vẫn để lại file mồ côi
> trên đĩa. Remediation batch `F24-remediation` (commit `0e0c2d6`/`707cc45`, xem mục "Remediation
> F24" cuối tài liệu) sửa đúng root cause (authorization chạy TRƯỚC Multer). Codex re-audit tập
> trung đúng finding này (không mở lại 4 batch gốc, theo `17-fast-track-collaboration.md` §8): xác
> nhận độc lập `requireFileWrite()` chạy trước Multer ở đủ 4 route (`routes.js:365,391,1333,1657`),
> chạy lại độc lập 8 test F24 trên cả 2 driver, G0 verifier/mapping/diff-check đều xanh — **ACCEPTED,
> không còn P0/P1**. UI Native-MDS cho `W1.ADMIN` vẫn là lane UI riêng (chưa giao lại Claude), không
> ảnh hưởng kết luận đóng phần backend/security. Nội dung bundle gốc bên dưới **giữ nguyên không
> sửa** (đúng nguyên tắc audit trail); phần fix + kết quả re-audit ghi ở mục "Remediation F24" cuối.
>
> Bundle này gộp 4 batch liên tiếp thành 1 audit-closure bundle theo đúng cơ chế §12/§14
> `17-fast-track-collaboration.md` (điều kiện: không batch nào BLOCKED giữa chừng, không batch nào
> đụng lại phạm vi batch trước sau khi đóng, full regression xanh một lần ở HEAD batch cuối). Đây là
> bundle audit **kế tiếp** sau `21-audit-bundle-f15-rbac-exp-b1-b6.md` (Codex ACCEPTED WITH BACKLOG
> 2026-08-31, backlog P2/P3 chính là 4 batch trong bundle này: `W1.FILE` P2/P3, `W1.POLICY.2` phần
> còn lại, `W1.ADMIN`).
>
> **W1 (nhánh RBAC v2 D13 + nhánh security F1-F4/F8/F9/F11) nay CHÍNH THỨC CLOSED phía backend** —
> xem `04-ROADMAP.md` execution update cuối cùng cho tuyên bố đầy đủ. Chuyển ưu tiên sang Wave 2.

## Batch-ID / commit range / HEAD

| # | Batch | Commit | Batch Contract |
|---|---|---|---|
| 1 | W1.POLICY.2 (read-side) — dọn choke point mask read cho list route + CI guard | `4967d22` | `18-g1b-rbac-batch-contract.md#batch-w1policy2-2026-08-31` |
| 2 | W1.FILE-P2 — gate upload attachment theo owner_id cho entity Direct | `5ada777` | `18-g1b-rbac-batch-contract.md#batch-w1file-p2-2026-08-31` |
| 3 | W1.POLICY.2-write-side — đóng phần WRITE còn lại (F23, tự phát hiện) | `a094f19` | `18-g1b-rbac-batch-contract.md#batch-w1policy2-write-side-2026-08-31` |
| 4 | W1.ADMIN — field-visibility API + gán lại owner API (batch cuối của W1) | `70e5ed4` | `18-g1b-rbac-batch-contract.md#batch-w1admin-2026-08-31` |

Commit range đầy đủ: `2805020..70e5ed4` (parent = commit đóng bundle audit trước, nhánh `main`,
remote `misa`). HEAD đã push: `misa/main` @ `70e5ed4`. Diffstat toàn range: **23 file, +1036/-119**.

## Contract result: từng exit criterion PASS/FAIL + evidence

**W1.POLICY.2 (read-side):**
- PASS — `projectRecord()` nay là choke point duy nhất cho MỌI route GET (kể cả list + collection
  lồng); xác nhận bằng CI guard mới `scripts/verify-g0.mjs#verifyNoLegacyMasking()` — 0 lời gọi
  `rbac.maskList/maskRecord/maskMoney/senGroups/senVisible/canMoney` còn lại trong `routes.js`.
- PASS — đã thử nghiệm revert tạm 1 lời gọi legacy mask để xác nhận verifier bắt được lỗi trước khi
  coi guard là đủ.
- PASS — 4 test mới D13-081..084 (GET /partners, /partners/:id nested people, /people, /suppliers):
  field Public hiển thị đúng cho viewer, field Confidential/Restricted vẫn ẩn; admin thấy đủ.
- PASS — D13-085 (GET /budgets): viewer có `reports:view` vẫn KHÔNG thấy `amount` (Confidential).

**W1.FILE-P2:**
- PASS — `govFileUpload(entity, table)` (refactor từ `govFileUpload(ownerType)`) gate upload theo
  `owner_id` giống PUT/DELETE của chính entity — áp dụng cho award/event/agreement/work_log.
- PASS — supplier upload GIỮ NGUYÊN role-gate (không đổi) vì `supplier` là Global entity, đúng thiết
  kế D13.4a (không có khái niệm owner riêng cho Global).
- PASS — 4 test mới D13-086..089: executor upload vào award/event/agreement/work_log KHÔNG phải của
  mình → 403 (trước đây 200); vào bản ghi chính mình → 200; admin luôn 200 bất kể ai tạo.
- PASS — P3 (attachment metadata chưa lọc theo visibility) xác định WON'T-FIX, đúng thiết kế D13
  "existence vs content" — xem `01-audit-findings.md` §F21, không phải bug.

**W1.POLICY.2 (write-side, F23 tự phát hiện):**
- PASS — audit độc lập (agent) quét toàn bộ route ghi (POST/PUT/DELETE) trong `routes.js`, đối
  chiếu module khai ở `requirePerm()` với bảng thực sự bị ghi — xác nhận KHÔNG còn write-bypass nào
  khác ngoài 3 route dưới đây (10 nhóm bypass gốc F1 đã đóng hết qua RBAC-EXP-B1..B6 trong bundle
  trước).
- PASS — phát hiện **F23** (P2, tự phát hiện, không phải finding Codex): `POST
  /partners/:id/fees/:fid/remind` (R028), `POST /awards/:id/remind` (R071), `POST
  /events/:id/remind` (R096) đều `INSERT INTO important_dates` nhưng gate theo
  `requirePerm(<module cha>,'view')` thay vì `requirePerm('reminders','create')` đúng như route
  chính thống `POST /reminders` (R040). Rủi ro thật: `viewer` có `<module cha>:view` nhưng KHÔNG có
  `reminders:create` (theo MATRIX) — tạo được `important_dates` qua lối tắt này, sai ranh giới
  quyền. Đã sửa cả 3 route; không ảnh hưởng executor/admin/super_admin (đã có sẵn
  `reminders:create`).
- PASS — CI guard mới `scripts/verify-g0.mjs#verifyImportantDatesGate()`: quét mọi route có thân
  hàm chứa `INSERT INTO important_dates`, bắt buộc đăng ký `requirePerm('reminders',*)` — phạm vi
  hẹp có chủ đích (1 bảng), đã thử nghiệm revert tạm 1 route để xác nhận verifier bắt được lỗi.
- PASS — 3 test mới D13-090..092 (partners/awards/events): viewer trả 403 (trước đây 200), executor
  vẫn 200 (không regression).
- **Quyết định KHÔNG làm (ghi rõ):** không xây wrapper `authorizedInsert/Update` tổng quát (mô tả
  gốc roadmap `W1.POLICY.2`) — audit độc lập xác nhận KHÔNG còn write-bypass nào khác; xây thêm 1
  lớp wrapper thuần kiến trúc không có bug cụ thể thúc đẩy là premature abstraction — xem
  `01-audit-findings.md` §F23.

**W1.ADMIN (batch cuối của W1):**
- PASS — `GET`/`PUT /api/admin/field-visibility` expose `policy-visibility-store.js` (có sẵn từ
  trước, CHƯA từng gọi được qua HTTP) qua route thật, `requirePerm(admin,view/edit)`.
- PASS — D13.2b "chỉ siết không nới" enforce đúng: `PUT` trả 400 `FORBIDDEN_TIER` khi cố bật
  `is_public=true` cho field không phải Public-tier (vd `bank_name`, Restricted) — không thể nới
  field Confidential/Restricted lên public qua API cấu hình.
- PASS — `PUT /api/admin/records/:entity/:id/owner` gán lại owner cho 14 entity Direct qua
  `REASSIGNABLE_OWNER_TABLE` (allowlist cố định, fail-closed 400 nếu entity lạ), validate
  `owner_id` là user active (400 nếu không), 404 nếu record không tồn tại, đi qua
  `policyService.prepareUpdate()` làm defense-in-depth.
- **Phát hiện đáng chú ý:** `policyService.prepareUpdate()`'s `OWNER_TRANSFER_ADMIN_ONLY` đã tồn
  tại từ các batch RBAC-EXP trước, nhưng KHÔNG route nào từng lọt field owner qua `pick()`
  allowlist — logic hoàn toàn không thể gọi tới trong thực tế cho đến route mới này (không phải lỗ
  hổng bảo mật vì không có gì khai thác được đường không thể gọi tới, nhưng là năng lực còn thiếu
  thật sự).
- PASS — role management (mục con thứ 3 của `W1.ADMIN`): xác nhận `PUT /admin/users/:id` đã có sẵn
  D13.1 escalation protection (Admin không sửa được tài khoản Admin-trở-lên, chỉ Super Admin) —
  không cần code thêm.
- PASS — 15 test mới R146/R147/R148 (`integration-auth-admin.test.js`), cả SQLite lẫn MySQL driver.
- PASS — hệ thống tài liệu tự-verify cập nhật đồng bộ (lần đầu tiên session này thêm route MỚI thay
  vì chỉ re-gate route có sẵn): `07-route-catalog.md` (145→148), `08-permission-matrix.md` (Section
  A 145→148, Section B +flow F035 + token mới `D-MISSING`, 34→35 flow), `scripts/verify-g0.mjs` +
  `scripts/verify-gate1-mapping.mjs` (145/34→148/35) + `gate1-test-mapping.md`,
  `ui-characterization.test.js` (34/145→35/148), `16-coding-rules.md`/`README.md`.

## Changed files: product / test / docs tách riêng

**Product code (2 file):**
- `server/routes.js` (+179/-~38 dòng qua 4 commit) — 3 route mới W1.ADMIN
  (`GET`/`PUT /admin/field-visibility`, `PUT /admin/records/:entity/:id/owner` +
  `REASSIGNABLE_OWNER_TABLE`); 3 route sửa gate quyền F23 (partners/awards/events remind); refactor
  `govFileUpload(ownerType)` → `govFileUpload(entity, table)` cho award/event/agreement/work_log;
  dọn hết lời gọi legacy `rbac.maskList/maskRecord/maskMoney/senGroups/senVisible/canMoney` trong
  các route GET, thay bằng `projectRecord()`.
- `server/policy-visibility-store.js` (1 dòng) — export thêm `assertAllowed`, `ALLOWED_FIELDS` để
  `routes.js` dùng được (trước đó chỉ export `createVisibilityStore`).

**Test (9 file, 0 file mới hoàn toàn — chỉ mở rộng file có sẵn):**
- `integration-auth-admin.test.js` (+173 dòng): 15 test R146/R147/R148.
- `integration-partners.test.js` (+66/-2): D13-081, D13-082, D13-090.
- `integration-people.test.js` (+19): D13-083.
- `integration-suppliers.test.js` (+19): D13-084.
- `integration-bookings-budgets.test.js` (+16): D13-085.
- `integration-events-dashboard.test.js` (+18): D13-086, D13-092.
- `integration-awards.test.js` (+13): D13-089, D13-091.
- `ui-characterization.test.js` (+8/-8): assertion đếm lại 34/145→35/148 (khớp route/flow mới).
- `unit-validation-formatter.test.js` (-26): xoá BR-VAL-018 (`senGroups`/`senVisible`) và BR-VAL-019
  (`canMoney`/`maskMoney`) — các hàm này không còn lời gọi thật nào trong `routes.js` sau
  `verifyNoLegacyMasking()`, characterization test cho hàm chết bị xoá thay vì giữ xanh giả.
- Test cho D13-087 (agreement)/D13-088 (work_log) nằm trong 2 file trên (xem diff, không tạo file
  mới).

**CI verifier scripts (2 file):**
- `scripts/verify-g0.mjs` (+60/-~10): thêm `verifyNoLegacyMasking()`, `verifyImportantDatesGate()`;
  cập nhật 8 hằng số 145/34 → 148/35 (route catalog, Section A, UI-flow matrix).
- `scripts/verify-gate1-mapping.mjs` (+6/-2): 2 hằng số 145 → 148.

**Docs (10 file):** `01-audit-findings.md` (F23 mới), `04-ROADMAP.md` (+92 dòng — 4 execution
update + tuyên bố W1 đóng), `07-route-catalog.md` (R028/R071/R096 sửa module reminders; +R146/
R147/R148), `08-permission-matrix.md` (Section A đếm lại theo 4 module liên quan F23 + admin 5→8;
Section B +F035 + token `D-MISSING`), `15-changelog.md` (+157 dòng, 4 mục Wave 1 mới),
`16-coding-rules.md` (139/145→142/148 route có `requirePerm`), `18-g1b-rbac-batch-contract.md`
(+215 dòng, 4 batch contract), `20-ui-characterization.md` (34→35 flow, F035 note),
`README.md` (145→148 endpoint + route catalog/matrix mô tả), `gate1-test-mapping.md` (+3 dòng
R146/R147/R148).

## Route-job-rule mapping delta

- 3 route đổi module trong `07-route-catalog.md`/`08-permission-matrix.md` Section A: R028/R071/
  R096 chuyển từ partners/awards/events sang reminders (F23) — đếm lại: partners 41→40, awards
  12→11, events 11→10, reminders 12→15, tổng vẫn 145 (chưa đổi tổng ở batch này).
- 3 route MỚI thêm (W1.ADMIN, lần đầu tiên session này thêm route thay vì re-gate): R146 (`GET
  /admin/field-visibility`), R147 (`PUT /admin/field-visibility`), R148 (`PUT
  /admin/records/:entity/:id/owner`) — tổng 145→148. Section A admin module 5→8 route. Section B
  +1 flow (F035, token `D-MISSING` — route backend/API chưa có UI, khác `D-403`) — 34→35 flow.
- Mapping tổng cuối cùng: **148/148 route green** (`scripts/verify-gate1-mapping.mjs`), không route
  nào rớt khỏi mapping trong toàn bộ 4 batch.

## Behavior changes: có/không; file:line hoặc diff chứng minh

**Có**, các thay đổi hành vi có chủ đích (siết bảo mật hoặc thêm năng lực mới), đều có test riêng:

1. **Read masking hợp nhất** (`server/routes.js`, các route GET partners/people/suppliers/budgets):
   trước đây dùng 3 cơ chế mask song song (`rbac.maskList`, `maskMoney`, kiểm tra thủ công theo
   `sensitive_perms`) — nay 100% qua `projectRecord()`. Hành vi cuối cho client KHÔNG đổi (field
   Public vẫn hiện, Confidential/Restricted vẫn ẩn đúng như trước) — đây là thay THẾ choke point,
   không phải thay đổi kết quả; test D13-081..085 xác nhận không regression.
2. **Upload attachment gate theo owner** (award/event/agreement/work_log): executor upload vào bản
   ghi KHÔNG phải của mình trước đây trả `200` (chỉ role-gate, không owner-gate) — nay trả `403`.
   Executor upload vào bản ghi CHÍNH mình vẫn `200`. Admin không đổi (luôn `200`).
3. **F23 remind-route gate siết cho viewer**: `viewer` trước đây tạo được `important_dates` qua 3
   route remind (partners fee/award/event) vì gate nhầm theo `<module>:view` — nay trả `403` (đúng
   `reminders:create`). Executor/admin/super_admin không đổi.
4. **W1.ADMIN — 3 route hoàn toàn MỚI**: không có hành vi "trước/sau" vì route chưa từng tồn tại;
   chỉ admin/super_admin gọi tới được (`requirePerm(admin,*)` + `prepareUpdate()` defense-in-depth).

**Không** đổi: UI/MDS (ngoài phạm vi, lane Codex); seed demo; các route GET/view chưa nằm trong
phạm vi 4 batch này; `assertWritable`/`prepareCreate` cho 24 entity D13.4a (đã đóng ở bundle trước,
không chạm lại).

## Tests added/changed: ID + file

- **D13-081..092** (12 test mới, xem breakdown ở "Changed files" trên) — read masking (081-085),
  upload owner-gate (086-089), F23 remind-gate (090-092).
- **R146/R147/R148** (15 test mới, `integration-auth-admin.test.js`) — happy/invalid/not-found/
  unauthenticated/forbidden cho 3 route W1.ADMIN.
- **Xoá 2 test cho hàm chết**: BR-VAL-018, BR-VAL-019 (`unit-validation-formatter.test.js`) — không
  còn lời gọi thật nào tới `senGroups/senVisible/canMoney/maskMoney` sau khi
  `verifyNoLegacyMasking()` xác nhận 0 call site trong `routes.js`.
- **Sửa đếm lại** (không đổi assertion cốt lõi): `ui-characterization.test.js` UI-CHAR-003
  (34/145→35/148).

## Commands and exact results: pass/fail/skip + exit code

Full regression cuối cùng (tại HEAD `70e5ed4`, sau batch W1.ADMIN — số liệu **tích luỹ** toàn range
4 batch, không phải mỗi batch chạy riêng full suite từ đầu):

| Suite | Kết quả |
|---|---|
| Security | 6/6 pass |
| SQLite integration | 803 pass / 8 skip (0 fail) |
| MySQL integration | 802 pass / 1 skip (0 fail) |
| Route mapping (`verify-gate1-mapping.mjs`) | 148/148 PASS |
| `scripts/verify-g0.mjs` | PASS toàn bộ 9 check (bao gồm 2 check mới: `verifyNoLegacyMasking`, `verifyImportantDatesGate`) |
| `verify-g0-selftest` | 6/6 pass |
| `git diff --check` | sạch (không trailing whitespace/conflict marker) |

Tiến trình tích luỹ qua từng batch (từ HEAD `2805020` của bundle trước, mapping vẫn 145/145 cho 3
batch đầu, chỉ đổi 148/148 ở batch cuối):
- W1.POLICY.2 read-side (`4967d22`): SQLite 781 total/773 pass/8 skip, MySQL 781 total/780 pass/1
  skip.
- W1.FILE-P2 (`5ada777`): SQLite 785 total/777 pass/8 skip, MySQL 785 total/784 pass/1 skip (+4 mỗi
  driver, D13-086..089).
- W1.POLICY.2-write-side (`a094f19`): SQLite 788 total/780 pass/8 skip, MySQL 788 total/787 pass/1
  skip (+3 mỗi driver, D13-090..092).
- W1.ADMIN (`70e5ed4`): SQLite 803 total/795 pass/8 skip, MySQL 803 total/802 pass/1 skip (+15 mỗi
  driver, R146/R147/R148; mapping 145→148).

Không có regression nào trong toàn range — mỗi batch chỉ CỘNG THÊM test pass, không có test cũ
chuyển từ pass sang fail ở bất kỳ điểm nào.

## Known-red/TODO: reason + owner + expiry/wave

Không có known-red mới trong toàn bộ 4 batch. `memory-bank/g1b-allowlist.json` giữ nguyên 1 entry
cũ (không liên quan phạm vi bundle này).

## Out-of-scope findings/backlog

- **Không còn backlog nào của `W1.POLICY.2`, `W1.FILE`, `W1.ADMIN`** sau 4 batch này (xem từng mục
  PASS ở trên) — đây chính là lý do bundle này tuyên bố W1 đóng hoàn toàn.
- UI cho 3 route mới `W1.ADMIN` (R146/R147/R148): thuộc lane Codex theo `CLAUDE.md` mục 6, chưa
  được owner giao lại — ghi nhận bằng token `D-MISSING` trong `08-permission-matrix.md`, không tự
  dựng UI giả.
- `W1.7` (session hardening): phần logic thật đã XONG từ trước (không thuộc bundle này); chỉ còn
  durable session STORE chờ DevOps chọn implementation (O4) — đã ghi rõ trong `04-ROADMAP.md`,
  không phải backlog phía Claude, không chặn tuyên bố đóng W1.

## Rollback path

Mỗi batch là 1 commit độc lập trên `main`, đã push tuần tự lên `misa/main`
(`4967d22→5ada777→a094f19→70e5ed4`). Rollback 1 batch bất kỳ = `git revert <sha>`:
- `4967d22` (read-side): độc lập, không entity/route nào bị batch sau sửa lại cùng dòng logic mask
  — revert an toàn, chỉ cần chạy lại `verifyNoLegacyMasking()` sẽ tự FAIL nếu revert đưa legacy
  mask call trở lại (đúng mục đích guard).
- `5ada777` (upload owner-gate): độc lập với 3 batch còn lại (chỉ chạm `govFileUpload()`), revert
  an toàn.
- `a094f19` (F23 remind-gate): độc lập, chỉ đổi `requirePerm()` module của đúng 3 route remind,
  revert an toàn — nhưng sẽ cần đồng thời revert phần đếm lại Section A liên quan trong
  `08-permission-matrix.md` nếu muốn tài liệu khớp code.
- `70e5ed4` (W1.ADMIN): revert an toàn (3 route hoàn toàn mới, không entity/route cũ nào phụ thuộc
  vào chúng) — nhưng phải revert kèm toàn bộ phần cập nhật hệ thống tài liệu tự-verify (route
  catalog/matrix/verify script/mapping/ui-characterization) trong CÙNG commit đó, nếu không
  `verify-g0.mjs`/`verify-gate1-mapping.mjs` sẽ FAIL vì đếm lệch 148 so với route thật còn 145.

## Worktree status and unrelated pre-existing changes

Không có worktree phụ. Tại thời điểm gửi bundle này: `git status --short` sạch (đã commit + push
hết, `misa/main` @ `70e5ed4`); không có file unrelated pre-existing nào lẫn vào 4 commit trên — mỗi
commit chỉ chứa đúng file thuộc batch đó.

## Tổng kết: W1 (RBAC v2 D13 + security F2/F3/F8/F4) đóng hoàn toàn

Sau bundle này, rà soát lại toàn bộ 2 bảng `W1.*` trong `04-ROADMAP.md`:

- **Nhánh RBAC v2**: `W1.RBAC.0` (preflight script + regression XONG 2026-08-27 — cutover DB
  production thật là hành động DevOps-gated, tương tự O3/O4/O5, không phải backlog phía Claude),
  `W1.RBAC.1/2` XONG (schema + 4 vai trò), `W1.POLICY`/`W1.POLICY.2`/`W1.OWN`/`W1.ADMIN`/`W1.FILE`
  đều XONG không còn backlog (bundle trước + bundle này).
- **Nhánh security**: `W1.1`/`W1.8`/`W1.9`/`W1.AI-POLICY` đều XONG; `W1.7` XONG phần logic thật,
  chỉ còn durable session STORE chờ DevOps (O4) — không chặn.

**Không còn sub-item W1 nào ở trạng thái mở phía Claude.** Codex xác nhận bundle này (cùng bundle
`21-audit-bundle-f15-rbac-exp-b1-b6.md` trước đó) là điều kiện cuối để coi roadmap item **W1
CLOSED** chính thức thay vì chỉ là tự tuyên bố của Claude.

---

## Remediation F24 (2026-08-31) — phạm vi hẹp, chỉ sửa đúng blocker Codex chỉ ra

**Status:** ĐÃ FIX (commit `0e0c2d6`/docs `707cc45`, đã push `misa/main`) — **Codex re-audit ACCEPTED
(2026-08-31)**, không mở lại 4 batch gốc ở trên (theo `17-fast-track-collaboration.md` §8).

**Evidence Codex đưa ra (audit lần 1):** HTTP thật trên SQLite tạm — executor upload vào `award`
của admin nhận đúng `403`, nhưng số file trong `UPLOAD_DIR` tăng `0 → 1`. Root cause: 4 route
(`routes.js` — agreements, work-logs, awards, events) đăng ký `upload.array(...)` (Multer, disk
storage — `uploads.js:8`) TRƯỚC handler; `assertWritable()` nằm BÊN TRONG handler nên chạy SAU khi
Multer đã ghi file — deny vẫn để lại file mồ côi trên đĩa.

**Fix áp dụng đúng theo quyết định Codex:**
1. Middleware mới `requireFileWrite(entity, table, moduleLabel)` (`server/routes.js`) — fetch
   record thật + `policyService.assertWritable({principal, entity, action:'edit', record})` TRƯỚC
   `upload.array(...)`, trả 403 và KHÔNG gọi `next()` nếu không hợp lệ.
2. Đặt `requireFileWrite(...)` làm middleware đầu tiên cho `POST /agreements/:id/files`,
   `POST /work-logs/:id/files`, `POST /awards/:id/files`, `POST /events/:id/files` — trước
   `upload.array()`. Xoá logic `assertWritable` trùng lặp còn lại trong `govFileUpload()` và 2
   handler inline award/event (đã pass ở middleware, không cần kiểm lại). Giữ nguyên message lỗi
   403 gốc từng route qua tham số `moduleLabel` (`'partners'` cho agreement/work_log — đúng
   generic message cũ của `govFileUpload`; `'awards'`/`'events'` cho 2 route inline).
3. Test mới `server/test/integration-file-write-authz.test.js` — 8 test table-driven (cả SQLite lẫn
   MySQL driver), cho mỗi entity (award/event/agreement/work_log): case deny (executor upload vào
   record người khác → 403 + row `attachments` KHÔNG tăng + số file `UPLOAD_DIR` KHÔNG tăng) và
   case đối chứng (executor upload vào record chính mình → 200 + CẢ 2 số liệu tăng đúng 1 — xác
   nhận phép đếm trước/sau thật sự nhạy với thay đổi, không phải assertion luôn pass). Đã thí
   nghiệm revert tạm fix (đưa `assertWritable()` trở lại sau `upload.array()`, y hệt bug gốc) để
   xác nhận test bắt đúng: `403` vẫn đúng nhưng file-count tăng `0→1` — test FAIL đúng chỗ cần FAIL
   — trước khi coi test là đủ, rồi khôi phục lại fix.
4. Full regression chạy lại đúng 1 lần ở HEAD sau fix.

**Commands and exact results:**

| Suite | Kết quả |
|---|---|
| Security | 6/6 pass |
| SQLite integration | 811 total / 803 pass / 8 skip (+8 so với bundle gốc) |
| MySQL integration | 811 total / 810 pass / 1 skip (+8 so với bundle gốc) |
| Route mapping | 148/148 PASS (không đổi — F24 không thêm/bớt route) |
| `scripts/verify-g0.mjs` | PASS toàn bộ 9 check |
| `verify-g0-selftest` | 6/6 pass |
| `git diff --check` | sạch |

**Changed files:** `server/routes.js` (middleware `requireFileWrite` mới + 4 call site + xoá check
trùng lặp trong 3 handler); `server/test/integration-file-write-authz.test.js` (mới, 8 test).
`01-audit-findings.md` (§F24 mới), `04-ROADMAP.md` (execution update + hàng `W1.FILE`),
`15-changelog.md`, `18-g1b-rbac-batch-contract.md` (batch contract `F24-remediation`) — docs only,
không phải test/product.

**Behavior changes:** deny (`403`) không còn side-effect ghi file vào `UPLOAD_DIR` — kết quả HTTP
cuối cùng cho client (`403`/`200`) KHÔNG đổi so với trước, D13-086..089/D13-078..092 vẫn pass
nguyên vẹn không sửa assertion nào. Message lỗi 403 giữ nguyên từng route (không đổi).

**Out-of-scope:** không mở rộng sang finding nào khác ngoài F24 — 4 batch gốc (W1.POLICY.2 read+
write, W1.FILE-P2, W1.ADMIN) giữ nguyên nội dung không sửa lại.

**Rollback path:** 1 commit độc lập (`0e0c2d6`), `git revert` an toàn — chỉ hoàn tác thứ tự
middleware, không entity/route nào khác phụ thuộc vào `requireFileWrite()`.

**Worktree status:** `git status --short` sạch tại thời điểm gửi remediation này; không có file
unrelated pre-existing nào lẫn vào commit.

### Kết quả re-audit — Codex ACCEPTED (2026-08-31)

- **Evidence Codex tự xác nhận:** `requireFileWrite()` thực hiện owner authorization TRƯỚC Multer ở
  đủ 4 route: `routes.js:365` (định nghĩa middleware), `routes.js:391` (agreement/work-log),
  `routes.js:1333` (award), `routes.js:1657` (event).
- **Experiment Codex chạy độc lập:** 8 test F24 (`integration-file-write-authz.test.js:122`) trên cả
  SQLite và MySQL — mọi upload trái quyền đều `403`, không tăng row `attachments`, không tăng file
  trong `UPLOAD_DIR`; upload đúng quyền tăng chính xác 1 ở cả hai nơi.
  Verification: G0 verifier, mapping 148/148, `git diff --check` đều xanh, workspace sạch.
- **Risk còn lại (không chặn):** không còn side-effect filesystem khi authorization từ chối. Toàn bộ
  route Multer còn lại cũng đều có middleware quyền đứng trước (Codex xác nhận qua rà soát chung).
- **Decision:** Chấp nhận remediation `0e0c2d6`/docs `707cc45`. **W1 backend/security chính thức
  CLOSED.** Phần UI Native-MDS cho `W1.ADMIN` vẫn là lane UI riêng, không làm thay đổi kết luận
  đóng W1 backend.
