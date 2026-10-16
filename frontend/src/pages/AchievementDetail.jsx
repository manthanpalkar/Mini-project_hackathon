import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAchievements } from '../utils/db';
import { ArrowLeft, Calendar } from 'lucide-react';

function formatAchievementDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  } catch (e) {}
  return String(dateStr);
}

const parsePosition = (posStr) => {
  if (!posStr) return { x: 50, y: 50, zoom: 1.0 };
  if (posStr === 'center') return { x: 50, y: 50, zoom: 1.0 };
  if (posStr === 'top') return { x: 50, y: 0, zoom: 1.0 };
  if (posStr === 'bottom') return { x: 50, y: 100, zoom: 1.0 };
  if (posStr === 'left') return { x: 0, y: 50, zoom: 1.0 };
  if (posStr === 'right') return { x: 100, y: 50, zoom: 1.0 };
  if (posStr.startsWith('crop:')) return { x: 50, y: 50, zoom: 1.0 };
  const parts = posStr.split(' ');
  const x = parseInt(parts[0]) || 50;
  const y = parseInt(parts[1]) || 50;
  const zoom = parseFloat(parts[2]) || 1.0;
  return { x, y, zoom };
};

const parseCrop = (posStr) => {
  const defaults = {
    outer: { x: 10, y: 0, w: 80, h: 33 },
    inner: { x: 10, y: 0, w: 80, h: 24 }
  };
  if (!posStr || !posStr.startsWith('crop:')) return defaults;
  try {
    const parts = posStr.replace('crop:', '').split(';');
    if (parts.length >= 2) {
      const outerParts = parts[0].split(',').map(Number);
      const innerParts = parts[1].split(',').map(Number);
      return {
        outer: { x: outerParts[0] ?? 10, y: outerParts[1] ?? 0, w: outerParts[2] ?? 80, h: outerParts[3] ?? 33 },
        inner: { x: innerParts[0] ?? 10, y: innerParts[1] ?? 0, w: innerParts[2] ?? 80, h: innerParts[3] ?? 24 }
      };
    }
  } catch (e) {
    console.error("Error parsing crop string:", e);
  }
  return defaults;
};

const parseSliders = (posStr) => {
  const defaults = {
    outer: { x: 48, y: 0, zoom: 1.8 },
    inner: { x: 50, y: 50, zoom: 1.0 }
  };
  if (!posStr) return defaults;
  if (posStr.startsWith('sliders:')) {
    try {
      const parts = posStr.replace('sliders:', '').split(';');
      if (parts.length >= 2) {
        const outerParts = parts[0].split(',');
        const innerParts = parts[1].split(',');
        return {
          outer: {
            x: isNaN(parseInt(outerParts[0])) ? 48 : parseInt(outerParts[0]),
            y: isNaN(parseInt(outerParts[1])) ? 0 : parseInt(outerParts[1]),
            zoom: isNaN(parseFloat(outerParts[2])) ? 1.8 : parseFloat(outerParts[2])
          },
          inner: {
            x: isNaN(parseInt(innerParts[0])) ? 50 : parseInt(innerParts[0]),
            y: isNaN(parseInt(innerParts[1])) ? 50 : parseInt(innerParts[1]),
            zoom: isNaN(parseFloat(innerParts[2])) ? 1.0 : parseFloat(innerParts[2])
          }
        };
      }
    } catch (e) {
      console.error("Error parsing sliders string:", e);
    }
  }
  const p = parsePosition(posStr);
  return {
    outer: { ...p },
    inner: { ...p }
  };
};

export default function AchievementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [achievement, setAchievement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAchievements().then(data => {
      const found = data.find(a => String(a.id) === String(id));
      setAchievement(found);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '5rem', paddingBottom: '5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  if (!achievement) {
    return (
      <div className="container" style={{ paddingTop: '5rem', paddingBottom: '5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Achievement not found.</p>
        <button onClick={() => navigate('/achievements')} className="btn btn-primary">
          Back to Achievements
        </button>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '6.5rem', paddingBottom: '6rem', maxWidth: '1000px' }}>
      
      {/* Back link */}
      <button 
        onClick={() => navigate('/achievements')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
          padding: 0,
          marginBottom: '2.5rem',
          transition: 'color 0.2s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        <ArrowLeft size={16} />
        <span>Back to Achievements</span>
      </button>

      {/* Image (Top - Under back link) — Inner View, hover expands height */}
      {(() => {
        // Use inner slider values saved from admin panel
        const slidersData = parseSliders(achievement.imagePosition);
        const p = slidersData.inner;
        // Absolute positioning formula mirrors admin preview exactly
        return (
          <div
            className="achievement-detail-banner"
            style={{
              width: '100%',
              borderRadius: '24px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              marginBottom: '3.5rem',
              position: 'relative'
            }}
          >
            <img
              src={achievement.image}
              alt={achievement.title}
              style={{
                position: 'absolute',
                width: `${p.zoom * 100}%`,
                height: `${p.zoom * 100}%`,
                left: `${-p.x * (p.zoom - 1)}%`,
                top: `${-p.y * (p.zoom - 1)}%`,
                objectFit: 'cover',
                objectPosition: `${p.x}% ${p.y}%`,
                display: 'block'
              }}
            />
          </div>
        );
      })()}

      {/* Two Column Layout Block */}
      <div className="achievement-detail-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 2fr',
        gap: '4rem',
        alignItems: 'start'
      }}>
        
        {/* Left Column: Title & Metadata */}
        <div>
          {/* Meta Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <span 
              className="badge"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0.35rem 0.9rem',
                borderRadius: '12px'
              }}
            >
              {achievement.category}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
              <Calendar size={14} />
              <span style={{ fontSize: '0.8rem' }}>
                {formatAchievementDate(achievement.date)}
              </span>
            </div>
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: '2.2rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: '1.25',
            margin: 0,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)'
          }}>
            {achievement.title}
          </h1>
        </div>

        {/* Right Column: Full Description */}
        <div style={{
          fontSize: '1.05rem',
          color: 'var(--text-primary)',
          lineHeight: '1.85',
          whiteSpace: 'pre-line'
        }}>
          {achievement.description}
        </div>

      </div>

      <style>{`
        @media (max-width: 768px) {
          .achievement-detail-grid {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
          }
        }
      `}</style>
    </div>
  );
}
