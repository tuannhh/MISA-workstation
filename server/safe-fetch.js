'use strict';

// Một seam outbound duy nhất cho mọi URL do người dùng/nguồn ngoài ảnh hưởng.  Không dựa vào
// việc kiểm tra chuỗi hostname: DNS có thể phân giải tên công khai về IP private, và redirect
// có thể đổi đích sau request đầu.  Caller phải dùng safeFetch()/validateOutboundUrl(), không
// gọi global fetch trực tiếp cho luồng dữ liệu ngoài.
const dns = require('node:dns').promises;
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
let testDependencies = null;

class SafeFetchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SafeFetchError';
    this.code = 'SSRF_BLOCKED';
  }
}

function normalizeHttpUrl(input) {
  const value = String(input || '').trim();
  if (!value) throw new SafeFetchError('URL không hợp lệ.');
  // Giữ nguyên mọi scheme đã được người dùng cung cấp để validateOutboundUrl() từ chối rõ ràng
  // scheme ngoài HTTP(S), thay vì biến `ftp://...` thành hostname lạ `https://ftp//...`.
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
}

function allowedHosts() {
  return String(process.env.OUTBOUND_ALLOWED_HOSTS || '')
    .split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);
}

function hostMatchesAllowlist(host, entries) {
  return entries.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

function isBlockedIpv4(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    a >= 224;
}

function isBlockedIp(address) {
  const raw = String(address || '').toLowerCase();
  if (net.isIP(raw) === 4) return isBlockedIpv4(raw);
  if (net.isIP(raw) !== 6) return true;
  // WHATWG URL canonicalizes ::ffff:127.0.0.1 into ::ffff:7f00:1. Decode both
  // forms so IPv4-mapped loopback/private addresses cannot bypass the IPv4 rules.
  if (raw.startsWith('::ffff:')) {
    const suffix = raw.slice(7);
    if (net.isIP(suffix) === 4) return isBlockedIp(suffix);
    const parts = suffix.split(':');
    if (parts.length === 2 && parts.every((part) => /^[0-9a-f]{1,4}$/.test(part))) {
      const high = parseInt(parts[0], 16); const low = parseInt(parts[1], 16);
      return isBlockedIp(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    return true;
  }
  return raw === '::' || raw === '::1' || raw.startsWith('fc') || raw.startsWith('fd') ||
    /^fe[89ab]/.test(raw) || raw.startsWith('ff') || raw.startsWith('2001:db8:');
}

function isBlockedHostname(host) {
  const value = String(host || '').toLowerCase().replace(/\.$/, '');
  return !value || value === 'localhost' || value.endsWith('.localhost') ||
    value.endsWith('.local') || value === 'metadata.google.internal';
}

function effectiveDependencies(dependencies = {}) {
  return {
    lookup: dns.lookup,
    // node:test needs to replace global.fetch for deterministic Gemini/outbound fixtures. Runtime
    // instead uses the pinned transport below so the DNS answer just verified is the IP actually
    // connected to (a second hostname DNS lookup by global fetch would re-open DNS-rebinding).
    fetchImpl: process.env.NODE_TEST_CONTEXT ? globalThis.fetch : pinnedHttpFetch,
    ...(testDependencies || {}),
    ...dependencies,
  };
}

async function resolveOutboundTarget(input, dependencies = {}) {
  let url;
  try { url = new URL(normalizeHttpUrl(input)); }
  catch { throw new SafeFetchError('URL không hợp lệ.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new SafeFetchError('URL không được phép truy cập.');
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (isBlockedHostname(host)) throw new SafeFetchError('URL không được phép truy cập.');

  const allowlist = allowedHosts();
  if (allowlist.length && !hostMatchesAllowlist(host, allowlist)) {
    throw new SafeFetchError('URL không nằm trong danh sách nguồn được phép.');
  }

  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new SafeFetchError('URL không được phép truy cập.');
    return { url, address: host, family: net.isIP(host) };
  }

  const { lookup } = effectiveDependencies(dependencies);
  let addresses;
  try { addresses = await lookup(host, { all: true, verbatim: true }); }
  catch { throw new SafeFetchError('Không thể xác minh địa chỉ URL.'); }
  const list = Array.isArray(addresses) ? addresses : [addresses];
  if (!list.length || list.some((entry) => !entry || isBlockedIp(entry.address))) {
    throw new SafeFetchError('URL không được phép truy cập.');
  }
  return { url, address: list[0].address, family: list[0].family || net.isIP(list[0].address) };
}

async function validateOutboundUrl(input, dependencies = {}) {
  return (await resolveOutboundTarget(input, dependencies)).url;
}

// Connect by the validated address while retaining the hostname in URL/Host/SNI. This closes the
// time-of-check/time-of-use gap of `dns.lookup()` followed by `fetch(hostname)`. It deliberately
// returns the small Response surface that this application uses (ok/status/headers/text).
function pinnedHttpFetch(urlText, options = {}) {
  const url = new URL(urlText);
  const { __safeFetchAddress: address, __safeFetchFamily: family, signal, maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES, ...requestOptions } = options;
  if (!address) return Promise.reject(new Error('Thiếu địa chỉ outbound đã xác minh.'));
  const transport = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      callback(value);
    };
    const request = transport.request(url, {
      method: requestOptions.method || 'GET',
      headers: requestOptions.headers,
      lookup: (_hostname, _options, callback) => callback(null, address, family),
    }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxResponseBytes) request.destroy(new Error('Nội dung URL vượt quá giới hạn cho phép.'));
        else chunks.push(chunk);
      });
      res.on('error', (error) => finish(reject, error));
      res.on('end', () => finish(resolve, {
        ok: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode || 0,
        url: url.toString(),
        headers: { get: (name) => {
          const value = res.headers[String(name).toLowerCase()];
          return Array.isArray(value) ? value.join(', ') : (value || null);
        } },
        text: async () => Buffer.concat(chunks).toString('utf8'),
      }));
    });
    const onAbort = () => request.destroy(signal.reason instanceof Error ? signal.reason : new Error('Request aborted'));
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }
    request.on('error', (error) => finish(reject, error));
    if (requestOptions.body) request.write(requestOptions.body);
    request.end();
  });
}

