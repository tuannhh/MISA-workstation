# 10 — Hợp đồng API theo nhóm nghiệp vụ (ý nghĩa field)

> KHÔNG lặp lại danh sách 145 route (đã có đủ, machine-checkable, ở [`07-route-catalog.md`](07-route-catalog.md)). File này giải thích **ý nghĩa field** trong request body và response shape cho từng nhóm resource — đặc biệt field tính toán (`total_amount`, `deadlineDays`…) và cơ chế che dữ liệu (`masked`/`●●●`) khi thiếu quyền. Nguồn: `server/routes.js`, `server/rbac.js`.
>
> Quy ước chung áp dụng cho MỌI route CREATE/EDIT dưới đây trừ khi ghi khác: request body là JSON phẳng; server dùng `pick(req.body, XXX_COLS)` (`routes.js:22-26`) để chỉ nhận đúng các cột khai báo trong mảng `XXX_COLS`, field lạ bị bỏ qua âm thầm (không lỗi); response CREATE luôn `{ id }`, response EDIT/DELETE luôn `{ ok: true }` (không trả lại record đã lưu — client phải tự gọi lại GET nếu cần dữ liệu mới).

## A. Partners — organizations (`ORG_COLS`, `routes.js:87-95`)

Request body khi tạo/sửa cơ quan gồm 3 nhóm field theo loại đối tác (`org_type`):
- **Chung**: `name`, `org_type` (`press`\|`association`\|`gov`\|`other`, không hợp lệ → mặc định `other` — `routes.js:159`), `tier` (mức độ quan trọng, hiển thị badge màu ở UI), `founded_date`, `parent_org` (đơn vị chủ quản), `website`, `address`, `press_types` (mảng JS, server tự `JSON.stringify` qua `jsonField()` — `routes.js:28-32,158`), `membership_fee` (**org_fee**, hội phí), `note`.
- **Gov (bộ ngành)**: `admin_level` (Trung ương/Địa phương), `agency_block`, `contact_clerk` (đầu mối văn thư), `org_departments`, `org_leaders`, `focal_partner_dev`, `focal_pr` (đầu mối PR bên đối tác).
- **Association (hiệp hội)**: `abbreviation`, `hotline`, `tax_code`, `field_area`, `misa_current_role`, `misa_events`, `misa_awards`.
- **Press (báo chí)**: `political_rank` (`C1`/`C2`/`C3` — xem `POLITICAL_RANK_DESC` trong `public/app.js:234-238`), `charter`, `contract_term`, `contract_benefits`, `contract_staff` (hợp tác đổi hàng).
- `caretaker_ids` (không thuộc `ORG_COLS`, đọc riêng từ `req.body`): mảng user id gán "người chăm sóc" — ghi qua `syncAssignments()` (`routes.js:71-76,161,170`); **không gửi field này = giữ nguyên phân công cũ** (khác với gửi mảng rỗng = xoá hết).

Response `GET /partners` (list): mỗi row có thêm `people_count` (đếm nhân sự thuộc cơ quan) và `fee_overdue` (đếm khoản hội phí quá hạn — subquery `OVERDUE`, `routes.js:112,119`), field mật bị `rbac.maskList()` thay bằng chuỗi `'●●● (đã ẩn)'` nếu user không thuộc nhóm `org_fee`; kèm `sensitiveVisible` (boolean toàn cục: user có xem được **mọi** nhóm mật không, không phải riêng route này).

Response `GET /partners/:id` (detail): `record` (đã mask) + **10 mảng con** trong 1 response (sửa lại — bản trước đếm sai "7 mảng", xác nhận trực tiếp `routes.js:153`: `res.json({ record, people, sponsorships, interactions, dates, fees, agreements, workLogs, gifts, benefitUsages, caretakers, sensitiveVisible })`) — `people`, `sponsorships`, `interactions`, `dates` (important_dates), `fees` (association_fees, `amount` bị thay `'●●● (đã ẩn)'` thủ công nếu thiếu `org_fee` — cách mask khác với `rbac.maskRecord`, xem `routes.js:145`), `agreements`/`workLogs` (mỗi item kèm `files: [...]` là danh sách attachment `kind='file'` gắn theo owner), `gifts`, `benefitUsages`, `caretakers`. (`sensitiveVisible` đi kèm nhưng là boolean, không phải mảng.) Đây là 1 API "gộp" toàn bộ dữ liệu liên quan 1 cơ quan để tránh nhiều round-trip — client (`public/app.js`) render tất cả từ 1 lần gọi.

