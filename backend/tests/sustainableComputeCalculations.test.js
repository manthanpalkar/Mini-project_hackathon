const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  calculateAveragePowerWatts,
  calculateEnergyKwh,
  calculateCarbonKg,
  calculateP95,
  compareMetrics,
  DEFAULT_GRID_CARBON_INTENSITY
} = require('../modules/moduleC_sustainableComputing/services/sustainableComputeService');

describe('Module C Sustainability Calculations Test Suite', () => {
  describe('1. calculateAveragePowerWatts', () => {
    test('computes average power correctly with 0% utilization (idle)', () => {
      const power = calculateAveragePowerWatts(50, 150, 0);
      assert.strictEqual(power, 50);
    });

    test('computes average power correctly with 100% utilization (max)', () => {
      const power = calculateAveragePowerWatts(50, 150, 1.0);
      assert.strictEqual(power, 150);
    });

    test('computes average power correctly with 50% utilization', () => {
      // 50 + 0.5 * (150 - 50) = 100
      const power = calculateAveragePowerWatts(50, 150, 0.5);
      assert.strictEqual(power, 100);
    });

    test('clamps utilization between 0 and 1', () => {
      assert.strictEqual(calculateAveragePowerWatts(50, 150, -0.2), 50);
      assert.strictEqual(calculateAveragePowerWatts(50, 150, 1.5), 150);
    });

    test('rejects negative idle power', () => {
      assert.throws(() => {
        calculateAveragePowerWatts(-10, 100, 0.5);
      }, /idlePowerWatts must be non-negative/);
    });

    test('rejects max power lower than idle power', () => {
      assert.throws(() => {
        calculateAveragePowerWatts(100, 80, 0.5);
      }, /maxPowerWatts must be greater than or equal to idlePowerWatts/);
    });
  });

  describe('2. calculateEnergyKwh', () => {
    test('computes 1 kWh correctly: 1000W running for 3600 seconds', () => {
      // (1000 * 3600) / 3,600,000 = 1.0 kWh
      const kwh = calculateEnergyKwh(1000, 3600);
      assert.strictEqual(kwh, 1.0);
    });

    test('computes fractional energy correctly: 100W running for 300 seconds', () => {
      // (100 * 300) / 3,600,000 = 30,000 / 3,600,000 = 0.008333 kWh
      const kwh = calculateEnergyKwh(100, 300);
      assert.strictEqual(kwh, 0.008333);
    });

    test('returns 0 for 0 seconds duration', () => {
      assert.strictEqual(calculateEnergyKwh(250, 0), 0);
    });

    test('returns 0 for negative duration or power', () => {
      assert.strictEqual(calculateEnergyKwh(-50, 300), 0);
      assert.strictEqual(calculateEnergyKwh(50, -300), 0);
    });
  });

  describe('3. calculateCarbonKg', () => {
    test('computes carbon with default grid intensity (0.708 kg CO2e / kWh)', () => {
      // 10 kWh * 0.708 = 7.08 kg
      const carbon = calculateCarbonKg(10, DEFAULT_GRID_CARBON_INTENSITY);
      assert.strictEqual(carbon, 7.08);
    });

    test('computes carbon with custom regional grid intensity', () => {
      // 5 kWh * 0.450 = 2.25 kg
      const carbon = calculateCarbonKg(5, 0.45);
      assert.strictEqual(carbon, 2.25);
    });

    test('returns 0 for 0 or negative energy/intensity', () => {
      assert.strictEqual(calculateCarbonKg(0, 0.708), 0);
      assert.strictEqual(calculateCarbonKg(-2, 0.708), 0);
      assert.strictEqual(calculateCarbonKg(10, 0), 0);
    });
  });

  describe('4. calculateP95', () => {
    test('computes 95th percentile accurately from sample array', () => {
      // Array of 100 numbers: 1 to 100
      const samples = Array.from({ length: 100 }, (_, i) => i + 1);
      const p95 = calculateP95(samples);
      assert.strictEqual(p95, 95);
    });

    test('handles small sample arrays gracefully', () => {
      const p95 = calculateP95([10, 20, 30, 40, 50]);
      assert.strictEqual(p95, 50);
    });

    test('returns null for empty array or non-array input', () => {
      assert.strictEqual(calculateP95([]), null);
      assert.strictEqual(calculateP95(null), null);
      assert.strictEqual(calculateP95(undefined), null);
    });
  });

  describe('5. compareMetrics', () => {
    test('computes reduction and percentage accurately', () => {
      // Baseline 100, Optimized 75 -> 25 reduction, 25% savings
      const res = compareMetrics(100, 75);
      assert.strictEqual(res.absoluteReduction, 25);
      assert.strictEqual(res.percentReduction, 25);
    });

    test('computes adverse trade-off (negative reduction) when optimized is higher', () => {
      // Baseline 50, Optimized 60 -> -10 reduction, -20% change
      const res = compareMetrics(50, 60);
      assert.strictEqual(res.absoluteReduction, -10);
      assert.strictEqual(res.percentReduction, -20);
    });

    test('handles zero baseline safely without NaN or Infinity', () => {
      const res = compareMetrics(0, 50);
      assert.strictEqual(res.percentReduction, 0);
      assert.ok(!isNaN(res.percentReduction));
      assert.ok(isFinite(res.percentReduction));
    });
  });
});
