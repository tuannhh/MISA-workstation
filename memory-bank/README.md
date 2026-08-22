# Memory Bank — MISA PR Workstation

> Nguồn sự thật dự án, được git theo dõi. Chỉ ghi **fact đã kiểm chứng** (kèm `file:line`); điều chưa chắc ghi `UNVERIFIED`, không suy đoán.
> Khởi tạo: 2026-08-22 (Gate 0) · Commit baseline audit: `088fbb2`

## Mục lục

| File | Nội dung |
|---|---|
| [01-audit-findings.md](01-audit-findings.md) | Phát hiện audit đã hội tụ (Claude ↔ Codex, 5 vòng), severity theo 2 trục |
| [02-decisions.md](02-decisions.md) | Quyết định kỹ thuật đã chốt + 8 quyết định owner còn mở |
| [03-data-classification.md](03-data-classification.md) | Registry dữ liệu nhạy cảm/tiền (nguồn sự thật cho PolicyEngine) |
| [04-ROADMAP.md](04-ROADMAP.md) | Kế hoạch Gate 0 → Wave 4, task chi tiết + exit gate |

## Tổng quan sản phẩm (1 đoạn)

CRM đối ngoại/truyền thông cho phòng PR MISA. Stack: Node 24 + Express + `node:sqlite` (mặc định) hoặc MySQL (`DB_CLIENT=mysql`, qua `server/mysql-sync.js` worker). Frontend hybrid: Vue 3 + Vite shell (`frontend/`) **nạp động** legacy SPA `public/app.js` (~2.889 dòng, render bằng HTML-string). ~142 endpoint (135 `server/routes.js` + 7 `server/ai.js`). AI: Gemini REST (`server/gemini.js`) — text `gemini-3.5-flash`, ảnh `gemini-3.1-flash-image`. Production: Cloud Run + Cloud SQL MySQL (https://misa-workstation-784559735000.asia-southeast1.run.app), **đã có dữ liệu thật migrate từ Railway**.

## Bối cảnh audit (quan trọng để hiểu severity)

Đánh giá theo skill `production-compatibility-gate` — **2 trục**: Retrofit-tier (A=bất biến dữ liệu / B=seam / C=deploy-config) × Target-gate (target nào owner đã cam kết). **Target đã cam kết:** `browser-production` (đang chạy) **+ `AMIS-native-host`** (owner xác nhận 2026-08-22 sẽ đưa vào AMIS Mobile native). Chưa cam kết: multi-replica.

## Biên bản debate đầy đủ (ngoài repo, trên Desktop người dùng)

`PR-WORKSTATION-DEBATE-BRIEF.md` (Codex) → `...-CLAUDE-REBUTTAL.md` → `...-CODEX-ROUND-2.md` → `...-CLAUDE-ROUND-3.md` → `...-CODEX-ROUND-4-FINAL-CONVERGENCE.md` → `...-CLAUDE-ROUND-5-CLOSE.md` → `...-PLAN-ROADMAP.md` (bản roadmap đưa Codex review) → `...-CODEX-ROADMAP-REVIEW.md` (conditional-consensus 8,2/10, 6 amendment).

## Trạng thái

Debate kỹ thuật đã đóng. Roadmap đã qua review độc lập của Codex và áp dụng đủ 6 amendment (xem đầu `04-ROADMAP.md`) → **Codex: APPROVE FOR IMPLEMENTATION**. Cách phối hợp: Claude triển khai từng gate/slice, Codex audit độc lập evidence/exit-condition trước khi qua gate tiếp. **Đang thực thi Gate 0.** Owner vẫn cần duyệt 8 quyết định (02-decisions.md §B) — O3/O8 nên xin sớm vì lead-time tổ chức dài, không chặn Gate 0/G1A/G1B.
