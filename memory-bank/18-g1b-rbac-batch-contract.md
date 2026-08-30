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

## Batch G1B.5-n1n2 (2026-08-28)

```md
Batch-ID: G1B.5-n1n2
Goal: viết target-red test cho N1/N2 — 2 finding đã RESOLVED ở 02-decisions.md §B.1
      (owner APPROVED 2026-08-25, C0.1.3/C0.1.4) nhưng target chưa implement, đúng phạm vi
      G1B.5 trong roadmap.
In scope: N1 (4 route side-effect hiện dùng requirePerm('reminders'|'monitoring','view') phải
      đổi sang action tường minh ack/run — POST /notifications/:id/read,
      POST /notifications/read-all, POST /reminders/run, POST /monitor/alerts/:id/read); N2
      (GET /dashboard hiện KHÔNG có requirePerm nào — phải có permission dashboard:view tường
      minh, cấp cho mọi role được phép xem dashboard trong rbac.js MATRIX).
Out of scope: implement fix thật (đổi rbac.js MODULES/MATRIX + requirePerm ở routes.js — đó là
      Wave 1, đổi mã hành vi thật); G1B.1/.2 (ma trận D13 ownership, batch riêng vì quy mô lớn
      hơn nhiều).
Behavior mode: target-change (spec-first, source-introspection — 2 role hiện tại
      (super_admin/pr_staff) đều được cấp full CRUD trên module reminders/monitoring nên HTTP
      request thực tế không phân biệt được 'view' vs 'ack'/'run' hôm nay; gap chỉ lộ ra khi có
      role tương lai được cấp view nhưng không được cấp write side-effect, đúng như D13/Viewer
      sẽ có — nên test target đọc trực tiếp nguồn route/permission thay vì gọi HTTP, giống cách
      verify-g0.mjs đã làm cho route catalog).
Risk hotspots: không — chỉ đọc file nguồn, không đổi runtime.
Required tests: N1 (4 route, mỗi route 1 known-red assert đúng action tường minh, không phải
      'view'); N2 (route /dashboard có requirePerm('dashboard','view'); rbac.js MODULES chứa
      'dashboard'; MATRIX[super_admin].dashboard và MATRIX[pr_staff].dashboard đều chứa 'view').
Allowed known-red/TODO (owner + expiry/wave): N1 (owner: backend, expiry: 2026-12-31, wave: W1
      — xem 04-ROADMAP.md dòng N1); N2 (owner: backend, expiry: 2026-12-31, wave: W1 — dòng N2).
      Cả hai đã RESOLVED ở 02-decisions.md §B.1, không phải phạm vi mới xin thêm.
Exit criteria: known-red N1/N2 RED đúng lý do (đọc đúng nguồn hiện tại, không fail vì lỗi test);
      full regression (security/mapping/G0/integration sqlite+mysql) vẫn xanh.
Expected commit range/count: 1 commit.
```

- **N1-explicit-action** — đọc trực tiếp `server/routes.js`, so khớp `requirePerm('reminders', ...)`/`requirePerm('monitoring', ...)` tại đúng 4 route side-effect; known-red assert action phải khác `'view'` (target: `ack` cho 2 route notifications + monitor alerts, `run` cho reminders/run) — hiện cả 4 đều dùng `'view'` nên RED đúng.
- **N2-dashboard-permission** — đọc `server/routes.js` xác nhận `GET /dashboard` có gọi `requirePerm('dashboard', 'view')` (hiện KHÔNG có, route chỉ nhận `(req, res)` trần) và đọc `server/rbac.js` xác nhận `MODULES` chứa `'dashboard'` + cả 2 role trong `MATRIX` đều liệt kê `dashboard: [...'view'...]` — cả 3 điều kiện đều RED hôm nay.

## Batch G1B.1-engine-completeness (2026-08-28)

```md
Batch-ID: G1B.1-engine-completeness
Goal: đóng khoảng cách giữa bảng D13.4a ĐÃ owner-approved (02-decisions.md, đủ 6 nhóm:
      Direct/Global/Module-admin-only/Inherited/"Global theo role") và policy-engine.js hiện tại
      (chỉ model 3/6 nhóm — thiếu hẳn "Inherited" cho event_costs) + mở rộng test coverage phủ
      đủ tất cả entity trong từng nhóm (trước đó chỉ test mẫu booking/gift/budget/person, chưa
      test hết 14 Direct + 4 Global + 6 Module-admin-only).
In scope: thêm nhóm `INHERITED` (event_cost kế thừa owner_id của event cha, theo D13.4a hàng
      "Chi phí sự kiện" — đã owner-approved, không phải quyết định sản phẩm mới) vào
      policy-engine.js; thêm tham số `parentOwnerId` cho canWrite/canReadField (optional,
      backward-compatible, không đổi chữ ký gọi hiện có); mở rộng unit test phủ hết 14 Direct +
      4 Global + 6 Module-admin-only + 1 Inherited + toàn bộ FIELD_TIER entries chưa test.
Out of scope: gắn route nào cho event_costs hay bất kỳ resource nào khác vào PolicyEngine (đó
      là Wave 1 strangler slice, chỉ People Detail được owner duyệt hiện tại — xem §G
      02-decisions.md); "Tài nguyên quản trị" (users/field_visibility config/audit_log) — hành
      vi đã đúng ngầm định (không nằm trong Direct/Global nên executor không ghi được, khớp
      "Global theo role" trong D13.4a) nên không cần thêm set riêng, chỉ ghi chú trong test.
Behavior mode: target-change (engine code, pure function, không DB/route) — phần lớn assertion
      sẽ GREEN vì code hiện tại đã generic đúng cho phần lớn entity, ngoại trừ event_cost (RED
      trước khi thêm INHERITED, GREEN sau khi thêm).
Risk hotspots: không — pure function, không đổi route/schema, tham số mới optional nên mọi call
      site hiện có (People Detail pilot, policy-service.js) không bị ảnh hưởng.
Required tests: unit-policy-engine.test.js mở rộng đủ 14+4+6+1 entity; giữ nguyên 5 test D13-001
      ..005 cũ không sửa (đã là contract đích, chỉ thêm không thay).
Allowed known-red/TODO (owner + expiry/wave): không cần known-red — đây là closing spec gap đã
      approved, không phải target-red chờ implementation.
Exit criteria: mọi entity trong D13.4a có ít nhất 1 test canWrite + (nếu có FIELD_TIER) 1 test
      classification; event_cost inherited ownership pass đúng cả 2 chiều (owner sự kiện cha ->
      true, người khác -> false); test cũ D13-001..005 + D13-008..010 vẫn xanh nguyên văn; full
      regression xanh.
Expected commit range/count: 1 commit.
```

