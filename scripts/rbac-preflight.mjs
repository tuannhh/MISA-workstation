#!/usr/bin/env node
// W1.RBAC.0 — read-only preflight. Never import server/db.js: importing it can seed/migrate.
import path from 'node:path';
import process from 'node:process';

const activityTables = ['bookings', 'interactions', 'awards', 'events', 'sponsorships', 'agreements', 'work_logs', 'gifts', 'association_fees', 'supplier_quotes', 'supplier_transactions', 'supplier_contacts', 'award_participations', 'benefit_usages'];
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const driver = String(process.env.DB_CLIENT || 'sqlite').toLowerCase();

let query, close;
if (driver === 'mysql') {
  const mysql = (await import('mysql2/promise')).default;
  const pool = mysql.createPool({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, connectionLimit: 1 });
  query = async (sql, params = []) => (await pool.query(sql, params))[0];
  close = () => pool.end();
} else {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path.join(dataDir, 'pr.db'), { readOnly: true });
  query = async (sql, params = []) => db.prepare(sql).all(...params);
  close = () => db.close();
}

function asCount(value) {
  return Number(value ?? 0);
}

async function countMissingValues(table, column) {
  // Both identifiers originate from the fixed catalog above, never user input.
  const rows = await query(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN ${column} IS NULL THEN 1 ELSE 0 END) AS missing FROM ${table}`,
  );
  return { table, column, total: asCount(rows[0]?.total), missing: asCount(rows[0]?.missing) };
}

try {
  const columns = new Map();
  for (const table of [...activityTables, 'attachments']) {
    const rows = driver === 'mysql'
      ? await query('SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?', [table])
      : await query(`PRAGMA table_info(${table})`);
    columns.set(table, new Set(rows.map((row) => row.name)));
  }
  const missingOwner = activityTables.filter((table) => table === 'gifts'
    ? !columns.get(table).has('responsible_user_id')
    : !columns.get(table).has('owner_id'));
  const attachmentsHasVisibility = columns.get('attachments').has('audience_visibility');
  const ownership = [];
  for (const table of activityTables) {
    const column = table === 'gifts' ? 'responsible_user_id' : 'owner_id';
    if (columns.get(table).has(column)) ownership.push(await countMissingValues(table, column));
  }
  const attachmentVisibility = attachmentsHasVisibility
    ? await countMissingValues('attachments', 'audience_visibility')
    : null;
  const visibilityTable = driver === 'mysql'
    ? await query("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='field_visibility'")
    : await query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='field_visibility'");
  const hasUnassignedOwners = ownership.some(({ missing }) => missing > 0);
  const hasUnclassifiedAttachments = attachmentVisibility?.missing > 0;
  const report = {
    driver,
    readOnly: true,
    required: {
      activityTables,
      ownerColumnException: { gifts: 'responsible_user_id (owner_id là người/cơ quan nhận quà legacy)' },
      attachmentVisibility: 'audience_visibility',
      fieldVisibilityTable: 'field_visibility',
      dataReadiness: 'All direct-resource owner columns and attachment visibility must have NULL=0 before fail-closed.',
    },
    actual: {
      missingOwner,
      ownership,
      attachmentsHasVisibility,
      attachmentVisibility,
      hasFieldVisibility: visibilityTable.length > 0,
      hasUnassignedOwners,
      hasUnclassifiedAttachments,
    },
    readyToFlipFailClosed: missingOwner.length === 0
      && attachmentsHasVisibility
      && visibilityTable.length > 0
      && !hasUnassignedOwners
      && !hasUnclassifiedAttachments,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.readyToFlipFailClosed) process.exitCode = 2;
} finally {
  await close();
}
