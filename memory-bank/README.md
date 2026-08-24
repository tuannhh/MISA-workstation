# Memory Bank — MISA PR Workstation

> Nguồn sự thật dự án, được git theo dõi. Chỉ ghi **fact đã kiểm chứng** (kèm `file:line`); điều chưa chắc ghi `UNVERIFIED`, không suy đoán.
> Khởi tạo: 2026-08-22 (Gate 0) · Commit baseline audit: `088fbb2`

## Mục lục

| File | Nội dung |
|---|---|
| [01-audit-findings.md](01-audit-findings.md) | Phát hiện audit đã hội tụ (Claude ↔ Codex, 5 vòng), severity theo 2 trục |
| [02-decisions.md](02-decisions.md) | Quyết định kỹ thuật đã chốt + 8 quyết định owner còn mở |
| [03-data-classification.md](03-data-classification.md) | Registry dữ liệu nhạy cảm/tiền (nguồn sự thật cho PolicyEngine) |
| [04-ROADMAP.md](04-ROADMAP.md) | Kế hoạch Gate 0 → Wave 4, task chi tiết + exit gate (v2, amendment Codex đã áp dụng) |
| [05-error-contract.md](05-error-contract.md) | G0.5 — envelope lỗi target, giữ tương thích `error` field cũ |
| [06-threat-model.md](06-threat-model.md) | G0.8 — threat model, data-flow, Gemini egress map |
| [07-route-catalog.md](07-route-catalog.md) | G0.3 — catalog **145/145 route literal 1:1** + 2 job + 13 UI view, `file:line` (thay bản wildcard-compress cũ, đã bị Codex bắt lỗi) |
| [08-permission-matrix.md](08-permission-matrix.md) | G0.4 — ma trận permission × surface × runtime, join theo route ID (đã sửa lỗi MDS P0 admin=N/A + gộp 5 trục runtime) |
| [09-db-schema.md](09-db-schema.md) | G0.2 — lược đồ đầy đủ 34 bảng (cột/kiểu/PK/FK/index) + quy tắc dịch SQLite→MySQL + migration idempotent |
| [10-api-contract.md](10-api-contract.md) | G0.2 — ý nghĩa field request/response theo nhóm resource (không lặp route catalog) |
| [11-business-flows.md](11-business-flows.md) | G0.2 — luồng nghiệp vụ cốt lõi: đối tác, giải thưởng, sự kiện, nhà cung cấp, nhắc việc, giám sát truyền thông |
| [12-frontend-architecture.md](12-frontend-architecture.md) | G0.2 — kiến trúc Vue shell + legacy `app.js`, pattern list/detail/form, trạng thái MDS thật |
| [13-deployment-runbook.md](13-deployment-runbook.md) | G0.2 — chạy dev local, deploy Cloud Run + Cloud SQL, biến môi trường đầy đủ |
| [14-known-traps.md](14-known-traps.md) | G0.2 — bẫy kỹ thuật đã biết (khác audit findings) |
| [15-changelog.md](15-changelog.md) | G0.2 — lịch sử phát triển theo mốc kiến trúc/tính năng, kèm lý do |
| [16-coding-rules.md](16-coding-rules.md) | G0.2 — quy tắc code đang thấy trong thực tế, ghi rõ mâu thuẫn/ngoại lệ |

## Tổng quan sản phẩm (1 đoạn)