- **INHERITED (event_cost)** — D13.4a hàng "Chi phí sự kiện" đã owner-approved từ trước (không phải quyết định mới, chỉ là code chưa bắt kịp bảng): `event_costs` không có "người tạo" độc lập, kế thừa `owner_id` của `events` cha. `canWrite`/`canReadField` nhận thêm `parentOwnerId` (optional): executor ghi/đọc đủ `event_cost` khi `parentOwnerId === principal.id`, giống hệt ngữ nghĩa Direct nhưng lấy owner từ bản ghi cha thay vì chính nó. Trước khi thêm, `event_cost` không nằm trong `DIRECT`/`GLOBAL` nên executor không bao giờ ghi được dù là sự kiện của chính họ (RED so với D13.4a) — test cũ xác nhận đúng RED trước, GREEN sau khi thêm `INHERITED`.
- **Phủ đủ entity** — mỗi 1 trong 14 Direct (không chỉ booking/gift) đều có 1 test canWrite executor-own=true/executor-other=false/admin=true; mỗi 4 Global (organization/person/supplier/important_date) có test create=true, edit=true bất kể owner, delete=false cho executor; mỗi 6 Module-admin-only (budget/scan_query/source/competitor/campaign/monitor_alert) có test executor bị chặn hoàn toàn (create/edit đều false), admin bypass; toàn bộ `FIELD_TIER` entries còn thiếu (sponsorship/budget/award/award_participation/supplier_quote/supplier_transaction/event_cost/association_fee/gift/supplier) có test `classification()`.

## Batch RBAC-PILOT2-people-write (2026-08-30)

```md
Batch-ID: RBAC-PILOT2-people-write
Goal: mo rong pilot People Detail (04-ROADMAP.md Wave 1, "Thu tu bat buoc" muc 4: "Chuyen People
      Detail end-to-end (read, write, file)") tu chi READ (D13-011) sang WRITE: PUT /api/people/:id
      va DELETE /api/people/:id di qua PolicyEngine cho target role viewer/executor/admin, giu
      nguyen 100% hanh vi legacy 2-role (super_admin/pr_staff) qua nhanh cu.
In scope: PUT /api/people/:id va DELETE /api/people/:id trong server/routes.js — nhanh moi goi
      policyService.assertWritable (entity='person', action='edit'|'delete') truoc khi buildUpdate/
      xoa; nhanh legacy (khong phai target role) giu nguyen requirePerm('partners','edit'|'delete')
      + stripDisallowed nhu hien tai, khong doi 1 dong. Dual-driver test moi (SQLite+MySQL).
Out of scope: W1.FILE (attachment visibility gate cho POST/GET/DELETE attachments cua person) —
      batch rieng sau; owner reassignment UI (D13.4c, thuoc W1.ADMIN, UI la lane Codex); bat ky
      pilot slice nao ngoai People Detail (Partner/Supplier/Booking/Event...) — phai hoi lai owner
      truoc, khong tu mo rong pham vi (02-decisions.md SS G).
Behavior mode: target-change cho DUNG 2 route nay, target role moi (viewer/executor/admin) — hanh
      vi legacy 2-role khong doi (khong big-bang, dung tinh than D13-011 da lam cho GET).
Risk hotspots: nguoi la GLOBAL (D13.4a) khong phai Direct — canWrite khong doc owner_id cua ban
      ghi (people khong co cot owner_id), chi check role+action; phai dam bao KHONG vo tinh doi
      sang kiem tra ownership (se sai ban chat "danh ba dung chung" da owner-approved D13-P1).
      Field-level write khong bi gate theo classification_tier (D13.2b: "authorization tach khoi
      audience_visibility, mot field public van co the khong sua duoc neu khong phai owner" — nguoc
      lai cung dung: field Confidential/Restricted van ghi duoc neu co quyen edit record, day la
      thiet ke da duyet, khong phai lo hong can va).
Required tests: viewer PUT/DELETE nguoi -> 403 (khong duoc sua/xoa gi); executor PUT nguoi -> 200,
      GET lai dung gia tri moi (Global edit, khong can la owner vi people khong co owner_id);
      executor DELETE nguoi -> 403 (D13.1: khong co quyen xoa du la Global); admin PUT + DELETE ->
      200 (full CRUD tru tao tai khoan Admin/config); legacy super_admin/pr_staff PUT/DELETE giu
      nguyen 100% test R032/R033 cu (khong sua cac test do, chi doc lai xac nhan van pass).
Allowed known-red/TODO: khong can — day la target-change co code that di kem, khong phai spec-first
      cho lo hong chua sua.
Exit criteria: full regression (test:security, test:integration:sqlite, test:integration:mysql,
      test:verify-gate1-mapping, verify-g0.mjs, git diff --check) deu xanh, khong regression tren
      R032/R033 legacy; PolicyForbiddenError tra 403 ro rang, khong silent-strip (dung nguyen tac
      D1); danh gia lai npm run rbac:preflight sau batch (van se readyToFlipFailClosed=false vi
      chua backfill du lieu that — khong phai exit criterion cua batch nay).
Expected commit range/count: 1 commit.
```

