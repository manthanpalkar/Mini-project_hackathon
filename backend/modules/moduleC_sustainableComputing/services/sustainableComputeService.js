/**
 * UniVerse Module C: Sustainable Computing Observatory
 * Core Simulation & Sustainability Calculation Engine
 * 
 * Provides:
 * 1. Seeded deterministic PRNG (Mulberry32) for reproducible synthetic workloads
 * 2. Pure calculation functions for Power, Energy (kWh), and Carbon (kg CO2e)
 * 3. Service workload generators for:
 *    - Campus API (Caching optimization)
 *    - Analytics Worker (Micro-batching optimization)
 *    - Media Processing Worker (Vectorized profile optimization)
 * 4. Baseline vs. Optimized scenario comparator
 */

// Model version identifier
const MODEL_VERSION = '1.0.0-universe-observatory';

// Default Grid Carbon Intensity (kg CO2e / kWh)
// Educational baseline benchmark: 0.708 kg CO2e/kWh (Central Electricity Authority India national average)
const DEFAULT_GRID_CARBON_INTENSITY = 0.708;

// Deterministic Pseudo-Random Number Generator: Mulberry32
class SeededRandom {
  constructor(seed) {
    let s = 0;
    if (typeof seed === 'number') {
      s = seed;
    } else if (typeof seed === 'string') {
      for (let i = 0; i < seed.length; i++) {
        s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
      }
    } else {
      s = 123456789;
    }
    this.state = s >>> 0;
  }

  // Returns pseudorandom float in [0, 1)
  nextFloat() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns pseudorandom integer in [min, max] inclusive
  nextInt(min, max) {
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }

  // Returns random float in [min, max]
  nextFloatRange(min, max) {
    return min + this.nextFloat() * (max - min);
  }
}

// ==========================================
// PURE SUSTAINABILITY CALCULATION FUNCTIONS
// ==========================================

/**
 * Calculates synthetic average power in Watts.
 * Formula: P_avg = P_idle + utilization * (P_max - P_idle)
 * 
 * @param {number} idlePowerWatts - Idle power draw (Watts)
 * @param {number} maxPowerWatts - Maximum peak power draw (Watts)
 * @param {number} utilizationFraction - Average CPU/Compute utilization (0.0 to 1.0)
 * @returns {number} Average power in Watts rounded to 2 decimal places
 */
function calculateAveragePowerWatts(idlePowerWatts, maxPowerWatts, utilizationFraction) {
  if (idlePowerWatts < 0) {
    throw new Error('idlePowerWatts must be non-negative');
  }
  if (maxPowerWatts < idlePowerWatts) {
    throw new Error('maxPowerWatts must be greater than or equal to idlePowerWatts');
  }
  const clampedUtil = Math.max(0, Math.min(1, Number(utilizationFraction) || 0));
  const power = idlePowerWatts + clampedUtil * (maxPowerWatts - idlePowerWatts);
  return Math.round(power * 100) / 100;
}

/**
 * Calculates energy consumption in kilowatt-hours (kWh).
 * Formula: E_kWh = (P_avg_W * t_seconds) / 3,600,000
 * 
 * @param {number} avgPowerWatts - Average power (Watts)
 * @param {number} durationSeconds - Workload duration (Seconds)
 * @returns {number} Energy in kWh rounded to 6 decimal places
 */
function calculateEnergyKwh(avgPowerWatts, durationSeconds) {
  if (avgPowerWatts < 0 || durationSeconds < 0) {
    return 0;
  }
  const energy = (avgPowerWatts * durationSeconds) / 3600000;
  return Math.round(energy * 1000000) / 1000000;
}

/**
 * Calculates estimated carbon emissions in kilograms of CO2 equivalent (kg CO2e).
 * Formula: C_kgCO2e = E_kWh * I_kgCO2e/kWh
 * 
 * @param {number} energyKwh - Energy in kWh
 * @param {number} gridCarbonIntensity - Grid intensity (kg CO2e / kWh)
 * @returns {number} Carbon emissions in kg CO2e rounded to 6 decimal places
 */
function calculateCarbonKg(energyKwh, gridCarbonIntensity = DEFAULT_GRID_CARBON_INTENSITY) {
  if (energyKwh <= 0 || gridCarbonIntensity <= 0) {
    return 0;
  }
  const carbon = energyKwh * gridCarbonIntensity;
  return Math.round(carbon * 1000000) / 1000000;
}

