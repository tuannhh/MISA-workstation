# 07 — Route Catalog (G0.3, machine-checkable, thay thế bản cũ)

> **Sửa sau Codex G0-audit** (FAIL — 47/135 literal path không xuất hiện nguyên dạng do bản trước nén bằng wildcard). Bản này: **1 route = 1 row, không compress, không wildcard**, tự-verify khớp 100% với source.
>
> **Verify:** `rg -o "router\.(get|post|put|patch|delete)\('[^']+'" server/routes.js server/ai.js` → 142 literal path (135 `routes.js` + 7 `ai.js`) khớp 100% thứ tự + cú pháp param (`:id`,`:fid`,`:cid`,`:pid`,`:tid`,`:qid`,`:aid`) với 142 dòng đầu bảng dưới. + 3 route auth (`app.post/get` trực tiếp, không qua `router.`, đọc trực tiếp `server/app.js:25-27`) = **145/145 khớp, 0 lệch**. Router mount: `apiRouter` ở `/api` (`server/app.js:30`), `aiRouter` ở `/api/ai` (`server/app.js:32`) — mọi full path dưới đã cộng prefix đúng. **Sửa lại 2026-08-25 (Codex G1A.1-audit A5):** 3 route auth + 2 mount đã chuyển từ `server/index.js` sang `server/app.js` khi tách `createApp()` (commit `2c64b7e`) — line number cập nhật theo file mới, không còn trỏ `index.js`.

