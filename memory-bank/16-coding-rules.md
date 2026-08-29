# 16 — Nguyên tắc & quy tắc đang thấy trong code

> **§A dưới đây là mô tả LEGACY/HIỆN TRẠNG** (rút ra bằng đọc `server/*.js`), không phải quy tắc lý tưởng nên có — bao gồm cả pattern không an toàn/không nhất quán, ghi lại để hiểu code cũ, KHÔNG phải để copy khi viết code mới. Khi có mâu thuẫn/không nhất quán, ghi rõ ra — không che giấu.
> **§B là quy tắc BẮT BUỘC cho code MỚI** (thêm theo yêu cầu Codex round-3 re-audit, mục "coding-rules chỉ mô tả, chưa có phần chuẩn mực" — R3-02F/C0.4.9) — tách rõ khỏi §A để không ai đọc nhầm "coding rules" là "được phép copy legacy pattern".
> Quy tắc chung của MISA (BackEnd.SKILL) không lặp lại ở đây, chỉ ghi đặc thù riêng của dự án này.

## §A. Quy tắc/pattern LEGACY — mô tả hiện trạng, không phải chuẩn cần theo

### 1. Đặt tên cột DB: `snake_case`, không ngoại lệ
Mọi cột trong `server/db.js` dùng `snake_case` (`membership_fee`, `phone_personal`, `org_id`…) — nhất quán 100% qua 34 bảng. Tên bảng cũng `snake_case`, số nhiều (`organizations`, `people` — ngoại lệ tự nhiên của tiếng Anh, `association_fees`).

### 2. Pattern ghi dữ liệu: `pick()` + `buildInsert()`/`buildUpdate()` — nhưng có ngoại lệ đã biết (F1)
Pattern chuẩn cho mọi entity CRUD nghiệp vụ (`routes.js:22-43`):
```js
const XXX_COLS = ['col1', 'col2', ...];          // whitelist field cho phép ghi
const data = pick(req.body, XXX_COLS);           // lọc field lạ, '' -> null
const r = buildInsert('table', data);            // hoặc buildUpdate('table', id, data)
```
Đếm được **20 lời gọi `buildInsert`, 22 lời gọi `buildUpdate`** trong `routes.js` theo pattern này — là cách ghi CHỦ ĐẠO. **Ngoại lệ raw SQL đã biết (F1)**:
- `POST /budgets` — raw `INSERT ... ON CONFLICT` (`routes.js:638-639`), không qua `buildInsert`.
- `PUT /admin/users/:id` — tự build câu `UPDATE` động theo field có mặt (`routes.js:1247-1256`), không dùng `pick`/`buildUpdate`.
- Insert `attachments` — luôn viết tay `db.prepare('INSERT INTO attachments...')` ở mỗi route upload (5 vị trí khác nhau: `routes.js:247-248, 429-438, 941-943, 1051, 1131`), không có 1 hàm `insertAttachment()` dùng chung dù logic gần giống nhau ở cả 5 nơi.
- Module giám sát truyền thông (`scan_queries`/`sources`/`competitors`/`campaigns`/`monitor_alerts`) đa số viết SQL tay trực tiếp (`db.prepare('INSERT INTO ...').run(...)`), không qua `pick`/`buildInsert` — lý do có thể là các trường JSON (`include`/`exclude`/`channels`/`keywords`) cần xử lý riêng (`jarr()`, `JSON.stringify`) trước khi ghi, nhưng kết quả là 2 style code ghi dữ liệu cùng tồn tại trong 1 file `routes.js` không có ranh giới rõ ràng khi nào dùng cách nào.

### 3. Mọi route nghiệp vụ đều qua `requirePerm(module, action)` — trừ 6 route có lý do cụ thể
`router.use(requireAuth)` áp dụng chung cho toàn bộ `routes.js`/`ai.js` (`routes.js:14`, `ai.js:13`) — bắt buộc đăng nhập. Trên nền đó, **139/145 route** thêm `requirePerm(module, action)` theo đúng module+hành động (xem [`07-route-catalog.md`](07-route-catalog.md) cột `auth`). 6 route chỉ dừng ở `requireAuth`, có lý do riêng từng route (không phải bỏ sót đồng loạt):
- `GET /files/:id` — không biết trước module vì phục vụ nhiều loại owner khác nhau, tự kiểm tra quyền theo `kind` bên trong (F1 root — kiểm tra không đủ với `org_fee`).
- `GET /dashboard` — chủ ý cho mọi role đăng nhập xem tổng quan (N2, UNVERIFIED có phải chủ ý hay thiếu sót — chờ owner).
- `GET /api/ai/status`, 3 route auth (`/login` public, `/logout`, `/me`) — không thuộc module nghiệp vụ nào.

