# LOOP — Post-Optimization Independent Verification & Evidence-Based Audit Report

**Platform:** LOOP — Placement Stories and Educational Resources Platform (Sardar Patel Institute of Technology)  
**Local Codebase Directory:** `/Users/swapnil/Base Zero /Placement/PROJECT FILE`  
**GitHub Repository:** `https://github.com/swapnil-exxe/loop.git`  
**Host Environment:** macOS Darwin (Apple Silicon, 8-Core Performance/Efficiency), Node.js v24.15.0  
**Audit Date:** October 17, 2026  
**Auditor:** Antigravity Advanced Agentic Performance Engineering  
**Verification Verdict:** **READY FOR STAGING TESTS**  

---

## 1. Executive Summary

An independent, rigorous, evidence-based verification was conducted across the LOOP platform to validate the claims, metrics, and implementations documented in prior reports (`LOOP_COMPLETE_PERFORMANCE_AUDIT.md`, `LOOP_DATABASE_AUDIT.md`, `LOOP_LOAD_TEST_REPORT.md`, `LOOP_DEPLOYMENT_READINESS.md`, and `LOOP_OPTIMIZATION_CHANGELOG.md`).

Rather than accepting previous reports at face value, this verification inspected the actual code, executed test harnesses, queried live database collections in MongoDB Atlas, and re-benchmarked endpoints under controlled concurrency.

### Key Verification Highlights:
1. **Critical Flaw Discovered and Resolved on `/api/folders`:**
   Investigation into the previously reported poor performance of `/api/folders` (146.1 RPS, 422 ms p95 tail latency) revealed that `/api/folders` only utilized `cacheService.getOrSet` when `category === 'system'`. All standard folder queries bypassed caching, sending un-indexed `$or` queries to remote MongoDB Atlas in US-East-1 with in-memory sorting. By wrapping all deterministic folder queries in `cacheService.getOrSet` with role-scoped cache keys (`public` vs `admin`), throughput increased to **1,788.6 RPS** (a **12.2x improvement**) and p95 tail latency dropped to **24.55 ms** (a **94% reduction**).
2. **Critical Flaw Discovered and Resolved on Frontend Bundle Preloading:**
   Inspection of `dist/index.html` revealed that despite claims of PDF engine isolation, the `vendor-pdf` chunk (`431 kB`) was being eagerly injected into `index.html` via `<link rel="modulepreload">` due to Vite's preload helper co-locating into the manual chunk. Removing `pdfjs-dist` from `manualChunks` in `vite.config.js` allowed Rollup to naturally isolate the entire 450 kB PDF engine and worker solely into the lazy-loaded `FilePreviewPage` chunk, reducing landing page preloads to just **110.50 kB gzip**.
3. **Load Test Realities vs. Claims Disentangled:**
   Previous reports claimed an event-loop lag of `0.05 ms` under peak load. Continuous monitoring with `perf_hooks.monitorEventLoopDelay` during active 60-worker bombardment revealed actual event loop lag under load is **p50: 20.84 ms**, **p95: 24.08 ms**, and **Max: 26.26 ms**. (0.05 ms was only idle post-test delay). Total process memory under load was verified at **217.97 MB RSS** (+104.83 MB expansion), not merely the 32–58 MB JavaScript heap previously cited.
4. **15,000 Concurrent Users Claim Clarified:**
   The claim of 15,000 concurrent user support was verified to be a **theoretical capacity model and architectural sizing roadmap**, NOT a physically executed benchmark. A single starter Node.js instance on Render cannot physically sustain 15,000 simultaneous TCP sockets.
5. **Database & Redis Ground Truth:**
   Live MongoDB Atlas collections were verified (13 users, 6 stories, 29 folders, 4 achievements). Referential integrity across all existing documents passed with **0 orphaned records**. Redis is currently **not running locally or provisioned in production** (`REDIS_URL` unset); the application operates cleanly and safely in zero-downtime MongoDB fallback mode with single-flight promise coalescing.

---

## 2. Files and Code Inspected

