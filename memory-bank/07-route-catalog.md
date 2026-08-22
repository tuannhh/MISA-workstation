# 07 — Route Catalog (G0.3, machine-checkable, thay thế bản cũ)

> **Sửa sau Codex G0-audit** (FAIL — 47/135 literal path không xuất hiện nguyên dạng do bản trước nén bằng wildcard). Bản này: **1 route = 1 row, không compress, không wildcard**, tự-verify khớp 100% với source.
>
> **Verify:** `rg -o "router\.(get|post|put|patch|delete)\('[^']+'" server/routes.js server/ai.js` → 142 literal path (135 `routes.js` + 7 `ai.js`) khớp 100% thứ tự + cú pháp param (`:id`,`:fid`,`:cid`,`:pid`,`:tid`,`:qid`,`:aid`) với 142 dòng đầu bảng dưới. + 3 route auth (`app.post/get` trực tiếp, không qua `router.`, đọc trực tiếp `server/index.js:27-29`) = **145/145 khớp, 0 lệch**. Router mount: `apiRouter` ở `/api` (`server/index.js:32`), `aiRouter` ở `/api/ai` (`server/index.js:34`) — mọi full path dưới đã cộng prefix đúng.

| ID | method | full path | auth | entity/table | sensitive_group | upload/download | source |
|---|---|---|---|---|---|---|---|
| R001 | GET | /api/assignable-users | requirePerm(partners,view) | users | — | không | routes.js:82 |
| R002 | GET | /api/partners | requirePerm(partners,view) | organizations | org_fee (membership_fee, masked) | không | routes.js:97 |
| R003 | GET | /api/partners/:id | requirePerm(partners,view) | organizations+people+sponsorships+association_fees+agreements+work_logs+gifts+benefit_usages | org_fee, contact, private, social, finance | không | routes.js:125 |
| R004 | POST | /api/partners | requirePerm(partners,create) | organizations | org_fee (membership_fee, **KHÔNG stripDisallowed** — F1) | không | routes.js:156 |
| R005 | PUT | /api/partners/:id | requirePerm(partners,edit) | organizations | org_fee (có stripDisallowed) | không | routes.js:165 |
| R006 | DELETE | /api/partners/:id | requirePerm(partners,delete) | organizations | — | không | routes.js:174 |
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
| R030 | GET | /api/people/:id | requirePerm(partners,view) | people+attachments+interactions+gifts | contact,private,social,finance,iddoc,org_fee | không (metadata) | routes.js:361 |
| R031 | POST | /api/people | requirePerm(partners,create) | people | contact,private,social,finance (**KHÔNG stripDisallowed** — F1) | không | routes.js:383 |
| R032 | PUT | /api/people/:id | requirePerm(partners,edit) | people | contact,private,social,finance (có stripDisallowed) | không | routes.js:391 |
| R033 | DELETE | /api/people/:id | requirePerm(partners,delete) | people+attachments | — | có (xoá file vật lý) | routes.js:400 |
| R034 | POST | /api/people/:id/attachments | requirePerm(partners,edit) | attachments (kind=portrait/id_doc) | iddoc (gate khi kind=id_doc) | có (upload ≤5 file) | routes.js:412 |
| R035 | PUT | /api/people/:id/attachments/:aid/primary | requirePerm(partners,edit) | attachments | — | không | routes.js:444 |
| R036 | DELETE | /api/attachments/:aid | requirePerm(partners,edit) | attachments (nhiều owner_type) | iddoc (gate) | có (xoá file vật lý) | routes.js:452 |
| R037 | GET | /api/files/:id | **requireAuth only** | attachments (serve file thật) | iddoc (gate); **org_fee KHÔNG gate — F1 root** | có (download, res.sendFile) | routes.js:467 |
| R038 | GET | /api/reminders/upcoming | requirePerm(reminders,view) | important_dates | — | không | routes.js:511 |
| R039 | GET | /api/reminders | requirePerm(reminders,view) | important_dates | — | không | routes.js:518 |
| R040 | POST | /api/reminders | requirePerm(reminders,create) | important_dates | — | không | routes.js:522 |
| R041 | PUT | /api/reminders/:id | requirePerm(reminders,edit) | important_dates | — | không | routes.js:530 |
| R042 | DELETE | /api/reminders/:id | requirePerm(reminders,delete) | important_dates | — | không | routes.js:535 |
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
| R058 | POST | /api/notifications/:id/read | requirePerm(reminders,**view**) | reminder_log | — | không | routes.js:819 — N1 |
| R059 | POST | /api/notifications/read-all | requirePerm(reminders,**view**) | reminder_log | — | không | routes.js:823 — N1 |
| R060 | POST | /api/reminders/run | requirePerm(reminders,**view**) | trigger `scheduler.runOnce()` → reminder_log+email side-effect | — | không | routes.js:828 — N1 (mức cao nhất, trigger side-effect thật) |
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
| R082 | PUT | /api/suppliers/:id | requirePerm(suppliers,edit) | suppliers | — | không | routes.js:1031 |
| R083 | DELETE | /api/suppliers/:id | requirePerm(suppliers,delete) | suppliers+attachments | — | có (xoá file vật lý) | routes.js:1035 |
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
| R098 | GET | /api/dashboard | **requireAuth only, không requirePerm module** | organizations+people+events+association_fees+bookings+interactions+important_dates (aggregate) | — | không | routes.js:1160 — N2 |
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
| R116 | POST | /api/monitor/alerts/:id/read | requirePerm(monitoring,**view**) | monitor_alerts | — | không | routes.js:1418 — N1 |
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
| R143 | POST | /api/login | **no-auth (public)** | users | — | không | index.js:27 |
| R144 | POST | /api/logout | requireAuth | — | — | không | index.js:28 |
| R145 | GET | /api/me | requireAuth | users | — | không | index.js:29 |

## Background jobs (không phải HTTP endpoint, giữ riêng)
| Job | Định nghĩa | Nơi gọi lúc boot | Tần suất |
|---|---|---|---|
| Reminder scheduler | `scheduler.js:23-69` (`runOnce`), `:71-76` (`start`) | `server/index.js:47` — `scheduler.start()` trong `app.listen()` | Ngay lúc boot + `setInterval` 6h |
| Monitor auto-scan | `monitor.js:427-437` (`applySchedule`) | `server/index.js:48` — `monitor.start()` trong `app.listen()` | Tùy `app_meta.autoscan`, mặc định 4h |

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
