'use strict';

// Dùng trong test scheduler/monitor (G1A.8): scheduler.js/monitor.js gọi Date.now()/new Date()
// tại call-time (không cache ở module-scope), nên mock.timers của node:test giả lập đúng mà
// không cần sửa code nguồn. Luôn dùng context.mock.timers (không dùng bản module-level) để
// tự reset sau mỗi test, tránh rò rỉ Date giả sang test khác trong cùng file/process.
function useFixedClock(t, isoString) {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(isoString) });
}

module.exports = { useFixedClock };