### 4. Định dạng lỗi: `res.status(NNN).json({ error: '...' })` — đang chuyển sang envelope mới
100% route trong `routes.js`/`ai.js`/`auth.js` hiện trả lỗi theo dạng `{ error: 'Thông báo tiếng Việt' }` kèm status code (`400`/`401`/`403`/`404`/`409`/`422`/`429`/`500`/`502`). Đây LÀ pattern nhất quán thật đang chạy — không có route nào lệch khỏi shape này. Target envelope mới (field `message` là canonical, `error` giữ lại làm alias tương thích ngược) đã chốt ở [`05-error-contract.md`](05-error-contract.md) — CHƯA triển khai, mọi route hiện tại vẫn ở dạng cũ.

### 5. Message lỗi luôn viết bằng tiếng Việt, hướng người dùng cuối
Không có message lỗi tiếng Anh nào trong `routes.js`/`ai.js` gửi cho client (log console dùng tiếng Việt lẫn tiếng Anh, nhưng response luôn tiếng Việt) — nhất quán 100%. Message thường mô tả rõ hành động cần làm tiếp (`"Kỳ phải dạng YYYY-MM"`, `"Cần dán văn bản, nhập URL, hoặc tải lên file."`), không chỉ báo lỗi khô khan.

### 6. Response shape theo loại hành động — quy ước ngầm, không có type/schema ép buộc
- CREATE thành công → `{ id: lastInsertRowid }`.
- EDIT/DELETE thành công → `{ ok: true }` (không trả lại record).
- List có phân trang → `{ rows, total, page, pageSize, ...field riêng }`.
- List không phân trang → `{ rows }` (đơn giản, dùng cho danh mục nhỏ: suppliers/list, competitors, sources…).
- Detail → `{ record, ...mảng con liên quan }`.

Đây là quy ước tự nhất quán qua quan sát, **không có middleware/helper ép buộc shape** — mỗi route tự viết `res.json({...})`, dễ lệch nếu người viết mới không soi route tương tự trước khi viết route mới.

### 7. Audit log (`logEdit`) — áp dụng CHO PHẦN LỚN nhưng KHÔNG PHẢI mọi route ghi dữ liệu
`logEdit(req, action, entity, id, detail)` (`routes.js:44-47`) được gọi ở đa số route CREATE/EDIT/DELETE nghiệp vụ chính (partners, people, awards, events, suppliers, admin users, monitor scan/queries/sources/competitors/campaigns). **Không nhất quán ở các sub-resource nhỏ** — không gọi `logEdit` ở: `PUT`/`DELETE /partners/:id/fees/:fid` (`routes.js:308-315`), `POST`/`DELETE /suppliers/:id/quotes` (`routes.js:1042-1047`), `POST`/`PUT`/`DELETE /events/:id/costs` (`routes.js:1119-1128`), `PUT`/`DELETE /awards/:id/participations/:pid` (`routes.js:928-935`), `PUT`/`DELETE /suppliers/:id/transactions/:tid` chỉ audit ở PUT không ở DELETE (so sánh `routes.js:1018-1026`). Không có quy tắc rõ ràng phân biệt "sub-resource nào cần audit, cái nào không" — có vẻ là thiếu sót rải rác hơn là chủ ý, vì cùng loại sub-resource (vd fees POST có `logEdit` nhưng PUT/DELETE không).

### 8. Mask dữ liệu mật: 3 cơ chế song song, KHÔNG một chuẩn chung (F1, đã biết)
Quan sát trực tiếp trong `routes.js`, có **3 cách khác nhau** để che field tiền/mật trong response, tuỳ route:
1. `rbac.maskRecord()`/`rbac.maskList()` — theo registry `SENSITIVE_GROUPS` (chỉ áp dụng entity `organization`/`person`/`sponsorship`/`gift`).
2. `maskMoney(req, rows, ...fields)` (`routes.js:52-57`) — helper ad-hoc riêng của `routes.js`, gán thẳng `rbac.MASK` vào field chỉ định, dùng cho `bookings.amount`, `awards.cost`, `events.total_cost`, `supplier_quotes.unit_price`.
3. Map tay trực tiếp trong route handler (không qua helper nào) — vd `fees.amount` (`routes.js:145`), `supplier_transactions.value` (`routes.js:989`), `events.totals.*` (gán cả object thành chuỗi mask, `routes.js:1094`).

