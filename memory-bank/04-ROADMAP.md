# 04 — Plan & Roadmap chi tiết (v3 — sau owner-decisions 2026-08-24: D13 RBAC v2 + D14 voice + dữ liệu test bỏ được)

> **v3 thay v2.** v2 (sau Codex roadmap-review 8,2→9,0/10, 6 amendment) xây trên giả định: 2 vai trò, `org_fee` đơn, **dữ liệu production sống** (nên R1 rất cẩn trọng), O4/O5 owner tự quyết. Owner quyết trực tiếp 2026-08-24 (xem `02-decisions.md` §D/§E) lật lại 3 giả định gốc — v3 tái cấu trúc theo đó. **Xương sống giữ nguyên** (test-first, fail-closed, PolicyEngine 1 choke-point, strangler UI theo slice, không gộp refactor + đổi nghiệp vụ 1 commit); phần đổi lớn ghi rõ ở §0 dưới.
> Phối hợp không đổi: Claude triển khai từng gate/slice; **Codex audit độc lập** evidence/diff/test/exit-condition trước khi owner cho qua gate tiếp.

## §0 — Những gì owner-decisions 2026-08-24 làm đổi so với v2 (đọc trước)

| Quyết định | Tác động lên roadmap |
|---|---|
| **D13 — RBAC v2** (4 vai trò Viewer/Nhân viên thực thi/Admin/Super Admin + visibility field-level cấu hình được + tách created_by/owner_id, áp cho 14 bảng "hoạt động") | Đây giờ là **khối việc lớn nhất, nền tảng** — mọi thứ khác (money policy, file policy, UI slice) phụ thuộc semantics phân quyền mới. W1.2–W1.4 cũ (money policy qua `org_fee`) **không còn là task riêng** — gộp vào RBAC v2 vì PolicyEngine (D1) giờ đọc bảng `field_visibility` động + role 4 cấp + ownership, không phải `org_fee` hard-code. F11 (role drift) **bị nuốt trọn** — thay cả hệ vai trò thì không "dọn banner" nữa mà xây mới. |
| **Dữ liệu Cloud Run = test, bỏ được** | Chuỗi **R1.0–R1.7 sụp gọn**: không cần dual-write/backfill/reconcile/shadow/canary cẩn trọng (những cái đó sinh ra CHÍNH VÌ giả định dữ liệu sống). Thay bằng **redesign schema + seed lại sạch** 1 lần. Nhiều Tier-A "phải đúng từ dòng đầu vì dữ liệu đã ghi" **giãn ưu tiên** — code vẫn phải đúng cho khi dữ liệu thật xuất hiện, nhưng không cần retrofit cho dữ liệu ĐANG có. Target `browser-production` **lùi thời điểm** — chưa có người dùng/dữ liệu thật (xem `README.md` bối cảnh audit). |
| **O3 (contract auth AMIS) + O4 (session store) + O5 (SLO) → DevOps MISA** | Cả 3 giao DevOps (owner 2026-08-24). W1.7 dựng **seam** durable-session (interface fail-closed), backend do DevOps chọn. W2.3 ngưỡng SLO + topology do DevOps chốt — Claude dựng harness đo. W2.5/W4.1: bridge contract AMIS Mobile do DevOps + team AMIS làm rõ; Claude dựng adapter theo contract khi có. |
| **O6 duyệt $200** | W2.6 (Gemini eval) chạy được — ngân sách cứng $200 cho toàn bộ golden eval. |
| **O2/O7 superseded** | Không còn quyết riêng — nuốt vào D13. |
| **D14 — Voice Assistant vision** (gọi từ mọi màn hình + AI tự chuẩn bị hành động, **người dùng xác nhận** trước khi ghi — D14.2 đã chốt human-in-the-loop 2026-08-24) | Track riêng Wave 3/4. **KHÔNG bỏ human-in-the-loop** (owner chốt: speech-to-text sai được, phải xác nhận). Khác biệt thực chất thu hẹp còn: gọi-từ-mọi-màn-hình + AI chuẩn bị hành động đa bước chờ xác nhận 1 lần. Còn mở: quy tắc AI đề xuất mức đổi `relationship_score` (BA định nghĩa, không chặn vì đã có bước xác nhận). |
| **D15 — AMIS Mobile = cầu nối WebView** (owner làm rõ 2026-08-24; **sửa wording theo Codex C0.7, 2026-08-25**) | **Giảm khối lượng triển khai, KHÔNG giảm severity F5.** AMIS Mobile không phải nơi build app native riêng — là host launcher + WebView, mỗi app = 1 icon, bấm vào mở **web app trong khung native**. "Native composition" = **web UI chạy trong WebView host, với 1 composition trình bày Native-Mobile RIÊNG BIỆT** (không phải desktop + responsive CSS) + bridge session/mic/camera/deep-link — KHÔNG phải codebase native song song. F5 giữ nguyên **P0** (chỉ giảm effort/estimate). Auth (O3) = host bơm token vào web app qua bridge, nhưng **cơ chế cụ thể vẫn `UNVERIFIED`** tới khi có bridge contract — không được viết như đã xác nhận (xem W4.1). |

### §0.2 — Codex round-3 re-audit (`PR-WORKSTATION-CODEX-G0-ROUND-3-REAUDIT.md`) → `G0-CLOSE-CONTRACT.md` (2026-08-25)
Codex giữ `HOLD GATE 0` sau round 3, ra 8 blocker C0.1-C0.8 cụ thể (khác định dạng finding tự do trước đây — mỗi blocker có acceptance criteria rõ). **Owner phân công lại phạm vi (2026-08-25):** C0.3 (rebuild ma trận UI-flow route×role×surface cho G0.4) **chuyển cho Codex trực tiếp thực hiện**, không phải Claude. C0.1 (4 quyết định owner) đã APPROVED, Claude cập nhật vào tài liệu (§B, §D D13.4c, N1/N2). C0.2/C0.4/C0.5/C0.6/C0.7/C0.8 do Claude xử lý trong đợt remediation này — xem D13 §D (C0.2), 09/10/11/12/13/14-*.md (C0.4), Gate 0/Wave 1 dưới (C0.5), Gate 1 dưới (C0.6), §F D15 (C0.7), `06-threat-model.md` (C0.8).

### §0.1 — Điểm cần owner/Codex quyết về CÁCH test (fork chiến lược, Claude khuyến nghị — chưa tự chốt)
Giả định cũ của Gate 1 là "characterization test 100% hành vi hiện tại TRƯỚC khi refactor" — hợp lý khi giữ nguyên hệ thống. Nhưng giờ **RBAC bị viết lại (D13) + dữ liệu bỏ được**, nên với phần bị viết lại (phân quyền, money policy, ownership) việc "test lại hành vi CŨ (đang sai — F1)" ít giá trị. **Khuyến nghị:** đổi sang **spec-first cho phần viết lại** (viết test cho hành vi ĐÍCH của RBAC v2), **chỉ characterization cho phần GIỮ nguyên** (CRUD nghiệp vụ, monitor, report, AI extract). Tiết kiệm đáng kể công Gate 1. **Cần owner/Codex xác nhận** trước khi khóa Gate 1 — ghi ở exit-gate G1.

---

## Sơ đồ phụ thuộc (task-level)

```
G0 (quyết định + inventory + threat/data-flow) ── C0.1/C0.2/C0.4/C0.5/C0.6/C0.7/C0.8 remediated;
                                                    C0.3 (UI-flow matrix) do Codex trực tiếp làm — xem trạng thái Gate 0 dưới
  │
  ├─ G1A: characterization-core — ĐỦ 145 route + job/scheduler/monitor — GREEN, CI job `regression`
  ├─ G1B: RBAC v2 (D13, spec-first) + security target suite — KNOWN-RED, CI job `security-gap`, allowlist {F-id|D13-target|N-id, owner, expiry}
  └─ G1C: acceptance E2E 4 vai trò — khung định nghĩa ở Gate 1, xanh sau W1

Sau G1A.9 (mapping 145/145) xong + G1A GREEN:
  ├─ W1 = RBAC v2 nền tảng (D13, security-complete theo C0.2) — khối lớn nhất, gộp F1/F9/F11 + money/file policy:
  │    W1.RBAC.0 (preflight/rollback reset gate — Codex C0.5, KHÔNG dùng dropAll() hiện tại)
  │    W1.RBAC.1/2 (schema 4 vai trò + field_visibility + classification_tier seed + created_by/owner_id 14 bảng + resource-policy nhóm khác)
  │    W1.POLICY/W1.POLICY.2 (PolicyEngine D1 đọc field_visibility động + classification_tier trần + role + ownership, tầng truy vấn)
  │    W1.OWN/W1.ADMIN/W1.FILE (ownership + màn hình Admin + per-file visibility có trần)
  ├─ W1 security song song (độc lập RBAC):
  │    W1.8 SSRF (F3) ── làm ngay, không chờ quyết định nào
  │    W1.7 session seam (F2) ── backend store để DevOps chốt (O4)
  │    W1.9 AI reliability (F8) ── không chờ O8
  │    W1.AI-POLICY (F4 data-egress) ── O8 provisional, xây ngay dạng gateway cấu hình được
  ├─ G1.8 Perf baseline (F7) ── song song, cần DB_CLIENT=mysql, KHÔNG block
  └─ W2.5 host-adapter interface + 2 fake provider ── làm sớm, không chờ O3 (chỉ contract-ready)

Wave 2 (contract + perf) ── W2.3 acceptance SLO cần O5(DevOps chốt ngưỡng); W2.6 Gemini eval cần O6(đã duyệt $200)
Wave 3 (strangler UI trên RBAC v2 mới) ── mỗi slice tự chờ test+policy+contract của slice; slice voice = D14 (W3.VOICE.SECURE-COMMAND trước W3.VOICE.1)
Wave 4 (WebView-host runtime + release + voice runtime) ── chặn: security gate + SLO gate + bridge contract (O3) + O8(nếu AI/voice bật với dữ liệu thật)
```

Đường tới hạn (cập nhật 2026-08-25): **O3, O4, O5 → giao DevOps MISA**, liệt kê tường minh là 3 phụ thuộc song song (không gộp 1 câu — xem ghi chú dưới bảng W1). **O8 → PROVISIONAL** → `W1.AI-POLICY` xây ngay dạng gateway cấu hình được, không chờ. **O6 duyệt $200.** Phụ thuộc ngoài: **O3/bridge contract AMIS Mobile** (DevOps + team AMIS) chặn W2.5/W4.1 phần adapter thật + W3.VOICE.2; **O4** chặn phần chọn backend thật của W1.7 (seam vẫn dựng được); **O5** chặn kết luận PASS/FAIL của W2.3 (harness vẫn dựng được) — KHÔNG cái nào chặn G0/G1/W1.RBAC/W1.8/W1.9/phần contract-ready W2.5.

## Quy ước CI (không đổi từ v2)
- Job **`regression`**: mọi test GREEN mới merge, không exception.
- Job **`security-gap`**: exploit/contract test mô tả hành vi ĐÍCH; mỗi failure kỳ vọng nằm trong allowlist `{F-id hoặc target, owner, expiry}`. **Unexpected failure = build đỏ.**
- Đóng 1 finding/target: xóa allowlist, test chuyển sang `regression`.
- **Manual evidence chỉ cho native host/thiết bị** — không thay API/business-rule regression backend.

---

## GATE 0 — Quyết định & baseline (chỉ đọc + tạo tài liệu, KHÔNG sửa production code)

**Trạng thái Codex round 4 CLOSE, 2026-08-25:** C0.1-C0.8 đều PASS. Owner đã duyệt D13-P1/P2 (“ok nhé, tôi nhất trí đề xuất của bạn”), đóng product-decision gap cuối của C0.2. **CLOSE GATE 0 / OPEN GATE 1.** Native-Mobile vẫn FAIL/P0 hiện trạng và phải được sửa ở wave UI; việc mở G1 không đổi finding này thành PASS.

| # | Task | Trạng thái |
|---|---|---|
| G0.1 | Owner quyết O1-O8 + C0.1 (O1/self-claim/N1/N2) | **XONG.** O6 APPROVED ($200); O2/O7 SUPERSEDED; O3/O4/O5 DEFERRED-TO-DEVOPS; O8 PROVISIONAL; O1/self-claim/N1/N2 APPROVED. D13-P1/P2 phát sinh từ C0.2 cũng đã owner APPROVED 2026-08-25. |
| G0.2 | Memory-bank đủ chủ đề mandate, 1:1 với source | **Cấu trúc XONG (file 01-16); source-fidelity đã sửa (C0.4, 2026-08-25):** index 22 (không phải 21), `dropAll()` 28/34 bảng + 6 bảng bị bỏ sót đúng tên, reminder không có UNIQUE (race check-then-insert), partner detail 10 mảng (không phải 7), booking chỉ `award_id` (không có `event_id` — đăng ký F12), %/diện tích UI gắn nhãn ước lượng, MySQL version tách rõ local-Docker vs Cloud-SQL-UNVERIFIED, `16-coding-rules.md` thêm mục DO/DON'T bắt buộc riêng khỏi mô tả legacy — xem `15-changelog.md`. |
| G0.3 | Inventory 100% route/job/AI/UI | **XONG — Codex round 2+3 xác nhận PASS** (145/145 literal, `07-route-catalog.md`) |
| G0.4 | Ma trận route/flow × surface × role × state × runtime | **C0.3 XONG bởi Codex round 4 (2026-08-25):** Section A auth partition 145/145; Section B có 34 `flow_id`, map R001-R145 đúng một lần, đủ 2 current role × Desktop/Native; Section C tách host capability khỏi OS permission. Native-Mobile vẫn trung thực `FAIL/MISSING` (F5/P0). Verify: `node scripts/verify-g0.mjs`. |
| G0.5 | Error contract | **XONG — PASS** (`05-error-contract.md`, `error===message`) |
| G0.6 | Registry classification | **XONG, redefine theo C0.2:** không còn 1 cờ boolean — `03-data-classification.md` §A/§C giờ là nguồn `classification_tier` (trần bất biến), bảng `field_visibility` (W1.RBAC) là nguồn `audience_visibility` (cấu hình được, chỉ siết không nới dưới trần). O1 APPROVED, không còn block. |
| G0.7 | F10 secret | **XONG — PASS** (placeholder, không phải key sống) |
| G0.8 | Threat model + egress map | **XONG — PASS** (Codex round-3 xác nhận core inventory đúng; 2 sửa diễn đạt P2 — AI-E001 wording, AI-E012 payload — đã áp dụng, `06-threat-model.md` v5) |

**Exit gate G0 (Codex round 4 CLOSE, 2026-08-25): PASS.** C0.1-C0.8 đều PASS; `npm run test:security`, `node scripts/verify-g0.mjs --base=5648042` và `git diff --check` đều xanh. **OPEN GATE 1** theo đúng G1A/G1B/G1C dưới đây. O3/O4/O5 và host/device evidence chỉ chặn các wave được ghi tường minh, không chặn G1.

---

## GATE 1 — Test net (hybrid theo Codex C0.6: characterization-core phủ ĐỦ 145 route, không thu hẹp; target RBAC/security spec-first riêng; thêm lớp acceptance E2E)
**Hiện trạng 2026-08-25:** G1A.1 (harness) **ĐÃ CLOSE** sau 4 vòng remediation (round 1 → HOLD/PARTIAL 5 blocker A1-A5; round 2 → còn R2-01/R2-02/R2-03; round 3 → còn R3-01/R3-02 + R3-03 tự hạ backlog; round 4 → Codex CLOSE, kèm 1 follow-up N4-01 đã vá ngay) — xem dòng G1A.1 dưới. **G1A.2 ĐÃ CLOSE** (2 vòng Codex audit — round 1 CONDITIONAL PASS với 3 điểm remediation, round 2 CLOSE tại commit `82d181d`) — xem dòng G1A.2 dưới. **G1A.3 đã mở.** G1A.9 đã hết `TODO` cho phần thuộc G1A.2 (83 dòng `green`), còn `TODO` cho G1A.3-G1A.8. **Ước lượng còn lại:** ~2-3,5 tuần (điều chỉnh tăng so với bản trước — Codex round-3 re-audit R3-07/C0.6 bác bỏ cách thu hẹp "chỉ phần giữ nguyên", yêu cầu characterization-core phủ TOÀN BỘ 145 route + mọi job/business-flow, không chỉ nhóm module không đổi).

