# 11 — Luồng nghiệp vụ cốt lõi

> Diễn giải luồng thật đọc từ `server/routes.js`, `server/monitor.js`, `server/scheduler.js`, `server/ai.js`, `public/app.js`. Không suy đoán — mọi bước trích từ code, kèm `file:line`.

## A. Vòng đời quan hệ đối tác (organization/person)

Một "đối tác" trong hệ thống là 1 `organization` (cơ quan báo chí/hiệp hội/bộ ngành/khác) và 0..n `person` (nhân sự thuộc cơ quan đó, `people.org_id`). Vòng đời thực tế trong app:

1. **Tạo cơ quan** (`orgForm()` trong `public/app.js:1091`, gửi `POST /partners`) — chuyên viên PR chọn loại (`org_type`) rồi điền field theo loại (form hiển thị field khác nhau tuỳ `press`/`association`/`gov`/`other`, xem `renderGovPartner()` `app.js:1186` cho ví dụ nhánh gov). Cơ quan luôn tồn tại độc lập, không bắt buộc có nhân sự.
2. **Thêm nhân sự vào cơ quan** (`personForm()` `app.js:1482`, gửi `POST /people` với `org_id` cố định) — mỗi người có `relationship_score` (0-100, thang đo mức độ quan hệ, hiển thị bằng thanh màu `scoreBar()` `app.js:112-116`) và `status` (Thân thiết/Đang hợp tác/Cần kết nối/Ngừng hợp tác). Đây là entity có nhiều field mật nhất (contact/private/social/finance) — xem `03-data-classification.md`.
3. **Gắn tài trợ/giải thưởng nhận được từ hiệp hội** (`sponsorshipForm()`, `POST /partners/:id/sponsorships`) — dùng cho hiệp hội (org_type=association), không liên quan module `awards` (giải thưởng MISA đi thi, mục B dưới).
4. **Ký thoả thuận hợp tác/MOU** (`agreementForm()`, `POST /partners/:id/agreements`) và **ghi nhận lịch sử làm việc** (`workLogForm()`, `POST /partners/:id/work-logs`) — riêng cho `org_type=gov` (đối tác bộ ngành), mỗi mục có thể đính kèm file (hợp đồng scan, biên bản) qua `POST /agreements/:id/files` hoặc `/work-logs/:id/files`.
5. **Đóng hội phí hằng năm** (chỉ hiệp hội) — mỗi năm 1 dòng `association_fees` (`feeForm()`, `POST /partners/:id/fees`) với `due_date`/`paid_date`/`status`. Route `POST /partners/:id/fees/:fid/remind` tạo 1 `important_dates` mới trỏ tới hạn đóng — **đây là điểm nối 2 module**: nghiệp vụ hội phí tự sinh ra dữ liệu cho module Lịch nhắc (mục E), không phải trigger DB, mà là code tường minh trong route handler (`routes.js:316-323`).
6. **Tặng quà đối ngoại** (`giftForm()`, `POST /partners/:id/gifts` hoặc `/people/:id/gifts` — dùng chung 1 factory `addGift()` `routes.js:258-266`) và **ghi nhận sử dụng quyền lợi hợp đồng đổi hàng** (`benefitForm()`, chỉ báo chí) là 2 luồng phụ độc lập, không phụ thuộc luồng nào khác.
7. **Ghi tương tác** (mục D) và **đặt bài/booking** (mục dưới) là 2 hoạt động lặp lại xuyên suốt vòng đời quan hệ — không có bước "đóng" quan hệ chính thức, chỉ đổi `status='Ngừng hợp tác'` trên person hoặc để cơ quan "nguội" (không còn tương tác — phát hiện qua `careRisk`/`care-alerts`, mục F).

Tại mọi thời điểm, `GET /partners/:id` trả về TOÀN BỘ 7 mảng con (people/sponsorships/interactions/dates/fees/agreements+workLogs/gifts/benefitUsages) trong 1 lần gọi — client `public/app.js` render toàn bộ trang chi tiết cơ quan từ 1 response duy nhất, không có lazy-load từng tab.

## B. Luồng giải thưởng (award → participation → cost tracking)

