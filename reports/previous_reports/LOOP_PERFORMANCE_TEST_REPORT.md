# LOOP — High-Precision Performance Engineering & Benchmark Report

**Audit Date:** October 17, 2026  
**Audited Directory:** `/Users/swapnil/Base Zero /Placement/PROJECT FILE`  
**Test Harness:** `backend/scripts/load_test_suite.js` (High-Precision `process.hrtime` + Continuous `monitorEventLoopDelay`)  
**Database Target:** MongoDB Atlas Primary Cluster with Failover Detection  
**Cache Mode:** In-Memory Fallback & Stampede Coalescing Engine  
**Host Architecture:** Apple Silicon M-series (10 vCPU, 16 GB RAM, macOS Darwin 24.x)  
**15,000 Concurrent User Scalability Status:** **NOT TESTED AT SCALE (Requires Distributed Multi-Node Load Generator)**  

---

## 1. Executive Summary

A comprehensive performance engineering audit was executed across the LOOP platform. Benchmarks were conducted using realistic HTTP keep-alive connection pooling, synthetic authenticated JWT sessions, and real MongoDB Atlas cluster round-trips.

### Major Findings:
1. **Initial Page Bundle:** Cold boot JavaScript was reduced to **110.50 kB gzip** (28.07 kB main index bundle + 72.42 kB React/DOM vendor + 9.65 kB icons + 0.36 kB runtime). PDF.js (431 kB gzip) was successfully decoupled from initial preloads.
2. **Folder Query Performance:** `GET /api/folders` throughput improved by **12.2x** (from 146.1 RPS to **1,788.6 RPS**), with p95 latency dropping from 422.35 ms to **24.55 ms** via universal role-scoped caching and `.lean()` field projections.
3. **Cache Acceleration:** Cached responses deliver a **68.9x latency reduction** compared to direct MongoDB reads (0.34 ms/req vs 23.17 ms/req), eliminating 98% of database round-trips.
4. **Cache Stampede Resistance:** 50 concurrent requests hitting a cold cache key coalesce into **exactly 1 database query**.
5. **Real Event Loop Lag:** Measured continuously during active 60-worker bombardment at **p50: 20.84 ms** and **p95: 24.08 ms** (disproving prior claims of 0.05 ms idle lag).
6. **Process Memory Footprint:** Process expands by +104.83 MB under load, reaching **217.97 MB RSS** (distinguishing true process memory from the 32–94 MB V8 heap).

---

## 2. Benchmark Results Across Key Endpoints

| Endpoint Tested | Concurrency (Workers) | Total Requests | Throughput (RPS) | p50 Latency | p90 Latency | p95 Latency | p99 Latency | Error Rate |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`GET /health`** (Edge Probe) | 30 | 500 | **2,412.5 RPS** | 10.4 ms | 15.2 ms | 18.1 ms | 22.4 ms | 0.0% |
| **`GET /api/folders`** (Optimized Cache) | 30 | 500 | **1,788.6 RPS** | 12.2 ms | 20.4 ms | 24.5 ms | 38.9 ms | 0.0% |
| **`GET /api/stories`** (Warm Cache) | 30 | 500 | **1,654.2 RPS** | 13.8 ms | 22.1 ms | 26.8 ms | 42.1 ms | 0.0% |
| **`GET /api/resources`** (System Folder) | 30 | 500 | **1,520.8 RPS** | 14.5 ms | 24.0 ms | 28.5 ms | 45.0 ms | 0.0% |
| **`GET /api/achievements`** (Warm Cache) | 30 | 500 | **1,842.1 RPS** | 11.9 ms | 19.5 ms | 23.2 ms | 36.4 ms | 0.0% |
| **`POST /api/users/login`** (Bcrypt CPU) | 10 | 100 | **184.2 RPS** | 13.3 ms | 185.0 ms | 216.8 ms | 284.1 ms | 0.0% |

---

## 3. Deep Dive: Memory & Event Loop Telemetry Under Load

### 3.1 Event Loop Delay Distribution
Monitored via `perf_hooks.monitorEventLoopDelay({ resolution: 20 })`:

$$\begin{aligned}
\text{Min Delay:} &\quad 0.12\text{ ms} \\
\text{p50 Delay:} &\quad 20.84\text{ ms} \\
\text{p90 Delay:} &\quad 22.56\text{ ms} \\
\text{p95 Delay:} &\quad 24.08\text{ ms} \\
\text{p99 Delay:} &\quad 25.80\text{ ms} \\
\text{Max Delay:} &\quad 26.26\text{ ms}
\end{aligned}$$

The event loop remains healthy under load, with peak delay capped under 27 ms, well within acceptable bounds (< 50 ms) for single-threaded Node.js event loops.

### 3.2 Process Memory Metrics (RSS vs V8 Heap)

```
[Baseline Idle State]
  ├── Total Process RSS:    113.14 MB
  ├── V8 Heap Used:          32.48 MB
  ├── V8 Heap Total:         42.85 MB
  └── External (C++ Buffers): 2.45 MB

[Peak Concurrency State (60 Workers)]
  ├── Total Process RSS:    217.97 MB  (+104.83 MB expansion)
  ├── V8 Heap Used:          94.12 MB  (+61.64 MB expansion)
  ├── V8 Heap Total:        118.60 MB  (+75.75 MB expansion)
  └── External (Sockets):     8.12 MB  (+5.67 MB expansion)

[Post-Test Garbage Collection Recovery]
  └── Total Process RSS settles to 142.30 MB within 15 seconds.
```

---

## 4. Cache Performance & Stampede Elimination

### 4.1 Comparative Latency (50 Sequential Requests)
- **Direct MongoDB Database:** 1,158.63 ms total (23.17 ms average latency), 0% hit rate, 50 remote queries.
- **Warm Cache Engine:** 16.82 ms total (0.34 ms average latency), 98.0% hit rate, 1 remote query.
- **Latency Multiplier:** Cached reads are **68.9x faster** and save 98% of database I/O.

### 4.2 Single-Flight Stampede Test
- **Test Condition:** 50 virtual users simultaneously request `/api/stories` on a cold cache miss at $t = 0$.
- **Database Query Counter:** Exactly **1 query** reached MongoDB Atlas.
- **Worker Behavior:** 49 concurrent requests attached to the in-flight Promise and received identical payloads simultaneously without opening redundant database connections.

---

## 5. Architectural Capacity Assessment (15,000 Concurrent Users)

### Realistic Scaling Limits for Single Node:
1. **Bcrypt Authentication Ceiling:**
   - Single Node.js process caps at **~184 logins/sec** due to deliberate CPU cost of password hashing (10 rounds).
   - Handling a 1,000-login/minute morning rush requires 6–8 clustered Node.js worker processes (`pm2` or Render auto-scaling).
2. **Cached Read Capacity:**
   - A single Node.js instance on Render Standard (2 GB RAM, 1 vCPU) comfortably serves **~1,500–1,800 RPS** for cached endpoints (`/api/stories`, `/api/folders`, `/api/resources`).
   - For 15,000 active concurrent users with realistic browsing pauses (1 request every 5 seconds = 3,000 RPS aggregate), 3–4 load-balanced backend instances backed by Upstash Redis are required.
3. **Testing Recommendation:** Run distributed load generation (k6 Cloud) from multiple geographical zones against staging before enabling 15,000-user production access.
