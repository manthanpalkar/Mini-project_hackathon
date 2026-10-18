# 🛡️ LOOP Placement Portal — Security Audit & Penetration Testing Report

**Targets Audited:**
- **Frontend:** [https://loop-seven-delta.vercel.app/](https://loop-seven-delta.vercel.app/)
- **Backend API:** [https://loop-qnh9.onrender.com/](https://loop-qnh9.onrender.com/)
- **Source Code Repository:** [https://github.com/swapnil-exxe/loop](https://github.com/swapnil-exxe/loop)

**Audit Framework:** Strix AI Penetration Testing Suite (`strix-agent v1.7.0`) & Manual Verification  
**Evaluation Mode:** Read-Only Non-Destructive Security Assessment  
**Date:** October 9, 2026  
**Artifact Directory:** `strix_runs/audit_20261009/`

---

## 1. Executive Summary

A comprehensive, non-destructive security assessment of the **LOOP** placement preparation portal was executed across the deployed client on Vercel, the REST API on Render, and the GitHub source code.

The assessment identified **7 security findings**, consisting of **1 Critical Vulnerability**, **2 High Severity Vulnerabilities**, **2 Medium Severity Vulnerabilities**, and **2 Low Severity Vulnerabilities**.

### Key Highlights:
1. **Critical Authentication Bypass (LOOP-SEC-001)**: The production server on Render runs using a hardcoded fallback JWT signing secret (`spit_loop_super_secret_jwt_key_2026`). An attacker can forge arbitrary administrator tokens and gain unrestricted control over the entire system without knowing any user passwords.
2. **Wildcard Subdomain CORS Vulnerability (LOOP-SEC-002)**: The CORS configuration trusts all origins matching `*.vercel.app` with `credentials: true`. An attacker hosting any free project on Vercel can make cross-origin authenticated requests and read confidential student records.
3. **Missing Frontend Security Headers (LOOP-SEC-003)**: The Vercel frontend lacks defensive headers (CSP, HSTS, X-Frame-Options), leaving the client susceptible to clickjacking.
4. **Vulnerable Dependencies (LOOP-SEC-004)**: Critical and high advisories exist in the project tree (`proxy-addr`, `qs`, `braces`).

---

## 2. Assessment Methodology & Scan Coverage

| Category | Coverage & Methodology | Status |
| :--- | :--- | :--- |
| **Strix Framework Preflight** | Strix CLI installed (`/opt/anaconda3/bin/strix v1.7.0`). Docker daemon was not running locally and external LLM API keys (`STRIX_LLM`/`LLM_API_KEY`) were not configured in the shell environment. | Local automated container agent bypassed; fallback to static & targeted active PoC testing. |
| **Authentication & Tokens** | Analyzed token generation, validation, expiration, and secret key handling. | Complete |
| **Authorization & RBAC** | Tested student-to-admin privilege escalation and IDOR across user endpoints. | Complete |
| **CORS & Network Boundaries** | Checked CORS headers, preflight responses, and origin reflection. | Complete |
| **Resource & File Uploads** | Evaluated Busboy stream processing, GridFS chunking, and MIME validation. | Complete |
| **Dependencies & Deployment** | Checked NPM audit advisories, HTTP security headers, and cloud configurations. | Complete |

---

## 3. Vulnerability Summary by Severity

| Severity | Count | Finding IDs |
| :--- | :---: | :--- |
| **Critical** | 1 | `LOOP-SEC-001` |
| **High** | 2 | `LOOP-SEC-002`, `LOOP-SEC-004` |
| **Medium** | 2 | `LOOP-SEC-003`, `LOOP-SEC-005` |
| **Low** | 2 | `LOOP-SEC-006`, `LOOP-SEC-007` |
| **Total** | **7** | |

---

## 4. Detailed Vulnerability Findings

### 🔴 LOOP-SEC-001: Default Fallback JWT Secret Leads to Complete Authentication Bypass
* **Severity**: **Critical (CVSS 9.8 / CWE-798 - Use of Hard-coded Credentials)**
* **Affected Component**: `backend/server.js` (Line 22 & Line 243)
* **Affected Endpoint**: All authenticated endpoints (`/api/users`, `/api/stories`, `/api/admin/*`)
* **Status**: **CONFIRMED EXPLOITABLE**

#### Description:
In `backend/server.js`, the JWT secret is defined as:
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'spit_loop_super_secret_jwt_key_2026';
```
When `JWT_SECRET` is omitted from the production environment on Render, the server defaults to this predictable string. 

#### Safe Proof-of-Concept & Reproduction:
1. Construct an arbitrary token with `role: "Administrator"` signed with `spit_loop_super_secret_jwt_key_2026`.
2. Issue a request to `GET https://loop-qnh9.onrender.com/api/users` with `Authorization: Bearer <token>`.
3. The deployed server immediately returns HTTP 200 OK with the complete list of registered users and internal profiles.

#### Potential Impact:
Unauthenticated remote attackers can forge tokens with administrative privileges, access moderation queues, approve or reject placement stories, and alter user roles.

#### Recommended Remediation:
- Remove the fallback string entirely. The application should terminate at startup if `process.env.JWT_SECRET` is missing:
```javascript
if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is missing.");
  process.exit(1);
}
```
- Generate a cryptographically secure 256-bit secret and configure it in Render's Environment Variables dashboard.

---

### 🟠 LOOP-SEC-002: Permissive Wildcard CORS Configuration on `*.vercel.app`
* **Severity**: **High (CVSS 8.1 / CWE-942 - Permissive Cross-Origin Resource Sharing Policy)**
* **Affected Component**: `backend/server.js` (Lines 50–68)
* **Affected Endpoint**: All API endpoints (`/api/*`)
* **Status**: **CONFIRMED EXPLOITABLE**

#### Description:
The CORS middleware allows any origin ending with `.vercel.app`:
```javascript
if (
  process.env.ALLOWED_ORIGIN === '*' ||
  ALLOWED_ORIGINS.includes(origin) ||
  origin.endsWith('.ngrok-free.app') ||
  origin.endsWith('.ngrok.io') ||
  origin.endsWith('.vercel.app')
) {
  return callback(null, true);
}
```
Because `credentials: true` is enabled, any attacker deploying a site on Vercel (e.g., `https://attacker-project.vercel.app`) can make cross-origin requests to the Render API.

#### Safe Proof-of-Concept & Reproduction:
1. Send an HTTP request with `Origin: https://attacker.vercel.app` to `https://loop-qnh9.onrender.com/api/health`.
2. The server responds with:
```http
Access-Control-Allow-Origin: https://attacker.vercel.app
Access-Control-Allow-Credentials: true
```

#### Potential Impact:
Enables Cross-Site Script Inclusion / Cross-Origin Data Scraping if an authenticated student or admin visits an attacker-controlled Vercel website while logged in.

#### Recommended Remediation:
- Restrict allowed origins strictly to the exact production domain:
```javascript
const ALLOWED_ORIGINS = [
  'https://loop-seven-delta.vercel.app',
  'http://localhost:5173'
];
```

---

### 🟠 LOOP-SEC-004: Known Vulnerabilities in Production Dependencies
* **Severity**: **High (CVSS 7.5 / CWE-1395 - Dependency on Vulnerable Third-Party Package)**
* **Affected Components**: `backend/package.json` (`proxy-addr`, `qs`, `braces`, `body-parser`)
* **Status**: **CONFIRMED**

#### Description:
Running `npm audit` on the backend revealed:
- **`proxy-addr` (CVE/GHSA-jqcg-44mw-7w3h)**: Critical IP spoofing vulnerability when parsing IPv4-mapped IPv6 subnets with `app.set('trust proxy', 1)`.
- **`qs` (GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g)**: Array-limit bypass and Denial of Service.
- **`braces` (GHSA-vfj7-8cjw-p6xm)**: Stack-exhaustion denial of service.

#### Potential Impact:
Attackers can spoof client IP addresses to bypass rate limiting (`loginLimiter` and `globalLimiter`), or trigger high CPU consumption through crafted query strings.

#### Recommended Remediation:
- Execute `npm update` and `npm audit fix` in the backend directory.
- Pin updated patched dependencies (`express >= 4.21.2`, `proxy-addr >= 2.0.8`).

---

### 🟡 LOOP-SEC-003: Missing Defensive Security Headers on Vercel Frontend
* **Severity**: **Medium (CVSS 5.4 / CWE-1021 - Improper Restriction of Rendered UI Layers)**
* **Affected Component**: `frontend/vercel.json`
* **Affected Endpoint**: `https://loop-seven-delta.vercel.app/`
* **Status**: **CONFIRMED**

#### Description:
Inspection of `https://loop-seven-delta.vercel.app/` revealed that key defensive headers are missing:
- `Content-Security-Policy` (CSP)
- `Strict-Transport-Security` (HSTS)
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`

#### Potential Impact:
Without `X-Frame-Options` or `frame-ancestors`, the login page can be embedded inside a malicious iframe, facilitating clickjacking attacks.

#### Recommended Remediation:
Add security headers to `frontend/vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
      ]
    }
  ]
}
```

---

### 🟡 LOOP-SEC-005: Unindexed Dynamic Regex Queries on Resource Search
* **Severity**: **Medium (CVSS 5.3 / CWE-1333 - Regular Expression Denial of Service)**
* **Affected Component**: `backend/server.js` (Lines 1626–1634)
* **Affected Endpoint**: `GET /api/resources?search=<query>`
* **Status**: **CONFIRMED STATIC**

#### Description:
In the `/api/resources` route, the search parameter is injected into unindexed `$regex` filters:
```javascript
if (search) {
  const sanitized = sanitizeString(search);
  filter.$or = [
    { title: { $regex: sanitized, $options: 'i' } },
    { description: { $regex: sanitized, $options: 'i' } }
  ];
}
```
Without escaping special regular expression characters, a user providing patterns with nested quantifiers can degrade MongoDB query performance.

#### Recommended Remediation:
- Use an `escapeRegExp` utility before constructing regular expressions, or implement MongoDB `$text` indices with text search.

---

### 🔵 LOOP-SEC-006: Internal User Data Exposure in Administrative Listing
* **Severity**: **Low (CVSS 3.7 / CWE-200 - Exposure of Sensitive Information)**
* **Affected Component**: `backend/server.js` (Line 595)
* **Affected Endpoint**: `GET /api/users`
* **Status**: **CONFIRMED**

#### Description:
While passwords are correctly excluded using `.select('-password')`, other internal fields such as `pendingRole`, `pendingBranch`, and `hasPendingEdit` are returned in raw JSON responses.

#### Recommended Remediation:
- Whitelist only public profile fields using a dedicated serialization projection.

---

### 🔵 LOOP-SEC-007: Rate Limiting Granularity & Scraping Exposure
* **Severity**: **Low (CVSS 3.1 / CWE-770 - Allocation of Resources Without Limits or Throttling)**
* **Affected Component**: `backend/server.js` (Line 102)
* **Status**: **CONFIRMED**

#### Description:
The global rate limiter allows 100 requests per 15 minutes across all `/api/` endpoints. While effective against brute-force attacks on login, it does not throttle resource scrapers targeting the GridFS download endpoints.

#### Recommended Remediation:
- Implement separate rate limiters for binary file streaming routes (`/api/resources/:id/file`).

---

## 5. Prioritized Remediation Checklist

1. [ ] **Critical**: Add `JWT_SECRET` validation at server startup and update production secrets on Render.
2. [ ] **High**: Remove wildcard `*.vercel.app` pattern from `ALLOWED_ORIGINS` in `backend/server.js`.
3. [ ] **High**: Run `npm audit fix` in `backend/` to update `proxy-addr` and `express`.
4. [ ] **Medium**: Configure defensive HTTP security headers in `frontend/vercel.json`.
5. [ ] **Medium**: Apply `escapeRegExp` on search query parameters in `backend/server.js`.
6. [ ] **Low**: Create a strict field-whitelist serializer for `/api/users`.

---

*Report generated following read-only verification guidelines. No source code, databases, or deployment configurations were modified during this audit.*
