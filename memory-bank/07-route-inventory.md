# 07 — Route/Job/AI/UI Inventory (G0.3)

> Input thô cho G0.4 (ma trận permission). Nguồn: agent Explore đọc toàn bộ `server/routes.js` (135 route), `server/ai.js` (7 route), `server/index.js` (3 route auth), `server/scheduler.js`, `server/monitor.js`, `public/app.js`. Mọi route `routes.js` đi qua `router.use(requireAuth)` (`routes.js:14`) trước `requirePerm` riêng — "requireAuth only" nghĩa là có `requireAuth` + KHÔNG có `requirePerm` module cụ thể, không phải route public (trừ khi ghi "no auth").
>
> **Không suy đoán** — mọi dòng có `file:line`. Việc đối chiếu với `01-audit-findings.md` xem §Ghi chú cuối file.

## 0. Auth (server/index.js)
| method | path | requirePerm/requireAuth | entity | sensitive_group | upload | ghi chú |
|---|---|---|---|---|---|---|
| POST | /api/login | no auth (public) | users | — | no | `index.js:27` → `auth.js:10-19` |
| POST | /api/logout | requireAuth | — | — | no | `index.js:28` → `auth.js:21-23` |
| GET | /api/me | requireAuth | users | — | no | `index.js:29` → `auth.js:25-31` |

## 1. Organizations/Partners
| method | path | perm | entity | sensitive_group | upload | ghi chú |
|---|---|---|---|---|---|---|
| GET | /assignable-users | partners:view | users | — | no | `:82-84` |
| GET | /partners | partners:view | organizations | org_fee (membership_fee, masked) | no | `:97-123` |
| GET | /partners/:id | partners:view | organizations+people+sponsorships+fees+agreements+work_logs+gifts+benefit_usages | org_fee, contact/private/social/finance | no | `:125-154`; audit VIEW_SENSITIVE khi xem hội phí `:129` |
| POST | /partners | partners:create | organizations | org_fee (membership_fee, **KHÔNG stripDisallowed**) | no | `:156-164` — **F1 mở rộng** |
| PUT | /partners/:id | partners:edit | organizations | org_fee | no | `:165-173`; có stripDisallowed `:168` |
| DELETE | /partners/:id | partners:delete | organizations | — | no | `:174-178`; không xoá file liên quan (rác agreements/work_logs) |
| POST | /partners/:id/sponsorships | partners:edit | sponsorships | org_fee (amount, **KHÔNG stripDisallowed**) | no | `:183-188` — **F1 mở rộng** |
| PUT | /sponsorships/:id | partners:edit | sponsorships | org_fee | no | `:189-193` — **F1 mở rộng** |
| DELETE | /sponsorships/:id | partners:edit | sponsorships | — | no | `:194-198` |
| POST/PUT/DELETE | /partners/:id/agreements, /agreements/:id | partners:edit | agreements | — | no | `:207-224` |
| DELETE | /agreements/:id | partners:edit | agreements+attachments | — | xoá file vật lý | `:219-224` |
| POST/PUT/DELETE | /partners/:id/work-logs, /work-logs/:id | partners:edit | work_logs | — | no/xoá file | `:226-242` |
| POST | /agreements/:id/files, /work-logs/:id/files | partners:edit | attachments | — | upload (8 file) | `:243-254` |
| POST/PUT/DELETE | /partners\|people/:id/gifts, /gifts/:id | partners:edit | gifts | org_fee (value, **KHÔNG stripDisallowed**) | no | `:258-278` — **F1 mở rộng** |
| POST/PUT/DELETE | benefit-usages | partners:edit | benefit_usages | — | no | `:282-298` |
| POST/PUT/DELETE | /partners/:id/fees | partners:edit | association_fees | org_fee (amount, **KHÔNG stripDisallowed**) | no | `:302-315` — **F1 mở rộng** |
| POST | /partners/:id/fees/:fid/remind | partners:view | important_dates | org_fee (đọc nhưng không trả amount) | no | `:316-323` |

