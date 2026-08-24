# 08 — Ma trận Permission × Surface × Runtime (G0.4)

> **⚠ Đây là ma trận HIỆN TRẠNG (hệ 2 vai trò `super_admin`/`pr_staff` đang chạy trong code).** Sau owner-decision D13 (2026-08-24, `02-decisions.md` §D), hệ vai trò sẽ được **viết lại thành 4 cấp** (Viewer/Nhân viên thực thi/Admin/Super Admin) + visibility field-level cấu hình được + ownership (created_by/owner_id). **Ma trận ĐÍCH theo 4 vai trò sẽ được dựng khi W1.RBAC land** (`04-ROADMAP.md` Wave 1) — KHÔNG dựng lại lúc này, vì file này đúng vai trò documenting **current-state** để làm baseline characterization (Gate 1). Đọc file này để hiểu hệ ĐANG chạy; đọc `02-decisions.md` §D để hiểu hệ SẼ có.
>
> **Sửa lần 2 sau Codex re-audit round 2 (F1, vẫn FAIL/P0 MDS ở lần 1).** Lỗi lần 1 đã sửa đúng 1 phần (bỏ `N/A` cho admin, tách 5 trục runtime) nhưng vẫn **chưa machine-checkable**: dùng range liên tục che lấp route thật (`R038-R061` cho reminders "nuốt" luôn interactions/bookings/reports; `R096` gán chồng cả events và reminders), **lọt 9 route** (`R001,R046-R049,R097,R143-R145`) khỏi Section A, và `partners` vẫn ghi `N/A` cho OS-permission dù có 2 route upload file thật (`R016`,`R017`).
>
> **Nguyên tắc sửa lần này:** dùng **một phân hoạch (partition) DUY NHẤT** — theo `requirePerm(module,action)` thật đọc trực tiếp từ cột `auth` của `07-route-catalog.md` (không nhập tay lại, không suy đoán theo UI view) — cho **cả 3 section A/B/C**. Đã tự-verify tổng = 145, không trùng, không lọt (lệnh chạy lại được ở cuối §A).

## A. Role coverage theo module — partition từ `07-route-catalog.md`, đã tự-verify tổng = 145

Lệnh tự-verify (chạy lại được):
```bash
awk -F'|' 'NR>4 && $2 ~ /R[0-9]{3}/ {gsub(/^ +| +$/,"",$2); gsub(/^ +| +$/,"",$5); print $2","$5}' memory-bank/07-route-catalog.md
```

| Module | super_admin | pr_staff | Route ID (danh sách tường minh, KHÔNG dùng range che lấp module khác) | Đếm |
|---|---|---|---|---|
| partners | view/create/edit/delete | view/create/edit/delete (sensitive theo `sensitive_perms`) | R001-R036, R046-R049, R097 | 41 |
| reminders | view/create/edit/delete | view/create/edit/delete | R038,R039,R040,R041,R042,R057,R058,R059,R060,R061,R137,R138 | 12 |
| interactions | view/create/edit/delete | view/create/edit/delete | R043,R044,R045,R136 | 4 |
| reports | view | **[] — không có quyền nào** | R050,R051,R052,R053,R054,R055,R056 | 7 |
| awards | view/create/edit/delete | view/create/edit/delete | R062-R071, R139, R140 | 12 |
| suppliers | view/create/edit/delete | view/create/edit/delete | R072-R086 | 15 |
| events | view/create/edit/delete | view/create/edit/delete | R087-R096, R141 | 11 |
| admin | view/create/edit/delete | **[] — không có quyền nào** | R099-R103 | 5 |
| monitoring | view/create/edit/delete | view/create/edit/delete | R104-R135 | 32 |
| *(không thuộc module nào — đặc biệt)* | — | — | R037 (`requireAuth` only — file serving đa-owner), R098 (`requireAuth` only, dashboard), R142 (`requireAuth` only, ai/status), R143 (public, login), R144 (`requireAuth`, logout), R145 (`requireAuth`, me) | 6 |

**Tổng: 41+12+4+7+12+15+11+5+32+6 = 145.** Không route nào trùng 2 module (khác lỗi lần 1: `R096` chỉ thuộc `events`, không thuộc `reminders`; `R001/R046-R049/R097` thuộc `partners` — trước đây bị lọt hoàn toàn khỏi bảng).

