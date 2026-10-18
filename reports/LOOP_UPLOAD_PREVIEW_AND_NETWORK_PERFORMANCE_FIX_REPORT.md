# LOOP — Production Readiness, Bug Verification & Performance Hardening Report

**Project:** LOOP (Life of Other Placements)  
**Date & Time:** October 18, 2026 — 01:30 IST  
**Environment:** macOS (Darwin 24.6.0), Node.js v20+, Vite 8.0.16, MongoDB Atlas / Local GridFS, Chromium (Playwright)  
**Branch:** `main` (Repository: `/Users/swapnil/Base Zero /Placement/PROJECT FILE`)  
**Status:** Verification Complete — **No Commits, Pushes, or Deployments Executed**

---

## 1. Executive Summary: Confirmed vs. Unconfirmed Issues

| Issue / Hypothesis | Initial State | Reproduction & Verification Status | Root Cause & Resolution |
| :--- | :--- | :--- | :--- |
| **Resource Upload Crash (`isModerated is not defined`)** | Upload reached 100% then crashed with `ReferenceError: isModerated is not defined`. | **Confirmed & Reproduced** | Line 3216 in `backend/server.js` referenced an undeclared identifier `isModerated`. Fixed to `const isModerated = Boolean(session.isPending);`, maintaining strict student-vs-admin moderation. |
| **PDF Preview Failure (`Preview Unavailable — File link is not available`)** | Direct preview of existing PDF resources failed with file link unavailable. | **Confirmed & Reproduced** | `frontend/src/utils/db.js` only checked `fileUrl` and `url`. Files with `gridFsFileId`, `storageKey`, or relative IDs failed to resolve. Created universal resolver and upgraded `backend/server.js` resource stream routes to resolve via `$or` queries. Verified with real resource `DBMS PROJECT Guidlines.pdf`. |
| **Story Submission Interrupted on SPA Navigation** | Form modal blocked user with *"Keep this tab active"* warning; navigation broke submission. | **Confirmed & Reproduced** | Submission was tied directly to local component lifecycle. Refactored into `UploadContext.jsx` and `UploadDock.jsx` persistent non-blocking background queue with progress bar, minimizable pill, and duplicate prevention. |
| **Excessive Network Usage & Duplicate Requests** | Uncached assets, duplicate API calls on page switch, eager file downloads. | **Confirmed & Remediated** | Implemented `maxAge: '7d', immutable: true` on static uploads; eliminated eager binary prefetching on list views (measured 0 binary downloads on `/resources`); eliminated duplicate `/api/stories` calls. |
| **Session Dropouts & 401 Redirect Storms** | Concurrent API calls returning 401 cleared storage multiple times and caused rapid page reload loops. | **Confirmed & Remediated** | Implemented debounced 3-second session notification guard (`notifyAuthExpired`) in `frontend/src/utils/db.js`. Ensured HTTP 403 Forbidden never clears credentials. |
| **PDF.js Bundle Bloat on Login/Home** | Heavy PDF rendering libraries bundled into initial entrypoint. | **Confirmed & Verified Split** | Dynamic `import()` code-splitting keeps PDF.js strictly isolated to `/preview` routes (0 PDF.js scripts requested on `/login` or `/home`). |

---

## 2. Root-Cause Analysis: Resource Upload `isModerated` Exception

### Root Cause
In `backend/server.js` (at chunked upload finalization `/api/resources/chunked/complete`):
```javascript
// BEFORE (Buggy code)
const resource = new Resource({
  title: session.title,
  // ...
  isModerated: isModerated, // ReferenceError: isModerated is not defined!
});
```
When a file reached 100% upload, the completion handler attempted to access `isModerated` as a global variable, which was never declared in that lexical scope. This threw a 500 internal server error right at 100% progress.

### Resolution
The variable was corrected to derive directly from the validated session state:
```javascript
// AFTER (Fixed code)
const isModerated = Boolean(session.isPending);
```
- For student uploads: `session.isPending = true` -> routes to `PendingResource` awaiting administrative review.
- For administrator uploads: `session.isPending = false` -> routes directly to published `Resource`.
- Moderation enforcement remains strictly controlled by the backend.

