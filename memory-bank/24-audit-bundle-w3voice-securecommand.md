# Evidence Bundle — W3.VOICE.SECURE-COMMAND + W3.VOICE.1 (backend/API-only) — gửi Codex audit

> **Trạng thái: BLOCKED hẹp (Codex audit) → F25/F26/P2 ACCEPTED (Codex re-audit) → F27 phát hiện
> trong chính vòng re-audit đó → F27 ACCEPTED cả 3 case (Codex re-audit) → F28 phát hiện trong chính
> vòng re-audit đó → F28 ACCEPTED (Codex re-audit 2026-08-31) → CLOSED. W3.VOICE.SECURE-COMMAND
> backend đủ điều kiện đóng batch, không còn P1/MUST-FIX nào mở.**
> Codex audit trên bundle gốc dưới đây xác nhận phần lớn thiết kế đúng hướng (10/10 test cũ xanh,
> principal binding/tampering guard/quyền re-check tại confirm/score-clamp/confirm lặp tuần tự đều
> đúng) nhưng trả **BLOCKED** với 2 MUST-FIX P1 tái hiện được bằng HTTP thật + 1 P2 gộp chung: xem
> mục "Remediation F25/F26/P2" — **Codex re-audit ACCEPTED cả 3** (chạy lại 12/12 test độc lập, tự
> xác nhận transaction/rollback thật) nhưng phát hiện thêm **F27** (P1 mới, parent entity TOCTOU) —
> xem mục "Remediation F27" — **Codex re-audit ACCEPTED cả 3 case bắt buộc** (person xoá, org xoá,
> revision drift; chạy lại độc lập 15/15 test cả 2 driver) nhưng phát hiện thêm **F28** (P1 release
> blocker, row lock MySQL nhiều instance) — xem mục "Remediation F28" ở cuối tài liệu — **Codex
> re-audit ACCEPTED F28** (chạy lại độc lập SQLite 15/15, MySQL 17/17, `verify-g0`/route mapping/
> `git diff --check` pass) và tuyên bố **W3.VOICE.SECURE-COMMAND backend CLOSED**. Nội dung bundle
> gốc bên dưới **giữ nguyên không sửa** (đúng nguyên tắc audit trail); phần fix + evidence ghi ở các
> mục cuối.

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

**Status: ĐÃ FIX, Codex re-audit ACCEPTED (2026-08-31).** Codex chạy lại độc lập 12/12 test voice
trên cả SQLite/MySQL; failure-path DB thật rollback đúng, không còn proposal `confirmed` mồ côi;
transaction bọc claim→interaction→audit→result pointer→CAS đúng như mô tả (`server/ai.js`); score
stale trả `409 PROPOSAL_STALE`, không tạo interaction; `idempotencyKey` bắt buộc + validate đúng;
`verify-g0`/route mapping/`git diff --check` đều xanh. **Không mở lại 3 finding này** — vòng
re-audit phát hiện thêm 1 P1 mới ngoài phạm vi 3 finding trên, xem mục "Remediation F27" bên dưới.

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

---

## Remediation F28 (2026-08-31) — row lock MySQL nhiều instance, phát hiện trong vòng re-audit F27

**Status:** CLOSED (commit `d8ff14b`, đã push `misa/main`) — **Codex re-audit ACCEPTED (2026-08-31)**:
tự chạy lại độc lập SQLite 15/15, MySQL 17/17 (bao gồm 2 test 2-connection chứng minh `FOR UPDATE`
chặn `UPDATE` tới `COMMIT` và chặn `DELETE` tới `ROLLBACK`), `verify-g0`/route mapping/
`git diff --check` đều pass. Quyết định của Codex: **W3.VOICE.SECURE-COMMAND backend CLOSED** —
transaction rollback (F25), TTL atomic, idempotency (P2), stale terminal (F26), parent re-check
(F27) và multi-instance lock (F28) đều đã có bằng chứng.

