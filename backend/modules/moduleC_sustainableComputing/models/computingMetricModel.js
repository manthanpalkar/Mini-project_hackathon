const mongoose = require('mongoose');

// Module C: Sustainable Computing Observatory
// Monitors lab node power, CPU efficiency, green job schedules, and carbon metrics

const ComputeTelemetrySchema = new mongoose.Schema({
  labId: { type: String, required: true, index: true },
  nodeId: { type: String, required: true, index: true },
  cpuUtilizationPercent: { type: Number, required: true, min: 0, max: 100 },
  gpuUtilizationPercent: { type: Number, default: 0, min: 0, max: 100 },
  powerWatts: { type: Number, required: true },
  estimatedCarbonGramsPerHour: { type: Number, required: true },
  ambientTemperatureCelsius: { type: Number, default: 24.0 },
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

const ComputeTelemetry = mongoose.models.ComputeTelemetry || mongoose.model('ComputeTelemetry', ComputeTelemetrySchema);
const GreenComputeJob = mongoose.models.GreenComputeJob || mongoose.model('GreenComputeJob', GreenComputeJobSchema);

module.exports = {
  ComputeTelemetry,
  GreenComputeJob
};