---

## 3. Root-Cause Analysis: PDF Preview Failure

### Root Cause
1. **Frontend Identifier Mismatch:** In `frontend/src/utils/db.js`, `getResourceFileUrl(resource)` only inspected `resource.fileUrl` or `resource.url`. If a document was stored using GridFS (`gridFsFileId`), local storage (`storageKey`), or had only an `_id` / `id`, `getResourceFileUrl` returned `null` or `'#'`, triggering the `Preview Unavailable` UI state.
2. **Backend Route Parameter Strictness:** `backend/server.js` route `GET /api/resources/:id/file` only attempted `Resource.findById(id)` with a strict MongoDB ObjectId cast. When passed a numeric legacy timestamp ID (such as `1792231573193`) or GridFS key, the query failed.

### Resolution
1. **Universal URL Resolver (`frontend/src/utils/db.js`):**
   ```javascript
   export const getResourceFileUrl = (resource) => {
     if (!resource) return null;
     if (typeof resource === 'string') return resource;
     const directUrl = resource.fileUrl || resource.url || resource.previewUrl || resource.link || resource.resumeFile || resource.resume;
     if (directUrl && typeof directUrl === 'string' && directUrl !== '#') return directUrl;
     const fileId = resource.gridFsFileId || resource.storageKey || resource.id || resource._id;
     if (fileId) return `/api/resources/${encodeURIComponent(fileId)}/file`;
     return null;
   };
   ```
2. **Flexible Backend Resolution (`backend/server.js`):**
   Queries use `$or: [{ id: identifier }, { _id: identifier }, { gridFsFileId: identifier }, { storageKey: identifier }]` and fall back gracefully across `Resource`, `PendingResource`, and GridFS buckets.

---

## 4. Preview-Surface Inventory & Verification Results (13 Locations)

All 13 file preview surfaces were verified:

| # | Preview Surface Location | Source Model / Reference | Resolution Pathway | Verified Status |
| :---: | :--- | :--- | :--- | :---: |
| 1 | **Resources Grid View Preview Button** | `Resource.gridFsFileId` / `fileUrl` | `getResourceFileUrl(res)` -> `/preview/:id` | **PASS** |
| 2 | **Resources Table/List View Preview Icon** | `Resource.id` / `storageKey` | `getResourceFileUrl(res)` -> `/preview/:id` | **PASS** |
| 3 | **Resource Folder Detail Modal Preview** | `Folder.resources[]` | Item resolver -> `/preview/:id` | **PASS** |
| 4 | **Global Search Resource Results Preview** | `Resource` search hit | Direct preview navigation | **PASS** |
| 5 | **Stories Card Resume Preview** | `Story.resumeUrl` / `resume` | `getResourceFileUrl(story.resumeUrl)` | **PASS** |
| 6 | **Story Detail Modal Resume Preview** | `Story.resume` | Dynamic resolver -> `/preview/:id` | **PASS** |
| 7 | **Story Study Material Attachment** | `Story.resources[]` | Dynamic resolver -> `/preview/:id` | **PASS** |
| 8 | **Admin Pending Resource Review Modal** | `PendingResource._id` | `getResourceFileUrl(pending)` | **PASS** |
| 9 | **Admin Approved Resources Table** | `Resource._id` | `getResourceFileUrl(resource)` | **PASS** |
| 10 | **Admin Pending Stories Resume Modal** | `PendingStory.resume` | Dynamic resolver -> `/preview/:id` | **PASS** |
| 11 | **Admin Pending Stories Study Materials**| `PendingStory.resources[]` | Dynamic resolver -> `/preview/:id` | **PASS** |
| 12 | **Direct Route URL Navigation** | `/preview/:id` | `FilePreviewPage.jsx` route handler | **PASS** |
| 13 | **Native Browser PDF Viewer Fallback** | `?view=native` toggle | Direct streaming `<iframe>` | **PASS** |

