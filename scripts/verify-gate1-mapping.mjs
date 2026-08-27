#!/usr/bin/env node
// Machine-check the Gate 1 mapping without trying to infer business correctness.
// It catches route omissions, duplicate route rows, missing test files and stale IDs;
// semantic/security target review remains an auditor responsibility.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogPath = path.join(root, 'memory-bank/07-route-catalog.md');
const mappingPath = path.join(root, 'memory-bank/gate1-test-mapping.md');
const catalog = fs.readFileSync(catalogPath, 'utf8');
const mapping = fs.readFileSync(mappingPath, 'utf8');
const routeIds = [...catalog.matchAll(/^\|\s*(R\d{3})\s*\|/gm)].map((m) => m[1]);
const rows = mapping.split('\n').filter((line) => /^\|\s*(R\d{3}|JOB-[A-Z-]+|AI-|BR-)/.test(line));
const routeRows = rows.filter((line) => /^\|\s*R\d{3}\s*\|/.test(line));

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

if (routeIds.length !== 145 || new Set(routeIds).size !== 145) {
  fail(`route catalog phải có 145 ID duy nhất, nhận ${routeIds.length}`);
}
const counts = new Map();
for (const line of routeRows) {
  const id = line.match(/^\|\s*(R\d{3})\s*\|/)?.[1];
  if (id) counts.set(id, (counts.get(id) || 0) + 1);
}
for (const id of routeIds) {
  if (!counts.has(id)) fail(`mapping thiếu ${id}`);
  if (counts.get(id) !== 1) fail(`mapping ${id} xuất hiện ${counts.get(id)} lần`);
}

for (const line of rows) {
  const cells = line.split('|').map((cell) => cell.trim());
  const id = cells[1];
  const testId = cells[2];
  const status = cells[3];
  const file = cells[4];
  if (!id || !testId || !status || !file) {
    fail(`row ${id || '(unknown)'} thiếu cột bắt buộc`);
    continue;
  }
  const normalizedStatus = status.replace(/\*/g, '').match(/^(TODO|green|known-red|manual-host)\b/)?.[1];
  if (!normalizedStatus) {
    fail(`${id} có status không hợp lệ: ${status}`);
  }
  if (normalizedStatus !== 'TODO' && file !== '—' && !fs.existsSync(path.join(root, file))) {
    fail(`${id} trỏ tới file không tồn tại: ${file}`);
  }
}

if (!process.exitCode) {
  const statusOf = (line) => line.split('|')[3]?.trim().replace(/\*/g, '').match(/^(TODO|green|known-red|manual-host)\b/)?.[1];
  const todo = rows.filter((line) => statusOf(line) === 'TODO').length;
  const knownRed = rows.filter((line) => statusOf(line) === 'known-red').length;
  console.log(`PASS Gate 1 mapping: ${routeIds.length}/145 route, ${rows.length} mapped rows, TODO=${todo}, known-red=${knownRed}`);
}
