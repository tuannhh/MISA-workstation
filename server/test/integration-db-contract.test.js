'use strict';

// G1A.5 — DB contract: schema/constraint/data round-trip trên cả SQLite và MySQL.
// Đây là contract cho adapter hiện tại, không phải target migration Wave 1: các khác biệt
// FK đã biết (F15) được characterize riêng ở route tests và không bị "tô xanh" ở đây.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const isMysql = String(process.env.DB_CLIENT || 'mysql').toLowerCase() === 'mysql';
const dbHarness = require('../test-support/db-harness');
const { createResourceStack } = require('../test-support/resource-stack');

const TABLES = [
  'users', 'organizations', 'people', 'attachments', 'sponsorships', 'important_dates',
  'bookings', 'budgets', 'reminder_log', 'interactions', 'audit_log', 'awards',
  'award_participations', 'assignments', 'suppliers', 'supplier_quotes', 'events',
  'event_costs', 'association_fees', 'agreements', 'work_logs', 'gifts', 'benefit_usages',
  'supplier_transactions', 'supplier_contacts', 'scan_queries', 'sources', 'mentions',
  'competitors', 'monitor_alerts', 'scan_runs', 'sentiment_audit', 'app_meta', 'campaigns', 'field_visibility',
  'voice_proposals',
];

// Các cột này đại diện cho schema gốc + các migration từng gây lỗi thực tế. Không lặp toàn bộ
// catalog cột ở đây; chi tiết đầy đủ nằm ở memory-bank/09-db-schema.md.
const REQUIRED_COLUMNS = {
  users: ['id', 'username', 'password_hash', 'full_name', 'role', 'sensitive_perms', 'email', 'notify_opt_in'],
  organizations: ['id', 'name', 'org_type', 'membership_fee'],
  people: ['id', 'org_id', 'full_name', 'phone_other', 'assoc_events', 'assoc_awards'],
  attachments: ['id', 'owner_type', 'owner_id', 'kind', 'audience_visibility'],
  bookings: ['id', 'title', 'amount', 'award_id', 'event_id', 'owner_id'],
  gifts: ['id', 'owner_type', 'owner_id', 'responsible_user_id'],
  awards: ['id', 'name', 'owner_id'],
  events: ['id', 'name', 'owner_id'],
  interactions: ['id', 'partner_type', 'owner_id'],
  sponsorships: ['id', 'title', 'owner_id'],
  agreements: ['id', 'title', 'owner_id'],
  work_logs: ['id', 'owner_id'],
  association_fees: ['id', 'owner_id'],
  supplier_quotes: ['id', 'supplier_id', 'owner_id'],
  supplier_transactions: ['id', 'supplier_id', 'owner_id'],
  supplier_contacts: ['id', 'supplier_id', 'owner_id'],
  award_participations: ['id', 'award_id', 'owner_id'],
  benefit_usages: ['id', 'org_id', 'owner_id'],
  reminder_log: ['id', 'date_id', 'occur_date', 'seq', 'channel', 'recipient_user_id'],
  sources: ['id', 'name', 'enabled', 'auto', 'mode'],
  mentions: ['id', 'query_id', 'link', 'matched_group'],
  scan_queries: ['id', 'name', 'grounding'],
  scan_runs: ['id', 'queries', 'fetched', 'new_mentions', 'pos', 'neu', 'neg'],
  app_meta: ['key', 'value'],
};

let db;
const resources = createResourceStack();

before(async () => {
  if (isMysql) {
    resources.acquire(dbHarness.setupTestDataDir().teardown);
    const dbName = await dbHarness.createMysqlTestDb();
    resources.acquire(() => dbHarness.dropMysqlTestDb(dbName));
  } else {
    resources.acquire(dbHarness.setupSqliteDb().teardown);
  }
  const dbMod = require('../db');
  db = dbMod.db;
  resources.acquire(dbMod.closeDb);
});

after(async () => {
  await resources.cleanupAll();
});

