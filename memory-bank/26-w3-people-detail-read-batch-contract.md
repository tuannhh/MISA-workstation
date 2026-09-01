# 26 — Batch Contract: W3.PEOPLE (People Detail strangler pilot)

> **Status:** READ + WRITE + FILE + DELETE UI IMPLEMENTED / automated regression PASS; chờ authenticated visual review — 2026-09-01.
> Đây là strangler hẹp, không phải tuyên bố đã thay toàn bộ hồ sơ nhân sự.

## 1. Mục tiêu và phạm vi

Thay thế có kiểm soát **phần trình bày đọc** của hash `#person/:id` bằng Vue island dùng MDS, với hai composition độc lập:

- Desktop: page detail trong shell desktop hiện hữu.
- Native-Mobile: mini-app `.mds-mobile-app` là sibling của desktop shell; dùng `MMobileTopBar`, tab cuộn ngang, safe-area token và host adapter.

Nguồn dữ liệu duy nhất là `GET /api/people/:id` (R030). API đã chiếu field/file qua PolicyEngine nên UI không tự tính quyền hoặc khôi phục field bị server ẩn.

## 2. Rollout và giữ hành vi cũ

- Cờ host/staging `window.__MISA_UI_FEATURE_FLAGS__ = { peopleDetailRead: true }` mới kích hoạt island. Mặc định `false`.
- Chỉ trên `localhost`/`127.0.0.1`, visual harness có thể dùng `?uiPeoplePilot=1` và `?uiPeopleSurface=native`; đây là fake provider W2.5 dành cho test, không hoạt động trên deploy và không thay thế O3/AMIS bridge.
- Khi cờ tắt, hash tiếp tục chạy `VIEWS.person` legacy, gồm mọi thao tác R032–R037, gifts, interactions và bookings như trước.
- Khi host khai báo Native nhưng provider không hợp lệ/chưa có O3, UI hiển thị native error shell và **không** fallback sang desktop.
- Không dùng role, user-agent hoặc viewport để chọn surface. Server session/RBAC vẫn quyết định dữ liệu và 403.

## 3. Route × surface × role

| Route/flow | Desktop | Native-Mobile fake provider | Native AMIS thật | super_admin/admin | executor | viewer |
|---|---|---|---|---|---|---|
| R030/F005 People Detail — read | Vue MDS pilot, feature flag | Vue native composition, contract test | **UNVERIFIED — O3/W4.1** | projection server | projection server | projection server/403 native shell |
| R032 People Detail — update | Vue MDS compact form, feature flag | Vue native form riêng, contract test | **UNVERIFIED** | server PolicyEngine khi submit | server PolicyEngine khi submit | nút ẩn theo UX + server 403 |
| R033 delete | MDS confirm, feature flag | MDS confirm trong Native page | **UNVERIFIED** | server PolicyEngine khi submit | server PolicyEngine khi submit | không có UX action + server 403 |
| R034–R037 file | MDS attachment panel, feature flag | mount trong Native page riêng | **UNVERIFIED** | server PolicyEngine/file projection | server PolicyEngine/file projection | upload action ẩn + server 403 |

`viewer` không bị route UI điều hướng sang desktop; nếu API trả 403 thì native composition hiển thị error state. Quyền đọc chi tiết cuối cùng vẫn do backend trả về.

## 4. Runtime contract và giới hạn trung thực

- Back: Native gọi `adapter.goBack()`. Desktop quay về `#people`.
- Lifecycle foreground: reload qua adapter; viewport cập nhật safe area; deep link `people/:id` chỉ yêu cầu navigation rồi phải fetch/RBAC lại.
- Camera/file picker/mic: **N/A cho read-only batch**; UI không request capability.
- Accessibility device (Dynamic Type/Display Zoom, Font/Display size), notification/deep link và gesture trên AMIS thật: **UNVERIFIED**, phải thực hiện W4.1–W4.3 sau O3. Fake provider chỉ chứng minh contract code.

## 5. Exit criteria batch

