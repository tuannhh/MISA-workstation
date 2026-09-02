# Gate 1 — Bảng ánh xạ route/job → test (G1A.9)

> Yêu cầu bắt buộc theo Codex C0.6 (`memory-bank/04-ROADMAP.md` §G1A): mapping
> `route_id/business_rule_id → test_id → trạng thái` phủ đủ 150/150 route + mọi
> job/scheduler/monitor flow, là **exit criterion của toàn Gate 1**, không phải optional.
>
> `status` dùng 1 trong 4 giá trị: `TODO` (chưa viết test — trạng thái khởi tạo của mọi
> dòng trong file này), `green` (characterization/target test đã xanh), `known-red`
> (target test đỏ có chủ ý, phải có allowlist `{F-id/D13-target/N-id, owner, expiry}` ở
> G1B — xem `04-ROADMAP.md` §G1B.6), `manual-host` (không tự động hoá được, cần test tay
> trên thiết bị/host thật — ví dụ Native-Mobile runtime). Gate 1 chỉ đóng khi KHÔNG còn
> dòng nào `TODO`.
>
> Cột `test_id`/`file` để trống (`—`) cho tới khi G1A.2–G1A.8 lần lượt viết test thật.
> Nguồn route_id: `memory-bank/07-route-catalog.md` (đã xác nhận đúng 150/150, không
> lọt/trùng, bằng `scripts/verify-g0.mjs`).
>
> **Quy ước `business_rule_id`/`test_id` (từ G1A.2, sau remediation round 1 theo audit
> Codex; câu chữ sửa lại theo CLOSE round 2, 2026-08-25):** với mọi rule không gắn
> `route_id`, `test_id` chỉ bằng đúng `business_rule_id` của CHÍNH nó khi rule đó có
> `test()` riêng. Một số rule liên quan (nhiều nhánh của cùng 1 hàm) chia sẻ 1 khối
> `test()` duy nhất — ví dụ `BR-VAL-002`/`BR-VAL-003` đều được assert trong khối
> `test('BR-VAL-001: ...')` — khi đó `test_id` của các rule này trỏ tới id của test CHỨA
> nó (đã ghi rõ ở cột `note`), không phải bằng chính `business_rule_id` của rule. Quy tắc
> chung: `test_id` LUÔN xuất hiện verbatim trong chuỗi mô tả `test(...)` nguồn — `grep
> <test_id> server/test/*.test.js server/security.test.js` luôn join ra đúng test.
> **Quy ước `green` vs `known-red`:** `green` = test ĐANG PASS, kể cả khi nó đặc tả một
> lỗ hổng/gap đang tồn tại trong hành vi hiện tại (characterization test) — pass nghĩa là
> mô tả đúng thực trạng, không phải "đã an toàn". `known-red` CHỈ dùng cho target/guard
> test THẬT SỰ ĐANG ĐỎ có chủ ý (test mong đợi hành vi đã được sửa nhưng code chưa sửa),
> kèm allowlist `{id, owner, expiry}` theo §G1B.6. Một characterization xanh mô tả gap và
> target test đỏ cho đúng gap đó là 2 dòng khác nhau trong bảng — không gộp chung 1 dòng.
>
> **Ngoại lệ prefix `INFRA-` (2026-08-30):** không phải finding thật, mà là fixture tự-test
> cơ chế `known-red()` (G1B.6) chính nó — vẫn phải khai allowlist `{id, owner, expiry}` như
> mọi known-red khác để verifier đối chiếu nhất quán, nhưng `note` phải ghi rõ "không phải
> finding thật" để không bị hiểu nhầm là còn gap bảo mật mở. Dùng id cố định `expiry` xa
> (2099) vì không gắn với vòng đời sửa lỗi nào — chỉ xoá nếu bỏ hẳn cơ chế self-test.
>
> **Quy ước riêng cho dòng `route_id` (G1A.3, khác BR-* của G1A.2):** mỗi route có NHIỀU
> `test()` (1 test/case: happy/invalid/unauthenticated/forbidden/not-found), không phải 1
> test duy nhất. Ở đây `test_id` = chính `route_id` (ví dụ `R143`), và quy tắc "verbatim"
> được thoả vì MỌI test-case của route đó đều mở đầu tiêu đề bằng đúng chuỗi `route_id` —
> `grep R143 server/test/*.test.js` join ra ĐỦ (không phải đúng 1) các test-case của route.
> Route không có `:id`/body thì không có case invalid/not-found tương ứng — ghi rõ lý do ở
> cột `note` thay vì bỏ trống. Route có hành vi không trả 404 khi id không tồn tại (silent
> no-op) vẫn tính là `green` với ghi chú `CHARACTERIZATION not-found` — đặc tả đúng thực
> trạng, không phải bug được "test cho qua".

