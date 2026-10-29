import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import BRAND from '../constants/branding';
import { 
  ArrowLeft, 
  FileCheck2, 
  Scale, 
  GraduationCap, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  Clock, 
  Building2, 
  Sparkles
} from 'lucide-react';

// Static sections configuration hoisted outside component to maintain stable identity
const SECTIONS = [
  { id: 'acceptance', num: '01', title: 'Acceptance of Terms' },
  { id: 'about-loop', num: '02', title: 'About LOOP' },
  { id: 'eligibility', num: '03', title: 'Eligibility' },
  { id: 'user-accounts', num: '04', title: 'User Accounts' },
  { id: 'acceptable-use', num: '05', title: 'Acceptable Use' },
  { id: 'user-content', num: '06', title: 'Student Stories and User Content' },
  { id: 'uploaded-resources', num: '07', title: 'Uploaded Files and Resources' },
  { id: 'intellectual-property', num: '08', title: 'Intellectual Property' },
  { id: 'copyright-attribution', num: '09', title: 'Copyright and Attribution' },
  { id: 'downloads-personal-use', num: '10', title: 'Downloads and Personal Use' },
  { id: 'prohibited-activities', num: '11', title: 'Prohibited Activities' },
  { id: 'platform-availability', num: '12', title: 'Platform Availability' },
  { id: 'third-party-links', num: '13', title: 'Third-Party Links' },
  { id: 'content-accuracy', num: '14', title: 'Content Accuracy' },
  { id: 'account-suspension', num: '15', title: 'Account Suspension or Removal' },
  { id: 'limitation-liability', num: '16', title: 'Limitation of Liability' },
  { id: 'changes-to-terms', num: '17', title: 'Changes to These Terms' },
  { id: 'contact-info', num: '18', title: 'Contact Information' }
];