## Batch RBAC-PILOT3-people-file (2026-08-30)

```md
Batch-ID: RBAC-PILOT3-people-file
Goal: hoan tat "Chuyen People Detail end-to-end (read, write, file)" (04-ROADMAP.md Wave 1, muc 4)
      bang cach noi POST/PUT/DELETE attachments cua person + GET /api/files/:id vao PolicyEngine
      cho target role viewer/executor/admin, dung D13.3a/b (audience_visibility tung file + tran
      server-derived theo kind) va D13.4a (person la Global, khong co owner bypass); nhanh legacy
      2-role (super_admin/pr_staff) giu nguyen 100% qua senGroups()/requirePerm nhu cu.
In scope: POST /api/people/:id/attachments, PUT /api/people/:id/attachments/:aid/primary, DELETE
      /api/attachments/:aid, GET /api/files/:id trong server/routes.js; policy-engine.js them
      attachmentVisibilityCeiling/canSetAttachmentVisibility/canReadAttachment (pure, D13.3b: id_doc
      tran private cung KHONG co ngoai le Admin, portrait tran public); GET /api/people/:id target-
      role branch tu tra portraits/idDocs rong (tam trong D13-011/RBAC-PILOT2) sang du lieu that co
      gate theo canReadAttachment; scripts/verify-g0.mjs them 3 route vao PILOT_INLINE_PERM_ROUTES;
      07-route-catalog.md cap nhat R034/R035/R036 dung style carve-out nhu R030/R032/R033.
Out of scope: UI chon visibility luc upload (Codex lane, khong dung trong batch nay — server chi
      chap nhan query param ?visibility= lam seam ky thuat, khong phai UI that); attachments cua
      owner_type khac person (award/supplier/event) — DELETE /api/attachments/:aid va GET /api/
      files/:id la route dung chung nhieu owner_type, target role dung cham owner_type != person
      thi fail-closed 403, KHONG tu suy dien policy cho cac entity do; bat ky pilot slice nao ngoai
      People Detail — phai hoi lai owner truoc (02-decisions.md SS G).
Behavior mode: target-change cho 4 route tren, chi anh huong target role moi — hanh vi legacy
      2-role khong doi 1 dong (van dung senGroups().has('iddoc'), rbac.can(), requirePerm nhu cu).
Risk hotspots: (1) D13.3b tran la TUYET DOI — canSetAttachmentVisibility KHONG duoc co nhanh bypass
      cho Admin/Super Admin, neu vo tinh them isPrivileged() bypass se pha vo chinh cau "khong co
      duong nao de 1 Nhan vien thuc thi lo tay cong khai hoa" ma ca Admin cung phai bi chan; (2)
      person la Global (D13.4a) nen canReadAttachment KHONG co nhanh executor-owns-this-record nhu
      canReadField danh cho Direct/Inherited — private attachment chi Admin/Super Admin doc duoc,
      ke ca chinh nguoi da upload no; (3) DELETE /api/attachments/:aid va GET /api/files/:id phuc vu
      NHIEU owner_type, phai kiem tra att.owner_type==='person' truoc khi ap dung canReadAttachment/
      assertWritable cho target role, neu khong se sai lech sang xu ly nham policy cho award/supplier
      attachments (chua co slice rieng).
Required tests: viewer upload/set-primary/delete deu 403; executor upload portrait mac dinh private
      -> chinh executor cung khong thay lai (khong co owner bypass tren Global); executor upload voi
      visibility=public -> thay lai duoc; executor upload id_doc -> 403 (chi Admin/Super Admin);
      admin (target role) upload id_doc thanh cong, executor thay idDocCount nhung KHONG thay noi
      dung (ton tai vs noi dung, dung D13.4b); admin upload id_doc kem visibility=public van 400
      (tran tuyet doi, khong co ngoai le Admin); GET /api/files/:id executor 403 tren id_doc + 200
      tren portrait public, admin 200 ca hai; executor set-primary/delete anh chan dung OK (Global
      edit) nhung DELETE id_doc van 403; DELETE /api/attachments/:aid fail-closed 403 khi owner_type
      khac person; legacy super_admin/pr_staff giu nguyen 100% test R034/R035/R036/R037 cu.
Allowed known-red/TODO: khong can — target-change co code that di kem.
Exit criteria: full regression (test:security, test:integration:sqlite, test:integration:mysql,
      test:verify-gate1-mapping, verify-g0.mjs, git diff --check) deu xanh, khong regression tren
      R034/R035/R036/R037 legacy; ceiling D13.3b khong the bi vuot bang bat ky role nao (co test
      xac nhan rieng cho Admin); PolicyForbiddenError/403 ro rang, khong silent-strip.
Expected commit range/count: 1 commit.
```

## Batch RBAC-EXP-B1-module-admin (2026-08-30)

