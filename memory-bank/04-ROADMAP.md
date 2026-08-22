# 04 — Plan & Roadmap chi tiết (v2 — sau Codex roadmap-review, amendments áp dụng)

> Nguồn: đồng thuận Claude ↔ Codex (5 vòng debate) + `PR-WORKSTATION-CODEX-ROADMAP-REVIEW.md` (2026-08-22, conditional-consensus 8,2/10 → 6 amendment → khóa được ở 9,0/10).
> **Lập trường Codex sau amendment: APPROVE FOR IMPLEMENTATION.** Phối hợp: Claude triển khai từng gate/slice; Codex audit độc lập evidence contract/diff/test-result/exit-condition trước khi owner cho qua gate tiếp theo.
> Mỗi task ghi Evidence Contract: Owner / Evidence-type / Activation-target / Fail-closed. Ước lượng công là chỉ dấu tương đối, không phải cam kết.
> Nguyên tắc xuyên suốt: **test-first**, **fail-closed**, **strangler theo slice**, **không gộp refactor + đổi nghiệp vụ trong 1 commit**, **không tuyên bố hoàn thành khi thiếu owner-decision / native-contract / runtime-evidence**.

## Đã áp dụng 6 amendment của Codex (F10 tự kiểm chứng thêm: DEPLOY.md không chứa key sống — `AQ.Ab8RN6…` là placeholder bị cắt, đóng G0.7 không cần rotate)

1. Tách rõ **G1A GREEN** (regression, luôn phải xanh) và **G1B KNOWN-RED** (security exploit suite, allowlist theo F-id) — không còn gọi cùng 1 suite vừa "net xanh" vừa "RED có chủ đích".
2. R1 mở rộng thành **R1.0–R1.7**: backup/restore proof → dual-write → backfill → reconcile DB↔blob → shadow decision → contract+canary flip → rollback. Tách money-migration (registry/projection, không phải row-classification) khỏi attachment-migration (row-classification).
3. **W2 exit hardened**: chỉ PASS khi SLO đạt, hoặc mitigation đã **đo lại và PASS** — "có async-plan" không còn là điều kiện exit.
4. **Semantic remap** Finding→Wave; thêm 2 task mới có ID: `W1.AI-POLICY` (chặn bởi O8) và `W2.6` Gemini eval/model migration (chặn bởi O6).
5. Đường tắt đổi tên **Emergency containment exception — DEFAULT OFF**, không thuộc roadmap đã duyệt, chỉ owner+Security mới kích hoạt được khi có incident/active exposure.
6. Ma trận native (G0.4) mở rộng sang **permission/lifecycle/deep-link/gesture/accessibility OS**; W2.5 chỉ là *contract-ready*; W4.1 mới là *runtime-ready*; O8 là blocker của **release có AI/voice bật**, build tắt AI (`AI_DISABLED`) có thể tiếp tục native shell pilot nhưng không được gọi AI feature complete.

---

## Sơ đồ phụ thuộc (task-level, không còn block toàn-wave)

```
G0 (quyết định + inventory + threat/data-flow + route×surface×role×state×runtime matrix)
  │
  ├─ G1A: characterization/regression suite — LUÔN PHẢI GREEN, CI job `regression`
  └─ G1B: security-target exploit suite — KNOWN-RED, CI job `security-gap`, mỗi RED allowlist theo F-id+owner+expiry

Sau G1A xanh:
  ├─ W1 security P0 (task-level dependency, KHÔNG chờ cả cụm O1/O2/O4/O7):
  │    W1.1–W1.6 (money/file policy) ── cần O1, O2
  │    W1.7 (session)                ── cần O4
  │    W1.8 (SSRF)                   ── KHÔNG cần O1/O2/O4/O7, làm ngay
  │    W1.9 reliability (timeout/retry/kill-switch) ── không cần O8
  │    W1.AI-POLICY (data-egress enforcement)        ── CẦN O8
  │    W1.11 (role drift)            ── cần O7
  ├─ G1.8 Perf BASELINE (characterization, không block refactor) ── chạy song song, cần DB_CLIENT=mysql
  └─ W2.5 host-adapter interface + fake provider ── làm sớm, không chờ O3 (chỉ *contract-ready*)

Wave 2 (W2.1–W2.4, W2.6) ── cần W1 đóng xong các finding liên quan; W2.3 ACCEPTANCE benchmark cần O5
Wave 3 (strangler theo slice) ── mỗi slice tự chờ: test + policy/service + shared contract CỦA CHÍNH SLICE xanh
Wave 4 release đầy đủ ── chặn bởi: security gate + SLO gate (W2.3 PASS) + O3 (native provider thật) + O8 nếu AI/voice bật
```

