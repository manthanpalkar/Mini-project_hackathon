import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
const BASE_URL = 'https://loop-seven-delta.vercel.app';

if (!fs.existsSync(DIST_DIR)) {
  console.error('[PRERENDER_ERROR] dist directory not found. Please run vite build first.');
  process.exit(1);
}

const templatePath = path.join(DIST_DIR, 'index.html');
const templateHtml = fs.readFileSync(templatePath, 'utf8');

const PAGES = [
  {
    route: '/home',
    title: 'LOOP — Limitless Opportunities, One Platform | SPIT Mumbai',
    description: 'Their Journey. Your Opportunity. Explore verified interview debriefs, placement journeys, company package archives, and curated study materials from SPIT seniors.',
    h1: 'LOOP — Limitless Opportunities, One Platform',
    paragraphs: [
      'Welcome to LOOP (Limitless Opportunities, One Platform), the premier student placement and career preparation network at Sardar Patel Institute of Technology (SPIT), Mumbai. Built around the core principle "Their Journey. Your Opportunity.", LOOP connects college juniors, seniors, and alumni: today\'s juniors become tomorrow\'s seniors, who then guide the next generation.',
      'Our platform bridges the generational knowledge gap between graduating seniors and aspiring juniors. Here you will find extensive interview debriefs detailing technical rounds, system design questions, LeetCode problem patterns, core engineering concepts (DBMS, Operating Systems, Computer Networks), and human resource discussions for leading employers including Microsoft, Google, Amazon, Morgan Stanley, Deutsche Bank, and innovative startups.',
      'In addition to career journeys, LOOP hosts student-contributed study materials, handwritten formulas, subject syllabus notes, and past examination papers curated to accelerate academic excellence and technical readiness.'
    ],
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'LOOP — Limitless Opportunities, One Platform',
      url: 'https://loop-seven-delta.vercel.app/'
    }
  },
  {
    route: '/stories',
    title: 'Placement Stories & Interview Debriefs | LOOP SPIT',
    description: 'Browse verified campus placement experiences, interview questions, coding rounds, and preparation journeys from SPIT engineering seniors.',
    h1: 'Engineering Placement Stories & Senior Interview Debriefs',
    paragraphs: [
      'Explore an exhaustive repository of verified placement debriefs authored by seniors from Computer Engineering, Information Technology, Electronics & Telecommunication, and Artificial Intelligence & Data Science branches at Sardar Patel Institute of Technology.',
      'Each debrief offers a structured breakdown of the hiring pipeline, starting from initial online coding assessments, aptitude screenings, and problem statements to live technical interviews, managerial evaluations, and leadership principle behavioral rounds. Students share specific algorithmic topics, dynamic programming patterns, object-oriented design principles, and resume strategies that secured competitive internship and full-time offers.',
      'Filter placement debriefs by engineering discipline, graduating passout batch, recruiting company, or compensation package to discover targeted advice and prepare strategically for upcoming on-campus recruitment cycles.'
    ],
    schema: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Engineering Placement Stories & Interview Experiences',
      description: 'Verified student placement debriefs, technical interview rounds, and preparation strategies at SPIT Mumbai.',
      url: 'https://loop-seven-delta.vercel.app/stories'
    }
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
    schema: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'SPIT Academic Resources & Placement Preparation Materials',
      url: 'https://loop-seven-delta.vercel.app/resources'
    }
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
    schema: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'SPIT Student Achievements & Accolades',
      url: 'https://loop-seven-delta.vercel.app/achievements'
    }
  },
  {
    route: '/privacy-policy',
    title: 'Privacy Policy | LOOP SPIT',
    description: 'LOOP Privacy Policy. Learn how student records, placement debriefs, GridFS documents, and authentication credentials are secure at SPIT Mumbai.',
    h1: 'LOOP Privacy Policy & Data Security Governance',
    paragraphs: [
      'At LOOP, we place utmost importance on protecting the privacy, identity, and personal records of our students and contributors at Sardar Patel Institute of Technology (SPIT). This Privacy Policy explains our practices regarding data collection, encryption standards, authentication protocols, and document access control.',
      'We collect only the essential information necessary to maintain account security and facilitate educational resource sharing, including institutional email addresses, hashed authentication credentials, and user-submitted placement experiences. Confidential student contact details, personal telephone numbers, and private resumes remain strictly guarded behind role-based access control and are never exposed in public sitemaps, search engine metadata, or unauthorized endpoints.',
      'All uploaded binaries are managed within an enterprise-grade MongoDB Atlas GridFS cluster using encrypted streaming tokens. By using LOOP, you consent to the information practices described in this policy, which complies with prevailing data protection frameworks.'
    ]
  },
  {
    route: '/terms',
    title: 'Terms of Use | LOOP SPIT',
    description: 'Terms of Use for LOOP, the student placement debrief and academic preparation platform at Sardar Patel Institute of Technology (SPIT).',
    h1: 'LOOP Terms of Use & Academic Integrity Guidelines',
    paragraphs: [
      'These Terms of Use govern your access to and interaction with the LOOP knowledge platform. By accessing or submitting content to LOOP, you agree to abide by institutional guidelines of academic honesty, intellectual integrity, and respectful community participation.',
      'Contributors retain ownership of their placement stories and uploaded academic materials while granting LOOP a non-exclusive license to present and index them for campus educational benefit. Users agree not to distribute copyrighted commercial materials without authorization, post defamatory or misleading interview details, or attempt unauthorized circumvention of security access controls.',
      'LOOP administrators reserve the right to review, edit, or reject submitted placement debriefs and study resources to uphold factual accuracy and campus privacy standards.'
    ]
  },
  {
    route: '/login',
    title: 'Sign In | LOOP SPIT',
    description: 'Sign in to LOOP SPIT with your Sardar Patel Institute of Technology student account or official Google credentials to access full features.',
    h1: 'Sign In to LOOP — SPIT Campus Portal',
    paragraphs: [
      'Access verified senior placement stories, download academic revision notes, participate in peer discussions, and manage your student profile on LOOP SPIT.',
      'Please sign in using your official SPIT email address (@spit.ac.in) or Google Workspace single sign-on. Registered students receive full interactive access to resume downloads, document attachments, and contribution workflows.'
    ],
    noIndex: true
  },
  {
    route: '/forgot-password',
    title: 'Reset Password | LOOP SPIT',
    description: 'Recover and reset your account password for LOOP SPIT using your registered institutional email address and secure verification code.',
    h1: 'Reset Your LOOP Account Password',
    paragraphs: [
      'If you have forgotten your password or need to recover account access, enter your registered institutional email address to receive a secure 6-digit verification code.',
      'Verification codes are generated with time-limited validity to ensure security. Once verified, you will be prompted to choose a new strong password to regain access.'
    ],
    noIndex: true
  },
  {
    route: '/stories/aarav_sharma',
    title: 'Aarav Sharma — Microsoft SDE Debrief | LOOP SPIT',
    description: 'Read Aarav Sharma\'s verified Microsoft Software Engineer placement debrief. Covers DSA prep, online coding test, technical rounds, and SPIT journey.',
    h1: 'Aarav Sharma — Microsoft SDE Placement Debrief',
    paragraphs: [
      'Aarav Sharma, a Computer Engineering senior at SPIT Mumbai, shares his complete recruitment journey securing a Software Development Engineer role at Microsoft during the 2025 campus recruitment drive.',
      'The debrief details his 6-month preparation strategy focusing on LeetCode Medium/Hard algorithmic challenges, dynamic programming, tree traversals, and object-oriented low-level design. Aarav walks through each phase of Microsoft’s assessment pipeline, including the initial Codility online screening, two technical live-coding interviews exploring graph traversal and cache optimization, and the final hiring manager round emphasizing behavioral principles and past engineering projects.',
      'Key recommendations include practicing timed coding assessments, writing clean self-documenting code with comprehensive edge-case handling, and deeply understanding project trade-offs.'
    ],
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Aarav Sharma — Microsoft Software Engineer Placement Experience',
      author: { '@type': 'Person', name: 'Aarav Sharma' },
      publisher: { '@type': 'Organization', name: 'LOOP — Limitless Opportunities, One Platform' }
    }
  },
  {
    route: '/stories/priya_verma',
    title: 'Priya Verma — Amazon SDE-1 Debrief | LOOP SPIT',
    description: 'Read Priya Verma\'s verified Amazon SDE-1 placement debrief. Covers leadership principles, system design basics, coding rounds, and interview tips.',
    h1: 'Priya Verma — Amazon SDE-1 Placement Debrief',
    paragraphs: [
      'Priya Verma from the Information Technology department shares her comprehensive experience achieving an SDE-1 offer from Amazon during on-campus recruitment.',
      'Her debrief emphasizes a balanced preparation approach combining robust data structures practice with deep immersion in Amazon\'s 16 Leadership Principles. Priya explains how she formulated behavioral responses using the STAR methodology (Situation, Task, Action, Result) and tackled technical coding challenges involving sliding windows, heap data structures, and concurrency fundamentals.',
      'Her advice to pre-final year students focuses on starting algorithmic preparation early, completing mock peer interviews, and building scalable full-stack projects.'
    ],
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Priya Verma — Amazon SDE-1 Placement Experience',
      author: { '@type': 'Person', name: 'Priya Verma' },
      publisher: { '@type': 'Organization', name: 'LOOP — Limitless Opportunities, One Platform' }
    }
  },
  {
    route: '/stories/rohan_patil',
    title: 'Rohan Patil — Google SDE Debrief | LOOP SPIT',
    description: 'Read Rohan Patil\'s verified Google Software Engineer placement debrief. Covers graph algorithms, DP optimization, coding rounds, and mock interviews.',
    h1: 'Rohan Patil — Google Software Engineer Placement Debrief',
    paragraphs: [
      'Rohan Patil from the Computer Engineering department recounts his technical interview journey with Google for the Software Engineer position.',
      'Google’s recruitment process is renowned for its rigorous evaluation of algorithmic depth, problem-solving agility, and time complexity optimization. Rohan discusses the importance of competitive programming on Codeforces and LeetCode, mastering shortest-path algorithms, topological sorting, bit manipulation, and dynamic programming with bitmasks.',
      'The debrief provides invaluable insights into communicating thought processes out loud with Google interviewers, clarifying ambiguity before writing code, and systematically verifying solution correctness.'
    ],
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Rohan Patil — Google Software Engineer Placement Experience',
      author: { '@type': 'Person', name: 'Rohan Patil' },
      publisher: { '@type': 'Organization', name: 'LOOP — Limitless Opportunities, One Platform' }
    }
  }
];

