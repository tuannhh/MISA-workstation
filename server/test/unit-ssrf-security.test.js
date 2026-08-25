'use strict';

// G1A.2 — Commit 2/4: SSRF/security utilities (monitor.js, ai.js).
// Đặc tả hành vi HIỆN TẠI bằng fetch giả (dependency injection qua t.mock.method(globalThis,
// 'fetch', ...)) — KHÔNG có network thật. Kết luận đã xác nhận trong inventory: repo CHƯA có
// bất kỳ SSRF guard nào (không allowlist/denylist host, không chặn localhost/RFC1918/link-local/
// metadata-IP). Các test BR-SSRF-010/011 CHỦ Ý đặc tả đúng lỗ hổng đang tồn tại (fetch được gọi
// thẳng tới host nội bộ do caller truyền, không bị chặn) — đây KHÔNG phải test mục tiêu (target)
// và KHÔNG được coi là bug cần sửa trong G1A.2. Guard/allowlist thật đã có kế hoạch riêng ở
// G1B.4 (memory-bank/04-ROADMAP.md: "SSRF matrix (F3): localhost/RFC1918/link-local/metadata/
// redirect"). Sửa ở đây là lấn sang G1B, vi phạm nguyên tắc "characterization only".
//
// require('../monitor') kéo theo require('./db') + module-scope db.prepare('INSERT ... INTO
// mentions ...') ngay khi require -> cùng lý do với Commit 1, phải cách ly DATA_DIR tạm +
// DB_CLIENT=sqlite TRƯỚC khi require để không đụng data/pr.db thật / không cần MySQL.
process.env.DB_CLIENT = 'sqlite';
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-unit-ssrf-'));

const test = require('node:test');
const assert = require('node:assert/strict');
const { useFixedClock } = require('../test-support/clock');

const monitor = require('../monitor');
const aiRouter = require('../ai');
const { stripHtml, limitEventExtract } = aiRouter.testables;

test.after(() => { fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); });

function fakeResponse({ ok = true, status = 200, text = '', url } = {}) {
  return { ok, status, url, text: async () => text };
}

// ===================== monitor.js — tiện ích thuần =====================

test('BR-SSRF-001: stripTags() loại bỏ tag HTML + entity đơn giản, gộp khoảng trắng', () => {
  assert.equal(monitor.stripTags('<b>Xin&nbsp;chào</b>  <i>MISA</i>'), 'Xin chào MISA');
  assert.equal(monitor.stripTags(null), '');
});

test('BR-SSRF-002: decodeEntities() giải mã CDATA + entity HTML cơ bản', () => {
  assert.equal(monitor.decodeEntities('<![CDATA[A &amp; B]]>'), 'A & B');
  assert.equal(monitor.decodeEntities('&lt;tag&gt; &quot;q&quot; &#39;s&#39;'), '<tag> "q" \'s\'');
});

test('BR-SSRF-003: fetchText() trả text khi HTTP OK, gửi đúng User-Agent/Accept', async (t) => {
  let seenOpts;
  t.mock.method(globalThis, 'fetch', async (url, opts) => { seenOpts = opts; return fakeResponse({ ok: true, text: 'nội dung rss' }); });
  const out = await monitor.fetchText('https://example.com/feed.xml');
  assert.equal(out, 'nội dung rss');
  assert.match(seenOpts.headers['User-Agent'], /MISA-PR-Monitor/);
  assert.match(seenOpts.headers.Accept, /rss|xml/);
});

test('BR-SSRF-004: fetchText() throw khi HTTP status không OK', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => fakeResponse({ ok: false, status: 404 }));
  await assert.rejects(() => monitor.fetchText('https://example.com/missing'), /HTTP 404/);
});

test('BR-SSRF-005: fetchText() abort request sau timeoutMs', async (t) => {
  t.mock.method(globalThis, 'fetch', (url, opts) => new Promise((resolve, reject) => {
    opts.signal.addEventListener('abort', () => reject(new Error('The operation was aborted')));
  }));
  await assert.rejects(() => monitor.fetchText('https://slow.example', 20), /aborted/);
});

test('BR-SSRF-006: resolveLink() trích <title>, dùng res.url thật theo redirect', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => fakeResponse({
    url: 'https://final.example/bai-viet',
    text: '<html><title>  Tin  tức   MISA  </title></html>',
  }));
  const out = await monitor.resolveLink('https://short.ly/abc');
  assert.deepEqual(out, { url: 'https://final.example/bai-viet', title: 'Tin tức MISA' });
});

test('BR-SSRF-007: resolveLink() fallback {url, title:""} khi fetch lỗi, không throw', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('network down'); });
  const out = await monitor.resolveLink('https://khong-vao-duoc.example');
  assert.deepEqual(out, { url: 'https://khong-vao-duoc.example', title: '' });
});

test('BR-SSRF-008: classifyHost() nhận diện đúng nền tảng theo host, còn lại "web", bỏ tiền tố www.', () => {
  assert.deepEqual(monitor.classifyHost('www.facebook.com'), ['facebook', 'facebook.com']);
  assert.deepEqual(monitor.classifyHost('youtu.be'), ['youtube', 'youtu.be']);
  assert.deepEqual(monitor.classifyHost('tiktok.com'), ['tiktok', 'tiktok.com']);
  assert.deepEqual(monitor.classifyHost('linkedin.com'), ['linkedin', 'linkedin.com']);
  assert.deepEqual(monitor.classifyHost('instagram.com'), ['instagram', 'instagram.com']);
  assert.deepEqual(monitor.classifyHost('baochinews.vn'), ['web', 'baochinews.vn']);
});

