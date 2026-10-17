# LOOP — Launchpad of Outstanding Placements
## Independent Senior Application Security Audit & Final Verification Report

**Date of Audit**: October 9, 2026  
**Auditor Role**: Senior Application Security Engineer  
**Codebase Targets**:
* Frontend: React 19 + Vite (Deploy target: Vercel)
* Backend: Node.js + Express (Deploy target: Render)
* Database: MongoDB Atlas (Mongoose + GridFS)
* Authentication: JSON Web Tokens (JWT) + bcryptjs

---

### 1. Executive Summary

A thorough, independent secondary application security audit was performed on the **LOOP** placement portal codebase following previous security remediation efforts. Rather than accepting the previous report at face value, every reported vulnerability was independently inspected in the actual source code, and additional deep security evaluations were conducted across authentication, authorization, access control (IDOR), input handling, path traversal, content moderation, rate limiting, and dependencies.

During this second review:
* All **8 previous findings** were verified as genuinely remediated and defensively hardened.
* **4 additional confirmed vulnerabilities** were identified in the source code:
  1. A **Path Traversal / Arbitrary File Read** risk in the legacy local file streaming fallback.
  2. A **Moderation Bypass** flaw allowing non-administrators to publish resources directly without approval.
  3. A **Privilege Escalation** pathway in the user profile edit request endpoint (`POST /api/users/:email/edit-request`).
  4. An unescaped email query in JWT authentication middleware (`authenticateToken`).
* All newly identified vulnerabilities were safely remediated locally with precise, minimal-impact code fixes.
* Comprehensive regression tests were developed, and the complete backend test suite (**20/20 tests passing**) and frontend production build succeeded with zero errors.

---

### 2. Verification of Previous Findings

| Finding ID | Vulnerability Description | Severity | Independent Audit Verification | Status |
|:---|:---|:---:|:---|:---:|
| **PREV-01** | Hardcoded Fallback JWT Secret | High | Verified in `backend/server.js`: Fallback string removed entirely; fail-fast startup validator ensures `JWT_SECRET` is present and contains >= 32 characters. | **CONFIRMED & FIXED** |
| **PREV-02** | Overly Permissive CORS Configuration | High | Verified in `backend/server.js`: Wildcard regex matching `*.vercel.app` and `*.ngrok.io` removed. Strict explicit allowlist enforced (`loop-seven-delta.vercel.app`, localhost). | **CONFIRMED & FIXED** |
| **PREV-03** | Missing Defensive HTTP Security Headers | Medium | Verified in `frontend/vercel.json`: Strict headers configured including HSTS, X-Content-Type-Options, X-Frame-Options (`SAMEORIGIN`), and a tailored CSP allowing PDF.js workers (`worker-src 'self' blob:`), fonts, and videos. | **CONFIRMED & FIXED** |
| **PREV-04** | Vulnerable Production Dependencies | High | Verified via `npm audit --omit=dev`: Production dependencies for both frontend and backend report **0 vulnerabilities**. | **CONFIRMED & FIXED** |
| **PREV-05** | Unsafe Resource Search Regex (ReDoS) | Medium | Verified in `backend/server.js`: `GET /api/resources` query capped to 100 characters, input sanitized, and metacharacters neutralized via `escapeRegExp()`. | **CONFIRMED & FIXED** |
| **PREV-06** | Excessive Internal User Data Exposure | Low | Verified in `backend/server.js`: Administrative user query `GET /api/users` explicitly projects `-password -__v`. | **CONFIRMED & FIXED** |
| **PREV-07** | Blanket-Only Rate Limiting | Medium | Verified in `backend/server.js`: Dedicated rate limiters active for file streaming/downloads (`fileDownloadLimiter`, 60/15m) and upload sessions (`uploadLimiter`, 30/15m). | **CONFIRMED & FIXED** |
| **PREV-08** | Unauthorized Role Escalation (Profile & Onboard) | High | Verified in `backend/server.js`: `PUT /api/users/:email` restricts role updates to Admins; `PUT /api/users/:email/onboard` restricts roles to authorized non-admin values (`Student`, `Alumni`, etc.). | **CONFIRMED & FIXED** |

---

### 3. Additional Vulnerabilities Discovered & Remediated

#### Finding ADD-01: Path Traversal / Arbitrary File Read in Legacy File Streaming
* **Severity**: **High**
* **Affected File**: `backend/server.js` (lines 1773–1785)
* **Root Cause**:
  In the legacy disk streaming fallback (`/api/resources/:id/file`), the server executed:
  ```javascript
  if (resource.link && resource.link.startsWith('/uploads/')) {
    const localPath = path.join(__dirname, resource.link);
    if (fs.existsSync(localPath)) {
      return fs.createReadStream(localPath).pipe(res);
    }
  }
  ```
  If a malicious user or crafted database entry specified `link: "/uploads/../../.env"` or `link: "/uploads/../package.json"`, `path.join(__dirname, resource.link)` traversed outside `uploads` and resolved to `__dirname/.env`, allowing arbitrary file reading off the server.