**Evidence Codex đưa ra:** phát hiện ngay trong lúc re-audit ACCEPTED F27, không phải finding mới
độc lập. Codex chỉ ra: freshness re-check F27 vừa thêm (`fetchPersonSnapshot`/`fetchOrgSnapshot`)
chạy TRONG transaction confirm nhưng chỉ dùng plain `SELECT` — không giữ row lock. Trên MySQL khi
triển khai thật với **nhiều instance Cloud Run** (mỗi instance là 1 process/connection MySQL riêng
biệt), instance A đọc snapshot xong (hợp lệ) rồi instance B (connection khác) `UPDATE`/`DELETE` đúng
row đó GIỮA lúc A đọc và A `INSERT interaction` — A vẫn ghi interaction dùng dữ liệu đã cũ. Đây là
race **liên-process** thật, khác với F27 (F27 chỉ đóng gap trong CÙNG 1 process — `withTransaction()`
chỉ đảm bảo không handler nào khác của process đó chen được vào giữa, không nói gì về process khác).

**Đề xuất sửa của Codex (đã áp dụng đúng nguyên văn):** trong transaction sau claim, dùng locking
read cho MySQL — `SELECT ... FOR UPDATE` cho person và organization đã chọn; SQLite giữ query thường
vì claim write đã lấy write lock toàn DB. Sau lock, so snapshot rồi mới insert/audit/CAS. Thêm 1
MySQL concurrency test bằng hai connection: connection thứ hai phải bị chặn khi cố update/delete
parent cho tới khi confirm transaction commit/rollback. Quyết định của Codex: "F27 đóng. W3 Voice
backend có thể ghi ACCEPTED WITH RELEASE BLOCKER F28; cần sửa F28 trước khi deploy/scaling nhiều
instance. Không cần mở rộng sang UI hoặc thêm schema revision."

**Fix áp dụng:**
1. `server/db.js`: export thêm `isMysql: DB_CLIENT === 'mysql'` từ `module.exports` (dựa vào hằng số
   `DB_CLIENT` module-level đã có sẵn, không đổi logic chọn driver).
2. `server/ai.js`: import `isMysql`; `fetchPersonSnapshot(id)`/`fetchOrgSnapshot(id)` nối thêm
   ` FOR UPDATE` vào câu SQL khi `isMysql === true`, giữ nguyên plain `SELECT` khi không phải MySQL
   (SQLite không hỗ trợ cú pháp `FOR UPDATE` và không cần — claim `UPDATE` phía trên đã lấy write
   lock toàn DB, SQLite chỉ có đúng 1 writer tại 1 thời điểm). Cả 2 hàm chỉ được gọi TRONG
   `withTransaction()` của route confirm (đã xác minh lại — không có lời gọi nào khác ngoài đó), nên
   thêm `FOR UPDATE` không ảnh hưởng đường nào khác.
3. Không thêm cột `revision` cho `people`/`organizations`, không đổi UI/MDS — đúng phạm vi Codex đã
   chốt.

**Test mới (`server/test/integration-voice-secure-command.test.js`, 15→17 test, 2 test MySQL-only
qua `{ skip: !isMysql }`):**
- Dùng 2 connection `mysql2/promise` **độc lập với app** (không qua route HTTP thật) — lý do: app
  dùng `MySQLSyncDatabase` (`server/mysql-sync.js`), chặn đồng bộ chính main thread của process bằng
  `Atomics.wait` mỗi khi gọi MySQL. Nếu test giữ lock trước bằng 1 connection rồi gọi HTTP
  confirm() trên CÙNG process test, main thread sẽ đóng băng chờ MySQL cấp lock cho app — nhưng
  chính main thread đó lại là nơi DUY NHẤT chạy được code JS để COMMIT/ROLLBACK connection đang giữ
  lock (test code cũng cần main thread event loop) → tự deadlock chính test process, không phải lỗi
  của fix. Vì vậy test xác minh trực tiếp cơ chế khoá mà fix dựa vào, dùng ĐÚNG câu SQL production
  vừa thêm (`SELECT ... FOR UPDATE`), qua 2 connection MySQL thật độc lập.