Đường tới hạn thật không đổi: **O3** (contract auth AMIS) và **O8** (data policy Gemini/voice) phải xin **ngay từ G0** (lead-time tổ chức dài) — chặn `W1.AI-POLICY`/W4, KHÔNG chặn G0/G1A/G1B/W1.8/W1.9/W2.5.

## Quy ước CI (mới, theo amendment 1)

- Job **`regression`**: mọi test phải GREEN để merge. Không có exception.
- Job **`security-gap`**: chạy exploit/contract test mô tả hành vi ĐÍCH cho từng finding đang mở. Mỗi failure kỳ vọng phải nằm trong **allowlist** dạng `{F-id, owner, ngày hết hạn}`. **Unexpected failure = build đỏ** (không được thêm ngầm).
- Khi Wave 1 đóng 1 finding: xóa allowlist tương ứng, test đó chuyển hẳn sang `regression` (giờ phải luôn xanh).
- **Manual evidence chỉ dùng cho native host/thiết bị hoặc tương tác trực quan chưa tự động hóa được** — không dùng thay API/business-rule regression test cho backend.

---

## GATE 0 — Quyết định & baseline (chỉ đọc + tạo tài liệu, KHÔNG sửa production code)
**Ước lượng:** 2-4 ngày.

| # | Task | Evidence Contract |
|---|---|---|
| G0.1 | Owner duyệt 8 quyết định (`02-decisions.md` §B); gửi O3 cho team AMIS, O8 cho Security/Legal **ngay** (lead-time dài) | Owner+platform / doc / all / — |
| G0.2 | Hoàn thiện memory-bank; **commit vào git** (đã untracked tới thời điểm review — Codex xác nhận `git status --short` → `?? memory-bank/`); ghi rõ drift 2-role-code vs 5-role-banner (F11) | Claude / **git commit** / all / — |
| G0.3 | Inventory 100%: mọi route (`routes.js`,`ai.js`), job (`scheduler`,`monitor`), import/export, AI flow, UI route (`app.js` VIEWS) | code / doc / all / fail nếu còn ô trống |
| G0.4 | Ma trận mở rộng: `route × surface(desktop/native) × role/permission × UI-state(loading/empty/error/403/masked) × feature-runtime(permission/lifecycle/deep-link/gesture/accessibility-OS)`. Mỗi ô runtime ghi `PASS/FAIL/N-A/UNVERIFIED` | doc / all / — |
| G0.5 | Chốt error contract: `401/403/404/409/422` + envelope `{code,message,details,requestId}` canonical, `error` = deprecated compat alias (= `message`) — xem `05-error-contract.md` cho spec đầy đủ, đã khớp 1:1 với dòng này | doc / browser-prod / — |
| G0.6 | Chốt registry classification (`03-data-classification.md`) sau khi owner duyệt O1 | doc / browser-prod / — |
| G0.7 | **F10 — ĐÃ ĐÓNG:** kiểm lịch sử Git `DEPLOY.md` — giá trị `GEMINI_API_KEY: AQ.Ab8RN6…` là placeholder bị cắt (dấu `…`), không phải key sống. Không cần rotate | Claude / git-log / all / — resolved |
| G0.8 | Threat model + data-flow + Gemini egress map (input cho O8) | doc / all / — |

**Exit gate G0:** không còn policy term mơ hồ; unknown ghi `UNVERIFIED`; inventory không ô trống; memory-bank đã commit git.

---

## GATE 1 — Test net, tách 2 trạng thái (BẮT BUỘC trước refactor lớn)
**Hiện trạng:** chỉ 6 test hẹp (`server/security.test.js:19-66`, chỉ phủ spreadsheet redaction + mail recipient). `package.json` chỉ có script `test:security` (SQLite). **Ước lượng:** 2-4 tuần.