```md
Batch-ID: RBAC-EXP-B1-module-admin
Goal: mo rong PolicyEngine tu pilot 1 entity (person) sang 6 entity Module-admin-only trong
      02-decisions.md SS D13.4a (budget/scan_query/source/competitor/campaign/monitor_alert) --
      day la batch 1/6 cua ke hoach mo rong 24 entity con lai (owner da duyet mo rong toan bo,
      tu chon phuong an chia batch). Chon nhom nay lam truoc vi luat don gian nhat: Nhan vien
      thuc thi (executor) bi chan HOAN TOAN moi hanh dong ghi (ke ca create), chi Admin/Super
      Admin (target role) hoac super_admin/pr_staff (legacy) moi duoc sua -- khong co khai niem
      chu so huu can so sanh, giam rui ro logic cho lan mo rong dau tien.
In scope: 14 route ghi (POST/PUT/DELETE) tren 6 entity trong server/routes.js -- POST /api/budgets;
      POST/PUT/DELETE /api/monitor/queries(/:id); POST/PUT/DELETE /api/monitor/sources(/:id);
      POST/PUT/DELETE /api/monitor/competitors(/:id); POST/PUT/DELETE /api/monitor/campaigns(/:id);
      POST /api/monitor/alerts/:id/read. Them 1 ham dung chung moduleAdminOnlyGate(entity,
      legacyModule, action) (thay vi copy tay 14 khoi dual-branch giong het nhau -- 6 entity chung
      1 luat nen dung 1 ham duoc test ky an toan hon 14 ban sao chep tay); giu NGUYEN action string
      goc cho nhanh legacy (vd budgets dung 'view' khong phai 'edit', monitor_alerts dung 'ack'
      khong phai 'edit') vi PolicyEngine.canWrite() cho Module-admin-only tra ve gia tri GIONG HET
      nhau bat ke action la gi (executor luon false, admin/super_admin luon true) nen doi action
      khong lam sai policy nhung SAI action se lam sai nhanh requirePerm(legacyModule,action) cho
      user legacy. scripts/verify-g0.mjs them 14 route vao PILOT_INLINE_PERM_ROUTES; server/test/
      target-n1-n2-explicit-permission.test.js: mo rong requirePermArgsFor() nhan dang them pattern
      moduleAdminOnlyGate(...) (route POST /monitor/alerts/:id/read khong con literal requirePerm
      tren dong dang ky).
Out of scope: GET (view/list/detail) cua ca 6 entity -- giu nguyen requirePerm('monitoring'/
      'reports','view') cu, KHONG doi. Day la khoang trong da biet tu chinh pilot person (GET
      /api/people van chi dung requirePerm cu, chi GET /api/people/:id moi duoc gate rieng) --
      target role hien van bi 403 tren GET vi rbac.js MATRIX chua co entry cho viewer/executor/
      admin; day la van de he thong rieng (rbac.js MATRIX gap), khong phai loi cua batch nay, va
      se duoc xu ly khi co quyet dinh rieng ve migrate rbac.js MATRIX cho 3 target role (chua hoi
      owner). POST /monitor/scan (trigger quet, khong map 1-1 vao entity nao trong 6 entity tren)
      va POST/PUT/DELETE /monitor/mentions, PUT /monitor/settings (entity 'mention' khong nam trong
      DIRECT/GLOBAL/MODULE_ADMIN_ONLY/INHERITED cua policy-engine.js) -- khong dung trong batch nay.
      5 entity Direct/Global con lai va cac batch RBAC-EXP-B2..B6 -- se lam o cac batch sau, khong
      gop vao batch nay.
Behavior mode: target-change cho 14 route tren, chi anh huong target role viewer/executor/admin --
      hanh vi legacy 2-role (super_admin/pr_staff) khong doi 1 dong (moduleAdminOnlyGate() goi lai
      dung requirePerm(legacyModule, action) nguyen ban cho nhanh else).
Risk hotspots: (1) action string phai giu dung nghia legacy trong nhanh else (budgets='view',
      monitor_alert='ack') -- da xac nhan canWrite() cho Module-admin-only khong phu thuoc action
      nen doi action cho nhanh PolicyEngine khong sai, nhung phai KHONG doi action truyen cho
      requirePerm() nhanh legacy; (2) POST /monitor/sources goi outbound.validateOutboundUrl (SSRF
      F3) -- test admin phai phan biet 403 (PolicyEngine chan, truoc handler) voi 400 (SSRF chan,
      trong handler) de khong nham lan 2 lop chan khac nhau; (3) route dung chung nhieu entity
      (mentions) phai duoc loai tru ro rang khoi scope, khong tu suy dien policy cho entity chua
      phan loai.
Required tests (server/test/integration-rbac-exp-b1-module-admin.test.js, D13-025..D13-030): moi
      entity co 3 case -- viewer create/edit/delete deu 403; executor create/edit/delete deu 403
      (dung diem D13.4a: executor khong duoc ke ca create, khac Direct/Global); admin (target role)
      full CRUD tra 200 (source: tach rieng create voi edit/delete vi create phu thuoc SSRF that).
      Legacy giu nguyen 100% test R050/R051 (budgets), R116-R134 (monitor) cu, khong sua cac test
      do -- chi xac nhan van pass.
Allowed known-red/TODO: khong can -- target-change co code that di kem.
Exit criteria: full regression (test:security, test:integration:sqlite, test:integration:mysql,
      test:verify-gate1-mapping, verify-g0.mjs, git diff --check) deu xanh, khong regression tren
      route legacy; PolicyForbiddenError tra 403 ro rang, khong silent-strip.
Expected commit range/count: 1 commit.
```

## Batch RBAC-CUTOVER (2026-08-30)

