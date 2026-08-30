#!/usr/bin/env node
'use strict';

// G1.8 — Perf baseline (04-ROADMAP.md): "harness assert DB_CLIENT===mysql; profile 1/5/10/20/50,
// warm-up + sustained, mix read/write/report/file; artifact ghi engine/SHA/topology/CPU-RAM/pool/
// cardinality; thu p50/p95/p99, throughput, error, event-loop lag p99. Không block refactor."
//
// Đây là công cụ ĐO, không phải cổng pass/fail — không kết luận "đạt/không đạt" ở bước này (đúng
// Evidence Contract G1.8: "artifact bắt buộc, không kết luận pass ở bước này"). Kết luận PASS/FAIL
// thật thuộc W2.3 (acceptance SLO), nơi DevOps chốt ngưỡng/topology/peak — script này chỉ tạo số
// đo trung thực để W2.3 tham chiếu.
//
// BẮT BUỘC DB_CLIENT=mysql (F1-01-audit-findings.md#F7): server/mysql-sync.js dùng Atomics.wait
// trên MAIN THREAD cho mọi query MySQL — đường SQLite (node:sqlite) không đi qua Atomics nên đo
// trên SQLite sẽ cho số liệu sai lệch hoàn toàn không đại diện cho production (server/db.js:16-18).

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`perf-baseline: ${message}`);
  process.exit(1);
}

if (String(process.env.DB_CLIENT || '').toLowerCase() !== 'mysql') {
  fail('BẮT BUỘC DB_CLIENT=mysql — đường SQLite không đi qua Atomics.wait (F7), số đo không đại diện. Chạy: DB_CLIENT=mysql ALLOW_TEST_DB_CREATE=1 node scripts/perf-baseline.mjs');
}
if (process.env.ALLOW_TEST_DB_CREATE !== '1') {
  fail('cần ALLOW_TEST_DB_CREATE=1 để tạo database MySQL tạm — khớp chốt fail-closed hiện có ở server/test-support/db-harness.js.');
}

const CONCURRENCY_LEVELS = String(process.env.PERF_LEVELS || '1,5,10,20,50')
  .split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
const WARMUP_MS = Number(process.env.PERF_WARMUP_MS || 3000);
const SUSTAIN_MS = Number(process.env.PERF_SUSTAIN_MS || 8000);
const SEED_ORGS = Number(process.env.PERF_SEED_ORGS || 50);
const SEED_PEOPLE_PER_ORG = Number(process.env.PERF_SEED_PEOPLE_PER_ORG || 4);
const SEED_INTERACTIONS = Number(process.env.PERF_SEED_INTERACTIONS || 500);

// Mix read/write/report/file theo đúng yêu cầu roadmap — tỉ trọng mô phỏng tải thật (đọc danh sách
// nhiều nhất, ghi/report/file ít hơn), không phải benchmark riêng lẻ từng loại.
function buildWorkload({ baseUrl, cookie, peopleIds, attachmentId }) {
  const headers = { cookie, 'content-type': 'application/json' };
  const categories = [
    {
      name: 'read', weight: 55,
      run: async () => {
        const page = 1 + Math.floor(Math.random() * 10);
        const res = await fetch(`${baseUrl}/api/people?page=${page}&pageSize=20`, { headers });
        return res.ok;
      },
    },
    {
      name: 'write', weight: 15,
      run: async () => {
        const personId = peopleIds[Math.floor(Math.random() * peopleIds.length)];
        const res = await fetch(`${baseUrl}/api/interactions`, {
          method: 'POST', headers,
          body: JSON.stringify({ partner_type: 'person', partner_id: personId, date: '2026-08-30', channel: 'email', summary: 'perf-baseline write' }),
        });
        return res.ok;
      },
    },
    {
      name: 'report', weight: 20,
      run: async () => {
        const res = await fetch(`${baseUrl}/api/reports`, { headers });
        return res.ok;
      },
    },
    {
      name: 'file', weight: 10,
      run: async () => {
        const res = await fetch(`${baseUrl}/api/files/${attachmentId}`, { headers });
        return res.ok;
      },
    },
  ];
  const total = categories.reduce((s, c) => s + c.weight, 0);
  return { categories, total };
}

function pickCategory(workload) {
  let r = Math.random() * workload.total;
  for (const c of workload.categories) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return workload.categories[workload.categories.length - 1];
}

function percentile(sortedMs, p) {
  if (!sortedMs.length) return null;
  const idx = Math.min(sortedMs.length - 1, Math.max(0, Math.ceil((p / 100) * sortedMs.length) - 1));
  return Math.round(sortedMs[idx] * 100) / 100;
}

