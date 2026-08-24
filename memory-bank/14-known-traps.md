# 14 — Bẫy kỹ thuật đã biết

> KHÁC audit findings (lỗi/rủi ro cần sửa, xem [`01-audit-findings.md`](01-audit-findings.md)) — đây là những điều **dễ hiểu sai hoặc dễ lặp lại lỗi nếu không biết trước**, dù bản thân không phải bug đang gây hại ngay. Đọc file này TRƯỚC khi sửa code liên quan.

## 1. `uploadAudio` dùng chung cho voice-intake VÀ award-extract file — không phải "upload âm thanh"

Tên biến `uploadAudio` (`server/uploads.js:40-43`) khiến người đọc nghĩ nó chỉ dùng cho ghi âm. Thực tế nó được gắn ở **2 route hoàn toàn khác nhau**:
- `POST /ai/interaction-voice` (`ai.js:48`, field `audio`) — đúng nghĩa gốc, ghi âm giọng nói.
- `POST /ai/award-extract` (`ai.js:160`, field `file`) — dùng để upload PDF/ảnh/văn bản thông báo giải thưởng, **không liên quan âm thanh**.

Cả 2 dùng chung 1 instance multer `memoryStorage()`, giới hạn 25MB, **không có `fileFilter`** — nghĩa là `award-extract` chấp nhận MIME tuỳ ý (không giới hạn ảnh/PDF như route khác dùng `upload` thường), rủi ro ghi ở N3/`06-threat-model.md`. Nếu cần thêm 1 route upload file mới cho AI, **đừng copy `uploadAudio` theo tên** — kiểm tra kỹ có cần giới hạn MIME hay không, đặt tên theo mục đích thật (vd tách riêng `uploadAiFile` không giới hạn kiểu).

## 2. `DB_CLIENT` mặc định là `mysql`, KHÔNG PHẢI `sqlite`

`server/db.js:15`: `String(process.env.DB_CLIENT || 'mysql')`. Trực giác thường nghĩ "không đặt biến môi trường = chạy engine nhẹ mặc định (SQLite)" — **ngược lại ở dự án này**. Chạy `npm start` hoặc `node server/index.js` mà không set `DB_CLIENT=sqlite` sẽ cố kết nối MySQL (mặc định `127.0.0.1:3306`, user/pass `pr_media`) và treo/lỗi nếu không có MySQL local đang chạy. Muốn test nhanh bằng SQLite phải **chủ động** `DB_CLIENT=sqlite npm start` (hoặc dùng script `npm run start:local` đã set sẵn). Bản memory-bank round 1 (đã sửa) từng ghi NGƯỢC lại default này — bằng chứng cho thấy đây thực sự dễ nhớ sai kể cả với người review kỹ.

## 3. `Atomics.wait` chỉ chạy trên nhánh MySQL — benchmark ở SQLite sẽ SAI hoàn toàn

`mysql-sync.js:63` dùng `Atomics.wait` (block đồng bộ main thread) cho MỌI query khi `DB_CLIENT=mysql`. Nhánh SQLite (`node:sqlite` `DatabaseSync`) **không đi qua cơ chế này** — gọi trực tiếp, không block theo cùng cách. Hệ quả: **benchmark hiệu năng chạy trên SQLite local sẽ nhanh hơn hẳn và không phản ánh hành vi production** (mỗi query MySQL khoá cả event loop tới khi xong hoặc timeout 30s — F7/D9). Bất kỳ ai đo latency/throughput phải pin `DB_CLIENT=mysql` — đo trên SQLite là đo nhầm môi trường, dễ kết luận sai "hệ thống chịu tải tốt".

## 4. Banner đăng nhập quảng cáo vai trò không tồn tại trong seed (F11)

`server/index.js:50-55` in ra console 5 tài khoản demo (`truongphong`, `lanhdao`, `xem` kèm `admin`/`chuyenvien`) và `README.md` liệt kê tương tự 5 role, nhưng `rbac.js:12-15` chỉ định nghĩa 2 role thật (`super_admin`, `pr_staff`) và `server/db.js:665-666` chỉ seed đúng 2 user (`admin`, `chuyenvien`). Nếu đọc banner/README mà không đọc `rbac.js`+`db.js`, sẽ tưởng hệ thống có 5 vai trò phân quyền chi tiết hơn thực tế — 3 role kia hiện **không đăng nhập được bằng bất kỳ cách nào** (không có user tương ứng trong DB seed sạch). Đừng dựa vào banner/README để hiểu RBAC — luôn đọc `server/rbac.js` trực tiếp.

