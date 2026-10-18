# LOOP — Comprehensive Database Schema, Indexes & Data Integrity Audit

**Target Platform:** LOOP — Placement Stories and Educational Resources Platform  
**Database Engine:** MongoDB Atlas (WiredTiger Storage Engine) via Mongoose ODM  
**Audit Date:** October 2026  
**Scope:** Schema validation, relationships, compound index coverage, query execution patterns, data integrity, orphaned records analysis, and migration safety.  

---

## 1. Discovered Collections & Models Overview

The database inspection connected to the configured MongoDB Atlas cluster and audited **10 collections**:

| Collection Name | Mongoose Model | Document Count | Raw Size (Bytes) | Storage Size | Total Index Size | Primary Purpose | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `users` | `User` | 13 | 5,078 | 36,864 | 294,912 | Student and admin identities, roles, credentials | Verified Live in Atlas |
| `stories` | `Story` | 6 | 18,699 | 53,248 | 278,528 | Verified senior placement interview experiences | Verified Live in Atlas |
| `pendingstories` | `PendingStory` | 0 | 0 | 49,152 | 131,072 | Student story submissions awaiting admin review | Verified Live in Atlas |
| `resources` | `Resource` | 0 | 0 | 32,768 | 327,680 | Educational notes, past papers, syllabus materials | Verified Live in Atlas |
| `pendingresources`| `PendingResource`| 0 | 0 | 24,576 | 155,648 | Student resource uploads awaiting moderation | Verified Live in Atlas |
| `folders` | `Folder` | 29 | 9,395 | 36,864 | 315,392 | Hierarchical organizational taxonomy | Verified Live in Atlas |
| `achievements` | `Achievement` | 4 | 2,817 | 36,864 | 110,592 | Institutional placement highlights and trophies | Verified Live in Atlas |
| `uploadsessions` | `UploadSession` | 0 | 0 | 32,768 | 122,880 | Parallel GridFS chunk upload tracking | Verified Live in Atlas |
| `loop_resources.files` | GridFS Bucket | 0 | 0 | 32,768 | 57,344 | Binary file metadata for GridFS | Verified Live in Atlas |
| `loop_resources.chunks`| GridFS Chunks | 0 | 0 | 4,759,552 | 49,152 | 255KB binary payload chunks for stored files | Verified Live in Atlas |

---

## 2. Detailed Schema & Field Validation Analysis

### 1. `users` Collection (`User` Model)
- **Primary Identifier:** `_id` (ObjectId)
- **Core Fields:**
  - `email`: String (Required, Unique, Lowercase/Trimmed). Enforces `@spit.ac.in` domain restriction.
  - `role`: String (Required, Indexed). Enums: `'Student'`, `'Senior / Contributor'`, `'Alumni / Contributor'`, `'Administrator'`.
  - `status`: String (Default: `'Active'`, Indexed). Enums: `'Active'`, `'Pending'`, `'Suspended'`.
  - `password`: String (Bcrypt salted hash; legacy default `'spit123'`).
  - `username`: String (Unique, Sparse, Indexed). Permits flexible login via handle.
  - `googleSub`: String (Unique, Sparse, Indexed). Google OAuth subject ID.
  - `authProvider`: String (Default: `'local'`, Enums: `'local'`, `'google'`).
  - `onboarded`: Boolean (Default: `false`).
  - `branch`, `currentYear`, `name`, `nameColor`: String attributes.
  - `pendingName`, `pendingRole`, `pendingBranch`, `hasPendingEdit`: Profile edit moderation flow.
- **Audit Assessment:** Well-structured schema. The sparse unique indexes on `username` and `googleSub` allow users to register either locally or through Google without collision on `null` values.

### 2. `stories` Collection (`Story` Model)
- **Primary Identifier:** `id` (String UUID, Unique)
- **Core Fields:**
  - `name`: String (Required)
  - `branch`: String (Indexed)
  - `subBranch`: String (`CSE`, `AI`, `DS`)
  - `passoutYear`: String (Indexed)
  - `company`: String (Indexed)
  - `role`: String (Indexed)
  - `semester`, `cgpa`: String
  - `journey`: Embedded Subdocument (`firstYear`, `secondYear`, `thirdYear`, `fourthYear`, `prep`, `projects`, `howSecured`)
  - `resources`: Array of `{ name, type }`
  - `studyMaterials`: Array of `{ title, type, fileName, fileSize, url }`
  - `customSections`: Array of `{ title, content }`
  - `resumeFile`: Embedded Subdocument `{ fileName, fileSize, url }`
  - `uploadedByEmail`: String
