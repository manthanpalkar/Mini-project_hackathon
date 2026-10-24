import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import BRAND from '../constants/branding';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Lock, 
  FileText, 
  Database, 
  Sparkles, 
  GraduationCap, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  HardDrive, 
  Key, 
  UserCheck, 
  AlertCircle, 
  ExternalLink, 
  Clock, 
  Building2 
} from 'lucide-react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('intro');
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  // Sections configuration
  const sections = [
    { id: 'intro', num: '01', title: 'Introduction' },
    { id: 'info-collect', num: '02', title: 'Information We Collect' },
    { id: 'info-provide', num: '03', title: 'Information You Provide' },
    { id: 'account-auth', num: '04', title: 'Account and Authentication Information' },
    { id: 'files-resources', num: '05', title: 'Files and Resources' },
    { id: 'placement-stories', num: '06', title: 'Placement Stories' },
    { id: 'use-info', num: '07', title: 'How We Use Information' },
    { id: 'store-info', num: '08', title: 'How We Store Information' },
    { id: 'storage-downloads', num: '09', title: 'File Storage and Downloads' },
    { id: 'cookies-local', num: '10', title: 'Cookies and Local Storage' },
    { id: 'third-party', num: '11', title: 'Third-Party Services' },
    { id: 'security', num: '12', title: 'Data Security' },
    { id: 'retention', num: '13', title: 'Data Retention' },
    { id: 'user-rights', num: '14', title: 'User Rights' },
    { id: 'children-privacy', num: '15', title: "Children's Privacy" },
    { id: 'changes', num: '16', title: 'Changes to This Privacy Policy' },
    { id: 'contact', num: '17', title: 'Contact Us' }
  ];

  // Scrollspy to update active TOC section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140;

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id);
        if (el) {
          const top = el.offsetTop;
          if (scrollPosition >= top) {
            setActiveSection(sections[i].id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    setActiveSection(id);
    setMobileTocOpen(false);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      paddingBottom: '5rem',
      animation: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <SEOHead 
        title={`Privacy Policy | ${BRAND.fullName}`}
        description={`${BRAND.tagline} LOOP Privacy Policy. Learn how student records, placement debriefs, and authentication credentials are secure at SPIT Mumbai.`}
        canonicalUrl="/privacy-policy"
        ogType="website"
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Privacy Policy', url: '/privacy-policy' }
        ]}
      />
      {/* Top Banner Navigation & Breadcrumbs */}
      <div style={{
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface)',
        padding: '1.25rem 0'
      }}>
        <div className="container" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {/* Breadcrumb & Back Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigate(-1)}
              className="btn btn-secondary"
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '12px',
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                border: '1px solid var(--border-color)'
              }}
              title="Return to previous page"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>

            <nav aria-label="Breadcrumb" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <Link to="/home" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                Home
              </Link>
              <span style={{ margin: '0 0.5rem', opacity: 0.5 }}>/</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Privacy Policy</span>
            </nav>
          </div>

          {/* Institutional Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '9999px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            fontSize: '0.76rem',
            fontWeight: 600,
            color: 'var(--text-secondary)'
          }}>
            <Building2 size={13} style={{ color: 'var(--text-primary)' }} />
            <span>Sardar Patel Institute of Technology</span>
          </div>
        </div>
      </div>

      {/* Hero Header */}
      <header style={{
        padding: '3.5rem 0 2.5rem',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-primary)'
      }}>
        <div className="container" style={{ maxWidth: '1100px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.3rem 0.75rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(52, 199, 89, 0.1)',
            border: '1px solid rgba(52, 199, 89, 0.25)',
            color: '#34c759',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '1.25rem'
          }}>
            <ShieldCheck size={14} />
            <span>Official Policy Documentation</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2.2rem, 4vw, 3.25rem)',
            fontWeight: 800,
            letterSpacing: '-0.035em',
            lineHeight: 1.15,
            marginBottom: '1rem',
            color: 'var(--text-primary)'
          }}>
            Privacy Policy
          </h1>

          <p style={{
            fontSize: '1.12rem',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            maxWidth: '780px',
            marginBottom: '1.75rem'
          }}>
            This Privacy Policy describes how LOOP collects, handles, stores, and protects user information across our student mentorship, placement preparation, and academic resource platform at Sardar Patel Institute of Technology.
          </p>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={15} />
              <span>Last Updated: <strong>October 5, 2026</strong></span>
            </div>
            <span style={{ opacity: 0.3 }}>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={15} />
              <span>17 Sections</span>
            </div>
            <span style={{ opacity: 0.3 }}>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <GraduationCap size={15} />
              <span>Educational & Non-Commercial</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="container" style={{
        maxWidth: '1100px',
        paddingTop: '2.5rem',
        display: 'flex',
        gap: '3.5rem',
        alignItems: 'flex-start'
      }}>
        {/* DESKTOP STICKY TABLE OF CONTENTS */}
        <aside 
          className="desktop-toc-sidebar"
          style={{
            width: '280px',
            flexShrink: 0,
            position: 'sticky',
            top: '90px',
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
            paddingRight: '0.5rem',
            display: 'block'
          }}
        >
          <div style={{
            padding: '1.25rem',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--card-shadow)'
          }}>
            <div style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Table of Contents</span>
              <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>17 Sections</span>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {sections.map(section => {
                const isSelected = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    style={{
                      textAlign: 'left',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      lineHeight: 1.35,
                      border: 'none',
                      backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      transition: 'all 0.18s ease'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <span style={{ 
                      fontSize: '0.7rem', 
                      fontFamily: 'var(--font-mono)', 
                      opacity: isSelected ? 1 : 0.5,
                      color: isSelected ? 'var(--accent-color)' : 'inherit'
                    }}>
                      {section.num}
                    </span>
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {section.title}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* DOCUMENT BODY */}
        <article style={{ flex: 1, minWidth: 0, maxWidth: '780px' }}>
          
          {/* MOBILE COLLAPSIBLE TABLE OF CONTENTS */}
          <div className="mobile-toc-container" style={{ display: 'none', marginBottom: '2rem' }}>
            <div style={{
              borderRadius: '16px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden'
            }}>
              <button
                onClick={() => setMobileTocOpen(!mobileTocOpen)}
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={16} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Table of Contents (17 Sections)</span>
                </div>
                {mobileTocOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {mobileTocOpen && (
                <div style={{
                  padding: '0.5rem 1rem 1.25rem',
                  borderTop: '1px solid var(--border-color)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.35rem'
                }}>
                  {sections.map(section => (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      style={{
                        padding: '0.45rem 0.65rem',
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        background: activeSection === section.id ? 'var(--bg-tertiary)' : 'transparent',
                        color: activeSection === section.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: activeSection === section.id ? 700 : 500,
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      {section.num}. {section.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 1: Introduction */}
          <section id="intro" className="policy-section">
            <div className="section-badge">01</div>
            <h2>1. Introduction</h2>
            <p>
              Welcome to <strong>LOOP</strong> (Limitless Opportunities, One Platform), an academic, peer-mentoring, and career preparation platform designed exclusively for students, senior cohorts, and alumni of <strong>Sardar Patel Institute of Technology (SPIT)</strong>, Mumbai.
            </p>
            <p>
              LOOP was built to bridge the guidance gap between graduating seniors and aspiring undergraduates. By hosting genuine interview breakdowns, company-specific preparation playbooks, curated department resources, and academic notes, LOOP fosters a collaborative, non-commercial environment for collegiate excellence.
            </p>
            <p>
              Your privacy and the security of your academic submissions are central to our philosophy. This Privacy Policy outlines what data we handle, how your information is safeguarded, and your rights when interacting with LOOP.
            </p>
            
            <div className="callout-card">
              <GraduationCap className="callout-icon" />
              <div>
                <strong>Academic Focus & Transparency</strong>
                <p>
                  LOOP is an institutional student-support initiative. We never sell, rent, commercialize, or broker your personal information or submitted study materials to third-party advertisers.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Information We Collect */}
          <section id="info-collect" className="policy-section">
            <div className="section-badge">02</div>
            <h2>2. Information We Collect</h2>
            <p>
              To provide a seamless, authenticated, and relevant platform experience, LOOP collects data categorized into two main streams:
            </p>
            <ul className="bullet-list">
              <li>
                <strong>Directly Provided Data:</strong> Personal profile fields (name, branch, graduation year, avatar), submitted placement interview experiences, shared study files, and account credentials.
              </li>
              <li>
                <strong>Platform Usage & Device Metrics:</strong> Technical details necessary for session persistence, authentication headers, error logging, and upload transfer verification.
              </li>
            </ul>
            <p>
              We adhere strictly to data minimization: only information directly required to organize study resources, authenticate student identity, and showcase verified placement guidance is collected.
            </p>
          </section>

          {/* Section 3: Information You Provide */}
          <section id="info-provide" className="policy-section">
            <div className="section-badge">03</div>
            <h2>3. Information You Provide</h2>
            <p>
              When you interact with various features of LOOP, you may voluntarily submit the following details:
            </p>
            <ul className="bullet-list">
              <li>
                <strong>Profile Details:</strong> Full name, academic branch (e.g., Computer Engineering, Computer Science & Engineering, Electronics & Telecommunication), graduating batch year, and optional UI preference customizations such as your profile badge accent color.
              </li>
              <li>
                <strong>Placement Guidance Submissions:</strong> Company names, job roles, selection status, detailed round-by-round interview questions, preparation tips, compensation tier brackets, and helpful study URLs.
              </li>
              <li>
                <strong>Uploaded Course Materials:</strong> Notes, past examination question papers, cheatsheets, project references, and related academic files.
              </li>
              <li>
                <strong>Resumes & Portfolios:</strong> Optional PDF resume files attached to your senior interview story to provide juniors with formatting references.
              </li>
            </ul>
          </section>

          {/* Section 4: Account and Authentication Information */}
          <section id="account-auth" className="policy-section">
            <div className="section-badge">04</div>
            <h2>4. Account and Authentication Information</h2>
            <p>
              Access to protected features of LOOP (such as reading detailed placement journeys, accessing internal folders, and submitting content) requires an authenticated account.
            </p>
            <ul className="bullet-list">
              <li>
                <strong>Institutional Credentials:</strong> Accounts are identified by your email address (typically your official <code>@spit.ac.in</code> institutional account) and a securely salted password.
              </li>
              <li>
                <strong>Cryptographic Password Protection:</strong> Passwords are never stored in plaintext. They are hashed using industry-standard <code>bcrypt</code> key-derivation algorithms with salt rounds before being written to our database.
              </li>
              <li>
                <strong>Session Tokens:</strong> Upon authentication, our backend issues a cryptographically signed JSON Web Token (JWT) that encodes your identity and authorization role (Student, Senior, or Administrator).
              </li>
            </ul>
          </section>

          {/* Section 5: Files and Resources */}
          <section id="files-resources" className="policy-section">
            <div className="section-badge">05</div>
            <h2>5. Files and Resources</h2>
            <p>
              LOOP hosts study materials, lecture summaries, and placement question banks categorized into structured folders by engineering branch and semester.
            </p>
            <p>
              When a file is uploaded to LOOP, our systems record relevant file metadata including the original filename, file size in bytes, MIME content type (such as <code>application/pdf</code>), upload timestamp, the contributing user's name/email, and the target folder identifier.
            </p>
            <div className="callout-card">
              <HardDrive className="callout-icon" />
              <div>
                <strong>File Integrity & Format Restrictions</strong>
                <p>
                  To ensure a secure environment for students, all uploads are validated on the backend. Only safe document formats, study archives, and academic files are accepted. Executables and unauthorized binaries are rejected.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6: Placement Stories */}
          <section id="placement-stories" className="policy-section">
            <div className="section-badge">06</div>
            <h2>6. Placement Stories</h2>
            <p>
              Senior placement stories constitute one of LOOP's most valued resources. When you submit an experience:
            </p>
            <ul className="bullet-list">
              <li>
                <strong>Moderation Queue:</strong> To prevent spam, misinformation, or inadvertent leaks of confidential test passwords, submissions are placed into an administrative review queue before publication.
              </li>
              <li>
                <strong>Public Display within SPIT:</strong> Once approved, placement stories become visible to verified LOOP users within the SPIT community to assist their recruitment preparation.
              </li>
              <li>
                <strong>Edit & Deletion Requests:</strong> Authors may submit requests to update, redact specific sections, or unpublish their placement stories at any time via the profile and dashboard interface.
              </li>
            </ul>
          </section>

          {/* Section 7: How We Use Information */}
          <section id="use-info" className="policy-section">
            <div className="section-badge">07</div>
            <h2>7. How We Use Information</h2>
            <p>
              Information collected by LOOP is strictly utilized for the following academic and platform purposes:
            </p>
            <ul className="bullet-list">
              <li>
                <strong>Facilitating Peer Mentorship:</strong> Allowing junior students to search, filter, and learn from seniors who secured offers at target organizations.
              </li>
              <li>
                <strong>Resource Organization:</strong> Organizing uploaded study guides and reference materials into an intuitive diagrammatic folder explorer.
              </li>
              <li>
                <strong>Account Administration:</strong> Authenticating user logins, enforcing role-based permissions, and managing content review workflows.
              </li>
              <li>
                <strong>Platform Reliability:</strong> Diagnosing performance bottlenecks, tracking upload session completion, and ensuring high system availability.
              </li>
            </ul>
          </section>

          {/* Section 8: How We Store Information */}
          <section id="store-info" className="policy-section">
            <div className="section-badge">08</div>
            <h2>8. How We Store Information</h2>
            <p>
              LOOP operates modern database infrastructure configured with strict security baselines:
            </p>
            <ul className="bullet-list">
              <li>
                <strong>Database Hosting:</strong> Primary data records are maintained in isolated MongoDB Atlas clusters protected by network firewalls, IP access controls, and encrypted storage-at-rest.
              </li>
              <li>
                <strong>Transport Encryption:</strong> All communications between your browser, our Vercel web frontend, and our Render API backend occur exclusively over encrypted Transport Layer Security (TLS 1.3 / HTTPS).
              </li>
              <li>
                <strong>Access Isolation:</strong> Access to production database credentials is strictly restricted to designated SPIT faculty administrators and verified student platform maintainers.
              </li>
            </ul>
          </section>

          {/* Section 9: File Storage and Downloads */}
          <section id="storage-downloads" className="policy-section">
            <div className="section-badge">09</div>
            <h2>9. File Storage and Downloads</h2>
            <p>
              Uploaded academic resources and placement story attachments are processed using a resilient streaming architecture:
            </p>
            <p>
              Files uploaded to the platform are validated, stored in secure asset directories, and streamed directly to authenticated students requesting previews or offline downloads. Temporary chunk buffers used during large-file upload streaming are automatically cleaned up upon session finalization or cancellation.
            </p>
            <p>
              Downloads are restricted to authorized, logged-in platform users to preserve the integrity of proprietary student notes and preparation compilations.
            </p>
          </section>

          {/* Section 10: Cookies and Local Storage */}
          <section id="cookies-local" className="policy-section">
            <div className="section-badge">10</div>
            <h2>10. Cookies and Local Storage</h2>
            <p>
              LOOP deliberately minimizes client-side data persistence and does not employ commercial advertising or behavioral tracking cookies.
            </p>
            <ul className="bullet-list">
              <li>
                <strong>Browser <code>localStorage</code>:</strong> We store a minimal session JSON object (<code>loop_current_user</code>) containing your active authentication JWT, email, name, branch, and role. This maintains your logged-in state across browser reloads.
              </li>
              <li>
                <strong>Browser <code>sessionStorage</code>:</strong> Used temporarily to remember your intended page destination when navigating back from authentication screens.
              </li>
              <li>
                <strong>Session Clearing:</strong> Clicking <strong>Exit</strong> from the navigation bar instantly purges the local session token, rendering future authenticated requests invalid until you log in again.
              </li>
            </ul>
          </section>

          {/* Section 11: Third-Party Services */}
          <section id="third-party" className="policy-section">
            <div className="section-badge">11</div>
            <h2>11. Third-Party Services</h2>
            <p>
              To maintain reliable web hosting, database clustering, and deployment pipelines, LOOP utilizes trusted cloud infrastructure providers:
            </p>
            <ul className="bullet-list">
              <li><strong>Vercel Inc.:</strong> Hosting and edge delivery of the frontend client application.</li>
              <li><strong>Render Services Inc.:</strong> Production hosting of the authenticated REST API backend server.</li>
              <li><strong>MongoDB Atlas:</strong> Managed database cluster with enterprise-grade data encryption.</li>
              <li><strong>Google Fonts:</strong> Static typography assets loaded for clean, readable editorial fonts.</li>
            </ul>
            <p>
              Each infrastructure partner operates under compliant confidentiality standards. We do not integrate third-party analytics trackers, social network sharing beacons, or ad networks.
            </p>
          </section>

          {/* Section 12: Data Security */}
          <section id="security" className="policy-section">
            <div className="section-badge">12</div>
            <h2>12. Data Security</h2>
            <p>
              We implement comprehensive defense-in-depth measures to protect your submissions from unauthorized access, alteration, or disclosure:
            </p>
            <div className="callout-card">
              <Lock className="callout-icon" />
              <div>
                <strong>Security Protections in Place</strong>
                <ul className="bullet-list" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                  <li>Cryptographic password hashing using salted bcrypt algorithms.</li>
                  <li>Tamper-proof JSON Web Token signature verification for all protected API routes.</li>
                  <li>Strict input sanitization to eliminate NoSQL injection and Cross-Site Scripting (XSS).</li>
                  <li>Rate-limiting on sensitive endpoints to protect against brute-force attacks.</li>
                </ul>
              </div>
            </div>
            <p>
              While no networked system can guarantee 100% absolute invulnerability, our architecture adheres to modern web engineering security standards.
            </p>
          </section>

          {/* Section 13: Data Retention */}
          <section id="retention" className="policy-section">
            <div className="section-badge">13</div>
            <h2>13. Data Retention</h2>
            <p>
              Because placement guidance and subject reference materials provide ongoing educational value across multiple academic years, approved stories and resources remain available on the platform throughout relevant graduation cycles.
            </p>
            <p>
              Users may at any time request the removal, anonymization, or redaction of their personal placement story or uploaded documents. When an account is terminated by administrative action, associated private folders and draft submissions are permanently deleted.
            </p>
          </section>

          {/* Section 14: User Rights */}
          <section id="user-rights" className="policy-section">
            <div className="section-badge">14</div>
            <h2>14. User Rights</h2>
            <p>
              As a contributing student or alumnus on LOOP, you maintain full control over your submitted identity:
            </p>
            <ul className="bullet-list">
              <li><strong>Right of Access:</strong> You can review your profile information, submitted stories, and upload history at any time.</li>
              <li><strong>Right to Rectification:</strong> You may update your profile details (branch, batch year, name badge styling) or submit story edit requests directly from the user dashboard.</li>
              <li><strong>Right to Erasure:</strong> You can request the complete deletion of your account and uploaded materials.</li>
              <li><strong>Right to Object:</strong> You can choose whether to attach a resume or personal contact links to your placement submissions.</li>
            </ul>
          </section>

          {/* Section 15: Children's Privacy */}
          <section id="children-privacy" className="policy-section">
            <div className="section-badge">15</div>
            <h2>15. Children's Privacy</h2>
            <p>
              LOOP is designed and operated exclusively for collegiate students, engineering candidates, faculty, and alumni of Sardar Patel Institute of Technology. The platform is not directed to, nor does it knowingly collect personal data from, children under the age of 18. If we discover an account registered by an ineligible minor, it will be promptly removed.
            </p>
          </section>

          {/* Section 16: Changes to This Privacy Policy */}
          <section id="changes" className="policy-section">
            <div className="section-badge">16</div>
            <h2>16. Changes to This Privacy Policy</h2>
            <p>
              As LOOP expands with new features—such as enhanced interview practice modules, folder collaborations, or institutional updates—this policy may be revised periodically.
            </p>
            <p>
              The <strong>Last Updated</strong> date at the top of this document indicates when changes were published. Continued access or use of LOOP after updates are posted indicates your acceptance of the revised terms.
            </p>
          </section>

          {/* Section 17: Contact Us */}
          <section id="contact" className="policy-section">
            <div className="section-badge">17</div>
            <h2>17. Contact Us</h2>
            <p>
              If you have any questions, clarifications, privacy inquiries, or data requests regarding this Privacy Policy, please reach out to our team:
            </p>
            
            <div style={{
              marginTop: '1.5rem',
              padding: '1.75rem',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--card-shadow)'
            }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                LOOP — Limitless Opportunities, One Platform Administration
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Department of Computer Engineering & Placement Cell<br />
                Sardar Patel Institute of Technology, Bhavan's Campus, Munshi Nagar, Andheri (West), Mumbai 400058, Maharashtra, India.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                <div>Email: <a href="mailto:admin@spit.ac.in" style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'underline' }}>admin@spit.ac.in</a></div>
                <span style={{ opacity: 0.3 }}>•</span>
                <div>Institution: <a href="https://www.spit.ac.in/" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'underline' }}>spit.ac.in</a></div>
              </div>
            </div>
          </section>

        </article>
      </div>

      {/* Embedded Modern Editorial Styles */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .policy-section {
          position: relative;
          padding-top: 2rem;
          margin-bottom: 3.5rem;
          border-top: 1px solid var(--border-color);
          scroll-margin-top: 100px;
        }

        .policy-section:first-of-type {
          border-top: none;
          padding-top: 0;
        }

        .section-badge {
          display: inline-block;
          font-family: monospace;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-secondary);
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          padding: 2px 8px;
          border-radius: 6px;
          margin-bottom: 0.75rem;
        }

        .policy-section h2 {
          font-size: 1.65rem;
          font-weight: 800;
          letter-spacing: -0.025em;
          margin-bottom: 1.15rem;
          color: var(--text-primary);
          line-height: 1.25;
        }

        .policy-section p {
          font-size: 1.02rem;
          line-height: 1.72;
          color: var(--text-secondary);
          margin-bottom: 1.25rem;
        }

        .policy-section strong {
          color: var(--text-primary);
        }

        .bullet-list {
          list-style: none;
          padding: 0;
          margin: 1rem 0 1.5rem 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .bullet-list li {
          position: relative;
          padding-left: 1.5rem;
          font-size: 0.98rem;
          line-height: 1.65;
          color: var(--text-secondary);
        }

        .bullet-list li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.65rem;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: var(--text-primary);
          opacity: 0.6;
        }

        .callout-card {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-left: 3px solid var(--text-primary);
          padding: 1.25rem 1.4rem;
          border-radius: 12px;
          margin: 1.75rem 0;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
        }

        .callout-card .callout-icon {
          color: var(--text-primary);
          flex-shrink: 0;
          margin-top: 0.15rem;
          width: 20px;
          height: 20px;
        }

        .callout-card strong {
          display: block;
          font-size: 0.95rem;
          margin-bottom: 0.3rem;
          color: var(--text-primary);
        }

        .callout-card p {
          font-size: 0.9rem !important;
          line-height: 1.55 !important;
          margin-bottom: 0 !important;
          color: var(--text-secondary);
        }

        code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.88em;
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          padding: 2px 6px;
          border-radius: 6px;
          color: var(--text-primary);
        }

        @media (max-width: 991px) {
          .desktop-toc-sidebar {
            display: none !important;
          }
          .mobile-toc-container {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
