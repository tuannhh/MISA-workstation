#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const ok = (condition, message) => {
  if (!condition) throw new Error(message);
};
const pass = (message) => console.log(`PASS  ${message}`);
const clean = (value) => value.replaceAll('**', '').replaceAll('`', '').trim();

function expandRouteIds(value) {
  const ids = [];
  for (const match of value.matchAll(/R(\d{3})(?:-R(\d{3}))?/g)) {
    const first = Number(match[1]);
    const last = Number(match[2] || match[1]);
    ok(last >= first, `invalid route range ${match[0]}`);
    for (let id = first; id <= last; id += 1) ids.push(`R${String(id).padStart(3, '0')}`);
  }
  return ids;
}

function markdownRows(markdown, rowPattern) {
  return markdown.split('\n')
    .filter((line) => rowPattern.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

function assertPartition(actual, expected, label) {
  const counts = new Map();
  for (const id of actual) counts.set(id, (counts.get(id) || 0) + 1);
  const missing = expected.filter((id) => !counts.has(id));
  const duplicate = [...counts].filter(([, count]) => count !== 1).map(([id, count]) => `${id}×${count}`);
  const unknown = [...counts.keys()].filter((id) => !expected.includes(id));
  ok(!missing.length && !duplicate.length && !unknown.length,
    `${label}: missing=[${missing}] duplicate=[${duplicate}] unknown=[${unknown}]`);
}

function sourceRoutes() {
  const routes = [];
  for (const [file, prefix] of [['server/routes.js', '/api'], ['server/ai.js', '/api/ai']]) {
    const source = read(file);
    const regex = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]([^\n]*)/g;
    for (const match of source.matchAll(regex)) {
      const permission = match[3].match(/requirePerm\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
      routes.push({
        method: match[1].toUpperCase(),
        fullPath: `${prefix}${match[2]}`,
        module: permission ? permission[1] : null,
        action: permission ? permission[2] : null,
      });
    }
  }
  routes.push(
    { method: 'POST', fullPath: '/api/login', module: null, authKind: 'public' },
    { method: 'POST', fullPath: '/api/logout', module: null, authKind: 'no-middleware' },
    { method: 'GET', fullPath: '/api/me', module: null, authKind: 'handler-session-check' },
  );
  return routes;
}

function verifyRoutesAndMatrices() {
  const catalog = read('memory-bank/07-route-catalog.md');
  const matrix = read('memory-bank/08-permission-matrix.md');
  const catalogRows = markdownRows(catalog, /^\| R\d{3} \|/);
  ok(catalogRows.length === 145, `catalog rows=${catalogRows.length}, expected 145`);

  const ids = catalogRows.map((row) => row[0]);
  const expectedIds = Array.from({ length: 145 }, (_, index) => `R${String(index + 1).padStart(3, '0')}`);
  assertPartition(ids, expectedIds, 'route catalog IDs');

  const source = sourceRoutes();
  ok(source.length === 145, `source literal routes=${source.length}, expected 145`);
  const sourceByKey = new Map(source.map((route) => [`${route.method} ${route.fullPath}`, route]));
  ok(sourceByKey.size === 145, 'source contains duplicate method/path pairs');

  const catalogById = new Map();
  for (const row of catalogRows) {
    const [id, method, fullPath, auth] = row;
    const route = sourceByKey.get(`${method} ${fullPath}`);
    ok(route, `${id} ${method} ${fullPath} does not match source`);
    const authText = clean(auth);
    if (route.module) {
      ok(authText.includes(`requirePerm(${route.module},${route.action})`),
        `${id} auth mismatch: source=${route.module}:${route.action}, catalog=${authText}`);
    } else if (route.authKind === 'public') {
      ok(authText.includes('no-auth'), `${id} login must be documented public/no-auth`);
    } else if (route.authKind === 'no-middleware') {
      ok(authText.includes('no auth middleware'), `${id} logout has no auth middleware`);
    } else if (route.authKind === 'handler-session-check') {
      ok(authText.includes('handler tự kiểm tra session'), `${id} me auth is a handler check`);
    } else {
      ok(authText.includes('requireAuth'), `${id} is protected by router.use(requireAuth)`);
    }
    catalogById.set(id, route);
  }
  pass('route catalog: 145 unique IDs and exact source method/path/auth');

  const sectionA = matrix.slice(matrix.indexOf('## A.'), matrix.indexOf('## B.'));
  const sectionARows = markdownRows(sectionA, /^\| (partners|reminders|interactions|reports|awards|suppliers|events|admin|monitoring|\*\(không)/);
  const sectionAIds = sectionARows.flatMap((row) => expandRouteIds(row[3]));
  assertPartition(sectionAIds, expectedIds, 'Section A authorization partition');
  for (const row of sectionARows) {
    const documentedModule = clean(row[0]).startsWith('*(không') ? null : clean(row[0]);
    for (const id of expandRouteIds(row[3])) {
      ok(catalogById.get(id).module === documentedModule,
        `${id} Section A module=${documentedModule}, source=${catalogById.get(id).module}`);
    }
  }
  pass('authorization matrix Section A: 145 unique IDs and exact source module partition');

  const flowRows = markdownRows(matrix, /^\| F\d{3} \|/);
  ok(flowRows.length === 34, `UI flow rows=${flowRows.length}, expected 34`);
  const flowIds = flowRows.map((row) => row[0]);
  ok(new Set(flowIds).size === flowRows.length, 'duplicate flow_id in UI-flow matrix');
  const mappedIds = [];
  for (const row of flowRows) {
    ok(row.length === 8, `${row[0]} must have 8 columns, got ${row.length}`);
    mappedIds.push(...expandRouteIds(row[2]));
    ok(row[3].includes('D-') && row[4].includes('D-'), `${row[0]} missing Desktop profile for a current role`);
    ok(row[5].includes('N-MISSING') && row[6].includes('N-MISSING'), `${row[0]} missing Native row/profile for a current role`);
    ok(row[7].length > 0, `${row[0]} missing disabled/masked evidence status`);
  }
  assertPartition(mappedIds, expectedIds, 'UI-flow route mapping');
  pass('UI-flow matrix: 145 routes -> exactly 1 of 34 flows; 2 roles x Desktop/Native present');
}

function verifyGemini() {
  const count = (file) => [...read(file).matchAll(/\bgemini\.(?:genJSON|genText|genImage|groundedSearch)\s*\(/g)].length;
  const ai = count('server/ai.js');
  const monitor = count('server/monitor.js');
  ok(ai === 6 && monitor === 7, `Gemini expressions ai=${ai}, monitor=${monitor}; expected 6/7`);
  ok(read('memory-bank/06-threat-model.md').includes('12 logical') || read('memory-bank/06-threat-model.md').includes('12 luồng'),
    'threat model must document 12 logical Gemini flows');
  pass('Gemini inventory: ai.js=6, monitor.js=7, 13 expressions / 12 logical flows');
}

function verifySchema() {
  const db = read('server/db.js');
  const tables = [...db.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/g)].map((match) => match[1]);
  const indexes = [...db.matchAll(/CREATE INDEX IF NOT EXISTS\s+([a-z_]+)/g)].map((match) => match[1]);
  const drops = [...db.matchAll(/DROP TABLE IF EXISTS\s+([a-z_]+)/g)].map((match) => match[1]);
  ok(new Set(tables).size === 34, `tables=${new Set(tables).size}, expected 34`);
  ok(new Set(indexes).size === 22, `indexes=${new Set(indexes).size}, expected 22`);
  ok(new Set(drops).size === 28, `drop targets=${new Set(drops).size}, expected 28`);
  const omissions = [...new Set(tables)].filter((table) => !new Set(drops).has(table)).sort();
  const expected = ['agreements', 'benefit_usages', 'gifts', 'supplier_contacts', 'supplier_transactions', 'work_logs'].sort();
  ok(JSON.stringify(omissions) === JSON.stringify(expected), `drop omissions=${omissions}, expected=${expected}`);
  pass(`schema facts: 34 tables, 22 indexes, 28 drops; omissions=${omissions.join(',')}`);
}

function verifyErrorExample() {
  const contract = read('memory-bank/05-error-contract.md');
  const message = contract.match(/^\s*"message":\s*"([^"]+)"/m)?.[1];
  const error = contract.match(/^\s*"error":\s*"([^"]+)"/m)?.[1];
  ok(message && message === error, `error example mismatch: message=${message}, error=${error}`);
  pass('error contract example: message === error');
}

function verifyMarkdownLinks() {
  const docs = fs.readdirSync(path.join(root, 'memory-bank')).filter((name) => name.endsWith('.md'));
  const broken = [];
  for (const doc of docs) {
    const source = read(`memory-bank/${doc}`)
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`\n]+`/g, '');
    for (const match of source.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)) {
      let target = match[1].trim().replace(/^<|>$/g, '').split('#')[0];
      if (!target || /^(?:https?:|mailto:)/.test(target) || target.includes('://')) continue;
      target = decodeURIComponent(target);
      const resolved = path.resolve(root, 'memory-bank', target);
      if (!fs.existsSync(resolved)) broken.push(`${doc} -> ${target}`);
    }
  }
  ok(!broken.length, `broken Markdown links:\n${broken.join('\n')}`);
  pass(`Markdown internal links: 0 broken across ${docs.length} memory-bank files`);
}

function verifyRemediationScope() {
  const baseArg = process.argv.find((arg) => arg.startsWith('--base='));
  if (!baseArg) return;
  const base = baseArg.slice('--base='.length);
  const changed = execFileSync('git', ['diff', '--name-only', base], { cwd: root, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const names = [...new Set([...changed, ...untracked])];
  const scoped = names.filter((name) => name !== '.DS_Store');
  const invalid = scoped.filter((name) => !name.startsWith('memory-bank/') && name !== 'scripts/verify-g0.mjs');
  ok(!invalid.length, `remediation touched product files: ${invalid.join(',')}`);
  pass(`remediation scope from ${base}: memory-bank + verification script only (${scoped.length} files; unrelated .DS_Store ignored)`);
}

try {
  verifyRoutesAndMatrices();
  verifyGemini();
  verifySchema();
  verifyErrorExample();
  verifyMarkdownLinks();
  verifyRemediationScope();
  console.log('\nG0 verification checks passed.');
} catch (error) {
  console.error(`FAIL  ${error.message}`);
  process.exitCode = 1;
}