### A.1 Sponsorships / Agreements / Work-logs / Gifts / Benefit-usages / Association-fees
Đều là sub-resource của 1 organization, cột cho phép ghi định nghĩa ở các hằng `S_COLS`/`AG_COLS`/`WL_COLS`/`GIFT_COLS`/`BU_COLS`/`FEE_COLS` (`routes.js:181-182,206,225,257,281,301`) — ý nghĩa field đa số tự giải thích qua tên tiếng Việt trong comment code; điểm cần chú ý:
- `sponsorships.type` = `Tài trợ`\|`Giải thưởng`\|`Hoạt động`; các field mở rộng (`product`, `category`, `submit_deadline`…) chỉ áp dụng khi `type='Giải thưởng'` (tài trợ giải thưởng bên ngoài, khác `awards` module).
- `gifts` dùng chung 1 route factory `addGift(ownerType)` cho cả `POST /partners/:id/gifts` (org) và `POST /people/:id/gifts` (person) — response/field giống nhau, chỉ khác `owner_type`.
- `fees` (association_fees) có action riêng `POST /partners/:id/fees/:fid/remind` — không sửa dữ liệu hội phí, chỉ tạo 1 dòng mới trong `important_dates` để đưa vào lịch nhắc (side-effect: sinh ra 1 bản ghi ở resource khác).

## B. People (`P_COLS`, `routes.js:328-336`)

Field chia 2 nhóm: **nghiệp vụ** (`org_id`, `full_name`, `level`, `position`, `beat`, `category`, `relationship_score` 0-100 dùng cho `scoreBar()` UI, `status`) và **mật** — mọi field còn lại trong `P_COLS` đều thuộc 1 trong 4 nhóm `contact`/`private`/`social`/`finance` (ánh xạ đầy đủ ở `rbac.js:66-73`, không lặp ở đây). `phone_ott` là object `{zalo,whatsapp,viber,telegram}` — server `JSON.stringify` qua `jsonField()` trước khi lưu (`routes.js:385,393`).

Response `GET /people/:id`: `record` (masked) + `maskedFields` (mảng tên field đã bị che — client dùng để hiển thị icon khoá cạnh field, không phải chỉ ẩn giá trị) + `portraits` (ảnh chân dung, **luôn hiển thị mọi role**) + `idDocs` (giấy tờ tuỳ thân, **rỗng nếu thiếu nhóm `iddoc`**, khác `idDocCount` — số đếm luôn trả về dù không có quyền xem file, để UI báo "có N giấy tờ, bạn không có quyền xem") + `interactions` + `gifts` (masked theo `org_fee`) + `caretakers`.

## C. Bookings (`B_COLS`, `routes.js:584-585`)

`subject_type` (`org`\|`person`) + `subject_id` xác định đối tượng được đặt bài; server tự suy `org_id`/`org_name` qua `resolveOrg()` (`routes.js:587-597`) — **client không cần tự tính org khi subject là person**, server tự JOIN từ `people.org_id`. `amount` là **org_fee**. `award_id` (có trong `B_COLS`, `routes.js:584-585`) liên kết 1 booking với 1 giải thưởng — dùng để tính `mediaCost` trong báo cáo giải thưởng (mục F). **Sửa lại (Codex round-3 re-audit, R3-02D):** `event_id` **KHÔNG có trong `B_COLS`** — client gửi `event_id` bị `pick()` âm thầm loại bỏ, không lưu được. Đây là mismatch schema/API thật, đăng ký ở [`01-audit-findings.md`](01-audit-findings.md) F12 — không tự sửa code ở đây, chờ owner xác nhận ý định trước khi thêm cột/allowlist.

Response `GET /bookings`: `rows` (mask `amount` field-by-field) + `total_amount` — **field tổng hợp cấp response, không phải cấp row**: nếu thiếu `org_fee`, giá trị là `'●●● (đã ẩn)'` (chuỗi), không phải số 0 hay `null` — client phải xử lý kiểu union `number | string` khi hiển thị (`routes.js:607-609`).

## D. Budgets

Chỉ 3 field: `period` (`YYYY-MM`, khoá upsert), `amount`, `note`. `POST /budgets` là **upsert** (tạo mới hoặc cập nhật nếu `period` đã tồn tại — `ON CONFLICT`, `routes.js:638-639`), không có `PUT` riêng.

