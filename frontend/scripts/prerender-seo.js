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
    title: 'LOOP — SPIT Placement Experiences & Interview Preparation Portal',
    description: 'Explore authentic SPIT Mumbai placement experiences, round-by-round interview debriefs, and career preparation resources shared by students and alumni on LOOP.',
    h1: 'SPIT Placement Experiences & Interview Preparation Portal',
    paragraphs: [
      'Welcome to LOOP (Limitless Opportunities, One Platform), the independent student-led placement portal and career-preparation platform for Sardar Patel Institute of Technology (SPIT), Mumbai. Built around the guiding ethos "Their Journey. Your Opportunity.", LOOP connects college juniors, seniors, and alumni to document verified recruitment experiences and foster peer mentorship across engineering disciplines.',
      'LOOP hosts structured, round-by-round placement interview debriefs covering every stage of campus recruitment—from initial resume shortlisting and online assessments (OA) to live technical evaluations, algorithmic coding challenges, system design rounds, and behavioral HR interviews across top technology and financial services employers.',
      'Each debrief captures authentic placement preparation strategies, recommended algorithmic problem sets, core computer science revision topics (DBMS, Operating Systems, Computer Networks, OOP), and candid advice from seniors on navigating recruitment hurdles.',
      'Students can explore interview experiences filtered by company, engineering branch (CSE, CSE-DS, CSE-AIML, CE, EXTC), and graduation year, or access curated semester study materials, formula sheets, and past question papers in the academic resources repository.'
    ],
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'LOOP — Limitless Opportunities, One Platform',
      alternateName: [
        'LOOP',
        'LOOP SPIT',
        'LOOP SPIT Mumbai',
        'LOOP Placement Portal',
        'SPIT Placement Portal'
      ],
      url: `${BASE_URL}/`,
      description: 'Independent student-led placement intelligence and career-preparation portal for Sardar Patel Institute of Technology (SPIT), Mumbai.',
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
    route: '/stories',
    title: 'Placement Stories & Interview Debriefs | LOOP SPIT',
    description: 'Browse verified campus placement experiences, interview questions, coding rounds, and preparation journeys from SPIT engineering seniors.',
    h1: 'Engineering Placement Stories & Senior Interview Debriefs',
    paragraphs: [
      'Explore verified placement debriefs authored by seniors from Computer Engineering, Information Technology, Electronics & Telecommunication, and Artificial Intelligence & Data Science branches at Sardar Patel Institute of Technology.',
      'Each debrief offers a structured breakdown of the hiring pipeline, starting from initial online coding assessments, aptitude screenings, and problem statements to live technical interviews, managerial evaluations, and leadership principle behavioral rounds. Students share specific algorithmic topics, dynamic programming patterns, object-oriented design principles, and resume strategies that secured competitive internship and full-time offers.',
      'Filter placement debriefs by engineering discipline, graduating passout batch, recruiting company, or compensation package to discover targeted advice and prepare strategically for upcoming recruitment cycles.'
    ],
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Engineering Placement Stories & Interview Experiences',
        description: 'Verified student placement debriefs, technical interview rounds, and preparation strategies at SPIT Mumbai.',
        url: `${BASE_URL}/stories`
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Placement Stories', item: `${BASE_URL}/stories` }
        ]
      }
    ],
    priority: '0.9',
    changefreq: 'daily'
  },
  {
    route: '/resources',
    title: 'Academic Notes & Placement Materials | LOOP SPIT',
    description: 'Access curated semester notes, syllabus materials, handwritten cheat sheets, and technical interview roadmaps from SPIT seniors.',
    h1: 'Curated Academic Notes & Technical Preparation Repository',
    paragraphs: [
      'The LOOP Resource Repository centralizes semester-wise lecture notes, laboratory guides, previous years question papers, and essential interview revision cheat sheets for engineering undergraduates at SPIT Mumbai.',
      'Organized in logical department and subject hierarchies, resources cover critical foundation topics such as Data Structures and Algorithms, Database Management Systems, Computer Networks, Operating Systems, Theory of Computation, and Machine Learning. All files are securely archived in high-speed MongoDB Atlas GridFS storage, providing rapid parallel streaming and seamless in-browser previewing.',
      'Whether you are preparing for semester midterms, end-semester university examinations, or corporate coding assessments, explore senior-vetted study notes and contribute your own academic materials to empower the campus community.'
    ],
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'SPIT Academic Resources & Placement Preparation Materials',
        url: `${BASE_URL}/resources`
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Resources', item: `${BASE_URL}/resources` }
        ]
      }
    ],
    priority: '0.8',
    changefreq: 'weekly'
  },
  {
    route: '/achievements',
    title: 'Student Achievements & Campus Accolades | LOOP SPIT',
    description: 'Discover hackathon victories, placement milestones, technical publications, and student leadership accomplishments from SPIT Mumbai.',
    h1: 'SPIT Student Achievements & Campus Accolades',
    paragraphs: [
      'Celebrating exceptional student accomplishment, competitive programming victories, international hackathon awards, and research publications across Sardar Patel Institute of Technology.',
      'From securing top podium finishes at Smart India Hackathon and global open-source fellowships to publishing peer-reviewed papers in IEEE conferences, our students continually raise the bar of technological innovation and academic excellence. LOOP showcases these milestones to celebrate peer success and inspire junior batches to pursue ambitious engineering goals.',
      'Stay informed on high-package placement breakthroughs, prestigious off-campus offers, and outstanding extracurricular milestones that define the vibrant intellectual spirit of our campus community.'
    ],
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'SPIT Student Achievements & Accolades',
        url: `${BASE_URL}/achievements`
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Achievements', item: `${BASE_URL}/achievements` }
        ]
      }
    ],
    priority: '0.7',
    changefreq: 'weekly'
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

  const roleDisplay = cleanRole ? `${cleanCompany} — ${cleanRole}` : cleanCompany;
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
  } catch (err) {
    console.log('[PRERENDER_SEO] Using default section visibility (OFF):', sectionVisibility);
  }
}

