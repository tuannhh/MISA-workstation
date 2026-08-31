# 08 — Ma trận Permission × Surface × Runtime (G0.4)

> **⚠ Đây là ma trận HIỆN TRẠNG (hệ 2 vai trò `super_admin`/`pr_staff` đang chạy trong code).** Sau owner-decision D13 (2026-08-24, `02-decisions.md` §D), hệ vai trò sẽ được **viết lại thành 4 cấp** (Viewer/Nhân viên thực thi/Admin/Super Admin) + visibility field-level cấu hình được + ownership (created_by/owner_id). **Ma trận ĐÍCH theo 4 vai trò sẽ được dựng khi W1.RBAC land** (`04-ROADMAP.md` Wave 1) — KHÔNG dựng lại lúc này, vì file này đúng vai trò documenting **current-state** để làm baseline characterization (Gate 1). Đọc file này để hiểu hệ ĐANG chạy; đọc `02-decisions.md` §D để hiểu hệ SẼ có.
>
> **Cập nhật 2026-08-30 (owner chốt bỏ hoàn toàn 2-role):** `server/rbac.js` KHÔNG còn `pr_staff`/2-role
> nữa — đã đổi thành đúng 4 vai trò D13 (`viewer/executor/admin/super_admin`); `pr_staff` được
> RENAME thành `executor` (owner xác nhận: PR staff hiện tại = Nhân viên thực thi), `admin`/`viewer`
> là 2 vai trò MỚI thêm vào `MATRIX` với cùng mức quyền thô (module,action) như `super_admin`/
> `executor` tương ứng (phân biệt Admin/Super Admin chi tiết hơn — nếu có — nằm ở tầng PolicyEngine
> D13, không phải ở MATRIX thô này). **2 cột "super_admin"/"pr_staff" ở bảng §A dưới đây vẫn đúng
> NỘI DUNG quyền (module→action) — chỉ tên cột đã đổi ý nghĩa**: đọc "super_admin" = super_admin,
> đọc "pr_staff" = executor (quyền y hệt, chỉ đổi tên). Bảng §B.2 (UI-flow theo role×device) VẪN
> giữ nguyên 2 cột role cũ — đây là phạm vi UI/characterization (Codex lane), CHƯA rebuild cho 4
> vai trò; việc đó là 1 batch UI riêng, không nằm trong phạm vi đổi role hệ backend lần này.
>
> **Sửa lần 2 sau Codex re-audit round 2 (F1, vẫn FAIL/P0 MDS ở lần 1).** Lỗi lần 1 đã sửa đúng 1 phần (bỏ `N/A` cho admin, tách 5 trục runtime) nhưng vẫn **chưa machine-checkable**: dùng range liên tục che lấp route thật (`R038-R061` cho reminders "nuốt" luôn interactions/bookings/reports; `R096` gán chồng cả events và reminders), **lọt 9 route** (`R001,R046-R049,R097,R143-R145`) khỏi Section A, và `partners` vẫn ghi `N/A` cho OS-permission dù có 2 route upload file thật (`R016`,`R017`).
>
> **Nguyên tắc bản hiện tại:** giữ hai view độc lập nhưng join được: §A là auth partition theo middleware source; §B là UI/business-flow partition; §C là runtime capability. Cả §A và §B đều phủ đúng 148/148 route, không trùng/lọt, được kiểm bằng `node scripts/verify-g0.mjs`.
>
> **Codex round 4, 2026-08-25:** C0.3 đã được thực hiện: 34 `flow_id`, bốn cột role/surface, state profiles Desktop, baseline Native-Mobile `FAIL/MISSING`, và host-capability tách khỏi OS permission. Trong lúc verify phát hiện thêm drift R144/R145: route được mount trực tiếp, R144 không có auth middleware còn R145 tự kiểm tra session trong handler; catalog/§A đã sửa đúng source.

## A. Role coverage theo module — partition từ `07-route-catalog.md`, đã tự-verify tổng = 148

Lệnh tự-verify (chạy lại được):
```bash
awk -F'|' 'NR>4 && $2 ~ /R[0-9]{3}/ {gsub(/^ +| +$/,"",$2); gsub(/^ +| +$/,"",$5); print $2","$5}' memory-bank/07-route-catalog.md
```

