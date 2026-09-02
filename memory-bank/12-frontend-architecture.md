# 12 — Kiến trúc giao diện (frontend)

> Nguồn: `frontend/src/App.vue`, `frontend/src/main.js`, `frontend/vite.config.mjs`, `public/app.js` (2.908 dòng tại audit 2026-09-02), `public/index.html`. Điều chưa xác minh được ghi `UNVERIFIED` — không suy đoán.

## A. 2 lớp frontend cùng tồn tại và cách chúng ghép lại

Có **2 hệ thống UI riêng biệt, không dùng chung state/component**, ghép lại bằng 1 cơ chế nạp script động — không phải Vue Router/SPA lồng nhau:

1. **Vue 3 shell + strangler routes** (`frontend/src/`) — build bằng Vite (`vite.config.mjs`), output thẳng vào `public/assets/vue-app.js` + `vue-app.css` (`emptyOutDir: false`). Ngoài khung đăng nhập/app và mount point legacy, `App.vue` hiện chọn feature Vue theo hash + feature flag + host surface tường minh; feature mới có `domain/`, `desktop/`, `mobile/` riêng. Legacy vẫn là fallback cho route chưa tách.
2. **Legacy SPA `public/app.js`** — thuần JavaScript (không module, không framework), tự làm routing (hash-based), tự render HTML string, tự quản lý toàn bộ nghiệp vụ (145 endpoint gọi qua `api()`), tự quản lý login/logout.

**Cách ghép nối**: `App.vue` mounted lifecycle (`onMounted`, `App.vue:47-54`) tạo 1 `<script src="/app.js" defer>` và `appendChild` vào `document.body` **sau khi** Vue đã render xong DOM khung (đợi 1 `nextTick()`). `app.js` sau đó tự query các phần tử DOM đã có sẵn (`$('#login')`, `$('#view')`…) và tự gắn toàn bộ event handler, tự gọi `GET /api/me` để quyết định hiển thị màn login hay app (`app.js:2886-2889`). **Vue không truyền prop/state gì cho `app.js`** — 2 lớp giao tiếp gián tiếp qua DOM (Vue tạo phần tử, app.js đọc/ghi `innerHTML`/`classList` của chính phần tử đó). **CSS cho `app.js` KHÔNG còn UNVERIFIED** (sửa lại — bản trước tự mâu thuẫn với §E dưới): nằm ở `public/styles.css`, nạp riêng qua `<link>` trong `public/index.html`, độc lập hoàn toàn khỏi `frontend/src/style.css`/`vue-app.css` — xem chi tiết §E.

`index.html` mount Vue vào `#root` (`main.js:7` `createApp(App).mount('#root')`) — cấu trúc HTML `#login`/`#app` nằm trong template của `App.vue`, được Vue render vào `#root` trước, rồi mới tới lượt `app.js` thao tác lên các phần tử con đó.

## B. Routing: 2 cơ chế riêng, không giao nhau

- Vue shell **không có router** — chỉ 1 component `App.vue`, không dùng `vue-router`. Trạng thái UI của shell (theme/density/sidebar mở-đóng/modal settings) là local `ref()` lưu vào `localStorage` (`App.vue:9-12,39-45`), không liên quan URL.
- `app.js` tự làm client-side routing bằng `location.hash` — object `VIEWS = {}` (`app.js:275`) được các khối code phía sau gán từng key (`VIEWS.dashboard = ...`, `VIEWS.partner = ...`…), hàm `route()` (`app.js:276` trở đi) đọc `location.hash`, tách `base` (phần trước `/` đầu tiên, vd `partner/12` → `partner`), tìm trong `NAV` để kiểm tra quyền (`can(navItem.mod, 'view')`) trước khi gọi `VIEWS[base](key)`. Điều hướng nội bộ chỉ là gán `location.hash = ...` (không dùng `history.pushState` trực tiếp, dựa vào cơ chế mặc định của URL hash).

## C. Pattern lặp lại trong `app.js`

Không có framework component, nhưng có 3 pattern hàm dùng lại nhất quán xuyên suốt mọi module nghiệp vụ:

1. **List pattern** — `renderTable({ head, title, desc, mod, ps, onSearch, rowsHtml, sensitiveNote, addLabel, searchPlaceholder })` (`app.js:290-315`): sinh khung bảng chuẩn (tiêu đề + nút "Thêm mới" nếu có quyền `create` + ô tìm kiếm debounce 300ms + bảng + phân trang). Mọi view danh sách (partners theo từng `org_type`, people, awards, suppliers, events, interactions, monitor mentions…) gọi hàm này, chỉ khác `head`/`rowsHtml` (HTML string tự build) và hàm `onSearch` gọi lại API tương ứng.
2. **Detail pattern** — mỗi entity có 1 hàm `xxxDetail()`/`renderXxx()` (vd `renderGovPartner()` `app.js:1186`) tự build HTML string lớn cho toàn bộ trang chi tiết (nhiều section/tab con), gắn event listener bằng cách query lại DOM sau khi set `innerHTML` (không có binding 2 chiều).
3. **Form pattern** — `openForm({ title, fields, save, note, draftKey })` (`app.js:2722-2830`) là modal form dùng chung cho **mọi** entity: nhận 1 mảng `fields` (mỗi field có `k` khoá, `l` label, `type` — `text`/`select`/`checks`/`list`/`money`/`textarea`/`static`, `opts`, `v` giá trị, `req` bắt buộc, `sens` đánh dấu "Dữ liệu mật", `full` chiếm hết chiều rộng), tự sinh input tương ứng, tự validate field `req`, và **tự động lưu draft vào `sessionStorage`** mỗi khi người dùng nhập (khoá theo `draftKey` hoặc `hash+title`) — khôi phục lại nếu mở form đó lần nữa trong cùng phiên trước khi lưu thành công. Mỗi entity có 1 hàm `xxxForm(r)` (vd `personForm()`, `awardForm()`, `eventForm()`…) chỉ có nhiệm vụ build mảng `fields` từ record `r`, rồi gọi `openForm()`.

