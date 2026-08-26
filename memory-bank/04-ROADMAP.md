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
| G1A.3 | Integration API cho **ĐỦ 145 route** (không giới hạn nhóm module) — request/response shape, validate, not-found/conflict, side-effect DB, tính toán, audit, file/download, side-effect job nền; case tối thiểu mỗi route: happy + invalid + unauthenticated + not-found. **ĐANG LÀM — fast-track protocol (`17-fast-track-collaboration.md`, owner approved `ffdc3df`, 2026-08-26): audit theo batch 15-25 route, không theo từng commit.** Batch "reports-awards" (21 route) **ACCEPTED WITH BACKLOG (Codex 2026-08-26)** — xem dòng batch trước; F14 đã fix, F15 backlog Wave 1. Batch "suppliers" (R072-R086, 15 route, commit `21fffc3`) **XONG — chờ gửi Codex audit.** 43 test HTTP; xác nhận thêm bằng chứng F15 lan sang `supplier_quotes`/`supplier_transactions`/`supplier_contacts` (cùng pattern FK không cascade trên MySQL, đo trực tiếp qua `db` sau DELETE) — không phải phát hiện mới, chỉ củng cố phạm vi đã biết. Full regression trước handoff: SQLite 385 pass+7 skip, MySQL 391 pass+1 skip, security 6/6, verify-g0.mjs PASS. Mapping: 94/145 green, 51 TODO. Batch tiếp theo: events+dashboard(R087-R098) → monitor phần 1(R104-R120) → monitor phần 2(R121-R135) → ai(R136-R142) | test / — / — |
| G1A.4 | Concurrency/idempotency đã biết là lỗi hiện tại (reminder check-then-insert — `11-business-flows.md` §E, R3-02C) — viết test **xác nhận hành vi HIỆN TẠI có race** (không phải test hành vi đích), gắn cờ để Wave 1 thay bằng test hành vi đích khi sửa unique key | test / — / characterization, không phải target |
| G1A.5 | DB contract chạy CẢ SQLite + MySQL; acceptance chỉ MySQL | test / all / — |
| G1A.6 | UI characterization smoke — mọi module (không chỉ phần giữ) | test / — / — |
| G1A.7 | AI golden set: extraction/summary/report + malformed/timeout/quota, cả 12 luồng egress Gemini | test / — / — |
| G1A.8 | Scheduler/monitor background job: `runOnce()` reminder, `monitor.applySchedule()` auto-scan — verify side-effect (log/email/mention) không chỉ verify route HTTP | test / — / — |
| G1A.9 | **Khung (scaffold) XONG 2026-08-25 — Codex xác nhận PASS AS SCAFFOLD, chưa phải exit criterion.** `memory-bank/gate1-test-mapping.md` đã có đủ 145/145 route + `JOB-REMINDER`/`JOB-MONITOR-SCAN`, mọi dòng `status=TODO`, không lọt/trùng (Codex đếm độc lập xác nhận). Đây vẫn là khung rỗng. Phải điền `test_id`/`file`/`status` thật khi G1A.2-G1A.8 lần lượt hoàn thành; Gate 1 chỉ đóng khi không còn dòng `TODO`. Codex đề xuất thêm: verifier join route catalog ↔ mapping, validate `test_id`/`file`/`status` — chưa làm, ghi nhận làm việc sau | test / all / khung mapping tồn tại, nội dung thật chưa xong |
| G1A.10 | CI `regression` xanh; `npm audit` 3 lỗ (nanoid/postcss/body-parser) vá kèm test, không `audit fix` mù. **Backlog DevOps bổ sung (Codex re-audit round 3, R3-03, hạ từ blocker G1A.1 xuống SHOULD-FIX vì xác suất thấp trong môi trường local kiểm soát):** harness `test:integration:mysql` hiện mặc định bootstrap admin tới `TEST_MYSQL_HOST/PORT=127.0.0.1:3306` — về lý thuyết không phân biệt được container Docker MySQL test với một Cloud SQL Proxy local khác đang chiếm đúng loopback/port đó. Khi làm CI/devops hardening thật: pin Docker test sang cổng riêng (vd `127.0.0.1:3307`) + `TEST_MYSQL_*` khai báo rõ trong CI, hoặc thêm sentinel/identity check trước mọi DDL. Chưa chặn CLOSE G1A.1 | deploy / all / job `regression` xanh |

