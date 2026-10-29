const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  sustainableComputeInstance,
  SeededRandom
} = require('../modules/moduleC_sustainableComputing/services/sustainableComputeService');

describe('Module C Deterministic Simulation Engine Test Suite', () => {
  describe('1. Seeded PRNG Reproducibility', () => {
    test('same numeric seed produces identical pseudorandom float sequence', () => {
      const prng1 = new SeededRandom(12345);
      const prng2 = new SeededRandom(12345);

      const seq1 = Array.from({ length: 10 }, () => prng1.nextFloat());
      const seq2 = Array.from({ length: 10 }, () => prng2.nextFloat());

      assert.deepStrictEqual(seq1, seq2);
    });

    test('same string seed produces identical pseudorandom sequence', () => {
      const prng1 = new SeededRandom('spit-hackathon-2026');
      const prng2 = new SeededRandom('spit-hackathon-2026');

      assert.strictEqual(prng1.nextInt(1, 100), prng2.nextInt(1, 100));
      assert.strictEqual(prng1.nextFloat(), prng2.nextFloat());
    });

    test('different seeds produce different sequences', () => {
      const prng1 = new SeededRandom(101);
      const prng2 = new SeededRandom(999);

      assert.notStrictEqual(prng1.nextFloat(), prng2.nextFloat());
    });
  });

  describe('2. End-to-End Simulation Determinism', () => {
    test('identical config and seed produces 100% identical results', () => {
      const config = {
        seed: 42,
        durationSeconds: 300,
        workloadIntensity: 'medium',
        gridCarbonIntensity: 0.708,
        selectedServices: ['campus_api', 'analytics_worker', 'media_processor']
      };

      const run1 = sustainableComputeInstance.runSimulation(config);
      const run2 = sustainableComputeInstance.runSimulation(config);

      // Verify aggregate metrics are identical
      assert.deepStrictEqual(run1.aggregate, run2.aggregate);

      // Verify each service's baseline & optimized metrics are identical
      assert.strictEqual(run1.serviceResults.length, run2.serviceResults.length);
      for (let i = 0; i < run1.serviceResults.length; i++) {
        const s1 = run1.serviceResults[i];
        const s2 = run2.serviceResults[i];
        assert.strictEqual(s1.serviceId, s2.serviceId);
        assert.deepStrictEqual(s1.baseline, s2.baseline);
        assert.deepStrictEqual(s1.optimized, s2.optimized);
        assert.deepStrictEqual(s1.comparison, s2.comparison);
      }
    });

    test('different seed produces a different valid simulation result', () => {
      const runA = sustainableComputeInstance.runSimulation({ seed: 100, durationSeconds: 120 });
      const runB = sustainableComputeInstance.runSimulation({ seed: 200, durationSeconds: 120 });

      // Total logical workload is consistent for the same duration/intensity
      assert.strictEqual(runA.aggregate.totalLogicalItems, runB.aggregate.totalLogicalItems);

      // But simulated random latency / outcomes differ
      assert.notStrictEqual(
        runA.serviceResults[0].baseline.avgLatencyMs,
        runB.serviceResults[0].baseline.avgLatencyMs
      );
    });
  });

  describe('3. Workload Fairness & Semantics Preservation', () => {
    test('baseline and optimized scenarios process equivalent logical item counts', () => {
      const result = sustainableComputeInstance.runSimulation({
        seed: 777,
        durationSeconds: 180,
        workloadIntensity: 'high'
      });

      for (const service of result.serviceResults) {
        assert.strictEqual(
          service.baseline.itemsSubmitted,
          service.optimized.itemsSubmitted,
          `Service ${service.serviceId} itemsSubmitted must match between baseline and optimized`
        );
        assert.strictEqual(
          service.logicalItemsCount,
          service.baseline.itemsSubmitted
        );
      }
    });

    test('Campus API caching delivers lower average latency and energy savings', () => {
      const result = sustainableComputeInstance.runSimulation({ seed: 55 });
      const api = result.serviceResults.find(s => s.serviceId === 'campus_api');

      assert.ok(api, 'Campus API must be present');
      assert.ok(api.optimized.avgLatencyMs < api.baseline.avgLatencyMs, 'Optimized latency must be lower due to cache hits');
      assert.ok(api.optimized.energyKwh < api.baseline.energyKwh, 'Optimized energy must be lower');
      assert.ok(api.comparison.energy.percentReduction > 20, 'Caching should yield substantial power reduction');
    });

    test('Analytics Worker batching preserves total items and reduces scheduler overhead', () => {
      const result = sustainableComputeInstance.runSimulation({ seed: 88 });
      const worker = result.serviceResults.find(s => s.serviceId === 'analytics_worker');

      assert.ok(worker, 'Analytics Worker must be present');
      assert.strictEqual(worker.baseline.itemsSubmitted, worker.optimized.itemsSubmitted);
      assert.ok(worker.optimized.energyKwh < worker.baseline.energyKwh);
    });

    test('Media Processing Worker vectorized pipeline delivers compute duration reduction', () => {
      const result = sustainableComputeInstance.runSimulation({ seed: 99 });
      const media = result.serviceResults.find(s => s.serviceId === 'media_processor');

      assert.ok(media, 'Media Processor must be present');
      assert.ok(media.optimized.avgLatencyMs < media.baseline.avgLatencyMs);
      assert.ok(media.optimized.energyKwh < media.baseline.energyKwh);
      assert.ok(media.optimized.carbonKg < media.baseline.carbonKg);
    });
  });

  describe('4. Aggregate Sustainability Metrics Integrity', () => {
    test('aggregate baseline and optimized energy equals the sum of service energies', () => {
      const result = sustainableComputeInstance.runSimulation({ seed: 333, durationSeconds: 600 });

      let sumBaselineEnergy = 0;
      let sumOptimizedEnergy = 0;
      let sumBaselineCarbon = 0;
      let sumOptimizedCarbon = 0;

      for (const s of result.serviceResults) {
        sumBaselineEnergy += s.baseline.energyKwh;
        sumOptimizedEnergy += s.optimized.energyKwh;
        sumBaselineCarbon += s.baseline.carbonKg;
        sumOptimizedCarbon += s.optimized.carbonKg;
      }

      // Rounded to 4 decimals to avoid float precision drift
      assert.strictEqual(
        Math.round(result.aggregate.baselineEnergyKwh * 10000) / 10000,
        Math.round(sumBaselineEnergy * 10000) / 10000
      );
      assert.strictEqual(
        Math.round(result.aggregate.optimizedEnergyKwh * 10000) / 10000,
        Math.round(sumOptimizedEnergy * 10000) / 10000
      );
      assert.strictEqual(
        Math.round(result.aggregate.baselineCarbonKg * 10000) / 10000,
        Math.round(sumBaselineCarbon * 10000) / 10000
      );
      assert.strictEqual(
        Math.round(result.aggregate.optimizedCarbonKg * 10000) / 10000,
        Math.round(sumOptimizedCarbon * 10000) / 10000
      );
    });
  });
});
