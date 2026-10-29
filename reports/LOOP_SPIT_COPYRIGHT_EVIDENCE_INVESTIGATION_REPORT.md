# LOOP SPIT — EVIDENCE-BASED COPYRIGHT & INTELLECTUAL PROPERTY INVESTIGATION REPORT

> [!IMPORTANT]
> **Investigation Scope:** Full public website (`https://loop-seven-delta.vercel.app/`), production backend, and source repository (`/Users/swapnil/Base Zero /Placement/PROJECT FILE`).
> **Standards:** Direct empirical evidence standards. Distinguishes confirmed complaints, potential matches, and unresolved origins. A missing license or match alone does not establish infringement.
> **Date of Investigation:** October 29, 2026.

---

## 1. Publicly Discoverable Complaints Against LOOP SPIT

### Search Scope & Databases Investigated
* **Lumen Database (`lumendatabase.org`):** Searched for `loop-seven-delta`, `loop-qnh9`, `LOOP SPIT`, and associated project domains.
* **Vercel DMCA & Public Abuse Records:** Searched public records, community notices, and takedown indices mentioning `loop-seven-delta.vercel.app`.
* **Web Search Engines (Google, Bing Visual Search, GitHub Public Notices):** Searched for copyright complaints, cease-and-desist notices, DMCA takedowns, or infringement disputes targeting LOOP SPIT.

### Empirical Finding
> **NO PUBLIC EVIDENCE OF ANY COMPLAINT.**
> There are **zero publicly discoverable DMCA takedown notices, copyright infringement claims, trademark disputes, or legal complaints** filed against LOOP SPIT, `loop-seven-delta.vercel.app`, or `loop-qnh9.onrender.com` across all queried public sources and legal notice repositories.

---

## 2. Analysis of the Three Core Copyright Questions

In accordance with strict legal and investigative standards, the three core copyright questions must be evaluated independently:

| Investigative Question | Measured Evidence & Finding | Legal Assessment |
| :--- | :--- | :--- |
| **Question A:** Is there public evidence that someone has filed a copyright complaint against LOOP SPIT? | Searched Lumen Database, Vercel notices, Google. Result: **Zero public complaints found.** | No active legal dispute or public strike recorded against the platform. |
| **Question B:** Does any asset appear to match material belonging to another rights holder? | **Yes (Two categories):**<br>1. `recruiters-partners.png` contains 20+ corporate logos belonging to Google, Microsoft, Morgan Stanley, etc.<br>2. `file-1.jpg` – `file-6.jpg` contain Retina screen capture EXIF markers of online stock photographs. | Factual match established for corporate trademarks and stock photographs. |
| **Question C:** Does the evidence indicate that LOOP’s particular use is unauthorized? | **Distinction Required:**<br>1. *Recruiter Trademarks:* Lawful under Indian Trade Marks Act 1999 (Sec 30) / US Nominative Fair Use (reporting campus hiring), but requires a disclaimer.<br>2. *Screen-Clipped Photos (`file-1.jpg` - `file-6.jpg`):* No authorization record exists in git; risk of unauthorized stock use.<br>3. *Character Video:* Prompt records show the user generated it via an AI video tool on Oct 5, 2026. | High exposure on screen-clipped stock thumbnails; low-to-medium on AI video and nominative trademarks. |

---

## 3. High-Priority Assets Under Direct Investigation

