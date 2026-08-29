# 19 — G1C.1: khung E2E acceptance theo 4 vai trò (định nghĩa tại Gate 1, KHÔNG viết test thật)

> **Phạm vi tài liệu này:** đúng yêu cầu `04-ROADMAP.md` G1C.1 — "Journey đại diện cho mỗi vai trò
> ... sau khi W1/slice UI tương ứng xong — **không viết trước W1, chỉ định nghĩa khung ở Gate 1**".
> Đây là quyết định về **công cụ + quy ước + khung test skeleton**, không phải bản triển khai. Chưa
> có test thật nào chạy được vì: (a) hệ 4 vai trò D13 chưa tồn tại trong code (còn 2 role
> `super_admin`/`pr_staff` — xem `08-permission-matrix.md`), (b) Native-Mobile composition chưa tồn
> tại cho bất kỳ flow nào (F5, `FAIL/MISSING` toàn bộ). Exit criterion đúng của G1C.1 là **khung
> tồn tại và đúng chỗ nối**, không phải "test xanh" — test chỉ xanh sau khi Wave 1 (RBAC) + slice
> Wave 3 tương ứng hạ cánh (`04-ROADMAP.md` §Exit gate G1, mục d).

## 1. Vì sao Playwright (không phải Cypress hay tự viết)

Đã xem `frontend/src/` (Vue 3 shell, không có router, chỉ 1 `App.vue`) và `public/app.js` (SPA thuần,
tự route bằng `location.hash`, không framework — `12-frontend-architecture.md` §A/B). Không có bất
kỳ hạ tầng E2E nào trong repo hiện tại (đã `grep`/`find` xác nhận, không có `playwright`/`cypress`
trong `package.json` hay thư mục `e2e/`).

Lý do chọn Playwright cho khi bắt đầu viết test thật (sau Wave 1):

- **Multi-session/multi-context native** — cần thiết để test RBAC chéo vai trò (vd: Nhân viên thực
  thi A tạo bản ghi, xác nhận Nhân viên thực thi B không sửa được) mà không cần 2 trình duyệt thật.
- **Device emulation có sẵn** — trùng đúng ma trận viewport W4.2 đã chốt trong roadmap
  (375/393/412/768/1024, DPR, `prefers-color-scheme`), tái dùng được khi Native-Mobile composition
  (W4.1) hạ cánh, không cần công cụ khác cho phần đó.
- **`APIRequestContext`** — cho phép seed dữ liệu qua API thật (không phải mock DB) trong bước
  `beforeEach`, khớp cách `server/test-support/db-harness.js` đã seed cho integration test, giữ
  cùng triết lý "test qua đường thật, không mock tầng dưới".
- **Không phụ thuộc router cụ thể** — chờ `page.waitForURL()`/`page.waitForSelector()` hoạt động
  tốt với cả `location.hash` (routing hiện tại của `app.js`) lẫn router thật nếu Wave 3 đổi sang SPA
  router khi rewrite từng slice — không phải viết lại harness khi kiến trúc frontend đổi.

**Chưa cài đặt `@playwright/test` vào `package.json` ở bước này** — cài công cụ mới (kèm tải
browser binary ~500MB) là quyết định của người viết test thật đầu tiên (Wave 3, khi slice People
Detail có UI RBAC v2 để test), không phải việc của bước "định nghĩa khung". Tài liệu này chỉ khoá
lựa chọn công cụ + quy ước để không phải tranh luận lại.

## 2. Quy ước thư mục và đặt tên (áp dụng khi bắt đầu viết test thật)

```
e2e/
  playwright.config.js       # base URL, project theo viewport W4.2, timeout
  fixtures/
    roles.js                 # login helper theo 4 role D13 (viewer/executor/admin/super_admin)
  journeys/
    viewer.spec.js
    executor.spec.js
    admin.spec.js
    super-admin.spec.js
```

- Mỗi file `journeys/<role>.spec.js` chứa **đúng 1 journey đại diện** cho vai trò đó (không phải
  test suite đầy đủ mọi module — đây là acceptance layer, không phải regression layer; coverage
  chi tiết từng module đã có ở G1A/G1B).
- Mỗi journey có 2 khối: `test.describe('Desktop', ...)` và `test.describe('Native-Mobile', ...)`.
  Khối `Native-Mobile` **luôn bắt đầu bằng `test.fixme()` cho tới khi W4.1 hạ cánh** — ghi rõ lý do
  ngay trong code, không xoá khối mà chỉ để trống.
- `test_id` mỗi journey đặt tên `G1C-<ROLE>-01` để join được với `gate1-test-mapping.md` nếu sau
  này cần thêm cột acceptance-layer (chưa cần ở Gate 1 — G1A.9 verifier hiện chỉ bắt buộc phủ tầng
  route, không bắt buộc phủ tầng journey).

## 3. Bốn journey đại diện (nội dung, chưa phải code) theo đúng D13.1 (`02-decisions.md` §D)

Mỗi journey chọn đúng 1 kịch bản tối thiểu **chứng minh được ranh giới quyền đặc trưng nhất** của
vai trò đó theo D13.1 — không lặp lại toàn bộ CRUD (đã phủ ở G1A/G1B), chỉ chứng minh lớp acceptance
cuối cùng nhìn từ UI.