> **Sửa cụ thể theo evidence Codex:** `R046-R049` (bookings) và `R097` (press-overview) dùng `requirePerm('partners', ...)` thật trong source (`server/routes.js:611,618,623,1148`), không phải route riêng biệt — nay đã gộp đúng vào `partners`. `R001` (assignable-users) cũng `partners:view` (`routes.js:82`).

## B. UI-state desktop — cùng partition với §A (không dùng grouping khác để tránh lệch)

> "403" cho `pr_staff`/role không có quyền module là trạng thái **PHẢI có evidence**, không được ghi `N/A` chỉ vì "không có route hợp lệ với role đó" — `N/A` chỉ hợp lệ khi module không tồn tại route GET nào để hiển thị (không áp dụng ở đây, mọi module đều có ít nhất 1 GET).

| Module | loading | empty | error | 403 (role không có quyền module) | masked (org_fee) |
|---|---|---|---|---|---|
| partners | có | có | có | UNVERIFIED — chưa có test tự động đóng vai role thiếu quyền | có (`maskList`, membership_fee) |
| reminders | có | có | UNVERIFIED | UNVERIFIED | N/A (không có cột tiền) |
| interactions | có | có | UNVERIFIED | UNVERIFIED | N/A |
| reports | có | UNVERIFIED | UNVERIFIED | **FAIL/MISSING** — `pr_staff` không có quyền `reports`, chưa test 403/access-denied state cho role đó (sửa lại: round 1 ghi `N/A`, SAI theo Codex — "chỉ super_admin gọi được" không phải lý do hợp lệ để bỏ qua việc phải tồn tại trạng thái 403 cho role bị chặn) | KHÔNG có — org_fee aggregate không check `canMoney` (F1-adjacent, lỗ hổng nếu owner cấp quyền `reports` cho `pr_staff` sau này) |
| awards | có | có | có | UNVERIFIED | có (ad-hoc `maskMoney`) |
| suppliers | có | có | có | UNVERIFIED | có (ad-hoc) |
| events | có | có | có | UNVERIFIED | có (ad-hoc) |
| admin | có | UNVERIFIED | UNVERIFIED | UNVERIFIED | N/A |
| monitoring | có | có | có | UNVERIFIED | N/A |
| dashboard (R098) | có | UNVERIFIED | có | N/A (không gate module — mọi role đăng nhập xem, xem N2) | N/A |

> "403" phần lớn UNVERIFIED (không phải N/A) vì chưa có test tự động đóng vai `pr_staff` gọi route bị chặn module — đưa vào G1A regression suite (Wave 1), không phải Gate 0. Riêng `reports` đã nâng từ `N/A` sai lên `FAIL/MISSING` theo đúng evidence Codex chỉ ra.

## C. Native surface × 5 trục feature-runtime — cùng partition, KHÔNG có ngoại lệ N/A giả

**Nguyên tắc chốt (MDS 2.0 P0, không đổi từ lần sửa 1):** native composition phải tồn tại cho **mọi module có ít nhất 1 role với quyền thật khác `[]`** — bao gồm `admin` (`super_admin` có quyền thật, `server/rbac.js:28-39`).

### C.1 — native_composition + lifecycle/deep-link/gesture/accessibility-OS (baseline đồng nhất, verify 1 lần cho toàn bộ)

**Trạng thái cho TOÀN BỘ 145 route, không có ngoại lệ:** `native_composition = FAIL/MISSING`; `lifecycle = FAIL/MISSING`; `deep_link = FAIL/MISSING`; `gesture = FAIL/MISSING`; `accessibility_os = FAIL/MISSING`. Lý do đồng nhất: **chưa có bất kỳ native shell nào được dựng (F5)** — baseline "0%", không phải placeholder hay N/A. Đây thỏa acceptance-experiment #1-2 của Codex ("parse toàn bộ R001-R145... assert mỗi route có mapping rõ ràng hoặc N/A+reason") vì rule áp dụng như nhau cho mọi route, không có route nào bị bỏ qua.

Việc dựng native thật (implementation) thuộc **Wave 4**, không phải Gate 0/1 — Gate 0/1 chỉ yêu cầu ma trận phản ánh đúng sự thật (không N/A giả), không yêu cầu đã dựng xong.

