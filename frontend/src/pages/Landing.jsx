import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, CornerRightDown } from 'lucide-react';

const heroImage = '/images/spit-college.jpg';
const labImage = '/images/loop-labs.png';

function LightboxImage({ src, alt, title, height = '380px', borderRadius = '16px', objectFit = 'contain', backgroundColor = '#ffffff' }) {
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
          padding: '1rem',
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
  const [activePhoto, setActivePhoto] = useState(null);
  const [activeChartTab, setActiveChartTab] = useState(0);

  useEffect(() => {
    document.title = 'LOOP | Home';
  }, []);

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
        <div style={{ maxWidth: '800px', zIndex: 2 }}>
          <h1 style={{
            fontSize: 'calc(2.2rem + 2vw)',
            fontFamily: 'var(--font-serif)',
            fontWeight: 600,
            lineHeight: '1.15',
            letterSpacing: '-0.02em',
            marginBottom: '2rem',
            color: '#ffffff',
            textShadow: '0 4px 30px rgba(0, 0, 0, 0.85), 0 2px 8px rgba(0, 0, 0, 0.9)'
          }}>
            Your Guide to Corporate Success
          </h1>
          <p style={{
            fontSize: '1.15rem',
            color: 'rgba(255, 255, 255, 0.92)',
            textShadow: '0 2px 16px rgba(0, 0, 0, 0.7)',
            marginBottom: '3rem',
            maxWidth: '560px',
            margin: '0 auto 3rem auto',
            lineHeight: '1.6'
          }}>
            No fluff. Cut the endless scrolling. Connect instantly with the SPIT seniors who made it, and unlock the exact step-by-step playbooks and raw study materials they used to get hired.
          </p>

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
              fontWeight: 600
            }}
          >
            Browse Stories
          </button>
        </div>

        {/* Scroll Indicator */}
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



      {/* SECTION 3: INSIGHTS / LOOP LABS (Full-bleed bg image + gradient overlay) */}
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
                    The Numbers Don't Lie. Get familiar with the SPIT standard. From a solid ₹15.14 LPA campus average to the elite ₹61.55 LPA peak packages, explore the official TPO records and see the exact targets you are aiming for.
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

          {/* Interactive Chart Tabs */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '2.5rem',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '1rem'
          }} className="chart-tabs-wrapper">
            {['Placement Performance', 'Category-wise Placement Trends', 'Internships & Higher Education'].map((tabLabel, idx) => {
              const isActive = activeChartTab === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveChartTab(idx)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.95rem',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '0.6rem 1.2rem',
                    position: 'relative',
                    transition: 'all 0.25s ease',
                    fontFamily: 'var(--font-sans)'
                  }}
                >
                  {tabLabel}
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-17px',
                      left: 0,
                      right: 0,
                      height: '3px',
                      backgroundColor: '#8A2BE2',
                      borderRadius: '2px'
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Chart Display Area (Borderless & Shadowless, blending with white background) */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            minHeight: '400px',
            backgroundColor: '#ffffff',
            padding: '1rem 0',
            animation: 'fadeIn 0.4s ease-out'
          }}>
            {activeChartTab === 0 && (
              <img 
                src="/images/chart-placed-ctc.png" 
                alt="Placement & CTC Statistics" 
                loading="lazy"
                decoding="async"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  maxHeight: '460px',
                  objectFit: 'contain'
                }}
              />
            )}
            {activeChartTab === 1 && (
              <img 
                src="/images/chart-internships-higherstudies.png" 
                alt="Internships & Higher Studies Statistics" 
                loading="lazy"
                decoding="async"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  maxHeight: '460px',
                  objectFit: 'contain'
                }}
              />
            )}
            {activeChartTab === 2 && (
              <img 
                src="/images/chart-category-companies-students.png" 
                alt="Category-wise Company & Students Placed Statistics" 
                loading="lazy"
                decoding="async"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  maxHeight: '460px',
                  objectFit: 'contain'
                }}
              />
            )}
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
        </div>
      </section>

      {/* SECTION 2: ACHIEVEMENTS (Full-bleed bg image + right text + right-to-left gradient overlay) */}
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
              Contribute to a culture of transparent learning. We welcome seniors and alumni to document their placement journeys, interview rounds, and study resources to mentor the upcoming batches.
            </p>
            
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
