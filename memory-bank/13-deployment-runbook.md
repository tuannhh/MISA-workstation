# 13 — Triển khai & hạ tầng

> Nguồn: `DEPLOY.md` (Railway — LỖI THỜI, xem §D), `Dockerfile`, `docker-compose.yml`, `railway.json`, `.env.example`, `package.json`, `server/config.js`, `server/db.js`, `server/mailer.js`, `server/mysql-worker.js`, `memory-bank/README.md`. Tham chiếu, không lặp lại: production URL + trạng thái audit ở [`README.md`](README.md) mục lục.

## A. Chạy dev local

2 cách, tuỳ có muốn dùng MySQL thật hay SQLite tương thích nhanh:

### A.1 MySQL (khuyến nghị, đúng engine dùng trên môi trường test/staging)
```bash
cp .env.example .env
docker compose up --build
# Mở http://localhost:3007
```
`docker-compose.yml` dựng 2 service: `db` (MySQL 8.4 — **chỉ xác nhận cho local Docker**, `utf8mb4_unicode_ci`, volume `mysql_data`) + `app` (build từ `Dockerfile`, đọc biến `MYSQL_HOST=db`). Compose đặt tường minh `NODE_ENV=development` + `LOCAL_DEMO=1`; lần khởi động đầu tự tạo bảng + seed idempotent bốn tài khoản demo D13 (`server/db.js` — `init()`+`seed()` chạy ngay khi `require('./db')`, không cần lệnh riêng). `NODE_ENV=production` luôn chặn demo seed, kể cả nếu có cờ local bị cấu hình nhầm; production MISA phải provision principal thật qua DevOps/SSO. **Sửa lại (Codex round-3 re-audit, R3-02E):** phiên bản engine thật của Cloud SQL (môi trường test hiện tại, xem §B) là **UNVERIFIED** — không có artifact nào trong repo xác nhận Cloud SQL cũng chạy 8.4; không suy ra bằng version local Docker.

### A.2 SQLite (nhanh, chỉ tương thích — không phải đường chính)
```bash
npm install
DB_CLIENT=sqlite npm start
# hoặc: npm run start:local   (tự set DB_CLIENT=sqlite)
```
DB lưu ở `data/pr.db`. Reset dữ liệu mẫu: `DB_CLIENT=sqlite npm run seed` (chạy `node server/db.js --reseed`, gọi cùng hàm `dropAll()` — xoá **28/34 bảng** rồi seed lại, KHÔNG sạch hoàn toàn, xem `09-db-schema.md` §E — **script `seed` trong `package.json` KHÔNG tự set `DB_CLIENT=sqlite`**, phải tự thêm biến môi trường khi gọi trên máy đang cấu hình MySQL, nếu không sẽ reseed nhầm MySQL đang trỏ tới — xem [`14-known-traps.md`](14-known-traps.md)).

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
`Dockerfile` (`node:24-alpine`): `npm ci` → copy source → `npm run build:ui` (build Vue vào `public/`) → `EXPOSE 3007` → `CMD ["node", "server/index.js"]`. App đọc `process.env.PORT` (Cloud Run tự cấp `PORT=8080` khi deploy, override giá trị default `3007` trong `server/index.js:7` — sửa lại 2026-08-25, trước ở `:15` khi chưa tách `server/app.js`).

### B.2 Kết nối Cloud SQL
`server/mysql-worker.js:19-24`: nếu có `MYSQL_SOCKET_PATH` → dùng unix socket `/cloudsql/<INSTANCE_CONNECTION_NAME>` (chuẩn Cloud Run + Cloud SQL, không cần Cloud SQL Proxy sidecar riêng — Cloud Run tự mount socket khi khai báo Cloud SQL connection trong config service); nếu không → dùng `MYSQL_HOST`+`MYSQL_PORT` (cho Docker/local). **Ưu tiên `socketPath` nếu có** — 2 cách cấu hình loại trừ nhau qua 1 biến môi trường duy nhất (`MYSQL_SOCKET_PATH`).

