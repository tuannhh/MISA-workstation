'use strict';
// W2.1 — unit test thuần module cho server/error-contract.js (05-error-contract.md): requestId
// middleware gắn req.requestId + header X-Request-Id cho MỌI request; sendError() là điểm serialize
// DUY NHẤT cho response lỗi mới, luôn đặt error===message ký tự-cho-ký tự (không để call site tự
// gán error riêng, tránh lệch giá trị giữa 2 field — đúng lỗi Codex re-audit round 2 F3 đã sửa).
const test = require('node:test');
const assert = require('node:assert/strict');
const { requestIdMiddleware, sendError } = require('../error-contract');

function fakeRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  return res;
}

test('BR-ERR-001: requestIdMiddleware gắn req.requestId dạng "req_<hex>" + đặt header X-Request-Id cùng giá trị', () => {
  const req = {};
  const res = fakeRes();
  let calledNext = false;
  requestIdMiddleware(req, res, () => { calledNext = true; });
  assert.match(req.requestId, /^req_[0-9a-f]{24}$/);
  assert.equal(res.headers['X-Request-Id'], req.requestId);
  assert.equal(calledNext, true);
});

test('BR-ERR-002: requestIdMiddleware 2 request liên tiếp có requestId khác nhau', () => {
  const req1 = {}; const req2 = {};
  requestIdMiddleware(req1, fakeRes(), () => {});
  requestIdMiddleware(req2, fakeRes(), () => {});
  assert.notEqual(req1.requestId, req2.requestId);
});

test('BR-ERR-003: sendError() status/code/message đúng tham số, error===message ký tự-cho-ký tự, requestId lấy từ req', () => {
  const req = { requestId: 'req_test123' };
  const res = fakeRes();
  sendError(req, res, 403, 'FORBIDDEN_MODULE', 'Bạn không có quyền edit trên partners.');
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'FORBIDDEN_MODULE');
  assert.equal(res.body.message, 'Bạn không có quyền edit trên partners.');
  assert.equal(res.body.error, res.body.message);
  assert.equal(res.body.requestId, 'req_test123');
  assert.equal('details' in res.body, false, 'không được có field details khi không truyền');
});

test('BR-ERR-004: sendError() details optional chỉ xuất hiện khi truyền vào', () => {
  const req = { requestId: 'req_x' };
  const res = fakeRes();
  sendError(req, res, 403, 'FORBIDDEN_SENSITIVE_GROUP', 'Không đủ quyền', { group: 'iddoc' });
  assert.deepEqual(res.body.details, { group: 'iddoc' });
});

test('BR-ERR-005: sendError() requestId undefined khi req không có (không throw)', () => {
  const res = fakeRes();
  sendError({}, res, 500, 'INTERNAL_ERROR', 'Lỗi máy chủ');
  assert.equal(res.body.requestId, undefined);
  assert.equal(res.body.error, res.body.message);
});