Không có 1 điểm chốt (choke point) duy nhất — quyết định D1 (PolicyEngine 1 nơi duy nhất) ở [`02-decisions.md`](02-decisions.md) chính là để dọn 3 cách này về 1.

### 9. Timezone: GMT+7 luôn tính tay bằng cộng `7 * 3600 * 1000` — KHÔNG dùng `Intl`/`Date` timezone-aware nhất quán
Mọi nơi cần "hôm nay theo giờ Hà Nội" đều viết `new Date(Date.now() + 7 * 3600 * 1000)` rồi tự đọc `getUTCFullYear()/getUTCMonth()/getUTCDate()` — lặp lại độc lập ở ít nhất 4 file: `routes.js` (`todayGMT7`-tương-tự trong `deadlineInfo`, dashboard), `monitor.js:18-21` (`ymdGMT7`), `scheduler.js:5-7` (`todayGMT7`), `ai.js:16-18` (`todayGMT7`). **Ngoại lệ duy nhất dùng `Intl.DateTimeFormat` timezone-aware thật**: `public/app.js:60-67` (`fmtDateTime`, hiển thị datetime cho người dùng). Đây KHÔNG phải bug (cộng giờ tay cho ngày `YYYY-MM-DD` là đủ đúng vì không có giờ/phút), nhưng là 1 pattern lặp lại 4 lần độc lập không tái sử dụng — thêm 1 nơi tính "hôm nay GMT+7" mới nên tự hỏi có nên gom vào 1 helper chung hay tiếp tục lặp theo đúng phong cách hiện tại.

### 10. Tiền lưu `INTEGER` (đơn vị đồng, không có số lẻ) — không dùng `DECIMAL`/cents
Toàn bộ cột tiền (`membership_fee`, `amount`, `cost`, `budget`, `value`, `unit_price`) khai `INTEGER` — lưu trực tiếp đơn vị VNĐ, không nhân 100 (không có khái niệm "cents" như hệ thống ngoại tệ thập phân). `supplier_quotes.qty` là ngoại lệ duy nhất dùng `REAL` (cho phép số lượng lẻ, vd 0.5 ngày công).

### 11. Ngày lưu `TEXT 'YYYY-MM-DD'`, không dùng kiểu `DATE` — kể cả trên MySQL
Mọi cột ngày (`event_date`, `booked_date`, `due_date`, `start_time`…) khai `TEXT`, giữ nguyên `TEXT` khi dịch sang MySQL (không rơi vào rule dịch nào ở `translate()` — xem [`09-db-schema.md`](09-db-schema.md) §A). So sánh/lọc theo khoảng ngày dựa vào so sánh chuỗi ISO (`WHERE date BETWEEN ? AND ?`) — hoạt động đúng vì `YYYY-MM-DD` so sánh chuỗi = so sánh thời gian, nhưng **không có validate format ở tầng DB** (cột nhận bất kỳ chuỗi nào, kể cả rỗng hoặc sai định dạng — validate chỉ có ở 1 số route cụ thể như `budgets.period` regex `^\d{4}-\d{2}$`, không phải toàn bộ).

### 12. Field JSON lưu dưới dạng `TEXT` chuỗi hoá — không dùng kiểu JSON của MySQL
`press_types`, `phone_ott`, `image_links`, `video_links`, `include`/`exclude` (scan_queries), `tags`/`channels`/`keywords`/`competitors` — toàn bộ lưu `TEXT` chứa chuỗi JSON đã `JSON.stringify()`, đọc lại bằng `JSON.parse()` tay ở từng nơi cần (`jarr()` trong `routes.js:1279`, `parseJSON()` trong `app.js:41`). Không dùng cột kiểu `JSON` native của MySQL 8 dù đã sẵn có — nhất quán với việc giữ 1 schema nguồn viết theo cú pháp SQLite (không có kiểu JSON trong SQLite cũ).

## §B. Quy tắc BẮT BUỘC cho code MỚI (mục tiêu đích — không phải mô tả hiện trạng)

> Nguồn: `BackEnd.SKILL/misa-backend-standard` (không lặp lại nội dung chung ở đó) + các finding đã hội tụ trong memory-bank này. Danh sách dưới đây là **tối thiểu bắt buộc** khi thêm/sửa code từ Wave 1 trở đi — không phải danh sách đầy đủ mọi convention.

