# 20 — G1A.6 UI characterization smoke

> **Mục đích:** tạo baseline kiểm chứng được cho mọi bề mặt UI hiện hữu trước các slice
> MDS/RBAC. Từ `green` trong tài liệu này chỉ có nghĩa evidence mô tả **đúng hiện trạng**;
> nó không có nghĩa ứng dụng đã đạt MISA Design System hoặc Native-Mobile.

## 1. Contract và phạm vi

- **In scope:** Vue shell, legacy UI `public/app.js`, 14 module desktop root, 34 business/UI
  flow và hai role đang tồn tại (`super_admin`, `pr_staff`).
- **Out of scope:** thay giao diện, cài Playwright, hoặc giả lập native host. Mỗi phần phải
  được làm trong slice Wave 3/4 có native composition/bridge contract thật.
- **Không đổi hành vi runtime:** batch chỉ thêm source-backed characterization test, mapping và
  evidence; không đụng UI/product code.
- **Nguồn truth về permission/surface:** [`08-permission-matrix.md`](08-permission-matrix.md)
  §B/C. Nguồn kiến trúc hybrid: [`12-frontend-architecture.md`](12-frontend-architecture.md).

## 2. Automated smoke

Chạy:

```bash
npm run test:ui-characterization
npm run test:verify-gate1-mapping
```

| Rule | Kiểm chứng | Ý nghĩa `green` |
|---|---|---|
| UI-CHAR-001 | 14 key `NAV` desktop có resolver `VIEWS` tương ứng | Không module desktop nào bị mất route khi refactor legacy app |
| UI-CHAR-002 | Vue tạo đủ mount point và chỉ nạp `/app.js` sau `nextTick()` | Khóa contract ghép Vue shell ↔ legacy DOM để slice sau đổi có chủ đích |
| UI-CHAR-003 | 34 flow map đúng 145 route, mỗi flow có hai cột `N-MISSING` | Ma trận không được lặng lẽ diễn giải Native-Mobile là PASS |
| UI-CHAR-004 | Compact đang là desktop responsive, không có native root/topbar/bottom-nav | Chặn “responsive = native” sai nghĩa MDS; F5 vẫn P0 |

Các rule được join trong [`gate1-test-mapping.md`](gate1-test-mapping.md), vì vậy verifier
sẽ fail nếu test file hoặc trạng thái mapping bị drift.

## 3. Runtime evidence — 2026-08-30

Kiểm tra trên server SQLite với `DATA_DIR` tạm (`/private/tmp/pr-g1a6-ui-smoke.*`), không dùng
`data/pr.db` hoặc `data/uploads` của workspace.

### Desktop

- Đăng nhập nhanh **Quản lý phòng / Toàn quyền** và mở đủ 14 hash root:
  `dashboard`, `press`, `association`, `gov`, `other`, `people`, `events`, `awards`,
  `suppliers`, `interactions`, `monitor`, `reminders`, `reports`, `admin`.
  Tất cả render heading tương ứng, không có lỗi UI hiển thị.
- Đăng nhập nhanh **Chuyên viên PR** và mở cùng danh sách. 12 module được phép render;
  `#reports` và `#admin` không có nav entry, direct hash đều resolve về `#dashboard`.
  Đây là hành vi current-state `D-403` (redirect/ẩn nav), **không** phải trang 403 đạt chuẩn.

### Compact 375×812

Ở cả hai role current-state, runtime có `.mds-app` + `.platform-header`, không có
`.mds-mobile-app` và không có native bottom navigation. Sidebar desktop được CSS ẩn dưới 600px
hoặc mở dạng drawer. Không có overflow ngang trong màn Dashboard rỗng đã kiểm tra; kết quả này
chỉ chứng minh responsive hiện tại không vỡ ở mẫu đó, **không** thay thế ma trận thiết bị/native
host của MDS.

## 4. Kết luận và đường đi tiếp

1. G1A.6 đóng **baseline characterization** sau khi full regression của batch xanh.
2. **F5 giữ nguyên `FAIL/MISSING` P0:** 34/34 flow × mọi role vẫn chưa có native composition.
   Không dùng G1A.6 để báo "MDS mobile pass" hoặc cho release native.
3. Wave 3 bắt đầu bằng People Detail theo strangler slice; mỗi slice thay legacy DOM bằng Desktop
   MDS và một native composition riêng. Wave 4.1-4.3 bổ sung host bridge, device/accessibility,
   lifecycle/deep-link/permission/Back evidence trước release Native-Mobile.
4. Khi một slice thêm native UI, thay UI-CHAR-004 bằng contract + runtime test **dương tính**
   (native root, host adapter, role/403, viewport và capability evidence), không xóa finding F5
   chỉ vì CSS responsive được cải thiện.