CRM đối ngoại/truyền thông cho phòng PR MISA. Stack: Node 24 + Express + **MySQL là mặc định** (`DB_CLIENT` default `'mysql'`, `server/db.js:15`; SQLite chỉ khi set `DB_CLIENT=sqlite` — **sửa lại: bản trước ghi ngược**). Frontend hybrid: Vue 3 + Vite shell (`frontend/`) **nạp động** legacy SPA `public/app.js` (~2.889 dòng, render bằng HTML-string). **145 endpoint HTTP** (135 `server/routes.js` + 7 `server/ai.js` + 3 auth `server/index.js` — **sửa lại: bản trước ghi ~142, thiếu 3 route auth**). AI: Gemini REST (`server/gemini.js`) — text `gemini-3.5-flash`, ảnh `gemini-3.1-flash-image`, **12 luồng egress logic / 13 lời gọi trực tiếp** (6 trong `ai.js` + 6 luồng logic từ 7 lời gọi trong `monitor.js`, xem `06-threat-model.md` §D — sửa lại lần 2, round 1 ghi sai "9 callsite") + SMTP egress riêng (`scheduler.js`→`mailer.js`). **Sửa lại (owner xác nhận 2026-08-24): Cloud Run + Cloud SQL MySQL (https://misa-workstation-784559735000.asia-southeast1.run.app) KHÔNG phải production thật — chỉ là môi trường test trước khi DevOps MISA cấu hình hạ tầng production chính thức riêng.** Railway trước đó cũng chỉ là test. Hạ tầng production thật CHƯA tồn tại — xem `13-deployment-runbook.md` §B. Còn UNVERIFIED: dữ liệu trong Cloud Run test hiện tại có phải dữ liệu nghiệp vụ thật đang dùng hằng ngày hay chỉ demo.

## Bối cảnh audit (quan trọng để hiểu severity)

Đánh giá theo skill `production-compatibility-gate` — **2 trục**: Retrofit-tier (A=bất biến dữ liệu / B=seam / C=deploy-config) × Target-gate (target nào owner đã cam kết). **Target `AMIS-native-host` đã cam kết** (owner xác nhận 2026-08-22 sẽ đưa vào AMIS Mobile native). **Target `browser-production` cần làm rõ lại (2026-08-24):** hạ tầng hiện tại (Cloud Run) chỉ là môi trường test theo owner xác nhận — nhưng skill này định nghĩa `browser-production` = "người dùng MISA thật dùng qua trình duyệt", không phụ thuộc tên gọi hạ tầng. Nếu nhân viên PR đang thật sự dùng app này hằng ngày với dữ liệu thật (dù chạy trên Cloud Run "test"), target này **vẫn coi là đã kích hoạt** — chờ owner trả lời câu UNVERIFIED ở `13-deployment-runbook.md` §B để chốt. Chưa cam kết: multi-replica.

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

**G0.2 — đã bổ sung (round 3, cùng đợt):** thêm 8 file `09-16` phủ đủ mục 2 của `BackEnd.SKILL/20-memory-bank-mandate.md` — [09-db-schema.md](09-db-schema.md) (34 bảng, phát hiện thêm: `CREATE INDEX` bị `translate()` bỏ hoàn toàn trên MySQL — 21 index chỉ tồn tại ở SQLite, production không có), [10-api-contract.md](10-api-contract.md), [11-business-flows.md](11-business-flows.md), [12-frontend-architecture.md](12-frontend-architecture.md) (xác nhận trực tiếp: `app.js` có 0 class `mds-*`, MDS chỉ áp dụng ~5% diện tích UI — khung ngoài), [13-deployment-runbook.md](13-deployment-runbook.md) (2 điểm UNVERIFIED tự khai báo: volume bền cho uploads trên Cloud Run, quy trình migration Railway→Cloud SQL không có trong repo), [14-known-traps.md](14-known-traps.md), [15-changelog.md](15-changelog.md), [16-coding-rules.md](16-coding-rules.md). Đã tự kiểm chứng nhiều claim trọng yếu (CREATE INDEX bị bỏ, MASK định nghĩa độc lập 2 nơi, `notify_opt_in` tắt cả 2 kênh, mds-* = 0) trực tiếp qua source trước khi chấp nhận.

**Còn treo, không phải việc Claude tự làm được:**
- G0.1/G0.6 vẫn chờ owner quyết thật (6 quyết định O1/O2/O4/O5/O6/O7 + 2 submission O3/O8).
- 2 điểm UNVERIFIED hạ tầng ở `13-deployment-runbook.md` §B.3/B.4 (volume uploads bền? quy trình migration Railway thật là gì?) — cần owner xác nhận, không suy đoán.

**CHƯA mở Gate 1** — round 3 (G0.4/G0.5/G0.8/F4 + toàn bộ G0.2) đã xong phần Claude làm được, sẵn sàng gửi Codex re-audit round 3 (Claude triển khai, Codex audit độc lập từng gate, đúng mô hình đã thống nhất).