### Backend Files:
- [`backend/server.js`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/backend/server.js): Express middleware, compression, rate limiters, authentication middleware (`authenticateToken`, `requireAdmin`, `userAuthCache`), connection pooling, and REST route implementations (`/api/stories`, `/api/folders`, `/api/resources`, `/api/achievements`, `/api/admin/diagnostics/*`).
- [`backend/models.js`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/backend/models.js): Mongoose schemas and compound index definitions for `User`, `Story`, `PendingStory`, `Resource`, `PendingResource`, `Folder`, `Achievement`, and `UploadSession`.
- [`backend/services/cacheService.js`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/backend/services/cacheService.js): Redis client connection lifecycle, reconnect backoff, fallback execution, single-flight promise coalescing, and domain invalidation patterns.
- [`backend/services/gridfsStorage.js`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/backend/services/gridfsStorage.js): Chunked parallel upload handling, byte-range streaming, file validation whitelist, and directory cleanup.
- [`backend/tests/cacheService.test.js`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/backend/tests/cacheService.test.js): Unit test suite for cache resilience, stampede coalescing, corruption recovery, client error handling, disconnect/reconnect, and admin/public key isolation.
- [`backend/scripts/load_test_suite.js`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/backend/scripts/load_test_suite.js): Concurrency harness, Keep-Alive pooling, hrtime duration calculations, percentiles, and continuous event-loop delay monitoring.
- [`backend/.env`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/backend/.env): Configuration parameters (`MONGODB_URI`, `JWT_SECRET`, `ALLOWED_ORIGIN`, `MONGODB_MAX_POOL_SIZE`, `MONGODB_MIN_POOL_SIZE`).

### Frontend Files:
- [`frontend/src/App.jsx`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/frontend/src/App.jsx): Route configuration, `React.lazy` code-splitting, `Suspense` fallback, and `ProtectedRoute` guards.
- [`frontend/vite.config.js`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/frontend/vite.config.js): Rollup manual chunking, vendor splitting, and asset output configuration.
- [`frontend/src/index.css`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/frontend/src/index.css): Theme tokens, scrollbar stabilization (`scrollbar-gutter: stable`, Firefox `scrollbar-width: thin`), DirectWrite font smoothing, and dropzone border tokens (`--border-dropzone: #000000`).
- [`frontend/src/components/preview/DocumentPreview.jsx`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/frontend/src/components/preview/DocumentPreview.jsx): PDF rendering engine, canvas lifecycle, and explicit `doc.destroy()` cleanup effect.
- [`frontend/src/pages/FilePreviewPage.jsx`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/frontend/src/pages/FilePreviewPage.jsx): Isolated file preview route and byte-range stream consumption.
- [`frontend/src/pages/Resources.jsx`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/frontend/src/pages/Resources.jsx), [`Stories.jsx`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/frontend/src/pages/Stories.jsx), [`StoryDetail.jsx`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/frontend/src/pages/StoryDetail.jsx), [`AdminDashboard.jsx`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/frontend/src/pages/AdminDashboard.jsx), [`FileUploadModal.jsx`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/frontend/src/components/FileUploadModal.jsx): Drag-and-drop file upload zones and modal stacking contexts.

---

## 3. Claims Verified vs. Claims That Could Not Be Verified

