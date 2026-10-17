# LOOP — Production Deployment Readiness, Environment Configuration & Operational Runbook

**Platform:** LOOP — Placement Stories and Educational Resources Platform  
**Target Environments:** Vercel (Frontend), Render (Backend), MongoDB Atlas (Database), Upstash Redis (Distributed Cache)  
**Document Classification:** Production Operations & Deployment Guide  
**Date:** October 2026  
**Status:** Validated  

---

## 1. Required Environment Variables Specification

### Backend Environment Variables (`backend/.env` / Render Dashboard)

| Variable | Required | Default / Example | Purpose & Safety Constraints |
| :--- | :--- | :--- | :--- |
| `PORT` | Optional | `5001` | Local port; Render assigns automatically via `$PORT`. |
| `MONGODB_URI` | **CRITICAL** | `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority` | Connection string for MongoDB Atlas. Never commit to Git. |
| `JWT_SECRET` | **CRITICAL** | Minimum 32-character high-entropy secret | Used to sign and verify authentication tokens. Server halts on startup if missing or < 32 chars. |
| `ALLOWED_ORIGIN` | **CRITICAL** | `https://loop-seven-delta.vercel.app` | Comma-delimited list of allowed CORS browser origins. |
| `GOOGLE_CLIENT_ID` | Optional | `xxx.apps.googleusercontent.com` | Google OAuth client ID for institutional sign-in. |
| `GOOGLE_CLIENT_SECRET` | Optional | `GOCSPX-xxx` | Google OAuth secret. |
| `REDIS_URL` | Recommended | `rediss://default:token@cluster.upstash.io:6379` | Redis connection URL. If omitted, server runs in zero-downtime MongoDB fallback mode. |
| `REDIS_ENABLED` | Optional | `true` | Explicit toggle to enable or disable Redis caching. |
| `MONGODB_MAX_POOL_SIZE` | Optional | `50` | Maximum connections per Node.js worker instance. |
| `MONGODB_MIN_POOL_SIZE` | Optional | `5` | Minimum warm connections maintained in the pool. |
| `REDIS_TTL_STORIES` | Optional | `300` (5 minutes) | TTL in seconds for public stories cache. |
| `REDIS_TTL_RESOURCES` | Optional | `300` (5 minutes) | TTL in seconds for public resources cache. |
| `REDIS_TTL_ACHIEVEMENTS` | Optional | `600` (10 minutes) | TTL in seconds for institutional achievements cache. |
| `REDIS_TTL_FOLDERS` | Optional | `300` (5 minutes) | TTL in seconds for folder taxonomy cache. |

### Frontend Environment Variables (`frontend/.env` / Vercel Dashboard)

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | **CRITICAL** | `https://loop-backend-xxxx.onrender.com/api` | Base URL for backend REST API endpoints. |
| `VITE_GOOGLE_CLIENT_ID`| Optional | `xxx.apps.googleusercontent.com` | Client ID for Google Identity Services SDK. |

---

## 2. Hosting Architecture & Infrastructure Realities

### 1. Render Backend Hosting
- **Free Tier Limitations:**
  - Spins down after 15 minutes of inactivity. First incoming student request incurs a **30 to 50 second cold start delay**.
  - Limited to 512 MB RAM and shared 0.5 CPU. Not suitable for campus placement announcement days.
- **Recommended Tier for Production:**
  - **Render Paid Web Service (Starter or Standard, $7–$25/mo):**
    - Zero spin-down; always active.
    - Automatic TLS certificate management.
    - Zero-downtime rolling deploys.
    - Ability to scale to multiple instances under high load.

### 2. Vercel Frontend Hosting
- **Asset Delivery:**
  - Pure static HTML/JS/CSS output from Vite (`frontend/dist`).
  - Served via Vercel Global Edge Network with automatic Brotli compression, HTTP/2 multiplexing, and immutable chunk caching (`max-age=31536000, immutable`).
- **Client-Side Routing:**
  - `frontend/vercel.json` ensures all deep links (`/stories/:id`, `/resources`, `/login`) rewrite to `/index.html`.

### 3. MongoDB Atlas & Redis Architecture
- **Connection Budget Calculation:**
  ```
  Total Connections = (Backend Instances) * (MONGODB_MAX_POOL_SIZE) + Monitoring
  Example (3 Instances): 3 * 50 = 150 Connections (Well within M10 1,500 limit).
  ```
- **Redis Cluster:**
  - Supports non-blocking read scaling up to 10,000+ RPS.
  - Zero-downtime offline fallback: if Redis disconnects, MongoDB handles requests without 500 errors.

---

## 3. Pre-Deployment Verification Checklist

Execute these verification checks prior to deploying any production release:

```markdown
- [ ] 1. Repository Cleanliness:
      git status shows clean working tree with 0 untracked files or leftover debug logs.
- [ ] 2. Secrets Exclusion:
      Verify .env and credentials are not staged in Git commits.
- [ ] 3. Production Frontend Build:
      Run `npm run build` inside frontend/. Build must complete with 0 errors and output < 120 kB main chunk.
- [ ] 4. Automated Backend Test Suite:
      Run `npm test` inside backend/. All 79 automated test suites must pass (100% pass rate).
- [ ] 5. Database Connectivity & Ping:
      Backend establishes TLS connection to MongoDB Atlas and ping latency is < 50 ms.
- [ ] 6. CORS Whitelist:
      Ensure Vercel production domain is present in ALLOWED_ORIGIN in Render dashboard.
- [ ] 7. GridFS Parallel Upload Verification:
      Ensure temporary chunk directory permissions and cleanup timers are initialized.
- [ ] 8. JWT Secret Strength:
      Verify JWT_SECRET in production environment is >= 32 characters and cryptographically random.
```

---

## 4. Rollback Plan

If an unexpected runtime regression or database failure occurs after deployment:

1. **Frontend Rollback (Instant via Vercel):**
   - Navigate to **Vercel Project Dashboard** -> **Deployments**.
   - Locate the previous stable deployment (prior commit hash).
   - Click **Instant Rollback**. Vercel redirects edge traffic to the previous build in < 5 seconds.
2. **Backend Rollback (Render):**
   - In **Render Dashboard** -> **Web Service** -> **Deploys**.
   - Select the last passing deploy and click **Rollback to this deploy**.
   - Alternatively, execute:
     ```bash
     git revert <commit-hash>
     git push origin main
     ```
3. **Database Safeguard:**
   - No destructive migrations were performed. Collection schemas maintain full backward compatibility with previous application releases.

---

## 5. Live Production Monitoring & System Health

Administrators can monitor the live production health without external APM agents via the built-in System Health telemetry endpoint:

- **Endpoint:** `GET /api/admin/diagnostics/system-health` (Requires Administrator JWT)
- **Tracked Telemetry:**
  - `dbState`: Connected / Connecting / Disconnected
  - `databaseStorage`: Data size, total index size, and quota remaining
  - `eventLoopLag`: Real-time Node.js event-loop delay in milliseconds
  - `cacheService`: Redis connectivity, hit rate percentage, total hits, and misses
  - `apiMetrics`: Request count, 2xx/3xx/4xx/5xx status code distributions, response time percentiles
  - `rateLimitHits`: Number of throttled requests per 15-minute window