| Module | super_admin | pr_staff | Route ID (danh sách tường minh, KHÔNG dùng range che lấp module khác) | Đếm |
|---|---|---|---|---|
| partners | view/create/edit/delete | view/create/edit/delete (sensitive theo `sensitive_perms`) | R001-R027, R029-R036, R046-R049, R097 | 40 |
| reminders | view/create/edit/delete | view/create/edit/delete | R028,R038,R039,R040,R041,R042,R057,R058,R059,R060,R061,R071,R096,R137,R138 | 15 |
| interactions | view/create/edit/delete | view/create/edit/delete | R043,R044,R045,R136 | 4 |
| reports | view | **[] — không có quyền nào** | R050,R051,R052,R053,R054,R055,R056 | 7 |
| awards | view/create/edit/delete | view/create/edit/delete | R062-R070, R139, R140 | 11 |
| suppliers | view/create/edit/delete | view/create/edit/delete | R072-R086 | 15 |
| events | view/create/edit/delete | view/create/edit/delete | R087-R095, R141 | 10 |
| admin | view/create/edit/delete | **[] — không có quyền nào** | R099-R103, R146, R147, R148 | 8 |
| monitoring | view/create/edit/delete | view/create/edit/delete | R104-R135 | 32 |
| dashboard | view | view | R098 | 1 |
| *(không thuộc module nào — đặc biệt)* | — | — | R037 (`requireAuth` qua router — file serving đa-owner), R142 (`requireAuth` qua router, ai/status), R143 (public login), R144 (không auth middleware; logout destroy session nếu có), R145 (handler `auth.me` tự kiểm tra session) | 5 |

**Tổng: 40+15+4+7+11+15+10+8+32+1+5 = 148.** Không route nào trùng 2 module (khác lỗi lần 1: `R096` chỉ thuộc `events`, không thuộc `reminders`; `R001/R046-R049/R097` thuộc `partners` — trước đây bị lọt hoàn toàn khỏi bảng). **N2 ĐÃ SỬA (Wave 1, 2026-08-30):** `R098` tách khỏi hàng đặc biệt sang module `dashboard` riêng (`requirePerm('dashboard','view')`, cấp cho cả 2 role). **SỬA 2026-08-31 (batch `W1.POLICY.2 write-side`, F1-class module/action mismatch):** `R028`/`R071`/`R096` chuyển từ `partners`/`awards`/`events` (đều đang `view`) sang `reminders` (`create`) — cả 3 route ghi `important_dates` nhưng trước đây gate theo quyền `view` của module cha thay vì `reminders:create` thật, khiến `viewer` (không có `reminders:create`) vẫn tạo được nhắc lịch qua lối tắt này. Xem `01-audit-findings.md` §F23. **THÊM 2026-08-31 (batch `W1.ADMIN` backend): `R146`/`R147`/`R148`** — 3 route MỚI (`GET`/`PUT /admin/field-visibility`, `PUT /admin/records/:entity/:id/owner`), nâng tổng route từ 145 lên **148**.

> **Sửa cụ thể theo evidence Codex:** `R046-R049` (bookings) và `R097` (press-overview) dùng `requirePerm('partners', ...)` thật trong source (`server/routes.js:611,618,623,1148`), không phải route riêng biệt — nay đã gộp đúng vào `partners`. `R001` (assignable-users) cũng `partners:view` (`routes.js:82`).

## B. UI-flow matrix — view thứ hai, độc lập với auth partition §A

Section A trả lời “middleware hiện tại kiểm tra module nào”. Section B trả lời “người dùng đang làm luồng gì”. Hai view chỉ join qua `Route ID`; không dùng module permission để giả định rằng booking, press overview hay upload là cùng một UI.

### B.1 Quy ước trạng thái và action hiện tại

