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

## Batch RBAC-EXP-B4 (2026-08-30)

```md
Batch-ID: RBAC-EXP-B4
Goal: batch 4/6 -- gan PolicyEngine cho 2 entity Direct (award, award_participation) + 1 entity
      Direct khac (event) + 1 entity Inherited (event_cost, ke thua owner_id cua event cha qua
      parentOwnerId -- lan dau service layer thuc su xai nhanh Inherited da co san trong engine tu
      G1B.1 nhung chua tung duoc policy-service.js/routes.js goi toi).
In scope: (a) `policy-service.js`: mo rong `assertWritable/prepareCreate/prepareUpdate/
      projectRecord` nhan them tham so `parentOwnerId` (optional, forward thang vao
      `policy.canWrite`/`policy.canReadField`) -- thay doi tuong thich nguoc, khong anh huong
      entity Direct/Global da wiring truoc do. (b) Schema: `award_participations`/`event_costs`
      CHUA TUNG co cot `created_by` that (chi duoc gan `owner_id` qua migration truoc, awards/
      events co san `created_by` tu luc CREATE TABLE) -- them `ALTER TABLE ... ADD COLUMN
      created_by INTEGER` cho 2 bang nay (KHONG them `owner_id` cho event_costs -- Inherited,
      khong tu co chu so huu rieng). (c) `award` (`GET/POST/PUT/DELETE /api/awards`,`/api/
      awards/:id`): GET dung `projectRecord()` che `cost` (Confidential); POST dung
      `prepareCreate()`; PUT dung `assertWritable()` theo owner_id; DELETE khong dieu kien owner
      (chi Admin/Super Admin). (d) `award_participation`: entity Direct RIENG (KHONG ke thua owner
      cua award cha -- D13.4a liet ke rieng trong nhom 14 Direct), CRUD tuong tu award; DELETE SUA
      DUNG tu map nham 'edit' (executor xoa duoc) sang 'delete' that (chi Admin/Super Admin). (e)
      `event` (`GET/POST/PUT/DELETE /api/events`,`/api/events/:id`): khong co field Confidential
      rieng cua chinh no nhung `total_cost`/`costs`/`totals` la tong hop tu event_costs (Inherited)
      nen van phai che theo `owner_id` cua CHINH EVENT o moi row -- dung `policy.canReadField()`
      truc tiep (khong qua `projectRecord()` vi day la truong tong hop, khong phai field tren
      chinh record). (f) `event_cost` (`POST/PUT/DELETE /api/events/:id/costs`(`/:cid`)): Inherited
      -- tra ve `owner_id` cua event cha lam `parentOwnerId`; POST dung action `create` cho dung
      thuc te (truoc batch nay map nham sang 'edit'); DELETE khong dieu kien owner (chi Admin/
      Super Admin, canWrite() chan action='delete' ngay tu dau bat ke Direct/Inherited).
      `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` them 12 route + `07-route-catalog.md`
      (R064-R069, R089-R094 va sua mo ta masking cua R062/R063/R087/R088) cap nhat theo mau da
      dung.
Out of scope: 8 Direct entity con lai (sponsorship/agreement/work_log/gift/association_fee/
      supplier_quote/supplier_transaction/supplier_contact/benefit_usage -- 9 thuc ra) -- batch
      RBAC-EXP-B5..B6 (nhom tam thoi, chua chot voi chu).
Behavior mode: TARGET-CHANGE tiep tuc dung mau owner_id-gate cua Direct (B3), lan dau ap dung cho
      Inherited that qua service layer (truoc chi co trong engine/unit test, chua co route nao
      goi that).
Risk hotspots: (1) `prepareCreate()` luon gan `created_by` khong dieu kien -- neu thieu cot se lam
      INSERT loi ngay lap tuc (khong phai loi tham lang) -- da phat hien truoc khi viet code qua
      doc schema (award_participations/event_costs thieu created_by that), fix bang migration
      TRUOC khi wiring, khong phai vua lam vua vaTM; (2) `event`/`event_cost` la truong hop DAU
      TIEN can phan biet "field Confidential tren CHINH record" (khong co, vi event khong co field
      mat) voi "truong tong hop tu bang con Inherited" (total_cost/costs/totals) -- neu dung
      `projectRecord()` cho ca object `row` cua event se KHONG che duoc total_cost (vi no khong
      phai field that trong `record`, ma la gia tri tinh rieng) -- da tranh bang cach goi
      `policy.canReadField()` truc tiep voi `parentOwnerId` cho rieng phan cost, KHONG boc toan bo
      event row qua projectRecord (khong can thiet, event khong co field mat nao); (3)
      `award_participation` la Direct RIENG khong phai Inherited tu award -- de nham thanh Inherited
      (ke thua owner cua award cha) vi no la "con" cua award ve mat UI/route path, nhung D13.4a da
      liet ke ro no thuoc nhom 14 Direct (co owner_id rieng qua migration) -- xac nhan lai bang
      D13-057 (owner_id cua participation la CHINH executor tao, khong phai owner cua award cha).
Required tests: `integration-awards.test.js` D13-052..058 (award: viewer POST 403, executor POST
      200 + owner_id dung + che cost theo owner, executor PUT nguoi khac 403/cua minh 200, executor
      DELETE luon 403 ke ca cua minh, viewer PUT/DELETE 403; award_participation: executor POST 200
      + owner_id dung rieng no KHONG phai cua award cha, executor DELETE luon 403, admin DELETE
      200); `integration-events-dashboard.test.js` D13-059..065 (event: viewer POST 403, executor
      POST 200 + owner_id dung, executor PUT nguoi khac 403/cua minh 200, executor DELETE luon 403,
      viewer PUT/DELETE 403; event_cost Inherited: executor tao cost cho event MINH so huu 200,
      cho event NGUOI KHAC so huu 403, executor thay amount/total_cost tren event minh so huu KHONG
      thay tren event nguoi khac, viewer khong bao gio thay amount, executor DELETE cost luon 403 ke
      ca tren event minh so huu, admin DELETE 200).
Allowed known-red/TODO: khong can.
Exit criteria: full regression (test:security 6/6, sqlite 754/8 skip, mysql 761/1 skip, mapping
      145/145, verify-g0.mjs PASS, git diff --check sach) deu xanh.
Expected commit range/count: 1 commit.
```

