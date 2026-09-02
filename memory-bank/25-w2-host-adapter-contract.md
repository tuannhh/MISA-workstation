# 25 — W2.5 Host-adapter contract

> **Status:** CONTRACT-READY — 2026-09-02. Fake adapter là boundary development/test; provider AMIS
> production được DevOps/AMIS thiết lập cùng deployment và nằm ngoài repository này. Handoff reference:
> [`31-o3-amis-bridge-acceptance.md`](31-o3-amis-bridge-acceptance.md).

## 1. Mục đích và ranh giới

W2.5 tạo một seam duy nhất giữa UI composition và host. Nó cho phép từng slice Wave 3 dùng chung logic nghiệp vụ nhưng chọn đúng shell Desktop hoặc Native-Mobile trước khi xét role/permission.

- Không chứa bearer token, cookie, `principal`, hoặc cơ chế bridge AMIS suy đoán. Xác thực/authorization tiếp tục là server-side; O3 sẽ định nghĩa luồng principal thật.
- Không sniff user-agent, viewport, hoặc role để chọn shell. Bootstrap đáng tin cậy truyền `surface` tường minh.
- Không tích hợp vào `public/app.js` legacy trong W2.5. Slice People Detail là consumer đầu tiên; không chạm legacy giúp rollback độc lập.
- `fake-browser` và `fake-native` chỉ dành cho contract/UI test. Không được coi là provider production.

## 2. Contract ổn định

Module: [`frontend/src/platform/host-adapter.mjs`](../frontend/src/platform/host-adapter.mjs).

| Nhóm | API | Cam kết |
|---|---|---|
| Chọn bề mặt | `createHostAdapterRegistry().select(surface)` | `desktop` → Browser, `native` → Native; thiếu adapter đúng surface ném `HOST_ADAPTER_UNAVAILABLE`, không fallback âm thầm. |
| Context an toàn | `getContext()` | Chỉ locale/theme/surface metadata; tuyệt đối không nhận `principal` trước O3. |
| Layout/runtime | `getSafeArea()`, `getLifecycle()`, `subscribe(viewport/lifecycle/keyboard/deep-link)` | Một điểm vào cho safe area, keyboard, lifecycle và inbound deep link; page không tự gắn listener host rải rác. |
| Điều hướng | `goBack({ reason })` | Native page gọi host adapter; form bẩn sẽ tự xác nhận trong slice rồi mới gọi. |
| Device capability | `requestCapability(name)` | Trả một trong `granted/limited/denied/blocked/unavailable`; mặc định `unavailable`, không giả vờ Browser có quyền OS. |
| Recovery | `openSettings(capability)` | Provider thật sẽ mở setting host; fake trả `unavailable` rõ ràng. |
| Gesture | `setSystemGestureEnabled(boolean)` | Viewer/media slice sẽ báo host khoá/mở edge gesture đúng thời điểm. |

Deep link chỉ là tín hiệu `{ path }`: consumer phải resolve session → entity → RBAC trước khi render dữ liệu theo MDS 7.3. Adapter không được tự trust payload.

## 3. Matrix W2.5

| Surface | Provider hiện có | Roles | Trạng thái |
|---|---|---|---|
| Desktop browser | `fake-browser` | Không phụ thuộc role | PASS contract test; chưa là page UI mới |
| Native WebView test | `fake-native` | Không phụ thuộc role | PASS contract test; chưa là host AMIS thật |
| Native WebView AMIS | DevOps/AMIS khi deploy | Tất cả role | External deployment handoff; không phải code gate của repo |

## 4. Evidence và cách chạy

```bash
node --test server/test/unit-host-adapter.test.js
npm run build:ui
```

Các case `W25-001..004` xác nhận hai fake provider cùng contract, Native không rơi về Browser, lifecycle/safe-area/deep-link/Back được mô phỏng, và provider sai bị fail sớm. Không có route map delta trong W2.5 vì chưa có UI slice nào consume seam.

## 5. Bàn giao cho W3

Slice People Detail phải:

1. Gọi registry với surface do bootstrap host xác nhận.
2. Dựng `desktop/` và `mobile/` page tree riêng; Native root dùng `.mds-mobile-app`.
3. Áp role/permission sau khi chọn shell; 403 cũng ở native shell.
4. Dùng adapter cho Back, lifecycle, deep link và capability; không gọi trực tiếp API bridge/browser như production.
5. Bổ sung case route × four-role × Desktop/Native và ghi rõ thiết bị/bridge còn UNVERIFIED tới W4.1.