- Test 1 (UPDATE): connA `START TRANSACTION` + `SELECT ... FOR UPDATE` trên row person; connB (raw
  connection thứ 2) gọi `UPDATE people SET relationship_score=? WHERE id=?` cùng row — assert promise
  của connB CHƯA settle sau 400ms (còn bị chặn thật); connA `COMMIT`; assert connB resolve ngay sau
  đó và giá trị đã ghi đúng.
- Test 2 (DELETE): tương tự nhưng connB gọi `DELETE`, connA giải phóng lock bằng `ROLLBACK` (không
  chỉ COMMIT) — assert connB vẫn bị chặn tới khi ROLLBACK xong rồi mới chạy được.
- 17/17 test xanh trên MySQL (2 test mới mất ~430ms mỗi test — đúng bằng cửa sổ 400ms chờ trước khi
  release lock, xác nhận khoảng chặn có thật chứ không phải race pass ngẫu nhiên); trên SQLite, 2
  test này skip đúng qua `{ skip: !isMysql }`, 15/15 còn lại vẫn xanh.

**Commands and exact results:**

| Suite | Kết quả |
|---|---|
| Security | 6/6 pass |
| SQLite `integration-voice-secure-command.test.js` | 15/15 pass (2 test F28 skip đúng) |
| MySQL `integration-voice-secure-command.test.js` | 17/17 pass (bao gồm 2 test F28 mới) |
| SQLite full integration suite | 826 total / 818 pass / 8 skip (không đổi) |
| MySQL full integration suite | 828 total / 827 pass / 1 skip (+2) |
| `scripts/verify-g0.mjs` | PASS toàn bộ check |
| `scripts/verify-gate1-mapping.mjs` | PASS — 150/150 route |
| `git diff --check` | sạch |

**Changed files:** `server/db.js` (export `isMysql`); `server/ai.js` (`fetchPersonSnapshot`/
`fetchOrgSnapshot` nối `FOR UPDATE` khi MySQL); `server/test/integration-voice-secure-command.test.js`
(2 test MySQL-only mới + helper `rawMysqlConnConfig`/`stillPendingAfter`). `01-audit-findings.md`
(§F28 mới, cập nhật trạng thái F27 → ACCEPTED), `04-ROADMAP.md`/`15-changelog.md` (execution update)
— docs only, commit riêng.

**Behavior changes:**
1. Trên MySQL, freshness re-check của person/organization trong route confirm nay khoá row (`FOR
   UPDATE`) trong lúc đọc — hành vi quan sát được từ 1 client duy nhất KHÔNG đổi (vẫn `200`/`409
   PROPOSAL_STALE` như trước), chỉ khác ở tầng đồng thời nhiều connection: connection khác cố
   ghi/xoá đúng row đó trong lúc confirm đang xử lý sẽ phải CHỜ tới khi confirm COMMIT/ROLLBACK thay
   vì có thể chen vào giữa.
2. SQLite không đổi hành vi (không hỗ trợ và không cần `FOR UPDATE`).
3. Mọi case đã ACCEPTED trước đó (F25/F26/P2/F27) giữ nguyên hành vi, không regression — xác nhận
   bằng full regression suite ở trên.

**Out-of-scope:** không thêm cột `revision` schema-wide; không mở rộng sang UI Voice/MDS; không đổi
route `/interaction-voice` cũ; không sửa gì ở SQLite ngoài việc không áp dụng thay đổi (đúng chốt của
Codex).

**Rollback path:** 1 commit độc lập (`d8ff14b`), `git revert` an toàn — chỉ đổi 1 dòng export ở
`db.js` + nội dung 2 câu SQL trong `ai.js` + thêm test, không entity/route khác phụ thuộc.

**Worktree status:** `git status --short` sạch tại thời điểm chuẩn bị remediation này; không có file
unrelated pre-existing nào lẫn vào commit.

