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

## Tổng quan sản phẩm (1 đoạn)

CRM đối ngoại/truyền thông cho phòng PR MISA. Stack: Node 24 + Express + **MySQL là mặc định** (`DB_CLIENT` default `'mysql'`, `server/db.js:15`; SQLite chỉ khi set `DB_CLIENT=sqlite` — **sửa lại: bản trước ghi ngược**). Frontend hybrid: Vue 3 + Vite shell (`frontend/`) **nạp động** legacy SPA `public/app.js` (~2.889 dòng, render bằng HTML-string). **145 endpoint HTTP** (135 `server/routes.js` + 7 `server/ai.js` + 3 auth `server/index.js` — **sửa lại: bản trước ghi ~142, thiếu 3 route auth**). AI: Gemini REST (`server/gemini.js`) — text `gemini-3.5-flash`, ảnh `gemini-3.1-flash-image`, **9 callsite egress** (6 trong `ai.js` + 3 trong `monitor.js`, xem `06-threat-model.md` §D) + SMTP egress riêng (`scheduler.js`→`mailer.js`). Production: Cloud Run + Cloud SQL MySQL (https://misa-workstation-784559735000.asia-southeast1.run.app), **đã có dữ liệu thật migrate từ Railway**.

## Bối cảnh audit (quan trọng để hiểu severity)

Đánh giá theo skill `production-compatibility-gate` — **2 trục**: Retrofit-tier (A=bất biến dữ liệu / B=seam / C=deploy-config) × Target-gate (target nào owner đã cam kết). **Target đã cam kết:** `browser-production` (đang chạy) **+ `AMIS-native-host`** (owner xác nhận 2026-08-22 sẽ đưa vào AMIS Mobile native). Chưa cam kết: multi-replica.

## Biên bản debate đầy đủ (ngoài repo, trên Desktop người dùng)

`PR-WORKSTATION-DEBATE-BRIEF.md` (Codex) → `...-CLAUDE-REBUTTAL.md` → `...-CODEX-ROUND-2.md` → `...-CLAUDE-ROUND-3.md` → `...-CODEX-ROUND-4-FINAL-CONVERGENCE.md` → `...-CLAUDE-ROUND-5-CLOSE.md` → `...-PLAN-ROADMAP.md` (bản roadmap đưa Codex review) → `...-CODEX-ROADMAP-REVIEW.md` (conditional-consensus 8,2/10, 6 amendment).

## Trạng thái

Debate kỹ thuật (5 vòng) đã đóng. Roadmap đã qua review độc lập của Codex, áp dụng đủ 6 amendment → **Codex: APPROVE FOR IMPLEMENTATION** (xem đầu `04-ROADMAP.md`). Cách phối hợp: Claude triển khai từng gate/slice, **Codex audit độc lập** evidence/exit-condition trước khi qua gate tiếp — đây không phải hình thức, Codex đã thực sự audit Gate 0 và bắt được lỗi thật (xem dưới).

**Gate 0 — ROUND 1: Codex audit (2026-08-22) → FAIL/HOLD GATE 1.** Claude tuyên bố G0.2-G0.5/G0.7/G0.8 "xong" là **sai** — Codex tìm được: (1) ma trận G0.4 vi phạm MDS P0 (gộp theo module, loại admin khỏi native — đã sửa); (2) inventory G0.3 có 47/135 route không xuất hiện literal do bị nén bằng wildcard (đang sửa, agent xây catalog 145-dòng machine-checkable); (3) error contract mâu thuẫn giữa roadmap và spec (đã sửa — `message` canonical, `error` compat alias); (4) Gemini egress map thiếu 3 callsite + mô tả sai `evaluateCampaign` + bỏ sót SMTP (đã sửa); (5) fact drift: DB_CLIENT default sai, đếm endpoint sai ~142 vs 145 thật (đã sửa ở trên); (6) O1-O8 không có Status/Approver/Evidence, O3/O8 chưa hề gửi dù ghi "nên gửi sớm" (đã sửa — decision register giờ trung thực: `NOT SUBMITTED`).

Chỉ **G0.7 (F10 secret) PASS** ở round 1. **Remediation round 2 đã xong phần doc-only** (route catalog 145/145 literal tại `07-route-catalog.md`, ma trận G0.4 rebuild theo route ID với native `FAIL/MISSING` tường minh cho mọi module kể cả admin, 5 trục runtime tách cột riêng). Còn treo trước khi có thể tuyên bố "G0 xong" — **quyết định đó thuộc Codex re-audit, không phải tự Claude tuyên bố**:
- G0.1 (owner quyết O1-O8) và G0.6 (owner duyệt data-classification) vẫn `PROPOSED`/`BLOCKED` — chưa có phê duyệt/evidence thật từ owner.
- O3/O8 vẫn `NOT SUBMITTED` — gửi Team AMIS Mobile và Security/Legal là hành động của owner, Claude không có channel để tự gửi.
- G0.2 (memory-bank mandate coverage theo `BackEnd.SKILL/20-memory-bank-mandate.md`) — còn thiếu tài liệu riêng cho: schema DB đầy đủ, API request/response contract, business flow, frontend architecture/MDS strategy, deployment/runbook, known-traps, changelog, coding-rules. **Chưa đụng tới trong round này** — flag rõ để không rơi.
- Chưa chạy self-check đối chiếu §7 checklist của audit Codex (route-source-set == catalog-set == 145 ✅ đã tự-verify; nhưng broken-link check, `git diff --check`, và toàn bộ checklist còn lại chưa chạy lại sau khi sửa).

**CHƯA mở Gate 1** — đang chờ Codex re-audit round 2 theo đúng mô hình đã thống nhất (Claude triển khai, Codex audit độc lập từng gate).
