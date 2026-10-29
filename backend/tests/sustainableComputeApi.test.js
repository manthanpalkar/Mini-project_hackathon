const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const computingRoutes = require('../modules/moduleC_sustainableComputing/routes/computingRoutes');

describe('Module C REST API Test Suite', () => {
  let app;
  let server;
  let baseUrl;

  before(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/modules/c', computingRoutes);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('GET /api/modules/c/health returns 200 OK with observatory capabilities', async () => {
    const res = await fetch(`${baseUrl}/api/modules/c/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ready');
    assert.ok(data.capabilities.includes('deterministic_simulation'));
  });

  test('GET /api/modules/c/services returns 3 distinct services with power models', async () => {
    const res = await fetch(`${baseUrl}/api/modules/c/services`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.count, 3);
    const ids = body.data.map(s => s.id);
    assert.ok(ids.includes('campus_api'));
    assert.ok(ids.includes('analytics_worker'));
    assert.ok(ids.includes('media_processor'));
  });

  test('GET /api/modules/c/assumptions returns documented formulas and disclosures', async () => {
    const res = await fetch(`${baseUrl}/api/modules/c/assumptions`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.powerFormula.includes('P_idle'));
    assert.ok(body.data.energyFormula.includes('3,600,000'));
    assert.ok(body.data.carbonFormula.includes('grid_intensity'));
    assert.ok(body.data.disclaimer.includes('SIMULATED DATA'));
  });

  test('POST /api/modules/c/simulations rejects invalid duration bounds with 400', async () => {
    const res = await fetch(`${baseUrl}/api/modules/c/simulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds: 5 }) // below min 10
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('durationSeconds'));
  });

  test('POST /api/modules/c/simulations rejects invalid workload intensity with 400', async () => {
    const res = await fetch(`${baseUrl}/api/modules/c/simulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workloadIntensity: 'ultra_mega' })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('workloadIntensity'));
  });

  test('POST /api/modules/c/simulations rejects invalid grid carbon intensity with 400', async () => {
    const res = await fetch(`${baseUrl}/api/modules/c/simulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gridCarbonIntensity: -1.5 })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('gridCarbonIntensity'));
  });

  test('POST /api/modules/c/simulations executes successfully and returns complete comparisons', async () => {
    const res = await fetch(`${baseUrl}/api/modules/c/simulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed: 42,
        durationSeconds: 120,
        workloadIntensity: 'medium',
        gridCarbonIntensity: 0.708
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.runId.startsWith('sim_'));
    assert.strictEqual(body.serviceResults.length, 3);
    assert.ok(body.aggregate.energySavedKwh > 0);
    assert.ok(body.aggregate.carbonSavedKg > 0);
  });

  test('GET /api/modules/c/metrics returns observatory summary stats', async () => {
    const res = await fetch(`${baseUrl}/api/modules/c/metrics`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.totalEnergySavedKwh > 0);
    assert.ok(body.data.totalCarbonSavedKg > 0);
  });
});