function isRedirect(response) {
  return response && response.status >= 300 && response.status < 400;
}

async function safeFetch(input, options = {}, dependencies = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxRedirects = DEFAULT_MAX_REDIRECTS, signal: externalSignal, ...fetchOptions } = options;
  const { fetchImpl } = effectiveDependencies(dependencies);
  if (typeof fetchImpl !== 'function') throw new Error('fetch không khả dụng.');

  const controller = new AbortController();
  const forwardAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) forwardAbort();
    else externalSignal.addEventListener('abort', forwardAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  let current = normalizeHttpUrl(input);
  try {
    for (let redirects = 0; redirects <= maxRedirects; redirects++) {
      const target = await resolveOutboundTarget(current, dependencies);
      const { url } = target;
      const response = await fetchImpl(url.toString(), {
        ...fetchOptions, signal: controller.signal, redirect: 'manual',
        __safeFetchAddress: target.address, __safeFetchFamily: target.family,
      });
      if (!isRedirect(response)) return response;
      const location = response.headers && typeof response.headers.get === 'function' ? response.headers.get('location') : null;
      if (!location) throw new SafeFetchError('Chuyển hướng URL không hợp lệ.');
      if (redirects === maxRedirects) throw new SafeFetchError('URL chuyển hướng quá nhiều lần.');
      current = new URL(location, url).toString();
    }
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', forwardAbort);
  }
  throw new SafeFetchError('URL chuyển hướng quá nhiều lần.');
}

// Chỉ dùng trong node:test để test DNS/redirect mà không cần mạng thật.  Không có route hay
// config runtime nào gọi API này; production luôn dùng dns.lookup + global fetch thật.
function __setTestDependencies(dependencies) {
  if (!process.env.NODE_TEST_CONTEXT) throw new Error('Chỉ được cấu hình safeFetch trong node:test.');
  testDependencies = { ...dependencies };
}
function __resetTestDependencies() { testDependencies = null; }

module.exports = {
  SafeFetchError, normalizeHttpUrl, isBlockedIp, isBlockedHostname, validateOutboundUrl,
  safeFetch, pinnedHttpFetch, __setTestDependencies, __resetTestDependencies,
};
