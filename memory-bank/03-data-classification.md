# 03 — Data Classification Registry (dự thảo cho PolicyEngine)

> Nguồn phân loại **duy nhất** mà PolicyEngine đọc cho cả read-mask, write-guard và file-gate.
> Cột tiền đã xác nhận trong `server/db.js` (grep 2026-08-22). Owner duyệt trước khi code (quyết định O1).
> Lưu ý naming: table (số nhiều) ≠ policy-entity (số ít) — vd `organizations`↔`organization`, `supplier_quotes`↔`supplier_quote`. PolicyEngine dùng **policy-entity**; map table↔entity phải nằm TRONG registry (không để rải rác).

## A. Nhóm `org_fee` — trường tiền persisted (mặc định đề nghị)

| Policy-entity | Table | Cột | Bằng chứng |
|---|---|---|---|
| organization | organizations | `membership_fee` | `db.js:50` |
| sponsorship | sponsorships | `amount` | `db.js:103` |
| booking | bookings | `amount` | `db.js:135` |
| budget | budgets | `amount` | `db.js:149` |
| award | awards | `cost` | `db.js:207` |
| award_participation | award_participations | `budget` | `db.js:234` |
| supplier_quote | supplier_quotes | `unit_price` | `db.js:275` |
| supplier_transaction | supplier_transactions | `value` | `db.js:395` |
| event_cost | event_costs | `amount` | `db.js:311` |
| association_fee | association_fees | `amount` | `db.js:327` |
| gift | gifts | `value` | `db.js:369` |

## B. Cần owner xác nhận (O1)
- `suppliers.service_fee_pct` (`db.js:266`), `suppliers.deposit_pct` (`db.js:268`): điều khoản % thương mại, không phải số tuyệt đối → xếp `org_fee` NẾU chính sách coi điều khoản giá là mật.
- **Derived/projection** phải kế thừa `org_fee` từ nguồn (registry mô tả cả field dẫn xuất): `bookings.total_amount`, `events.total_cost`, `events.totals.*`, report `spend/budget/grandTotal/fee totals`, award `partBudget/mediaCost/totalCost`.
- **Tài liệu tiền:** `supplier_quotes kind=quote` mặc định `org_fee`. Agreement / work-log / award doc / event doc: owner chọn (a) phân loại theo loại tài liệu server-side, hoặc (b) mặc định private, hạ cấp sau review.
- **Không cho client tự đặt classification.**

## C. Nhóm mật cá nhân (person) — đã tồn tại trong `server/rbac.js:66-73`
| Nhóm | Trường |
|---|---|
| contact | phone_personal, phone_other, phone_ott |
| private | dob, home_address, personal_notes, personality, hobbies, food_habits, family_info, media_stance, relationship_network, meeting_places, gift_rules |
| social | social_facebook, social_instagram, social_tiktok, social_x, social_thread |
| finance | bank_account_number, bank_name |
| iddoc | attachments `kind='id_doc'` |
| org_fee | §A |

## D. Data-tier gửi Gemini (khuyến nghị — chờ Security/Legal duyệt, O8)
| Tier | Ví dụ | Policy mặc định |
|---|---|---|
| Public | Tin báo chí, website công khai | Gửi được, giữ provenance/citation |
| Internal | Brief nội bộ, lịch SK chưa công bố | Chỉ khi policy cho phép; audit + tối thiểu hóa |
| Confidential | Danh bạ, chi phí, hợp đồng, ghi âm tương tác | Redact/pseudonymize; consent voice; use-case allowlist |
| Restricted | Giấy tờ định danh, tài khoản NH, bí mật đặc biệt | KHÔNG gửi external AI mặc định |

## E. Áp dụng (một registry, ba phép thực thi)
```
PolicyEngine(registry):
  authorizeRead(principal, entity, outputShape)      # mask field + projection
  authorizeWrite(principal, entity, operation, input) # fail-closed 403 nếu chạm field mật ngoài quyền
  authorizeAttachment(principal, attachment, action)  # gate /files/:id + upload theo classification server-derived
```
`read money = module.view ∧ org_fee` · `write money = module.(create|edit) ∧ org_fee` (quyết định D2).
