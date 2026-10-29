const mongoose = require('mongoose');

// Module C: Sustainable Computing Observatory
// Telemetry models, simulation run records, and green job schedules

const ComputeTelemetrySchema = new mongoose.Schema({
  labId: { type: String, required: true, index: true },
  nodeId: { type: String, required: true, index: true },
  serviceId: { type: String, default: null, index: true },
  scenario: { type: String, enum: ['baseline', 'optimized', 'telemetry'], default: 'telemetry' },
  cpuUtilizationPercent: { type: Number, required: true, min: 0, max: 100 },
  gpuUtilizationPercent: { type: Number, default: 0, min: 0, max: 100 },
  powerWatts: { type: Number, required: true },
  estimatedCarbonGramsPerHour: { type: Number, required: true },
  ambientTemperatureCelsius: { type: Number, default: 24.0 },
  simulationRunId: { type: String, default: null, index: true },
  recordedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

ComputeTelemetrySchema.index({ labId: 1, recordedAt: -1 });

const GreenComputeJobSchema = new mongoose.Schema({
  jobName: { type: String, required: true },
  submittedByEmail: { type: String, required: true, index: true },
  labTarget: { type: String, default: 'spit-cloud-lab' },
  preferredWindow: { type: String, enum: ['immediate', 'green_hours_off_peak', 'solar_peak'], default: 'green_hours_off_peak' },
  estimatedComputeHours: { type: Number, required: true },
  energyBudgetJoules: { type: Number, default: null },
  status: { type: String, enum: ['queued', 'running', 'completed', 'cancelled'], default: 'queued', index: true }
}, { timestamps: true });

// Schema for persisted deterministic simulation runs
const GreenComputeSimulationRunSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true, index: true },
  userEmail: { type: String, required: true, index: true },
  userName: { type: String, default: 'UniVerse Student' },
  seed: { type: mongoose.Schema.Types.Mixed, required: true },
  durationSeconds: { type: Number, required: true },
  workloadIntensity: { type: String, enum: ['low', 'medium', 'high', 'stress'], default: 'medium' },
  gridCarbonIntensityKgPerKwh: { type: Number, required: true },
  modelVersion: { type: String, required: true },
  servicesConfig: [{ type: String }],
  totalLogicalItems: { type: Number, required: true },
  serviceResults: { type: mongoose.Schema.Types.Mixed, required: true },
  aggregate: {
    totalLogicalItems: { type: Number, required: true },
    baselineEnergyKwh: { type: Number, required: true },
    optimizedEnergyKwh: { type: Number, required: true },
    energySavedKwh: { type: Number, required: true },
    energySavedPercent: { type: Number, required: true },
    baselineCarbonKg: { type: Number, required: true },
    optimizedCarbonKg: { type: Number, required: true },
    carbonSavedKg: { type: Number, required: true },
    carbonSavedPercent: { type: Number, required: true }
  },
  assumptions: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

GreenComputeSimulationRunSchema.index({ userEmail: 1, createdAt: -1 });
GreenComputeSimulationRunSchema.index({ createdAt: -1 });

const ComputeTelemetry = mongoose.models.ComputeTelemetry || mongoose.model('ComputeTelemetry', ComputeTelemetrySchema);
const GreenComputeJob = mongoose.models.GreenComputeJob || mongoose.model('GreenComputeJob', GreenComputeJobSchema);
const GreenComputeSimulationRun = mongoose.models.GreenComputeSimulationRun || mongoose.model('GreenComputeSimulationRun', GreenComputeSimulationRunSchema);

module.exports = {
  ComputeTelemetry,
  GreenComputeJob,
  GreenComputeSimulationRun
};
