import { useState } from 'react';
import { Eye, EyeOff, Check, AlertCircle, Sparkles, BookOpen, FileText, Trophy, Loader2 } from 'lucide-react';
import { useVisibility } from '../hooks/useVisibility';

export default function AdminSectionVisibilityTab() {
  const { visibility, loading, updateVisibility } = useVisibility();
  const [updatingKey, setUpdatingKey] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(prev => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const handleToggle = async (sectionKey) => {
    if (updatingKey) return; // Prevent double clicks
    const currentVal = Boolean(visibility[sectionKey]);
    const nextVal = !currentVal;
    const sectionTitle = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);

    try {
      setUpdatingKey(sectionKey);
      await updateVisibility({
        ...visibility,
        [sectionKey]: nextVal
      });
      showNotification(
        `${sectionTitle} section is now ${nextVal ? 'VISIBLE to everyone.' : 'HIDDEN from public users.'}`,
        'success'
      );
    } catch (err) {
      showNotification(
        `Failed to update ${sectionTitle} visibility: ${err.message}`,
        'error'
      );
    } finally {
      setUpdatingKey(null);
    }
  };

  const sectionsConfig = [
    {
      key: 'stories',
      title: 'Stories — ON/OFF',
      name: 'Stories',
      icon: BookOpen,
      iconColor: '#0071E3',
      description: 'Controls public access to student placement debriefs, company interview rounds, and preparation journeys.'
    },
    {
      key: 'resources',
      title: 'Resources — ON/OFF',
      name: 'Resources',
      icon: FileText,
      iconColor: '#34C759',
      description: 'Controls public access to the study material repository, department folders, documents, and file previews.'
    },
    {
      key: 'achievements',
      title: 'Achievements — ON/OFF',
      name: 'Achievements',
      icon: Trophy,
      iconColor: '#AF52DE',
      description: 'Controls public access to student accomplishments, hackathon wins, the Hall of Fame, and campus milestones.'
    }
  ];

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Tab Header */}
      <div style={{
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: 'var(--text-primary)',
            color: 'var(--accent-inverse)'
          }}>
            <Eye size={20} />
          </div>
          <h2 style={{
            fontSize: '1.65rem',
            fontFamily: 'var(--font-serif)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0
          }}>
            Public Section Visibility
          </h2>
        </div>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '0.95rem',
          lineHeight: '1.6',
          margin: 0,
          maxWidth: '740px'
        }}>
          Manage the public availability of major sections across LOOP. When a section is OFF, it is hidden from the public homepage, navigation bar, footer, search engine indexes, and direct URL access. Turning a section ON immediately restores full public visibility without altering underlying content.
        </p>
      </div>

      {/* Confirmation & Notification Toast */}
      {notification && (
        <div style={{
          marginBottom: '2rem',
          padding: '1rem 1.25rem',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: notification.type === 'success' ? 'rgba(52, 199, 89, 0.12)' : 'rgba(255, 59, 48, 0.12)',
          border: `1px solid ${notification.type === 'success' ? 'rgba(52, 199, 89, 0.35)' : 'rgba(255, 59, 48, 0.35)'}`,
          color: notification.type === 'success' ? '#248a3d' : '#d70015',
          fontSize: '0.925rem',
          fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
          animation: 'fade-in 0.25s ease'
        }}>
          {notification.type === 'success' ? (
            <Check size={20} strokeWidth={2.5} />
          ) : (
            <AlertCircle size={20} strokeWidth={2.5} />
          )}
          <span style={{ flexGrow: 1 }}>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '0.2rem',
              display: 'flex'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 3 Toggle Switch Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {sectionsConfig.map((sec) => {
          const isEnabled = Boolean(visibility[sec.key]);
          const isSaving = updatingKey === sec.key;
          const Icon = sec.icon;

          return (
            <div
              key={sec.key}
              style={{
                backgroundColor: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
                border: '1px solid var(--border-color)',
                borderRadius: '18px',
                padding: '1.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.5rem',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
              }}
            >
              {/* Left Details */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', maxWidth: '600px' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: `${sec.iconColor}18`,
                  color: sec.iconColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '0.15rem'
                }}>
                  <Icon size={24} />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1.15rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)'
                    }}>
                      {sec.title}
                    </h3>

                    {/* Status Pill Badge */}
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.65rem',
                      borderRadius: '20px',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      backgroundColor: isEnabled ? 'rgba(52, 199, 89, 0.15)' : 'rgba(142, 142, 147, 0.15)',
                      color: isEnabled ? '#34C759' : 'var(--text-secondary)',
                      border: `1px solid ${isEnabled ? 'rgba(52, 199, 89, 0.3)' : 'var(--border-color)'}`
                    }}>
                      {isEnabled ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </div>

                  <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.875rem',
                    lineHeight: '1.55',
                    margin: '0 0 0.65rem 0'
                  }}>
                    {sec.description}
                  </p>

                  {/* Status Label Required by Specification */}
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: isEnabled ? 'var(--text-primary)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    {isEnabled ? (
                      <>
                        <Eye size={15} style={{ color: '#34C759' }} />
                        <span>ON: Visible to everyone.</span>
                      </>
                    ) : (
                      <>
                        <EyeOff size={15} style={{ color: 'var(--text-secondary)' }} />
                        <span>OFF: Hidden from public users.</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Interactive Toggle Switch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {isSaving && (
                  <span style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}>
                    <Loader2 size={14} className="spin" />
                    <span>Saving...</span>
                  </span>
                )}

                <button
                  type="button"
                  role="switch"
                  aria-checked={isEnabled}
                  aria-label={`Toggle ${sec.name} section visibility`}
                  disabled={loading || isSaving}
                  onClick={() => handleToggle(sec.key)}
                  style={{
                    position: 'relative',
                    width: '64px',
                    height: '34px',
                    borderRadius: '34px',
                    backgroundColor: isEnabled ? '#34C759' : 'var(--border-color)',
                    border: 'none',
                    cursor: (loading || isSaving) ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    outline: 'none',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    boxShadow: isEnabled ? '0 0 12px rgba(52, 199, 89, 0.35)' : 'none'
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
                      transform: isEnabled ? 'translateX(30px)' : 'translateX(0px)',
                      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Persistence and Reliability Architecture Note */}
      <div style={{
        marginTop: '2.5rem',
        padding: '1.25rem 1.5rem',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
        lineHeight: '1.6'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', color: 'var(--text-primary)', fontWeight: 600 }}>
          <Sparkles size={16} color="#0071E3" />
          <span>Global Persistence & Architecture Guarantees</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          <li>Settings are stored globally in the primary database and persist across browser refreshes, logouts, server restarts, and redeployments.</li>
          <li>Independent toggles: changing one section will not modify or override the state of the other two.</li>
          <li>When OFF, sections disappear from public navigation, homepage cards, and XML sitemaps, and direct route access yields a 404 response.</li>
          <li>Administrators retain full moderation access in this dashboard regardless of public visibility settings.</li>
        </ul>
      </div>
    </div>
  );
}
