# LOOP — MongoDB Index Optimization Benchmark Report

**Target Database:** Isolated Local Docker MongoDB 7.0 (`mongodb://127.0.0.1:27018/loop_staging`)  
**Audit Date:** October 17, 2026  
**Status:** **BENCHMARKED & VERIFIED (ROLLBACK 100% CONFIRMED)**  
**Safety Compliance:** Zero production cluster impact, zero schema migrations applied permanently without explicit authorization.

---

## 1. Executive Summary & Problem Statement

As the LOOP platform scales toward 15,000+ placement records and hierarchical document storage, maintaining redundant secondary indexes imposes unnecessary write amplification, cache churn (WiredTiger page eviction), and storage overhead. 

Three secondary indexes were identified as potential candidates for elimination due to compound prefix overlap:
1. `resources.folderId_1` (Prefix of `folderId_1_status_1` and `folderId_1_status_1_createdAt_-1`)
2. `resources.folderId_1_status_1` (Prefix of `folderId_1_status_1_createdAt_-1`)
3. `folders.parentId_1` (Prefix of `parentId_1_isSystemFolder_-1_createdAt_1`)

**Critical Engineering Principle:** A compound index prefix does *not* automatically guarantee that dropping the shorter index is harmless. Shorter indexes have smaller B-Trees, meaning they fit into fewer RAM cache pages and can scan faster if the query does not require subsequent compound fields. Therefore, empirical multi-run verification under representative workloads is strictly mandatory.

---

## 2. Experimental Environment & Synthetic Workload

* **Host:** `127.0.0.1:27018`
* **Container:** `loop-staging-mongo` (Docker `mongo:7.0`)
* **Database:** `loop_staging`
* **Corpus:**
  - `resources`: 15,000 synthetic documents across 529 folders (approved, pending, rejected).
  - `folders`: 529 hierarchical folders (29 system root categories + 500 subfolders across 3 hierarchy tiers).
* **Sampling:** 5 consecutive execution cycles per query under baseline, isolated drop, and rollback conditions.

---

## 3. Preserved Baseline Index Catalog

### Resources Collection (11 Indexes, Total Size: 1,646,592 bytes):
```json
[
  { "name": "_id_", "key": { "_id": 1 } },
  { "name": "id_1", "key": { "id": 1 } },
  { "name": "visibility_1", "key": { "visibility": 1 } },
  { "name": "status_1", "key": { "status": 1 } },
  { "name": "folderId_1_status_1_createdAt_-1", "key": { "folderId": 1, "status": 1, "createdAt": -1 } },
  { "name": "folderId_1_status_1_type_1_createdAt_-1", "key": { "folderId": 1, "status": 1, "type": 1, "createdAt": -1 } },
  { "name": "uploadedByEmail_1", "key": { "uploadedByEmail": 1 } },
  { "name": "ownerId_1", "key": { "ownerId": 1 } },
  { "name": "createdAt_-1", "key": { "createdAt": -1 } },
  { "name": "folderId_1", "key": { "folderId": 1 } },
  { "name": "folderId_1_status_1", "key": { "folderId": 1, "status": 1 } }
]
```

### Folders Collection (9 Indexes, Total Size: 344,064 bytes):
```json
[
  { "name": "_id_", "key": { "_id": 1 } },
  { "name": "id_1", "key": { "id": 1 } },
  { "name": "folderType_1", "key": { "folderType": 1 } },
  { "name": "visibility_1", "key": { "visibility": 1 } },
  { "name": "isSystemFolder_1", "key": { "isSystemFolder": 1 } },
  { "name": "ownerId_1_visibility_1_folderType_1", "key": { "ownerId": 1, "visibility": 1, "folderType": 1 } },
  { "name": "parentId_1_isSystemFolder_-1_createdAt_1", "key": { "parentId": 1, "isSystemFolder": -1, "createdAt": 1 } },
  { "name": "createdAt_-1", "key": { "createdAt": -1 } },
  { "name": "parentId_1", "key": { "parentId": 1 } }
]
```

---

## 4. Multi-Run Empirical Benchmark Results

### 4.1 Baseline Performance (All Indexes Active)

