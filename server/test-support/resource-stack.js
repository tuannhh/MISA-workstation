'use strict';

// Stack tài nguyên test theo thứ tự acquire (Codex re-audit round 2, R2-01): teardown chỉ được
// gọi cleanup cho đúng những tài nguyên ĐÃ acquire thành công, theo thứ tự ngược lại (LIFO) —
// tuyệt đối không được tự require()/tạo mới bất kỳ resource nào trong lúc dọn dẹp. Nếu before()
// throw giữa chừng (vd tạo database test lỗi trước khi kịp require('../db')), stack vẫn giữ đúng
// những cleanup đã push trước đó; các bước chưa từng acquire thì không có gì để dọn — không có
// nhánh nào "tiện thể" require lại module sản phẩm với env mặc định.
function createResourceStack() {
  const cleanups = [];

  function acquire(cleanup) {
    cleanups.push(cleanup);
  }

  async function cleanupAll() {
    const errors = [];
    while (cleanups.length) {
      const cleanup = cleanups.pop();
      try {
        await cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'teardown gặp lỗi (đã thử hết các bước dọn dẹp)');
  }

  return { acquire, cleanupAll, get size() { return cleanups.length; } };
}

module.exports = { createResourceStack };