| ID | method | full path | auth | entity/table | sensitive_group | upload/download | source |
|---|---|---|---|---|---|---|---|
| R001 | GET | /api/assignable-users | requirePerm(partners,view) | users | — | không | routes.js:82 |
| R002 | GET | /api/partners | requirePerm(partners,view) | organizations | org_fee (membership_fee, masked) | không | routes.js:97 |
| R003 | GET | /api/partners/:id | requirePerm(partners,view) | organizations+people+sponsorships+association_fees+agreements+work_logs+gifts+benefit_usages | org_fee, contact, private, social, finance | không | routes.js:125 |
| R004 | POST | /api/partners | requirePerm(partners,create) | organizations | org_fee (membership_fee, **KHÔNG stripDisallowed** — F1) | không | routes.js:156 |
| R005 | PUT | /api/partners/:id | **`requirePerm(partners,edit)` tương đương, kiểm INLINE trong handler (không còn literal ở khai báo route — D13 batch `RBAC-EXP-B2` 2026-08-30, PolicyEngine không điều kiện, không còn dual-branch legacy)**: router-level `requireAuth` + `policyService.assertWritable()`/PolicyEngine, module `partners`/action `edit` — khai tường minh ở `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` | organizations | membership_fee (che qua `classification_tier=Confidential`, PolicyEngine — không còn `stripDisallowed`) | không | routes.js:208 |
| R006 | DELETE | /api/partners/:id | **`requirePerm(partners,delete)` tương đương, kiểm INLINE trong handler (D13 batch `RBAC-EXP-B2`)**: router-level `requireAuth` + `policyService.assertWritable()`/PolicyEngine (chỉ Admin/Super Admin qua — Global entity không bao giờ cho executor xoá), module `partners`/action `delete` — khai tường minh ở `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` | organizations | — | không | routes.js:222 |
| R007 | POST | /api/partners/:id/sponsorships | requirePerm(partners,edit) | sponsorships | org_fee (amount, **KHÔNG stripDisallowed** — F1) | không | routes.js:183 |
| R008 | PUT | /api/sponsorships/:id | requirePerm(partners,edit) | sponsorships | org_fee (F1) | không | routes.js:189 |
| R009 | DELETE | /api/sponsorships/:id | requirePerm(partners,edit) | sponsorships | — | không | routes.js:194 |
| R010 | POST | /api/partners/:id/agreements | requirePerm(partners,edit) | agreements | — | không | routes.js:207 |
| R011 | PUT | /api/agreements/:id | requirePerm(partners,edit) | agreements | — | không | routes.js:214 |
| R012 | DELETE | /api/agreements/:id | requirePerm(partners,edit) | agreements+attachments | — | có (xoá file vật lý) | routes.js:219 |
| R013 | POST | /api/partners/:id/work-logs | requirePerm(partners,edit) | work_logs | — | không | routes.js:226 |
| R014 | PUT | /api/work-logs/:id | requirePerm(partners,edit) | work_logs | — | không | routes.js:232 |
| R015 | DELETE | /api/work-logs/:id | requirePerm(partners,edit) | work_logs+attachments | — | có (xoá file vật lý) | routes.js:237 |
| R016 | POST | /api/agreements/:id/files | requirePerm(partners,edit) | attachments (kind=file) | — | có (upload ≤8 file) | routes.js:253 |
| R017 | POST | /api/work-logs/:id/files | requirePerm(partners,edit) | attachments (kind=file) | — | có (upload ≤8 file) | routes.js:254 |
| R018 | POST | /api/partners/:id/gifts | requirePerm(partners,edit) | gifts | org_fee (value, **KHÔNG stripDisallowed** — F1) | không | routes.js:267 |
| R019 | POST | /api/people/:id/gifts | requirePerm(partners,edit) | gifts | org_fee (value, F1) | không | routes.js:268 |
| R020 | PUT | /api/gifts/:id | requirePerm(partners,edit) | gifts | org_fee | không | routes.js:269 |
| R021 | DELETE | /api/gifts/:id | requirePerm(partners,edit) | gifts | — | không | routes.js:274 |
| R022 | POST | /api/partners/:id/benefit-usages | requirePerm(partners,edit) | benefit_usages | — | không | routes.js:282 |
| R023 | PUT | /api/benefit-usages/:id | requirePerm(partners,edit) | benefit_usages | — | không | routes.js:289 |
| R024 | DELETE | /api/benefit-usages/:id | requirePerm(partners,edit) | benefit_usages | — | không | routes.js:294 |
| R025 | POST | /api/partners/:id/fees | requirePerm(partners,edit) | association_fees | org_fee (amount, **KHÔNG stripDisallowed** — F1) | không | routes.js:302 |
| R026 | PUT | /api/partners/:id/fees/:fid | requirePerm(partners,edit) | association_fees | org_fee (F1) | không | routes.js:308 |
| R027 | DELETE | /api/partners/:id/fees/:fid | requirePerm(partners,edit) | association_fees | org_fee | không | routes.js:312 |
| R028 | POST | /api/partners/:id/fees/:fid/remind | requirePerm(partners,view) | important_dates | org_fee (đọc, không trả amount) | không | routes.js:316 |
| R029 | GET | /api/people | requirePerm(partners,view) | people+organizations | contact,private,social,finance (masked) | không | routes.js:338 |
| R030 | GET | /api/people/:id | **`requirePerm(partners,view)` tương đương, kiểm INLINE trong handler (không còn literal ở khai báo route — D13 People Detail pilot `3e8b299`)**: router-level `requireAuth` + legacy 2-role nhánh `rbac.can(role,partners,view)`, role D13 mới nhánh `policyService.projectRecord()`/PolicyEngine, cùng module `partners`/action `view` — khai tường minh ở `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` | people+attachments+interactions+gifts | contact,private,social,finance,iddoc,org_fee | không (metadata) | routes.js:404 |
| R031 | POST | /api/people | requirePerm(partners,create) | people | contact,private,social,finance (**KHÔNG stripDisallowed** — F1) | không | routes.js:383 |
| R032 | PUT | /api/people/:id | **`requirePerm(partners,edit)` tương đương, kiểm INLINE trong handler (không còn literal ở khai báo route — D13 People Detail write pilot, batch `RBAC-PILOT2-people-write`)**: router-level `requireAuth` + legacy 2-role nhánh `rbac.can(role,partners,edit)` (có stripDisallowed), role D13 mới nhánh `policyService.assertWritable()`/PolicyEngine, cùng module `partners`/action `edit` — khai tường minh ở `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` | people | contact,private,social,finance (có stripDisallowed, chỉ nhánh legacy) | không | routes.js:452 |
| R033 | DELETE | /api/people/:id | **`requirePerm(partners,delete)` tương đương, kiểm INLINE trong handler (không còn literal ở khai báo route — D13 People Detail write pilot, batch `RBAC-PILOT2-people-write`)**: router-level `requireAuth` + legacy 2-role nhánh `rbac.can(role,partners,delete)`, role D13 mới nhánh `policyService.assertWritable()`/PolicyEngine (chỉ Admin/Super Admin qua — D13.1), cùng module `partners`/action `delete` — khai tường minh ở `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` | people+attachments | — | có (xoá file vật lý) | routes.js:471 |
| R034 | POST | /api/people/:id/attachments | **`requirePerm(partners,edit)` tương đương, kiểm qua middleware `personEditGate`** (không còn literal `requirePerm(...)` ở khai báo route — D13 People Detail file pilot, batch `RBAC-PILOT3-people-file`): legacy 2-role nhánh `requirePerm('partners','edit')`, role D13 mới nhánh `policyService.assertWritable()`/PolicyEngine, cùng module `partners`/action `edit` — khai tường minh ở `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` | attachments (kind=portrait/id_doc) | iddoc (legacy) / privileged-only (D13, gate khi kind=id_doc); D13.3b visibility ceiling theo kind | có (upload ≤5 file) | routes.js:508 |
| R035 | PUT | /api/people/:id/attachments/:aid/primary | **`requirePerm(partners,edit)` tương đương, kiểm qua middleware `personEditGate`** (không còn literal `requirePerm(...)` ở khai báo route — D13 People Detail file pilot, batch `RBAC-PILOT3-people-file`): legacy 2-role nhánh `requirePerm('partners','edit')`, role D13 mới nhánh `policyService.assertWritable()`/PolicyEngine, cùng module `partners`/action `edit` — khai tường minh ở `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` | attachments | — | không | routes.js:553 |
| R036 | DELETE | /api/attachments/:aid | **`requirePerm(partners,edit)` tương đương, kiểm INLINE trong handler** (không còn literal ở khai báo route — D13 People Detail file pilot, batch `RBAC-PILOT3-people-file`; route phục vụ nhiều owner_type, role D13 fail-closed 403 nếu owner_type≠person): legacy 2-role nhánh `rbac.can(role,partners,edit)`, role D13 mới nhánh `policyService.assertWritable()`/PolicyEngine, cùng module `partners`/action `edit` — khai tường minh ở `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` | attachments (nhiều owner_type) | iddoc (legacy) / privileged-only (D13, gate khi kind=id_doc) | có (xoá file vật lý) | routes.js:564 |
| R037 | GET | /api/files/:id | **requireAuth only** | attachments (serve file thật) | iddoc (gate); **org_fee KHÔNG gate — F1 root** | có (download, res.sendFile) | routes.js:467 |
| R038 | GET | /api/reminders/upcoming | requirePerm(reminders,view) | important_dates | — | không | routes.js:511 |
| R039 | GET | /api/reminders | requirePerm(reminders,view) | important_dates | — | không | routes.js:518 |
| R040 | POST | /api/reminders | requirePerm(reminders,create) | important_dates | — | không | routes.js:522 |
| R041 | PUT | /api/reminders/:id | **`requirePerm(reminders,edit)` tương đương, kiểm INLINE trong handler (D13 batch `RBAC-EXP-B2` 2026-08-30)**: router-level `requireAuth` + `policyService.assertWritable()`/PolicyEngine, module `reminders`/action `edit` — khai tường minh ở `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` | important_dates | — | không | routes.js:631 |
| R042 | DELETE | /api/reminders/:id | **`requirePerm(reminders,delete)` tương đương, kiểm INLINE trong handler (D13 batch `RBAC-EXP-B2`)**: router-level `requireAuth` + `policyService.assertWritable()`/PolicyEngine (chỉ Admin/Super Admin qua), module `reminders`/action `delete` — khai tường minh ở `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` | important_dates | — | không | routes.js:642 |
| R043 | GET | /api/entities/search | requirePerm(interactions,view) | people+organizations | — | không | routes.js:545 |
| R044 | GET | /api/interactions | requirePerm(interactions,view) | interactions | — | không | routes.js:559 |
| R045 | POST | /api/interactions | requirePerm(interactions,create) | interactions | — | không | routes.js:571 |
| R046 | GET | /api/bookings | requirePerm(partners,view) | bookings | org_fee (maskMoney ad-hoc) | không | routes.js:599 |
| R047 | POST | /api/bookings | requirePerm(partners,create) | bookings | org_fee (**KHÔNG gate write** — F1) | không | routes.js:611 |
| R048 | PUT | /api/bookings/:id | requirePerm(partners,edit) | bookings | org_fee (F1) | không | routes.js:618 |
| R049 | DELETE | /api/bookings/:id | requirePerm(partners,delete) | bookings | — | không | routes.js:623 |
| R050 | GET | /api/budgets | requirePerm(reports,view) | budgets | — | không | routes.js:632 |
| R051 | POST | /api/budgets | requirePerm(reports,view) | budgets | org_fee (**raw SQL upsert, ngoài helper, KHÔNG gate** — F1) | không | routes.js:635 |
| R052 | GET | /api/reports | requirePerm(reports,view) | bookings+event_costs+association_fees+people+interactions (aggregate) | org_fee (KHÔNG check canMoney) | không | routes.js:647 |
| R053 | GET | /api/reports/by-staff | requirePerm(reports,view) | users+assignments+bookings+interactions+people | org_fee | không | routes.js:728 |
| R054 | GET | /api/reports/by-unit | requirePerm(reports,view) | organizations+bookings+interactions+people | org_fee | không | routes.js:746 |
| R055 | GET | /api/reports/awards | requirePerm(reports,view) | awards+award_participations+bookings | org_fee (read-leak projection) | không | routes.js:760 |
| R056 | GET | /api/reports/care-alerts | requirePerm(reports,view) | people+organizations+interactions+bookings | — | không | routes.js:779 |
| R057 | GET | /api/notifications | requirePerm(reminders,view) | reminder_log+important_dates | — | không | routes.js:810 |
| R058 | POST | /api/notifications/:id/read | requirePerm(reminders,ack) | reminder_log | — | không | routes.js:819 — N1 ĐÃ SỬA (Wave 1, 2026-08-30) |
| R059 | POST | /api/notifications/read-all | requirePerm(reminders,ack) | reminder_log | — | không | routes.js:823 — N1 ĐÃ SỬA (Wave 1, 2026-08-30) |
| R060 | POST | /api/reminders/run | requirePerm(reminders,run) | trigger `scheduler.runOnce()` → reminder_log+email side-effect | — | không | routes.js:828 — N1 ĐÃ SỬA (Wave 1, 2026-08-30, mức cao nhất, trigger side-effect thật) |
| R061 | GET | /api/reminders/:id/ics | requirePerm(reminders,view) | important_dates | — | có (download .ics) | routes.js:833 |
| R062 | GET | /api/awards | requirePerm(awards,view) | awards | org_fee (maskMoney ad-hoc) | không | routes.js:869 |
| R063 | GET | /api/awards/:id | requirePerm(awards,view) | awards+award_participations+attachments | org_fee | không (metadata) | routes.js:888 |
| R064 | POST | /api/awards | requirePerm(awards,create) | awards | org_fee (**KHÔNG gate write** — F1) | không | routes.js:898 |
| R065 | PUT | /api/awards/:id | requirePerm(awards,edit) | awards | org_fee (F1) | không | routes.js:906 |
| R066 | DELETE | /api/awards/:id | requirePerm(awards,delete) | awards+attachments | — | có (xoá file vật lý) | routes.js:912 |
| R067 | POST | /api/awards/:id/participations | requirePerm(awards,create) | award_participations | org_fee (**KHÔNG gate write** — F1) | không | routes.js:922 |
| R068 | PUT | /api/awards/:id/participations/:pid | requirePerm(awards,edit) | award_participations | org_fee (F1) | không | routes.js:928 |
| R069 | DELETE | /api/awards/:id/participations/:pid | requirePerm(awards,edit) | award_participations | — | không | routes.js:932 |
| R070 | POST | /api/awards/:id/files | requirePerm(awards,edit) | attachments (kind=award_doc) | — (không kiểm loại nội dung) | có (upload ≤8 file) | routes.js:938 |
| R071 | POST | /api/awards/:id/remind | requirePerm(awards,view) | important_dates | — | không | routes.js:949 |
| R072 | GET | /api/suppliers | requirePerm(suppliers,view) | suppliers | — | không | routes.js:968 |
| R073 | GET | /api/suppliers/list | requirePerm(suppliers,view) | suppliers | — | không | routes.js:979 |
| R074 | GET | /api/suppliers/:id | requirePerm(suppliers,view) | suppliers+supplier_quotes+supplier_transactions+attachments+supplier_contacts | org_fee (maskMoney ad-hoc) | không (metadata) | routes.js:982 |
| R075 | POST | /api/suppliers/:id/contacts | requirePerm(suppliers,edit) | supplier_contacts | — | không | routes.js:995 |
| R076 | PUT | /api/suppliers/:id/contacts/:cid | requirePerm(suppliers,edit) | supplier_contacts | — | không | routes.js:1001 |
| R077 | DELETE | /api/suppliers/:id/contacts/:cid | requirePerm(suppliers,edit) | supplier_contacts | — | không | routes.js:1006 |
| R078 | POST | /api/suppliers/:id/transactions | requirePerm(suppliers,edit) | supplier_transactions | org_fee (**KHÔNG gate write** — F1) | không | routes.js:1012 |
| R079 | PUT | /api/suppliers/:id/transactions/:tid | requirePerm(suppliers,edit) | supplier_transactions | org_fee (F1) | không | routes.js:1018 |
| R080 | DELETE | /api/suppliers/:id/transactions/:tid | requirePerm(suppliers,edit) | supplier_transactions | — | không | routes.js:1023 |
| R081 | POST | /api/suppliers | requirePerm(suppliers,create) | suppliers | — | không | routes.js:1027 |
| R082 | PUT | /api/suppliers/:id | **`requirePerm(suppliers,edit)` tương đương, kiểm INLINE trong handler (D13 batch `RBAC-EXP-B2` 2026-08-30)**: router-level `requireAuth` + `policyService.assertWritable()`/PolicyEngine, module `suppliers`/action `edit` — khai tường minh ở `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` | suppliers | service_fee_pct,deposit_pct (che qua `classification_tier=Confidential`, PolicyEngine) | không | routes.js:1174 |
| R083 | DELETE | /api/suppliers/:id | **`requirePerm(suppliers,delete)` tương đương, kiểm INLINE trong handler (D13 batch `RBAC-EXP-B2`)**: router-level `requireAuth` + `policyService.assertWritable()`/PolicyEngine (chỉ Admin/Super Admin qua), module `suppliers`/action `delete` — khai tường minh ở `scripts/verify-g0.mjs#PILOT_INLINE_PERM_ROUTES` | suppliers+attachments | — | có (xoá file vật lý) | routes.js:1184 |
| R084 | POST | /api/suppliers/:id/quotes | requirePerm(suppliers,edit) | supplier_quotes | org_fee (**KHÔNG gate write** — F1) | không | routes.js:1042 |
| R085 | DELETE | /api/suppliers/:id/quotes/:qid | requirePerm(suppliers,edit) | supplier_quotes | — | không | routes.js:1046 |
| R086 | POST | /api/suppliers/:id/files | requirePerm(suppliers,edit) | attachments (kind=quote) | org_fee (file chứa tiền; download qua R037 KHÔNG gate org_fee) | có (upload ≤5 file) | routes.js:1049 |
| R087 | GET | /api/events | requirePerm(events,view) | events+event_costs | org_fee (maskMoney ad-hoc) | không | routes.js:1065 |
| R088 | GET | /api/events/:id | requirePerm(events,view) | events+event_costs+attachments | org_fee | không (metadata) | routes.js:1083 |
| R089 | POST | /api/events | requirePerm(events,create) | events | — | không | routes.js:1099 |
| R090 | PUT | /api/events/:id | requirePerm(events,edit) | events | — | không | routes.js:1106 |
| R091 | DELETE | /api/events/:id | requirePerm(events,delete) | events+attachments | — | có (xoá file vật lý) | routes.js:1112 |
| R092 | POST | /api/events/:id/costs | requirePerm(events,edit) | event_costs | org_fee (**KHÔNG gate write** — F1) | không | routes.js:1119 |
| R093 | PUT | /api/events/:id/costs/:cid | requirePerm(events,edit) | event_costs | org_fee (F1) | không | routes.js:1123 |
| R094 | DELETE | /api/events/:id/costs/:cid | requirePerm(events,edit) | event_costs | — | không | routes.js:1126 |
| R095 | POST | /api/events/:id/files | requirePerm(events,edit) | attachments (**kind từ query string, chỉ cắt 40 ký tự, không whitelist** — F9) | — | có (upload ≤10 file) | routes.js:1129 |
| R096 | POST | /api/events/:id/remind | requirePerm(events,view) | important_dates | — | không | routes.js:1135 |
| R097 | GET | /api/press-overview | requirePerm(partners,view) | people+organizations+interactions | — | không | routes.js:1148 |
| R098 | GET | /api/dashboard | requirePerm(dashboard,view) | organizations+people+events+association_fees+bookings+interactions+important_dates (aggregate) | — | không | routes.js:1160 — N2 ĐÃ SỬA (Wave 1, 2026-08-30) |
| R099 | GET | /api/admin/users | requirePerm(admin,view) | users | — | không | routes.js:1232 |
| R100 | POST | /api/admin/users | requirePerm(admin,create) | users | — | không | routes.js:1236 |
| R101 | PUT | /api/admin/users/:id | requirePerm(admin,edit) | users | — | không | routes.js:1246 |
| R102 | DELETE | /api/admin/users/:id | requirePerm(admin,delete) | users | — | không | routes.js:1265 |
| R103 | GET | /api/admin/audit | requirePerm(admin,view) | audit_log | — (không phân trang, LIMIT 200 cứng) | không | routes.js:1271 |
| R104 | GET | /api/monitor/dashboard | requirePerm(monitoring,view) | mentions+monitor_alerts+scan_runs+sources | — | không | routes.js:1287 |
| R105 | GET | /api/monitor/mentions | requirePerm(monitoring,view) | mentions+scan_queries | — | không | routes.js:1322 |
| R106 | GET | /api/monitor/keyword-stats | requirePerm(monitoring,view) | mentions (aggregate) | — | không | routes.js:1342 |
| R107 | POST | /api/monitor/mentions/bulk-delete | requirePerm(monitoring,delete) | mentions | — | không | routes.js:1347 |
| R108 | PUT | /api/monitor/mentions/:id | requirePerm(monitoring,edit) | mentions+sentiment_audit | — | không | routes.js:1355 |
| R109 | DELETE | /api/monitor/mentions/:id | requirePerm(monitoring,delete) | mentions | — | không | routes.js:1373 |
| R110 | POST | /api/monitor/scan | requirePerm(monitoring,create) | mentions+scan_runs (fetch RSS/URL — **F3 SSRF**) | — | không | routes.js:1379 |
| R111 | GET | /api/monitor/runs | requirePerm(monitoring,view) | scan_runs | — | không | routes.js:1388 |
| R112 | GET | /api/monitor/highlights | requirePerm(monitoring,view) | mentions (Gemini grounding) | — | không | routes.js:1392 |
| R113 | GET | /api/monitor/competitor-brief | requirePerm(monitoring,view) | mentions+competitors (Gemini grounding) | — | không | routes.js:1397 |
| R114 | GET | /api/monitor/settings | requirePerm(monitoring,view) | app_meta | — | không | routes.js:1402 |
| R115 | PUT | /api/monitor/settings | requirePerm(monitoring,edit) | app_meta | — | không | routes.js:1409 |
| R116 | POST | /api/monitor/alerts/:id/read | requirePerm(monitoring,ack) | monitor_alerts | — | không | routes.js:1418 — N1 ĐÃ SỬA (Wave 1, 2026-08-30) |
| R117 | GET | /api/monitor/queries | requirePerm(monitoring,view) | scan_queries | — | không | routes.js:1424 |
| R118 | POST | /api/monitor/queries | requirePerm(monitoring,create) | scan_queries | — | không | routes.js:1427 |
| R119 | PUT | /api/monitor/queries/:id | requirePerm(monitoring,edit) | scan_queries | — | không | routes.js:1435 |
| R120 | DELETE | /api/monitor/queries/:id | requirePerm(monitoring,delete) | scan_queries | — | không | routes.js:1447 |
| R121 | GET | /api/monitor/sources | requirePerm(monitoring,view) | sources | — | không | routes.js:1454 |
| R122 | POST | /api/monitor/sources | requirePerm(monitoring,create) | sources (fetch URL qua detectFeed — **F3 SSRF**) | — | không | routes.js:1457 |
| R123 | PUT | /api/monitor/sources/:id | requirePerm(monitoring,edit) | sources | — | không | routes.js:1469 |
| R124 | DELETE | /api/monitor/sources/:id | requirePerm(monitoring,delete) | sources | — | không | routes.js:1476 |
| R125 | GET | /api/monitor/competitors | requirePerm(monitoring,view) | competitors | — | không | routes.js:1482 |
| R126 | POST | /api/monitor/competitors | requirePerm(monitoring,create) | competitors | — | không | routes.js:1485 |
| R127 | PUT | /api/monitor/competitors/:id | requirePerm(monitoring,edit) | competitors | — | không | routes.js:1493 |
| R128 | DELETE | /api/monitor/competitors/:id | requirePerm(monitoring,delete) | competitors | — | không | routes.js:1500 |
| R129 | GET | /api/monitor/campaigns | requirePerm(monitoring,view) | campaigns | — | không | routes.js:1510 |
| R130 | GET | /api/monitor/campaigns/:id | requirePerm(monitoring,view) | campaigns | — | không | routes.js:1513 |
| R131 | POST | /api/monitor/campaigns | requirePerm(monitoring,create) | campaigns | — | không | routes.js:1518 |
| R132 | PUT | /api/monitor/campaigns/:id | requirePerm(monitoring,edit) | campaigns | — | không | routes.js:1529 |
| R133 | DELETE | /api/monitor/campaigns/:id | requirePerm(monitoring,delete) | campaigns | — | không | routes.js:1538 |
| R134 | GET | /api/monitor/campaigns/:id/results | requirePerm(monitoring,view) | campaigns+mentions | — | không | routes.js:1543 |
| R135 | GET | /api/monitor/campaigns/:id/evaluate | requirePerm(monitoring,view) | campaigns (Gemini grounding, **evaluateCampaign gửi cp.name/message/content/audience/keywords** — F4/O8) | — | không | routes.js:1576 |
| R136 | POST | /api/ai/interaction-voice | requirePerm(interactions,create) | interactions (trích xuất, chưa lưu) | **voice/audio → Gemini** (F4, chặn O8) | có (upload audio, field `audio`) | ai.js:48 |
| R137 | POST | /api/ai/card-text | requirePerm(reminders,view) | important_dates (sinh text, không lưu) | text → Gemini | không | ai.js:87 |
| R138 | POST | /api/ai/card-image | requirePerm(reminders,view) | important_dates (sinh ảnh, không lưu) | image → Gemini | không | ai.js:110 |
| R139 | POST | /api/ai/award-extract | requirePerm(awards,create) | awards (trích xuất, chưa lưu) | text/image/excel → Gemini (**uploadAudio.single — KHÔNG fileFilter, 25MB RAM, MIME tùy ý** — N3) | có (upload, field `file`) | ai.js:160 |
| R140 | POST | /api/ai/award-advice | requirePerm(awards,view) | awards (input client, không đọc DB) | text → Gemini (không gửi `cost`) | không | ai.js:197 |
| R141 | POST | /api/ai/event-extract | requirePerm(events,create) | events (trích xuất, chưa lưu) | excel/text → Gemini (đã redact — điểm mạnh) | có (upload, field `file`, Excel/CSV) | ai.js:244 |
| R142 | GET | /api/ai/status | requireAuth only | — | — | không | ai.js:275 |
| R143 | POST | /api/login | **no-auth (public)** | users | — | không | app.js:25 |
| R144 | POST | /api/logout | **no auth middleware** (`auth.logout` chỉ destroy session nếu có) | — | — | không | app.js:26; auth.js:24 |
| R145 | GET | /api/me | **handler tự kiểm tra session** (`auth.me`, không gắn `requireAuth` middleware) | users | — | không | app.js:27; auth.js:28 |

