'use strict';
// Unit test cho state machine closeWorker() (Codex re-audit round 3, R3-02) — dùng fake worker
// (EventEmitter) để kiểm mọi nhánh thành công/lỗi mà không cần spawn worker thread thật hay MySQL
// thật. Chạy được ở cả DB_CLIENT=sqlite và mysql vì không đụng tới database nào.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { closeWorker, bindSqliteNamedParams } = require('../mysql-sync');

class FakeWorker extends EventEmitter {
  constructor({ onPostMessage } = {}) {
    super();
    this._onPostMessage = onPostMessage;
    this.terminateCalls = 0;
  }

  postMessage(msg) {
    if (this._onPostMessage) this._onPostMessage(msg, this);
  }

  terminate() {
    this.terminateCalls += 1;
    return Promise.resolve();
  }
}

test('closeWorker() resolve khi có shutdownAck không lỗi VÀ exit code 0', async () => {
  const worker = new FakeWorker({
    onPostMessage: (msg, w) => {
      w.emit('message', { shutdownAck: true, error: null });
      w.emit('exit', 0);
    },
  });
  await assert.doesNotReject(() => closeWorker(worker));
});

test('closeWorker() reject khi shutdownAck báo lỗi (connection.end() thất bại)', async () => {
  const worker = new FakeWorker({
    onPostMessage: (msg, w) => {
      w.emit('message', { shutdownAck: true, error: { message: 'ECONNRESET giả lập' } });
      w.emit('exit', 1);
    },
  });
  await assert.rejects(() => closeWorker(worker), /lỗi khi đóng connection lúc shutdown/);
});

test('closeWorker() reject khi exit code khác 0 mà KHÔNG có shutdownAck (false-success đã bị Codex phát hiện)', async () => {
  const worker = new FakeWorker({
    onPostMessage: (msg, w) => {
      // Không emit 'message' nào — mô phỏng ack bị mất hoặc worker crash trước khi kịp gửi.
      w.emit('exit', 1);
    },
  });
  await assert.rejects(() => closeWorker(worker), /thoát với exit code 1/);
});

test('closeWorker() reject khi exit code 0 nhưng chưa từng nhận shutdownAck (exit trước ack)', async () => {
  const worker = new FakeWorker({
    onPostMessage: (msg, w) => {
      w.emit('exit', 0);
    },
  });
  await assert.rejects(() => closeWorker(worker), /thoát trước khi gửi shutdownAck/);
});

test('closeWorker() reject khi worker phát sự kiện "error"', async () => {
  const worker = new FakeWorker({
    onPostMessage: (msg, w) => {
      w.emit('error', new Error('worker crash giả lập'));
    },
  });
  await assert.rejects(() => closeWorker(worker), /worker crash giả lập/);
});

test('closeWorker() reject với ĐÚNG lỗi gốc khi postMessage() throw đồng bộ (không còn TDZ ReferenceError)', async () => {
  const worker = new FakeWorker();
  worker.postMessage = () => { throw new Error('postMessage đồng bộ thất bại'); };
  await assert.rejects(() => closeWorker(worker), (error) => {
    assert.equal(error.message, 'postMessage đồng bộ thất bại');
    assert.notEqual(error.constructor.name, 'ReferenceError');
    return true;
  });
});

test('closeWorker() force-terminate và reject nếu worker không tự thoát trong timeoutMs', async () => {
  const worker = new FakeWorker(); // không bao giờ emit 'exit'/'message' -> phải rơi vào timeout
  await assert.rejects(() => closeWorker(worker, 30), /force-terminate/);
  assert.equal(worker.terminateCalls, 1);
});

test('closeWorker() reject với lỗi terminate() nếu chính terminate() cũng thất bại', async () => {
  const worker = new FakeWorker();
  worker.terminate = () => Promise.reject(new Error('terminate() thất bại giả lập'));
  await assert.rejects(() => closeWorker(worker, 30), /terminate\(\) thất bại giả lập/);
});

test('bindSqliteNamedParams() đổi @name thành positional params theo đúng thứ tự, kể cả lặp tên', () => {
  const bound = bindSqliteNamedParams(
    'INSERT INTO t (a,b,a2) VALUES (@a,@b,@a)',
    [{ a: 7, b: 'hai' }],
  );
  assert.equal(bound.sql, 'INSERT INTO t (a,b,a2) VALUES (?,?,?)');
  assert.deepEqual(bound.params, [7, 'hai', 7]);
});

test('bindSqliteNamedParams() không biến đổi @ trong literal/comment và không nuốt thiếu binding', () => {
  const bound = bindSqliteNamedParams(
    "SELECT '@email.example', `@column`, @@sql_mode -- @comment\n WHERE x=@value",
    [{ value: 3 }],
  );
  assert.match(bound.sql, /'@email\.example'/);
  assert.match(bound.sql, /`@column`/);
  assert.match(bound.sql, /@@sql_mode/);
  assert.match(bound.sql, /-- @comment/);
  assert.deepEqual(bound.params, [3]);
  assert.throws(() => bindSqliteNamedParams('SELECT @missing', [{}]), /Thiếu named parameter @missing/);
});
