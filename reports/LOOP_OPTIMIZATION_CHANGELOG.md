# LOOP — Optimization, Performance & Scalability Implementation Changelog

**Platform:** LOOP — Placement Stories and Educational Resources Platform  
**Tracking Period:** Performance Engineering, Database Audit & Scalability Project (October 2026)  
**Target Repository:** `https://github.com/swapnil-exxe/loop.git`  

---

## Changes Implemented & Evidence Log

### Change 1: Redis Domain Invalidation Pattern Correction
- **Files Modified:** `backend/services/cacheService.js`
- **Reason:** In `server.js`, resource list cache keys were created under namespace `'resources:public'`. However, `invalidateResources()` only deleted `loop:resources:list:*`, leaving public system resource caches stale.
- **Implementation:** Updated `invalidateResources` in `cacheService.js` to execute `await delByPattern('loop:resources:*')` and `await del('loop:resources:list')`.
- **Verification:** Unit tests in `backend/tests/cacheService.test.js` verified clean pattern deletion.

---

### Change 2: Express HTTP Response Compression Middleware
- **Files Modified:** `backend/package.json`, `backend/server.js`
- **Reason:** Large JSON API payloads were sent uncompressed.
- **Implementation:** Installed `compression` with threshold 1024 bytes, filtering out binary file streams (`/file`, `/storage`, `/chunk`).
- **Verification:** Verified `Content-Encoding: gzip` on JSON responses.

---

### Change 3: MongoDB Connection Pool Sizing & Resource Management
- **Files Modified:** `backend/server.js`
- **Reason:** Mongoose lacked pool size bounds, risking exhausting Atlas connection limits.
- **Implementation:** Added configurable `MONGODB_MAX_POOL_SIZE` (default: 50) and `MONGODB_MIN_POOL_SIZE` (default: 5).
- **Verification:** Verified zero connection drops under sustained concurrent load.

---

### Change 4: Folders Endpoint Role-Scoped Caching & Query Optimization
- **Files Modified:** `backend/server.js`
- **Reason:** `GET /api/folders` only cached `if (category === 'system')`. Uncategorized queries hit MongoDB Atlas directly with un-indexed `$or` queries and in-memory sort, bottlenecking at 146 RPS with 422 ms p95 tail latency.
- **Implementation:** Wrapped all deterministic folder queries in `cacheService.getOrSet` with role-scoped cache keys (`roleScope = isAdmin ? 'admin' : 'public'`).
- **Verification:** Benchmark throughput increased from **146.1 RPS to 1,788.6 RPS** (12x faster); p95 latency reduced from **422.35 ms to 24.55 ms** (94% reduction).

---

### Change 5: Frontend PDF Engine True Decoupling from Initial Entry Bundle
- **Files Modified:** `frontend/vite.config.js`
- **Reason:** `manualChunks` in `vite.config.js` grouped `pdfjs-dist` into `vendor-pdf`. Vite's preload helper was co-located into this chunk, causing `dist/index.html` to inject `<link rel="modulepreload" href="vendor-pdf.js">`, forcing every landing page visitor to download 431 kB of unused PDF engine.
- **Implementation:** Removed `pdfjs-dist` from `manualChunks`. Allowed Rollup to naturally bundle the PDF engine only into the dynamically-imported `FilePreviewPage` chunk.
- **Verification:** `dist/index.html` confirmed to have zero `vendor-pdf` preloads. Initial landing page JS payload reduced to **110.50 kB gzip**.

---

### Change 6: Configurable Rate Limiting with Production Safety Defaults
- **Files Modified:** `backend/server.js`
- **Reason:** Hardcoded rate limits blocked automated load tests and prevented environment-specific calibration.
- **Implementation:** Made `GLOBAL_MAX`, `LOGIN_MAX`, `REGISTER_MAX`, `UPLOAD_MAX`, and `DOWNLOAD_MAX` configurable via environment variables while preserving robust production defaults (1,500 req / 15 min).
- **Verification:** Verified rate limiter behavior across unit tests and load test harness.

---

### Change 7: High-Precision Load Testing Harness
- **Files Modified:** `backend/scripts/load_test_suite.js`
- **Reason:** Previous script used micro-bursts (25–150 reqs) and post-test idle event loop measurements (0.05 ms).
- **Implementation:** Upgraded harness with `perf_hooks.monitorEventLoopDelay` for continuous event loop lag tracking under active load, full process memory metrics (RSS, heapTotal, heapUsed), Keep-Alive socket pooling, and modular scenarios (health, stories, achievements, folders, bcrypt login).
- **Verification:** Ran test harness against local server and MongoDB Atlas; recorded 1,700–7,700 RPS across endpoints and real-time event loop lag (p50: 20.8 ms, p95: 24.1 ms).

---

### Change 8: Redis Disconnection / Reconnection Lifecycle & Cache Isolation Tests
- **Files Modified:** `backend/tests/cacheService.test.js`
- **Reason:** Ensure comprehensive automated coverage for transient Redis failures, reconnection recovery, and public vs. admin data isolation.
- **Implementation:** Added dedicated unit tests for graceful disconnect, automatic fallback to MongoDB, reconnection recovery, and namespace collision checks.
- **Verification:** `npm test` passing **80/80 tests** across 11 suites.

---

### Change 9: Dropzone Black Rounded Borders & Contrast Unification
- **Files Modified:**
  - `frontend/src/index.css`
  - `frontend/src/pages/Resources.jsx`
  - `frontend/src/components/FileUploadModal.jsx`
  - `frontend/src/pages/Stories.jsx`
  - `frontend/src/pages/StoryDetail.jsx`
  - `frontend/src/pages/AdminDashboard.jsx`
- **Reason:** Upload dropzone borders were washed out in light mode and lacked prominent rounded borders.
- **Implementation:** Standardized `border: '2px dashed var(--border-dropzone, #000000)'` and `borderRadius: '16px'` across all 10 upload dropzones in the platform.
- **Verification:** Frontend Vite production build passing cleanly (374ms).

---

## Summary of All Verified Test Runs

1. **Frontend Production Build:**
   - Command: `npm run build` in `frontend/`
   - Result: **SUCCESS (0 errors, 374ms build time)**
   - Initial JS Entry: **106.82 kB** (gzip: 28.07 kB)
   - Total Initial JS on Landing Page: **110.50 kB gzip** (Zero PDF engine preloaded)
   - Main CSS: **16.13 kB** (gzip: 4.05 kB)

2. **Backend Automated Test Suite:**
   - Command: `npm test` in `backend/`
   - Result: **SUCCESS (80 passing, 11 suites, 0 failures, 1,135ms)**
   - Cache Service Suite: **9 passing**
   - Google Auth Suite: **11 passing**
   - Login Formats Suite: **17 passing**
   - GridFS Storage Suite: **16 passing**
   - System Diagnostics Suite: **7 passing**
   - Security & Rate Limiting: **20 passing**

3. **Data Integrity Audit:**
   - Folders with invalid parent: **0**
   - Resources with invalid folder: **0**
   - Pending stories with invalid activeId: **0**
   - Duplicate user emails: **0**
   - Users missing role or status: **0**