## Background jobs (không phải HTTP endpoint, giữ riêng)
| Job | Định nghĩa | Nơi gọi lúc boot | Tần suất |
|---|---|---|---|
| Reminder scheduler | `scheduler.js:23-69` (`runOnce`), `:71-76` (`start`) | `server/index.js:10` — `scheduler.start()` trong `app.listen()` (sửa lại 2026-08-25, trước ở `:47` khi chưa tách `app.js`) | Ngay lúc boot + `setInterval` 6h |
| Monitor auto-scan | `monitor.js:427-437` (`applySchedule`) | `server/index.js:11` — `monitor.start()` trong `app.listen()` (sửa lại 2026-08-25) | Tùy `app_meta.autoscan`, mặc định 4h |

## UI top-level views (`public/app.js`) — join key cho ma trận G0.4
| VIEWS key | file:line | Route ID chính dùng |
|---|---|---|
| dashboard | `:328` | R098 |
| monitor | `:412` | R104-R135 |
| press/association/gov/other | `:959` | R002, R097 |
| partner | `:961` | R003, R006-R028 |
| people | `:1334` | R029 |
| person | `:1360` | R030-R036 |
| reminders | `:1571` | R038-R042, R057-R061, R137, R138, R046-R049, R062 |
| reports | `:1753` | R050-R056 |
| awards | `:1932` | R062-R071, R139, R140 |
| events | `:2127` | R087-R096, R073, R141 |
| suppliers | `:2362` | R072-R086 |
| interactions | `:2529` | R043-R045, R136 |
| admin | `:2657` | R099-R103 |
| (notification widget) | `~:2850-2869` | R057-R059 |
| (login/logout) | `~:2877-2887` | R143-R145 |

Không có view riêng cho R001 (assignable-users, dùng nội bộ dropdown ở nhiều view khác), R142 (ai/status, internal check).