### G1A — Regression suite (GREEN, luôn phải xanh)
| # | Task | Evidence Contract |
|---|---|---|
| G1A.1 | Harness: MySQL ephemeral + fixtures/factories + deterministic clock | test / all / — |
| G1A.2 | Unit: RBAC, registry, projection, validation, formatter, SSRF, AI redaction/schema | test / all / — |
| G1A.3 | Integration API ~142 endpoint: happy + invalid + unauthenticated + not-found + conflict (hành vi ĐANG ĐÚNG, không phải hành vi đích chưa có) | test / browser-prod / — |
| G1A.5 | DB contract chạy CẢ SQLite + MySQL; acceptance production chỉ MySQL | test / all / — |
| G1A.6 | UI characterization: smoke workflow desktop hiện có + role/action visibility (không thay backend regression) | test / browser-prod / — |
| G1A.7 | AI golden set: extraction/summary/report + malformed/timeout/quota/no-real-data | test / browser-prod / — |
| G1A.9 | CI job `regression` xanh; dependency scan/build. `npm audit` còn 3 lỗ (nanoid high/postcss mod/body-parser low) — vá kèm regression test, không `audit fix` mù | deploy / all / job `regression` phải xanh |

### G1B — Security-target exploit suite (KNOWN-RED, allowlist theo F-id)
| # | Task | Evidence Contract |
|---|---|---|
| G1B.1 | Money/file policy target test (F1): create/update symmetry, read+write+file+derived cho từng sensitive group, direct-ID file access | test / browser-prod / RED allowlist `F1` |
| G1B.2 | Session target test (F2): fixation/logout/rate-limit | test / browser-prod / RED allowlist `F2` |
| G1B.3 | SSRF matrix (F3): localhost/RFC1918/link-local/metadata/redirect | test / browser-prod / RED allowlist `F3` |
| G1B.4 | Mỗi RED ghi `{F-id, owner, ngày hết hạn}` trong allowlist file; unexpected failure ngoài allowlist = build đỏ | test / all / CI job `security-gap` |

### Perf baseline (chạy song song, KHÔNG block G1A/G1B)
| # | Task | Evidence Contract |
|---|---|---|
| G1.8 | **Baseline characterization** cho F7: harness phải **assert `DB_CLIENT===mysql`** (fail nếu không, không chỉ trust env var tên); 3 lần lặp/profile 1/5/10/20/50, warm-up + sustained window, mix read/write/report/file-metadata; artifact ghi DB engine, build SHA, region/topology, CPU/RAM, pool size, dataset cardinality. Thu p50/p95/p99, throughput, error, event-loop lag p99, CPU/RSS, DB connections. **Không block refactor** — chỉ ghi nhận finding đã biết (F7) | test / browser+native / artifact bắt buộc, không có kết luận "pass" ở bước này |

**Exit gate G1:** G1A 100% route/business-rule inventory có regression test (KHÔNG chấp nhận manual-evidence thay backend test — chỉ dùng cho native/thiết bị); G1B mọi RED có allowlist F-id hợp lệ, không unexpected failure; G1.8 có artifact baseline. **Không mechanical refactor khi G1A còn ô trống.**

---

## WAVE 1 — Đóng security root-cause
**Ước lượng:** 2-3 tuần. **Phụ thuộc theo task** (không theo cả cụm):

