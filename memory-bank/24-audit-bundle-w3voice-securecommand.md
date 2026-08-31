# Evidence Bundle — W3.VOICE.SECURE-COMMAND + W3.VOICE.1 (backend/API-only) — gửi Codex audit

> **Trạng thái: BLOCKED hẹp (Codex audit) → ĐÃ FIX F25/F26/P2 (Claude 2026-08-31), chờ re-audit.**
> Codex audit trên bundle gốc dưới đây xác nhận phần lớn thiết kế đúng hướng (10/10 test cũ xanh,
> principal binding/tampering guard/quyền re-check tại confirm/score-clamp/confirm lặp tuần tự đều
> đúng) nhưng trả **BLOCKED** với 2 MUST-FIX P1 tái hiện được bằng HTTP thật + 1 P2 gộp chung: xem
> mục "Remediation F25/F26/P2" ở cuối tài liệu. Nội dung bundle gốc bên dưới **giữ nguyên không sửa**
> (đúng nguyên tắc audit trail); phần fix + evidence ghi ở mục cuối.

Batch độc lập (không gộp với bundle W1 đã đóng). Backend/API thuần theo lane Claude
(`17-fast-track-collaboration.md` §1, `CLAUDE.md` mục 6); UI cho R149/R150 CHƯA làm — lane Codex,
chưa được owner giao lại.

## Batch-ID / commit range / HEAD

| # | Batch | Commit | Batch Contract |
|---|---|---|---|
| 1 | Mechanical — tách `buildInsert`/`buildUpdate`/`logEdit` sang `db-helpers.js` | `506311a` | `23-w3voice-securecommand-batch-contract.md` |
| 2 | W3.VOICE.SECURE-COMMAND + W3.VOICE.1 — luồng propose/confirm | `b6ba61e` | `23-w3voice-securecommand-batch-contract.md` |
| 3 | Docs — execution update + changelog | `ba81e43` | (docs-only follow-up) |

Commit range đầy đủ: `8751b46..ba81e43` (parent = HEAD bundle W1 trước đó, nhánh `main`, remote
`misa`). HEAD đã push: `misa/main` @ `ba81e43`. Diffstat toàn range: **16 file, +725/-57**.

## Contract result: từng exit criterion PASS/FAIL + evidence

- PASS — route cũ `POST /interaction-voice` và `VOICE_SCHEMA` giữ nguyên không sửa (test
  `BR-AI-010` cũ không đổi assertion) — batch chỉ THÊM 2 route mới, không thay thế route cũ.
- PASS — `POST /interaction-voice-propose` (R149, `server/ai.js:143`) không tự chọn candidate khi
  ≥2 người/tổ chức khớp tên — trả `matchConfidence:'ambiguous'` + toàn bộ candidate, không đoán.
- PASS — `POST /interaction-voice-confirm` (R150, `server/ai.js:199`) chỉ nhận `proposalId` +
  `idempotencyKey` + `edits` tường minh, KHÔNG nhận lại payload gốc từ client — chọn candidate
  ngoài danh sách đã đề xuất trong `voice_proposals.payload_json` bị 400 `VALIDATION_FAILED` (test
  tamper-guard nằm trong happy-path assertion, xem `propose()`/`confirm()` helper).