```md
Batch-ID: RBAC-CUTOVER
Goal: owner chot bo hoan toan he 2-role legacy (super_admin/pr_staff), chuyen dut khoat sang DUY
      NHAT 4 vai tro D13 (viewer/executor/admin/super_admin) -- day la quyet dinh MOI, rong hon
      va GHI DE ngoai le 02-decisions.md SS G (2026-08-28, truoc do cam "cutover role hang loat"/
      "bat RBAC v2 lam duong mac dinh"). Owner tra loi truc tiep 2 diem chan: (1) anh xa user that
      pr_staff -> executor CO DINH; super_admin/admin/viewer KHONG co anh xa tu dong 1-1, owner tu
      gan theo cap bac that tung nguoi qua POST/PUT /api/admin/users sau nay (vi du owner dua ra:
      Ban Tong Giam doc -> viewer, truong nhom truyen thong doi ngoai -> admin, truong ban truyen
      thong -> super_admin); (2) du lieu nghiep vu cu (owner_id NULL tren 13 bang Direct) chi la
      demo, KHONG can backfill, co the xoa/ghi lai. Chi tiet day du: 02-decisions.md SS G.1.
In scope: (a) server/rbac.js: ROLES/MATRIX doi han tu 2 khoa (super_admin/pr_staff) sang 4 khoa
      (viewer/executor/admin/super_admin) -- pr_staff RENAME thang thanh executor (cung noi dung
      quyen, chi doi ten); them moi MATRIX.admin (copy noi dung super_admin -- phan biet Admin/
      Super Admin chi tiet hon nam o PolicyEngine/guard rieng, khong o MATRIX tho) va MATRIX.viewer
      (chi 'view' tren moi module, rong 'admin'). (b) Global rename pr_staff -> executor toan bo
      repo code+test (67 cho, 15 file) -- rename co hoc (1:1, khong doi noi dung), khong phai viet
      lai tu dau. (c) server/routes.js: bo han TARGET_RBAC_ROLES/nhanh dual-branch -- moi route da
      gan PolicyEngine (person + 6 entity Module-admin-only) nay chay PolicyEngine KHONG DIEU KIEN
      cho CA 4 vai tro (ke ca super_admin, truoc day tach rieng vao nhanh "legacy"); route CHUA gan
      PolicyEngine tiep tuc dung requirePerm/rbac.can nhu cu -- nay dung cho ca 4 vai tro nho MATRIX
      da mo rong, khong con 403 sai cho viewer/admin. GET /people/:id, PUT/DELETE /people/:id,
      personEditGate, POST /people/:id/attachments, DELETE /attachments/:aid, GET /files/:id: xoa
      nhanh else (legacy maskRecord/senGroups/stripDisallowed cho rieng person) -- CHI GET /files/:id
      giu lai phan biet ro id_doc (luon gate qua canReadAttachment) voi owner_type khac 'person'
      (khong gate them, dung hanh vi cu -- route nay phuc vu nhieu owner_type, chua co policy slice
      rieng cho award/supplier/event). (d) D13.1 fix quan trong phat hien giua batch: MATRIX.admin
      copy nguyen tu super_admin se VO TINH cho Admin full quyen module 'admin' (tao/sua/xoa tai
      khoan BAT KY role nao + xem audit_log) -- trai voi D13.1 da chot (Admin KHONG duoc tao/sua/xoa
      tai khoan Admin/Super Admin, KHONG duoc xem audit_log). Vá bang guard rieng trong tung handler
      (khong phai o MATRIX tho, vi MATRIX khong phan biet duoc "quan ly user thuong" voi "quan ly
      user dac quyen"): POST/PUT/DELETE /admin/users chan Admin thao tac tai khoan co role hien tai
      HOAC role dich la admin/super_admin (tru tu sua chinh minh KHONG doi role -- khong phai leo
      thang); GET /admin/audit chi super_admin (isPrivileged khong du, phai dung == 'super_admin').
      (e) isValidNewUserPayload/POST /api/admin/users da tu dong nhan 4 role qua rbac.ROLES, dong
      khoang trong "khong co cach tao user role D13 qua API that" da neu o batch RBAC-EXP-B1.
Out of scope: seed 2 tai khoan demo trong db.js van giu nguyen 2 tai khoan (super_admin + executor)
      -- KHONG them demo cho viewer/admin (tao qua API that khi can, gap da dong). Khong dong migrate
      MATRIX/PolicyEngine cho 18 entity con lai (14 Direct + 3 Global + 1 Inherited) -- batch RBAC-
      EXP-B2..B6 tiep tuc rieng. Khong sua 08-permission-matrix.md SS B.2 (UI-flow theo role x
      device) -- do la pham vi UI/characterization (Codex lane), chi them 1 ghi chu dinh huong doc
      dung cach doc bang cu, khong rebuild bang cho 4 vai tro (viec do la 1 batch UI rieng).
Behavior mode: TARGET-CHANGE lon nhat tu dau du an -- xoa han khai niem "legacy 2-role" khoi code,
      khong con nhanh du phong nao. An toan vi: user that hien tai CHUA co ai mang role
      viewer/admin/pr_staff-cu (chi co seed 2 tai khoan demo, da rename dung), va MATRIX moi duoc
      thiet ke GIU NGUYEN noi dung quyen cho tung ten vai tro (super_admin khong doi, executor =
      pr_staff cu ve noi dung).
Risk hotspots: (1) MATRIX.admin copy tu super_admin roi VO TINH mo rong qua module 'admin' -- da
      phat hien VA VA NGAY trong batch nay (khong phai backlog rieng) qua doi chieu lai voi D13.1 da
      chot tu truoc, khong phai suy dien moi; (2) GET /files/:id phuc vu nhieu owner_type -- neu ap
      dung canReadAttachment vo dieu kien cho MOI owner_type se chan nham file cua award/supplier/
      event (chua co policy slice), da xu ly bang re nhanh rieng giu nguyen hanh vi cu cho owner_type
      khac 'person'; (3) sensitiveVisible field trong GET /people/:id truoc day chi check
      role==='admin' (thieu super_admin) -- da sua thanh policy.isPrivileged(principal).
Required tests: server/test/integration-rbac-admin-tier.test.js (13 test, D13-031..034) -- D13.1
      Admin/Super Admin: admin khong tao/sua/xoa duoc tai khoan admin/super_admin khac (ke ca tu
      nang cap chinh minh), van tao/sua/xoa duoc tai khoan executor/viewer binh thuong, tu sua chinh
      minh (khong doi role) van OK; admin khong xem duoc audit_log, super_admin xem duoc. Toan bo
      709 test SQLite + 716 test MySQL cu (truoc batch) van pass 100% khong sua noi dung assertion
      (chi rename pr_staff->executor co hoc trong fixture/comment) -- xac nhan rename khong lam sai
      lech hanh vi nao.
Allowed known-red/TODO: khong can -- target-change co code + test di kem.
Exit criteria: full regression (test:security, test:integration:sqlite, test:integration:mysql,
      test:verify-gate1-mapping, verify-g0.mjs, git diff --check) deu xanh; khong con chuoi
      'pr_staff' nao trong server/*.js (grep xac nhan); D13.1 Admin/Super Admin phan biet dung
      (test rieng); 02-decisions.md SS G.1 ghi lai quyet dinh owner day du de tranh mau thuan voi
      SS G cu.
Expected commit range/count: 1 commit.
```