| # | Task | Finding | Phụ thuộc | Evidence Contract |
|---|---|---|---|---|
| W1.1 | Principal seam `resolvePrincipal(req)→req.principal` (Commit A, provider=web session, giữ hành vi) | F6/auth | G1A | code+test / all / — |
| W1.2 | `DATA_POLICY_REGISTRY` + `PolicyEngine` (authorizeRead/Write/Attachment) | F1, F9 | O1, O2 | code+test / browser-prod / fail-closed 403 |
| W1.3 | Service command = choke point mọi sensitive write; wrapper `authorizedInsert/Update` bắt buộc `principal+resource+operation`; CI static rule cấm raw SQL ghi field đã đăng ký ngoài policy | F1 | O1, O2 | code+test / browser-prod / fail-closed |
| W1.4 | Đối xứng CREATE+UPDATE mọi entity tiền; bỏ silent-strip → 403 mã lỗi ổn định | F1 | O1, O2 | test / browser-prod / fail-closed |
| **R1.0–R1.7** | **Attachment classification — xem chi tiết bảng riêng dưới** | F9 | — | xem dưới |
| W1.7 | Web session hardening (F2): durable store, `secure`, regenerate login, fail-fast secret, revoke/logout, audit | F2 | **chỉ O4** | code+test / browser-prod / fail-closed |
| W1.8 | `safeFetch` SSRF guard (F3), dùng chung monitor + award-extract | F3 | **không cần O1/O2/O4/O7 — làm ngay** | code+test / browser-prod / fail-closed |
| W1.9 | aiGateway reliability: timeout/AbortController, retry 429/5xx, capability-map strip sampling-params. **Chưa data-egress enforcement, chưa đổi model** | F8 | **không cần O8** | code+test / browser-prod / — |
| **W1.AI-POLICY** | Data-egress enforcement: deny-by-default, tier/purpose allowlist, redact/minimize, consent voice, retention/delete, egress audit KHÔNG chứa payload, kill-switch `AI_DISABLED`, negative tests | F4 | **CẦN O8** | code+test / browser-prod / fail-closed deny-by-default |
| W1.10 | Money acceptance suite — chuyển G1B.1 sang `regression` khi đóng xong | F1 | W1.2–W1.4 | test / browser-prod / — |
| W1.11 | Dọn F11: xóa banner login sai (`index.js:50-55`), đồng bộ README/seed/role 1:1 | F11 | **chỉ O7** | code / browser-prod / — |

### R1.0–R1.7 — Attachment classification migration (thay hoàn toàn W1.5–W1.6 cũ)
> Tách biệt với money-migration: money là **registry/projection test** (không cần row-label); attachment là **row-classification thật** vì đã có dữ liệu prod sống.

| # | Task | Evidence Contract |
|---|---|---|
| R1.0 | **Backup + restore proof**: snapshot DB + object/file storage; restore thử sang môi trường cô lập; ghi RPO/RTO. Làm **trước** migration, không đợi W4.4 | platform / runtime-test / browser-prod / release blocker nếu chưa có |
| R1.1 | Expand schema: migration idempotent, thêm cột classification **nullable** + allowed-value definition; chưa flip policy | migration / browser-prod / — |
| R1.2 | **Dual-write**: mọi upload path ghi classification server-derived; client-supplied classification bị reject; metric `classification_write_missing_total` phải bằng 0 trước khi sang R1.3 | code+test+metric / browser-prod / gate: metric=0 |
| R1.3 | Backfill idempotent từ `owner_type+owner_id+server-allowlist kind/resource`. Ambiguous/unknown → `restricted/quarantine` (KHÔNG default public) | migration / browser-prod / — |
| R1.4 | **Reconcile**: `0 NULL`, `0 invalid enum`, `0 unclassified`, owner-reference hợp lệ, **row↔blob tồn tại hai chiều**, checksum/size nếu có, count theo owner/kind/class trước-sau. Quarantine hợp lệ nhưng phải có owner xử lý | test+report / browser-prod / gate: mọi điều kiện = 0/pass |
| R1.5 | **Shadow decision**: PolicyEngine chạy log-only trên read/download/delete, so sánh hành vi dự kiến + test direct-ID; log KHÔNG chứa payload dữ liệu | test / browser-prod / — |
| R1.6 | **Contract + canary flip**: `NOT NULL`/allowed-value constraint sau verify; canary fail-closed theo feature flag; audit 403/404/error; mở dần traffic | migration+deploy / browser-prod / **release blocker: cấm flip trước R1.0–R1.5** |
| R1.7 | **Rollback**: rollback code giữ schema additive + dual-write; tắt flag policy nếu cần, KHÔNG xóa classification đã sinh; cleanup schema chỉ sau khi ổn định | runbook / browser-prod / — |

**Money migration (tách riêng, không dùng khái niệm "backfill" chung với attachment):**
- Registry completeness cho 11 field (`03-data-classification.md` §A) + owner xác nhận 2 field %/4 nhóm document mơ hồ (O1).
- Test read projection/aggregate kế thừa `org_fee` đúng.
- Test unauthorized partial edit: field mật không bị ghi đè, không nhận masked-sentinel như dữ liệu thật.
- Test authorized create/update/import/job hoạt động đúng + audit.

**Exit gate W1:** G1B.1/G1B.2/G1B.3 chuyển hết sang `regression` (không còn RED allowlist active cho F1/F2/F3); R1.6 chỉ chạy sau R1.0–R1.5 pass; session bền qua restart; SSRF chặn metadata/private; `W1.AI-POLICY` xanh nếu O8 đã duyệt (nếu chưa, giữ `AI_DISABLED` mặc định).

