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

> **Ghi chú ngữ cảnh owner (2026-08-31, không đổi gate, chỉ làm rõ mức rủi ro thật):**
> - **O3:** owner xác nhận trực tiếp mô hình D15 đúng như đã viết — AMIS Mobile là icon mở web app
>   trong WebView, và **có auto-login qua host (SSO)**, không phải người dùng tự đăng nhập lại. Xác
>   nhận này KHÔNG giảm phạm vi W4.1 (bridge session/token vẫn phải thiết kế thật, đúng
>   `02-decisions.md` §F: origin allowlist, token audience/TTL/chống replay, fail-closed) — chỉ xoá
>   nhánh giả định còn lại ("có thể không cần bridge nếu user tự login"), cơ chế cụ thể vẫn
>   `UNVERIFIED` tới khi DevOps+AMIS chốt bridge contract.
> - **O5:** quy mô người dùng thật rất nhỏ — toàn ngành dọc PR MISA cả nước chỉ **~30 người**, không
>   phải quy mô enterprise. Baseline G1.8 đo throughput không tăng theo tải + latency p50 tăng tuyến
>   tính 4.4ms→889ms (1→50 concurrent) — với peak thực tế nhiều khả năng thấp hơn hẳn 50, W2.3 gần
>   như chắc PASS mà không cần W2.4 (async pilot). Vẫn KHÔNG tự đặt ngưỡng thay DevOps (nguyên tắc
>   W2.3 không đổi) — chỉ là dữ liệu để DevOps chốt ngưỡng SLO sát thực tế hơn thay vì mặc định theo
>   quy mô lớn.
> - **O8:** owner xác nhận môi trường production MISA có quy trình pentest + chuẩn bảo mật nội bộ
>   riêng (không public) khi go-live — coi như phần "Security/Legal duyệt lại dữ liệu thật" đã có
>   kênh xử lý sẵn trong quy trình chuẩn của MISA, không phải backlog phát sinh thêm ngoài roadmap.

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
| G1B.1 | **Engine hoàn tất đủ D13.4a — Codex ACCEPT phần engine trong Bundle A 2026-08-28** (CHƯA đóng cả gate, xem ghi chú Codex cuối dòng) (`18-g1b-rbac-batch-contract.md#batch-g1b1-engine-completeness-2026-08-28`): thêm nhóm `INHERITED` (event_cost kế thừa owner_id của event cha — hàng "Chi phí sự kiện" D13.4a đã owner-approved, code trước đó thiếu) vào `policy-engine.js`; mở rộng `unit-policy-engine.test.js` phủ đủ 14 Direct + 4 Global + 6 Module-admin-only + 1 Inherited (D13-012..016, tất cả GREEN — engine đã đúng generic cho phần lớn, chỉ event_cost RED trước khi thêm INHERITED). **Owner đã duyệt mở rộng route-wiring ra toàn bộ 24 entity còn lại (2026-08-30), tự chọn cách chia batch — không còn cần xin thêm cho scope chung, chỉ còn tiến độ từng batch.** Tiến độ route-wiring (ghi/create/edit/delete, GET/view của TẤT CẢ entity kể cả `person` vẫn còn khoảng trống chung — xem ghi chú batch RBAC-EXP-B1): `person` (pilot, GET detail + PUT/DELETE + file) XONG; **Batch 1/6 — 6 entity Module-admin-only (budget/scan_query/source/competitor/campaign/monitor_alert) XONG 2026-08-30** (`18-g1b-rbac-batch-contract.md#batch-rbac-exp-b1-module-admin-2026-08-30`); còn 18 entity (14 Direct + 3 Global + 1 Inherited) chưa làm — batch RBAC-EXP-B2..B6 tiếp theo. Money/file (G1B.2) đã có nền: `classification_tier=Confidential` cho field tiền (D13-016), file visibility ceiling (D13.3b) chưa test HTTP vì chưa có route file nào gắn PolicyEngine ngoài `person`. **Batch RBAC-CUTOVER 2026-08-30 (owner chốt, `02-decisions.md` §G.1) — XONG:** bỏ hoàn toàn hệ 2-role legacy (`super_admin`/`pr_staff`) khỏi `server/rbac.js`, chuyển dứt khoát sang DUY NHẤT 4 vai trò D13 (`viewer/executor/admin/super_admin`); route chưa gắn PolicyEngine (121/145 còn lại) nay tự động đúng cho cả 4 vai trò qua MATRIX mở rộng, không còn 403 sai cho viewer/admin; phát hiện+vá luôn 1 gap D13.1 (Admin vô tình có full quyền module `admin` giống Super Admin — đã guard riêng, test D13-031..034). **Batch RBAC-FIELDVIS-FIX 2026-08-30 (P0 tự phát hiện trước Batch 2) — XONG:** field Public-tier bị ẩn mặc định cho viewer/executor (không chỉ field mật) — đã sửa `canReadField()`/`isPublic()` đúng D13.2b, phát hiện thêm MySQL chưa dịch đúng UPSERT `field_visibility`. **Batch RBAC-EXP-B2 2026-08-30 (2/6 — Global còn lại: organization/supplier/important_date) — XONG:** `GET/PUT/DELETE /api/partners/:id`, `/api/suppliers/:id`, `PUT/DELETE /api/reminders/:id` gắn PolicyEngine giống pattern `person`; dọn `stripDisallowed()` đã hết call site thật. **Batch RBAC-EXP-B3 2026-08-30 (3/6 — 2 entity Direct đầu tiên: booking/interaction) — XONG:** `POST /api/interactions` (create+owner_id), `GET/POST/PUT/DELETE /api/bookings`+`/:id` gắn PolicyEngine — executor CHỈ sửa bản ghi CHÍNH mình tạo (`owner_id`), KHÔNG BAO GIỜ xoá được kể cả chủ sở hữu (khác Global — điểm này chủ đã hỏi lại và xác nhận qua AskUserQuestion). **Batch RBAC-EXP-B4 2026-08-30 (4/6 — award/award_participation/event + entity Inherited đầu tiên event_cost) — XONG:** `policy-service.js` mở rộng nhận `parentOwnerId`; `award`/`award_participation`/`event` gắn PolicyEngine theo owner_id; `event_cost` (Inherited) kế thừa owner_id của event cha qua `parentOwnerId`; sửa đúng 2 chỗ map nhầm quyền (award_participation DELETE, event_cost POST). **Batch RBAC-EXP-B5 2026-08-30 (5/6 — supplier_contact/supplier_transaction/supplier_quote) — XONG:** đúng mẫu owner_id-gate đã lặp lại 3 lần trước; cả 3 DELETE sửa đúng từ map nhầm 'edit' sang 'delete' thật. **Batch RBAC-EXP-B6 2026-08-30 (6/6, BATCH CUỐI CÙNG — sponsorship/agreement/work_log/gift/association_fee/benefit_usage) — XONG:** cùng mẫu owner_id-gate; `gift` dùng `responsible_user_id` (KHÁC `owner_id` là người nhận quà); tất cả DELETE sửa đúng. **TOÀN BỘ 24/24 entity D13.4a đã có PolicyEngine wiring — kế hoạch 6 batch owner duyệt 2026-08-30 đã HOÀN TẤT.** Xem execution update chi tiết dưới `WAVE 3` header. | test / — / engine GREEN đủ D13.4a; 2-role legacy ĐÃ BỎ HOÀN TOÀN; route-wiring PolicyEngine: **24/24 entity XONG** — Global 4 (person/organization/supplier/important_date), Module-admin-only 6, Inherited 1 (event_cost), Direct 13 (booking/interaction/award/award_participation/event/supplier_quote/supplier_transaction/supplier_contact/sponsorship/agreement/work_log/gift/association_fee/benefit_usage). Không còn batch RBAC-EXP-B* nào trong kế hoạch |
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
| W1.POLICY.2 | Service command = choke point mọi sensitive write; wrapper `authorizedInsert/Update` bắt buộc `principal+resource+operation`; CI static rule cấm raw SQL ghi field ngoài policy (dọn 10 nhóm write-bypass F1 + 3 cách mask song song — `16-coding-rules.md` §8). **Phần READ (2026-08-31):** `projectRecord()` nay là choke point duy nhất cho MỌI route GET (kể cả list + collection lồng), dọn hết `rbac.maskList/senGroups/maskMoney/canMoney` cũ (SUPERSEDED — `02-decisions.md` O7) + `scripts/verify-g0.mjs#verifyNoLegacyMasking()` cấm tái phát — xem `18-g1b-rbac-batch-contract.md#batch-w1policy2-2026-08-31`. **Phần WRITE (2026-08-31, batch `W1.POLICY.2-write-side`):** audit độc lập xác nhận KHÔNG còn write-bypass nào trong `routes.js` (10 nhóm bypass gốc F1 đã đóng hết qua RBAC-EXP-B1..B6) — tìm ra 1 lớp bug mới (F23: 3 route ghi `important_dates` gate nhầm theo quyền `view` của module cha, viewer tạo được dữ liệu không đúng quyền), đã sửa + thêm CI guard `verifyImportantDatesGate()`. **Quyết định KHÔNG xây wrapper `authorizedInsert/Update` tổng quát** — không còn bug cụ thể nào thúc đẩy, xây thêm là premature abstraction — xem `01-audit-findings.md` §F23. **Không còn backlog nào của W1.POLICY.2.** | W1.POLICY | code+test / — / fail-closed |
| W1.OWN | Logic ownership: quyền sửa = `user.id===owner_id` HOẶC Admin/Super Admin bypass; delete chỉ Admin/Super Admin (D13.4b); Nhân viên thực thi tự xem đầy đủ bản ghi mình `owner`; Admin gán/gán lại `owner_id` (giải quyết cả dữ liệu cũ owner=NULL + nhân viên nghỉ việc). **Không self-claim — owner APPROVED 2026-08-25** (D13.4c, C0.1, không còn là mặc định chờ xác nhận). Bao gồm resource-policy nhóm global/inherited/module-admin-only (D13.4a) cho organizations/people/suppliers/important_dates/budgets/event_costs/monitoring | W1.POLICY | code+test / — / fail-closed |
| W1.ADMIN | Backend/API (Desktop MDS UI thuộc lane Codex, chưa giao lại): (a) cấu hình field public/private theo module — **XONG 2026-08-31** (`GET/PUT /api/admin/field-visibility`, D13.2b chỉ siết không nới); (b) gán/gán lại owner cho bản ghi — **XONG 2026-08-31** (`PUT /api/admin/records/:entity/:id/owner`, `REASSIGNABLE_OWNER_TABLE` 14 entity Direct, qua `policyService.prepareUpdate()`); (c) quản vai trò 4 cấp — **đã có sẵn từ trước, không cần code thêm** (`PUT /admin/users/:id` đã có D13.1 escalation protection). Super Admin config API key/audit_log: đã có sẵn (`GET /admin/audit`). **Không còn backlog nào của W1.ADMIN** (backend/API) — UI chờ owner giao lại lane. | W1.OWN | code+test / — / fail-closed |
| W1.FILE | Attachment: visibility per-file lúc upload (D13.3), classification server-derived cho gate `/files/:id` theo owner+action+visibility (D3, F9). File cũ default `private`. **Không cần R1 dual-write/reconcile — dữ liệu bỏ được, seed sạch**. `GET /files/:id` nay gate ĐỦ 6 owner_type thật (F21, Codex ACCEPTED WITH BACKLOG 2026-08-31) — **P2 (upload chưa gate owner_id của Direct entity) đã sửa 2026-08-31, batch `W1.FILE-P2`**: award/event/agreement/work_log upload nay gate owner_id giống PUT/DELETE của chính entity; supplier upload giữ role-gate (Global entity, đúng thiết kế). **P3 (metadata file chưa lọc theo visibility) đã xác định là WON'T-FIX 2026-08-31 (đúng thiết kế D13 "existence vs content", không phải bug)** — xem `01-audit-findings.md` §F21. **F24 (P1, Codex audit trên bundle đóng W1) đã sửa 2026-08-31, batch `F24-remediation`:** authorization của 4 route upload file nay chạy TRƯỚC Multer qua middleware `requireFileWrite()`, không còn để deny tạo file mồ côi trên đĩa — xem `01-audit-findings.md` §F24. **Không còn backlog nào của W1.FILE; chờ Codex re-audit F24.** | W1.POLICY | code+test / — / fail-closed |

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
| W2.5 | Host-adapter interface + fake browser + fake-native provider, chung contract test. **XONG — contract-ready (Codex 2026-09-01):** registry chọn surface tường minh, Native thiếu provider fail-closed (không fallback Browser), capability state + lifecycle/safe-area/deep-link/Back/gesture có fake contract test; xem `25-w2-host-adapter-contract.md`. Production provider vẫn `UNVERIFIED` tới O3. **Lane: Codex** — interface sống ở `frontend/` | code+test / native / contract-ready, không phải device-pass |
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