## Batch RBAC-FIELDVIS-FIX (2026-08-30)

```md
Batch-ID: RBAC-FIELDVIS-FIX
Goal: P0 tu phat hien truoc khi bat dau Batch RBAC-EXP-B2 (mo rong 3 entity Global con lai:
      organization/supplier/important_date) -- kiem tra thu cong projectRecord() cho entity person
      voi principal executor phat hien: MOI field Public-tier (khong thuoc SENSITIVE_GROUPS nao,
      vd email_work/phone_work/position/org_id/beat/relationship_score...) bi AN MAC DINH cho
      viewer/executor, khong chi field mat (Confidential/Restricted). Ly do: canReadField() cu doi
      hoi isPublic===true (co dong field_visibility ro rang) moi cho xem field Public, va
      ALLOWED_FIELDS trong policy-visibility-store.js chi liet ke dung nhom field mat + full_name
      (demo) -- moi field khac (vd email_work) khong nam trong allowlist nay nen isPublic() throw,
      catch ve false, ket qua field bi an. Sau batch RBAC-CUTOVER (cung ngay) xoa nhanh legacy,
      GET /people/:id chay PolicyEngine KHONG DIEU KIEN cho executor (vai tro that duy nhat cua
      toan bo nhan vien PR that hien nay, sau khi doi ten pr_staff->executor) -- nghia la BUG NAY
      DA LIVE tren production ngay khi RBAC-CUTOVER duoc push: nhan vien PR that mo 1 nguoi trong
      danh ba se thay record GAN NHU RONG (chi con full_name neu da duoc toggle rieng, con lai mat
      het email/dien thoai cong viec/chuc vu/co quan...). Xac nhan bang script thu cong
      (server/policy-service.js projectRecord voi principal role=executor) truoc khi sua: tra ve
      '{}' cho 1 record co 9 field, chi con 'id' bi mat luon.
In scope: (a) server/policy-engine.js canReadField(): sua logic cuoi -- tier!=='Public' luon tra
      false (KHONG doi, giu nguyen an toan chan Confidential/Restricted bi cau hinh sai thanh
      public -- test D13-002 "config corrupt khong public hoa Confidential" van xanh); tier===
      'Public' gio tra `isPublic !== false` thay vi `!!isPublic` -- nghia la field Public MAC DINH
      HIEN THI tru khi CO dong field_visibility ro rang is_public=0 (dung D13.2b: "audience_
      visibility chi duoc SIET, khong duoc NOI" -- SIET tu mac dinh-hien-thi xuong an, khong phai
      NOI tu mac dinh-an len hien). (b) server/policy-visibility-store.js isPublic(): tra ve
      `undefined` khi chua co dong cau hinh nao (thay vi ep ve `false`) -- phan biet ro "chua cau
      hinh gi" (undefined, PolicyEngine ap mac dinh theo tier) voi "da cau hinh ro private"
      (false, luon an bat ke tier). (c) server/policy-service.js projectRecord(): bo `!!` ep kieu,
      truyen thang gia tri tho tu store (undefined/true/false) sang canReadField(). (d) PHAT HIEN
      THEM giua batch (khong phai backlog rieng): server/mysql-sync.js translate() chua co rule
      dich cau UPSERT field_visibility (INSERT...ON CONFLICT(module,field) DO UPDATE SET...) sang
      MySQL -- setPublic() (duy nhat cach cau hinh field_visibility qua code that) CHUA TUNG duoc
      test tren MySQL truoc batch nay (test unit cu ep cung DB_CLIENT=sqlite o dau file, integration
      test moi viet trong batch nay la lan dau goi qua HTTP/MySQL that va lap tuc lo ra loi cu
      phap SQL) -- them 1 rule translate moi theo dung mau cac rule ON CONFLICT khac da co san.
Out of scope: khong doi ALLOWED_FIELDS (van chi gom nhom field mat + full_name lam vi du dieu
      chinh duoc) -- mo rong allowlist nay phu mot cot that cua module la 1 viec khac (them 1 man
      hinh Admin cau hinh tung field), khong phai P0 can sua ngay; khong doi hanh vi Confidential/
      Restricted (giu fail-closed nhu cu, khong lien quan bug nay).
Behavior mode: BUG-FIX dung theo dac ta da duyet truoc do (02-decisions.md D13.2b), khong phai
      quyet dinh moi -- "Field tier Public -> mac dinh hien thi hop ly, audience_visibility CHI
      DUOC SIET KHONG DUOC NOI DUOI TRAN" da duoc owner duyet tu 2026-08-25 (C0.2), code cu chi
      thuc thi SAI (an mac dinh thay vi hien mac dinh).
Risk hotspots: (1) neu sua nham thanh "moi field deu hien thi mac dinh bat ke tier" se mo lo hong
      nguoc lai (Confidential/Restricted bi lo) -- da chan bang if tier!=='Public' return false
      DUNG TRUOC dong return isPublic!==false, khong doi thu tu; (2) MySQL UPSERT statement dich
      sai thu tu regex (datetime('now') da bi 1 rule truoc do dich thanh UTC_TIMESTAMP() TRONG
      CUNG 1 chuoi .replace(), nen rule moi phai match phan DA DICH, khong phai literal goc) --
      da phat hien qua that bai test that, sua dung, xac nhan lai bang test.
Required tests: server/test/integration-people.test.js D13-011 (sua lai, khong con INSERT
      field_visibility thu cong -- gio field Public thay duoc mac dinh) + D13-011b (test moi:
      SIET full_name xuong private qua setPublic() that, xac nhan an dung 1 field, khong anh huong
      field Public khac); server/test/unit-policy-visibility-store.test.js D13-006 (sua lai ky
      vong tu false -> undefined). Xac nhan thu cong lai bang script: executor projectRecord() tren
      person co 9 field business gio thay 7 field (an dung dob/phone_personal, con lai hien).
Allowed known-red/TODO: khong can -- bug fix co code + test di kem, khong phai hardening ly thuyet.
Exit criteria: full regression (test:security, sqlite 723/8, mysql 730/1, verify-gate1-mapping,
      verify-g0.mjs, git diff --check) deu xanh; script xac nhan thu cong executor thay du field
      Public tren person; MySQL that su chay duoc setPublic() (truoc batch nay chua tung duoc thuc
      thi tren MySQL).
Expected commit range/count: 1 commit.
```

