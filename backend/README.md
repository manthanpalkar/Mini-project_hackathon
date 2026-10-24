# LOOP — Backend API Server & Persistence Engine
### *Limitless Opportunities, One Platform* • *Their Journey. Your Opportunity.*

[![Node](https://img.shields.io/badge/Node.js-Express_4.19-green?logo=node.js&style=flat-square)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas_%26_GridFS-brightgreen?logo=mongodb&style=flat-square)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-Cloud_Cache-red?logo=redis&style=flat-square)](https://redis.io/)
[![Tests](https://img.shields.io/badge/Automated_Tests-267_Passed_(28_Suites)-success?style=flat-square)](tests/)
[![Deployment](https://img.shields.io/badge/Deployed-Render-46E3B7?logo=render&style=flat-square)](https://loop-qnh9.onrender.com/)

The **LOOP Backend Engine** is the institutional REST API service for **LOOP (Limitless Opportunities, One Platform)** built with Node.js and Express for **Sardar Patel Institute of Technology (SPIT), Mumbai**. It provides authenticated access to placement experiences, high-speed binary streaming of academic files up to 200 MB via MongoDB GridFS, distributed caching with Redis, and automated moderation pipelines.

---

## Core Capabilities

1. **Placement Story Intelligence:**
   - Powers **430 verified placement stories** across 2024, 2025, 2026, and 2027.
   - Deterministic ID mapping guaranteeing immutable story URLs.
   - Comprehensive multi-faceted query indexing (passout year, branch, company, package range).
2. **High-Speed Binary Streaming (MongoDB GridFS):**
   - Direct streaming of student resumes and academic documents up to 200 MB with chunk validation.
   - Resilient multi-part chunked upload pipeline with lease timeouts and automated crash recovery.
   - Binary security enforcement: blocks executable files (`.exe`, `.sh`, `.bat`, `.cmd`, `.msi`) at the stream boundary.
3. **Sub-Millisecond Redis Distributed Caching:**
   - Caches hot endpoints (stories, public resources, folder trees) with event-driven domain invalidation.
   - Transparent, resilient fallback to in-memory caching and direct MongoDB queries when Redis is unavailable.
4. **Campus Identity & Institutional Security:**
   - Google OAuth 2.0 strictly locked to `@spit.ac.in` institutional Google accounts.
   - Salted bcrypt password hashing with rate-limited authentication boundaries (5 attempts per window).
   - Transactional 6-digit SHA-256 hashed OTP password resets delivered via Brevo.
   - Comprehensive audit logging tracking all administrative modifications and user sessions.
5. **Session Resilience & One-Click Demo Engine:**
   - Dedicated `POST /api/auth/demo-login` issuing genuine JWT sessions for Student and Admin roles with feature flag controls.
   - Intelligent cold-start fault tolerance: distinguishes Atlas reconnection latency from genuine token expiration (returns 503 instead of 401), preventing false session purges across container sleep cycles.

---

## Architecture & Directory Structure

```text
backend/
├── backups/                # Pre-migration database snapshots and point-in-time archives
├── models/                 # Mongoose schemas & data models
│   ├── ActivityLog.js      # Administrative user intelligence & audit trails
│   ├── Feedback.js         # Student feedback and platform bug reports
│   ├── Folder.js           # Hierarchical academic vault directory tree
│   ├── PendingResource.js  # Unapproved student study material submissions
│   ├── PendingStory.js     # Moderation queue for placement experiences
│   ├── Resource.js         # Approved academic resources & GridFS references
│   ├── Story.js            # Approved verified placement interview debriefs
│   ├── UploadSession.js    # Adaptive chunk lease tracking & crash recovery
│   └── User.js             # User accounts, hashed passwords & Google SSO IDs
├── reports/                # Extraction audits, performance metrics & test logs
├── scripts/                # Data extraction, OCR, migration & verification scripts
│   ├── extract_all_placement_years.py # 2024, 2025, 2027 extraction pipeline
│   ├── extract_placement_stories.py   # 2026 placement experience extraction
│   ├── ocr_pdf.swift                  # Apple Vision Framework OCR engine
│   └── audit_and_repair_source_fidelity.py # Idempotent source repair script
├── services/               # Core business logic services
│   ├── activityService.js  # Sanitized user audit logging service
│   ├── cacheService.js     # Redis distributed cache with single-flight stampede defense
│   ├── googleAuth.js       # Institutional Google OAuth 2.0 token verifier
│   └── storageService.js   # GridFS streaming, chunk assembly & upload validation
├── tests/                  # 220 Automated Node.js native test suites (26 suites)
│   ├── activityLogs.test.js
│   ├── cacheService.test.js
│   ├── demoLoginAndSessionHardening.test.js # Demo auth & session cold-start tests
│   ├── googleAuth.test.js
│   ├── scalabilityPhase1.test.js
│   ├── securityFixes.test.js
│   ├── server.test.js
│   └── storageService.test.js
├── .env.example            # Environment configuration template
├── models.js               # Legacy schema compatibility re-exporter
├── package.json            # Node.js dependencies & test scripts
└── server.js               # Express application entry point & route definitions
```

---

## API Endpoints Reference

### Authentication & User Identity
* `POST /api/auth/register` — Register a student account (restricted to `@spit.ac.in`).
* `POST /api/auth/login` — Authenticate with email/password; returns sliding JWT session.
* `POST /api/auth/demo-login` — Authenticate via one-click demo login (role: `student` or `admin`).
* `POST /api/auth/google` — Authenticate or sign up via Google Identity Services (`@spit.ac.in` verified).
* `POST /api/auth/forgot-password` — Request a 6-digit hashed OTP via Brevo.
* `POST /api/auth/verify-otp` — Verify OTP token.
* `POST /api/auth/reset-password` — Set a new password using verified OTP token.

### Placement Stories
* `GET /api/stories` — Retrieve approved placement stories with multi-parameter filtering.
* `GET /api/stories/:id` — Retrieve single placement story with complete interview debrief.
* `POST /api/stories` — Submit a new placement story (routed to moderation queue).
* `PUT /api/stories/:id` — Update story details (admin or author).
* `DELETE /api/stories/:id` — Remove story (admin only).

### Academic Resources & GridFS Streaming
* `GET /api/resources` — List approved academic materials.
* `GET /api/resources/:id/file` — Stream binary document directly from GridFS.
* `POST /api/resources/upload/init` — Initialize adaptive chunked upload session.
* `PUT /api/resources/upload/chunk` — Upload individual binary chunk with hash verification.
* `POST /api/resources/upload/finalize` — Finalize upload, verify chunk assembly, and commit to GridFS.

### Administration & Moderation
* `GET /api/admin/pending-stories` — Review pending placement experience submissions.
* `POST /api/admin/pending-stories/:id/approve` — Approve and publish story to main library.
* `GET /api/admin/users/:userId/activity` — Retrieve user audit log history.

---

## Environment Configuration

Create a `.env` file in `backend/` with the following variables:

```env
PORT=5001
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/databaseloop?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key
ALLOWED_ORIGIN=http://localhost:5173

# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Distributed Redis Cache
REDIS_URL=redis://default:<password>@<host>:<port>
REDIS_CACHE_ENABLED=true

# Transactional Email (Brevo)
BREVO_API_KEY=your_brevo_api_key
EMAIL_FROM=loop@spit.ac.in
```

---

## Local Development & Automated Testing

### Installation & Run
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Start local server with hot reloading
npm run dev
```

### Automated Verification Test Suite
Execute the full native Node.js test harness (220 tests across 26 suites):
```bash
npm test
```

---

## Deployment

The backend runs on **Render Cloud Application Engine**:
* **Live API Base URL:** [https://loop-qnh9.onrender.com/api](https://loop-qnh9.onrender.com/api)
* Features health monitoring (`/api/health`), automatic zero-downtime deployments on git push, and SSL/TLS termination.
