# 27 — Batch Contract: W3.PARTNER.READ + WRITE-CORE (Partner Detail strangler)

> **Status:** READ + WRITE-CORE + COOPERATION-CREATE/DELETE + AGREEMENT-EDIT IMPLEMENTED / local visual review PASS; chưa cutover sửa work-log/tệp hay Native production.

## 1. Mục tiêu và phạm vi

Chuyển phần **đọc an toàn** của hash `#partner/:id` sang Vue island MDS có hai composition riêng:

- Desktop: trang Detail trong shell hiện hữu.
- Native-Mobile: mini-app `.mds-mobile-app`, `MMobileTopBar`, tab cuộn ngang, safe-area qua W2.5 host adapter.

Nguồn đọc là `GET /api/partners/:id` (R003). Slice hiển thị record đã PolicyEngine projection, danh sách nhân sự đã projection, ngày nhắc, metadata MOU/lịch sử làm việc. Không có quyền/RBAC tự tính ở client.

## 2. Chủ ý không đưa vào batch read/write lõi

Các phần sau **giữ nguyên legacy** khi cờ `partnerDetailRead` tắt và chưa được coi là chuyển đổi khi cờ bật: nhân sự, hội phí, tài trợ, quà tặng, booking, sửa/xóa MOU/work log, tệp, tương tác. Chúng có route/field ownership khác nhau; gom vào read slice sẽ phá ranh giới PolicyEngine và làm rollback không còn hẹp.

`membership_fee` chỉ hiển thị nếu property đã xuất hiện trong `record` từ API. Client không có fallback mask/unmask hoặc request riêng để suy đoán dữ liệu Confidential.

**Write lõi (R005/R006):** Desktop/Native form chỉ gửi `name`, `website`, `address`; không gửi `org_type`, `membership_fee`, owner/role hay sub-resource. `GET /api/me` chỉ gợi ý action UX; `PUT`/`DELETE` vẫn do PolicyEngine kiểm tra. Mobile có draft-confirm khi Back/Hủy và không reload khi foreground trong lúc đang sửa.

**Cooperation create (R010/R013):** chỉ với `org_type='gov'`, UI Desktop/Native cho phép tạo MOU bằng `title`, `signed_date`, `valid_until`, hoặc ghi nhận làm việc bằng `category`, `work_date`, `topic` với trạng thái khởi tạo cố định `Đang xử lý`. Loại làm việc gồm đúng 4 lựa chọn dùng `MSelect` MDS; client không gửi `owner_id`, `files`, `terms`, `note`, `result`, `staff` hoặc status tùy ý. `GET /api/me` chỉ gợi ý nút; `policyService.prepareCreate()` vẫn là điểm quyết định quyền cuối cùng.

**Cooperation delete (R012/R015):** nút xoá chỉ gợi ý cho Admin/Super Admin có `partners.delete`, luôn qua `MDialog` danger và server `policyService.assertWritable(..., action:'delete')` quyết định lại. UI không diễn giải ownership Direct ở client. Sửa và tệp vẫn chưa thuộc batch này vì cần contract ownership/file-policy riêng.

**Agreement edit (R011):** model giữ `owner_id` chỉ để gợi ý UX: executor thấy Sửa khi owner trùng principal hiện tại, Admin/Super Admin thấy Sửa theo module permission. MOU form gửi đúng allowlist `title`, `signed_date`, `valid_until`, `terms`, `note`; không gửi owner/created-by/tệp. Máy chủ vẫn gọi `assertWritable()` và trả 403 nếu quyền bị thay đổi sau khi UI đã render. Work-log edit và mọi tệp chưa được claim.

## 3. Route × surface × role

| Route/flow | Desktop | Native fake provider | Native AMIS thật | viewer | executor | admin/super_admin |
|---|---|---|---|---|---|---|
| R003 Partner Detail — read | Vue MDS pilot | Vue native composition | **UNVERIFIED — O3/W4.1** | projection/403 từ server | projection/403 từ server | projection từ server, field Confidential chỉ khi server cho phép |
| R004–R006 core partner write/delete | Vue MDS pilot | Vue native composition | **UNVERIFIED — O3/W4.1** | server PolicyEngine | server PolicyEngine | server PolicyEngine |
| R010 create agreement / R013 create work log (`gov`) | Vue MDS form | Vue native composition | **UNVERIFIED — O3/W4.1** | server PolicyEngine/403 | server PolicyEngine/allow khi có `partners.create` | server PolicyEngine |
| R012/R015 delete MOU/work log (`gov`) | Vue MDS confirm | Vue native confirm | **UNVERIFIED — O3/W4.1** | server PolicyEngine/403 | server PolicyEngine/403 | server PolicyEngine + confirm |
| R011 edit agreement (`gov`) | Vue MDS form | Vue native form | **UNVERIFIED — O3/W4.1** | server PolicyEngine/403 | owner-only UX + server PolicyEngine | server PolicyEngine |
| R014 edit work-log, R016/R017 file sub-resources | Legacy, không claim | Legacy, không claim | N/A batch này | server PolicyEngine | server PolicyEngine | server PolicyEngine |

Native 403/404/lỗi mạng vẫn là native shell, không fallback Desktop. Cờ có default `false`; local harness `?uiPartnerPilot=1&uiPeopleSurface=native` chỉ hoạt động trên localhost/127.0.0.1, không thay thế AMIS bridge O3.

## 4. Exit criteria

1. Hai cây page Desktop/Native độc lập, không chọn shell theo UA/viewport/role.
2. View model không hiển thị trường nhạy cảm không có trong projection; person rows không đưa contact cá nhân.
3. Loading/403/404/network ở đúng shell; Back/deep link/lifecycle qua W2.5 adapter.
4. `UI-PAR-001..010`, build và regression xanh; rollback = tắt `partnerDetailRead`.
5. Không tuyên bố Native production pass trước O3/W4 device evidence.