Khác với "tài trợ/giải thưởng" ở mục A (đó là hiệp hội trao cho MISA thụ động), module `awards` là **MISA tự đăng ký tham gia thi**:

1. **Nhập/AI trích xuất thông báo giải thưởng.** 2 cách: nhập tay (`awardForm()` `app.js:2017`) hoặc dán văn bản/URL/upload file thông báo giải cho AI đọc (`awardExtractModal()` `app.js:2092` → `POST /ai/award-extract` → `ai.js:160-187`). AI trả `extracted` (chưa lưu) với `review_status` mặc định `'Thô'`; **người dùng phải bấm lưu thủ công** để gọi `POST /awards` — không có "auto-save" từ AI.
2. **Xin gợi ý AI có nên tham gia không** (tuỳ chọn) — `POST /ai/award-advice` (`ai.js:197-212`) nhận field giải thưởng đang nhập (không đọc DB), trả `capability` (đánh giá năng lực đạt giải) + `plan` (nháp kế hoạch) — chỉ là văn bản gợi ý, không ghi vào đâu tự động, người dùng copy vào field `capability`/`plan` của participation nếu muốn.
3. **Tạo hồ sơ tham gia theo năm** (`participationForm()` `app.js:2052`, `POST /awards/:id/participations`) — 1 award có thể có nhiều `award_participations` theo từng năm dự thi, mỗi năm có `status` riêng (Đang cân nhắc→Quyết định tham gia→Đã nộp→Đạt giải/Trượt/Không tham gia, không ép buộc thứ tự) và `budget` (dự toán, **org_fee**).
4. **Theo dõi hạn nộp hồ sơ** — `POST /awards/:id/remind` tạo 1 `important_dates` (giống cơ chế mục A.5), lấy `submission_deadline` của award làm ngày nhắc.
5. **Đính kèm tài liệu** (`POST /awards/:id/files`, kind cố định `award_doc` — khác event, không lấy kind từ query string).
6. **Tính chi phí thực tế đã chi cho giải thưởng** — không tính tại thời điểm tham gia, mà **tính lại mỗi lần xem báo cáo** (`GET /reports/awards`, `routes.js:760-776`): `mediaCost` = tổng `bookings.amount` có `award_id` trỏ tới award này (nghĩa là: khi đặt bài PR cho 1 giải thưởng, chuyên viên phải tự gắn `award_id` vào booking đó — không có bước ép buộc, dễ quên) + `partBudget` (tổng `budget` các participation trong khoảng năm lọc) + `cost` (chi phí gốc khai khi tạo award) = `totalCost`. Đây là **3 nguồn dữ liệu độc lập cộng lại tại thời điểm đọc**, không phải 1 cột lưu sẵn.

## C. Luồng sự kiện (event → cost → file đính kèm)

1. **Tạo sự kiện** (`eventForm()` `app.js:2234`, `POST /events`) — nhập tay hoặc AI đọc file kế hoạch Excel/CSV (`eventExtractModal()` `app.js:2301` → `POST /ai/event-extract` → `ai.js:244-273`, xem mục AI dưới). `mode` (`join`\|`host`) là field quan trọng nhất — quyết định MISA là khách hay chủ, ảnh hưởng UI hiển thị field nào.
2. **Ghi nhận chi phí theo 3 nhóm** (`costForm()` `app.js:2272`, `POST /events/:id/costs`) — `category` là `sponsor` (nhà tài trợ đồng hành sự kiện), `organization` (chi phí MISA tự tổ chức: gian hàng, POSM, LED…), hoặc `media` (chi phí truyền thông cho sự kiện: bài PR, phóng viên). 1 event có thể có nhiều dòng chi phí ở cả 3 nhóm cùng lúc; mỗi dòng có thể gắn `supplier_id` (đơn vị thực hiện).
3. **Đính kèm tài liệu tự do loại** (`POST /events/:id/files`) — khác award/agreement (kind cố định), event lấy `kind` từ **query string** do client gửi, chỉ cắt 40 ký tự, không whitelist server-side (`routes.js:1130`, F9 ở `01-audit-findings.md`) — client gợi ý danh sách loại qua `OPT.eventDocKind` (`app.js:214`) nhưng đây chỉ là UX, không phải ràng buộc thật.
4. **Nhắc lịch bắt đầu sự kiện** (`POST /events/:id/remind`, giống cơ chế mục A.5/B.4).
5. **Xem tổng chi phí** — `GET /events/:id` tính `totals` (3 category + `grand`) real-time từ `event_costs`, không lưu sẵn; nếu thiếu `org_fee`, cả object `totals` bị thay bằng chuỗi mask (không phải mask từng field — xem `10-api-contract.md` §H).