const filteredCorePages = CORE_PAGES.filter(p => {
  if (p.route === '/stories' && !sectionVisibility.stories) return false;
  if (p.route === '/resources' && !sectionVisibility.resources) return false;
  if (p.route === '/achievements' && !sectionVisibility.achievements) return false;
  return true;
});

const activeStoryPages = sectionVisibility.stories ? REAL_STORY_PAGES : [];

const ALL_PAGES = [...filteredCorePages, ...activeStoryPages];

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
  const renderedParagraphs = (page.paragraphs || [])
    .map(p => `<p style="font-size: 1.05rem; line-height: 1.7; color: #444; margin-bottom: 1.25rem;">${p}</p>`)
    .join('\n');

  const semanticShell = `
    <header style="padding: 1.5rem 2rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto;">
      <a href="/" style="font-size: 1.25rem; font-weight: 800; text-decoration: none; color: inherit;">LOOP — Limitless Opportunities, One Platform</a>
      <nav style="display: flex; gap: 1.5rem; font-weight: 600; flex-wrap: wrap;">
        <a href="/">Home</a>
        ${sectionVisibility.stories ? '<a href="/stories">Stories</a>' : ''}
        ${sectionVisibility.resources ? '<a href="/resources">Resources</a>' : ''}
        ${sectionVisibility.achievements ? '<a href="/achievements">Achievements</a>' : ''}
        <a href="/privacy-policy">Privacy Policy</a>
        <a href="/terms">Terms</a>
        <a href="/login">Sign In</a>
      </nav>
    </header>
    <main style="max-width: 900px; margin: 3rem auto; padding: 0 1.5rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <h1 style="font-size: 2.3rem; font-weight: 800; line-height: 1.25; margin-bottom: 1.5rem; color: #111;">${page.h1}</h1>
      <article>
        ${renderedParagraphs}
      </article>
      <div style="border-top: 1px solid #e5e5e5; margin-top: 2.5rem; padding-top: 1.5rem;">
        <h2 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.75rem;">Explore Placement Knowledge Base:</h2>
        <ul style="line-height: 2;">
          ${sectionVisibility.stories ? '<li><a href="/stories">Browse Engineering Placement Stories &amp; Debriefs</a></li>' : ''}
          ${sectionVisibility.resources ? '<li><a href="/resources">Access Curated Semester Study Materials</a></li>' : ''}
          ${sectionVisibility.achievements ? '<li><a href="/achievements">View SPIT Student Accolades &amp; Milestones</a></li>' : ''}
          ${sectionVisibility.stories ? '<li><a href="/stories/story_2026_21664150">Barclays Summer Intern Placement Experience (CSE-DS)</a></li>' : ''}
          ${sectionVisibility.stories ? '<li><a href="/stories/story_2026_35118136">J.P. Morgan CIB Analytics Placement Experience (CSE-AIML)</a></li>' : ''}
          ${sectionVisibility.stories ? '<li><a href="/stories/story_2026_28159237">ISS STOXX SDE Placement Experience (CE)</a></li>' : ''}
          <li><a href="/login">Student Account Login &amp; Portal Access</a></li>
        </ul>
      </div>
    </main>
  `;

  // Robust replacement of #root contents
  html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${semanticShell}</div>`);

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
