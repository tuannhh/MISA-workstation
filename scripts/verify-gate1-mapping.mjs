#!/usr/bin/env node
// Machine-check the Gate 1 mapping without trying to infer business correctness.
// It catches route omissions, duplicate route rows, missing test files and stale IDs;
// semantic/security target review remains an auditor responsibility.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogPath = path.join(root, 'memory-bank/07-route-catalog.md');
const mappingPath = path.join(root, 'memory-bank/gate1-test-mapping.md');
const allowlistPath = path.join(root, 'memory-bank/g1b-allowlist.json');
const catalog = fs.readFileSync(catalogPath, 'utf8');
const mapping = fs.readFileSync(mappingPath, 'utf8');
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
const routeIds = [...catalog.matchAll(/^\|\s*(R\d{3})\s*\|/gm)].map((m) => m[1]);
// G1B.6 dùng vocabulary {F-id/D13-target/N-id} cho known-red (xem header file mapping) — verifier
// trước đây chỉ nhận diện route/job/AI/BR nên các dòng F2-*/D13-*/N-* của G1B bị mapping đếm ẩn
// (PASS giả, không phản ánh đúng known-red thật). Bổ sung 3 prefix này để mapping thấy đủ.
const rows = mapping.split('\n').filter((line) => /^\|\s*(R\d{3}|JOB-[A-Z-]+|AI-|BR-|F\d+-|D13-|N\d+-|UI-CHAR-|INFRA-)/.test(line));
const routeRows = rows.filter((line) => /^\|\s*R\d{3}\s*\|/.test(line));

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

if (routeIds.length !== 148 || new Set(routeIds).size !== 148) {
  fail(`route catalog phải có 148 ID duy nhất, nhận ${routeIds.length}`);
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

// Codex audit Bundle A, finding #2 phần verifier (2026-08-28): trước đó verifier chỉ ĐẾM dòng
// known-red trong mapping, không đối chiếu với memory-bank/g1b-allowlist.json — một known-red
// row có thể trỏ tới allowlist entry không tồn tại/hết hạn/thiếu field mà verifier vẫn PASS.
const allowlistCounts = new Map();
for (const entry of allowlist) {
  if (!entry.id) { fail(`g1b-allowlist.json có entry thiếu "id": ${JSON.stringify(entry)}`); continue; }
  allowlistCounts.set(entry.id, (allowlistCounts.get(entry.id) || 0) + 1);
  for (const field of ['owner', 'expiry', 'wave']) {
    if (!entry[field]) fail(`g1b-allowlist.json entry "${entry.id}" thiếu field bắt buộc "${field}"`);
  }
  if (entry.expiry && !(new Date(entry.expiry).getTime() > Date.now())) {
    fail(`g1b-allowlist.json entry "${entry.id}" đã hết hạn (expiry=${entry.expiry}) — gia hạn có chủ đích hoặc implement thật`);
  }
}
for (const [id, count] of allowlistCounts) {
  if (count > 1) fail(`g1b-allowlist.json entry "${id}" trùng lặp ${count} lần`);
}

const statusOf = (line) => line.split('|')[3]?.trim().replace(/\*/g, '').match(/^(TODO|green|known-red|manual-host)\b/)?.[1];
const knownRedRows = rows.filter((line) => statusOf(line) === 'known-red');
for (const line of knownRedRows) {
  const id = line.split('|')[1]?.trim();
  if (id && !allowlistCounts.has(id)) {
    fail(`mapping "${id}" đánh dấu known-red nhưng không có entry tương ứng trong g1b-allowlist.json`);
  }
}
const referencedIds = new Set(knownRedRows.map((line) => line.split('|')[1]?.trim()));
for (const id of allowlistCounts.keys()) {
  if (!referencedIds.has(id)) fail(`g1b-allowlist.json entry "${id}" không được dòng known-red nào trong gate1-test-mapping.md tham chiếu — entry mồ côi, xoá hoặc thêm mapping row`);
}

if (!process.exitCode) {
  const todo = rows.filter((line) => statusOf(line) === 'TODO').length;
  const knownRed = knownRedRows.length;
  console.log(`PASS Gate 1 mapping: ${routeIds.length}/148 route, ${rows.length} mapped rows, TODO=${todo}, known-red=${knownRed} (allowlist ${allowlistCounts.size} entry, đã đối chiếu)`);
}
