# 03 — Data Classification Registry (dự thảo cho PolicyEngine)

> Nguồn phân loại **duy nhất** mà PolicyEngine đọc cho cả read-mask, write-guard và file-gate.
> Cột tiền đã xác nhận trong `server/db.js` (grep 2026-08-22).
> **Status: O1 APPROVED (owner, 2026-08-25 — `PR-WORKSTATION-CODEX-G0-CLOSE-CONTRACT.md` C0.1.1).** File này giờ là registry đã chốt cho 2 trục §A/§C (`classification_tier` — trần bảo mật) — không còn "draft chờ duyệt".
> Lưu ý naming: table (số nhiều) ≠ policy-entity (số ít) — vd `organizations`↔`organization`, `supplier_quotes`↔`supplier_quote`. PolicyEngine dùng **policy-entity**; map table↔entity phải nằm TRONG registry (không để rải rác).
>
> **Cập nhật sau D13 + Codex C0.2 (2026-08-24/25, xem `02-decisions.md` §D):** owner chốt mô hình lớn hơn — nhưng Codex round-3 re-audit (R3-03) chỉ ra KHÔNG được gộp classification và visibility vào 1 cờ boolean duy nhất (Admin có thể lỡ tay công khai hoá dữ liệu tài khoản NH/giấy tờ tùy thân). Vì vậy registry ở file này giờ đóng đúng 1 vai trò: **§A/§C là nguồn `classification_tier`** (trần bảo mật server-controlled, KHÔNG phải Admin UI thường đổi được — xem D13.2a) — KHÔNG phải nguồn `audience_visibility` (bảng `field_visibility` động, Admin tự cấu hình, chỉ được SIẾT không được NỚI dưới trần tier này). `org_fee` không còn là 1 quyền riêng — chỉ là 1 nhóm field có `classification_tier=Confidential` trong cơ chế chung.

## A. Nhóm `org_fee` — trường tiền persisted (`classification_tier = Confidential`)

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

## B. O1 — APPROVED 2026-08-25 (trước đây "cần owner xác nhận")
> Evidence: `PR-WORKSTATION-CODEX-G0-CLOSE-CONTRACT.md` C0.1.1, owner "tôi duyệt 4 mặc định C0.1 như bạn đề xuất nhé". Xem đầy đủ ở `02-decisions.md` §B dòng O1 + §D D13.2a.

- `suppliers.service_fee_pct` (`db.js:266`), `suppliers.deposit_pct` (`db.js:268`): điều khoản % thương mại → **`classification_tier = Confidential`** (APPROVED, cùng nhóm `org_fee`).
- **Derived/projection** kế thừa tier `Confidential` từ nguồn (registry mô tả cả field dẫn xuất): `bookings.total_amount`, `events.total_cost`, `events.totals.*`, report `spend/budget/grandTotal/fee totals`, award `partBudget/mediaCost/totalCost`. **Áp dụng nghiêm ở tầng truy vấn** (không chỉ mask response) — xem `02-decisions.md` D13.4b về rò rỉ qua aggregate.
- **Tài liệu tiền:** `supplier_quotes kind=quote` → `Confidential`. Agreement / work-log / award doc / event doc → **`Confidential` (APPROVED, mặc định an toàn)** — server phân loại theo loại tài liệu (D3/D13.3b), `audience_visibility` mặc định `private`, hạ xuống Public chỉ khi Admin xét lại từng loại tài liệu cụ thể (không được vượt trần qua UI thường nếu tier vẫn Confidential).
- **Không cho client tự đặt classification** (D3, RETAINED).

## C. Nhóm mật cá nhân (person) — đã tồn tại trong `server/rbac.js:66-73`, giờ = `classification_tier` seed cho D13.2a
| Nhóm | Trường | `classification_tier` |
|---|---|---|
| contact | phone_personal, phone_other, phone_ott | Confidential |
| private | dob, home_address, personal_notes, personality, hobbies, food_habits, family_info, media_stance, relationship_network, meeting_places, gift_rules | Confidential |
| social | social_facebook, social_instagram, social_tiktok, social_x, social_thread | Confidential |
| finance | bank_account_number, bank_name | **Restricted** |
| iddoc | attachments `kind='id_doc'` | **Restricted** |
| org_fee | §A | Confidential |

## D. Data-tier gửi Gemini (khuyến nghị — chờ Security/Legal duyệt, O8)
| Tier | Ví dụ | Policy mặc định |
|---|---|---|
| Public | Tin báo chí, website công khai | Gửi được, giữ provenance/citation |
| Internal | Brief nội bộ, lịch SK chưa công bố | Chỉ khi policy cho phép; audit + tối thiểu hóa |
| Confidential | Danh bạ, chi phí, hợp đồng, ghi âm tương tác | Redact/pseudonymize; consent voice; use-case allowlist |
| Restricted | Giấy tờ định danh, tài khoản NH, bí mật đặc biệt | KHÔNG gửi external AI mặc định |

## E. Áp dụng (một registry, bốn trục — sửa lại sau D13/C0.2, D2 đã SUPERSEDED)
```
PolicyEngine(registry):
  authorizeRead(principal, entity, outputShape)      # classification_tier (§A/§C/§D) × audience_visibility (field_visibility) × projection/aggregate
  authorizeWrite(principal, entity, operation, input) # role (D13.1) × ownership (D13.4) — fail-closed 403 nếu chạm field mật ngoài quyền
  authorizeAttachment(principal, attachment, action)  # gate /files/:id + upload theo classification server-derived + trần visibility (D13.3b)
  authorizeEgress(entity, purpose, provider)          # classification_tier × O8 policy — KHÔNG dùng audience_visibility làm căn cứ egress
```
**Không còn công thức `module.view ∧ org_fee`** (D2 SUPERSEDED BY D13, xem `02-decisions.md` §A) — tiền chỉ là field có `classification_tier=Confidential`, đọc/ghi quyết định bởi role (D13.1) + ownership (D13.4) + `audience_visibility` như mọi field mật khác, không có nhánh riêng cho tiền.