export default function TermsOfUse() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('acceptance');
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  // 18 Sections configuration
  const sections = SECTIONS;

  // Scrollspy to update active TOC section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140;

      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const el = document.getElementById(SECTIONS[i].id);
        if (el) {
          const top = el.offsetTop;
          if (scrollPosition >= top) {
            setActiveSection(SECTIONS[i].id);
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
        title={`Terms of Use | ${BRAND.fullName}`}
        description={`${BRAND.tagline} Terms of Use for ${BRAND.fullName}, the student placement and academic preparation platform at Sardar Patel Institute of Technology (SPIT).`}
        canonicalUrl="/terms"
        ogType="website"
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Terms of Use', url: '/terms' }
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
              <Link to="/" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                Home
              </Link>
              <span style={{ margin: '0 0.5rem', opacity: 0.5 }}>/</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Terms of Use</span>
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
            backgroundColor: 'rgba(0, 113, 227, 0.1)',
            border: '1px solid rgba(0, 113, 227, 0.25)',
            color: '#0071e3',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '1.25rem'
          }}>
            <Scale size={14} />
            <span>Platform Agreement & Guidelines</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2.2rem, 4vw, 3.25rem)',
            fontWeight: 800,
            letterSpacing: '-0.035em',
            lineHeight: 1.15,
            marginBottom: '1rem',
            color: 'var(--text-primary)'
          }}>
            Terms of Use
          </h1>

          <p style={{
            fontSize: '1.12rem',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            maxWidth: '780px',
            marginBottom: '1.75rem'
          }}>
            Guidelines, user responsibilities, and terms for utilizing the LOOP student mentoring and placement preparation platform at Sardar Patel Institute of Technology.
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
              <FileCheck2 size={15} />
              <span>18 Sections</span>
            </div>
            <span style={{ opacity: 0.3 }}>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <GraduationCap size={15} />
              <span>Student Community Code</span>
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
              <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>18 Sections</span>
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
                  <Scale size={16} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Table of Contents (18 Sections)</span>
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

          {/* Section 1: Acceptance of Terms */}
          <section id="acceptance" className="policy-section">
            <div className="section-badge">01</div>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing, browsing, registering for, or contributing to <strong>LOOP</strong> (Limitless Opportunities, One Platform), you acknowledge that you have read, understood, and agreed to be bound by these <strong>Terms of Use</strong>, alongside our <Link to="/privacy-policy" style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'underline' }}>Privacy Policy</Link> and relevant Sardar Patel Institute of Technology campus student conduct policies.
            </p>
            <p>
              If you do not agree with any provision set forth in these terms, you must refrain from accessing the platform or uploading materials to LOOP.
            </p>
          </section>

          {/* Section 2: About LOOP */}
          <section id="about-loop" className="policy-section">
            <div className="section-badge">02</div>
            <h2>2. About LOOP</h2>
            <p>
              LOOP (Limitless Opportunities, One Platform) is an internal, non-commercial peer-mentorship platform and digital placement repository created for the academic and student community of <strong>Sardar Patel Institute of Technology (SPIT)</strong>, Mumbai.
            </p>
            <p>
              The platform facilitates the structured exchange of campus recruitment experiences, interview preparation strategy roadmaps, categorized department study resources, and peer guidance to empower undergraduates across academic semesters.
            </p>
            
            <div className="callout-card">
              <Sparkles className="callout-icon" />
              <div>
                <strong>Non-Commercial Purpose</strong>
                <p>
                  LOOP is maintained solely for non-profit educational and peer-mentoring objectives. No commercial subscriptions, paid paywalls, or fee-based premium features exist within LOOP.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Eligibility */}
          <section id="eligibility" className="policy-section">
            <div className="section-badge">03</div>
            <h2>3. Eligibility</h2>
            <p>
              Access to protected features on LOOP is strictly limited to:
            </p>
            <ul className="bullet-list">
              <li>Currently enrolled undergraduate and postgraduate students of SPIT.</li>
              <li>Graduated alumni of SPIT contributing interview reflections and career insights.</li>
              <li>Authorized faculty members and Training & Placement Cell coordinators.</li>
            </ul>
            <p>
              Users must provide authentic institutional credentials (such as an authorized <code>@spit.ac.in</code> domain email address) to create or maintain an active profile.
            </p>
          </section>

          {/* Section 4: User Accounts */}
          <section id="user-accounts" className="policy-section">
            <div className="section-badge">04</div>
            <h2>4. User Accounts</h2>
            <p>
              When creating and using your LOOP account:
            </p>
            <ul className="bullet-list">
              <li>
                <strong>Account Responsibility:</strong> You are responsible for maintaining the confidentiality of your login credentials and for all activities conducted under your authenticated session.
              </li>
              <li>
                <strong>Factual Profile Information:</strong> You agree to provide accurate details regarding your engineering branch, graduating batch year, and placement outcomes. Impersonating other students or alumni is strictly prohibited.
              </li>
              <li>
                <strong>Single-User Principle:</strong> Accounts are non-transferable and intended solely for individual use. Sharing institutional credentials with unauthorized non-SPIT third parties violates these terms.
              </li>
            </ul>
          </section>

          {/* Section 5: Acceptable Use */}
          <section id="acceptable-use" className="policy-section">
            <div className="section-badge">05</div>
            <h2>5. Acceptable Use</h2>
            <p>
              LOOP is designed to nurture a collegial, high-trust learning community. You agree to use the platform constructively by:
            </p>
            <ul className="bullet-list">
              <li>Providing respectful, constructive, and actionable placement interview preparation tips.</li>
              <li>Sharing high-quality academic reference notes, previous year question compilations, and educational cheatsheets.</li>
              <li>Upholding the dignity and integrity of peers, faculty, and visiting recruitment organizations.</li>
              <li>Reporting inaccurate or inappropriate materials to platform administrators promptly.</li>
            </ul>
          </section>

          {/* Section 6: Student Stories and User Content */}
          <section id="user-content" className="policy-section">
            <div className="section-badge">06</div>
            <h2>6. Student Stories and User Content</h2>
            <p>
              When authoring and submitting placement interview experiences:
            </p>
            <ul className="bullet-list">
              <li>
                <strong>Authenticity & Candor:</strong> Submissions must reflect genuine firsthand interview experiences, accurate round breakdowns, and truthful compensation band references.
              </li>
              <li>
                <strong>Non-Disclosure Compliance:</strong> Do not reproduce verbatim, proprietary assessment software test seeds or confidential non-disclosure documents protected by company agreements. Focus on topics, algorithmic paradigms, system design concepts, and general behavioral interview frameworks.
              </li>
              <li>
                <strong>Editorial Moderation:</strong> All submissions pass through an administrative review pipeline prior to public appearance to ensure format compliance and community standards.
              </li>
            </ul>
          </section>

          {/* Section 7: Uploaded Files and Resources */}
          <section id="uploaded-resources" className="policy-section">
            <div className="section-badge">07</div>
            <h2>7. Uploaded Files and Resources</h2>
            <p>
              Users uploading course documents, laboratory manuals, or placement preparation notes agree that:
            </p>
            <ul className="bullet-list">
              <li>All uploaded files are safe, free from malicious payloads, macro viruses, or malicious scripts.</li>
              <li>Files are correctly categorized into the appropriate departmental and semester folders.</li>
              <li>Uploaded content is strictly educational and relevant to SPIT curricula or technical recruitment.</li>
            </ul>
            <div className="callout-card">
              <AlertTriangle className="callout-icon" />
              <div>
                <strong>Zero Tolerance for Malware or Obscene Content</strong>
                <p>
                  Any intentional attempt to upload infected binaries, unauthorized executables, or inappropriate media will trigger immediate account termination and reporting to the SPIT Disciplinary Committee.
                </p>
              </div>
            </div>
          </section>

          {/* Section 8: Intellectual Property */}
          <section id="intellectual-property" className="policy-section">
            <div className="section-badge">08</div>
            <h2>8. Intellectual Property</h2>
            <p>
              The respective rights governing content on LOOP are structured as follows:
            </p>
            <ul className="bullet-list">
              <li>
                <strong>Your Content:</strong> You retain ownership of your original written interview accounts, personal resume formats, and handwritten study notes.
              </li>
              <li>
                <strong>License to LOOP:</strong> By contributing content, you grant LOOP a royalty-free, non-exclusive, perpetual license to host, display, categorize, and format your submission for educational access by SPIT students and faculty.
              </li>
              <li>
                <strong>LOOP Platform Property:</strong> The LOOP user interface, visual identity, branding, logo, code repository, and diagrammatic resource explorer architecture are the proprietary intellectual property of the lawful copyright holders (the LOOP student development team and SPIT). All rights are reserved.
              </li>
            </ul>
          </section>

          {/* Section 9: Copyright and Attribution */}
          <section id="copyright-attribution" className="policy-section">
            <div className="section-badge">09</div>
            <h2>9. Copyright and Attribution</h2>
            <p>
              <strong>© 2026 LOOP SPIT — All Rights Reserved.</strong> LOOP SPIT is a proprietary software project. Unless expressly authorized in writing by the lawful copyright holder, unauthorized copying, reproduction, modification, redistribution, publication, or commercial use of protected project materials is prohibited.
            </p>
            <p>
              We respect third-party intellectual property rights and expect contributors to do the same:
            </p>
            <ul className="bullet-list">
              <li>Do not upload entire copyrighted commercial textbooks, proprietary pirated video courses, or paid test-series question banks without publisher authorization.</li>
              <li>Always provide appropriate citations or references when summarizing open-source curriculum materials, research papers, or open documentation (e.g., LeetCode, CSES, Striver SDE Sheet, MIT OpenCourseWare).</li>
              <li>Third-party trademarks, company names, and recruiter logos displayed on the platform belong to their respective corporate owners and are presented strictly under nominative fair use for factual campus recruitment reporting.</li>
            </ul>
          </section>

          {/* Section 10: Downloads and Personal Use */}
          <section id="downloads-personal-use" className="policy-section">
            <div className="section-badge">10</div>
            <h2>10. Downloads and Personal Use</h2>
            <p>
              Study materials, interview summaries, and departmental references available on LOOP are provided strictly for <strong>personal, non-commercial educational prep</strong>.
            </p>
            <p>
              You may not redistribute, repackage, sell, or mirror LOOP files onto external public cloud drives, commercial tutoring platforms, or social media groups without explicit authorization.
            </p>
          </section>

          {/* Section 11: Prohibited Activities */}
          <section id="prohibited-activities" className="policy-section">
            <div className="section-badge">11</div>
            <h2>11. Prohibited Activities</h2>
            <p>
              To safeguard the platform for all scholars, the following behaviors are strictly forbidden:
            </p>
            <ul className="bullet-list">
              <li>Attempting to bypass authentication, forge JWT headers, or escalate user privileges to administrative status.</li>
              <li>Automated scraping, crawling, or bulk data extraction using automated bots or headless browsers without administrative consent.</li>
              <li>Introducing denial-of-service stress testing, flooding upload endpoints, or disrupting server infrastructure.</li>
              <li>Harassing, defaming, or publishing derogatory statements regarding fellow students, faculty, or recruitment interviewers.</li>
              <li>Submitting fraudulent placement claims or falsified offer letters.</li>
            </ul>
          </section>

          {/* Section 12: Platform Availability */}
          <section id="platform-availability" className="policy-section">
            <div className="section-badge">12</div>
            <h2>12. Platform Availability</h2>
            <p>
              LOOP is provided on an <strong>"as-is" and "as-available"</strong> basis. While our engineering team works diligently to ensure high uptime across exam seasons and placement seasons, we do not warrant that service will be continuous, error-free, or uninterrupted at all times.
            </p>
            <p>
              Scheduled maintenance, cloud infrastructure restarts on Render or Vercel, or database migration windows may temporarily affect access.
            </p>
          </section>

          {/* Section 13: Third-Party Links */}
          <section id="third-party-links" className="policy-section">
            <div className="section-badge">13</div>
            <h2>13. Third-Party Links</h2>
            <p>
              LOOP contains hyperlinks to external resources, including the <a href="https://www.spit.ac.in/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'underline' }}>official SPIT website</a>, corporate career portals, coding platforms, and academic repositories.
            </p>
            <p>
              These external destinations operate independently. LOOP assumes no responsibility for the content, privacy policies, or practices of third-party websites.
            </p>
          </section>

          {/* Section 14: Content Accuracy */}
          <section id="content-accuracy" className="policy-section">
            <div className="section-badge">14</div>
            <h2>14. Content Accuracy</h2>
            <p>
              Placement interview journeys represent subjective personal experiences of individual candidates. Hiring formats, difficulty tiers, question types, and recruitment criteria vary substantially between companies, departments, and academic years.
            </p>
            <p>
              Submissions are provided for mentorship and contextual guidance; they should not be construed as definitive predictions of future examination or interview patterns.
            </p>
          </section>

          {/* Section 15: Account Suspension or Removal */}
          <section id="account-suspension" className="policy-section">
            <div className="section-badge">15</div>
            <h2>15. Account Suspension or Removal</h2>
            <p>
              LOOP administrators reserve the right, at their professional discretion, to:
            </p>
            <ul className="bullet-list">
              <li>Reject, modify, or unpublish any submission that violates community guidelines or contains factual inaccuracies.</li>
              <li>Temporarily suspend or permanently terminate account access for users engaged in unauthorized tampering or abusive conduct.</li>
              <li>Refer severe violations of institutional integrity to the Sardar Patel Institute of Technology campus disciplinary authorities.</li>
            </ul>
          </section>

          {/* Section 16: Limitation of Liability */}
          <section id="limitation-liability" className="policy-section">
            <div className="section-badge">16</div>
            <h2>16. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, neither LOOP, its student developers, faculty mentors, nor Sardar Patel Institute of Technology shall be held liable for any direct, indirect, incidental, or consequential damages resulting from:
            </p>
            <ul className="bullet-list">
              <li>Your use of, or inability to use, materials hosted on the platform.</li>
              <li>Any recruitment or placement outcomes, interview decisions, or academic assessments.</li>
              <li>Unauthorized access to or alteration of your submissions.</li>
              <li>Temporary data loss arising from cloud hosting disruptions or server maintenance.</li>
            </ul>
          </section>

          {/* Section 17: Changes to These Terms */}
          <section id="changes-to-terms" className="policy-section">
            <div className="section-badge">17</div>
            <h2>17. Changes to These Terms</h2>
            <p>
              We may revise these Terms of Use from time to time to accommodate platform enhancements, architectural upgrades, or institutional guidelines.
            </p>
            <p>
              The revised document will be published with an updated <strong>Last Updated</strong> date. Continued use of LOOP following posted modifications signifies your formal agreement to the amended terms.
            </p>
          </section>

          {/* Section 18: Contact Information */}
          <section id="contact-info" className="policy-section">
            <div className="section-badge">18</div>
            <h2>18. Contact Information</h2>
            <p>
              For inquiries regarding these Terms of Use, copyright notices, or platform administration, please contact:
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
