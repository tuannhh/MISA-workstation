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
| **D15 — AMIS Mobile = cầu nối WebView** (owner làm rõ 2026-08-24) | **Làm NHẸ toàn bộ khối "native".** AMIS Mobile không phải nơi build app native riêng — là host launcher + WebView, mỗi app = 1 icon, bấm vào mở **web app trong khung native**. Nên "native composition" = **web UI chạy trong WebView host** (mobile-first responsive + bridge session/mic/camera/deep-link), KHÔNG phải codebase native song song. F5 + Wave native giảm rủi ro/khối lượng đáng kể. Auth (O3) = host bơm token vào web app qua bridge. |

### §0.1 — Điểm cần owner/Codex quyết về CÁCH test (fork chiến lược, Claude khuyến nghị — chưa tự chốt)
Giả định cũ của Gate 1 là "characterization test 100% hành vi hiện tại TRƯỚC khi refactor" — hợp lý khi giữ nguyên hệ thống. Nhưng giờ **RBAC bị viết lại (D13) + dữ liệu bỏ được**, nên với phần bị viết lại (phân quyền, money policy, ownership) việc "test lại hành vi CŨ (đang sai — F1)" ít giá trị. **Khuyến nghị:** đổi sang **spec-first cho phần viết lại** (viết test cho hành vi ĐÍCH của RBAC v2), **chỉ characterization cho phần GIỮ nguyên** (CRUD nghiệp vụ, monitor, report, AI extract). Tiết kiệm đáng kể công Gate 1. **Cần owner/Codex xác nhận** trước khi khóa Gate 1 — ghi ở exit-gate G1.

---

## Sơ đồ phụ thuộc (task-level)

```
G0 (quyết định + inventory + threat/data-flow + matrix) ── phần lớn XONG, xem trạng thái Gate 0 dưới
  │
  ├─ G1A: characterization suite (phần GIỮ nguyên) — GREEN, CI job `regression`
  ├─ G1B: security/policy target suite — KNOWN-RED, CI job `security-gap`, allowlist {F-id|target, owner, expiry}
  └─ (fork §0.1) spec-first target tests cho RBAC v2 = 1 phần G1B (target = hành vi D13 chưa có)

Sau G1A xanh:
  ├─ W1 = RBAC v2 nền tảng (D13) — khối lớn nhất, gộp F1/F9/F11 + money/file policy:
  │    W1.RBAC (schema 4 vai trò + field_visibility + created_by/owner_id 14 bảng)
  │    W1.POLICY (PolicyEngine D1 đọc field_visibility động + role + ownership)
  │    W1.ADMIN (màn hình Admin: cấu hình field, gán owner, quản vai trò)
  │    → vì dữ liệu bỏ được: seed lại sạch, KHÔNG dual-write/backfill
  ├─ W1 security song song (độc lập RBAC):
  │    W1.8 SSRF (F3) ── làm ngay, không chờ quyết định nào
  │    W1.7 session seam (F2) ── backend store để DevOps chốt (O4)
  │    W1.9 AI reliability (F8) ── không chờ O8
  │    W1.AI-POLICY (F4 data-egress) ── CẦN O8
  ├─ G1.8 Perf baseline (F7) ── song song, cần DB_CLIENT=mysql, KHÔNG block
  └─ W2.5 host-adapter interface + 2 fake provider ── làm sớm, không chờ O3 (chỉ contract-ready)

Wave 2 (contract + perf) ── W2.3 acceptance SLO cần O5(DevOps chốt ngưỡng); W2.6 Gemini eval cần O6(đã duyệt $200)
Wave 3 (strangler UI trên RBAC v2 mới) ── mỗi slice tự chờ test+policy+contract của slice; slice voice = D14 (cần O8 + D14.2)
Wave 4 (native runtime + release + voice runtime) ── chặn: security gate + SLO gate + O3 + O8(nếu AI/voice bật)
```

Đường tới hạn (cập nhật 2026-08-24): **O3, O4, O5 → giao DevOps MISA** (không còn chờ owner). **O8 → PROVISIONAL** (owner cho phép gửi Gemini tạm với dữ liệu test) → `W1.AI-POLICY` xây ngay dạng gateway cấu hình được, không chờ. **O6 duyệt $200.** Còn phụ thuộc bên ngoài duy nhất: **bridge contract AMIS Mobile** (DevOps + team AMIS làm rõ) chặn W2.5/W4.1 phần adapter thật + W3.VOICE.2 — KHÔNG chặn G1/W1.RBAC/W1.8/W1.9/phần contract-ready W2.5.

