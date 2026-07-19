# Hệ thống Quản trị & Giám sát Truyền thông – PR MISA

Prototype **Phương án A**: Phân hệ 2 (CRM quan hệ đối ngoại) + Đăng nhập + Phân quyền (RBAC) + Bảo mật trường dữ liệu nhạy cảm.

> 📄 **Đề xuất giải pháp tổng thể** (scope, workflow, RBAC, kiến trúc, lộ trình, phương án deploy): [`docs/de-xuat-giai-phap.html`](docs/de-xuat-giai-phap.html) — mở bằng trình duyệt.

## Công nghệ

- UI: Vue 3 + Tailwind CSS, token/component theo MISA Design System 2.0.
- Backend: Node.js 24 + Express.
- Database mặc định: MySQL 8.4 (`DB_CLIENT=mysql`). SQLite chỉ còn là chế độ tương thích để chạy nhanh dữ liệu cũ.

## Chạy với MySQL (khuyến nghị)

```bash
cp .env.example .env
docker compose up --build
# Mở http://localhost:3007
```

MySQL và thư mục tệp tải lên được lưu bằng Docker volume. Khi khởi động lần đầu, backend tự tạo bảng và dữ liệu tài khoản mặc định.

## Chạy nhanh với SQLite cũ

```bash
npm install
DB_CLIENT=sqlite npm start
# Mở http://localhost:3007
```
- Đặt lại dữ liệu mẫu SQLite: `DB_CLIENT=sqlite npm run seed`
- Dữ liệu tương thích SQLite lưu ở `data/pr.db`.

## Tài khoản demo
| Tài khoản | Mật khẩu | Vai trò | Đặc điểm |
|---|---|---|---|
| `admin` | `admin123` | Super Admin (IT) | Toàn quyền + quản trị + xem dữ liệu mật |
| `truongphong` | `123456` | Trưởng phòng PR | Toàn quyền nghiệp vụ + **xem dữ liệu mật** |
| `chuyenvien` | `123456` | Chuyên viên PR | Thêm/sửa, **KHÔNG xem dữ liệu mật** (hiển thị ●●●) |
| `lanhdao` | `123456` | Ban Lãnh đạo | **Chỉ xem**, không sửa, không dữ liệu mật |
| `xem` | `123456` | Cộng tác viên | Xem hạn chế (không CQNN/Danh bạ/Quản trị) |

## Tính năng prototype
- **CRM đối ngoại:** Cơ quan báo chí · Phóng viên (điểm quan hệ) · Hiệp hội (hội phí, tài trợ, giải thưởng) · CQNN · Danh bạ/VIP · Lịch sử tương tác.
- **RBAC:** 5 vai trò, gác quyền theo module + hành động (xem/thêm/sửa/xóa), menu dựng động theo quyền.
- **Bảo mật trường nhạy cảm:** đời tư phóng viên, hội phí, ngân sách tài trợ bị che `●●●` với người không đủ quyền; **ghi audit log** khi người đủ quyền mở dữ liệu mật.
- **Dashboard** tổng quan + **trang Quản trị** (người dùng + nhật ký truy cập).
- Bảng có **tìm kiếm + phân trang server-side** (sẵn sàng chịu tải nhiều bản ghi).

## Tự điền sự kiện từ Excel an toàn

Người dùng có thể tải trực tiếp file `.xlsx`, `.xls`, `.xlsb` hoặc `.csv` (tối đa 10 MB) tại màn hình Sự kiện. Hệ thống đọc và lấy mẫu file trong worker riêng, giới hạn thời gian/bộ nhớ, sau đó chỉ gửi phần văn bản cần thiết sang Gemini để đề xuất dữ liệu cho biểu mẫu. File gốc không được lưu trên máy chủ.

- Email, số điện thoại và dãy số định danh dài được thay bằng nhãn ẩn trước khi phân tích.
- Trang tính có tên dạng “Danh sách”, “Khách mời”, “Đại biểu”, “Liên hệ”, “Contact” hoặc “Attendee” không gửi nội dung chi tiết sang AI.
- File lớn được ưu tiên lấy các dòng có thông tin sự kiện thay vì đọc toàn bộ; giao diện sẽ báo rõ nếu đã lấy mẫu.
- File giả phần mở rộng, sai chữ ký, quá dung lượng, quá thời gian hoặc quá tài nguyên bị từ chối bằng thông báo tiếng Việt dễ xử lý.
- Giới hạn 8 lượt tự điền/phút/người dùng để giảm lạm dụng và chi phí AI.

Lưu ý: nội dung sau khi đã giảm thiểu dữ liệu vẫn được gửi tới dịch vụ Gemini. Không tải lên tài liệu thuộc mức phân loại cấm đưa lên dịch vụ AI bên ngoài theo chính sách bảo mật nội bộ MISA.

Kiểm tra lớp bảo vệ Excel và email:

```bash
npm run test:security
npm audit
```

## Cấu trúc
```
server/
  index.js         – Express app, session
  db.js            – schema + seed, chọn MySQL/SQLite bằng DB_CLIENT
  mysql-sync.js    – adapter MySQL cho API truy vấn hiện hữu
  mysql-worker.js  – kết nối MySQL bất đồng bộ trong worker riêng
  auth.js    – đăng nhập, middleware phân quyền
  rbac.js    – ma trận quyền + cấu hình trường nhạy cảm + masking
  routes.js  – REST API cho toàn bộ module CRM + admin
frontend/
  src/             – khung Vue, MISA tokens, component và Tailwind
public/
  index.html, app.js – nghiệp vụ SPA và bundle Vue đã build
```

## Bước tiếp theo (theo lộ trình đề xuất)
- Đăng nhập SSO/AD nội bộ MISA.
- Triển khai UAT trên Cloud Run, sau đó chuyển về server nội bộ MISA.
- Xây Phân hệ 1 (giám sát truyền thông: crawler + phân tích AI Gemini).