## D. Luồng nhà cung cấp (supplier → quote → transaction)

1. **Tạo hồ sơ nhà cung cấp** (`supplierForm()` `app.js:2437`, `POST /suppliers`) — gồm thông tin liên hệ + 2 field % thương mại (`service_fee_pct`, `deposit_pct`, phân loại chưa chốt org_fee hay không, xem O1).
2. **Xin báo giá** (`quoteForm()` `app.js:2456`, `POST /suppliers/:id/quotes`) — mỗi dòng báo giá là 1 hạng mục (`item`/`unit`/`qty`/`unit_price`), không có khái niệm "1 bộ báo giá" gộp nhiều dòng thành 1 phiên bản — mọi dòng quote thuộc trực tiếp 1 supplier, xoá từng dòng riêng lẻ.
3. **Ghi nhận giao dịch/hợp đồng thực tế** (`transactionForm()` `app.js:2479`, `POST /suppliers/:id/transactions`) — độc lập với `supplier_quotes` (không có liên kết DB giữa 1 quote và 1 transaction phát sinh từ nó); `value` là **org_fee** thật đã ký/chi.
4. **Quản lý đầu mối liên hệ** (`supplierContactForm()`, CRUD riêng `supplier_contacts`) và **nhắc hạn thanh toán/hợp đồng** (`supplierReminderForm()` — dùng `OPT.supplierRemindKind`, tạo `important_dates` giống các mục trên) là 2 luồng phụ.
5. Nhà cung cấp còn được **tham chiếu từ event_costs** (mục C) — 1 supplier có thể vừa có `supplier_quotes`/`supplier_transactions` riêng, vừa được gắn vào chi phí của nhiều sự kiện khác nhau qua `event_costs.supplier_id` (không có ràng buộc 2 chiều, chỉ 1 FK 1 phía).

## E. Luồng nhắc việc (reminder → notification → email qua scheduler)

Đây là luồng nền chạy độc lập với hành động người dùng, do `server/scheduler.js` điều khiển:

1. **Nguồn dữ liệu**: mọi dòng trong `important_dates`, được tạo trực tiếp bởi người dùng (`reminderForm()`, `POST /reminders`) hoặc tự động sinh ra từ các luồng khác (hội phí quá hạn, hạn nộp giải thưởng, ngày bắt đầu sự kiện, hạn thanh toán nhà cung cấp — xem mục A/B/C/D).
2. **`scheduler.runOnce()`** (`scheduler.js:23-69`) chạy mỗi 6 giờ (`setInterval`, `scheduler.js:74`, không cấu hình được qua UI — khác `monitor.applySchedule()` có UI settings) hoặc chạy tay qua `POST /reminders/run`. Với mỗi `important_dates`, tính `nextOccurrence()` (lần xuất hiện kế tiếp, có tính lặp năm) rồi tính từng "mốc nhắc" theo `lead_days`+`notify_repeat_every`+`notify_repeat_count` — có thể sinh nhiều mốc nhắc cho 1 sự kiện (vd nhắc 3 lần, mỗi lần cách 7 ngày, trước hạn 21 ngày).
3. **Chống trùng — SAI ở bản trước, sửa lại (Codex round-3 re-audit, R3-02C):** `runOnce()` (`scheduler.js:28-29,45-55`) làm **check-then-insert**: `SELECT ... WHERE date_id=? AND occur_date=? AND seq=? AND channel=? AND (recipient_user_id IS ? OR recipient_user_id=?)` rồi mới `INSERT` nếu không thấy. **Không có ràng buộc `UNIQUE`** trên `reminder_log` — chỉ có 1 index thường `idx_remlog (date_id, occur_date, seq)` (`db.js:240`), **không bao gồm `channel`/`recipient_user_id`**. Nghĩa là an toàn chỉ khi các lệnh gọi `runOnce()` chạy tuần tự, không đúng khi 2 lệnh gọi đồng thời (vd cron 6 giờ trùng lúc người dùng bấm `POST /reminders/run` tay) — cả 2 có thể cùng đọc "chưa có", rồi cùng ghi, tạo bản ghi trùng (nhắc in-app trùng/gửi email trùng). Fix thật (thêm khoá UNIQUE tương thích NULL `recipient_user_id` trên cả SQLite/MySQL + insert-on-conflict trong transaction) là việc Gate 1/W1, không phải Gate 0 — ghi ở đây là hành vi HIỆN TẠI, không phải hành vi đích.
4. **2 kênh riêng biệt, độc lập nhau**: `inapp` (tạo cho MỌI user có `notify_opt_in=1`, không cần có email) và `email` (chỉ tạo cho user có `notify_opt_in=1` VÀ có `email` VÀ `mailer.enabled()` — SMTP đã cấu hình). Một user có thể nhận nhắc in-app nhưng không nhận email, hoặc ngược lại tùy cấu hình.
5. **Gửi email** qua `mailer.send()` (`mailer.js:47-63`) — bất đồng bộ, lỗi gửi bị nuốt (`.catch(() => {})` ở `scheduler.js:61`) nên **không có cơ chế retry hoặc cảnh báo khi email thất bại** — chỉ tăng đếm `emailed` nếu thành công.
6. **Hiển thị cho người dùng**: `GET /notifications` đọc `reminder_log` (kênh `inapp`) của user hiện tại, hiển thị chuông trên header; `POST /notifications/:id/read` hoặc `/read-all` đánh dấu đã đọc.
7. **Xuất lịch (.ics)**: `GET /reminders/:id/ics` sinh file iCalendar tại chỗ (không lưu DB) để người dùng tự import vào Google Calendar/Outlook — độc lập hoàn toàn với luồng nhắc in-app/email ở trên (không liên quan `reminder_log`).

## F. Luồng giám sát truyền thông (scan → Gemini grounding → mention → sentiment → highlight/competitor-brief/campaign-evaluate)

Module phức tạp nhất, điều khiển bởi `server/monitor.js`, có cả tác vụ nền tự động và theo yêu cầu người dùng.

### F.1 Quét tin (`runScan()`, `monitor.js:324-405`)
4 nguồn dữ liệu độc lập, chạy tuần tự trong 1 lượt quét (`scan_runs` ghi nhận 1 dòng mỗi lượt):
1. **Google News RSS** theo từng nhóm AND của mỗi `scan_queries.include` (`googleNewsUrl()`).
2. **RSS báo chí đã khai báo** (`sources` có `mode='rss'`) — fetch 1 lần/nguồn, so khớp với MỌI query đang bật (không phải query gắn cứng với nguồn).
3. **Nguồn dạng website không có RSS** (`sources.mode='site'`) — quét bằng Gemini Google Search giới hạn `site:<domain>` (`siteGroundIngest()`).
4. **Mở rộng bằng Gemini Google Search grounding** cho riêng các `scan_queries` có cờ `grounding=1` (`groundIngest()`).

Mọi tin quét được đều qua `matchTerms()` (boolean AND-trong-nhóm, OR-giữa-nhóm, NOT cho exclude) trước khi lưu; dedup bằng `INSERT OR IGNORE` theo `mentions.link` UNIQUE (`saveMention()` `monitor.js:112-114`) — 1 link chỉ tồn tại 1 lần dù khớp nhiều query/nguồn.

