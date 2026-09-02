# 31 — O3 AMIS Mobile: deployment handoff reference

> **Status:** OWNER-CLARIFIED / outside this repository — 2026-09-02. Khi DevOps triển khai vào môi
> trường MISA, AMIS Mobile tự chịu trách nhiệm host/launcher/WebView và cấu hình bridge production.
> Project này **không** viết provider production, không tự chặn roadmap vì thiếu device-test AMIS, và
> không suy đoán token/bridge API. Tài liệu là handoff reference cho DevOps, không phải exit gate code.

## 1. Mục tiêu và nguyên tắc không suy đoán

PR Workstation chạy như web app trong AMIS Mobile WebView. Người dùng mở AMIS Mobile, chạm icon của
ứng dụng và host điều hướng thẳng vào Native-Mobile composition của PR Workstation. `frontend/src/platform/host-adapter.mjs` chỉ là seam/fake-host phục vụ development; DevOps/AMIS tự cung cấp bridge production khi deploy.

- Không chọn sẵn bearer token, cookie, one-time-code hay SDK assertion. DevOps/AMIS chọn **một** cơ chế, ghi thành contract versioned và cung cấp test environment.
- Không truyền token qua query string, `localStorage`, log WebView hay error telemetry. UI không nhận `principal` trực tiếp từ bridge; server mới xác thực token/assertion và dựng `req.principal`.
- Bridge input fail-closed: sai origin, version/schema không hỗ trợ, chữ ký/audience/TTL/replay không hợp lệ, hoặc capability không rõ → không cấp session/quyền và không fallback Browser adapter.
- Fake provider W2.5 chỉ dùng cho test; mọi PASS bên dưới cần evidence chạy trong AMIS WebView trên thiết bị thật.

## 2. Quyết định DevOps/AMIS phải trả lời bằng văn bản

| Mục | Bắt buộc chốt | Evidence tối thiểu |
|---|---|---|
| Bootstrap | Allowed web origin(s), app id, bridge version, cách host báo `surface=native` | Versioned schema + staging app id/origin |
| Principal | Một trong bearer/cookie/one-time-code/SDK assertion; issuer, audience, tenant claims, TTL, refresh, revoke và server verification | Sequence diagram + test token/assertion hợp lệ/sai/hết hạn/replay |
| Inbound messages | Channel và envelope `{version,type,requestId,payload}`; origin/source validation; size/rate limit | Contract test: origin/schema/version lạ bị reject |
| Navigation | Semantics Back, deep-link allowlist, foreground/background, app reload | Device log/test cho Back và deep-link 403 |
| Viewport | Safe-area, keyboard, orientation/split state và thứ tự event | Device matrix iOS/Android, portrait/landscape |
| Capability | File/camera/microphone: request, status `granted/limited/denied/blocked/unavailable`, revoke, open Settings | Permission deny/grant/revoke trên thiết bị thật |
| Observability | Redacted request id/correlation id, không lộ token/audio/PII, alert khi bridge reject | Staging log sample + retention/access policy |

## 3. Contract adapter cần đáp ứng

Provider production phải qua `assertHostAdapter()` và chỉ triển khai các method đã tồn tại:

| Adapter API | Hành vi production cần chứng minh |
|---|---|
| `getContext()` | locale/theme/surface metadata; **không** trả principal chưa được server xác thực |
| `getSafeArea()` + `subscribe('viewport')` | trả safe area ban đầu và cập nhật sau orientation/keyboard; UI dùng giá trị này cho top bar/floating action/footer |
| `getLifecycle()` + `subscribe('lifecycle')` | foreground/background/reload có schema versioned; app không tự ghi khi background |
| `subscribe('deep-link')` | chỉ deep link allowlist; route protected luôn để server trả 401/403, không trust payload host |
| `goBack()` | Back hardware/host chỉ chạy sau guard form bẩn của slice; result rõ `handled` hoặc failure |
| `requestCapability()` / `openSettings()` | chỉ trả enum chuẩn; mic/file/camera không có bridge thì `unavailable`, không giả browser permission là OS permission |
| `setSystemGestureEnabled()` | host có ack/timeout; media/viewer không làm kẹt Back gesture |

## 4. Luồng auth/principal bắt buộc kiểm thử

1. Host bootstrap **không** tự làm người dùng có quyền. Browser dùng session hiện tại; AMIS provider chuyển proof tới endpoint server-side theo cơ chế DevOps chốt.
2. Server kiểm issuer/audience/tenant/TTL/chống replay rồi mới tạo hoặc gắn session; role/permission luôn lấy từ server RBAC v2, không từ claim UI.
3. Refresh, logout host, revoke và đổi role phải khiến request sau bị 401/403; UI chỉ hiển thị recovery state, không giữ quyền cũ.
4. Test tối thiểu: proof hợp lệ; expired; wrong issuer/audience; wrong tenant; replay; origin/message giả; host logout; role bị rút giữa foreground và confirm Voice.

## 5. W4 device acceptance matrix

| Nhóm | Cases bắt buộc | Pass criteria |
|---|---|---|
| Roles | Viewer, Executor, Admin, Super Admin × route release | 401/403/field projection đúng server; client không suy diễn tiền/file/quyền |
| Layout MDS | 375/393/412/768/1024; portrait/landscape/split; Dynamic Type/Font scale | Native composition riêng, touch target ≥48px, không overflow, focus/keyboard không che action |
| Navigation | Host Back, in-app Back, dirty draft, deep-link hợp lệ/403 | Không mất draft trái ý; deep-link không bypass authorization |
| Capabilities | file picker, camera, mic deny/grant/revoke/unavailable | UI fail-closed, có recovery/open Settings khi contract cho phép |
| Voice | global entry → audio/mic → R149 proposal → user chọn/confirm R150 | Không ghi trước confirm; no token/audio/PII trong log; revoke/stale/timeout có recovery |
| Release ops | canary, rollback, readiness, telemetry, audit, backup/restore drill | DevOps ký evidence W4.4 trước release production |

## 6. Handoff boundary

Code handoff hoàn tất khi bản deploy chứa Native-Mobile composition riêng, server-side session/RBAC và
build/test của project xanh. Sau đó DevOps/AMIS chịu trách nhiệm cấu hình host, bridge, device matrix và
release evidence trong môi trường MISA — production artifact không được đưa ngược ra repository này để
agent tự kiểm thử. O8/Security-Legal cho dữ liệu thật vẫn là governance release riêng.