### C.2 — os_permission: khác nhau theo route, liệt kê tường minh (KHÔNG suy đoán theo module)

Nguồn: cột "upload/download" của `07-route-catalog.md`, lọc bằng lệnh tự-verify:
```bash
awk -F'|' 'NR>4 && $2 ~ /R[0-9]{3}/ {gsub(/^ +| +$/,"",$2); gsub(/^ +| +$/,"",$8); if ($8 ~ /^có/) print $2","$8}' memory-bank/07-route-catalog.md
```

| os_permission | Route ID | Lý do |
|---|---|---|
| **FAIL/MISSING (file picker)** | R016, R017 | Upload file agreement/work-log (`server/routes.js:243,254`) — thuộc module `partners`, **KHÔNG được ghi N/A** như bảng module-level lần 1 sai |
| **FAIL/MISSING (file picker)** | R034 | Upload attachment người (portrait/id_doc) |
| **FAIL/MISSING (file picker)** | R070, R139 | Upload file/award-doc (module `awards`) |
| **FAIL/MISSING (file picker)** | R086 | Upload file quote (module `suppliers`) |
| **FAIL/MISSING (file picker)** | R095, R141 | Upload file event/excel (module `events`) |
| **FAIL/MISSING (microphone)** | R136 | Voice-intake, cần consent OS mic — chặn thêm bởi O8 |
| **FAIL/MISSING (notification)** | R057, R058, R059, R060 | Domain reminder/notify — hiện chỉ poll trong-app, **chưa có OS push thật**; cần permission notification khi Wave 4 dựng native push |
| N/A (không có input OS-capability) | 132 route còn lại (145 − 8 file-picker − 1 mic − 4 notification) | Route không có upload/mic/notification — bao gồm mọi GET/list/detail, mọi write thuần dữ liệu, và các route xoá/download file (`R012,R015,R033,R036,R037,R061,R066,R083,R091` — server-side, không cần OS-permission phía client) |

**Sửa cụ thể partners (đúng lỗi Codex chỉ ra):** module `partners` KHÔNG còn ghi `N/A` đồng nhất — `R016`/`R017` (2 route upload file thật) đã tách riêng ở bảng trên là `FAIL/MISSING (file picker)`; 39 route còn lại của `partners` (không upload) là `N/A` đúng nghĩa.

### Exit gate G0.4 (v2, sau re-audit round 2)
- Section A: 145/145 route có module rõ ràng, tổng khớp, không trùng/lọt (tự-verify bằng lệnh awk ở trên).
- Section B: desktop-state theo cùng partition A; không còn ô `N/A` dùng để né sự thật thiếu evidence (`reports` 403 đã sửa từ N/A → FAIL/MISSING).
- Section C: native/lifecycle/deep-link/gesture/accessibility = FAIL/MISSING đồng nhất cho 145/145 (rule, không phải bảng thủ công dễ lọt); os_permission liệt kê tường minh theo route thật từ cột upload/download của catalog, `partners` không còn N/A giả.
- Cả 3 section join được vào `07-route-catalog.md` qua route ID, không có bảng nào tự phát sinh mapping riêng ngoài nguồn catalog.

## D. Role model drift (F11, tham chiếu, không đổi)
Code (`rbac.js:12-15`) chỉ có 2 role thật (`super_admin`, `pr_staff`). Banner login (`server/index.js:50-55`) quảng cáo tên vai trò (`truongphong`, `lanhdao`, `xem`) **không tồn tại trong seed** (`server/db.js:665-666` chỉ tạo `admin`+`chuyenvien`). Dọn banner thuộc W1.11, chờ O7.

## E. UNVERIFIED cần owner xác nhận (đưa vào G0.1 — không tự suy đoán)
1. `GET /dashboard` (R098) không có `requirePerm` module — chủ ý hay thiếu sót? (N2)
2. `R060`,`R057-R059`,`R116` dùng perm `view` cho action ghi (N1) — tách action `notify`/`ack` riêng, hay giữ nguyên vì rủi ro thấp?
3. `reports` (R050-R056) không check `canMoney` khi tính org_fee — an toàn hiện tại vì chỉ `super_admin` có quyền, sẽ hở nếu owner cấp quyền `reports` cho `pr_staff` (liên quan O1/O2).
