# Gate 1 — Bảng ánh xạ route/job → test (G1A.9)

> Yêu cầu bắt buộc theo Codex C0.6 (`memory-bank/04-ROADMAP.md` §G1A): mapping
> `route_id/business_rule_id → test_id → trạng thái` phủ đủ 145/145 route + mọi
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
> Nguồn route_id: `memory-bank/07-route-catalog.md` (đã xác nhận đúng 145/145, không
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
| R007 | R007 | green | server/test/integration-partners.test.js | happy/invalid(thiếu title->400)/CHARACTERIZATION not-found — **lệch driver**: org_id lạ SQLite chặn 400 (FK PRAGMA=ON), MySQL không chặn vẫn 200 (cột REFERENCES inline không thành FOREIGN KEY thật qua translate() — ghi nhận cho G1A.5)/unauthenticated |
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
| R038 | — | TODO | — | — |
| R039 | — | TODO | — | — |
| R040 | — | TODO | — | — |
| R041 | — | TODO | — | — |
| R042 | — | TODO | — | — |
| R043 | — | TODO | — | — |
| R044 | — | TODO | — | — |
| R045 | — | TODO | — | — |
| R046 | — | TODO | — | — |
| R047 | — | TODO | — | — |
| R048 | — | TODO | — | — |
| R049 | — | TODO | — | — |
| R050 | — | TODO | — | — |
| R051 | — | TODO | — | — |
| R052 | — | TODO | — | — |
| R053 | — | TODO | — | — |
| R054 | — | TODO | — | — |
| R055 | — | TODO | — | — |
| R056 | — | TODO | — | — |
| R057 | — | TODO | — | — |
| R058 | — | TODO | — | — |
| R059 | — | TODO | — | — |
| R060 | — | TODO | — | — |
| R061 | — | TODO | — | — |
| R062 | — | TODO | — | — |
| R063 | — | TODO | — | — |
| R064 | — | TODO | — | — |
| R065 | — | TODO | — | — |
| R066 | — | TODO | — | — |
| R067 | — | TODO | — | — |
| R068 | — | TODO | — | — |
| R069 | — | TODO | — | — |
| R070 | — | TODO | — | — |
| R071 | — | TODO | — | — |
| R072 | — | TODO | — | — |
| R073 | — | TODO | — | — |
| R074 | — | TODO | — | — |
| R075 | — | TODO | — | — |
| R076 | — | TODO | — | — |
| R077 | — | TODO | — | — |
| R078 | — | TODO | — | — |
| R079 | — | TODO | — | — |
| R080 | — | TODO | — | — |
| R081 | — | TODO | — | — |
| R082 | — | TODO | — | — |
| R083 | — | TODO | — | — |
| R084 | — | TODO | — | — |
| R085 | — | TODO | — | — |
| R086 | — | TODO | — | — |
| R087 | — | TODO | — | — |
| R088 | — | TODO | — | — |
| R089 | — | TODO | — | — |
| R090 | — | TODO | — | — |
| R091 | — | TODO | — | — |
| R092 | — | TODO | — | — |
| R093 | — | TODO | — | — |
| R094 | — | TODO | — | — |
| R095 | — | TODO | — | — |
| R096 | — | TODO | — | — |
| R097 | — | TODO | — | — |
| R098 | — | TODO | — | — |
| R099 | R099 | green | server/test/integration-auth-admin.test.js | happy/unauthenticated/forbidden (không có :id/body -> không case invalid/not-found) |
| R100 | R100 | green | server/test/integration-auth-admin.test.js | happy/invalid(thiếu field, username trùng 409)/unauthenticated/forbidden |
| R101 | R101 | green | server/test/integration-auth-admin.test.js | happy/invalid(role lạ bị bỏ qua lặng lẽ)/CHARACTERIZATION not-found (id lạ vẫn 200 ok:true, không 404)/unauthenticated/forbidden |
| R102 | R102 | green | server/test/integration-auth-admin.test.js | happy/invalid(tự xoá chính mình 400)/CHARACTERIZATION not-found (id lạ vẫn 200 ok:true, không 404)/unauthenticated/forbidden |
| R103 | R103 | green | server/test/integration-auth-admin.test.js | happy/unauthenticated/forbidden (không có :id/body -> không case invalid/not-found) |
| R104 | — | TODO | — | — |
| R105 | — | TODO | — | — |
| R106 | — | TODO | — | — |
| R107 | — | TODO | — | — |
| R108 | — | TODO | — | — |
| R109 | — | TODO | — | — |
| R110 | — | TODO | — | — |
| R111 | — | TODO | — | — |
| R112 | — | TODO | — | — |
| R113 | — | TODO | — | — |
| R114 | — | TODO | — | — |
| R115 | — | TODO | — | — |
| R116 | — | TODO | — | — |
| R117 | — | TODO | — | — |
| R118 | — | TODO | — | — |
| R119 | — | TODO | — | — |
| R120 | — | TODO | — | — |
| R121 | — | TODO | — | — |
| R122 | — | TODO | — | — |
| R123 | — | TODO | — | — |
| R124 | — | TODO | — | — |
| R125 | — | TODO | — | — |
| R126 | — | TODO | — | — |
| R127 | — | TODO | — | — |
| R128 | — | TODO | — | — |
| R129 | — | TODO | — | — |
| R130 | — | TODO | — | — |
| R131 | — | TODO | — | — |
| R132 | — | TODO | — | — |
| R133 | — | TODO | — | — |
| R134 | — | TODO | — | — |
| R135 | — | TODO | — | — |
| R136 | — | TODO | — | — |
| R137 | — | TODO | — | — |
| R138 | — | TODO | — | — |
| R139 | — | TODO | — | — |
| R140 | — | TODO | — | — |
| R141 | — | TODO | — | — |
| R142 | — | TODO | — | — |
| R143 | R143 | green | server/test/integration-auth-admin.test.js | happy/invalid (không có :id -> không case not-found; đây là route đăng nhập nên "unauthenticated" không áp dụng) |
| R144 | R144 | green | server/test/integration-auth-admin.test.js | happy + CHARACTERIZATION (route không gắn requireAuth — logout không cookie vẫn 200 ok:true) |
| R145 | R145 | green | server/test/integration-auth-admin.test.js | happy/unauthenticated (không có :id/body -> không case invalid/not-found) |
| JOB-REMINDER | — | TODO | — | scheduler.js runOnce() — G1A.4 (race hiện tại)/G1A.8 |
| JOB-MONITOR-SCAN | — | TODO | — | monitor.js runScan()/applySchedule() — G1A.8 |
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
| BR-SSRF-010 | BR-SSRF-010 | green | server/test/unit-ssrf-security.test.js | CHARACTERIZATION (test xanh, KHÔNG phải target-red): resolveLink() gọi fetch thẳng tới host nội bộ/RFC1918/link-local/metadata IP do caller truyền, KHÔNG có allowlist/denylist — đây là hành vi HIỆN TẠI, test PASS vì đặc tả đúng thực trạng. Target guard thật (sẽ khiến test này phải sửa để assert bị chặn) chưa tồn tại — xem hàng TODO/known-red thật ở BR-SSRF-016 (G1B.4, chưa gán owner/expiry) |
| BR-SSRF-011 | BR-SSRF-011 | green | server/test/unit-ssrf-security.test.js | CHARACTERIZATION (test xanh, KHÔNG phải target-red): detectFeed() (nguồn gọi thật: POST /monitor/sources) gọi fetchText() thẳng tới host nội bộ/metadata do người dùng nhập, KHÔNG có guard — cùng ghi chú như BR-SSRF-010, target thật ở BR-SSRF-016 |
| BR-SSRF-012 | BR-SSRF-012 | green | server/test/unit-ssrf-security.test.js | ai.js stripHtml() — loại script/style trước tag khác, gộp khoảng trắng, cắt 20000 ký tự |
| BR-SSRF-013 | BR-SSRF-013 | green | server/test/unit-ssrf-security.test.js | ai.js limitEventExtract() — tối đa 8 lần/60s theo user, lần 9 trả 429 |
| BR-SSRF-014 | BR-SSRF-014 | green | server/test/unit-ssrf-security.test.js | ai.js limitEventExtract() — cửa sổ trượt 60s, request cũ hết hạn khỏi bộ đếm |
| BR-SSRF-015 | BR-SSRF-015 | green | server/test/unit-ssrf-security.test.js | ai.js limitEventExtract() — đếm riêng theo từng user (key session.user.id) |
| BR-SSRF-016 | — | TODO | — | TARGET (chưa có test, đây mới là hàng cần chuyển known-red khi G1B.4 viết guard thật): ai.js POST /award-extract (routes handler, không phải pure/DI helper) — fetch(sourceUrl) trực tiếp KHÔNG redact/allowlist khi req.body.url được cung cấp. Cùng nhóm target với BR-SSRF-010/011 (resolveLink/detectFeed) — 1 allowlist guard chung sẽ đóng cả 3. Cần test mức route (G1A.3) + guard thật (G1B.4, owner + expiry chưa gán), KHÔNG thuộc phạm vi characterization thuần của G1A.2 |
| BR-SSRF-017 | BR-SSRF-017 | green | server/test/unit-ssrf-security.test.js | monitor.js parseFeed() — trích item RSS đầy đủ (title/link/desc/pub/source), decode entity, loại tag HTML thật |
| BR-SSRF-018 | BR-SSRF-018 | green | server/test/unit-ssrf-security.test.js | monitor.js parseFeed() — lấy link từ <link href> (Atom) khi không có <link>text</link>, bỏ item thiếu title/link |
| BR-SSRF-019 | BR-SSRF-019 | green | server/test/unit-ssrf-security.test.js | monitor.js parseFeed() — đặc tả thứ tự xử lý: decode entity TRƯỚC strip tag, nên text escape dạng "&lt;x&gt;" bị hiểu thành tag thật và bị xoá |
| BR-SSRF-020 | BR-SSRF-020 | green | server/test/unit-ssrf-security.test.js | monitor.js matchTerms() — OR giữa nhóm AND, exclude thắng include, so khớp bỏ dấu tiếng Việt |
| BR-AI-001 | BR-AI-001 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js genText() — model/temperature/x-goog-api-key đúng, nối+trim text (fetch giả DI) |
| BR-AI-002 | BR-AI-002 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js genJSON() — đúng responseSchema/responseMimeType, parse JSON trả về |
| BR-AI-003 | BR-AI-003 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js genJSON() — throw "AI trả về dữ liệu không hợp lệ." khi text không parse được |
| BR-AI-004 | BR-AI-004 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js groundedSearch() — trích text/chunks(lọc uri)/queries từ groundingMetadata |
| BR-AI-005 | BR-AI-005 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js genImage() — trích ảnh base64 đầu tiên, gửi kèm refImages |
| BR-AI-006 | BR-AI-006 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js genImage() — throw "AI không tạo được ảnh. Thử lại." khi không có ảnh |
| BR-AI-007 | BR-AI-007 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js call() — message lỗi thật hoặc fallback "Gemini HTTP <status>" |
| BR-AI-008 | BR-AI-008 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js ensureKey() — throw khi thiếu GEMINI_API_KEY + không có file gemini.key |
| BR-AI-009 | BR-AI-009 | green | server/test/unit-ai-redaction-schema.test.js | gemini.js textOf() — nối part.text, trim 2 đầu, an toàn khi thiếu candidates/parts |
| BR-AI-010 | BR-AI-010 | green | server/test/unit-ai-redaction-schema.test.js | ai.js VOICE_SCHEMA — required=[transcript,summary] |
| BR-AI-011 | BR-AI-011 | green | server/test/unit-ai-redaction-schema.test.js | ai.js AWARD_SCHEMA — required=[name,ai_summary], cost:integer |
| BR-AI-012 | BR-AI-012 | green | server/test/unit-ai-redaction-schema.test.js | ai.js ADVICE_SCHEMA — required=[capability,plan] |
| BR-AI-013 | BR-AI-013 | green | server/test/unit-ai-redaction-schema.test.js | ai.js EVENT_SCHEMA — required=[name] |
| BR-AI-014 | BR-AI-014 | green | server/test/unit-ai-redaction-schema.test.js | monitor.js SENT_SCHEMA — mảng object required=[i,sentiment,summary], sentiment enum 3 giá trị |
| BR-AI-015 | BR-AI-015 | green | server/test/unit-ai-redaction-schema.test.js | CHARACTERIZATION (test xanh, KHÔNG phải target-red): monitor.js analyzeBatch() đưa content THÔ (chưa qua redactTextForAi) vào prompt gửi Gemini — toàn bộ pipeline quét RSS/mention KHÔNG redact PII trước khi gửi AI. Đây là hành vi HIỆN TẠI, test PASS vì đặc tả đúng thực trạng; target gateway thật chưa tồn tại — xem hàng TODO ở BR-AI-017/W1.AI-POLICY |
| BR-AI-016 | BR-AI-016 | green | server/test/unit-ai-redaction-schema.test.js | monitor.js analyzeBatch() — map kết quả theo đúng chỉ số "i", trả [] khi genJSON không trả mảng |
| BR-AI-017 | — | TODO | — | TARGET (chưa có test, đây mới là hàng cần chuyển known-red khi W1.AI-POLICY viết gateway thật): ai.js POST /award-extract — nội dung dán trực tiếp (req.body.text) và nội dung scrape từ URL (qua stripHtml, không qua redactTextForAi) đều gửi Gemini KHÔNG redact, khác với /event-extract (có redactTextForAi ở dòng tương ứng); cùng nhóm target với BR-AI-015 (analyzeBatch). Route handler, không phải pure/DI helper — cần test mức route (G1A.3) + gateway thật (W1.AI-POLICY), KHÔNG thuộc phạm vi G1A.2 |
| BR-AI-018 | — | TODO | — | monitor.js analyzePending() (DB-coupled: đọc/ghi bảng mentions) — đã quyết định chuyển sang G1A.8 (test scheduler/monitor mức job), KHÔNG kiểm ở G1A.2 vốn chỉ characterize helper thuần/DI |
| BR-CALC-001 | BR-CALC-001 | green | server/test/unit-projections-calculations.test.js | routes.js nsrOf() — công thức Net Sentiment Ratio, 0 khi mẫu số rỗng (trích từ 3 nơi lặp: /monitor/dashboard tổng+trend, /monitor/campaigns/:id/results) |
| BR-CALC-002 | BR-CALC-002 | green | server/test/unit-projections-calculations.test.js | routes.js nsrOf() — làm tròn đúng 2 chữ số thập phân |
| BR-CALC-003 | BR-CALC-003 | green | server/test/unit-projections-calculations.test.js | routes.js careRiskLevel() — đúng biên 5 cấp rủi ro chăm sóc tại 7/14/21/30 ngày (GET /reports) |
| BR-CALC-004 | BR-CALC-004 | green | server/test/unit-projections-calculations.test.js | routes.js bucketOf() — đúng biên mốc 1/3/6/12 tháng, null khi <30 ngày (GET /reports/care-alerts) |
| BR-CALC-005 | BR-CALC-005 | green | server/test/unit-projections-calculations.test.js | routes.js crisisOf() — đúng ngưỡng >=3 tin tiêu cực/24h (GET /monitor/dashboard) |
| BR-CALC-006 | BR-CALC-006 | green | server/test/unit-projections-calculations.test.js | routes.js sentimentScore() — map sắc thái người sửa tay -> điểm, null khi giá trị khác (PUT /monitor/mentions/:id) |
| BR-CALC-007 | BR-CALC-007 | green | server/test/unit-projections-calculations.test.js | routes.js awardCostOf() — tổng chi phí giải thưởng = cost gốc+tổng budget tham gia+chi phí booking (GET /reports/awards) |
| BR-CALC-008 | BR-CALC-008 | green | server/test/unit-projections-calculations.test.js | routes.js awardCostOf() — null-guard cost/participations rỗng, chỉ còn mediaCost |
| BR-CALC-009 | — | TODO | — | routes.js /reports/by-staff avgScore (dòng ~744, `ROUND(AVG(p.relationship_score))` qua SQL) — NULL không được JS-side guard khi user chưa được giao đầu mối nào; hành vi nằm trong SQL, cần test mức DB thật (MySQL canonical) ở G1A.3, không phải pure JS unit của G1A.2 |
| BR-CALC-010 | — | TODO | — | routes.js /reports grandTotal (`totalSpend.s + evTotal + feeTotal`) — phép cộng 3 giá trị đã COALESCE từ SQL, không có nhánh nghiệp vụ riêng để unit test thuần; phủ qua route-level test ở G1A.3 |