1. **Cấm ghi trực tiếp field mật (`classification_tier≥Confidential`) bằng raw SQL/`pick()` không qua `PolicyEngine`.** Mọi route CREATE/EDIT chạm tới field mật phải đi qua choke point `authorizeWrite` (D1/D13) — không thêm 1 route mới copy pattern `stripDisallowed`/`maskMoney`/map-tay hiện có ở §A mục 2/8 (3 cơ chế cũ đang tồn tại chỉ để characterization, không phải mẫu cho code mới).
2. **Cấm silent-strip.** Nếu request chạm field vượt quyền, trả lỗi rõ ràng (`403` theo `05-error-contract.md`) — không lặng lẽ loại field khỏi payload rồi vẫn trả `200 {ok:true}` như §A mục 2 mô tả ở `stripDisallowed`.
3. **Cấm thêm 1 cơ chế mask mới song song 3 cơ chế cũ** (§A mục 8). Field mật mới phải qua `field_visibility`/`PolicyEngine` (D13.2b), không viết thêm 1 helper mask ad-hoc hay map tay trong route handler.
4. **Migration lỗi không được nuốt im lặng.** `migrate()`/`add()` hiện tại (`db.js:573`) bọc `try/catch` nuốt lỗi ALTER TABLE (xem `09-db-schema.md` §D) — đây là hành vi LEGACY, không copy khi thêm migration mới; migration mới phải log rõ lỗi thật, không nuốt để "chạy lại được".
5. **Hành động có quyền hạn cao (xoá, cấu hình API key, đổi role, đổi `classification_tier`/vượt trần `audience_visibility`) phải ghi `audit_log`** (`logEdit` hoặc tương đương) — không lặp lại tình trạng "áp dụng cho phần lớn nhưng không phải mọi route" ở §A mục 7; route mới không có audit là thiếu sót, không phải lựa chọn hợp lệ.
6. **Không dùng `dropAll()`/`RESET_DB=1`/`npm run seed` hiện tại làm cơ chế reset cho bất kỳ migration/redesign mới nào** (xem `09-db-schema.md` §E, `04-ROADMAP.md` W1.RBAC.0) — hàm này xoá 28/34 bảng, không sạch hoàn toàn.
7. **Route/action mới có side-effect ghi phải dùng tên action tường minh** (`create`/`edit`/`delete`/`ack`/`notify`/`run`…), không tái dùng `view` cho hành động có ghi dữ liệu (N1, đã RESOLVED — xem `02-decisions.md` §B.1).
8. **Verify/smoke thủ công (chạy `node server/index.js` tay để kiểm tra) phải tự set `DATA_DIR` trỏ vào thư mục tạm** (vd `DATA_DIR=$(mktemp -d)`) và tự xoá thư mục đó sau khi xong — không chạy trực tiếp lên `data/pr.db` dev thật của máy, dù chỉ đọc/login. Nếu đã lỡ ghi vào `data/pr.db` thật, KHÔNG dùng `npm run seed` để "làm sạch" — đó là thao tác reseed/destructive không tương xứng với vài dòng log lỡ ghi thêm (Codex G1A1-audit N1).
9. **Mọi HTTP outbound chịu ảnh hưởng từ URL ngoài phải qua `server/safe-fetch.js`.** Không gọi `fetch(url)`/`http.request(url)` trực tiếp cho URL từ request, DB hoặc AI grounding. Seam bắt buộc validate HTTP(S), DNS/IP và từng redirect, giới hạn body, pin địa chỉ đã xác minh; URL bị chặn phải fail-closed và không ghi dữ liệu dẫn xuất. Nếu môi trường cần trust boundary hẹp hơn, cấu hình `OUTBOUND_ALLOWED_HOSTS`, không tự tạo allowlist riêng trong route.

## §C. Quy trình phối hợp và quality gate bắt buộc

Từ 2026-08-26, mọi batch triển khai/audit phải tuân theo [`17-fast-track-collaboration.md`](17-fast-track-collaboration.md): chốt Batch Contract trước code, Claude bàn giao một Evidence Bundle cho toàn batch, Codex audit theo rủi ro, và chỉ P0/P1 hoặc exit criterion chưa đạt mới giữ gate. Quy tắc này tối ưu số vòng phối hợp; **không** miễn full regression trước handoff và không hạ chuẩn bảo mật/chịu lỗi của `BackEnd.SKILL`.
