import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const BASE_URL = process.env.VITE_SITE_URL || 'https://loop-seven-delta.vercel.app';

if (!fs.existsSync(DIST_DIR)) {
  console.error('[PRERENDER_ERROR] dist directory not found. Please run vite build first.');
  process.exit(1);
}

const templatePath = path.join(DIST_DIR, 'index.html');
const templateHtml = fs.readFileSync(templatePath, 'utf8');

// Privacy sanitizer: strictly removes personal email addresses, phone numbers, and profile URLs
function sanitizePublicText(text) {
  if (!text) return '';
  return String(text)
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[contact redacted]')
    .replace(/\b(?:\+?91[\-\s]?)?[6-9]\d{9}\b/g, '[phone redacted]')
    .replace(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/gi, '[profile redacted]')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function truncateText(text, maxLen = 350) {
  const cleaned = sanitizePublicText(text);
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.substring(0, maxLen).replace(/\s+\S*$/, '') + '...';
}

// 1. Core Platform Pages
const CORE_PAGES = [
  {
    route: '/',
    title: 'LOOP SPIT | SPIT Mumbai Placement Stories & Resources',
    description: 'Explore LOOP SPIT, a student-led platform for SPIT Mumbai students featuring placement experiences, interview preparation guidance, and career resources.',
    h1: 'Placement Stories & Resources',
    paragraphs: [
      'Welcome to LOOP SPIT, the independent student-led placement portal and career-preparation platform for Sardar Patel Institute of Technology (SPIT), Mumbai. Built around the guiding ethos "Their Journey. Your Opportunity.", LOOP connects college juniors, seniors, and alumni to document verified recruitment experiences and foster peer mentorship across engineering disciplines.',
      'LOOP hosts structured, round-by-round placement interview debriefs covering every stage of campus recruitment—from initial resume shortlisting and online assessments (OA) to live technical evaluations, algorithmic coding challenges, system design rounds, and behavioral HR interviews across top technology and financial services employers.',
      'Each debrief captures authentic placement preparation strategies, recommended algorithmic problem sets, core computer science revision topics (DBMS, Operating Systems, Computer Networks, OOP), and candid advice from seniors on navigating recruitment hurdles.',
      'Students can explore interview experiences filtered by company, engineering branch (CSE, CSE-DS, CSE-AIML, CE, EXTC), and graduation year, or access curated semester study materials, formula sheets, and past question papers in the academic resources repository.'
    ],
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'LOOP SPIT — Placement Stories & Resources',
      alternateName: [
        'LOOP',
        'LOOP SPIT',
        'LOOP SPIT Mumbai',
        'LOOP Placement Portal',
        'SPIT Placement Portal'
      ],
      url: `${BASE_URL}/`,
      description: 'Explore LOOP SPIT, a student-led platform for SPIT Mumbai students featuring placement experiences, interview preparation guidance, and career resources.',
      publisher: {
        '@type': 'Organization',
        name: 'LOOP — Limitless Opportunities, One Platform',
        url: `${BASE_URL}/`,
        logo: {
          '@type': 'ImageObject',
          url: `${BASE_URL}/loop-logo.png`
        }
      },
      about: {
        '@type': 'EducationalOrganization',
        name: 'Sardar Patel Institute of Technology',
        alternateName: 'SPIT Mumbai',
        url: 'https://www.spit.ac.in/',
        sameAs: [
          'https://www.spit.ac.in/',
          'https://en.wikipedia.org/wiki/Sardar_Patel_Institute_of_Technology'
        ]
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${BASE_URL}/stories?q={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    },
    priority: '1.0',
    changefreq: 'daily'
  },
  {
    route: '/privacy-policy',
    title: 'Privacy Policy | LOOP — Limitless Opportunities, One Platform',
    description: 'LOOP Privacy Policy. Learn how student records, placement debriefs, and authentication credentials are safeguarded at SPIT Mumbai.',
    h1: 'LOOP Privacy Policy & Data Security Governance',
    paragraphs: [
      'At LOOP, we place utmost importance on protecting the privacy, identity, and personal records of our students and contributors at Sardar Patel Institute of Technology (SPIT). This Privacy Policy explains our practices regarding data collection, encryption standards, authentication protocols, and document access control.',
      'We collect only the essential information necessary to maintain account security and facilitate educational resource sharing, including institutional email addresses, hashed authentication credentials, and user-submitted placement experiences. Confidential student contact details, personal telephone numbers, and private resumes remain strictly guarded behind role-based access control and are never exposed in public sitemaps, search engine metadata, or unauthorized endpoints.',
      'All uploaded binaries are managed within an enterprise-grade MongoDB Atlas GridFS cluster using encrypted streaming tokens. By using LOOP, you consent to the information practices described in this policy, which complies with prevailing data protection frameworks.'
    ],
    priority: '0.3',
    changefreq: 'monthly'
  },
  {
    route: '/terms',
    title: 'Terms of Use | LOOP — Limitless Opportunities, One Platform',
    description: 'Terms of Use for LOOP, the student placement debrief and academic preparation platform at Sardar Patel Institute of Technology (SPIT).',
    h1: 'LOOP Terms of Use & Academic Integrity Guidelines',
    paragraphs: [
      'These Terms of Use govern your access to and interaction with the LOOP knowledge platform. By accessing or submitting content to LOOP, you agree to abide by institutional guidelines of academic honesty, intellectual integrity, and respectful community participation.',
      'Contributors retain ownership of their placement stories and uploaded academic materials while granting LOOP a non-exclusive license to present and index them for campus educational benefit. Users agree not to distribute copyrighted commercial materials without authorization, post defamatory or misleading interview details, or attempt unauthorized circumvention of security access controls.',
      'LOOP administrators reserve the right to review, edit, or reject submitted placement debriefs and study resources to uphold factual accuracy and campus privacy standards.'
    ],
    priority: '0.3',
    changefreq: 'monthly'
  },
  {
    route: '/login',
    title: 'Sign In | LOOP — Limitless Opportunities, One Platform',
    description: 'Sign in to LOOP SPIT with your Sardar Patel Institute of Technology student account or institutional Google credentials to access full features.',
    h1: 'Sign In to LOOP — SPIT Campus Portal',
    paragraphs: [
      'Access verified senior placement stories, download academic revision notes, participate in peer discussions, and manage your student profile on LOOP SPIT.',
      'Please sign in using your official SPIT email address (@spit.ac.in) or Google Workspace single sign-on. Registered students receive full interactive access to resume downloads, document attachments, and contribution workflows.'
    ],
    noIndex: true
  },
  {
    route: '/forgot-password',
    title: 'Reset Password | LOOP — Limitless Opportunities, One Platform',
    description: 'Recover and reset your account password for LOOP SPIT using your registered institutional email address and secure verification code.',
    h1: 'Reset Your LOOP Account Password',
    paragraphs: [
      'If you have forgotten your password or need to recover account access, enter your registered institutional email address to receive a secure 6-digit verification code.',
      'Verification codes are generated with time-limited validity to ensure security. Once verified, you will be prompted to choose a new strong password to regain access.'
    ],
    noIndex: true
  }
];

// 2. Load Real, Approved, Privacy-Safe Stories
const REAL_STORY_PAGES = [];
const featuredPath = path.resolve(__dirname, 'featuredStories.json');
const backupPath = path.resolve(__dirname, '../../backend/backups/stories_backup_pre_phase2_phase3_2026-10-23T09-13-25-182Z.json');

let selectedStories = [];
if (fs.existsSync(featuredPath)) {
  try {
    selectedStories = JSON.parse(fs.readFileSync(featuredPath, 'utf8'));
  } catch (err) {
    console.warn('[PRERENDER_SEO] Warning loading featuredStories.json:', err.message);
  }
} else if (fs.existsSync(backupPath)) {
  try {
    const rawStories = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phoneRegex = /\b(?:\+?91[\-\s]?)?[6-9]\d{9}\b/;

    // Filter to privacy-clean, rich approved stories
    const cleanStories = rawStories.filter(s => {
      const text = JSON.stringify(s.journey || {});
      return s.id && s.name && s.company && s.role &&
        s.journey && s.journey.howSecured && s.journey.howSecured.length > 300 &&
        !emailRegex.test(text) && !phoneRegex.test(text);
    });

    const seenCompanies = new Set();
    const preferredCompanies = [
      'Barclays', 'J.P. Morgan', 'ISS STOXX', 'UBS', 'Mastercard',
      'Oracle Financial Services (OFSS)', 'Mahindra Finance', 'Interactive Brokers',
      'ICICI Lombard', 'AuxoAI', 'Nomura', 'PhonePe', 'Colgate-Palmolive',
      'BlackRock', 'WorkIndia'
    ];

    for (const comp of preferredCompanies) {
      const match = cleanStories.find(s => s.company === comp && !seenCompanies.has(s.company));
      if (match) {
        seenCompanies.add(match.company);
        selectedStories.push(match);
      }
    }

    for (const s of cleanStories) {
      if (selectedStories.length >= 15) break;
      if (!seenCompanies.has(s.company)) {
        seenCompanies.add(s.company);
        selectedStories.push(s);
      }
    }
  } catch (err) {
    console.warn('[PRERENDER_SEO] Warning loading backup stories:', err.message);
  }
}

for (const s of selectedStories) {
  // Normalize malformed whitespace, repeated tabs, and newlines in text fields
  const cleanCompany = (s.company || '').replace(/\s+/g, ' ').trim();
  const cleanRole = (s.role || '').replace(/\s+/g, ' ').trim();
  const cleanBranch = (s.branch || '').replace(/\s+/g, ' ').trim();
  const cleanPassoutYear = (s.passoutYear || '').replace(/\s+/g, ' ').trim();

  const cohortDisplay = cleanBranch && cleanPassoutYear
    ? ` (${cleanBranch}, Class of ${cleanPassoutYear})`
    : (cleanBranch ? ` (${cleanBranch})` : '');

  const prepRaw = s.prep || s.journey?.prep || '';
  const howSecuredRaw = s.howSecured || s.journey?.howSecured || '';
  const prepExcerpt = prepRaw ? truncateText(prepRaw, 350) : '';
  const howSecuredExcerpt = howSecuredRaw ? truncateText(howSecuredRaw, 450) : '';

  REAL_STORY_PAGES.push({
    route: `/stories/${s.id}`,
    title: `${cleanCompany} ${cleanRole} Placement Experience | LOOP SPIT`,
    description: `Verified campus placement debrief for ${cleanRole} at ${cleanCompany}${cohortDisplay} at Sardar Patel Institute of Technology (SPIT), Mumbai.`,
    h1: `${cleanCompany} — ${cleanRole} Placement Experience`,
    paragraphs: [
      `A student contributor from the ${cleanBranch || 'engineering'} department${cleanPassoutYear ? ` (Class of ${cleanPassoutYear})` : ''} at Sardar Patel Institute of Technology (SPIT), Mumbai secured an offer for ${cleanRole} at ${cleanCompany}.`,
      `Selection Process & Interview Rounds: ${howSecuredExcerpt}`,
      prepExcerpt ? `Preparation Strategy & Study Routines: ${prepExcerpt}` : 'Preparation focused on Data Structures & Algorithms, core CS subjects (DBMS, OS, Networks), and structured mock interview rounds.'
    ],
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: `${cleanCompany} — ${cleanRole} Placement Experience`,
        description: `Verified campus placement debrief for ${cleanRole} at ${cleanCompany}${cohortDisplay} at Sardar Patel Institute of Technology (SPIT), Mumbai.`,
        image: `${BASE_URL}/og-image.png`,
        author: {
          '@type': 'Organization',
          name: 'LOOP Student Contributor'
        },
        publisher: {
          '@type': 'Organization',
          name: 'LOOP — Limitless Opportunities, One Platform',
          url: `${BASE_URL}/`,
          logo: {
            '@type': 'ImageObject',
            url: `${BASE_URL}/loop-logo.png`
          }
        },
        about: {
          '@type': 'EducationalOrganization',
          name: 'Sardar Patel Institute of Technology',
          alternateName: 'SPIT Mumbai',
          url: 'https://www.spit.ac.in/'
        },
        datePublished: s.createdAt || '2025-01-01',
        dateModified: s.updatedAt || s.createdAt || '2025-01-01',
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${BASE_URL}/stories/${s.id}`
        }
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Placement Stories', item: `${BASE_URL}/stories` },
          { '@type': 'ListItem', position: 3, name: `${cleanCompany} Placement Experience`, item: `${BASE_URL}/stories/${s.id}` }
        ]
      }
    ],
    priority: '0.6',
    changefreq: 'monthly'
  });
}

console.log(`[PRERENDER_SEO] Loaded ${REAL_STORY_PAGES.length} privacy-safe authentic stories across top companies.`);

// Determine section visibility (Environment variable, API endpoint, or default OFF)
let sectionVisibility = {
  stories: false,
  resources: false,
  achievements: false
};

if (process.env.SECTION_VISIBILITY) {
  try {
    sectionVisibility = { ...sectionVisibility, ...JSON.parse(process.env.SECTION_VISIBILITY) };
  } catch (e) {
    console.warn('[PRERENDER_SEO] Could not parse process.env.SECTION_VISIBILITY:', e.message);
  }
} else if (process.env.VITE_SECTION_STORIES || process.env.VITE_SECTION_RESOURCES || process.env.VITE_SECTION_ACHIEVEMENTS) {
  sectionVisibility = {
    stories: process.env.VITE_SECTION_STORIES === 'true',
    resources: process.env.VITE_SECTION_RESOURCES === 'true',
    achievements: process.env.VITE_SECTION_ACHIEVEMENTS === 'true'
  };
  console.log('[PRERENDER_SEO] Configured section visibility from environment flags:', sectionVisibility);
} else {
  const apiUrl = process.env.VITE_API_URL || 'https://loop-qnh9.onrender.com/api';
  try {
    if (typeof fetch === 'function') {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${apiUrl}/settings/visibility`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        sectionVisibility = {
          stories: Boolean(data.stories),
          resources: Boolean(data.resources),
          achievements: Boolean(data.achievements)
        };
        console.log('[PRERENDER_SEO] Fetched live section visibility:', sectionVisibility);
      }
    }
  } catch {
    console.log('[PRERENDER_SEO] Using default section visibility (OFF):', sectionVisibility);
  }
}

// In login-required platform architecture, internal sections and individual stories are protected behind authentication
// and must NOT be leaked into public static pre-rendered HTML or public sitemaps.
const ALL_PAGES = [...CORE_PAGES];

function getRenderedShell(page) {
  if (page.route === '/' || page.route === '') {
    return `
    <header class="navbar" style="background: transparent; position: fixed; top: 0; left: 0; right: 0; z-index: 1000; padding: 1.25rem 2rem; display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); background: rgba(10, 14, 23, 0.7); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
      <div style="flex: 1; display: flex; align-items: center;"></div>
      <a href="/" style="position: absolute; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: #ffffff; font-weight: 800; font-size: 1.35rem; letter-spacing: -0.02em;">
        <img src="/loop-logo.png" alt="LOOP Logo" style="height: 26px; width: auto; filter: invert(1); margin-right: 0.2rem;" />
        <span>Loop</span>
        <span style="font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.3); letter-spacing: 0.05em; color: #ffffff;">SPIT</span>
      </a>
      <div style="flex: 1; display: flex; justify-content: flex-end; align-items: center;">
        <a href="/login" class="btn btn-primary" style="padding: 0.45rem 1.15rem; background-color: #ffffff; color: #000000; text-decoration: none; border-radius: 20px; font-size: 0.82rem; font-weight: 700;">Login</a>
      </div>
    </header>

    <main>
      <!-- Hero Section -->
      <section style="min-height: 85vh; width: 100%; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0.65)), url('/images/spit-college.jpg'); background-size: cover; background-position: center; color: #ffffff; text-align: center; padding: 6rem 1.5rem 3rem 1.5rem; border-bottom: 1px solid var(--border-color);">
        <div style="max-width: 840px; z-index: 2; margin: 0 auto;">
          <div style="display: inline-flex; align-items: center; gap: 0.6rem; padding: 0.45rem 1.15rem; border-radius: 9999px; background-color: rgba(255, 255, 255, 0.12); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.28); font-size: 0.85rem; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 700; color: #ffffff; margin-bottom: 1.5rem; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);">
            <span style="letter-spacing: 0.12em;">LOOP</span>
            <span style="opacity: 0.6;">•</span>
            <span style="font-weight: 500; text-transform: none; letter-spacing: 0.02em;">Limitless Opportunities, One Platform</span>
          </div>
          <h1 style="font-size: calc(2.1rem + 1.6vw); font-family: var(--font-serif); font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; margin-bottom: 0.85rem; color: #ffffff; text-shadow: 0 4px 30px rgba(0, 0, 0, 0.85), 0 2px 8px rgba(0, 0, 0, 0.9);">
            Placement Stories &amp; Resources
          </h1>
          <p style="font-size: calc(1.05rem + 0.25vw); font-weight: 500; color: rgba(255, 255, 255, 0.95); text-shadow: 0 2px 14px rgba(0, 0, 0, 0.75); margin-bottom: 0.65rem; letter-spacing: -0.01em; line-height: 1.4;">
            Real placement experiences. Practical resources. Better preparation.
          </p>
          <p style="font-size: 1.05rem; color: rgba(255, 255, 255, 0.84); text-shadow: 0 2px 16px rgba(0, 0, 0, 0.7); max-width: 620px; margin: 0 auto 2.5rem auto; line-height: 1.55;">
            Learn from SPIT seniors and alumni through interview experiences, coding tests, and placement tips.
          </p>
          <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            <a href="/login" class="btn btn-primary" style="padding: 1rem 2.2rem; font-size: 1rem; background-color: #ffffff; color: #000000; text-decoration: none; border-radius: 30px; font-weight: 600; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);">Browse Stories</a>
            <a href="/login" class="btn" style="padding: 1rem 2.2rem; font-size: 1rem; background-color: rgba(255, 255, 255, 0.15); color: #ffffff; text-decoration: none; border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 30px; font-weight: 600; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">Explore Resources</a>
          </div>
        </div>
        <a href="#philosophy-section" style="position: absolute; bottom: 2rem; background: transparent; border: none; color: rgba(255, 255, 255, 0.6); text-decoration: none; font-size: 1.5rem; z-index: 2;">↓</a>
        <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 120px; background: linear-gradient(transparent, var(--bg-primary)); pointer-events: none;"></div>
      </section>

      <!-- Section 3: Loop Labs (Philosophy & study resources) -->
      <section id="philosophy-section" style="position: relative; min-height: 600px; border-bottom: 1px solid var(--border-color); overflow: hidden; display: flex; align-items: center; padding: 5rem 1.5rem; background-color: var(--bg-primary);">
        <div class="container grid-2col" style="max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center;">
          <div>
            <img src="/images/loop-labs.png" alt="Students collaborating at SPIT" style="width: 100%; height: 520px; object-fit: cover; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);" />
          </div>
          <div>
            <span style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #8A2BE2; margin-bottom: 1rem; display: block;">Loop Labs</span>
            <h2 style="font-size: calc(1.8rem + 1vw); font-family: var(--font-serif); font-weight: 500; line-height: 1.25; margin-bottom: 1.5rem; color: var(--text-primary);">The Catalyst</h2>
            <p style="font-size: 1.05rem; line-height: 1.7; color: var(--text-secondary); margin-bottom: 2rem;">Bypass the disorganized WhatsApp groups. Get instant access to the complete stack—from raw lecture notes, class PPTs, and standard textbooks to clear your semester exams, to the exact placement materials you need to secure a Dream Offer.</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2.5rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
              <div>
                <h4 style="font-size: 2rem; font-weight: 800; font-family: var(--font-display); margin-bottom: 0.25rem; color: var(--text-primary);">95%</h4>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Senior feedback participation rate</p>
              </div>
              <div>
                <h4 style="font-size: 2rem; font-weight: 800; font-family: var(--font-display); margin-bottom: 0.25rem; color: var(--text-primary);">200+</h4>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Verified SPIT roadmaps &amp; sheets</p>
              </div>
            </div>
            <a href="/login" class="btn btn-secondary" style="display: inline-block; padding: 0.75rem 1.6rem; border-radius: 30px; font-weight: 600; text-decoration: none;">Explore Resources</a>
          </div>
        </div>
      </section>

      <!-- Section 3B: Placements & Partnerships -->
      <section style="padding: 6rem 1.5rem 0 1.5rem; background-color: #ffffff;">
        <div class="container" style="max-width: 1100px; margin: 0 auto;">
          <div class="placement-header-grid">
            <div style="text-align: left;">
              <span style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #8A2BE2; margin-bottom: 1rem; display: block;">Placements &amp; Partnerships</span>
              <h2 style="font-size: calc(1.8rem + 1vw); font-family: var(--font-serif); font-weight: 500; color: #111; margin-bottom: 2rem; line-height: 1.25;">Placements &amp; Partnerships</h2>
              <div class="sub-blocks-grid">
                <div>
                  <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.75rem; color: #111;">Placement Track Record</h3>
                  <p style="font-size: 0.95rem; color: #666; line-height: 1.6; margin: 0;">The Numbers Don't Lie. Get familiar with the SPIT standard. From a solid ₹15.14 LPA campus average to the elite ₹61.55 LPA peak packages, explore verified campus placement packages and see the exact targets you are aiming for.</p>
                </div>
                <div>
                  <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.75rem; color: #111;">Top Recruiters</h3>
                  <p style="font-size: 0.95rem; color: #666; line-height: 1.6; margin: 0;">The Tier-1 Roster. Microsoft, Morgan Stanley, Barclays, and more. See the exact tech giants and financial heavyweights that actively partner with SPIT to hunt for top-tier engineering talent.</p>
                </div>
              </div>
            </div>
            <div>
              <img src="/images/tpo-team-placement.jpg" alt="SPIT Training &amp; Placement Team" style="width: 100%; height: 340px; object-fit: cover; border-radius: 20px;" />
            </div>
          </div>

          <div style="display: flex; justify-content: center; margin-bottom: 2.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
            <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); padding: 0.6rem 1.2rem; position: relative;">
              Placement Performance
              <div style="position: absolute; bottom: -17px; left: 0; right: 0; height: 3px; background-color: #8A2BE2; border-radius: 2px;"></div>
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2.5rem; width: 100%; max-width: 1100px; margin: 0 auto; padding: 1.5rem 0; align-items: stretch; background-color: #ffffff;">
            <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
              <img src="/images/chart-placement-percentage.png" alt="Placement Statistics — Placement Percentage" style="width: 100%; max-width: 520px; height: auto; display: block;" />
            </div>
            <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
              <img src="/images/chart-average-ctc.png" alt="Placement Statistics — Average &amp; Median CTCs" style="width: 100%; max-width: 520px; height: auto; display: block;" />
            </div>
          </div>

          <div style="margin-top: 5rem; border-top: 1px solid var(--border-color); padding-top: 4rem; text-align: center;">
            <h3 style="font-size: 1.40rem; font-family: var(--font-serif); font-weight: 500; color: var(--text-primary); margin-bottom: 2.5rem; letter-spacing: 0.02em;">Our Prominent Recruiters &amp; Corporate Partners</h3>
            <div style="display: flex; justify-content: center; align-items: center; width: 100%; background-color: #ffffff;">
              <img src="/images/recruiters-partners.png" alt="Our Recruiters and Partners" style="max-width: 100%; height: auto; max-height: 520px; object-fit: contain;" />
            </div>
          </div>
        </div>
      </section>

      <!-- Section 2: Achievements (The Hall of Fame) -->
      <section id="achievements-section" class="achievements-section-bg">
        <div class="achievements-bg-image"></div>
        <div class="achievements-overlay"></div>
        <div class="container" style="position: relative; z-index: 2; display: flex; justify-content: flex-end; width: 100%; max-width: 1200px; margin: 0 auto; padding: 3rem 1.5rem;">
          <div style="width: 100%; max-width: 520px; color: #ffffff; text-align: left;">
            <span style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #c084fc; margin-bottom: 1rem; display: block;">Achievements &amp; Milestones</span>
            <h2 style="font-size: calc(2.2rem + 1vw); font-family: var(--font-serif); font-weight: 500; line-height: 1.25; color: #ffffff; letter-spacing: -0.01em; margin-bottom: 1.5rem;">The Hall of Fame</h2>
            <p style="font-size: 1.15rem; line-height: 1.75; color: rgba(255, 255, 255, 0.85); margin-bottom: 2rem;">We don't just participate; we dominate. Explore the ultimate track record of student achievements at SPIT. View the exact milestones set by the top 1% of the campus—and learn what it takes to leave your own mark.</p>
            <a href="/login" class="btn" style="padding: 0.85rem 2rem; border-radius: 30px; font-weight: 600; background-color: #ffffff; color: #000000; text-decoration: none; display: inline-block;">Explore Achievements</a>
          </div>
        </div>
      </section>

      <!-- Section 5: Contribute / Photo Stack -->
      <section style="padding: 8rem 1.5rem 10rem 1.5rem; background-color: var(--bg-primary);">
        <div class="container grid-2col" style="max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center;">
          <div>
            <span style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #8A2BE2; margin-bottom: 1rem; display: block;">CONTRIBUTE TO LOOP</span>
            <h2 style="font-size: calc(2rem + 1vw); font-family: var(--font-serif); font-weight: 500; line-height: 1.2; margin-bottom: 1.5rem; color: var(--text-primary);">Let's build together.</h2>
            <p style="font-size: 1.1rem; line-height: 1.7; color: var(--text-secondary); margin-bottom: 2.5rem;">Contribute to a continuous cycle of knowledge sharing. LOOP connects college juniors, seniors, and alumni: today's juniors become tomorrow's seniors, who then guide the next generation. We welcome seniors and alumni to document their placement journeys, interview rounds, and study resources.</p>
            <a href="/login" class="btn btn-secondary" style="padding: 0.9rem 2rem; border-radius: 30px; font-weight: 600; text-decoration: none; display: inline-block;">Share Your Journey</a>
          </div>
          <div style="position: relative; height: 350px; width: 100%; display: flex; justify-content: center; align-items: center;" class="photo-stack-container">
            <div class="stack-photo" style="position: absolute; left: 10%; width: 160px; height: 240px; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.4); transform: rotate(-4deg);"><img src="/images/file-1.jpg" alt="Students studying" style="width: 100%; height: 100%; object-fit: cover;" /></div>
            <div class="stack-photo" style="position: absolute; width: 180px; height: 260px; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.5); transform: rotate(2deg); z-index: 2;"><img src="/images/file-2.jpg" alt="Working at a table" style="width: 100%; height: 100%; object-fit: cover;" /></div>
            <div class="stack-photo" style="position: absolute; right: 10%; width: 160px; height: 240px; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.4); transform: rotate(-2deg);"><img src="/images/file-3.jpg" alt="Student presenting code" style="width: 100%; height: 100%; object-fit: cover;" /></div>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer style="border-top: 1px solid var(--border-color); padding: 3rem 1.5rem; background-color: var(--bg-secondary); text-align: center;">
        <div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">LOOP — Limitless Opportunities, One Platform</div>
          <div style="display: flex; gap: 1.5rem; font-size: 0.85rem;">
            <a href="/privacy-policy" style="color: var(--text-secondary); text-decoration: none;">Privacy Policy</a>
            <a href="/terms" style="color: var(--text-secondary); text-decoration: none;">Terms of Use</a>
            <a href="/login" style="color: var(--text-secondary); text-decoration: none;">Sign In</a>
          </div>
        </div>
      </footer>
    </main>
    `;
  }

  // Legal & documentation pages shell
  const renderedParagraphs = (page.paragraphs || [])
    .map(p => `<p style="font-size: 1.05rem; line-height: 1.7; color: var(--text-secondary); margin-bottom: 1.25rem;">${p}</p>`)
    .join('\n');

  return `
    <header class="navbar" style="background: var(--bg-surface); border-bottom: 1px solid var(--border-color); padding: 1.25rem 2rem; display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto;">
      <a href="/" style="display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: var(--text-primary); font-weight: 800; font-size: 1.35rem;">
        <img src="/loop-logo.png" alt="LOOP Logo" style="height: 26px; width: auto; filter: var(--logo-filter); margin-right: 0.2rem;" />
        <span>Loop</span>
        <span style="font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 6px; border: 1px solid var(--border-color); letter-spacing: 0.05em;">SPIT</span>
      </a>
      <nav style="display: flex; gap: 1.5rem; font-weight: 600; align-items: center;">
        <a href="/" style="color: var(--text-secondary); text-decoration: none; font-size: 0.9rem;">Home</a>
        <a href="/login" class="btn btn-primary" style="padding: 0.45rem 1.15rem; background-color: var(--text-primary); color: var(--accent-inverse); text-decoration: none; border-radius: 20px; font-size: 0.82rem; font-weight: 700;">Login</a>
      </nav>
    </header>
    <main style="max-width: 900px; margin: 3rem auto; padding: 0 1.5rem; font-family: var(--font-sans);">
      <h1 style="font-size: 2.3rem; font-weight: 800; line-height: 1.25; margin-bottom: 1.5rem; color: var(--text-primary);">${page.h1}</h1>
      <article>
        ${renderedParagraphs}
      </article>
      <div style="border-top: 1px solid var(--border-color); margin-top: 2.5rem; padding-top: 1.5rem;">
        <a href="/login" class="btn btn-primary" style="display: inline-block; padding: 0.9rem 2.2rem; background-color: var(--text-primary); color: var(--accent-inverse); text-decoration: none; border-radius: 30px; font-weight: 600; font-size: 1rem;">Login to Continue →</a>
      </div>
    </main>
    <footer style="border-top: 1px solid var(--border-color); padding: 3rem 1.5rem; background-color: var(--bg-secondary); text-align: center; margin-top: 4rem;">
      <div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">LOOP — Limitless Opportunities, One Platform</div>
        <div style="display: flex; gap: 1.5rem; font-size: 0.85rem;">
          <a href="/privacy-policy" style="color: var(--text-secondary); text-decoration: none;">Privacy Policy</a>
          <a href="/terms" style="color: var(--text-secondary); text-decoration: none;">Terms of Use</a>
          <a href="/login" style="color: var(--text-secondary); text-decoration: none;">Sign In</a>
        </div>
      </div>
    </footer>
  `;
}

function prerenderPage(page) {
  let html = templateHtml;
  const canonicalUrl = page.route === '/' ? `${BASE_URL}/` : `${BASE_URL}${page.route}`;

  // 1. Replace Title
  html = html.replace(/<title>.*?<\/title>/i, `<title>${page.title}</title>`);
  html = html.replace(/<meta name="title" content=".*?" \/>/i, `<meta name="title" content="${page.title}" />`);
  html = html.replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${page.title}" />`);
  html = html.replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${page.title}" />`);

  // 2. Replace Description
  html = html.replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${page.description}" />`);
  html = html.replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${page.description}" />`);
  html = html.replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${page.description}" />`);

  // 3. Set Canonical & URL
  html = html.replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${canonicalUrl}" />`);
  html = html.replace(/<meta name="twitter:url" content=".*?" \/>/i, `<meta name="twitter:url" content="${canonicalUrl}" />`);
  if (!html.includes('<link rel="canonical"')) {
    html = html.replace('</head>', `    <link rel="canonical" href="${canonicalUrl}" />\n  </head>`);
  } else {
    html = html.replace(/<link rel="canonical" href=".*?" \/>/i, `<link rel="canonical" href="${canonicalUrl}" />`);
  }

  // 4. Set Robots
  if (page.noIndex) {
    if (!html.includes('<meta name="robots"')) {
      html = html.replace('</head>', `    <meta name="robots" content="noindex, nofollow" />\n  </head>`);
    } else {
      html = html.replace(/<meta name="robots" content=".*?" \/>/i, `<meta name="robots" content="noindex, nofollow" />`);
    }
  } else {
    if (!html.includes('<meta name="robots"')) {
      html = html.replace('</head>', `    <meta name="robots" content="index, follow" />\n  </head>`);
    } else {
      html = html.replace(/<meta name="robots" content=".*?" \/>/i, `<meta name="robots" content="index, follow" />`);
    }
  }

  // 5. Inject Structured Data JSON-LD
  if (page.schema) {
    const schemaArray = Array.isArray(page.schema) ? page.schema : [page.schema];
    const jsonLd = schemaArray.map(s => `    <script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n    </script>`).join('\n');
    html = html.replace('</head>', `${jsonLd}\n  </head>`);
  }

  // 6. Pre-render clean semantic content inside #root
  const semanticShell = getRenderedShell(page);

  // Robust replacement of #root contents
  html = html.replace(/<div id="root">[\s\S]*?<\/div>(?=\s*(?:<script|<\/body>))/i, `<div id="root">${semanticShell}</div>`);

  // Target directory & files
  if (page.route === '/' || page.route === '') {
    fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html, 'utf8');
    // Also provide home.html as backwards compatible alias
    fs.writeFileSync(path.join(DIST_DIR, 'home.html'), html, 'utf8');
  } else {
    const targetDir = path.join(DIST_DIR, page.route);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(path.join(targetDir, 'index.html'), html, 'utf8');

    // Also emit cleanUrl HTML file (e.g. dist/stories.html)
    const cleanUrlFile = path.join(DIST_DIR, `${page.route}.html`);
    const cleanUrlDir = path.dirname(cleanUrlFile);
    if (!fs.existsSync(cleanUrlDir)) {
      fs.mkdirSync(cleanUrlDir, { recursive: true });
    }
    fs.writeFileSync(cleanUrlFile, html, 'utf8');
  }
}

console.log(`[PRERENDER_SEO] Generating static SEO HTML files for ${ALL_PAGES.length} routes...`);
for (const p of ALL_PAGES) {
  prerenderPage(p);
  console.log(`  ✓ Prerendered ${p.route} (${p.title})`);
}

// 3. Generate Clean, In-Sync Sitemap XML (No fake stories, no duplicates, no private pages)
const indexablePages = ALL_PAGES.filter(p => !p.noIndex);
const todayIso = new Date().toISOString().split('T')[0] + 'T00:00:00+00:00';

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexablePages.map(p => {
  const url = p.route === '/' ? `${BASE_URL}/` : `${BASE_URL}${p.route}`;
  return `  <url>
    <loc>${url}</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>${p.changefreq || 'weekly'}</changefreq>
    <priority>${p.priority || '0.6'}</priority>
  </url>`;
}).join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml, 'utf8');
if (fs.existsSync(PUBLIC_DIR)) {
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapXml, 'utf8');
}
console.log(`[PRERENDER_SEO] Generated sitemap.xml with ${indexablePages.length} valid, indexable canonical URLs.`);
console.log(`[PRERENDER_SEO] Prerendering complete!`);