### G1B — Target RBAC v2 + security suite (KNOWN-RED, allowlist) — spec-first cho phần VIẾT LẠI (D13/F1/F2/F3/F9)
| # | Task | Evidence Contract |
|---|---|---|
| G1B.1 | **Target test RBAC v2 (D13, đã security-complete hoá theo C0.2):** 4 vai trò × `classification_tier`(bất biến) × `audience_visibility`(cấu hình, chỉ siết) × ownership (14 nhóm "hoạt động" trực tiếp + global/inherited/module-admin-only cho nhóm khác, D13.4a) × delete (chỉ Admin/Super Admin) — mô tả hành vi ĐÍCH, **KHÔNG được đóng băng hành vi RBAC cũ (2-role/`org_fee`) làm test xanh** | test / — / RED allowlist `D13` |
| G1B.2 | Money/file policy = 1 phần của G1B.1 (không còn suite riêng): field tiền chỉ là field `classification_tier=Confidential`; direct-ID file access theo trần server-derived + per-file visibility (D13.3b); derived/aggregate (`grandTotal` kiểu) không rò rỉ field bị ẩn (D13.4b) | test / — / RED allowlist `D13` |
| G1B.3 | Session target (F2): fixation/logout/rate-limit | test / — / RED allowlist `F2` |
| G1B.4 | SSRF matrix (F3): localhost/RFC1918/link-local/metadata/redirect | test / — / RED allowlist `F3` |
| G1B.5 | N1/N2 target (đã RESOLVED, xem `02-decisions.md` §B.1): route side-effect dùng action tường minh (`ack`/`notify`/`run`), `dashboard:view` tường minh cho mọi role được phép | test / — / RED allowlist `N1,N2` |
| G1B.6 | Mỗi RED ghi `{F-id/D13-target/N-id, owner, expiry}`; unexpected failure ngoài allowlist = build đỏ | test / all / CI `security-gap` |

### G1C — Acceptance E2E (GREEN sau Wave 1, mới theo C0.6) — journey đại diện 4 vai trò
| # | Task | Evidence Contract |
|---|---|---|
| G1C.1 | Journey đại diện cho mỗi vai trò (Viewer/Nhân viên thực thi/Admin/Super Admin) qua Desktop + Native-Mobile composition, sau khi W1/slice UI tương ứng xong — không viết trước W1, chỉ định nghĩa khung ở Gate 1 | test / all / GREEN sau W1, không phải điều kiện mở W1 |

### Perf baseline (song song, KHÔNG block)
| # | Task | Evidence Contract |
|---|---|---|
| G1.8 | Baseline F7: harness **assert `DB_CLIENT===mysql`**; profile 1/5/10/20/50, warm-up + sustained, mix read/write/report/file; artifact ghi engine/SHA/topology/CPU-RAM/pool/cardinality; thu p50/p95/p99, throughput, error, event-loop lag p99. **Không block refactor** | test / — / artifact bắt buộc, không kết luận "pass" ở bước này |

**Exit gate G1 (cập nhật theo C0.6):** (a) G1A.9 mapping 145/145 + job/flow tồn tại và đúng; (b) G1A GREEN đầy đủ (không phải chỉ "phần giữ nguyên"); (c) G1B mọi RED có allowlist hợp lệ, không unexpected failure, KHÔNG có RED nào đóng băng hành vi cũ thành "đúng"; (d) G1C khung đã định nghĩa (chưa cần xanh); (e) G1.8 có artifact. Không mechanical refactor khi G1A còn ô trống trong mapping.

---

## WAVE 1 — RBAC v2 nền tảng (D13) + security root-cause
**Ước lượng:** 3-5 tuần (khối lớn nhất). Nền tảng cho mọi wave sau.

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

### W1 — nhánh security (độc lập RBAC, chạy song song)
| # | Task | Finding | Phụ thuộc | Evidence Contract |
|---|---|---|---|---|
| W1.1 | Principal seam `resolvePrincipal(req)→req.principal` (Commit A, provider=web session) | F6/auth | G1A | code+test / all / — |
| W1.7 | Session hardening seam (F2): `secure`, regenerate login, fail-fast secret, revoke/logout, audit. **Backend store (bảng SQL/Redis) = interface, DevOps chọn implementation** (O4→DevOps) | F2 | G1A | code+test / — / fail-closed |
| W1.8 | `safeFetch` SSRF guard (F3), dùng chung monitor + award-extract | F3 | **không chờ gì — làm ngay** | code+test / — / fail-closed |
| W1.9 | aiGateway reliability: timeout/AbortController, retry 429/5xx, capability-map strip sampling-params. Chưa data-egress enforcement | F8 | **không cần O8** | code+test / — / — |
| W1.AI-POLICY | Data-egress **gateway cấu hình được** (không phải hard deny): tier/purpose allowlist, redact/minimize, retention/delete, egress audit KHÔNG chứa payload, kill-switch `AI_DISABLED`, negative tests. **Bao cả 12 luồng egress + SMTP** (`06-threat-model.md` §D). **O8 = PROVISIONAL (owner cho phép gửi Gemini tạm — dữ liệu test):** cấu hình mặc định CHO PHÉP, nhưng cơ chế deny-by-default có sẵn để siết chỉ bằng đổi config khi có dữ liệu thật + Security/Legal duyệt | F4 | **O8 provisional — xây ngay, không chờ** | code+test / — / gateway hoạt động, config permissive theo O8 hiện tại |