/**
 * Calculates 95th percentile latency from a sample array.
 * Uses standard rank order method.
 * 
 * @param {number[]} samples - Latency samples in milliseconds
 * @returns {number|null} p95 latency in ms, or null if no samples
 */
function calculateP95(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return null;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.ceil(0.95 * sorted.length) - 1;
  const p95 = sorted[Math.max(0, Math.min(sorted.length - 1, index))];
  return Math.round(p95 * 10) / 10;
}

/**
 * Computes scenario comparison metrics (differences and percentages).
 * Positive reduction values denote sustainability savings.
 * 
 * @param {number} baseline - Baseline metric
 * @param {number} optimized - Optimized metric
 * @param {number} decimals - Precision decimals
 * @returns {object} { baseline, optimized, absoluteReduction, percentReduction }
 */
function compareMetrics(baseline, optimized, decimals = 4) {
  const b = Number(baseline) || 0;
  const opt = Number(optimized) || 0;
  const factor = Math.pow(10, decimals);
  const absoluteReduction = Math.round((b - opt) * factor) / factor;
  
  let percentReduction = 0;
  if (b > 0) {
    percentReduction = Math.round(((b - opt) / b) * 1000) / 10; // e.g. 24.5%
  }

  return {
    baseline: Math.round(b * factor) / factor,
    optimized: Math.round(opt * factor) / factor,
    absoluteReduction,
    percentReduction
  };
}

// ==========================================
// WORKLOAD SERVICE DEFINITIONS & MODELS
// ==========================================

const SERVICES_CATALOG = {
  campus_api: {
    id: 'campus_api',
    name: 'Campus Core API',
    description: 'REST application API serving student profiles, academic courses, placement records, and authentication.',
    workloadType: 'request_response',
    powerModel: {
      idleWatts: 45,
      maxWatts: 140
    },
    baselineParams: {
      cacheHitRatio: 0.05, // 5% baseline cache hit
      dbLatencyMeanMs: 42,
      dbLatencyStdMs: 14,
      slowQueryProb: 0.04,
      slowQueryLatencyMeanMs: 160
    },
    optimizedParams: {
      cacheHitRatio: 0.58, // 58% optimized in-memory cache hit
      cacheLatencyMs: 3.5,
      dbLatencyMeanMs: 38,
      dbLatencyStdMs: 12,
      slowQueryProb: 0.015,
      slowQueryLatencyMeanMs: 130
    },
    optimizationDescription: 'Distributed in-memory query & profile caching avoids redundant database read pipelines for repeated student requests.'
  },

  analytics_worker: {
    id: 'analytics_worker',
    name: 'Student Analytics Worker',
    description: 'Asynchronous event stream processor computing placement skill trends, study habits, and aggregate metrics.',
    workloadType: 'event_stream',
    powerModel: {
      idleWatts: 60,
      maxWatts: 210
    },
    baselineParams: {
      batchSize: 1, // Single-item processing with high per-event scheduler overhead
      schedulerOverheadMs: 18,
      processingDurationMeanMs: 65,
      failureRate: 0.012
    },
    optimizedParams: {
      batchSize: 20, // Adaptive micro-batching coalesces 20 items per dispatch
      schedulerOverheadMs: 1.2, // 93% reduction in per-item scheduling overhead
      processingDurationMeanMs: 52,
      failureRate: 0.003
    },
    optimizationDescription: 'Adaptive event micro-batching aggregates discrete telemetry events, amortizing queue scheduling and DB connection overhead.'
  },

  media_processor: {
    id: 'media_processor',
    name: 'Media & Document Pipeline',
    description: 'Compute-heavy resume OCR text extraction, profile image transformations, and exam snapshot encoding.',
    workloadType: 'compute_intensive',
    powerModel: {
      idleWatts: 85,
      maxWatts: 320
    },
    baselineParams: {
      processingProfile: 'unoptimized_monolithic',
      taskDurationMeanMs: 1100,
      taskDurationStdMs: 300,
      coreUtilization: 0.88,
      failureRate: 0.025
    },
    optimizedParams: {
      processingProfile: 'vectorized_pipelined',
      taskDurationMeanMs: 640, // 42% latency reduction via single-pass SIMD pipeline
      taskDurationStdMs: 150,
      coreUtilization: 0.62,
      failureRate: 0.008
    },
    optimizationDescription: 'Vectorized single-pass transformation pipeline with stream-based memory allocation reduces redundant CPU cycles.'
  }
};