## Quy ước CI (không đổi từ v2)
- Job **`regression`**: mọi test GREEN mới merge, không exception.
- Job **`security-gap`**: exploit/contract test mô tả hành vi ĐÍCH; mỗi failure kỳ vọng nằm trong allowlist `{F-id hoặc target, owner, expiry}`. **Unexpected failure = build đỏ.**
- Đóng 1 finding/target: xóa allowlist, test chuyển sang `regression`.
- **Manual evidence chỉ cho native host/thiết bị** — không thay API/business-rule regression backend.

---

## GATE 0 — Quyết định & baseline (chỉ đọc + tạo tài liệu, KHÔNG sửa production code)

**Trạng thái 2026-08-24: TẤT CẢ owner-decisions đã có; phần Claude làm được ĐÃ XONG; chỉ còn chờ Codex re-audit round 3.**

| # | Task | Trạng thái |
|---|---|---|
| G0.1 | Owner quyết O1-O8 | **XONG (2026-08-24):** O6 APPROVED ($200); O2/O7 SUPERSEDED bởi D13; **O3/O4/O5 DEFERRED-TO-DEVOPS** (owner giao DevOps, không còn là owner-submission chờ); **O8 PROVISIONAL** (owner cho phép gửi Gemini tạm — dữ liệu test); O1 mặc định `private`; D13/D14/D15 đã ghi. **Không còn owner-submission nào treo** — O3 giờ là việc DevOps, O8 đã có quyết định tạm. Bridge contract AMIS Mobile là việc DevOps làm khi tới W2.5/W4.1, KHÔNG chặn đóng G0. |
| G0.2 | Memory-bank đủ chủ đề mandate + commit git | **XONG** (file 01-16, commit — xem `15-changelog.md`) |
| G0.3 | Inventory 100% route/job/AI/UI | **XONG — Codex round 2 xác nhận PASS** (145/145 literal, `07-route-catalog.md`) |
| G0.4 | Ma trận route × surface × role × state × runtime | **XONG cho hệ HIỆN TẠI (2 vai trò)** — `08-permission-matrix.md`. **Lưu ý: đây là baseline hiện trạng; ma trận ĐÍCH theo 4 vai trò D13 sẽ được dựng khi W1.RBAC land** (không dựng lại lúc này vì matrix hiện tại đúng vai trò documenting current-state cho characterization). |
| G0.5 | Error contract | **XONG** (`05-error-contract.md`, `error===message` đã sửa round 3) |
| G0.6 | Registry classification | **CHUYỂN NGHĨA sau D13:** không còn là "registry cố định chờ duyệt O1" — giờ là **danh sách giá trị khởi tạo mặc định `private`** để seed vào bảng `field_visibility` (W1.RBAC). Không còn block bởi O1 riêng. |
| G0.7 | F10 secret | **XONG — PASS** (placeholder, không phải key sống) |
| G0.8 | Threat model + egress map | **XONG** (`06-threat-model.md` v4: 12 luồng egress/13 lời gọi, SMTP boundary) |

**Exit gate G0 (cập nhật):** mọi task G0 + mọi owner-decision đã xong (O3/O4/O5→DevOps, O8 provisional, còn lại quyết/superseded). **Điều kiện đóng G0 duy nhất còn lại: Codex re-audit round 3** xác nhận G0.4/G0.5/G0.8 đã sửa đúng + G0.2 đủ coverage. Không còn owner-action nào treo.

---

## GATE 1 — Test net (fork §0.1: spec-first cho phần viết lại, characterization cho phần giữ)
**Hiện trạng:** chỉ 6 test hẹp (`server/security.test.js`). **Ước lượng:** 1,5-3 tuần (giảm so với v2 vì không characterization phần sẽ viết lại).

### G1A — Regression/characterization suite (GREEN) — CHỈ phần GIỮ nguyên
| # | Task | Evidence Contract |
|---|---|---|
| G1A.1 | Harness: MySQL ephemeral + fixtures/factories + deterministic clock | test / all / — |
| G1A.2 | Unit phần giữ: validation, formatter, SSRF, AI redaction/schema, projection tính toán | test / all / — |
| G1A.3 | Integration API cho **module GIỮ nguyên nghiệp vụ** (monitor, report, AI extract, CRUD cơ bản): happy + invalid + unauthenticated + not-found | test / — / — |
| G1A.5 | DB contract chạy CẢ SQLite + MySQL; acceptance chỉ MySQL | test / all / — |
| G1A.6 | UI characterization smoke phần giữ | test / — / — |
| G1A.7 | AI golden set: extraction/summary/report + malformed/timeout/quota | test / — / — |
| G1A.9 | CI `regression` xanh; `npm audit` 3 lỗ (nanoid/postcss/body-parser) vá kèm test, không `audit fix` mù | deploy / all / job `regression` xanh |