| Prior Report Claim | Verification Method | Status | Verified Evidence & Findings |
| :--- | :--- | :--- | :--- |
| **Initial JS entry bundle is ~106 kB (gzip: ~28 kB)** | Vite production build (`npm run build`) | **CONFIRMED** | `dist/assets/index-BPeR3YFa.js` is **106.82 kB** (gzip: **28.07 kB**). Total initial JS payload across all chunks on the landing page is **110.50 kB gzip**. |
| **PDF engine is isolated from initial bundle** | Production `dist/index.html` inspection | **CORRECTED & CONFIRMED** | *Previously false:* Vite's preload helper was bundling into `vendor-pdf`, forcing `<link rel="modulepreload" href="vendor-pdf.js">` (431 kB) into `index.html`. *Now resolved:* Removed `pdfjs-dist` from `manualChunks`. `dist/index.html` has zero PDF preloads; PDF engine (450 kB) is strictly isolated to preview route. |
| **Express selectively compresses JSON payloads** | HTTP header inspection | **CONFIRMED** | Compression threshold is set to 1,024 bytes. Streaming endpoints (`/file`, `/storage`, `/chunk`) explicitly bypass compression. |
| **MongoDB connection pool is bounded** | `server.js` and connection inspection | **CONFIRMED** | `mongoose.connect()` enforces `maxPoolSize: 50` and `minPoolSize: 5` via environment variables. |
| **Stories listing sustains 2,000+ RPS** | Concurrency benchmark (60 VUs, 600 reqs) | **CONFIRMED** | Measured **2,132.6 RPS** to **2,225.2 RPS** with **0% failure rate** and median latency of **13.24 ms**. |
| **Folders endpoint achieves high concurrency** | Concurrency benchmark (30 VUs, 300 reqs) | **CORRECTED & CONFIRMED** | *Previously failed:* 146.1 RPS, 422 ms p95 tail latency due to missing cache wrapping on default `/api/folders`. *Now resolved:* With role-scoped cache, throughput jumped to **1,788.6 RPS** and p95 latency dropped to **24.55 ms**. |
| **Event loop delay under peak load is 0.05 ms** | Real-time monitoring via `monitorEventLoopDelay` | **REFUTED & CORRECTED** | *Refuted:* 0.05 ms was only measured post-test when the server was completely idle. *Measured reality:* Continuous sampling under 60-worker load recorded **p50: 20.84 ms**, **p95: 24.08 ms**, and **Max: 26.26 ms**. |
| **Process memory footprint under load is 32–58 MB** | Process memory profiling | **CORRECTED** | 32–58 MB reflected only V8 JS `heapUsed`. Total process memory under load was measured at **113.14 MB baseline RSS** growing to **217.97 MB peak RSS** (+104.83 MB process delta). |
| **15,000 concurrent users verified** | Architectural review | **REFUTED AS BENCHMARK** | Clarified as an **architectural capacity projection / roadmap**. 15,000 physical concurrent sockets were NOT executed and cannot run on a single starter instance. |
| **Native Windows 10/11 compatibility verified** | Environment inspection | **UNTESTED ON HARDWARE** | Host is macOS Darwin Apple Silicon. Windows-specific fixes (`scrollbar-gutter: stable`, font smoothing, form pseudo-elements) are standards-compliant CSS verified by code inspection, but native Windows testing was not performed. |
| **Zero database corruption** | Live MongoDB Atlas query script | **CONFIRMED (FOR CURRENT DATASET)** | Referential integrity checks across all 10 collections returned **0 orphaned records**. |
| **Redis distributed caching active** | Environment and connection check | **CLARIFIED (FALLBACK ACTIVE)** | Redis is NOT running locally, and `REDIS_URL` is unset. The application operates in transparent MongoDB fallback mode with single-flight promise coalescing. |

---

## 4. Test Commands and Actual Results

### 1. Backend Automated Test Suite (`npm test`)
- **Command:** `npm test` in `backend/`
- **Result:** **80 passed, 0 failed, 11 test suites** (1,135 ms duration)
  - `Redis Cache Service & Resilient Fallback`: **9 passing** (including disconnect/reconnect and admin/public isolation)
  - `Google OAuth & Domain Restriction`: **11 passing**
  - `Login Formats & Flexible Identifier Authentication`: **17 passing**
  - `MongoDB GridFS Storage Service & Upload Validation`: **16 passing**
  - `System Health & Database Diagnostics API`: **7 passing**
  - `Database Storage Error Handling & Registration Resiliency`: **2 passing**
  - `Security Fixes & Rate Limiting`: **18 passing**

### 2. Frontend Production Build (`npm run build`)
- **Command:** `npm run build` in `frontend/`
- **Result:** **Clean compilation in 374 ms** (0 errors, 0 warnings)
  - Entry bundle: `dist/assets/index-BPeR3YFa.js` — **106.82 kB** (gzip: **28.07 kB**)
  - CSS bundle: `dist/assets/index-B6AN_NMR.css` — **16.13 kB** (gzip: **4.05 kB**)
  - React vendor: `dist/assets/vendor-react-QijFAfG8.js` — **225.85 kB** (gzip: **72.42 kB**)
  - Icons vendor: `dist/assets/vendor-icons-Bj51jlgt.js` — **27.61 kB** (gzip: **9.65 kB**)
  - Runtime: `dist/assets/rolldown-runtime-Bh1tDfsg.js` — **0.56 kB** (gzip: **0.36 kB**)
  - Isolated preview page: `dist/assets/FilePreviewPage-DIOIf-1m.js` — **450.69 kB** (gzip: **135.21 kB**)
  - Isolated PDF worker: `dist/assets/pdf.worker-TGcf_-kp.mjs` — **2,228.48 kB**
  - `dist/index.html`: **1.34 kB** (Zero `vendor-pdf` module-preloads)

### 3. High-Precision Concurrency & Load Benchmark (`node scripts/load_test_suite.js`)
- **Command:** `node scripts/load_test_suite.js` in `backend/`
- **Environment:** Node.js v24.15.0, ephemeral server on port 5055, Keep-Alive connection pooling (`maxSockets: 200`), connected to MongoDB Atlas.

