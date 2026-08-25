'use strict';

function startTestApp(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((res, rej) => {
          // Không nuốt lỗi close (N2, Codex G1A1-audit): nếu socket còn mở/close lỗi, phải
          // reject để teardown báo lỗi thay vì giả vờ "đã dọn sạch".
          const timer = setTimeout(() => {
            rej(new Error('app-harness: đóng HTTP server quá 5s — có thể còn socket/connection mở.'));
          }, 5000);
          server.close((err) => {
            clearTimeout(timer);
            if (err) rej(err); else res();
          });
        }),
      });
    });
    server.on('error', reject);
  });
}

module.exports = { startTestApp };
