/**
 * Comprehensive LOOP Upload Performance & Chunk Optimization Benchmark
 * Tests isolated on local MongoDB 7.0 (127.0.0.1:27018)
 * Measures chunk upload, assembly time, memory footprint, and parallel scaling.
 */
const mongoose = require('mongoose');
const { Readable } = require('stream');
const crypto = require('crypto');
const StorageService = require('../services/storageService');

const LOCAL_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27018/loop_upload_benchmark';

async function runBenchmarks() {
  console.log('================================================================');
  console.log('LOOP UPLOAD PERFORMANCE & CHUNK SIZING SCIENTIFIC BENCHMARK');
  console.log('Connecting to isolated local MongoDB 7.0 at 127.0.0.1:27018...');
  console.log('================================================================');

  await mongoose.connect(LOCAL_MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected successfully to local benchmark database.');

  // Clean benchmark collections if present
  try {
    await mongoose.connection.db.collection('loop_temp_chunks.files').drop().catch(() => {});
    await mongoose.connection.db.collection('loop_temp_chunks.chunks').drop().catch(() => {});
    await mongoose.connection.db.collection('loop_resources.files').drop().catch(() => {});
    await mongoose.connection.db.collection('loop_resources.chunks').drop().catch(() => {});
  } catch (e) {}

  const testCases = [
    { name: '1 MB Document (e.g. Standard Resume)', size: 1 * 1024 * 1024 },
    { name: '5.4 MB PDF Paper (Exact Screenshot Size)', size: Math.round(5.4 * 1024 * 1024) },
    { name: '20 MB Presentation / Lab Manual', size: 20 * 1024 * 1024 },
    { name: '50 MB Project Archive / Dataset', size: 50 * 1024 * 1024 }
  ];

  const chunkStrategies = [
    {
      strategyName: 'Baseline Hardcoded (8 MB chunks)',
      getChunkSize: (fileSize) => 8 * 1024 * 1024,
      concurrency: 6
    },
    {
      strategyName: 'Optimized Adaptive (1MB-4MB dynamic)',
      getChunkSize: (fileSize) => {
        if (fileSize <= 2 * 1024 * 1024) return 1 * 1024 * 1024;
        if (fileSize <= 10 * 1024 * 1024) return 1.5 * 1024 * 1024; // 5.4 MB = 4 chunks
        if (fileSize <= 40 * 1024 * 1024) return 4 * 1024 * 1024;
        return 8 * 1024 * 1024;
      },
      concurrency: 6
    }
  ];

  const results = [];

  for (const tc of testCases) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`TEST CASE: ${tc.name} (${(tc.size / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`----------------------------------------------------------------`);

    // Generate dummy payload buffer
    const testBuffer = crypto.randomBytes(tc.size);

    for (const strat of chunkStrategies) {
      const chunkSize = strat.getChunkSize(tc.size);
      const totalChunks = Math.ceil(tc.size / chunkSize);
      const activeConcurrency = Math.min(strat.concurrency, totalChunks);
      const uploadId = `bench_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      // Prepare chunks
      const chunkBuffers = [];
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(tc.size, start + chunkSize);
        chunkBuffers.push({
          index: i,
          buffer: testBuffer.subarray(start, end)
        });
      }

      const memBefore = process.memoryUsage().heapUsed;
      const t0 = performance.now();

      // Simulate chunk upload queue with concurrency limit
      let nextIndex = 0;
      const workers = [];
      const workerRun = async () => {
        while (nextIndex < totalChunks) {
          const c = chunkBuffers[nextIndex++];
          const stream = Readable.from(c.buffer);
          await StorageService.saveTempChunk({
            uploadId,
            chunkIndex: c.index,
            chunkStream: stream,
            expectedSize: c.buffer.length
          });
        }
      };

      for (let w = 0; w < activeConcurrency; w++) {
        workers.push(workerRun());
      }
      await Promise.all(workers);

      const tChunksUploaded = performance.now();
      const chunkUploadTimeMs = tChunksUploaded - t0;

      // Assemble final GridFS file
      const tAssembleStart = performance.now();
      const finalFile = await StorageService.assembleFinalGridFSFile({
        uploadId,
        totalChunks,
        expectedFileSize: tc.size,
        fileName: `bench_${tc.size}.bin`,
        mimeType: 'application/octet-stream',
        metadata: { benchmark: true }
      });
      const tAssembleEnd = performance.now();
      const assemblyTimeMs = tAssembleEnd - tAssembleStart;
      const totalTimeMs = tAssembleEnd - t0;

      const memAfter = process.memoryUsage().heapUsed;
      const heapDeltaMB = Math.max(0, (memAfter - memBefore) / (1024 * 1024));

      // Cleanup
      await StorageService.cleanupTempChunks(uploadId);
      await StorageService.deleteFile({ fileUrl: finalFile.fileId.toString() });

      const throughputMBps = (tc.size / (1024 * 1024)) / (totalTimeMs / 1000);

      results.push({
        fileSizeMB: (tc.size / (1024 * 1024)).toFixed(2),
        strategy: strat.strategyName,
        chunkSizeMB: (chunkSize / (1024 * 1024)).toFixed(2),
        totalChunks,
        concurrency: activeConcurrency,
        chunkTimeMs: chunkUploadTimeMs.toFixed(1),
        assemblyTimeMs: assemblyTimeMs.toFixed(1),
        totalTimeMs: totalTimeMs.toFixed(1),
        throughputMBps: throughputMBps.toFixed(2),
        heapDeltaMB: heapDeltaMB.toFixed(2)
      });

      console.log(`  [${strat.strategyName}]`);
      console.log(`    Chunks: ${totalChunks} (size: ${(chunkSize / (1024 * 1024)).toFixed(2)} MB) | Active Concurrency: ${activeConcurrency}`);
      console.log(`    Chunk Upload: ${chunkUploadTimeMs.toFixed(1)}ms | Assembly: ${assemblyTimeMs.toFixed(1)}ms | Total: ${totalTimeMs.toFixed(1)}ms`);
      console.log(`    Throughput: ${throughputMBps.toFixed(2)} MB/s | Heap Delta: ${heapDeltaMB.toFixed(2)} MB`);
    }
  }

  console.log('\n================================================================');
  console.log('SUMMARY TABLE');
  console.log('================================================================');
  console.table(results);

  await mongoose.disconnect();
  console.log('\nDisconnected from benchmark database.');
}

runBenchmarks().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