## Batch RBAC-EXP-B3 (2026-08-30)

```md
Batch-ID: RBAC-EXP-B3
Goal: batch 3/6 -- gan PolicyEngine cho 2 entity Direct dau tien (booking/interaction, D13.4a),
      khac han pattern Global cua batch B2: moi record co owner_id rieng, executor CHI sua duoc
      ban ghi CHINH HO tao, KHONG BAO GIO xoa duoc (ke ca chu so huu) -- diem nay da duoc chu xac
      nhan lai qua AskUserQuestion sau khi chu dat cau hoi ve nghia Global (organization/supplier)
      co bi nham lan voi nghia Direct hay khong; cau tra loi "Giu nhu cu" xac nhan Global giu
      nguyen (khong doi), con Direct (batch nay) dung gate owner_id nhu thiet ke ban dau.
In scope: (a) interaction (`POST /api/interactions`): chi co create/view (khong PUT/DELETE, la
      log lich su tuong tac) -- POST doi `pick()` tho sang `policyService.prepareCreate()`, tu gan
      `owner_id`/`created_by` = principal hien tai (truoc batch nay owner_id luon NULL). (b) booking
      (`GET/POST/PUT/DELETE /api/bookings`, `/api/bookings/:id`): GET dung `projectRecord()` che
      `amount` neu khong phai chu so huu/khong privileged; POST dung `prepareCreate()` tu gan
      owner_id; PUT dung `assertWritable()` -- chi qua khi `owner_id` = chinh principal HOAC
      Admin/Super Admin; DELETE dung `assertWritable()` khong dieu kien owner -- Direct entity thi
      xoa CHI danh cho Admin/Super Admin, kể ca chu so huu cung khong xoa duoc. (c)
      `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` them 4 route (POST interactions, POST/PUT/
      DELETE bookings) + `07-route-catalog.md` R045/R047/R048/R049 doi mo ta auth sang "kiem
      INLINE" giong pattern da dung o B2.
Out of scope: 12 Direct entity con lai (award/award_participation/event/sponsorship/agreement/
      work_log/gift/association_fee/supplier_quote/supplier_transaction/supplier_contact/
      benefit_usage) + 1 Inherited (event_cost) -- batch RBAC-EXP-B4..B6 (nhom tam thoi, chua chot
      voi chu); UI-flow matrix SS B.2 (Codex lane).
Behavior mode: TARGET-CHANGE -- lan dau ap dung gate owner_id thuc su cho Direct entity (khac Global
      da lam o B2); truoc batch nay owner_id ton tai trong schema nhung khong duoc PolicyEngine
      dung de gate gi ca (moi executor deu sua/xoa duoc bat ky booking nao qua legacy 2-role).
Risk hotspots: (1) de lam nham Direct thanh Global (cho executor sua bat ky ai) -- da tranh duoc
      nho chu chu dong hoi lai va xac nhan Direct phai gate owner_id; (2) DELETE cho booking truoc
      batch nay CHUA TUNG gate theo owner (chi role) -- doi sang "khong bao gio cho executor, ke
      ca chu" la THAT CHAT hon truoc, khong phai noi long -- xac nhan an toan qua D13-050b (chu so
      huu tu DELETE chinh booking cua minh van 403); (3) test file
      integration-bookings-budgets.test.js dung quy uoc `{cookie: ...}` (khong phai `as`) khac 2
      file batch truoc -- giu nguyen quy uoc rieng cua file, khong doi ten tham so.
Required tests: `integration-interactions.test.js` D13-046 (viewer POST 403), D13-047 (executor
      POST 200, owner_id/created_by = chinh executor); `integration-bookings-budgets.test.js`
      D13-048 (viewer POST 403), D13-049 (executor POST 200 + owner_id dung), D13-050 (executor
      PUT booking cua NGUOI KHAC tra 403), D13-050b (executor DELETE booking CUA CHINH MINH van
      403 -- Direct entity khong bao gio cho executor xoa), D13-051 (admin/target-role DELETE 200).
Allowed known-red/TODO: khong can.
Exit criteria: full regression (test:security 6/6, sqlite 748/8, mysql 748/1, verify-gate1-mapping
      145/145, verify-g0.mjs PASS, git diff --check sach) deu xanh.
Expected commit range/count: 1 commit.
```

