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

### Module B: Smart Campus Ride-Pooling & Trust System
- **Status:** Fully Implemented & Tested (2.1.0)
- **Mount Point:** `/api/modules/b`
- **Features:**
  1. **Graph Mobility & Dijkstra Routing:** Priority-queue Dijkstra shortest path routing across 10 SPIT campus and transit nodes with 18 bidirectional road segments.
  2. **Multi-Stop Route Insertion:** Topological waypoint insertion with deterministic 0–100 match scoring, detour bounds, and CO₂ savings calculations ($120\text{g } \text{CO}_2/\text{km}$ baseline).
  3. **Active Trip Progression & Durable Completion:** Server-authoritative state transitions (`open` ➔ `scheduled` ➔ `in_transit` ➔ `completed`). Idempotent completion prevents duplicate sustainability credits via `StudentSustainabilityOutcome`.
  4. **Live In-Transit Simulation:** Authoritative progress state and animated vehicle tracking along Dijkstra waypoints on `CampusNetworkMap` with passenger-specific pickup ETAs.
  5. **Post-Ride Peer Ratings & Safety Feedback:** Verified ratings (1–5 stars) restricted to confirmed ride participants, category tags, unrated driver fallbacks, and private administrator safety violation reports.
  6. **Recurring Commute Schedules:** Reusable commuter templates with Asia/Kolkata timezone support and idempotent upcoming ride offer generation.
  7. **In-App Notifications & Privacy-Aware Contact:** Persistent event-driven notification center with unread counters, plus authorized WhatsApp (`wa.me`) and phone actions accessible only to confirmed participants with driver consent.
- **Core Collections:**
  - `RideOffer`: Route waypoints, vehicle info, atomic seat availability, simulation state, contact sharing preferences, ratings summary.
  - `RideRequest`: Pickup/dropoff nodes, requested seats, detour and fare metrics, booking status.
  - `RideRating`: 1–5 star ratings, feedback categories, optional comments, private safety reports.
  - `RecurringRideTemplate`: Days of week, departure time, date boundaries, seat and pricing defaults.
  - `RideNotification`: Event-driven alerts (`REQUEST_RECEIVED`, `REQUEST_ACCEPTED`, `RIDE_STARTED`, `RIDE_COMPLETED`, etc.).
  - `StudentSustainabilityOutcome`: Exactly-once auditable carbon offset and monetary savings ledger.

### Module C: Sustainable Computing Observatory
- **Status:** Architectural Scaffold Complete
- **Mount Point:** `/api/modules/c`
- **Features:** Telemetry collection for SPIT computer lab workstations, server nodes, and cluster power draws. Provides carbon emission estimates and carbon-aware batch job scheduling.
- **Core Models:**
  - `ComputeTelemetry`: Node utilization (CPU/GPU), active wattage, estimated carbon grams/hr.
  - `GreenComputeJob`: Off-peak scheduling queue for high-compute student projects.

### Module D: Privacy-Aware Digital Wellbeing
- **Status:** Architectural Scaffold Complete
- **Mount Point:** `/api/modules/d`
- **Features:** Privacy-first study and focus session tracker. Protects student identity via irreversible salted SHA-256 hashes and provides automated rest break nudges to prevent burnout.
- **Core Models:**
  - `FocusSession`: Anonymous hash, branch track, duration, focus rating, study category.
  - `NudgeRule`: Configurable study thresholds and mindful break recommendations.

### Module E: Responsible Examination Monitoring
- **Status:** Architectural Scaffold Complete
- **Mount Point:** `/api/modules/e`
- **Features:** Student-centric, ethical examination integrity verification. Logs proctoring events with transparent dispute resolution mechanisms and student explanation entries.
- **Core Models:**
  - `ExamSession`: Exam code, candidate identifier, event timeline (camera checks, blur events, jitter), resolution status.

---

## Database & Isolation Guarantees

1. **Target Cluster:** `loopuniversedev.ky5byth.mongodb.net`
2. **Development Database:** `loop_universe_dev`
3. **Connection Security:**
   - Strict connection to `process.env.MONGODB_URI` without silent or unverified fallbacks.
   - Credentials masked in all logs (`sanitizeUriForLog`).
   - Idempotent development seed utility (`backend/scripts/seed_dev_safe.js`) protects against accidental data loss.