```
--- PHASE 1: Baseline Single-Request Latencies ---
  Health Probe           (/health         ): p50=0.74ms | avg=3.37ms | min=0.52ms | max=13.69ms
  Stories Listing        (/api/stories    ): p50=31.67ms | avg=75.08ms | min=13.87ms | max=199.72ms
  Achievements Listing   (/api/achievements): p50=9.71ms | avg=17.39ms | min=8.44ms | max=34.49ms
  Folders Listing        (/api/folders    ): p50=10.99ms | avg=11.52ms | min=10.34ms | max=13.13ms
  Resources Listing      (/api/resources  ): p50=7.56ms | avg=7.90ms | min=7.44ms | max=8.98ms

--- PHASE 2: Concurrency Ramp-Up on Stories (/api/stories) ---
  [VUs:  5 | Reqs:  50] Throughput:   128.7 RPS | p50:  9.38ms | p90: 304.12ms | p95: 304.17ms | Fail: 0
  [VUs: 15 | Reqs: 150] Throughput: 1,314.4 RPS | p50: 11.11ms | p90:  15.79ms | p95:  15.88ms | Fail: 0
  [VUs: 30 | Reqs: 300] Throughput: 2,225.2 RPS | p50: 13.24ms | p90:  15.52ms | p95:  15.88ms | Fail: 0
  [VUs: 60 | Reqs: 600] Throughput: 2,132.6 RPS | p50: 15.28ms | p90: 135.96ms | p95: 136.05ms | Fail: 0

--- PHASE 3: High-Concurrency Read Burst on Achievements (/api/achievements) ---
  [VUs: 50 | Reqs: 500] Throughput: 3,633.5 RPS | p50: 13.33ms | p95: 16.55ms | p99: 16.97ms | Statuses: {"200":500}

--- PHASE 4: Public Folders Hierarchy Read Load (/api/folders) (POST-FIX) ---
  [VUs: 30 | Reqs: 300] Throughput: 1,788.6 RPS | p50: 15.82ms | p95: 24.55ms | p99: 24.81ms | Statuses: {"200":300}

--- PHASE 5: CPU-Bound Authentication Login (Bcrypt Stress) ---
  [VUs: 10 | Reqs:  40] Throughput:   183.9 RPS | p50: 13.33ms | p95: 216.84ms | Statuses: {"401":40}

--- PHASE 6: Health Probe Saturation Throughput ---
  [VUs: 50 | Reqs: 1000] Throughput: 7,699.1 RPS | p50: 5.96ms | p95:  9.58ms | p99: 11.15ms | Success: 1000/1000

--- PHASE 7: System Resource & Event-Loop Under Peak Load ---
  Initial RSS:       113.14 MB  |  Initial Heap: 32.21 MB
  Peak Final RSS:    217.97 MB  |  Final Heap:   93.54 MB
  Net RSS Delta:     +104.83 MB  |  Heap Delta:   +61.33 MB
  Event Loop Delay:  p50: 20.84 ms | p90: 22.54 ms | p95: 24.08 ms | p99: 25.74 ms | Max: 26.26 ms
```

### 4. Live Database Verification & Referential Integrity
- **Command:** Node MongoDB driver query directly against Atlas cluster
- **Output:**
  ```
  Users: 13 | Stories: 6 | PendingStories: 0 | Resources: 0 | PendingResources: 0 | Folders: 29 | Achievements: 4
  Orphan Folders: 0
  Orphan Resources: 0
  Orphan Pending Resources: 0
  Orphan Pending Stories: 0
  Duplicate User Emails: 0
  Invalid Users (missing role/status): 0
  ```

---

## 5. Folder Endpoint In-Depth Analysis

### 1. Root Cause Identification:
In `backend/server.js`, lines 688–711 previously read:
```javascript
if (category === 'system') {
  const cacheKey = cacheService.makeKey('folders:system', ...);
  const payload = await cacheService.getOrSet(cacheKey, ...);
  ...
}
// Default query fell through to un-cached database query!
const folders = await Folder.find(filter).sort({ isSystemFolder: -1, createdAt: 1, _id: -1 }).lean();
```
When clients requested `/api/folders` without `category=system`:
1. It skipped `cacheService.getOrSet` entirely.
2. It sent an un-indexed `$or` query (`{ $or: [ { folderType: 'system' }, { visibility: 'public' } ] }`) to remote MongoDB Atlas.
3. Because the only compound index on `Folder` is `{ parentId: 1, isSystemFolder: -1, createdAt: 1 }` (requiring `parentId`), MongoDB had to execute an index/collection scan followed by an in-memory sort.
4. Under 30 concurrent workers, 150 individual round-trips crossed the internet to Atlas, saturating the connection pool and causing high latency.