- **Audit Assessment:** Embedding the `journey` subdocument avoids relational joins when viewing individual stories (`/stories/:id`), ensuring maximum single-round-trip read performance. Heavy fields are projected out (`-journey -resumeFile ...`) on high-traffic list queries.

### 3. `folders` Collection (`Folder` Model)
- **Primary Identifier:** `id` (String UUID, Unique)
- **Core Fields:**
  - `name`: String (Required)
  - `description`: String
  - `ownerId`: ObjectId (Ref: `User`, Default: `null`)
  - `folderType`: String (`'system'` or `'user'`, Indexed)
  - `visibility`: String (`'public'` or `'private'`, Indexed)
  - `parentId`: String (UUID, Default: `null`, Indexed)
  - `isSystemFolder`: Boolean (Indexed)
  - `allowContributions`: Boolean (Default: `true`)
- **Audit Assessment:** Adjacency list pattern for hierarchical navigation. `parentId: null` designates root system folders. Compound index `{ parentId: 1, isSystemFolder: -1, createdAt: 1 }` powers folder navigation menus with zero in-memory sorting.

### 4. `resources` Collection (`Resource` Model)
- **Primary Identifier:** `id` (String UUID, Unique)
- **Core Fields:**
  - `title`: String (Required)
  - `folderId`: String (Required, Indexed)
  - `storageProvider`: String (`'gridfs'`, `'local'`, `'legacy'`, `'r2'`, `'s3'`)
  - `storageKey`: String
  - `gridFsFileId`: ObjectId (Ref to `loop_resources.files`)
  - `visibility`: String (`'public'`, `'private'`, Indexed)
  - `status`: String (`'approved'`, `'pending'`, `'rejected'`, Indexed)
  - `mimeType`, `size`, `type`, `category`: Metadata attributes.
- **Audit Assessment:** Decoupled storage pointers (`gridFsFileId`, `storageProvider`) allow seamless future migration to object storage (Cloudflare R2 or AWS S3) without modifying collection schemas or API contracts.

---

## 3. Index Inventory & Query Optimization Analysis

### Current Index Verification (Verified Live from MongoDB Atlas)

```
Collection: users (8 indexes, 294.9 KB)
  ├── _id_: {_id: 1}
  ├── email_1: {email: 1} [UNIQUE]
  ├── role_1: {role: 1}
  ├── status_1: {status: 1}
  ├── branch_1: {branch: 1}
  ├── createdAt_-1: {createdAt: -1}
  ├── username_1: {username: 1} [UNIQUE, SPARSE]
  └── googleSub_1: {googleSub: 1} [UNIQUE, SPARSE]

Collection: stories (8 indexes, 278.5 KB)
  ├── _id_: {_id: 1}
  ├── id_1: {id: 1} [UNIQUE]
  ├── branch_1: {branch: 1}
  ├── passoutYear_1: {passoutYear: 1}
  ├── company_1: {company: 1}
  ├── role_1: {role: 1}
  ├── createdAt_-1: {createdAt: -1}
  └── createdAt_-1__id_-1: {createdAt: -1, _id: -1}

Collection: folders (9 indexes, 315.4 KB)
  ├── _id_: {_id: 1}
  ├── id_1: {id: 1} [UNIQUE]
  ├── createdAt_-1: {createdAt: -1}
  ├── folderType_1: {folderType: 1}
  ├── visibility_1: {visibility: 1}
  ├── parentId_1: {parentId: 1}
  ├── isSystemFolder_1: {isSystemFolder: 1}
  ├── ownerId_1_visibility_1_folderType_1: {ownerId: 1, visibility: 1, folderType: 1}
  └── parentId_1_isSystemFolder_-1_createdAt_1: {parentId: 1, isSystemFolder: -1, createdAt: 1}

Collection: resources (11 indexes, 327.7 KB)
  ├── _id_: {_id: 1}
  ├── id_1: {id: 1} [UNIQUE]
  ├── folderId_1: {folderId: 1} [POTENTIAL REDUNDANT PREFIX]
  ├── createdAt_-1: {createdAt: -1}
  ├── uploadedByEmail_1: {uploadedByEmail: 1}
  ├── visibility_1: {visibility: 1}
  ├── status_1: {status: 1}
  ├── folderId_1_status_1: {folderId: 1, status: 1} [POTENTIAL REDUNDANT PREFIX]
  ├── ownerId_1: {ownerId: 1}
  ├── folderId_1_status_1_createdAt_-1: {folderId: 1, status: 1, createdAt: -1}
  └── folderId_1_status_1_type_1_createdAt_-1: {folderId: 1, status: 1, type: 1, createdAt: -1}
```