### B.3 Volume/dữ liệu file upload
Khác kiến trúc Railway cũ (1 volume bền `/data` cho cả SQLite file + uploads), trên Cloud Run **container là stateless** — `data/uploads/` (ảnh chân dung, giấy tờ, file đính kèm) được ghi qua `UPLOAD_DIR` (`server/db.js:9-12`, mặc định `<repo>/data/uploads`, override bằng `DATA_DIR`). **UNVERIFIED**: chưa xác nhận được trong phạm vi code đã đọc liệu Cloud Run instance hiện tại có mount 1 volume bền (Cloud Storage FUSE, hoặc GCE persistent disk) cho `DATA_DIR`, hay file upload bị mất mỗi lần container bị Cloud Run tái chế/redeploy (rủi ro nghiêm trọng nếu chưa có — cần owner xác nhận hạ tầng thật, không suy đoán).

### B.4 Migration dữ liệu từ Railway → Cloud Run
`memory-bank/README.md` ghi nhận "đã có dữ liệu thật migrate từ Railway" nhưng **không có script/quy trình migration nào trong repo** (không tìm thấy file dump/import SQL, không có tool chuyển đổi SQLite→MySQL trong `server/`) — quy trình migration thực tế đã xảy ra là **UNVERIFIED trong phạm vi source code**, có thể đã làm thủ công ngoài repo (mysqldump, script 1 lần không commit, hoặc thao tác tay qua Cloud SQL console). Không suy đoán thêm chi tiết.

## C. Biến môi trường đầy đủ

| Biến | Bắt buộc? | Mặc định nếu bỏ trống | Ý nghĩa | Nguồn |
|---|---|---|---|---|
| `NODE_ENV` | **BẮT BUỘC = `production` trên môi trường phục vụ user thật** | không set (dev/test) | **W1.7 (2026-08-30):** gate 3 hành vi hardening cùng lúc trong `createApp()` — (1) fail-fast nếu thiếu `SESSION_SECRET`, (2) `app.set('trust proxy', 1)` để nhận đúng `X-Forwarded-Proto`, (3) cookie session `secure:true`. Quên set biến này = cookie KHÔNG có `Secure`, tương đương chưa vá F2 dù code đã đúng | `server/app.js:12-20` |
| `PORT` | không | `3007` | Cổng HTTP; Cloud Run tự set `8080` | `server/index.js:7` |
| `DB_CLIENT` | không | **`mysql`** | `mysql`\|`sqlite` — chọn engine DB. **Lưu ý: default là mysql, KHÔNG PHẢI sqlite** | `server/db.js:15` |
| `DATA_DIR` | không | `<repo>/data` | Thư mục chứa `pr.db` (nếu SQLite) + `uploads/` (mọi engine) | `server/db.js:9` |
| `SESSION_SECRET` | **BẮT BUỘC trên production** | `'misa-pr-dev-secret-change-me'` (chỉ dev/test) | Khoá ký session cookie — **W1.7 (2026-08-30): `createApp()` fail-fast (throw) nếu `NODE_ENV=production` và thiếu biến này**, không còn âm thầm dùng default không an toàn (F2) | `server/app.js:12-16` |
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
| `GEMINI_TIMEOUT_MS` | không | `30000` | **W1.9:** timeout mỗi lời gọi Gemini qua `AbortController`, cùng quy ước `MYSQL_QUERY_TIMEOUT_MS` | `server/config.js` |
| `GEMINI_RETRY_BASE_DELAY_MS` | không | `250` | **W1.9:** backoff giữa các lần retry 429/5xx (`delay = giá_trị * lần_thử`), tối đa 3 lần thử | `server/config.js` |
| `SMTP_HOST` | chỉ nếu muốn bật email nhắc | — | Có `SMTP_HOST`+`SMTP_USER` mới bật `mailer` | `server/mailer.js:10-11` |
| `SMTP_PORT` | không | `587` | | `mailer.js:11` |
| `SMTP_USER` / `SMTP_PASS` | cùng `SMTP_HOST` | — | Đăng nhập SMTP (khuyến nghị Brevo, xem `DEPLOY.md`) | `mailer.js:11` |
| `SMTP_FROM` | không | = `SMTP_USER` | Email hiển thị người gửi | `mailer.js:11` |
| `SMTP_SECURE` | không | `false` | `'true'` mới bật TLS ngay (STARTTLS mặc định qua port 587) | `mailer.js:11` |
| `MONITOR_AUTOSCAN` | không | tắt | `'1'` bật auto-scan giám sát truyền thông ngay từ env (độc lập với cấu hình `app_meta` qua UI) | `server/monitor.js:429` |
| `MONITOR_INTERVAL_H` | không | `4` | Chu kỳ auto-scan (giờ) khi bật qua env, chỉ dùng làm giá trị khởi tạo nếu `app_meta` chưa có | `monitor.js:431` |
| `RESET_DB` | **KHÔNG đặt trên bất kỳ môi trường có dữ liệu cần giữ** | tắt | `'1'` khi khởi động → chạy `dropAll()`: xoá **28/34 bảng** (6 bảng KHÔNG bị xoá — `agreements`/`work_logs`/`gifts`/`benefit_usages`/`supplier_transactions`/`supplier_contacts`) rồi seed lại. **Không phải "xoá sạch" đúng nghĩa** — không dùng làm cơ chế reset cho W1 redesign, xem `09-db-schema.md` §E và bẫy ở `14-known-traps.md` | `server/db.js:895-898` |

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