function tableNames() {
  if (isMysql) {
    return db.prepare(
      'SELECT TABLE_NAME AS name FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE()'
    ).all().map((row) => row.name);
  }
  return db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all().map((row) => row.name);
}

function columnNames(table) {
  if (isMysql) {
    return db.prepare(
      'SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?'
    ).all(table).map((row) => row.name);
  }
  // table is a constant from REQUIRED_COLUMNS, never user input.
  return db.prepare(`PRAGMA table_info(\`${table}\`)`).all().map((row) => row.name);
}

test('DB-CONTRACT-001: canonical schema có đủ 36 bảng trên cả hai driver', () => {
  assert.deepEqual(new Set(tableNames()), new Set(TABLES));
});

test('DB-CONTRACT-005: field_visibility unique theo module+field và mặc định private', () => {
  const insert = db.prepare('INSERT INTO field_visibility (module,field) VALUES (?,?)');
  insert.run('partners', 'bank_account_number');
  const row = db.prepare('SELECT is_public FROM field_visibility WHERE module=? AND field=?').get('partners', 'bank_account_number');
  assert.equal(Number(row.is_public), 0);
  assert.throws(() => insert.run('partners', 'bank_account_number'), /duplicate|unique|UNIQUE|constraint/i);
});

test('DB-CONTRACT-002: các cột lõi và migration quan trọng tồn tại', () => {
  for (const [table, required] of Object.entries(REQUIRED_COLUMNS)) {
    const actual = new Set(columnNames(table));
    for (const column of required) assert.ok(actual.has(column), `${table}.${column} bị thiếu`);
  }
});

test('DB-CONTRACT-003: unique username được thực thi và dữ liệu round-trip đúng kiểu/giá trị', () => {
  const username = `db_contract_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const insert = db.prepare(
    'INSERT INTO users (username,password_hash,full_name,role,email) VALUES (?,?,?,?,?)'
  );
  const id = insert.run(username, 'hash', 'DB Contract', 'executor', `${username}@example.test`).lastInsertRowid;
  const row = db.prepare('SELECT id,username,full_name,role FROM users WHERE id=?').get(id);
  assert.equal(row.username, username);
  assert.equal(row.full_name, 'DB Contract');
  assert.equal(row.role, 'executor');
  assert.throws(() => insert.run(username, 'hash2', 'Duplicate', 'executor', null), /duplicate|unique|UNIQUE|constraint/i);
});

test('DB-CONTRACT-004: app_meta upsert giữ đúng một key và giá trị mới trên cả driver', () => {
  const key = `db-contract-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const upsert = db.prepare(
    'INSERT INTO app_meta (`key`,value) VALUES (?,?) ON CONFLICT(`key`) DO UPDATE SET value=excluded.value'
  );
  upsert.run(key, 'first');
  upsert.run(key, 'second');
  const rows = db.prepare('SELECT value FROM app_meta WHERE `key`=?').all(key);
  assert.deepEqual(rows.map((row) => row.value), ['second']);
});

test('DB-CONTRACT-006: migrate() chuyển user role legacy pr_staff -> executor, idempotent (remediation P1 audit F19 — RBAC-CUTOVER thiếu migration này, user cũ sẽ bị khoá hoàn toàn sau deploy vì rbac.MATRIX không còn key pr_staff)', () => {
  const { migrate } = require('../db');
  const username = `pr_staff_legacy_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  db.prepare('INSERT INTO users (username,password_hash,full_name,role,email) VALUES (?,?,?,?,?)')
    .run(username, 'hash', 'User cũ pr_staff', 'pr_staff', null);
  migrate();
  assert.equal(db.prepare('SELECT role FROM users WHERE username=?').get(username).role, 'executor');
  // idempotent: chạy lại (giả lập app restart lần 2) không lỗi, không đổi thêm gì
  migrate();
  assert.equal(db.prepare('SELECT role FROM users WHERE username=?').get(username).role, 'executor');
});
