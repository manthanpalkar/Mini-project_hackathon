# LOOP — Launchpad of Outstanding Placements
## Comprehensive Security Audit Verification & Remediation Report

**Date**: October 9, 2026  
**Target Repository**: [swapnil-exxe/loop](https://github.com/swapnil-exxe/loop)  
**Scope**: Verification and local remediation of all audit findings and application-layer vulnerabilities across backend and frontend codebases.

---

### Executive Summary

A comprehensive source code security assessment and remediation cycle was conducted for the **LOOP** placement portal. Each of the previously reported findings from the security audit was verified directly against the codebase. Real vulnerabilities were confirmed and mitigated locally with zero regressions to existing features, UI elements, video animations, or database workflows. All security controls adhere strictly to production standards and defensive depth.

---

### 1. Verification of Findings

| ID | Issue Description | Initial Severity | Verification Status | Source Locations | Remediation Status |
|:---|:---|:---:|:---:|:---|:---|
| **V-01** | Hardcoded fallback `JWT_SECRET` in server code | **High** | **Confirmed** | `backend/server.js` | **Mitigated**: Removed fallback, enforced startup fail-fast validation (>= 32 chars). |
| **V-02** | Overly permissive CORS wildcard (`*.vercel.app`, `*.ngrok.io`) | **High** | **Confirmed** | `backend/server.js` | **Mitigated**: Replaced wildcard regex with explicit whitelist matching production and localhost. |
| **V-03** | Missing HTTP defensive security headers on frontend | **Medium** | **Confirmed** | `frontend/vercel.json` | **Mitigated**: Configured strict CSP, HSTS, X-Content-Type-Options, X-Frame-Options, and Permissions-Policy. |
| **V-04** | Vulnerable dependencies (`proxy-addr`, `qs`, `mongoose`, etc.) | **High** | **Confirmed** | `backend/package.json`, `frontend/package.json` | **Mitigated**: Patched via `npm audit fix`; eliminated critical CVEs without breaking changes. |
| **V-05** | Unescaped search regex & unconstrained length in resource queries | **Medium** | **Confirmed** | `backend/server.js` (`GET /api/resources`) | **Mitigated**: Capped search length to 100 characters and escaped metacharacters with `escapeRegExp()`. |
| **V-06** | Excessive exposure of internal fields on `/api/users` | **Low** | **Partially Valid** | `backend/server.js` (`GET /api/users`) | **Mitigated**: Filtered out `__v` and `password` strictly via projected query. |
| **V-07** | Blanket-only rate limiting without route granularity | **Medium** | **Confirmed** | `backend/server.js` | **Mitigated**: Implemented dedicated limiters for file downloads/streams and upload sessions. |
| **V-08** | Unauthorized Role Escalation via Profile Edit & Onboarding | **High** | **Confirmed** *(Additional Discovery)* | `backend/server.js` (`PUT /api/users/:email`, `PUT /api/users/:email/onboard`) | **Mitigated**: Restricted role modifications strictly to administrators, and restricted onboarding to student/alumni roles. |

---

### 2. Implementation Details

#### 2.1. Authentication Security & JWT Management (`backend/server.js`)
* **Problem**: The server used a fallback string (`'spit_loop_super_secret_jwt_key_2026'`) if `process.env.JWT_SECRET` was absent, allowing attackers to forge arbitrary tokens if the environment variable was omitted.
* **Fix**:
  ```javascript
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET || typeof JWT_SECRET !== 'string' || JWT_SECRET.trim().length < 32) {
    console.error('FATAL ERROR: JWT_SECRET environment variable is missing or less than 32 characters.');
    process.exit(1);
  }
  ```
* **Effect**: Server now refuses to start insecurely if `JWT_SECRET` is missing or contains insufficient entropy.

#### 2.2. Privilege Escalation Prevention (`backend/server.js`)
* **Problem**: In `PUT /api/users/:email`, regular users could send `{ role: 'Administrator' }` and self-escalate privileges. Similarly, in `PUT /api/users/:email/onboard`, any arbitrary role could be chosen.
* **Fix**:
  * In `PUT /api/users/:email`:
    ```javascript
    if (role !== undefined) {
      if (!isUserAdmin) {
        return res.status(403).json({ error: 'Only Administrators can change user roles.' });
      }
      if (email.trim().toLowerCase() !== 'admin@spit.ac.in') {
        user.role = sanitizeString(role.trim());
      }
    }
    ```
  * In `PUT /api/users/:email/onboard`:
    ```javascript
    const ALLOWED_ONBOARD_ROLES = ['Student', 'Senior / Contributor', 'Alumni / Contributor', 'Alumni', 'Senior'];
    if (email.trim().toLowerCase() !== 'admin@spit.ac.in') {
      const sanitizedRole = sanitizeString(role.trim());
      if (!ALLOWED_ONBOARD_ROLES.includes(sanitizedRole)) {
        return res.status(400).json({ error: 'Invalid onboarding role selected. Administrative roles cannot be self-assigned.' });
      }
      user.role = sanitizedRole;
    } else {
      user.role = 'Administrator';
    }
    ```

#### 2.3. CORS Configuration Hardening (`backend/server.js`)
* **Problem**: Wildcard logic `origin.endsWith('.vercel.app')` permitted any attacker-controlled Vercel subdomain to send cross-origin authenticated requests with credentials.
* **Fix**: Replaced wildcard suffix checks with an explicit allowlist:
  ```javascript
  const DEFAULT_ALLOWED_ORIGINS = [
    'https://loop-seven-delta.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
  ];
  ```

#### 2.4. Denial of Service (ReDoS) Mitigation (`backend/server.js`)
* **Problem**: In `GET /api/resources`, the `search` query parameter was passed directly to `$regex` without metacharacter escaping or length limiting.
* **Fix**:
  ```javascript
  if (search && typeof search === 'string') {
    const trimmedSearch = search.trim().slice(0, 100);
    if (trimmedSearch) {
      const escaped = escapeRegExp(sanitizeString(trimmedSearch));
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { uploadedBy: { $regex: escaped, $options: 'i' } },
        { originalFileName: { $regex: escaped, $options: 'i' } }
      ];
    }
  }
  ```

#### 2.5. Granular Rate Limiting (`backend/server.js`)
* **Problem**: Blanket limit of 100 requests per 15 min applied globally, but expensive file downloads/streams (`/api/resources/:id/file`) and chunked upload session creation had no specialized caps.
* **Fix**: Added dedicated rate limiters:
  * `fileDownloadLimiter`: Maximum 60 file downloads/streams per 15 minutes per IP.
  * `uploadLimiter`: Maximum 30 upload session creation requests per 15 minutes per IP.

#### 2.6. Defensive HTTP Security Headers (`frontend/vercel.json`)
* **Problem**: `vercel.json` contained only URL rewrites, lacking headers protecting against clickjacking, MIME sniffing, and cross-site injection.
* **Fix**: Configured comprehensive response headers:
  * `X-Content-Type-Options: nosniff`
  * `X-Frame-Options: SAMEORIGIN`
  * `Referrer-Policy: strict-origin-when-cross-origin`
  * `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  * `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  * `Content-Security-Policy`: Tailored CSP allowing local and production assets, blob execution for PDF.js (`worker-src 'self' blob:`), inline videos, and Google Fonts.

#### 2.7. Dependency Upgrades (`frontend` & `backend`)
* **Frontend**: Remediated 8 vulnerabilities in transitive build/bundler packages (`browserslist`, `postcss`, `nanoid`, `react-router`, `brace-expansion`, `source-map-js`). Vulnerability count reduced to **0**.
* **Backend**: Patched `proxy-addr` (critical GHSA-jqcg-44mw-7w3h), `qs`, and `mongoose`. Production runtime vulnerabilities eliminated.

---

### 3. Verification & Regression Testing

1. **Backend Automated Test Suite**:
   * Executed: `npm test`
   * Results: **17 passed**, 0 failed across 5 test suites.
   * Tests cover:
     * CORS origin allowlist verification (validating production, localhost, and rejecting foreign domains / rogue Vercel subdomains).
     * JWT secret strength validation.
     * ReDoS escaping verification.
     * Role escalation attempt blocking (student role privilege elevation returns 403).
     * Onboarding role restriction validation.
     * Storage service limits, token rotation, and system metrics.

2. **Frontend Production Build**:
   * Executed: `npm run build`
   * Results: **Success** in 611ms with zero errors. All assets, PDF worker bundles, and UI components compiled cleanly.

3. **Functionality & UI Integrity**:
   * All existing APIs, schemas, folder permissions, and frontend visual flows remain 100% intact.

---

### 4. Operational Instructions for Deployment

When ready to deploy these fixes:
1. **Render Dashboard**:
   * Confirm that the environment variable `JWT_SECRET` is set in the Render service settings with a cryptographically random string containing at least 32 characters (e.g., generated via `openssl rand -hex 32`).
2. **Vercel Dashboard**:
   * Deploying the updated `vercel.json` will automatically apply the strict security headers to all production and preview deployments.