## Batch RBAC-EXP-B5 (2026-08-30)

```md
Batch-ID: RBAC-EXP-B5
Goal: batch 5/6 -- gan PolicyEngine cho 3 entity Direct nhom "nha cung cap con"
      (supplier_contact/supplier_transaction/supplier_quote), dung y het mau da lap lai 3 lan
      truoc (award_participation B4, booking/interaction B3) -- khong con rui ro thiet ke moi,
      chi con dung nghia entity/cot dung.
In scope: (a) Schema: `supplier_quotes`/`supplier_transactions`/`supplier_contacts` cung thieu
      `created_by` that (giong award_participations/event_costs o B4) -- them ALTER TABLE truoc
      khi wiring. (b) `GET /api/suppliers/:id`: quotes/transactions doi tu maskMoney/org_fee legacy
      sang `projectRecord()` (entity `supplier_quote`/`supplier_transaction`, che unit_price/value);
      contacts KHONG co field Confidential nen giu nguyen (chi can gate ghi/xoa). (c)
      `supplier_contact`/`supplier_transaction`/`supplier_quote`: CRUD owner_id-gate dung mau B3/
      B4; ca 3 DELETE deu SUA DUNG tu map nham 'edit' (executor xoa duoc) sang 'delete' that (chi
      Admin/Super Admin) -- dung y het pattern da lap lai o B4 cho award_participation/event_cost.
      `supplier_quote` khong co route PUT (CHARACTERIZATION co san, chi POST+DELETE) nen khong can
      wiring PUT. `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` them 8 route + `07-route-
      catalog.md` (R075-R080, R084-R085 va sua mo ta masking R074) cap nhat theo mau da dung.
Out of scope: 6 Direct entity con lai (sponsorship/agreement/work_log/gift/association_fee/
      benefit_usage) -- batch RBAC-EXP-B6 (batch cuoi cung cua ke hoach 6 batch).
Behavior mode: TARGET-CHANGE tiep tuc dung mau owner_id-gate cua Direct, khong co bien the thiet ke
      moi nao trong batch nay -- thuan tuy lap lai pattern da xac nhan dung o B3/B4.
Risk hotspots: (1) 3/3 DELETE deu tung map nham 'edit' (executor xoa duoc) -- giong dung 3 cho da
      sua o B4 (award_participation/event_cost) va tung o B3 (booking) -- xac nhan qua test rieng
      cho tung entity (D13-067/069/070: DELETE luon 403 cho executor ke ca ban ghi cua chinh minh);
      (2) `supplier_quote` khong co route PUT that -- khong nham tao ra PUT moi ngoai scope
      CHARACTERIZATION hien co.
Required tests: `integration-suppliers.test.js` D13-066 (viewer tao ca 3 loai deu 403), D13-067
      (supplier_contact: executor tao 200 + owner_id dung, PUT nguoi khac 403/cua minh 200, DELETE
      luon 403), D13-068+D13-069 (supplier_transaction: che value theo owner, PUT nguoi khac 403/
      cua minh 200, DELETE luon 403, admin DELETE 200), D13-070 (supplier_quote: che unit_price
      theo owner, DELETE luon 403, admin DELETE 200).
Allowed known-red/TODO: khong can.
Exit criteria: full regression (test:security 6/6, sqlite 759/8 skip, mysql 766/1 skip, mapping
      145/145, verify-g0.mjs PASS, git diff --check sach) deu xanh.
Expected commit range/count: 1 commit.
```

