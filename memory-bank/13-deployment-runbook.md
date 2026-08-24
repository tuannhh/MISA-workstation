# 13 — Triển khai & hạ tầng

> Nguồn: `DEPLOY.md` (Railway — LỖI THỜI, xem §D), `Dockerfile`, `docker-compose.yml`, `railway.json`, `.env.example`, `package.json`, `server/config.js`, `server/db.js`, `server/mailer.js`, `server/mysql-worker.js`, `memory-bank/README.md`. Tham chiếu, không lặp lại: production URL + trạng thái audit ở [`README.md`](README.md) mục lục.

## A. Chạy dev local

2 cách, tuỳ có muốn dùng MySQL thật hay SQLite tương thích nhanh:

### A.1 MySQL (khuyến nghị, khớp production)
```bash
cp .env.example .env
docker compose up --build
# Mở http://localhost:3007
```
`docker-compose.yml` dựng 2 service: `db` (MySQL 8.4, `utf8mb4_unicode_ci`, volume `mysql_data`) + `app` (build từ `Dockerfile`, đọc biến `MYSQL_HOST=db`). Lần khởi động đầu tự tạo bảng + seed 2 tài khoản (`server/db.js` — `init()`+`seed()` chạy ngay khi `require('./db')`, không cần lệnh riêng).

### A.2 SQLite (nhanh, chỉ tương thích — không phải đường chính)
```bash
npm install
DB_CLIENT=sqlite npm start
# hoặc: npm run start:local   (tự set DB_CLIENT=sqlite)
```
DB lưu ở `data/pr.db`. Reset dữ liệu mẫu: `DB_CLIENT=sqlite npm run seed` (chạy `node server/db.js --reseed`, xoá sạch + seed lại — **script `seed` trong `package.json` KHÔNG tự set `DB_CLIENT=sqlite`**, phải tự thêm biến môi trường khi gọi trên máy đang cấu hình MySQL, nếu không sẽ reseed nhầm MySQL production — xem [`14-known-traps.md`](14-known-traps.md)).

### A.3 Script khác trong `package.json`
| Script | Lệnh | Dùng khi |
|---|---|---|
| `dev` | `node --watch server/index.js` | chạy server với auto-reload, KHÔNG tự build lại UI Vue |
| `dev:ui` | `vite --config frontend/vite.config.mjs` | dev server Vite riêng cho khung Vue (không phục vụ `app.js`/API — chỉ dùng khi sửa `frontend/src/`) |
| `build` / `build:ui` | `vite build --config frontend/vite.config.mjs` | build khung Vue → `public/assets/vue-app.js`+`.css` |
| `prestart` | tự chạy `build:ui` trước `start` (npm hook) | đảm bảo `npm start` luôn có bundle Vue mới nhất |
| `test:security` | `DB_CLIENT=sqlite node --test server/security.test.js` | test bảo mật upload Excel/email (xem `server/security.test.js`) |

## B. Triển khai hiện tại — Cloud Run + Cloud SQL (CHỈ LÀ MÔI TRƯỜNG TEST, KHÔNG PHẢI PRODUCTION THẬT)

> **Sửa lại sau xác nhận trực tiếp của owner (2026-08-24) — bản trước ghi SAI khi gọi đây là "production".** Cả Railway (trước đây) lẫn Cloud Run + Cloud SQL (hiện tại) đều **chỉ là môi trường test/thử nghiệm trước khi DevOps MISA cấu hình môi trường production chính thức trên hạ tầng riêng của MISA** — hạ tầng production thật **CHƯA tồn tại** tại thời điểm ghi dòng này. `DEPLOY.md` mô tả Railway càng không áp dụng. Điều này ảnh hưởng cách đọc toàn bộ tài liệu: mọi chỗ trước đây ghi "production Cloud Run" trong `README.md`/file khác cần hiểu là "môi trường test hiện tại", KHÔNG phải cam kết target `browser-production` theo nghĩa `production-compatibility-gate` skill — target đó chỉ thật sự "đã kích hoạt" khi DevOps triển khai xong hạ tầng MISA chính thức.
>
> **Đã trả lời (owner, 2026-08-24): dữ liệu hiện tại trong Cloud Run/Cloud SQL là DỮ LIỆU TEST, không cần giữ.** Đây là fact quan trọng làm giảm mức khẩn cấp của mọi finding thuộc nhóm "phải cẩn thận vì đã có dữ liệu thật" (đặc biệt chuỗi migration R1.0-R1.7 ở `04-ROADMAP.md` — được thiết kế cẩn trọng dual-write/shadow-mode/rollback CHÍNH VÌ giả định có dữ liệu thật đang sống). **Cần rà soát lại `04-ROADMAP.md` khi rewrite theo D13**: có thể đơn giản hoá đáng kể — thay vì migrate tại chỗ, có thể **xoá sạch dữ liệu test + seed lại theo schema/RBAC mới** một lần trước khi đưa production thật vào (do DevOps MISA cấu hình). Không tự động coi mọi Tier-A finding hết giá trị — code vẫn cần đúng từ đầu cho khi dữ liệu thật xuất hiện, chỉ là **không cần retrofit cẩn trọng cho dữ liệu ĐANG có** vì dữ liệu đó bỏ được.