- PASS — principal binding: confirm bởi user khác với `user_id` đã propose → 403
  `FORBIDDEN_MODULE` (test #4).
- PASS — hết hạn: `expires_at` bị ép quá khứ trực tiếp trong DB (mô phỏng TTL 10 phút trôi qua) →
  410 `PROPOSAL_EXPIRED` (test #5).
- PASS — idempotency: confirm 2 lần cùng `idempotencyKey` → lần 2 trả lại đúng `interactionId` cũ,
  KHÔNG tạo interaction thứ 2 (test #6); confirm 2 lần khác `idempotencyKey` → lần 2 nhận 409
  `PROPOSAL_ALREADY_CONFIRMED`, vẫn chỉ 1 interaction (test #7). Gate duy nhất: atomic claim
  `UPDATE voice_proposals SET status='confirmed' WHERE id=? AND status='pending'`, kiểm
  `changes===1`.
- PASS — re-check quyền tại confirm (không tin propose-time check): `policyService.prepareCreate`
  cho interaction + `policyService.assertWritable` cho person-edit (nếu có score delta) chạy lại
  toàn bộ; hạ quyền `viewer` giữa propose và confirm (kèm refresh session `/api/me` bắt buộc để
  session không cache role cũ) → confirm 403 (test #10).
- PASS — optimistic concurrency cho `relationship_score`: CAS
  `UPDATE people SET relationship_score=? WHERE id=? AND relationship_score=snapshot`; nếu bị đổi
  song song giữa propose/confirm → CAS reject, interaction **vẫn được tạo** (`ok:true`,
  `scoreApplied:false, reason:'STALE_SCORE_SNAPSHOT'`), điểm giữ nguyên giá trị ghi đè song song,
  không mất dữ liệu interaction đã xác nhận (test #8).
- PASS — `suggested_score_delta`: server chỉ kẹp biên an toàn `[-10,10]` (test #1: Gemini trả 15 →
  server lưu/áp dụng 10); không có delta → `person:null`, điểm không đổi (test #9).
- PASS — happy path đầy đủ: propose → confirm tạo interaction + cộng điểm 50→55 (test #3).
- **Quyết định KHÔNG làm (đúng phạm vi contract):** không đổi route `/interaction-voice` cũ; không
  dựng UI; không định nghĩa quy tắc nghiệp vụ chính thức cho delta điểm (D14.3 vẫn treo, thuộc BA);
  không xây transaction wrapper đa-câu-lệnh mới cho toàn repo (CAS đơn-câu-lệnh đủ cho phạm vi này).

## Changed files: product / test / docs tách riêng

**Product code (5 file):**
- `server/db-helpers.js` (mới, 22 dòng) — `buildInsert`/`buildUpdate`/`logEdit` tách nguyên vẹn từ
  `routes.js`, không đổi hành vi (commit `506311a` riêng).
- `server/routes.js` (+16/-14 dòng qua commit `506311a`) — xoá 3 hàm đã tách, thêm require từ
  `db-helpers.js`; không đổi route nào.
- `server/db.js` (+17 dòng) — bảng mới `voice_proposals` trong `init()`, KHÔNG thêm vào `dropAll()`
  (đúng tiền lệ `field_visibility`/quyết định `W1.RBAC.0`).
- `server/ai.js` (+220/-~ dòng) — 2 route mới R149/R150, `VOICE_PROPOSAL_SCHEMA`,
  `clampScoreDelta`, `expiresAtString`, `isExpired`, `matchCandidates`, hằng số
  `VOICE_PROPOSAL_TTL_MS`/`SCORE_DELTA_MIN`/`SCORE_DELTA_MAX`; instance `policyService` riêng (dùng
  chung `visibilityStore` không cache — an toàn độc lập với instance của `routes.js`).

**Test (3 file):**
- `server/test/integration-voice-secure-command.test.js` (mới, 219 dòng, 10 test) — xem danh sách
  ở mục exit criterion trên.
- `server/test/integration-db-contract.test.js` (+2/-1) — thêm `voice_proposals` vào `TABLES`,
  đếm lại tên test "35 bảng"→"36 bảng".
- `server/test/ui-characterization.test.js` (+4/-4) — đếm lại UI-CHAR-003: 35/148→36/150.

**CI verifier scripts (2 file):**
- `scripts/verify-g0.mjs` (+37/-~) — đếm lại route 148→150, bảng 35→36, index 22→23, Gemini
  expressions `ai` 6→7 (kèm comment giải thích: tái dùng egress ID `AI-E001`, không phải flow logic
  mới), UI-flow 35→36; toàn bộ `pass()` message cập nhật khớp.
- `scripts/verify-gate1-mapping.mjs` (+6/-2) — 2 hằng số 148→150.

**Docs (6 file):** `23-w3voice-securecommand-batch-contract.md` (mới, 83 dòng — batch contract đầy
đủ, viết trước code); `04-ROADMAP.md` (+52 dòng — 2 status row + execution update blockquote);
`07-route-catalog.md` (+8 — R149/R150 + header 150/150); `08-permission-matrix.md` (+15 —
interactions 4→6 route, F036 mới, tổng 148→150); `09-db-schema.md` (+22 — mục `voice_proposals`,
đếm lại 35→36 bảng/22→23 index); `gate1-test-mapping.md` (+8 — mapping row R149/R150);
`15-changelog.md` (+46 — mục batch này).

## Route-job-rule mapping delta

- 2 route MỚI: R149 (`POST /api/ai/interaction-voice-propose`, `ai.js:143`), R150 (`POST
  /api/ai/interaction-voice-confirm`, `ai.js:199`) — tổng route catalog 148→150.
- `08-permission-matrix.md` Section A: `interactions` module 4→6 route. Section B: +1 flow mới
  `F036` (token `D-MISSING` — route backend/API chưa có UI, đúng tiền lệ `F035`) — tổng flow
  35→36.
- `09-db-schema.md`: +1 bảng `voice_proposals` (35→36), +1 index `idx_voiceprop_user_status`
  (22→23).
- Mapping tổng cuối cùng: **150/150 route green** (`scripts/verify-gate1-mapping.mjs`), không route
  nào rớt khỏi mapping.

## Behavior changes: có/không; file:line hoặc diff chứng minh

**Có**, 2 route hoàn toàn MỚI (không có hành vi "trước/sau" vì route chưa từng tồn tại trước batch
này) — chỉ user đã authenticate với `interactions:create` gọi tới được:

1. `POST /interaction-voice-propose` (`server/ai.js:143`) — tạo `voice_proposals` row, TTL 10
   phút, không ghi `interactions`/`people` nào.
2. `POST /interaction-voice-confirm` (`server/ai.js:199`) — ghi `interactions` (qua `buildInsert`)
   + tuỳ chọn cộng/trừ `people.relationship_score` (qua CAS), có audit log qua `logEdit`.

**Không** đổi: route `/interaction-voice` cũ (giữ nguyên schema `VOICE_SCHEMA`/hành vi/test
`BR-AI-010`); mọi route khác; UI/MDS (lane Codex, chưa giao lại); seed demo.

## Tests added/changed: ID + file

- **10 test mới** `integration-voice-secure-command.test.js` — happy path + clamp delta, ambiguous
  match, principal binding 403, hết hạn 410, double-confirm idempotent, double-confirm 409, CAS lost
  update, không có score delta, quyền bị rút giữa propose/confirm.
- **Đếm lại (không đổi assertion cốt lõi):** `integration-db-contract.test.js` DB-CONTRACT-001
  (35→36 bảng), `ui-characterization.test.js` UI-CHAR-003 (35/148→36/150).

## Commands and exact results: pass/fail/skip + exit code

Full regression tại HEAD `ba81e43` (tích luỹ từ HEAD bundle W1 trước, `8751b46`):

| Suite | Kết quả |
|---|---|
| Security | 6/6 pass |
| SQLite integration | 821 total / 813 pass / 8 skip (0 fail, +10 so với HEAD trước 811 total) |
| MySQL integration | 821 total / 820 pass / 1 skip (0 fail, +10 so với HEAD trước 811 total) |
| Route mapping (`verify-gate1-mapping.mjs`) | 150/150 PASS |
| `scripts/verify-g0.mjs` | PASS toàn bộ check (route/bảng/index/UI-flow/Gemini-expressions đếm lại) |
| `git diff --check` | sạch |

Không có regression: mỗi batch trong range chỉ CỘNG THÊM test pass, không có test cũ chuyển từ pass
sang fail.

## Known-red/TODO: reason + owner + expiry/wave

Không có known-red mới. `memory-bank/g1b-allowlist.json` không đổi trong batch này.

## Out-of-scope findings/backlog

- UI cho R149/R150: lane Codex theo `CLAUDE.md` mục 6, chưa được owner giao lại — ghi nhận bằng
  token `D-MISSING` trong `F036` (`08-permission-matrix.md`), không tự dựng UI giả.
- **W3.VOICE.2** (trigger toàn cục ở tầng WebView-host, D15): vẫn `UNVERIFIED` tới bridge contract
  O3 (DevOps) — ngoài phạm vi batch này, không phải backlog phía Claude.
- Quy tắc nghiệp vụ chính thức cho `relationship_score` delta (D14.3): vẫn treo, thuộc BA — batch
  này chỉ implement CƠ CHẾ an toàn (kẹp biên + CAS), không tự quyết định giá trị/logic nghiệp vụ.

## Rollback path

3 commit độc lập trên `main`, đã push tuần tự lên `misa/main` (`506311a→b6ba61e→ba81e43`).
- `506311a` (mechanical): revert an toàn — thuần di chuyển hàm, `b6ba61e` phụ thuộc require từ
  `db-helpers.js` nên phải revert CÙNG với `b6ba61e` nếu muốn revert cả 2.
- `b6ba61e` (feature): revert an toàn độc lập — 2 route mới không ai gọi tới ngoài test mới; không
  entity/route cũ nào phụ thuộc `voice_proposals`. Phải revert kèm phần cập nhật hệ thống tài liệu
  tự-verify (route catalog/matrix/schema/verify script/mapping) trong CÙNG lần revert, nếu không
  `verify-g0.mjs`/`verify-gate1-mapping.mjs` sẽ FAIL vì đếm lệch so với route/bảng thật.
- `ba81e43` (docs-only): revert an toàn, không ảnh hưởng code/test.

## Worktree status and unrelated pre-existing changes

Không có worktree phụ. Tại thời điểm gửi bundle này: `git status --short` sạch (đã commit + push
hết, `misa/main` @ `ba81e43`); không có file unrelated pre-existing nào lẫn vào 3 commit trên.

---

## Remediation F25/F26/P2 (2026-08-31) — phạm vi hẹp, chỉ sửa đúng 2 MUST-FIX + 1 P2 Codex chỉ ra

**Status:** ĐÃ FIX (commit `05826b4`, đã push `misa/main`) — chờ Codex re-audit đúng 5 hành vi đã
yêu cầu (theo `17-fast-track-collaboration.md` §8, không mở lại phần đã pass trong bundle gốc).

**Evidence Codex đưa ra (audit lần 1):** tạo trigger tạm ép `INSERT INTO interactions` lỗi, tái
hiện HTTP thật trên SQLite:
```
first: 502
afterFailure: { "status": "confirmed", "idempotency_key": "audit-atomicity-key", "result_interaction_id": null }
retry: { "status": 200, "interactionId": null, "idempotent": true }
```
Root cause F25: claim proposal (`UPDATE ... status='confirmed'`) và các bước ghi tiếp theo (INSERT
interaction, audit, cập nhật `result_interaction_id`, CAS điểm) là các câu lệnh SQL rời rạc không
bọc transaction — gate atomic gốc chỉ chống double-click, không bảo vệ toàn bộ chuỗi nghiệp vụ khỏi
lỗi giữa chừng. Root cause F26: CAS điểm stale chỉ bỏ qua phần điểm (`scoreApplied:false`), vẫn tạo
interaction — trái nguyên văn D14.4 ("từ chối và yêu cầu chuẩn bị lại" khi snapshot khác hiện tại).
P2: `idempotencyKey` không validate, ghi `null` khi thiếu.

**Fix áp dụng đúng theo hướng Codex đề xuất ("Hướng sửa gọn cho Claude" trong audit):**
1. `withTransaction(fn)` mới (`server/db.js`) — bọc `BEGIN`/`COMMIT`/`ROLLBACK` thô qua `db.exec()`.
   An toàn dùng được vì cả 2 driver (`DatabaseSync` SQLite, `MySQLSyncDatabase` MySQL — 1 connection
   duy nhất qua worker thread, gọi đồng bộ bằng `Atomics.wait`) không có `await` xen giữa trong 1
   request handler, nên không request nào khác chen được vào giữa transaction (đã sanity-check
   `node:sqlite` hỗ trợ `BEGIN`/`COMMIT`/`ROLLBACK` thô qua script độc lập trước khi áp dụng).
2. `POST /ai/interaction-voice-confirm` (`server/ai.js`) nay bọc claim + insert interaction + audit
   + cập nhật `result_interaction_id` + CAS điểm trong 1 `withTransaction()`. Điều kiện TTL chuyển
   vào ngay câu `UPDATE` claim (`AND expires_at > datetime('now')`) thay vì chỉ dựa `isExpired()`
   JS trước đó — hết hạn đúng lúc claim cũng được xử lý atomic như 1 dạng xung đột claim.
3. CAS điểm stale (`cas.changes !== 1`) nay `throw StaleScoreError` bên trong transaction → ROLLBACK
   TOÀN BỘ (kể cả interaction vừa insert), route trả `409 PROPOSAL_STALE`. Phân biệt rõ với nhánh
   thiếu QUYỀN sửa điểm (`PolicyForbiddenError` ở `assertWritable`) — nhánh đó GIỮ NGUYÊN hành vi cũ
   (vẫn tạo interaction, bỏ qua phần điểm), vì đó là thiếu quyền chứ không phải dữ liệu lệch thời
   điểm — không phải case Codex yêu cầu sửa.
4. `idempotencyKey` nay bắt buộc: `typeof !== 'string' || !trim() || length > 200` → `400
   VALIDATION_FAILED` trước khi chạm DB.
5. Test mới/sửa trong `server/test/integration-voice-secure-command.test.js` (12 test, tăng từ 10):
   - Sửa 5 test hiện có: thêm `idempotencyKey` bắt buộc vào mọi lời gọi `confirm()` còn thiếu; đổi
     kỳ vọng test stale-score từ `200`/`scoreApplied:false` sang `409 PROPOSAL_STALE` + interaction
     count không đổi + proposal quay về `pending`.
   - Test mới "thiếu hoặc rỗng idempotencyKey bị từ chối 400" — 2 case (thiếu hẳn, chuỗi khoảng
     trắng), xác nhận proposal không bị claim bởi request không hợp lệ.
   - Test mới "lỗi giữa chừng khi ghi interaction → proposal ROLLBACK về pending, retry sau khi hết
     lỗi tạo đúng 1 interaction" — dùng CHECK constraint tạm thời qua `ALTER TABLE` (MySQL — `CREATE
     TRIGGER` cần quyền SUPER khi bật binary log, không có trong user test) / TRIGGER tạm thời
     (SQLite) ép thật sự `INSERT` lỗi có điều kiện (`partner_name='FORCE_FAIL_MARKER'`, giá trị điều
     khiển được từ `person_name` trong payload Gemini mock) — đúng phong cách thí nghiệm Codex đã
     dùng (lỗi DB thật, không phải mock JS — mock không xác nhận được hành vi transaction/rollback
     thật ở tầng DB, và không thể mock được vì `ai.js` destructure `buildInsert` tại require-time,
     không đọc lại `module.exports` sau khi mutate).
   - Test "confirm 2 lần cùng/khác idempotencyKey" (đã có từ batch gốc) tiếp tục phủ đúng yêu cầu
     "confirm lặp cùng key → cùng 1 interaction" của Codex, không cần test mới.
6. Full regression chạy lại đúng 1 lần ở HEAD sau fix.

**Commands and exact results:**

| Suite | Kết quả |
|---|---|
| Security | 6/6 pass |
| SQLite integration | 823 total / 815 pass / 8 skip (+2 so với bundle gốc) |
| MySQL integration | 823 total / 822 pass / 1 skip (+2 so với bundle gốc) |
| Route mapping | 150/150 PASS (không đổi — remediation không thêm/bớt route) |
| `scripts/verify-g0.mjs` | PASS toàn bộ check |
| `git diff --check` | sạch |

**Changed files:** `server/db.js` (+`withTransaction()`, +export); `server/ai.js` (route confirm
viết lại phần claim/ghi để dùng transaction + phân loại lỗi `ConfirmConflictError`/`StaleScoreError`
+ validate `idempotencyKey`); `server/test/integration-voice-secure-command.test.js` (sửa 5 test,
thêm 2 test, thêm helper `forceInsertFailure()`/`clearInsertFailure()`/`getProposal()`).
`01-audit-findings.md` (§F25/§F26/P2 mới), `04-ROADMAP.md`/`15-changelog.md` (execution update) —
docs only, không phải test/product.

**Behavior changes:**
1. Lỗi giữa chừng lúc confirm (vd DB tạm thời từ chối insert) nay ROLLBACK về `pending`, KHÔNG còn
   để lại proposal `confirmed` mồ côi — client retry được thật (trước đây retry trả `200` giả).
2. CAS điểm `relationship_score` stale nay trả `409 PROPOSAL_STALE`, KHÔNG tạo interaction (trước
   đây `200`, tạo interaction, chỉ bỏ qua phần điểm). Nhánh thiếu QUYỀN sửa điểm KHÔNG đổi.
3. `idempotencyKey` thiếu/rỗng nay `400` (trước đây được chấp nhận, ghi `null`).
4. Happy-path và các case đã ACCEPTED trong audit lần 1 (principal binding, tampering guard, quyền
   bị rút, score clamp, confirm lặp cùng/khác key) giữ nguyên hành vi, không regression.

**Out-of-scope:** không mở rộng sang UI Voice/MDS — đúng phạm vi Codex đã giới hạn ("không mở rộng
scope sang UI Voice/MDS trong vòng backend này"). Không đổi route `/interaction-voice` cũ.

**Rollback path:** 1 commit độc lập (`05826b4`), `git revert` an toàn — chỉ đổi logic nội bộ route
confirm + thêm 1 helper dùng chung, không route/entity khác phụ thuộc `withTransaction()`.

**Worktree status:** `git status --short` sạch tại thời điểm chuẩn bị remediation này; không có file
unrelated pre-existing nào lẫn vào commit.