### G1B — Security + RBAC-v2 target suite (KNOWN-RED, allowlist) — phần VIẾT LẠI dùng spec-first
| # | Task | Evidence Contract |
|---|---|---|
| G1B.1 | **Target test RBAC v2 (D13):** 4 vai trò × visibility field (public/private cấu hình) × ownership (created_by bất biến / owner_id sửa được / Admin gán lại) — mô tả hành vi ĐÍCH chưa có | test / — / RED allowlist `D13` |
| G1B.2 | Money/file policy = 1 phần của G1B.1 (không còn suite riêng): field tiền chỉ là field `private`, ownership + role quyết read/write; direct-ID file access theo per-file visibility (D13.3) | test / — / RED allowlist `D13` |
| G1B.3 | Session target (F2): fixation/logout/rate-limit | test / — / RED allowlist `F2` |
| G1B.4 | SSRF matrix (F3): localhost/RFC1918/link-local/metadata/redirect | test / — / RED allowlist `F3` |
| G1B.5 | Mỗi RED ghi `{F-id hoặc D13-target, owner, expiry}`; unexpected failure ngoài allowlist = build đỏ | test / all / CI `security-gap` |

### Perf baseline (song song, KHÔNG block)
| # | Task | Evidence Contract |
|---|---|---|
| G1.8 | Baseline F7: harness **assert `DB_CLIENT===mysql`**; profile 1/5/10/20/50, warm-up + sustained, mix read/write/report/file; artifact ghi engine/SHA/topology/CPU-RAM/pool/cardinality; thu p50/p95/p99, throughput, error, event-loop lag p99. **Không block refactor** | test / — / artifact bắt buộc, không kết luận "pass" ở bước này |

**Exit gate G1:** (a) owner/Codex xác nhận fork §0.1 (spec-first vs characterization); (b) G1A phủ 100% phần GIỮ nguyên; (c) G1B mọi RED có allowlist hợp lệ, không unexpected failure; (d) G1.8 có artifact. Không mechanical refactor khi G1A phần-giữ còn ô trống.

---

## WAVE 1 — RBAC v2 nền tảng (D13) + security root-cause
**Ước lượng:** 3-5 tuần (khối lớn nhất). Nền tảng cho mọi wave sau.

### W1 — nhánh RBAC v2 (D13, gộp F1/F9/F11 + money/file policy)
| # | Task | Phụ thuộc | Evidence Contract |
|---|---|---|---|
| W1.RBAC.1 | Schema: bảng `field_visibility(module, field, is_public)`; thêm `created_by`(bất biến)+`owner_id`(gán lại được) cho 14 bảng "hoạt động" (10 bảng chưa có — xem D13.4); cột visibility per-file trên `attachments` (D13.3). **Dữ liệu bỏ được → migration additive rồi SEED LẠI SẠCH, không dual-write/backfill** | — | migration+test / — / — |
| W1.RBAC.2 | 4 vai trò (Viewer/Nhân viên thực thi/Admin/Super Admin) thay 2 role hiện tại; seed `field_visibility` mặc định `private` cho mọi field trong 6 nhóm mật cũ + 2 field % + tài liệu (D13.2, `03-data-classification.md`) | W1.RBAC.1 | code+test / — / fail-closed |
| W1.POLICY | `DATA_POLICY_REGISTRY` nguồn = bảng `field_visibility` động (KHÔNG hard-code) + `PolicyEngine` (authorizeRead/Write/Attachment) đọc role 4 cấp + ownership + visibility. Choke point tầng service, fail-closed 403, KHÔNG silent-strip (D1) | W1.RBAC.2 | code+test / — / fail-closed 403 |
| W1.POLICY.2 | Service command = choke point mọi sensitive write; wrapper `authorizedInsert/Update` bắt buộc `principal+resource+operation`; CI static rule cấm raw SQL ghi field ngoài policy (dọn 10 nhóm write-bypass F1 + 3 cách mask song song — `16-coding-rules.md` §8) | W1.POLICY | code+test / — / fail-closed |
| W1.OWN | Logic ownership: quyền sửa = `user.id===owner_id` HOẶC Admin/Super Admin bypass; Nhân viên thực thi tự xem đầy đủ bản ghi mình `owner`; Admin gán/gán lại `owner_id` (giải quyết cả dữ liệu cũ owner=NULL + nhân viên nghỉ việc). **Mặc định: chỉ Admin gán owner** (D13.4, owner chưa xác nhận self-claim) | W1.POLICY | code+test / — / fail-closed |
| W1.ADMIN | Màn hình Admin (Desktop MDS): (a) cấu hình field public/private theo module; (b) gán/gán lại owner cho bản ghi; (c) quản vai trò 4 cấp. Super Admin thêm: cấu hình API key, xem `audit_log` | W1.OWN | code+test / — / — |
| W1.FILE | Attachment: visibility per-file lúc upload (D13.3), classification server-derived cho gate `/files/:id` theo owner+action+visibility (D3, F9). File cũ default `private`. **Không cần R1 dual-write/reconcile — dữ liệu bỏ được, seed sạch** | W1.POLICY | code+test / — / fail-closed |

