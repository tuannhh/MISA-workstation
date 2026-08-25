# Memory Bank — MISA PR Workstation

> Nguồn sự thật dự án, được git theo dõi. Chỉ ghi **fact đã kiểm chứng** (kèm `file:line`); điều chưa chắc ghi `UNVERIFIED`, không suy đoán.
> Khởi tạo: 2026-08-22 (Gate 0) · Commit baseline audit: `088fbb2`

## Mục lục

| File | Nội dung |
|---|---|
| [01-audit-findings.md](01-audit-findings.md) | Phát hiện audit đã hội tụ (Claude ↔ Codex, 5 vòng), severity theo 2 trục |
| [02-decisions.md](02-decisions.md) | Quyết định kỹ thuật D1-D12 + **D13 RBAC v2** (security-complete hoá 2026-08-25: 4 trục classification/visibility/authorization/egress) + **D14 Voice** (+ D14.4 secure proposal/confirmation) + **D15 WebView** + trạng thái O1-O8 (C0.1 owner APPROVED) |
| [03-data-classification.md](03-data-classification.md) | Registry `classification_tier` (trần bất biến, nguồn cho D13.2a) — KHÔNG còn là nguồn `audience_visibility` |
| [04-ROADMAP.md](04-ROADMAP.md) | Kế hoạch Gate 0 → Wave 4 (**v3 + remediation C0.1-C0.8, 2026-08-25**: reset preflight W1.RBAC.0, Gate 1 phủ đủ 145 route, D15/D14 wording sửa theo Codex) |
| [05-error-contract.md](05-error-contract.md) | G0.5 — envelope lỗi target, giữ tương thích `error` field cũ |
| [06-threat-model.md](06-threat-model.md) | G0.8 — threat model, data-flow, Gemini egress map (**v5**, PASS — 2 sửa diễn đạt P2 theo Codex C0.8) |
| [07-route-catalog.md](07-route-catalog.md) | G0.3 — catalog **145/145 route literal 1:1** + 2 job + 13 UI view, `file:line` (thay bản wildcard-compress cũ, đã bị Codex bắt lỗi) |
| [08-permission-matrix.md](08-permission-matrix.md) | G0.4 — Section A (auth partition 145/145) PASS, giữ nguyên. **Section B/C (UI-flow matrix) do Codex trực tiếp rebuild (C0.3, owner giao 2026-08-25)** — chưa xong |
| [09-db-schema.md](09-db-schema.md) | G0.2 — lược đồ đầy đủ 34 bảng (cột/kiểu/PK/FK/index) + quy tắc dịch SQLite→MySQL + migration idempotent |
| [10-api-contract.md](10-api-contract.md) | G0.2 — ý nghĩa field request/response theo nhóm resource (không lặp route catalog) |
| [11-business-flows.md](11-business-flows.md) | G0.2 — luồng nghiệp vụ cốt lõi: đối tác, giải thưởng, sự kiện, nhà cung cấp, nhắc việc, giám sát truyền thông |
| [12-frontend-architecture.md](12-frontend-architecture.md) | G0.2 — kiến trúc Vue shell + legacy `app.js`, pattern list/detail/form, trạng thái MDS thật |
| [13-deployment-runbook.md](13-deployment-runbook.md) | G0.2 — chạy dev local, deploy Cloud Run + Cloud SQL, biến môi trường đầy đủ |
| [14-known-traps.md](14-known-traps.md) | G0.2 — bẫy kỹ thuật đã biết (khác audit findings) |
| [15-changelog.md](15-changelog.md) | G0.2 — lịch sử phát triển theo mốc kiến trúc/tính năng, kèm lý do |
| [16-coding-rules.md](16-coding-rules.md) | G0.2 — §A quy tắc/pattern legacy (mô tả, không phải chuẩn) + **§B quy tắc BẮT BUỘC cho code mới** (thêm 2026-08-25 theo Codex C0.4.9) |

## Tổng quan sản phẩm (1 đoạn)