function prerenderPage(page) {
  let html = templateHtml;
  const canonicalUrl = `${BASE_URL}${page.route}`;

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
    const jsonLd = `    <script type="application/ld+json">\n${JSON.stringify(page.schema, null, 2)}\n    </script>\n`;
    html = html.replace('</head>', `${jsonLd}  </head>`);
  }

  // 6. Pre-render comprehensive semantic content inside #root
  const renderedParagraphs = (page.paragraphs || [])
    .map(p => `<p style="font-size: 1.05rem; line-height: 1.7; color: #444; margin-bottom: 1.25rem;">${p}</p>`)
    .join('\n');

  const semanticShell = `
    <header style="padding: 1.5rem 2rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto;">
      <a href="/home" style="font-size: 1.25rem; font-weight: 800; text-decoration: none; color: inherit;">LOOP — Limitless Opportunities, One Platform</a>
      <nav style="display: flex; gap: 1.5rem; font-weight: 600; flex-wrap: wrap;">
        <a href="/home">Home</a>
        <a href="/stories">Stories</a>
        <a href="/resources">Resources</a>
        <a href="/achievements">Achievements</a>
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
        <h2 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.75rem;">Explore LOOP Placement Knowledge Base:</h2>
        <ul style="line-height: 2;">
          <li><a href="/stories">Browse Engineering Placement Stories &amp; Debriefs</a></li>
          <li><a href="/resources">Access Curated Semester Study Materials</a></li>
          <li><a href="/achievements">View SPIT Student Accolades &amp; Milestones</a></li>
          <li><a href="/stories/aarav_sharma">Microsoft Placement Interview Experience (Aarav Sharma)</a></li>
          <li><a href="/stories/priya_verma">Amazon SDE Placement Interview Debrief (Priya Verma)</a></li>
          <li><a href="/stories/rohan_patil">Google SDE Placement Interview Debrief (Rohan Patil)</a></li>
          <li><a href="/login">Student Account Login &amp; Portal Access</a></li>
        </ul>
      </div>
    </main>
  `;

  // Replace content inside #root
  html = html.replace(/<div id="root">[\s\S]*?<\/div>\s*<script/i, `<div id="root">${semanticShell}</div>\n    <script`);

  // Target directory
  const targetDir = path.join(DIST_DIR, page.route);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.writeFileSync(path.join(targetDir, 'index.html'), html, 'utf8');

  // Also emit cleanUrl HTML file (e.g. dist/stories.html)
  if (page.route !== '/' && page.route !== '') {
    const cleanUrlFile = path.join(DIST_DIR, `${page.route}.html`);
    const cleanUrlDir = path.dirname(cleanUrlFile);
    if (!fs.existsSync(cleanUrlDir)) {
      fs.mkdirSync(cleanUrlDir, { recursive: true });
    }
    fs.writeFileSync(cleanUrlFile, html, 'utf8');
  }
}

console.log(`[PRERENDER_SEO] Generating static SEO HTML files for ${PAGES.length} routes...`);
for (const p of PAGES) {
  prerenderPage(p);
  console.log(`  ✓ Prerendered ${p.route}/index.html (${p.title})`);
}
console.log(`[PRERENDER_SEO] Prerendering complete!`);