### B.1 Build & container
`Dockerfile` (`node:24-alpine`): `npm ci` → copy source → `npm run build:ui` (build Vue vào `public/`) → `EXPOSE 3007` → `CMD ["node", "server/index.js"]`. App đọc `process.env.PORT` (Cloud Run tự cấp `PORT=8080` khi deploy, override giá trị default `3007` trong `server/index.js:15`).

### B.2 Kết nối Cloud SQL
`server/mysql-worker.js:19-24`: nếu có `MYSQL_SOCKET_PATH` → dùng unix socket `/cloudsql/<INSTANCE_CONNECTION_NAME>` (chuẩn Cloud Run + Cloud SQL, không cần Cloud SQL Proxy sidecar riêng — Cloud Run tự mount socket khi khai báo Cloud SQL connection trong config service); nếu không → dùng `MYSQL_HOST`+`MYSQL_PORT` (cho Docker/local). **Ưu tiên `socketPath` nếu có** — 2 cách cấu hình loại trừ nhau qua 1 biến môi trường duy nhất (`MYSQL_SOCKET_PATH`).

### B.3 Volume/dữ liệu file upload
Khác kiến trúc Railway cũ (1 volume bền `/data` cho cả SQLite file + uploads), trên Cloud Run **container là stateless** — `data/uploads/` (ảnh chân dung, giấy tờ, file đính kèm) được ghi qua `UPLOAD_DIR` (`server/db.js:9-12`, mặc định `<repo>/data/uploads`, override bằng `DATA_DIR`). **UNVERIFIED**: chưa xác nhận được trong phạm vi code đã đọc liệu Cloud Run instance hiện tại có mount 1 volume bền (Cloud Storage FUSE, hoặc GCE persistent disk) cho `DATA_DIR`, hay file upload bị mất mỗi lần container bị Cloud Run tái chế/redeploy (rủi ro nghiêm trọng nếu chưa có — cần owner xác nhận hạ tầng thật, không suy đoán).

### B.4 Migration dữ liệu từ Railway → Cloud Run
`memory-bank/README.md` ghi nhận "đã có dữ liệu thật migrate từ Railway" nhưng **không có script/quy trình migration nào trong repo** (không tìm thấy file dump/import SQL, không có tool chuyển đổi SQLite→MySQL trong `server/`) — quy trình migration thực tế đã xảy ra là **UNVERIFIED trong phạm vi source code**, có thể đã làm thủ công ngoài repo (mysqldump, script 1 lần không commit, hoặc thao tác tay qua Cloud SQL console). Không suy đoán thêm chi tiết.

## C. Biến môi trường đầy đủ