## Batch RBAC-EXP-B6 (2026-08-30) — BATCH CUOI CUNG, DONG 24/24 ENTITY

```md
Batch-ID: RBAC-EXP-B6
Goal: batch 6/6 (CUOI CUNG) -- gan PolicyEngine cho 6 entity Direct con lai (sponsorship,
      agreement, work_log, gift, association_fee, benefit_usage). Sau batch nay, TOAN BO 24 entity
      D13.4a da co PolicyEngine wiring that (10 truoc batch nay + 6 batch nay + person pilot +
      6 Module-admin-only + 3 Global + 1 Inherited = du 24, xem bang tong ket cuoi file nay).
In scope: (a) Schema: 6 bang nay cung thieu `created_by` that (giong 9 entity truoc o B4/B5) --
      them ALTER TABLE truoc khi wiring. (b) `GET /api/partners/:id`: sponsorships/fees/gifts doi
      tu rbac.maskList/org_fee legacy sang `projectRecord()` (che amount/amount/value theo owner-
      bypass); agreements/workLogs/benefitUsages KHONG co field Confidential nen giu nguyen query,
      chi can gate ghi/xoa rieng. (c) `gift` CAN THAN: `owner_id`/`owner_type` tren bang `gifts` la
      NGUOI/CO QUAN NHAN qua (nghiep vu), KHAC voi chu so huu RBAC -- PolicyEngine dung cot rieng
      `responsible_user_id` (da co san tu `ownerColumn('gift')` trong policy-service.js, khong can
      sua engine). (d) Ca 6 entity: CRUD owner_id-gate dung mau da lap lai o B3/B4/B5; TAT CA
      DELETE deu SUA DUNG tu map nham 'edit' (executor xoa duoc) sang 'delete' that (chi Admin/
      Super Admin) -- dung pattern da lap lai 3 lan truoc, khong con phat hien moi. `scripts/
      verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` them 18 route (R007-R012, R010-R015 nham tren --
      thuc te R007-R015, R018-R027 = 18 route) + `07-route-catalog.md` cap nhat.
Out of scope: khong con entity D13.4a nao chua wiring -- day la batch cuoi cung cua ke hoach 6
      batch owner da duyet 2026-08-30. Con lai ngoai scope PolicyEngine entity-wiring: UI-flow
      matrix SS B.2 (Codex lane), `policyService.prepareUpdate()` van chua duoc route nao goi that
      (routes van tu buildUpdate() sau assertWritable(), khong qua prepareUpdate) -- khong phai
      exit criterion cua RBAC-EXP-B1..B6, ghi nhan rieng neu can don sau.
Behavior mode: TARGET-CHANGE tiep tuc dung mau owner_id-gate cua Direct, khong co bien the thiet ke
      moi -- batch nay thuan tuy hoan tat dien bao phu, khong con quyet dinh kien truc nao moi.
Risk hotspots: (1) gift dung 2 cot khac nghia (`owner_id`=nguoi nhan, `responsible_user_id`=nhan
      vien phu trach) -- de nham lan neu doc luot qua code, xac nhan lai qua D13-075 (assert rieng
      ca 2 cot: `responsible_user_id`=executor tao, `owner_id`=id cua org nhan qua, KHAC nhau); (2)
      6/6 DELETE deu tung map nham 'edit' -- cung loai bug da sua 3 lan truoc (award_participation/
      event_cost B4, 3 entity supplier B5), xac nhan qua test rieng tung entity.
Required tests: `integration-partners.test.js` D13-071 (viewer tao ca 6 loai deu 403), D13-072
      (sponsorship: che amount theo owner, PUT/DELETE dung owner-gate), D13-073 (agreement),
      D13-074 (work_log), D13-075 (gift: xac nhan rieng 2 cot owner_id vs responsible_user_id +
      che value theo owner), D13-076 (association_fee: che amount theo owner), D13-077
      (benefit_usage) -- moi entity: executor tao 200 + owner_id/responsible_user_id dung, PUT
      nguoi khac 403/cua minh 200, DELETE (ke ca cua minh) luon 403, admin DELETE 200.
Allowed known-red/TODO: khong can.
Exit criteria: full regression (test:security 6/6, sqlite 766/8 skip, mysql 773/1 skip, mapping
      145/145, verify-g0.mjs PASS, git diff --check sach) deu xanh. TOAN BO 24/24 entity D13.4a co
      PolicyEngine wiring -- khong con batch RBAC-EXP-B* nao trong ke hoach 6 batch owner da duyet
      2026-08-30 (xem tong ket dien bao phu duoi day).
Expected commit range/count: 1 commit.

### Tong ket dien bao phu 24/24 entity D13.4a (hoan tat 2026-08-30 qua 6 batch RBAC-EXP-B1..B6)
- Global (4): person (pilot), organization, supplier, important_date.
- Module-admin-only (6): budget, scan_query, source, competitor, campaign, monitor_alert.
- Inherited (1): event_cost (ke thua owner_id cua event cha qua parentOwnerId).
- Direct (13): booking, interaction (B3); award, award_participation, event (B4); supplier_quote,
  supplier_transaction, supplier_contact (B5); sponsorship, agreement, work_log, gift,
  association_fee, benefit_usage (B6).
- Tong: 4+6+1+13 = 24. Khong con entity nao trong D13.4a chua co PolicyEngine wiring.
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

## Batch W1.POLICY.2 (2026-08-31) -- dong nhat choke point mask read cho list route + CI guard

```md
Batch-ID: W1.POLICY.2
Goal: sau khi bundle F15->RBAC-EXP-B6 duoc Codex dong (ACCEPTED WITH BACKLOG, remediation F21/F22
      commit `051a9f9`), ray soat CO HE THONG (khong doi phat hien tung cai) toan bo route GET
      dung entity co FIELD_TIER Confidential/Restricted, tim CHO nao con dung co che mask cu
      (rbac.maskList/senGroups, SUPERSEDED boi D13 -- 02-decisions.md hang O7) hoac KHONG mask gi
      ca -- dong nhat het qua `policyService.projectRecord()`, roadmap item co san (04-ROADMAP.md
      W1.POLICY.2) tu truoc batch F21/F22, chua lam vi uu tien P0/P1 truoc.
