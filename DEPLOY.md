# Triển khai MISA PR Workstation lên Railway

Ứng dụng dùng **SQLite (file)** + **lưu ảnh/giấy tờ trong `data/uploads/`** + **scheduler chạy nền**, nên cần:
- 1 **Volume** (ổ đĩa bền) để giữ dữ liệu qua các lần deploy.
- 1 instance **luôn bật** (đã đặt `numReplicas: 1` trong `railway.json`).

## Các bước

### 1. Tạo project từ GitHub
- Railway → **New Project → Deploy from GitHub repo** → chọn `tuannhh/pr-media-system`.
- Railway tự nhận Node (theo `engines.node >= 24` trong `package.json`) và chạy `npm start`.

### 2. Thêm Volume (bắt buộc — nếu không sẽ MẤT dữ liệu khi redeploy)
- Trong service → tab **Variables/Volumes → New Volume**.
- **Mount path:** `/data`

### 3. Đặt biến môi trường (tab **Variables**)
| Biến | Giá trị | Ghi chú |
|---|---|---|
| `DATA_DIR` | `/data` | trỏ DB + uploads vào volume |
| `SESSION_SECRET` | (chuỗi ngẫu nhiên dài) | bảo mật phiên đăng nhập |
| `GEMINI_API_KEY` | `AQ.Ab8RN6…` | bật AI giọng nói + tạo thiệp |
| `SMTP_HOST` | `smtp-relay.brevo.com` | email Brevo |
| `SMTP_PORT` | `587` | |
| `SMTP_USER` | (SMTP login Brevo) | dạng `xxxx@smtp-brevo.com` |
| `SMTP_PASS` | (SMTP key Brevo) | |
| `SMTP_FROM` | (email người gửi đã verify) | vd `tkmedia@misa.com.vn` |

> `PORT` do Railway tự cấp — không cần đặt.

### 4. Deploy & kiểm tra
- Bấm **Deploy**. Khi xong → **Settings → Networking → Generate Domain** để lấy URL công khai (HTTPS).
- Lần chạy đầu sẽ tự seed dữ liệu mẫu + 5 tài khoản demo (`admin/admin123`, …).
- Mở URL → đăng nhập → kiểm tra: AI giọng nói/thiệp (cần `GEMINI_API_KEY`), gửi email nhắc (cần SMTP Brevo).

## Lưu ý
- **Bí mật không nằm trong repo**: `data/` đã được `.gitignore` (gồm `gemini.key`, `smtp.json`, `pr.db`). Trên Railway dùng **biến môi trường** thay cho các file đó.
- **Reset dữ liệu demo**: chạy `npm run seed` (xóa & seed lại) — cẩn thận, mất dữ liệu thật.
- **Production nội bộ MISA** (lộ trình sau): chuyển SQLite → PostgreSQL, đóng gói Docker, đưa về server nội bộ; lúc đó volume/đường dẫn dữ liệu sẽ thay bằng DB ngoài.

## Email Brevo (gói miễn phí)
- Tạo SMTP key: Brevo → **SMTP & API → SMTP** → *Generate a new SMTP key*.
- Verify người gửi: Brevo → **Senders, Domains & Dedicated IPs → Senders** → thêm & xác minh email dùng làm `SMTP_FROM`.
- Free tier ~300 email/ngày — đủ cho nhắc sự kiện nội bộ.
- Thử nhanh tại máy local: tạo file `data/smtp.json`:
  ```json
  { "host": "smtp-relay.brevo.com", "port": 587, "user": "xxxx@smtp-brevo.com", "pass": "SMTP_KEY", "from": "tkmedia@misa.com.vn" }
  ```
