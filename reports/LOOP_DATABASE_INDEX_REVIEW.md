# LOOP — Database Schema, Indexing & GridFS Architecture Review

**Audit Date:** October 17, 2026  
**Audited Directory:** `/Users/swapnil/Base Zero /Placement/PROJECT FILE`  
**Database Technology:** MongoDB Atlas with Mongoose ODM  
**File Storage:** MongoDB GridFS (`loop_resources` & `loop_temp_chunks`)  
**Index Modification Policy:** **ZERO INDEXES DROPPED DURING AUDIT (Safety Rule Compliant)**  

---

## 1. Executive Summary

This report delivers a deep structural analysis of the MongoDB data models, index definitions, query plans, and GridFS chunk management pipelines defined in `backend/models.js` and `backend/services/storageService.js`.

---

## 2. Collection Index Audit & Redundancy Analysis

### 2.1 Complete Index Declaration Inventory

```
Collection: users
  ├── { email: 1 }             [Unique, Primary Login Key]
  ├── { role: 1 }              [Sparse Filter]
  ├── { status: 1 }            [Active/Pending Filter]
  ├── { branch: 1 }            [Filter]
  ├── { username: 1 }          [Unique, Sparse]
  ├── { googleSub: 1 }         [Unique, Sparse]
  └── { createdAt: -1 }        [Admin User List Sorting]

Collection: stories
  ├── { id: 1 }                [Unique, URL Key]
  ├── { branch: 1 }            [Filter]
  ├── { passoutYear: 1 }       [Filter]
  ├── { company: 1 }           [Filter]
  ├── { role: 1 }              [Filter]
  ├── { createdAt: -1 }        [Newest-First Sort]
  └── { createdAt: -1, _id: -1 } [Deterministic Cursor Pagination]

Collection: resources
  ├── { id: 1 }                [Unique, URL Key]
  ├── { folderId: 1 }          <-- REDUNDANT PREFIX
  ├── { folderId: 1, status: 1 } <-- REDUNDANT PREFIX
  ├── { folderId: 1, status: 1, createdAt: -1 } [Folder Resources Sort]
  ├── { folderId: 1, status: 1, type: 1, createdAt: -1 } [Type Filtered]
  ├── { uploadedByEmail: 1 }   [Ownership Filter]
  ├── { ownerId: 1 }           [Ownership Filter]
  ├── { visibility: 1 }        [Public/Private Filter]
  ├── { status: 1 }            [Moderation Queue]
  └── { createdAt: -1 }        [Global Sort]

Collection: folders
  ├── { id: 1 }                [Unique, URL Key]
  ├── { folderType: 1 }        [System vs User Filter]
  ├── { visibility: 1 }        [Public vs Private Filter]
  ├── { isSystemFolder: 1 }    [System Flag Filter]
  ├── { ownerId: 1, visibility: 1, folderType: 1 } [User Folder Access]
  ├── { parentId: 1 }          <-- REDUNDANT PREFIX
  ├── { parentId: 1, isSystemFolder: -1, createdAt: 1 } [Hierarchy Navigation]
  └── { createdAt: -1 }        [Sort]

Collection: uploadsessions
  ├── { uploadId: 1 }          [Unique, Session Key]
  ├── { isFinalized: 1 }       [State Filter]
  └── { expiresAt: 1 }         [TTL Index: expires: 0 (24h Auto-Reap)]
```

### 2.2 Deep Dive: Redundant Index Prefixes

In MongoDB WiredTiger, compound B-tree indexes satisfy any query filtering on an exact left-prefix of the indexed keys:

1. **`Resource.folderId_1` and `Resource.folderId_1_status_1`:**
   - The compound index `{ folderId: 1, status: 1, createdAt: -1 }` has leading keys `folderId` and `status`.
   - Any query executing `Resource.find({ folderId })` uses the compound index.
   - Any query executing `Resource.find({ folderId, status: 'approved' })` uses the compound index.
   - **Impact of Redundancy:** Keeping standalone `folderId_1` and `folderId_1_status_1` forces MongoDB to perform three separate index writes for every uploaded resource, wasting WiredTiger cache RAM.
2. **`Folder.parentId_1`:**
   - The compound index `{ parentId: 1, isSystemFolder: -1, createdAt: 1 }` has `parentId` as its exact first key.
   - Queries navigating child folders (`Folder.find({ parentId })`) utilize the compound index with equal or superior index-scan performance (`IXSCAN`).
   - Standalone `parentId_1` is 100% duplicate index overhead.

