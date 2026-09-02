# 20 — G1A.6 UI characterization smoke

> **Mục đích:** tạo baseline kiểm chứng được cho mọi bề mặt UI hiện hữu trước các slice
> MDS/RBAC. Từ `green` trong tài liệu này chỉ có nghĩa evidence mô tả **đúng hiện trạng**;
> nó không có nghĩa ứng dụng đã đạt MISA Design System hoặc Native-Mobile.

## 1. Contract và phạm vi

- **In scope:** Vue shell, legacy UI `public/app.js`, 14 module desktop root, 35 business/UI
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
| UI-CHAR-003 | 35 flow map đúng 148 route, mỗi flow có hai cột `N-MISSING` | Ma trận không được lặng lẽ diễn giải Native-Mobile là PASS |
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
2. **F5 giữ nguyên `FAIL/MISSING` P0:** 35/35 flow × mọi role vẫn chưa có native composition
   (F035 thêm 2026-08-31 từ batch W1.ADMIN — route backend/API thuần, chưa có UI nào nên cũng
   chưa có native composition để đánh giá).
   Không dùng G1A.6 để báo "MDS mobile pass" hoặc cho release native.
3. Wave 3 bắt đầu bằng People Detail theo strangler slice; mỗi slice thay legacy DOM bằng Desktop
   MDS và một native composition riêng. Wave 4.1-4.3 bổ sung host bridge, device/accessibility,
   lifecycle/deep-link/permission/Back evidence trước release Native-Mobile.
4. Khi một slice thêm native UI, thay UI-CHAR-004 bằng contract + runtime test **dương tính**
   (native root, host adapter, role/403, viewport và capability evidence), không xóa finding F5
   chỉ vì CSS responsive được cải thiện.

## 5. W3.PEOPLE.READ pilot — 2026-09-01

`UI-CHAR-004` tiếp tục mô tả **legacy shell**; nó không được dùng để phủ định composition mới ở
`frontend/src/features/people/mobile/`. Pilot chi tiết People dùng feature flag host và có test
`UI-PPL-001..004`; evidence/giới hạn đầy đủ ở `26-w3-people-detail-read-batch-contract.md`.
Native host thật, thiết bị và accessibility OS vẫn UNVERIFIED tới O3/W4; F5 không thay đổi.

## 6. W3.VOICE — review native composition — 2026-09-02

- Voice review không tự chọn đồng thời person và organization. Khi có hơn một candidate, người dùng
  phải chọn **đúng một**; UI và R150 cùng từ chối selection thiếu hoặc mơ hồ trước khi tạo interaction.
- Runtime fake-native tại 390×844 xác nhận Back/Hủy đều cao-rộng tối thiểu 48px. Tại 320×700,
  `.mds-mobile-app` và document đều không có overflow ngang; input là 16px để tránh iOS auto-zoom.
- Bằng chứng tự động: `UI-VOICE-003` và `integration-voice-secure-command` (SQLite 16/16).
  Đây chỉ xác nhận browser fake provider. Permission mic, host Back/lifecycle, safe-area thực tế và
  accessibility OS vẫn cần bridge contract O3 + thiết bị thật ở Wave 4.

### W3.VOICE.2 — global entry contract-ready

- Các native slice đang hoạt động có entry `Giọng nói` cố định, nhưng chỉ sau `GET /api/me` xác nhận
  quyền `interactions:create`; lỗi mạng hoặc principal không rõ đều không render action.
- Entry truyền safe-area từ host adapter W2.5 và mở `#interactions?voice=1`, đưa người dùng thẳng
  vào review/upload. Nó **không** gọi microphone browser, không tự nhận identity từ host và không
  thay thế R149/R150. Direct link không có quyền dừng với `VOICE_FORBIDDEN`.
- Fake-native runtime: Events → Voice tại 390px, button 48px và không overflow. Host/device/mic
  thật vẫn `UNVERIFIED` tới O3/W4.

## 7. W3 native route lifecycle — 2026-09-02

- F31 ghi nhận lỗi state presentation thật: mỗi strangler slice có `ref` route riêng, chuỗi resolver
  hash short-circuit có thể không xoá slice cũ. Điều này có thể để nhiều `.mds-mobile-app` cùng nằm
  trên DOM khi chuyển màn hình liên tiếp.
