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
| [07-route-inventory.md](07-route-inventory.md) | G0.3 — inventory đầy đủ 142 route + 2 job + 13 UI view, `file:line` |
| [08-permission-matrix.md](08-permission-matrix.md) | G0.4 — ma trận permission × surface × runtime theo module |

## Tổng quan sản phẩm (1 đoạn)

CRM đối ngoại/truyền thông cho phòng PR MISA. Stack: Node 24 + Express + `node:sqlite` (mặc định) hoặc MySQL (`DB_CLIENT=mysql`, qua `server/mysql-sync.js` worker). Frontend hybrid: Vue 3 + Vite shell (`frontend/`) **nạp động** legacy SPA `public/app.js` (~2.889 dòng, render bằng HTML-string). ~142 endpoint (135 `server/routes.js` + 7 `server/ai.js`). AI: Gemini REST (`server/gemini.js`) — text `gemini-3.5-flash`, ảnh `gemini-3.1-flash-image`. Production: Cloud Run + Cloud SQL MySQL (https://misa-workstation-784559735000.asia-southeast1.run.app), **đã có dữ liệu thật migrate từ Railway**.

## Bối cảnh audit (quan trọng để hiểu severity)

Đánh giá theo skill `production-compatibility-gate` — **2 trục**: Retrofit-tier (A=bất biến dữ liệu / B=seam / C=deploy-config) × Target-gate (target nào owner đã cam kết). **Target đã cam kết:** `browser-production` (đang chạy) **+ `AMIS-native-host`** (owner xác nhận 2026-08-22 sẽ đưa vào AMIS Mobile native). Chưa cam kết: multi-replica.

## Biên bản debate đầy đủ (ngoài repo, trên Desktop người dùng)

`PR-WORKSTATION-DEBATE-BRIEF.md` (Codex) → `...-CLAUDE-REBUTTAL.md` → `...-CODEX-ROUND-2.md` → `...-CLAUDE-ROUND-3.md` → `...-CODEX-ROUND-4-FINAL-CONVERGENCE.md` → `...-CLAUDE-ROUND-5-CLOSE.md` → `...-PLAN-ROADMAP.md` (bản roadmap đưa Codex review) → `...-CODEX-ROADMAP-REVIEW.md` (conditional-consensus 8,2/10, 6 amendment).

## Trạng thái

Debate kỹ thuật đã đóng. Roadmap đã qua review độc lập của Codex và áp dụng đủ 6 amendment (xem đầu `04-ROADMAP.md`) → **Codex: APPROVE FOR IMPLEMENTATION**. Cách phối hợp: Claude triển khai từng gate/slice, Codex audit độc lập evidence/exit-condition trước khi qua gate tiếp.

**Gate 0: G0.2/G0.3/G0.4/G0.5/G0.7/G0.8 xong.** G0.3 (inventory 142 route) phát hiện F1 (money write-bypass) rộng hơn audit gốc — 10 nhóm route, không phải 2 (chi tiết `07-route-inventory.md` §Ghi chú). Còn chờ: G0.1 (owner duyệt 8 quyết định — O3/O8 nên xin sớm vì lead-time dài) và 3 UNVERIFIED nhỏ ở `08-permission-matrix.md`. Sau đó vào Gate 1 (test net G1A/G1B).
