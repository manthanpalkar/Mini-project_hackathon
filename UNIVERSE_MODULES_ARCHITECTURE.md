# UniVerse Platform: Multi-Module Architecture Specification

## Overview

**UniVerse** is an institutional campus super-app built on the proven, resilient engineering foundation of **LOOP SPIT**. It preserves 100% of the production-tested placement intelligence and academic vault systems while providing dedicated, modular subsystems for campus life, green computing, student wellbeing, and academic integrity.

---

## Subsystem Modules

```
                    ┌──────────────────────────────────────────────┐
                    │               UniVerse Platform              │
                    │         "Their Journey. Your Campus."        │
                    └───────────────────────┬──────────────────────┘
                                            │
        ┌───────────────┬───────────────────┼───────────────────┬───────────────┐
        ▼               ▼                   ▼                   ▼               ▼
   [Module A]      [Module B]          [Module C]          [Module D]      [Module E]
 Placement Vault   Campus Rides       Green Compute      Wellbeing Nudge  Exam Integrity
```

### Module A: Placement Intelligence & Academic Vault (LOOP Core)
- **Status:** Active & Preserved
- **Features:** 4-year senior roadmaps, round-by-round interview debriefs, compensation packages, 200MB GridFS adaptive chunked binary file storage, and role-based access control.
- **Data Collections:** `stories`, `pendingstories`, `resources`, `pendingresources`, `folders`, `achievements`, `users`.

### Module B: Smart Campus Ride-Pooling
- **Status:** Architectural Scaffold Complete
- **Mount Point:** `/api/modules/b`
- **Features:** Peer-to-peer carpool and auto-rickshaw sharing between SPIT students, faculty, and commuters from local transit hubs (Andheri Station, Azad Nagar Metro).
- **Core Models:**
  - `RideOffer`: Driver profile, departure schedule, seat capacity, pricing/free carpool tag, route waypoints.
  - `RideRequest`: Passenger origin/destination, seat demand, match linkage.
- **Primary Routes:**
  - `GET /api/modules/b/rides`: Active scheduled ride offers.
  - `POST /api/modules/b/rides`: Publish a ride offer.
  - `GET /api/modules/b/health`: Status probe.

### Module C: Sustainable Computing Observatory
- **Status:** Architectural Scaffold Complete
- **Mount Point:** `/api/modules/c`
- **Features:** Telemetry collection for SPIT computer lab workstations, server nodes, and cluster power draws. Provides carbon emission estimates and carbon-aware batch job scheduling.
- **Core Models:**
  - `ComputeTelemetry`: Node utilization (CPU/GPU), active wattage, estimated carbon grams/hr.
  - `GreenComputeJob`: Off-peak scheduling queue for high-compute student projects.
- **Primary Routes:**
  - `GET /api/modules/c/telemetry`: Node power & utilization telemetry.
  - `POST /api/modules/c/telemetry`: Ingest telemetry readings.
  - `GET /api/modules/c/health`: Status probe.

### Module D: Privacy-Aware Digital Wellbeing
- **Status:** Architectural Scaffold Complete
- **Mount Point:** `/api/modules/d`
- **Features:** Privacy-first study and focus session tracker. Protects student identity via irreversible salted SHA-256 hashes and provides automated rest break nudges to prevent burnout.
- **Core Models:**
  - `FocusSession`: Anonymous hash, branch track, duration, focus rating, study category.
  - `NudgeRule`: Configurable study thresholds and mindful break recommendations.
- **Primary Routes:**
  - `POST /api/modules/d/sessions`: Log an anonymous focus session.
  - `GET /api/modules/d/health`: Status probe.

### Module E: Responsible Examination Monitoring
- **Status:** Architectural Scaffold Complete
- **Mount Point:** `/api/modules/e`
- **Features:** Student-centric, ethical examination integrity verification. Logs proctoring events with transparent dispute resolution mechanisms and student explanation entries.
- **Core Models:**
  - `ExamSession`: Exam code, candidate identifier, event timeline (camera checks, blur events, jitter), resolution status.
- **Primary Routes:**
  - `GET /api/modules/e/exams`: Session audit records.
  - `GET /api/modules/e/health`: Status probe.

---

## Database & Isolation Guarantees

1. **Target Cluster:** `loopuniversedev.ky5byth.mongodb.net`
2. **Development Database:** `loop_universe_dev`
3. **Connection Security:**
   - Strict connection to `process.env.MONGODB_URI` without silent or unverified fallbacks.
   - Credentials masked in all logs (`sanitizeUriForLog`).
   - Idempotent development seed utility (`backend/scripts/seed_dev_safe.js`) protects against accidental data loss.
