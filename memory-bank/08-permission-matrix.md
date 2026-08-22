# 08 — Ma trận Permission × Surface × Runtime (G0.4)

> **Sửa sau Codex G0-audit (G0-A1, MDS P0 violation).** Lỗi cũ: (1) ma trận gộp theo module thay vì join theo route ID → không machine-checkable; (2) dòng `admin` ghi `Feature-runtime: N/A (không cần native cho admin theo MDS gate)` — **SAI theo MDS P0**: MDS 2.0 yêu cầu tồn tại native composition cho **mọi role có quyền thật**, không có ngoại lệ; `super_admin` có `admin:view/create/edit/delete` thật (`server/rbac.js:28-39`, không phải quyền rỗng), nên module `admin` **phải** có dòng native — không được ghi N/A; (3) 5 trục feature-runtime bị gộp vào 1 ô `UNVERIFIED` — Codex yêu cầu tách riêng từng trục vì mỗi trục có tiêu chí PASS khác nhau (permission OS ≠ deep-link ≠ gesture).
>
> Route-ID join key: mọi route ở đây trỏ tới `07-route-catalog.md` (145 dòng, R001-R145) — không lặp lại chi tiết route, chỉ tham chiếu ID.

## A. Role coverage theo module (nguồn: `server/rbac.js:12-55`)

| Module | super_admin | pr_staff | Route ID chính |
|---|---|---|---|
| partners | view/create/edit/delete | view/create/edit/delete (sensitive theo `sensitive_perms` per-user) | R002-R028 |
| people | view/create/edit/delete | view/create/edit/delete | R029-R037 |
| awards | view/create/edit/delete | view/create/edit/delete | R062-R071, R139, R140 |
| events | view/create/edit/delete | view/create/edit/delete | R087-R096, R141 |
| suppliers | view/create/edit/delete | view/create/edit/delete | R072-R086 |
| reminders | view/create/edit/delete | view/create/edit/delete | R038-R042, R057-R061, R096, R137, R138 |
| interactions | view/create/edit/delete | view/create/edit/delete | R043-R045, R136 |
| monitoring | view/create/edit/delete | view/create/edit/delete | R104-R135 |
| reports | view | **[] — không có quyền nào** | R050-R056 |
| admin | view/create/edit/delete | **[] — không có quyền nào** | R099-R103 |
| dashboard | (không có `requirePerm` module — mọi role đăng nhập xem, N2 UNVERIFIED chủ ý) | (như trên) | R098 |
| AI | gắn theo module cha (interactions/reminders/awards/events) | như trên | R136-R142 |

## B. UI-state desktop (`public/app.js`, characterization thủ công — chưa có test tự động)

| View | loading | empty | error | 403 | masked (org_fee) | Route ID |
|---|---|---|---|---|---|---|
| dashboard | có | UNVERIFIED | có | N/A (không gate module) | N/A | R098 |
| monitor | có | có | có | UNVERIFIED | N/A | R104-R135 |
| partner list/detail | có | có | có | UNVERIFIED | có (`maskList`, membership_fee) | R002-R028 |
| people list/detail | có | có | có | UNVERIFIED | có (contact/private/social/finance) | R029-R037 |
| reminders | có | có | UNVERIFIED | UNVERIFIED | N/A | R038-R061 |
| reports | có | UNVERIFIED | UNVERIFIED | N/A (chỉ super_admin) | KHÔNG có (org_fee aggregate không check `canMoney` — lỗ hổng nếu role mới thêm quyền reports) | R050-R056 |
| awards | có | có | có | UNVERIFIED | có (ad-hoc `maskMoney`) | R062-R071 |
| events | có | có | có | UNVERIFIED | có (ad-hoc) | R087-R096 |
| suppliers | có | có | có | UNVERIFIED | có (ad-hoc) | R072-R086 |
| interactions | có | có | UNVERIFIED | UNVERIFIED | N/A | R043-R045 |
| admin | có | UNVERIFIED | UNVERIFIED | UNVERIFIED | N/A | R099-R103 |

> "403" phần lớn UNVERIFIED vì chưa có test tự động đóng vai `pr_staff` gọi route bị chặn module — đưa vào G1A regression suite (Wave 1), không phải Gate 0.

## C. Native surface × 5 trục feature-runtime — SỬA THEO G0-A1, KHÔNG CÓ NGOẠI LỆ N/A

**Nguyên tắc chốt (MDS 2.0 P0):** native composition phải tồn tại cho **mọi module có ít nhất 1 role với quyền thật khác `[]`** — bao gồm `admin` (vì `super_admin` có quyền thật, không phải quyền rỗng như `reports`/`admin` phía `pr_staff`). Trạng thái hiện tại cho **toàn bộ** module là **`FAIL/MISSING`** (chưa dựng bất kỳ native composition nào, F5) — không phải `N/A`, không phải `UNVERIFIED`. `UNVERIFIED` chỉ dùng cho câu hỏi "cần đạt tiêu chí gì", không dùng để né việc phải có dòng.

