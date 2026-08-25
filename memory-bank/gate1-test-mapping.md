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

| route_id | test_id | status | file | note |
|---|---|---|---|---|
| R001 | — | TODO | — | — |
| R002 | — | TODO | — | — |
| R003 | — | TODO | — | — |
| R004 | — | TODO | — | — |
| R005 | — | TODO | — | — |
| R006 | — | TODO | — | — |
| R007 | — | TODO | — | — |
| R008 | — | TODO | — | — |
| R009 | — | TODO | — | — |
| R010 | — | TODO | — | — |
| R011 | — | TODO | — | — |
| R012 | — | TODO | — | — |
| R013 | — | TODO | — | — |
| R014 | — | TODO | — | — |
| R015 | — | TODO | — | — |
| R016 | — | TODO | — | — |
| R017 | — | TODO | — | — |
| R018 | — | TODO | — | — |
| R019 | — | TODO | — | — |
| R020 | — | TODO | — | — |
| R021 | — | TODO | — | — |
| R022 | — | TODO | — | — |
| R023 | — | TODO | — | — |
| R024 | — | TODO | — | — |
| R025 | — | TODO | — | — |
| R026 | — | TODO | — | — |
| R027 | — | TODO | — | — |
| R028 | — | TODO | — | — |
| R029 | — | TODO | — | — |
| R030 | — | TODO | — | — |
| R031 | — | TODO | — | — |
| R032 | — | TODO | — | — |
| R033 | — | TODO | — | — |
| R034 | — | TODO | — | — |
| R035 | — | TODO | — | — |
| R036 | — | TODO | — | — |
| R037 | — | TODO | — | — |
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
| R099 | — | TODO | — | — |
| R100 | — | TODO | — | — |
| R101 | — | TODO | — | — |
| R102 | — | TODO | — | — |
| R103 | — | TODO | — | — |
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
| R143 | — | TODO | — | — |
| R144 | — | TODO | — | — |
| R145 | — | TODO | — | — |
| JOB-REMINDER | — | TODO | — | scheduler.js runOnce() — G1A.4 (race hiện tại)/G1A.8 |
| JOB-MONITOR-SCAN | — | TODO | — | monitor.js runScan()/applySchedule() — G1A.8 |
| BR-VAL-001 | UT-VAL-001 | green | server/test/unit-validation-formatter.test.js | rbac.js can() — matrix lookup + role/action lạ -> false |
| BR-VAL-002 | UT-VAL-001 | green | server/test/unit-validation-formatter.test.js | rbac.js can() — module có nhưng action không nằm trong danh sách |
| BR-VAL-003 | UT-VAL-001 | green | server/test/unit-validation-formatter.test.js | rbac.js can() — role không tồn tại trong MATRIX |
| BR-VAL-004 | UT-VAL-002 | green | server/test/unit-validation-formatter.test.js | rbac.js canSeeSensitive() theo role, false khi role lạ |
| BR-VAL-005 | UT-VAL-003 | green | server/test/unit-validation-formatter.test.js | rbac.js allowedGroups() — sensitive_perms override, lọc nhóm lạ |
| BR-VAL-006 | UT-VAL-004 | green | server/test/unit-validation-formatter.test.js | rbac.js allowedGroups() — fallback theo role khi null/JSON hỏng |
| BR-VAL-007 | UT-VAL-005 | green | server/test/unit-validation-formatter.test.js | rbac.js allowedGroups() — user null / role không canSeeSensitive -> rỗng |
| BR-VAL-008 | UT-VAL-006 | green | server/test/unit-validation-formatter.test.js | rbac.js canSeeGroup() bọc allowedGroups() |
| BR-VAL-009 | UT-VAL-007 | green | server/test/unit-validation-formatter.test.js | rbac.js fieldGroup() — tra nhóm theo entity+field, null khi không thuộc |
| BR-VAL-010 | UT-VAL-008 | green | server/test/unit-validation-formatter.test.js | rbac.js maskRecord() — allowed===true không che gì |
| BR-VAL-011 | UT-VAL-009 | green | server/test/unit-validation-formatter.test.js | rbac.js maskRecord() — che field mật thiếu nhóm (giá trị truthy), giữ null/rỗng |
| BR-VAL-012 | UT-VAL-010 | green | server/test/unit-validation-formatter.test.js | rbac.js maskRecord() — entity không có field mật / record null |
| BR-VAL-013 | UT-VAL-011 | green | server/test/unit-validation-formatter.test.js | rbac.js maskList() áp maskRecord cho từng bản ghi |
| BR-VAL-014 | UT-VAL-012 | green | server/test/unit-validation-formatter.test.js | rbac.js permissionSummary() — string/object user, canSeeSensitive suy từ số nhóm |
| BR-VAL-015 | UT-VAL-013 | green | server/test/unit-validation-formatter.test.js | routes.js pageParams() — clamp page/pageSize, mặc định 1/20 |
| BR-VAL-016 | UT-VAL-014 | green | server/test/unit-validation-formatter.test.js | routes.js pick() — chỉ giữ field allowed, '' -> null |
| BR-VAL-017 | UT-VAL-015 | green | server/test/unit-validation-formatter.test.js | routes.js jsonField() — stringify non-string, bỏ qua null/thiếu/đã-là-string |
| BR-VAL-018 | UT-VAL-016 | green | server/test/unit-validation-formatter.test.js | routes.js senGroups()/senVisible() |
| BR-VAL-019 | UT-VAL-017 | green | server/test/unit-validation-formatter.test.js | routes.js canMoney()/maskMoney() — che field tiền theo nhóm org_fee, hỗ trợ single+array |
| BR-VAL-020 | UT-VAL-018 | green | server/test/unit-validation-formatter.test.js | routes.js stripDisallowed() — xoá field mật không thuộc nhóm khỏi payload cập nhật |
| BR-VAL-021 | UT-VAL-019 | green | server/test/unit-validation-formatter.test.js | routes.js isValidBudgetPeriod() — chỉ nhận YYYY-MM |
| BR-VAL-022 | UT-VAL-020 | green | server/test/unit-validation-formatter.test.js | routes.js isValidNewUserPayload() — bắt buộc username/password/full_name + role hợp lệ |
| BR-VAL-023 | UT-VAL-021 | green | server/test/unit-validation-formatter.test.js | routes.js sanitizeSensitivePerms() — lọc nhóm lạ khỏi ALL_GROUPS |
| BR-VAL-024 | UT-VAL-022 | green | server/test/unit-validation-formatter.test.js | routes.js nextOccurrence() — một lần vs lặp lại, tự cộng năm khi đã qua |
| BR-VAL-025 | UT-VAL-023 | green | server/test/unit-validation-formatter.test.js | routes.js decorateDates() — dueSoon theo lead_days, null khi thiếu ngày |
| BR-VAL-026 | UT-VAL-024 | green | server/test/unit-validation-formatter.test.js | routes.js deadlineInfo() — null khi thiếu/sai ngày, tính theo giờ VN (UTC+7) |
| BR-VAL-027 | UT-VAL-025 | green | server/test/unit-validation-formatter.test.js | routes.js jarr() — mảng/JSON string/parse lỗi -> [] |
| BR-VAL-028 | UT-VAL-026 | green | server/test/unit-validation-formatter.test.js | routes.js periodOf() — mặc định 30 ngày; "from" mặc định KHÔNG phụ thuộc "to" đã truyền (đặc tả hiện trạng) |
| BR-VAL-029 | UT-VAL-027 | green | server/test/unit-validation-formatter.test.js | routes.js campOut() — bọc keywords/competitors qua jarr() |
| BR-VAL-030 | UT-VAL-028 | green | server/test/unit-validation-formatter.test.js | spreadsheet-parser.js validateSignature() — quá MAX_FILE_BYTES |
| BR-VAL-031 | UT-VAL-029 | green | server/test/unit-validation-formatter.test.js | spreadsheet-parser.js validateSignature() — CSV chứa byte NUL |
| BR-VAL-032 | UT-VAL-030 | green | server/test/unit-validation-formatter.test.js | spreadsheet-parser.js validateSignature() — signature ZIP(xlsx)/OLE(xls) hợp lệ/không hợp lệ |
| BR-VAL-033 | UT-VAL-031 | green | server/test/unit-validation-formatter.test.js | uploads.js fileFilter() — mimetype ngoài ALLOWED bị từ chối |
| BR-VAL-034 | UT-VAL-032 | green | server/test/unit-validation-formatter.test.js | uploads.js aiDocumentFileFilter() — yêu cầu ĐỒNG THỜI mimetype + đuôi file hợp lệ |
| BR-SSRF-001 | UT-SSRF-001 | green | server/test/unit-ssrf-security.test.js | monitor.js stripTags() — loại tag HTML + entity đơn giản |
| BR-SSRF-002 | UT-SSRF-002 | green | server/test/unit-ssrf-security.test.js | monitor.js decodeEntities() — giải mã CDATA + entity HTML cơ bản |
| BR-SSRF-003 | UT-SSRF-003 | green | server/test/unit-ssrf-security.test.js | monitor.js fetchText() — trả text khi HTTP OK, đúng User-Agent/Accept (fetch giả DI) |
| BR-SSRF-004 | UT-SSRF-004 | green | server/test/unit-ssrf-security.test.js | monitor.js fetchText() — throw "HTTP <status>" khi response không OK |
| BR-SSRF-005 | UT-SSRF-005 | green | server/test/unit-ssrf-security.test.js | monitor.js fetchText() — abort sau timeoutMs qua AbortController |
| BR-SSRF-006 | UT-SSRF-006 | green | server/test/unit-ssrf-security.test.js | monitor.js resolveLink() — trích <title>, dùng res.url thật theo redirect |
| BR-SSRF-007 | UT-SSRF-007 | green | server/test/unit-ssrf-security.test.js | monitor.js resolveLink() — fallback {url,title:''} khi fetch lỗi, không throw |
| BR-SSRF-008 | UT-SSRF-008 | green | server/test/unit-ssrf-security.test.js | monitor.js classifyHost() — nhận diện nền tảng theo host, mặc định 'web', bỏ www. |
| BR-SSRF-009 | UT-SSRF-009 | green | server/test/unit-ssrf-security.test.js | monitor.js hostOf() — tự thêm scheme, bỏ www., fallback khi URL không parse được |
| BR-SSRF-010 | UT-SSRF-010 | known-red | server/test/unit-ssrf-security.test.js | ĐẶC TẢ lỗ hổng đang tồn tại: resolveLink() gọi fetch thẳng tới host nội bộ/RFC1918/link-local/metadata IP do caller truyền, KHÔNG có allowlist/denylist. KHÔNG fix trong G1A.2 — allowlist/deny thật chuyển sang G1B.4 (SSRF matrix F3), owner: chưa gán, chưa có expiry — cần bổ sung allowlist {F3, owner, expiry} trước khi Gate 1 đóng theo §G1B.6 |
| BR-SSRF-011 | UT-SSRF-011 | known-red | server/test/unit-ssrf-security.test.js | ĐẶC TẢ lỗ hổng đang tồn tại: detectFeed() (nguồn gọi thật: POST /monitor/sources, R-id xem 07-route-catalog.md) gọi fetchText() thẳng tới host nội bộ/metadata do người dùng nhập, KHÔNG có guard. Cùng chuyển G1B.4 như BR-SSRF-010, chưa gán owner/expiry |
| BR-SSRF-012 | UT-SSRF-012 | green | server/test/unit-ssrf-security.test.js | ai.js stripHtml() — loại script/style trước tag khác, gộp khoảng trắng, cắt 20000 ký tự |
| BR-SSRF-013 | UT-SSRF-013 | green | server/test/unit-ssrf-security.test.js | ai.js limitEventExtract() — tối đa 8 lần/60s theo user, lần 9 trả 429 |
| BR-SSRF-014 | UT-SSRF-014 | green | server/test/unit-ssrf-security.test.js | ai.js limitEventExtract() — cửa sổ trượt 60s, request cũ hết hạn khỏi bộ đếm |
| BR-SSRF-015 | UT-SSRF-015 | green | server/test/unit-ssrf-security.test.js | ai.js limitEventExtract() — đếm riêng theo từng user (key session.user.id) |
| BR-SSRF-016 | — | TODO | — | ai.js POST /award-extract (routes handler, không phải pure/DI helper) — fetch(sourceUrl) trực tiếp KHÔNG redact/allowlist khi req.body.url được cung cấp; cần test mức route (G1A.3) + guard thật (G1B.4), KHÔNG thuộc phạm vi characterization thuần của G1A.2 |
