# 08 — Ma trận Permission × Surface × Runtime (G0.4)

> Theo amendment #6 của Codex: `route × surface(desktop/native) × role/permission × UI-state × feature-runtime(permission/lifecycle/deep-link/gesture/accessibility-OS)`.
> Chi tiết từng route (135+7) nằm ở `07-route-inventory.md` — file này là **ma trận tổng hợp theo module** để tránh trùng lặp 142 dòng. Mỗi ô runtime ghi `PASS/FAIL/N-A/UNVERIFIED`.

## Quy ước cột
- **Role coverage:** quyền module theo `rbac.js:28-55` cho `super_admin`/`pr_staff`.
- **UI state (desktop):** loading/empty/error/403/masked — dựa trên `public/app.js` hiện có (characterization, không phải test tự động).
- **Native surface:** trạng thái tồn tại của native composition — hiện **KHÔNG có module nào** đã dựng (F5), nên cột này là baseline "chưa có" cho toàn bộ, không phải lỗi riêng module.
- **Feature-runtime:** permission (camera/mic/file/notification OS) / lifecycle (background/resume) / deep-link / gesture / accessibility-OS. Toàn bộ `UNVERIFIED` cho tới Wave 4 (đúng theo D-nguyên tắc completion, không suy đoán).

## Ma trận theo module

| Module | Role: super_admin | Role: pr_staff | UI state desktop | Native surface | Feature-runtime | Gap chính |
|---|---|---|---|---|---|---|
| partners (org+person) | view/create/edit/delete | view/create/edit/delete (sensitive theo `sensitive_perms`) | loading/empty/error hiện có; 403 chưa test tự động; masked có (`maskList`) | Chưa có (F5) | UNVERIFIED | F1 write-bypass (10 route), F1 read-bypass (`/files/:id`) — pilot slice Wave 3 |
| people | view/create/edit/delete | view/create/edit/delete | như trên | Chưa có | UNVERIFIED | Bề mặt mật lớn nhất (contact/private/social/finance/iddoc/org_fee) — **pilot W3 slice 1** |
| awards | view/create/edit/delete | view/create/edit/delete | như trên | Chưa có | UNVERIFIED | cost/budget write-bypass; file upload không kiểm loại nội dung |
| events | view/create/edit/delete | view/create/edit/delete | như trên | Chưa có | UNVERIFIED | event_costs write-bypass; F9 kind từ query string không whitelist |
| suppliers | view/create/edit/delete | view/create/edit/delete | như trên | Chưa có | UNVERIFIED | transactions/quotes write-bypass; file=quote không gate org_fee khi download |
| reminders | view/create/edit/delete | view/create/edit/delete | như trên | Chưa có | UNVERIFIED | N1: perm 'view' dùng cho action ghi (`/reminders/run` trigger side-effect thật) |
| interactions | view/create/edit/delete | view/create/edit/delete | như trên | Chưa có | UNVERIFIED | Voice-intake (F4, `POST /ai/interaction-voice`) — chặn bởi O8 |
| monitoring | view/create/edit/delete | view/create/edit/delete | như trên | Chưa có | UNVERIFIED | SSRF F3 (`/monitor/scan`, `/monitor/sources`); N1 (`/monitor/alerts/:id/read`) |
| reports | view | **[] — không có quyền nào** | như trên (chỉ super_admin thấy) | Chưa có | UNVERIFIED | org_fee aggregate không check `canMoney` (an toàn hiện tại vì chỉ super_admin gọi, hở nếu role mới thêm quyền reports) |
| admin | view/create/edit/delete | **[] — không có quyền nào** | như trên | Chưa có | N/A (không cần native cho admin theo MDS gate) | `/admin/audit` không phân trang (LIMIT 200 cứng) |
| dashboard | (không có requirePerm module — mọi role đăng nhập xem) | (như trên) | như trên | Chưa có | UNVERIFIED | **N2: chưa xác nhận chủ ý** — cần owner |
| AI (voice/text/image/excel) | theo module gắn (interactions/reminders/awards/events) | như trên | error/timeout có xử lý ở event-extract; các flow khác chưa rõ | Chưa có | UNVERIFIED | F4/F8 — chặn `W1.AI-POLICY` bởi O8, model migration bởi O6 |

## Role model — xác nhận drift (F11, tham chiếu)
Code (`rbac.js:12-15`) chỉ có 2 role. Banner login (`index.js:50-55`) quảng cáo 5 tài khoản (`truongphong`, `lanhdao`, `xem`) **không tồn tại trong seed** (`db.js:665-666` chỉ tạo `admin`+`chuyenvien`). Ma trận này phản ánh **code thật** (2 role), không phản ánh banner. Dọn banner ở W1.11 sau O7.

## UNVERIFIED cần owner xác nhận (đưa vào G0.1 cùng 8 quyết định)
1. `GET /dashboard` không có requirePerm module — chủ ý (dashboard chung mọi role) hay thiếu sót?
2. `POST /reminders/run`, `/notifications/*/read`, `/monitor/alerts/:id/read` dùng perm `view` cho action ghi — có cần tách action `notify`/`ack` riêng trong RBAC, hay giữ nguyên (rủi ro thấp, chỉ semantics)?
3. `uploadAudio.single('file')` dùng lại cho PDF/ảnh ở `/ai/award-extract` — xác nhận `server/uploads.js` áp đúng limit theo loại file thực tế (không kế thừa nhầm limit audio).

## Exit gate G0.4
Ma trận theo module hoàn thành; mọi ô runtime ghi rõ trạng thái (không để trống); 3 UNVERIFIED trên đưa vào quyết định owner. Ma trận per-route chi tiết đã có ở `07-route-inventory.md` — không cần lặp lại ở đây.
