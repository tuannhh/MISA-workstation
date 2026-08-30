'use strict';
// F15 — unit test thuần cho translate() (server/mysql-sync.js): xác nhận cột `REFERENCES` inline
// kiểu SQLite được chuyển thành `CONSTRAINT ... FOREIGN KEY` out-of-line thật cho MySQL. Root
// cause đã xác nhận thực nghiệm (không đoán): MySQL/InnoDB PARSE nhưng ÂM THẦM BỎ QUA cú pháp
// REFERENCES gắn trực tiếp vào cột — chỉ tạo constraint thật khi có FOREIGN KEY tách riêng.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { translate } = require('../mysql-sync');

test('BR-FK-001: cột REFERENCES + ON DELETE CASCADE chuyển thành CONSTRAINT FOREIGN KEY out-of-line', () => {
  const sql = `CREATE TABLE IF NOT EXISTS award_participations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    award_id INTEGER REFERENCES awards(id) ON DELETE CASCADE,
    year INTEGER
  )`;
  const out = translate(sql);
  assert.match(out, /award_id BIGINT,/, 'kiểu cột vẫn phải là BIGINT, không bị mất khi tách REFERENCES ra');
  assert.match(out, /CONSTRAINT fk_award_participations_award_id FOREIGN KEY \(award_id\) REFERENCES awards\(id\) ON DELETE CASCADE/);
  assert.doesNotMatch(out, /award_id\s+BIGINT\s+REFERENCES/, 'không được còn REFERENCES inline ngay sau kiểu cột (MySQL âm thầm bỏ qua dạng này)');
});

test('BR-FK-002: ON DELETE SET NULL giữ đúng action, không bị đổi thành CASCADE mặc định', () => {
  const sql = `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organizer_org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    name TEXT
  )`;
  const out = translate(sql);
  assert.match(out, /CONSTRAINT fk_events_organizer_org_id FOREIGN KEY \(organizer_org_id\) REFERENCES organizations\(id\) ON DELETE SET NULL/);
});

test('BR-FK-003: REFERENCES không có ON DELETE (mặc định RESTRICT/NO ACTION của MySQL) vẫn tạo FK, không tự thêm CASCADE', () => {
  const sql = `CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_by INTEGER REFERENCES users(id),
    note TEXT
  )`;
  const out = translate(sql);
  assert.match(out, /CONSTRAINT fk_bookings_created_by FOREIGN KEY \(created_by\) REFERENCES users\(id\)(?!\s+ON\s+DELETE)/);
});

test('BR-FK-004: nhiều FK trong cùng 1 bảng đều được tách ra đủ, không chỉ FK đầu tiên', () => {
  const sql = `CREATE TABLE IF NOT EXISTS event_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    amount INTEGER
  )`;
  const out = translate(sql);
  assert.match(out, /CONSTRAINT fk_event_costs_event_id FOREIGN KEY \(event_id\) REFERENCES events\(id\) ON DELETE CASCADE/);
  assert.match(out, /CONSTRAINT fk_event_costs_supplier_id FOREIGN KEY \(supplier_id\) REFERENCES suppliers\(id\) ON DELETE SET NULL/);
});

test('BR-FK-005: bảng không có REFERENCES nào thì không đổi gì (không thêm FK giả)', () => {
  const sql = `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL
  )`;
  const out = translate(sql);
  assert.doesNotMatch(out, /CONSTRAINT/);
  assert.doesNotMatch(out, /FOREIGN KEY/);
});

test('BR-FK-006: NOT NULL trên cột có REFERENCES vẫn được giữ nguyên sau khi tách FK', () => {
  const sql = `CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
  )`;
  const out = translate(sql);
  assert.match(out, /user_id BIGINT NOT NULL\s*,?\s*$/m, 'NOT NULL phải còn nguyên trên cột, không bị REFERENCES nuốt mất');
  assert.match(out, /CONSTRAINT fk_assignments_user_id FOREIGN KEY \(user_id\) REFERENCES users\(id\) ON DELETE CASCADE/);
});

test('BR-FK-007: kết quả translate() vẫn là DDL hợp lệ có thể chạy thật trên MySQL (round-trip qua db thật)', async () => {
  if (String(process.env.DB_CLIENT || 'mysql').toLowerCase() !== 'mysql') return; // chỉ có ý nghĩa khi chạy với DB_CLIENT=mysql
  const dbHarness = require('../test-support/db-harness');
  const { teardown } = dbHarness.setupTestDataDir();
  const dbName = await dbHarness.createMysqlTestDb();
  try {
    const { db, closeDb } = require('../db');
    const fk = db.prepare(`SELECT COUNT(*) AS c FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='award_participations' AND REFERENCED_TABLE_NAME='awards'`).get();
    assert.equal(fk.c, 1, 'award_participations.award_id phải có đúng 1 FK trỏ về awards thật trên MySQL');
    await closeDb();
  } finally {
    await dbHarness.dropMysqlTestDb(dbName);
    teardown();
  }
});