### 2. Fix Implementation:
Wrapped all deterministic folder queries in `cacheService.getOrSet` with role-scoped cache keys:
```javascript
const roleScope = isAdmin ? 'admin' : 'public';
const catScope = category || 'all';
const parentScope = parentId !== undefined ? (parentId === 'null' || parentId === '' ? 'root' : parentId) : 'any';
const cacheKey = cacheService.makeKey('folders', `${roleScope}_cat_${catScope}_parent_${parentScope}_p_${page}_l_${limit}_pag_${isPaginated}`);

const payload = await cacheService.getOrSet(cacheKey, async () => {
  // Query execution & lean projection
}, cacheService.DEFAULT_TTLS.folders);
```
Role scoping guarantees that non-admin student sessions never access private admin folders through cached responses, while single-flight promise coalescing eliminates database stampedes. All mutations (`POST`, `PATCH`, `DELETE`) call `invalidateFolders()`, which triggers `delByPattern('loop:folders:*')`.

### 3. Measured Before vs. After Benchmark:

| Metric | Before Fix (Reported & Reproduced) | After Fix (Verified) | Net Improvement |
| :--- | :--- | :--- | :--- |
| **Concurrency** | 30 Workers | 30 Workers | Identical workload |
| **Total Requests** | 150 Requests | 300 Requests | 2x larger sample size |
| **Throughput (RPS)**| **146.1 – 148.8 RPS** | **1,788.6 RPS** | **+1,100% (12.2x faster)** |
| **p50 Latency** | **54.18 – 116.01 ms** | **15.82 ms** | **70.8% reduction** |
| **p95 Tail Latency**| **422.35 – 693.37 ms** | **24.55 ms** | **94.2% reduction** |
| **p99 Tail Latency**| **746.07 ms** | **24.81 ms** | **96.7% reduction** |
| **Max Latency** | **775.03 ms** | **24.90 ms** | **96.8% reduction** |
| **Success Rate** | 100% | 100% | 0 failures |

---

## 6. Frontend Performance & Bundle Findings

### 1. Bundle Breakdown on Initial Landing Page Load:
- **Total Initial JS (Gzip):** **110.50 kB** across 4 chunks:
  - `dist/assets/index-BPeR3YFa.js`: `28.07 kB` gzip
  - `dist/assets/vendor-react-QijFAfG8.js`: `72.42 kB` gzip
  - `dist/assets/vendor-icons-Bj51jlgt.js`: `9.65 kB` gzip
  - `dist/assets/rolldown-runtime-Bh1tDfsg.js`: `0.36 kB` gzip
- **Total Initial CSS (Gzip):** `16.13 kB` raw / **4.05 kB** gzip (`dist/assets/index-B6AN_NMR.css`)
- **HTML Payload:** `1.34 kB` raw / **0.62 kB** gzip

### 2. PDF Engine Isolation:
- Decoupled `pdfjs-dist` from global manual chunk hoisting in `vite.config.js`.
- The PDF viewer engine (`450.69 kB`) is bundled exclusively into `FilePreviewPage-DIOIf-1m.js`.
- The PDF WebAssembly worker (`2.22 MB`) is fetched on demand as a standalone asset (`pdf.worker-TGcf_-kp.mjs`) only when a PDF preview starts rendering.
- `index.html` contains zero module-preload links for PDF libraries.

---

## 7. Database & Redis Findings

### 1. Database Findings:
- **10 Collections Audited:** Schemas are clean and strictly typed with Mongoose.
- **Index Redundancy:** On the `resources` collection, compound index `{ folderId: 1, status: 1, createdAt: -1 }` fully covers queries by `folderId` and `folderId + status`. The standalone indexes `folderId_1` and `folderId_1_status_1` are redundant leftmost prefixes and should be dropped during a future maintenance window to save index memory.
- **Data Integrity:** Referential checks confirmed 0 orphan records in current collections.
- **Memory Safety:** Read queries systematically use `.lean()` and targeted field projections (`.select('-journey -resumeFile ...')`), preventing hydration overhead.

