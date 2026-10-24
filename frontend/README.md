# LOOP — Frontend Web Client
### *Limitless Opportunities, One Platform* • *Their Journey. Your Opportunity.*

[![React](https://img.shields.io/badge/React-19.0-blue?logo=react&style=flat-square)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&style=flat-square)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css&style=flat-square)](https://tailwindcss.com/)
[![Deployment](https://img.shields.io/badge/Deployed-Vercel-black?logo=vercel&style=flat-square)](https://loop-seven-delta.vercel.app/)

The **LOOP Frontend** is the single-page application (SPA) client for **LOOP (Limitless Opportunities, One Platform)** engineered for **Sardar Patel Institute of Technology (SPIT), Mumbai**. Built around the motto *"Their Journey. Your Opportunity."*, it provides a fast, responsive user interface for exploring senior placement experiences, downloading verified campus resources, previewing academic PDFs in-browser, and submitting interview debriefs.

---

## Key Features

1. **Senior Placement Stories Feed (`/stories`):**
   - **430 Verified Placement Stories** spanning the Classes of 2024, 2025, 2026, and 2027.
   - **Three Clean Sidebar Filter Categories:**
     1. **CSE:** Encompasses CSE, CSE-AIML, CSE-DS, and IT.
     2. **CE:** Encompasses CE / Computer Engineering and MCA candidates.
     3. **EXTC:** Electronics & Telecommunication Engineering.
   - **Precise Candidate Badges:** Displays the candidate's exact degree track (`CSE`, `CSE (AI/ML)`, `CSE (DS)`, `IT`, `CE`, `EXTC`) independently of high-level category groupings.
   - **Passout Year Range Filtering:** Instant multi-select and passout slider filters.
   - Clean story cards highlighting candidate name, role, company, semester placed, CGPA, and `"Read Journey →"`.

2. **Placement Preparation Journey View (`/stories/:id`):**
   - Single-column reading layout optimized for deep interview debrief study.
   - Round-by-round selection process breakdown (Online Assessments, Technical Interviews, Managerial/HR rounds).
   - Preparation strategy & study routines with topic-level cards.
   - Verified compensation packages (CTC, Fixed Pay, Variable Bonuses, Relocation/Joining bonuses, and monthly stipends with Indian Rupee `₹` formatting).
   - Direct senior resume downloads and interactive PDF previews via Mozilla `pdfjs-dist`.

3. **Academic Study Vault (`/resources`):**
   - Hierarchical folder navigation (`/DSA/Trees/Roadmap.pdf`).
   - Categorized study materials, cheatsheets, and interview problem sheets.
   - In-browser canvas PDF rendering without external cloud dependencies.

4. **One-Click Demo Authentication & Campus SSO (`/login`):**
   - **One-Click Demo Login:** Features dedicated **`🎓 Student Demo`** and **`🛡️ Admin Demo`** buttons for immediate testing without manual credentials.
   - **Google Identity Services (OAuth 2.0):** Domain-restricted to institutional `@spit.ac.in` accounts.
   - **Animated dual-canvas login** with real-time character state interactions.

5. **Multi-Stage Contribution Modal:**
   - 11-stage guided submission workflow with template insertion for projects and prep routines.
   - Auto-categorization of study attachments and verified resume linking.

6. **Administrative Management (`/admin`):**
   - Real-time moderation queues for pending stories and resources.
   - Campus user intelligence, login audit trails, and student role management.

7. **Resilient SPA Routing & Error Boundaries:**
   - **Zero White-Screen Guarantees:** Vercel SPA rewrites ensure `/stories`, `/resources`, and deep nested links load and refresh cleanly.
   - **React 19 ErrorBoundary:** Catches runtime exceptions with graceful recovery UI.
   - **Lazy Code Splitting:** Heavy PDF processing (`pdfjs-dist`: 918 kB) isolated into `vendor-pdf` chunk, keeping the initial JS bundle at ~386 kB (~116 kB gzip).

---

## Architecture & Directory Structure

```text
frontend/
├── public/                 # Favicon, robots.txt, og-image.png, web manifests
├── src/
│   ├── assets/             # Brand logos and illustration assets
│   ├── components/         # Reusable presentation components
│   │   ├── ErrorBoundary.jsx     # Top-level React 19 rendering error boundary
│   │   ├── FileUploadModal.jsx   # Chunked file upload interface
│   │   ├── Footer.jsx            # Platform footer with legal/campus links
│   │   ├── FormattedText.jsx     # Safe markdown/link renderer for narrative fields
│   │   ├── Navbar.jsx            # Navigation bar with user avatar and campus SSO
│   │   └── UploadDock.jsx        # Non-blocking background upload progress bar
│   ├── context/            # React Context providers (AuthContext, UploadContext)
│   ├── hooks/              # Custom hooks (useCachedData for SWR caching)
│   ├── pages/              # Primary view controllers
│   │   ├── Achievements.jsx      # Student technical competition showcase
│   │   ├── AchievementDetail.jsx # Achievement breakdown and proof links
│   │   ├── AdminDashboard.jsx    # Moderation, user audit, and activity logs
│   │   ├── FilePreviewPage.jsx   # Fullscreen in-browser PDF/Text canvas viewer
│   │   ├── ForgotPassword.jsx    # 6-digit hashed OTP recovery interface
│   │   ├── Landing.jsx           # Public portal landing page
│   │   ├── Login.jsx             # Animated dual-canvas login with Google SSO
│   │   ├── Onboarding.jsx        # First-time student profile setup
│   │   ├── PrivacyPolicy.jsx     # Institutional data privacy guidelines
│   │   ├── Resources.jsx         # Academic resource repository and folder browser
│   │   ├── Stories.jsx           # Placement experience search and filtering feed
│   │   ├── StoryDetail.jsx       # Senior placement interview debrief page
│   │   └── TermsOfUse.jsx        # Campus honor code & submission standards
│   ├── utils/              # Utility helpers and test suites
│   │   ├── branchUtils.js        # Sovereign branch normalization and filter logic
│   │   ├── branchUtils.test.js   # Unit test suite verifying 430 snapshot mappings
│   │   ├── db.js                 # API abstraction layer with resilient fallbacks
│   │   ├── localMockData.js      # Offline development fallback seed records
│   │   └── upload.js             # Adaptive chunking upload protocol
│   ├── App.jsx             # Main routing orchestrator
│   ├── index.css           # Global design system, dark mode tokens & responsive grid
│   └── main.jsx            # React root mount point
├── index.html              # HTML shell with meta tags & SEO schema
├── package.json            # Node.js dependencies and run scripts
├── vercel.json             # Vercel SPA routing and security header rules
└── vite.config.js          # Vite build configuration with Rolldown chunking
```

---

## Branch Normalization & Presentation Utilities

Branch categorization and formatting are standardized centrally in [`src/utils/branchUtils.js`](src/utils/branchUtils.js):

* **Sidebar Categories (`BRANCH_FILTER_CATEGORIES`):** `['CSE', 'CE', 'EXTC']`
* **Filter Mapping (`getFilterCategory`):**
  - `CSE`, `CSE-AIML`, `CSE-DS`, `IT` $\to$ **`CSE`**
  - `CE`, `COMPS`, `MCA` $\to$ **`CE`**
  - `EXTC`, `Electronics`, `ETRX` $\to$ **`EXTC`**
* **Display Badges (`formatDisplayBranch`):**
  - `CSE-DS` $\to$ `CSE (DS)`
  - `CSE-AIML` $\to$ `CSE (AI/ML)`
  - `IT` $\to$ `IT`
  - `CSE` $\to$ `CSE`
  - `CE` / `MCA` $\to$ `CE`
  - `EXTC` $\to$ `EXTC`

---

## Local Development & Setup

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### Installation
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start local development server with Hot Module Replacement (HMR)
npm run dev
```
The client will be running at `http://localhost:5173`.

### Environment Configuration
Create a `.env` file in `frontend/` if overriding the default API URL:
```env
VITE_API_URL=http://localhost:5001/api
```
*(In production, requests automatically proxy to the live Render backend at `https://loop-qnh9.onrender.com/api`)*.

---

## Verification & Testing

Run unit tests and production builds to verify codebase integrity:

```bash
# Run branch utility unit test suite
node --test src/utils/branchUtils.test.js

# Execute full production build
npm run build

# Preview production build locally
npm run preview
```

---

## Deployment

The frontend is continuously integrated and deployed via **Vercel**:
* **Production URL:** [https://loop-seven-delta.vercel.app/](https://loop-seven-delta.vercel.app/)
* Deployed automatically upon every push to the `main` branch of [`swapnil-exxe/loop`](https://github.com/swapnil-exxe/loop).
