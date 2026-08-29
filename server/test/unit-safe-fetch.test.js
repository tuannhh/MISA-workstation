'use strict';

// G1B.4 / F3 — unit contract for the single outbound HTTP seam.  Every test injects DNS and
// fetch, so it never opens a socket.  This is deliberately lower-level than route tests: it
// proves that a future caller cannot accidentally reintroduce private-IP or redirect SSRF.
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const http = require('node:http');
const outbound = require('../safe-fetch');

function publicLookup() { return Promise.resolve([{ address: '93.184.216.34', family: 4 }]); }
function response(status = 200, location = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key) => key.toLowerCase() === 'location' ? location : null },
    text: async () => '',
  };
}

test('BR-SSRF-021: normalizeHttpUrl chỉ thêm https khi thiếu scheme, URL rỗng bị chặn', () => {
  assert.equal(outbound.normalizeHttpUrl('misa.vn/tin'), 'https://misa.vn/tin');
  assert.equal(outbound.normalizeHttpUrl('HTTP://misa.vn'), 'HTTP://misa.vn');
  assert.throws(() => outbound.normalizeHttpUrl('  '), outbound.SafeFetchError);
});

test('BR-SSRF-022: validateOutboundUrl fail-closed với hostname local và IPv4 private/reserved', async () => {
  for (const url of [
    'http://localhost:3000/', 'http://api.local/', 'http://127.0.0.1/',
    'http://10.1.2.3/', 'http://172.16.1.1/', 'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/', 'http://100.64.0.1/',
  ]) {
    await assert.rejects(() => outbound.validateOutboundUrl(url, { lookup: publicLookup }), outbound.SafeFetchError);
  }
});

test('BR-SSRF-023: validateOutboundUrl fail-closed với IPv6 loopback/private/link-local và metadata hostname', async () => {
  for (const url of ['http://[::1]/', 'http://[fc00::1]/', 'http://[fe80::1]/', 'http://[::ffff:127.0.0.1]/', 'http://metadata.google.internal/']) {
    await assert.rejects(() => outbound.validateOutboundUrl(url, { lookup: publicLookup }), outbound.SafeFetchError);
  }
});

test('BR-SSRF-024: DNS public-looking nhưng phân giải private bị chặn; mọi địa chỉ phải an toàn', async () => {
  await assert.rejects(
    () => outbound.validateOutboundUrl('https://public-name.example/', { lookup: async () => [{ address: '93.184.216.34' }, { address: '10.0.0.5' }] }),
    outbound.SafeFetchError,
  );
});

test('BR-SSRF-025: URL public HTTP(S) không credential được xác thực và fetch khi DNS public', async () => {
  const seen = [];
  const result = await outbound.safeFetch('https://news.example/path', {}, {
    lookup: publicLookup,
    fetchImpl: async (url, options) => { seen.push({ url, options }); return response(); },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(seen.map((item) => item.url), ['https://news.example/path']);
  assert.equal(seen[0].options.redirect, 'manual');
  await assert.rejects(() => outbound.validateOutboundUrl('ftp://news.example/', { lookup: publicLookup }), outbound.SafeFetchError);
  await assert.rejects(() => outbound.validateOutboundUrl('https://u:p@news.example/', { lookup: publicLookup }), outbound.SafeFetchError);
});

test('BR-SSRF-026: redirect được xử lý manual và redirect tới private bị chặn trước request thứ hai', async () => {
  const seen = [];
  await assert.rejects(
    () => outbound.safeFetch('https://public.example/start', {}, {
      lookup: publicLookup,
      fetchImpl: async (url) => { seen.push(url); return response(302, 'http://169.254.169.254/latest/meta-data/'); },
    }),
    outbound.SafeFetchError,
  );
  assert.deepEqual(seen, ['https://public.example/start']);
});

test('BR-SSRF-027: redirect public hợp lệ được xác thực lại trước request tiếp theo', async () => {
  const seen = [];
  const result = await outbound.safeFetch('https://public.example/start', {}, {
    lookup: publicLookup,
    fetchImpl: async (url) => {
      seen.push(url);
      return seen.length === 1 ? response(302, 'https://final.example/article') : response();
    },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(seen, ['https://public.example/start', 'https://final.example/article']);
});

test('BR-SSRF-028: runtime transport kết nối bằng IP đã xác minh, vẫn giữ hostname URL/Host', async (t) => {
  const originalRequest = http.request;
  let captured;
  t.after(() => { http.request = originalRequest; });
  http.request = (url, options, callback) => {
    captured = { url, options };
    const req = new EventEmitter();
    req.destroy = (error) => process.nextTick(() => req.emit('error', error));
    req.write = () => true;
    req.end = () => process.nextTick(() => {
      const res = new EventEmitter();
      res.statusCode = 200;
      res.headers = {};
      callback(res);
      res.emit('data', Buffer.from('ok'));
      res.emit('end');
    });
    return req;
  };
  const result = await outbound.safeFetch('http://public.example/article', {}, {
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    fetchImpl: outbound.pinnedHttpFetch,
  });
  assert.equal(await result.text(), 'ok');
  assert.equal(captured.url.hostname, 'public.example');
  await new Promise((resolve, reject) => captured.options.lookup('public.example', {}, (error, address, family) => {
    try { assert.equal(error, null); assert.equal(address, '93.184.216.34'); assert.equal(family, 4); resolve(); } catch (e) { reject(e); }
  }));
});