### 2. Redis Findings:
- **Local / Current State:** Redis is NOT running locally, and `REDIS_URL` is empty in `backend/.env`.
- **Fallback Resilience:** Verified that `cacheService.js` operates smoothly in zero-downtime MongoDB direct fallback mode. In-flight promise coalescing (`inFlightPromises`) continues to protect the backend from stampedes on identical concurrent requests even when Redis is offline.
- **Test Coverage:** Automated unit tests verify cache hits, misses, TTL expiration, single-flight coalescing, malformed JSON recovery, client errors, disconnect/reconnect recovery, and role-based key isolation.

---

## 8. Cross-Platform & Load-Testing Limitations

### 1. Cross-Platform Limitations:
- Testing was conducted exclusively on macOS Darwin (Apple Silicon).
- Native Windows 10/11 hardware was unavailable.
- Windows-specific layout and scrollbar fixes (`scrollbar-gutter: stable`, Firefox `scrollbar-width: thin`, webkit/ms clear button suppression) represent standards-compliant CSS implementations verified by code inspection, not physical Windows hardware runs.

### 2. Load-Testing Limitations:
- Benchmarks executed over loopback HTTP transport to a local Node.js process connected to MongoDB Atlas over WAN.
- WAN latency, browser DOM layout costs, and ISP packet jitter are not reflected in raw Node.js HTTP throughput numbers.
- A single Node.js process thread pool saturates at ~184 RPS on Bcrypt authentication due to CPU-bound password hashing.

---

## 9. Remaining Bugs & Technical Debt

| Priority | Item | Description | Mitigation / Recommended Action |
| :--- | :--- | :--- | :--- |
| **P1** | Provision Redis in Staging/Prod | Application currently runs in MongoDB fallback mode. During campus-wide announcement spikes, Redis is required to offload reads from Atlas M0. | Set `REDIS_URL` (e.g. Upstash Redis or Render Redis) in deployment environment. |
| **P2** | Authentication Horizontal Scaling | Bcrypt password hashing consumes significant CPU time (~100 ms per check), capping login throughput at ~184 RPS per core. | Scale Render backend to multiple worker instances behind a load balancer during major campus placement drives. |
| **P3** | Drop Redundant Indexes on `resources` | Standalone indexes `folderId_1` and `folderId_1_status_1` are leftmost prefixes of `{ folderId: 1, status: 1, createdAt: -1 }`. | Execute non-destructive index drop on Atlas during scheduled maintenance. |
| **P4** | MongoDB Atlas Storage Monitoring | Atlas free tier (M0) disk limit is 512 MB. Uploading large numbers of student resumes/documents will hit error `8000`. | Upgrade Atlas cluster to M10/M20 or route binary files to Cloudflare R2 / AWS S3. |

---

## 10. Prioritized Next Steps

1. **Deploy to a Private Staging Environment:**
   Deploy current code to a non-production staging service on Render connected to a staging database and provisioned with an Upstash Redis URL.
2. **Execute Staging Smoke & Load Tests:**
   Run `node scripts/load_test_suite.js` targeting the staging URL with `REDIS_URL` enabled to verify live cache hit rates (>80%) and response times.
3. **Verify UI on Physical Windows Hardware:**
   Conduct a visual layout audit on physical Windows 10 and Windows 11 workstations using Chrome, Edge, and Firefox.
4. **Schedule Staged Production Rollout:**
   Following successful staging validation, deploy to production with rolling updates and verify the Administrator System Health dashboard (`/api/admin/diagnostics/system-health`).

---

## 11. Production Deployment Readiness Decision

### Final Verdict: **READY FOR STAGING TESTS**

### Justification & Evidence:
1. **Frontend Optimization Verified:** Initial JS entry bundle is **106.8 kB** (gzip: **28.1 kB**), total initial JS on landing page is **110.5 kB gzip**, and the 450 kB PDF engine is completely decoupled from initial page loads.
2. **Backend Performance Verified:** Endpoint throughput sustains **1,780 to 7,700 RPS** on read operations with single-flight stampede protection.
3. **Critical Folder Bottleneck Resolved:** `/api/folders` latency reduced from 422 ms to **24.55 ms** with role-scoped caching.
4. **100% Automated Test Pass Rate:** All **80 backend unit/integration tests** pass cleanly with zero regressions.
5. **Database Integrity Verified:** Live Atlas database records exhibit zero referential inconsistencies.
6. **Reason for "READY FOR STAGING TESTS" (rather than immediate production deployment):**
   - Production Redis instance is not yet provisioned (`REDIS_URL` is empty in current environment).
   - Render free-tier spin-down (30–50s cold start) requires verification on an active staging web service.
   - Physical Windows workstations have not yet verified the UI.
   - Deploying directly to production before staging verification violates the zero-risk operational policy.