| Biến | Bắt buộc? | Mặc định nếu bỏ trống | Ý nghĩa | Nguồn |
|---|---|---|---|---|
| `PORT` | không | `3007` | Cổng HTTP; Cloud Run tự set `8080` | `server/index.js:15` |
| `DB_CLIENT` | không | **`mysql`** | `mysql`\|`sqlite` — chọn engine DB. **Lưu ý: default là mysql, KHÔNG PHẢI sqlite** | `server/db.js:15` |
| `DATA_DIR` | không | `<repo>/data` | Thư mục chứa `pr.db` (nếu SQLite) + `uploads/` (mọi engine) | `server/db.js:9` |
| `SESSION_SECRET` | **nên có trên production** | `'misa-pr-dev-secret-change-me'` | Khoá ký session cookie — KHÔNG fail-fast nếu thiếu, chỉ dùng default không an toàn (F2) | `server/index.js:20` |
| `MYSQL_SOCKET_PATH` | chỉ khi Cloud SQL qua unix socket | — | Đường dẫn socket `/cloudsql/<INSTANCE_CONNECTION_NAME>`; có giá trị này thì bỏ qua `MYSQL_HOST`/`MYSQL_PORT` | `server/mysql-worker.js:19-24` |
| `MYSQL_HOST` | chỉ khi không dùng socket | `127.0.0.1` | Host MySQL (Docker: tên service `db`) | `mysql-worker.js:22` |
| `MYSQL_PORT` | chỉ khi không dùng socket | `3306` | | `mysql-worker.js:23` |
| `MYSQL_DATABASE` | nên có | `pr_media` | | `mysql-worker.js:14` |
| `MYSQL_USER` | nên có | `pr_media` | | `mysql-worker.js:12` |
| `MYSQL_PASSWORD` | nên có | `pr_media` | **default là mật khẩu yếu đã biết công khai (trong `.env.example`) — đổi bắt buộc trên production** | `mysql-worker.js:13` |
| `MYSQL_SYNC_BUFFER_BYTES` | không | `16 * 1024 * 1024` (16MB) | Buffer `SharedArrayBuffer` tối đa cho 1 response MySQL qua worker — vượt sẽ lỗi (`mysql-worker.js:51-56`) | `mysql-sync.js:6` |
| `MYSQL_QUERY_TIMEOUT_MS` | không | `30000` | Timeout `Atomics.wait` mỗi query MySQL — xem F7/D9 ở `01-audit-findings.md`/`02-decisions.md` | `mysql-sync.js:7` |
| `GEMINI_API_KEY` | chỉ nếu muốn bật AI | fallback file `data/gemini.key` | Bật toàn bộ 13 lời gọi Gemini (voice/thiệp/award/event/monitor) — không đặt = mọi route AI trả lỗi `Chưa cấu hình GEMINI_API_KEY`, không crash app | `server/config.js:5-15` |
| `GEMINI_TEXT_MODEL` | không | `gemini-3.5-flash` | Pin theo D10 — chỉ đổi sau golden eval | `server/config.js:19` |
| `GEMINI_IMAGE_MODEL` | không | `gemini-3.1-flash-image` | | `server/config.js:20` |
| `SMTP_HOST` | chỉ nếu muốn bật email nhắc | — | Có `SMTP_HOST`+`SMTP_USER` mới bật `mailer` | `server/mailer.js:10-11` |
| `SMTP_PORT` | không | `587` | | `mailer.js:11` |
| `SMTP_USER` / `SMTP_PASS` | cùng `SMTP_HOST` | — | Đăng nhập SMTP (khuyến nghị Brevo, xem `DEPLOY.md`) | `mailer.js:11` |
| `SMTP_FROM` | không | = `SMTP_USER` | Email hiển thị người gửi | `mailer.js:11` |
| `SMTP_SECURE` | không | `false` | `'true'` mới bật TLS ngay (STARTTLS mặc định qua port 587) | `mailer.js:11` |
| `MONITOR_AUTOSCAN` | không | tắt | `'1'` bật auto-scan giám sát truyền thông ngay từ env (độc lập với cấu hình `app_meta` qua UI) | `server/monitor.js:429` |
| `MONITOR_INTERVAL_H` | không | `4` | Chu kỳ auto-scan (giờ) khi bật qua env, chỉ dùng làm giá trị khởi tạo nếu `app_meta` chưa có | `monitor.js:431` |
| `RESET_DB` | **KHÔNG đặt trên production trừ khi chủ ý xoá sạch** | tắt | `'1'` khi khởi động → xoá sạch 22 bảng nghiệp vụ + seed lại — xem `09-db-schema.md` §E và bẫy ở `14-known-traps.md` | `server/db.js:895-898` |

Biến KHÔNG dùng nữa nhưng còn nhắc trong `DEPLOY.md` (thuộc Railway, không áp dụng Cloud Run trực tiếp): không có — các biến SMTP/GEMINI_API_KEY dùng chung cho cả 2 hạ tầng.

## D. `DEPLOY.md` — đọc với cảnh báo

`DEPLOY.md` (gốc repo) mô tả triển khai Railway với **SQLite file + volume `/data`** — mô hình lưu trữ này **không còn đúng với production hiện tại** (Cloud Run + Cloud SQL MySQL, xem §B). Các phần vẫn còn giá trị tham khảo trong `DEPLOY.md`:
- Hướng dẫn tạo SMTP key Brevo (mục "Email Brevo") — vẫn áp dụng được, không phụ thuộc hạ tầng.
- Cảnh báo "bí mật không nằm trong repo, `data/` đã gitignore" — vẫn đúng nguyên tắc, chỉ khác cơ chế inject secret (Cloud Run dùng biến môi trường/Secret Manager thay Railway Variables).

Phần KHÔNG còn áp dụng: mục "Tạo Volume — bắt buộc" (Railway-specific), "Reset dữ liệu demo: `npm run seed`" (đúng cú pháp nhưng cảnh báo sai ngữ cảnh — trên Cloud SQL production, lệnh này cần chạy với `DB_CLIENT=mysql` trỏ đúng instance, không phải SQLite).

## E. Kiểm tra sau khi build/deploy

```bash
npm run test:security   # test bảo mật Excel upload + validate email (server/security.test.js)
npm audit                # audit dependency
```
Không có test suite phủ route API (D8 — dựng test net 100% route là việc CHƯA làm, thuộc roadmap Wave 1, xem `04-ROADMAP.md`).