## E. Reports (đọc-chỉ, không có field ghi)

Không phải CRUD — mỗi route trả 1 cấu trúc phân tích riêng, tính từ nhiều bảng, tổng hợp server-side:
- `GET /reports`: object lớn gồm `spend.{byMonth,byOrg,byPerson,byType,byStaff,total,count,budget}`, `events.{byCategory,byEvent,total}`, `fees.{byOrg,total}`, **`grandTotal` = spend.total + events.total + fees.total** (tổng chi phí toàn diện, không check `canMoney` — ghi ở [`01-audit-findings.md`](01-audit-findings.md)), `fulfillment` (booking theo status), `tiers`/`byBeat`/`careRisk` (phân tích quan hệ), `interactions.{byMonth,byChannel,byResult}`, `network` (quy mô mạng lưới).
- `careRisk`: mỗi người được gắn `level` 1-5 theo số ngày không tương tác (`days`) — `level>=3` mới xuất hiện trong response (đã lọc sẵn server-side, không phải toàn bộ danh bạ).
- `GET /reports/awards`: mỗi award có `partBudget` (tổng `award_participations.budget` trong khoảng năm lọc), `mediaCost` (tổng `bookings.amount` liên kết `award_id`), **`totalCost = cost + partBudget + mediaCost`** — field tổng hợp 3 nguồn khác nhau, không phải cột DB.
- `GET /reports/care-alerts`: `bucket` (`1m`\|`3m`\|`6m`\|`12m`) phân loại theo số ngày từ lần tương tác/booking gần nhất; `counts` là tổng số theo từng bucket (để vẽ 4 thẻ KPI).

## F. Awards (`AW_COLS`, `PART_COLS`, `routes.js:856-859`)

`AW_COLS` mô tả toàn bộ hồ sơ giải thưởng tĩnh (tên, đơn vị tổ chức, hạn nộp, tiêu chí…) — `cost` là **org_fee**. `organizer_type` (`gov`\|`association`\|`other`) chỉ mang tính phân loại hiển thị, không gate quyền. `review_status` (`Thô`\|`Đã duyệt`\|`Chuẩn hóa`) đánh dấu mức độ đã được người kiểm tra lại dữ liệu AI trích xuất (xem mục AI ở [`11-business-flows.md`](11-business-flows.md)) — **không có ràng buộc DB nào chặn ghi dữ liệu khi `review_status='Thô'`**, chỉ là cờ hiển thị.

`PART_COLS` (hồ sơ tham gia theo năm): `budget` là **org_fee**; `status` (`Đang cân nhắc`→`Quyết định tham gia`→`Đã nộp`→`Đạt giải`/`Trượt`/`Không tham gia`) là chuỗi trạng thái tự do (không có state machine ép buộc thứ tự ở server — client có thể set bất kỳ giá trị nào trong `OPT.partStatus`).

Response `GET /awards/:id`: `record` + `participations` + `attachments` (kind=`award_doc`) + `caretakers`; nếu thiếu `org_fee`, `record.cost` và mọi `participations[].budget` bị mask (2 lệnh `maskMoney` riêng biệt — `routes.js:894`, không dùng `rbac.maskRecord` vì `cost`/`budget` không khai trong `SENSITIVE_GROUPS.org_fee.fields`, chỉ khai `organization`/`sponsorship`/`gift` — xem ghi chú F1 ở [`01-audit-findings.md`](01-audit-findings.md)).

## G. Suppliers (`SUP_COLS`, `QUOTE_COLS`, `STRANS_COLS`, `SCONTACT_COLS`, `routes.js:963-966`)

- `suppliers`: `service_fee_pct`/`deposit_pct` là % thương mại (0-100), **UNVERIFIED có phải `org_fee` hay không** — chờ owner quyết (O1, xem `03-data-classification.md` §B).
- `supplier_quotes` (`QUOTE_COLS`): `stt` (số thứ tự dòng báo giá), `item`, `unit`, `qty` (REAL, cho phép số lẻ), `unit_price` (**org_fee**).
- `supplier_transactions` (`STRANS_COLS`): `contract_no` (số hợp đồng/đơn hàng), `value` (**org_fee**), `status` tự do (`OPT.transStatus`: Chưa/Đang/Đã thực hiện).
- `supplier_contacts` (`SCONTACT_COLS`): đầu mối liên hệ phía nhà cung cấp — không có field mật đặc biệt (không thuộc registry `SENSITIVE_GROUPS`).

