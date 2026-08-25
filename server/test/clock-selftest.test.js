'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { useFixedClock } = require('../test-support/clock');

test('useFixedClock ghim Date.now()/new Date() đúng thời điểm cố định', (t) => {
  useFixedClock(t, '2026-01-15T00:00:00.000Z');
  assert.equal(Date.now(), Date.parse('2026-01-15T00:00:00.000Z'));
  assert.equal(new Date().toISOString(), '2026-01-15T00:00:00.000Z');
});

test('clock giả không rò rỉ sang test khác trong cùng file (context.mock.timers tự reset)', () => {
  const now = Date.now();
  assert.notEqual(now, Date.parse('2026-01-15T00:00:00.000Z'));
});