async function runPhase(workload, concurrency, durationMs, { record }) {
  const endAt = performance.now() + durationMs;
  const workers = Array.from({ length: concurrency }, async () => {
    while (performance.now() < endAt) {
      const category = pickCategory(workload);
      const t0 = performance.now();
      let ok = false;
      try {
        ok = await category.run();
      } catch {
        ok = false;
      }
      const elapsed = performance.now() - t0;
      if (record) record(category.name, elapsed, ok);
    }
  });
  await Promise.all(workers);
}

function seedData(db, { orgs, peoplePerOrg, interactions }) {
  const orgTypes = ['press', 'association', 'gov', 'other'];
  const insOrg = db.prepare('INSERT INTO organizations (name, org_type) VALUES (?,?)');
  const orgIds = [];
  for (let i = 0; i < orgs; i += 1) {
    const r = insOrg.run(`Perf Org ${i}`, orgTypes[i % orgTypes.length]);
    orgIds.push(Number(r.lastInsertRowid));
  }

  const insPerson = db.prepare('INSERT INTO people (org_id, full_name, relationship_score, status) VALUES (?,?,?,?)');
  const peopleIds = [];
  for (const orgId of orgIds) {
    for (let j = 0; j < peoplePerOrg; j += 1) {
      const r = insPerson.run(orgId, `Perf Person ${orgId}-${j}`, (orgId + j) % 100, 'Đang hợp tác');
      peopleIds.push(Number(r.lastInsertRowid));
    }
  }

  const insInteraction = db.prepare(
    "INSERT INTO interactions (partner_type, partner_id, partner_name, date, channel, summary) VALUES ('person',?,?,?,?,?)"
  );
  for (let k = 0; k < interactions; k += 1) {
    const personId = peopleIds[k % peopleIds.length];
    const day = 1 + (k % 27);
    const month = 1 + (Math.floor(k / 27) % 12);
    insInteraction.run(personId, `Perf Person ${personId}`, `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, 'email', `Perf interaction ${k}`);
  }

  const { UPLOAD_DIR } = require(path.join(root, 'server/db.js'));
  const filename = `perf-baseline-${Date.now()}.txt`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), 'perf baseline dummy file content\n'.repeat(200));
  const insAttachment = db.prepare(
    "INSERT INTO attachments (owner_type, owner_id, kind, filename, original_name, mime) VALUES ('person',?,?,?,?,?)"
  );
  const attResult = insAttachment.run(peopleIds[0], 'portrait', filename, filename, 'text/plain');

  return {
    cardinality: { organizations: orgIds.length, people: peopleIds.length, interactions, attachments: 1 },
    peopleIds,
    attachmentId: Number(attResult.lastInsertRowid),
  };
}

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'UNVERIFIED (git rev-parse thất bại)';
  }
}

async function main() {
  const dbHarness = require(path.join(root, 'server/test-support/db-harness.js'));
  const { createResourceStack } = require(path.join(root, 'server/test-support/resource-stack.js'));
  const resources = createResourceStack();

  // Đúng pattern acquire-trước-khi-tạo (server/test/integration-ai.test.js): setupTestDataDir()
  // PHẢI acquire trước createMysqlTestDb(), để UPLOAD_DIR (server/db.js: DATA_DIR/uploads) trỏ vào
  // thư mục tạm thay vì data/uploads/ thật của repo — Codex phát hiện bản trước rò 4 file dummy
  // thật vào đây vì thiếu bước này (quarantine tại data/uploads/.quarantine-perf-baseline-leak/).
  resources.acquire(dbHarness.setupTestDataDir().teardown);
  const dbName = await dbHarness.createMysqlTestDb();
  resources.acquire(() => dbHarness.dropMysqlTestDb(dbName));

  try {
    const dbModule = require(path.join(root, 'server/db.js'));
    const { db } = dbModule;
    resources.acquire(dbModule.closeDb);
    const { createApp } = require(path.join(root, 'server/app.js'));
    const fixtures = require(path.join(root, 'server/test-support/fixtures.js'));
    const { startTestApp } = require(path.join(root, 'server/test-support/app-harness.js'));

    console.log(`Database test tạm: ${dbName}`);
    console.log('Seeding dữ liệu perf baseline...');
    const { cardinality, peopleIds, attachmentId } = seedData(db, {
      orgs: SEED_ORGS, peoplePerOrg: SEED_PEOPLE_PER_ORG, interactions: SEED_INTERACTIONS,
    });
    console.log(`Cardinality: ${JSON.stringify(cardinality)}`);

    const user = fixtures.createPrivilegedUser({ username: `perf_baseline_${Date.now()}` });
    const started = await startTestApp(createApp());
    resources.acquire(started.close);
    const { baseUrl } = started;
    const { cookie } = await fixtures.login(baseUrl, user);

    const workload = buildWorkload({ baseUrl, cookie, peopleIds, attachmentId });

    const histogram = monitorEventLoopDelay({ resolution: 10 });
    histogram.enable();

    const results = [];
    for (const concurrency of CONCURRENCY_LEVELS) {
      console.log(`\n== concurrency=${concurrency} ==`);
      histogram.reset();
      console.log(`  warm-up ${WARMUP_MS}ms...`);
      await runPhase(workload, concurrency, WARMUP_MS, { record: null });

      histogram.reset();
      const latenciesByCategory = new Map(workload.categories.map((c) => [c.name, []]));
      let okCount = 0;
      let errCount = 0;
      const sustainStart = performance.now();
      await runPhase(workload, concurrency, SUSTAIN_MS, {
        record: (name, elapsedMs, ok) => {
          latenciesByCategory.get(name).push(elapsedMs);
          if (ok) okCount += 1; else errCount += 1;
        },
      });
      const sustainElapsedMs = performance.now() - sustainStart;

      const allLatencies = [...latenciesByCategory.values()].flat().sort((a, b) => a - b);
      const total = okCount + errCount;
      const byCategory = {};
      for (const [name, arr] of latenciesByCategory) {
        const sorted = [...arr].sort((a, b) => a - b);
        byCategory[name] = { count: sorted.length, p50Ms: percentile(sorted, 50), p95Ms: percentile(sorted, 95), p99Ms: percentile(sorted, 99) };
      }

      const levelResult = {
        concurrency,
        durationMs: Math.round(sustainElapsedMs),
        totalRequests: total,
        throughputRps: total > 0 ? Math.round((total / (sustainElapsedMs / 1000)) * 100) / 100 : 0,
        errorRate: total > 0 ? Math.round((errCount / total) * 10000) / 10000 : 0,
        latency: { p50Ms: percentile(allLatencies, 50), p95Ms: percentile(allLatencies, 95), p99Ms: percentile(allLatencies, 99) },
        byCategory,
        eventLoopLag: {
          p50Ms: Math.round((histogram.percentile(50) / 1e6) * 100) / 100,
          p99Ms: Math.round((histogram.percentile(99) / 1e6) * 100) / 100,
          maxMs: Math.round((histogram.max / 1e6) * 100) / 100,
        },
      };
      results.push(levelResult);
      console.log(`  requests=${total} throughput=${levelResult.throughputRps}rps errorRate=${levelResult.errorRate} p50=${levelResult.latency.p50Ms}ms p95=${levelResult.latency.p95Ms}ms p99=${levelResult.latency.p99Ms}ms eventLoopLagP99=${levelResult.eventLoopLag.p99Ms}ms`);
    }

    histogram.disable();

    const artifact = {
      generatedAt: new Date().toISOString(),
      gitSha: gitSha(),
      engine: {
        dbClient: 'mysql',
        note: 'server/mysql-sync.js: mọi query MySQL đi qua Atomics.wait trên main thread (F7) — không phải async driver thường.',
      },
      pool: {
        note: 'server/mysql-worker.js:25 dùng mysql.createConnection() — ĐÚNG 1 connection duy nhất trong worker thread, KHÔNG phải connection pool. Mọi query serialize qua đúng 1 connection này, cộng thêm Atomics.wait chặn main thread khi chờ kết quả.',
      },
      topology: {
        note: 'Đo trên 1 instance local Docker Compose (docker-compose.yml, MySQL 8.4) — KHÔNG đại diện Cloud Run multi-replica/production. Ngưỡng SLO + topology production do DevOps chốt ở W2.3, không tự suy ra từ số đo này.',
        mysqlImage: 'mysql:8.4 (docker-compose.yml)',
      },
      hardware: {
        cpuCount: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'UNVERIFIED',
        totalMemGB: Math.round((os.totalmem() / 1024 / 1024 / 1024) * 100) / 100,
        platform: `${os.platform()} ${os.release()}`,
      },
      cardinality,
      workloadMix: workload.categories.map((c) => ({ name: c.name, weightPercent: c.weight })),
      warmupMs: WARMUP_MS,
      sustainMs: SUSTAIN_MS,
      results,
    };

    const outDir = path.join(root, 'memory-bank', 'perf-baseline');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${artifact.generatedAt.replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
    console.log(`\nArtifact: ${path.relative(root, outPath)}`);
  } finally {
    // resources.cleanupAll() dọn đúng thứ tự LIFO (đóng HTTP -> đóng worker MySQL -> drop DB tạm
    // -> dọn DATA_DIR) và KHÔNG nuốt lỗi (Codex re-audit): nếu bất kỳ bước dọn nào thất bại,
    // AggregateError ném ra để script exit khác 0 thay vì báo "đã dọn sạch" giả.
    await resources.cleanupAll();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
