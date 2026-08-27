# 18 — G1B RBAC v2 implementation contract

> **Status:** ACTIVE — 2026-08-27. Nguồn quyết định: `02-decisions.md` D1/D3/D13; registry: `03-data-classification.md`. Đây là contract triển khai, không thay thế các quyết định đó.

## Batch RBAC-FOUNDATION

- **Goal:** dựng nền dữ liệu và `PolicyEngine` cho RBAC v2 mà chưa thay một lượt toàn bộ route legacy.
- **In scope:** registry code một nguồn sự thật; `field_visibility` (unique module+field, default private/fail-closed); owner metadata cho đúng các resource D13.4; read/write/attachment decision API thuần; migration/backfill preflight và test dual-driver.
- **Out of scope:** thay UI, thay toàn bộ 145 route, AMIS bridge, durable session backend (O4 do DevOps chốt), AI policy.
- **Behavior mode:** target-change, fail-closed. Chỉ route được chuyển sang PolicyEngine mới đổi hành vi; route còn lại giữ characterization cho tới từng vertical slice.
- **Risk hotspots:** migration/backfill dữ liệu thật; aggregate tiền; attachment direct ID; staff tự claim owner; cross-driver schema; silent stripping.
- **Required tests:** target red trước implementation cho Viewer/Staff/Admin/Super Admin; migration fresh+upgrade+rollback/preflight; owner transfer/no-self-claim; public/private ceiling; create/update/write 403; direct file download; report aggregate; SQLite+MySQL.
- **Exit criteria:** không client-controlled classification/owner; thiếu visibility là private; sensitive write bị 403 (không strip); mọi record cũ được classify/verify trước flip fail-closed; route pilot People Detail pass dual driver.

## Thứ tự bắt buộc

1. Inventory schema và dữ liệu thật; backup, migration rehearsal và backfill classification/owner/file visibility; verify `NULL=0` trước flip fail-closed (W1.RBAC.0).
2. Thêm registry code + PolicyEngine thuần và target tests; chưa gắn route.
3. Thêm schema/migration idempotent, seed visibility, audit/invalidate cache.
4. Chuyển People Detail end-to-end (read, write, file), rồi acceptance money supplier/booking/event.
5. Chỉ sau đó strangler các slice còn lại; không dùng `buildInsert`/`buildUpdate` làm authorization choke point.

## Evidence preflight

- `npm run rbac:preflight` chạy **read-only**, không import `server/db.js` để tránh seed/migrate vô tình. Ngoài kiểm tra schema, script đếm từng ownership column và `attachments.audience_visibility`; chỉ báo `readyToFlipFailClosed=true` khi tất cả đều `NULL=0`.
- Kết quả SQLite local 2026-08-27: chưa sẵn sàng flip fail-closed — thiếu `owner_id` ở 13/14 resource direct (cột `gifts.owner_id` hiện là chủ thể nhận quà, không phải staff owner), attachment chưa có `audience_visibility`, chưa có bảng `field_visibility`.
- Production/MySQL phải chạy lại đúng lệnh với biến `MYSQL_*`; lưu JSON artifact (bao gồm tổng record/missing theo bảng) + backup reference trước khi bước migration bắt đầu. `readyToFlipFailClosed=true` chỉ là bằng chứng schema/backfill, không thay thế DevOps attestation, backup và smoke cutover của W1.RBAC.0.

### Slice schema 1 — 2026-08-27

- `field_visibility(module, field, is_public)` có unique key, default private; attachment thêm `audience_visibility='private'` cho cả DB mới và DB nâng cấp.
- Chưa có route nào đọc hai giá trị này; PolicyEngine/backfill owner là slice sau. Vì vậy migration này additive, không làm lộ dữ liệu hoặc đổi quyền runtime.

### Slice schema 2 — ownership metadata (owner APPROVED 2026-08-27)

- Thêm `owner_id` nullable cho 13 resource hoạt động direct. `gifts.owner_id` là người/cơ quan nhận quà legacy, nên thêm `responsible_user_id` làm ownership staff — owner đã duyệt rõ trong hội thoại 2026-08-27.
- Không tự backfill, không self-claim và chưa route nào enforce; preflight phải báo đủ dữ liệu owner `NULL` trước khi bất kỳ gate fail-closed nào được bật.

### Slice foundation 3 — PolicyEngine thuần

- `server/policy-engine.js` là decision core không phụ thuộc Express/DB: tier server-controlled, visibility fail-closed, ownership direct/global/module-admin-only và exception gifts.
- Chưa thay `rbac.js` legacy hay gắn route. Test D13-001..005 là contract đích; slice People Detail sẽ là adapter đầu tiên trả 403 dựa trên engine này.