1. Desktop và Native là hai cây page riêng, không co desktop bằng CSS.
2. Không làm mất chức năng write/file legacy khi pilot chưa bật.
3. UI hiển thị loading / 403 / 404 / lỗi kết nối trong đúng shell đã chọn.
4. Có unit/source contract `UI-PPL-001..004`, build UI và regression liên quan xanh.
5. Không đóng F5 hoặc tuyên bố Native production pass trước W4/O3.

## 6. Rollback

Tắt `peopleDetailRead` là rollback tức thời, không migration/schema/data. Có thể revert độc lập các file dưới `frontend/src/features/people/`, `frontend/src/components/mds/` và seam nhỏ trong `App.vue`/`public/app.js`.

## 7. Write.1 Desktop — trạng thái và ranh giới

- Form Desktop MDS dùng `MInput`/`MButton`, gọi `PUT /api/people/:id` (R032) khi người dùng bấm Lưu.
- `GET /api/me` chỉ dùng để quyết định có hiện nút “Chỉnh sửa” hay không. `PUT` vẫn luôn đi vào PolicyEngine; 403/validation từ server được hiển thị trong form.
- Form compact **chỉ** gửi 9 field công khai đã hiện trong form. Trường nhạy cảm không được API projection trả về không được dựng thành chuỗi rỗng rồi gửi ngược lại, tránh ghi đè dữ liệu ẩn.
- Native write dùng cây `PeopleEditFormMobile` riêng: top bar MDS, vùng form cuộn, footer Lưu ghim và safe-area bottom; Back/Hủy có draft phải xác nhận bỏ thay đổi. Khi app chuyển foreground trong lúc sửa, feature không reload tự động để không mất draft.
- File detail/upload/đặt ảnh chính/xóa (R034–R037) hiện dùng `PeopleAttachmentsPanel` chung dữ liệu nhưng được mount trong hai page composition riêng. Mọi preview/tải file dùng `/api/files/:id`; UI chỉ hiển thị mảng portraits/idDocs đã được server projection. Xóa bắt buộc dialog xác nhận. Khi cờ tắt, toàn bộ R032–R037 vẫn đi qua legacy không thay đổi.
- R033 xóa hồ sơ có dialog xác nhận ở cả Desktop và Native. UI chỉ gợi ý nút này cho admin/super_admin theo permission summary, nhưng request `DELETE /api/people/:id` vẫn bị PolicyEngine kiểm tra lại và lỗi 403 hiển thị tại chỗ.

## 8. Handoff write/file

Batch kế tiếp `W3.PEOPLE.WRITE-FILE` dùng `domain/people-write.mjs`: compact form chỉ có
allowlist UX; không có `owner_id`, role hoặc policy quyết định ở client. `createPeopleApi()` có
seam `getCurrentUser`/`update`/`upload`, nhưng UI gọi write/upload chỉ sau khi có composition
form MDS đầy đủ và test action/403 tương ứng. API server vẫn là nguồn quyền duy nhất.

## 9. Kiểm tra hồi quy legacy — tạo cơ quan đối tác (2026-09-01)

- Đã thao tác thật ở bản local hiện hành với cả **Cơ quan báo chí**, **Hiệp hội** và **Đối tác bộ ngành**: nút `+ Thêm` hiển thị với principal có `partners.create` và mở đúng form theo từng loại. Không gửi form tạo mới trong browser để tránh tạo dữ liệu demo; R004 đã chạy HTTP thật trên SQLite và MySQL.
- Test `UI-PARTNER-ADD-001` khóa lại nối dây legacy: bốn loại `press/association/gov/other` phải còn nút mở `orgForm(type,{})`, payload phải có `org_type` và tạo qua `POST /partners`.
- Vì vậy lỗi người dùng báo là **không tái hiện được trên HEAD local**. Khi xảy ra ở môi trường khác, cần đối chiếu commit/build đang chạy và quyền `partners.create`: thiếu quyền thì nút bị ẩn; nếu modal mở nhưng Lưu thất bại, thu thập status/message của `POST /api/partners` để tái hiện chính xác.