- Action: `V/C/E/D` = view/create/edit/delete; `ACK`, `RUN`, `AI`, `UPLOAD`, `DOWNLOAD`, `EXPORT` là side-effect/capability. Action trong bảng là **current-state**; N1 target sẽ thay action `view` đang bảo vệ side-effect bằng action tường minh ở Wave 1.
- `D-*` là profile Desktop ở B.2; `N-MISSING` là profile Native-Mobile ở B.3. Mỗi flow có đủ hai role hiện tại và hai surface qua bốn cột role/surface.
- `S0` = không có field mật trong response chính; `S1` = có mask/gate theo `sensitive_perms`; `S2` = tiền/file đang mask ad-hoc hoặc thiếu gate, thuộc F1/F9; `S3` = UI ẩn/hiện control bằng `can(module,action)`, nhưng chưa có access-denied page.
- `N/A` chỉ dùng khi trạng thái không có ý nghĩa với loại flow và luôn kèm lý do trong profile. Không dùng `N/A` để che surface hoặc capability chưa có.

### B.2 Route → business/UI flow (partition 148/148)

| Flow ID | Business/UI flow | Route IDs (mỗi ID đúng một flow) | Desktop `super_admin` | Desktop `pr_staff` | Native `super_admin` | Native `pr_staff` | Sensitive/disabled evidence |
|---|---|---|---|---|---|---|---|
| F001 | Đăng nhập, phiên và hồ sơ hiện tại | R143,R144,R145 | LOGIN/LOGOUT/ME · D-AUTH | LOGIN/LOGOUT/ME · D-AUTH | N-MISSING | N-MISSING | S0 |
| F002 | Bootstrap lookup/status dùng chung | R001,R142 | V · D-SYSTEM | V · D-SYSTEM | N-MISSING | N-MISSING | S0; caller chịu state |
| F003 | Dashboard tổng quan | R098 | V qua `dashboard:view` · D-DASH | V qua `dashboard:view` · D-DASH | N-MISSING | N-MISSING | S0; N2 ĐÃ SỬA (Wave 1, 2026-08-30) |
| F004 | Danh sách/tổng quan cơ quan báo chí | R002,R097 | V · D-LIST | V · D-LIST | N-MISSING | N-MISSING | S1/S2 (`membership_fee`) |
| F005 | Chi tiết và CRUD cơ quan | R003,R004,R005,R006 | V/C/E/D · D-DETAIL | V/C/E/D · D-DETAIL | N-MISSING | N-MISSING | S1/S2; S3 |
| F006 | Tài trợ cơ quan | R007,R008,R009 | C/E/D qua `partners:edit` · D-EMBED | C/E/D qua `partners:edit` · D-EMBED | N-MISSING | N-MISSING | S2; S3 |
| F007 | Thoả thuận và file thoả thuận | R010,R011,R012,R016 | C/E/D/UPLOAD · D-EMBED | C/E/D/UPLOAD · D-EMBED | N-MISSING | N-MISSING | S2 file; S3 |
| F008 | Nhật ký công việc và file | R013,R014,R015,R017 | C/E/D/UPLOAD · D-EMBED | C/E/D/UPLOAD · D-EMBED | N-MISSING | N-MISSING | S2 file; S3 |
| F009 | Quà tặng | R018,R019,R020,R021 | C/E/D · D-EMBED | C/E/D · D-EMBED | N-MISSING | N-MISSING | S2 (`value`); S3 |
| F010 | Sử dụng quyền lợi | R022,R023,R024 | C/E/D · D-EMBED | C/E/D · D-EMBED | N-MISSING | N-MISSING | S0; S3 |
| F011 | Hội phí và tạo nhắc phí | R025,R026,R027,R028 | C/E/D; REMIND hiện dùng V · D-EMBED | C/E/D; REMIND hiện dùng V · D-EMBED | N-MISSING | N-MISSING | S2 (`amount`); S3 |
| F012 | Danh bạ người và tạo mới | R029,R031 | V/C · D-LIST | V/C · D-LIST | N-MISSING | N-MISSING | S1; S3 |
| F013 | Chi tiết người và tệp định danh | R030,R032,R033,R034,R035,R036 | V/E/D/UPLOAD · D-DETAIL | V/E/D/UPLOAD · D-DETAIL | N-MISSING | N-MISSING | S1/S2; S3 |
| F014 | Tải tệp đính kèm dùng chung | R037 | DOWNLOAD · D-SYSTEM | DOWNLOAD · D-SYSTEM | N-MISSING | N-MISSING | S2: direct-ID gate thiếu org_fee |
| F015 | Danh sách/CRUD lịch nhắc | R038,R039,R040,R041,R042 | V/C/E/D · D-LIST | V/C/E/D · D-LIST | N-MISSING | N-MISSING | S0; S3 |
| F016 | Tìm entity, lịch sử và voice interaction | R043,R044,R045,R136 | V/C/AI · D-LIST | V/C/AI · D-LIST | N-MISSING | N-MISSING | S0; mic runtime ở C |
| F017 | Booking truyền thông | R046,R047,R048,R049 | V/C/E/D · D-LIST | V/C/E/D · D-LIST | N-MISSING | N-MISSING | S2; S3 |
| F018 | Ngân sách kỳ | R050,R051 | V/UPSERT hiện cùng `reports:view` · D-LIST | DENY · D-403 | N-MISSING | N-MISSING | S2; write dùng view hiện tại |
| F019 | Báo cáo tổng hợp | R052,R053,R054,R055,R056 | V · D-REPORT | DENY · D-403 | N-MISSING | N-MISSING | S2 aggregate/projection |
| F020 | Notification inbox, acknowledge và chạy nhắc | R057,R058,R059,R060 | V qua `reminders:view`, ACK qua `reminders:ack`, RUN qua `reminders:run` · D-LIST | V/ACK/RUN cùng phân quyền · D-LIST | N-MISSING | N-MISSING | S0; N1 ĐÃ SỬA (Wave 1, 2026-08-30) |
| F021 | Xuất lịch ICS | R061 | V/EXPORT · D-SYSTEM | V/EXPORT · D-SYSTEM | N-MISSING | N-MISSING | S0; host capability ở C |
| F022 | Giải thưởng, tham gia, file và AI | R062,R063,R064,R065,R066,R067,R068,R069,R070,R071,R139,R140 | V/C/E/D/UPLOAD/AI · D-LIST | V/C/E/D/UPLOAD/AI · D-LIST | N-MISSING | N-MISSING | S2; S3 |
| F023 | Nhà cung cấp, liên hệ, giao dịch, báo giá, file | R072,R073,R074,R075,R076,R077,R078,R079,R080,R081,R082,R083,R084,R085,R086 | V/C/E/D/UPLOAD · D-LIST | V/C/E/D/UPLOAD · D-LIST | N-MISSING | N-MISSING | S2; S3 |
| F024 | Sự kiện, chi phí, file, nhắc và AI import | R087,R088,R089,R090,R091,R092,R093,R094,R095,R096,R141 | V/C/E/D/UPLOAD/AI · D-LIST | V/C/E/D/UPLOAD/AI · D-LIST | N-MISSING | N-MISSING | S2; S3 |
| F025 | Quản trị người dùng | R099,R100,R101,R102 | V/C/E/D · D-LIST | DENY · D-403 | N-MISSING | N-MISSING | S0; 403 page FAIL |
| F026 | Audit log | R103 | V · D-LIST | DENY · D-403 | N-MISSING | N-MISSING | dữ liệu privileged; 403 page FAIL |
| F027 | Monitor dashboard, mentions và bulk actions | R104,R105,R106,R107,R108,R109 | V/E/D · D-LIST | V/E/D · D-LIST | N-MISSING | N-MISSING | S0; S3 |
| F028 | Scan, runs và AI intelligence | R110,R111,R112,R113 | V/C/AI · D-REPORT | V/C/AI · D-REPORT | N-MISSING | N-MISSING | S0; SSRF/AI findings riêng |
| F029 | Monitor settings và acknowledge alert | R114,R115,R116 | V/E qua `monitoring:view`, ACK qua `monitoring:ack` · D-EMBED | V/E/ACK cùng phân quyền · D-EMBED | N-MISSING | N-MISSING | S0; N1 ĐÃ SỬA (Wave 1, 2026-08-30) |
| F030 | Cấu hình scan query | R117,R118,R119,R120 | V/C/E/D · D-LIST | V/C/E/D · D-LIST | N-MISSING | N-MISSING | S0; S3 |
| F031 | Cấu hình nguồn tin | R121,R122,R123,R124 | V/C/E/D · D-LIST | V/C/E/D · D-LIST | N-MISSING | N-MISSING | S0; S3 |
| F032 | Cấu hình đối thủ | R125,R126,R127,R128 | V/C/E/D · D-LIST | V/C/E/D · D-LIST | N-MISSING | N-MISSING | S0; S3 |
| F033 | Chiến dịch monitor và đánh giá AI | R129,R130,R131,R132,R133,R134,R135 | V/C/E/D/AI · D-LIST | V/C/E/D/AI · D-LIST | N-MISSING | N-MISSING | S0; S3 |
| F034 | AI tạo nội dung/ảnh thiệp nhắc | R137,R138 | AI hiện dùng `reminders:view` · D-EMBED | AI hiện dùng `reminders:view` · D-EMBED | N-MISSING | N-MISSING | S0; action AI chưa tách |
| F035 | Cấu hình field-visibility & gán lại owner (W1.ADMIN, backend/API-only) | R146,R147,R148 | DENY · D-MISSING | DENY · D-MISSING | N-MISSING | N-MISSING | Mới 2026-08-31; chưa có UI (lane Codex, CLAUDE.md mục 6) |