## 2. People
| method | path | perm | entity | sensitive_group | upload | ghi chú |
|---|---|---|---|---|---|---|
| GET | /people | partners:view | people+organizations | contact/private/social/finance (masked) | no | `:338-359` |
| GET | /people/:id | partners:view | people+attachments+interactions+gifts | contact/private/social/finance + iddoc (`:374`) + org_fee | no (metadata only) | `:361-381`; VIEW_SENSITIVE audit `:368-370` |
| POST | /people | partners:create | people | contact/private/social/finance (**KHÔNG stripDisallowed**) | no | `:383-390` — **F1 mở rộng (CREATE bypass đã biết, xác nhận lại)** |
| PUT | /people/:id | partners:edit | people | contact/private/social/finance | no | `:391-399`; stripDisallowed `:394` |
| DELETE | /people/:id | partners:delete | people+attachments | — | xoá file vật lý | `:400-408` |
| POST | /people/:id/attachments | partners:edit | attachments | iddoc gate (`:415-418`) | upload (5 file) | `:412-442` |
| PUT | .../attachments/:aid/primary | partners:edit | attachments | — | no | `:444-450` |
| DELETE | /attachments/:aid | partners:edit | attachments (nhiều owner_type) | iddoc gate (`:455`) | xoá file vật lý | `:452-464` |
| **GET** | **/files/:id** | **requireAuth only** (không requirePerm module) | attachments — **serve nội dung file thực tế** | iddoc gate (`:470-471`); **org_fee KHÔNG gate** | download (`res.sendFile`) | `:467-478` — **F1 root: đây là điểm read-bypass DUY NHẤT cho mọi attachment (quote/award_doc/agreement file/event file)** |

## 3. Reminders/Important Dates
| method | path | perm | entity | ghi chú |
|---|---|---|---|---|
| GET/POST/PUT/DELETE | /reminders* | reminders:view/create/edit/delete | important_dates | `:511-539` |
| POST | /notifications/:id/read, /notifications/read-all | reminders:**view** | reminder_log | `:819-826` — **dùng perm 'view' cho action ghi** (semantics sai, chưa phải lỗ hổng vì vẫn requireAuth+requirePerm) |
| POST | /reminders/run | reminders:**view** | trigger `scheduler.runOnce()` — side-effect ghi DB + gửi email | `:828-831` — **cùng vấn đề semantics, mức độ cao hơn vì trigger side-effect thật** |
| GET | /reminders/:id/ics | reminders:view | important_dates | download .ics `:833-851` |
| GET | /notifications | reminders:view | reminder_log+important_dates | `:810-818` |

## 4. Interactions
| method | path | perm | entity | ghi chú |
|---|---|---|---|---|
| GET | /entities/search | interactions:view | people+organizations | `:545-555` |
| GET/POST | /interactions | interactions:view/create | interactions | `:559-579` |

## 5. Bookings (dùng chung module `partners` — KHÔNG có module riêng trong `rbac.js:22`)
| method | path | perm | entity | sensitive_group | ghi chú |
|---|---|---|---|---|---|
| GET | /bookings | partners:view | bookings | org_fee (amount, `maskMoney` ad-hoc) | `:599-610` |
| POST/PUT | /bookings | partners:create/edit | bookings | org_fee (amount, **KHÔNG gate write**) | `:611-622` — **F1 mở rộng** |
| DELETE | /bookings/:id | partners:delete | bookings | — | `:623-627` |

## 6. Budgets
| method | path | perm | entity | ghi chú |
|---|---|---|---|---|
| GET | /budgets | reports:view | budgets | `:632-634` |
| POST | /budgets | reports:**view** | budgets | **raw SQL upsert, KHÔNG qua buildInsert/buildUpdate, KHÔNG gate ghi tiền** `:635-642` — **F1 mở rộng, ngoài helper**; đồng thời perm 'view' cho action ghi (an toàn tình cờ vì chỉ super_admin có reports:view, nhưng semantics sai) |

## 7. Reports (chỉ super_admin — `reports: []` với pr_staff)
| method | path | entity | sensitive_group | ghi chú |
|---|---|---|---|---|
| GET | /reports, /reports/by-staff, /reports/by-unit | bookings/fees/people/interactions/event_costs/budgets (aggregate) | org_fee (spend/fee/event totals, **KHÔNG check canMoney** — an toàn vì chỉ super_admin gọi được, nhưng nếu role mới thêm module reports sẽ hở ngay) | `:647-757` |
| GET | /reports/awards | awards+award_participations+bookings | org_fee (cost/partBudget/mediaCost/totalCost — read-leak projection đã biết) | `:760-776` |
| GET | /reports/care-alerts | people/organizations/interactions/bookings | — | `:779-805` |

