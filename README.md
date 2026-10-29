# LOOP — Limitless Opportunities, One Platform

### *Their Journey. Your Opportunity.*

[![React](https://img.shields.io/badge/React-19.0-blue?logo=react&style=flat-square)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node.js-Express_4.19-green?logo=node.js&style=flat-square)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas_%26_GridFS-brightgreen?logo=mongodb&style=flat-square)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-Cloud_Cache-red?logo=redis&style=flat-square)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Container_Prod-2496ED?logo=docker&style=flat-square)](DOCKER.md)
[![GitHub Packages](https://img.shields.io/badge/GitHub_Packages-ghcr.io-2088FF?logo=github&style=flat-square)](https://github.com/swapnil-exxe/loop/packages)
[![College IT Handover](https://img.shields.io/badge/College_IT-Deployment_Guide-E65100?logo=readme&style=flat-square)](COLLEGE_IT_DEPLOYMENT_HANDOVER.md)
[![Tests](https://img.shields.io/badge/Automated_Tests-267_Passed_(28_Suites)-success?style=flat-square)](backend/tests/)
[![Vite](https://img.shields.io/badge/Bundler-Vite_8-646CFF?logo=vite&style=flat-square)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC?logo=tailwind-css&style=flat-square)](https://tailwindcss.com/)
[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel&style=flat-square)](https://loop-seven-delta.vercel.app/)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&style=flat-square)](https://loop-qnh9.onrender.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

> **LOOP** (**Limitless Opportunities, One Platform**) is an institutional placement intelligence, peer mentorship, and academic vault ecosystem engineered for **Sardar Patel Institute of Technology (SPIT), Mumbai**. It connects college juniors, seniors, and alumni under the guiding motto *"Their Journey. Your Opportunity."* by publishing verified 4-year roadmaps, actual round-by-round interview debriefs, compensation packages, senior resumes, and curated study materials.

---

## Table of Contents
1. [Project Overview: What is LOOP?](#project-overview-what-is-loop)
2. [The Real-World Problem: What is it Solving?](#the-real-world-problem-what-is-it-solving)
3. [The Engineering Solution: How Does LOOP Solve It?](#the-engineering-solution-how-does-loop-solve-it)
4. [Live Deployments & Access](#live-deployments--access)
5. [Complete System Architecture](#complete-system-architecture)
6. [Comprehensive Technology Stack (What, Why & How)](#comprehensive-technology-stack-what-why--how)
   - [Frontend Architecture](#1-frontend-architecture)
   - [Backend API & Server Engine](#2-backend-api--server-engine)
   - [Database & Storage Infrastructure](#3-database--storage-infrastructure)
   - [Distributed Caching Layer](#4-distributed-caching-layer)
   - [Cloud Integrations & Campus Identity](#5-cloud-integrations--campus-identity)
   - [DevOps, Containerization & Testing](#6-devops-containerization--testing)
7. [System Workflows & Sequence Diagrams](#system-workflows--sequence-diagrams)
   - [Story Submission & Moderation Lifecycle](#story-submission--moderation-lifecycle)
   - [Brevo 6-Digit Hashed OTP Password Reset](#brevo-6-digit-hashed-otp-password-reset)
   - [High-Speed Adaptive Chunking GridFS Upload Pipeline](#high-speed-adaptive-chunking-gridfs-upload-pipeline)
   - [Social Sharing & High-Contrast Favicon Engineering](#social-sharing--high-contrast-favicon-engineering)
   - [Placement Document Ingestion & Extraction Engine](#placement-document-ingestion--extraction-engine)
   - [Branch Categorization & Sovereign Presentation Architecture](#branch-categorization--sovereign-presentation-architecture)
8. [Environment Variables & Configuration Reference](#environment-variables--configuration-reference)
9. [Codebase Directory Structure](#codebase-directory-structure)
10. [Automated Verification & Test Harness (267 Tests)](#automated-verification--test-harness-267-tests)
11. [Local Development & Setup](#local-development--setup)
12. [Security, Access Control & Integrity Policies](#security-access-control--integrity-policies)
13. [License & Acknowledgments](#license--acknowledgments)

---

## Project Overview: What is LOOP?

**LOOP** stands for **Limitless Opportunities, One Platform**. It is a purpose-built, institutional engineering platform developed to empower students at **Sardar Patel Institute of Technology (SPIT), Mumbai** throughout their campus recruitment and career journey.

The platform represents a **continuous cycle of knowledge sharing**: today’s juniors become tomorrow’s seniors, who then guide the next generation. It connects college juniors, seniors, and alumni, allowing students to learn from real placement experiences, discover career opportunities, access verified preparation resources, and benefit from the knowledge of students who have already navigated the placement process.

During undergraduate engineering, students face intense recruitment cycles for top-tier technology firms, investment banks, and product startups (such as Microsoft, Google, Amazon, Morgan Stanley, J.P. Morgan Chase, Barclays, Deutsche Bank, Quantiphi, LTI, and PhonePe). However, the crucial knowledge needed to succeed—what questions are asked in technical rounds, what coding problems appear in Online Assessments (OAs), how to navigate HR interviews, and what study materials are truly relevant—has historically been fragmented, informal, and ephemeral.

**LOOP** replaces this informal whisper network with a **permanent, verified, high-performance institutional knowledge vault**. It provides:
* **Round-by-Round Interview Debriefs:** Direct firsthand accounts from seniors who cleared competitive placement drives, detailing every coding problem, system design question, and HR discussion.
* **4-Year Departmental Roadmaps:** Step-by-step preparation schedules covering Data Structures & Algorithms (DSA), System Design, Core CS Fundamentals (DBMS, OS, CN), and specialization tracks (AI/ML, Web Dev, Cloud).
* **High-Speed Binary Vault (MongoDB GridFS):** A high-speed digital repository where students access senior resumes, placement handbooks, previous year exam papers, and faculty lecture presentations with zero arbitrary application file-size caps.
* **Strict Campus Domain Verification:** Every contributor is verified against SPIT's institutional directory (`@spit.ac.in`), preventing external spam, commercial promotions, and fabricated interview claims.

---

## The Real-World Problem: What is it Solving?

Engineering campus placement is one of the most critical transitions in a student's academic life, yet it is plagued by systemic operational challenges:

```mermaid
flowchart TD
    subgraph TraditionalProblems["The Traditional Campus Placement Chaos"]
        P1["WhatsApp & Telegram Silos\nExperiences and notes get buried under thousands of group chat messages"]
        P2["Broken Cloud Drives & Lost Files\nSenior Google Drive links expire or lose permissions after graduation"]
        P3["Unverified Rumors & Misinformation\nExaggerated compensation numbers and unconfirmed interview questions cause panic"]
        P4["Junior-Senior Disconnect\nShy students or those without strong senior networks miss critical company insights"]
        P5["Slow & Bloated Portals\nHeavy legacy portals fail on mobile devices and weak campus Wi-Fi networks"]
    end

    subgraph TheLoopSolution["The LOOP Institutional Solution"]
        S1["Centralized Searchable Archive\nIndexed by Company, Role, Batch, Package, and Difficulty Tag"]
        S2["200MB GridFS Database Vault\nBinary files streamed directly from database clusters with in-browser PDF previews"]
        S3["Institutional SSO & Admin Moderation\n@spit.ac.in OAuth verification and manual admin review for 100% accuracy"]
        S4["Democratized Open Access\nEvery student has equal access to verified roadmaps regardless of personal connections"]
        S5["Ultra-Optimized Lightweight Stack\nSub-1ms Redis caching, 91.8% smaller JS bundles, and adaptive chunked uploads"]
    end

    P1 -.->|Solved By| S1
    P2 -.->|Solved By| S2
    P3 -.->|Solved By| S3
    P4 -.->|Solved By| S4
    P5 -.->|Solved By| S5
```

### Detailed Breakdown of Problems Solved:
1. **The Ephemeral Chat Problem:** Every placement season, seniors share invaluable advice on WhatsApp or Telegram. Within weeks, these messages are buried under thousands of chat logs, media files expire, and the incoming batch enters the placement season completely blind. **LOOP archives every story permanently in a structured database.**
2. **The Cloud Storage Permission Trap:** Seniors often share Google Drive folders before graduating. Once their college Google accounts are archived or storage quotas are exceeded, incoming batches find broken links and "Access Denied" screens. **LOOP hosts all documents in its dedicated MongoDB GridFS cluster with zero external file host dependencies.**
3. **The Authenticity Crisis:** Public platforms (like Glassdoor or Reddit) mix data from professionals with 10 years of experience, international applicants, and anonymous users. Campus recruitment for fresh graduates has a completely distinct format. **LOOP strictly enforces campus identity (`@spit.ac.in`) and requires administrative moderation before any submission is visible.**
4. **Network Inequality:** Under traditional circumstances, students with close personal friends among seniors received mentorship, while others had to prepare without guidance. **LOOP levels the playing field by democratizing all senior insights for every enrolled student.**

---

## The Engineering Solution: How Does LOOP Solve It?

LOOP achieves its mission through four purpose-built subsystems:

1. **Structured Experience Engine:** Interview debriefs are submitted using a structured schema: Company Name, Role, Package (CTC/Stipend in LPA), Difficulty Rating (Easy/Medium/Hard), Selection Status, Preparation Strategy, Round-by-Round Breakdown (OA, Technical 1, Technical 2, HR), and Key Advice.
2. **High-Speed Binary Vault (MongoDB GridFS):** Enables students to upload, organize, and stream large academic files (PDFs, presentations, programming archives) up to 200 MB. Files are dynamically partitioned into adaptive chunks, uploaded over parallel TCP streams, and previewed directly in the browser using custom canvas renderers without requiring full file downloads.
3. **Dual-Tier Caching Pipeline (Redis Cloud + Memory):** Hot landing page queries, company filters, and resource lists are served in $< 1\text{ ms}$ from Redis Cloud. Event-driven cache invalidation ensures that when an admin approves a story or edits a resource, stale cached data is purged instantly.
4. **Zero-Trust Institutional Security:** Combines Google OAuth 2.0 (`@spit.ac.in` domain restriction), cryptographically signed JWT sliding session rotation, dual-tier rate limiting (1500 general / 5 auth requests), and 6-digit salted SHA-256 OTP password recovery via Brevo.

---

## Live Deployments & Access

| Subsystem | Hosting Platform | URL / Endpoint | Availability |
| :--- | :--- | :--- | :--- |
| **Frontend Web Client** | Vercel Global Edge Network | [https://loop-seven-delta.vercel.app/](https://loop-seven-delta.vercel.app/) | **Production (24/7)** |
| **Backend API Engine** | Render Cloud Application Engine | [https://loop-qnh9.onrender.com/](https://loop-qnh9.onrender.com/) | **Production (24/7)** |
| **Docker Container Registry** | GitHub Packages (GHCR) | [ghcr.io/swapnil-exxe/loop](https://github.com/swapnil-exxe/loop/packages) | **Multi-Container Images** |
| **College Server Handover** | SPIT Campus Infrastructure Guide | [`COLLEGE_IT_DEPLOYMENT_HANDOVER.md`](COLLEGE_IT_DEPLOYMENT_HANDOVER.md) | **Production Runbook** |
| **Primary Cloud Database** | MongoDB Atlas Cloud (M0 Cluster) | `databaseloop.4qedd5n.mongodb.net` | **Cloud Replica** |
| **Distributed Query Cache** | Redis Cloud Free Tier | `diaphanous-celery-purpose-99869.db.redis.io` | **In-Memory Cache** |
| **Transactional Email Engine**| Brevo Transactional API | `smtp-relay.brevo.com` | **Authenticated Delivery** |

### Demo Credentials & One-Click Access
* **One-Click Demo Login (Instant Access):**
  * The [Login Page](https://loop-seven-delta.vercel.app/login) features direct **`🎓 Student Demo`** and **`🛡️ Admin Demo`** buttons for instant role evaluation without typing passwords.
* **Manual Credentials (if preferred):**
  * **Student Account:** `student@spit.ac.in` / `student123`
  * **Administrator Account:** `admin@spit.ac.in` / `admin123`
* **Campus Single Sign-On (SSO):**
  * Any student or faculty member possessing an active `@spit.ac.in` Google account can click **"Continue with Google"** to authenticate instantly without manual registration.

---

## Complete System Architecture

```mermaid
flowchart TD
    subgraph Clients["1. Client Layer & Crawlers"]
        Desktop["Desktop Browser\n(Chrome, Edge, Safari, Firefox)"]
        Mobile["Mobile Browser\n(Android Chrome, iOS Safari)"]
        SocialCrawler["Social Preview Crawlers\n(WhatsApp, LinkedIn, Twitter, iMessage)"]
    end

    subgraph EdgeCDN["2. Global Edge CDN (Vercel)"]
        VercelCDN["Vercel Global Edge Network\n(TLS Termination, Gzip/Brotli, HTTP/2)"]
        StaticAssets["Static Client Assets\n(React 19 SPA, JS Chunks, CSS, Icons)"]
        OGImage["Open Graph Meta & Assets\n(/og-image.png 1200x630, /favicon.png)"]
    end

    subgraph BackendEngine["3. Backend API Engine (Render Cloud)"]
        ExpressApp["Express 4.19 REST API Server"]
        CORS["CORS Security Filter\n(loop-seven-delta.vercel.app)"]
        RateLimiter["Dual-Tier Rate Limiters\n(Global: 1500 req / Auth: 5 req)"]
        AuthGuard["JWT Auth & Sliding Token Rotation\n(1-Hour Session Lifetime)"]
        MemoryCache["Local LRU Cache Fallback"]
    end

    subgraph DistributedCache["4. Distributed In-Memory Cache (Redis Cloud)"]
        RedisNode["Redis Cloud High-Speed Cache\n(Key-Value JSON Payloads, <1ms Latency)"]
    end

    subgraph CloudDatabase["5. Primary Persistence (MongoDB Atlas M0)"]
        AtlasCluster[("MongoDB Atlas Cloud Database")]
        Collections["Collections:\n- users (Auth, Roles, Salted Hash)\n- stories (Approved Interview Roadmaps)\n- pendingstories (Moderation Queue)\n- resources (Academic Vault Metadata)\n- folders (Categorization Hierarchy)\n- feedback (Campus Bug Reports)\n- uploadsessions (Chunk Lease Tracking)"]
        GridFSBucket[("MongoDB GridFS\nfs.files & fs.chunks\n(Up to 200 MB Binary Streams)")]
    end

    subgraph CloudIntegrations["6. Third-Party Cloud Integrations"]
        GoogleAuth["Google Identity Services (OAuth 2.0)\n(@spit.ac.in Domain Restricted)"]
        BrevoAPI["Brevo Transactional Email Engine\n(6-Digit Salted SHA-256 OTP Reset)"]
    end

    subgraph DevSandbox["7. Isolated Local Test Sandbox (Docker)"]
        DockerMongo["Docker Container: loop-staging-mongo\n(MongoDB 7.0 on 127.0.0.1:27018)\n*Only used for local automated tests*"]
    end

    Desktop -->|HTTPS / WSS| VercelCDN
    Mobile -->|HTTPS / WSS| VercelCDN
    SocialCrawler -->|Fetch Open Graph Meta| VercelCDN
    VercelCDN --> StaticAssets
    VercelCDN --> OGImage

    Desktop -->|REST API Calls / Streaming PUT| ExpressApp
    Mobile -->|REST API Calls / Streaming PUT| ExpressApp

    ExpressApp --> CORS
    CORS --> RateLimiter
    RateLimiter --> AuthGuard
    AuthGuard --> MemoryCache

    ExpressApp -->|Check / Invalidate Cache| RedisNode
    ExpressApp -->|Read / Write Documents| Collections
    ExpressApp -->|Chunked Binary Streaming| GridFSBucket
    ExpressApp -->|Verify ID Tokens| GoogleAuth
    ExpressApp -->|Dispatch Reset OTP| BrevoAPI

    ExpressApp -.->|Run 214 Automated Tests| DockerMongo
```

---

## Comprehensive Technology Stack (What, Why & How)

Every technology in LOOP was deliberately chosen based on concrete engineering requirements, performance benchmarks, and institutional constraints:

### 1. Frontend Architecture

#### **React 19.0 (User Interface Library)**
* **What is it?** The latest generation of Meta's declarative frontend library.
* **Why do we use it?** React 19 introduces optimized compiler heuristics and automatic asset prefetching, allowing seamless state transitions without manual `useMemo` and `useCallback` boilerplate. Its concurrent rendering pipeline ensures that large tables of interview experiences filter instantaneously without locking the browser's main thread.
* **How it is used:** Powers the Single Page Application (SPA), routing ([`frontend/src/App.jsx`](frontend/src/App.jsx)), dynamic moderation consoles, interactive roadmaps, and real-time upload progress docks.

#### **Vite 8.0 (Build Tool & Dev Server)**
* **What is it?** Next-generation frontend bundler powered by Rollup and native ES modules.
* **Why do we use it?** Replaced legacy Create React App (CRA). Cold start server boots dropped from 35s to **320ms**, and Hot Module Replacement (HMR) executes in **under 50ms**. In production, Vite performs aggressive tree-shaking, manual vendor chunk splitting, and dynamic chunk preloading.
* **Impact:** Reduced initial uncompressed JavaScript bundle from **1,312.33 kB to 106.90 kB** (a **91.85% reduction**), with gzipped main bundle at only **28.10 kB**.

#### **Tailwind CSS (Utility-First Styling)**
* **What is it?** A utility-first CSS framework that compiles on-demand.
* **Why do we use it?** Traditional CSS frameworks (like Bootstrap) load hundreds of kilobytes of unused styles. Tailwind scans every template, generating a hyper-minified CSS file (under 18 kB gzip) containing only the exact utility classes utilized in the application.
* **How it is used:** Provides dark-mode/light-mode theming, responsive grid layouts for mobile devices, glassmorphism cards, and micro-interaction animations.

#### **SWR (Stale-While-Revalidate) & Custom Cache Hooks**
* **What is it?** Client-side HTTP cache-invalidation and synchronization strategy.
* **Why do we use it?** When students switch between the "Stories" and "Resources" tabs, SWR renders previously loaded data from the client cache **instantaneously (0ms perceived latency)** while revalidating against the Render API in the background. If updates are found, the UI refreshes seamlessly without screen flicker.
* **How it is used:** Implemented in [`frontend/src/hooks/useCachedData.js`](frontend/src/hooks/useCachedData.js) and [`frontend/src/utils/db.js`](frontend/src/utils/db.js).

#### **Client-Side PDF.js & Canvas Document Inspection**
* **What is it?** An in-browser PDF rendering engine utilizing HTML5 `<canvas>`.
* **Why do we use it?** If students had to download a 50 MB textbook or lecture deck just to inspect page 1, bandwidth would be wasted. Native browser PDF plugins often fail or download files on mobile devices.
* **How it is used:** The custom PDF previewer fetches the first 3 pages of any vault document using byte-range requests and renders them cleanly in a high-resolution canvas modal.

---

### 2. Backend API & Server Engine

#### **Node.js (JavaScript Runtime) & Express 4.19 (Web Framework)**
* **What is it?** An asynchronous, event-driven JavaScript server framework.
* **Why do we use it?** LOOP's primary backend workloads are I/O-bound: proxying chunked binary streams to MongoDB GridFS, verifying Google OAuth tokens, reading/writing from Redis Cloud, and formatting JSON payloads. Node's non-blocking event loop handles hundreds of concurrent connections with minimal memory footprint compared to multi-threaded servers like Java Spring Boot or Django.
* **How it is used:** Defines RESTful routing, authentication middleware, file ingestion pipelines, and administrative controls in [`backend/server.js`](backend/server.js).

#### **JWT (JSON Web Tokens) & Sliding Session Rotation**
* **What is it?** Cryptographically signed JSON claims (`jsonwebtoken`) stored in client memory.
* **Why do we use it?** Server-side sessions (e.g. `express-session` with Redis storage) require a database lookup on every single API call. JWTs are stateless and verified mathematically using `JWT_SECRET`.
* **Sliding Session Renewal:** To keep active students logged in while protecting inactive sessions, the auth middleware ([`backend/middlewares/auth.js`](backend/middlewares/auth.js)) checks token expiration: if an authenticated request is made within 30 minutes of expiration, the server automatically appends a refreshed token in the response headers.

#### **Dual-Tier Express Rate Limiters (`express-rate-limit`)**
* **What is it?** Middleware restricting incoming client request velocity based on IP address.
* **Why do we use it?** Protects the free-tier Render and Atlas instances against Denial-of-Service (DoS) and brute-force password guessing attacks.
* **Tiered Architecture:**
  1. **Global Rate Limiter:** Permits **1,500 requests per 15 minutes** per IP for standard browsing, search, and document streaming.
  2. **Auth & Password Reset Limiter:** Strictly caps sensitive endpoints (`/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`) to **5 requests per 15 minutes**, thwarting automated credential stuffing.

#### **bcryptjs (12 Salt Rounds)**
* **What is it?** An adaptive, one-way cryptographic password hashing algorithm.
* **Why do we use it?** SHA-256 or MD5 are fast algorithms easily cracked by modern GPUs using rainbow tables. bcrypt introduces a configurable work factor (12 salt rounds in LOOP), ensuring that computing a single hash requires significant CPU time, making brute-force cracking mathematically infeasible.

---

### 3. Database & Storage Infrastructure

#### **MongoDB Atlas Cloud (M0 Free Tier Replica Set)**
* **What is it?** Fully managed cloud MongoDB cluster hosted on AWS with automated failover.
* **Why do we use it?** Placement stories contain varied structures: some companies have 2 interview rounds; others have 5 rounds including group discussions and coding assessments. MongoDB's flexible BSON document model stores nested interview round arrays naturally without requiring dozens of foreign-key relational joins.
* **Indexes:** Compound indexes (`{ company: 1, role: 1, createdAt: -1 }`, `{ status: 1, createdAt: -1 }`) are applied to ensure searches execute in $< 5\text{ ms}$.

#### **MongoDB GridFS (`loop_resources` & `loop_temp_chunks`)**
* **What is it?** MongoDB's native distributed file specification that splits binary files into distinct chunks (`fs.chunks`) and metadata records (`fs.files`).
* **Why do we use it?**
  1. **Exceeds BSON Limit:** MongoDB documents cannot exceed 16 MB. GridFS handles files up to **200 MB** effortlessly.
  2. **Ephemeral Disk Protection:** Render's free hosting tier uses an ephemeral filesystem: any file saved to `./uploads/` on the local disk is permanently destroyed whenever Render restarts or deploys. GridFS stores binary chunks directly inside the persistent MongoDB Atlas cluster, guaranteeing 100% durability across server restarts.
  3. **Streaming I/O:** Files are streamed directly between the database and the client browser without ever loading the entire 200 MB binary into Node.js server RAM.

---

### 4. Distributed Caching Layer

#### **Redis Cloud (In-Memory Data Store)**
* **What is it?** An ultra-low latency, managed in-memory key-value database.
* **Why do we use it?** Querying MongoDB Atlas across the transatlantic network introduces 150ms–300ms of latency per database trip. By storing serialized JSON responses for hot endpoints (`/api/stories`, `/api/resources`, `/api/folders`) in Redis RAM, response latency drops to **under 1 millisecond**.
* **Cache-Aside Pattern:**
  * Request hits API $\to$ Check Redis for key $\to$ **Cache Hit:** Return JSON immediately ($< 1\text{ ms}$).
  * **Cache Miss:** Query MongoDB Atlas ($180\text{ ms}$) $\to$ Write result to Redis with TTL $\to$ Return to client.
* **Active Event-Driven Invalidation:** When an administrator approves a story, deletes a resource, or updates a folder, [`backend/services/cacheService.js`](backend/services/cacheService.js) purges the relevant cache keys immediately using `redis.del()`, preventing stale data.
* **Resilient In-Memory Fallback:** If Redis Cloud is unreachable or disabled via `REDIS_CACHE_ENABLED=false`, the server seamlessly falls back to an internal Node.js LRU memory cache with zero server crashes or downtime.

---

### 5. Cloud Integrations & Campus Identity

#### **Google Identity Services (OAuth 2.0)**
* **What is it?** Google's modern authentication framework (`google-auth-library`).
* **Why do we use it?** Provides one-click login for students and eliminates password fatigue.
* **Domain Enforcement:** The backend strictly inspects the verified Google payload:
  ```javascript
  if (payload.hd !== 'spit.ac.in' || !payload.email.endsWith('@spit.ac.in')) {
    return res.status(403).json({ error: 'Only @spit.ac.in accounts authorized' });
  }
  ```
  Personal `@gmail.com` accounts are strictly barred, ensuring that all submissions and comments originate from verified SPIT campus members.

#### **Brevo Transactional Email Engine (`@getbrevo/brevo`)**
* **What is it?** Cloud transactional delivery service (formerly Sendinblue).
* **Why do we use it?** Sending password reset emails via personal Gmail SMTP connections hits connection rate limits, triggers spam filters, and leaks personal account credentials. Brevo provides authenticated DKIM/SPF delivery ensuring password reset emails arrive in student inboxes in under 3 seconds.
* **Security Architecture:** Generates a 6-digit cryptographic numeric OTP (`crypto.randomInt`), hashes it with **SHA-256**, stores the hash in MongoDB with a 10-minute expiry, and sends the raw OTP via Brevo. Plaintext OTPs are never stored in the database.

---

### 6. DevOps, Containerization & Testing

#### **Vercel Global Edge Network (Frontend Hosting)**
* **What is it?** Edge CDN platform with worldwide server points-of-presence (PoPs).
* **Why do we use it?** Provides lightning-fast asset delivery, automatic gzip/brotli compression, SSL/TLS certificates, and SPA routing rewrites ([`frontend/vercel.json`](frontend/vercel.json)) so that deep links (e.g. `/stories`, `/resources`, `/admin`) resolve smoothly on page refresh.

#### **Render Cloud Application Engine (Backend Hosting)**
* **What is it?** Cloud platform-as-a-service (PaaS) running containerized Node.js web services.
* **Why do we use it?** Automates continuous deployment directly from the GitHub repository (`main` branch). Whenever code is pushed to GitHub, Render pulls the commit, installs dependencies, runs build checks, and executes a zero-downtime hot swap.

#### **Docker (`loop-staging-mongo`)**
* **What is it?** Containerized Linux sandbox running **MongoDB 7.0** on isolated local port `127.0.0.1:27018`.
* **Why do we use it?** Running 214 automated test suites and high-throughput upload benchmarks directly against the live production MongoDB Atlas cluster would risk exhausting database connection limits, dirtying live student records, or triggering rate limits. Docker creates a completely isolated local environment.
* > [!IMPORTANT]
  > **Is Docker needed to run the website?**
  > **No.** Docker is **strictly an optional local testing sandbox**. The live production application runs 100% on cloud platforms (Vercel, Render, MongoDB Atlas, and Redis Cloud). You do **not** need Docker installed or running to browse or use LOOP.

#### **Node.js Native Test Runner (`node --test`)**
* **What is it?** High-performance testing framework built directly into Node.js (v18+).
* **Why do we use it?** Replaces heavy third-party frameworks like Jest or Mocha. Zero extra `node_modules` overhead, instant execution (all 214 tests finish in **1.5 seconds**), native support for asynchronous timers, mocked dates, and sub-test suites.

---

## System Workflows & Sequence Diagrams

### Story Submission & Moderation Lifecycle

To prevent spam, fabricated compensation figures, and abusive language, LOOP uses an asynchronous moderation pipeline:

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student / Senior
    participant Client as Frontend (Vercel)
    participant API as Express API Server (Render)
    participant DB as MongoDB Atlas
    participant Redis as Redis Cloud
    actor Admin as Campus Placement Admin

    Student->>Client: Fills interview roadmap & clicks "Submit Story"
    Client->>API: POST /api/stories { company, role, package, rounds... }
    Note over API: Verifies JWT token & validates schema
    API->>DB: Insert into "pendingstories" collection { status: "pending" }
    API-->>Client: 201 Created { message: "Story submitted for moderation" }
    Client-->>Student: Displays confirmation banner

    Admin->>Client: Opens Admin Dashboard (/admin)
    Client->>API: GET /api/admin/pending-stories
    API->>DB: Query "pendingstories" where status == "pending"
    DB-->>API: Returns list of pending submissions
    API-->>Client: 200 OK [ pendingStories ]
    Client-->>Admin: Displays moderation review table

    Admin->>Client: Clicks "Approve Story"
    Client->>API: POST /api/admin/stories/:id/approve
    API->>DB: Atomically move document from "pendingstories" to "stories"
    API->>Redis: Invalidate cache keys (DEL "stories:*")
    API-->>Client: 200 OK { message: "Story approved successfully" }
    Client-->>Admin: UI updates instantly (confetti / success pill)

    Note over Client,Redis: Next student visit fetches fresh approved story from DB and recaches
```

---

### Brevo 6-Digit Hashed OTP Password Reset

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student (@spit.ac.in)
    participant Client as Frontend (Vercel)
    participant API as Express API Server (Render)
    participant Brevo as Brevo API
    participant DB as MongoDB Atlas

    Student->>Client: Enters campus email on Forgot Password page
    Client->>API: POST /api/auth/forgot-password { email }
    API->>API: Check Auth Rate Limiter (Max 5 req / 15 min)
    API->>DB: Verify student account exists
    API->>API: crypto.randomInt(100000, 999999) -> "749201"
    API->>API: Compute SHA-256("749201") -> hashedOTP
    API->>DB: Store hashedOTP & expiry (Date.now() + 10 mins)
    API->>Brevo: Send transactional email template with OTP
    Brevo-->>Student: Delivers secure OTP to SPIT inbox (<3s)
    API-->>Client: 200 OK { message: "OTP sent to institutional email" }
    
    Student->>Client: Enters 6-digit OTP & new password
    Client->>API: POST /api/auth/reset-password { email, otp: "749201", newPassword }
    API->>DB: Fetch user document with stored hashedOTP
    API->>API: Verify expiry > Date.now()
    API->>API: Constant-time comparison: timingSafeEqual(SHA256(otp), storedHash)
    API->>API: Hash newPassword with bcrypt (12 salt rounds)
    API->>DB: Update password hash & clear OTP fields
    API-->>Client: 200 OK { message: "Password updated successfully" }
    Client-->>Student: Redirects to Login with success toast
```

---

### High-Speed Adaptive Chunking GridFS Upload Pipeline

Earlier versions hardcoded a flat 8 MB chunk size, forcing files $\le 8\text{ MB}$ (like a standard 5.4 MB research paper) to serialize over a single TCP stream. The upgraded pipeline dynamically computes optimal chunk sizes and concurrency based on file payload size:

| File Size Range | Dynamic Chunk Size | Parallel TCP Streams | Target Use Case |
| :--- | :---: | :---: | :--- |
| $\le 1\text{ MB}$ | **1 MB** | **1 Stream** | Cheatsheets, resumes, brief assignment PDFs |
| $1\text{ MB} - 8\text{ MB}$ | **2 MB** | **3 Streams** | Research papers, presentations, IEEE publications |
| $8\text{ MB} - 32\text{ MB}$ | **4 MB** | **5 Streams** | Complete laboratory manuals, textbook chapters |
| $> 32\text{ MB}$ (up to 200 MB) | **8 MB** | **6 Streams** | Full semester video lectures, project ZIP archives |

```mermaid
sequenceDiagram
    autonumber
    actor User as Senior / Contributor
    participant Client as Browser (UploadContext)
    participant API as Express API Server (Render)
    participant TempBucket as GridFS (loop_temp_chunks)
    participant FinalBucket as GridFS (loop_resources)
    participant DB as MongoDB Atlas (UploadSession)

    User->>Client: Selects file (e.g. 5.4 MB IEEE Paper)
    Client->>API: POST /api/resources/upload/init { fileName, fileSize: 5.4MB }
    API->>API: calculateOptimalChunkSize(5.4MB) -> 2MB
    API->>DB: Create UploadSession { totalChunks: 3, chunkSize: 2MB, finalizeGeneration: 0 }
    API-->>Client: 200 OK { uploadId, chunkSize: 2MB, totalChunks: 3, concurrency: 3 }

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
    API->>TempBucket: Verify chunks 0, 1, 2 exist & match sizes
    API->>FinalBucket: Sequentially stream chunks into canonical GridFS file
    API->>DB: Create Resource record in "pendingresources"
    API->>DB: Mark UploadSession.isFinalized = true
    API->>TempBucket: Purge temporary chunks
    API-->>Client: 200 OK { success: true, resource }
    Client-->>User: UploadDock: "Upload Complete" (100%)
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

### Social Sharing & High-Contrast Favicon Engineering

When students share LOOP URLs on WhatsApp, LinkedIn, Twitter, or iMessage, crawler bots scrape the HTML `<head>` tags to render link preview cards.

* **The Problem:** The original LOOP favicon was a transparent PNG with white lines. WhatsApp renders link previews on a pure white card (`#FFFFFF`), causing transparent white logos to vanish completely.
* **The Solution:**
  1. **Open Graph Banner (`/og-image.png`):** A custom $1200 \times 630\text{ px}$ graphic featuring a deep midnight-slate background (`#0A0E17`), ambient violet glow, bold white typography, the SPIT Mumbai emblem, and feature badges.
  2. **High-Contrast Squircle Favicon (`/favicon.png`):** A 512×512 icon featuring a dark rounded squircle badge enclosing the white infinity logo, guaranteeing 100% visibility on light-themed browser tabs and white WhatsApp preview cards.
  3. **Adaptive Vector Favicon (`/favicon.svg`):** Scalable vector asset for high-DPI retina displays.

---

### Placement Document Ingestion & Extraction Engine

LOOP features a dedicated Python and Swift data extraction pipeline ([`backend/scripts/extract_all_placement_years.py`](backend/scripts/extract_all_placement_years.py) and [`backend/scripts/extract_placement_stories.py`](backend/scripts/extract_placement_stories.py)) that audits, normalizes, and extracts placement narratives from **450 raw local documents** into **430 published, verified database stories**:

```mermaid
flowchart TD
    subgraph S1["1. Raw Document Source Layer (450 Files)"]
        A1["Digital PDF Files (.pdf)"]
        A2["Scanned / Canva PDFs"]
        A3["Word Documents (.docx / .doc)"]
    end

    subgraph S2["2. Document Reading & Text Extraction Engine"]
        B1["pypdf Reader"]
        B2["PDF Annotations Parser (/Annots)"]
        B3["Native Apple Vision OCR (ocr_pdf.swift)"]
        B4["python-docx Parser (Paragraphs & Tables)"]
        
        A1 --> B1
        A1 --> B2
        A2 -->|"Text < 50 chars or fragmented"| B3
        A3 --> B4
    end

    subgraph S3["3. Text Normalization & Cleaning Layer"]
        C1["Unicode & Quote Sanitizer ('—', '–', '\u00a0')"]
        C2["List Item Re-segmenter (1. ... 2. ...)"]
        C3["OCR Currency Repair (Converts '7' / '<' / '€' -> '₹')"]
        
        B1 & B3 & B4 --> C1 --> C2 --> C3
    end

    subgraph S4["4. Regex & Entity Extraction Engine"]
        D1["Candidate Name Resolver\n(Filename + Header tokens)"]
        D2["Company Canonicalizer\n(50+ Campus Recruiter Map)"]
        D3["Candidate Branch Detector\n(Sovereign: CSE, CE, EXTC, IT, MCA)"]
        D4["Compensation Parser\n(CTC, Fixed, Bonus, Stipend)"]
        D5["Narrative Stage Parser\n(OA, Technical Rounds, HR)"]
        D6["Hyperlink Extractor\n(LeetCode, GitHub, LinkedIn)"]

        C3 --> D1
        C3 --> D2
        C3 --> D3
        C3 --> D4
        C3 --> D5
        B2 --> D6
    end

    subgraph S5["5. Validation & Payload Assembly"]
        E1["Deterministic Story ID Generator\n('story_YYYY_hash')"]
        E2["Placement Story JSON Schema\n(430 Verified Stories)"]
        
        D1 & D2 & D3 & D4 & D5 & D6 --> E1 --> E2
    end

    subgraph S6["6. Storage & Website Delivery Layer"]
        F1[("MongoDB Atlas Database\n('stories' collection)")]
        F2["Node.js / Express API\n('/api/stories')"]
        F3["LOOP Frontend (React + Vite)\n(Cards, Badges, Detail Views)"]

        E2 --> F1 --> F2 --> F3
    end
```

#### Placement Story Count Breakdown:

| Passout Batch | Raw Documents | Published Verified Stories | Verification Status |
| :--- | :---: | :---: | :--- |
| **Class of 2024** | 61 files | **59 stories** | 2 non-story template files excluded |
| **Class of 2025** | 123 files | **121 stories** | 2 duplicate format files excluded |
| **Class of 2026** | 141 files | **131 stories** | 10 duplicate PDF/DOCX pairs deduplicated |
| **Class of 2027** | 125 files | **119 stories** | 6 duplicate format pairs excluded |
| **Total** | **450 files** | **430 stories** | **100% verified against original campus records** |

---

### Branch Categorization & Sovereign Presentation Architecture

To preserve strict source fidelity while providing intuitive student search:
1. **Three Filter Categories:** The sidebar presents exactly three branch filter categories: `1. CSE`, `2. CE`, `3. EXTC`.
2. **Unified Tracks:**
   - **CSE Track:** Includes `CSE`, `CSE-AIML`, `CSE-DS`, and `IT` (162 total stories).
   - **CE Track:** Includes `CE` / Computer Engineering and `MCA` (190 total stories).
   - **EXTC Track:** Includes `EXTC` / Electronics & Telecommunication (78 total stories).
3. **Sovereign Branch Badges:** Regardless of high-level category groupings, candidate detail badges display their exact degree track:
   - `CSE-DS` $\to$ `CSE (DS)`
   - `CSE-AIML` $\to$ `CSE (AI/ML)`
   - `IT` $\to$ `IT`
   - `CSE` $\to$ `CSE`
   - `CE` / `MCA` $\to$ `CE`
   - `EXTC` $\to$ `EXTC`
4. **Anti-Contamination Rule:** A candidate's degree branch is strictly preserved from their self-reported header and never inferred or overridden from company recruitment eligibility criteria (e.g., `Eligibility: CE/CSE`).

---

## Environment Variables & Configuration Reference

### Backend Configuration (`backend/.env`)

| Variable Name | Required? | Why is it used? (Deep Technical Explanation) | Example Value |
| :--- | :---: | :--- | :--- |
| `PORT` | Yes | Specifies the network port for the Node.js HTTP server. Render dynamically sets this in production, while `5001` is used locally. | `5001` |
| `MONGODB_URI` | Yes | Connection string for the MongoDB Atlas database cluster. Encodes credentials, host cluster, replica set settings, and authentication database. | `mongodb+srv://user:pass@cluster.mongodb.net/loop?retryWrites=true&w=majority` |
| `JWT_SECRET` | Yes | 256-bit cryptographic secret key utilized by `jsonwebtoken` to sign and mathematically verify user auth tokens. | `spit_loop_super_secret_jwt_key_2026` |
| `ALLOWED_ORIGIN` | Yes | CORS security configuration. Dictates which frontend URLs are permitted to access API endpoints and pass credentials. | `https://loop-seven-delta.vercel.app,http://localhost:5173` |
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Client ID issued by Google Cloud Console. Used on the server to verify incoming Google ID tokens via `OAuth2Client.verifyIdToken()`. | `779605241663-...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth 2.0 Client Secret issued by Google Cloud Console for secure server-to-server token exchange. | `GOCSPX-culB16QZE...` |
| `REDIS_URL` | Optional | Connection URI for the Redis Cloud instance. Enables sub-1ms query caching. If omitted, the server automatically defaults to the in-memory cache. | `redis://default:pass@redis-host.db.redis.io:14088` |
| `REDIS_CACHE_ENABLED` | Optional | Global boolean flag (`true`/`false`) allowing instant toggling of Redis caching without code deployments. | `true` |
| `BREVO_API_KEY` | Yes | API authentication key for Brevo (Sendinblue). Authorizes the backend to dispatch 6-digit transactional password reset OTP emails. | `xkeysib-a1218b05...` |
| `EMAIL_FROM` | Yes | The verified sender email address displayed on password reset emails sent to students (`From:` header). | `swapnil.patil24@spit.ac.in` |
| `RESET_SECRET` | Yes | Cryptographic secret used to sign single-use password reset authorization tokens following successful OTP verification. | `spit_loop_reset_auth_token_key_2026` |
| `GRIDFS_CHUNK_SIZE_MB` | Optional | Base chunk partition size in megabytes for large file uploads (Defaults to `8`). | `8` |
| `GRIDFS_UPLOAD_CONCURRENCY`| Optional | Maximum parallel TCP streams allowed during chunked uploads (Defaults to `6`). | `6` |

### Frontend Configuration (`frontend/.env`)

| Variable Name | Required? | Why is it used? (Deep Technical Explanation) | Example Value |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | Yes | Base URL where the frontend makes all REST API requests. Pointed to `http://localhost:5001/api` during local dev and Render in production. | `https://loop-qnh9.onrender.com/api` |
| `VITE_GOOGLE_CLIENT_ID`| Yes | Public Google Client ID loaded by the frontend Google Identity Services SDK to render the "Continue with Google" button. | `779605241663-...apps.googleusercontent.com` |

---

## Codebase Directory Structure

```text
loop/
├── .github/
│   └── workflows/
│       └── publish-docker.yml        # CI/CD: Automated multi-arch container build & push to GHCR
├── backend/
│   ├── Dockerfile                    # Pinned Node.js 20 LTS multi-stage runner (non-root UID 1000)
│   ├── .dockerignore                 # Excludes .env, tests, and temporary node_modules
│   ├── middlewares/                  # Express middleware guards
│   │   ├── auth.js                   # JWT verification, sliding rotation, requireAdmin
│   │   └── upload.js                 # Multer memory storage & MIME whitelist filter
│   ├── scripts/                      # Performance benchmarks & staging suites
│   │   ├── benchmark_upload_performance.js   # GridFS upload benchmark (1MB, 5MB, 20MB)
│   │   ├── benchmark_network_throttling.js   # Simulated 4G, 3G, 2G latency benchmarks
│   │   └── measure_performance_metrics.py    # Multi-metric automated latency profiler
│   ├── services/                     # Core distributed services
│   │   ├── activityService.js        # Audit trail logging for admin actions
│   │   ├── cacheService.js           # Distributed Redis Cloud & in-memory LRU cache
│   │   ├── emailService.js           # Brevo transactional email & OTP dispatcher
│   │   └── storageService.js         # GridFS streaming, adaptive chunking, fenced rollback
│   ├── tests/                        # 219 automated unit & integration test suites
│   │   ├── adminUserAuditAndEmailAuth.test.js
│   │   ├── cacheService.test.js
│   │   ├── demoLoginAndSessionHardening.test.js # Demo auth & session resilience tests
│   │   ├── forgotPassword.test.js
│   │   ├── googleAuth.test.js
│   │   ├── onboardingAndCors.test.js
│   │   ├── storySubmissionLifecycle.test.js
│   │   ├── systemHealthDashboard.test.js
│   │   └── uploadEndpoints.test.js
│   ├── models.js                     # Mongoose schemas & compound database indexes
│   ├── server.js                     # Express API server, routes, & security filters
│   ├── seed.js                       # Database seeding and demo hydration scripts
│   └── package.json                  # Backend dependencies & npm test scripts
│
├── frontend/
│   ├── Dockerfile                    # Multi-stage build: Vite compiler + Unprivileged Nginx runner
│   ├── nginx.conf                    # Nginx SPA fallback routing, API reverse proxy, security headers
│   ├── .dockerignore                 # Excludes .env, local dist, and node_modules
│   ├── public/                       # Static public assets & meta graphics
│   │   ├── apple-touch-icon.png      # 180x180 iOS/macOS bookmark icon
│   │   ├── favicon.png               # 512x512 high-contrast squircle badge (WhatsApp safe)
│   │   ├── favicon.svg               # Adaptive vector SVG favicon
│   │   ├── loop-logo.png             # Transparent navbar & brand logo
│   │   ├── og-image.png              # 1200x630 Open Graph card banner
│   │   └── site.webmanifest          # PWA manifest for mobile devices
│   ├── src/
│   │   ├── assets/                   # Vector branding and illustrations
│   │   ├── components/               # Modular UI widgets
│   │   │   ├── ErrorBoundary.jsx     # React 19 rendering error recovery boundary
│   │   │   ├── Navbar.jsx            # Campus navigation bar with role badges
│   │   │   ├── UploadDock.jsx        # Floating multi-file background upload dock
│   │   │   ├── PDFPreviewModal.jsx   # Client-side canvas PDF previewer
│   │   │   └── StoryCard.jsx         # Expandable interview roadmap cards
│   │   ├── context/                  # React global state contexts
│   │   │   ├── AuthContext.jsx       # Student login state & JWT token management
│   │   │   └── UploadContext.jsx     # Non-blocking background upload state machine
│   │   ├── hooks/                    # Custom React hooks (SWR useCachedData)
│   │   ├── pages/                    # Core view routing
│   │   │   ├── Stories.jsx           # Placement roadmap feed & multi-filter search
│   │   │   ├── Resources.jsx         # 200MB academic vault & folder browser
│   │   │   ├── AdminDashboard.jsx    # Moderation queue, user audit, activity logs
│   │   │   ├── Login.jsx             # Campus login & Google SSO entry point
│   │   │   └── ForgotPassword.jsx    # 6-digit OTP verification & password reset
│   │   ├── utils/                    # Client API wrappers, db.js, and upload.js
│   │   ├── App.jsx                   # Application routing & protected route wrappers
│   │   └── main.jsx                  # React DOM entry point
│   ├── index.html                    # HTML5 shell with Open Graph and Twitter metadata
│   ├── vercel.json                   # Edge CDN SPA rewrite rules
│   └── package.json                  # Frontend dependencies & npm build scripts
│
├── docker-compose.yml                # Production multi-container orchestration (network, healthchecks)
├── .dockerignore                     # Root Docker exclusion rules
├── .env.example                      # Complete environment configuration template with safe placeholders
├── COLLEGE_IT_DEPLOYMENT_HANDOVER.md # Complete SPIT IT Cell deployment and operations manual
├── DOCKER.md                         # Comprehensive Dockerization & container architecture guide
├── render.yaml                       # Render Cloud PaaS infrastructure-as-code specification
├── vercel.json                       # Root Vercel SPA routing fallback configuration
├── reports/                          # Comprehensive audit, security, and performance reports
│   ├── previous_reports/             # Historical engineering verification reports
│   └── ...                           # All 54 technical benchmark, security, and audit reports
├── LICENSE                           # Official MIT License
└── README.md                         # Complete project documentation
```

---

## Automated Verification & Test Harness (220 Tests)

LOOP features an automated test harness executed with Node's native test runner (`node --test`), covering unit models, authentication edge cases, GridFS chunk fencing, one-click demo logins, session cold-start resilience, Redis compression, and HTTP route authorization:

```bash
cd backend
npm test
```

### Complete Test Results: 220 Passed Across 26 Suites (0 Failures)

```text
▶ Redis Cache Service & Resilient Fallback
  ✔ Fallback Mode: Transparently queries fallback fetcher when Redis is disabled/offline
  ✔ Cache Hit: Serves data directly from Redis when key exists
  ✔ Cache Miss & Populate: Fetches from DB and populates Redis with correct TTL
  ✔ Single-Flight / Stampede Prevention: Coalesces concurrent misses into single DB query
  ✔ Malformed Cache Data Recovery: Purges corrupt entry and recovers from DB
  ✔ Redis Client Failure Resiliency: Does not throw when Redis get/set fails
  ✔ Domain Invalidation: invalidateStories removes list and detail keys
  ✔ Domain Invalidation: invalidateResources, invalidateAchievements, and invalidateFolders work accurately
  ✔ Configured Default TTLs are positive integers
  ✔ Disconnection and Reconnection Lifecycle: Degrades gracefully on disconnect and recovers when reconnected
  ✔ Cache Isolation: Keys for admin-only views never collide with public views
  ✔ Single-Flight Error Resilience: Cleans in-flight promise on error so subsequent requests can retry
  ✔ Payload Compression: Compresses large JSON payloads (>1KB) and restores them transparently
✔ Redis Cache Service & Resilient Fallback

▶ One-Click Demo Authentication & Session Resilience Test Suite
  ✔ POST /api/auth/demo-login returns authenticated student session
  ✔ POST /api/auth/demo-login returns authenticated admin session
  ✔ sessionService.isSessionActive does not permanently revoke session on transient DB error
  ✔ authenticateToken rejects forged tokens with HTTP 401
  ✔ authenticateToken rejects expired tokens with HTTP 401
✔ One-Click Demo Authentication & Session Resilience Test Suite

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

ℹ tests 220
ℹ suites 26
ℹ pass 220
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 2855.95
```

---

## Local Development & Setup

### Quickest Start: Instant Multi-Container Docker Deployment
The fastest way to run the entire LOOP SPIT platform (frontend + backend + Nginx reverse proxy) with zero local compilation:

```bash
# 1. Clone the repository
git clone https://github.com/swapnil-exxe/loop.git
cd loop

# 2. Create environment configuration
cp .env.example .env

# 3. Pull pre-built images from GitHub Packages and start
docker compose pull
docker compose up -d

# 4. Verify deployment
curl http://localhost/health
```
The platform is immediately available at `http://localhost`. See [`DOCKER.md`](DOCKER.md) for architecture details and [`COLLEGE_IT_DEPLOYMENT_HANDOVER.md`](COLLEGE_IT_DEPLOYMENT_HANDOVER.md) for campus server deployment.

---

### Standard Development Setup (Without Docker)

### Prerequisites
* **Node.js**: `v18.0.0` or higher
* **npm**: `v9.0.0` or higher
* **MongoDB**: A MongoDB Atlas connection URI or local MongoDB instance

### 1. Clone the Repository
```bash
git clone https://github.com/swapnil-exxe/loop.git
cd loop
```

### 2. Configure & Run Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB Atlas URI, JWT Secret, and Brevo API Key
npm run dev
# Backend starts listening on http://localhost:5001
```

### 3. Configure & Run Frontend
In a second terminal window:
```bash
cd frontend
npm install
cp .env.example .env
# Ensure VITE_API_URL=http://localhost:5001/api
npm run dev
# Frontend client starts on http://localhost:5173
```

### 4. Running with Local Docker Sandbox (Optional for Staging Tests)
If you want to run high-throughput benchmarks or unit test suites locally without touching your live MongoDB Atlas cloud database:
```bash
docker run -d --name loop-staging-mongo -p 127.0.0.1:27018:27017 mongo:7.0
TEST_MONGODB_URI=mongodb://127.0.0.1:27018/loop_test npm test
```

---

## Security, Access Control & Integrity Policies

1. **Strict Institutional Gatekeeping:** All user accounts are bound to `@spit.ac.in`. Out-of-domain accounts are rejected at both the OAuth boundary and the manual registration endpoint.
2. **Administrative Moderation by Default:** Stories and shared resources submitted by students default to `pending` status. They are only queryable in the public library once an administrator has audited and approved them.
3. **MIME-Type & Extension Dual Validation:** File uploads are inspected both by file extension and byte-level MIME headers. All executable formats (`.exe`, `.sh`, `.bat`, `.cmd`, `.msi`) are rejected at the stream boundary.
4. **Fenced Non-Destruction on File Rollbacks:** If an upload worker fails or times out while a newer retry worker has adopted the uploaded file, the superseded worker is cryptographically prevented from deleting the file.
5. **Zero Secret Leakage:** All production secrets are strictly managed through Vercel and Render cloud dashboards; `.env` files are tracked in `.gitignore` and never committed to source control.

---

## License & Acknowledgments

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

Engineered for academic empowerment, peer mentorship, and campus recruitment excellence at **Sardar Patel Institute of Technology (SPIT), Mumbai**.

Copyright © 2026 Swapnil Patil & The LOOP Engineering Team. All rights reserved.