### B.3 State profiles — mọi ô loading/empty/error/403 đều có status

| Profile | loading | empty | error | 403/access denied | Evidence hiện tại |
|---|---|---|---|---|---|
| D-AUTH | UNVERIFIED | N/A — form auth không phải collection | PASS cho login error | UNVERIFIED cho session hết hạn | `public/app.js` login flow; cần G1 UI characterization |
| D-DASH | PASS — global route loading | UNVERIFIED | PASS — global route catch | **FAIL/MISSING** — R098 nay có `requirePerm(dashboard,view)` (N2 ĐÃ SỬA) nhưng UI vẫn chưa render trang 403 riêng | `public/app.js:276-284` |
| D-LIST | PASS — global route loading | PARTIAL — bảng/pager về 0, chưa có empty-state MDS thống nhất | PASS — global route catch | **FAIL/MISSING** — hash router redirect về dashboard, không render 403 | `public/app.js:276-315` |
| D-DETAIL | PASS — global route loading | UNVERIFIED cho từng collection con | PASS — global route catch | **FAIL/MISSING** — redirect, không có 403 state | `public/app.js:276-284`; detail render riêng |
| D-EMBED | UNVERIFIED — phụ thuộc parent/detail | UNVERIFIED | UNVERIFIED — toast/inline/catch không đồng nhất | **FAIL/MISSING** — không có 403 component | embedded modal/section trong `public/app.js` |
| D-REPORT | PASS — global route loading | UNVERIFIED | PASS — global route catch | **FAIL/MISSING** — direct hash redirect, không có 403 state | `public/app.js:276-284` |
| D-SYSTEM | UNVERIFIED — caller sở hữu state | N/A — không có surface collection độc lập | UNVERIFIED — caller sở hữu error | **FAIL/MISSING** — không có access-denied surface chung | internal lookup/status/download caller |
| D-403 | N/A — request bị chặn trước flow | N/A — request bị chặn trước flow | N/A — không phải lỗi dữ liệu | **FAIL/MISSING** — current client redirect/ẩn nav, không có 403 page | `public/app.js:266,276-284` |
| D-MISSING | **FAIL/MISSING** | **FAIL/MISSING** | **FAIL/MISSING** | **FAIL/MISSING** | **Mới (2026-08-31, W1.ADMIN backend):** route backend/API thuần, CHƯA có màn hình Desktop nào — khác `D-403` (route đó CÓ UI nhưng thiếu trang 403). UI thuộc lane Codex theo `CLAUDE.md` mục 6, chưa được giao lại — không tự dựng UI để tránh phải điền `D-LIST`/`D-EMBED` giả không có bằng chứng thật |
| N-MISSING | **FAIL/MISSING** | **FAIL/MISSING** | **FAIL/MISSING** | **FAIL/MISSING** | Không có Native-Mobile composition cho bất kỳ role/flow nào (F5/P0 MDS) |