## 5. `stripDisallowed` không đủ ở mọi route — client tưởng ghi thành công nhưng dữ liệu mật bị âm thầm bỏ (F1)

`stripDisallowed()` (`routes.js:59-65`) xoá field mật khỏi object trước khi ghi nếu user không đủ quyền nhóm đó — nhưng chỉ được gọi ở **2 route**: `PUT /partners/:id` (`routes.js:168`) và `PUT /people/:id` (`routes.js:394`). Mọi route CREATE (bao gồm `POST /partners`, `POST /people`) và toàn bộ route sponsorship/fee/gift/award/supplier/event liên quan tiền **không gọi hàm này** — user thiếu `org_fee` vẫn ghi/sửa được field tiền qua các route đó (ngược hoàn toàn với ý định che dữ liệu). Ở 2 route có gọi, hành vi cũng gây nhầm lẫn UX: server trả `200 {ok:true}` như ghi thành công, nhưng field mật đã bị lặng lẽ loại khỏi payload trước khi UPDATE — **client không có cách nào biết field đó không được lưu** trừ khi tự so sánh lại dữ liệu sau khi gọi GET. Khi thêm entity/route mới có field tiền, đừng copy pattern này — chờ `PolicyEngine` (D1) hoặc tối thiểu trả lỗi rõ ràng thay vì xoá âm thầm.

## 6. `CREATE INDEX` bị bỏ hoàn toàn trên nhánh MySQL — 21 index chỉ tồn tại ở SQLite

`mysql-sync.js:29`: `if (/^CREATE\s+INDEX/i.test(out)) return '';` — mọi `CREATE INDEX IF NOT EXISTS` trong `server/db.js` (21 dòng, liệt kê ở [`09-db-schema.md`](09-db-schema.md) §C) bị dịch thành chuỗi rỗng và không chạy khi `DB_CLIENT=mysql`. Ai kiểm tra query plan hoặc lo ngại hiệu năng trên SQLite local sẽ thấy các bảng CÓ index (vd `idx_mention_pub`, `idx_p_org`) — nhưng **production MySQL không có các index này**, chỉ có index ngầm từ `PRIMARY KEY`/`UNIQUE`. Nếu cần index thật trên MySQL, phải tạo tay qua migration/DDL riêng — sửa `db.js` sẽ KHÔNG có tác dụng trên production.

## 7. `translate()` chỉ nhận diện đúng 2 cú pháp `ON CONFLICT` cụ thể — upsert mới sẽ vỡ lặng lẽ trên MySQL, chạy OK trên SQLite

`mysql-sync.js:26-27` dùng regex khớp CHÍNH XÁC 2 câu `ON CONFLICT` đang có trong `db.js` (`app_meta` theo `` `key` ``, `budgets` theo `period`). Nếu thêm 1 upsert mới với cú pháp `ON CONFLICT(...)` khác (tên cột khác, nhiều cột khác), regex sẽ KHÔNG khớp → câu SQL giữ nguyên cú pháp SQLite khi gửi tới MySQL → lỗi cú pháp **chỉ xảy ra trên nhánh MySQL**, code chạy hoàn toàn bình thường khi test bằng `DB_CLIENT=sqlite`. Đây là bẫy "test pass local, vỡ production" kinh điển của lớp dịch DDL thủ công này.

## 8. `npm run seed` không tự set `DB_CLIENT` — dễ reseed nhầm engine đang cấu hình