// ==========================================
// DETERMINISTIC SIMULATION SERVICE CLASS
// ==========================================

class SustainableComputeService {
  constructor() {
    this.modelVersion = MODEL_VERSION;
    this.defaultGridIntensity = DEFAULT_GRID_CARBON_INTENSITY;
  }

  /**
   * Retrieves all supported service definitions.
   */
  getServiceDefinitions() {
    return Object.values(SERVICES_CATALOG).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      workloadType: s.workloadType,
      idleWatts: s.powerModel.idleWatts,
      maxWatts: s.powerModel.maxWatts,
      optimizationDescription: s.optimizationDescription
    }));
  }

  /**
   * Retrieves calculation assumptions and formulas.
   */
  getAssumptions() {
    return {
      modelVersion: this.modelVersion,
      defaultGridCarbonIntensityKgPerKwh: this.defaultGridIntensity,
      gridIntensitySource: 'Central Electricity Authority of India National Grid Emission Baseline (Educational Model Benchmark)',
      powerFormula: 'P_avg (W) = P_idle + u * (P_max - P_idle)',
      energyFormula: 'E (kWh) = (P_avg * duration_seconds) / 3,600,000',
      carbonFormula: 'C (kg CO2e) = E_kWh * grid_intensity',
      servicesPowerBaseline: Object.values(SERVICES_CATALOG).map(s => ({
        serviceId: s.id,
        serviceName: s.name,
        idleWatts: s.powerModel.idleWatts,
        maxWatts: s.powerModel.maxWatts
      })),
      disclaimer: 'SIMULATED DATA · Synthetic energy and carbon estimations derived from reproducible workload models, not physical hardware power meters.'
    };
  }

  /**
   * Executes a complete deterministic simulation across selected services.
   * Both baseline and optimized scenarios process equivalent logical workloads.
   * 
   * @param {object} config - Simulation options
   * @returns {object} Full reproducible simulation results
   */
  runSimulation(config = {}) {
    const seed = config.seed !== undefined ? config.seed : 42;
    const durationSeconds = Math.max(10, Math.min(86400, Number(config.durationSeconds) || 300)); // Default 5 mins
    const intensity = config.workloadIntensity || 'medium'; // 'low' | 'medium' | 'high' | 'stress'
    const gridIntensity = Math.max(0.01, Math.min(3.0, Number(config.gridCarbonIntensity) || this.defaultGridIntensity));
    
    // Multiplier for logical request/job volume
    let volumeMultiplier = 1.0;
    if (intensity === 'low') volumeMultiplier = 0.5;
    else if (intensity === 'medium') volumeMultiplier = 1.0;
    else if (intensity === 'high') volumeMultiplier = 2.0;
    else if (intensity === 'stress') volumeMultiplier = 3.5;

    // Selected services
    const requestedServices = Array.isArray(config.selectedServices) && config.selectedServices.length > 0
      ? config.selectedServices
      : Object.keys(SERVICES_CATALOG);

    const validServices = requestedServices.filter(sId => SERVICES_CATALOG[sId]);
    if (validServices.length === 0) {
      throw new Error('At least one valid service must be selected for simulation.');
    }

    // Initialize deterministic PRNG
    const prng = new SeededRandom(seed);

    const serviceResults = [];
    let aggBaselineEnergy = 0;
    let aggOptimizedEnergy = 0;
    let aggBaselineCarbon = 0;
    let aggOptimizedCarbon = 0;
    let totalLogicalItems = 0;

    for (const serviceId of validServices) {
      const def = SERVICES_CATALOG[serviceId];
      
      // Compute logical items volume based on duration and service nature
      let logicalItemsCount = 0;
      if (serviceId === 'campus_api') {
        logicalItemsCount = Math.round((durationSeconds * 6.5) * volumeMultiplier); // ~1950 reqs in 5m
      } else if (serviceId === 'analytics_worker') {
        logicalItemsCount = Math.round((durationSeconds * 2.2) * volumeMultiplier); // ~660 events in 5m
      } else if (serviceId === 'media_processor') {
        logicalItemsCount = Math.max(5, Math.round((durationSeconds * 0.35) * volumeMultiplier)); // ~105 jobs in 5m
      }
      totalLogicalItems += logicalItemsCount;

      // 1. Simulate Baseline Scenario
      const baselineResult = this._simulateServiceScenario({
        serviceDef: def,
        scenario: 'baseline',
        logicalItemsCount,
        durationSeconds,
        gridIntensity,
        prng
      });

      // 2. Simulate Optimized Scenario (processes EQUIVALENT logical items)
      const optimizedResult = this._simulateServiceScenario({
        serviceDef: def,
        scenario: 'optimized',
        logicalItemsCount,
        durationSeconds,
        gridIntensity,
        prng
      });

      // Comparison for this service
      const energyComparison = compareMetrics(baselineResult.energyKwh, optimizedResult.energyKwh, 6);
      const carbonComparison = compareMetrics(baselineResult.carbonKg, optimizedResult.carbonKg, 6);
      const latencyComparison = compareMetrics(baselineResult.avgLatencyMs, optimizedResult.avgLatencyMs, 2);
      const utilComparison = compareMetrics(baselineResult.utilizationPercent, optimizedResult.utilizationPercent, 2);

      serviceResults.push({
        serviceId: def.id,
        serviceName: def.name,
        workloadType: def.workloadType,
        optimizationDescription: def.optimizationDescription,
        logicalItemsCount,
        baseline: baselineResult,
        optimized: optimizedResult,
        comparison: {
          energy: energyComparison,
          carbon: carbonComparison,
          latency: latencyComparison,
          utilization: utilComparison
        }
      });

      aggBaselineEnergy += baselineResult.energyKwh;
      aggOptimizedEnergy += optimizedResult.energyKwh;
      aggBaselineCarbon += baselineResult.carbonKg;
      aggOptimizedCarbon += optimizedResult.carbonKg;
    }

    const aggregateEnergy = compareMetrics(aggBaselineEnergy, aggOptimizedEnergy, 6);
    const aggregateCarbon = compareMetrics(aggBaselineCarbon, aggOptimizedCarbon, 6);

    return {
      success: true,
      modelVersion: this.modelVersion,
      simulationMeta: {
        seed,
        durationSeconds,
        workloadIntensity: intensity,
        gridCarbonIntensityKgPerKwh: gridIntensity,
        totalLogicalItems,
        servicesCount: serviceResults.length,
        timestamp: new Date().toISOString()
      },
      serviceResults,
      aggregate: {
        totalLogicalItems,
        baselineEnergyKwh: aggregateEnergy.baseline,
        optimizedEnergyKwh: aggregateEnergy.optimized,
        energySavedKwh: aggregateEnergy.absoluteReduction,
        energySavedPercent: aggregateEnergy.percentReduction,
        baselineCarbonKg: aggregateCarbon.baseline,
        optimizedCarbonKg: aggregateCarbon.optimized,
        carbonSavedKg: aggregateCarbon.absoluteReduction,
        carbonSavedPercent: aggregateCarbon.percentReduction
      },
      assumptions: this.getAssumptions()
    };
  }

  /**
   * Internal scenario simulator for a single service.
   */
  _simulateServiceScenario({ serviceDef, scenario, logicalItemsCount, durationSeconds, gridIntensity, prng }) {
    const isOpt = scenario === 'optimized';
    const params = isOpt ? serviceDef.optimizedParams : serviceDef.baselineParams;
    const powerModel = serviceDef.powerModel;

    let completedCount = 0;
    let failedCount = 0;
    const latencySamples = [];

    // Synthesize latency samples and outcome for the service
    if (serviceDef.id === 'campus_api') {
      const cacheHitRatio = params.cacheHitRatio;
      for (let i = 0; i < logicalItemsCount; i++) {
        // Deterministic check: is this request a cache hit?
        const isHit = isOpt && (prng.nextFloat() < cacheHitRatio);
        if (isHit) {
          completedCount++;
          // In-memory cache hit: 1 to 5 ms
          latencySamples.push(params.cacheLatencyMs + prng.nextFloatRange(-1.2, 1.8));
        } else {
          // Cache miss / database query
          const isSlow = prng.nextFloat() < params.slowQueryProb;
          const isFailure = prng.nextFloat() < 0.005;
          if (isFailure) {
            failedCount++;
          } else {
            completedCount++;
          }
          if (isSlow) {
            latencySamples.push(params.slowQueryLatencyMeanMs + prng.nextFloatRange(-25, 45));
          } else {
            latencySamples.push(params.dbLatencyMeanMs + prng.nextFloatRange(-params.dbLatencyStdMs, params.dbLatencyStdMs));
          }
        }
      }
    } else if (serviceDef.id === 'analytics_worker') {
      const batchSize = params.batchSize;
      const batchesCount = Math.ceil(logicalItemsCount / batchSize);
      
      for (let b = 0; b < batchesCount; b++) {
        const isFail = prng.nextFloat() < params.failureRate;
        const itemsInThisBatch = Math.min(batchSize, logicalItemsCount - (b * batchSize));
        
        if (isFail) {
          failedCount += itemsInThisBatch;
        } else {
          completedCount += itemsInThisBatch;
        }

        // Latency per item inside batch
        const batchDuration = params.schedulerOverheadMs + (itemsInThisBatch * params.processingDurationMeanMs);
        const perItemLatency = batchDuration / itemsInThisBatch;
        latencySamples.push(perItemLatency + prng.nextFloatRange(-6, 8));
      }
    } else if (serviceDef.id === 'media_processor') {
      for (let j = 0; j < logicalItemsCount; j++) {
        const isFail = prng.nextFloat() < params.failureRate;
        if (isFail) {
          failedCount++;
        } else {
          completedCount++;
        }
        const lat = params.taskDurationMeanMs + prng.nextFloatRange(-params.taskDurationStdMs, params.taskDurationStdMs);
        latencySamples.push(Math.max(50, lat));
      }
    }

    // Clean latency array
    const validLatencies = latencySamples.filter(l => typeof l === 'number' && !isNaN(l) && l > 0);
    const avgLatencyMs = validLatencies.length > 0
      ? Math.round((validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length) * 10) / 10
      : 0;
    const p95LatencyMs = calculateP95(validLatencies);

    // Compute synthetic average utilization (bounded 0 to 1)
    let utilizationFraction = 0;
    if (serviceDef.id === 'campus_api') {
      // Baseline API CPU load ~ 0.52; Caching reduces load by ~35%
      utilizationFraction = isOpt ? 0.28 : 0.54;
      utilizationFraction += prng.nextFloatRange(-0.03, 0.03);
    } else if (serviceDef.id === 'analytics_worker') {
      // Batching eliminates queue scheduler polling: utilization drops from 0.68 to 0.44
      utilizationFraction = isOpt ? 0.44 : 0.68;
      utilizationFraction += prng.nextFloatRange(-0.04, 0.04);
    } else if (serviceDef.id === 'media_processor') {
      // Vectorized pipeline drops heavy core spin: utilization drops from 0.86 to 0.59
      utilizationFraction = isOpt ? 0.59 : 0.86;
      utilizationFraction += prng.nextFloatRange(-0.03, 0.03);
    }
    utilizationFraction = Math.max(0.05, Math.min(0.98, utilizationFraction));

    // Power, Energy, Carbon calculations
    const avgPowerWatts = calculateAveragePowerWatts(powerModel.idleWatts, powerModel.maxWatts, utilizationFraction);
    const energyKwh = calculateEnergyKwh(avgPowerWatts, durationSeconds);
    const carbonKg = calculateCarbonKg(energyKwh, gridIntensity);

    return {
      scenario,
      itemsSubmitted: logicalItemsCount,
      itemsCompleted: completedCount,
      itemsFailed: failedCount,
      avgLatencyMs,
      p95LatencyMs,
      utilizationFraction: Math.round(utilizationFraction * 1000) / 1000,
      utilizationPercent: Math.round(utilizationFraction * 1000) / 10,
      idleWatts: powerModel.idleWatts,
      maxWatts: powerModel.maxWatts,
      avgPowerWatts,
      energyKwh,
      carbonKg
    };
  }
}

const sustainableComputeInstance = new SustainableComputeService();

module.exports = {
  SustainableComputeService,
  sustainableComputeInstance,
  calculateAveragePowerWatts,
  calculateEnergyKwh,
  calculateCarbonKg,
  calculateP95,
  compareMetrics,
  SeededRandom,
  MODEL_VERSION,
  DEFAULT_GRID_CARBON_INTENSITY,
  SERVICES_CATALOG
};
