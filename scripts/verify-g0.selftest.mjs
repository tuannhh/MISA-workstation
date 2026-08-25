#!/usr/bin/env node
// Negative test cho verify-g0.mjs (Codex G1A1-audit A5): chứng minh parser route auth THẬT SỰ
// fail khi route bị đổi/xoá, thay vì luôn báo PASS như bản hard-code cũ.
'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDirectAppRoutes } from './verify-g0.mjs';

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
