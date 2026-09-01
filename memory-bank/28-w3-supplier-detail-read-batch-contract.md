# 28 — Batch Contract: W3.SUPPLIER.READ (Supplier Detail strangler)

> **Status:** READ + WRITE-CORE + FILE-METADATA/UPLOAD IMPLEMENTED / pending local build and regression verification. Native production remains **UNVERIFIED**.

## Scope

This slice claims `#suppliers/:id` only when `supplierDetailRead` is enabled by the host (or the explicit localhost harness flag `uiSupplierPilot=1`). It renders the existing R072 `GET /api/suppliers/:id` record in separate Desktop MDS and Native mini-app compositions.

The client uses only `payload.record`, which has already passed `PolicyEngine.projectRecord`. It conditionally renders `service_fee_pct` and `deposit_pct` only if those properties are present in the server response; it never tries to unmask or reconstruct them.

## Explicit exclusions

Quotes, transactions, contacts, dates, files, and every create/edit/delete/upload action remain in the legacy route even while this read pilot is enabled. Those sub-resources have their own Direct/Global/file policies and must move in dedicated slices, particularly before exposing monetary quote/transaction fields.

**Write core (R082):** the Desktop/Native forms send only the explicit Public allowlist `name`, `industry`, `address`, `services`, `tax_code`, `invoice_type`, `note`. They never send commercial percentages, contact fields, `order_group_link`, owner/role or sub-resource data. `GET /api/me` only suggests whether to show Edit; `PUT` remains server-enforced. Native has safe-area footer and confirms discarding an unsaved draft.

**File metadata/upload (R086 + R037):** metadata (`id`, name, MIME) follows D13's approved “existence vs content” rule and is rendered without file content. Supplier is Global and quote files are private: only Admin/Super Admin get an open link, while others see the metadata plus an explicit restricted state. Users with `suppliers.edit` may upload through MDS `MUpload`; the upload and download endpoints enforce permission again. No delete action is rendered because the existing attachment-delete endpoint fails closed for supplier files.

## Surface and security contract

| Flow | Desktop | Native fake host | AMIS Native host |
|---|---|---|---|
| R072 Supplier Detail read | MDS detail page | independent `.mds-mobile-app` composition | **UNVERIFIED — O3/W4.1** |
| R082 Supplier core edit | MDS compact form | independent Native form + discard confirmation | **UNVERIFIED — O3/W4.1** |
| R086 upload and R037 download supplier file | MDS metadata/upload panel | panel in Native mini-app | **UNVERIFIED — O3/W4.1 file bridge** |
| Missing/invalid native adapter | n/a | explicit native recovery shell | never falls back to Desktop |

Lifecycle, viewport/safe-area, deep-link and Back use the W2.5 host-adapter contract. The localhost fake-native route is `?uiSupplierPilot=1&uiSupplierSurface=native`; it is not production-device evidence.

## Exit criteria

1. `UI-SUP-001..004`, build and applicable regression are green.
2. No transaction, quote, contact, file or non-projected financial data is in the supplier view model.
3. Flag default is false and rollback is disabling `supplierDetailRead`.
4. Native AMIS production remains unclaimed pending O3/W4 evidence.
