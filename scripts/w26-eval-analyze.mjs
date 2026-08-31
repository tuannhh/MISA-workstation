'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const FILE = path.join(__dirname, '.w26-eval-out', `results-${args.tag || 'full'}.jsonl`);
const rows = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(p * (s.length - 1));
  return s[idx];
}
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / (arr.length || 1); }

const models = [...new Set(rows.map((r) => r.model))];
const families = [...new Set(rows.map((r) => r.family))];

console.log('=== Tổng quan theo model ===');
for (const model of models) {
  const rs = rows.filter((r) => r.model === model);
  const ok = rs.filter((r) => r.ok);
  const failed = rs.filter((r) => !r.ok);
  const validSchema = ok.filter((r) => r.schemaValid);
  const acc = mean(ok.map((r) => r.fieldAccuracy || 0));
  const lat = ok.map((r) => r.latencyMs);
  const cost = ok.reduce((a, r) => a + (r.costUsd || 0), 0);
  console.log(`\n[${model}] n=${rs.length} ok=${ok.length} failed=${failed.length}`);
  console.log(`  schema-validity: ${(validSchema.length / (ok.length || 1) * 100).toFixed(1)}% (${validSchema.length}/${ok.length})`);
  console.log(`  field-accuracy trung bình: ${(acc * 100).toFixed(1)}%`);
  console.log(`  latency p50=${pct(lat, 0.5)}ms p90=${pct(lat, 0.9)}ms max=${Math.max(...lat)}ms`);
  console.log(`  cost tổng: $${cost.toFixed(4)} (avg $${(cost / (ok.length || 1)).toFixed(5)}/call)`);
  if (failed.length) console.log(`  lỗi: ${failed.map((f) => f.error).slice(0, 5).join(' | ')}`);
}

console.log('\n=== Theo nhóm (family) x model ===');
for (const family of families) {
  console.log(`\n-- ${family} --`);
  for (const model of models) {
    const rs = rows.filter((r) => r.model === model && r.family === family && r.ok);
    const validSchema = rs.filter((r) => r.schemaValid);
    const acc = mean(rs.map((r) => r.fieldAccuracy || 0));
    const lat = rs.map((r) => r.latencyMs);
    console.log(`  ${model}: schema=${(validSchema.length / (rs.length || 1) * 100).toFixed(0)}% acc=${(acc * 100).toFixed(0)}% latency-p50=${pct(lat, 0.5)}ms`);
  }
}

const totalCost = rows.reduce((a, r) => a + (r.costUsd || 0), 0);
console.log(`\n=== Tổng chi phí ước tính toàn bộ eval: $${totalCost.toFixed(3)} ===`);