Response `GET /suppliers/:id`: `record` + `quotes` (mask `unit_price`) + `files` (kind=`quote`) + `transactions` (mask `value` bằng cách map tay giống `fees` ở mục A, không dùng `rbac.maskList`) + `dates` (nhắc hạn) + `contacts`.

## H. Events (`EVENT_COLS`, `EC_COLS`, `routes.js:1059-1063`)

`EVENT_COLS`: `mode` (`join`=MISA tham gia \| `host`=MISA tổ chức) quyết định UI hiển thị nhóm field nào; `image_links`/`video_links` là mảng JSON (client gửi array, server `JSON.stringify` qua `jsonField()`); `misa_keynotes` (số bài phát biểu lãnh đạo MISA, dùng thống kê dashboard).

`EC_COLS` (event_costs, 1 bảng cho 3 category): `category` (`sponsor`\|`organization`\|`media`) quyết định field nào có ý nghĩa — `sponsor_tier`/`sponsor_benefits` chỉ dùng khi `category=sponsor`; `press_org`/`journalist_name`/`article_link` chỉ dùng khi `category=media`; `amount` (**org_fee**) và `supplier_id` (liên kết nhà cung cấp thực hiện) dùng chung mọi category.

Response `GET /events/:id`: `costs` (object 3 mảng theo category) + `totals` (`{sponsor, organization, media, grand}` — tổng theo từng category và tổng toàn bộ; nếu thiếu `org_fee`, **cả 4 giá trị object `totals` bị gán thẳng chuỗi `'●●● (đã ẩn)'`**, không phải mask từng field — `routes.js:1094`) + `attachments` (kind tự do từ query string khi upload, xem F9 ở `01-audit-findings.md`) + `daysToStart` (số ngày tới `start_time`, âm nếu đã qua).

## I. Reminders / Notifications (`D_COLS`, `routes.js:483`)

`important_dates`: `subject_type` (`person`\|`organization`\|`general`) + `subject_id`/`subject_name` xác định đối tượng được nhắc (không FK, client tự điền tên khi tạo); `recurring` (1=lặp hằng năm theo ngày/tháng, 0=chỉ 1 lần theo đúng năm); `lead_days` = số ngày báo trước mốc đầu; `notify_repeat_every`/`notify_repeat_count` cho phép nhắc lặp nhiều mốc trước 1 ngày (vd nhắc 3 lần cách nhau 7 ngày trước hạn đóng hội phí).

Response `GET /reminders`/`upcoming`: mỗi row được "decorate" thêm `daysUntil`, `occurDate` (lần xuất hiện kế tiếp đã tính), `years` (số năm kỷ niệm nếu `recurring`), `dueSoon` (boolean, `daysUntil <= lead_days`) — tính bằng `decorateDates()`/`nextOccurrence()` (`routes.js:486-509`), không lưu trong DB.

`GET /notifications`: đọc từ `reminder_log` (không phải `important_dates` trực tiếp) JOIN ngược lại `important_dates` để lấy `title`/`note`; `unread` = số dòng `read_at IS NULL`. `POST /reminders/run` không nhận field nào, chạy `scheduler.runOnce()` ngay lập tức và trả `{ created, emailed }` (số nhắc in-app mới tạo + số email đã gửi trong lượt chạy tay này).

## J. Interactions (`I_COLS`, `routes.js:557-558`)

`partner_type`(`person`\|`org`) + `partner_id` xác định đối tác; `next_task`/`next_status`/`next_due`/`next_staff`/`work_mode` (mở rộng VIP profile) mô tả công việc tiếp theo cần làm sau tương tác này — không có route riêng để đóng/hoàn thành "next_task", chỉ sửa qua ghi đè khi tạo interaction mới hoặc qua `PUT` (không thấy route PUT cho interactions trong catalog — chỉ có GET/POST, xem R044/R045 ở `07-route-catalog.md`; sửa/xoá 1 interaction đã tạo **không có endpoint**, UNVERIFIED nếu đây là chủ ý hay thiếu sót).

## K. Admin — users (`routes.js:1232-1274`)

