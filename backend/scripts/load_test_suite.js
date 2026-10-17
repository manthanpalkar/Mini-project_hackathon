const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { monitorEventLoopDelay } = require('perf_hooks');
process.env.RATE_LIMIT_GLOBAL_MAX = process.env.RATE_LIMIT_GLOBAL_MAX || '100000';
process.env.RATE_LIMIT_LOGIN_MAX = process.env.RATE_LIMIT_LOGIN_MAX || '10000';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { app } = require('../server');

const TEST_PORT = parseInt(process.env.TEST_PORT || '5055', 10);
const TARGET_URL = process.env.LOAD_TEST_TARGET || `http://127.0.0.1:${TEST_PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'spit_loop_super_secret_jwt_key_2026';
const USE_KEEPALIVE = process.env.USE_KEEPALIVE !== 'false';

// Persistent HTTP Agent for realistic browser connection pooling
const httpAgent = new http.Agent({
  keepAlive: USE_KEEPALIVE,
  maxSockets: 200,
  maxFreeSockets: 50,
  timeout: 10000
});

// Synthetic Auth Token for realistic load testing
const testToken = jwt.sign(
  { email: 'junior.student@spit.ac.in', role: 'Student', status: 'Active' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function makeRequest(urlPath, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, TARGET_URL);
    const start = process.hrtime();
    const req = http.request(
      url,
      {
        method,
        agent: httpAgent,
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Connection': USE_KEEPALIVE ? 'keep-alive' : 'close',
          ...headers
        },
        timeout: 10000
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          const diff = process.hrtime(start);
          const durationMs = diff[0] * 1000 + diff[1] / 1e6;
          resolve({
            statusCode: res.statusCode,
            durationMs,
            bodyLength: raw.length,
            success: res.statusCode >= 200 && res.statusCode < 400,
            isTimeout: false,
            headers: res.headers
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      const diff = process.hrtime(start);
      resolve({
        statusCode: 408,
        durationMs: diff[0] * 1000 + diff[1] / 1e6,
        bodyLength: 0,
        success: false,
        isTimeout: true,
        error: 'Socket Timeout'
      });
    });

    req.on('error', (err) => {
      const diff = process.hrtime(start);
      resolve({
        statusCode: 500,
        durationMs: diff[0] * 1000 + diff[1] / 1e6,
        bodyLength: 0,
        success: false,
        isTimeout: false,
        error: err.message
      });
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function calculatePercentiles(latencies) {
  if (!latencies || latencies.length === 0) {
    return { min: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p90 = sorted[Math.floor(sorted.length * 0.90)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return {
    min: parseFloat(min.toFixed(2)),
    p50: parseFloat(p50.toFixed(2)),
    p90: parseFloat(p90.toFixed(2)),
    p95: parseFloat(p95.toFixed(2)),
    p99: parseFloat(p99.toFixed(2)),
    max: parseFloat(max.toFixed(2)),
    avg: parseFloat(avg.toFixed(2))
  };
}

async function runConcurrentBatch({
  scenarioName,
  urlPath,
  method = 'GET',
  headers = {},
  body = null,
  virtualUsers = 10,
  totalRequests = 100
}) {
  const latencies = [];
  let successful = 0;
  let failed = 0;
  let timeouts = 0;
  let statusCodes = {};

  // High-precision timing
  const startHr = process.hrtime();
  let remaining = totalRequests;

  const worker = async () => {
    while (remaining > 0) {
      remaining--;
      const res = await makeRequest(urlPath, method, headers, body);
      latencies.push(res.durationMs);
      statusCodes[res.statusCode] = (statusCodes[res.statusCode] || 0) + 1;
      if (res.isTimeout) timeouts++;
      if (res.success) successful++;
      else failed++;
    }
  };

  const pool = [];
  for (let i = 0; i < virtualUsers; i++) {
    pool.push(worker());
  }
  await Promise.all(pool);

  const diffHr = process.hrtime(startHr);
  const durationSec = diffHr[0] + diffHr[1] / 1e9;
  const rps = durationSec > 0 ? parseFloat((totalRequests / durationSec).toFixed(1)) : 0;
  const stats = calculatePercentiles(latencies);

  return {
    scenario: scenarioName,
    endpoint: urlPath,
    virtualUsers,
    totalRequests,
    durationSec: parseFloat(durationSec.toFixed(3)),
    rps,
    successful,
    failed,
    timeouts,
    statusCodes,
    stats
  };
}

function getMemoryProfile() {
  const mem = process.memoryUsage();
  return {
    rssMB: parseFloat((mem.rss / 1024 / 1024).toFixed(2)),
    heapUsedMB: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2)),
    heapTotalMB: parseFloat((mem.heapTotal / 1024 / 1024).toFixed(2)),
    externalMB: parseFloat((mem.external / 1024 / 1024).toFixed(2))
  };
}

async function runTestSuite() {
  console.log('===================================================================');
  console.log('  LOOP — High-Precision Performance & Concurrency Load Test Suite  ');
  console.log('===================================================================');

  let testServer = null;
  const isLocal = TARGET_URL.includes('127.0.0.1') || TARGET_URL.includes('localhost');

  if (isLocal) {
    testServer = http.createServer(app);
    await new Promise(resolve => testServer.listen(TEST_PORT, resolve));
    console.log(`[LoadTest] Local ephemeral test server active on port ${TEST_PORT}`);

    if (mongoose.connection.readyState !== 1) {
      console.log('[LoadTest] Connecting to MongoDB Atlas...');
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    }
    console.log('[LoadTest] Database connected successfully.');
  } else {
    console.log(`[LoadTest] Running against remote target: ${TARGET_URL}`);
  }

  // Continuous Event Loop Delay Monitor
  const loopHistogram = monitorEventLoopDelay({ resolution: 20 });
  loopHistogram.enable();

  const memInitial = getMemoryProfile();
  const results = {
    target: TARGET_URL,
    keepAliveEnabled: USE_KEEPALIVE,
    memInitial,
    phases: {}
  };

  // --- PHASE 1: Baseline Latencies (Single Request with Warm-Up) ---
  console.log('\n--- PHASE 1: Baseline Single-Request Latencies ---');
  const baselineEndpoints = [
    { name: 'Health Probe', path: '/health' },
    { name: 'Stories Listing', path: '/api/stories' },
    { name: 'Achievements Listing', path: '/api/achievements' },
    { name: 'Folders Listing', path: '/api/folders' },
    { name: 'Resources Listing', path: '/api/resources' }
  ];

  results.phases.baselines = [];
  for (const ep of baselineEndpoints) {
    const runs = [];
    for (let r = 0; r < 5; r++) {
      const res = await makeRequest(ep.path);
      runs.push(res.durationMs);
    }
    const stats = calculatePercentiles(runs);
    console.log(`  ${ep.name.padEnd(22)} (${ep.path.padEnd(17)}): p50=${stats.p50}ms | avg=${stats.avg}ms | min=${stats.min}ms | max=${stats.max}ms`);
    results.phases.baselines.push({ name: ep.name, path: ep.path, stats });
  }

  // --- PHASE 2: Concurrency Ramp-Up on Stories (/api/stories) ---
  console.log('\n--- PHASE 2: Concurrency Ramp-Up on Stories (/api/stories) ---');
  results.phases.rampUpStories = [];
  const rampSteps = [
    { virtualUsers: 5, totalRequests: 50 },
    { virtualUsers: 15, totalRequests: 150 },
    { virtualUsers: 30, totalRequests: 300 },
    { virtualUsers: 60, totalRequests: 600 }
  ];
  for (const step of rampSteps) {
    const res = await runConcurrentBatch({
      scenarioName: `Ramp-Up VUs ${step.virtualUsers}`,
      urlPath: '/api/stories',
      virtualUsers: step.virtualUsers,
      totalRequests: step.totalRequests
    });
    console.log(`  [VUs: ${String(res.virtualUsers).padStart(2)} | Reqs: ${String(res.totalRequests).padStart(3)}] Throughput: ${String(res.rps).padStart(7)} RPS | p50: ${String(res.stats.p50).padStart(5)}ms | p90: ${String(res.stats.p90).padStart(5)}ms | p95: ${String(res.stats.p95).padStart(5)}ms | p99: ${String(res.stats.p99).padStart(5)}ms | Fail: ${res.failed}`);
    results.phases.rampUpStories.push(res);
  }

  // --- PHASE 3: Read Burst on Achievements (/api/achievements) ---
  console.log('\n--- PHASE 3: High-Concurrency Read Burst on Achievements ---');
  const burstAch = await runConcurrentBatch({
    scenarioName: 'Achievements Burst',
    urlPath: '/api/achievements',
    virtualUsers: 50,
    totalRequests: 500
  });
  console.log(`  [VUs: 50 | Reqs: 500] Throughput: ${burstAch.rps} RPS | p50: ${burstAch.stats.p50}ms | p95: ${burstAch.stats.p95}ms | p99: ${burstAch.stats.p99}ms | Statuses: ${JSON.stringify(burstAch.statusCodes)}`);
  results.phases.burstAchievements = burstAch;

  // --- PHASE 4: Public Folders Hierarchy Read Load (/api/folders) ---
  console.log('\n--- PHASE 4: Public Folders Hierarchy Read Load ---');
  const foldersLoad = await runConcurrentBatch({
    scenarioName: 'Folders Hierarchy Load',
    urlPath: '/api/folders',
    virtualUsers: 30,
    totalRequests: 300
  });
  console.log(`  [VUs: 30 | Reqs: 300] Throughput: ${foldersLoad.rps} RPS | p50: ${foldersLoad.stats.p50}ms | p95: ${foldersLoad.stats.p95}ms | p99: ${foldersLoad.stats.p99}ms | Statuses: ${JSON.stringify(foldersLoad.statusCodes)}`);
  results.phases.foldersLoad = foldersLoad;

  // --- PHASE 5: CPU-Bound Authentication Login (/api/users/login) ---
  console.log('\n--- PHASE 5: CPU-Bound Authentication Login (Bcrypt Stress) ---');
  const loginLoad = await runConcurrentBatch({
    scenarioName: 'Bcrypt Login Stress',
    urlPath: '/api/users/login',
    method: 'POST',
    body: {
      identifier: 'swapnil.patil@spit.ac.in',
      password: 'wrong_password_to_force_hash_eval'
    },
    virtualUsers: 10,
    totalRequests: 40
  });
  console.log(`  [VUs: 10 | Reqs:  40] Throughput: ${loginLoad.rps} RPS | p50: ${loginLoad.stats.p50}ms | p95: ${loginLoad.stats.p95}ms | Statuses: ${JSON.stringify(loginLoad.statusCodes)}`);
  results.phases.loginLoad = loginLoad;

  // --- PHASE 6: Health Probe Saturation (/health) ---
  console.log('\n--- PHASE 6: Health Probe Saturation Throughput ---');
  const healthLoad = await runConcurrentBatch({
    scenarioName: 'Health Saturation',
    urlPath: '/health',
    virtualUsers: 50,
    totalRequests: 1000
  });
  console.log(`  [VUs: 50 | Reqs: 1000] Throughput: ${healthLoad.rps} RPS | p50: ${healthLoad.stats.p50}ms | p95: ${healthLoad.stats.p95}ms | p99: ${healthLoad.stats.p99}ms | Success: ${healthLoad.successful}/${healthLoad.totalRequests}`);
  results.phases.healthThroughput = healthLoad;

  // --- PHASE 7: Resource Profiling & Event Loop Lag Analysis ---
  loopHistogram.disable();
  const memFinal = getMemoryProfile();
  const eventLoopStats = {
    p50Ms: parseFloat((loopHistogram.percentile(50) / 1e6).toFixed(2)),
    p90Ms: parseFloat((loopHistogram.percentile(90) / 1e6).toFixed(2)),
    p95Ms: parseFloat((loopHistogram.percentile(95) / 1e6).toFixed(2)),
    p99Ms: parseFloat((loopHistogram.percentile(99) / 1e6).toFixed(2)),
    maxMs: parseFloat((loopHistogram.max / 1e6).toFixed(2))
  };

  console.log('\n--- PHASE 7: System Resource & Event-Loop Under Peak Load ---');
  console.log(`  Initial RSS:       ${memInitial.rssMB} MB  |  Initial Heap: ${memInitial.heapUsedMB} MB`);
  console.log(`  Peak Final RSS:    ${memFinal.rssMB} MB  |  Final Heap:   ${memFinal.heapUsedMB} MB`);
  console.log(`  Net RSS Delta:     +${(memFinal.rssMB - memInitial.rssMB).toFixed(2)} MB  |  Heap Delta: +${(memFinal.heapUsedMB - memInitial.heapUsedMB).toFixed(2)} MB`);
  console.log(`  Event Loop p50:    ${eventLoopStats.p50Ms} ms`);
  console.log(`  Event Loop p95:    ${eventLoopStats.p95Ms} ms`);
  console.log(`  Event Loop p99:    ${eventLoopStats.p99Ms} ms`);
  console.log(`  Event Loop Max:    ${eventLoopStats.maxMs} ms`);

  results.systemResources = {
    memInitial,
    memFinal,
    rssDeltaMB: parseFloat((memFinal.rssMB - memInitial.rssMB).toFixed(2)),
    heapDeltaMB: parseFloat((memFinal.heapUsedMB - memInitial.heapUsedMB).toFixed(2)),
    eventLoopLag: eventLoopStats
  };

  if (testServer) {
    httpAgent.destroy();
    await new Promise(resolve => testServer.close(resolve));
    console.log('\n[LoadTest] Ephemeral test server shut down cleanly.');
  }

  console.log('\n=== COMPLETE LOAD TEST RESULTS JSON ===');
  console.log(JSON.stringify(results, null, 2));
  console.log('=== END LOAD TEST RESULTS ===');

  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('[LoadTest] Fatal Error:', err);
  process.exit(1);
});
