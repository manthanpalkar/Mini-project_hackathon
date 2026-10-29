# UniVerse Module D — Privacy-Aware Digital Wellbeing Chrome Extension

> **Chrome Extension (Manifest V3)** for **UniVerse: An Intelligent, Sustainable, and Privacy-Aware Campus Ecosystem**.

A client-side, zero-surveillance browser extension built for students to sustain deep study sessions, measure focus duration, track context switches, and reflect on digital habits without compromising personal privacy.

---

## 🌟 Core Features

1. **Focus Session Controller**:
   - Start, pause, resume, and stop study sessions directly from the extension popup.
   - Dynamic extension badge (`12m` in green when active, `⏸` in amber when paused, blank when idle).
   - Chrome idle detection: Automatically detects when you step away from your computer.

2. **Zero-Surveillance Privacy Engine**:
   - **Active-Only Gating**: Absolutely no tab tracking occurs when a session is idle or paused.
   - **Incognito Exemption**: Incognito tabs and windows are 100% ignored.
   - **Hostname-Only Storage**: URL paths, search queries, hashes, and authentication parameters are stripped immediately.
   - **Zero Keystroke / Content Capture**: Never inspects page content, form inputs, or keystrokes.
   - **Right to Be Forgotten**: One-click local data wipe and JSON export.

3. **Configurable Categorization Rules**:
   - Categorize domains into **Productive / Academic**, **Educational**, **Distracting**, or **Neutral**.
   - User-defined rule matching (`domain_suffix`, `exact_host`, `contains`).
   - Pre-loaded with essential developer and academic presets (GitHub, StackOverflow, arXiv, Wikipedia, Canvas, Moodle, YouTube, Reddit, Instagram, etc.).

4. **Dedicated Analytics Dashboard**:
   - Clean, full-page extension dashboard displaying active focus minutes, session streaks, context switch count, and distracting time percentage.
   - Visual category time breakdown bars and inspectable recent activity records with rule explanations.

5. **Optional UniVerse Cloud Sync**:
   - Works **100% offline** out of the box using `chrome.storage.local`.
   - Optionally sync completed study sessions to the UniVerse campus backend (`/api/modules/d/sessions`) when logged in with a JWT token.

---

## 🚀 How to Install in Google Chrome

1. Open Google Chrome and navigate to:
   ```text
   chrome://extensions
   ```
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `loop/extension` directory from this repository:
   ```text
   c:\Users\manth\Desktop\Hackathon\loop\extension
   ```
5. Pin the **UniVerse Wellbeing** extension to your Chrome toolbar for easy access.

---

## 📁 Directory Architecture

```text
loop/extension/
├── manifest.json              # Chrome Extension Manifest V3 configuration
├── background/
│   └── service-worker.js      # Background service worker (ES module, alarms, tabs, idle)
├── shared/
│   ├── rulesEngine.js         # Pure domain normalization, matching & presets
│   ├── storage.js             # chrome.storage.local abstraction with test fallback
│   ├── sessionManager.js      # Timestamp-based elapsed math & transition tracking
│   └── syncClient.js          # Optional authenticated UniVerse API sync client
├── popup/
│   ├── popup.html             # Compact popup view for quick session control
│   ├── popup.css              # Cyberpunk/UniVerse dark glassmorphism styling
│   └── popup.js               # Popup controller & real-time timer
├── dashboard/
│   ├── dashboard.html         # Full analytics dashboard
│   ├── dashboard.css          # Rich data visualization & metrics layout
│   └── dashboard.js           # Metric aggregation & activity log rendering
├── options/
│   ├── options.html           # Settings & rule management interface
│   ├── options.css            # Clean configuration forms & table styles
│   └── options.js             # Add/delete rules, set goals, wipe data, configure sync
├── assets/                    # Extension icons (16px, 32px, 48px, 128px)
└── tests/
    ├── extensionRules.test.js # Unit tests for rules engine & privacy sanitization
    └── extensionSession.test.js # Lifecycle tests for session state & timer math
```

---

## 🔒 Permissions Rationale

- `"storage"`: Used to persist categorization rules, focus goals, and local session analytics in `chrome.storage.local`.
- `"tabs"`: Used strictly during active sessions to inspect `tab.url` hostnames. URL paths, queries, and form inputs are never accessed.
- `"alarms"`: Used for periodic badge updates and session duration synchronization across service worker wake/sleep cycles.
- `"idle"`: Detects system idle state to notify students or pause tracking when they leave their workstation.

---

## 🧪 Running Automated Tests

Run the standalone extension test suite using Node.js built-in test runner:

```bash
cd loop/extension
node --test tests/extensionRules.test.js tests/extensionSession.test.js
```
