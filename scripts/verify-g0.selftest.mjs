#!/usr/bin/env node
// Negative test cho verify-g0.mjs (Codex G1A1-audit A5): chứng minh parser route auth THẬT SỰ
// fail khi route bị đổi/xoá, thay vì luôn báo PASS như bản hard-code cũ.
'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDirectAppRoutes, resolveRouterPrefix } from './verify-g0.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const realAppSource = fs.readFileSync(path.join(root, 'server/app.js'), 'utf8');

test('positive: server/app.js thật có đúng 3 route auth, parse được', () => {
  const routes = parseDirectAppRoutes(realAppSource);
  assert.equal(routes.length, 3);
  assert.deepEqual(routes.map((r) => r.fullPath).sort(), ['/api/login', '/api/logout', '/api/me']);
});

test('negative: route /api/login bị xoá phải làm parser FAIL, không âm thầm PASS', () => {
  const mutated = realAppSource.replace(/app\.post\('\/api\/login', auth\.login\);\n/, '');
  assert.throws(() => parseDirectAppRoutes(mutated), /đúng 3 route auth/);
});

test('negative: handler đổi tên thành chưa biết phải làm parser FAIL', () => {
  const mutated = realAppSource.replace('auth.me)', 'auth.meRenamed)');
  assert.throws(() => parseDirectAppRoutes(mutated), /chưa khai báo authKind/);
});

// Codex re-audit round 2 (R2-03): trước đây sourceRoutes() hard-code ['server/routes.js', '/api']
// và ['server/ai.js', '/api/ai'] — nếu mount thật đổi (vd '/api' -> '/v2'), verifier vẫn dùng
// '/api' hard-code và có thể báo PASS sai. Các test dưới đây chứng minh resolveRouterPrefix() đọc
// đúng giá trị THẬT từ server/app.js, không còn hard-code.

test('positive: mount thật của server/app.js là /api -> routes.js, /api/ai -> ai.js', () => {
  assert.equal(resolveRouterPrefix('server/routes.js', realAppSource), '/api');
  assert.equal(resolveRouterPrefix('server/ai.js', realAppSource), '/api/ai');
});

test('negative: đổi mount /api thành /v2 phải phản ánh đúng /v2, không còn kẹt ở /api hard-code', () => {
  const mutated = realAppSource.replace("app.use('/api', apiRouter);", "app.use('/v2', apiRouter);");
  assert.equal(resolveRouterPrefix('server/routes.js', mutated), '/v2');
  assert.notEqual(resolveRouterPrefix('server/routes.js', mutated), '/api');
});

test('negative: xoá hẳn mount app.use cho routes.js phải làm parser FAIL, không dùng ngầm giá trị mặc định', () => {
  const mutated = realAppSource.replace("app.use('/api', apiRouter);\n", '');
  assert.throws(() => resolveRouterPrefix('server/routes.js', mutated), /parse mount thất bại/);
});