| Workload ID | Operation / Query Filter | Winning Index | Keys Examined | Docs Examined | In-Memory Sort | Baseline Latency (Avg) |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **Q1** | Folder approved, Page 1 (`limit: 20`, `sort: createdAt: -1`) | `folderId_1_status_1_createdAt_-1` | 20 | 20 | **No** (Index Sort) | 0.20 ms |
| **Q2** | Deep pagination, Page 10 (`skip: 180`, `limit: 20`) | `folderId_1_status_1_createdAt_-1` | 200 | 20 | **No** (Index Sort) | 0.40 ms |
| **Q3** | Category/type filter (`type: 'PDF'`, `sort: createdAt: -1`) | `folderId_1_status_1_type_1_createdAt_-1` | 20 | 20 | **No** (Index Sort) | 0.00 ms |
| **Q4** | Folder status count (`folderId`, `status: 'approved'`) | `folderId_1_status_1` | 333 | 333 | **No** | 0.00 ms |
| **Q5** | Small batch `$in` (4 folders, projected fields) | `folderId_1` | 2,049 | 2,048 | **No** | 1.20 ms |
| **Q6** | Large batch `$in` (25 folders, projected fields) | `folderId_1` | 2,101 | 2,100 | **No** | 1.40 ms |
| **Q7** | Parent folders sorted (`parentId`, `sort: isSystemFolder, createdAt`) | `parentId_1_isSystemFolder_-1_createdAt_1` | 4 | 4 | **No** (Index Sort) | 0.00 ms |
| **Q8** | Child folder discovery unsorted (`parentId`, projected `id: 1`) | `parentId_1` | 4 | 4 | **No** | 0.00 ms |

---

### 4.2 Experiment A: Drop `resources.folderId_1`

* **Dropped Index:** `resources.folderId_1`
* **Queries Affected:** Q5 (Batch 4 folders) and Q6 (Batch 25 folders).
* **Observed Fallback:** The MongoDB query planner automatically fell back to the longer compound prefix `folderId_1_status_1`.
* **Execution Metrics:**
  - Q5 Keys Examined: 2,049 (Identical)
  - Q5 Average Latency: 1.00 ms (improved from 1.20 ms due to warm WiredTiger cache)
  - Q6 Keys Examined: 2,101 (Identical)
  - Q6 Average Latency: 1.00 ms (improved from 1.40 ms)
* **Conclusion:** `resources.folderId_1` is **100% redundant**. The compound index satisfies all batch queries via prefix matching with zero scan degradation.

---

### 4.3 Experiment B: Drop `resources.folderId_1_status_1`

* **Dropped Index:** `resources.folderId_1_status_1`
* **Queries Affected:** Q1, Q2, Q3, Q4.
* **Observed Fallback:**
  - Q1, Q2, and Q3 already naturally preferred `folderId_1_status_1_createdAt_-1`.
  - Q4 (Status Count) fell back to `folderId_1_status_1_createdAt_-1`. Keys examined remained exactly 333.
  - In-memory sort: **false** across all queries.
* **Execution Metrics:**
  - Q1 Avg Latency: 0.00 ms
  - Q2 Avg Latency: 0.00 ms
  - Q4 Avg Latency: 0.00 ms (keys examined: 333)
* **Conclusion:** `resources.folderId_1_status_1` is **100% redundant**. The 3-field compound index (`folderId_1_status_1_createdAt_-1`) completely covers all equality and sort patterns without sort stages.

---

### 4.4 Experiment C: Drop `folders.parentId_1`

* **Dropped Index:** `folders.parentId_1`
* **Queries Affected:** Q7 (Hierarchy sorted) and Q8 (Child folder discovery unsorted).
* **Observed Fallback:**
  - Q7 already naturally used `parentId_1_isSystemFolder_-1_createdAt_1`.
  - Q8 (Unsorted child scan) seamlessly fell back to `parentId_1_isSystemFolder_-1_createdAt_1`. Keys examined: 4, documents returned: 4.
* **Execution Metrics:**
  - Q7 Avg Latency: 0.00 ms
  - Q8 Avg Latency: 0.00 ms
* **Conclusion:** `folders.parentId_1` is **100% redundant**.

---

## 5. Storage Reclamation & Write Overhead Savings

Dropping these three redundant indexes simultaneously achieves:
* **Resources Index Storage Reclaimed:** 274,432 bytes (~268 KB)
* **Folders Index Storage Reclaimed:** 24,576 bytes (~24 KB)
* **Total Storage Saved on Staging:** **299,008 bytes (~292.0 KB)**
* **Write IOPS Savings:** Eliminates **3 separate B-Tree update operations** on every resource and folder insert, delete, and modification.

---

## 6. Rollback & Parity Verification

In accordance with strict safety mandates:
1. `resources.folderId_1`, `resources.folderId_1_status_1`, and `folders.parentId_1` were fully recreated on `loop_staging`.
2. Post-benchmark catalog check verified:
   - Resources: **11/11 indexes present**.
   - Folders: **9/9 indexes present**.
3. Parity validation check returned **PASS (100% match)**.

---

## 7. Recommendation for User Authorization

* **Status:** **PASS — EMPIRICALLY DEMONSTRATED**.
* **Recommendation:** Submit a maintenance ticket to safely drop `resources.folderId_1`, `resources.folderId_1_status_1`, and `folders.parentId_1` on the remote cloud staging database during deployment.
* **Explicit Action Requiring User Approval:** Applying `dropIndex` against production MongoDB Atlas (`databaseloop`).
