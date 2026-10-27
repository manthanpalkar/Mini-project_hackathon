import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Home, ShieldAlert } from 'lucide-react';
import SEOHead from './SEOHead';

export default function SectionUnavailable({ sectionName = 'Section' }) {
  const navigate = useNavigate();

  const formattedName = sectionName
    ? sectionName.charAt(0).toUpperCase() + sectionName.slice(1)
    : 'Content';

  const userSession = typeof window !== 'undefined' ? localStorage.getItem('loop_current_user') : null;
  let isAdmin = false;
  try {
    const user = userSession ? JSON.parse(userSession) : null;
    isAdmin = Boolean(user?.isAdmin || user?.role === 'Administrator' || user?.role === 'Admin');
  } catch {}

  return (
    <div style={{
      minHeight: '75vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 1.5rem',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)'
    }}>
      <SEOHead
        title={`404 — ${formattedName} Unavailable | LOOP`}
        description={`The requested ${formattedName.toLowerCase()} section is currently unavailable.`}
        noIndex={true}
      />

      <div style={{
        maxWidth: '560px',
        width: '100%',
        textAlign: 'center',
        background: 'var(--card-bg, rgba(255, 255, 255, 0.04))',
        border: '1px solid var(--border-color)',
        borderRadius: '24px',
        padding: '3rem 2rem',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          backgroundColor: 'rgba(255, 59, 48, 0.12)',
          color: '#ff3b30',
          marginBottom: '1.5rem'
        }}>
          <ShieldAlert size={32} strokeWidth={2} />
        </div>

        <span style={{
          display: 'block',
          fontSize: '0.85rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--text-secondary)',
          marginBottom: '0.5rem'
        }}>
          404 — Not Available
        </span>

        <h1 style={{
          fontSize: 'calc(1.8rem + 0.6vw)',
          fontFamily: 'var(--font-serif)',
          fontWeight: 600,
          lineHeight: '1.25',
          margin: '0 0 1rem 0',
          color: 'var(--text-primary)'
        }}>
          {formattedName} Section Offline
        </h1>

        <p style={{
          fontSize: '1rem',
          lineHeight: '1.65',
          color: 'var(--text-secondary)',
          margin: '0 auto 2rem auto',
          maxWidth: '460px'
        }}>
          This section is currently hidden from public users by platform administrators or undergoing scheduled maintenance. Please check back later or return to the homepage.
        </p>

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1.75rem',
              borderRadius: '30px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Home size={16} />
            <span>Return to Home</span>
          </button>

          <button
            onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1.75rem',
              borderRadius: '30px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={16} />
            <span>Go Back</span>
          </button>
        </div>

        {isAdmin && (
          <div style={{
            marginTop: '2rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)'
          }}>
            <span>Administrator Notice: You can enable this section in the </span>
            <Link to="/admin?tab=visibility" style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'underline' }}>
              Admin Visibility Settings
            </Link>.
          </div>
        )}
      </div>
    </div>
  );
}