CRM đối ngoại/truyền thông cho phòng PR MISA. Stack: Node 24 + Express + **MySQL là mặc định** (`DB_CLIENT` default `'mysql'`, `server/db.js:15`; SQLite chỉ khi set `DB_CLIENT=sqlite` — **sửa lại: bản trước ghi ngược**). Frontend hybrid: Vue 3 + Vite shell (`frontend/`) **nạp động** legacy SPA `public/app.js` (~2.889 dòng, render bằng HTML-string). **145 endpoint HTTP** (135 `server/routes.js` + 7 `server/ai.js` + 3 auth `server/index.js` — **sửa lại: bản trước ghi ~142, thiếu 3 route auth**). AI: Gemini REST (`server/gemini.js`) — text `gemini-3.5-flash`, ảnh `gemini-3.1-flash-image`, **12 luồng egress logic / 13 lời gọi trực tiếp** (6 trong `ai.js` + 6 luồng logic từ 7 lời gọi trong `monitor.js`, xem `06-threat-model.md` §D — sửa lại lần 2, round 1 ghi sai "9 callsite") + SMTP egress riêng (`scheduler.js`→`mailer.js`). **Sửa lại (owner xác nhận 2026-08-24): Cloud Run + Cloud SQL MySQL (https://misa-workstation-784559735000.asia-southeast1.run.app) KHÔNG phải production thật — chỉ là môi trường test trước khi DevOps MISA cấu hình hạ tầng production chính thức riêng.** Railway trước đó cũng chỉ là test. Hạ tầng production thật CHƯA tồn tại — xem `13-deployment-runbook.md` §B. **Owner xác nhận 2026-08-24: dữ liệu trong Cloud Run test hiện tại là DỮ LIỆU TEST, không cần giữ** — cho phép đơn giản hoá lớn chuỗi migration R1 (có thể seed lại từ đầu thay vì retrofit), xem `13-deployment-runbook.md` §B.

## Bối cảnh audit (quan trọng để hiểu severity)

Đánh giá theo skill `production-compatibility-gate` — **2 trục**: Retrofit-tier (A=bất biến dữ liệu / B=seam / C=deploy-config) × Target-gate (target nào owner đã cam kết). **Target `AMIS-native-host` đã cam kết** (owner xác nhận 2026-08-22 sẽ đưa vào AMIS Mobile native; vision Voice Assistant D14 gắn chặt target này). **Target `browser-production` LÙI thời điểm (2026-08-24):** owner xác nhận Cloud Run chỉ là test + dữ liệu hiện tại là dữ liệu test bỏ được → CHƯA có người dùng thật với dữ liệu thật. Nghĩa là target `browser-production` **chưa thật sự kích hoạt lúc này** — chỉ kích hoạt khi DevOps MISA đưa production thật vào và nhân viên PR bắt đầu dùng thật. Điều này cho phép giãn ưu tiên nhiều Tier-A finding (không phải làm gấp vì chưa có dữ liệu thật để mất) và đơn giản hoá chuỗi migration R1. Chưa cam kết: multi-replica.

## Biên bản debate đầy đủ (ngoài repo, trên Desktop người dùng)

`PR-WORKSTATION-DEBATE-BRIEF.md` (Codex) → `...-CLAUDE-REBUTTAL.md` → `...-CODEX-ROUND-2.md` → `...-CLAUDE-ROUND-3.md` → `...-CODEX-ROUND-4-FINAL-CONVERGENCE.md` → `...-CLAUDE-ROUND-5-CLOSE.md` → `...-PLAN-ROADMAP.md` (bản roadmap đưa Codex review) → `...-CODEX-ROADMAP-REVIEW.md` (conditional-consensus 8,2/10, 6 amendment).

## Trạng thái

Debate kỹ thuật (5 vòng) đã đóng. Roadmap đã qua review độc lập của Codex, áp dụng đủ 6 amendment → **Codex: APPROVE FOR IMPLEMENTATION** (xem đầu `04-ROADMAP.md`). Cách phối hợp: Claude triển khai từng gate/slice, **Codex audit độc lập** evidence/exit-condition trước khi qua gate tiếp — đây không phải hình thức, Codex đã thực sự audit Gate 0 và bắt được lỗi thật (xem dưới).

**Gate 0 — ROUND 1: Codex audit (2026-08-22) → FAIL/HOLD GATE 1.** Claude tuyên bố G0.2-G0.5/G0.7/G0.8 "xong" là **sai** — Codex tìm được: (1) ma trận G0.4 vi phạm MDS P0 (gộp theo module, loại admin khỏi native — đã sửa); (2) inventory G0.3 có 47/135 route không xuất hiện literal do bị nén bằng wildcard (đang sửa, agent xây catalog 145-dòng machine-checkable); (3) error contract mâu thuẫn giữa roadmap và spec (đã sửa — `message` canonical, `error` compat alias); (4) Gemini egress map thiếu 3 callsite + mô tả sai `evaluateCampaign` + bỏ sót SMTP (đã sửa); (5) fact drift: DB_CLIENT default sai, đếm endpoint sai ~142 vs 145 thật (đã sửa ở trên); (6) O1-O8 không có Status/Approver/Evidence, O3/O8 chưa hề gửi dù ghi "nên gửi sớm" (đã sửa — decision register giờ trung thực: `NOT SUBMITTED`).

Chỉ **G0.7 (F10 secret) PASS** ở round 1.

**Gate 0 — ROUND 2: Codex re-audit (2026-08-22) → vẫn HOLD GATE 1.** Ghi nhận G0.3 **PASS** (145/145 route khớp tuyệt đối, đối chiếu máy). Nhưng G0.4 vẫn **FAIL/P0 MDS** (bản round 2 dùng range che lấp route — lọt 9 route, gán chồng R096) và G0.8 vẫn **FAIL** (thực tế 13 lời gọi Gemini trực tiếp / 12 luồng logic, không phải 9; `aiCompetitorAnalysis` bị phân loại sai thành Public). G0.5 **CONDITIONAL PASS** (example tự mâu thuẫn `error !== message` do lỗi chính tả). Phát hiện thêm F4: semantics gate O3/O8 tự mâu thuẫn giữa `02-decisions.md` và `04-ROADMAP.md`.

**Remediation round 3 (doc-only) đã xử lý:**
- G0.4: bỏ hẳn cách chia theo module tùy ý — dùng **1 phân hoạch duy nhất từ cột `auth` thật của `07-route-catalog.md`** cho cả 3 section (role/UI-state/native), tự-verify tổng = 145 bằng lệnh `awk` chạy lại được, không còn route lọt/chồng; `partners` không còn `N/A` cho file-picker (`R016`,`R017` tách riêng); `reports` 403 sửa từ `N/A` sai → `FAIL/MISSING`.
- G0.8: egress map viết lại theo **12 luồng logic / 13 lời gọi trực tiếp** (ID `AI-E001..AI-E012`), sửa tier `aiCompetitorAnalysis` Public→Internal, sửa payload thật của `analyzeBatch`/`groundIngest`/`siteGroundIngest`, sửa mô tả uploader (base64 buffer, không phải "file path"), sửa line số `mailer.js`.
- G0.5: sửa lỗi chính tả khiến `error !== message`, thêm exit-criterion equality test.
- F4: chốt 1 semantics duy nhất — **SUBMISSION O3/O8 là exit G0.1** (RESOLUTION chỉ chặn W1.AI-POLICY/Wave 3 voice/Wave 4), xoá câu tự mâu thuẫn cũ.

**G0.2 — đã bổ sung (round 3, cùng đợt):** thêm 8 file `09-16` phủ đủ mục 2 của `BackEnd.SKILL/20-memory-bank-mandate.md` — [09-db-schema.md](09-db-schema.md) (34 bảng, phát hiện thêm: `CREATE INDEX` bị `translate()` bỏ hoàn toàn trên MySQL — **22** index chỉ tồn tại ở SQLite, MySQL không có — sửa lại 2026-08-25, bản trước đếm sai "21"), [10-api-contract.md](10-api-contract.md), [11-business-flows.md](11-business-flows.md), [12-frontend-architecture.md](12-frontend-architecture.md) (xác nhận trực tiếp: `app.js` có 0 class `mds-*`, MDS chỉ áp dụng 1 phần rất nhỏ diện tích UI — khung ngoài; **con số %/diện tích cụ thể chưa đo**, sửa lại 2026-08-25 vì bản trước gọi ước lượng là "không suy đoán"), [13-deployment-runbook.md](13-deployment-runbook.md) (2 điểm UNVERIFIED tự khai báo: volume bền cho uploads trên Cloud Run, quy trình migration Railway→Cloud SQL không có trong repo), [14-known-traps.md](14-known-traps.md), [15-changelog.md](15-changelog.md), [16-coding-rules.md](16-coding-rules.md). Đã tự kiểm chứng nhiều claim trọng yếu (CREATE INDEX bị bỏ, MASK định nghĩa độc lập 2 nơi, `notify_opt_in` tắt cả 2 kênh, mds-* = 0) trực tiếp qua source trước khi chấp nhận.

**Owner-decisions 2026-08-24 (sau round 3): TẤT CẢ đã chốt.**
- **D13 RBAC v2** (4 vai trò + visibility field-level + created_by/owner_id) + **D14 Voice** (giữ human-in-the-loop — người dùng xác nhận trước khi AI ghi) + **D15 AMIS Mobile = cầu nối WebView** (không build native riêng — làm nhẹ khối lượng triển khai native) — xem `02-decisions.md` §D/§E/§F. Thay đổi kiến trúc lớn nhất từ đầu dự án.
- O6 APPROVED ($200); O2/O7 SUPERSEDED; **O3/O4/O5 DEFERRED-TO-DEVOPS**; **O8 PROVISIONAL** (cho phép gửi Gemini tạm — dữ liệu test); O1 (lúc đó) mặc định `private`.
- Dữ liệu Cloud Run = **test, bỏ được** → R1 migration chuỗi bỏ (có điều kiện preflight, xem dưới), target `browser-production` lùi thời điểm.
- `04-ROADMAP.md` viết lại **v3** theo tất cả các quyết định này.

**Gate 0 — Codex round-3 re-audit (2026-08-25): vẫn `HOLD GATE 0`**, ra 8 blocker cụ thể (`PR-WORKSTATION-CODEX-G0-ROUND-3-REAUDIT.md` → `G0-CLOSE-CONTRACT.md`, C0.1-C0.8, đối chiếu ngoài repo trên Desktop). Owner **chuyển C0.3 (rebuild ma trận UI-flow G0.4) cho Codex trực tiếp thực hiện** — lần đầu 1 phần Gate 0 không phải Claude làm. Các mục còn lại Claude đã remediate 2026-08-25:
- **C0.1 — owner APPROVED trực tiếp** (evidence trong `G0-CLOSE-CONTRACT.md`): O1 → APPROVED chính thức (audience default, không hạ classification tier bất biến); D13 self-claim → **không tự nhận**, chỉ Admin/Super Admin gán; N1 → action tường minh (`ack`/`notify`/`run`) thay `view`; N2 → `dashboard:view` tường minh. Không còn dòng nào ở trạng thái mở.
- **C0.2 — D13 security-complete hoá** (Codex chỉ ra bản 2026-08-24 gộp classification+visibility vào 1 cờ boolean, có thể khiến Admin lỡ tay công khai hoá tài khoản NH/giấy tờ tùy thân): D13.2 viết lại thành 4 trục tách biệt — `classification_tier` (trần bất biến) / `audience_visibility` (cấu hình, chỉ siết không nới dưới trần) / `authorization` (role×ownership) / `AI-egress`. D13.4 mở rộng ma trận ownership đủ nhóm resource (không chỉ 14 "hoạt động"). D1 RETAINED/AMENDED, D2 SUPERSEDED, D3 RETAINED/AMENDED — xem `02-decisions.md` §D.
- **C0.4 — sửa lỗi source-fidelity** (tự kiểm chứng lại từng claim bằng parser/grep trước khi sửa): index **22** (không phải 21); `dropAll()` xoá đúng **28/34 bảng**, 6 bảng bị bỏ sót (`agreements`/`work_logs`/`gifts`/`benefit_usages`/`supplier_transactions`/`supplier_contacts`) — `attachments`/`supplier_quotes` THỰC RA có bị xoá (bản cũ ghi sai ngược); reminder không có UNIQUE (chỉ check-then-insert); partner detail trả **10 mảng** (không phải 7); booking chỉ có `award_id`, không có `event_id` (finding mới **F12**); MySQL 8.4 tách rõ local-Docker (xác nhận) vs Cloud-SQL (UNVERIFIED).
- **C0.5 — reset strategy an toàn**: thay "additive migration + seed sạch" bằng preflight/rollback gate `W1.RBAC.0` (không dùng `dropAll()` hiện tại vì không sạch). O3/O4/O5 liệt kê tường minh là 3 phụ thuộc DevOps song song.
- **C0.6 — khoá test contract Gate 1**: characterization-core phủ ĐỦ 145 route + job/scheduler (không thu hẹp "phần giữ nguyên"), thêm lớp G1C acceptance E2E, bắt buộc mapping machine-readable `route_id→test_id→trạng thái`.
- **C0.7 — sửa wording D15**: không dùng "mobile-first responsive" (dễ hiểu lầm) — đổi "composition Native-Mobile RIÊNG BIỆT trong WebView"; D15 **không giảm severity F5** (P0 giữ nguyên); thêm yêu cầu bridge security contract.
- **C0.8 — 2 sửa diễn đạt threat model**: AI-E001 không còn "chặn bởi O8"; AI-E012 làm rõ mention text chỉ dùng cục bộ, không vào prompt Gemini. `06-threat-model.md` lên v5.
- Thêm **D14.4** (secure proposal/confirmation contract cho voice — chống tampering/replay/TOCTOU, R3-08).
- Verify lại: `git diff --check` sạch, `npm run test:security` 6/6 PASS.

**Điều kiện đóng Gate 0 còn lại:** (1) Codex hoàn thành C0.3 (rebuild Section B/C của `08-permission-matrix.md`); (2) Codex round-4 verify tập trung xác nhận C0.1-C0.8 đạt (không phải audit lại toàn dự án). **CHƯA mở Gate 1** cho tới khi cả 2 điều kiện trên xong.