> **Yêu cầu bắt buộc (C0.6, không thương lượng ở Gate 1):** phải có 1 bảng ánh xạ machine-readable `route_id/business_rule_id → test_id → trạng thái (green | known-red | manual-host)` phủ đủ 145/145 route + mọi job/scheduler/monitor flow **trước khi bắt đầu implementation Wave 1** — ước lượng thời gian chỉ đáng tin sau khi bảng này tồn tại, không phải trước.

### G1A — Characterization-core (GREEN) — **TOÀN BỘ 145 route + job/scheduler/monitor/business-flow, không thu hẹp theo "phần giữ nguyên"**
| # | Task | Evidence Contract |
|---|---|---|
| G1A.1 | **XONG — Codex CLOSE 2026-08-25 (round 4, commit `a03d020`).** Lịch sử 4 vòng remediation: round 1 (5 blocker A1-A5) → round 2 (remediate A1-A5, còn R2-01/R2-02/R2-03) → round 3 (remediate R2-01/R2-02/R2-03: resource-stack, opt-in cho cả CREATE/DROP, router-mount verifier parse thật, loopback bind, restore-env — nhưng lộ thêm 2 blocker sâu hơn) → round 4 (remediate R3-01: `server/db.js` bọc `try/catch` quanh `dropAll()/init()/seed()`, đóng worker trước khi rethrow nên `before()` lỗi trong `node:test` không còn treo process — Codex đo độc lập `elapsedMs=241`, không cần kill; R3-02: tách `closeWorker()` thuần, hết TDZ, chỉ resolve khi có `shutdownAck` không lỗi VÀ exit code 0, 8 unit test fake-worker; R3-03 chuyển backlog `G1A.10`, không chặn CLOSE). Codex xác nhận **CLOSE G1A.1, OPEN G1A.2** kèm 1 follow-up không chặn (N4-01: SQLite `DatabaseSync.close()` trả `undefined`, gọi `.catch()` trực tiếp lên đó từng có thể ném `TypeError` che lỗi init/seed gốc) — đã vá ngay cùng lượt đóng gate (`Promise.resolve(db.close()).catch(...)` + try/catch quanh chính lệnh gọi), có regression test `server/test/smoke-failure.test.js` (SQLite-only, ép `init()` throw bằng file `pr.db` hỏng, xác nhận lỗi gốc `file is not a database` được giữ nguyên, không còn `TypeError` che lỗi). Evidence đầy đủ: `15-changelog.md` mục 2026-08-25 CLOSE G1A.1 + vá N4-01 | test / all / `test:integration:sqlite` 15 pass+6 skip, `test:integration:mysql` 20/20 pass+1 skip exit 0 (~1,8-2s), `test:verify-g0-selftest` 6/6, `verify-g0.mjs` PASS, `git diff --check` sạch, 0 leak DB/process — **Codex đã CLOSE, không cần audit lại** |
| G1A.2 | **XONG — Codex CLOSE 2026-08-25 (round 2, commit `82d181d`).** 4 commit theo đúng thứ tự (validation/formatter → SSRF/security → AI redaction/schema → projection/tính toán): `427eb65`/`f7f8cde`/`b015251`/`47b5c8d`. Round 1 audit ra CONDITIONAL PASS với 3 điểm: (1) 3 dòng gắn nhãn `known-red` thực ra là characterization test ĐANG XANH (mô tả đúng gap hiện có, không phải target đỏ) — đã sửa lại `green` + tách rõ khỏi hàng TODO/target thật (`BR-SSRF-016`/`BR-AI-017`) trong `gate1-test-mapping.md`; (2) inventory thiếu `monitor.parseFeed()`/`matchTerms()` + 6 test có sẵn ở `server/security.test.js` chưa vào mapping — đã bổ sung 4 test mới (`BR-SSRF-017..020`) + gắn `BR-VAL-035..040` cho 6 test cũ; (3) `test_id` không join được nguồn — đổi sang bằng `business_rule_id` xuất hiện verbatim trong `test()`. Cả 3 xử lý trong 1 commit remediation (`82d181d`), Codex re-audit CLOSE ngay, còn 1 ghi chú câu chữ không chặn (rule chia sẻ `test()` chung, ví dụ `BR-VAL-002/003` trỏ `test_id=BR-VAL-001`) đã sửa cùng lúc mở G1A.3. Evidence: 83 rule `green` + 5 `TODO` (đều ghi rõ thuộc G1A.3/G1B.4/W1.AI-POLICY, không phải sót của G1A.2), 0 `known-red` sai nghĩa, test/security 6/6, `test:integration:sqlite` 90 pass+6 skip, `test:integration:mysql` 95 pass+1 skip, `verify-g0.mjs` PASS, không sửa business logic khi characterization (chỉ trích xuất thuần hàm inline ở Commit 4, verify bằng smoke test thật + diff giữ nguyên nhánh) — **Codex đã CLOSE, không cần audit lại** | test / all / GREEN |
| G1A.3 | Integration API cho **ĐỦ 145 route** (không giới hạn nhóm module) — request/response shape, validate, not-found/conflict, side-effect DB, tính toán, audit, file/download, side-effect job nền; case tối thiểu mỗi route: happy + invalid + unauthenticated + not-found. **ĐANG LÀM — fast-track protocol (`17-fast-track-collaboration.md`, owner approved `ffdc3df`, 2026-08-26): audit theo batch 15-25 route, không theo từng commit.** Batch "reports-awards" (21 route) và "suppliers" (15 route) **ACCEPTED WITH BACKLOG (Codex 2026-08-26)** — F14 đã fix, F15 backlog Wave 1 (đã lan 4 quan hệ FK lúc đó). Batch "events-dashboard" (R087-R098, 12 route, commit `8baa28d` + fix nit `7cd0142`) **ACCEPT — PASS WITH 1 MINOR TEST ISSUE** (auditor ChatGPT thay Codex CLI hết token, 2026-08-26) — F16 fix giữ nguyên (KEEP), F15 evidence đủ tin cậy coi là vấn đề hệ thống tầng schema/migration (5 quan hệ FK), yêu cầu rõ Wave 1 KHÔNG được sửa bằng DELETE thủ công từng route. 1 nit Low đã sửa: test R098 seed dùng giờ Hà Nội thay UTC (tránh flaky gần nửa đêm VN). Batch "monitor phần 1" (R104-R120, 17 route, commit `0bf0f5f`) — phát hiện+fix **F17 P1** (`POST /api/monitor/scan` trả 500 trên MỌI lượt quét thật trên MySQL do cột `sources.mode` không tồn tại — `ALTER TABLE ... TEXT ... DEFAULT` fail âm thầm trên MySQL vì helper `add()` nuốt hết lỗi; sửa đổi kiểu cột sang `VARCHAR(20)` + sửa `add()` chỉ nuốt lỗi "đã tồn tại", log các lỗi khác). **ACCEPT WITH 1 MEDIUM HARDENING ISSUE (ChatGPT, 2026-08-26)** — F17 diagnosis/fix/test PASS+KEEP, nhưng chỉ `console.error()` cho lỗi lạ mà không rethrow vẫn là cùng class failure (app có thể boot với schema thiếu). Remediation commit `e684918`: `add()` rethrow mọi lỗi không phải duplicate/already-exists (fail-fast thật, không chỉ log), tách `isIgnorableMigrationError()` để test được, thêm `mode VARCHAR(20) NOT NULL DEFAULT 'rss'` trực tiếp vào canonical `CREATE TABLE sources` (fresh schema không còn phụ thuộc migration), test mới BR-VAL-041/042. Full regression (484 integration + 6 security + G0) không hồi quy sau remediation. Batch "monitor phần 2" (R121-R135, 15 route, commit `13501da`) — CRUD sources/competitors/campaigns + campaigns/:id/results/evaluate, không phát hiện bug mới. Batch "ai" (R136-R142, 7 route, commit `fc77674`) — trích xuất giọng nói/thiệp/giải thưởng/sự kiện qua Gemini, **145/145 ROUTE GREEN**. Rà soát toàn bộ SUM()/AVG() trong routes.js trước khi đóng route mapping phát hiện+fix **F18 P1** (commit `4d133d9`, cùng root cause F14/F16, lan ở 3 route report chưa từng sửa: `/reports` 9 mảng breakdown + tiers, `/reports/by-staff` spend/avgScore, `/reports/by-unit` spend, `/reports/awards` mediaCost/totalCost nối chuỗi — vd `totalCost="0300000"`). **Theo amendment §14 `17-fast-track-collaboration.md` (owner approved 2026-08-26): monitor phần 2 + ai là 1 audit-closure bundle, audit một lần trên range `13501da..4d133d9`, không xen giữa.** 41+25 test batch + 10 test F18 xanh cả 2 driver. Full regression 1 lần ở HEAD: SQLite 548 pass/7 skip, MySQL 554 pass/1 skip, security 6/6, verify-g0.mjs PASS. Mapping: **145/145 green** — đóng phần HTTP-route của G1A.3 (chưa đóng toàn G1A/Gate 1, còn job/concurrency/AI golden/security target theo amendment §14) | test / — / — |
| G1A.4 | **XONG — Codex ACCEPT Bundle A 2026-08-28 (commit `99ddbec`).** Reminder check-then-insert (`11-business-flows.md` §E, R3-02C): `server/test/integration-jobs.test.js` gọi thẳng `scheduler.runOnce()` — happy (log in-app đúng ngày/seq), idempotent khi gọi tuần tự, và **CHARACTERIZATION xác nhận tiền đề DB-level của race hiện tại** (chèn trực tiếp 2 dòng `reminder_log` giống hệt nhau, không có UNIQUE constraint chặn — không phải test hành vi đích, không mô phỏng race đồng thời thật trong 1 process vì `runOnce()` không có điểm yield giữa check và insert). Full suite xanh cả hai driver; chưa phải target fix race. | test / — / characterization, không phải target |
| G1A.5 | **XONG — Codex ACCEPT Bundle A 2026-08-28** (remediation commit `163093b` sau 2 MUST-FIX round đầu). `server/test/integration-db-contract.test.js` (5 contract tests, `DB-CONTRACT-001..005`): đủ **35 bảng** (sửa lại từ ghi nhầm "34 bảng" — test `DB-CONTRACT-001` đã luôn xác nhận 35, chỉ prose ở đây bị lệch); cột lõi + migration quan trọng; unique username + round-trip; app_meta upsert; `field_visibility` unique — chạy cả SQLite/MySQL. Codex phát hiện `REQUIRED_COLUMNS.bookings` bị khai báo 2 lần (dòng 29 và 43), JS giữ khai báo sau nên `owner_id` bị mất khỏi yêu cầu — đã gộp thành 1 khai báo duy nhất giữ `owner_id` (server/test/integration-db-contract.test.js:29). F15 (FK parity) vẫn là backlog Wave 1, không bị đóng băng thành contract xanh giả. | test / all / SQLite 5/5, MySQL 5/5; latest full suite SQLite 625 pass/7 skip, MySQL 631 pass/1 skip |
| G1A.6 | **XONG — Codex 2026-08-30.** `server/test/ui-characterization.test.js` thêm 4 rule `UI-CHAR-001..004`: 14 module desktop có nav+resolver; Vue shell nạp `app.js` sau khi đủ mount point; matrix 34 flow/145 route có `N-MISSING` cho cả hai role; compact được ghi đúng là desktop responsive, không phải Native-Mobile. Browser runtime: Admin mở đủ 14 hash; pr_staff bị ẩn/redirect `#reports` và `#admin`; 375×812 không có `.mds-mobile-app`/bottom nav. Evidence chi tiết: `20-ui-characterization.md`. **F5 P0 giữ nguyên** — `green` ở đây chỉ là baseline trung thực, không phải MDS/native pass. | test / all / SQLite 632/639 pass, MySQL 638/639 pass; security 6/6; G0 + mapping PASS |
| G1A.7 | **XONG — Codex xác nhận 2026-08-27.** `server/test/integration-ai-golden.test.js` (18 test: 12 luồng AI-E001..AI-E012 + 6 nhánh lỗi) dùng fake/fixture, không gọi Gemini/Internet thật. SQLite 18/18 và MySQL 18/18 xanh. F19 sửa `COLLATE NOCASE` không portable tại `server/ai.js:26,30`; F20 xác định root cause là SQLite-style named binding `@name` đi qua MySQL adapter và sửa tại `server/mysql-sync.js` bằng `bindSqliteNamedParams()`, có unit regression. Full regression sau đó là điều kiện tiếp theo của Bundle A; không coi đây là G1A/Gate 1 CLOSE | test / all / GREEN |
| G1A.8 | **XONG — Codex ACCEPT Bundle A 2026-08-28 (commit `99ddbec`).** `server/test/integration-jobs.test.js` verify side-effect DB thật (không chỉ route HTTP): `JOB-REMINDER` (đã gộp ở G1A.4) + `JOB-MONITOR-SCAN` — gọi thẳng `monitor.runScan({triggeredBy:'auto'})` KHÔNG truyền `queryIds` (đúng đường job tự động thật, khác route thủ công `POST /monitor/scan` luôn yêu cầu `query_ids` tường minh), network-safe (tắt hết `sources`, rỗng `include`), verify `scan_runs.queries` = đúng số query đang enabled; `monitor.applySchedule()` verify không leak timer qua theo dõi `setInterval`/`clearInterval`. | test / — / — |
| G1A.9 | **MAPPING VERIFIER ĐÃ IMPLEMENT — `npm run test:verify-gate1-mapping` PASS.** Kiểm tra machine-readable: route catalog 145/145, mỗi route đúng một row, file/status hợp lệ; còn đúng 2 TODO target có owner/wave (`BR-AI-017`, `BR-AI-018`), không phải ô trống characterization. Bốn known-red G1B đều có allowlist hợp lệ; UI characterization thêm `UI-CHAR-001..004` mà không ảnh hưởng route partition. | test / all / `145/145`, 253 rows, TODO=2, known-red=4 |
| G1A.10 | **CLOSED 2026-08-30 — GitHub Actions run xanh thật: [`33264995903`](https://github.com/tuannhh/MISA-workstation/actions/runs/33264995903), commit `f9c57ee`, PR #1 (`ci/g1a10-regression-workflow` → `main`).** `npm audit` 3 lỗ (body-parser 1.20.5→1.20.6, nanoid 3.3.16→3.3.18, postcss 8.5.19→8.5.26 — patch-level, không đổi range trong `package.json`) vá kèm test (`server/test/unit-dependency-audit.test.js`), không `audit fix` mù: đọc source `raw-body`/`body-parser` xác nhận đúng cơ chế lỗ hổng (`limit` không hợp lệ → `bytes.parse()` trả `null` → `raw-body` bỏ qua MỌI kiểm tra kích thước) trước khi vá; test xác nhận bản vá throw `TypeError` fail-fast thay vì âm thầm tắt giới hạn, cộng 1 test không-regression cho cấu hình thật (`limit:'2mb'`). nanoid/postcss xác nhận chỉ là devDependency build-tool (postcss/tailwind/vite), không có đường chạy runtime trong Express server nên không cần test hành vi runtime, chỉ version bump. `npm audit` sau vá: 0 vulnerabilities. CI `regression` (`.github/workflows/regression.yml`, mới): service container MySQL khớp `docker-compose.yml`, chạy `npm audit` + `npm run build` + `test:security` + `verify-g0.mjs` + `verify-g0-selftest` + `verify-gate1-mapping` + `test:integration:sqlite`/`mysql` + `git diff --check` — chưa verify chạy thật trên GitHub (cần push/PR đầu tiên để xác nhận), chỉ verify được cục bộ từng lệnh riêng lẻ đều xanh. **Codex CONDITIONAL ACCEPT + remediation (commit `09a40c3`):** C1 `--audit-level=high` che giấu lỗ hổng mức low/moderate trái exit criterion "0 vulnerabilities" → đổi về `npm audit` thuần; C2 CI chưa chạy build tool thật (nanoid/postcss vừa nâng version) → thêm step `npm run build` (verify local: 6182 module, output `public/assets/` khớp byte-for-byte bản đã commit). Codex nêu rõ: **G1A.10 chỉ thật sự CLOSE sau khi owner push và có ít nhất 1 GitHub Actions run xanh thật** — YAML parse cục bộ không kiểm chứng được MySQL service container/runner Actions. **Lần chạy thật đầu tiên (run `33264742127`, commit `3d26864`) FAIL thật, không phải flaky:** test `server/test/smoke-failure.test.js` ("DB init failure sau khi worker đã spawn") kỳ vọng lỗi MySQL khớp `/Unknown database/i`, nhưng đó chỉ đúng do máy dev cục bộ có 1 GRANT thừa kế từ thiết kế cũ (`GRANT ALL PRIVILEGES ON \`pr_media_test_%\`.* TO 'pr_media'@'%'`, xác nhận qua `SHOW GRANTS FOR 'pr_media'@'%'` — không nằm trong code/harness hiện tại). Container MySQL sạch của GitHub Actions chỉ có đúng quyền `docker-compose.yml` cấp (least-privilege, khớp production thật) nên trả `"Access denied"` trước khi kịp báo database không tồn tại — đây là khác biệt môi trường hợp lệ, không phải lỗi code: cả 2 thông điệp đều chứng minh đúng mục tiêu test (DB init thất bại rõ ràng, process tự thoát khác 0, không âm thầm PASS). Owner quyết định: sửa assertion chấp nhận cả 2 (`/Access denied|Unknown database/i`), **không sửa MySQL grant, không nới quyền, không đổi harness**. Vá trong commit `f9c57ee`, verify lại toàn bộ (SQLite 628/635, MySQL 634/635, `git diff --check` sạch) trước khi push lại — run `33264995903` xanh. **Backlog DevOps bổ sung (Codex re-audit round 3, R3-03, hạ từ blocker G1A.1 xuống SHOULD-FIX vì xác suất thấp trong môi trường local kiểm soát):** harness `test:integration:mysql` hiện mặc định bootstrap admin tới `TEST_MYSQL_HOST/PORT=127.0.0.1:3306` — về lý thuyết không phân biệt được container Docker MySQL test với một Cloud SQL Proxy local khác đang chiếm đúng loopback/port đó. Khi làm CI/devops hardening thật: pin Docker test sang cổng riêng (vd `127.0.0.1:3307`) + `TEST_MYSQL_*` khai báo rõ trong CI, hoặc thêm sentinel/identity check trước mọi DDL. Chưa chặn CLOSE G1A.1 | deploy / all / job `regression` xanh |

> **Execution update — 2026-08-26:** route characterization đã đạt **145/145 green** tại `fc77674`; `monitor-2` là `13501da` (R121–R135) và `ai` là `fc77674` (R136–R142). Hai commit là một audit-closure bundle duy nhất theo `17-fast-track-collaboration.md` §14, **chưa audit-close** tại thời điểm ghi. Hai background job vẫn `TODO`; vì vậy G1A.3/Gate 1 chưa được CLOSE chỉ từ con số 145/145.

> **Execution update — 2026-08-27:** Bundle A jobs (`99ddbec`), AI golden (`6a3ca0e` + Codex remediation hiện tại), DB contract (`integration-db-contract.test.js`) và SSRF target G1B.4 đã có evidence xanh cả hai driver. Latest full regression: SQLite 586 pass/7 skip, MySQL 592 pass/1 skip, security 6/6, G0 + mapping verifier PASS. G1A.4/G1A.5/G1A.7/G1A.8 là **implemented/green, chờ Bundle A audit closure**; G1B.1/.2/.3/.5/.6 vẫn mở. Không chuyển sang Wave 1 implementation chỉ vì test characterization đã xanh.

> **Execution update — 2026-08-30 (G1A.6):** G1A.9 mapping 145/145 — PASS. G1A.6 đã bổ sung
> UI characterization cho mọi module; vì vậy **toàn bộ hạng mục Gate 1 đã có evidence theo exit
> contract**: G1A xanh, G1B known-red có allowlist, G1C.1 có framework và G1.8 có artifact. Đây
> đóng **Gate 1 test-net**, không phải release MDS/native: F5 vẫn P0 `FAIL/MISSING` cho 34/34 flow
> tới khi Wave 3/4 có Native-Mobile composition + WebView-host/device evidence thật.

### G1B — Target RBAC v2 + security suite (KNOWN-RED, allowlist) — spec-first cho phần VIẾT LẠI (D13/F1/F2/F3/F9)
| # | Task | Evidence Contract |
|---|---|---|
| G1B.1 | **Engine hoàn tất đủ D13.4a — Codex ACCEPT phần engine trong Bundle A 2026-08-28** (CHƯA đóng cả gate, xem ghi chú Codex cuối dòng) (`18-g1b-rbac-batch-contract.md#batch-g1b1-engine-completeness-2026-08-28`): thêm nhóm `INHERITED` (event_cost kế thừa owner_id của event cha — hàng "Chi phí sự kiện" D13.4a đã owner-approved, code trước đó thiếu) vào `policy-engine.js`; mở rộng `unit-policy-engine.test.js` phủ đủ 14 Direct + 4 Global + 6 Module-admin-only + 1 Inherited (D13-012..016, tất cả GREEN — engine đã đúng generic cho phần lớn, chỉ event_cost RED trước khi thêm INHERITED). **Owner đã duyệt mở rộng route-wiring ra toàn bộ 24 entity còn lại (2026-08-30), tự chọn cách chia batch — không còn cần xin thêm cho scope chung, chỉ còn tiến độ từng batch.** Tiến độ route-wiring (ghi/create/edit/delete, GET/view của TẤT CẢ entity kể cả `person` vẫn còn khoảng trống chung — xem ghi chú batch RBAC-EXP-B1): `person` (pilot, GET detail + PUT/DELETE + file) XONG; **Batch 1/6 — 6 entity Module-admin-only (budget/scan_query/source/competitor/campaign/monitor_alert) XONG 2026-08-30** (`18-g1b-rbac-batch-contract.md#batch-rbac-exp-b1-module-admin-2026-08-30`); còn 18 entity (14 Direct + 3 Global + 1 Inherited) chưa làm — batch RBAC-EXP-B2..B6 tiếp theo. Money/file (G1B.2) đã có nền: `classification_tier=Confidential` cho field tiền (D13-016), file visibility ceiling (D13.3b) chưa test HTTP vì chưa có route file nào gắn PolicyEngine ngoài `person`. **Batch RBAC-CUTOVER 2026-08-30 (owner chốt, `02-decisions.md` §G.1) — XONG:** bỏ hoàn toàn hệ 2-role legacy (`super_admin`/`pr_staff`) khỏi `server/rbac.js`, chuyển dứt khoát sang DUY NHẤT 4 vai trò D13 (`viewer/executor/admin/super_admin`); route chưa gắn PolicyEngine (121/145 còn lại) nay tự động đúng cho cả 4 vai trò qua MATRIX mở rộng, không còn 403 sai cho viewer/admin; phát hiện+vá luôn 1 gap D13.1 (Admin vô tình có full quyền module `admin` giống Super Admin — đã guard riêng, test D13-031..034). **Batch RBAC-FIELDVIS-FIX 2026-08-30 (P0 tự phát hiện trước Batch 2) — XONG:** field Public-tier bị ẩn mặc định cho viewer/executor (không chỉ field mật) — đã sửa `canReadField()`/`isPublic()` đúng D13.2b, phát hiện thêm MySQL chưa dịch đúng UPSERT `field_visibility`. **Batch RBAC-EXP-B2 2026-08-30 (2/6 — Global còn lại: organization/supplier/important_date) — XONG:** `GET/PUT/DELETE /api/partners/:id`, `/api/suppliers/:id`, `PUT/DELETE /api/reminders/:id` gắn PolicyEngine giống pattern `person`; dọn `stripDisallowed()` đã hết call site thật. **Batch RBAC-EXP-B3 2026-08-30 (3/6 — 2 entity Direct đầu tiên: booking/interaction) — XONG:** `POST /api/interactions` (create+owner_id), `GET/POST/PUT/DELETE /api/bookings`+`/:id` gắn PolicyEngine — executor CHỈ sửa bản ghi CHÍNH mình tạo (`owner_id`), KHÔNG BAO GIỜ xoá được kể cả chủ sở hữu (khác Global — điểm này chủ đã hỏi lại và xác nhận qua AskUserQuestion). Xem execution update chi tiết dưới `WAVE 3` header. | test / — / engine GREEN đủ D13.4a; 2-role legacy ĐÃ BỎ HOÀN TOÀN; route-wiring PolicyEngine chi tiết: person + 6 entity Module-admin-only + 3 entity Global + 2 entity Direct (booking/interaction) XONG (12/24); còn 12 Direct + 1 Inherited — batch RBAC-EXP-B4..B6 tiếp theo |
| G1B.2 | Money/file policy = 1 phần của G1B.1 (không còn suite riêng): field tiền chỉ là field `classification_tier=Confidential` — **engine đã phủ đủ (D13-016)**; direct-ID file access theo trần server-derived + per-file visibility (D13.3b); derived/aggregate (`grandTotal` kiểu) không rò rỉ field bị ẩn (D13.4b) — 2 mục sau vẫn cần route wiring thật, chưa làm | test / — / classification engine GREEN, file/aggregate vẫn RED allowlist `D13` |
| G1B.3 | **Test target-red XONG — Codex ACCEPT Bundle A 2026-08-28** (`server/test/target-session-f2.test.js`, batch contract `18-g1b-rbac-batch-contract.md#batch-g1b3-session-2026-08-28`). Dựng cơ chế allowlist known-red bắt buộc theo G1B.6 (`server/test-support/known-red.js` + `memory-bank/g1b-allowlist.json`) vì trước đó chưa tồn tại. `F2-logout-invalidation` hoá ra đã GREEN sẵn (`session.destroy()` đã vô hiệu cookie cũ) — ghi nhận characterization, không đưa vào allowlist. **Implement thật (W1.7) ĐÃ XONG 2026-08-30** — `F2-fixation`/`F2-ratelimit` promote sang assertion xanh thật, xoá khỏi allowlist (xem W1.7 execution update). | test / — / GREEN thật, 0 known-red finding (chỉ còn `INFRA-known-red-selftest`, không phải finding) |
| G1B.4 | **XONG — F3 CLOSED 2026-08-27, Codex ACCEPT Bundle A 2026-08-28.** `safeFetch` chung chặn localhost/RFC1918/link-local/metadata/IPv6 private, DNS trả địa chỉ private, URL credential và redirect; transport pin IP đã verify để tránh DNS rebinding TOCTOU, cap body 2 MiB. Áp dụng monitor, grounding, create/update source và award-extract. Test BR-SSRF-010/011, BR-SSRF-021..028, R122/R139 xanh. `OUTBOUND_ALLOWED_HOSTS` là allowlist runtime tùy chọn, fail-closed khi được cấu hình. | code+test / all / GREEN |
| G1B.5 | **XONG — implement thật 2026-08-30 (Claude, Wave 1 nhánh security).** N1: 4 route side-effect (`/notifications/:id/read`, `/notifications/read-all`, `/reminders/run`, `/monitor/alerts/:id/read`) nay dùng action tường minh `ack`/`run` thay vì tái dùng `view`; `rbac.js` MATRIX thêm `ack`/`run` cho cả 2 role hiện tại (giữ nguyên quyền thực tế, chỉ tách action). N2: `GET /dashboard` nay có `requirePerm('dashboard','view')`; `rbac.js` khai thêm module `dashboard`, cấp `['view']` cho cả 2 role. `server/test/target-n1-n2-explicit-permission.test.js` promote từ known-red sang assertion xanh thật, 2 entry xoá khỏi `g1b-allowlist.json`. Route catalog (`07-route-catalog.md` R058/R059/R060/R098/R116) + permission matrix (`08-permission-matrix.md`, thêm module `dashboard` riêng, tách khỏi hàng "không thuộc module nào") cập nhật khớp; `scripts/verify-g0.mjs` thêm `dashboard` vào whitelist Section A. Known-red self-test (`known-red-fixture.js`) trước đây mượn tạm entry N1 làm fixture — tách thành id infra riêng `INFRA-known-red-selftest` (không phải finding thật, expiry 2099) để không phụ thuộc còn known-red thật nào mở. | test+code / — / GREEN, mapping known-red=1 (chỉ còn entry infra self-test, 0 finding thật) |
| G1B.6 | **XONG — Codex ACCEPT Bundle A 2026-08-28.** Mỗi RED ghi `{F-id/D13-target/N-id, owner, expiry}`; unexpected failure ngoài allowlist = build đỏ. Hardened theo remediation: bản đầu `known-red()` bắt MỌI exception (kể cả TypeError/lỗi fixture không liên quan) làm PASS giả — sửa bắt buộc tham số `expectedError` (RegExp/predicate), lỗi không khớp bị ném lại nguyên văn thay vì nuốt; có self-test qua child-process (`target-session-f2.test.js`) chứng minh cả 2 chiều. `verify-gate1-mapping.mjs` mở rộng đối chiếu allowlist: mỗi known-red row phải có entry `{id,owner,expiry,wave}` hợp lệ chưa hết hạn, không trùng, không mồ côi. | test / all / CI `security-gap`; verifier đối chiếu allowlist đã implement |

### G1C — Acceptance E2E (GREEN sau Wave 1, mới theo C0.6) — journey đại diện 4 vai trò
| # | Task | Evidence Contract |
|---|---|---|
| G1C.1 | **Khung ĐÃ ĐỊNH NGHĨA 2026-08-30** (`19-g1c-e2e-acceptance-framework.md`) — chưa có test thật, đúng yêu cầu "không viết trước W1". Chốt: công cụ Playwright (chưa cài `@playwright/test`, để dành khi slice đầu tiên có test thật); quy ước thư mục `e2e/journeys/<role>.spec.js`; 4 journey đại diện đúng ranh giới D13.1 mỗi vai trò (Viewer: field private bị ẩn/không có nút sửa; Nhân viên thực thi: tự xem đủ bản ghi mình owner + bị chặn sửa bản ghi người khác + không có nút xoá; Admin: gán lại owner + xoá được nhưng không thấy audit_log/API key config; Super Admin: audit_log + đổi role + API key config, Admin truy cập trực tiếp phải 403); khối `Native-Mobile` mỗi journey giữ `test.fixme()` tới khi W4.1 hạ cánh. Chưa đưa vào CI `regression` (cố tình — tránh cài công cụ nặng chỉ để chạy 0 test thật). | test / all / GREEN sau W1, không phải điều kiện mở W1 |

### Perf baseline (song song, KHÔNG block)
| # | Task | Evidence Contract |
|---|---|---|
| G1.8 | **CLOSED 2026-08-30 — Codex ACCEPT sau 2 vòng remediation.** `scripts/perf-baseline.mjs` (`npm run perf:baseline`): harness assert `DB_CLIENT===mysql` + `ALLOW_TEST_DB_CREATE=1`; profile 1/5/10/20/50, warm-up 3s + sustained 8s, mix read 55/write 15/report 20/file 10; artifact `memory-bank/perf-baseline/2026-08-30T03-44-04-278Z.json` (`gitSha=018c7af`, đúng commit remediation round 2) ghi đủ engine (Atomics.wait note F7)/gitSha/topology (local Docker, không phải Cloud Run)/CPU-RAM/pool (1 connection duy nhất, không phải pool)/cardinality (50 org, 200 người, 500 tương tác). Kết quả thật: throughput **~49–61 rps, không tăng theo concurrency** (1→50), latency p50 tăng tuyến tính 4.4ms→889ms, errorRate=0 mọi mức — khớp đúng dự đoán F7 (nghẽn cổ chai ở 1 connection worker + Atomics.wait main-thread, không phải lỗi ứng dụng). **Round 1 (commit `436bbe4`):** (1) rò 4 file dummy thật vào `data/uploads/` do thiếu `setupTestDataDir()` trước khi require `server/db.js` — đã quarantine (`data/uploads/.quarantine-perf-baseline-leak/MANIFEST.md`, không xoá) + xác nhận không có row `attachments` nào trong DB thật tham chiếu; (2) `closeDb()` bị `.catch(() => {})` nuốt lỗi cleanup — sửa dùng `server/test-support/resource-stack.js`; (3) số liệu ghi sai. **Round 2 (commit `018c7af`):** `resources.acquire(setupTestDataDir().teardown)` + `createMysqlTestDb()` vẫn nằm NGOÀI try/finally — bootstrap MySQL lỗi thì finally không chạy, rò thư mục `DATA_DIR` tạm (Codex tái hiện bằng `TEST_MYSQL_ADMIN_PASSWORD` sai). Fix: chuyển cả 2 dòng vào trong try; thêm regression failure-path mới `server/test/perf-baseline-failure.test.js` (spawn thật script, assert exit≠0 + số thư mục `pr-media-test-*` không đổi). Verify sau round 2: process tự thoát (exit 0), không còn DB tạm, không có file mới trong `data/uploads/`, artifact SHA khớp commit, full regression (SQLite 632/8 skip, MySQL 639/1 skip, security 6/6, mapping 145/145) không hồi quy. Đây là công cụ ĐO, không kết luận pass/fail — ngưỡng SLO thật chốt ở W2.3 (DevOps). **Codex ACCEPT/CLOSE 2026-08-30:** "Fix round 2 đúng và đủ, không còn blocker"; chạy độc lập `perf-baseline-failure.test.js` 1/1 pass, `verify-g0`/mapping xanh; F7 **vẫn là backlog hiệu năng cho W2.3/W2.4**, không coi là đã xử lý tận gốc chỉ vì có artifact đo. | test / — / artifact có, số liệu xác nhận rõ ràng nghẽn cổ chai F7, Codex ACCEPT sau 2 vòng remediation |

**Exit gate G1 (cập nhật theo C0.6):** (a) G1A.9 mapping 145/145 + job/flow tồn tại và đúng; (b) G1A GREEN đầy đủ (không phải chỉ "phần giữ nguyên"); (c) G1B mọi RED có allowlist hợp lệ, không unexpected failure, KHÔNG có RED nào đóng băng hành vi cũ thành "đúng"; (d) G1C khung đã định nghĩa (chưa cần xanh); (e) G1.8 có artifact. Không mechanical refactor khi G1A còn ô trống trong mapping.

---

## WAVE 1 — RBAC v2 nền tảng (D13) + security root-cause
**Ước lượng:** 3-5 tuần (khối lớn nhất). Nền tảng cho mọi wave sau.

> **Ngoại lệ thứ tự phạm vi hẹp (owner, 2026-08-28 — `02-decisions.md` §G):** foundation fail-closed
> (`W1.RBAC.0`, `W1.1`, registry phân loại, `W1.POLICY`) và ĐÚNG 1 pilot slice runtime (People
> Detail) được phép chạy trước khi G1B/G1C/G1.8 đóng đủ Exit gate G1, để rút ngắn tiến độ — nhưng
> **KHÔNG** được cutover role hàng loạt, bật RBAC v2 mặc định toàn hệ thống, chuyển production, hay
> tuyên bố Wave 1/Gate 1 "hoàn tất". Slice pilot mới ngoài People Detail phải hỏi lại owner trước.

### W1 — nhánh RBAC v2 (D13, gộp F1/F9/F11 + money/file policy)
| # | Task | Phụ thuộc | Evidence Contract |
|---|---|---|---|
| W1.RBAC.0 | **Preflight/rollback gate cho reset (Codex C0.5, thay "additive migration + seed sạch"):** (1) DevOps xác nhận đúng project/instance/database + xác nhận không có user/dữ liệu thật cần giữ; (2) chụp backup/export HOẶC ghi rõ owner-approved chấp nhận không khôi phục được; (3) tạo database/schema MỚI TRỐNG, áp migration versioned từ đầu, verify đủ 34/34 bảng + constraint + seed invariant (không dùng `dropAll()` hiện tại); (4) giữ database cũ, chỉ chuyển traffic sau khi smoke+security test pass trên database mới; (5) nếu phát hiện dữ liệu cần giữ ở bất kỳ bước nào → DỪNG, khôi phục đầy đủ quy trình R1.0-R1.7 (backfill/reconcile/canary) thay vì tiếp tục reset | — | deploy / — / preflight bắt buộc trước W1.RBAC.1 |
| W1.RBAC.1 | Schema: bảng `field_visibility(module, field, is_public)` + seed `classification_tier` cứng (D13.2a); thêm `created_by`(bất biến)+`owner_id`(gán lại được) cho 14 bảng "hoạt động" (10 bảng chưa có — xem D13.4) + resource-policy cho nhóm global/inherited/module-admin-only (D13.4a); cột visibility per-file trên `attachments` (D13.3) + trần server-derived (D13.3b). **Reset strategy sửa lại theo Codex C0.5 (2026-08-25) — KHÔNG dùng `dropAll()`/`RESET_DB`/`npm run seed` hiện tại** (Codex round-3 chứng minh chỉ xoá 28/34 bảng, 6 bảng bị bỏ sót — `09-db-schema.md` §E): dùng **fresh database/schema cutover** theo preflight/rollback gate ở W1.RBAC.0 dưới | W1.RBAC.0 | migration+test / — / — |
| W1.RBAC.2 | 4 vai trò (Viewer/Nhân viên thực thi/Admin/Super Admin) thay 2 role hiện tại; seed `field_visibility` mặc định `private` cho mọi field trong 6 nhóm mật cũ + 2 field % + tài liệu (D13.2, `03-data-classification.md`) | W1.RBAC.1 | code+test / — / fail-closed |
| W1.POLICY | `DATA_POLICY_REGISTRY` nguồn = bảng `field_visibility` động (KHÔNG hard-code) + `PolicyEngine` (authorizeRead/Write/Attachment) đọc role 4 cấp + ownership + visibility. Choke point tầng service, fail-closed 403, KHÔNG silent-strip (D1) | W1.RBAC.2 | code+test / — / fail-closed 403 |
| W1.POLICY.2 | Service command = choke point mọi sensitive write; wrapper `authorizedInsert/Update` bắt buộc `principal+resource+operation`; CI static rule cấm raw SQL ghi field ngoài policy (dọn 10 nhóm write-bypass F1 + 3 cách mask song song — `16-coding-rules.md` §8) | W1.POLICY | code+test / — / fail-closed |
| W1.OWN | Logic ownership: quyền sửa = `user.id===owner_id` HOẶC Admin/Super Admin bypass; delete chỉ Admin/Super Admin (D13.4b); Nhân viên thực thi tự xem đầy đủ bản ghi mình `owner`; Admin gán/gán lại `owner_id` (giải quyết cả dữ liệu cũ owner=NULL + nhân viên nghỉ việc). **Không self-claim — owner APPROVED 2026-08-25** (D13.4c, C0.1, không còn là mặc định chờ xác nhận). Bao gồm resource-policy nhóm global/inherited/module-admin-only (D13.4a) cho organizations/people/suppliers/important_dates/budgets/event_costs/monitoring | W1.POLICY | code+test / — / fail-closed |
| W1.ADMIN | Màn hình Admin (Desktop MDS): (a) cấu hình field public/private theo module; (b) gán/gán lại owner cho bản ghi; (c) quản vai trò 4 cấp. Super Admin thêm: cấu hình API key, xem `audit_log` | W1.OWN | code+test / — / — |
| W1.FILE | Attachment: visibility per-file lúc upload (D13.3), classification server-derived cho gate `/files/:id` theo owner+action+visibility (D3, F9). File cũ default `private`. **Không cần R1 dual-write/reconcile — dữ liệu bỏ được, seed sạch** | W1.POLICY | code+test / — / fail-closed |

> **R1.0–R1.7 cũ (dual-write/backfill/reconcile/shadow/canary/rollback) BỎ, có điều kiện (Codex C0.5/R3-06, không phải bỏ vô điều kiện).** Chỉ được bỏ khi W1.RBAC.0 (preflight) xác nhận không có dữ liệu thật cần giữ. Nếu bất kỳ bước preflight nào phát hiện dữ liệu cần giữ, **khôi phục toàn bộ quy trình R1** (ghi lại ở đây để không mất kiến thức: bản v2 §R1 trong git history commit trước `04-ROADMAP.md` v3). **Lưu ý (Codex C0.5 mục cuối):** dữ liệu test bỏ được KHÔNG có nghĩa các rủi ro khác (F2 session, F3 SSRF, F4 AI-egress, F7 Atomics) cũng bỏ được — môi trường test công khai vẫn mang credential Cloud/session/SSRF exposure thật, vẫn phải sửa theo đúng lộ trình W1.7/W1.8/W1.AI-POLICY/W2.3, không được coi nhẹ vì "chỉ là test".

> **O3/O4/O5 → DevOps MISA là 3 phụ thuộc ngoài SONG SONG, không phải chỉ bridge AMIS Mobile là phụ thuộc duy nhất (Codex C0.5, sửa cách diễn đạt trước đây gộp cả 3 vào 1 câu "bridge contract"):** O3 (auth/bridge contract) chặn W2.5 phần adapter thật + W3.VOICE.2 + W4.1; O4 (session store) chặn phần chọn backend thật của W1.7 (seam vẫn dựng được không cần chờ); O5 (SLO/topology) chặn kết luận PASS/FAIL của W2.3 (harness đo vẫn dựng được không cần chờ). Cả 3 **không chặn G0/G1/W1.RBAC/W1.8/W1.9** — chỉ chặn đúng gate cụ thể của từng cái, liệt kê tường minh thay vì gộp chung.

> **Execution update — 2026-08-30 (Gate 1 đã đóng, Wave 1 bắt đầu):** Gate 1 CLOSED (G1A/G1B/G1C.1/G1.8 đều đủ evidence — xem `15-changelog.md`), nên ngoại lệ phạm vi hẹp ở `02-decisions.md` §G (chỉ 1 pilot slice, không cutover) không còn là giới hạn thời gian ràng buộc — nhưng vẫn tiếp tục theo đúng tinh thần đó (test-first, dual-driver, không big-bang) cho tới khi có quyết định owner khác. Batch `RBAC-PILOT2-people-write` (`memory-bank/18-g1b-rbac-batch-contract.md`): mở rộng pilot People Detail từ chỉ READ (D13-011) sang **WRITE** — `PUT`/`DELETE /api/people/:id` nay đi qua `policyService.assertWritable()` cho role D13 (viewer 403 mọi write; executor PUT 200 vì `people` là Global-edit theo D13-P1, DELETE 403 vì D13.1 cấm Nhân viên thực thi xoá; admin PUT+DELETE đều 200), nhánh legacy 2-role giữ nguyên 100% qua `requirePerm`+`stripDisallowed` cũ. Route catalog R032/R033 cập nhật theo đúng pattern carve-out đã dùng cho R030 (`scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES`). 4 test dual-driver mới (D13-012..015). Full regression sau batch: security 6/6, SQLite 636/8 skip, MySQL 643/1 skip, mapping 145/145, `verify-g0.mjs` PASS. **Còn lại của "People Detail end-to-end"**: W1.FILE (attachment visibility gate cho person) — batch kế tiếp; sau đó mới tới acceptance money/supplier/booking/event theo đúng thứ tự batch contract.

> **Execution update — 2026-08-30 (batch RBAC-PILOT3-people-file, hoàn tất "People Detail end-to-end"):** Batch `RBAC-PILOT3-people-file` (`memory-bank/18-g1b-rbac-batch-contract.md`) nối `POST`/`PUT`/`DELETE` attachments của person + `GET /api/files/:id` vào PolicyEngine cho role D13, đóng nốt phần W1.FILE còn thiếu của People Detail. `policy-engine.js` thêm `attachmentVisibilityCeiling`/`canSetAttachmentVisibility`/`canReadAttachment` (pure, D13.3b: trần `id_doc=private` **tuyệt đối, kể cả Admin không có ngoại lệ**; trần `portrait=public`). Vì `person` là Global (D13.4a, không có `owner_id`), `canReadAttachment` KHÔNG có nhánh executor-owns-record như `canReadField` — file `private` chỉ Admin/Super Admin đọc được, kể cả chính người đã upload. `GET /api/people/:id` nhánh D13 (trước đây trả `portraits:[]/idDocs:[]` tạm ở RBAC-PILOT2) nay trả dữ liệu thật có gate; `idDocCount` vẫn hiển thị đúng số lượng cho mọi role (tồn tại) nhưng `idDocs` rỗng nếu không phải Admin/Super Admin (nội dung) — đúng D13.4b "mọi role thấy sự tồn tại, không nhất thiết thấy nội dung". `DELETE /api/attachments/:aid` và `GET /api/files/:id` phục vụ nhiều `owner_type` (award/supplier/event...) — role D13 đụng attachment không phải của `person` bị fail-closed 403 (chưa có policy slice riêng), không tự suy diễn. Route catalog R034/R035/R036 cập nhật theo đúng pattern carve-out đã dùng cho R030/R032/R033; 3 route mới khai ở `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES`. 9 test dual-driver mới (D13-016..024) phủ: gate 403 cho viewer; executor upload private mặc định tự mình cũng không thấy lại (không có owner bypass trên Global); upload `visibility=public` thấy lại được; id_doc chỉ Admin/Super Admin (upload/delete/xem); trần D13.3b không có ngoại lệ Admin (upload id_doc kèm `visibility=public` vẫn 400); fail-closed 403 khi `owner_type` khác person. Full regression sau batch: security 6/6, SQLite 645/8 skip, MySQL 652/1 skip, mapping 145/145, `verify-g0.mjs` PASS, `git diff --check` sạch. **"People Detail end-to-end" (read, write, file) nay đã đủ cả 3 phần theo đúng thứ tự bắt buộc của `18-g1b-rbac-batch-contract.md`** — bước tiếp theo là **acceptance money/supplier/booking/event**, cần hỏi lại owner trước khi mở rộng pilot slice mới (`02-decisions.md` §G).

> **Codex ACCEPT — 2026-08-30:** "People Detail end-to-end (read/write/file) CLOSED cho phạm vi pilot D13." Evidence Codex tự xác nhận: write gate `routes.js:452`, file upload/primary/delete `routes.js:496`, file download chặn owner_type ngoài `person` `routes.js:591`, trần `id_doc=private`/`portrait=public` server-derived tại `policy-engine.js:52`. Experiment: `integration-people.test.js` 47/47 pass cả SQLite lẫn MySQL; unit PolicyEngine 10/10; security 6/6; mapping + G0 xanh. Risk ghi nhận: `R034` cho phép upload với person ID không tồn tại là hành vi legacy characterization có từ trước, không do batch này tạo ra, không mở rộng sửa để tránh đổi contract ngoài scope. Quyết định: dừng trước slice money/supplier/booking/event là đúng §G — chờ owner xác nhận trước khi mở slice mới.

> **Execution update — 2026-08-30 (W1.7 session hardening, nhánh security độc lập RBAC):** Vì slice money/supplier/booking/event cần owner xác nhận trước (§G), tiếp tục nhánh W1 security (không phụ thuộc quyết định đó) — implement thật seam F2 đã có target-red từ G1B.3 (`server/test/target-session-f2.test.js`). `server/app.js`: fail-fast nếu `NODE_ENV=production` thiếu `SESSION_SECRET`; `app.set('trust proxy', 1)` + `cookie.secure=true` khi production. `server/auth.js`: `req.session.regenerate()` sau xác thực thành công (chống fixation); audit thêm `LOGIN_FAILED`/`LOGOUT` (trước chỉ audit `LOGIN` thành công). `server/login-rate-limiter.js` (mới): chặn brute-force `/api/login`, 429 sau 5 lần sai liên tiếp trong 15 phút theo khoá `IP:username` — in-memory, đủ cho single-instance hiện tại, thay được bằng store dùng chung (Redis) sau interface này nếu sau này cần multi-replica (không phải quyết định của batch này). `F2-fixation`/`F2-ratelimit` promote từ known-red (G1B.6) sang assertion xanh thật, xoá khỏi `memory-bank/g1b-allowlist.json`; thêm 4 test mới (audit login-failed/logout, fail-fast production, cookie Secure production — `server/test/integration-session-production.test.js`). **Còn lại của F2 (không thuộc batch này):** durable session store (SQL/Redis) thay MemoryStore — chờ DevOps chọn implementation (O4), chỉ thật sự cần khi multi-replica hoặc muốn tránh mất session lúc Cloud Run redeploy. Full regression: security 6/6, SQLite 649/8 skip, MySQL 656/1 skip, mapping 145/145 (known-red còn lại: N1/N2, không liên quan F2), `verify-g0.mjs` PASS, `git diff --check` sạch.

### W1 — nhánh security (độc lập RBAC, chạy song song)
| # | Task | Finding | Phụ thuộc | Evidence Contract |
|---|---|---|---|---|
| W1.1 | Principal seam `resolvePrincipal(req)→req.principal` (Commit A, provider=web session) | F6/auth | G1A | code+test / all / — |
| W1.7 | Session hardening (F2): `secure`, regenerate login, rate-limit brute-force, fail-fast secret, revoke/logout, audit. **Backend store (bảng SQL/Redis) = interface, DevOps chọn implementation** (O4→DevOps). **XONG phần logic thật 2026-08-30** (regenerate + rate-limit **5 lần sai → khoá 30 phút**, owner chốt lại 2026-08-30, xem execution update) — chỉ còn durable session STORE (bền qua restart/multi-instance) chờ DevOps chọn (O4), KHÔNG ảnh hưởng logic rate-limit/fixation đã xong | F2 | G1A | code+test / — / fail-closed |
| W1.8 | `safeFetch` SSRF guard (F3), dùng chung monitor + award-extract | F3 | **XONG sớm tại G1B.4 (2026-08-27)** | code+test / all / GREEN |
| W1.9 | aiGateway reliability: timeout/AbortController, retry 429/5xx, capability-map strip sampling-params. Chưa data-egress enforcement. **XONG 2026-08-30** | F8 | **không cần O8** | code+test / — / — |
| W1.AI-POLICY | Data-egress **gateway cấu hình được** (không phải hard deny): tier/purpose allowlist, redact/minimize, retention/delete, egress audit KHÔNG chứa payload, kill-switch `AI_DISABLED`, negative tests. **Bao cả 12 luồng egress + SMTP** (`06-threat-model.md` §D). **O8 = PROVISIONAL (owner cho phép gửi Gemini tạm — dữ liệu test):** cấu hình mặc định CHO PHÉP, nhưng cơ chế deny-by-default có sẵn để siết chỉ bằng đổi config khi có dữ liệu thật + Security/Legal duyệt | F4 | **O8 provisional — xây ngay, không chờ** | code+test / **XONG — Claude 2026-08-30** / gateway hoạt động, config permissive theo O8 hiện tại |

**Exit gate W1:** G1B.1/G1B.2 (RBAC v2 target) chuyển sang `regression` (hành vi D13 đã đúng, 4 vai trò + visibility + ownership pass); G1B.3/G1B.4 (F2/F3) chuyển `regression`; session bền qua restart (seam + DevOps backend); SSRF chặn metadata/private; `W1.AI-POLICY` xanh nếu O8 duyệt (chưa thì giữ `AI_DISABLED`). **Không còn 2-role, không còn `org_fee` hard-code, không còn 3 cách mask song song.**

> **Execution update — 2026-08-30 (W1.9 aiGateway reliability, tiếp tục nhánh security độc lập):** `server/gemini.js` `call()` thêm `AbortController` timeout (`GEMINI_TIMEOUT_MS`, mặc định 30s, env-configurable cùng quy ước `MYSQL_QUERY_TIMEOUT_MS`) + retry tối đa 3 lần cho HTTP 429/5xx (backoff `GEMINI_RETRY_BASE_DELAY_MS * lần_thử`, mặc định 250ms) — KHÔNG retry lỗi 4xx khác (400/403...) hay lỗi mạng/timeout (fetch reject), tránh lặp lại vô ích hoặc đoán sai một lỗi network là transient. Thêm `supportsSamplingParams(model)`/`buildGenerationConfig()`: model ngoài allowlist (`gemini-3.5-flash` — model pin hiện tại, nằm trong allowlist nên hành vi hiện có KHÔNG đổi) không được gửi kèm `temperature`/`topP`/`topK`, fail-safe mặc định `false` để không lỗi HTTP 400 âm thầm nếu W2.6 đổi model mà quên cập nhật allowlist. `genText`/`genJSON`/`groundedSearch` đi qua `buildGenerationConfig()`; `genImage` không đổi (chưa từng gửi sampling params). Test mới: `server/test/unit-gemini-gateway.test.js` (8 test thuần module, không HTTP/DB — retry phục hồi/hết lượt, 5xx, 4xx không retry, timeout, capability-map). Test cũ cập nhật để khớp hành vi mới: `integration-ai-golden.test.js` (nhánh 429 cũ đổi thành 2 test — hết lượt retry vẫn 502 với message lần cuối, và phục hồi giữa chừng trả 200), `unit-ai-redaction-schema.test.js` BR-AI-007 (mock trả 429/500 mọi lần — nhân tiện đặc tả nhánh retry-hết-lượt, thêm `GEMINI_RETRY_BASE_DELAY_MS=5` để không tốn ~1.5s thật mỗi lần chạy suite). Full regression: security 6/6, SQLite 658/8 skip, MySQL 665/1 skip (+9 so với trước batch), mapping 263 rows PASS, `verify-g0.mjs` PASS, `git diff --check` sạch. **Còn lại của F8 (không thuộc batch này):** circuit breaker, usage/cost tracking — không phải exit criterion của W1.9. Data-egress enforcement + kill-switch `AI_DISABLED` thuộc `W1.AI-POLICY` (F4), việc kế tiếp trong nhánh security.

> **Execution update — 2026-08-30 (W1.AI-POLICY data-egress gateway, F4 — XONG):** module mới `server/ai-policy.js` — `REGISTRY` cố định 13 luồng (`AI-E001`..`AI-E012` + `SMTP`) gắn `tier`/`purpose` theo `03-data-classification.md` §D/§E; `assertEgressAllowed(flowId, principal)` gọi TRƯỚC mỗi lần thật sự gửi dữ liệu ra ngoài — thứ tự ưu tiên: kill-switch cứng (`AI_DISABLED` chặn 12 luồng AI-E00x, `SMTP_DISABLED` chặn riêng SMTP — 2 công tắc độc lập) → deny-list động qua `app_meta.ai_egress_deny_ids` (JSON array, Admin siết bằng config không cần deploy, mặc định rỗng = permissive đúng O8 provisional; JSON hỏng fail-open) → mặc định `allowed`. Mọi quyết định ghi vào `audit_log` có sẵn (`action='AI_EGRESS'`, `detail` CHỈ chứa `{tier,purpose,provider,decision}` — không bao giờ chứa payload thật). `pruneEgressLog(days)`/`startRetentionSweep()` dùng lại pattern `setInterval`+`unref()` đã có ở `scheduler.js`, scope xoá CHỈ `action='AI_EGRESS'`. Đã lắp `assertEgressAllowed()` vào cả 6 route `ai.js` (AI-E001..E006), cả 6 luồng logic `monitor.js` (AI-E007..E012), và `mailer.js#send()` (SMTP, sau nhánh "SMTP chưa cấu hình" có sẵn). Nhân dịp này đóng luôn 2 gap redact đã ghi sẵn trong `gate1-test-mapping.md`: `award-extract` nhánh text+url (`ai.js`) và `analyzeBatch()` (`monitor.js`) nay đều gọi `redactTextForAi()` trước khi đưa nội dung vào prompt gửi Gemini — đóng **BR-AI-017** và **BR-AI-015**. Test mới: `server/test/unit-ai-policy.test.js` (9 test thuần module — registry đủ 13 khoá, audit không chứa payload, throw khi flowId lạ, principal null → username 'system', 2 kill-switch độc lập, deny-list qua app_meta + fail-open khi JSON hỏng, prune chỉ đụng `AI_EGRESS`). Test cũ cập nhật để khớp hành vi ĐÃ SỬA (không còn "known gap"): `unit-ai-redaction-schema.test.js` BR-AI-015 (đổi assertion từ "PII xuất hiện thô" sang "PII đã bị redact"), `integration-ai.test.js` R139/BR-AI-017 (test mới, mock `gemini.genJSON` xác nhận prompt route `award-extract` không còn SĐT/email thô). Full regression: security 6/6, SQLite 668/8 skip, MySQL 675/1 skip (+10 so với trước batch), mapping 263 rows PASS, `verify-g0.mjs` PASS. **Không mở rộng RBAC v2 pilot** (vẫn khoá `person`-only theo `02-decisions.md` §G, không đụng trong batch này). O8 vẫn PROVISIONAL — gateway hiện permissive theo đúng chỉ đạo owner, siết được bất kỳ lúc nào qua `AI_DISABLED`/`ai_egress_deny_ids` khi Security/Legal duyệt dữ liệu thật.

> **Execution update — 2026-08-30 (G1B.5 N1/N2 implement thật, Wave 1 nhánh security — XONG):** N1 (RESOLVED `02-decisions.md` §B.1): `rbac.js` MATRIX thêm action `ack` (reminders, monitoring) và `run` (reminders) cho cả 2 role hiện tại (giữ nguyên quyền thực tế cấp cho từng role, chỉ tách action ra khỏi `view` dùng chung) — 4 route side-effect đổi sang action tường minh: `POST /notifications/:id/read`→`reminders:ack`, `POST /notifications/read-all`→`reminders:ack`, `POST /reminders/run`→`reminders:run`, `POST /monitor/alerts/:id/read`→`monitoring:ack`. N2 (RESOLVED cùng mục): `rbac.js` thêm module `dashboard` (MATRIX cấp `['view']` cho cả 2 role); `GET /dashboard` nay có `requirePerm('dashboard','view')` tường minh thay vì chỉ `requireAuth` ngầm định. `server/test/target-n1-n2-explicit-permission.test.js` promote từ known-red (G1B.6) sang 7 assertion xanh thật (4 N1 + 2 N2 wiring-nguồn + 1 N1 runtime `rbac.can()` fail-closed cho action lạ); 2 entry `N1-explicit-action`/`N2-dashboard-permission` xoá khỏi `g1b-allowlist.json`. Tài liệu G0 cập nhật khớp nguồn để `verify-g0.mjs` không rớt: `07-route-catalog.md` (R058/R059/R060/R098/R116 đổi cột auth + ghi chú ĐÃ SỬA), `08-permission-matrix.md` (tách module `dashboard` riêng khỏi hàng "không thuộc module nào — đặc biệt", cập nhật F003/F020/F029/D-DASH), `scripts/verify-g0.mjs` (whitelist Section A thêm `dashboard`). **Vấn đề phụ phát sinh khi promote:** cơ chế tự-test `known-red()` (`server/test/target-session-f2.test.js` + `known-red-fixture.js`) trước đây mượn tạm entry `N1-explicit-action` làm fixture (vì luôn có sẵn 1 known-red thật chưa sửa) — khi N1 được sửa và xoá khỏi allowlist, self-test gãy theo. Sửa bằng cách tách hẳn thành id infra riêng `INFRA-known-red-selftest` (allowlist ghi rõ "KHÔNG phải finding thật", expiry 2099, không gắn vòng đời sửa lỗi nào); thêm 1 dòng mapping tương ứng + mở rộng prefix hợp lệ của `verify-gate1-mapping.mjs` (`INFRA-`) để verifier đối chiếu đúng. Full regression: security 6/6, SQLite 668/8 skip, MySQL 675/1 skip (không đổi tổng số so với trước batch — đổi nội dung không đổi số lượng test net), mapping 264 rows PASS (`known-red=1`, đúng 1 entry infra self-test — 0 finding thật còn known-red), `verify-g0.mjs` PASS. **G1B (RBAC v2 target-red toàn bộ: G1B.1-G1B.6) nay đã XONG hết phần "test target-red + implement N1/N2/F2/F3"** — phần còn thiếu để đóng hẳn G1B.1/G1B.2 vẫn là route-wiring PolicyEngine cho 24 entity ngoài `person` (chờ owner theo `02-decisions.md` §G).

---

## WAVE 2 — Shared contract & performance (exit hardened)
**Ước lượng:** 2-3 tuần.

| # | Task | Evidence Contract |
|---|---|---|
| W2.1 | Chuẩn hóa API envelope/schema/error/client dùng chung (`05-error-contract.md`: `message` canonical, `error` alias; xóa `error` khi frontend hết đọc ở Wave 3) | code+test / **XONG — Claude 2026-08-30** / requestId + code ổn định cho 401/403/429/multer + phân loại DB-constraint-error (400, không lộ raw)/lỗi thật không xác định (500, không lộ raw) — exit criterion đã đóng, xem execution update phần 2 |
| W2.2 | Tách business/domain khỏi page layout (cần W2.1 chốt trước) | code+test / all / — |
| W2.3 | **ACCEPTANCE gate F7:** PASS khi đạt SLO tại peak trên topology production-like. **Ngưỡng SLO + peak + topology + ngân sách instance do DevOps MISA chốt (O5→DevOps)** — Claude dựng harness đo + báo cáo, không tự đặt ngưỡng release. Nếu chưa async hóa: mitigation chỉ chấp nhận khi **đo lại vẫn PASS** + owner/DevOps + expiry + rollback. "Có async-plan" ≠ exit | test / — / **PASS bắt buộc, plan-only không đủ** |
| W2.4 | Nếu W2.3 fail: async repository pilot theo slice; benchmark lại sau mỗi slice; xóa mitigation khi đạt SLO | code+test / — / — |
| W2.5 | Host-adapter interface + fake browser + fake-native provider, chung contract test. **Exit = contract-ready only**; production provider `UNVERIFIED` tới O3 | code+test / native / fail-closed nếu chỉ 1 adapter |
| W2.6 | **Gemini eval/model migration (O6 duyệt $200):** corpus 60-100 ca tổng hợp, ≥3 repeat/candidate, **hard cap tổng chi phí $200**, threshold quality/schema-validity/latency/cost; canary+rollback; giữ pin `gemini-3.5-flash` nếu candidate không thắng rõ | test / **XONG — Claude 2026-08-30, kết luận GIỮ PIN** / corpus 60 ca thật x2 model x3 repeat = 360 call thật, chi phí $4.456/$200; candidate `gemini-3.7-flash` KHÔNG thắng rõ (regression event-extract + latency tail), xem execution update |

**Exit gate W2:** shared layer swap được qua contract test; **W2.3 PASS thật** (đo lại, ngưỡng DevOps chốt); W2.5 contract-ready (2 fake provider); **W2.6 XONG — kết luận GIỮ PIN `gemini-3.5-flash`** (candidate `gemini-3.7-flash` không thắng rõ, trong ngân sách $4.456/$200).

> **Execution update — 2026-08-30 (W2.1 chuẩn hóa error envelope — phần nền tảng, XONG):** module mới
> `server/error-contract.js` — `requestIdMiddleware` gắn `req.requestId` (dạng `req_<24-hex>`) +
> header `X-Request-Id` cho MỌI request (kể cả response thành công); `sendError(req,res,status,code,
> message,details)` là điểm serialize DUY NHẤT cho response lỗi mới, luôn tự thêm `error=message`
> (không để mỗi call site tự gán `error` riêng — tránh lệch giá trị giữa 2 field, đúng lỗi Codex
> re-audit round 2 F3 đã sửa 1 lần ở tài liệu). Đã áp dụng cho **toàn bộ điểm 401/403/429/500 tập
> trung** — nơi phủ áp đảo đa số 145 route: `server/auth.js` (`requireAuth`/`requirePerm`/`login`/
> `me` — dùng chung bởi ~140 route qua middleware), 14 điểm `res.status(403)` rải rác trong
> `server/routes.js` (D13 PolicyEngine pilot People Detail + attachment gate — `PolicyForbiddenError`,
> `rbac.can()` inline, sensitive-group check). Code chuẩn: `UNAUTHENTICATED` (401), `FORBIDDEN_MODULE`
> (403 chung), `FORBIDDEN_SENSITIVE_GROUP` (403 riêng cho giấy tờ tùy thân/nhóm mật), `RATE_LIMITED`
> (429 login), `FILE_TOO_LARGE`/`UPLOAD_ERROR` (400 multer), `UNCAUGHT_ERROR`/`INTERNAL_ERROR` (xem
> dưới). `server/app.js`: global error middleware viết lại dùng `sendError()`, phân biệt
> `multer.MulterError` (400 đúng — `LIMIT_FILE_SIZE`→`FILE_TOO_LARGE`, còn lại→`UPLOAD_ERROR`) khỏi
> lỗi khác (giữ nguyên `UNCAUGHT_ERROR`/400, KHÔNG đổi thành 500 — xem nợ kỹ thuật dưới).
>
> **Nợ kỹ thuật cố ý chưa làm trong batch này (đã cân nhắc, không phải bỏ sót):** roadmap gốc yêu
> cầu middleware toàn cục phân biệt lỗi multer (400 đúng) khỏi lỗi khác (500, không lộ raw DB error
> ra client). Khảo sát thực tế trước khi code cho thấy **phần lớn route POST/PUT hiện tại dựa vào
> lỗi ràng buộc NOT NULL của DB bubble lên đúng middleware này để trả 400 làm cơ chế validation**
> (đặc tả tường minh ở tên test R004/R007/R031/R045/R064/R089/R092/R047 — ít nhất 8 route xác nhận,
> nhiều route khác cùng cơ chế nhưng không gắn nhãn "(NOT NULL)" trong tên). Đổi mặc định "lỗi khác"
> từ 400 sang 500 sẽ phá vỡ hàng loạt characterization test đó cùng lúc — đây là việc LỚN HƠN phạm
> vi "chuẩn hóa envelope" của batch này, đòi hỏi thêm validation tường minh trước khi chạm DB cho
> từng route (một dạng refactor có quy mô ngang F13/F16 trước đây, không phải 1 chỗ). Ghi nhận làm
> việc kế tiếp của W2.1 (chưa có batch contract riêng) — KHÔNG đóng exit criterion "không lộ raw DB
> error" của `05-error-contract.md` ở batch này.
>
> Test mới: `server/test/unit-error-contract.test.js` (5 test thuần module — `requestIdMiddleware`
> id ổn định/khác nhau, `sendError()` shape/details-optional/requestId-undefined an toàn),
> `server/test/integration-error-contract.test.js` (5 test HTTP thật — 401 login-fail, 401
> requireAuth, 403 requirePerm, 429 rate-limit, header `X-Request-Id` mọi response). Cả 10 test gắn
> id `BR-ERR-001..010`. Full regression: security 6/6, SQLite 678/8 skip (+10), MySQL 685/1 skip
> (+10), mapping 274 rows PASS, `verify-g0.mjs` PASS, `verify-g0-selftest` 6/6, `git diff --check`
> sạch. Không đổi status code/`error` text của bất kỳ response nào đang tồn tại — mọi thay đổi là
> ADDITIVE (`code`/`message`/`requestId` thêm vào, `error` giữ nguyên giá trị cũ) nên không có test
> cũ nào cần sửa ngoài phạm vi đã liệt kê.

> **Execution update — 2026-08-30 (W2.1 phần 2 — đóng nợ kỹ thuật, XONG, exit criterion đầy đủ):**
> thay vì thêm validation tường minh trước DB cho từng route (refactor lớn, rủi ro cao — xem nợ kỹ
> thuật ở trên), chọn cách nhỏ hơn và an toàn hơn: **phân loại lỗi bằng mã lỗi driver DB** ngay tại
> global error middleware, xác nhận bằng thực nghiệm trực tiếp (không đoán theo tài liệu driver).
> `error-contract.js` thêm `isDbConstraintError(err)`: SQLite (`node:sqlite`) ném constraint
> violation (NOT NULL/UNIQUE/FK/CHECK) với `err.code==='ERR_SQLITE_ERROR'` + `err.errcode % 256===19`
> (SQLITE_CONSTRAINT, đúng cho mọi biến thể); MySQL dùng tập mã cố định
> (`ER_BAD_NULL_ERROR`/`ER_NO_DEFAULT_FOR_FIELD`/`ER_DUP_ENTRY`/`ER_NO_REFERENCED_ROW*`/
> `ER_ROW_IS_REFERENCED*`/`ER_DATA_TOO_LONG`/`WARN_DATA_TRUNCATED`/`ER_TRUNCATED_WRONG_VALUE`). Phát
> hiện **bug phụ khi thực nghiệm**: `server/mysql-sync.js`'s `_call()` đang bỏ qua `result.code` dù
> worker thread đã gửi kèm — sửa để `err.code` MySQL đến được middleware (trước đó `err.code` luôn
> `undefined`, không thể phân loại được lỗi MySQL). `server/app.js`'s global middleware nay có thứ tự
> rõ ràng: `LIMIT_FILE_SIZE`→400, `MulterError`→400, `err.code==='UPLOAD_REJECTED'`
> (`uploads.js`'s `fileFilter`/`aiDocumentFileFilter` nay tự gắn code này khi từ chối file sai loại,
> phân biệt với lỗi thật)→400, `isUploadParseError(err)` (mới, `error-contract.js` — lỗi parse
> multipart của busboy khi request malformed: thiếu boundary/cắt ngang form — các message này là
> literal cố định của thư viện busboy, xác nhận đọc trực tiếp `node_modules/busboy/lib`, không chứa
> dữ liệu client nên lộ ra vẫn an toàn)→400, `isDbConstraintError(err)`→400 `VALIDATION_FAILED`
> (message chung, log chi tiết server-side kèm requestId, không lộ raw driver message), **còn lại**
> →500 `INTERNAL_ERROR` (message chung cố định, log stack đầy đủ server-side, KHÔNG lộ raw DB/driver
> error ra client — đây là exit criterion cuối cùng của `05-error-contract.md` đã đóng). 2 regression
> phát hiện ngay sau khi đổi mặc định 400→500 (`R136`/`R141`, cả 2 do lỗi upload không có mã phân
> loại) đã sửa đúng gốc (gắn `.code` ở nơi phát sinh lỗi, không patch vá ở middleware) và xác nhận lại
> bằng full regression: security 6/6, **SQLite 678/8 skip (0 fail)**, **MySQL 685/1 skip (0 fail)**
> (xác nhận cả bug `mysql-sync.js` đã sửa đúng bằng lỗi ràng buộc MySQL thật), mapping 274 rows PASS,
> `verify-g0.mjs` PASS, `verify-g0-selftest` 6/6, `git diff --check` sạch. Không thêm test mới riêng
> cho `isDbConstraintError`/`isUploadParseError` ở batch này (đã phủ gián tiếp qua ~40+ route
> characterization test hiện có dựa vào cơ chế NOT NULL→400 + R136/R141); có thể bổ sung unit test
> trực tiếp cho 2 hàm này như việc nhỏ sau, không phải exit criterion.

> **Execution update — 2026-08-30 (W2.6 Gemini eval/model migration, XONG — kết luận GIỮ PIN):**
> owner xác nhận candidate so sánh là `gemini-3.7-flash` (mới nhất tại thời điểm làm app, thay cho
> pin `gemini-3.5-flash`) — xác nhận model id hợp lệ bằng 1 lệnh gọi thật trước khi chạy corpus.
> Harness mới `scripts/w26-eval-run.mjs` (+ corpus `scripts/w26-eval-corpus.mjs`, phân tích
> `scripts/w26-eval-analyze.mjs`) — gọi Gemini API THẬT (không mock), KHÔNG dùng dữ liệu thật (đúng
> O6): corpus 60 ca tổng hợp x 4 nhóm (award-extract/event-extract/award-advice/card-text, che 4/6
> route Gemini text — 2 route còn lại là voice-extract cần audio thật và card-image dùng model ảnh
> riêng, ngoài phạm vi so sánh model text) x 2 model x 3 repeat = **360 lệnh gọi thật**. Chạy pilot 8
> call trước để đo chi phí thật ($0.0094/call) trước khi chạy full batch — an toàn trong ngân sách.
> Gặp 1 lỗi mạng thật (`ECONNRESET`) giữa chừng làm crash lần chạy đầu — sửa harness để network
> error retry được (trước đó chỉ retry theo HTTP status) + thêm cơ chế resume (bỏ qua tổ hợp
> case/model/rep đã có kết quả `ok=true` trong file cũ, không gọi lại/không tốn thêm tiền) — chạy
> lại hoàn tất đủ 360/360, không mất tiến độ.
>
> **Kết quả:** `gemini-3.5-flash` (pin): schema-validity 100% (180/180), field-accuracy TB 99.9%,
> latency p50=6.6s/p90=13.3s/max=26s, chi phí $2.865. `gemini-3.7-flash` (candidate): schema-validity
> 99.4% (179/180), field-accuracy TB 99.0%, latency p50=7.96s/p90=16.9s/**max=70.7s**, chi phí $1.591
> (rẻ hơn ~45%). Theo nhóm: candidate THUA rõ ở `event-extract` (schema 98% vs 100%, acc 96% vs
> 100%, latency p50 8.5s vs 3.6s) — đào sâu phát hiện **1 ca (`EVT-01` rep2) mất 70.7s VÀ JSON hỏng
> luôn (schema invalid)**, cho thấy đuôi latency dài tương quan với rủi ro output hỏng, không chỉ là
> chậm đơn thuần. 3 nhóm còn lại (`award-extract`/`award-advice`/`card-text`) tương đương hoặc
> candidate nhỉnh hơn chút. **Chi phí thật toàn bộ eval: $4.456/$200** (ngân sách O6 còn dư
> $195.544, không dùng hết vì flash-tier rẻ hơn nhiều so với mức ước lượng thận trọng dùng để chặn
> ngân sách khi chạy — `$2/$8` mỗi 1M token input/output — đặt cao hơn hẳn giá thật để không đánh
> giá thấp rủi ro vượt ngân sách).
>
> **Quyết định (theo đúng D10 "chỉ đổi model sau golden eval... candidate không thắng rõ thì giữ
> pin"):** candidate rẻ hơn nhưng KHÔNG thắng rõ — có regression chất lượng thật ở 1/4 nhóm nghiệp
> vụ kèm rủi ro đuôi latency/output hỏng chưa từng thấy ở pin hiện tại. **GIỮ NGUYÊN pin
> `gemini-3.5-flash`**, không đổi `cfg.GEMINI_TEXT_MODEL`. Không cần canary/rollback (không có gì để
> rollback vì không đổi production). Dữ liệu thô 360 dòng lưu `scripts/.w26-eval-out/
> results-full.jsonl` làm evidence, đã commit cùng harness để có thể chạy lại đối chiếu khi có
> candidate mới hoặc khi `gemini-3.7-flash` cải thiện đuôi latency. Không đổi UI, không đụng RBAC v2
> pilot, không tốn ngân sách ngoài batch này.

> **Execution update — 2026-08-30 (W1.7 tune rate-limit theo owner: quá 5 lần sai → khoá 30 phút):**
> khi rà lại roadmap phát hiện tài liệu (dòng W1.7/G1B.3 cũ) đang LỆCH với code thật — commit
> `70e9f93` (trước batch này trong cùng ngày) đã implement thật `req.session.regenerate()`
> (F2-fixation) và `server/login-rate-limiter.js` (F2-ratelimit), test `target-session-f2.test.js`
> đã promote cả 2 sang assertion xanh và xoá khỏi `g1b-allowlist.json` — nhưng roadmap chưa cập nhật
> theo kịp (đã sửa lại 2 dòng W1.7/G1B.3 ở trên cho khớp thực tế). Owner chốt cụ thể ngưỡng rate-limit
> lần này: **quá 5 lần sai liên tiếp → khoá tài khoản (theo cặp IP+username) trong 30 phút** (trước
> đó là cửa sổ 15 phút tính từ lần sai ĐẦU TIÊN — khác ngữ nghĩa, có thể hết khoá sớm hơn 15 phút
> tuỳ thời điểm lần sai thứ 5 rơi vào đâu trong cửa sổ).
>
> `server/login-rate-limiter.js` viết lại theo đúng ngữ nghĩa "khoá 30 phút kể từ lần sai LÀM CHẠM
> NGƯỠNG" (không phải từ lần sai đầu tiên): đổi `windowMs`→`lockoutMs` (mặc định 30 phút), lưu
> `lockedUntil` thay vì `resetAt`, chỉ đặt mốc khoá khi `count>=maxAttempts`. Thêm tham số `now`
> (mặc định `Date.now`) để unit test được chính xác mốc thời gian mà không phải chờ thật 30 phút —
> không đổi hành vi production (call site `auth.js` không truyền `now`, vẫn dùng đồng hồ thật).
> `auth.js`: message lỗi 429 nói rõ "quá 5 lần... 30 phút" thay vì câu chung chung trước đây (không
> test nào khoá cứng theo text cũ, xác nhận bằng grep trước khi đổi).
>
> Test mới `server/test/unit-login-rate-limiter.test.js` (7 test thuần module, `BR-AUTH-001..007`):
> chưa đủ 5 lần chưa khoá; đúng lần 5 khoá ngay; khoá đúng 30 phút (còn khoá ở 29:59, hết ở 30:00);
> hết khoá đếm lại từ đầu; `recordSuccess()` xoá sạch lịch sử; khoá theo từng cặp IP+username riêng
> (không lẫn); không tự gia hạn khoá khi không có request nào gọi thêm `recordFailure()` trong lúc
> đang khoá (đúng luồng `auth.js` — chỉ gọi `recordFailure()` khi CHƯA `isBlocked()`). Mapping thêm
> 8 dòng (`BR-AUTH-001..007` + sửa note `F2-ratelimit`). Full regression: security 6/6, SQLite
> 685/8 skip (+7), MySQL 692/1 skip (+7), mapping 281 rows PASS, `verify-g0.mjs` PASS,
> `verify-g0-selftest` 6/6, `git diff --check` sạch. Không đổi UI, không đụng RBAC v2 pilot, không
> đổi durable session store (vẫn chờ DevOps O4 — không liên quan tới rate-limit/fixation).

> **Execution update — 2026-08-30 (F15 sửa tận gốc — FK không được MySQL thực thi, backlog Wave 1):**
> rà backlog Wave 1 tìm việc unblocked tiếp theo (không phải UI, không cần mở rộng RBAC pilot, không
> chờ DevOps), chọn F15 — đã có bằng chứng mạnh từ trước (5 quan hệ FK: `award_participations`,
> `supplier_quotes/transactions/contacts`, `event_costs`) nhưng chưa root-cause. Điều tra thực
> nghiệm trực tiếp (`SHOW CREATE TABLE` trên MySQL test thật): xác nhận cột `award_id BIGINT
> DEFAULT NULL` — **REFERENCES đã biến mất hoàn toàn** khỏi DDL thật dù `db.js` khai đủ. Root cause:
> **MySQL/InnoDB PARSE nhưng ÂM THẦM BỎ QUA cú pháp `REFERENCES` gắn trực tiếp vào cột** (inline
> column-level, cách SQLite chấp nhận) — hành vi đã tài liệu hoá của MySQL, không phải bug của
> `mysql2`/`translate()` từ trước — MySQL chỉ tạo FK thật khi có `CONSTRAINT ... FOREIGN KEY (col)
> REFERENCES tbl(col)` tách riêng (out-of-line).
>
> Sửa tận gốc tại đúng 1 điểm dịch DDL dùng chung (`server/mysql-sync.js`'s `translate()`, áp dụng
> cho MỌI `CREATE TABLE` khi khởi tạo MySQL) thay vì vá từng route: tách mọi cột `col TYPE
> REFERENCES tbl(refCol) [ON DELETE action]` inline thành `CONSTRAINT fk_<table>_<col> FOREIGN KEY
> (col) REFERENCES tbl(refCol) [ON DELETE action]` out-of-line, giữ nguyên kiểu cột + `NOT NULL`.
> Xác nhận trước khi áp dụng: không bảng nào trong `db.js` tham chiếu tới bảng CHƯA được tạo (rà thủ
> công thứ tự khai báo `CREATE TABLE`), nên an toàn áp dụng ngay lúc tạo bảng, không cần hoãn/2-pass
> ALTER TABLE thêm constraint sau. Xác nhận thật qua `information_schema.KEY_COLUMN_USAGE`: **24/24
> FK được tạo** (khớp đúng số dòng `REFERENCES` đếm được trong `db.js`).
>
> 5 test characterization từng ghi nhận lệch driver (R007/R067/R075/R083/R091 — `not-found` trả 200
> trên MySQL/400 trên SQLite; DELETE cha để lại con mồ côi trên MySQL) nay **hội tụ đúng 1 hành vi**
> — cập nhật lại bỏ nhánh `isMysql ? 200 : 400` kiểu cũ, khẳng định thẳng 400/cascade như SQLite (đã
> grep xác nhận không route nào dựa vào hành vi cũ "MySQL cho phép insert mồ côi" làm tính năng thật
> trước khi sửa). Test mới `server/test/unit-mysql-sync-translate.test.js` (7 test, `BR-FK-001..007`)
> khoá lại đúng ngữ nghĩa `translate()`: tách FK inline→out-of-line, giữ `ON DELETE SET NULL`/không
> có `ON DELETE`, nhiều FK cùng bảng, bảng không FK không đổi gì, giữ `NOT NULL`, và 1 test round-trip
> thật xác nhận FK tồn tại qua `information_schema` (chỉ chạy khi `DB_CLIENT=mysql`). Full
> regression: security 6/6, SQLite 692/8 skip (+7), MySQL 699/1 skip (+7), mapping 281 rows PASS,
> `verify-g0.mjs` PASS, `git diff --check` sạch. Không đổi UI, không đụng RBAC v2 pilot. **F15 đóng
> hẳn — không còn P2 nào trong backlog Wave 1 từ finding này.**

> **Execution update — 2026-08-30 (RBAC-EXP-B1: mở rộng PolicyEngine — batch 1/6, 6 entity
> Module-admin-only):** owner duyệt mở rộng route-wiring PolicyEngine từ pilot 1 entity (`person`)
> ra toàn bộ 24 entity còn lại (`02-decisions.md` §D13.4a), tự chọn cách chia batch cho an toàn.
> Trước khi code, khảo sát lại đúng hiện trạng (agent riêng, chỉ báo cáo — không tự đề xuất kế
> hoạch) phát hiện 2 khoảng trống hệ thống cần ghi nhận rõ (không chặn batch này, nhưng ảnh hưởng
> mọi batch sau): (1) `rbac.js` MATRIX chỉ có 2 role (`super_admin`/`pr_staff`) — **139/145 route
> vẫn dùng `requirePerm` cũ nên user mang 1 trong 3 role D13 (viewer/executor/admin) sẽ bị 403 trên
> MỌI route CHƯA gắn PolicyEngine**, kể cả route GET/view; (2) hiện **KHÔNG có cách nào tạo user
> mang role D13 qua API/UI thật** — chỉ tạo được qua `fixtures.createUser()` (insert thẳng DB, bỏ
> qua validator `isValidNewUserPayload`). Cả 2 điểm này KHÔNG phải lỗi phát sinh từ batch nay — là
> hệ quả tất yếu của rollout từng phần (route-wiring đi trước, migrate MATRIX + UI tạo user D13 đi
> sau) — nhưng phải xử lý ở batch riêng, có quyết định owner riêng, không lẫn vào việc "gắn
> PolicyEngine vào route".
>
> Chọn chia 24 entity thành 6 batch theo nhóm ngữ nghĩa D13.4a (không làm gộp 1 lần): Module-admin-
> only (6, batch này) → Global còn lại (3) → Direct chia 4 cụm theo nghiệp vụ (sự kiện+event_cost,
> giải thưởng, nhà cung cấp, còn lại) — Module-admin-only đi trước vì luật đơn giản nhất (executor
> bị chặn HOÀN TOÀN mọi hành động ghi, không cần so sánh chủ sở hữu), phù hợp dựng khuôn mẫu chắc
> trước khi sang các nhóm phức tạp hơn.
>
> Batch 1/6 (Batch Contract `18-g1b-rbac-batch-contract.md#batch-rbac-exp-b1-module-admin-2026-08-30`):
> gắn PolicyEngine vào 14 route ghi (POST/PUT/DELETE) của 6 entity `budget/scan_query/source/
> competitor/campaign/monitor_alert` trong `server/routes.js`. Thêm 1 hàm dùng chung
> `moduleAdminOnlyGate(entity, legacyModule, action)` (route-level middleware, thay `requirePerm`
> trực tiếp) — dùng chung cho cả 6 entity vì luật giống hệt nhau, an toàn hơn chép tay 14 khối dual-
> branch riêng lẻ; nhánh legacy (super_admin/pr_staff) gọi lại đúng `requirePerm(legacyModule,
> action)` nguyên bản, giữ nguyên action string gốc (vd `budgets` dùng `'view'` không phải `'edit'`,
> `monitor_alerts` dùng `'ack'` không phải `'edit'`) để không đổi quyền legacy dù PolicyEngine không
> phân biệt theo action cho nhóm Module-admin-only. **Không đụng route GET/view của 6 entity này** —
> vẫn dùng `requirePerm` cũ (khoảng trống MATRIX ở trên vẫn còn với GET, ghi nhận rõ trong Batch
> Contract, không phải phạm vi batch này).
>
> Test mới `server/test/integration-rbac-exp-b1-module-admin.test.js` (17 test, `D13-025..030`): mỗi
> entity xác nhận viewer/executor create-edit-delete đều 403 (executor bị chặn cả create — đúng
> điểm khác biệt D13.4a so với Direct/Global), admin (target role) full CRUD 200; riêng `source`
> tách test create (chỉ xác nhận vượt qua PolicyEngine — 400 SSRF chứ không phải 403 — vì
> `outbound.validateOutboundUrl` chặn mọi URL loopback bất kể role) khỏi edit/delete (dựng bản ghi
> nền qua DB trực tiếp). 2 test cũ phải sửa theo cho khớp shape mã mới (không đổi hành vi, chỉ đổi
> cách đo): `scripts/verify-g0.mjs` thêm 14 route vào `PILOT_INLINE_PERM_ROUTES` (script quét literal
> `requirePerm(...)` trên dòng đăng ký route, nay route dùng `moduleAdminOnlyGate(...)` nên phải khai
> tường minh y hệt cách pilot `person` đã làm); `target-n1-n2-explicit-permission.test.js` mở rộng
> `requirePermArgsFor()` nhận dạng thêm pattern `moduleAdminOnlyGate(...)` (route `POST /monitor/
> alerts/:id/read` không còn literal `requirePerm` trên dòng đăng ký).
>
> Full regression: security 6/6, SQLite 709/8 skip (+17 so trước batch), MySQL 716/1 skip (+17),
> mapping 145/145 route + 288 dòng PASS, `verify-g0.mjs` PASS, `git diff --check` sạch. Không đổi
> UI, không có regression trên route legacy (super_admin/pr_staff giữ nguyên 100% hành vi cũ, xác
> nhận qua test R050/R051/R116-R134 cũ vẫn xanh). **Batch 2/6 (Global còn lại: organization/
> supplier/important_date) là bước tiếp theo.**

> **Execution update — 2026-08-30 (RBAC-CUTOVER: owner chốt bỏ hoàn toàn 2-role legacy, dùng DUY
> NHẤT 4 vai trò D13):** ngay sau batch RBAC-EXP-B1, owner tuyên bố trực tiếp: *"2 vai trò cũ chỉ
> là demo trên bản code ban đầu, bạn loại bỏ hoàn toàn đi nhé. Chỉ thực hiện theo 4 vai trò mới."*
> Đây là quyết định RỘNG HƠN và **ghi đè phần "Phạm vi CẤM" của `02-decisions.md` §G** (2026-08-28,
> khi đó cấm cutover role hàng loạt) — đã ghi lại đầy đủ thành §G.1 (amendment) trong
> `02-decisions.md`, kèm 2 quyết định cụ thể owner trả lời khi hỏi lại: (1) `pr_staff`→`executor` là
> ánh xạ CỐ ĐỊNH cho user thật hiện có; `super_admin`/`admin`/`viewer` KHÔNG có ánh xạ tự động — owner
> tự gán theo cấp bậc thật từng người sau này (owner ví dụ: Ban Tổng Giám đốc→viewer, trưởng nhóm
> truyền thông đối ngoại→admin, trưởng ban truyền thông→super_admin); (2) dữ liệu nghiệp vụ cũ chỉ là
> demo, không cần backfill `owner_id`, có thể xoá/ghi lại.
>
> Batch Contract: `18-g1b-rbac-batch-contract.md#batch-rbac-cutover-2026-08-30`. Thực hiện: (a)
> `server/rbac.js` ROLES/MATRIX đổi hẳn từ 2 khoá (`super_admin`/`pr_staff`) sang 4 khoá
> (`viewer`/`executor`/`admin`/`super_admin`) — `pr_staff` RENAME thẳng thành `executor` (giữ nguyên
> nội dung quyền, chỉ đổi tên), thêm mới `MATRIX.admin` (copy `super_admin`) và `MATRIX.viewer` (chỉ
> `'view'` mọi module, trừ `admin`); (b) global rename cơ học `pr_staff`→`executor` toàn repo (67 chỗ,
> 15 file code+test — không phải viết lại, thuần đổi tên 1:1); (c) `server/routes.js` bỏ hẳn
> `TARGET_RBAC_ROLES`/nhánh dual-branch — route đã gắn PolicyEngine (`person` + 6 entity Module-
> admin-only) nay chạy PolicyEngine KHÔNG ĐIỀU KIỆN cho cả 4 vai trò (kể cả `super_admin`, trước đây
> tách riêng vào nhánh "legacy"); route chưa gắn PolicyEngine tiếp tục dùng `requirePerm`/`rbac.can`
> — nay đúng cho cả 4 vai trò nhờ MATRIX mở rộng, đóng khoảng trống 403-sai cho viewer/admin đã ghi
> nhận ở batch trước.
>
> **Phát hiện và vá giữa batch (không phải backlog riêng):** copy nguyên `MATRIX.admin` từ
> `super_admin` vô tình cấp Admin full quyền module `admin` (tạo/sửa/xoá tài khoản BẤT KỲ role nào +
> xem `audit_log`) — trái với D13.1 đã chốt trước đó (Admin KHÔNG được quản trị tài khoản Admin/Super
> Admin, KHÔNG xem được audit log). Vá bằng guard riêng trong từng handler (`POST/PUT/DELETE
> /admin/users`, `GET /admin/audit`) vì MATRIX thô không phân biệt được "quản lý user thường" với
> "quản lý user đặc quyền" — Admin bị chặn thao tác tài khoản có role hiện tại HOẶC role đích là
> `admin`/`super_admin` (trừ tự sửa chính mình không đổi role — không phải leo thang); `audit_log`
> chỉ đúng `role==='super_admin'` mới xem được. `isValidNewUserPayload`/`POST /api/admin/users` đã tự
> động nhận đủ 4 role qua `rbac.ROLES` — đóng khoảng trống "không có cách tạo user role D13 qua API
> thật" đã nêu ở batch RBAC-EXP-B1.
>
> Test mới `server/test/integration-rbac-admin-tier.test.js` (13 test, `D13-031..034`): Admin không
> tạo/sửa/xoá được tài khoản Admin/Super Admin khác (kể cả tự nâng cấp chính mình), vẫn tạo/sửa/xoá
> được tài khoản executor/viewer bình thường, tự sửa chính mình (không đổi role) vẫn OK; Admin không
> xem được audit log, Super Admin xem được. Toàn bộ 709 test SQLite + 716 test MySQL từ trước batch
> vẫn pass 100% sau rename (chỉ đổi tên cơ học trong fixture/comment, không sửa nội dung assertion
> nào) — xác nhận rename không làm lệch hành vi. Full regression sau batch: security 6/6, SQLite
> 722/8 skip (+13), MySQL 729/1 skip (+13), mapping 145/145 route PASS, `verify-g0.mjs` PASS,
> `git diff --check` sạch, grep xác nhận **0 chuỗi `pr_staff` còn lại trong `server/*.js`**.
>
> **Chưa làm (out of scope batch này, ghi rõ để không rơi):** 18 entity D13.4a còn lại (14 Direct +
> 3 Global + 1 Inherited) chưa gắn PolicyEngine — batch RBAC-EXP-B2..B6 tiếp tục độc lập, không liên
> quan tới việc bỏ 2-role vừa xong (route chưa gắn PolicyEngine đã tự động đúng cho 4 vai trò nhờ
> MATRIX, không bị chặn bởi việc PolicyEngine wiring chưa xong). `08-permission-matrix.md` §B.2
> (UI-flow theo role×device) vẫn giữ 2 cột role cũ — phạm vi UI/characterization (Codex lane), chưa
> rebuild cho 4 vai trò, đã ghi chú rõ trong file đó. Seed demo (`server/db.js`) vẫn giữ 2 tài khoản
> (super_admin + executor) — viewer/admin tạo qua API thật khi cần, không seed thêm.

> **Execution update — 2026-08-30 (RBAC-FIELDVIS-FIX: P0 tự phát hiện trước khi bắt đầu Batch
> RBAC-EXP-B2):** kiểm tra thủ công `projectRecord()` cho entity `person` với `principal.role=
> 'executor'` trước khi mở rộng thêm 3 entity Global (organization/supplier/important_date) phát
> hiện: **mọi field Public-tier** (không thuộc nhóm mật nào — `email_work`/`phone_work`/`position`/
> `org_id`/`beat`...) bị **ẩn mặc định** cho viewer/executor, không chỉ field mật thật sự — script
> xác nhận trả về `{}` cho 1 record 9 field. Vì batch RBAC-CUTOVER (cùng ngày, ngay trước) đã xoá
> nhánh legacy khiến GET `/people/:id` chạy PolicyEngine không điều kiện cho **executor** (vai trò
> thật duy nhất của toàn bộ nhân viên PR thật hiện nay), **bug này đã LIVE trên production ngay
> sau RBAC-CUTOVER**: nhân viên PR mở 1 người trong danh bạ sẽ thấy record gần như rỗng.
>
> Root cause: `canReadField()` cũ đòi `isPublic===true` (có dòng `field_visibility` rõ ràng) mới
> cho xem field dù tier là Public; `ALLOWED_FIELDS` (`policy-visibility-store.js`) chỉ liệt kê nhóm
> field mật + `full_name` (demo) nên mọi field khác throw khi tra cứu, catch về `false`, bị ẩn.
> Batch Contract: `18-g1b-rbac-batch-contract.md#batch-rbac-fieldvis-fix-2026-08-30`. Sửa: (a)
> `canReadField()` — tier Public giờ mặc định hiển thị (`isPublic !== false` thay vì `!!isPublic`),
> đúng D13.2b ("chỉ được SIẾT, không được NỚI dưới trần"); tier Confidential/Restricted không đổi
> (vẫn fail-closed tuyệt đối, không phụ thuộc `isPublic`); (b) `isPublic()` trả `undefined` khi
> chưa có dòng cấu hình (thay vì ép `false`) để phân biệt "chưa cấu hình" với "đã cấu hình private
> rõ ràng". **Phát hiện thêm giữa batch:** `mysql-sync.js translate()` chưa từng dịch đúng UPSERT
> `field_visibility` sang MySQL — `setPublic()` (cách duy nhất cấu hình bảng này qua code thật)
> chưa từng chạy được trên MySQL trước batch này (unit test cũ ép cứng SQLite); đã thêm rule dịch.
>
> Full regression: security 6/6, SQLite 723/8 skip, MySQL 730/1 skip, mapping 145/145 PASS,
> `verify-g0.mjs` PASS, `git diff --check` sạch. Xác nhận thủ công lại: executor `projectRecord()`
> trên person 9 field business giờ thấy 7 (đúng ẩn `dob`/`phone_personal`, hiện phần còn lại).
> **Batch RBAC-EXP-B2 (organization/supplier/important_date) tiếp tục ngay sau, trên nền engine đã
> sửa đúng — nếu làm trước khi sửa sẽ lặp lại đúng bug này cho 2 entity dùng hàng ngày nhiều hơn
> person.**

> **Execution update — 2026-08-30 (RBAC-EXP-B2: batch 2/6 mở rộng 24 entity — organization/
> supplier/important_date):** Batch Contract: `18-g1b-rbac-batch-contract.md#batch-rbac-exp-b2-
> 2026-08-30`. Gắn PolicyEngine cho 3 entity Global còn lại (`person` đã xong ở pilot), đúng pattern
> đã dùng: `organization` (`GET/PUT/DELETE /api/partners/:id`) — GET dùng `projectRecord()` che
> `membership_fee` (Confidential); PUT/DELETE bỏ `requirePerm`+`stripDisallowed` cũ, thay
> `assertWritable()` không điều kiện (executor sửa được bất kể ai tạo, KHÔNG bao giờ xoá được —
> Global, chỉ Admin/Super Admin xoá); `supplier` (`GET/PUT/DELETE /api/suppliers/:id`) tương tự —
> che `service_fee_pct`/`deposit_pct`; `important_date` (`PUT/DELETE /api/reminders/:id`) không có
> field mật nào nên chỉ cần gate ghi/xoá, không cần `projectRecord` cho GET. Collection lồng bên
> trong `GET /partners/:id`/`GET /suppliers/:id` (people/sponsorships/gifts/fees/agreements/
> workLogs/quotes/transactions/contacts) giữ nguyên masking cũ — thuộc Direct entity khác, ngoài
> phạm vi batch này.
>
> **Dọn rác phát sinh:** `stripDisallowed()` hết call site thật sau khi bỏ ở `organization` (person
> đã bỏ từ batch trước đó) — xoá định nghĩa, xoá khỏi `router.testables` export, xoá unit test đã
> mồ côi (`BR-VAL-020`). `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` + `07-route-catalog.md`
> (R005/R006/R041/R042/R082/R083) cập nhật mô tả auth theo đúng mẫu inline-check đã dùng cho
> `person` (R032/R033).
>
> **Phát hiện giữa batch:** `call()` helper trong 3 file test (`integration-partners/suppliers/
> reminders.test.js`) chưa hỗ trợ tham số `as` (chỉ 1 cookie `super_admin` cho cả file) — test D13
> mới ban đầu "xanh giả" (viewer/executor gọi thực chất bằng cookie super_admin, luôn bypass). Sửa
> cả 3 file thêm `as = cookie` vào `call()`, xác nhận lại test đúng fail trước khi sửa route.
>
> Test mới: D13-035..038 (organization), D13-039..042 (supplier), D13-043..045 (important_date).
> Full regression: security 6/6, SQLite 733/8 skip, MySQL 740/1 skip, mapping 145/145 PASS,
> `verify-g0.mjs` PASS, `git diff --check` sạch. **Còn lại: 14 Direct entity + 1 Inherited
> (event_cost) — batch RBAC-EXP-B3..B6 tiếp theo.**

> **Execution update — 2026-08-30 (RBAC-EXP-B3: batch 3/6 mở rộng 24 entity — booking/interaction,
> 2 entity Direct đầu tiên):** Batch Contract: `18-g1b-rbac-batch-contract.md#batch-rbac-exp-b3-
> 2026-08-30`. Trước khi làm, chủ đặt câu hỏi ngược lại nghĩa "executor sửa được bất kể ai tạo,
> không bao giờ xoá được" của batch B2 — lo ngại điều này áp dụng luôn cho mọi entity, nghĩa là
> nhân viên thực thi thấy/sửa được việc của người khác vô tội vạ. Xác nhận lại qua
> `AskUserQuestion`: batch B2 (Global: organization/supplier/important_date) **giữ nguyên như cũ**
> theo đúng D13-P1/D13-P2 đã owner-approved 2026-08-25; batch này (Direct: booking/interaction)
> khác hẳn — mỗi record có `owner_id` riêng, executor CHỈ sửa được bản ghi CHÍNH họ tạo, KHÔNG BAO
> GIỜ xoá được (kể cả chủ sở hữu).
>
> `interaction` (`POST /api/interactions`) chỉ có create/view (log lịch sử, không PUT/DELETE) —
> đổi `pick()` thô sang `policyService.prepareCreate()`, tự gán `owner_id`/`created_by` = principal
> hiện tại (trước batch này `owner_id` luôn NULL, không ai dùng tới). `booking`
> (`GET/POST/PUT/DELETE /api/bookings`, `/api/bookings/:id`): GET dùng `projectRecord()` che
> `amount` nếu không phải chủ sở hữu/không privileged; POST dùng `prepareCreate()`; PUT dùng
> `assertWritable()` — chỉ qua khi `owner_id` = chính principal HOẶC Admin/Super Admin; DELETE
> không điều kiện owner — Direct entity thì xoá CHỈ dành cho Admin/Super Admin, **kể cả chủ sở hữu
> cũng không xoá được** (siết chặt hơn hành vi cũ — trước batch này DELETE chỉ gate theo role,
> chưa từng gate theo owner). `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` + `07-route-
> catalog.md` (R045/R047/R048/R049) cập nhật mô tả auth theo đúng mẫu inline-check đã dùng ở B2.
>
> Test mới: D13-046..047 (interaction: viewer POST 403, executor POST 200 + owner_id/created_by
> đúng); D13-048..051 (booking: viewer POST 403, executor POST 200 + owner_id đúng, executor PUT
> booking của người khác 403, executor DELETE booking CỦA CHÍNH MÌNH vẫn 403, admin DELETE 200).
> Full regression: security 6/6, SQLite 748/8 skip, MySQL 747/1 skip, mapping 145/145 PASS,
> `verify-g0.mjs` PASS, `git diff --check` sạch. **Còn lại: 12 Direct entity + 1 Inherited
> (event_cost) — batch RBAC-EXP-B4..B6 tiếp theo (nhóm tạm thời, chưa chốt với chủ).**

---

## WAVE 3 — Strangler UI theo vertical slice (trên RBAC v2 mới) + slice Voice (D14)
**Ước lượng:** 3-6 tuần (cuốn chiếu). Mỗi slice tự chờ: test + policy/service + shared contract **của chính slice** xanh. **Mọi slice xây trên RBAC v2 (W1) — 4 vai trò + visibility + ownership, KHÔNG phải 2-role cũ.**

Thứ tự: 1) **People Detail (pilot)** → 2) Partner Detail → 3) Supplier/Booking/File → 4) People List/Forms/Interactions → 5) **Voice Assistant (D14, track riêng — cần O8 + D14.2)** → 6) Events/Awards/Smart Intake → 7) Monitoring/Reports/Admin/Reminders.

Mỗi slice: characterization/spec → mechanical extraction (commit riêng) → policy/service (RBAC v2) → Desktop MDS token/component → Native composition (W2.5 contract) → role/device test. **Exit mỗi slice:** không còn SQL/business-rule trong controller slice; desktop MDS pass token/a11y/visual; native composition pass contract test; regression xanh; rollback độc lập.

### W3.VOICE — Voice Assistant (D14), track riêng trong Wave 3
| # | Task | Phụ thuộc | Evidence Contract |
|---|---|---|---|
| W3.VOICE.0 | **D14.2 đã chốt (human-in-the-loop, owner 2026-08-24).** Còn 1 việc BA: định nghĩa quy tắc AI **đề xuất** mức đổi `relationship_score` (không chặn thiết kế vì đã có bước xác nhận) | BA | doc / — / — |
| W3.VOICE.1 | Route AI voice mở rộng: giữ "trích-xuất-chờ-duyệt", thành **hành động đa bước chờ-xác-nhận-1-lần** (AI chuẩn bị: match entity + soạn bản ghi + đề xuất đổi điểm → người dùng xác nhận rồi mới ghi). Rào chắn: confidence thấp/nhiều khớp → **bắt người dùng chọn**; log mọi lần ghi | W3.VOICE.SECURE-COMMAND | code+test / — / fail-closed: không ghi khi chưa xác nhận |
| W3.VOICE.SECURE-COMMAND | **Mới (Codex round-3 re-audit R3-08, D14.4):** proposal opaque/có định danh/gắn 1 principal/hết hạn + snapshot revision; xác nhận chỉ gửi `proposal_id`+chỉnh sửa+idempotency key (không gửi lại toàn payload); server đọc lại bản ghi + check optimistic concurrency + chạy lại PolicyEngine trước khi ghi 1 lần; chống replay/tampering/TOCTOU | W1.AI-POLICY | code+test / — / fail-closed: từ chối nếu revision lệch hoặc proposal hết hạn |
| W3.VOICE.2 | "Gọi từ mọi màn hình" — trigger toàn cục (nút nổi/mic) ở tầng **web app trong WebView host** (D15); có thể cần bridge host cấp quyền mic OS — **gắn O3 (bridge contract, DevOps)** | O3(DevOps), W2.5 | code+device-test / WebView-host / `UNVERIFIED` tới bridge contract |

---

## WAVE 4 — WebView-host runtime & release gate (+ voice runtime)
**Ước lượng:** 3-6 tuần (giảm nhờ D15 — web-in-WebView, không build native riêng). **CHẶN bởi: security gate (G1B rỗng) + SLO gate (W2.3 PASS) + bridge contract AMIS Mobile (DevOps+AMIS).**

| # | Task | Evidence Contract |
|---|---|---|
| W4.1 | **Runtime-ready:** tích hợp bridge AMIS Mobile thật qua contract test + device test **trong WebView host**: session/principal (**cơ chế cụ thể — bearer token/cookie/one-time-code/SDK assertion — `UNVERIFIED` tới khi DevOps+AMIS chốt bridge contract, KHÔNG giả định "host bơm token" là fact đã xác nhận**, sửa theo Codex C0.7), Back, safe-area, lifecycle, file/camera/mic qua bridge, notification/deep-link. **Bridge security contract bắt buộc trước khi tích hợp thật** (`02-decisions.md` §F): origin allowlist, versioned message schema, token audience/TTL/chống replay, không lưu token ở query string/`localStorage`, timeout fail-closed. **Không phải native codebase riêng — là web app + 1 composition Native-Mobile riêng trong WebView** (không phải desktop responsive) | code+device-test / WebView-host / `UNVERIFIED` tới khi có bridge contract (DevOps+AMIS) |
| W4.2 | QA ma trận MDS trong WebView host: 375/393/412/768/1024, portrait/landscape/split, iOS Dynamic Type/Zoom, Android Font/Display, keyboard/Back/gesture | device-test / WebView-host / — |
| W4.3 | Permission denied/revoked/unavailable (qua bridge); restore draft; deep-link 403; gesture fallback; accessibility OS | device-test / WebView-host / fail-closed |
| W4.VOICE | Voice Assistant runtime trong WebView host: mic OS permission qua bridge, gọi từ mọi màn hình, **AI chuẩn bị hành động + người dùng xác nhận** (D14.2) rồi mới ghi, log audit đầy đủ | device-test / WebView-host / cần W3.VOICE |
| W4.4 | Canary + rollback + observability + audit; health/liveness/readiness; graceful shutdown; **backup/restore drill ở scale production** (do DevOps hạ tầng MISA) | deploy / native+browser / — |

**Exit gate W4 (= release gate):** ma trận scope 4-vai-trò không còn `UNVERIFIED` cho route release; runtime evidence trong WebView host trên thiết bị thật; security gate rỗng; W2.3 PASS; scorecard ≥8,5, không trục critical <8,0. **Release bật AI/voice: O8 hiện PROVISIONAL (đủ cho dữ liệu test) — khi có dữ liệu thật cần Security/Legal duyệt lại.** Build `AI_DISABLED` release web-in-host pilot được, gọi đúng tên "web-in-host, AI tắt".

---

## Emergency containment exception — DEFAULT OFF, KHÔNG thuộc roadmap đã duyệt
> Owner yêu cầu: test phủ nghiệp vụ trước khi sửa. Đường tắt này **không mặc định** — chỉ owner + Security kích hoạt khi có incident/active exposure.
Điều kiện tối thiểu: exploit/contract test viết trước patch; feature flag + canary + rollback + audit + owner + expiry; không gọi "đã đóng F1 toàn bộ" nếu chỉ containment 1 phần; quay lại G1A/G1B đầy đủ ngay sau, có mốc chốt. **(R1.0–R1.5 không còn áp dụng vì dữ liệu bỏ được — nếu production thật đã có dữ liệu sống thì khôi phục ràng buộc backup/reconcile.)**

---

## Bảng ánh xạ Finding → Wave (v3, sau D13)
| Finding | Mapping v3 | Ghi chú |
|---|---|---|
| F1 money bypass | **Nuốt vào W1.POLICY/W1.POLICY.2** (tiền = field `private` trong D13, không còn `org_fee` riêng) → G1B.1/G1B.2 → `regression` | không còn W1.2-1.4 tách rời |
| F2 session | G1B.3 → W1.7 (seam; backend DevOps chốt O4) | |
| F3 SSRF | G1B.4 → W1.8 | **CLOSED 2026-08-27** |
| F4/O8 AI governance | G0.8 + O8(provisional) → W1.AI-POLICY (gateway) → W3.VOICE (D14) → W4.VOICE | O8 tạm cho phép; gateway siết được sau bằng config |
| F5 mobile native | G0.4 (matrix, Section B/C do Codex dựng — C0.3) → W2.5 (contract-ready) → slice Wave 3 → W4.1-4.3 (runtime) | **D15: web-in-WebView + composition Native-Mobile RIÊNG BIỆT (không phải desktop responsive) — giảm khối lượng (không codebase native song song), KHÔNG giảm severity P0 (Codex C0.7)** |
| F12 event_id/API mismatch | Đăng ký ở `01-audit-findings.md`; chờ owner xác nhận ý định trước khi thêm vào Wave nào | mới (Codex round-3 re-audit R3-02D) |
| F13 reminders/notif hỏng trên MySQL (`scheduler.js` `IS ?`) | **ĐÃ FIX ở G1A.3 commit 5** (owner yêu cầu sửa ngay, không đợi Wave) — không còn trong backlog Wave | phát hiện G1A.3 commit 4 (characterization), sửa commit 5, xem `01-audit-findings.md` §D |
| F14 grandTotal báo cáo tổng hợp nối chuỗi trên MySQL (`routes.js` SUM() string) | **ĐÃ FIX ở G1A.3 batch reports-awards commit `119f81a`** (owner duyệt fix ngay, cùng cơ chế F13) — không còn trong backlog Wave | phát hiện batch reports-awards (characterization R052), xem `01-audit-findings.md` §D |
| F15 FK `award_participations.award_id` không thực thi trên MySQL | **ĐÃ SỬA — Claude 2026-08-30** | phát hiện batch reports-awards (characterization R067), P2. Root cause: MySQL âm thầm bỏ qua `REFERENCES` inline cột (chỉ SQLite honor); `mysql-sync.js`'s `translate()` nay tách thành `CONSTRAINT...FOREIGN KEY` out-of-line, xác nhận đủ 24/24 FK thật qua `information_schema`. Xem execution update + `01-audit-findings.md` §D |
| F17 `POST /api/monitor/scan` 500 trên MySQL (cột `sources.mode` không tồn tại do ALTER TABLE TEXT DEFAULT fail âm thầm) | **ĐÃ FIX ở G1A.3 batch monitor phần 1** (owner duyệt fix ngay, cùng cơ chế F13/F14/F16 — bug production nghiêm trọng, không phải trade-off cần hỏi) — không còn trong backlog Wave | phát hiện batch monitor phần 1 (characterization R110), P1, xem `01-audit-findings.md` §D |
| F18 SUM()/AVG() trả string trên MySQL ở 3 route report chưa từng sửa (`/reports` 9 mảng breakdown+tiers, `/reports/by-staff` spend/avgScore, `/reports/awards` mediaCost/totalCost nối chuỗi) | **ĐÃ FIX ở G1A.3, commit `4d133d9`** (owner duyệt fix ngay, cùng cơ chế F13/F14/F16/F17 — sai số liệu báo cáo tài chính trên MySQL, không phải trade-off cần hỏi) — không còn trong backlog Wave | phát hiện lúc rà soát toàn bộ SUM()/AVG() trong routes.js trước khi đóng route mapping 145/145, P1, xem `01-audit-findings.md` §D |
| F6 app.js monolith | W2.1-2.2 → slice Wave 3 | |
| F7 Atomics | G1.8 (baseline) → W2.3 (acceptance, ngưỡng DevOps) → W2.4 nếu fail | |
| F8 Gemini | G1A.7 → W1.9 → W2.6 (eval, $200) | |
| F9 attachment | **Nuốt vào W1.FILE** (per-file visibility D13.3) — R1 dual-write BỎ (dữ liệu bỏ được) | |
| F10 secret | G0.7 — đã đóng | |
| F11 role drift | **Nuốt vào W1.RBAC** (thay cả hệ vai trò, không "dọn banner") | |
| D13 RBAC v2 | **W1.RBAC.0/W1.RBAC.1/W1.RBAC.2/W1.POLICY/W1.OWN/W1.ADMIN/W1.FILE** (khối lớn nhất) | security-complete hoá theo C0.2 (2026-08-25): tách classification_tier/audience_visibility/authorization/egress, ma trận ownership đủ nhóm resource |
| D14 Voice | W3.VOICE.0/W3.VOICE.SECURE-COMMAND/W3.VOICE.1-2 + W4.VOICE | D14.2 chốt human-in-the-loop; D14.4 secure proposal/confirmation (C0.7/R3-08); cần bridge AMIS (DevOps) |
| D15 WebView host | ảnh hưởng W2.5/W3-native/W4.1-4.3 | native = web-in-WebView + composition Native-Mobile riêng (C0.7) — KHÔNG giảm severity F5, chỉ giảm khối lượng |

## Điều kiện release đầy đủ MDS/native (không đổi tinh thần)
Không tuyên bố "100% MDS/native" khi: matrix 4-vai-trò còn `UNVERIFIED` cho route release, HOẶC bridge AMIS Mobile thật chưa qua contract+device test trong WebView host (W4.1), HOẶC W2.3 chưa PASS. Release bật AI/voice: O8 hiện provisional đủ cho dữ liệu test; dữ liệu thật cần Security/Legal duyệt lại. Build `AI_DISABLED` release web-in-host pilot riêng — gọi đúng tên "web-in-host, AI tắt".