> **R1.0–R1.7 cũ (dual-write/backfill/reconcile/shadow/canary/rollback) BỎ** — chỉ cần khi có dữ liệu sống. Nếu về sau production thật đã có dữ liệu trước khi RBAC v2 land, mới cần khôi phục quy trình R1 (ghi lại ở đây để không mất kiến thức: bản v2 §R1 trong git history commit trước `04-ROADMAP.md` v3).

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
| W3.VOICE.1 | Route AI voice mở rộng: giữ "trích-xuất-chờ-duyệt", thành **hành động đa bước chờ-xác-nhận-1-lần** (AI chuẩn bị: match entity + soạn bản ghi + đề xuất đổi điểm → người dùng xác nhận rồi mới ghi). Rào chắn: confidence thấp/nhiều khớp → **bắt người dùng chọn**; log mọi lần ghi | W1.AI-POLICY | code+test / — / fail-closed: không ghi khi chưa xác nhận |
| W3.VOICE.2 | "Gọi từ mọi màn hình" — trigger toàn cục (nút nổi/mic) ở tầng **web app trong WebView host** (D15); có thể cần bridge host cấp quyền mic OS — **gắn O3 (bridge contract, DevOps)** | O3(DevOps), W2.5 | code+device-test / WebView-host / `UNVERIFIED` tới bridge contract |

---

## WAVE 4 — WebView-host runtime & release gate (+ voice runtime)
**Ước lượng:** 3-6 tuần (giảm nhờ D15 — web-in-WebView, không build native riêng). **CHẶN bởi: security gate (G1B rỗng) + SLO gate (W2.3 PASS) + bridge contract AMIS Mobile (DevOps+AMIS).**

| # | Task | Evidence Contract |
|---|---|---|
| W4.1 | **Runtime-ready:** tích hợp bridge AMIS Mobile thật (D15 — host bơm token vào web app) qua contract test + device test **trong WebView host**: session/principal, Back, safe-area, lifecycle, file/camera/mic qua bridge, notification/deep-link. **Không phải native codebase riêng — là web app trong WebView** | code+device-test / WebView-host / `UNVERIFIED` tới khi có bridge contract (DevOps+AMIS) |
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
| F5 mobile native | G0.4 (matrix) → W2.5 (contract-ready) → slice Wave 3 → W4.1-4.3 (runtime) | **D15: web-in-WebView, không build native riêng — nhẹ hơn nhiều** |
| F6 app.js monolith | W2.1-2.2 → slice Wave 3 | |
| F7 Atomics | G1.8 (baseline) → W2.3 (acceptance, ngưỡng DevOps) → W2.4 nếu fail | |
| F8 Gemini | G1A.7 → W1.9 → W2.6 (eval, $200) | |
| F9 attachment | **Nuốt vào W1.FILE** (per-file visibility D13.3) — R1 dual-write BỎ (dữ liệu bỏ được) | |
| F10 secret | G0.7 — đã đóng | |
| F11 role drift | **Nuốt vào W1.RBAC** (thay cả hệ vai trò, không "dọn banner") | |
| D13 RBAC v2 | **W1.RBAC/W1.POLICY/W1.OWN/W1.ADMIN/W1.FILE** (khối lớn nhất) | mới |
| D14 Voice | W3.VOICE.0-2 + W4.VOICE | mới; D14.2 chốt human-in-the-loop; cần bridge AMIS (DevOps) |
| D15 WebView host | ảnh hưởng W2.5/W3-native/W4.1-4.3 | mới; native = web-in-WebView, không codebase native riêng |

## Điều kiện release đầy đủ MDS/native (không đổi tinh thần)
Không tuyên bố "100% MDS/native" khi: matrix 4-vai-trò còn `UNVERIFIED` cho route release, HOẶC bridge AMIS Mobile thật chưa qua contract+device test trong WebView host (W4.1), HOẶC W2.3 chưa PASS. Release bật AI/voice: O8 hiện provisional đủ cho dữ liệu test; dữ liệu thật cần Security/Legal duyệt lại. Build `AI_DISABLED` release web-in-host pilot riêng — gọi đúng tên "web-in-host, AI tắt".