| Vai trò | Journey đại diện | Ranh giới phải chứng minh (D13.1) |
|---|---|---|
| **Viewer** | Đăng nhập → mở danh sách Người liên hệ (People) → mở 1 bản ghi chi tiết | Field `audience_visibility=private` bị ẩn/mask trên UI; không thấy nút Thêm/Sửa/Xoá ở bất kỳ đâu trên trang |
| **Nhân viên thực thi** | Đăng nhập → tạo mới 1 bản ghi (trở thành `owner`) → sửa được bản ghi đó → mở bản ghi **không phải mình `owner`** | Tự xem đầy đủ field trên bản ghi mình `owner` (kể cả field private); bị chặn nút Sửa và bị 403 khi cố gọi API sửa trực tiếp trên bản ghi người khác; không thấy nút Xoá ở bất kỳ đâu (D13.1: không có quyền delete) |
| **Admin** | Đăng nhập → gán lại `owner_id` một bản ghi cho người khác (màn Admin, W1.ADMIN) → xoá 1 bản ghi | Gán/gán lại owner thành công + ghi `audit_log`; xoá được (role Admin có delete); **không thấy** màn cấu hình API key hay `audit_log` viewer (giới hạn D13.1 của Admin, khác Super Admin) |
| **Super Admin** | Đăng nhập → mở màn `audit_log` → đổi vai trò 1 user khác → cấu hình API key | Cả 3 thao tác chỉ Super Admin mới thấy màn hình tương ứng; Admin thử truy cập trực tiếp route này phải 403 |

Journey không cố tình phủ Money/file visibility (D13.2/D13.3) hay resource-policy nhóm
Global/Module-admin-only (D13.4a) — 2 nhóm đó đã có unit test engine ở G1B.1/G1B.2
(`unit-policy-engine.test.js` D13-012..016); acceptance layer chỉ cần xác nhận UI **thật sự gọi
đúng PolicyEngine** qua đúng 1 đại diện mỗi vai trò, không lặp lại toàn bộ ma trận.

## 4. Khung skeleton mẫu (tham khảo khi viết test thật — KHÔNG phải file đã commit)

```js
// e2e/journeys/executor.spec.js — ví dụ hình dạng, viết thật khi W1.RBAC.2 + slice People Detail
// (Wave 3, People Detail là pilot slice — 02-decisions.md D5) đã hạ cánh cho vai trò này.
const { test, expect } = require('@playwright/test');
const { loginAs } = require('../fixtures/roles');

test.describe('G1C-EXECUTOR-01: Desktop', () => {
  test.beforeEach(async ({ page }) => {
    // TODO(Wave1/W1.RBAC.2): loginAs('executor') cần vai trò D13 tồn tại thật trong seed data.
    await loginAs(page, 'executor');
  });

  test('tự xem đầy đủ bản ghi mình owner, bị chặn sửa bản ghi người khác', async ({ page, request }) => {
    // TODO(Wave3/slice People Detail): thay bằng route thật khi PolicyEngine gắn vào People Detail
    // cho vai trò executor (hiện chỉ People Detail GET đã gắn — xem G1B.1 route-wiring note).
    test.fixme(true, 'chờ W1.RBAC.2 (4 vai trò) + slice People Detail executor edit hạ cánh');
  });
});

test.describe('G1C-EXECUTOR-01: Native-Mobile', () => {
  test('cùng journey trong WebView-host composition', async ({ page }) => {
    test.fixme(true, 'chờ W4.1 (WebView-host runtime) — Native-Mobile composition chưa tồn tại (F5)');
  });
});
```

## 5. Điều kiện để một journey chuyển từ `test.fixme()` sang test thật

Theo đúng cách G1B đã làm với known-red (`server/test-support/known-red.js` + allowlist) — nhưng
**không dùng chung cơ chế known-red** (known-red là cho unit/integration RED có chủ đích ở tầng
route; `test.fixme()` ở đây là "chưa tồn tại tính năng để test", 2 ngữ nghĩa khác nhau, không nên
gộp để tránh làm allowlist G1B phình sai mục đích):

1. Vai trò đó đã tồn tại thật trong seed data (`W1.RBAC.2`).
2. Slice Wave 3 tương ứng (chứa entity/route journey đó chạm vào) đã có Desktop MDS pass theo Exit
   mỗi slice (`04-ROADMAP.md` Wave 3).
3. Riêng khối `Native-Mobile`: thêm điều kiện W4.1 (WebView-host runtime + bridge contract).

Khi đủ điều kiện, thay `test.fixme(true, ...)` bằng bước thật, xoá TODO, và **chỉ khi đó** journey
mới tính vào exit criterion "G1C GREEN" của Wave tương ứng — không đánh dấu Gate 1 hay Wave nào
"hoàn tất" chỉ vì file skeleton đã tồn tại.

## 6. Không đưa vào CI `regression` ở bước này

`e2e/` chưa có trong bất kỳ npm script nào (`test:integration:sqlite`/`mysql` chỉ glob
`server/test/*.test.js`, không đụng `e2e/`) và **cố tình chưa thêm** `test:e2e` vào
`package.json`/`.github/workflows/regression.yml` — thêm script rỗng hoặc toàn `test.fixme()` vào
CI ngay bây giờ không chứng minh gì thêm ngoài việc file tồn tại, trong khi cài `@playwright/test`
thật (browser binary, thời gian cài đặt CI) nên làm cùng lúc với slice đầu tiên có test thật, tránh
CI phải tải một công cụ nặng chỉ để chạy toàn bộ 0 test.