### Live Real-Browser Verification:
- Verified with actual stored document `DBMS PROJECT Guidlines.pdf` (`id: 1792231573193`).
- Playwright Chromium test verified:
  - First page renders on HTML5 Canvas: **826 x 1069 px**
  - Page navigation controls: flipped from Page 1 to Page 2
  - Zoom controls: scaled from 100% to 115%
  - Native iframe toggle: toggled and displayed native PDF stream cleanly

---

## 5. Story Background-Upload Architecture & SPA Navigation

### Architecture
- **State Store (`frontend/src/context/UploadContext.jsx`):**
  - Managed by a React Context provider wrapping the entire app.
  - Retains background upload tasks independently of mounted page views.
  - Exposes `startStoryUpload(submissionData)`, `activeUploads`, `cancelUpload`, and `retryUpload`.
- **Duplicate Protection:**
  - Hashes `name.toLowerCase() + '__' + company.toLowerCase()`.
  - Rejects new concurrent submissions if an active upload for the same author and target company is currently in flight.
- **UI Dock (`frontend/src/components/UploadDock.jsx`):**
  - Fixed floating dock in bottom-right corner.
  - Displays progress percentage, dynamic upload speed (KB/s), filename, and status.
  - Supports minimization to a compact badge pill and manual retry on failure.
- **Form Decoupling (`frontend/src/pages/Stories.jsx`):**
  - Modal form dispatches to `startStoryUpload` and can immediately be dismissed.
  - Removed misleading warning: *"Keep this tab active. Switching or minimizing tabs will pause the upload."* Users are now free to navigate to `/resources`, `/home`, or `/admin` while uploads complete in the background.

---

## 6. Authentication & Multi-Device Session Verification

- **Sliding Token Rotation:**
  - Backend inspects token expiration timestamp on each authenticated request.
  - When remaining token validity drops below 30%, a refreshed JWT is automatically issued via the `X-Refreshed-Token` response header.
  - Frontend intercepts the header in `authFetch` and updates `localStorage.loop_token` without interrupting active user workflows.
- **Elimination of 401 Redirect Storms:**
  - Multiple concurrent requests returning 401 are filtered through `notifyAuthExpired()` with a 3000ms debounce window.
  - Prevents multiple overlapping alert prompts and rapid reload loops.
- **Preservation on 403 Forbidden:**
  - HTTP 403 Forbidden (e.g. attempting to access an unauthorized admin endpoint) no longer clears user credentials or logs the user out.

---

## 7. Directly Observed Real-Browser Performance & Network Metrics

Measurements collected via automated Playwright profiling in headless Chromium running against live Vite preview and Express/MongoDB backend:

| Benchmark / Metric | Directly Observed Value | Target / Assessment |
| :--- | :--- | :--- |
| **Initial Unauthenticated Load (`/login`) Requests** | **31 requests** | Lightweight (<40 requests) |
| **Initial Unauthenticated Load Time** | **2,085.6 ms** | Fast cold start |
| **PDF.js Loaded on Initial Login / Home** | **`false`** | **Strictly Code-Split & Isolated** |
| **Authenticated `/home` Navigation Time** | **895.2 ms** | **Sub-second navigation (<1000 ms)** |
| **Authenticated `/home` Request Count** | **21 requests** | Low network overhead |
| **Stories Navigation (`/stories`) Time** | **1,554.5 ms** | Smooth transition |
| **Stories Request Count** | **18 requests** | Efficient route loading |
| **Stories Duplicate API Calls** | **0 duplicate calls** | **Zero duplicate network storms** |
| **Resources Navigation (`/resources`) Time** | **2,063.6 ms** | Responsive repository view |
| **Resources Metadata API Payload** | **2,779 bytes (2.7 KB)** | Highly compact JSON payload |
| **Resource Binaries Eagerly Downloaded on List** | **0 binaries** | **Zero eager PDF bloat** |
| **PDF Preview Time to First Canvas Render** | **2,486.2 ms** | Fast document viewing |
| **Rendered PDF Canvas Dimensions** | **826.0 x 1069.0 px** | Crisp desktop presentation |
| **Uncaught Console Errors** | **1 (benign favicon probe)** | No runtime JS exceptions |

---

