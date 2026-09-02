# 32 — Production handoff: DevOps/AMIS và governance

> **Trạng thái:** HANDOFF / ngoài repository — cập nhật 2026-09-02 theo chỉ đạo owner. Mục đích của
> file này là để đội DevOps MISA có một danh sách triển khai production rõ ràng; không biến các mục
> hạ tầng/host thành backlog code của PR Workstation hoặc suy đoán API bridge chưa được MISA công bố.

## 1. Ranh giới trách nhiệm

Project đã có Native-Mobile composition riêng, host-adapter seam/fake provider và kiểm tra local.
`frontend/src/platform/host-adapter.mjs` **không** phải provider production. Khi người dùng chạm icon
trong AMIS Mobile, host MISA sẽ mở mini-app này vào native surface. Đội DevOps/AMIS chịu trách
nhiệm launcher/WebView/SSO bridge và kiểm chứng thiết bị; repository không viết giả một API host,
không nhận principal trực tiếp từ UI và không tự gọi microphone OS.

| Hạng mục | Owner production | Repository đã có | Evidence DevOps/AMIS cần trả | Trạng thái repo |
|---|---|---|---|---|
| O3 / W4.1 bootstrap host, SSO principal, Back, safe area, lifecycle, deep-link | DevOps MISA + AMIS Mobile | Native composition + adapter contract/fake provider (`25-w2-host-adapter-contract.md`) | Contract versioned, app id/origin staging, auth negative cases, device log | HANDOFF — không code provider ở repo |
| W4.2/W4.3 layout, OS accessibility, permission/capability, gesture và lifecycle trên thiết bị | DevOps MISA + AMIS Mobile | MDS mobile trees; local fake-native checks | Ma trận 375/393/412/768/1024, font/display scale, portrait/landscape, denied/revoked/unavailable, deep-link 403 | HANDOFF |
| W4.VOICE microphone/permission trong WebView host | DevOps MISA + AMIS Mobile | Voice propose/confirm và global entry; không gọi browser mic | Deny/grant/revoke/unavailable, foreground/background, no audio/PII/token in telemetry | HANDOFF |
| O4 runtime session/secret/DB/uploads | DevOps MISA | SQL-backed session logic đã có; production bắt buộc `NODE_ENV=production` + `SESSION_SECRET` | Secret injection, Cloud SQL connection/least privilege, persistent `DATA_DIR` hoặc object storage, restart/revoke smoke | HANDOFF cấu hình, không mở code task |
| O5/W4.4 vận hành release | DevOps MISA | CI regression, health code và perf artifacts hiện có | SLO/error budget, canary/rollback, alerting/correlation, backup + restore drill, incident owner | HANDOFF |
| O8 dữ liệu thật qua Gemini/Voice | Security/Legal MISA (không phải DevOps thuần) | Gateway/redaction/audit/kill-switch và synthetic live contract | Phê duyệt policy dữ liệu thật, retention/access, điều kiện bật AI/Voice | GOVERNANCE HANDOFF |

Chi tiết contract O3 và ma trận thiết bị nằm ở
[`31-o3-amis-bridge-acceptance.md`](31-o3-amis-bridge-acceptance.md). Runbook biến môi trường và
điểm cần provision nằm ở [`13-deployment-runbook.md`](13-deployment-runbook.md) §B/C.

## 2. Không được diễn giải sai khi bàn giao

- Local Chrome/fake-native chứng minh composition và luồng web của project, **không** thay bằng
  chứng device/WebView AMIS thật.
- Host không được cấp quyền chỉ từ payload UI. Server phải xác thực proof/session và luôn là nguồn
  RBAC/PolicyEngine cuối cùng.
- Không đưa token vào query string, `localStorage`, log WebView hay telemetry. Bridge sai origin,
  schema/version, TTL, audience hoặc replay phải fail-closed.
- W2.3 là bài kiểm thử trong repository còn mở (profile 50 người có think time), không phải việc
  DevOps có thể đánh dấu PASS thay project. W2.4 chỉ mở nếu profile đó không đạt hoặc quy mô vượt 50.

## 3. Điều kiện để DevOps nhận build

1. Nhánh `main` xanh CI và có artifact build đúng commit.
2. Không còn native route nào thuộc phạm vi release rơi về legacy desktop shell; ma trận
   route × Desktop/Native × 4 role được cập nhật sau từng strangler slice.
3. W2.3 có artifact MySQL profile 50 người dùng tác nghiệp, hoặc owner ghi quyết định hoãn rủi ro
   một cách tường minh.
4. AI/Voice trên dữ liệu thật chỉ bật sau phê duyệt O8; nếu chưa có, dùng cấu hình `AI_DISABLED`.

Mọi mục trong file này được **bỏ qua khi triển khai code project** cho tới khi DevOps/AMIS gửi contract
hoặc evidence từ môi trường MISA. Khi đó chỉ làm integration có scope hẹp theo contract thật, không
viết lại các màn Native-Mobile đã có.
