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
- **Status:** Fully Implemented & Integrated
- **Mount Point:** `/api/modules/c`
- **Frontend Route:** `/green-compute` (Navbar: "Green Compute")
- **Features:**
  - **Deterministic Simulation Engine:** Mulberry32 PRNG for 100% reproducible baseline vs. optimized experiments across arbitrary seeds and durations.
  - **3 Specialized Campus Service Workloads:**
    1. *Campus Core API (`campus_api`):* Request-response workload optimized with distributed in-memory query & profile caching.
    2. *Student Analytics Worker (`analytics_worker`):* Event streaming telemetry optimized with adaptive event micro-batching.
    3. *Media & Document Pipeline (`media_processor`):* Heavy compute OCR and image encoding optimized with vectorized single-pass processing.
  - **Pure Physics & Grid Emissions Formulation:**
    - Average Power: $P_{\text{avg}} = P_{\text{idle}} + u \cdot (P_{\text{max}} - P_{\text{idle}})$ (Watts)
    - Energy: $E = \frac{P_{\text{avg}} \cdot t}{3{,}600{,}000}$ (kWh)
    - Carbon: $C = E \cdot I_{\text{grid}}$ (kg CO₂e), using India Central Electricity Authority baseline factor ($0.708\text{ kg CO}_2\text{e/kWh}$).
  - **Interactive Observatory UI:** Real-time KPI summaries, side-by-side SVG comparative charts, service ledger, scientific formula disclosure, and historical runs browser.
- **Core Models:**
  - `GreenComputeSimulationRun`: Full simulation telemetry with seed, duration, intensity, service-level comparisons, and aggregate savings persisted to MongoDB Atlas.
  - `ComputeTelemetry`: Node utilization (CPU/GPU), active wattage, estimated carbon grams/hr.
  - `GreenComputeJob`: Off-peak scheduling queue for high-compute student projects.

### Module D: Privacy-Aware Digital Wellbeing
- **Status:** Fully Implemented & Integrated
- **Mount Point:** `/api/modules/d`
- **Frontend Route:** `/digital-wellbeing` (Navbar: "Wellbeing")
- **Features:**
  - **Focus Session Lifecycle Controller:** Robust state machine supporting start, pause, resume, stop, and discard actions. Server-authoritative timestamps calculate true active duration independently of pauses or page reloads.
  - **User-Defined Categorization Rules:** Custom domain matching (`domain_suffix`, `exact_host`, `contains`) with user priority precedence, instant live domain preview classifier, and built-in academic system presets.
  - **Synthetic Activity Generator:** Explicit user-initiated reproducible scenario generator (Mulberry32 PRNG) supporting *Focused Study*, *Mixed Study*, *Frequent Switching*, and *Minimal Sustained Activity*. All records visibly labeled `SIMULATED DEMO DATA`.
  - **Focus & Context-Switch Analytics:** Accurate calculation of active focus time, category distribution, context switches (category transition count), and estimated distracting duration.
  - **Privacy Center & Data Rights:** Transparent tracking status indicator, strict data minimization (zero keystrokes, zero browser snooping), single-event deletion, full history purge (*right-to-be-forgotten*), and JSON data export.
- **Core Models:**
  - `FocusSession`: User email, salted SHA-256 anonymous hash, target minutes, accumulated active seconds, pause tracking, quality score, and reflection notes.
  - `CategorizationRule`: User email, pattern, match type, category (`learning`, `productive`, `distracting`, `neutral`, `uncategorized`), priority, and toggle status.
  - `ActivityEvent`: Explicit user-triggered or synthetic browsing events with domain, category, duration, and source label.
  - `NudgeRule`: Configurable study thresholds and mindful break recommendations.

### Module E: Responsible Examination Monitoring
- **Status:** Fully Implemented & Integrated
- **Mount Point:** `/api/modules/e`
- **Vision Service Microservice:** Port `5005` (FastAPI + YOLOv8 + 17-Keypoint Pose)
- **Frontend Route:** `/exam-monitoring` (Navbar: "Proctor")
- **Features:**
  - **Multi-Candidate CCTV Spatial Tracking:** Detects 40–60 candidates simultaneously in classroom or exam hall frames using YOLOv8 nano and centroid/IoU temporal tracking. Assigns anonymous temporary session track identifiers (`Track #ID`).
  - **Observable Behavioral Event Detectors:**
    - *Event 1: Repeated Head-Direction Changes:* 17-keypoint human pose estimation (nose, eyes, ears, shoulders) tracks horizontal yaw deviation from each candidate's seated baseline. Triggers review alert on significant direction reversals within a sliding window.
    - *Event 2: Phone-Like Object Detection:* Pretrained object detection identifies cell phones in student desk proximity. Requires multi-frame temporal persistence to prevent single-frame glint false positives.
    - *Event 3: Restricted-Zone Entry:* Optional configurable polygon/bounding box for proctor podium or unauthorized examination boundary.
    - *Event 4: Prolonged Orientation:* Sustained angular orientation toward adjacent candidate desks (> 65% of frames in window).
  - **Real-Time Video HUD & Dynamic Overlay:** Synchronized HTML5 video player with sub-pixel canvas overlay rendering green/emerald normal tracks and glowing red alert boxes (`REVIEW — Track #ID: Event Label`).
  - **Human-in-the-Loop Invigilator Dashboard:** Review status state machine (`Pending Review`, `Reviewed`, `Dismissed`, `Resolved`), evidence snapshot viewer, one-click video seek jump, and proctor audit notes.
  - **Strict Ethical Safeguards:** Zero biometric face recognition, zero facial identity matching, no automated penalties, and clear distinction between model confidence and misconduct verdict.
- **Core Models:**
  - `MonitoringSession`: Session ID, room code, video/camera source, config parameters (frame skip, thresholds), telemetry metrics.
  - `DetectionIncident`: Incident ID, temporary track ID, event type, confidence, video timestamp, bounding box, review status, base64 evidence snapshot, reviewer notes.

---

## Database & Isolation Guarantees

1. **Target Cluster:** `loopuniversedev.ky5byth.mongodb.net`
2. **Development Database:** `loop_universe_dev`
3. **Connection Security:**
   - Strict connection to `process.env.MONGODB_URI` without silent or unverified fallbacks.
   - Credentials masked in all logs (`sanitizeUriForLog`).
   - Idempotent development seed utility (`backend/scripts/seed_dev_safe.js`) protects against accidental data loss.