Script `seed` trong `package.json` chỉ chạy `node server/db.js --reseed`, **không kèm** `DB_CLIENT=sqlite` như `start:local`. Nếu máy đang có `.env`/biến môi trường trỏ MySQL (mặc định, xem bẫy #2) và ai đó chạy `npm run seed` với ý định "reset dữ liệu mẫu SQLite", lệnh sẽ **xoá sạch + seed lại MySQL** đang trỏ tới (`dropAll()` xoá 22 bảng nghiệp vụ, xem `09-db-schema.md` §E). Luôn viết rõ `DB_CLIENT=sqlite npm run seed` khi ý định là SQLite, và kiểm tra biến môi trường hiện tại trước khi chạy `npm run seed` trên bất kỳ máy nào có thể trỏ tới DB thật.

## 9. `RESET_DB=1` xoá sạch dữ liệu khi khởi động server — không phải chỉ khi seed

Khác bẫy #8 (chỉ kích hoạt khi gọi `--reseed` tay), biến môi trường `RESET_DB=1` (`server/db.js:895-898`) kích hoạt `dropAll()` **ngay khi `node server/index.js` khởi động** (mọi lần deploy/restart trong khi biến còn đặt `=1`). Comment trong code (`db.js:894`) tự ghi rõ đây là "dùng để làm sạch dữ liệu trên môi trường live... sau đó gỡ về 0" — nghĩa là chính tác giả xác nhận đây là biến vận hành nguy hiểm có chủ đích, không phải chỉ dùng cho test. Đặt biến này rồi quên gỡ trước khi redeploy tiếp = mất dữ liệu production lần thứ 2.

## 10. Hằng số `MASK` định nghĩa độc lập ở 2 nơi — sửa 1 nơi mà quên nơi kia sẽ vỡ cơ chế nhận diện che dữ liệu ở client

Server (`rbac.js:95`) và client (`public/app.js:2`) đều định nghĩa `const MASK = '●●● (đã ẩn)'` — **cùng giá trị literal nhưng không import chung** (2 codebase riêng, không có module dùng lại). Toàn bộ logic client hiển thị icon khoá/style `.mask` (`val()`, `money()`, `valDate()` ở `app.js:31-39`) dựa vào so sánh chuỗi `v === MASK`. Nếu sau này đổi text mask ở server (`rbac.js:95`) mà quên đổi ở `app.js:2`, client sẽ hiển thị chuỗi mask mới như dữ liệu thật (không nhận ra là bị che) — lỗi hiển thị âm thầm, không có type-check hay test nào bắt được vì 2 file không liên kết qua code.

## 11. `POST /budgets` chỉ yêu cầu quyền `reports:view`, không phải `edit`/`create` — khác mọi route ghi khác

Mọi route ghi dữ liệu khác đều gate bằng `create`/`edit`/`delete` tương ứng hành động. `POST /budgets` (`routes.js:635`) lại gate bằng `requirePerm('reports', 'view')` — nghĩa là **bất kỳ role có quyền XEM báo cáo cũng ghi được ngân sách**, không cần quyền sửa riêng. Với ma trận hiện tại (chỉ `super_admin` có `reports`) chưa gây hở thật, nhưng nếu owner cấp quyền `reports:view` cho role mới (vd "Lãnh đạo — chỉ xem", O7) mà không biết bẫy này, role đó sẽ vô tình ghi được ngân sách — cùng nhóm rủi ro với ghi chú ở `08-permission-matrix.md` §E.3.

## 12. `notify_opt_in` tắt CẢ in-app lẫn email, không chỉ email như tên gợi ý

`scheduler.js:26-27`: `optedUsers = users.filter(u => u.notify_opt_in)` — lọc TRƯỚC khi tách kênh. Email còn cần thêm điều kiện có `email` + SMTP bật, nhưng **in-app cũng bị lọc bởi đúng cờ này**. Ai đọc tên cột `notify_opt_in` mà không đọc `scheduler.js` sẽ dễ tưởng đây là "chỉ tắt email" (giữ nhắc in-app) — thực tế tắt cả 2 kênh cùng lúc.

## 13. `pick()`/`buildUpdate()` bỏ qua field lạ và no-op khi rỗng — không báo lỗi

`pick(obj, allowed)` (`routes.js:22-26`) chỉ giữ field có trong mảng `XXX_COLS`; field client gửi lên nhưng không khai trong mảng bị loại **âm thầm, không lỗi, không log**. `buildUpdate()` (`routes.js:38-43`) nếu object rỗng sau `pick` (vd client gửi toàn field không được whitelist) thì `return` ngay, **không chạy UPDATE nào**, nhưng route vẫn trả `{ok:true}` như thành công. Khi thêm cột DB mới cho 1 entity, dễ quên thêm tên cột vào mảng `XXX_COLS` tương ứng — API vẫn chạy "bình thường" (không lỗi 500) nhưng field mới không bao giờ được ghi, rất khó phát hiện nếu không kiểm tra kỹ dữ liệu sau khi lưu.

## 14. `attachments.kind`/`owner_type` không có CHECK constraint — mỗi module tự quy ước riêng, dễ nhầm khi thêm chỗ mới

Bảng `attachments` dùng chung cho 6 owner_type (`person`, `agreement`, `work_log`, `award`, `supplier`, `event`) với `kind` mang ý nghĩa khác nhau tuỳ owner: `portrait`/`id_doc` (person), `file` (agreement/work_log), `award_doc` (award, cố định trong code), `quote` (supplier, cố định trong code), **tự do từ query string** (event — F9). Không có ràng buộc DB nào đảm bảo `kind` hợp lệ theo `owner_type` — thêm 1 module mới dùng `attachments` phải tự nhớ quy ước, không có gì ở schema nhắc hoặc chặn nếu viết sai.
