# LOOP — Launchpad Of Outstanding Placements

[![React](https://img.shields.io/badge/React-19.0-blue?logo=react&style=flat-square)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node.js-Express-green?logo=node.js&style=flat-square)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas_%26_GridFS-brightgreen?logo=mongodb&style=flat-square)](https://www.mongodb.com/)
[![Tests](https://img.shields.io/badge/Automated_Tests-45_Passed-success?style=flat-square)](backend/tests/)
[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel&style=flat-square)](https://loop-seven-delta.vercel.app/)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&style=flat-square)](https://loop-qnh9.onrender.com/)

**LOOP** is a high-performance, institutional placement preparation portal engineered for college students and alumni. It bridges the gap between theoretical classroom learning and competitive campus hiring by creating a verified knowledge-sharing ecosystem. Juniors learn directly from the 4-year roadmaps, actual interview questions, and verified resumes of seniors placed at top engineering and technology firms.

---

## Deployments & Demo Access

| Environment | Service | URL |
| :--- | :--- | :--- |
| **Frontend** | Production Single Page Application | [https://loop-seven-delta.vercel.app/](https://loop-seven-delta.vercel.app/) |
| **Backend** | Production RESTful API Server | [https://loop-qnh9.onrender.com/](https://loop-qnh9.onrender.com/) |
| **Database** | Managed Cloud Database | MongoDB Atlas + GridFS Storage |

### Demo Credentials

You can explore role-based features using these test accounts or your campus Google account:

* **Student Account**:
  * Email: `student@spit.ac.in`
  * Password: `student123`
* **Google OAuth**:
  * Any active institutional `@spit.ac.in` Google account can log in or register directly via the Google Sign-In button.

---

## Core Problems Solved

### 1. The "Where to Start?" Dilemma (Lack of Roadmaps)
* **Problem**: College students frequently feel overwhelmed when preparing for technical hiring, lacking guidance on when to begin DSA, system design, or full-stack projects.
* **Solution**: LOOP structures senior stories into progressive year-by-year timelines (`First Year`, `Second Year`, `Third Year`, and `Fourth Year`), giving juniors actionable milestones for each academic semester.

### 2. Resume & Portfolio Ambiguity
* **Problem**: Students often struggle to understand what technical project depth or resume layouts recruiters actually value.
* **Solution**: Seniors upload their verified resumes and technical portfolio items directly to MongoDB GridFS. Juniors can inspect successful resume templates that secured shortlists at companies such as Microsoft, Cisco, NVIDIA, and Morgan Stanley.

### 3. Disconnect Between Theory and Actual Interviews
* **Problem**: Standard online coding platforms offer generic problem sets that rarely mirror campus-specific hiring workflows.
* **Solution**: Every senior story features an interview breakdown detailing:
  * Online Assessment (OA) platforms, topics, and problem difficulty.
  * Technical interview questions, system architecture discussions, and coding prompts.
  * Behavioral and HR round questions and expectations.

### 4. Fragmented & Unvetted Study Materials
* **Problem**: Useful notes, interview sheets, and curated links are often lost across scattered chat groups and dead links.
* **Solution**: LOOP provides an academic study vault arranged in hierarchical folders (`/DSA`, `/System Design`, `/Web Dev`, `/Core CS`). All contributions undergo administrative verification before going live.

---

## Architecture & Technology Stack

```
   ┌─────────────────────────────────────────────────────────────────┐
   │                         CLIENT BROWSER                          │
   │   React 19 (Vite 8) • React Router v7 • Lucide Icons • SWR      │
   └───────────────────────────────┬─────────────────────────────────┘
                                   │ HTTPS / REST JSON
                                   ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                       NODE.JS / EXPRESS API                     │
   │  Helmet CSP • Dual-Tier Rate Limiting • UserAuthCache • JWT     │
   └───────────────┬───────────────────────────────┬─────────────────┘
                   │ Mongoose ODM                  │ Stream Protocol
                   ▼                               ▼
   ┌───────────────────────────────┐ ┌───────────────────────────────┐
   │      MONGODB ATLAS NO-SQL     │ │    MONGODB GRIDFS BUCKETS     │
   │  Users • Stories • Resources  │ │   fs.files • fs.chunks (200MB)│
   └───────────────────────────────┘ └───────────────────────────────┘
```

| Layer | Technologies | Implementation Details |
| :--- | :--- | :--- |
| **Frontend UI** | **React 19**, **Vite 8**, **React Router v7** | Single Page Application with Apple-minimalist liquid glass styling, responsive grid layouts, and zero-emoji design. |
| **Icons & Styling** | **Lucide React**, **CSS Variables** | Cohesive vector iconography, pill buttons (`999px`), subtle contrast borders, and GPU-accelerated micro-interactions. |
| **State & Caching** | **Custom SWR Hooks**, `sessionStorage` | Stale-while-revalidate client cache providing **0ms** navigation transitions with optimistic background revalidation. |
| **Backend API** | **Node.js (v18+)**, **Express 4.19** | Stateless REST server with route-level input validation, rate limiting, and centralized error sanitization. |
| **Database** | **MongoDB Atlas**, **Mongoose 8** | Schema validation, compound indexing, deterministic sorting, and relationship population. |
| **Binary Storage** | **MongoDB GridFS** (`fs.files`, `fs.chunks`) | Chunked document and PDF streaming up to 200MB directly within database clusters. |
| **Authentication** | **JWT**, **Google OAuth 2.0** | Cryptographic token rotation, campus domain validation (`@spit.ac.in`), and in-memory LRU auth cache. |

---

## Functional Modules

### 1. Senior Stories Archive
* **3D Interactive Perspective Cards**: Real-time cursor tracking tilt effect (`Story3DCard`) rendering key placement stats, student avatars, and company badges.
* **Hinge-Style Story Prompts**: Structured blocks separating personal golden rules, preparation strategy, and round-by-round interview breakdowns.
* **Archive Contribution Modal**: Liquid glass modal with quick-jump section anchors, reusable templates (`+ Insert Project Template`, `+ Insert Rounds Template`, `+ Insert Advice Template`), and custom section prompts.
* **Resume & Attachment Handling**: Integrated file upload with instant client preview and GridFS storage.

### 2. Academic Vault & Hierarchical Folders
* **Nested Directory Tree**: Dynamic folder structure supporting arbitrary depth (e.g., `/DSA/Trees/Roadmap.pdf`).
* **Multi-Format Media Streamer**: In-browser document viewer supporting high-resolution PDF rendering via `pdfjs-dist` and inline image review.
* **Tag-Based Filtering**: Search and filter resources by technical topic, file type, or contributor branch.

### 3. Administrative Moderation Hub
* **Two-Tier Approval Queues**: Dedicated staging queues for pending stories and resources to guarantee content quality.
* **Optimistic Actions**: Approvals and rejections execute instantly in the UI with automatic rollback upon failure.
* **Role Governance**: Secure administration dashboard for monitoring student registrations, profile updates, and system metrics.

### 4. Hall of Fame & Achievements
* **Curated Milestones**: Showcase top campus achievements, competitive programming rankings, and hackathon wins.
* **Rich Metadata**: Verified team rosters, external repository links, and photographic proof of accomplishments.

---

## Security & Scalability Engineering

### Institutional Google OAuth & Domain Restriction
* All Google OAuth sign-in and registration attempts strictly enforce the `@spit.ac.in` domain at both the OAuth verifier and database schema levels. Non-institutional accounts are rejected with an explicit `403 Forbidden` response.

### High-Performance UserAuthCache
* An in-memory LRU authentication cache caches verified user records with a 5-minute TTL to reduce database lookup overhead during frequent authenticated requests.
* **Event-Driven Eviction**: The cache immediately purges affected keys upon role changes, account suspensions, or password modifications.

### Dual-Tier Campus Rate Limiting
* **Global Tier**: Accommodates shared campus lab NAT IP addresses with up to 1,500 requests per 15-minute window.
* **Sensitive Tier**: Strict brute-force protection on authentication, signup, and password verification endpoints.

### Defense-in-Depth Hardening
* **ReDoS Prevention**: Sanitizes user search inputs using `escapeRegExp` to prevent catastrophic regular expression backtracking.
* **Privilege Escalation Protection**: Onboarding, registration, and user edit endpoints strictly prohibit self-assignment of administrative roles.
* **File Upload Security**: Enforces a strict MIME-type whitelist for educational documents and images while rejecting executable extensions (`.exe`, `.sh`, `.bat`, `.msi`, `.dll`).
* **HTTP Security Headers**: Strict Content Security Policy (CSP), frameguard rules, and restricted CORS allowlists configured via Helmet.

---

## Codebase Structure

```text
loop/
├── backend/
│   ├── middlewares/          # JWT verification & token rotation middleware
│   ├── services/             # Google OAuth & GridFS file storage services
│   ├── tests/                # 45 automated unit and integration tests
│   ├── models.js             # Mongoose schemas & compound database indexes
│   ├── server.js             # Express API server, routes, & security filters
│   ├── seed.js               # Database seeding and demo hydration scripts
│   ├── .env.example          # Backend environment variable template
│   └── package.json          # Backend dependencies & npm scripts
│
├── frontend/
│   ├── src/
│   │   ├── assets/           # Vector branding and illustrations
│   │   ├── components/       # Reusable UI widgets, Navbar, modals, & viewers
│   │   ├── context/          # React contexts for authentication & theme state
│   │   ├── hooks/            # Custom hooks (SWR useCachedData, etc.)
│   │   ├── pages/            # Views (Stories, Resources, Admin, Login, etc.)
│   │   ├── utils/            # API client wrappers & database helpers
│   │   ├── App.jsx           # Main application routing & protected route guards
│   │   └── main.jsx          # DOM entry point
│   ├── public/               # Public assets and fallback avatars
│   ├── vercel.json           # SPA rewrite rules for production hosting
│   ├── .env.example          # Frontend environment variable template
│   └── package.json          # Frontend dependencies & npm scripts
│
├── PHASE3_EVALUATION_REPORT.md # Comprehensive 25-mark evaluation audit & viva prep
└── README.md                 # Complete project documentation
```

---

## Automated Test Suite

LOOP includes an automated test suite executed with the native Node.js test runner:

```bash
cd backend
npm test
```

### Test Coverage Summary (45 / 45 Tests Passing)

* **Google OAuth & Domain Restriction (11 tests)**: Institutional `@spit.ac.in` domain enforcement, token verification, account linking, and signup validation.
* **Rate Limiting & Abuse Prevention (2 tests)**: Shared-IP campus lab tolerance (1,500 req/15min) and sensitive route rate limiting.
* **UserAuthCache (5 tests)**: Storage and retrieval, TTL expiration, event-driven invalidation on role changes, and LRU cache eviction.
* **Pagination & Query Optimization (2 tests)**: Standardized page limits, offset calculation, and pagination response headers.
* **Database Indexes & Sorting (2 tests)**: Compound index validation for Story, Resource, and Folder models.
* **Security & Vulnerability Fixes (9 tests)**: CORS allowlist validation, JWT secret strength, ReDoS escaping, privilege escalation blocking, and path traversal prevention.
* **Database Storage Resiliency (2 tests)**: Storage quota error handling and safe error messaging.
* **GridFS File Validation & Storage (9 tests)**: 200MB file limit enforcement, format classification, and executable file blocking.
* **System Metrics & Token Rotation (3 tests)**: Health metrics reporting, bearer token validation, and automatic token renewal.

---

## Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **MongoDB**: A running local MongoDB instance or a free MongoDB Atlas connection string

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

Edit `backend/.env` with your configuration:
```env
PORT=5001
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_super_secret_jwt_key
ALLOWED_ORIGIN=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 3. Configure Frontend
```bash
cd ../frontend
npm install
cp .env.example .env
```

Edit `frontend/.env`:
```env
VITE_API_URL=http://localhost:5001/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

### 4. Seed Database (Optional)
Hydrate your database with sample placement stories and resources:
```bash
cd ../backend
npm run seed
```

### 5. Run the Application
Open two separate terminal windows:

* **Terminal 1 (Backend API)**:
  ```bash
  cd backend
  npm run dev
  # Server starts on http://localhost:5001
  ```

* **Terminal 2 (Frontend Client)**:
  ```bash
  cd frontend
  npm run dev
  # Client starts on http://localhost:5173
  ```

---

## Git Workflow & Branching Strategy

The project adheres to structured Git conventions:

* **Branching Model**:
  * `main`: Production-ready branch deployed to Vercel and Render.
  * `feature/*`: Isolated branches for new modules or enhancements.
  * `bugfix/*` / `fix/*`: Targeted patches and issue resolutions.
* **Commit Conventions**: Conventional commits format (`feat:`, `fix:`, `style:`, `test:`, `docs:`, `refactor:`).

---

## Evaluation & Documentation

For full Phase 3 viva preparation, architectural diagrams, API route catalogs, and Git commit evidence, refer to:
* **[PHASE3_EVALUATION_REPORT.md](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/PHASE3_EVALUATION_REPORT.md)**: Comprehensive evaluation report with 32 viva questions and answers, Git branch analysis, and live demonstration checklist.

---

## License

This project is developed for educational and academic use at Sardar Patel Institute of Technology (SPIT). All rights reserved.
