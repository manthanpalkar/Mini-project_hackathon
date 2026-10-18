# LOOP — Life of Other Placements

[![React](https://img.shields.io/badge/React-19.0-blue?logo=react&style=flat-square)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node.js-Express-green?logo=node.js&style=flat-square)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas_%26_GridFS-brightgreen?logo=mongodb&style=flat-square)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-Cloud_Cache-red?logo=redis&style=flat-square)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-MongoDB_7.0_Staging-2496ED?logo=docker&style=flat-square)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Automated_Tests-214_Passed_(25_Suites)-success?style=flat-square)](backend/tests/)
[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel&style=flat-square)](https://loop-seven-delta.vercel.app/)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&style=flat-square)](https://loop-qnh9.onrender.com/)

> **LOOP** is an institutional placement intelligence, peer mentorship, and academic vault ecosystem engineered for **Sardar Patel Institute of Technology (SPIT), Mumbai**. It bridges the gap between campus academics and high-tier engineering recruitment by publishing verified 4-year roadmaps, actual round-by-round interview debriefs, compensation packages, senior resumes, and curated study materials.

---

## Deployments & Live Access

| Layer | Hosting Provider | Live URL | Status |
| :--- | :--- | :--- | :--- |
| **Frontend Client** | Vercel Global Edge Network | [https://loop-seven-delta.vercel.app/](https://loop-seven-delta.vercel.app/) | **Live 24/7** |
| **Backend REST API** | Render Cloud Application Engine | [https://loop-qnh9.onrender.com/](https://loop-qnh9.onrender.com/) | **Live 24/7** |
| **Primary Database** | MongoDB Atlas Cloud (M0 Cluster) | `databaseloop.4qedd5n.mongodb.net` | **Cloud Replica** |
| **Distributed Cache** | Redis Cloud Free Tier | `diaphanous-celery-purpose-99869.db.redis.io` | **In-Memory Cache** |
| **Email & OTP Engine** | Brevo Transactional API | `smtp-relay.brevo.com` | **Authenticated Delivery** |

### Demo Credentials

* **Student Account:**
  * **Email:** `student@spit.ac.in`
  * **Password:** `student123`
* **Administrator Account:**
  * **Email:** `admin@spit.ac.in`
  * **Password:** *(Managed via campus admin provisioning)*
* **Campus Single Sign-On:**
  * Any valid `@spit.ac.in` institutional Google account can log in or register instantly via the **Continue with Google** button.

---

## System Architecture

```mermaid
flowchart TD
    subgraph Clients["Clients & Edge Network"]
        Browser["Student / Admin Browser\n(React 19 + Vite 8 SPA)"]
        Social["Social Platforms / WhatsApp\n(Open Graph Crawler)"]
    end

    subgraph CDN["Edge & Static Hosting"]
        Vercel["Vercel Global Edge CDN\n(HTML5, CSS3, JS Bundles, /og-image.png)"]
    end

    subgraph BackendAPI["Backend Cloud Engine (Render)"]
        Express["Express 4.19 REST API Server"]
        AuthMiddleware["JWT Verification & Sliding Rotation"]
        RateLimiters["Dual-Tier Rate Limiters\n(Global 1500 req / Auth 5 req)"]
        UserCache["LRU UserAuthCache & CacheService"]
    end

    subgraph DataTier["Cloud Persistence & Cache Layer"]
        AtlasDB[("MongoDB Atlas Cloud\nUsers, Stories, Resources, Feedback")]
        GridFSBucket[("MongoDB GridFS\nfs.files & fs.chunks (Up to 200MB)")]
        RedisCloud[("Redis Cloud\nHot Query Caching (<1ms)")]
    end

    subgraph ExternalServices["External Cloud Integrations"]
        GoogleOAuth["Google Identity Services\n(@spit.ac.in Domain Enforced)"]
        BrevoSMTP["Brevo Email API\n(6-Digit Hashed OTP Password Reset)"]
    end

    subgraph LocalDev["Isolated Local Staging Sandbox (Docker)"]
        DockerMongo["Docker Container: loop-staging-mongo\n(MongoDB 7.0 on 127.0.0.1:27018)"]
    end

    Browser -->|HTTPS / WSS| Vercel
    Browser -->|REST API JSON / Streaming PUT| Express
    Social -->|Fetch Open Graph Meta| Vercel

    Express --> AuthMiddleware
    AuthMiddleware --> RateLimiters
    RateLimiters --> UserCache

    Express -->|Read / Write Documents| AtlasDB
    Express -->|Chunked Binary Streams| GridFSBucket
    Express -->|Get / Set Cached JSON| RedisCloud
    Express -->|Verify ID Tokens| GoogleOAuth
    Express -->|Send Transactional OTP| BrevoSMTP

    Express -.->|Automated Test Harness| DockerMongo
```

---

## Core Technologies: What, Why & How

### 1. Redis Cloud (Distributed Query Acceleration)
* **What is it?** A managed, low-latency in-memory data store hosted on Redis Cloud.
* **Why do we use it?** 
  High-traffic endpoints (such as `/api/stories`, `/api/resources`, and `/api/folders`) are queried frequently by students browsing placement roadmaps. Querying MongoDB Atlas across the transatlantic network introduces 150ms–300ms of latency per request. Redis caches serialized JSON responses in memory, serving hot data in **under 1 millisecond**.
* **How it works:**
  1. **Cache-Aside Pattern:** When a request arrives, [`backend/services/cacheService.js`](backend/services/cacheService.js) checks Redis for a matching key (e.g., `stories:page1:sortDate`).
  2. **Cache Hit:** If found, the cached JSON payload is returned immediately without touching MongoDB.
  3. **Cache Miss:** If not found, MongoDB Atlas is queried, the response is written to Redis with an automatic TTL (e.g., 5 to 15 minutes), and delivered to the client.
  4. **Active Event-Driven Invalidation:** When an administrator approves a story, edits a resource, or moderates an entry, the cache service automatically invalidates matching key patterns using `DEL` / `SCAN`, preventing stale data.
  5. **Resilient In-Memory Fallback:** If Redis is temporarily unreachable or `REDIS_CACHE_ENABLED=false`, the server seamlessly falls back to a bounded local Node.js memory cache with zero downtime.

---

### 2. Docker (Isolated Testing & Benchmark Sandbox)
* **What is it?** A lightweight Linux container running **MongoDB 7.0** (`loop-staging-mongo`) exposed on isolated port `127.0.0.1:27018`.
* **Why do we use it?**
  To protect live production database clusters. In production, LOOP connects to a shared MongoDB Atlas free-tier M0 cluster. Running exhaustive test suites (214 tests), load tests, and multi-gigabyte upload benchmarks directly against Atlas would risk exhausting database quotas, modifying live student records, or causing rate limits. Docker creates an ephemeral, production-identical local sandbox.
* **How it works:**
  * **Zero Production Pollution:** All unit, integration, and crash-recovery tests execute against `127.0.0.1:27018`.
  * **Crash Window Verification:** Docker allows tests to simulate hard network disconnects, server crashes during multi-megabyte GridFS assembly, and lease expirations deterministically.
  * **When is it needed?** Docker is **only required for local test execution and benchmarks**. When deploying to production on Render and Vercel, the application communicates directly with MongoDB Atlas in the cloud—Docker is never required on your computer during normal website operation.

---

### 3. Brevo (Transactional Email & 6-Digit OTP Engine)
* **What is it?** An enterprise-grade transactional email delivery API (`@getbrevo/brevo`).
* **Why do we use it?**
  Students frequently forget their passwords or require account verification. Consumer email systems (like raw Gmail SMTP) hit strict connection limits, trigger spam filters, and leak credentials. Brevo provides verified DKIM/SPF delivery directly to institutional `@spit.ac.in` student inboxes.
* **How the OTP System Works:**
  1. **Request:** Student enters their campus email on the Forgot Password page.
  2. **Cryptographic OTP Generation:** The backend generates a secure 6-digit numeric OTP using `crypto.randomInt(100000, 999999)`.
  3. **Salted Hashing:** The OTP is never stored in plaintext. It is hashed with SHA-256 and stored in the user's document alongside an expiration timestamp (`Date.now() + 10 * 60 * 1000`, strictly 10 minutes).
  4. **Rate Limiting & Anti-Spam:** Password reset requests are limited to **3 requests per 15 minutes** per IP/email to prevent inbox bombing and brute-force guessing.
  5. **Verification & One-Time Consumption:** Upon entering the OTP, the hash is validated using constant-time comparison (`crypto.timingSafeEqual`). Once verified, the OTP is purged immediately, and a single-use JWT reset token is issued to authorize password updates.

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student (@spit.ac.in)
    participant Client as Frontend (Vercel)
    participant API as Backend API (Render)
    participant Brevo as Brevo API
    participant DB as MongoDB Atlas

    Student->>Client: Enters email & clicks "Send OTP"
    Client->>API: POST /api/auth/forgot-password { email }
    API->>DB: Check student exists & verify rate limits
    API->>API: Generate 6-digit OTP & compute SHA-256 hash
    API->>DB: Save hashed OTP & 10-minute expiry timestamp
    API->>Brevo: Send transactional email with OTP template
    Brevo-->>Student: Delivers OTP email to SPIT inbox
    API-->>Client: 200 OK { message: "OTP sent successfully" }
    
    Student->>Client: Enters 6-digit OTP & new password
    Client->>API: POST /api/auth/reset-password { email, otp, newPassword }
    API->>DB: Fetch hashed OTP & verify expiry (> now)
    API->>API: Compare SHA-256(otp) === storedHash
    API->>API: Hash new password with bcrypt (12 salt rounds)
    API->>DB: Update password & invalidate OTP record
    API-->>Client: 200 OK { message: "Password updated successfully" }
    Client-->>Student: Redirects to Login with success banner
```

---

### 4. Google OAuth 2.0 (Campus Domain Restricted)
* **What is it?** Google Identity Services token verification (`google-auth-library`).
* **Why do we use it?**
  Eliminates friction while guaranteeing campus-only authenticity. Seniors and juniors can log in with one click without creating separate passwords.
* **How it works:**
  1. **Client-Side Sign-In:** The browser initiates authentication via Google Identity Services and receives a cryptographically signed Google ID token (`credential`).
  2. **Server-Side Verification:** The backend verifies the token using Google's public keys via `OAuth2Client.verifyIdToken()`.
  3. **Strict Domain Enforcement:** The server verifies that `payload.hd === 'spit.ac.in'` and that the email ends with `@spit.ac.in`. If an outsider attempts to log in with a personal `@gmail.com` account, the backend strictly rejects the request with `403 Forbidden` (`Only @spit.ac.in institutional accounts are authorized`).
  4. **Automatic Account Linking:** If the student exists, their profile is updated with their verified Google avatar and name; if not, an account is automatically provisioned with the `Student` role.

---

### 5. High-Speed MongoDB GridFS & Parallel Upload Pipeline
* **What is it?** MongoDB GridFS chunked binary storage with client-side parallel slicing and server-side atomic assembly.
* **Why do we use it?**
  Resume PDFs, presentation decks, project archives, and educational videos range from 1 MB to 200 MB. Storing large binary files in regular MongoDB documents exceeds the 16 MB BSON document limit. Storing files locally on Render's ephemeral filesystem would cause files to disappear on dyno restarts. GridFS streams binary files directly inside database collections (`fs.files` and `fs.chunks`) with high availability and durability.

#### Adaptive Chunk Sizing & Multi-Stream Acceleration
Earlier implementations hardcoded an 8 MB chunk size, causing files $\le 8\text{ MB}$ (like a 5.4 MB research paper) to be serialized over a single TCP stream. The upgraded architecture features **dynamic adaptive chunk sizing**:
* **Files $\le 1\text{ MB}$:** $1\text{ MB}$ chunk (1 request, zero chunk slicing overhead).
* **Files $1\text{ MB} - 8\text{ MB}$ (e.g. 5.4 MB IEEE paper):** $2\text{ MB}$ chunks (**3 parallel streams**, $3\times$ TCP pipe utilization).
* **Files $8\text{ MB} - 32\text{ MB}$ (e.g. 20 MB manual):** $4\text{ MB}$ chunks (**5 parallel streams**).
* **Files $> 32\text{ MB}$ (up to 200 MB):** $8\text{ MB}$ chunks (**6 parallel streams**).

```mermaid
sequenceDiagram
    autonumber
    actor User as Student / Senior
    participant Client as Browser (UploadContext)
    participant API as Express API Server
    participant TempBucket as GridFS (loop_temp_chunks)
    participant FinalBucket as GridFS (loop_resources)
    participant DB as MongoDB Atlas (UploadSession)

    User->>Client: Selects file (e.g. 5.4 MB IEEE Paper)
    Client->>API: POST /api/resources/upload/init { fileName, fileSize: 5.4MB }
    API->>API: calculateOptimalChunkSize(5.4MB) -> 2MB
    API->>DB: Create UploadSession { totalChunks: 3, chunkSize: 2MB, finalizeGeneration: 0 }
    API-->>Client: 200 OK { uploadId, chunkSize: 2MB, totalChunks: 3, concurrency: 6 }
    
    par Parallel Chunk Upload (3 Concurrent Streams)
        Client->>API: PUT /upload/chunk [Chunk 0: 0-2MB]
        API->>TempBucket: Stream chunk 0
        and
        Client->>API: PUT /upload/chunk [Chunk 1: 2-4MB]
        API->>TempBucket: Stream chunk 1
        and
        Client->>API: PUT /upload/chunk [Chunk 2: 4-5.4MB]
        API->>TempBucket: Stream chunk 2
    end

    Client->>API: POST /api/resources/upload/finalize { uploadId }
    API->>DB: Atomically acquire lease & increment finalizeGeneration Token
    API->>TempBucket: Verify chunks 0, 1, 2 exist
    API->>FinalBucket: Sequentially stream chunks into canonical GridFS file
    API->>DB: Create Resource / PendingResource record
    API->>DB: Atomically mark UploadSession.isFinalized = true
    API->>TempBucket: Purge temporary chunks
    API-->>Client: 200 OK { success: true, resource }
    Client-->>User: UploadDock: "Ready in library" (100%)
```

#### Fenced Non-Destruction & Crash Safety Protocol
To eliminate race conditions between concurrent worker threads, upload finalization is protected by a distributed fencing protocol:
* **Compare-And-Set Generation Fencing:** Every finalization attempt atomically acquires a lease via `UploadSession.findOneAndUpdate()` and increments `finalizeGeneration`.
* **Fenced Non-Destruction:** If a slow worker is superseded by a newer worker, the older worker loses its fencing token and is strictly blocked from deleting shared GridFS files during rollback.
* **Crash Windows Covered (A through E):**
  * *Window A (Crash Before Assembly):* Stale lock expires automatically via `leaseExpiresAt`; retry recovers seamlessly.
  * *Window B (Crash During Assembly):* Temporary chunks remain safe in `loop_temp_chunks`; incomplete target file is pruned.
  * *Window C (GridFS Created, died before session update):* Complete file is adopted by `metadata.uploadId` lookup without re-uploading.
  * *Window D (GridFS Recorded, died before resource created):* Reuses canonical `finalGridFsId`.
  * *Window E (Resource Created, lease superseded):* Fenced non-destruction preserves the file while rolling back redundant records.

---

### 6. Social Sharing Preview & Light-Mode Favicon Design
When sharing links across social networks (WhatsApp, iMessage, LinkedIn, Twitter), search crawlers parse Open Graph meta tags to render rich cards.
* **High-Resolution Banner (`/og-image.png`):** A $1200 \times 630\text{ px}$ graphic featuring a deep midnight-slate background (`#0A0E17`), ambient blue/violet glow, bold white LOOP typography, SPIT Mumbai official badge, and feature pills.
* **High-Contrast Favicon Badge (`/favicon.png`):** Features a 512×512 dark squircle badge containing the white infinity symbol. When shared on platforms with white backgrounds (like WhatsApp link preview cards) or pinned on light-themed browser tabs, the dark badge provides 100% contrast, eliminating white-on-white vanishing.
* **Adaptive SVG Favicon (`/favicon.svg`):** Uses vector rendering for crisp browser tab presentation across standard and retina displays.

---

## Environment Variables & Configuration Reference

### Backend Configuration (`backend/.env`)

| Variable | Required? | Why is it used? / Purpose | Example / Format |
| :--- | :---: | :--- | :--- |
| `PORT` | Yes | Defines the network port where the Express HTTP server listens. | `5001` |
| `MONGODB_URI` | Yes | Connection URI for the MongoDB Atlas database cluster, containing username, password, cluster endpoint, and database name. | `mongodb+srv://user:pass@cluster.mongodb.net/loop_db?retryWrites=true&w=majority` |
| `JWT_SECRET` | Yes | Cryptographic secret key used to sign and verify JSON Web Tokens (JWT) for student and administrator sessions. | `spit_loop_super_secret_jwt_key_2026` |
| `ALLOWED_ORIGIN` | Yes | CORS security configuration specifying authorized frontend origins allowed to send credentials and requests. | `http://localhost:5173,https://loop-seven-delta.vercel.app` |
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Client ID issued by the Google Cloud Console, required to verify campus Google Sign-In tokens. | `779605241663-...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET`| Yes | OAuth 2.0 Client Secret issued by Google Cloud Console for secure server-to-server token exchange. | `GOCSPX-culB16QZE...` |
| `REDIS_URL` | Optional | Connection string for Redis Cloud (host, port, username, password) used to cache API responses. | `redis://default:pass@redis-host.db.redis.io:14088` |
| `REDIS_CACHE_ENABLED` | Optional | Boolean flag (`true`/`false`) toggling Redis caching. If set to `false`, the server uses its resilient in-memory cache. | `true` |
| `BREVO_API_KEY` | Yes | API Key from Brevo (formerly Sendinblue) used to dispatch transactional 6-digit password reset OTP emails. | `xkeysib-a1218b05...` |
| `EMAIL_FROM` | Yes | The verified sender email address displayed on password reset and notification emails sent to students. | `swapnil.patil24@spit.ac.in` |
| `RESET_SECRET` | Yes | Cryptographic secret used to sign single-use password reset authorization tokens following successful OTP verification. | `spit_loop_super_secret_jwt_key_2026` |
| `GRIDFS_CHUNK_SIZE_MB`| Optional | Base chunk size configuration in megabytes for large file partitioning (Default: `8`). | `8` |
| `GRIDFS_UPLOAD_CONCURRENCY`| Optional | Maximum parallel HTTP streams allowed per file upload session (Default: `6`). | `6` |

### Frontend Configuration (`frontend/.env`)

| Variable | Required? | Why is it used? / Purpose | Example / Format |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | Yes | The base URL of the backend Express API server. Point to `http://localhost:5001/api` for local development or the Render URL in production. | `https://loop-qnh9.onrender.com/api` |
| `VITE_GOOGLE_CLIENT_ID`| Yes | Public Google OAuth Client ID loaded by the frontend Google Identity Services script for button rendering. | `779605241663-...apps.googleusercontent.com` |

---

## Codebase Directory Structure

```text
loop/
├── backend/
│   ├── middlewares/          # JWT authentication, token rotation, & role guards
│   ├── scripts/              # Performance benchmarks & staging test suites
│   │   ├── benchmark_upload_performance.js   # Local GridFS upload benchmark
│   │   ├── benchmark_network_throttling.js   # Simulated 4G/3G/2G network profiles
│   │   └── measure_performance_metrics.py    # Performance & latency analyzer
│   ├── services/             # Core distributed services
│   │   ├── activityService.js                # Administrator audit trails & logging
│   │   ├── cacheService.js                   # Distributed Redis Cloud & in-memory cache
│   │   └── storageService.js                 # MongoDB GridFS chunking & adaptive sizing
│   ├── tests/                # 214 automated unit & integration test suites
│   │   ├── adminUserAuditAndEmailAuth.test.js
│   │   ├── cacheService.test.js
│   │   ├── forgotPassword.test.js
│   │   ├── googleAuth.test.js
│   │   ├── onboardingAndCors.test.js
│   │   ├── storySubmissionLifecycle.test.js
│   │   ├── systemHealthDashboard.test.js
│   │   └── uploadEndpoints.test.js
│   ├── models.js             # Mongoose schemas & compound database indexes
│   ├── server.js             # Express API server, routes, & security filters
│   ├── seed.js               # Database seeding and demo hydration scripts
│   └── package.json          # Backend dependencies & npm scripts
│
├── frontend/
│   ├── public/               # Public assets & social preview images
│   │   ├── apple-touch-icon.png              # 180x180 iOS/macOS bookmark icon
│   │   ├── favicon.png                       # 512x512 high-contrast squircle badge
│   │   ├── favicon.svg                       # Adaptive vector favicon
│   │   ├── loop-logo.png                     # Transparent navbar & login logo
│   │   ├── og-image.png                      # 1200x630 WhatsApp & social banner
│   │   └── site.webmanifest                  # Web app manifest for mobile home screens
│   ├── src/
│   │   ├── assets/           # Vector branding and illustrations
│   │   ├── components/       # Reusable UI widgets, Navbar, UploadDock, modals
│   │   ├── context/          # React contexts (AuthContext, UploadContext, Theme)
│   │   ├── hooks/            # Custom hooks (SWR useCachedData, etc.)
│   │   ├── pages/            # Views (Stories, Resources, Admin, Login, Previews)
│   │   ├── utils/            # API client wrappers, db.js, and upload.js
│   │   ├── App.jsx           # Main application routing & protected route guards
│   │   └── main.jsx          # DOM entry point
│   ├── index.html            # HTML5 shell with Open Graph and Twitter metadata
│   ├── vercel.json           # SPA rewrite rules for production hosting
│   └── package.json          # Frontend dependencies & npm scripts
│
├── LOOP_UPLOAD_PERFORMANCE_AUDIT.md  # Scientific benchmark & optimization audit
└── README.md                         # Complete project documentation
```

---

## Automated Verification & Test Suite

LOOP includes an automated test harness executed using Node's native test runner (`node --test`).

```bash
cd backend
npm test
```

### Test Suite Results: 214 / 214 Tests Passing (25 Suites, 0 Failures)

```text
▶ MongoDB GridFS Storage Service & Upload Validation
  ▶ File Size Validation (200 MB Limit)
    ✔ enforces 200 MB maximum limit (209,715,200 bytes)
    ✔ formatBytes formats file sizes correctly
    ✔ calculateOptimalChunkSize adapts chunk size dynamically to file size
  ✔ File Size Validation (200 MB Limit)
  ▶ File Whitelist & Security Checks
    ✔ accepts educational documents: PDF, DOC, DOCX, TXT, RTF, ODT
    ✔ accepts spreadsheets & presentations: XLS, XLSX, CSV, PPT, PPTX
    ✔ accepts images & archives: PNG, JPG, WEBP, ZIP, RAR, 7Z
    ✔ accepts programming code files: JAVA, PY, JS, TS, CPP, SQL, MD
    ✔ strictly blocks dangerous executables: .exe, .bat, .cmd, .sh, .msi, .dll
  ✔ File Whitelist & Security Checks
  ▶ Upload Finalization & Moderation Decision Integrity
    ✔ moderation decision correctly maps student uploads to PendingResource
    ✔ idempotency: repeated completion returns existing resource without duplicate
    ✔ atomic concurrency lock: prevents simultaneous finalization from creating duplicates
    ✔ retry resilience: error in finalization releases lock for subsequent retry
    ✔ Crash Window A: abandoned session lock broken by expired lease
    ✔ Crash Window B: temporary chunks preserved and incomplete file purged
    ✔ Crash Window C: complete file reused via uploadId metadata
    ✔ Crash Window D: reuses existing finalGridFsId
    ✔ Crash Window E: Fenced Non-Destruction preserves file and rolls back resource
    ✔ fencing token: slow attempt rejected if generation was incremented
    ✔ deferred cleanup: temporary chunks preserved until finalization commit is durable
  ✔ Upload Finalization & Moderation Decision Integrity
  ▶ HTTP Integration & File Streaming Authorization Tests
    ✔ POST /api/resources/upload/init: calculates adaptive chunk size (2 MB) and 3 chunks for 5.4 MB file
    ✔ POST /api/resources/upload/finalize: rejects unauthenticated request with 401
    ✔ GET /api/resources/:id/file: prevents arbitrary GridFS ObjectId streaming bypass
    ✔ GET /api/resources/:id/file: unrelated student accessing pending resource returns 403 Forbidden
    ✔ Regression 5: Stale worker rollback: does NOT delete GridFS file adopted by a newer worker
    ✔ Regression 10: Fenced Non-Destruction: superseded worker rollback never deletes GridFS file
  ✔ HTTP Integration & File Streaming Authorization Tests
✔ MongoDB GridFS Storage Service & Upload Validation

ℹ tests 214
ℹ suites 25
ℹ pass 214
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 1548.36
```

---

## Local Development & Setup

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **MongoDB**: A free MongoDB Atlas cluster connection string (or local Docker container for tests)

### 1. Clone the Repository
```bash
git clone https://github.com/swapnil-exxe/loop.git
cd loop
```

### 2. Configure Backend
```bash
cd backend
npm install
cp .env.example .env
```
Update `backend/.env` with your MongoDB Atlas URI, JWT Secret, and Brevo API key.

### 3. Configure Frontend
```bash
cd ../frontend
npm install
cp .env.example .env
```
Update `frontend/.env` with `VITE_API_URL=http://localhost:5001/api`.

### 4. Run the Local Development Servers
In two separate terminal windows:

* **Terminal 1 (Backend API):**
  ```bash
  cd backend
  npm run dev
  # Server starts on http://localhost:5001
  ```

* **Terminal 2 (Frontend Client):**
  ```bash
  cd frontend
  npm run dev
  # Client starts on http://localhost:5173
  ```

### 5. Running with Local Docker Sandbox (Optional for Testing)
To run automated benchmarks against an isolated local database without touching MongoDB Atlas:
```bash
docker run -d --name loop-staging-mongo -p 127.0.0.1:27018:27017 mongo:7.0
TEST_MONGODB_URI=mongodb://127.0.0.1:27018/loop_test node backend/scripts/benchmark_upload_performance.js
```

---

## Security Policies & Best Practices

1. **Credential Hygiene:** Never commit `.env` files or raw API keys to Git. All secrets are managed via Vercel and Render environment variable dashboards.
2. **Access Control:** All endpoints modifying placement records or administrative settings require `authenticateToken` and `requireAdmin` middlewares.
3. **Campus Data Integrity:** All incoming story submissions default to `PendingStory` and require moderation review before appearing in public library queries.
4. **Binary Protection:** Only educational document and image formats are permitted; executable binary uploads are immediately rejected at the stream boundary.

---

## License

Developed for educational, academic, and campus recruitment empowerment at **Sardar Patel Institute of Technology (SPIT), Mumbai**. All rights reserved.