---

## Remediation F27 (2026-08-31) — parent entity (person/organization) TOCTOU, phát hiện trong vòng re-audit F25/F26/P2

**Status:** ĐÃ FIX (commit `340e4a8`, đã push `misa/main`) — **Codex re-audit ACCEPTED cả 3 case bắt
buộc** (person bị xoá, organization bị xoá, revision/snapshot drift), tự xác nhận độc lập 15/15 test
pass cả 2 driver. F27 đóng, không mở lại. (Trong chính vòng re-audit này, Codex phát hiện thêm F28 —
xem mục "Remediation F28" bên dưới.)

**Evidence Codex đưa ra:** phát hiện ngay trong lúc re-audit F25/F26/P2, không phải finding mới độc
lập — Codex tái hiện HTTP thật:
1. Propose 1 interaction với person hợp lệ, KHÔNG có score delta.
2. Xoá person trước khi confirm.
3. Confirm vẫn trả `200`, proposal thành `confirmed`, interaction mới giữ `partner_id` trỏ tới
   person đã bị xoá.

Root cause: proposal chỉ snapshot `id/name/relationship_score` — dùng làm cơ sở CAS cho
`relationship_score` — nhưng CAS đó chỉ chạy khi `scoreDelta !== 0`. Khi không sửa điểm, không có cơ
chế nào đọc lại/so sánh person hoặc organization đã chọn còn tồn tại/còn đúng như lúc người dùng xác
nhận — trái D14.4 ("server phải đọc lại bản ghi hiện tại và so snapshot/revision trước khi ghi").

**Fix áp dụng theo hướng "bắt buộc tối thiểu" + phần "trạng thái terminal" Codex đề xuất (không thêm
cột `revision` schema-wide theo phương án "đầy đủ" #2 — xem lý do dưới):**
1. 2 hàm mới `fetchPersonSnapshot(id)`/`fetchOrgSnapshot(id)` (`server/ai.js`) — đọc lại ĐÚNG các
   field đã có sẵn trong snapshot candidate lúc propose (`name`/`org_name`/`relationship_score` cho
   person qua JOIN với `organizations`; `name`/`org_type` cho org).
2. Trong CÙNG transaction với claim (sau khi claim thành công, TRƯỚC khi insert interaction): với
   MỖI parent đã chọn (`selectedPerson`/`selectedOrg`, không chỉ khi có score delta), đọc lại và so
   sánh (`snapshotDrifted()`) — row không tồn tại HOẶC bất kỳ field nào khác snapshot → đánh dấu
   stale.
3. Khi stale: `UPDATE voice_proposals SET status='stale' WHERE id=?` rồi **COMMIT** (khác với lỗi
   thật — vẫn `ROLLBACK` về `pending`) — không bao giờ insert interaction. Trạng thái `stale` là
   **terminal**: route confirm nay có nhánh riêng chặn sớm `if (proposal.status === 'stale')` →
   `409 PROPOSAL_STALE` ngay từ đầu, không cho "sống lại" dù dữ liệu vô tình quay về đúng snapshot cũ
   — đúng đề xuất #3 của Codex.
4. **Quyết định về phương án #2 (thêm cột `revision` cho `people`/`organizations` + tăng ở mọi
   đường ghi):** không làm — so sánh trực tiếp TOÀN BỘ field đã snapshot với bản ghi hiện tại (bước
   2 ở trên) bao phủ được MỌI thay đổi thật (kể cả những field ngoài dự kiến), không phụ thuộc việc
   nhớ tăng `revision` đúng ở mọi đường ghi mới trong tương lai (rủi ro bỏ sót cao hơn), và không mở
   rộng phạm vi remediation sang toàn bộ write-path của 2 bảng dùng chung nhiều module khác ngoài
   Voice. Coi phương án so sánh trực tiếp là tương đương ngữ nghĩa với "revision" theo đúng tinh
   thần D14.4 (snapshot khác hiện tại → từ chối), không phải cắt góc.