---

## WAVE 2 — Shared contract & performance (exit hardened)
**Ước lượng:** 2-3 tuần.

| # | Task | Evidence Contract |
|---|---|---|
| W2.1 | Chuẩn hóa API envelope/schema/error/client dùng chung | code+test / all / — |
| W2.2 | Tách business/domain logic khỏi page layout (không mang layout); cần W2.1 chốt trước để extraction ổn định | code+test / all / — |
| **W2.3** | **ACCEPTANCE gate F7** (sau O5 đóng SLO+peak+ngân sách): PASS khi đạt SLO tại peak đã duyệt, trên topology production-like. Nếu chưa async hóa xong: mitigation concurrency thấp chỉ được chấp nhận khi **đo lại vẫn PASS** + capacity/cost đủ peak + owner + expiry + rollback. **"Có async-plan" nhưng benchmark fail = KHÔNG exit** — có thể tiếp tục dev UI, KHÔNG release/tăng traffic | test / browser+native / **PASS bắt buộc, plan-only không đủ** |
| W2.4 | Nếu W2.3 fail lần đầu: async repository pilot theo slice; chạy lại benchmark sau mỗi slice chuyển async để chống regression; xóa mitigation khi seam đạt SLO | code+test / native / — |
| W2.5 | Host-adapter interface + fake browser provider + fake-native provider, chung contract test. **Exit = contract-ready only** (KHÔNG phải native integration thật); production provider vẫn `UNVERIFIED` tới O3 | code+test / native / fail-closed nếu chỉ 1 adapter đăng ký |
| **W2.6** | **Gemini eval/model migration** (mới, cần O6): corpus theo O6, ≥3 repeat/candidate, threshold quality/schema-validity/latency/cost; canary + rollback; giữ pin `gemini-3.5-flash` khi candidate không thắng rõ | test / browser-prod / cần O6 trước khi chạy |

**Exit gate W2:** shared layer có contract test swap được; **W2.3 PASS thật** (đo lại, không chỉ có kế hoạch); W2.5 ở mức contract-ready (2 fake provider, browser thật); W2.6 có kết luận giữ/đổi model kèm canary.

---

## WAVE 3 — Strangler UI theo vertical slice
**Ước lượng:** 3-6 tuần (cuốn chiếu). Mỗi slice tự chờ: test + policy/service + shared contract **của chính slice** xanh — không chờ toàn Wave 2 xong mới bắt đầu slice đầu.

Thứ tự: 1) **People Detail (pilot)** → 2) Partner Detail → 3) Supplier/Booking/File/Money → 4) People List/Forms/Interactions/Voice (**cần O8** nếu bật voice) → 5) Events/Awards/Smart Intake → 6) Monitoring/Reports/Admin/Reminders.

Mỗi slice: characterization → mechanical extraction (commit riêng) → policy/service integration → Desktop MDS token/component → Native composition (dùng W2.5 contract) → role/device test. **Exit mỗi slice:** không còn SQL/business-rule trong controller của slice; desktop MDS pass token/a11y/visual; native composition pass contract test (chưa cần provider AMIS thật); regression xanh; rollback độc lập.

---

## WAVE 4 — Native runtime & release gate
**Ước lượng:** 4-8 tuần. **CHẶN bởi: security gate (G1B rỗng) + SLO gate (W2.3 PASS) + O3 + O8 (nếu AI/voice bật).**

| # | Task | Evidence Contract |
|---|---|---|
| **W4.1** | **Runtime-ready**: tích hợp provider AMIS thật qua contract test (O3) + device test: session/principal, Back, safe-area, lifecycle, file/camera/mic, notification/deep-link | code+device-test / native / `UNVERIFIED` tới khi AMIS ký contract |
| W4.2 | QA ma trận đầy đủ theo MDS: compact/current/tablet (375/393/412/768/1024), portrait/landscape/split-view, iOS Dynamic Type/Display Zoom, Android Font/Display size, keyboard/Back/gesture | device-test / native / — |
| W4.3 | Permission denied/revoked/unavailable; restore draft; deep-link 403; gesture fallback; accessibility OS states | device-test / native / fail-closed |
| W4.4 | Canary + rollback + observability + audit review; health/liveness/readiness; graceful shutdown; **backup/restore drill đã làm ở R1.0, verify lại ở scale production** | deploy / native+browser / — |