## 8. Awards
| method | path | perm | entity | sensitive_group | ghi chú |
|---|---|---|---|---|---|
| GET | /awards, /awards/:id | awards:view | awards+award_participations+attachments | org_fee (cost/budget, `maskMoney` ad-hoc) | `:869-896` (metadata file only) |
| POST/PUT | /awards | awards:create/edit | awards | org_fee (cost, **KHÔNG gate write**) | `:898-911` — **F1 mở rộng** |
| DELETE | /awards/:id | awards:delete | awards+attachments | — xoá file vật lý | `:912-919` |
| POST/PUT | /awards/:id/participations | awards:create/edit | award_participations | org_fee (budget, **KHÔNG gate write**) | `:922-931` — **F1 mở rộng** |
| POST | /awards/:id/files | awards:edit | attachments (kind=award_doc) | không kiểm loại nội dung | upload 8 file `:938-946` |
| POST | /awards/:id/remind | awards:view | important_dates | — | `:949-958` |

## 9. Suppliers
| method | path | perm | entity | sensitive_group | ghi chú |
|---|---|---|---|---|---|
| GET | /suppliers/:id | suppliers:view | suppliers+quotes+transactions+attachments+contacts | org_fee (quotes.unit_price, transactions.value — `maskMoney` ad-hoc) | `:982-993` (metadata file only) |
| POST/PUT | /suppliers/:id/transactions | suppliers:edit | supplier_transactions | org_fee (value, **KHÔNG gate write**) | `:1012-1022` — **F1 mở rộng** |
| POST | /suppliers/:id/quotes | suppliers:edit | supplier_quotes | org_fee (unit_price, **KHÔNG gate write**) | `:1042-1045` — **F1 mở rộng** |
| POST | /suppliers/:id/files | suppliers:edit | attachments (kind=quote) | org_fee (file chứa tiền; **download qua `/files/:id` KHÔNG gate org_fee**) | upload 5 file `:1049-1054` — **F1 read-bypass đã biết, nguồn gốc** |

## 10. Events
| method | path | perm | entity | sensitive_group | ghi chú |
|---|---|---|---|---|---|
| GET | /events, /events/:id | events:view | events+event_costs+attachments | org_fee (total_cost/cost-by-category, `maskMoney` ad-hoc) | `:1065-1097` (metadata file only) |
| POST/PUT | /events/:id/costs | events:edit | event_costs | org_fee (amount, **KHÔNG gate write**) | `:1119-1128` — **F1 mở rộng** |
| POST | /events/:id/files | events:edit | attachments (**kind từ query string, không whitelist chặt, chỉ `.slice(0,40)`**) | không map sensitive_group | upload 10 file `:1129-1134` — **F9 xác nhận cụ thể** |

## 11. Dashboard
| method | path | perm | ghi chú |
|---|---|---|---|
| GET | /press-overview | partners:view | `:1148-1158` |
| GET | /dashboard | **requireAuth only, KHÔNG có requirePerm module nào** | `:1160-1227` — mọi user đăng nhập xem toàn bộ số liệu tổng hợp (organizations/people/events/fees counts). **UNVERIFIED: chủ ý (dashboard chung) hay thiếu sót** — cần owner xác nhận cho G0.4 |

## 12. Admin
| method | path | perm | ghi chú |
|---|---|---|---|
| GET/POST/PUT/DELETE | /admin/users | admin:view/create/edit/delete | `:1232-1270`; PUT tự cập nhật session nếu sửa chính mình `:1258-1261`; DELETE chặn tự xoá chính mình `:1266` |
| GET | /admin/audit | admin:view | `:1271-1274`; **LIMIT 200, không phân trang** |