- `App.vue` nay reset toàn bộ route ref trước khi resolver claim URL mới. `UI-CHAR-005` khóa contract
  này; fake-native 390×844 chạy tuần tự Events, Admin, Monitoring, Reports, Interactions, Awards,
  People, Person Detail, Partner Detail và Supplier Detail đều ghi nhận đúng một root visible và
  không overflow ngang.
- Kết quả chỉ xác nhận browser fake provider. Các kiểm thử lifecycle/Back/safe-area/accessibility
  trong AMIS WebView thật vẫn là W4, bị chặn bởi bridge contract O3.

## 8. W3.REMINDERS — Desktop/Native strangler pilot — 2026-09-02

- `#reminders` có Desktop MDS và Native composition riêng sau feature flag `remindersList` (local
  harness: `uiRemindersPilot=1`). Slice dùng R038-R042: xem tất cả/sắp tới, tạo, sửa và xóa; không
  đưa notification inbox, ICS hoặc AI thiệp vào một UI surface chưa có contract riêng.
- Domain payload chỉ allowlist tiêu đề/loại/ngày/lặp/báo trước/đối tượng/ghi chú. Generic form không
  nhận `subject_id`; tạo mới là `subject_type=general`, còn PUT giữ linkage entity có sẵn tại server.
  Action client chỉ là affordance từ `/api/me`; server tiếp tục PolicyEngine/permission authority.
- Runtime fake-native 390×844: route list và form create đều có đúng một `.mds-mobile-app`, topbar,
  buttons 48px, không overflow ngang. `UI-REM-001` khóa payload/permission/flag/composition. AMIS
  lifecycle, keyboard, safe-area thiết bị và accessibility OS vẫn `UNVERIFIED` tới O3/W4.

### W3.REMINDERS.NOTIFICATIONS — 2026-09-02

- Hộp thư nhắc có composition Desktop và Native, dùng R057-R059: tải projection riêng principal,
  đánh dấu từng thông báo hoặc tất cả đã đọc. Mở hộp thư **không** tự acknowledge như legacy bell;
  người dùng chọn action rõ ràng, action chỉ hiện khi `/api/me` có `reminders:ack`.
- Fake-native 390×844 mở/đóng hộp thư: đúng một root, topbar/action 48px, không overflow và không
  console error. Integration backend đã phủ principal/ack; UI contract `UI-REM-001` khóa client API
  và composition. R060 run scheduler, R061 ICS và R137-R138 AI card vẫn là scope riêng.

## 9. W3.MONITORING.SOURCES — 2026-09-02

- Dashboard nay dẫn đến Source Management Desktop/Native cho R123-R126. List chỉ render dữ liệu
  server trả; form chỉ gửi `name/url/type/enabled`, không gửi `mode`, `owner_id` hay action quét.
  URL client là dữ liệu chưa tin cậy: server giữ normalize HTTP, SSRF guard, RSS discovery và gate
  Module-admin-only.
- Runtime fake-native 390×844 với source thật từ API: list và form đều có một native root, button
  tối thiểu 48px, không overflow. `UI-MONITOR-002` khóa allowlist/gate/composition. Các surface
  mentions, query, competitor, campaign, scan và AI vẫn là slice riêng; AMIS device evidence chờ O3/W4.

## 10. W3.MONITORING.MENTIONS.READ — 2026-09-02

- Dashboard dẫn đến danh sách tin bài Desktop/Native qua R110. Browser chỉ truyền `page`, `search`,
  `category`, `sentiment`, `status`; máy chủ vẫn áp `monitoring:view`, lọc và projection.
- Đây là slice đọc/lọc có chủ đích: không gộp scan, xóa đơn/xóa hàng loạt hoặc cập nhật xử lý vào màn
  danh sách. Các mutation sẽ đi sau bằng flow review/permission riêng thay vì đặt thao tác rủi ro cạnh
  bộ lọc.
- `UI-MONITOR-003` khóa contract API và hai composition. Browser fake-native vẫn chỉ là evidence cấu
  trúc; lifecycle, deep link, accessibility OS và WebView AMIS thật tiếp tục `UNVERIFIED` đến O3/W4.