**Exit gate W1:** G1B.1/G1B.2 (RBAC v2 target) chuyển sang `regression` (hành vi D13 đã đúng, 4 vai trò + visibility + ownership pass); G1B.3/G1B.4 (F2/F3) chuyển `regression`; session bền qua restart (seam + DevOps backend); SSRF chặn metadata/private; `W1.AI-POLICY` xanh nếu O8 duyệt (chưa thì giữ `AI_DISABLED`). **Không còn 2-role, không còn `org_fee` hard-code, không còn 3 cách mask song song.**

---

## WAVE 2 — Shared contract & performance (exit hardened)
**Ước lượng:** 2-3 tuần.

| # | Task | Evidence Contract |
|---|---|---|
| W2.1 | Chuẩn hóa API envelope/schema/error/client dùng chung (`05-error-contract.md`: `message` canonical, `error` alias; xóa `error` khi frontend hết đọc ở Wave 3) | code+test / all / — |
| W2.2 | Tách business/domain khỏi page layout (cần W2.1 chốt trước) | code+test / all / — |
| W2.3 | **ACCEPTANCE gate F7:** PASS khi đạt SLO tại peak trên topology production-like. **Ngưỡng SLO + peak + topology + ngân sách instance do DevOps MISA chốt (O5→DevOps)** — Claude dựng harness đo + báo cáo, không tự đặt ngưỡng release. Nếu chưa async hóa: mitigation chỉ chấp nhận khi **đo lại vẫn PASS** + owner/DevOps + expiry + rollback. "Có async-plan" ≠ exit | test / — / **PASS bắt buộc, plan-only không đủ** |
| W2.4 | Nếu W2.3 fail: async repository pilot theo slice; benchmark lại sau mỗi slice; xóa mitigation khi đạt SLO | code+test / — / — |
| W2.5 | Host-adapter interface + fake browser + fake-native provider, chung contract test. **Exit = contract-ready only**; production provider `UNVERIFIED` tới O3 | code+test / native / fail-closed nếu chỉ 1 adapter |
| W2.6 | **Gemini eval/model migration (O6 duyệt $200):** corpus 60-100 ca tổng hợp, ≥3 repeat/candidate, **hard cap tổng chi phí $200**, threshold quality/schema-validity/latency/cost; canary+rollback; giữ pin `gemini-3.5-flash` nếu candidate không thắng rõ | test / — / cần theo dõi ngân sách $200 |

**Exit gate W2:** shared layer swap được qua contract test; **W2.3 PASS thật** (đo lại, ngưỡng DevOps chốt); W2.5 contract-ready (2 fake provider); W2.6 có kết luận giữ/đổi model trong ngân sách $200.

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
| F3 SSRF | G1B.4 → W1.8 | làm ngay |
| F4/O8 AI governance | G0.8 + O8(provisional) → W1.AI-POLICY (gateway) → W3.VOICE (D14) → W4.VOICE | O8 tạm cho phép; gateway siết được sau bằng config |
| F5 mobile native | G0.4 (matrix, Section B/C do Codex dựng — C0.3) → W2.5 (contract-ready) → slice Wave 3 → W4.1-4.3 (runtime) | **D15: web-in-WebView + composition Native-Mobile RIÊNG BIỆT (không phải desktop responsive) — giảm khối lượng (không codebase native song song), KHÔNG giảm severity P0 (Codex C0.7)** |
| F12 event_id/API mismatch | Đăng ký ở `01-audit-findings.md`; chờ owner xác nhận ý định trước khi thêm vào Wave nào | mới (Codex round-3 re-audit R3-02D) |
| F13 reminders/notif hỏng trên MySQL (`scheduler.js` `IS ?`) | **ĐÃ FIX ở G1A.3 commit 5** (owner yêu cầu sửa ngay, không đợi Wave) — không còn trong backlog Wave | phát hiện G1A.3 commit 4 (characterization), sửa commit 5, xem `01-audit-findings.md` §D |
| F14 grandTotal báo cáo tổng hợp nối chuỗi trên MySQL (`routes.js` SUM() string) | **ĐÃ FIX ở G1A.3 batch reports-awards commit `119f81a`** (owner duyệt fix ngay, cùng cơ chế F13) — không còn trong backlog Wave | phát hiện batch reports-awards (characterization R052), xem `01-audit-findings.md` §D |
| F15 FK `award_participations.award_id` không thực thi trên MySQL | Wave 1 (nhóm sửa contract/data-integrity) | phát hiện batch reports-awards (characterization R067), P2, chưa root-cause, xem `01-audit-findings.md` §D |
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