### Verified Issues vs. Potential Optimization Issues:
1. **Verified Optimization: Folders Endpoint Routing:**
   - Querying `/api/folders` without `category=system` previously bypassed caching and triggered collection scans with in-memory sorting. Fixed in `backend/server.js` via role-scoped caching (`public` vs `admin`).
2. **Potential Future Optimization: Redundant Prefix Indexes on Resources:**
   - Standalone `folderId_1` and `folderId_1_status_1` are leftmost prefixes of compound index `{ folderId: 1, status: 1, createdAt: -1 }`. They can be dropped in a planned future maintenance window without breaking any existing queries, saving ~60 KB of index RAM.
3. **Verified Stable Pagination:**
   - Compound index `{ createdAt: -1, _id: -1 }` on `stories` ensures deterministic sorting across skip/limit pagination.

---

## 4. Live Data Integrity Audit Results

A live verification script evaluated referential consistency across all existing documents in the MongoDB Atlas database:

| Integrity Check | Scope | Violations Detected | Status |
| :--- | :--- | :--- | :--- |
| **Folder Hierarchy Integrity** | Orphaned `parentId` values pointing to non-existent folders | **0** | **PASS** |
| **Resource Folder Ownership** | Resources pointing to non-existent `folderId` | **0** | **PASS** |
| **Pending Resource Targets** | Pending uploads referencing invalid folders | **0** | **PASS** |
| **Pending Story References** | Edit/Delete requests referencing non-existent `activeId` | **0** | **PASS** |
| **User Email Uniqueness** | Duplicate emails or case-mismatched accounts | **0** | **PASS** |
| **User Role & Status Completeness**| Missing mandatory authorization attributes | **0** | **PASS** |
| **GridFS File & Chunk Parity** | Orphaned chunks or unlinked file descriptors | **0** | **PASS** |

> [!NOTE]
> The database exhibits zero referential violations in the audited dataset (13 users, 6 stories, 29 folders, 4 achievements). Claims of zero corruption apply strictly to the evaluated records and schemas.

---

## 5. Query Optimization & Lean Hydration

Every high-traffic read route in `backend/server.js` was verified to bypass Mongoose document hydration:

```javascript
const stories = await Story.find({})
  .sort({ createdAt: -1, _id: -1 })
  .skip(skip)
  .limit(limit)
  .select('-journey -resumeFile -studyMaterials -customSections -photo -resume')
  .lean();
```

### Benefits Verified:
1. **Memory Allocation:** `.lean()` skips Mongoose model constructor instantiation, reducing process heap allocation.
2. **Field Projection:** Stripping heavy textual journey bodies from list views prevents multi-megabyte JSON transfers on initial navigation.
3. **Deterministic Sorting:** Sorting by `{ createdAt: -1, _id: -1 }` guarantees repeatable ordering.

---

## 6. Safe Migration Protocols & Guidelines

Any future schema modification must adhere to non-destructive database evolution principles:
1. **Dry-Run Validation:** Always execute count and validation checks in a staging replica before running production data alterations.
2. **No In-Place Deletions:** Use soft-deletion (`isArchived: true` or `status: 'deleted'`) for institutional records.
3. **Backward Compatibility:** Newly added schema fields must define sensible defaults (`default: ''` or `default: false`) so that existing legacy documents deserialize safely without manual backfilling.
