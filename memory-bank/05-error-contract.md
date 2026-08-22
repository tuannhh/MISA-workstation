# 05 — Error Contract (G0.5)

> Fact hiện trạng đã kiểm chứng + target đề xuất. Chưa sửa code — chờ duyệt cùng lúc với W1.

## Hiện trạng (đã xác nhận)

- Toàn bộ handler trả `res.status(NNN).json({ error: '<message tiếng Việt>' })` — ví dụ `server/routes.js:127,209,364,455,469`. Không có `code` ổn định, không có `requestId`, không có `details`.
- `server/auth.js:20,29,36,42,45` cùng pattern cho 401/403.
- Error middleware toàn cục (`server/index.js:37-41`) bắt lỗi multer + lỗi chưa xử lý → luôn trả **400** kèm `err.message` **kể cả khi lỗi là 500 thật** (ví dụ lỗi DB) — message có thể lộ chi tiết implementation.
- **Frontend đọc `data.error` ở khắp nơi** (`public/app.js:14,23,768,2077,2114,...`) — đây là **hợp đồng ngầm hiện tại**, không được phá khi đổi envelope.

## Target envelope (thêm, không thay — giữ tương thích)

```json
{
  "error": "Không đủ quyền xem giấy tờ tùy thân",   // GIỮ NGUYÊN — frontend cũ vẫn đọc được
  "code": "FORBIDDEN_SENSITIVE_GROUP",               // MỚI — machine-readable, ổn định qua thời gian
  "requestId": "req_c8f1...",                        // MỚI — trace log
  "details": { "group": "iddoc" }                    // MỚI — optional, không bắt buộc
}
```

## Mã lỗi chuẩn theo HTTP status

| Status | Khi dùng | Ví dụ code |
|---|---|---|
| 401 | Chưa đăng nhập / session hết hạn | `UNAUTHENTICATED` |
| 403 | Đã đăng nhập nhưng thiếu quyền module/sensitive-group | `FORBIDDEN_MODULE`, `FORBIDDEN_SENSITIVE_GROUP` |
| 404 | Resource không tồn tại | `NOT_FOUND` |
| 409 | Conflict (vd sửa đồng thời, unique constraint) | `CONFLICT` |
| 422 | Input hợp lệ dạng JSON nhưng sai business rule | `VALIDATION_FAILED` |
| 500 | Lỗi server thật — **KHÔNG lộ `err.message` thô ra client**, chỉ log server-side + `requestId` | `INTERNAL_ERROR` |

## Việc cần sửa (đưa vào Wave 1, không phải Gate 0)
1. Middleware toàn cục (`index.js:37-41`): phân biệt lỗi multer (400 đúng) vs lỗi khác (500, message chung + log chi tiết server-side).
2. `requirePerm`/PolicyEngine (W1.2/W1.3) trả `code` ổn định thay vì chỉ message tiếng Việt tự do.
3. Thêm `requestId` middleware (uuid mỗi request, gắn vào log + response) — nền cho audit W1.7/W1.AI-POLICY.
4. **Không đổi field `error`** trong giai đoạn chuyển tiếp — chỉ thêm field mới, tới khi frontend (Wave 3 strangler) chuyển sang đọc `code`.

## Exit criterion
Mọi response lỗi mới (từ W1 trở đi) có `code` ổn định + `requestId`; response lỗi cũ (chưa migrate) vẫn có `error` hoạt động bình thường; không response nào lộ stack trace hoặc raw DB error message ra client.
