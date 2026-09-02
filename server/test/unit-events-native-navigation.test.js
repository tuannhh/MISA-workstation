'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const mobileEvents = fs.readFileSync(path.join(root, 'frontend', 'src', 'features', 'events', 'mobile', 'EventsListMobile.vue'), 'utf8');
const eventsFeature = fs.readFileSync(path.join(root, 'frontend', 'src', 'features', 'events', 'EventsListFeature.vue'), 'utf8');
const app = fs.readFileSync(path.join(root, 'frontend', 'src', 'App.vue'), 'utf8');
const bottomNav = fs.readFileSync(path.join(root, 'frontend', 'src', 'components', 'mds', 'MMobileBottomNav.vue'), 'utf8');

test('UI-EVENT-NATIVE-007: Native Events có taskbar app, CTA nổi và entry AVA thay vì text AI', () => {
  assert.match(mobileEvents, /<MMobileBottomNav/);
  assert.match(mobileEvents, /MHeaderIconAva/);
  assert.match(mobileEvents, /Trợ lý số MISA AVA — nhập nhanh sự kiện/);
  assert.doesNotMatch(mobileEvents, /variant="link"[^>]*>AI</, 'không để text action AI chìm trong top bar');
  assert.match(mobileEvents, /Thêm sự kiện/);
  assert.match(mobileEvents, /<MEmptyState[^>]*title="Chưa có sự kiện"[\s\S]*?<template #actions>/);
  assert.match(mobileEvents, /Khám phá PR Workstation/);
  assert.match(mobileEvents, /--mds-mobile-bottom-nav-height/);
});

test('UI-EVENT-NATIVE-008: taskbar chỉ điều hướng sang native slice đã bật, không rơi về desktop legacy', () => {
  assert.match(bottomNav, /aria-label="Điều hướng chính của ứng dụng"/);
  assert.match(bottomNav, /--mds-mobile-bottom-nav-height/);
  assert.match(bottomNav, /:aria-current="item.active \? 'page' : undefined"/);
  assert.match(eventsFeature, /:native-navigation="nativeNavigation"/);
  assert.match(eventsFeature, /@navigate="emit\('navigate', \$event\)"/);
  assert.match(app, /const nativeNavigationTargets/);
  for (const label of ['Danh bạ', 'Tương tác', 'Sự kiện', 'Giải thưởng', 'Giám sát', 'Nhắc việc', 'Báo cáo', 'Quản trị']) assert.match(app, new RegExp(`label: '${label}'`));
  assert.match(app, /disabled: !isLocalUiHarness && !target\.enabled\(\)/);
  assert.match(app, /if \(!target \|\| \(!isLocalUiHarness && !target\.enabled\(\)\)\) return/);
  assert.match(app, /url\.searchParams\.set\(target\.pilotParam, '1'\)/);
  assert.match(app, /url\.searchParams\.set\(target\.surfaceParam, HostSurface\.NATIVE\)/);
});
