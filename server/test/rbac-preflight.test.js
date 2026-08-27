'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '..', '..');

function childEnv(dataDir) {
  const env = { ...process.env, DB_CLIENT: 'sqlite', DATA_DIR: dataDir };
  // A nested node:test inherits these and then silently skips its own test work.
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_TEST_WORKER_ID;
  return env;
}

function createFreshDb(dataDir) {
  const result = spawnSync(process.execPath, ['-e', "const { closeDb } = require('./server/db'); closeDb();"], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
    env: childEnv(dataDir),
  });
  assert.equal(result.signal, null, 'fresh database setup must not hang');
  assert.equal(result.status, 0, result.stderr);
}

function runPreflight(dataDir) {
  const result = spawnSync(process.execPath, ['scripts/rbac-preflight.mjs'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
    env: childEnv(dataDir),
  });
  assert.equal(result.signal, null, 'preflight must not hang');
  return { ...result, report: JSON.parse(result.stdout) };
}

test('BR-RBAC-001: preflight rejects a database with an unassigned direct-resource owner', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-rbac-preflight-'));
  try {
    createFreshDb(dataDir);
    const db = new DatabaseSync(path.join(dataDir, 'pr.db'));
    db.prepare('INSERT INTO bookings (subject_type, subject_id, title) VALUES (?, ?, ?)').run('org', 1, 'Unassigned booking');
    db.close();

    const result = runPreflight(dataDir);
    assert.equal(result.status, 2, 'missing ownership must keep the fail-closed gate locked');
    assert.equal(result.report.readyToFlipFailClosed, false);
    assert.equal(result.report.actual.hasUnassignedOwners, true);
    assert.deepEqual(
      result.report.actual.ownership.find(({ table }) => table === 'bookings'),
      { table: 'bookings', column: 'owner_id', total: 1, missing: 1 },
    );
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('BR-RBAC-002: preflight allows a fresh schema only after every required value is present', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-rbac-preflight-'));
  try {
    createFreshDb(dataDir);
    const db = new DatabaseSync(path.join(dataDir, 'pr.db'));
    db.prepare('INSERT INTO bookings (subject_type, subject_id, title, owner_id) VALUES (?, ?, ?, ?)').run('org', 1, 'Assigned booking', 1);
    db.close();

    const result = runPreflight(dataDir);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.report.readyToFlipFailClosed, true);
    assert.equal(result.report.actual.hasUnassignedOwners, false);
    assert.equal(result.report.actual.hasUnclassifiedAttachments, false);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
