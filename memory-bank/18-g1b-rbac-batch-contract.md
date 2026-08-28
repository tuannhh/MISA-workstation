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

### Slice foundation 4 — Principal seam (W1.1)

- `auth.resolvePrincipal(req)` chuẩn hoá provider web session hiện tại thành `req.principal`; `requireAuth` và `requirePerm` đều gắn principal trước khi cho route tiếp tục. Không tin dữ liệu do client gửi và chưa thay matrix 2-role legacy.
- Route cũ có thể tiếp tục đọc `req.session.user` trong giai đoạn strangler. Route/slice mới bắt buộc dùng `req.principal`, để AMIS bridge sau này chỉ cần thay provider tại seam thay vì chạm mọi handler.

### Slice foundation 5 — Classification registry completeness

- Đối chiếu `03-data-classification.md` với engine phát hiện 8 field đời tư (`personality`, `hobbies`, `food_habits`, `family_info`, `media_stance`, `relationship_network`, `meeting_places`, `gift_rules`) đã được quyết là Confidential nhưng thiếu trong implementation ban đầu. Đã thêm đủ vào `FIELD_TIER` và allowlist cấu hình; bất kỳ attempt nào public hoá chúng đều `FORBIDDEN_TIER`.

### Slice foundation 6 — Policy service choke point

- `server/policy-service.js` là adapter command/projection DB-agnostic cho vertical slices: `prepareCreate` server-derive `created_by` và owner direct; `prepareUpdate` giữ created_by immutable và chỉ Admin/Super Admin chuyển owner; `projectRecord` lọc field trước response bằng PolicyEngine + dynamic visibility.
- Từ chối đều là `PolicyForbiddenError` để route trả 403 rõ ràng, không silent-strip. Chưa gắn handler legacy; People Detail là slice đầu tiên được phép dùng service này.

### Pilot 1 — People Detail read (D13)

- `GET /people/:id` là route strangler đầu tiên: các target role `viewer`/`executor`/`admin` đi qua `policyService.projectRecord`; missing config = không trả field, Confidential/Restricted không bao giờ thành public. Collection, attachment và file trả rỗng trong pilot để không tạo read-leak qua related resource trước W1.FILE/W1.OWN.
- User legacy vẫn qua behavior cũ, nên pilot không làm đổi quyền 2-role trước cutover. Dual-driver test D13-011 tạo viewer thật, cấu hình duy nhất `partners.full_name=public`, rồi xác nhận phone/bank/collection đều không lộ.

## Batch G1B.3-session (2026-08-28)

```md
Batch-ID: G1B.3-session
Goal: viết target-red spec test cho F2 (session hardening) theo đúng G1B.3 trong roadmap;
      trước tiên dựng cơ chế allowlist known-red bắt buộc theo G1B.6 (chưa tồn tại trong repo —
      không có test nào được phép RED mà không đi qua cơ chế này).
In scope: cơ chế known-red/allowlist (server/test-support/known-red.js +
      memory-bank/g1b-allowlist.json); 2 test target cho F2: session KHÔNG regenerate khi login
      (fixation) và /api/login KHÔNG có rate-limit (brute force). Có kiểm tra thêm hành vi logout
      hiện tại (không phải known-red — chỉ xác nhận trạng thái đang GREEN hay RED để ghi đúng).
Out of scope: implement fix thật cho fixation/rate-limit (đó là W1.7, DevOps chốt backend store
      O4); D13/G1B.1/G1B.2 (RBAC v2 resource matrix — batch riêng); đổi SESSION_SECRET fail-fast
      (không test được qua HTTP ở tầng này, để lại TODO).
Behavior mode: target-change (spec-first cho phần viết lại F2) + 1 infra mechanical (known-red).
Risk hotspots: auth/session — nhưng đây là test THÊM MỚI, không sửa server/auth.js hay
      server/app.js, nên không đổi hành vi runtime hiện có.
Required tests: known-red self-test (allowlist thiếu id / hết hạn / test tự pass đều phải làm
      known-red khung thất bại đúng cách); F2-fixation; F2-ratelimit; F2-logout-invalidation
      (characterization, không phải known-red).
Allowed known-red/TODO (owner + expiry/wave): F2-fixation (owner: backend, expiry: 2026-12-31,
      wave: W1.7); F2-ratelimit (owner: backend, expiry: 2026-12-31, wave: W1.7) — cả hai đã có
      trong roadmap §G1B.3/W1.7, không phải phạm vi mới xin thêm.
Exit criteria: known-red harness tự-test xanh (chứng minh nó thật sự phát hiện allowlist
      thiếu/hết hạn/test bất ngờ pass); 2 known-red test hiện RED đúng lý do (fail vì thiếu
      regenerate/rate-limit, không fail vì lỗi test); logout-invalidation ghi đúng trạng thái
      thật; full regression (security/mapping/integration sqlite+mysql) vẫn xanh.
Expected commit range/count: 1 commit.
```

- **Known-red harness (G1B.6)** — `server/test-support/known-red.js` export `knownRed(id, name, fn)`: tra `memory-bank/g1b-allowlist.json` theo `id`; fail ngay nếu không có entry hoặc entry đã hết `expiry`; chạy `fn`, bắt lỗi — nếu `fn` **không** throw (nghĩa là hành vi đích bất ngờ đã đúng rồi), known-red tự fail để buộc promote thành test xanh thật + xoá khỏi allowlist, đúng yêu cầu G1B.6 "unexpected failure ngoài allowlist = build đỏ" (áp dụng đối xứng cho cả chiều "known-red bất ngờ pass").
- **F2-fixation** — login lần 1 (user A) lấy cookie phiên C1, login lần 2 (user B) **tái dùng cookie C1** (mô phỏng attacker đã cắm sẵn session id C1 cho nạn nhân trước khi nạn nhân đăng nhập); vì `auth.login` không gọi `req.session.regenerate()`, cookie phiên sau khi login lại vẫn là C1 — known-red xác nhận đúng lỗ hổng fixation, sẽ tự bật GREEN thật khi W1.7 thêm regenerate.
- **F2-ratelimit** — gửi liên tiếp N lần sai mật khẩu tới `/api/login`, hiện không có giới hạn nên toàn bộ vẫn trả `401` (không có lần nào `429`) — known-red xác nhận thiếu rate-limit.
- **F2-logout-invalidation** — xác nhận trạng thái THẬT hiện tại (không phải known-red): sau `POST /api/logout`, dùng lại cookie cũ gọi `/api/me` phải trả `401`. `req.session.destroy()` đã xoá bản ghi phía server nên hành vi này đã đúng từ trước — ghi nhận là GREEN, không đưa vào allowlist.
