import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, CornerRightDown } from 'lucide-react';
import SEOHead from '../components/SEOHead';
import { useVisibility } from '../context/VisibilityContext';
import BRAND from '../constants/branding';

const heroImage = '/images/spit-college.jpg';
const labImage = '/images/loop-labs.png';

function LightboxImage({ src, alt, title, height = '380px', borderRadius = '16px', objectFit = 'contain', backgroundColor = '#ffffff', padding = '0' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'relative',
          borderRadius: borderRadius,
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          height: height,
          backgroundColor: backgroundColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: padding,
          cursor: 'zoom-in',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          boxShadow: isHovered ? '0 12px 24px rgba(0, 0, 0, 0.15)' : 'none',
        }}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          style={{
            width: '100%',
            height: '100%',
            objectFit: objectFit,
            transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: isHovered ? 'scale(1.05)' : 'scale(1)',
          }}
        />

        <div style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          color: '#ffffff',
          padding: '8px 16px',
          borderRadius: '30px',
          fontSize: '0.8rem',
          fontWeight: 600,
          opacity: isHovered ? 1 : 0,
          transform: isHovered ? 'translateY(0)' : 'translateY(8px)',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
        }}>
          <span style={{ fontSize: '0.9rem' }}>🔍</span> Click to Expand
        </div>
      </div>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            animation: 'fadeIn 0.2s ease-out',
            cursor: 'zoom-out'
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontSize: '1.25rem',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              zIndex: 100000,
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              e.target.style.transform = 'scale(1)';
            }}
          >
            ✕
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92%',
              maxHeight: '92%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              animation: 'zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <img
              src={src}
              alt={alt}
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: '#ffffff',
                padding: '10px'
              }}
            />
            {title && (
              <div style={{
                marginTop: '20px',
                color: '#ffffff',
                fontSize: '1.2rem',
                fontWeight: 600,
                textAlign: 'center',
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-serif)',
                textShadow: '0 2px 8px rgba(0,0,0,0.6)'
              }}>
                {title}
              </div>
            )}
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes zoomIn {
              from { transform: scale(0.92); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { visibility } = useVisibility();
  const [user, setUser] = useState(() => {
    const userSession = typeof window !== 'undefined' ? localStorage.getItem('loop_current_user') : null;
    try {
      return userSession ? JSON.parse(userSession) : null;
    } catch {
      return null;
    }
  });
  const isAuthenticated = Boolean(user && (user.token || user.refreshToken));
  const isAdmin = Boolean(user?.isAdmin || user?.role === 'Administrator' || user?.role === 'Admin');

  useEffect(() => {
    const syncUser = () => {
      const userSession = localStorage.getItem('loop_current_user');
      try {
        setUser(userSession ? JSON.parse(userSession) : null);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener('loop_login_success', syncUser);
    window.addEventListener('loop_session_refreshed', syncUser);
    window.addEventListener('loop_logout', syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener('loop_login_success', syncUser);
      window.removeEventListener('loop_session_refreshed', syncUser);
      window.removeEventListener('loop_logout', syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);
  const [activePhoto, setActivePhoto] = useState(null);

  useEffect(() => {
    if (!activePhoto) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActivePhoto(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePhoto]);

  // Scroll handler for the first CTA button or indicator
  const scrollToPhilosophy = () => {
    document.getElementById('philosophy-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleShareJourney = () => {
    navigate('/stories?upload=true');
  };

  return (
    <div className="animate-fade-in" style={{ backgroundColor: 'var(--bg-primary)', overflowX: 'hidden' }}>
      <SEOHead
        title="LOOP SPIT | SPIT Mumbai Placement Stories &amp; Resources"
        description="LOOP is a student-led platform for SPIT Mumbai students featuring placement experiences, company-wise interview stories, interview preparation resources, and career guidance."
        canonicalUrl="/"
        ogType="website"
        keywords="LOOP, LOOP SPIT, LOOP SPIT Mumbai, LOOP placement, SPIT placement stories, SPIT interview experiences, SPIT placement portal, SPIT placement preparation, Sardar Patel Institute of Technology"
        structuredData={{
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
          url: 'https://loop-seven-delta.vercel.app/',
          description: 'LOOP is a student-led platform for SPIT Mumbai students featuring placement experiences, company-wise interview stories, interview preparation resources, and career guidance.',
          publisher: {
            '@type': 'Organization',
            name: 'LOOP — Limitless Opportunities, One Platform',
            url: 'https://loop-seven-delta.vercel.app/',
            logo: {
              '@type': 'ImageObject',
              url: 'https://loop-seven-delta.vercel.app/loop-logo.png'
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
            target: 'https://loop-seven-delta.vercel.app/stories?q={search_term_string}',
            'query-input': 'required name=search_term_string'
          }
        }}
      />

      {/* SECTION 1: HERO BANNER (Full-bleed high-contrast banner) */}
      <section style={{
        minHeight: '85vh',
        width: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0.65)), url(${heroImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: '#ffffff',
        textAlign: 'center',
        padding: '3rem 1.5rem',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ maxWidth: '840px', zIndex: 2 }}>
          {/* Branded Identity Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.45rem 1.15rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.28)',
            fontSize: '0.85rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: '#ffffff',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
          }}>
            <span style={{ letterSpacing: '0.12em' }}>{BRAND.name}</span>
            <span style={{ opacity: 0.6 }}>•</span>
            <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: '0.02em' }}>{BRAND.fullForm}</span>
          </div>

          <h1 style={{
            fontSize: 'calc(2.1rem + 1.6vw)',
            fontFamily: 'var(--font-serif)',
            fontWeight: 600,
            lineHeight: '1.2',
            letterSpacing: '-0.02em',
            marginBottom: '1.25rem',
            color: '#ffffff',
            textShadow: '0 4px 30px rgba(0, 0, 0, 0.85), 0 2px 8px rgba(0, 0, 0, 0.9)'
          }}>
            LOOP SPIT — SPIT Mumbai Placement Stories &amp; Career Resources
          </h1>
          <p style={{
            fontSize: '1.15rem',
            color: 'rgba(255, 255, 255, 0.92)',
            textShadow: '0 2px 16px rgba(0, 0, 0, 0.7)',
            marginBottom: '3rem',
            maxWidth: '680px',
            margin: '0 auto 3rem auto',
            lineHeight: '1.6'
          }}>
            Their Journey. Your Opportunity. LOOP SPIT is an independent student-led placement platform for Sardar Patel Institute of Technology (SPIT), Mumbai. Connecting juniors, seniors, and alumni to share authentic round-by-round interview debriefs, coding test patterns, and career preparation resources.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {isAuthenticated ? (
              <>
                {(visibility.stories || isAdmin) && (
                  <button
                    onClick={() => navigate('/stories')}
                    className="btn btn-primary"
                    style={{
                      padding: '1rem 2.2rem',
                      fontSize: '1rem',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      border: 'none',
                      borderRadius: '30px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Browse Stories
                  </button>
                )}
                {(visibility.resources || isAdmin) && (
                  <button
                    onClick={() => navigate('/resources')}
                    className="btn"
                    style={{
                      padding: '1rem 2.2rem',
                      fontSize: '1rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.35)',
                      borderRadius: '30px',
                      fontWeight: 600,
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      cursor: 'pointer'
                    }}
                  >
                    Explore Resources
                  </button>
                )}
                {!(visibility.stories || isAdmin) && !(visibility.resources || isAdmin) && (
                  <button
                    onClick={scrollToPhilosophy}
                    className="btn btn-primary"
                    style={{
                      padding: '1rem 2.2rem',
                      fontSize: '1rem',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      border: 'none',
                      borderRadius: '30px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Explore Platform ↓
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="btn btn-primary"
                style={{
                  padding: '1rem 2.5rem',
                  fontSize: '1.05rem',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '30px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 25px rgba(0, 0, 0, 0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.35)';
                }}
              >
                Login to Continue →
              </button>
            )}
          </div>
        </div>

        {/* Scroll Indicator (Authenticated users only) */}
        {isAuthenticated && (
          <button
            onClick={scrollToPhilosophy}
            style={{
              position: 'absolute',
              bottom: '2rem',
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              animation: 'bounce 2s infinite',
              zIndex: 2
            }}
            title="Scroll down"
          >
            <ArrowDown size={28} />
          </button>
        )}

        {/* Ambient dark bottom gradient fade */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '120px',
          background: 'linear-gradient(transparent, var(--bg-primary))',
          pointerEvents: 'none'
        }} />
      </section>

      {/* Internal Content Sections (Visible only to authenticated users) */}
      {isAuthenticated && (
        <>



      {/* SECTION 3: INSIGHTS / LOOP LABS (Full-bleed bg image + gradient overlay) */}
      {(visibility.resources || isAdmin) && (
        <section
          id="branches-section"
          style={{
            position: 'relative',
            minHeight: '600px',
            borderBottom: '1px solid var(--border-color)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div className="container grid-2col" style={{
            alignItems: 'center'
          }}>
            {/* Loop Labs Image (Left) */}
            <LightboxImage
              src={labImage}
              alt="Students collaborating at SPIT"
              title="We study what works"
              height="520px"
              borderRadius="24px"
              objectFit="cover"
              backgroundColor="transparent"
            />

            {/* Loop Labs Description (Right) */}
            <div>
              <span style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: '#8A2BE2',
                marginBottom: '1rem',
                display: 'block'
              }}>
                Loop Labs
              </span>
              <h2 style={{
                fontSize: 'calc(1.8rem + 1vw)',
                fontFamily: 'var(--font-serif)',
                fontWeight: 500,
                lineHeight: '1.25',
                marginBottom: '1.5rem',
                color: 'var(--text-primary)'
              }}>
                The Catalyst
              </h2>
              <p style={{
                fontSize: '1.05rem',
                lineHeight: '1.7',
                color: 'var(--text-secondary)',
                marginBottom: '2rem'
              }}>
                Bypass the disorganized WhatsApp groups. Get instant access to the complete stack—from raw lecture notes, class PPTs, and standard textbooks to clear your semester exams, to the exact placement materials you need to secure a Dream Offer.
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1.5rem',
                marginBottom: '2.5rem',
                borderTop: '1px solid var(--border-color)',
                paddingTop: '1.5rem'
              }}>
                <div>
                  <h4 style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: '0.25rem' }}>95%</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Senior feedback participation rate</p>
                </div>
                <div>
                  <h4 style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: '0.25rem' }}>200+</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Verified SPIT roadmaps & sheets</p>
                </div>
              </div>

              <button
                onClick={() => navigate('/resources')}
                className="btn btn-secondary"
                style={{ padding: '0.75rem 1.6rem', borderRadius: '30px' }}
              >
                Explore Resources
              </button>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 3B: PLACEMENT RECORDS & PARTNER COMPANIES */}
      <section style={{
        padding: '6rem 0 0 0',
        backgroundColor: '#ffffff' // Clean white background to blend paper-white charts seamlessly
      }}>
        <div className="container" style={{ maxWidth: '1100px' }}>
          <div className="placement-header-grid">
            <div style={{ textAlign: 'left' }}>
              <span style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: '#8A2BE2',
                marginBottom: '1rem',
                display: 'block'
              }}>
                Placements & Partnerships
              </span>
              <h2 style={{
                fontSize: 'calc(1.8rem + 1vw)',
                fontFamily: 'var(--font-serif)',
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: '2rem',
                lineHeight: '1.25'
              }}>
                Placements & Partnerships
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '2rem'
              }} className="sub-blocks-grid">
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.75rem', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
                    Placement Track Record
                  </h3>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                    The Numbers Don't Lie. Get familiar with the SPIT standard. From a solid ₹15.14 LPA campus average to the elite ₹61.55 LPA peak packages, explore verified campus placement packages and see the exact targets you are aiming for.
                  </p>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.75rem', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
                    Top Recruiters
                  </h3>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                    The Tier-1 Roster. Microsoft, Morgan Stanley, Barclays, and more. See the exact tech giants and financial heavyweights that actively partner with SPIT to hunt for top-tier engineering talent.
                  </p>
                </div>
              </div>
            </div>
            <LightboxImage
              src="/images/tpo-team-placement.jpg"
              alt="SPIT TPO Team & Coordinators"
              title="SPIT Training & Placement Team"
              height="340px"
              borderRadius="20px"
              objectFit="cover"
              backgroundColor="transparent"
            />
          </div>

          {/* Placement Performance Section Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '2.5rem',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '1rem'
          }}>
            <span
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                padding: '0.6rem 1.2rem',
                position: 'relative',
                fontFamily: 'var(--font-sans)'
              }}
            >
              Placement Performance
              <div style={{
                position: 'absolute',
                bottom: '-17px',
                left: 0,
                right: 0,
                height: '3px',
                backgroundColor: '#8A2BE2',
                borderRadius: '2px'
              }} />
            </span>
          </div>

          {/* Chart Display Area — Both New Placement Performance Charts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '2.5rem',
            width: '100%',
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '1.5rem 0',
            alignItems: 'stretch',
            backgroundColor: '#ffffff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              <img
                src="/images/chart-placement-percentage.png"
                alt="Placement Statistics — Placement Percentage"
                loading="lazy"
                decoding="async"
                style={{
                  width: '100%',
                  maxWidth: '520px',
                  height: 'auto',
                  aspectRatio: '82 / 62',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              <img
                src="/images/chart-average-ctc.png"
                alt="Placement Statistics — Average & Median CTCs"
                loading="lazy"
                decoding="async"
                style={{
                  width: '100%',
                  maxWidth: '520px',
                  height: 'auto',
                  aspectRatio: '82 / 62',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>
          </div>

          {/* Recruiters / Partners Section */}
          <div style={{
            marginTop: '5rem',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '4rem',
            textAlign: 'center'
          }}>
            <h3 style={{
              fontSize: '1.40rem',
              fontFamily: 'var(--font-serif)',
              fontWeight: 500,
              color: 'var(--text-primary)',
              marginBottom: '2.5rem',
              letterSpacing: '0.02em'
            }}>
              Our Prominent Recruiters & Corporate Partners
            </h3>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              backgroundColor: '#ffffff'
            }}>
              <img
                src="/images/recruiters-partners.png"
                alt="Our Recruiters and Partners"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  maxHeight: '520px',
                  objectFit: 'contain'
                }}
              />
            </div>
          </div>

          {/* Featured Placement Experiences Grid (SEO & High-Intent CRO) */}
          {(visibility.stories || isAdmin) && (
            <div style={{
              marginTop: '4.5rem',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '3.5rem',
              textAlign: 'left'
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
              <div>
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: '#8A2BE2',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Authentic Senior Journeys
                </span>
                <h3 style={{
                  fontSize: '1.75rem',
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0
                }}>
                  Featured Placement Debriefs
                </h3>
                <p style={{
                  fontSize: '0.95rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.5rem',
                  marginBottom: 0,
                  maxWidth: '680px',
                  lineHeight: '1.6'
                }}>
                  Explore authentic, round-by-round interview experiences from Sardar Patel Institute of Technology students. Each debrief details online assessments, live technical rounds, algorithmic problem-solving patterns, and actionable preparation advice across top recruiters.
                </p>
              </div>
              <button
                onClick={() => navigate('/stories')}
                className="btn btn-secondary"
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                View All Debriefs →
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.5rem',
              width: '100%'
            }}>
              {[
                { id: 'story_2026_21664150', company: 'Barclays', role: 'Summer Intern 2025', branch: 'CSE-DS', year: '2026' },
                { id: 'story_2026_35118136', company: 'J.P. Morgan', role: 'CIB Research & Analytics', branch: 'CSE-AIML', year: '2026' },
                { id: 'story_2026_28159237', company: 'ISS STOXX', role: 'SDE 1', branch: 'CE', year: '2026' },
                { id: 'story_2026_68003868', company: 'UBS', role: 'GOTO Intern', branch: 'CE', year: '2026' },
                { id: 'story_2026_5760309', company: 'Mastercard', role: 'Software Engineer I', branch: 'CSE-DS', year: '2026' },
                { id: 'story_2026_78234768', company: 'PhonePe', role: 'SDE', branch: 'CE', year: '2026' }
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/stories/${item.id}`)}
                  style={{
                    padding: '1.4rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: 'var(--card-shadow)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.borderColor = '#8A2BE2';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{
                      backgroundColor: 'rgba(138, 43, 226, 0.12)',
                      color: '#8A2BE2',
                      padding: '0.2rem 0.65rem',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase'
                    }}>
                      {item.company}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Class of {item.year}
                    </span>
                  </div>
                  <h4 style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.4rem',
                    fontFamily: 'var(--font-sans)'
                  }}>
                    {item.role}
                  </h4>
                  <p style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    margin: '0 0 1rem 0'
                  }}>
                    Department of {item.branch} • SPIT Mumbai
                  </p>
                  <a
                    href={`/stories/${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/stories/${item.id}`);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      textDecoration: 'none'
                    }}
                  >
                    Read Interview Debrief →
                  </a>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      </section>

      {/* SECTION 2: ACHIEVEMENTS (Full-bleed bg image + right text + right-to-left gradient overlay) */}
      {(visibility.achievements || isAdmin) && (
        <section
          id="achievements-section"
          className="achievements-section-bg"
        >
        <div className="achievements-bg-image" />
        <div className="achievements-overlay" />

        {/* Top Fade Overlay to blend white background of the section above */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '35px',
          background: 'linear-gradient(to bottom, #ffffff 0%, rgba(255, 255, 255, 0) 100%)',
          zIndex: 2,
          pointerEvents: 'none'
        }} />

        {/* Bottom Fade Overlay to blend white background of the section below */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '35px',
          background: 'linear-gradient(to top, #ffffff 0%, rgba(255, 255, 255, 0) 100%)',
          zIndex: 2,
          pointerEvents: 'none'
        }} />
        <div className="container" style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          justifyContent: 'flex-end',
          width: '100%'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '520px',
            color: '#ffffff',
            padding: '3rem 0',
            textAlign: 'left'
          }}>
            <span style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#c084fc', // Bright light violet for excellent visibility on dark background
              marginBottom: '1rem',
              display: 'block'
            }}>
              Achievements & Milestones
            </span>
            <h2 style={{
              fontSize: 'calc(2.2rem + 1vw)',
              fontFamily: 'var(--font-serif)',
              fontWeight: 500,
              lineHeight: '1.25',
              color: '#ffffff',
              letterSpacing: '-0.01em',
              marginBottom: '1.5rem'
            }}>
              The Hall of Fame
            </h2>
            <p style={{
              fontSize: '1.15rem',
              lineHeight: '1.75',
              color: 'rgba(255, 255, 255, 0.85)',
              marginBottom: '2rem'
            }}>
              We don't just participate; we dominate. Explore the ultimate track record of student achievements at SPIT. View the exact milestones set by the top 1% of the campus—and learn what it takes to leave your own mark.
            </p>

            <div>
              <button
                onClick={() => navigate('/achievements')}
                className="btn"
                style={{
                  padding: '0.85rem 2rem',
                  borderRadius: '30px',
                  fontWeight: 600,
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'transform 0.2s ease, opacity 0.2s ease'
                }}
                onMouseEnter={(e) => { e.target.style.transform = 'scale(1.03)'; e.target.style.opacity = '0.95'; }}
                onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; e.target.style.opacity = '1'; }}
              >
                Explore Achievements
              </button>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* SECTION 5: CTA & TEAM PHOTO STACK (Left details, right vertical stack) */}
      <section style={{ padding: '8rem 0 10rem 0' }}>
        <div className="container grid-2col" style={{
          alignItems: 'center'
        }}>
          {/* CTA Details (Left) */}
          <div>
            <span style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#8A2BE2',
              marginBottom: '1rem',
              display: 'block'
            }}>
              CONTRIBUTE TO LOOP
            </span>
            <h2 style={{
              fontSize: 'calc(2rem + 1vw)',
              fontFamily: 'var(--font-serif)',
              fontWeight: 500,
              lineHeight: '1.2',
              marginBottom: '1.5rem',
              color: 'var(--text-primary)'
            }}>
              Let's build together.
            </h2>
            <p style={{
              fontSize: '1.1rem',
              lineHeight: '1.7',
              color: 'var(--text-secondary)',
              marginBottom: '2.5rem'
            }}>
              Contribute to a continuous cycle of knowledge sharing. LOOP connects college juniors, seniors, and alumni: today's juniors become tomorrow's seniors, who then guide the next generation. We welcome seniors and alumni to document their placement journeys, interview rounds, and study resources.
            </p>

            {(visibility.stories || isAdmin) && (
              <button
                onClick={handleShareJourney}
                className="btn btn-secondary"
                style={{
                  padding: '0.9rem 2rem',
                  borderRadius: '30px',
                  fontWeight: 600,
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--accent-inverse)',
                  borderColor: 'var(--text-primary)'
                }}
              >
                Share Your Journey
              </button>
            )}
          </div>

          {/* Hinge style overlapping team photo stack (Right) */}
          <div style={{
            position: 'relative',
            height: '420px',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }} className="photo-stack-container">
            {/* Card 1: Leftmost */}
            <div
              onClick={() => setActivePhoto({ src: '/images/file-1.jpg', alt: 'Students studying', title: "Let's build together" })}
              className="stack-photo"
              style={{
                position: 'absolute',
                left: '5%',
                width: '180px',
                height: '270px',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                border: '1px solid var(--border-color)',
                transform: 'rotate(-4deg) translateY(-20px)',
                zIndex: 1,
                cursor: 'zoom-in'
              }}
            >
              <img
                src="/images/file-1.jpg"
                alt="Students studying"
                loading="lazy"
                decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* Card 2: Center */}
            <div
              onClick={() => setActivePhoto({ src: '/images/file-2.jpg', alt: 'Working at a table', title: "Let's build together" })}
              className="stack-photo"
              style={{
                position: 'absolute',
                width: '200px',
                height: '300px',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                border: '1px solid var(--border-color)',
                transform: 'rotate(2deg) translateY(10px)',
                zIndex: 3,
                cursor: 'zoom-in'
              }}
            >
              <img
                src="/images/file-2.jpg"
                alt="Working at a table"
                loading="lazy"
                decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* Card 3: Rightmost */}
            <div
              onClick={() => setActivePhoto({ src: '/images/file-3.jpg', alt: 'Student presenting code', title: "Let's build together" })}
              className="stack-photo"
              style={{
                position: 'absolute',
                right: '5%',
                width: '180px',
                height: '270px',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                border: '1px solid var(--border-color)',
                transform: 'rotate(-2deg) translateY(-30px)',
                zIndex: 2,
                cursor: 'zoom-in'
              }}
            >
              <img
                src="/images/file-3.jpg"
                alt="Student presenting code"
                loading="lazy"
                decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Bounce keyframe and stack responsiveness */}
      <style>{`
        .achievements-section-bg {
          position: relative;
          min-height: 580px;
          display: flex;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          overflow: hidden;
        }
        .achievements-bg-image {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url('/images/achievements-bg.jpg');
          background-size: cover;
          background-position: center;
          transition: transform 8s cubic-bezier(0.25, 1, 0.3, 1);
          z-index: 0;
        }
        .achievements-section-bg:hover .achievements-bg-image {
          transform: scale(1.06);
        }
        .achievements-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.3) 30%, rgba(0, 0, 0, 0.8) 60%, rgba(0, 0, 0, 0.95) 100%);
          z-index: 1;
        }
        .stack-photo {
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), z-index 0.4s step-start, box-shadow 0.4s ease !important;
        }
        .stack-photo:hover {
          transform: scale(1.6) rotate(0deg) translateY(-20px) !important;
          z-index: 100 !important;
          box-shadow: 0 30px 60px rgba(0,0,0,0.5) !important;
        }
        .placement-header-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 4rem;
          align-items: center;
          margin-bottom: 4rem;
        }
        .sub-blocks-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-8px);
          }
          60% {
            transform: translateY(-4px);
          }
        }

        @media (max-width: 900px) {
          .achievements-section-bg {
            min-height: 500px !important;
          }
          .achievements-overlay {
            background: rgba(0, 0, 0, 0.75) !important;
          }
          .placement-header-grid {
            grid-template-columns: 1fr !important;
            gap: 2.5rem !important;
            margin-bottom: 3rem !important;
          }
          .sub-blocks-grid {
            grid-template-columns: 1fr !important;
            gap: 1.5rem !important;
          }
          section {
            padding: 5rem 1.5rem !important;
          }
          .container {
            grid-template-columns: 1fr !important;
            gap: 4rem !important;
          }
          .hide-on-mobile {
            display: none !important;
          }
          .photo-stack-container {
            height: 350px !important;
            margin-top: 2rem;
          }
          .stack-photo {
            width: 140px !important;
            height: 210px !important;
          }
          .stack-photo:hover {
            transform: scale(1.3) rotate(0deg) translateY(-10px) !important;
          }
          .stack-photo:nth-of-type(1) {
            left: 10% !important;
          }
          .stack-photo:nth-of-type(2) {
            width: 160px !important;
            height: 230px !important;
          }
          .stack-photo:nth-of-type(3) {
            right: 10% !important;
          }
        }
      `}</style>
      </>
      )}

      {/* Lightbox for stack photos */}
      {activePhoto && (
        <div
          onClick={() => setActivePhoto(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            animation: 'fadeIn 0.2s ease-out',
            cursor: 'zoom-out'
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setActivePhoto(null); }}
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontSize: '1.25rem',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              zIndex: 100000,
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              e.target.style.transform = 'scale(1)';
            }}
          >
            ✕
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92%',
              maxHeight: '92%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              animation: 'zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <img
              src={activePhoto.src}
              alt={activePhoto.alt}
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: '#ffffff',
                padding: '10px'
              }}
            />
            {activePhoto.title && (
              <div style={{
                marginTop: '20px',
                color: '#ffffff',
                fontSize: '1.2rem',
                fontWeight: 600,
                textAlign: 'center',
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-serif)',
                textShadow: '0 2px 8px rgba(0,0,0,0.6)'
              }}>
                {activePhoto.title}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