In scope: (a) `GET /api/partners` (list to chuc) + nested `people` trong `GET /api/partners/:id`:
      doi tu `rbac.maskList('organization'|'person', rows, senGroups(req))` sang
      `projectRecord()` -- truoc day list che membership_fee/bank_name theo `sensitive_perms`
      per-user (co che SUPERSEDED), khac han detail da dung projectRecord tu RBAC-EXP-B2, co the
      lo field Confidential qua sensitive_perms cu ma PolicyEngine khong cong nhan. (b) `GET
      /api/people` (list nhan su): tuong tu (a). (c) `GET /api/suppliers` (list NCC): truoc day
      KHONG mask GI CA (khac han GET /suppliers/:id da dung projectRecord tu RBAC-EXP-B2, D13-039)
      -- them projectRecord(). (d) `GET /api/budgets`: truoc day KHONG mask gi (viewer co
      reports:view nen thay het so tien budget.amount la Confidential) -- them projectRecord(),
      quyet dinh thiet ke: Confidential = Module-admin-only (chi Admin/Super Admin), KHONG phu
      thuoc quyen 'view' module -- nhat quan voi supplier.service_fee_pct/deposit_pct da lam o
      RBAC-EXP-B2, khong phai bug rieng cua budget. (e) Don rac: xoa han
      `senGroups/senVisible/canMoney/maskMoney` khoi `server/routes.js` (het call site that su sau
      (a)-(d)) + khoi `router.testables` export + xoa 2 unit test da mo coi (BR-VAL-018/019 trong
      `unit-validation-formatter.test.js`, khong con ham nao de test). (f) CI guard moi:
      `scripts/verify-g0.mjs#verifyNoLegacyMasking()` -- ban literal-substring 6 ten ham
      (rbac.maskList(/rbac.maskRecord(/maskMoney(/canMoney(/senGroups(/senVisible() bat ky dau
      trong `server/routes.js`, ngan tai phat sinh pattern nay ve sau (route moi lo qua neu ai dung
      lai co che cu). (g) `07-route-catalog.md` cap nhat mo ta mask cho R002/R003/R029/R050/R051/
      R072 + sua 1 ghi chu sai da cu (R051 tung ghi "KHONG gate -- F1", thuc te RBAC-EXP-B1 da gan
      moduleAdminOnlyGate tu truoc, xac nhan qua verify-g0.mjs#PILOT_INLINE_PERM_ROUTES truoc khi
      sua).
Out of scope: (1) P3 backlog cua F21 (attachment metadata/filename khong loc theo
      audience_visibility khi list file dinh kem) -- xem xet lai va XAC DINH day la THIET KE CO CHU
      DICH, khong phai bug, theo dung nguyen tac D13 "existence vs content" (02-decisions.md dong
      96: moi role >= Viewer thay SU TON TAI ban ghi + field public; rieng NOI DUNG/tai file moi
      gate) -- ghi WON'T-FIX vao 01-audit-findings.md, khong sua code. (2) W1.FILE P2 (upload chua
      gate owner_id) va toan bo W1.ADMIN -- batch rieng tiep theo, ngoai pham vi batch nay. (3)
      UI-flow matrix SS B.2 (Codex lane).
Behavior mode: TARGET-CHANGE cho (a)-(d) (viewer/executor tu "thay du field qua sensitive_perms cu"
      hoac "thay het khong mask" sang "chi thay field Public + field minh la owner", giong hanh vi
      detail route da co tu RBAC-EXP-B2/B6) -- day la SIET quyen xem, khong phai noi rong; (e)-(g)
      la don rac/tai lieu, khong doi hanh vi.
Risk hotspots: (1) nested `people` trong GET /partners/:id la collection long, de bo sot neu chi
      sua route top-level -- xac nhan rieng qua D13-082; (2) budget.amount: viewer CO
      reports:view (MATRIX) nhung VAN bi an vi Confidential la Module-admin-only doc lap voi
      quyen module -- co the gay nham lan "sao co quyen view ma van khong thay amount", ghi ro
      trong comment code + batch contract nay de tra loi neu Codex/nguoi sau hoi lai.
Required tests: `integration-partners.test.js` D13-081 (list che membership_fee), D13-082 (nested
      people che bank_name/phone_personal); `integration-people.test.js` D13-083 (list che
      bank_name/phone_personal); `integration-suppliers.test.js` D13-084 (list che
      service_fee_pct/deposit_pct); `integration-bookings-budgets.test.js` D13-085 (budget.amount
      an voi viewer du co reports:view, day du voi admin).
Allowed known-red/TODO: khong can.
Exit criteria: full regression (test:security 6/6, sqlite 781 total/773 pass/8 skip, mysql 781
      total/780 pass/1 skip, verify-gate1-mapping 145/145, verify-g0.mjs PASS bao gom
      verifyNoLegacyMasking, verify-g0-selftest 6/6, git diff --check sach) deu xanh.
Expected commit range/count: 1 commit.
```

## Batch W1.FILE-P2 (2026-08-31) -- gate upload attachment theo owner_id cho entity Direct

```md
Batch-ID: W1.FILE-P2
Goal: theo `/goal` "lam het cac van de cua W1" -- dong backlog P2 cua F21 da ghi trong
      `01-audit-findings.md`/`04-ROADMAP.md` hang `W1.FILE` tu batch F21/F22: upload file cho
      award/event/agreement/work_log (entity Direct, co owner_id) truoc day CHI gate tho theo role
      qua `requirePerm(module,'edit')`, khong kiem owner_id -- bat ky executor nao cung upload
      duoc vao ho so nguoi khac tao (khac han PUT/DELETE cua chinh entity da gate owner_id tu lau
      qua cac batch RBAC-EXP-B4/B6).
In scope: (a) `POST /awards/:id/files`: them fetch `existing` tu bang `awards` + goi
      `policyService.assertWritable({principal, entity:'award', action:'edit', record: existing})`
      truoc khi insert attachment -- giong het pattern `PUT /awards/:id` da dung. (b) `POST
      /events/:id/files`: tuong tu entity `event`. (c) `govFileUpload(ownerType)` (dung chung cho
      agreement/work_log) doi thanh `govFileUpload(entity, table)` -- them fetch record tu dung
      bang (`agreements`/`work_logs`) + `assertWritable()` truoc khi insert, giu nguyen logic insert
      con lai. (d) Bo `requirePerm(module,'edit')` khoi ca 4 khai bao route (assertWritable() da tu
      kiem du: viewer luon false, executor can owner_id dung, admin/super_admin luon true -- giong
      het cach PUT/DELETE cua 4 entity nay da lam). (e) `scripts/verify-g0.mjs
      #PILOT_INLINE_PERM_ROUTES` them 4 route moi (`POST /api/awards/:id/files`, `POST
      /api/events/:id/files`, `POST /api/agreements/:id/files`, `POST /api/work-logs/:id/files`)
      + `07-route-catalog.md` cap nhat R016/R017/R070/R095 sang mo ta "kiem INLINE" giong pattern
      da dung cho PUT/DELETE cua 4 entity nay.
Out of scope: (1) `POST /suppliers/:id/files` (owner_type='supplier', kind='quote') -- supplier la
      entity Global (khong co owner-bypass tren PUT/DELETE cua chinh no, executor sua duoc bat ke
      ai tao), nen gate tho theo role hien tai la DUNG thiet ke, khong phai backlog P2 -- da xac
      nhan qua doc entity classification (`GLOBAL` set trong policy-engine.js) truoc khi ket luan,
      khong tu suy dien. (2) toan bo W1.ADMIN -- batch rieng tiep theo.
Behavior mode: TARGET-CHANGE (SIET quyen) -- executor tu "upload duoc vao bat ky record nao" sang
      "chi upload duoc vao record minh la owner_id, hoac Admin/Super Admin luon duoc". Khong doi
      hanh vi cho Global entity (supplier) va khong doi hanh vi cho Admin/Super Admin/viewer.
Risk hotspots: (1) cac test CHARACTERIZATION cu (`R070 happy CHARACTERIZATION: award_id khong ton
      tai van 200`, `R016/R017 khong gui file nao van 400`) deu dung cookie admin mac dinh -- van
      PASS vi admin luon bypass owner check (isPrivileged), xac nhan lai bang full regression thay
      vi tu suy dien; (2) `govFileUpload` doi tu 1 tham so (`ownerType`) sang 2 (`entity, table`) --
      ca 2 call site (agreement/work_log) phai sua dong thoi, khong sot.
Required tests: `integration-awards.test.js` D13-089 (executor upload vao award nguoi khac tra
      403, truoc day 200); `integration-events-dashboard.test.js` D13-086 (executor upload vao
      event nguoi khac 403, vao event chinh minh 200, admin luon 200); `integration-partners.test.js`
      D13-087 (agreement, tuong tu D13-086), D13-088 (work_log, tuong tu).
Allowed known-red/TODO: khong can.
Exit criteria: full regression (test:security 6/6, sqlite 785 total/777 pass/8 skip, mysql 785
      total/784 pass/1 skip, verify-gate1-mapping 145/145, verify-g0.mjs PASS, verify-g0-selftest
      6/6, git diff --check sach) deu xanh. Dong backlog P2 cua `W1.FILE` trong
      `04-ROADMAP.md`/`01-audit-findings.md` §F21.
Expected commit range/count: 1 commit.
```

## Batch W1.POLICY.2-write-side (2026-08-31) -- dong phan WRITE con lai cua W1.POLICY.2

```md
Batch-ID: W1.POLICY.2-write-side
Goal: theo `/goal` "lam het cac van de cua W1" -- dong phan WRITE con lai cua roadmap item
      `W1.POLICY.2` (phan READ da dong o batch W1.POLICY.2 truoc). Truoc khi code, chay 1 audit
      doc lap (agent) quet TOAN BO route ghi (POST/PUT/DELETE) trong routes.js, doi chieu module
      khai o requirePerm() voi bang thuc su bi ghi -- tim dung loai loi ma "CI static rule cam raw
      SQL ghi field ngoai policy" (mo ta roadmap) muon chan.
In scope: (a) Audit tim ra 3 route that: `POST /partners/:id/fees/:fid/remind` (R028), `POST
      /awards/:id/remind` (R071), `POST /events/:id/remind` (R096) deu `INSERT INTO
      important_dates` nhung dang ky voi `requirePerm(<module cha>,'view')` thay vi
      `requirePerm('reminders','create')` nhu route chinh thong `POST /reminders` (R040) da dung
      dung. Risk that: vai tro `viewer` co `<module cha>:view` nhung KHONG co `reminders:create`
      (MATRIX) -- viewer van tao duoc important_dates qua loi tat nay, sai ranh gioi quyen. (b) Sua
      ca 3 route sang `requirePerm('reminders','create')` -- khong anh huong executor/admin/super_
      admin (da co san reminders:create). (c) CI guard moi
      `scripts/verify-g0.mjs#verifyImportantDatesGate()`: quet moi route co than ham chua `INSERT
      INTO important_dates`, bat buoc dang ky `requirePerm('reminders',*)` -- pham vi HEP co chu y
      (chi 1 bang, khong phai bo may tong quat map bang->module, tranh false-positive giong tinh
      than `verifyNoLegacyMasking()`). Da thu nghiem bang cach revert tam 1 route de xac nhan
      verifier bat duoc loi truoc khi coi la du. (d) `07-route-catalog.md` sua R028/R071/R096;
      `08-permission-matrix.md` Section A: chuyen 3 route nay tu partners/awards/events sang
      reminders (dem lai: partners 41->40, awards 12->11, events 11->10, reminders 12->15, tong
      van 145).
Out of scope: KHONG xay wrapper `authorizedInsert/Update` tong quat (phan con lai cua mo ta goc
      W1.POLICY.2 trong roadmap) -- audit doc lap xac nhan KHONG con write-bypass nao khac trong
      routes.js (10 nhom bypass goc cua F1 da dong het qua RBAC-EXP-B1..B6, moi route ghi deu co
      assertWritable/prepareCreate/prepareUpdate/moduleAdminOnlyGate/requirePerm dung truoc). Xay
      them 1 lop wrapper thuan kien truc, khong co bug cu the nao thuc day, la premature
      abstraction -- quyet dinh KHONG lam, ghi ro trong `01-audit-findings.md` §F23 thay vi am
      tham bo qua. Toan bo W1.ADMIN -- xem xet rieng.
Behavior mode: TARGET-CHANGE hep (SIET quyen) -- chi anh huong vai tro `viewer` tren dung 3 route
      nay, khong doi hanh vi cho executor/admin/super_admin.
Risk hotspots: doi module trong `requirePerm()` lam 3 route chuyen tu module partners/awards/
      events sang reminders trong `08-permission-matrix.md` Section A -- phai cap nhat CA danh
      sach route CUA CA 4 module lien quan (khong chi reminders) de giu dung nguyen tac "khong
      dung range che lap module khac" da ghi trong file do, va giu tong 145 khong doi -- xac nhan
      qua `node scripts/verify-g0.mjs` (Section A tu doi chieu catalog voi source) truoc khi coi la
      xong, khong tu suy dien dem tay.
Required tests: `integration-partners.test.js` D13-090, `integration-awards.test.js` D13-091,
      `integration-events-dashboard.test.js` D13-092 -- moi route: viewer tra 403 (truoc day 200),
      executor van 200 (khong regression).
Allowed known-red/TODO: khong can.
Exit criteria: full regression (test:security 6/6, sqlite 788 total/780 pass/8 skip, mysql 788
      total/787 pass/1 skip, verify-gate1-mapping 145/145, verify-g0.mjs PASS bao gom
      verifyImportantDatesGate moi, verify-g0-selftest 6/6, git diff --check sach) deu xanh.
Expected commit range/count: 1 commit.
```

## Batch W1.ADMIN (2026-08-31) -- dong sub-item cuoi cung cua W1 (backend/API-only)

```md
Batch-ID: W1.ADMIN
Goal: theo `/goal` "lam het cac van de cua W1" -- dong 3 muc con cua roadmap item `W1.ADMIN`:
      (a) expose `policy-visibility-store.js` (da co san, chua tung duoc goi qua HTTP) qua route
      that; (b) them nang luc gan lai owner cho ban ghi entity Direct (`prepareUpdate()` da co san
      logic `OWNER_TRANSFER_ADMIN_ONLY` tu batch RBAC truoc nhung KHONG route nao lot field owner
      qua `pick()` allowlist -- logic khong the goi toi trong thuc te); (c) ra soat role management
      -- xac nhan da xong san (khong can code moi).
In scope: (a) 2 route moi: `GET /admin/field-visibility` (requirePerm admin,view) doc
      `visibilityStore.isPublic()` theo `ALLOWED_FIELDS` allowlist (hien chi module `partners`, 22
      field); `PUT /admin/field-visibility` (requirePerm admin,edit) goi `visibilityStore.
      setPublic()` -- enforce D13.2b "chi siet khong noi" (chi duoc bat is_public=true cho field
      da la Public-tier theo `policy.classification()`, tra 400 FORBIDDEN_TIER neu khong). (b) 1
      route moi: `PUT /admin/records/:entity/:id/owner` (requirePerm admin,edit) voi
      `REASSIGNABLE_OWNER_TABLE` (14 entity Direct -> ten bang that), fetch ban ghi (404 neu khong
      co), validate owner_id la user active (400 neu khong), goi `policyService.prepareUpdate()`
      truoc khi UPDATE (defense-in-depth dung dang sau requirePerm coarser-grained). (c) Xac nhan
      `PUT /admin/users/:id` da co san D13.1 escalation protection (Admin khong sua duoc Admin-tro-
      len, chi Super Admin) -- khong can code them cho muc (c). (d) Cap nhat toan bo he thong tai
      lieu tu-verify lan dau tien them route MOI (khac cac batch truoc chi re-gate route co san):
      `07-route-catalog.md` (+R146/R147/R148, header 145->148), `08-permission-matrix.md` (Section
      A admin 5->8 route + tong 145->148; Section B them flow F035 + token moi `D-MISSING` cho
      route backend/API chua co UI -- KHONG dung `D-403` vi khong co man hinh nao de thieu trang
      403; 34->35 flow), `scripts/verify-g0.mjs` (8 hang so 145/34 -> 148/35),
      `scripts/verify-gate1-mapping.mjs` (2 hang so 145->148) + `gate1-test-mapping.md` (+R146/
      R147/R148 tro toi test that), `server/test/ui-characterization.test.js` (assertion 34/145 ->
      35/148), `memory-bank/16-coding-rules.md` va `memory-bank/README.md` (dem endpoint/route
      song hanh 145->148, 139/145->142/148 route co requirePerm).
Out of scope: KHONG dung UI cho 3 route moi -- UI/MDS thuoc lane Codex theo CLAUDE.md muc 6, chua
      duoc owner giao lai. Khong tu dung view/man hinh gia de "co bang chung D-LIST/D-EMBED" --
      token `D-MISSING` ghi trung thuc hien trang thay vi bia bang chung khong that.
Behavior mode: THEM MOI nang luc (khong doi hanh vi route cu). 2 route field-visibility va 1 route
      owner-reassignment la hoan toan moi, chi admin/super_admin goi toi duoc (requirePerm admin,*
      + prepareUpdate() defense-in-depth).
Risk hotspots: day la batch DAU TIEN trong toan bo session them route MOI thay vi re-gate route co
      san -- rui ro lon nhat la lam lech he thong tai lieu tu-verify (catalog/matrix/verify script/
      mapping deu hard-code tong so route+flow). Da ra soat va sua DU 6 diem: 07-route-catalog.md,
      08-permission-matrix.md (Section A + B.2 + B.3 legend), verify-g0.mjs, verify-gate1-
      mapping.mjs, gate1-test-mapping.md, server/test/ui-characterization.test.js -- xac nhan qua
      `node scripts/verify-g0.mjs` va `node scripts/verify-gate1-mapping.mjs` deu PASS truoc khi
      coi la xong, khong tu suy dien dem tay.
Required tests: `server/test/integration-auth-admin.test.js` R146 (happy/invalid module/
      unauthenticated/forbidden), R147 (happy siet full_name/invalid mo public bank_name Restricted
      D13.2b/unauthenticated/forbidden), R148 (happy gan lai owner booking/invalid entity la/invalid
      thieu owner_id/invalid owner_id user khong active/not-found id la/unauthenticated/forbidden)
      -- 15 test moi, ca sqlite lan mysql driver.
Allowed known-red/TODO: khong can.
Exit criteria: full regression (test:security 6/6, sqlite 803 total/795 pass/8 skip, mysql 803
      total/802 pass/1 skip, verify-gate1-mapping 148/148, verify-g0.mjs PASS toan bo 9 check, verify-
      g0-selftest 6/6, git diff --check sach) deu xanh. Sau batch nay, ra soat lai toan bo bang
      W1.* trong `04-ROADMAP.md` xac nhan khong con sub-item nao khac o trang thai mo -- neu dung,
      cong bo W1 DONG HOAN TOAN (thoa man `/goal` "lam het cac van de cua W1").
Expected commit range/count: 1 commit.
```