| Module | Native composition tồn tại? | OS permission (camera/mic/file/notification) | Lifecycle (background/resume) | Deep-link | Gesture | Accessibility-OS |
|---|---|---|---|---|---|---|
| partners | **FAIL/MISSING** | N/A cho module này (không có input OS-permission) | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING |
| people | **FAIL/MISSING** | FAIL/MISSING (upload ảnh/giấy tờ cần camera+file, R034) | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING |
| awards | **FAIL/MISSING** | FAIL/MISSING (upload file R070, R139) | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING |
| events | **FAIL/MISSING** | FAIL/MISSING (upload file R095, R141) | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING |
| suppliers | **FAIL/MISSING** | FAIL/MISSING (upload file R086) | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING |
| reminders | **FAIL/MISSING** | FAIL/MISSING (notification OS cho reminder R057-R059) | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING |
| interactions | **FAIL/MISSING** | FAIL/MISSING (mic cho voice-intake R136 — chặn thêm bởi O8) | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING |
| monitoring | **FAIL/MISSING** | N/A cho module này | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING |
| reports | **FAIL/MISSING** | N/A cho module này | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING |
| **admin** | **FAIL/MISSING** — **KHÔNG được ghi N/A** (super_admin có quyền thật, `rbac.js:28-39`) | N/A cho module này | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING |
| dashboard | **FAIL/MISSING** | N/A cho module này | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING |
| AI (voice/text/image/excel) | **FAIL/MISSING** | FAIL/MISSING (mic R136, file R139/R141) | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING | FAIL/MISSING |

Ghi chú cột:
- **OS permission = N/A** chỉ khi module đó không có bất kỳ route nào yêu cầu camera/mic/file-picker/notification (partners/monitoring/reports/admin/dashboard đúng — xác nhận qua cột "upload/download" ở `07-route-catalog.md`, các module này không có route upload thật ngoài file-download qua R037 dùng chung).
- **Lifecycle/Deep-link/Gesture/Accessibility-OS** = `FAIL/MISSING` cho toàn bộ vì chưa có bất kỳ native shell nào tồn tại để đo — đây là baseline thật, không phải placeholder; test thật trên thiết bị là điều kiện Gate 3 (`production-compatibility-gate` skill), không phải Gate 0/1.
- Việc dựng native (implementation thật) **không phải Gate 0/1** — Gate 0/1 chỉ yêu cầu ma trận này phản ánh đúng sự thật (không N/A giả), việc dựng thật thuộc Wave 4 theo roadmap.

## D. Role model drift (F11, tham chiếu)
Code (`rbac.js:12-15`) chỉ có 2 role thật (`super_admin`, `pr_staff`). Banner login (`server/index.js:50-55`) quảng cáo tên vai trò (`truongphong`, `lanhdao`, `xem`) **không tồn tại trong seed** (`server/db.js:665-666` chỉ tạo `admin`+`chuyenvien`). Ma trận A/B/C ở trên phản ánh **code thật** (2 role), không phản ánh banner. Dọn banner thuộc W1.11, chờ O7.

## E. UNVERIFIED cần owner xác nhận (đưa vào G0.1 cùng 8 quyết định — không tự suy đoán)
1. `GET /dashboard` (R098) không có `requirePerm` module — chủ ý (dashboard chung mọi role) hay thiếu sót?
2. `POST /reminders/run` (R060), `/notifications/*/read` (R057-R059), `/monitor/alerts/:id/read` (R116) dùng perm `view` cho action ghi (N1) — cần tách action `notify`/`ack` riêng trong RBAC, hay giữ nguyên vì rủi ro thấp (chỉ semantics, không leak dữ liệu)?
3. `reports` aggregate (R050-R056) không check `canMoney` khi tính org_fee — hiện an toàn vì chỉ `super_admin` có quyền `reports`, nhưng sẽ hở nếu owner sau này cấp quyền `reports` cho `pr_staff` (liên quan O1/O2 org_fee model).

## Exit gate G0.4
Ma trận A (role) + B (UI-state) + C (native × 5 trục runtime) đều join được theo route ID vào `07-route-catalog.md`; không còn ô nào ghi `N/A` để né sự thật "chưa có native" (C đã sửa: mọi module, kể cả admin, ghi `FAIL/MISSING` tường minh); 5 trục runtime tách cột riêng, không gộp `UNVERIFIED` chung; 3 mục §E chuyển cho owner ở G0.1, không tự quyết.