## Batch RBAC-EXP-B2 (2026-08-30)

```md
Batch-ID: RBAC-EXP-B2
Goal: batch 2/6 mo rong PolicyEngine ra ngoai person -- gan not 3 entity Global con lai
      (organization/supplier/important_date, D13.4a) theo dung pattern da dung cho person pilot,
      TREN NEN engine da sua dung o batch RBAC-FIELDVIS-FIX ngay truoc do (neu lam truoc khi sua se
      lap lai dung bug an mac dinh field Public cho 2 entity dung hang ngay nhieu hon person).
In scope: (a) organization (`GET/PUT/DELETE /api/partners/:id`): GET dung
      `policyService.projectRecord()` thay `rbac.maskRecord()` cho record chinh (che membership_fee
      theo classification_tier=Confidential); PUT/DELETE bo `requirePerm('partners',edit/delete)` +
      `stripDisallowed` cu, thay bang `policyService.assertWritable()` khong dieu kien (giong
      person) -- Global entity: executor sua duoc bat ke ai tao, KHONG bao gio xoa duoc (chi
      Admin/Super Admin). Cac collection long (people/sponsorships/gifts/fees/agreements/workLogs)
      GIU NGUYEN rbac.maskList/legacy masking -- do la Direct entity KHAC (sponsorship/gift/
      association_fee/agreement/work_log), chua co policy slice rieng, ngoai pham vi batch nay.
      (b) supplier (`GET/PUT/DELETE /api/suppliers/:id`): tuong tu -- che service_fee_pct/
      deposit_pct (Confidential); quotes/transactions/contacts la Direct entity khac, giu nguyen
      maskMoney/org_fee legacy. (c) important_date (`PUT/DELETE /api/reminders/:id`): KHONG co field
      mat nao (FIELD_TIER khong khai important_date) nen KHONG can projectRecord cho GET -- chi can
      gate ghi/xoa qua assertWritable. (d) Don rac phat sinh: `stripDisallowed()` (server/routes.js)
      het call site that su sau khi bo o organization (person da bo tu batch truoc) -- xoa han dinh
      nghia + xoa khoi `router.testables` export + xoa unit test rieng da mo coi (BR-VAL-020, khong
      con ham nao de test). (e) `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` them 6 route moi
      (PUT/DELETE partners, suppliers, reminders) + `07-route-catalog.md` R005/R006/R041/R042/
      R082/R083 doi mo ta auth sang dung "kiem INLINE" giong R032/R033 (person) da lam truoc do.
Out of scope: 14 Direct entity + 1 Inherited (event_cost) con lai -- batch RBAC-EXP-B3..B6; UI-flow
      matrix SS B.2 (Codex lane); khong dong ALLOWED_FIELDS them field organization/supplier nao (da
      khong con can thiet sau RBAC-FIELDVIS-FIX -- field Public mac dinh hien thi, khong can dang
      ky rieng).
Behavior mode: TARGET-CHANGE tiep tuc tu person pilot, khong doi nguyen tac -- chi ap dung dung mau
      da duyet cho 2 entity Global con lai dung hang ngay (to chuc/nha cung cap).
Risk hotspots: (1) neu lam truoc RBAC-FIELDVIS-FIX se lap lai bug an field Public mac dinh cho 2
      entity nay -- da lam SAU, xac nhan qua test D13-035/D13-039 (viewer thay name/address mac
      dinh, chi membership_fee/service_fee_pct/deposit_pct bi an); (2) test file cu
      (integration-partners/suppliers/reminders.test.js) `call()` helper CHUA ho tro tham so `as`
      (chi co 1 cookie super_admin toan file) -- phat hien qua that bai test that (viewer/executor
      test tra ve nhu super_admin), sua ca 3 file them `as = cookie` vao `call()`.
Required tests: `integration-partners.test.js` D13-035..038, `integration-suppliers.test.js`
      D13-039..042, `integration-reminders.test.js` D13-043..045 -- moi entity: viewer thay field
      Public mac dinh + field mat an (chi organization/supplier co field mat, important_date
      khong), viewer PUT/DELETE 403, executor PUT 200 nhung DELETE 403 (Global khong bao gio xoa
      duoc), admin (target role D13) PUT+DELETE deu 200.
Allowed known-red/TODO: khong can.
Exit criteria: full regression (test:security, sqlite 733/8, mysql 740/1, verify-gate1-mapping,
      verify-g0.mjs, git diff --check) deu xanh; script xac nhan lai executor/viewer thay dung field
      tren organization/supplier (khong con bug RBAC-FIELDVIS-FIX).
Expected commit range/count: 1 commit.
```