Ngoài ra: `esc()`/`val()`/`money()`/`valDate()` (`app.js:28-38`) là các hàm format hiển thị dùng lại ở mọi bảng/detail — đặc biệt tự nhận diện giá trị `'●●● (đã ẩn)'` (hằng `MASK`, đồng bộ literal với `rbac.MASK` phía server, không import chung — 2 hằng số trùng giá trị nhưng định nghĩa độc lập ở 2 file, xem [`14-known-traps.md`](14-known-traps.md)) để bọc `<span class="mask">`.

## D. MDS (MISA Design System) — trạng thái thật

**Xác minh trực tiếp**: `grep -o 'mds-[a-z-]*' public/app.js` trả về **0 kết quả** — `app.js` không dùng bất kỳ class `mds-*` nào. Toàn bộ UI trong `app.js` (bảng, badge, modal, form field, chip, chart SVG tự vẽ) dùng class CSS riêng của dự án (`badge`, `b-green`/`b-blue`/`b-amber`/`b-gray`/`b-red`, `hbar-row`, `donut-wrap`, `chip`, `mask`, `field`, `modal-bg`…) — **không phải component MDS 2.0** dù `README.md` ghi "UI: Vue 3 + Tailwind CSS, token/component theo MISA Design System 2.0".

Phần THẬT sự tuân theo MDS là **chỉ lớp vỏ Vue shell** (`App.vue` + `frontend/src/assets/tokens/*.css` — token màu/khoảng cách/font theo 10 theme MDS chính thức, component `MIcon`/`MHeaderIconAva`/`MHeaderIconChat`) và commit `088fbb2` ("Fix icon chevron sidebar + control đúng chuẩn MDS") — phạm vi sửa chỉ ở khung header/sidebar/settings, không đụng `app.js`.

**Kết luận, đã gắn nhãn ước lượng (Codex round-3 re-audit, R3-02E — bản trước gọi "không suy đoán" nhưng ~5%/~95% chưa từng đo diện tích DOM thật, chỉ suy ra từ việc `app.js` có 0 class `mds-*`):** bằng chứng trực tiếp là `app.js` không dùng bất kỳ class MDS nào (mục D) và khung Vue shell có dùng MDS thật — từ đó **ước lượng** MDS hiện chỉ phủ một phần rất nhỏ diện tích UI thực tế (khung ngoài: header/sidebar/settings), còn phần lớn nội dung nghiệp vụ (mọi bảng/form/detail của 12 module) render bằng HTML-string tự viết, không đi qua bất kỳ component MDS nào — con số %/diện tích cụ thể **chưa đo**, không nên trích dẫn như số liệu chính xác. Đây chính là lý do cụ thể khiến quyết định **D4 (strangler theo vertical slice)** ở [`02-decisions.md`](02-decisions.md) là cách duy nhất khả thi để đưa MDS thật vào — big-bang rewrite 2.889 dòng HTML-string + toàn bộ 105 lời gọi `api()` đi kèm là rủi ro không chấp nhận được **kể cả với môi trường test hiện tại** (sửa lại: owner xác nhận 2026-08-24 dữ liệu Cloud Run hiện tại là dữ liệu TEST bỏ được, không phải "production đang sống" như bản trước ghi — xem `README.md` bối cảnh audit; rủi ro big-bang vẫn cao vì quy mô code, không phải vì dữ liệu sống). Slice đầu tiên đã chốt là **People Detail** (**D5**) — đúng entity có bề mặt dữ liệu mật lớn nhất (contact/private/social/finance/iddoc/org_fee), vì đây vừa là nơi rủi ro bảo mật cao nhất (F1) vừa là nơi cần kiểm chứng pattern "characterization test → extract → Desktop MDS → Native composition" trước khi nhân rộng ra 11 module còn lại.

## E. Native mobile — strangler composition, local acceptance (F5)

Legacy `app.js` chỉ responsive; không được diễn giải phần đó là native. Ngược lại, các feature đã strangler có composition mobile Vue riêng (`frontend/src/features/*/mobile/`) với `.mds-mobile-app`, `MMobileTopBar` và safe-area theo host adapter — không render desktop shell rồi co CSS. Owner duyệt Chrome local/fake-native mobile emulation làm evidence code/UI trong repo; host bridge/device AMIS là handoff DevOps sau build, xem [`31-o3-amis-bridge-acceptance.md`](31-o3-amis-bridge-acceptance.md). Browser local không được ghi là device-test thật.

CSS cho các class dùng trong `app.js` (`badge`, `hbar-*`, `modal-bg`, `field`, `chip`…) nằm ở `public/styles.css` — file CSS tĩnh riêng, độc lập với build Vite (`vue-app.css`), nạp trực tiếp qua `<link>` trong `public/index.html` (không qua Vite, không qua `frontend/src/style.css`). Đây là bằng chứng cụ thể thứ 2 (cùng với mục D) cho thấy `app.js` là 1 hệ thống UI tách biệt hoàn toàn khỏi pipeline Vue/MDS: có CSS riêng, JS riêng, không qua build step nào.

## F. UNVERIFIED

- Có hay không cơ chế cache-busting cho `/app.js`/`/styles.css` khi deploy bản mới (script tag không có query version, `App.vue:51` `legacy.src = '/app.js'`) — UNVERIFIED, có thể gây user load bản cache cũ sau redeploy.