5. CAS `relationship_score` (khi có score delta) giữ nguyên làm lưới an toàn thứ 2: vì bước 2 đã xác
   nhận fresh NGAY TRONG CÙNG transaction, CAS ở đây về lý thuyết không thể fail — nếu fail thật, coi
   là vi phạm giả định đồng bộ của `withTransaction()` (lỗi hệ thống thật), `throw` lỗi thường để
   ROLLBACK toàn bộ + `502`, KHÔNG coi là stale bình thường.

**Test mới/sửa (`server/test/integration-voice-secure-command.test.js`, 12→15 test):**
- "person bị XOÁ giữa propose và confirm (không có score delta)" → `409 PROPOSAL_STALE`, không tạo
  interaction, proposal `status='stale'`.
- "organization bị XOÁ giữa propose và confirm" → tương tự.
- "person ĐỔI TÊN (không phải điểm) giữa propose và confirm" → `409 PROPOSAL_STALE` — xác nhận
  drift-check không chỉ theo dõi điểm, đúng ý nghĩa "revision" toàn diện.
- Sửa test stale-score cũ: assert `getProposal().status === 'stale'` (không còn `'pending'`), thêm
  bước retry cùng proposal vẫn `409 PROPOSAL_STALE` (xác nhận không "sống lại").
- 15/15 test xanh cả SQLite/MySQL.

**Commands and exact results:**

| Suite | Kết quả |
|---|---|
| Security | 6/6 pass |
| SQLite integration | 826 total / 818 pass / 8 skip (+3 so với remediation F25/F26/P2) |
| MySQL integration | 826 total / 825 pass / 1 skip (+3) |
| Route mapping | 150/150 PASS (không đổi) |
| `scripts/verify-g0.mjs` | PASS toàn bộ check |
| `git diff --check` | sạch |

**Changed files:** `server/ai.js` (2 hàm snapshot mới, nhánh stale-check trong transaction, nhánh
chặn sớm `status==='stale'`, xoá `StaleScoreError` không còn dùng); `server/test/integration-voice-
secure-command.test.js` (3 test mới, sửa 1 test, thêm helper `insertOrg`/`getOrg`).
`01-audit-findings.md` (§F27 mới, cập nhật trạng thái F25/F26/P2 → ACCEPTED), `04-ROADMAP.md`/
`15-changelog.md` (execution update) — docs only.

**Behavior changes:**
1. Confirm với person/org đã bị xoá (kể cả KHÔNG có score delta) nay `409 PROPOSAL_STALE`, KHÔNG
   tạo interaction (trước đây `200`, tạo interaction trỏ tới bản ghi đã mất).
2. Confirm với person đã đổi tên/đổi tổ chức (hoặc org đổi loại) giữa propose/confirm nay cũng
   `409 PROPOSAL_STALE` (trước đây không được kiểm tra ngoài điểm).
3. Proposal stale (điểm/parent) nay chuyển trạng thái **terminal `stale`** thay vì quay lại
   `pending` — không còn khả năng "sống lại" nếu dữ liệu vô tình trùng khớp snapshot cũ lần nữa.
4. Happy-path và các case đã ACCEPTED (F25 rollback lỗi thật, F26 score stale ban đầu, P2
   idempotencyKey, principal binding, tampering guard, TTL) giữ nguyên hành vi, không regression.

**Out-of-scope:** không thêm cột `revision` cho `people`/`organizations` (xem lý do ở mục 4 phần
Fix); không mở rộng sang UI Voice/MDS; không đổi route `/interaction-voice` cũ.

**Rollback path:** 1 commit độc lập (`340e4a8`), `git revert` an toàn — chỉ đổi logic nội bộ route
confirm + 2 hàm helper cục bộ trong `ai.js`, không entity/route khác phụ thuộc.

**Worktree status (F27):** `git status --short` sạch tại thời điểm chuẩn bị remediation này; không có file
unrelated pre-existing nào lẫn vào commit.