## 13. Monitoring
| method | path | perm | ghi chú |
|---|---|---|---|
| GET/POST/PUT/DELETE | /monitor/* (dashboard/mentions/queries/sources/competitors/campaigns) | monitoring:view/create/edit/delete | `:1287-1581` |
| POST | /monitor/scan | monitoring:create | `:1379-1387` — SSRF risk (F3): fetch RSS/URL từ `sources` table |
| POST | /monitor/sources | monitoring:create | `:1457-1468` — gọi `detectFeed(b.url)` fetch URL user nhập — SSRF risk (F3) |
| GET | /monitor/highlights, /competitor-brief, /campaigns/:id/evaluate | monitoring:view | Gemini groundedSearch — text/grounding |
| POST | /monitor/alerts/:id/read | monitoring:**view** | `:1418-1421` — cùng vấn đề semantics perm 'view' cho action ghi |

## 14. AI flows (`server/ai.js`) — cột "dữ liệu gửi Gemini" bổ sung cho `06-threat-model.md` §D
| method | path | perm | dữ liệu gửi Gemini | ghi chú |
|---|---|---|---|---|
| POST | /ai/interaction-voice | interactions:create | **voice/audio** — file ghi âm nội bộ gửi base64 thẳng tới Gemini (`ai.js:59-62`) | `ai.js:48-82` — **F4 rủi ro cao nhất, đã xác nhận vị trí file:line** (trước đây UNVERIFIED trong `06-threat-model.md` §D, giờ đã đóng) |
| POST | /ai/card-text | reminders:view | text — title/subject_name/idea do user nhập | `ai.js:87-100` |
| POST | /ai/card-image | reminders:view | image — logo tĩnh + prompt | `ai.js:110-129` |
| POST | /ai/award-extract | awards:create | text/image/excel — PDF/ảnh qua `uploadAudio.single('file')` (**tên hàm gây nhầm, dùng lại cho non-audio — cần xác nhận limit/type check trong `server/uploads.js`**) | `ai.js:160-187` |
| POST | /ai/award-advice | awards:view | text — field client tự nhập, không gửi `cost` | `ai.js:197-212` |
| POST | /ai/event-extract | events:create | excel/text — có redaction (`redactTextForAi`) + rate-limit 8/phút/user | `ai.js:244-273` — điểm mạnh giữ nguyên |
| GET | /ai/status | requireAuth only | — (không gửi Gemini) | `ai.js:275` |

## 15. Background jobs

| Job | Định nghĩa | Nơi gọi lúc boot (đã xác nhận — đóng UNVERIFIED của agent) | Tần suất | Việc làm |
|---|---|---|---|---|
| Reminder scheduler | `scheduler.js:23-69` (`runOnce`), `:71-76` (`start`) | **`server/index.js:47`** — `scheduler.start()` trong callback `app.listen()` | Ngay lúc boot, sau đó `setInterval` mỗi 6h (`scheduler.js:74`) | Quét `important_dates`, tạo `reminder_log` + email nếu `notify_opt_in=1`. Idempotent (`:46,54`). Trigger thủ công qua `POST /reminders/run` (perm 'view' — xem §3) |
| Monitor auto-scan | `monitor.js:427-437` (`applySchedule`), `start()` → `:437` | **`server/index.js:48`** — `monitor.start()` trong callback `app.listen()` | Bật qua `app_meta.autoscan` hoặc `MONITOR_AUTOSCAN=1`; interval N giờ (mặc định 4h) | `runScan({triggeredBy:'auto'})` — quét RSS/Google-News, lưu `mentions`+`scan_runs`, `analyzePending` (Gemini sentiment). SSRF risk F3 |

## 16. UI top-level views (`public/app.js`)
| VIEWS key | file:line | route API chính |
|---|---|---|
| dashboard | `:328` | GET /dashboard |
| monitor | `:412` | GET/POST/PUT/DELETE /monitor/* |
| press/association/gov/other | `:959` | GET /partners (theo type), GET /press-overview |
| partner | `:961` | GET/DELETE /partners/:id, sponsorships/fees/agreements/work-logs/gifts/benefit-usages |
| people | `:1334` | GET /people |
| person | `:1360` | GET/DELETE /people/:id, attachments, PUT primary |
| reminders | `:1571` | reminders*, /ai/card-text, /ai/card-image, bookings, awards |
| reports | `:1753` | /reports* |
| awards | `:1932` | /awards*, /ai/award-advice, /ai/award-extract |
| events | `:2127` | /events*, /suppliers/list, /ai/event-extract |
| suppliers | `:2362` | /suppliers* |
| interactions | `:2529` | /interactions, /entities/search, /ai/interaction-voice |
| admin | `:2657` | /admin/users, /admin/audit |
| (notification widget) | `~:2850-2869` | GET /notifications, POST read/read-all |
| (login/logout) | `~:2877-2887` | /login, /logout, /me |

## Ghi chú tổng hợp — đối chiếu với `01-audit-findings.md`

**Số liệu xác nhận:** `routes.js` = 135 route (`grep -c` khớp), `ai.js` = 7 route (khớp brief gốc).

**F1 (money bypass) — MỞ RỘNG BLAST RADIUS.** Audit gốc chỉ nêu 2 ví dụ điển hình (`POST /partners`, sponsorship). Inventory đầy đủ xác nhận write-bypass (ghi tiền không qua `stripDisallowed`/PolicyEngine) lặp lại ở: `POST/PUT /partners` (membership_fee), `POST/PUT sponsorships`, `POST/PUT fees`, `POST/PUT gifts`, `POST /budgets` (raw SQL, ngoài helper), `POST/PUT /awards` (cost), `POST/PUT award_participations` (budget), `POST/PUT supplier_transactions` (value), `POST supplier_quotes` (unit_price), `POST/PUT event_costs` (amount) — **10 nhóm route, không phải 2**. Điều này CỦNG CỐ (không thay đổi) quyết định D1 — root cause vẫn là "PolicyEngine 1 choke-point ở service layer", và giờ có bằng chứng rằng vá riêng từng route (per-handler patch) sẽ chắc chắn sót — ủng hộ thêm cho việc KHÔNG chọn "thêm 20 dòng mỗi route".

**F1 read-bypass — xác nhận nguồn gốc DUY NHẤT:** `GET /files/:id` (`routes.js:467-478`) là điểm phục vụ nội dung file thực tế cho MỌI loại attachment (award_doc, quote, agreement/work-log file, event file, portrait). Chỉ gate `kind==='id_doc'`. Đây chính là target của R1 (attachment classification).

**F4 — đóng 1 UNVERIFIED:** vị trí chính xác voice-intake là `POST /ai/interaction-voice` (`server/ai.js:48-82`), gửi audio base64 trực tiếp. Cập nhật vào `06-threat-model.md` §D.

**F9 — xác nhận cụ thể:** `POST /events/:id/files` (`routes.js:1129-1134`) nhận `kind` từ query string chỉ cắt độ dài, không whitelist — đúng như audit gốc trích dẫn, giờ có route đầy đủ.

**3 finding phụ MỚI, chưa có ID (đề nghị theo dõi ở Gate 1, không phải P0):**
- **N1 — Semantics RBAC sai (Low):** 4 route dùng perm `view` cho action có side-effect ghi: `POST /notifications/:id/read`, `POST /notifications/read-all`, `POST /reminders/run` (trigger scheduler + gửi email — mức cao nhất trong nhóm này), `POST /monitor/alerts/:id/read`. Chưa phải lỗ hổng (vẫn `requireAuth`+`requirePerm`), nhưng nếu RBAC sau này tách quyền `notify`/`ack` riêng, các route này sẽ cần review lại. Ghi vào G1A test.
- **N2 — 3 route không có requirePerm module cụ thể (chỉ requireAuth):** `GET /dashboard` (`:1160`), `GET /files/:id` (`:467`, có gate riêng theo kind), `GET /ai/status` (`ai.js:275`). Dashboard: rủi ro thấp (chỉ số liệu tổng hợp, không phải giá trị tiền cụ thể) nhưng **UNVERIFIED liệu là chủ ý** — đưa vào G0.4 để owner xác nhận.
- **N3 — Naming nhầm lẫn:** `uploadAudio.single('file')` dùng lại cho non-audio file (PDF/ảnh) ở `/ai/award-extract` (`ai.js:160`). Không phải lỗ hổng tự thân nhưng cần xác nhận `server/uploads.js` áp đúng limit/type-check cho trường hợp này (không thừa hưởng nhầm limit của audio).

**Đã đóng hoàn toàn:** UNVERIFIED "nơi scheduler/monitor.start() được gọi" — xác nhận `server/index.js:47-48`.