**Exit gate W4 (= release gate):** ma trận scope (G0.4 mở rộng) không còn ô `UNVERIFIED` cho route đã chọn release; runtime evidence trên host/thiết bị thật; security gate rỗng (G1B không còn RED active); W2.3 PASS; scorecard ≥8,5, không trục critical <8,0. **Release có AI/voice bật thêm yêu cầu O8 đã duyệt** — build `AI_DISABLED` có thể release native shell pilot mà không chờ O8, nhưng không được gọi "AI feature complete". **Chỉ khi mọi điều kiện trên đạt mới tuyên bố 100% MDS + native.**

---

## Emergency containment exception — DEFAULT OFF, KHÔNG thuộc roadmap đã duyệt

> Owner đã yêu cầu rõ: viết test phủ toàn bộ nghiệp vụ trước khi sửa đổi. Đường tắt dưới đây **không phải lựa chọn mặc định** — chỉ owner + Security mới kích hoạt khi có incident/active exposure và chấp nhận phá vỡ trình tự G1 đầy đủ.

Điều kiện tối thiểu nếu kích hoạt:
- Exploit/contract test cho đúng lỗ hổng phải viết trước patch (không patch mù).
- Feature flag + canary + rollback + audit/metrics + owner + expiry ngày cụ thể.
- **Không bỏ R1.0–R1.5** nếu đụng attachment fail-closed (backup/dual-write/reconcile vẫn bắt buộc, không rút gọn).
- Không gọi là "đã đóng F1 toàn bộ" nếu chỉ containment 1 nhóm (ví dụ chỉ `org_fee` mà chưa hết mọi sensitive group).
- Quay lại G1A/G1B đầy đủ ngay sau containment, có mốc thời gian chốt.

---

## Bảng ánh xạ Finding → Wave (semantic remap sau amendment)

| Finding | Mapping | Ghi chú |
|---|---|---|
| F1 money bypass | G1B.1 → W1.2–W1.6(R1) → W1.10 → chuyển `regression` | file-gate nằm trong R1, không tách rời |
| F2 session | G1B.2 → W1.7 | chỉ cần O4 |
| F3 SSRF | G1B.3 → W1.8 | không cần quyết định owner nào, làm ngay |
| F4/O8 AI governance | G0.8 + O8 → **W1.AI-POLICY** → Wave 3 slice 4 (voice UI) → W4 device/runtime | UI slice KHÔNG thay backend policy |
| F5 mobile native | G0.4 (ma trận mở rộng) → W2.5 (contract-ready) → từng slice Wave 3 (composition) → W4.1–W4.3 (runtime-ready) | 2 fake provider ≠ native ready |
| F6 app.js monolith | W2.1–W2.2 (contract trước) → từng slice Wave 3 | |
| F7 Atomics | G1.8 (baseline, không block) → **W2.3 (acceptance, PASS bắt buộc)** → W2.4 nếu fail → W4 release gate | plan-only không đủ để exit W2.3 |
| F8 Gemini | G1A.7 (golden set) → W1.9 (reliability) → **W2.6 (eval/model migration, cần O6)** → canary/rollback | task riêng có ID, không rơi vào "Wave sau" mơ hồ |
| F9 attachment | W1.2 (PolicyEngine) + **R1.0–R1.7** | row-classification đầy đủ, không chỉ thêm cột |
| F10 DEPLOY.md secret | G0.7 — **đã đóng** (không phải key sống) | resolved |
| F11 role drift | W1.11, cần O7 | |
| R1 backfill order | R1.0–R1.7 (bảng riêng ở Wave 1) | predecessor của attachment fail-closed |

## Điều kiện release đầy đủ MDS/native
Không tuyên bố "đạt 100% MDS/native" khi: G0.4 còn ô `UNVERIFIED` cho route trong scope release, HOẶC provider AMIS thật (O3) chưa qua contract+device test (W4.1), HOẶC W2.3 chưa PASS, HOẶC (nếu release bật AI/voice) O8 chưa duyệt. Build `AI_DISABLED` được phép release native shell pilot riêng, gọi đúng tên "native shell, AI tắt" — không gọi "AI feature complete".