## 8. Memory & Low-RAM Optimizations

1. **Canvas Destruction on Unmount:**
   In `frontend/src/components/DocumentPreview.jsx`, unmounting the canvas resets width and height to 1 pixel:
   ```javascript
   if (canvasRef.current) {
     canvasRef.current.width = 1;
     canvasRef.current.height = 1;
   }
   ```
   This releases tens of megabytes of GPU/VRAM texture memory immediately upon closing the preview.
2. **Device Pixel Ratio Clamping:**
   Device pixel ratio is clamped to `Math.min(window.devicePixelRatio || 1, 1.75)` to prevent excessive memory allocation on high-DPI low-RAM mobile/tablet devices.
3. **Accessibility & Reduced Motion:**
   `prefers-reduced-motion: reduce` media query is honored across CSS and JavaScript animation loops (such as `Story3DCard` tilt and background glowing orbs), preventing CPU/GPU thrashing on low-end processors.

---

## 9. Automated Test & Production Build Verification

### Backend Automated Test Suite
- **Command:** `cd backend && npm test`
- **Total Tests:** **181 tests**
- **Test Suites:** **24 suites**
- **Passing:** **181 (100%)**
- **Failing:** **0**
- **Execution Time:** **1,329 ms (1.33 seconds)**

### Frontend Production Build
- **Command:** `cd frontend && npm run build`
- **Result:** **Built cleanly in 374 ms**
- **Asset Chunks Output:**
  - `dist/index.html`: 1.34 kB (gzip: 0.62 kB)
  - `dist/assets/index-bDe--Ibd.js`: 130.95 kB (gzip: 33.40 kB)
  - `dist/assets/vendor-react-CfMwF6LX.js`: 225.84 kB (gzip: 72.44 kB)
  - `dist/assets/pdf-YzVtspiZ.js`: 431.18 kB (isolated dynamic chunk)
  - `dist/assets/pdf.worker.min-BmVo14Nb.mjs`: 1,317.03 kB (isolated web worker)

---

## 10. Summary of Modified Files

1. `backend/server.js`: Corrected `isModerated` undefined variable; expanded resource file streaming to match `$or` identifier variants; added cache-control headers.
2. `frontend/src/utils/db.js`: Upgraded `getResourceFileUrl` universal resolver; added debounced `notifyAuthExpired()` session protection.
3. `frontend/src/pages/FilePreviewPage.jsx`: Integrated universal resolver for direct and fallback preview loading.
4. `frontend/src/pages/StoryDetail.jsx`: Dynamically resolves resume and study material attachment links.
5. `frontend/src/pages/AdminDashboard.jsx`: Dynamically resolves resume and study material previews in pending review modal.
6. `frontend/src/context/UploadContext.jsx`: Implemented persistent SPA background story upload manager with duplicate protection.
7. `frontend/src/components/UploadDock.jsx`: Created floating, non-blocking upload progress and retry dock.
8. `frontend/src/pages/Stories.jsx`: Decoupled story submission from page lifecycle; removed tab-lock warning.
9. `backend/tests/uploadEndpoints.test.js`: Verified upload chunk validation, file size limits, and moderation integrity.
10. `backend/tests/storySubmissionLifecycle.test.js`: Verified story submission validation, moderation assignment, and retry safety.
11. `backend/scripts/measure_performance_metrics.py`: Automated Playwright network and performance measurement suite.

---

## 11. Explicit Disclosures & Remaining Limitations

1. **Windows Hardware Testing:**
   - Automated profiling and end-to-end browser tests were executed in real headless Chromium / Google Chrome on macOS Darwin.
   - Physical Windows laptop hardware testing was **not performed** in this local session.
2. **Production Deployment & Git Actions:**
   - As instructed by non-negotiable rules, **no `git commit`, `git push`, branch merge, or cloud deployment was executed**.
   - All modified and new files remain safely staged/unstaged in the working tree for user review.
3. **Session Persistence across Complete Browser Termination:**
   - Story uploads survive internal client-side SPA navigation between LOOP tabs/pages.
   - Uploads in progress do not survive complete operating system termination or closing of the browser window.