## F. Cấu hình Gemini API key + SMTP khi DevOps MISA tự deploy (hạ tầng riêng, ngoài Cloud Run)

> Owner xác nhận (2026-09-03): deploy lên máy chủ MISA do **DevOps MISA tự thực hiện**, không phải Cloud Run. Mục này để bàn giao DevOps đúng cơ chế đã có sẵn trong code — **không có trang quản trị (admin UI) nào để nhập Gemini key/SMTP**, đây là chủ đích (secret không đi qua DB/UI), không phải thiếu tính năng.

App đọc 2 cấu hình này theo đúng 1 cơ chế, ưu tiên biến môi trường trước, có fallback file nếu môi trường không tiện set biến môi trường (vd chạy tay trên VM, không qua orchestrator):

| Cấu hình | Biến môi trường (ưu tiên) | File fallback trong `DATA_DIR` | Nguồn |
|---|---|---|---|
| Gemini API key | `GEMINI_API_KEY` | `data/gemini.key` — file text thuần, chỉ chứa đúng key, không xuống dòng thừa | `server/config.js:5-15` |
| SMTP (mail nhắc/cảnh báo) | `SMTP_HOST`+`SMTP_PORT`+`SMTP_USER`+`SMTP_PASS`+`SMTP_FROM`+`SMTP_SECURE` (xem §C) | `data/smtp.json` — JSON `{"host":"...","port":587,"secure":false,"user":"...","pass":"...","from":"..."}` | `server/mailer.js:8-19` |

Cách chọn cho DevOps:
- **Có biến môi trường/secret manager của MISA (khuyến nghị):** set thẳng các biến ở bảng §C, không cần tạo file gì. Container/service khởi động lại vẫn giữ nguyên, không phụ thuộc volume ghi được.
- **Không tiện set biến môi trường (vd chạy tay, hoặc muốn tách secret khỏi biến môi trường của service):** tạo 2 file `gemini.key` và `smtp.json` đúng định dạng trên, đặt trong thư mục trỏ bởi `DATA_DIR` (mặc định `<repo>/data`, đổi được qua biến `DATA_DIR`). Thư mục này đã có sẵn trong `.gitignore` — không commit nhầm secret vào git.
- **Không đặt gì cả:** Gemini tắt (mọi route AI trả lỗi `Chưa cấu hình GEMINI_API_KEY`, không crash app), mail tắt (`mailer.enabled() === false`, các nút gửi nhắc/cảnh báo âm thầm không gửi được — xem log `SMTP chưa cấu hình (email tắt)`). App vẫn chạy bình thường cho mọi tính năng khác.

Gmail SMTP (nếu DevOps chọn Gmail thay vì Brevo): cần **Mật khẩu ứng dụng (App Password)** 16 ký tự từ tài khoản Gmail có bật xác minh 2 bước (myaccount.google.com/apppasswords) — Gmail chặn SMTP bằng mật khẩu thường. `host=smtp.gmail.com`, `port=587`, `secure=false`.