test('BR-SSRF-009: hostOf() tự thêm https:// khi thiếu scheme, bỏ www., fallback khi không parse được', () => {
  assert.equal(monitor.hostOf('example.com/path'), 'example.com');
  assert.equal(monitor.hostOf('https://WWW.Example.COM/x'), 'example.com');
  assert.equal(monitor.hostOf('::://khong-hop-le'), '::://khong-hop-le'); // không parse được -> trả nguyên (đã strip www. nếu có)
});

test('BR-SSRF-010 (đặc tả lỗ hổng hiện có, KHÔNG fix ở đây — target guard xem G1B.4): resolveLink() gọi fetch thẳng tới host nội bộ/metadata do caller truyền, không có allowlist/denylist nào chặn', async (t) => {
  const calledUrls = [];
  t.mock.method(globalThis, 'fetch', async (url) => { calledUrls.push(url); return fakeResponse({ url, text: '' }); });
  const internalTargets = [
    'http://127.0.0.1:6379/',
    'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
    'http://192.168.1.1/admin',
  ];
  for (const target of internalTargets) await monitor.resolveLink(target);
  assert.deepEqual(calledUrls, internalTargets); // fetch nhận nguyên URL nội bộ, không bị chặn/rewrite
});

test('BR-SSRF-011 (đặc tả lỗ hổng hiện có, KHÔNG fix ở đây — target guard xem G1B.4): detectFeed() gọi fetchText tới host nội bộ do người dùng nhập ở POST /monitor/sources, không có guard', async (t) => {
  const calledUrls = [];
  t.mock.method(globalThis, 'fetch', async (url) => { calledUrls.push(url); return fakeResponse({ ok: false, status: 403 }); });
  const result = await monitor.detectFeed('169.254.169.254/latest/meta-data/');
  assert.equal(result, null); // không có feed hợp lệ -> null, nhưng...
  assert.ok(calledUrls.includes('https://169.254.169.254/latest/meta-data/')); // ...fetch vẫn đã được gọi thẳng tới IP metadata này trước đó
});

// ===================== ai.js — stripHtml / limitEventExtract =====================

test('BR-SSRF-012: stripHtml() loại script/style trước tag khác, gộp khoảng trắng, cắt tối đa 20000 ký tự', () => {
  const html = '<script>alert(1)</script><style>.a{color:red}</style><p>Xin&nbsp;chào <b>MISA</b></p>';
  assert.equal(stripHtml(html), 'Xin chào MISA');
  const long = '<p>' + 'a'.repeat(25000) + '</p>';
  assert.equal(stripHtml(long).length, 20000);
});

function fakeRes() {
  const state = {};
  const res = {
    status(code) { state.code = code; return res; },
    json(body) { state.body = body; return res; },
  };
  return { res, state };
}

test('BR-SSRF-013: limitEventExtract() cho phép tối đa 8 lần/60s theo user, lần thứ 9 trả 429', () => {
  const req = { session: { user: { id: 'user-limit-1' } } };
  let nextCalls = 0;
  for (let i = 0; i < 8; i++) {
    const { res } = fakeRes();
    limitEventExtract(req, res, () => { nextCalls++; });
  }
  assert.equal(nextCalls, 8);
  const { res, state } = fakeRes();
  limitEventExtract(req, res, () => { nextCalls++; });
  assert.equal(nextCalls, 8); // next() KHÔNG được gọi ở lần thứ 9
  assert.equal(state.code, 429);
  assert.match(state.body.error, /chờ khoảng 1 phút/);
});

test('BR-SSRF-014: limitEventExtract() cửa sổ trượt 60s — request cũ hơn 60s bị loại khỏi bộ đếm', (t) => {
  useFixedClock(t, '2026-08-25T00:00:00.000Z');
  const req = { session: { user: { id: 'user-limit-2' } } };
  let nextCalls = 0;
  for (let i = 0; i < 8; i++) limitEventExtract(req, { status() { return this; }, json() { return this; } }, () => { nextCalls++; });
  assert.equal(nextCalls, 8);
  t.mock.timers.tick(61_000); // vượt cửa sổ 60s -> 8 lần cũ hết hạn
  const { res, state } = fakeRes();
  limitEventExtract(req, res, () => { nextCalls++; });
  assert.equal(nextCalls, 9); // được tính lại từ đầu, không bị 429
  assert.equal(state.code, undefined);
});

test('BR-SSRF-015: limitEventExtract() đếm riêng theo từng user, không lẫn giới hạn giữa 2 user', () => {
  const reqA = { session: { user: { id: 'user-a' } } };
  const reqB = { session: { user: { id: 'user-b' } } };
  const noop = { status() { return this; }, json() { return this; } };
  for (let i = 0; i < 8; i++) limitEventExtract(reqA, noop, () => {});
  let calledB = false;
  limitEventExtract(reqB, noop, () => { calledB = true; });
  assert.equal(calledB, true); // user B chưa dùng lần nào -> không bị chặn bởi bộ đếm của user A
});
