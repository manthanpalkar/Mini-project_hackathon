/**
 * LOOP — Progressive Concurrency & Performance Load Test Suite
 * 
 * Target: Authorized Local Test Backend (http://127.0.0.1:5055)
 * Database: Isolated Docker MongoDB (127.0.0.1:27018/loop_staging)
 * 
 * Stepping: 10 -> 50 -> 100 -> 250 -> 500 Concurrent Virtual Users
 * Auto-abort Circuit Breaker: Error Rate > 5% OR p99 Latency > 3000ms
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { monitorEventLoopDelay } = require('perf_hooks');

const TARGET_URL = 'http://127.0.0.1:5055';

// Read secret from .env.local.test
const envContent = fs.readFileSync(path.join(__dirname, '../.env.local.test'), 'utf8');
const jwtMatch = envContent.match(/JWT_SECRET=([^\r\n]+)/);
const JWT_SECRET = jwtMatch ? jwtMatch[1].trim() : 'dummy';

const testToken = jwt.sign(
  { email: 'perf_tester@spit.ac.in', role: 'Student', status: 'Active' },
  JWT_SECRET,
  { expiresIn: '2h' }
);

// High-capacity Keep-Alive HTTP Agent
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 600,
  maxFreeSockets: 100,
  timeout: 5000
});

function calculateStats(latencies) {
  if (!latencies || latencies.length === 0) {
    return { min: 0, p50: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    min: parseFloat(sorted[0].toFixed(2)),
    p50: parseFloat(sorted[Math.floor(sorted.length * 0.50)].toFixed(2)),
    p95: parseFloat(sorted[Math.floor(sorted.length * 0.95)].toFixed(2)),
    p99: parseFloat(sorted[Math.floor(sorted.length * 0.99) || sorted.length - 1].toFixed(2)),
    max: parseFloat(sorted[sorted.length - 1].toFixed(2)),
    avg: parseFloat((sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2))
  };
}

function executeRequest(urlPath) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, TARGET_URL);
    const start = process.hrtime();
    const req = http.request(url, {
      method: 'GET',
      agent,
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Accept': 'application/json',
        'Connection': 'keep-alive'
      },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const diff = process.hrtime(start);
        const durationMs = diff[0] * 1000 + diff[1] / 1e6;
        resolve({
          statusCode: res.statusCode,
          durationMs,
          success: res.statusCode >= 200 && res.statusCode < 400
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const diff = process.hrtime(start);
      resolve({
        statusCode: 408,
        durationMs: diff[0] * 1000 + diff[1] / 1e6,
        success: false,
        timeout: true
      });
    });

    req.on('error', (err) => {
      const diff = process.hrtime(start);
      resolve({
        statusCode: 0, // Client network/socket error (NOT a server HTTP response)
        clientError: err.code || err.message,
        durationMs: diff[0] * 1000 + diff[1] / 1e6,
        success: false,
        error: err.message
      });
    });

    req.end();
  });
}

async function runStep(concurrency, totalRequests, endpoint) {
  const eld = monitorEventLoopDelay({ resolution: 10 });
  eld.enable();

  const memBefore = process.memoryUsage();
  const cpuBefore = process.cpuUsage();
  const startTime = process.hrtime();

  const latencies = [];
  let successCount = 0;
  let failCount = 0;
  let timeoutCount = 0;
  let rateLimitedCount = 0;
  let serverErrorCount = 0;
  let clientSocketErrorCount = 0;
  const statusCodes = {};
  const clientErrors = {};

  let remaining = totalRequests;
  const worker = async () => {
    while (remaining > 0) {
      remaining--;
      const res = await executeRequest(endpoint);
      latencies.push(res.durationMs);
      if (res.statusCode > 0) {
        statusCodes[res.statusCode] = (statusCodes[res.statusCode] || 0) + 1;
      } else if (res.clientError) {
        clientErrors[res.clientError] = (clientErrors[res.clientError] || 0) + 1;
      }

      if (res.success) {
        successCount++;
      } else {
        failCount++;
        if (res.statusCode === 429) rateLimitedCount++;
        if (res.statusCode >= 500) serverErrorCount++;
        if (res.clientError) clientSocketErrorCount++;
        if (res.timeout) timeoutCount++;
      }
    }
  };

  const pool = [];
  for (let i = 0; i < concurrency; i++) {
    pool.push(worker());
  }
  await Promise.all(pool);

  eld.disable();
  const diffTime = process.hrtime(startTime);
  const durationSec = diffTime[0] + diffTime[1] / 1e9;
  const cpuDiff = process.cpuUsage(cpuBefore);
  const memAfter = process.memoryUsage();

  const rps = parseFloat((totalRequests / durationSec).toFixed(1));
  const stats = calculateStats(latencies);
  const errorRate = parseFloat(((failCount / totalRequests) * 100).toFixed(2));
  const serverErrorRate = parseFloat(((serverErrorCount / totalRequests) * 100).toFixed(2));

  return {
    concurrency,
    totalRequests,
    durationSec: parseFloat(durationSec.toFixed(3)),
    rps,
    successCount,
    failCount,
    rateLimitedCount,
    serverErrorCount,
    clientSocketErrorCount,
    timeoutCount,
    statusCodes,
    clientErrors,
    errorRate,
    serverErrorRate,
    latencies: stats,
    eventLoopDelayMs: {
      mean: parseFloat((eld.mean / 1e6).toFixed(2)),
      p50: parseFloat((eld.percentile(50) / 1e6).toFixed(2)),
      p95: parseFloat((eld.percentile(95) / 1e6).toFixed(2)),
      p99: parseFloat((eld.percentile(99) / 1e6).toFixed(2)),
      max: parseFloat((eld.max / 1e6).toFixed(2))
    },
    rssDeltaMB: parseFloat(((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2)),
    cpuUserMs: parseFloat((cpuDiff.user / 1000).toFixed(1)),
    cpuSystemMs: parseFloat((cpuDiff.system / 1000).toFixed(1))
  };
}

async function runProgressiveSuite() {
  console.log('========================================================================');
  console.log('  LOOP — Progressive Concurrency Benchmark (Target: http://127.0.0.1:5055)');
  console.log('========================================================================\n');

  // Ensure test user exists in loop_staging so token is active
  const mongoose = require('mongoose');
  await mongoose.connect('mongodb://127.0.0.1:27018/loop_staging');
  await mongoose.connection.db.collection('users').updateOne(
    { email: 'perf_tester@spit.ac.in' },
    { $set: { email: 'perf_tester@spit.ac.in', role: 'Student', status: 'Active', name: 'Perf Tester' } },
    { upsert: true }
  );
  await mongoose.disconnect();

  const endpoints = [
    { name: 'Health Endpoint (Edge/Node Baseline)', path: '/api/health' },
    { name: 'Folders Hierarchy (Cached Hierarchy)', path: '/api/folders' },
    { name: 'Resources Filtered Query (15k docs, compound index)', path: '/api/resources?folderId=system-placement-material&status=approved' }
  ];

  const concurrencies = [
    { vu: 10, reqs: 200 },
    { vu: 50, reqs: 500 },
    { vu: 100, reqs: 1000 },
    { vu: 250, reqs: 2000 },
    { vu: 500, reqs: 3000 }
  ];

  const overallResults = {};

  for (const ep of endpoints) {
    console.log(`\n>>> Testing Endpoint: ${ep.name} (${ep.path}) <<<`);
    overallResults[ep.name] = [];

    for (const step of concurrencies) {
      process.stdout.write(`  [VUs: ${String(step.vu).padStart(3)}] Firing ${step.reqs} requests ... `);
      const res = await runStep(step.vu, step.reqs, ep.path);
      overallResults[ep.name].push(res);

      console.log(`RPS: ${res.rps.toFixed(1).padStart(7)} | p50: ${res.latencies.p50}ms | p95: ${res.latencies.p95}ms | p99: ${res.latencies.p99}ms | Status: ${JSON.stringify(res.statusCodes)} | ClientErrors: ${JSON.stringify(res.clientErrors)} | Server5xx: ${res.serverErrorRate}% | Throttled429: ${res.rateLimitedCount}`);

      // Circuit Breaker (halts only on genuine application/database failures or catastrophic latency)
      if (res.serverErrorRate > 5.0 || res.latencies.p99 > 3000) {
        console.warn(`\n  ⚠ CIRCUIT BREAKER TRIGGERED: Server error rate (${res.serverErrorRate}%) or p99 latency (${res.latencies.p99}ms) exceeded safety threshold.`);
        console.warn(`  Halting higher concurrency steps for this endpoint to preserve host stability.`);
        break;
      }

      // 500ms cool-down between steps to allow socket reuse & garbage collection
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Save results to JSON for reporting
  fs.writeFileSync(
    path.join(__dirname, 'progressive_load_results.json'),
    JSON.stringify(overallResults, null, 2)
  );

  console.log('\n========================================================================');
  console.log('  PROGRESSIVE LOAD TEST COMPLETE — RESULTS RECORDED                     ');
  console.log('========================================================================');
}

runProgressiveSuite().catch(err => {
  console.error('Fatal load test error:', err);
  process.exit(1);
});