* **Remediation Applied**:
  Enforced path boundary containment:
  ```javascript
  const sanitizedFilename = path.basename(resource.link);
  const uploadsDirResolved = path.resolve(UPLOADS_DIR);
  const localPath = path.resolve(uploadsDirResolved, sanitizedFilename);

  if (localPath.startsWith(uploadsDirResolved + path.sep) && fs.existsSync(localPath)) {
    res.setHeader('Content-Type', resource.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resource.originalFileName || resource.title)}"`);
    return fs.createReadStream(localPath).pipe(res);
  }
  ```
* **Status**: **RESOLVED & TESTED**

---

#### Finding ADD-02: Content Moderation Bypass on Resource Uploads
* **Severity**: **High**
* **Affected File**: `backend/server.js` (lines 1329, 1839, 2055)
* **Root Cause**:
  Three upload paths allowed students to bypass moderation and directly publish resources to the live library:
  1. `handleUploadInit`: `const isPending = !isAdmin && req.path.includes('pending-resources');`. Non-admins calling `/api/resources/upload/init` avoided `pending-resources` in the path, setting `isPending: false`.
  2. `POST /api/resources/upload`: Single-file multipart upload passed `{ isPending: false }` without verifying administrator privileges.
  3. `POST /api/resources`: Direct resource creation did not enforce `status: 'pending'` for non-administrators.
* **Remediation Applied**:
  * In `handleUploadInit`: `const isPending = !isAdmin;` unconditionally for all non-administrators.
  * In `POST /api/resources/upload`: Enforced `{ isPending: !isUserAdmin(req.user) }`.
  * In `POST /api/resources`: Explicitly set `resourceData.status = isAdmin ? 'approved' : 'pending';`.
* **Status**: **RESOLVED & TESTED**

---

#### Finding ADD-03: Privilege Escalation via User Profile Edit Requests
* **Severity**: **Medium**
* **Affected File**: `backend/server.js` (lines 945–955)
* **Root Cause**:
  In `POST /api/users/:email/edit-request`, students could submit `{ role: 'Administrator' }` as their pending role:
  ```javascript
  if (email.trim().toLowerCase() !== 'admin@spit.ac.in') {
    user.pendingRole = sanitizeString(role.trim());
  }
  ```
  When an administrator subsequently reviewed and approved the edit request via `POST /api/users/:email/approve-edit`, the user's active role would become `Administrator`, achieving privilege escalation through administrator workflow manipulation.
* **Remediation Applied**:
  Enforced whitelist of acceptable roles for profile edit requests:
  ```javascript
  const ALLOWED_REQUEST_ROLES = ['Student', 'Senior / Contributor', 'Alumni / Contributor', 'Alumni', 'Senior'];
  if (email.trim().toLowerCase() !== 'admin@spit.ac.in') {
    const sanitizedRole = sanitizeString(role.trim());
    if (!ALLOWED_REQUEST_ROLES.includes(sanitizedRole)) {
      return res.status(400).json({ error: 'Invalid role requested. Administrative roles cannot be requested via profile edits.' });
    }
    user.pendingRole = sanitizedRole;
  }
  ```
* **Status**: **RESOLVED & TESTED**

---

#### Finding ADD-04: Unescaped Email Metacharacters in JWT Authentication Lookup
* **Severity**: **Low**
* **Affected File**: `backend/server.js` (line 273)
* **Root Cause**:
  In `authenticateToken`, the user lookup constructed a regular expression from `decoded.email.trim()` without escaping metacharacters (`escapeRegExp`).
* **Remediation Applied**:
  Hoisted `escapeRegExp` helper and sanitized `decoded.email`:
  ```javascript
  const user = await User.findOne({ email: new RegExp('^' + escapeRegExp((decoded.email || '').trim()) + '$', 'i') });
  ```
* **Status**: **RESOLVED & TESTED**

---

### 4. Dependency Security Audit Results

#### Frontend (`frontend/package.json`)
* **Tool**: `npm audit`
* **Vulnerabilities Found**: **0 vulnerabilities** (0 Critical, 0 High, 0 Medium, 0 Low).
* **Build Integrity**: Production build compiled cleanly with Vite in 545ms.

#### Backend (`backend/package.json`)
* **Tool**: `npm audit --omit=dev` (Production Runtime)
* **Production Vulnerabilities Found**: **0 vulnerabilities** (0 Critical, 0 High, 0 Medium, 0 Low).
* **Development Dependencies Note**: Local development tool `nodemon` depends on an older `chokidar`/`braces` package. This advisory affects only local file watching during development and is not bundled or executed in production.

---

### 5. Automated Tests Executed & Actual Results

**Test Runner**: Node.js built-in test runner (`node --test tests/*.test.js`)  
**Execution Command**: `npm test` inside `backend/`

```text
✔ Security Fix: CORS Allowlist strictly validates origins (0.67ms)
✔ Security Fix: JWT_SECRET strength validation (0.13ms)
✔ Security Fix: escapeRegExp neutralizes catastrophic ReDoS patterns (0.23ms)
✔ Security Fix: Privilege escalation prevention in user profile updates (0.15ms)
✔ Security Fix: Onboarding role restriction blocks administrative privilege self-assignment (0.12ms)
✔ Security Fix: Profile edit request prevents asking for administrative roles (0.10ms)
✔ Security Fix: Path traversal prevention in legacy file streaming (0.23ms)
✔ Security Fix: Non-admin uploads are strictly routed through moderation (0.96ms)
✔ CORS origin check allowed origins (0.77ms)
✔ getSystemMetrics returns memory and database state (245.41ms)
✔ verifyAndRotateToken rejects requests without bearer token (0.87ms)
✔ verifyAndRotateToken allows valid token and rotates near-expiration token (1.55ms)
▶ MongoDB GridFS Storage Service & Upload Validation
  ▶ File Size Validation (200 MB Limit)
    ✔ enforces 200 MB maximum limit (209,715,200 bytes) (0.64ms)
    ✔ formatBytes formats file sizes correctly (0.19ms)
  ✔ File Size Validation (200 MB Limit) (1.47ms)
  ▶ File Whitelist & Security Checks
    ✔ accepts educational documents: PDF, DOC, DOCX, TXT, RTF, ODT (0.24ms)
    ✔ accepts spreadsheets & presentations: XLS, XLSX, CSV, PPT, PPTX (0.10ms)
    ✔ accepts images & archives: PNG, JPG, WEBP, ZIP, RAR, 7Z (0.10ms)
    ✔ accepts programming code files: JAVA, PY, JS, TS, CPP, SQL, MD (0.12ms)
    ✔ strictly blocks dangerous executables: .exe, .bat, .cmd, .sh, .msi, .dll (0.12ms)
  ✔ File Whitelist & Security Checks (0.89ms)
  ▶ File Category Classifier
    ✔ correctly classifies files by extension and mimeType (0.18ms)
  ✔ File Category Classifier (0.31ms)
✔ MongoDB GridFS Storage Service & Upload Validation (3.05ms)

Total Tests: 20 passed, 0 failed, 0 skipped (100% pass rate)
```

---

### 6. Remaining Risks & Operational Limitations

1. **Production Environment Secrets (`Render Dashboard`)**:
   * The backend's fail-fast startup protection requires that `JWT_SECRET` is defined in the Render Environment Variables with at least 32 characters.
   * If `JWT_SECRET` is absent or shorter than 32 characters in Render, the server will intentionally terminate on startup.
2. **MongoDB Atlas IP Whitelist**:
   * Outbound IPs from Render change dynamically unless a static outbound IP add-on is used. Ensure MongoDB Atlas Network Access permits connections from Render (`0.0.0.0/0` with strong database user credentials).
3. **No Dynamic Pen-Testing Executed on Third-Party Infrastructure**:
   * Live network penetration tests (such as automated fuzzing against live Render/Vercel endpoints) were not conducted, in adherence to strict non-destructive testing guidelines.

---

### 7. Manual Deployment Configuration Required

Prior to triggering production deployment:
1. **Render Environment Settings**:
   * Verify `JWT_SECRET` is set to a cryptographically secure random string of 32+ characters:
     ```bash
     # Example generator
     openssl rand -hex 32
     ```
   * Verify `ALLOWED_ORIGIN` contains `https://loop-seven-delta.vercel.app`.
   * Verify `NODE_ENV=production`.
2. **Vercel Settings**:
   * Verify `VITE_API_URL` or default backend URL points to `https://loop-qnh9.onrender.com`.

---

### 8. Final Deployment-Readiness Verdict

## **VERDICT: READY WITH WARNINGS**

* **Status Explanation**:
  * **Codebase**: Fully hardened, audited, and verified locally. All confirmed vulnerabilities (including CORS, ReDoS, privilege escalation, moderation bypass, path traversal, and security headers) have been remediated with automated tests passing.
  * **Warnings**:
    1. Ensure the production `JWT_SECRET` variable in the Render Dashboard meets the 32-character requirement before deploying the new backend code to avoid startup termination.
    2. Ensure that `.env` files are never tracked or committed to GitHub.
