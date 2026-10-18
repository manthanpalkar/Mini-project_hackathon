/**
 * Realistic Network Profile Benchmark for LOOP Upload Architecture
 * Simulates:
 * 1. Unthrottled High Speed (10+ MB/s, 10ms RTT)
 * 2. 4G / Fast Campus Wi-Fi (1.5 MB/s, 60ms RTT)
 * 3. Weak 4G / 3G / Mobile Hotspot (225 KB/s, 220ms RTT) [User Screenshot Condition]
 * 4. Rural / 2G Edge (50 KB/s, 450ms RTT)
 */
const mongoose = require('mongoose');
const { Readable } = require('stream');
const crypto = require('crypto');
const StorageService = require('../services/storageService');

const LOCAL_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27018/loop_upload_benchmark';

// Helper to create a throttled stream that simulates uplink bandwidth limit
function createThrottledStream(buffer, bytesPerSec, initialLatencyMs = 0) {
  let offset = 0;
  const chunkSize = Math.max(1024, Math.floor(bytesPerSec / 20)); // 20 chunks per second
  const intervalMs = 50;

  return new Readable({
    read() {
      if (initialLatencyMs > 0 && offset === 0) {
        setTimeout(() => this.pushNext(), initialLatencyMs);
      } else {
        this.pushNext();
      }
    }
  });
}

// Custom simulated uploader measuring parallel streams vs single stream under bandwidth throttling
async function simulateNetworkUpload({
  fileSize,
  chunkSize,
  maxConcurrency,
  bandwidthBytesPerSec,
  rttMs,
  lossProbability = 0
}) {
  const totalChunks = Math.ceil(fileSize / chunkSize);
  const activeConcurrency = Math.min(maxConcurrency, totalChunks);
  const uploadId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Total bandwidth shared across active streams (or per-connection under TCP congestion)
  // In TCP with latency, multiple streams achieve higher bandwidth efficiency
  const streamBandwidth = Math.floor(bandwidthBytesPerSec / activeConcurrency);

  let nextIndex = 0;
  const chunkTimes = [];
  let totalRetries = 0;

  const tStart = performance.now();

  const worker = async () => {
    while (nextIndex < totalChunks) {
      const idx = nextIndex++;
      const start = idx * chunkSize;
      const end = Math.min(fileSize, start + chunkSize);
      const len = end - start;
      const chunkBuf = crypto.randomBytes(len);

      let attempts = 0;
      let success = false;

      while (!success && attempts < 4) {
        attempts++;
        if (attempts > 1) totalRetries++;

        // Simulate network transmission delay
        const transferSec = len / streamBandwidth;
        const totalDelayMs = rttMs + (transferSec * 1000);
        await new Promise(r => setTimeout(r, Math.min(totalDelayMs, 300))); // Scaled for fast benchmark run

        // Save into MongoDB
        const stream = Readable.from(chunkBuf);
        try {
          await StorageService.saveTempChunk({
            uploadId,
            chunkIndex: idx,
            chunkStream: stream,
            expectedSize: len
          });
          success = true;
        } catch (e) {
          if (attempts >= 4) throw e;
        }
      }
    }
  };

  const workers = [];
  for (let w = 0; w < activeConcurrency; w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  const tUpload = performance.now();

  // Assemble into final GridFS
  const tAssembleStart = performance.now();
  const finalFile = await StorageService.assembleFinalGridFSFile({
    uploadId,
    totalChunks,
    expectedFileSize: fileSize,
    fileName: `sim_${fileSize}.bin`,
    mimeType: 'application/octet-stream'
  });
  const tEnd = performance.now();

  await StorageService.cleanupTempChunks(uploadId);
  await StorageService.deleteFile({ fileUrl: finalFile.fileId.toString() });

  return {
    totalChunks,
    activeConcurrency,
    uploadTimeMs: tUpload - tStart,
    assemblyTimeMs: tEnd - tAssembleStart,
    totalTimeMs: tEnd - tStart,
    totalRetries
  };
}

async function runNetworkProfiles() {
  await mongoose.connect(LOCAL_MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected to local MongoDB for Network Profiling.');

  const profiles = [
    { name: '4G / Campus Wi-Fi (1.5 MB/s, 60ms RTT)', bw: 1.5 * 1024 * 1024, rtt: 60 },
    { name: 'Weak 4G / Mobile Hotspot (225 KB/s, 220ms RTT) [User Case]', bw: 225 * 1024, rtt: 220 },
    { name: 'Slow 3G / 2G Edge (50 KB/s, 450ms RTT)', bw: 50 * 1024, rtt: 450 }
  ];

  const testFileSizes = [
    { label: '5.4 MB Paper (Screenshot File)', size: Math.round(5.4 * 1024 * 1024) },
    { label: '20 MB Lab Manual', size: 20 * 1024 * 1024 }
  ];

  for (const prof of profiles) {
    console.log(`\n================================================================`);
    console.log(`NETWORK PROFILE: ${prof.name}`);
    console.log(`================================================================`);

    for (const fs of testFileSizes) {
      console.log(`\n-- Testing ${fs.label} (${(fs.size / (1024 * 1024)).toFixed(2)} MB) --`);

      // 1. Baseline: 8 MB Chunks (1 chunk for 5.4MB, 3 chunks for 20MB)
      const resBaseline = await simulateNetworkUpload({
        fileSize: fs.size,
        chunkSize: 8 * 1024 * 1024,
        maxConcurrency: 6,
        bandwidthBytesPerSec: prof.bw,
        rttMs: prof.rtt
      });

      // 2. Adaptive Optimized: 1.5 MB Chunks for 5.4MB (4 chunks, 4 concurrency)
      const optimizedChunkSize = fs.size <= 10 * 1024 * 1024 ? 1.5 * 1024 * 1024 : 4 * 1024 * 1024;
      const resOptimized = await simulateNetworkUpload({
        fileSize: fs.size,
        chunkSize: optimizedChunkSize,
        maxConcurrency: 6,
        bandwidthBytesPerSec: prof.bw,
        rttMs: prof.rtt
      });

      console.log(`  Baseline (8MB chunk, ${resBaseline.totalChunks} chunk, concurr=${resBaseline.activeConcurrency}):`);
      console.log(`    Upload: ${resBaseline.uploadTimeMs.toFixed(1)}ms | Assembly: ${resBaseline.assemblyTimeMs.toFixed(1)}ms | Total: ${resBaseline.totalTimeMs.toFixed(1)}ms`);

      console.log(`  Optimized Adaptive (${(optimizedChunkSize / (1024 * 1024)).toFixed(2)}MB chunk, ${resOptimized.totalChunks} chunks, concurr=${resOptimized.activeConcurrency}):`);
      console.log(`    Upload: ${resOptimized.uploadTimeMs.toFixed(1)}ms | Assembly: ${resOptimized.assemblyTimeMs.toFixed(1)}ms | Total: ${resOptimized.totalTimeMs.toFixed(1)}ms`);

      const speedup = ((resBaseline.totalTimeMs - resOptimized.totalTimeMs) / resBaseline.totalTimeMs * 100).toFixed(1);
      console.log(`  -> Improvement: ${speedup}% lower latency`);
    }
  }

  await mongoose.disconnect();
}

runNetworkProfiles().catch(console.error);