| route_id | test_id | status | file | note |
|---|---|---|---|---|
| R001 | R001 | green | server/test/integration-partners.test.js | happy/unauthenticated (không :id/body -> không invalid/not-found; forbidden N/A — pr_staff đủ quyền partners.*) |
| R002 | R002 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION invalid(type lạ bị bỏ qua lặng lẽ)/unauthenticated (forbidden N/A) |
| R003 | R003 | green | server/test/integration-partners.test.js | happy/not-found(404 thật, khác đa số route dưới)/unauthenticated (forbidden N/A) |
| R004 | R004 | green | server/test/integration-partners.test.js | happy/invalid(thiếu name->400 lỗi DB; org_type lạ->CHARACTERIZATION tự thành 'other')/unauthenticated (forbidden N/A) |
| R005 | R005 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(200 ok:true, không 404)/unauthenticated (forbidden N/A) |
| R006 | R006 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R007 | R007 | green | server/test/integration-partners.test.js | happy/invalid(thiếu title->400)/not-found (**F15 đã sửa 2026-08-30**: org_id lạ nay chặn 400 đồng nhất cả 2 driver)/unauthenticated |
| R008 | R008 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R009 | R009 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R010 | R010 | green | server/test/integration-partners.test.js | happy/invalid(thiếu title->400, validate rõ trong route)/unauthenticated (not-found N/A vì tạo mới; forbidden N/A) |
| R011 | R011 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R012 | R012 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R013 | R013 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION invalid(body rỗng vẫn 200, không field NOT NULL nào từ client)/unauthenticated (forbidden N/A) |
| R014 | R014 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R015 | R015 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R016 | R016 | green | server/test/integration-partners.test.js | happy(multipart upload)/invalid(không file->400)/unauthenticated (not-found N/A; forbidden N/A) |
| R017 | R017 | green | server/test/integration-partners.test.js | happy(multipart upload)/invalid(không file->400)/unauthenticated (not-found N/A; forbidden N/A) |
| R018 | R018 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION invalid(body rỗng vẫn 200)/unauthenticated (not-found N/A; forbidden N/A) |
| R019 | R019 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(person_id lạ vẫn 200 — gifts.owner_id không có FK tới people)/unauthenticated (forbidden N/A) |
| R020 | R020 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R021 | R021 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R022 | R022 | green | server/test/integration-partners.test.js | happy/invalid(thiếu title->400, validate rõ trong route)/unauthenticated (not-found N/A; forbidden N/A) |
| R023 | R023 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R024 | R024 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R025 | R025 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION invalid(body rỗng vẫn 200)/unauthenticated (not-found N/A; forbidden N/A) |
| R026 | R026 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R027 | R027 | green | server/test/integration-partners.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R028 | R028 | green | server/test/integration-partners.test.js | happy/invalid(chưa có hạn đóng->400)/not-found(fid lạ rơi cùng nhánh 400 "chưa có hạn đóng")/unauthenticated (forbidden N/A) |
| R029 | R029 | green | server/test/integration-people.test.js | happy/CHARACTERIZATION invalid(org_id lạ->rows rỗng, không lỗi)/unauthenticated (forbidden N/A — module partners) |
| R030 | R030 | green | server/test/integration-people.test.js | happy/not-found(404 thật)/unauthenticated (forbidden N/A) |
| R031 | R031 | green | server/test/integration-people.test.js | happy/invalid(thiếu full_name->400)/unauthenticated (not-found N/A vì tạo mới; forbidden N/A) |
| R032 | R032 | green | server/test/integration-people.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R033 | R033 | green | server/test/integration-people.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R034 | R034 | green | server/test/integration-people.test.js | happy(portrait+id_doc)/invalid(không file->400; vượt 5 ảnh->400)/**forbidden THẬT** (pr_staff không có nhóm iddoc, upload id_doc->403)/CHARACTERIZATION not-found(person_id lạ vẫn 200, không kiểm tồn tại)/unauthenticated |
| R035 | R035 | green | server/test/integration-people.test.js | happy/not-found(404 thật "Không tìm thấy ảnh")/unauthenticated (forbidden N/A — không gate iddoc ở primary) |
| R036 | R036 | green | server/test/integration-people.test.js | happy/not-found(404 thật)/**forbidden THẬT** (pr_staff xoá attachment kind=id_doc->403)/unauthenticated |
| R037 | R037 | green | server/test/integration-people.test.js | happy(download, đúng content-type)/not-found(404 thật)/**forbidden THẬT** (pr_staff xem file id_doc->403)/unauthenticated (route requireAuth-only nhưng vẫn tự gate iddoc riêng trong handler) |
| R038 | R038 | green | server/test/integration-reminders.test.js | happy/CHARACTERIZATION invalid(days>365 clamp về 365, không lỗi)/unauthenticated (forbidden N/A) |
| R039 | R039 | green | server/test/integration-reminders.test.js | happy (không phân trang/filter -> không case invalid/not-found; forbidden N/A) |
| R040 | R040 | green | server/test/integration-reminders.test.js | happy/invalid(thiếu event_date->400)/unauthenticated (not-found N/A vì tạo mới; forbidden N/A) |
| R041 | R041 | green | server/test/integration-reminders.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R042 | R042 | green | server/test/integration-reminders.test.js | happy/CHARACTERIZATION not-found(200 ok:true)/unauthenticated (forbidden N/A) |
| R043 | R043 | green | server/test/integration-interactions.test.js | happy/CHARACTERIZATION invalid(q rỗng -> không lỗi)/unauthenticated (not-found N/A vì không có :id; forbidden N/A) |
| R044 | R044 | green | server/test/integration-interactions.test.js | happy/CHARACTERIZATION invalid(page/pageSize sai định dạng -> tự clamp)/unauthenticated (not-found N/A; forbidden N/A) |
| R045 | R045 | green | server/test/integration-interactions.test.js | happy/invalid(thiếu date NOT NULL->400)/CHARACTERIZATION (partner_type lạ tự về "person")/unauthenticated (not-found N/A vì tạo mới; forbidden N/A) |
| R046 | R046 | green | server/test/integration-bookings-budgets.test.js | happy(lọc subject_type/subject_id/from/to)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R047 | R047 | green | server/test/integration-bookings-budgets.test.js | happy/invalid(thiếu title NOT NULL->400)/unauthenticated (not-found N/A vì tạo mới; forbidden N/A) |
| R048 | R048 | green | server/test/integration-bookings-budgets.test.js | happy/CHARACTERIZATION not-found(id không tồn tại vẫn 200 ok:true)/unauthenticated (forbidden N/A) |
| R049 | R049 | green | server/test/integration-bookings-budgets.test.js | happy/CHARACTERIZATION not-found(id không tồn tại vẫn 200 ok:true)/unauthenticated (forbidden N/A) |
| R050 | R050 | green | server/test/integration-bookings-budgets.test.js | happy/unauthenticated/forbidden (pr_staff MATRIX.reports=[] -> 403; invalid N/A; not-found N/A) |
| R051 | R051 | green | server/test/integration-bookings-budgets.test.js | happy(tạo mới + upsert đè period trùng)/invalid(period sai YYYY-MM->400)/unauthenticated/forbidden (pr_staff->403; not-found N/A) |
| R052 | R052 | green | server/test/integration-reports.test.js | happy(đủ khối spend/events/fees/grandTotal/network)/happy(F14: grandTotal cộng đúng bằng số)/CHARACTERIZATION(thiếu from/to dùng dải mặc định)/unauthenticated/forbidden (pr_staff->403; not-found N/A) |
| R053 | R053 | green | server/test/integration-reports.test.js | happy/unauthenticated/forbidden (pr_staff->403; invalid N/A; not-found N/A) |
| R054 | R054 | green | server/test/integration-reports.test.js | happy/unauthenticated/forbidden (pr_staff->403; invalid N/A; not-found N/A) |
| R055 | R055 | green | server/test/integration-reports.test.js | happy CHARACTERIZATION(chỉ trả award có participations/mediaCost>0)/unauthenticated/forbidden (pr_staff->403; invalid N/A; not-found N/A) |
| R056 | R056 | green | server/test/integration-reports.test.js | happy(rows+counts theo bucket)/unauthenticated/forbidden (pr_staff->403; invalid N/A; not-found N/A) |
| R057 | R057 | green | server/test/integration-reminders.test.js | happy(chung luồng notif với R058/R059)/unauthenticated (forbidden N/A) |
| R058 | R058 | green | server/test/integration-reminders.test.js | happy(chung luồng notif với R057/R059)/CHARACTERIZATION not-found(200 ok:true, UPDATE 0 dòng)/unauthenticated (forbidden N/A) |
| R059 | R059 | green | server/test/integration-reminders.test.js | happy(chung luồng notif với R057/R058)/unauthenticated (forbidden N/A) |
| R060 | R060 | green | server/test/integration-reminders.test.js | happy (200 cả 2 driver — F13 đã fix ở commit 5, `scheduler.js` bỏ cú pháp `IS ?` chỉ SQLite chấp nhận; xem `01-audit-findings.md` F13)/unauthenticated (forbidden N/A) |
| R061 | R061 | green | server/test/integration-reminders.test.js | happy(.ics đúng content-type)/not-found(404 thật)/unauthenticated (forbidden N/A) |
| R062 | R062 | green | server/test/integration-awards.test.js | happy(tìm+lọc+phân trang)/CHARACTERIZATION(type lạ bị bỏ qua filter)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R063 | R063 | green | server/test/integration-awards.test.js | happy/not-found/unauthenticated (invalid N/A; forbidden N/A) |
| R064 | R064 | green | server/test/integration-awards.test.js | happy/invalid(thiếu name NOT NULL->400)/unauthenticated (not-found N/A vì tạo mới; forbidden N/A) |
| R065 | R065 | green | server/test/integration-awards.test.js | happy/CHARACTERIZATION not-found(id không tồn tại vẫn 200 ok:true)/unauthenticated (forbidden N/A) |
| R066 | R066 | green | server/test/integration-awards.test.js | happy(xoá kèm file vật lý)/CHARACTERIZATION not-found(id không tồn tại vẫn 200 ok:true)/unauthenticated (forbidden N/A) |
| R067 | R067 | green | server/test/integration-awards.test.js | happy/not-found (**F15 đã sửa 2026-08-30**: award_id lạ nay chặn 400 đồng nhất cả 2 driver)/unauthenticated (forbidden N/A) |
| R068 | R068 | green | server/test/integration-awards.test.js | happy/CHARACTERIZATION not-found(pid không tồn tại vẫn 200 ok:true)/unauthenticated (invalid N/A; forbidden N/A) |
| R069 | R069 | green | server/test/integration-awards.test.js | happy/CHARACTERIZATION not-found(pid không tồn tại vẫn 200 ok:true)/unauthenticated (invalid N/A; forbidden N/A) |
| R070 | R070 | green | server/test/integration-awards.test.js | happy(1 file + nhiều file)/invalid(0 file->400)/CHARACTERIZATION not-found(award_id không tồn tại vẫn 200)/unauthenticated (forbidden N/A) |
| R071 | R071 | green | server/test/integration-awards.test.js | happy/invalid(thiếu submission_deadline->400)/not-found/unauthenticated (forbidden N/A) |
| R072 | R072 | green | server/test/integration-suppliers.test.js | happy(tìm+lọc industry+phân trang)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R073 | R073 | green | server/test/integration-suppliers.test.js | happy/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R074 | R074 | green | server/test/integration-suppliers.test.js | happy/not-found/unauthenticated (invalid N/A; forbidden N/A) |
| R075 | R075 | green | server/test/integration-suppliers.test.js | happy/not-found (**F15 đã sửa 2026-08-30**: supplier_id lạ nay chặn 400 đồng nhất cả 2 driver)/unauthenticated (forbidden N/A) |
| R076 | R076 | green | server/test/integration-suppliers.test.js | happy/CHARACTERIZATION not-found(cid không tồn tại vẫn 200 ok:true)/unauthenticated (invalid N/A; forbidden N/A) |
| R077 | R077 | green | server/test/integration-suppliers.test.js | happy/CHARACTERIZATION not-found(cid không tồn tại vẫn 200 ok:true)/unauthenticated (invalid N/A; forbidden N/A) |
| R078 | R078 | green | server/test/integration-suppliers.test.js | happy/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R079 | R079 | green | server/test/integration-suppliers.test.js | happy/CHARACTERIZATION not-found(tid không tồn tại vẫn 200 ok:true)/unauthenticated (invalid N/A; forbidden N/A) |
| R080 | R080 | green | server/test/integration-suppliers.test.js | happy/CHARACTERIZATION not-found(tid không tồn tại vẫn 200 ok:true)/unauthenticated (invalid N/A; forbidden N/A) |
| R081 | R081 | green | server/test/integration-suppliers.test.js | happy/invalid(thiếu name NOT NULL->400)/unauthenticated (not-found N/A vì tạo mới; forbidden N/A) |
| R082 | R082 | green | server/test/integration-suppliers.test.js | happy/CHARACTERIZATION not-found(id không tồn tại vẫn 200 ok:true)/unauthenticated (forbidden N/A) |
| R083 | R083 | green | server/test/integration-suppliers.test.js | happy(xoá kèm file vật lý)/cascade quotes+transactions+contacts (**F15 đã sửa 2026-08-30**: MySQL nay cascade thật đồng nhất SQLite, xác nhận qua query trực tiếp db)/CHARACTERIZATION not-found(id không tồn tại vẫn 200)/unauthenticated (forbidden N/A) |
| R084 | R084 | green | server/test/integration-suppliers.test.js | happy/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R085 | R085 | green | server/test/integration-suppliers.test.js | happy/CHARACTERIZATION not-found(qid không tồn tại vẫn 200 ok:true)/unauthenticated (invalid N/A; forbidden N/A) |
| R086 | R086 | green | server/test/integration-suppliers.test.js | happy(1 file+nhiều file)/CHARACTERIZATION(0 file vẫn 200, khác R034/R070)/unauthenticated (not-found N/A; forbidden N/A) |
| R087 | R087 | green | server/test/integration-events-dashboard.test.js | happy(tìm+lọc+total_cost, F16 đã fix)/CHARACTERIZATION(mode lạ bị bỏ qua filter)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R088 | R088 | green | server/test/integration-events-dashboard.test.js | happy(costs 3 nhóm+totals)/happy(totals.grand cộng đúng)/not-found/unauthenticated (invalid N/A; forbidden N/A) |
| R089 | R089 | green | server/test/integration-events-dashboard.test.js | happy/invalid(thiếu name NOT NULL->400)/unauthenticated (not-found N/A vì tạo mới; forbidden N/A) |
| R090 | R090 | green | server/test/integration-events-dashboard.test.js | happy/CHARACTERIZATION not-found(id không tồn tại vẫn 200 ok:true)/unauthenticated (forbidden N/A) |
| R091 | R091 | green | server/test/integration-events-dashboard.test.js | happy(xoá kèm file vật lý)/cascade event_costs (**F15 đã sửa 2026-08-30**: MySQL nay cascade thật đồng nhất SQLite)/CHARACTERIZATION not-found(id không tồn tại vẫn 200)/unauthenticated (forbidden N/A) |
| R092 | R092 | green | server/test/integration-events-dashboard.test.js | happy/invalid(thiếu category NOT NULL->400)/unauthenticated (not-found N/A vì tạo mới; forbidden N/A) |
| R093 | R093 | green | server/test/integration-events-dashboard.test.js | happy/CHARACTERIZATION not-found(cid không tồn tại vẫn 200 ok:true)/unauthenticated (invalid N/A; forbidden N/A) |
| R094 | R094 | green | server/test/integration-events-dashboard.test.js | happy/CHARACTERIZATION not-found(cid không tồn tại vẫn 200 ok:true)/unauthenticated (invalid N/A; forbidden N/A) |
| R095 | R095 | green | server/test/integration-events-dashboard.test.js | happy(kind mặc định)/CHARACTERIZATION(F9: kind từ query không whitelist, cắt 40 ký tự)/CHARACTERIZATION(0 file vẫn 200)/unauthenticated (not-found N/A; forbidden N/A) |
| R096 | R096 | green | server/test/integration-events-dashboard.test.js | happy/invalid(thiếu start_time->400)/CHARACTERIZATION invalid(event_id không tồn tại cũng 400, gộp chung nhánh)/unauthenticated (forbidden N/A) |
| R097 | R097 | green | server/test/integration-events-dashboard.test.js | happy/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R098 | R098 | green | server/test/integration-events-dashboard.test.js | happy(overview+charts+upcoming)/happy(F16: mọi field số overview là number đã fix)/happy(F16: charts.*Monthly toàn number đã fix, có seed data để lộ đúng nhánh SUM)/happy(charts label/value)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A vì requireAuth only) |
| R099 | R099 | green | server/test/integration-auth-admin.test.js | happy/unauthenticated/forbidden (không có :id/body -> không case invalid/not-found) |
| R100 | R100 | green | server/test/integration-auth-admin.test.js | happy/invalid(thiếu field, username trùng 409)/unauthenticated/forbidden |
| R101 | R101 | green | server/test/integration-auth-admin.test.js | happy/invalid(role lạ bị bỏ qua lặng lẽ)/CHARACTERIZATION not-found (id lạ vẫn 200 ok:true, không 404)/unauthenticated/forbidden |
| R102 | R102 | green | server/test/integration-auth-admin.test.js | happy/invalid(tự xoá chính mình 400)/CHARACTERIZATION not-found (id lạ vẫn 200 ok:true, không 404)/unauthenticated/forbidden |
| R103 | R103 | green | server/test/integration-auth-admin.test.js | happy/unauthenticated/forbidden (không có :id/body -> không case invalid/not-found) |
| R104 | R104 | green | server/test/integration-monitor-1.test.js | happy(dashboard counts/sentiment/nsr/crisis/trend14/alerts)/happy CHARACTERIZATION(thiếu from/to dùng 30 ngày mặc định)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A vì monitoring full-CRUD cả 2 role) |
| R105 | R105 | green | server/test/integration-monitor-1.test.js | happy(lọc+phân trang+kèm queries)/happy CHARACTERIZATION(date_field=created_at)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R106 | R106 | green | server/test/integration-monitor-1.test.js | happy(keyword-stats count number thật)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R107 | R107 | green | server/test/integration-monitor-1.test.js | happy(bulk-delete)/invalid(ids rỗng 400)/happy CHARACTERIZATION(id lạ trong mảng không lỗi)/unauthenticated (not-found N/A; forbidden N/A) |
| R108 | R108 | green | server/test/integration-monitor-1.test.js | happy(sửa status/note)/happy(sửa sentiment ghi sentiment_by=human+sentiment_audit)/not-found(404)/unauthenticated (invalid N/A; forbidden N/A) |
| R109 | R109 | green | server/test/integration-monitor-1.test.js | happy(xoá)/happy CHARACTERIZATION(id lạ vẫn 200)/unauthenticated (invalid N/A; not-found đã gộp; forbidden N/A) |
| R110 | R110 | green | server/test/integration-monitor-1.test.js | happy(network-safe: sources tắt hết+scan_queries include rỗng, fetched=0)/invalid(query_ids rỗng 400)/unauthenticated (not-found N/A; forbidden N/A) — phát hiện+sửa F17 (xem 01-audit-findings.md) |
| R111 | R111 | green | server/test/integration-monitor-1.test.js | happy(danh sách lượt quét)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R112 | R112 | green | server/test/integration-monitor-1.test.js | happy CHARACTERIZATION(thiếu GEMINI_API_KEY -> 500, không gọi mạng thật)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R113 | R113 | green | server/test/integration-monitor-1.test.js | happy CHARACTERIZATION(thiếu GEMINI_API_KEY -> 500, không gọi mạng thật)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R114 | R114 | green | server/test/integration-monitor-1.test.js | happy(mặc định autoscan/interval_hours/scan_days)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R115 | R115 | green | server/test/integration-monitor-1.test.js | happy(clamp interval_hours/scan_days 2 chiều)/happy CHARACTERIZATION(scan_days=0 rơi về mặc định 30 do `\|\| 30` chạy trước clamp)/happy(bật+tắt autoscan an toàn, timer.unref())/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R116 | R116 | green | server/test/integration-monitor-1.test.js | happy(đánh dấu đã đọc)/happy CHARACTERIZATION(id lạ vẫn 200)/unauthenticated (invalid N/A; not-found đã gộp; forbidden N/A) |
| R117 | R117 | green | server/test/integration-monitor-1.test.js | happy(danh sách bộ từ khóa)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R118 | R118 | green | server/test/integration-monitor-1.test.js | happy(tạo)/invalid(thiếu name 400)/unauthenticated (not-found N/A; forbidden N/A) |
| R119 | R119 | green | server/test/integration-monitor-1.test.js | happy(sửa)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R120 | R120 | green | server/test/integration-monitor-1.test.js | happy(xoá)/happy CHARACTERIZATION(id lạ vẫn 200)/unauthenticated (invalid N/A; not-found đã gộp; forbidden N/A) |
| R121 | R121 | green | server/test/integration-monitor-2.test.js | happy(danh sách nguồn tin)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A vì monitoring full-CRUD cả 2 role) |
| R122 | R122 | green | server/test/integration-monitor-2.test.js | happy network-safe(loopback cổng đóng, mode=site)/invalid(thiếu name/url 400)/happy CHARACTERIZATION(url không scheme tự thêm https://)/unauthenticated (not-found N/A; forbidden N/A) |
| R123 | R123 | green | server/test/integration-monitor-2.test.js | happy(sửa tên/enabled)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R124 | R124 | green | server/test/integration-monitor-2.test.js | happy(xoá)/happy CHARACTERIZATION(id lạ vẫn 200)/unauthenticated (invalid N/A; not-found đã gộp; forbidden N/A) |
| R125 | R125 | green | server/test/integration-monitor-2.test.js | happy(danh sách đối thủ)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R126 | R126 | green | server/test/integration-monitor-2.test.js | happy(tạo)/invalid(thiếu name 400)/unauthenticated (not-found N/A; forbidden N/A) |
| R127 | R127 | green | server/test/integration-monitor-2.test.js | happy(sửa)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R128 | R128 | green | server/test/integration-monitor-2.test.js | happy(xoá)/happy CHARACTERIZATION(id lạ vẫn 200)/unauthenticated (invalid N/A; not-found đã gộp; forbidden N/A) |
| R129 | R129 | green | server/test/integration-monitor-2.test.js | happy(danh sách, keywords/competitors parse JSON->mảng)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R130 | R130 | green | server/test/integration-monitor-2.test.js | happy(chi tiết)/not-found(404)/unauthenticated (invalid N/A; forbidden N/A) |
| R131 | R131 | green | server/test/integration-monitor-2.test.js | happy(tạo, created_by=user hiện tại)/invalid(thiếu name 400)/unauthenticated (not-found N/A; forbidden N/A) |
| R132 | R132 | green | server/test/integration-monitor-2.test.js | happy(sửa)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R133 | R133 | green | server/test/integration-monitor-2.test.js | happy(xoá)/happy CHARACTERIZATION(id lạ vẫn 200)/unauthenticated (invalid N/A; not-found đã gộp; forbidden N/A) |
| R134 | R134 | green | server/test/integration-monitor-2.test.js | happy(tổng hợp sentiment/nsr/timeline/sample theo keyword+khoảng ngày)/happy CHARACTERIZATION(không keywords -> total=0)/not-found(404)/unauthenticated (invalid N/A; forbidden N/A) |
| R135 | R135 | green | server/test/integration-monitor-2.test.js | happy CHARACTERIZATION(thiếu GEMINI_API_KEY -> 500, không gọi mạng thật)/not-found(404, không chạm Gemini)/unauthenticated (invalid N/A; forbidden N/A) |
| R136 | R136 | green | server/test/integration-ai.test.js | happy CHARACTERIZATION(thiếu GEMINI_API_KEY -> 502, không gọi mạng thật)/invalid(thiếu file audio 400)/happy CHARACTERIZATION(uploadAudio không fileFilter, chấp nhận MIME tuỳ ý)/unauthenticated |
| R137 | R137 | green | server/test/integration-ai.test.js | happy CHARACTERIZATION(thiếu GEMINI_API_KEY -> 502)/happy CHARACTERIZATION(body rỗng vẫn 502, không validate trước khi gọi AI)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R138 | R138 | green | server/test/integration-ai.test.js | happy CHARACTERIZATION(thiếu GEMINI_API_KEY -> 502)/invalid(thiếu text 400)/unauthenticated (not-found N/A; forbidden N/A) |
| R139 | R139 | green | server/test/integration-ai.test.js | happy CHARACTERIZATION(nhánh text/file -> 502 thiếu key)/security(BR-SSRF-016: URL loopback bị chặn 400 trước outbound fetch/Gemini)/invalid(thiếu text/url/file 400)/unauthenticated |
| R140 | R140 | green | server/test/integration-ai.test.js | happy CHARACTERIZATION(thiếu GEMINI_API_KEY -> 502)/happy CHARACTERIZATION(body rỗng vẫn 502)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A) |
| R141 | R141 | green | server/test/integration-ai.test.js | happy CHARACTERIZATION(nhánh text -> 502 thiếu key)/invalid(file không phải Excel/CSV bị fileFilter chặn 400; thiếu file/text 400)/happy CHARACTERIZATION(rate-limit 8 lần/phút/user, lần 9 trả 429 trước khi chạm Gemini)/unauthenticated |
| R142 | R142 | green | server/test/integration-ai.test.js | happy(enabled=false + tên model)/unauthenticated (invalid N/A; not-found N/A; forbidden N/A vì requireAuth only) |
| R143 | R143 | green | server/test/integration-auth-admin.test.js | happy/invalid (không có :id -> không case not-found; đây là route đăng nhập nên "unauthenticated" không áp dụng) |
| R144 | R144 | green | server/test/integration-auth-admin.test.js | happy + CHARACTERIZATION (route không gắn requireAuth — logout không cookie vẫn 200 ok:true) |
| R145 | R145 | green | server/test/integration-auth-admin.test.js | happy/unauthenticated (không có :id/body -> không case invalid/not-found) |
| R146 | R146 | green | server/test/integration-auth-admin.test.js | happy(đọc cấu hình field-visibility module partners)/invalid(module không hỗ trợ 400)/unauthenticated/forbidden |
| R147 | R147 | green | server/test/integration-auth-admin.test.js | happy(siết field Public-tier full_name xuống private, GET phản ánh đúng)/invalid(D13.2b: mở public field Restricted bank_name -> 400)/unauthenticated/forbidden |
| R148 | R148 | green | server/test/integration-auth-admin.test.js | happy(gán lại owner_id booking qua policyService.prepareUpdate())/invalid(entity lạ 400; thiếu owner_id 400; owner_id user không active 400)/not-found(id không tồn tại 404)/unauthenticated/forbidden |
| R149 | R149 | green | server/test/integration-voice-secure-command.test.js | happy(match 1 candidate -> confidence high, tạo proposal)/happy(2 candidate trùng tên -> confidence ambiguous, trả về cả 2, không tự chọn)/CHARACTERIZATION(suggested_score_delta AI đề xuất vượt biên bị kẹp [-10,10]) |
| R150 | R150 | green | server/test/integration-voice-secure-command.test.js | happy(propose->confirm tạo interaction + đổi relationship_score đúng 1 lần)/forbidden(user khác không confirm được proposal của người khác)/invalid(proposal hết hạn -> 410)/happy(confirm 2 lần cùng idempotencyKey -> idempotent, không tạo trùng)/invalid(confirm 2 lần khác idempotencyKey -> 409 lần 2)/CHARACTERIZATION(relationship_score bị đổi song song giữa propose/confirm -> optimistic-concurrency CAS từ chối riêng phần điểm, interaction vẫn được tạo)/happy(không có suggested_score_delta -> không đụng people)/forbidden(quyền bị rút giữa propose/confirm -> re-check tại confirm, không tin quyền lúc propose) |
| JOB-REMINDER | — | green | server/test/integration-jobs.test.js | happy(tạo log in-app đúng ngày/seq, emailed=0 vì mailer tắt trong test)/happy(gọi tuần tự lần 2 idempotent, không trùng)/CHARACTERIZATION G1A.4 R3-02C(reminder_log KHÔNG có UNIQUE trên date_id+occur_date+seq+channel+recipient_user_id -> DB cho phép chèn 2 dòng trùng hệt, xác nhận tiền đề race hiện tại, KHÔNG phải test hành vi đích)/happy(notify_repeat_count>1 sinh đủ seq) |
| JOB-MONITOR-SCAN | — | green | server/test/integration-jobs.test.js | happy network-safe(runScan({triggeredBy:'auto'}) không truyền queryIds -> quét TẤT CẢ scan_queries enabled, khác route thủ công luôn yêu cầu query_ids)/happy(applySchedule() gọi lặp lại không leak timer — clearInterval() timer cũ trước khi tạo mới) |
| DB-CONTRACT-001 | DB-CONTRACT-001 | green | server/test/integration-db-contract.test.js | canonical schema có đủ 36 bảng trên cả SQLite và MySQL |
| DB-CONTRACT-002 | DB-CONTRACT-002 | green | server/test/integration-db-contract.test.js | các cột lõi + migration quan trọng (sensitive_perms, mode, matched_group, pos/neu/neg, award_id/event_id...) tồn tại trên cả driver |
| DB-CONTRACT-003 | DB-CONTRACT-003 | green | server/test/integration-db-contract.test.js | unique users.username được thực thi + round-trip insert/select giữ đúng giá trị |
| DB-CONTRACT-004 | DB-CONTRACT-004 | green | server/test/integration-db-contract.test.js | app_meta upsert cập nhật đúng một key trên cả driver |
| AI-E001..E012 (G1A.7 AI golden set) | AI-E001..AI-E012 | **green — SQLite 18/18, MySQL 18/18 (Codex 2026-08-27)** | server/test/integration-ai-golden.test.js | golden happy CÓ key + fetch mock (fake/fixture, không gọi Gemini/Internet thật) cho ĐỦ 12 luồng threat-model (`06-threat-model.md` §A), cộng 4 nhánh lỗi dùng chung tầng `gemini.js call()`. F19 đã sửa query portable tại `server/ai.js:26,30`; F20 xác định là adapter named-binding và sửa tại `server/mysql-sync.js` bằng `bindSqliteNamedParams()`; xem `01-audit-findings.md` §F19/F20. |
| BR-VAL-001 | BR-VAL-001 | green | server/test/unit-validation-formatter.test.js | rbac.js can() — matrix lookup + role/action lạ -> false |
| BR-VAL-002 | BR-VAL-001 | green | server/test/unit-validation-formatter.test.js | rbac.js can() — module có nhưng action không nằm trong danh sách (cùng test BR-VAL-001, 1 test nhiều assert) |
| BR-VAL-003 | BR-VAL-001 | green | server/test/unit-validation-formatter.test.js | rbac.js can() — role không tồn tại trong MATRIX (cùng test BR-VAL-001) |
| BR-VAL-004 | BR-VAL-004 | green | server/test/unit-validation-formatter.test.js | rbac.js canSeeSensitive() theo role, false khi role lạ |
| BR-VAL-005 | BR-VAL-005 | green | server/test/unit-validation-formatter.test.js | rbac.js allowedGroups() — sensitive_perms override, lọc nhóm lạ |
| BR-VAL-006 | BR-VAL-006 | green | server/test/unit-validation-formatter.test.js | rbac.js allowedGroups() — fallback theo role khi null/JSON hỏng |
| BR-VAL-007 | BR-VAL-007 | green | server/test/unit-validation-formatter.test.js | rbac.js allowedGroups() — user null / role không canSeeSensitive -> rỗng |
| BR-VAL-008 | BR-VAL-008 | green | server/test/unit-validation-formatter.test.js | rbac.js canSeeGroup() bọc allowedGroups() |
| BR-VAL-009 | BR-VAL-009 | green | server/test/unit-validation-formatter.test.js | rbac.js fieldGroup() — tra nhóm theo entity+field, null khi không thuộc |
| BR-VAL-010 | BR-VAL-010 | green | server/test/unit-validation-formatter.test.js | rbac.js maskRecord() — allowed===true không che gì |
| BR-VAL-011 | BR-VAL-011 | green | server/test/unit-validation-formatter.test.js | rbac.js maskRecord() — che field mật thiếu nhóm (giá trị truthy), giữ null/rỗng |
| BR-VAL-012 | BR-VAL-012 | green | server/test/unit-validation-formatter.test.js | rbac.js maskRecord() — entity không có field mật / record null |
| BR-VAL-013 | BR-VAL-013 | green | server/test/unit-validation-formatter.test.js | rbac.js maskList() áp maskRecord cho từng bản ghi |
| BR-VAL-014 | BR-VAL-014 | green | server/test/unit-validation-formatter.test.js | rbac.js permissionSummary() — string/object user, canSeeSensitive suy từ số nhóm |
| BR-VAL-015 | BR-VAL-015 | green | server/test/unit-validation-formatter.test.js | routes.js pageParams() — clamp page/pageSize, mặc định 1/20 |
| BR-VAL-016 | BR-VAL-016 | green | server/test/unit-validation-formatter.test.js | routes.js pick() — chỉ giữ field allowed, '' -> null |
| BR-VAL-017 | BR-VAL-017 | green | server/test/unit-validation-formatter.test.js | routes.js jsonField() — stringify non-string, bỏ qua null/thiếu/đã-là-string |
| BR-VAL-018 | BR-VAL-018 | green | server/test/unit-validation-formatter.test.js | routes.js senGroups()/senVisible() |
| BR-VAL-019 | BR-VAL-019 | green | server/test/unit-validation-formatter.test.js | routes.js canMoney()/maskMoney() — che field tiền theo nhóm org_fee, hỗ trợ single+array |
| BR-VAL-020 | BR-VAL-020 | green | server/test/unit-validation-formatter.test.js | routes.js stripDisallowed() — xoá field mật không thuộc nhóm khỏi payload cập nhật |
| BR-VAL-021 | BR-VAL-021 | green | server/test/unit-validation-formatter.test.js | routes.js isValidBudgetPeriod() — chỉ nhận YYYY-MM |
| BR-VAL-022 | BR-VAL-022 | green | server/test/unit-validation-formatter.test.js | routes.js isValidNewUserPayload() — bắt buộc username/password/full_name + role hợp lệ |
| BR-VAL-023 | BR-VAL-023 | green | server/test/unit-validation-formatter.test.js | routes.js sanitizeSensitivePerms() — lọc nhóm lạ khỏi ALL_GROUPS |
| BR-VAL-024 | BR-VAL-024 | green | server/test/unit-validation-formatter.test.js | routes.js nextOccurrence() — một lần vs lặp lại, tự cộng năm khi đã qua |
| BR-VAL-025 | BR-VAL-025 | green | server/test/unit-validation-formatter.test.js | routes.js decorateDates() — dueSoon theo lead_days, null khi thiếu ngày |
| BR-VAL-026 | BR-VAL-026 | green | server/test/unit-validation-formatter.test.js | routes.js deadlineInfo() — null khi thiếu/sai ngày, tính theo giờ VN (UTC+7) |
| BR-VAL-027 | BR-VAL-027 | green | server/test/unit-validation-formatter.test.js | routes.js jarr() — mảng/JSON string/parse lỗi -> [] |
| BR-VAL-028 | BR-VAL-028 | green | server/test/unit-validation-formatter.test.js | routes.js periodOf() — mặc định 30 ngày; "from" mặc định KHÔNG phụ thuộc "to" đã truyền (đặc tả hiện trạng) |
| BR-VAL-029 | BR-VAL-029 | green | server/test/unit-validation-formatter.test.js | routes.js campOut() — bọc keywords/competitors qua jarr() |
| BR-VAL-030 | BR-VAL-030 | green | server/test/unit-validation-formatter.test.js | spreadsheet-parser.js validateSignature() — quá MAX_FILE_BYTES |
| BR-VAL-031 | BR-VAL-031 | green | server/test/unit-validation-formatter.test.js | spreadsheet-parser.js validateSignature() — CSV chứa byte NUL |
| BR-VAL-032 | BR-VAL-032 | green | server/test/unit-validation-formatter.test.js | spreadsheet-parser.js validateSignature() — signature ZIP(xlsx)/OLE(xls) hợp lệ/không hợp lệ |
| BR-VAL-033 | BR-VAL-033 | green | server/test/unit-validation-formatter.test.js | uploads.js fileFilter() — mimetype ngoài ALLOWED bị từ chối |
| BR-VAL-034 | BR-VAL-034 | green | server/test/unit-validation-formatter.test.js | uploads.js aiDocumentFileFilter() — yêu cầu ĐỒNG THỜI mimetype + đuôi file hợp lệ |
| BR-VAL-035 | BR-VAL-035 | green | server/security.test.js | spreadsheet-parser.js parseSpreadsheet() — đọc file Excel hợp lệ, trả text cho AI (test có trước G1A.2, nay gắn BR-id) |
| BR-VAL-036 | BR-VAL-036 | green | server/security.test.js | spreadsheet-parser.js parseSpreadsheet() — lấy mẫu (sampling) khi file lớn, không đưa toàn bộ dữ liệu |
| BR-VAL-037 | BR-VAL-037 | green | server/security.test.js | spreadsheet-parser.js parseSpreadsheet() — từ chối file giả mạo phần mở rộng Excel (qua validateSignature, đi hết pipeline worker) |
| BR-VAL-038 | BR-VAL-038 | green | server/security.test.js | spreadsheet-parser.js parseSpreadsheet() — ẩn thông tin liên hệ (redactTextForAi) trước khi đưa nội dung file cho AI |
| BR-VAL-039 | BR-VAL-039 | green | server/security.test.js | spreadsheet-parser.js redactTextForAi() — ẩn thông tin liên hệ trong nội dung dán trực tiếp |
| BR-VAL-040 | BR-VAL-040 | green | server/security.test.js | mailer.js validateRecipient() — từ chối email chứa CRLF/nhóm lồng nhau (chống header injection) |
| BR-SSRF-001 | BR-SSRF-001 | green | server/test/unit-ssrf-security.test.js | monitor.js stripTags() — loại tag HTML + entity đơn giản |
| BR-SSRF-002 | BR-SSRF-002 | green | server/test/unit-ssrf-security.test.js | monitor.js decodeEntities() — giải mã CDATA + entity HTML cơ bản |
| BR-SSRF-003 | BR-SSRF-003 | green | server/test/unit-ssrf-security.test.js | monitor.js fetchText() — trả text khi HTTP OK, đúng User-Agent/Accept (fetch giả DI) |
| BR-SSRF-004 | BR-SSRF-004 | green | server/test/unit-ssrf-security.test.js | monitor.js fetchText() — throw "HTTP <status>" khi response không OK |
| BR-SSRF-005 | BR-SSRF-005 | green | server/test/unit-ssrf-security.test.js | monitor.js fetchText() — abort sau timeoutMs qua AbortController |
| BR-SSRF-006 | BR-SSRF-006 | green | server/test/unit-ssrf-security.test.js | monitor.js resolveLink() — trích <title>, dùng res.url thật theo redirect |
| BR-SSRF-007 | BR-SSRF-007 | green | server/test/unit-ssrf-security.test.js | monitor.js resolveLink() — fallback {url,title:''} khi fetch lỗi, không throw |
| BR-SSRF-008 | BR-SSRF-008 | green | server/test/unit-ssrf-security.test.js | monitor.js classifyHost() — nhận diện nền tảng theo host, mặc định 'web', bỏ www. |
| BR-SSRF-009 | BR-SSRF-009 | green | server/test/unit-ssrf-security.test.js | monitor.js hostOf() — tự thêm scheme, bỏ www., fallback khi URL không parse được |
| BR-SSRF-010 | BR-SSRF-010 | green | server/test/unit-ssrf-security.test.js | resolveLink() fail-closed với loopback/RFC1918/link-local/metadata, không gọi fetch |
| BR-SSRF-011 | BR-SSRF-011 | green | server/test/unit-ssrf-security.test.js | detectFeed() chặn metadata URL trước outbound fetch |
| BR-SSRF-012 | BR-SSRF-012 | green | server/test/unit-ssrf-security.test.js | ai.js stripHtml() — loại script/style trước tag khác, gộp khoảng trắng, cắt 20000 ký tự |
| BR-SSRF-013 | BR-SSRF-013 | green | server/test/unit-ssrf-security.test.js | ai.js limitEventExtract() — tối đa 8 lần/60s theo user, lần 9 trả 429 |
| BR-SSRF-014 | BR-SSRF-014 | green | server/test/unit-ssrf-security.test.js | ai.js limitEventExtract() — cửa sổ trượt 60s, request cũ hết hạn khỏi bộ đếm |
| BR-SSRF-015 | BR-SSRF-015 | green | server/test/unit-ssrf-security.test.js | ai.js limitEventExtract() — đếm riêng theo từng user (key session.user.id) |
| BR-SSRF-016 | BR-SSRF-016 | green | server/test/integration-ai.test.js | ai.js POST /award-extract chặn URL loopback trước outbound fetch/Gemini, trả 400 |
| BR-SSRF-017 | BR-SSRF-017 | green | server/test/unit-ssrf-security.test.js | monitor.js parseFeed() — trích item RSS đầy đủ (title/link/desc/pub/source), decode entity, loại tag HTML thật |
| BR-SSRF-018 | BR-SSRF-018 | green | server/test/unit-ssrf-security.test.js | monitor.js parseFeed() — lấy link từ <link href> (Atom) khi không có <link>text</link>, bỏ item thiếu title/link |
| BR-SSRF-019 | BR-SSRF-019 | green | server/test/unit-ssrf-security.test.js | monitor.js parseFeed() — đặc tả thứ tự xử lý: decode entity TRƯỚC strip tag, nên text escape dạng "&lt;x&gt;" bị hiểu thành tag thật và bị xoá |
| BR-SSRF-020 | BR-SSRF-020 | green | server/test/unit-ssrf-security.test.js | monitor.js matchTerms() — OR giữa nhóm AND, exclude thắng include, so khớp bỏ dấu tiếng Việt |
| BR-SSRF-021 | BR-SSRF-021 | green | server/test/unit-safe-fetch.test.js | normalizeHttpUrl thêm https khi thiếu scheme, URL rỗng bị chặn |
| BR-SSRF-022 | BR-SSRF-022 | green | server/test/unit-safe-fetch.test.js | fail-closed với hostname local và IPv4 private/reserved |
| BR-SSRF-023 | BR-SSRF-023 | green | server/test/unit-safe-fetch.test.js | fail-closed với IPv6 loopback/private/link-local và metadata hostname |
| BR-SSRF-024 | BR-SSRF-024 | green | server/test/unit-safe-fetch.test.js | DNS public-looking nhưng có địa chỉ private bị chặn |
| BR-SSRF-025 | BR-SSRF-025 | green | server/test/unit-safe-fetch.test.js | chỉ HTTP(S) không credential được fetch với DNS public; redirect manual |
| BR-SSRF-026 | BR-SSRF-026 | green | server/test/unit-safe-fetch.test.js | redirect tới private bị chặn trước request thứ hai |
| BR-SSRF-027 | BR-SSRF-027 | green | server/test/unit-safe-fetch.test.js | redirect public được xác thực lại trước request tiếp theo |
| BR-SSRF-028 | BR-SSRF-028 | green | server/test/unit-safe-fetch.test.js | runtime transport kết nối qua IP DNS đã xác minh, vẫn giữ hostname URL/Host |
| BR-AI-001 | BR-AI-001 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js genText() — model/temperature/x-goog-api-key đúng, nối+trim text (fetch giả DI) |
| BR-AI-002 | BR-AI-002 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js genJSON() — đúng responseSchema/responseMimeType, parse JSON trả về |
| BR-AI-003 | BR-AI-003 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js genJSON() — throw "AI trả về dữ liệu không hợp lệ." khi text không parse được |
| BR-AI-004 | BR-AI-004 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js groundedSearch() — trích text/chunks(lọc uri)/queries từ groundingMetadata |
| BR-AI-005 | BR-AI-005 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js genImage() — trích ảnh base64 đầu tiên, gửi kèm refImages |
| BR-AI-006 | BR-AI-006 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js genImage() — throw "AI không tạo được ảnh. Thử lại." khi không có ảnh |
| BR-AI-007 | BR-AI-007 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js call() — message lỗi thật hoặc fallback "Gemini HTTP <status>"; nhân tiện đặc tả nhánh retry-hết-lượt W1.9 (mock trả 429/500 mọi lần gọi) |
| F8-capability-map | supportsSamplingParams/buildGenerationConfig | green | server/test/unit-gemini-gateway.test.js | **W1.9:** model ngoài allowlist (`gemini-3.5-flash`) không được gửi kèm temperature/topP/topK — fail-safe mặc định false, không đoán model mới hỗ trợ |
| F8-retry-429 | retry 429 (phục hồi + hết lượt) | green | server/test/unit-gemini-gateway.test.js | **W1.9:** 429 retry tối đa 3 lần (1 đầu + 2 retry); phục hồi giữa chừng trả kết quả thành công, hết lượt ném message lần cuối |
| F8-retry-5xx | retry 5xx | green | server/test/unit-gemini-gateway.test.js | **W1.9:** 503 cũng được retry giống 429 (cùng `isRetryableStatus()`) |
| F8-no-retry-4xx | 4xx không retry | green | server/test/unit-gemini-gateway.test.js | **W1.9:** 400 không phải lỗi transient — ném ngay lần đầu, không lặp lại vô ích |
| F8-timeout | AbortController timeout | green | server/test/unit-gemini-gateway.test.js | **W1.9:** request treo vượt `GEMINI_TIMEOUT_MS` bị abort trong thời gian ngắn, không tự retry (chỉ retry theo response status) |
| F8-retry-golden | AI golden (quota/HTTP error, W1.9) | green | server/test/integration-ai-golden.test.js | **W1.9:** đặc tả lại characterization 429 cũ qua HTTP thật — route 502 forward message lần cuối khi hết lượt, hoặc 200 khi phục hồi giữa chừng |
| BR-AI-008 | BR-AI-008 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js ensureKey() — throw khi thiếu GEMINI_API_KEY + không có file gemini.key |
| BR-AI-009 | BR-AI-009 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js textOf() — nối part.text, trim 2 đầu, an toàn khi thiếu candidates/parts |
| BR-AI-010 | BR-AI-010 | green | server/test/unit-ai-redaction-schema.test.js | ai.js VOICE_SCHEMA — required=[transcript,summary] |
| BR-AI-011 | BR-AI-011 | green | server/test/unit-ai-redaction-schema.test.js | ai.js AWARD_SCHEMA — required=[name,ai_summary], cost:integer |
| BR-AI-012 | BR-AI-012 | green | server/test/unit-ai-redaction-schema.test.js | ai.js ADVICE_SCHEMA — required=[capability,plan] |
| BR-AI-013 | BR-AI-013 | green | server/test/unit-ai-redaction-schema.test.js | ai.js EVENT_SCHEMA — required=[name] |
| BR-AI-014 | BR-AI-014 | green | server/test/unit-ai-redaction-schema.test.js | monitor.js SENT_SCHEMA — mảng object required=[i,sentiment,summary], sentiment enum 3 giá trị |
| BR-AI-015 | BR-AI-015 | green | server/test/unit-ai-redaction-schema.test.js | **ĐÃ SỬA — W1.AI-POLICY (Claude 2026-08-30):** monitor.js analyzeBatch() nay gọi redactTextForAi() trước khi đưa content vào prompt gửi Gemini — test cập nhật để xác nhận PII (SĐT/email) đã bị thay bằng placeholder, không còn xuất hiện thô. Trước đây là characterization mô tả gap, nay là regression test cho hành vi đã fix |
| BR-AI-016 | BR-AI-016 | green | server/test/unit-ai-redaction-schema.test.js | monitor.js analyzeBatch() — map kết quả theo đúng chỉ số "i", trả [] khi genJSON không trả mảng |
| BR-AI-017 | BR-AI-017 | green | server/test/integration-ai.test.js | **ĐÃ SỬA — W1.AI-POLICY (Claude 2026-08-30):** ai.js POST /award-extract — cả nhánh req.body.text lẫn nhánh URL (qua stripHtml) nay đều gọi redactTextForAi() trước khi đưa vào prompt gửi Gemini, cùng chuẩn với /event-extract. Test mới mock gemini.genJSON, xác nhận SĐT/email không xuất hiện thô trong prompt |
| BR-AI-018 | — | TODO | — | monitor.js analyzePending() (DB-coupled: đọc/ghi bảng mentions) — đã quyết định chuyển sang G1A.8 (test scheduler/monitor mức job), KHÔNG kiểm ở G1A.2 vốn chỉ characterize helper thuần/DI |
| BR-CALC-001 | BR-CALC-001 | green | server/test/unit-projections-calculations.test.js | routes.js nsrOf() — công thức Net Sentiment Ratio, 0 khi mẫu số rỗng (trích từ 3 nơi lặp: /monitor/dashboard tổng+trend, /monitor/campaigns/:id/results) |
| BR-CALC-002 | BR-CALC-002 | green | server/test/unit-projections-calculations.test.js | routes.js nsrOf() — làm tròn đúng 2 chữ số thập phân |
| BR-CALC-003 | BR-CALC-003 | green | server/test/unit-projections-calculations.test.js | routes.js careRiskLevel() — đúng biên 5 cấp rủi ro chăm sóc tại 7/14/21/30 ngày (GET /reports) |
| BR-CALC-004 | BR-CALC-004 | green | server/test/unit-projections-calculations.test.js | routes.js bucketOf() — đúng biên mốc 1/3/6/12 tháng, null khi <30 ngày (GET /reports/care-alerts) |
| BR-CALC-005 | BR-CALC-005 | green | server/test/unit-projections-calculations.test.js | routes.js crisisOf() — đúng ngưỡng >=3 tin tiêu cực/24h (GET /monitor/dashboard) |
| BR-CALC-006 | BR-CALC-006 | green | server/test/unit-projections-calculations.test.js | routes.js sentimentScore() — map sắc thái người sửa tay -> điểm, null khi giá trị khác (PUT /monitor/mentions/:id) |
| BR-CALC-007 | BR-CALC-007 | green | server/test/unit-projections-calculations.test.js | routes.js awardCostOf() — tổng chi phí giải thưởng = cost gốc+tổng budget tham gia+chi phí booking (GET /reports/awards) |
| BR-CALC-008 | BR-CALC-008 | green | server/test/unit-projections-calculations.test.js | routes.js awardCostOf() — null-guard cost/participations rỗng, chỉ còn mediaCost |
| BR-CALC-009 | BR-CALC-009 | green | server/test/integration-reports.test.js | happy CHARACTERIZATION: routes.js /reports/by-staff avgScore (`ROUND(AVG(p.relationship_score))`) = null khi nhân sự có đầu mối org/award nhưng không có đầu mối person nào (AVG() tập rỗng trả NULL, không JS-side guard về 0). Phát hiện thêm khi viết test này (F18): avgScore/spend chưa Number()-wrap, mysql2 trả string — đã fix cùng F18 |
| BR-CALC-010 | BR-CALC-010 | green | server/test/integration-reports.test.js | happy: routes.js /reports grandTotal (`totalSpend.s + evTotal + feeTotal`) cộng đúng số cả 2 driver (F14, đã xanh từ batch reports-awards); mở rộng thêm (F18): mọi mảng breakdown dùng để vẽ chart (spend.byMonth/byOrg/byPerson/byType/byStaff, fulfillment, events.byCategory/byEvent, fees.byOrg, tiers) cũng đã Number()-wrap, trước đây bị bỏ sót |
| F2-fixation | F2-fixation | green | server/test/target-session-f2.test.js | **W1.7 (2026-08-30):** implement thật `req.session.regenerate()` trong `auth.login()` — promote từ known-red sang assertion xanh thật, entry xoá khỏi `memory-bank/g1b-allowlist.json` |
| F2-ratelimit | F2-ratelimit | green | server/test/target-session-f2.test.js | **W1.7 (2026-08-30):** implement thật `server/login-rate-limiter.js` (429 sau quá 5 lần sai/IP+username, khoá **30 phút** kể từ đúng lần sai thứ 5 — owner chốt lại 2026-08-30, trước đó là cửa sổ 15 phút tính từ lần sai đầu tiên) — promote từ known-red sang assertion xanh thật, entry xoá khỏi `memory-bank/g1b-allowlist.json`. Đơn vị chi tiết xem BR-AUTH-001..007 |
| BR-AUTH-001 | BR-AUTH-001 | green | server/test/unit-login-rate-limiter.test.js | Chưa đủ 5 lần sai liên tiếp thì `isBlocked()` vẫn `false` |
| BR-AUTH-002 | BR-AUTH-002 | green | server/test/unit-login-rate-limiter.test.js | Đúng lần sai thứ 5 thì `isBlocked()` chuyển `true` ngay |
| BR-AUTH-003 | BR-AUTH-003 | green | server/test/unit-login-rate-limiter.test.js | Khoá đúng 30 phút kể từ lần sai thứ 5 — còn khoá ở mốc 29:59, hết khoá đúng ở mốc 30:00 (clock giả qua tham số `now`) |
| BR-AUTH-004 | BR-AUTH-004 | green | server/test/unit-login-rate-limiter.test.js | Hết khoá thì đếm lại từ đầu — 1 lần sai kế tiếp chưa bị khoá lại ngay |
| BR-AUTH-005 | BR-AUTH-005 | green | server/test/unit-login-rate-limiter.test.js | `recordSuccess()` xoá hẳn lịch sử sai, không cộng dồn qua lần đăng nhập sau |
| BR-AUTH-006 | BR-AUTH-006 | green | server/test/unit-login-rate-limiter.test.js | Khoá theo từng cặp (IP, username) riêng — không lẫn giữa 2 user hoặc 2 IP khác nhau |
| BR-AUTH-007 | BR-AUTH-007 | green | server/test/unit-login-rate-limiter.test.js | Không có request nào gọi thêm `recordFailure()` trong lúc đang khoá (đúng luồng auth.js) thì mốc hết khoá không bị đẩy xa hơn 30 phút |
| BR-FK-001 | BR-FK-001 | green | server/test/unit-mysql-sync-translate.test.js | **F15 đã sửa (2026-08-30):** cột `REFERENCES ... ON DELETE CASCADE` inline (SQLite) chuyển thành `CONSTRAINT ... FOREIGN KEY` out-of-line thật cho MySQL, không còn dạng inline mà MySQL âm thầm bỏ qua |
| BR-FK-002 | BR-FK-002 | green | server/test/unit-mysql-sync-translate.test.js | `ON DELETE SET NULL` giữ đúng action, không bị đổi thành CASCADE mặc định |
| BR-FK-003 | BR-FK-003 | green | server/test/unit-mysql-sync-translate.test.js | `REFERENCES` không có `ON DELETE` vẫn tạo FK, không tự thêm CASCADE ngoài ý muốn |
| BR-FK-004 | BR-FK-004 | green | server/test/unit-mysql-sync-translate.test.js | Nhiều FK trong cùng 1 bảng đều được tách ra đủ (không chỉ FK đầu tiên) |
| BR-FK-005 | BR-FK-005 | green | server/test/unit-mysql-sync-translate.test.js | Bảng không có `REFERENCES` nào thì không đổi gì (không thêm FK giả) |
| BR-FK-006 | BR-FK-006 | green | server/test/unit-mysql-sync-translate.test.js | `NOT NULL` trên cột có `REFERENCES` vẫn được giữ nguyên sau khi tách FK ra |
| BR-FK-007 | BR-FK-007 | green | server/test/unit-mysql-sync-translate.test.js | Round-trip thật trên MySQL (chỉ chạy khi `DB_CLIENT=mysql`): `information_schema.KEY_COLUMN_USAGE` xác nhận đúng 1 FK `award_participations.award_id -> awards.id` tồn tại thật |
| F2-logout | F2-logout-invalidation | green | server/test/target-session-f2.test.js | CHARACTERIZATION: sau `POST /api/logout`, cookie cũ dùng lại `/api/me` trả 401 — `req.session.destroy()` đã đúng từ trước, không cần known-red |
| F2-audit-login | W1.7 audit: login sai mật khẩu | green | server/test/target-session-f2.test.js | **W1.7:** login thất bại ghi `audit_log` action=LOGIN_FAILED (trước đây chỉ LOGIN thành công được audit) |
| F2-audit-logout | W1.7 audit: logout | green | server/test/target-session-f2.test.js | **W1.7:** logout ghi `audit_log` action=LOGOUT trước khi `session.destroy()` |
| F2-failfast-secret | production fail-fast | green | server/test/integration-session-production.test.js | **W1.7:** `createApp()` throw khi `NODE_ENV=production` và thiếu `SESSION_SECRET` (không còn rơi về default không an toàn) |
| F2-secure-cookie | production: cookie Secure | green | server/test/integration-session-production.test.js | **W1.7:** cookie session có thuộc tính `Secure` khi `NODE_ENV=production` (`trust proxy` + `X-Forwarded-Proto: https`, mô phỏng Cloud Run) |
| BR-ERR-001 | BR-ERR-001 | green | server/test/unit-error-contract.test.js | **W2.1 (2026-08-30):** `requestIdMiddleware()` gắn `req.requestId` dạng `req_<24-hex>` + đặt header `X-Request-Id` cùng giá trị cho mọi request |
| BR-ERR-002 | BR-ERR-002 | green | server/test/unit-error-contract.test.js | **W2.1:** 2 request liên tiếp có `requestId` khác nhau (không trùng/tái sử dụng) |
| BR-ERR-003 | BR-ERR-003 | green | server/test/unit-error-contract.test.js | **W2.1:** `sendError()` — điểm serialize DUY NHẤT cho response lỗi mới — ghi đúng `status`/`code`/`message`, `error===message` ký tự-cho-ký tự, `requestId` lấy từ `req.requestId` |
| BR-ERR-004 | BR-ERR-004 | green | server/test/unit-error-contract.test.js | **W2.1:** field `details` (optional) chỉ xuất hiện trong body khi được truyền vào `sendError()` |
| BR-ERR-005 | BR-ERR-005 | green | server/test/unit-error-contract.test.js | **W2.1:** `sendError()` không throw khi `req.requestId` chưa có (job nền/test thiếu middleware) — `requestId` trong body là `undefined` |
| BR-ERR-006 | BR-ERR-006 | green | server/test/integration-error-contract.test.js | **W2.1:** `POST /api/login` sai mật khẩu trả đúng envelope `{code:'UNAUTHENTICATED', message, error===message, requestId}`, `requestId` khớp header `X-Request-Id` |
| BR-ERR-007 | BR-ERR-007 | green | server/test/integration-error-contract.test.js | **W2.1:** `requireAuth` (không cookie) trả đúng envelope `code:'UNAUTHENTICATED'` |
| BR-ERR-008 | BR-ERR-008 | green | server/test/integration-error-contract.test.js | **W2.1:** `requirePerm` từ chối `pr_staff` trên `admin.view` (`GET /api/admin/users`) trả đúng envelope `code:'FORBIDDEN_MODULE'` |
| BR-ERR-009 | BR-ERR-009 | green | server/test/integration-error-contract.test.js | **W2.1:** brute-force login (F2 rate-limiter) trả đúng envelope `code:'RATE_LIMITED'` — code ổn định, không chỉ message tự do |
| BR-ERR-010 | BR-ERR-010 | green | server/test/integration-error-contract.test.js | **W2.1:** mọi response (kể cả 200) đều có header `X-Request-Id`; 2 request khác nhau có id khác nhau |
| N1-explicit-action | N1-explicit-action | green | server/test/target-n1-n2-explicit-permission.test.js | **ĐÃ SỬA — Wave 1 nhánh security (Claude 2026-08-30):** 4 route side-effect (notifications/:id/read, notifications/read-all, reminders/run, monitor/alerts/:id/read) nay dùng action tường minh `ack`/`run` thay vì tái dùng `view`; `rbac.js` MATRIX thêm `ack`/`run` cho cả 2 role. Promote từ known-red sang assertion xanh, entry xoá khỏi g1b-allowlist.json |
| INFRA-known-red-selftest | known-red self-test | known-red | server/test/target-session-f2.test.js | **KHÔNG phải finding thật.** Fixture tự-test cơ chế `known-red()` (G1B.6) chính nó (`server/test-support/known-red-fixture.js`, 3 kịch bản match/mismatch/missing-expectedError) — trước đây mượn tạm entry N1-explicit-action vì luôn có 1 known-red thật chưa sửa; nay N1/N2 đã sửa xong nên tách hẳn thành id infra riêng, allowlist `{owner:backend, expiry:2099-12-31, wave:infra}`, không phụ thuộc còn finding thật nào mở |
| UI-CHAR-001 | UI-CHAR-001 | green | server/test/ui-characterization.test.js | G1A.6: 14 module desktop trong NAV đều có resolver `VIEWS` tương ứng; runtime smoke Admin kiểm tra đủ 14 hash route tại 2026-08-30. Đây là evidence desktop hiện trạng, không phải MDS pass. |
| UI-CHAR-002 | UI-CHAR-002 | green | server/test/ui-characterization.test.js | G1A.6: Vue shell tạo mount point và nạp `public/app.js` sau `nextTick`; khóa kiến trúc hybrid đang chạy để slice sau cập nhật có chủ đích. |
| UI-CHAR-003 | UI-CHAR-003 | green | server/test/ui-characterization.test.js | G1A.6: Section B.2 có 34 flow/145 route; mỗi flow ghi `N-MISSING` cho cả 2 role current-state. `green` nghĩa là matrix trung thực, không nghĩa Native-Mobile đạt. |
| UI-CHAR-004 | UI-CHAR-004 | green | server/test/ui-characterization.test.js | G1A.6: source/runtime characterize compact là desktop responsive; không có `.mds-mobile-app`/native bottom nav. F5 P0 vẫn mở đến W4.1 + native slice/device evidence. |
| UI-CHAR-005 | UI-CHAR-005 | green | server/test/ui-characterization.test.js | W3 native strangler: mọi route ref phải được clear trước resolver chain claim hash mới, tránh giữ mini-app Vue cũ trên DOM (F31). Fake-native 390×844 kiểm chứng 10 hash liên tiếp đều chỉ có một root visible; AMIS device evidence vẫn thuộc O3/W4. |
| N2-dashboard-permission | N2-dashboard-permission | green | server/test/target-n1-n2-explicit-permission.test.js | **ĐÃ SỬA — Wave 1 nhánh security (Claude 2026-08-30):** `GET /dashboard` nay có `requirePerm('dashboard','view')`; `rbac.js` khai module `dashboard`, MATRIX cấp `['view']` cho cả 2 role. Promote từ known-red sang assertion xanh, entry xoá khỏi g1b-allowlist.json |