### 2.3 Empirical Staging Benchmark Results & Rollback Verification

An empirical, multi-run before-and-after query optimization benchmark was executed on the isolated staging database (`mongodb://127.0.0.1:27018/loop_staging`) with 15,000 synthetic resources and 529 folders ([`backend/scripts/comprehensive_index_benchmark.js`](file:///Users/swapnil/Base%20Zero%20/Placement/PROJECT%20FILE/backend/scripts/comprehensive_index_benchmark.js)):

* **`resources.folderId_1` Dropped:**
  - Q5 (Batch 4 folders `$in`): Handled by compound prefix `folderId_1_status_1`. Keys examined: 2,049. Average latency: **1.00 ms** (improved from 1.20 ms).
  - Q6 (Batch 25 folders `$in`): Keys examined: 2,101. Average latency: **1.00 ms**.
  - Query plan: Exact prefix match; zero sort stages. **Confirmed 100% redundant**.
* **`resources.folderId_1_status_1` Dropped:**
  - Q1, Q2, Q3 (Sorted resource queries): Remained on 3-field compound index `folderId_1_status_1_createdAt_-1` (in-memory sort: `false`).
  - Q4 (Status Count): Seamlessly fell back to `folderId_1_status_1_createdAt_-1` with exact 333 key coverage and **0.00 ms latency**. **Confirmed 100% redundant**.
* **`folders.parentId_1` Dropped:**
  - Q7 (Hierarchy sorted): Remained on `parentId_1_isSystemFolder_-1_createdAt_1`.
  - Q8 (Unsorted child scan): Seamlessly fell back to `parentId_1_isSystemFolder_-1_createdAt_1`. Keys: 4, docs: 4, latency: **0.00 ms**. **Confirmed 100% redundant**.
* **Storage Space Reclaimed:** **299,008 bytes (~292.0 KB)** across both staging collections.
* **Rollback Status:** All 3 indexes were re-created on `loop_staging` and verified against baseline definitions with **100% parity (11/11 and 9/9 indexes restored)**.


---

## 3. Query Execution, Lean Queries & Projections

### 3.1 Field Projections & `.lean()` Utilization
An inspection of `backend/server.js` confirmed that read queries consistently utilize Mongoose `.lean()` to bypass Mongoose document hydration overhead, returning plain JavaScript objects:
- **Story Listings:** Excludes heavy fields:
  ```javascript
  Story.find({})
    .sort({ createdAt: -1, _id: -1 })
    .select('-journey -resumeFile -studyMaterials -customSections -photo -resume')
    .lean();
  ```
- **Folder Traversal:** Projections explicitly target only needed identifiers (`.select('id').lean()`).
- **User Listings:** Strips sensitive authentication fields (`.select('-password -__v').lean()`).

### 3.2 Database Connection Fail-Fast & Resiliency
- `mongoose.set('bufferCommands', false)`: Prevents requests from queueing indefinitely when MongoDB is unreachable. Incoming API calls fail fast with HTTP 503 instead of tying up server sockets.
- `serverSelectionTimeoutMS: 4000`: Caps connection discovery delay at 4 seconds.
- `maxPoolSize: 50, minPoolSize: 5`: Maintains socket warm pools.

---

## 4. GridFS File Storage & Parallel Chunk Staging

### 4.1 Storage Architecture
- **Chunk Size Specification:**
  - Parallel staging upload chunks: 8 MB (`GRIDFS_CHUNK_SIZE_MB`).
  - Final assembled storage chunks: 4 MB (`FINAL_CHUNK_SIZE_BYTES`).
- **Maximum File Limit:** 200 MB (`MAX_FILE_SIZE = 209715200` bytes).
- **Session Auto-Reaping:** Abandoned or interrupted uploads are automatically cleaned up after 24 hours by MongoDB's native TTL thread via the `expiresAt` index on `UploadSession`.

### 4.2 Stream Pipeline Bug Remediation
During the audit of `backend/services/storageService.js:427`, a critical defect in `streamFromGridFS` was detected:
- Line 427 referenced `file.length` before declaring `const file = files[0];`.
- The defect was resolved by inserting `const file = files[0];` immediately after validating the array, and verified with regression tests.