`POST /admin/users` nhận `username`, `password` (plaintext qua HTTPS, hash bằng `bcrypt.hashSync(..., 10)` server-side — `routes.js:1242`), `full_name`, `role` (phải thuộc `rbac.ROLES`), `email`, `sensitive_perms` (mảng tên nhóm mật, lọc qua `rbac.ALL_GROUPS` trước khi lưu — field lạ trong mảng bị loại, không lỗi). `PUT /admin/users/:id` build câu UPDATE động theo field nào có mặt trong body (không dùng `pick`/`buildUpdate` chung, tự viết riêng — xem [`16-coding-rules.md`](16-coding-rules.md) về ngoại lệ pattern này); nếu user tự sửa chính mình, `req.session.user` được refresh ngay để quyền mới có hiệu lực tức thì trong phiên hiện tại (không cần đăng nhập lại).

## L. Monitoring — mentions / queries / sources / competitors / campaigns (`routes.js:1279-1583`)

- **mentions**: field ghi được giới hạn chặt ở `MENTION_EDIT = ['status','next_action','assignee','note']` (`routes.js:1321`) — **không cho sửa `title`/`content`/`link`/`source_name`** qua API (đây là dữ liệu quét, coi là "chỉ đọc" trừ workflow xử lý). `sentiment` được xử lý riêng ngoài `MENTION_EDIT`: đổi `sentiment` qua `PUT` tự động ghi `sentiment_by='human'` + 1 dòng vào `sentiment_audit` (ai đổi, từ gì sang gì) — response vẫn chỉ `{ ok: true }`, không trả lại record.
- **scan_queries**: `include`/`exclude` client gửi dạng mảng JS (mảng của mảng cho include — OR của các nhóm AND), server tự `JSON.stringify`. `grounding` (boolean) bật quét mở rộng bằng Gemini Google Search cho riêng bộ từ khoá này.
- **sources**: `POST /monitor/sources` chỉ cần `name`+`url` — server **tự dò** có RSS feed không (`monitor.detectFeed()`) và tự set `mode` (`rss`\|`site`) + `enabled`; response trả thêm `mode` để client biết kết quả tự dò (không phải field client gửi lên).
- **competitors**: `channels` mảng JSON kênh vệ tinh (fanpage phụ, kênh Youtube…).
- **campaigns**: `keywords` (mảng từ khoá đo hiệu quả chiến dịch) + `competitors` (mảng `{name, keywords:[...]}` hoặc mảng string — cả 2 dạng được chấp nhận, xem `compRes` ở `routes.js:1559-1564`) là 2 field JSON quan trọng nhất, dùng để tính `GET /monitor/campaigns/:id/results` (không lưu kết quả, tính lại mỗi lần gọi từ bảng `mentions`).

Response `GET /monitor/dashboard`: `sentiment` (breakdown brand theo khoảng ngày), `nsr` (Net Sentiment Rate = (positive-negative)/(positive+negative), công thức lặp lại ở nhiều nơi — xem [`11-business-flows.md`](11-business-flows.md)), `crisis` (boolean, `neg24 >= 3`), `trend` (14 ngày gần nhất, mỗi ngày có `total`+`nsr` riêng).

## M. AI endpoints (`server/ai.js`) — request/response đặc thù

Không dùng `XXX_COLS`/`pick()` — mỗi route AI có schema riêng (JSON Schema truyền cho Gemini `responseSchema`), field response nằm trong object `extracted` (chưa lưu DB, client phải tự gọi route CREATE tương ứng sau khi người dùng duyệt):
- `POST /ai/interaction-voice`: trả `extracted.{transcript, summary, channel, result, date, person_name, org_name}` + `matchedPerson`/`matchedOrg` (kết quả tự khớp tên với DB, `null` nếu không tìm thấy — client tự quyết định gắn `partner_id` nào).
- `POST /ai/award-extract`, `/ai/event-extract`: trả `extracted` theo schema tương ứng + (event-extract) `missing` (mảng field quan trọng AI không điền được — dùng hiển thị cảnh báo) + `warnings`/`file` (metadata từ bước đọc Excel an toàn, xem `spreadsheet-parser.js`).
- `POST /ai/card-text`, `/ai/card-image`: input là ngữ cảnh (loại ngày, tên đối tượng, ý tưởng), output `text` (thuần) hoặc `{mime, dataUrl, usedLogo}` (ảnh base64 data URL, không lưu file).
- `POST /ai/award-advice`: input toàn bộ field giải thưởng client đang nhập (không đọc lại DB), output `{capability, plan}` — 2 đoạn văn gợi ý, không có field nào được lưu tự động.