> **Execution update — 2026-08-31 (W2.6 recheck theo yêu cầu owner, XÁC NHẬN LẠI GIỮ PIN):** owner đề
> nghị đổi sang `gemini-3.7-flash` (tin là model mới nhất/chưa test) — chỉ ra kết luận W2.6 gốc
> (2026-08-30) đã test đúng model này và có regression. Owner chọn "chạy lại eval trước khi đổi" thay
> vì đổi ngay hoặc giữ nguyên theo kết quả cũ. Chạy lại độc lập đủ 360 lệnh gọi thật (tag `recheck`,
> `scripts/w26-eval-run.mjs --tag=recheck --repeats=3`), thêm `--tag=` cho
> `scripts/w26-eval-analyze.mjs` để phân tích song song 2 lần chạy không ghi đè nhau. **Kết quả lặp
> lại gần như y hệt bản gốc:** `gemini-3.5-flash` schema=100%/acc=99.7%/p50=6.9s/p90=13.9s/max=31.0s,
> chi phí $2.942; `gemini-3.7-flash` schema=100%/acc=98.8%/p50=4.2s/p90=6.3s/**max=96.7s**, chi phí
> $1.589. Riêng `event-extract`: candidate vẫn thua rõ (schema 95%/acc 95% so với pin 100%/100%,
> khớp mẫu regression gốc 98%/96%). Latency trung vị/p90 của candidate cải thiện nhiều (do mẫu ngẫu
> nhiên khác + ít bị outlier hơn ở phần lớn ca) nhưng **đuôi xấu nhất (max) tệ hơn bản gốc** (96.7s
> so với 70.7s) — rủi ro đuôi latency dài kèm output hỏng ở D10 vẫn tái hiện, không phải nhiễu một
> lần. **Quyết định (không đổi so với gốc, theo đúng D10):** candidate vẫn KHÔNG thắng rõ — **GIỮ
> NGUYÊN pin `gemini-3.5-flash`**, không đổi `cfg.GEMINI_TEXT_MODEL`. Owner đồng ý sau khi xem dữ
> liệu recheck. Dữ liệu thô lưu `scripts/.w26-eval-out/results-recheck.jsonl` (commit cùng gốc làm
> evidence đối chiếu). Tổng chi phí 2 lần eval: $4.456 + $4.531 = **$8.987/$200** (O6). Không đổi
> code sản phẩm, không đổi test — chỉ thêm `--tag=` (tương thích ngược, mặc định vẫn `full`) và dữ
> liệu eval mới.

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

> **Execution update — 2026-08-30 (RBAC-EXP-B4: batch 4/6 mở rộng 24 entity — award/
> award_participation/event + entity Inherited đầu tiên event_cost):** Batch Contract:
> `18-g1b-rbac-batch-contract.md#batch-rbac-exp-b4-2026-08-30`. Mở rộng `policy-service.js` để
> `assertWritable/prepareCreate/prepareUpdate/projectRecord` nhận thêm `parentOwnerId` (tương thích
> ngược) — lần đầu service layer thật sự gọi tới nhánh Inherited (engine đã hỗ trợ sẵn từ G1B.1
> nhưng chưa route nào dùng). **Phát hiện trước khi viết code:** `award_participations`/
> `event_costs` chưa từng có cột `created_by` thật (chỉ có `owner_id` gán qua migration trước) —
> `prepareCreate()` luôn gán `created_by` không điều kiện, thiếu cột sẽ làm INSERT lỗi ngay lập
> tức; fix bằng 2 dòng `ALTER TABLE ... ADD COLUMN created_by INTEGER` TRƯỚC khi wiring.
>
> `award` (`GET/POST/PUT/DELETE /api/awards`, `/api/awards/:id`): GET dùng `projectRecord()` che
> `cost`; PUT theo owner_id; DELETE chỉ Admin/Super Admin. `award_participation`: entity Direct
> RIÊNG — KHÔNG kế thừa owner của award cha (dễ nhầm vì là "con" về route path, nhưng D13.4a liệt
> kê rõ nó thuộc nhóm 14 Direct); DELETE sửa đúng từ map nhầm 'edit' sang 'delete' thật. `event`:
> không có field Confidential riêng, nhưng `total_cost`/`costs`/`totals` là tổng hợp từ event_cost
> (Inherited) nên che theo `owner_id` của CHÍNH EVENT qua `policy.canReadField()` trực tiếp (không
> qua `projectRecord()` — đây là trường tổng hợp, không phải field thật trên record). `event_cost`
> (Inherited): `parentOwnerId` = `owner_id` event cha; POST dùng action `create` đúng thực tế (trước
> map nhầm 'edit'); DELETE chỉ Admin/Super Admin.
>
> Test mới: D13-052..058 (award/award_participation), D13-059..065 (event/event_cost). Full
> regression: security 6/6, SQLite 754/8 skip, MySQL 761/1 skip, mapping 145/145 PASS,
> `verify-g0.mjs` PASS, `git diff --check` sạch. **Còn lại: 9 Direct entity (sponsorship/agreement/
> work_log/gift/association_fee/supplier_quote/supplier_transaction/supplier_contact/
> benefit_usage) — batch RBAC-EXP-B5..B6 tiếp theo.**

> **Execution update — 2026-08-30 (RBAC-EXP-B5: batch 5/6 mở rộng 24 entity — supplier_contact/
> supplier_transaction/supplier_quote):** Batch Contract: `18-g1b-rbac-batch-contract.md#batch-
> rbac-exp-b5-2026-08-30`. Đúng y hệt mẫu đã lặp lại 3 lần trước (award_participation B4, booking/
> interaction B3) — không còn rủi ro thiết kế mới, chỉ còn đúng nghĩa entity/cột.
> `supplier_quotes`/`supplier_transactions`/`supplier_contacts` cũng thiếu `created_by` thật —
> thêm `ALTER TABLE` trước khi wiring. `GET /api/suppliers/:id`: quotes/transactions đổi sang
> `projectRecord()` (che `unit_price`/`value`); contacts giữ nguyên (không có field Confidential).
> Cả 3 entity CRUD owner_id-gate; **cả 3 DELETE đều sửa đúng** từ map nhầm 'edit' sang 'delete'
> thật (chỉ Admin/Super Admin). `supplier_quote` không có route PUT thật (giữ nguyên
> CHARACTERIZATION).
>
> Test mới: D13-066..070. Full regression: security 6/6, SQLite 759/8 skip, MySQL 766/1 skip,
> mapping 145/145 PASS, `verify-g0.mjs` PASS, `git diff --check` sạch. **Còn lại: 6 Direct entity
> (sponsorship/agreement/work_log/gift/association_fee/benefit_usage) — batch RBAC-EXP-B6 (batch
> cuối cùng) tiếp theo.**

> **Execution update — 2026-08-30 (RBAC-EXP-B6: BATCH CUỐI CÙNG, đóng 24/24 entity D13.4a —
> sponsorship/agreement/work_log/gift/association_fee/benefit_usage):** Batch Contract:
> `18-g1b-rbac-batch-contract.md#batch-rbac-exp-b6-2026-08-30--batch-cuoi-cung-dong-2424-entity`.
> 6 bảng này cũng thiếu `created_by` thật — thêm `ALTER TABLE` trước khi wiring. `GET /api/
> partners/:id`: sponsorships/fees/gifts đổi sang `projectRecord()` (che amount/amount/value theo
> owner-bypass); agreements/workLogs/benefitUsages giữ nguyên (không có field Confidential). **Chú
> ý `gift`**: `owner_id`/`owner_type` là NGƯỜI/CƠ QUAN NHẬN quà (nghiệp vụ), KHÁC chủ sở hữu RBAC
> dùng cột riêng `responsible_user_id`. Cả 6 entity CRUD owner_id-gate; TẤT CẢ DELETE đều sửa đúng
> từ map nhầm 'edit' sang 'delete' thật.
>
> Test mới: D13-071..077. Full regression: security 6/6, SQLite 766/8 skip, MySQL 773/1 skip,
> mapping 145/145 PASS, `verify-g0.mjs` PASS, `git diff --check` sạch.
>
> **TỔNG KẾT: 24/24 entity D13.4a đã có PolicyEngine wiring — kế hoạch 6 batch RBAC-EXP-B1..B6
> owner duyệt 2026-08-30 đã HOÀN TẤT.** Global 4 (person/organization/supplier/important_date),
> Module-admin-only 6 (budget/scan_query/source/competitor/campaign/monitor_alert), Inherited 1
> (event_cost), Direct 13 (booking/interaction/award/award_participation/event/supplier_quote/
> supplier_transaction/supplier_contact/sponsorship/agreement/work_log/gift/association_fee/
> benefit_usage). Còn lại ngoài scope entity-wiring: UI-flow matrix SS B.2 (Codex lane);
> `policyService.prepareUpdate()` chưa route nào gọi thật — không phải exit criterion của
> RBAC-EXP-B1..B6.

> **Execution update — 2026-08-31 (remediation F21/F22 — Codex audit BLOCKED trên Evidence Bundle
> F15→RBAC-EXP-B6):** Codex audit `21-audit-bundle-f15-rbac-exp-b1-b6.md` trả BLOCKED với 2 finding
> tái hiện được: **F21 (P0)** `GET /api/files/:id` phục vụ file `private` của 5 owner_type ngoài
> `person` (award/supplier/event/agreement/work_log) không gate gì — Viewer tải được tài liệu private
> của người khác (bypass D13.3, IDOR); **F22 (P1)** batch RBAC-CUTOVER thiếu migration dữ liệu
> `users.role='pr_staff'`→`'executor'`, user cũ bị lockout 403 toàn bộ sau deploy. Chi tiết root
> cause + resolution đầy đủ: `01-audit-findings.md` §F21/§F22.
>
> Fix: `server/policy-engine.js#canReadAttachment()` thêm owner-bypass Direct/Inherited giống
> `canReadField()`; `server/routes.js` thêm `ATTACHMENT_OWNER_ENTITY` map cố định 6 owner_type thật
> → owner_type lạ fail-closed 403 cho MỌI role kể cả Admin; `server/db.js#migrate()` thêm
> `UPDATE users SET role='executor' WHERE role='pr_staff'` (idempotent tự nhiên). Test mới:
> D13-078/079 (`integration-awards.test.js`), D13-080 (`integration-suppliers.test.js`),
> DB-CONTRACT-006 (`integration-db-contract.test.js`).
>
> Full regression: security 6/6, SQLite 770 pass/8 skip (+4), MySQL 777 pass/1 skip (+4), mapping
> 145/145 route PASS (không route mới), `verify-g0.mjs` PASS, `git diff --check` sạch. Backlog
> ngoài phạm vi P0/P1 (không sửa, đã báo cáo trong `01-audit-findings.md` §F21): upload file
> award/supplier/event/agreement/work_log chưa gate owner_id của Direct entity (P2); metadata
> attachment (tên file, không phải nội dung) chưa lọc theo owner (P3). **Sẵn sàng Codex re-audit
> tập trung đúng 2 điểm F21/F22.**
>
> **Codex ACCEPTED WITH BACKLOG — 2026-08-31 (re-audit commit `051a9f9`):** "Không còn P0/P1 trong
> phạm vi re-audit." Evidence Codex tự xác nhận: `routes.js:685`/`policy-engine.js:65` (F21),
> `db.js:709` (F22, tái hiện restart thật `pr_staff`→`executor` có lại `partners:view`). Verify độc
> lập: focused SQLite 101/101, focused MySQL 101/101; full security/SQLite/MySQL/mapping/G0
> verifier/diff-check đều exit 0; F15 xác nhận lại vẫn đúng (24 FK thật). Backlog hợp lệ không chặn,
> đã có sẵn owner+wave trong roadmap (không phải finding mới): **P2/P3 → hàng `W1.FILE`** ở trên;
> **W1.ADMIN** (UI/API gán lại owner) đã có sẵn hàng riêng. **Bundle `F15 → RBAC-EXP-B6` chính thức
> CLOSED — chuyển ưu tiên tiếp theo sang batch `W1.FILE` khi owner quyết định.**

> **Execution update — 2026-08-31 (batch `W1.POLICY.2`, theo `/goal` "làm hết các vấn đề của W1"):**
> Rà soát có hệ thống toàn bộ route GET dùng entity Confidential/Restricted, đóng nốt phần READ của
> hàng `W1.POLICY.2` (đã ghi vào roadmap từ trước F21/F22, chưa làm vì ưu tiên P0/P1 trước). Tìm và
> sửa 4 route: `GET /partners` (list) + nested `people` trong `GET /partners/:id` (đổi từ
> `rbac.maskList/senGroups` cũ sang `projectRecord()`), `GET /people` (list, tương tự), `GET
> /suppliers` (list, trước đây KHÔNG mask gì), `GET /budgets` (trước đây KHÔNG mask gì —
> `amount` Confidential nay Module-admin-only, nhất quán `supplier.service_fee_pct`). Xoá hẳn
> `senGroups/senVisible/canMoney/maskMoney` (hết call site thật) + 2 unit test mồ côi. Thêm CI guard
> `scripts/verify-g0.mjs#verifyNoLegacyMasking()` cấm tái phát cơ chế mask cũ trong `routes.js`. 5
> test dual-driver mới (D13-081..085). Full regression: security 6/6, SQLite 781/773 pass/8 skip,
> MySQL 781/780 pass/1 skip, mapping 145/145, `verify-g0.mjs` PASS, `verify-g0-selftest` 6/6, `git
> diff --check` sạch. Nhân dịp này xác định P3 backlog của F21 (metadata file chưa lọc visibility)
> là **WON'T-FIX** — đúng thiết kế D13 "existence vs content" (`02-decisions.md` dòng 96), không
> phải bug — xem `01-audit-findings.md` §F21. Còn lại của W1: **W1.FILE P2** (upload chưa gate
> owner_id) và **W1.POLICY.2 write-side** (`authorizedInsert/Update` wrapper) và **W1.ADMIN** (owner
> reassignment, field-visibility config UI — UI thuộc lane Codex) — batch tiếp theo.

> **Execution update — 2026-08-31 (batch `W1.FILE-P2`, theo `/goal` "làm hết các vấn đề của W1"):**
> Đóng backlog P2 của F21: `POST /awards|events/:id/files` và `POST /agreements|work-logs/:id/files`
> (award/event/agreement/work_log là entity Direct) nay fetch record thật + gọi
> `policyService.assertWritable({principal, entity, action:'edit', record})` trước khi insert
> attachment — đúng pattern PUT của chính 4 entity này đã dùng từ RBAC-EXP-B4/B6, thay
> `requirePerm(module,'edit')` thô theo role. `govFileUpload(ownerType)` đổi thành
> `govFileUpload(entity, table)` để fetch đúng bảng cha. **Ngoài phạm vi có chủ đích:** `POST
> /suppliers/:id/files` KHÔNG sửa — supplier là entity Global (executor sửa được bất kể ai tạo,
> không có owner-bypass trên PUT/DELETE của chính nó), gate thô theo role hiện tại là đúng thiết
> kế — xác nhận qua đọc `GLOBAL` set trong `policy-engine.js`, không tự suy diễn. 4 test mới
> (D13-086..089: executor upload vào record người khác trả 403 — trước đây 200 — vào record chính
> mình vẫn 200, admin luôn 200). Full regression: security 6/6, SQLite 785/777 pass/8 skip, MySQL
> 785/784 pass/1 skip, mapping 145/145, `verify-g0.mjs` PASS, `verify-g0-selftest` 6/6, `git diff
> --check` sạch. **Không còn backlog nào của W1.FILE** (P2 đã sửa, P3 đã xác định WON'T-FIX). Còn
> lại của W1: **W1.POLICY.2 write-side** (`authorizedInsert/Update` wrapper, CI rule cấm raw SQL
> ghi field ngoài policy) và **W1.ADMIN** (owner reassignment API, field-visibility config UI — UI
> thuộc lane Codex) — batch tiếp theo.

> **Execution update — 2026-08-31 (batch `W1.POLICY.2-write-side`, theo `/goal` "làm hết các vấn đề
> của W1"):** Trước khi code, chạy 1 audit độc lập (agent) quét toàn bộ route ghi trong
> `routes.js`, đối chiếu module khai ở `requirePerm()` với bảng thực sự bị ghi. Kết quả: KHÔNG còn
> write-bypass nào khác (10 nhóm bypass gốc F1 đã đóng hết qua RBAC-EXP-B1..B6) — nhưng phát hiện
> **F23** (tự phát hiện, P2): `POST /partners/:id/fees/:fid/remind` (R028), `POST /awards/:id/remind`
> (R071), `POST /events/:id/remind` (R096) đều ghi `important_dates` nhưng gate theo
> `requirePerm(<module cha>,'view')` thay vì `requirePerm('reminders','create')` đúng — `viewer`
> (có `<module cha>:view` nhưng không có `reminders:create`) tạo được nhắc lịch qua lối tắt này.
> Đã sửa cả 3 route (không ảnh hưởng executor/admin/super_admin). CI guard mới:
> `scripts/verify-g0.mjs#verifyImportantDatesGate()` — phạm vi hẹp có chủ đích (1 bảng), đã thử
> nghiệm revert tạm để xác nhận bắt được lỗi. `08-permission-matrix.md` Section A cập nhật đếm lại
> (partners 41→40, awards 12→11, events 11→10, reminders 12→15, tổng vẫn 145). 3 test mới
> (D13-090..092). Full regression: security 6/6, SQLite 788/780 pass/8 skip, MySQL 788/787 pass/1
> skip, mapping 145/145, `verify-g0.mjs` PASS, `verify-g0-selftest` 6/6, `git diff --check` sạch.
> **Quyết định KHÔNG xây wrapper `authorizedInsert/Update` tổng quát** — không còn bug cụ thể nào
> thúc đẩy, sẽ là premature abstraction — xem `01-audit-findings.md` §F23. **Không còn backlog nào
> của W1.POLICY.2.** Còn lại của W1: **W1.ADMIN** (owner reassignment API backend, field-visibility
> config API backend — UI thuộc lane Codex) — batch tiếp theo, batch cuối của W1.

> **Execution update — 2026-08-31 (batch `W1.ADMIN`, theo `/goal` "làm hết các vấn đề của W1" —
> BATCH CUỐI CÙNG CỦA W1):** Đóng 3 mục con của `W1.ADMIN` (phạm vi backend/API, UI thuộc lane
> Codex theo `CLAUDE.md` mục 6 chưa được giao lại): (a) 2 route mới expose `policy-visibility-
> store.js` (có sẵn từ batch RBAC trước nhưng chưa từng gọi được qua HTTP) — `GET`/`PUT /api/admin/
> field-visibility`, enforce D13.2b "chỉ siết không nới" (400 `FORBIDDEN_TIER` nếu mở public field
> không phải Public-tier); (b) 1 route mới `PUT /api/admin/records/:entity/:id/owner` — phát hiện
> `policyService.prepareUpdate()`'s `OWNER_TRANSFER_ADMIN_ONLY` đã tồn tại từ các batch RBAC-EXP
> trước nhưng KHÔNG route nào từng lọt field owner qua `pick()` allowlist, nên hoàn toàn không thể
> gọi tới trong thực tế — route mới dùng `REASSIGNABLE_OWNER_TABLE` (14 entity Direct) + đi qua
> `prepareUpdate()` làm defense-in-depth; (c) rà soát role management — xác nhận `PUT /admin/
> users/:id` đã có sẵn D13.1 escalation protection, không cần code thêm. **Lần đầu tiên trong
> session thêm route MỚI** (mọi batch trước chỉ re-gate route có sẵn) — cập nhật đồng bộ toàn bộ hệ
> thống tài liệu tự-verify: `07-route-catalog.md` (+R146/R147/R148, 145→148), `08-permission-
> matrix.md` (Section A admin 5→8, tổng 145→148; Section B +flow F035 + token mới `D-MISSING` cho
> route backend/API chưa có UI — khác `D-403`; 34→35 flow), `scripts/verify-g0.mjs` +
> `scripts/verify-gate1-mapping.mjs` (hằng số 145/34→148/35) + `gate1-test-mapping.md` (+3 dòng),
> `server/test/ui-characterization.test.js` (34/145→35/148), `16-coding-rules.md`/`README.md` (đếm
> route song hành). 15 test mới (`integration-auth-admin.test.js` R146/R147/R148, cả 2 driver). Full
> regression: security 6/6, SQLite 803/795 pass/8 skip, MySQL 803/802 pass/1 skip, mapping 148/148,
> `verify-g0.mjs` PASS toàn bộ 9 check, `verify-g0-selftest` 6/6, `git diff --check` sạch. **Không
> còn backlog nào của `W1.ADMIN` (backend/API)** — UI chờ owner giao lại lane Codex.
>
> **→ W1 ĐÓNG HOÀN TOÀN (2026-08-31).** Rà soát lại toàn bộ 2 bảng `W1.*` (nhánh RBAC v2 +
> nhánh security) ở trên: `W1.RBAC.0` (preflight script + regression đã xong 2026-08-27; cutover
> DB production thật là hành động DevOps-gated, tương tự O3/O4/O5, KHÔNG phải backlog phía Claude),
> `W1.RBAC.1/2` XONG (schema + 4 vai trò, nền tảng cho mọi batch RBAC đã chạy suốt session),
> `W1.POLICY`/`W1.POLICY.2`/`W1.OWN`/`W1.ADMIN`/`W1.FILE` đều XONG không còn backlog (xem từng hàng
> trên), `W1.1`/`W1.8`/`W1.9`/`W1.AI-POLICY` đều XONG, `W1.7` XONG phần logic thật — chỉ còn durable
> session STORE chờ DevOps chọn implementation (O4), không chặn đóng W1 theo đúng ghi chú "O3/O4/O5
> không chặn G0/G1/W1.RBAC/W1.8/W1.9" đã có sẵn ở trên. **Không còn sub-item W1 nào ở trạng thái mở
> phía Claude** — thoả mãn `/goal` "làm hết các vấn đề của W1".
>
> **Evidence Bundle đã gửi Codex audit (2026-08-31):** `22-audit-bundle-w1-close.md` — gộp 4 batch
> `W1.POLICY.2` (read+write-side)/`W1.FILE-P2`/`W1.ADMIN` thành 1 audit-closure bundle theo §12/§14
> `17-fast-track-collaboration.md`. Tuyên bố "W1 đóng hoàn toàn" ở trên là tự đánh giá phía Claude;
> chỉ chính thức CLOSED sau khi Codex trả ACCEPTED/ACCEPTED WITH BACKLOG trên bundle này.
>
> **Codex audit trả BLOCKED hẹp (2026-08-31) — F24 (P1):** 4 route upload file (award/event/
> agreement/work_log) chạy `assertWritable()` SAU khi Multer đã ghi file thật vào `UPLOAD_DIR` —
> tái hiện thật: executor upload vào award của admin nhận đúng `403` nhưng file vẫn tăng `0→1` trên
> đĩa, tạo file mồ côi không có row `attachments` quản lý (vi phạm "deny phải không có
> side-effect"). **Đã fix ngay (batch `F24-remediation`):** middleware mới
> `requireFileWrite(entity, table, moduleLabel)` chạy TRƯỚC `upload.array()` cho cả 4 route, chỉ
> `next()` khi `assertWritable()` pass — Multer chỉ ghi file sau khi authorized. 8 test mới
> `integration-file-write-authz.test.js` (table-driven, cả 2 driver) xác nhận deny KHÔNG tăng
> `attachments`/file vật lý, và case đối chứng (upload hợp lệ) CÓ tăng đúng 1 — đã thử nghiệm revert
> tạm để xác nhận test bắt đúng lỗi F24 trước khi coi test đủ. Full regression: security 6/6, SQLite
> 811/803 pass/8 skip (+8), MySQL 811/810 pass/1 skip (+8), mapping 148/148, `verify-g0.mjs` PASS,
> `verify-g0-selftest` 6/6, `git diff --check` sạch. **Chờ Codex re-audit tập trung đúng F24** (theo
> `17-fast-track-collaboration.md` §8 — không mở lại toàn bộ 4 batch trong bundle) — tuyên bố "W1
> đóng hoàn toàn" vẫn CHỈ là tự đánh giá phía Claude cho tới khi có kết quả re-audit.
>
> **Codex ACCEPTED — F24 re-audit (2026-08-31):** xác nhận độc lập `requireFileWrite()` chạy
> authorization TRƯỚC Multer ở đủ 4 route (`routes.js:365,391,1333,1657`); chạy lại độc lập 8 test
> F24 trên cả SQLite/MySQL — mọi upload trái quyền đều 403, không tăng `attachments`/`UPLOAD_DIR`,
> upload đúng quyền tăng đúng 1 ở cả 2 nơi; G0 verifier, mapping 148/148, `git diff --check` đều
> xanh. **Quyết định: chấp nhận remediation `0e0c2d6`/docs `707cc45`.** UI Native-MDS cho
> `W1.ADMIN` vẫn là lane UI riêng (chưa giao lại Claude), không ảnh hưởng kết luận đóng phần
> backend/security. **→ W1 (backend/security) CHÍNH THỨC CLOSED (2026-08-31, Codex xác nhận).**

---

## WAVE 3 — Strangler UI theo vertical slice (trên RBAC v2 mới) + slice Voice (D14)
**Ước lượng:** 3-6 tuần (cuốn chiếu). Mỗi slice tự chờ: test + policy/service + shared contract **của chính slice** xanh. **Mọi slice xây trên RBAC v2 (W1) — 4 vai trò + visibility + ownership, KHÔNG phải 2-role cũ.**

Thứ tự: 1) **People Detail (pilot)** → 2) Partner Detail → 3) Supplier/Booking/File → 4) People List/Forms/Interactions → 5) **Voice Assistant (D14, track riêng — cần O8 + D14.2)** → 6) Events/Awards/Smart Intake → 7) Monitoring/Reports/Admin/Reminders.

Mỗi slice: characterization/spec → mechanical extraction (commit riêng) → policy/service (RBAC v2) → Desktop MDS token/component → Native composition (W2.5 contract) → role/device test. **Exit mỗi slice:** không còn SQL/business-rule trong controller slice; desktop MDS pass token/a11y/visual; native composition pass contract test; regression xanh; rollback độc lập.

> **Execution update — 2026-09-01 (W3.PEOPLE.READ):** bắt đầu strangler People Detail bằng batch
> đọc hẹp, feature-flagged, không cutover write/file legacy. Vue island chia domain/API, Desktop
> MDS và Native composition độc lập; route `#person/:id` chỉ được claim khi host bật
> `peopleDetailRead`. Native thiếu provider fail-closed trong native shell, không về desktop.
> Contract/matrix/giới hạn runtime ở `26-w3-people-detail-read-batch-contract.md`. Visual review,
> build và regression cục bộ đã đạt; O3/W4 vẫn chặn mọi tuyên bố Native production pass.

> **Execution update — 2026-09-01 (W3.PEOPLE pilot visual review):** visual review xác thực đã
> chạy ở Desktop và Native fake provider; read/write/file/delete UI đều có build + regression
> liên quan xanh. Bổ sung local-only harness để review không cần giả mạo production host và
> regression `UI-PARTNER-ADD-001` cho toàn bộ bốn loại cơ quan. Đây **không** là device-pass:
> O3/W4 vẫn chặn Native AMIS production, và header legacy ngoài island không thuộc scope cutover.

> **Execution update — 2026-09-01 (W3.PARTNER.READ):** mở batch read hẹp tiếp theo theo đúng
> thứ tự strangler. Contract `27-w3-partner-detail-read-batch-contract.md` giữ hội phí/tài trợ/
> MOU/tệp/write ở legacy cho đến slice policy riêng, chỉ chuyển record đã projection + person rows
> + ngày nhắc qua Desktop MDS và Native composition độc lập.

> **Execution update — 2026-09-01 (W3.PARTNER.WRITE-CORE):** mở rộng chính batch Partner Detail
> bằng form lõi an toàn cho R005/R006: chỉ `name`/`website`/`address`, không `membership_fee`,
> `org_type`, owner/role hay sub-resource. UI chỉ gợi ý action theo `GET /api/me`; PolicyEngine
> vẫn là nguồn quyền cuối cùng khi PUT/DELETE. Desktop/Native form đều đã visual review local;
> phần hội phí/MOU/tệp/tài trợ/booking/tương tác vẫn là slice riêng.

> **Execution update — 2026-09-01 (W3.PARTNER.COOPERATION-CREATE):** mở lát cắt kế tiếp theo thứ
> tự Partner Detail: tạo MOU (R010) và ghi nhận làm việc (R013) cho đối tác bộ ngành. Hai form
> Desktop MDS/Native mini-app là composition độc lập, footer Lưu/Hủy có safe-area/draft confirm,
> và chỉ gửi tập field create tối thiểu. Loại làm việc dùng `MSelect` MDS cho đúng 4 lựa chọn;
> client không gửi owner/file hay tự quyết quyền. Sửa/xóa/tệp MOU/work-log vẫn để legacy tới slice
> ownership/file-policy tiếp theo. Evidence/matrix ở `27-w3-partner-detail-read-batch-contract.md`;
> Native AMIS production vẫn **UNVERIFIED** cho tới O3/W4 device evidence.

> **Execution update — 2026-09-01 (W3.PARTNER.COOPERATION-DELETE):** nối R012/R015 cho
> Admin/Super Admin bằng xác nhận `MDialog` danger ở cả Desktop và Native. Đây là UI-gate để giảm
> thao tác nhầm, không thay PolicyEngine: request DELETE vẫn bị server xác minh action `delete`.
> Sửa (R011/R014) và tệp (R016/R017) chưa được claim, vì ownership/file-policy là slice độc lập.

> **Execution update — 2026-09-01 (W3.PARTNER.AGREEMENT-EDIT):** nối R011 bằng form MDS riêng
> Desktop/Native. Để tránh client-side authorization, `owner_id` chỉ dùng gợi ý hiển thị cho executor;
> PUT vẫn qua PolicyEngine của server và lỗi 403 hiển thị lại trong form. Payload không chứa owner,
> created-by hay file. Work-log edit/tệp vẫn là scope kế tiếp.

> **Execution update — 2026-09-01 (W3.PARTNER.WORK-LOG-EDIT):** nối R014 cùng quy tắc ownership
> UI-gợi ý/PolicyEngine-server của R011. Bốn loại làm việc dùng `MSelect`; ba trạng thái dùng
> `MRadioGroup` MDS. Native là form riêng có safe-area và confirm bỏ draft. Tệp R016/R017 là slice
> cuối của Partner sub-resource và chưa được claim.

> **Execution update — 2026-09-01 (W3.PARTNER.FILE):** nối R016/R017 upload và R037 mở tệp bằng
> `MUpload` MDS, metadata từ Partner Detail và `/api/files/:id` protected. Không dựng xoá vì
> endpoint delete attachment cho agreement/work-log đang fail-closed đúng thiết kế. Native chỉ được
> xác thực bằng fake host; chọn tệp thực trong AMIS WebView tiếp tục chờ O3/W4 bridge/device test.

> **Execution update — 2026-09-01 (W3.SUPPLIER.READ):** bắt đầu slice Supplier/Booking/File bằng
> Supplier Detail read tối thiểu, feature-flagged. Vue island Desktop MDS và Native composition
> riêng chỉ tiêu thụ `record` từ R072 sau `PolicyEngine.projectRecord`; các tỷ lệ phí chỉ hiện khi
> property đã được server projection. Báo giá, giao dịch, contact, ngày nhắc, tệp và mọi write vẫn
> là legacy cho tới contract policy riêng, để không lộ tiền hoặc bypass ownership. Contract:
> `28-w3-supplier-detail-read-batch-contract.md`; Native AMIS production vẫn **UNVERIFIED** đến O3/W4.

> **Execution update — 2026-09-01 (W3.SUPPLIER.WRITE-CORE):** thêm form MDS Desktop/Native
> cho R082 với allowlist Public `name`, `industry`, `address`, `services`, `tax_code`,
> `invoice_type`, `note`. Không gửi `service_fee_pct`, `deposit_pct`, contact hay link nhóm đặt
> hàng; UI chỉ gợi ý quyền, PUT vẫn do PolicyEngine/server kiểm tra. Quote/transaction/file và
> create/delete vẫn thuộc slice policy sau.

> **Execution update — 2026-09-01 (W3.SUPPLIER.FILE):** bổ sung metadata/upload tệp báo giá
> bằng `MUpload` MDS. Theo D13 “existence vs content”, metadata hiện được; file private của
> Supplier Global chỉ có link mở cho Admin/Super Admin, role khác thấy trạng thái Hạn chế rõ ràng.
> Upload vẫn bị server kiểm tra lại; không dựng xóa do API hiện fail-closed. Native file bridge thật
> vẫn **UNVERIFIED** tới O3/W4.

> **Execution update — 2026-09-01 (W3.BOOKING.READ):** thay tab trống trong People Detail bằng
> danh sách Booking MDS Desktop/Native lấy từ R046. Component chỉ hiện `amount` nếu property đã
> qua projection, giữ `total_amount` nguyên vẹn từ server (không tính aggregate ở client); do đó
> viewer/executor không lộ tổng tiền của bản ghi người khác. Create/edit/delete Booking và org
> detail booking tiếp tục là slice ownership/form kế tiếp.

> **Execution update — 2026-09-01 (W3.BOOKING.CREATE):** thêm form tạo Booking trong People
> Detail, Desktop MDS và Native form riêng. Form gắn cứng `subject_type='person'`/`subject_id`
> từ route, không gửi owner, org, created_by hay award; backend vẫn tự resolve org và gán ownership.
> Amount được nhập như dữ liệu Confidential có chủ đích nhưng read lại chỉ theo PolicyEngine.
>
> **Execution update — 2026-09-01 (W3.BOOKING.EDIT):** thêm form sửa Desktop MDS và Native
> composition riêng. UX chỉ đưa thao tác sửa cho executor sở hữu booking hoặc Admin/Super Admin,
> nhưng `PUT /bookings/:id` vẫn là nơi PolicyEngine re-check quyền. Payload edit chỉ gồm các field
> booking cho phép, không đổi owner, nhân sự, cơ quan hay award. Xóa là affordance riêng cho
> Admin/Super Admin, có dialog xác nhận MDS và luôn gọi `DELETE /bookings/:id` để PolicyEngine
> re-check; executor không nhận affordance đó. Bề mặt booking trên Partner Detail tiếp tục ở slice
> kế tiếp.

> **Execution update — 2026-09-01 (W3.PEOPLE.LIST.READ):** bắt đầu People List/Forms/Interactions
> bằng danh bạ đọc thuần, feature-flagged (`peopleListRead`; local harness dùng `uiPeoplePilot=1`).
> Desktop MDS table và Native mini-app list là hai composition riêng, dùng R020 với tìm kiếm/phân
> trang và chỉ render field có trong projection. Không hiển thị số liên hệ cá nhân hay dựng form
> create ở batch này; mở hồ sơ chuyển sang People Detail đã có policy slice. Caretaker filter,
> create form và interaction vẫn là batch sau để không trộn ownership/sensitive policy vào read.
>
> **Execution update — 2026-09-01 (W3.PEOPLE.CREATE):** thêm create compact Desktop MDS và
> Native composition riêng từ danh bạ. Chỉ gửi allowlist Public: cơ quan bắt buộc, tên, cấp bậc,
> chức vụ, mảng, nhóm, điểm quan hệ, trạng thái, email/điện thoại công việc. Không đưa vào form
> số cá nhân, ngân hàng, địa chỉ nhà, dữ liệu đời tư, caretaker, owner hay created_by; `POST
> /people` vẫn kiểm tra `partners:create` ở server. Edit mở rộng và Interaction tiếp tục là batch
> kế tiếp.
>
> **Execution update — 2026-09-01 (W3.INTERACTIONS.LIST.READ):** bắt đầu Interaction bằng danh
> sách read-only Desktop MDS và Native mini-app riêng, feature-flagged `interactionsListRead`
> (local harness: `uiInteractionsPilot=1`). List dùng R044, search/pagination, không render
> `owner_id`/`created_by` hay suy diễn quyền ở client. Ghi tương tác, picker đối tác và Voice
> trigger vẫn để batch create kế tiếp.

> **Execution update — 2026-09-01 (W3.INTERACTIONS.CREATE):** hoàn thiện form ghi tương tác
> Desktop MDS và Native mini-app riêng. Action chỉ là affordance theo `interactions:create` từ
> `/api/me`; R043 bắt buộc chọn đối tác và payload không chấp nhận `owner_id`, `created_by` hay
> caretaker từ client. Native có Back/discard confirmation và safe-area sticky action. `UI-INT-002/003`
> khóa contract payload, quyền action và hai composition; kiểm chứng native AMIS runtime, accessibility
> thiết bị/lifecycle/deep link vẫn **UNVERIFIED**, chờ O3 host contract.

> **Execution update — 2026-09-01 (W3.VOICE.UI review):** thêm UI Desktop MDS và Native composition
> riêng cho R149/R150: tệp audio → proposal → rà soát field/candidate → confirm bằng idempotency key.
> Client không tự chọn candidate mơ hồ, không gửi owner/created_by và không tự ghi interaction. Thu âm
> trực tiếp/mic runtime trong AMIS Mobile (W3.VOICE.2), accessibility thiết bị và deep-link host vẫn
> **UNVERIFIED/BLOCKED bởi O3**; UI chỉ cho chọn tệp audio, không giả microphone production.

> **Execution update — 2026-09-01 (W3.EVENTS.LIST.READ):** Event List read pilot dùng R087,
> feature-flag `eventsListRead` (local harness: `uiEventsPilot=1`), có Desktop MDS và Native
> composition riêng. Chỉ render projection sự kiện; không hiển thị `total_cost`, owner, file hoặc
> cost breakdown. Event detail/create/edit, chi phí, file và Smart Intake vẫn là slice sau.

> **Execution update — 2026-09-01 (W3.EVENTS.DETAIL.READ):** mở rộng pilot sang R088 qua hash
> `events/:id`, vẫn dùng cùng feature flag. Desktop Detail và Native mini-app là hai composition
> riêng; client chỉ tạo view-model từ allowlist thông tin công khai, không render `owner_id`,
> assignment, raw cost rows hay attachments, và không tự tính tổng chi phí. List row và Native
> list item mở detail theo route; tạo/sửa/xóa, chi phí, file và Smart Intake vẫn là slice sau.
> Browser/local đã kiểm tra Event List; native AMIS runtime, accessibility thiết bị và host bridge
> cho Detail vẫn **UNVERIFIED**, chờ O3/W4.

> **Execution update — 2026-09-01 (W3.EVENTS.CORE.EDIT):** Detail mở action Sửa khi `/api/me`
> có `events:edit`; đây chỉ là affordance, lưu lại vẫn đi `PUT /events/:id` qua PolicyEngine. Form
> Desktop/Native tái dùng allowlist core đã khóa (`EVENT_PUBLIC_FIELDS`), không nhận owner,
> caretaker, chi phí hay file. Xóa, cost/file flows và Smart Intake tiếp tục tách slice để không
> trộn authorization/data classification vào core edit.

> **Execution update — 2026-09-01 (W3.EVENTS.CORE.DELETE):** thao tác xóa chỉ hiện khi `/api/me`
> có `events:delete`, luôn qua dialog xác nhận MDS ở Desktop và Native rồi mới gọi `DELETE
> /events/:id`. Client không tự quyết ownership/role, nhận lỗi 403 từ server như state hiển thị;
> cost/file và Smart Intake vẫn là slice độc lập.

> **Execution update — 2026-09-01 (W3.EVENTS.COST.READ):** Detail hiển thị 4 tổng chi phí
> (tài trợ/tổ chức/truyền thông/tổng) đúng nguyên văn projection `totals` của R088. Không cộng từ
> dòng chi phí tại browser; giá trị mask được giữ nguyên. Tạo/sửa/xóa từng cost line và file metadata
> vẫn tách slice vì route/file policy còn cần contract riêng.

> **Execution update — 2026-09-01 (W3.EVENTS.FILE):** Event Detail hiển thị metadata tệp được R088
> projection (tên/loại/MIME) và chỉ đưa action tải lên khi `/api/me` có `events:edit`. Mở/tải luôn qua
> endpoint server đã có PolicyEngine (`GET /files/:id`, `POST /events/:id/files`); client không tự
> quyết visibility hay truy xuất file. Không đưa nút xóa vì `DELETE /attachments/:aid` hiện cố ý
> fail-closed cho Event — tránh affordance hỏng. Desktop/Native vẫn là hai composition MDS; native
> AMIS runtime, host bridge và accessibility thiết bị tiếp tục **UNVERIFIED** tới O3/W4.

> **Execution update — 2026-09-01 (W3.EVENTS.COST.WRITE):** mỗi nhóm chi phí có view từ `costs`
> projection của R088, giữ nguyên số tiền/tổng bị mask và tuyệt đối không tự cộng ở browser. Form
> create/edit Desktop và Native là hai composition MDS riêng; payload chỉ có allowlist `EC_COLS` và
> gọi `POST/PUT /events/:id/costs`. Xóa chỉ hiện theo `events:delete`, có confirm MDS rồi gọi
> `DELETE /events/:id/costs/:cid`; backend vẫn là nơi chốt inherited owner và quyền write/delete.

> **Execution update — 2026-09-01 (W3.AWARDS.LIST/DETAIL.READ):** bổ sung Award List và Detail
> read-only, feature-flagged `awardsListRead` (local harness: `uiAwardsPilot=1`) qua R062/R063.
> Desktop MDS và Native mini-app là hai composition riêng; projection giữ nguyên giá trị mask chi phí,
> không render owner/caretaker/budget participation, metadata tệp mở lại qua `/files/:id` để server
> kiểm tra quyền. CRUD Award/participation, upload, reminder và AI extract là slice sau; native host,
> accessibility thiết bị và bridge vẫn **UNVERIFIED** tới O3/W4.

> **Execution update — 2026-09-01 (W3.AWARDS.CORE.WRITE):** mở create/edit Award qua R064/R065.
> Cả Desktop MDS và Native composition đều gate action bằng `awards:create`/`awards:edit`, nhưng đây
> chỉ là affordance: payload core dùng allowlist, không có owner/caretaker/file; `POST`/`PUT` vẫn để
> PolicyEngine quyết định quyền và ownership. Form hiện ưu tiên trường nghiệp vụ lõi; các trường nâng
> cao (liên kết tổ chức, AI/review, cơ cấu giải và cách đánh giá) được giữ nguyên khi sửa và sẽ mở
> trong slice form mở rộng, cùng participation/file/reminder/AI extract. Native host bridge,
> accessibility thiết bị và production AMIS runtime vẫn **UNVERIFIED** tới O3/W4.
> Nếu R063 không projection một field (ví dụ `cost` bị policy ẩn), form edit không render field đó và
> client không gửi key tương ứng trong `PUT`; tránh biến một thao tác sửa thông tin công khai thành
> ghi đè `null` lên dữ liệu Confidential ở server.

> **Execution update — 2026-09-01 (W3.AWARDS.PARTICIPATION):** thêm/sửa/xóa kỳ tham gia qua
> R066/R067/R068. Desktop và Native dùng form/panel riêng; client chỉ gửi allowlist `PART_COLS`,
> không nhận/gửi owner. Với executor, nút Sửa chỉ là affordance khi `owner_id` của raw projection
> trùng principal hiện tại; xóa chỉ hiện cho Admin/Super Admin. Server vẫn `prepareCreate`/
> `assertWritable` là authority cuối cùng. Budget Confidential bị omission khỏi projection sẽ không
> được render/gửi lại trong update, tránh ghi đè dữ liệu ẩn. Upload/reminder/AI extract Award là
> slice sau; host/device evidence còn **UNVERIFIED** tới O3/W4.

> **Execution update — 2026-09-01 (W3.AWARDS.FILE):** Award detail Desktop/Native có composition
> tệp riêng, gọi `POST /awards/:id/files` bằng `FormData` và chỉ hiện upload affordance theo
> `awards:edit`; việc open tiếp tục qua `/files/:id`. Client chỉ giữ metadata projection và không
> tự tính visibility/owner; route server `requireFileWrite` kiểm tra lại trước Multer. Chưa hiển thị
> nút xóa vì API Award hiện không có contract delete file an toàn cho slice này.
>
> **Execution update — 2026-09-01 (W3.SMART-INTAKE.AWARD):** bổ sung entry AI bóc tách giải
> thưởng cho Desktop MDS và Native composition riêng. Người dùng chỉ được chọn **một** nguồn
> (nội dung, URL HTTPS hoặc ảnh/PDF); client gọi `POST /ai/award-extract`, nhận kết quả rồi chuyển
> sang form tạo Award để người dùng rà soát/chủ động lưu — không có ghi tự động. Nếu `/api/me`
> không cấp nhóm nhạy cảm `org_fee`, client bỏ `cost` khỏi bản nháp AI trước khi render. Đây là
> phòng vệ UX/projection, không thay thế AI egress policy, validation hay PolicyEngine ở server;
> native AMIS runtime, bridge và accessibility thiết bị vẫn **UNVERIFIED** tới O3/W4. Event Smart
> Intake là slice riêng, chưa được mở trong batch Award này.
>
> **Execution update — 2026-09-01 (W3.SMART-INTAKE.EVENT):** bổ sung entry AI bóc tách Event
> đúng contract R141: chỉ một nguồn văn bản **hoặc** file Excel/CSV, không nhận URL/ảnh/PDF như Award.
> Response gồm `extracted`, `missing`, `warnings` được chuyển thành bản nháp Event rồi hiển thị ở
> form review Desktop/Native; warning và field AI chưa thấy vẫn được giữ trong form trước khi người
> dùng chủ động lưu. Ngày `YYYY-MM-DD` từ schema AI được chuẩn hóa thành `T00:00` để tương thích
> control `datetime-local`, không tự suy diễn giờ. Client không tự ghi Event, server vẫn là authority
> cho AI egress, validation và PolicyEngine; native AMIS runtime/device evidence vẫn **UNVERIFIED**
> tới O3/W4.
>
> **Execution update — 2026-09-01 (W3.MONITOR.DASHBOARD.READ):** mở Monitoring Dashboard
> read-only qua `GET /monitor/dashboard`, feature-flagged `monitoringDashboardRead` (local harness:
> `uiMonitoringPilot=1`). Desktop MDS và Native mini-app là hai composition riêng, chỉ render
> projection KPI/sentiment/NSR/alert/last-run; không đưa owner, nội dung nguồn thô, scan, AI
> grounding, config hay mutation vào pilot. Feature được lazy-load cùng Award slice để giữ entry
> bundle chính dưới ngưỡng 500 kB (sau build ~437 kB). Quét, Mentions CRUD, campaign/config và AI
> là các slice quyền riêng tiếp theo; native AMIS bridge/device evidence vẫn **UNVERIFIED** tới O3/W4.
>
> **Execution update — 2026-09-01 (W3.REPORTS.OVERVIEW.READ):** mở Reports Overview qua
> `GET /reports`, feature-flagged `reportsOverviewRead` (local harness: `uiReportsPilot=1`). Desktop
> MDS và Native composition riêng chỉ render projection tổng chi, ngân sách, booking/sự kiện/hội phí,
> network và rủi ro chăm sóc; browser không cộng/tính lại tiền từ các dòng nguồn. Kỳ tháng/quý/năm
> được tạo bởi hàm thuần có test ngày cuối tháng/quý (bao gồm tháng 2), tránh sai phạm vi tính tiền.
> Slice lazy-load độc lập; report theo nhân sự/đơn vị/award/care-alert chi tiết là phần sau. Native
> AMIS bridge/device evidence tiếp tục **UNVERIFIED** tới O3/W4.
>
> **Execution update — 2026-09-01 (W3.ADMIN.USERS.READ):** thêm Admin Users list read-only,
> feature-flagged `adminUsersRead` (local harness: `uiAdminPilot=1`). Desktop và Native MDS chỉ
> render projection tài khoản/tên/email/role/trạng thái từ `GET /admin/users`; `sensitive_perms`
> không đi qua view-model hoặc UI. Create/edit/delete user, audit log, field visibility và reassign
> owner tiếp tục là slice mutation riêng với confirmation/PolicyEngine test; Native host/device vẫn
> **UNVERIFIED** tới O3/W4.
>
> **Execution update — 2026-09-01 (W3.ADMIN.AUDIT.READ):** mở Audit log read-only ngay trong Admin
> feature qua `GET /admin/audit`. UI chỉ gợi action cho Super Admin sau khi đọc `/api/me`; API vẫn là
> authority và trả 403 cho role khác. Desktop table và Native mini-app list là hai composition riêng;
> audit detail chỉ hiển thị cho dữ liệu server đã cho phép trả về, không lẫn `sensitive_perms` từ màn
> Users. User CRUD, field visibility và reassign owner vẫn là các slice mutation riêng kế tiếp, đều
> cần confirmation + kiểm tra PolicyEngine/server-error; Native host/device vẫn **UNVERIFIED** tới
> O3/W4.
>
> **Execution update — 2026-09-01 (W3.ADMIN.USERS.WRITE):** bổ sung create/edit/delete User trên
> Desktop MDS và Native composition riêng. Form chỉ gửi allowlist account/name/role/email/password/
> active/notify; tuyệt đối không có `sensitive_perms` hay bất kỳ owner/created-by nào. UI thu hẹp
> role option cho Admin thường, chặn self-delete và dùng MDialog danger trước xoá; đây là affordance,
> server vẫn thực thi D13.1 và trả 403/409 nếu role/principal thay đổi. Field visibility và reassign
> owner tiếp tục là hai mutation PolicyEngine slice riêng; native host/device vẫn **UNVERIFIED** tới
> O3/W4.

> **Execution update — 2026-09-01 (W3.ADMIN.FIELD-VISIBILITY):** bổ sung cấu hình hiển thị trường
> cho module `partners`, dùng `GET /admin/field-visibility?module=partners` và `PUT
> /admin/field-visibility`. UI chỉ cho phép **siết** quyền bằng payload cố định
> `{ module, field, is_public: false }`; không có affordance công khai/khôi phục, nên không thể biến
> thao tác client thành đường nới classification. Mỗi lần ẩn đều qua MDialog; PolicyEngine và server
> vẫn là authority cuối cùng cho role/tier và trả lỗi đúng hợp đồng. Desktop table/card và Native
> mini-app có top bar/safe-area là hai composition riêng. Reassign owner vẫn là slice kế tiếp, cần
> được đặt trong ngữ cảnh chi tiết entity thay vì một form generic; native host/device tiếp tục
> **UNVERIFIED** tới O3/W4.

> **Execution update — 2026-09-01 (W3.ADMIN.REASSIGN-OWNER pilot):** mở pilot gán lại owner trên
> **Award Detail** (một entity Direct) qua `GET /admin/users` và `PUT
> /admin/records/award/:id/owner`. Đây không phải generic form cho 14 entity: Admin/Super Admin mở
> từ chính record, thấy chủ sở hữu hiện tại, chọn duy nhất tài khoản active và xác nhận danger trước
> khi gửi payload allowlist `{ owner_id }`. UI không cho gửi thay đổi no-op về chính owner hiện tại;
> server vẫn chạy `requirePerm('admin','edit')`, xác nhận record/tài khoản active và PolicyEngine
> `prepareUpdate()` ở thời điểm write. Desktop form/card và Native mini-app/safe-area là hai
> composition tách biệt. Các entity Direct còn lại chỉ được nhân rộng sau khi pilot được review;
> native host/device tiếp tục **UNVERIFIED** tới O3/W4.

> **Execution update — 2026-09-01 (W2.2 + W3.ADMIN.REASSIGN-OWNER Event):** sau pilot Award,
> tách `owner-reassign` thành domain projection và hai composition Desktop/Native dùng chung ở
> `features/ownership/`, rồi mở thêm Event Detail qua `PUT /admin/records/event/:id/owner`.
> Component chung chỉ nhận context đã projection (`resourceLabel`, record title, owner hiện tại,
> roster active); Event/Award giữ riêng permission gate, entity route và sau-write reload. Luồng vẫn
> một chiều: chọn active owner khác người hiện tại → MDialog danger → allowlist `{ owner_id }` →
> server/PolicyEngine re-check. Đây là phần thực thi W2.2 có test, không phải shared generic form
> bỏ qua context. Các Direct entity khác tiếp tục theo cùng checklist context/projection trước khi
> mở; native host/device vẫn **UNVERIFIED** tới O3/W4.
>
> **Execution update — 2026-09-01 (W3.ADMIN.REASSIGN-OWNER Partner):** mở tiếp đúng ngữ cảnh
> Partner Detail cho hai entity Direct có mặt trong projection: `agreement` và `work_log`. Action
> chỉ hiện cho `admin.edit`; mỗi dòng giữ entity, tiêu đề và owner hiện tại của chính bản ghi, tải
> roster active qua endpoint protected, dùng shared Desktop/Native owner flow và MDialog danger rồi
> mới gửi allowlist `{ owner_id }` tới `PUT /admin/records/:entity/:id/owner`. Không tạo form gán
> owner mù: endpoint, resource label, refresh sau ghi và lỗi 403 đều được giữ tại feature Partner.
> `UI-PAR-013` khóa hai endpoint, payload, gate, confirmation và Native composition. Các Direct
> entity còn lại chỉ được rollout khi feature của chúng có projection owner và context detail đủ
> để người quản trị đánh giá việc chuyển giao; native host/device vẫn **UNVERIFIED** tới O3/W4.
>
> **Execution update — 2026-09-02 (W3.ADMIN.REASSIGN-OWNER Booking):** mở gán lại owner từ đúng
> dòng Booking trong People Detail. Feature giữ record id/title cục bộ, dùng shared owner
> projection/composition cho Desktop và Native, chỉ hiển thị action theo `admin.edit`, và xác nhận
> MDialog trước payload `{ owner_id }` tới `PUT /admin/records/booking/:id/owner`. Booking amount
> vẫn là projection PolicyEngine và không bị client tính lại/lộ thêm vì mutation này. `UI-PPL-017`
> kiểm chứng roster, endpoint, payload, context, confirmation và Native composition. Các entity
> Direct còn lại tiếp tục phải qua checklist projection/context riêng; native host/device vẫn
> **UNVERIFIED** tới O3/W4.
>
> **Execution update — 2026-09-02 (W3.SUPPLIER.READ + ADMIN.REASSIGN-OWNER):** Supplier Detail
> nay có ba tab read-only cho `supplier_quote`, `supplier_transaction` và `supplier_contact`, với
> Desktop MDS và Native composition riêng. Giá báo/giá trị giao dịch chỉ được render khi property
> tương ứng thực sự nằm trong PolicyEngine projection; browser không suy đoán hoặc khôi phục trường
> Confidential bị ẩn. Mỗi dòng có projection owner và action `Gán` chỉ khi principal có
> `admin.edit`; shared flow giữ entity/id/nhãn trong context, lấy roster active từ endpoint
> protected, chặn no-op, yêu cầu MDialog rồi mới gửi allowlist `{ owner_id }` tới đúng ba endpoint
> supplier. `UI-SUP-008` kiểm chứng API allowlist, confirmation, projection và cả hai composition.
> Rollout Direct còn lại: Interaction, Award participation, Sponsorship, Gift, Association fee và
> Benefit usage. Native AMIS runtime/device vẫn **UNVERIFIED** tới O3/W4.
>
> **Execution update — 2026-09-02 (W3.INTERACTION.READ + ADMIN.REASSIGN-OWNER):** trước khi mở
> mutation, R044 được đưa qua `PolicyEngine.projectRecord()` thay vì trả raw SQL row. UI chỉ giữ
> `ownerId` đã projection làm context kỹ thuật (không render mặc định), còn Admin có đủ thông tin
> đối tác/ngày/nội dung tại đúng dòng Interaction để đánh giá chuyển giao. Action `Gán` dùng shared
> Desktop/Native owner flow, roster protected, chặn no-op và MDialog confirmation, rồi gọi duy nhất
> `PUT /admin/records/interaction/:id/owner` với `{ owner_id }`. `D13-081` khóa HTTP projection
> trên SQLite/MySQL; `UI-INT-004` khóa endpoint/payload/gate/composition. Direct còn lại: Award
> participation, Sponsorship, Gift, Association fee và Benefit usage; Native device vẫn
> **UNVERIFIED** tới O3/W4.
>
> **Execution update — 2026-09-02 (W3.ADMIN.REASSIGN-OWNER Award Participation):** rollout đúng
> ngữ cảnh từng Kỳ tham gia trong Award Detail, không dùng form chuyển owner mù. Action `Gán` chỉ
> xuất hiện khi `admin.edit`; Desktop và Native truyền id/title của kỳ được chọn vào shared ownership
> flow, lấy roster active từ endpoint protected, chặn no-op và xác nhận MDialog trước payload
> `{ owner_id }` tới `PUT /admin/records/award_participation/:id/owner`. Native dùng composition
> riêng và mọi action tạo/sửa/gán/xóa có touch target MDS 48px. `D13-082` xác nhận executor bị chặn,
> Admin ghi được và GET Award phản ánh owner server-derived trên SQLite/MySQL (45/45 mỗi driver);
> `UI-AWARD-007` khóa endpoint, payload, permission/context, confirmation và Native composition.
> Direct còn lại: Sponsorship, Gift, Association fee, Benefit usage. Native host/device vẫn
> **UNVERIFIED** tới O3/W4.
>
> **Execution update — 2026-09-02 (W3.ADMIN.REASSIGN-OWNER Partner Direct hoàn tất):** bốn entity
> còn lại `sponsorship`, `gift`, `association_fee`, `benefit_usage` nay xuất hiện đúng trong tab Hợp
> tác của Partner Detail với hai panel Desktop/Native tách biệt. View model chỉ lấy title/date/status
> đã server-projection; không mang `amount`/`value` Confidential sang UI. Gift dùng đúng
> `responsible_user_id` (không nhầm `owner_id` là cơ quan nhận quà). `Gán` chỉ hiện khi `admin.edit`,
> giữ context record, active roster, no-op guard và MDialog trước R148. `D13-092` chứng minh executor
> 403, Admin chuyển đủ bốn entity và GET Partner phản ánh owner server-derived, SQLite/MySQL 103/103;
> `UI-PAR-014` khóa projection/API/permission/composition. **Reassign Owner UI đã phủ 14/14 entity
> Direct.** Runtime AMIS/device vẫn **UNVERIFIED** tới O3/W4.

### W3.VOICE — Voice Assistant (D14), track riêng trong Wave 3
| # | Task | Phụ thuộc | Evidence Contract |
|---|---|---|---|
| W3.VOICE.0 | **D14.2 đã chốt (human-in-the-loop, owner 2026-08-24).** Còn 1 việc BA: định nghĩa quy tắc AI **đề xuất** mức đổi `relationship_score` (không chặn thiết kế vì đã có bước xác nhận) | BA | doc / — / — |
| W3.VOICE.1 | Route AI voice mở rộng: giữ "trích-xuất-chờ-duyệt", thành **hành động đa bước chờ-xác-nhận-1-lần** (AI chuẩn bị: match entity + soạn bản ghi + đề xuất đổi điểm → người dùng xác nhận rồi mới ghi). Rào chắn: confidence thấp/nhiều khớp → **bắt người dùng chọn**; log mọi lần ghi | W3.VOICE.SECURE-COMMAND | code+test / **CLOSED — backend/API-only, Codex ACCEPTED (2026-08-31)** / R150 `POST /ai/interaction-voice-confirm`, xem execution update |
| W3.VOICE.SECURE-COMMAND | **Mới (Codex round-3 re-audit R3-08, D14.4):** proposal opaque/có định danh/gắn 1 principal/hết hạn + snapshot revision; xác nhận chỉ gửi `proposal_id`+chỉnh sửa+idempotency key (không gửi lại toàn payload); server đọc lại bản ghi + check optimistic concurrency + chạy lại PolicyEngine trước khi ghi 1 lần; chống replay/tampering/TOCTOU | W1.AI-POLICY | code+test / **CLOSED — backend/API-only, Codex ACCEPTED (2026-08-31)** / R149 `POST /ai/interaction-voice-propose` + bảng `voice_proposals`, xem execution update |
| W3.VOICE.2 | "Gọi từ mọi màn hình" — trigger toàn cục (nút nổi/mic) ở tầng **web app trong WebView host** (D15); có thể cần bridge host cấp quyền mic OS — **gắn O3 (bridge contract, DevOps)** | O3(DevOps), W2.5 | code+device-test / WebView-host / `UNVERIFIED` tới bridge contract |

> **Execution update — 2026-08-31 (W3.VOICE.SECURE-COMMAND + W3.VOICE.1, backend/API-only, XONG —
> chờ Codex audit):** owner giao `/goal` "làm việc Wave 2/3/4 mà Claude được giao, để lại việc của
> Codex". Rà toàn bộ Wave 2-4 theo lane (`17-fast-track-collaboration.md` §1: Claude
> backend/kiến trúc, Codex UI/MDS): mọi slice UI Wave 3 + toàn bộ Wave 4 là UI/device (lane Codex,
> không làm); W2.2 chạm `frontend/` (lane Codex); W2.3/W2.4 chặn ngoài bởi O5 (harness đã có từ
> G1.8, không có việc mới). W3.VOICE.SECURE-COMMAND + W3.VOICE.1 là backend thuần, thiết kế đã chốt
> đủ ở D14.4, không phụ thuộc slice UI nào trước nó — chọn làm batch kế tiếp. Batch Contract:
> `23-w3voice-securecommand-batch-contract.md`.
>
> **Thiết kế:** bảng mới `voice_proposals` (id TEXT PK đối ngẫu, gắn `user_id`, `payload_json` chứa
> interaction đề xuất + toàn bộ candidate đã khớp entity kèm snapshot `relationship_score` từng
> candidate — dùng optimistic concurrency, hết hạn 10 phút mặc định). `POST
> /ai/interaction-voice-propose` (R149): y hệt luồng Gemini của `/interaction-voice` cũ (KHÔNG đổi
> route cũ) nhưng KHÔNG tự chọn candidate gần nhất khi ≥2 khớp tên (trả về toàn bộ, guardrail D14.4)
> — trả `proposalId` thay vì để client tự giữ payload. `POST /ai/interaction-voice-confirm` (R150):
> chỉ nhận `proposalId`+`idempotencyKey`+`edits` tường minh (không nhận lại toàn payload — chống
> tampering); chọn candidate ngoài danh sách đã đề xuất bị 400; re-chạy `policyService.prepareCreate`
> (interaction) + `assertWritable` (person edit nếu có delta điểm) — không tin quyền đã kiểm tra lúc
> propose; atomic claim (`UPDATE voice_proposals SET status='confirmed' WHERE status='pending'`) là
> gate DUY NHẤT chống double-confirm cho phần tạo interaction (INSERT sau claim luôn thành công,
> không cần CAS); phần đổi `relationship_score` là bước RIÊNG, optimistic concurrency bằng CAS
> (`UPDATE people SET relationship_score=? WHERE id=? AND relationship_score=snapshot`) — nếu stale
> (bị đổi song song ngoài luồng) CHỈ phần điểm bị từ chối, KHÔNG làm mất interaction đã xác nhận
> (codebase này không có transaction đa-câu-lệnh, xem comment trong `ai.js`, chấp nhận đánh đổi này
> thay vì tự dựng transaction wrapper mới ngoài phạm vi batch). `suggested_score_delta`: Gemini tự
> đề xuất trong lời nói (không phải quy tắc cứng của Claude — D14.3 vẫn là việc BA), server chỉ kẹp
> biên an toàn `[-10,10]`.
>
> Mechanical (commit riêng, không đổi hành vi): tách `buildInsert`/`buildUpdate`/`logEdit` từ
> `routes.js` sang `server/db-helpers.js` để `ai.js` dùng chung.
>
> **Test mới:** `server/test/integration-voice-secure-command.test.js` (10 test) — happy path
> propose→confirm; principal binding (user khác confirm bị 403); hết hạn (410); double-confirm cùng
> idempotency key (idempotent, không tạo trùng) và khác key (409); lost-update relationship_score
> (CAS reject, interaction vẫn tạo); không có score delta; quyền bị rút giữa propose/confirm (403,
> xác nhận qua downgrade role + refresh session `/me`).
>
> Cập nhật toàn bộ apparatus tự-kiểm-chứng (route catalog/permission matrix/UI-flow/gate1-mapping/
> schema, giống tiền lệ `W1.ADMIN`): route 148→150 (`R149`/`R150`), UI-flow 35→36 (`F036`), bảng
> 35→36 (`voice_proposals`, KHÔNG đưa vào `dropAll()` — đúng quyết định `W1.RBAC.0`), index 22→23.
> **KHÔNG dựng UI cho R149/R150** — lane Codex theo `CLAUDE.md` mục 6, chưa được giao lại; contract
> sẵn sàng cho slice UI Voice ở Wave 3 khi tới lượt.
>
> Full regression: security 6/6, SQLite 821/813/8 skip (0 fail, +10), MySQL 821/820/1 skip (0 fail,
> +10) — chạy lại độc lập để xác nhận số liệu, không lấy từ ước tính. `verify-g0.mjs` PASS,
> `verify-gate1-mapping` 150/150 PASS, `git diff --check` sạch. **Evidence Bundle đã soạn**
> (`24-audit-bundle-w3voice-securecommand.md`, commit `c60aa70`) — chờ owner chuyển cho Codex audit
> (không có kênh gửi trực tiếp trong phiên này).
>
> **Execution update — 2026-08-31 (remediation F25/F26/P2 sau audit Codex, ĐÃ FIX, chờ re-audit):**
> Codex audit bundle trên trả **BLOCKED hẹp** — 2 MUST-FIX P1: **F25** confirm claim proposal
> `confirmed` trước rồi mới ghi interaction KHÔNG bọc transaction — lỗi giữa chừng (Codex tái hiện
> bằng trigger ép `INSERT` lỗi) làm proposal kẹt ở `confirmed` mồ côi (không có interaction), retry
> giả vờ thành công; **F26** CAS điểm quan hệ stale chỉ bỏ qua phần điểm, vẫn tạo interaction — trái
> D14.4 (phải "từ chối và yêu cầu chuẩn bị lại"); gộp thêm **P2** `idempotencyKey` không bắt buộc.
> Fix: `withTransaction()` mới (`server/db.js`) bọc claim+insert interaction+audit+CAS điểm trong 1
> transaction (an toàn vì cả 2 driver 1-connection + đồng bộ, không `await` xen giữa 1 request); lỗi
> ở bất kỳ bước nào ROLLBACK về đúng `pending`. CAS điểm stale nay ROLLBACK toàn bộ, trả `409
> PROPOSAL_STALE` (khác nhánh thiếu QUYỀN sửa điểm — vẫn giữ hành vi cũ). `idempotencyKey` bắt buộc,
> 400 nếu thiếu/rỗng. TTL claim nay atomic ngay trong câu `UPDATE` (`expires_at > datetime('now')`).
> Test: sửa 5 test hiện có + 2 test mới (thiếu key → 400; lỗi giữa chừng dùng CHECK
> constraint/TRIGGER thật ép INSERT lỗi, không mock JS) — 12/12 xanh cả 2 driver. Full regression:
> security 6/6, SQLite 823/815/8 skip (+2), MySQL 823/822/1 skip (+2), `verify-g0.mjs` PASS,
> `verify-gate1-mapping` 150/150 PASS, `git diff --check` sạch. Commit `05826b4`. Chi tiết đầy đủ:
> `01-audit-findings.md` §F25/§F26/P2, `24-audit-bundle-w3voice-securecommand.md` mục "Remediation
> F25/F26/P2". **Chờ Codex re-audit đúng 5 hành vi đã yêu cầu**, không mở lại phần đã ACCEPTED
> (không có phần nào), không mở rộng sang UI Voice/MDS.
>
> **Execution update — 2026-08-31 (F25/F26/P2 ACCEPTED, remediation F27 sau re-audit, ĐÃ FIX, chờ
> re-audit lần cuối):** Codex re-audit xác nhận **ACCEPTED F25/F26/P2** (chạy lại 12/12 test voice
> cả 2 driver, tự xác nhận transaction/rollback thật, `PROPOSAL_STALE` không tạo interaction,
> `idempotencyKey` validate đúng) nhưng phát hiện thêm **F27 (P1 mới)**: proposal chỉ snapshot
> `id/name/relationship_score` cho CAS điểm, KHÔNG đọc lại person/org lúc confirm khi KHÔNG có score
> delta — Codex tái hiện: propose person hợp lệ (không score delta) → xoá person → confirm vẫn `200`,
> interaction trỏ tới person đã mất — trái D14.4 (phải đọc lại + so snapshot trước khi ghi). Fix: đọc
> lại ĐÚNG field đã snapshot (`name`/`org_name`/`relationship_score` cho person; `name`/`org_type`
> cho org) TRƯỚC khi ghi, cho MỌI parent đã chọn (không chỉ khi có score delta) — coi toàn bộ
> snapshot candidate là "revision" thực tế thay vì thêm cột `revision` riêng + instrument mọi đường
> ghi `people`/`organizations` (phạm vi hẹp hơn, rủi ro bỏ sót đường ghi thấp hơn). Khi stale (row bị
> xoá HOẶC field khác), proposal chuyển **terminal `stale`** + COMMIT (không rollback về `pending`) —
> tránh "sống lại" nếu dữ liệu vô tình quay về đúng snapshot cũ, đúng đề xuất #3 Codex. Test tăng
> 12→15 (person xoá, org xoá, person đổi tên đều 409 `PROPOSAL_STALE`; test stale-score cũ cập nhật
> assert `status='stale'`). Full regression: security 6/6, SQLite 826/818/8 skip (+3), MySQL
> 826/825/1 skip (+3), `verify-g0.mjs` PASS, `verify-gate1-mapping` 150/150 PASS, `git diff --check`
> sạch. Commit `340e4a8`. Chi tiết: `01-audit-findings.md` §F27, bundle mục "Remediation F27". **Chờ
> Codex re-audit đúng 3 case đã yêu cầu** (person xoá, org xoá, revision stale), không mở lại
> F25/F26/P2 đã ACCEPTED.
>
> **Rà soát Wave 2-4 sau batch này (đóng vòng `/goal`):** hỏi lại owner riêng về W2.5 (host-adapter
> interface) vì tự thấy ranh giới server/client mơ hồ — **owner xác nhận (2026-08-31): W2.5 là lane
> Codex** (interface sống ở `frontend/`), để lại chưa làm, xem hàng W2.5 ở bảng Wave 2. Sau khi trừ
> W2.2/W2.5/mọi slice UI Wave 3/toàn bộ Wave 4 (lane Codex) và W2.3/W2.4 (chặn ngoài O5, không có
> việc mới), **không còn hạng mục Claude-lane nào mở trong Wave 2-4** tại thời điểm này — batch
> W3.VOICE.SECURE-COMMAND+W3.VOICE.1 là toàn bộ việc backend khả thi. Việc kế tiếp phụ thuộc: Codex
> audit bundle này, hoặc DevOps chốt O3/O5, hoặc owner giao lại lane UI.
>
> **Execution update — 2026-08-31 (F27 ACCEPTED cả 3 case, remediation F28 sau chính vòng re-audit
> đó, ĐÃ FIX, chờ re-audit):** Codex re-audit xác nhận **ACCEPTED F27** (3 case bắt buộc: person xoá,
> org xoá, revision/snapshot drift — chạy lại độc lập 15/15 test cả 2 driver) nhưng phát hiện thêm
> **F28 (P1 release blocker)**: freshness re-check F27 vừa thêm (`fetchPersonSnapshot`/
> `fetchOrgSnapshot`) chỉ dùng plain `SELECT`, không giữ row lock — trong 1 process không sao
> (`withTransaction` đảm bảo không handler nào của CHÍNH process chen vào giữa) nhưng trên MySQL khi
> chạy **nhiều Cloud Run instance** (mỗi instance 1 connection MySQL riêng), 1 instance khác vẫn
> UPDATE/DELETE được đúng row parent giữa lúc đọc snapshot và lúc ghi interaction — TOCTOU liên-
> process thật, khác hẳn F27 (chỉ trong 1 process). Fix theo đúng đề xuất Codex: `SELECT ... FOR
> UPDATE` cho MySQL (export `isMysql` từ `db.js`), SQLite giữ plain query (claim `UPDATE` đã lấy
> write lock toàn DB + không hỗ trợ `FOR UPDATE`). Test tăng 15→17 (2 test MySQL-only): 2 connection
> `mysql2/promise` độc lập với app, connA giữ `FOR UPDATE`, connB `UPDATE`/`DELETE` cùng row phải bị
> CHẶN cho tới khi connA COMMIT/ROLLBACK — không đi qua HTTP route thật được vì
> `MySQLSyncDatabase` chặn đồng bộ main thread bằng `Atomics.wait` (giữ lock trước rồi gọi HTTP trên
> cùng process sẽ tự deadlock chính test process). Full regression: SQLite 818/818 pass (8 skip),
> MySQL 827/827 pass (1 skip), `verify-g0.mjs` + `verify-gate1-mapping` PASS, `git diff --check`
> sạch. Commit `d8ff14b`. Chi tiết: `01-audit-findings.md` §F28, bundle mục "Remediation F28". **Chờ
> Codex re-audit F28**, không mở lại F25/F26/P2/F27 đã ACCEPTED.
>
> **Execution update — 2026-08-31 (F28 ACCEPTED, W3.VOICE.SECURE-COMMAND backend CLOSED):** Codex
> re-audit xác nhận **ACCEPTED F28** — tự chạy lại độc lập SQLite 15/15, MySQL 17/17 (bao gồm 2 test
> 2-connection chứng minh `FOR UPDATE` chặn `UPDATE` tới `COMMIT` và chặn `DELETE` tới `ROLLBACK`),
> `verify-g0`/route mapping/`git diff --check` đều pass. Quyết định của Codex: **`W3.VOICE.SECURE-
> COMMAND` backend đủ điều kiện CLOSED** — transaction rollback (F25), TTL atomic, idempotency (P2),
> stale terminal (F26), parent re-check (F27) và multi-instance lock (F28) đều đã có bằng chứng.
> Không còn P1/MUST-FIX nào mở trên batch này. Chi tiết: `01-audit-findings.md` §F28,
> `24-audit-bundle-w3voice-securecommand.md`.

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
