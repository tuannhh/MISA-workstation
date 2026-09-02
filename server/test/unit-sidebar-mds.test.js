'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');
const style = fs.readFileSync(path.join(repoRoot, 'frontend/src/style.css'), 'utf8');

test('MDS-SIDEBAR-001: desktop sidebar dùng đúng token 200/64, không khai báo token kích thước song song', () => {
  assert.match(style, /width:\s*var\(--mds-layout-sidebar-w\)/);
  assert.match(style, /width:\s*var\(--mds-layout-sidebar-sm-w\)/);
  assert.doesNotMatch(style, /--layout-sidebar-(?:sm-)?w\s*:/);
  assert.doesNotMatch(style, /--layout-(?:header|page-header)-h\s*:/);
});

test('MDS-SIDEBAR-002: rail thu gọn nằm sát mép trái và hover mở overlay, không đẩy main', () => {
  assert.match(style, /\.app-body\.side-collapsed\s*\{[^}]*padding-left:\s*var\(--mds-layout-sidebar-sm-w\)/s);
  assert.match(style, /\.app-body\.side-collapsed\s*>\s*\.sidebar\s*\{[^}]*position:\s*absolute\s*!important;[^}]*inset:\s*0 auto 0 0\s*!important/s);
  assert.match(style, /\.app-body\.side-collapsed\s*>\s*\.sidebar:hover\s*\{[^}]*width:\s*var\(--mds-layout-sidebar-w\)/s);
});

test('MDS-SIDEBAR-003: item có gutter bo góc ở cả rail và overlay, không có vạch sát mép', () => {
  assert.match(style, /\.nav\s*\{[^}]*padding:\s*0\s*!important/s);
  assert.match(style, /\.nav a\s*\{[^}]*align-self:\s*stretch/s);
  assert.match(style, /\.side-toggle\s*\{[^}]*border-radius:\s*8px/s);
  assert.match(style, /\.app-body\.side-collapsed > \.sidebar:not\(:hover\) \.side-toggle\s*\{[^}]*border-radius:\s*8px/s);
});