### F.2 Phân tích AI sau khi quét (`analyzePending()`, `monitor.js:144-163`)
Chạy ngay sau quét (nếu `analyze !== false`) hoặc để dành cho lượt sau — xử lý theo batch 8 tin/lần gọi Gemini (`analyzeBatch()`), sinh `sentiment`/`sentiment_score`/`ai_summary`/`tags`, đánh dấu `sentiment_by='ai'`. Người dùng có thể sửa tay sau đó qua `PUT /monitor/mentions/:id` — khi đó `sentiment_by` đổi thành `'human'` và ghi 1 dòng `sentiment_audit` (ai sửa, từ gì sang gì).

### F.3 Phát hiện khủng hoảng (`detectCrisis()`, `monitor.js:309-321`)
Chạy sau mỗi lượt quét: nếu ≥3 tin `category='brand'` + `sentiment='negative'` trong 24h qua → tạo 1 `monitor_alerts` mức `critical` (tối đa 1 cảnh báo/ngày, kiểm tra `occur_date` trước khi tạo). Đây là ngưỡng cứng trong code, **không có UI cấu hình ngưỡng "3 tin"**.

### F.4 Auto-scan nền (`applySchedule()`, `monitor.js:426-437`)
Đọc cấu hình từ `app_meta` (`autoscan`, `autoscan_interval_h`) — người dùng bật/tắt và đổi chu kỳ qua `PUT /monitor/settings`, có hiệu lực ngay (gọi lại `applySchedule()` sau khi lưu). Khác `scheduler.js` (nhắc việc, cố định 6h, không cấu hình được), module giám sát có UI settings đầy đủ.

### F.5 3 tính năng AI grounding không lưu dữ liệu, tính lại mỗi lần gọi
- `GET /monitor/highlights` → `aiMisaHighlights()`: Gemini tự tìm tin hoạt động MISA nổi bật qua Google Search, KHÔNG đọc từ bảng `mentions` — hoàn toàn dựa vào tri thức/tìm kiếm của Gemini tại thời điểm gọi.
- `GET /monitor/competitor-brief` → `aiCompetitorAnalysis()`: tương tự nhưng có đọc DB để lấy danh sách `competitors` + từ khoá từ `scan_queries` đang bật, đưa vào prompt làm ngữ cảnh tìm kiếm.
- `GET /monitor/campaigns/:id/evaluate` → `evaluateCampaign()`: **khác 2 route trên** — tính số liệu **deterministic** trước (đếm `mentions` khớp từ khoá chiến dịch trong khoảng ngày, tính NSR bằng công thức `(positive-negative)/(positive+negative)`) rồi mới đưa số liệu đã tính + câu hỏi phân tích cho Gemini viết narrative — mẫu "tính số ở server, AI chỉ viết văn" được ghi nhận là điểm mạnh nên nhân rộng (`01-audit-findings.md` mục E).

`GET /monitor/campaigns/:id/results` (khác `/evaluate`) chỉ tính số liệu thuần (không gọi AI) — cùng công thức NSR, cộng thêm `bySource`/`competitors`/`timeline`, dùng để vẽ biểu đồ; `/evaluate` gọi lại đúng logic tính NSR này rồi thêm phần Gemini viết đánh giá.

## G. Tổng hợp — mẫu lặp lại xuyên suốt tất cả luồng trên

1. **"Nhắc lịch" không phải 1 module riêng mà là side-effect** được kích hoạt từ nhiều nơi (hội phí, giải thưởng, sự kiện, nhà cung cấp) — mỗi nơi tự viết code tạo 1 dòng `important_dates`, không có 1 hàm chung `createReminder()` — trùng logic ở ≥4 vị trí (`routes.js:316-323, 949-958, 1135-1141`, và tương tự ở supplier).
2. **AI luôn ở vai trò "gợi ý chờ duyệt"**, không có route AI nào tự ghi thẳng vào DB — mọi `extracted` từ Gemini phải qua 1 lần gọi CREATE riêng do người dùng xác nhận (human-in-the-loop, điểm mạnh ghi ở `01-audit-findings.md` mục E).
3. **Tính tiền tổng hợp luôn tính lại tại thời điểm đọc**, không cache/lưu sẵn cột tổng (booking.total_amount, event.total_cost, award.totalCost, campaign NSR) — đơn giản hoá logic ghi nhưng đổi lại mọi API đọc có JOIN/subquery nặng hơn.