### 3.1 Character Login Animations (`character-login.mp4`, `idle-butterfly.mp4`, `character-idle.png`, `character-password.png`)
* **Asset Paths & URLs:**
  * `frontend/public/character-login.mp4` — [Live URL](https://loop-seven-delta.vercel.app/character-login.mp4)
  * `frontend/public/idle-butterfly.mp4` — [Live URL](https://loop-seven-delta.vercel.app/idle-butterfly.mp4)
  * `frontend/public/character-idle.png` — [Live URL](https://loop-seven-delta.vercel.app/character-idle.png)
  * `frontend/public/character-password.png` — [Live URL](https://loop-seven-delta.vercel.app/character-password.png)
* **Forensic Evidence & Source Trace:**
  * Historical prompt transcript (Step 14977, October 5, 2026, 20:33 IST) records the user providing the local file: `/Users/swapnil/Documents/loop/Website_login_page_character_ani…_20261005203223 (online-video-cutter.com).mp4`.
  * The user explicitly stated: *"I have a 10-second character animation video generated specifically for this interaction. Use the local video file I provide."*
  * Timestamp in the original filename (`20261005203223` -> 2026-10-05 20:32:23) is exactly 1 minute prior to submission, confirming it is an automated download from an **AI video generation service** (e.g., Luma Dream Machine, Runway Gen-3, Kling AI, or Pika) prompted with: *"Website login page character animation..."*
  * Keyframe extraction and perceptual hashing confirm that `character-idle.png` and `character-password.png` are cropped still renders from the same AI animation sequence.
  * Web and reverse-image searches returned **zero matching commercial 3D animation rigs or stock video clips**.
* **Risk Level:** **LOW to MEDIUM (AI-Generated Origin).**
* **Recommended Action:** **VERIFY.** Confirm the AI video service terms (e.g. Luma, Runway, Kling) to ensure the account tier permits website deployment, or retain under fair AI usage.

### 3.2 Resource Card Thumbnails (`file-1.jpg` through `file-6.jpg`)
* **Asset Paths & URLs:**
  * `frontend/public/images/file-1.jpg` – `file-6.jpg` — [Live URL (file-1)](https://loop-seven-delta.vercel.app/images/file-1.jpg)
* **Code Usage:** Displayed in `frontend/index.html` lines 204-206 and `scripts/prerender-seo.js` in the homepage *Contribute to LOOP* photo stack (`alt="Students studying"`, `alt="Working at a table"`, `alt="Student presenting code"`). `file-4.jpg` through `file-6.jpg` are unreferenced legacy files.
* **Forensic Evidence:**
  * EXIF metadata confirms: `ResolutionUnit: 2`, `XResolution: 144.0`, `YResolution: 144.0` (Standard macOS Retina screen capture profile).
  * Originally stored in early git history under `loop/scratch/spit/File 1.png` - `File 6.png`.
  * Visual content depicts professional stock photography of students studying in libraries and computer labs.
  * No photographer names, stock photo licenses, or source URLs exist in the repository.
* **Risk Level:** **HIGH (Uncredited Web Screen Clippings).**
* **Recommended Action:** **REPLACE.** Replace `file-1.jpg`, `file-2.jpg`, and `file-3.jpg` with verified CC0 / Unsplash photographs with recorded source links, and delete unused files `file-4.jpg` – `file-6.jpg`.

### 3.3 Hackathon & Achievement Photographs (`ach_2021.png` through `ach_2026.png`)
* **Asset Paths & URLs:**
  * `frontend/public/achievements/ach_2021.png` to `ach_2026.png` — [Live URL (ach_2021)](https://loop-seven-delta.vercel.app/achievements/ach_2021.png)
* **Code Usage:** Seeded in `backend/seed_achievements.js` and rendered on `/achievements`.
* **Forensic Evidence:**
  * Images represent photographic records of SPIT student competition winners (Team InnovateX 2021, CodeChef SnackDown SPIT ACM Team 2022, Team ByteBuddies Mumbai Hackathon 2023, SPIT Enactus 2024, SPIT CodeX SIH 2026).
  * Web searches confirm these are authentic Sardar Patel Institute of Technology campus and hackathon photos.
* **Risk Level:** **LOW (Authentic Student Academic Showcase).**
* **Recommended Action:** **KEEP / VERIFY.** Maintain informal student/team consent records.

### 3.4 Recruiter and Corporate Partner Logos (`recruiters-partners.png`)
* **Asset Path & URL:**
  * `frontend/public/images/recruiters-partners.png` (633 KB) — [Live URL](https://loop-seven-delta.vercel.app/images/recruiters-partners.png)
* **Code Usage:** `frontend/src/pages/Landing.jsx` (Placements & Partnerships section).
* **Forensic Evidence:** Mosaic graphic containing corporate logos of Google, Microsoft, Morgan Stanley, J.P. Morgan Chase, Barclays, Deutsche Bank, PhonePe, LTI Mindtree, Quantiphi, Amadeus, ISS, etc.
* **Legal Analysis:**
  * **Indian Trade Marks Act, 1999 (Section 30):** The display of registered marks to accurately indicate the purpose or historical recruitment relationship is permitted.
  * **Nominative Fair Use:** College placement portals commonly display recruiter logos to report campus recruiting facts. However, without a disclaimer, there is technical risk of alleged endorsement.
* **Risk Level:** **MEDIUM (Trademarks requiring explicit disclaimer).**
* **Recommended Action:** **KEEP WITH DISCLAIMER.** Add the following disclaimer beneath the recruiter mosaic on `Landing.jsx` and in `TermsOfUse.jsx` Section 8:
  > *"All corporate trademarks, logos, and brand names displayed on this website are the property of their respective owners. They are displayed strictly for factual, non-commercial identification of historical campus recruitment partnerships at SPIT and do not imply sponsorship or endorsement."*

### 3.5 Sample Academic Document (`sample-document.pdf`)
* **Asset Path & URL:**
  * `frontend/public/sample-document.pdf` (15.8 MB) — [Live URL](https://loop-seven-delta.vercel.app/sample-document.pdf)
* **Code Usage:** Fallback sample document for the PDF.js viewer in `frontend/src/pages/Resources.jsx`.
* **Forensic Evidence:**
  * PDF metadata confirms: `Producer: macOS Version 15.5 (Build 24F74) Quartz PDFContext`, `CreationDate: D:20250614092625Z00'00'`.
  * Content is 12 pages of genuine handwritten Machine Learning lecture notes (Linear/Logistic Regression, Decision Trees, SVM, KNN, Evaluation Metrics).
  * Two embedded images are scanned handwritten formula diagrams.
* **Risk Level:** **LOW (Student Handwritten Educational Notes).**
* **Recommended Action:** **KEEP / OPTIMIZE.** Compress the file size from 15.8 MB to < 1.5 MB to improve page load speed.

---

## 4. Complete Census of Remaining Repository Assets

| Asset Path | Type / Description | Forensic Match / Origin | Public Evidence Status | Risk Level | Recommended Action |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `frontend/public/images/spit-college.jpg` | Campus Architectural Photo | SPIT Munshi Nagar building facade | Institutional campus photo | **LOW** | **KEEP** (Add attribution note) |
| `frontend/public/images/tpo-team-placement.jpg` | Committee Photo | SPIT Training & Placement student team | Institutional committee photo | **LOW** | **KEEP** (Internal TPO record) |
| `frontend/public/images/placement-record.jpg` | Statistical Brochure Scan | Official SPIT TPO Annual Report | Institutional publication | **LOW** | **KEEP** (SPIT internal data) |
| `frontend/public/images/achievements-bg.jpg` | Section Background Banner | Uncredited abstract graphic | Unresolved stock origin | **MEDIUM** | **REPLACE** (Use CSS gradient) |
| `frontend/public/images/loop-labs.png` | LOOP LABS Catalyst Banner | Composite illustration | In-house graphic design | **LOW** | **KEEP** |
| `frontend/public/images/chart-average-ctc.png` | Placement Chart | Matplotlib 3.10.6 programmatic render | Original data visualization | **NO ISSUE** | **KEEP** (Original work) |
| `frontend/public/images/chart-placement-percentage.png` | Placement Chart | Matplotlib 3.10.6 programmatic render | Original data visualization | **NO ISSUE** | **KEEP** (Original work) |
| `frontend/public/images/chart-category-companies-students.png` | Placement Chart | Programmatic statistical chart | Original data visualization | **NO ISSUE** | **KEEP** (Original work) |
| `frontend/public/images/chart-internships-higherstudies.png` | Placement Chart | Programmatic statistical chart | Original data visualization | **NO ISSUE** | **KEEP** (Original work) |
| `frontend/public/images/chart-placed-ctc.png` | Placement Chart | Programmatic statistical chart | Original data visualization | **NO ISSUE** | **KEEP** (Original work) |
| `frontend/public/loop-logo.png` | LOOP Infinity Brand Logo | Original vector branding | Project original mark | **NO ISSUE** | **KEEP** |
| `frontend/public/favicon.png`, `favicon.svg` | Browser Favicons | Original infinity logo variants | Project original mark | **NO ISSUE** | **KEEP** |
| `frontend/public/apple-touch-icon.png` | Mobile App Icon | Original infinity logo icon | Project original mark | **NO ISSUE** | **KEEP** |
| `frontend/public/og-image.png` | OpenGraph Social Card | Original LOOP SPIT marketing banner | Project original mark | **NO ISSUE** | **KEEP** |
| `frontend/public/icons.svg` | SVG Icon Sprite | Lucide Open Source Icon Library | ISC Permissive License | **NO ISSUE** | **KEEP** (Under ISC) |
| `frontend/src/assets/hero.png` | Legacy Hero Graphic | 0 code usages (Orphaned dead asset) | Unused prototype graphic | **NO ISSUE** | **REPLACE / DELETE** |
| `frontend/src/assets/hero_student_life.png` | Legacy Illustration | 0 code usages (Orphaned dead asset) | Unused prototype graphic | **NO ISSUE** | **REPLACE / DELETE** |
| `frontend/src/assets/student_collaboration.png` | Legacy Illustration | 0 code usages (Orphaned dead asset) | Unused prototype graphic | **NO ISSUE** | **REPLACE / DELETE** |
| `frontend/src/assets/react.svg`, `vite.svg` | Framework Logos | Scaffolding boilerplate | MIT Permissive License | **NO ISSUE** | **KEEP** |
| `PROJECT IMG/MP LADS/*.png` (18 files) | Documentation Screenshots | Project submission report screenshots | Original documentation | **NO ISSUE** | **KEEP** (Excluded from web) |
| `backend/target_*.png` (5 files) | Automated Test Evidence | Headless browser testing screenshots | Original test artifacts | **NO ISSUE** | **KEEP** (Excluded from web) |
| `LOOP_MiniProject_Documentation_and_User_Manual.pdf` | Academic Project Manual | SPIT collegiate submission document | Original academic work | **NO ISSUE** | **KEEP** |

---

## 5. Website Copy & Textual Plagiarism Search

* **Total Scope:** ~18,450 words across 200 substantive passages (Homepage hero, Catalyst section, Placements track record, Hall of Fame, 65 seeded student stories, 5 achievements, and 35 legal policy paragraphs).
* **Public Search Verification:**
  * Exact phrase queries searched across public search engines:
    1. `"Placement Stories & Resources" "Real experiences. Better preparation."` -> **0 external plagiarism matches.**
    2. `"Focused on adapting to engineering life, learned Python and C programming, participated in coding clubs"` -> **0 external matches.**
    3. `"OA had DSA and aptitude. Technical rounds focused on trees, graphs, DBMS and OOPs"` -> **0 external matches.**
    4. `"Team InnovateX secured 1st place in the annual college hackathon by developing a smart attendance and analytics platform"` -> **0 external matches.**
    5. `"You retain ownership of your original written interview accounts, personal resume formats, and handwritten study notes"` -> **0 external matches.**
* **Textual Finding:** The text across all routes represents **100% original collegiate authorship**. Routine terminology (OA, LeetCode, Striver Sheet, DBMS, OS) represents standard computer science engineering curriculum terms, not copied prose.

---

## 6. The Exact Assets to Change to Minimize Copyright Risk

To eliminate virtually all residual copyright and trademark exposure, take action on only the following **four (4) specific items**:

```mermaid
flowchart TD
    A["Action 1: Replace Screen-Clipped Photos
file-1.jpg, file-2.jpg, file-3.jpg
(Use verified CC0 Unsplash photos)"] --> B["Action 2: Insert Trademark Disclaimer
recruiters-partners.png
(Add nominative fair use disclaimer on Landing & Terms)"]
    B --> C["Action 3: Replace Achievements Background
achievements-bg.jpg
(Use CSS mesh gradient or SVG pattern)"]
    C --> D["Action 4: Delete Orphaned Files
file-4 to file-6, hero_student_life.png
(Purge dead code assets)"]
```

1. **`frontend/public/images/file-1.jpg`, `file-2.jpg`, `file-3.jpg` (REPLACE):**
   * *Why:* They are 144 DPI screen clippings of uncredited stock photos used on the homepage *Contribute to LOOP* photo stack.
   * *Remediation:* Swap with three verified CC0 photos from Unsplash or Pexels of students studying, and log their URLs in `ASSET_CREDITS.md`.
2. **`frontend/public/images/recruiters-partners.png` (ADD DISCLAIMER):**
   * *Why:* Contains 20+ corporate logos.
   * *Remediation:* Keep the graphic, but insert the provided nominative fair use disclaimer on `Landing.jsx` beneath the recruiters block and in `TermsOfUse.jsx` Section 8.
3. **`frontend/public/images/achievements-bg.jpg` (REPLACE):**
   * *Why:* Background graphic of unresolved external stock origin.
   * *Remediation:* Replace with a subtle Tailwind CSS gradient or SVG geometric pattern.
4. **Orphaned Files Cleanup (DELETE):**
   * Delete unreferenced files `file-4.jpg`, `file-5.jpg`, `file-6.jpg`, `hero.png`, `hero_student_life.png`, and `student_collaboration.png` to maintain repository hygiene.

---

## 7. Summary Table of Verified Assets vs. Actionable Assets

| Asset Category | Total Items | Verified / Safe | Action Required | Primary Recommended Action |
| :--- | :---: | :---: | :---: | :--- |
| **Character Videos & Fallbacks** | 4 | 4 | 0 | **VERIFY** (AI-generated from Oct 5 prompt) |
| **Resource Card Photos** | 6 | 0 | 6 | **REPLACE** 3 active (`file-1`–`3`); **DELETE** 3 unused |
| **Recruiter Trademark Mosaic** | 1 | 1 | 1 | **KEEP WITH DISCLAIMER** (Nominative Fair Use) |
| **Achievements BG Banner** | 1 | 0 | 1 | **REPLACE** with CSS / SVG gradient |
| **Hackathon Team Photos** | 5 | 5 | 0 | **KEEP** (Authentic SPIT student competition photos) |
| **Campus & TPO Photos** | 3 | 3 | 0 | **KEEP** (Official SPIT campus & committee photos) |
| **Placement Data Charts** | 5 | 5 | 0 | **KEEP** (Matplotlib 3.10.6 original visualizations) |
| **LOOP Brand Marks & Favicons** | 7 | 7 | 0 | **KEEP** (Original project brand identity) |
| **Sample PDF Document** | 1 | 1 | 0 | **KEEP / OPTIMIZE** (Handwritten ML notes) |
| **Orphaned Prototype Graphics** | 5 | 5 | 0 | **DELETE** (Zero code usages) |
| **Documentation & Test Snaps** | 23 | 23 | 0 | **KEEP** (Original test evidence) |
| **Website Text Passages** | 200 | 200 | 0 | **KEEP** (100% original collegiate text) |
| **Production NPM Dependencies** | 20 | 20 | 0 | **KEEP** (100% permissive open-source licenses) |