> Disabled/masked: Desktop hiện có `can(module,action)` để ẩn nav/nút ở một số nơi và có nhiều cơ chế mask song song. Đây là current evidence, **không** chứng minh chống direct request. Những flow gắn S1/S2 phải có test field-level và disabled/masked riêng ở G1; mọi flow D-403 phải có access-denied acceptance state khi slice UI được nâng cấp.

## C. Native/WebView runtime capability — tách host capability khỏi OS permission

### C.1 Baseline Native-Mobile áp dụng 148/148 route

| Trục | Current status | Target evidence trước khi PASS |
|---|---|---|
| Native-Mobile composition riêng | **FAIL/MISSING** | Cây trình bày mobile riêng trong AMIS WebView cho mọi flow/role |
| Lifecycle background/restore | **FAIL/MISSING** | device test resume/restore không mất hoặc ghi lặp state |
| Deep-link | **FAIL/MISSING** | contract + device test route hợp lệ/không hợp lệ/không quyền |
| Back/gesture | **FAIL/MISSING** | Android Back, iOS gesture, modal-stack và unsaved-change test |
| Accessibility OS | **FAIL/MISSING** | Dynamic Type/font scaling, screen reader, touch target và focus test |

### C.2 Capability theo route

| Capability | Route IDs | WebView-host capability | OS permission | Current decision/evidence |
|---|---|---|---|---|
| File/document picker | R016,R017,R034,R070,R086,R095,R139,R141 | **FAIL/MISSING** | **UNVERIFIED** — system picker có thể không cần broad storage permission; phải theo contract host/platform | 8 upload route từ catalog; không gộp thành N/A theo module |
| Camera capture | R034 | **FAIL/MISSING** | **UNVERIFIED** — cần camera permission nếu host cho chụp trực tiếp; N/A nếu chỉ system file picker | Chờ AMIS bridge contract |
| Download/share file | R037 | **FAIL/MISSING** | N/A — download/share sheet không mặc định yêu cầu storage permission | Cần bridge download/share contract và device test |
| Export/share ICS | R061 | **FAIL/MISSING** | N/A — share sheet/calendar handoff không đồng nghĩa quyền calendar write | Cần bridge share/open contract; nếu import trực tiếp calendar thì thêm permission riêng |
| Microphone/voice | R136 | **FAIL/MISSING** | **FAIL/MISSING** mic consent/runtime permission | O8 chỉ cho phép egress test tạm thời, không thay consent OS |
| Native notification/push | R057,R058,R059,R060 | **FAIL/MISSING** | **FAIL/MISSING** notification permission | Current chỉ in-app polling; chưa có push/host lifecycle |
| Server-side physical delete | R012,R015,R033,R036,R066,R083,R091 | N/A — server xử lý file, không phải host input | N/A — không cần OS permission client | Vẫn cần confirm/destructive UX, nhưng không phải runtime permission |
| Route còn lại | mọi ID không liệt kê ở trên | N/A — không yêu cầu capability chuyên biệt ngoài baseline C.1 | N/A — không có input OS đặc quyền đã biết | Nếu implementation thêm camera/location/calendar phải cập nhật matrix trước khi merge |

## D. Machine verification và exit C0.3

Chạy:

```bash
node scripts/verify-g0.mjs
```

Script phải xác nhận: catalog 148 unique; Section A phủ 148 unique; Section B.2 map 148 route đúng một flow; đủ 35 flow, mỗi flow có hai role × hai surface; Gemini/schema/error/link facts. Native vẫn `FAIL/MISSING` là kết quả audit đúng, không phải lỗi của script.

## E. Role model drift và quyết định đã đóng

- Code hiện tại chỉ có `super_admin`/`pr_staff` (`server/rbac.js:12-56`). D13 target bốn vai trò sẽ được triển khai/test ở W1; không trộn target role vào current-state matrix này.
- N1 và N2 đã owner APPROVED 2026-08-25 trong `02-decisions.md` §B.1. Bảng trên giữ action current-state để characterization, đồng thời ghi target tường minh.
- F1/F9 và F5 vẫn là finding mở: ma trận đầy đủ không biến hành vi thiếu an toàn hoặc Native-Mobile còn thiếu thành PASS.
