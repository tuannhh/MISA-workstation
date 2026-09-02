# 33 — Audit UI release scope, 2026-09-02

## Phạm vi và cách đọc kết quả

Đây là audit lại source, build và test hiện có sau slice Reports Detail. `PASS` nghĩa là có
composition MDS Desktop/Native riêng, domain dùng chung và test source/contract; **không** đồng
nghĩa đã có bằng chứng thiết bị AMIS production. Kiểm tra production host/OS thuộc bàn giao
DevOps trong `32-production-handoff.md`.

| Flow release scope | Desktop MDS | Native Mobile | Quyền/UI | Evidence repo | Kết quả |
|---|---|---|---|---|---|
| Dashboard | riêng | riêng + taskbar | projection server | `UI-DASH-001..002` | PASS (local contract) |
| People, booking, file | riêng | riêng | PolicyEngine + owner/file gate | `UI-PPL-001..017` | PASS (local contract) |
| Partner core, MOU, work-log | riêng | riêng | PolicyEngine + owner gate | `UI-PAR-001..014` | PASS (local contract) |
| Supplier core, detail/read/file | riêng | riêng | projection + owner reassignment | `UI-SUP-001..008`, list tests | PASS (local contract) |
| Interactions / Voice review | riêng | riêng | proposal/confirm; no automatic score | `UI-INT-*`, `UI-VOICE-*` | PASS (local contract) |
| Events / awards / Smart Intake | riêng | riêng | server authority on money/file | `UI-EVENT-*`, `UI-AWARD-*` | PASS (local contract) |
| Monitoring dashboard/source/query/mention | riêng | riêng | protected API; no UI-side authority | `UI-MONITOR-001..005` | PASS (local contract) |
| Reports overview + staff/unit/award/alert detail | riêng | riêng | projection only; no client money aggregation | `UI-REPORT-001..002` | PASS (local contract) |
| Reminders CRUD/notifications | riêng | riêng | protected server mutation | `UI-REM-001` | PASS (local contract) |
| Admin users/audit/field visibility/owner reassignment | riêng | riêng | server re-check; hidden controls are not authorization | `UI-ADMIN-*`, owner tests | PASS (local contract) |

## F6 / W2.2 chưa được phép đóng

Các dòng sau vẫn chỉ có `public/app.js` legacy hoặc chưa có Native composition đủ để thay thế.
Chúng là P0 của backlog UI, không hạ mức độ chỉ vì desktop legacy vẫn hoạt động:

1. Money mutation: budget; partner sponsorship/association fee/gift/benefit; supplier
   quote/transaction/contact create-edit-delete. Đây là thay đổi nhạy cảm; chỉ được tách theo
   từng domain/API allowlist và PolicyEngine test, không dựng generic money form.
2. Monitoring vận hành sâu: scan, run history, highlights, competitor brief, settings, alerts,
   competitor và campaign CRUD/evaluation.
3. Reminder: export `.ics` đã có action Desktop/Native gọi endpoint R061 được server bảo vệ;
   xác nhận trình tải tệp trong AMIS host thật vẫn là việc bàn giao DevOps. AI card text/image
   được owner hoãn, không tạo UI giả.

## Kết quả kiểm tra hiện tại

- `npm run build:ui`: PASS tại commit chứa Reports Detail.
- `node --test server/test/unit-interactions-ui.test.js`: 38/38 PASS.
- `npm run test:integration:sqlite`: 944 tests, 936 PASS, 8 SKIP, 0 FAIL.
- `git diff --check`: PASS trước commit slice.

## DevOps/AMIS bàn giao (không block repo)

O3 host bridge/provider thật, W4.1 device WebView, W4.2 orientation/font/display/accessibility,
W4.3 revoke/deep-link/gesture trên OS, W4.VOICE microphone host runtime, W4.4 canary/rollback
và observability vẫn do DevOps/MISA production thực hiện. Không dùng fake-native để báo PASS các
mục đó.

## Decision

Chưa có "audit UI cuối PASS" vì còn ba nhóm F6 ở trên. Báo cáo này thay baseline cũ bằng một
ma trận release-scope có bằng chứng và là điểm kiểm soát để tiếp tục strangler, không phải giấy
chứng nhận hoàn thành sớm.
