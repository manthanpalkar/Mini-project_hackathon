import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, GraduationCap, BookOpen, Calendar, ArrowRight, ChevronDown } from 'lucide-react';
import { onboardUser } from '../utils/db';
import BRAND from '../constants/branding';

export default function Onboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Student');
  const [branch, setBranch] = useState('CSE');
  const [cseSpecialization, setCseSpecialization] = useState('CSE');
  const [currentYear, setCurrentYear] = useState('First Year');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getRedirectTarget = () => {
    let target = location.state?.redirectAfter || location.state?.from;
    if (target && typeof target === 'object' && target.pathname) {
      target = target.pathname + (target.search || '') + (target.hash || '');
    }
    if (!target) {
      try {
        target = sessionStorage.getItem('loop_redirect_after_login');
      } catch (e) {}
    }
    try {
      sessionStorage.removeItem('loop_redirect_after_login');
    } catch (e) {}
    if (!target || target === '/login' || target === '/onboarding' || target === '/') {
      return '/home';
    }
    return target;
  };

  useEffect(() => {
    const userSession = localStorage.getItem('loop_current_user');
    if (!userSession) {
      navigate('/login');
      return;
    }
    const parsed = JSON.parse(userSession);
    setCurrentUser(parsed);
    
    // If they are already onboarded or are admin, send them to destination
    if (parsed.onboarded || parsed.isAdmin) {
      navigate(getRedirectTarget(), { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    document.title = `${BRAND.name} | Student Onboarding`;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!currentUser || !currentUser.email) {
      setError('No active session found. Please log in again.');
      localStorage.removeItem('loop_current_user');
      setTimeout(() => navigate('/login'), 1500);
      return;
    }

    setLoading(true);
    try {
      const onboardedData = await onboardUser(currentUser.email, {
        name: name.trim(),
        role,
        branch: branch === 'CSE' ? cseSpecialization : branch,
        currentYear
      });

      // Save updated user session while strictly preserving active session token and refresh credentials
      const updatedSession = {
        ...currentUser,
        ...onboardedData,
        name: name.trim(),
        role: onboardedData.role || role,
        branch: branch === 'CSE' ? cseSpecialization : branch,
        currentYear: currentYear,
        onboarded: true,
        token: onboardedData.token || currentUser.token,
        refreshToken: onboardedData.refreshToken || currentUser.refreshToken,
        sessionId: onboardedData.sessionId || currentUser.sessionId
      };
      localStorage.setItem('loop_current_user', JSON.stringify(updatedSession));
      
      // Dispatch update to synchronize navbar and application state
      window.dispatchEvent(new CustomEvent('loop_login_success', { detail: updatedSession }));

      // Navigate to intended destination
      navigate(getRedirectTarget(), { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Decorative Blur */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 70%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Onboarding Card */}
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '450px',
        padding: '2.5rem 2rem',
        borderRadius: '24px',
        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.4)',
        zIndex: 1,
        position: 'relative'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: '800',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '0.4rem',
            fontFamily: 'var(--font-display)'
          }}>
            Welcome to {BRAND.name}
          </h1>
          <p style={{
            color: 'var(--accent-primary)',
            fontSize: '0.85rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            marginBottom: '0.5rem'
          }}>
            {BRAND.fullForm}
          </p>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            fontWeight: 400
          }}>
            {BRAND.tagline} Complete your student profile to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{
              backgroundColor: 'rgba(255, 69, 58, 0.1)',
              border: '1px solid rgba(255, 69, 58, 0.2)',
              color: '#ff453a',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              textAlign: 'left'
            }}>
              {error}
              {error.toLowerCase().includes('user not found') && (
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('loop_current_user');
                      navigate('/login');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-color)',
                      cursor: 'pointer',
                      fontWeight: '600',
                      padding: 0,
                      textDecoration: 'underline',
                      fontSize: '0.85rem'
                    }}
                  >
                    Click here to return to Login
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Name field */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="name-input">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
                pointerEvents: 'none'
              }} />
              <input
                id="name-input"
                type="text"
                className="input-field"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ paddingLeft: '2.75rem' }}
                disabled={loading}
              />
            </div>
          </div>

          {/* Role selection dropdown */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="role-select">I am a</label>
            <div style={{ position: 'relative' }}>
              <GraduationCap size={16} style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
                pointerEvents: 'none'
              }} />
              <select
                id="role-select"
                className="input-field"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{ 
                  paddingLeft: '2.75rem',
                  paddingRight: '2.5rem',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
                disabled={loading}
              >
                <option value="Student">Student</option>
                <option value="Senior / Contributor">Senior / Contributor</option>
                <option value="Alumni / Contributor">Alumni / Contributor</option>
              </select>
              <ChevronDown size={16} style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
                pointerEvents: 'none'
              }} />
            </div>
          </div>

          {/* Branch dropdown */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="branch-select">Branch</label>
            <div style={{ position: 'relative' }}>
              <BookOpen size={16} style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
                pointerEvents: 'none'
              }} />
              <select
                id="branch-select"
                className="input-field"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                style={{ 
                  paddingLeft: '2.75rem',
                  paddingRight: '2.5rem',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
                disabled={loading}
              >
                <option value="CSE">CSE</option>
                <option value="CE">CE</option>
                <option value="EXTC">EXTC</option>
              </select>
              <ChevronDown size={16} style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
                pointerEvents: 'none'
              }} />
            </div>
          </div>

          {/* CSE Specialization (dynamically shown if CSE selected) */}
          {branch === 'CSE' && (
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="cse-spec-select">Specialization</label>
              <div style={{ position: 'relative' }}>
                <BookOpen size={16} style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                  pointerEvents: 'none'
                }} />
                <select
                  id="cse-spec-select"
                  className="input-field"
                  value={cseSpecialization}
                  onChange={(e) => setCseSpecialization(e.target.value)}
                  style={{ 
                    paddingLeft: '2.75rem',
                    paddingRight: '2.5rem',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                  disabled={loading}
                >
                  <option value="CSE">CSE</option>
                  <option value="CSE AI">CSE AI</option>
                  <option value="CSE DS">CSE DS</option>
                </select>
                <ChevronDown size={16} style={{
                  position: 'absolute',
                  right: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                  pointerEvents: 'none'
                }} />
              </div>
            </div>
          )}

          {/* Current Year dropdown */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="year-select">Current Year</label>
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
                pointerEvents: 'none'
              }} />
              <select
                id="year-select"
                className="input-field"
                value={currentYear}
                onChange={(e) => setCurrentYear(e.target.value)}
                style={{ 
                  paddingLeft: '2.75rem',
                  paddingRight: '2.5rem',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
                disabled={loading}
              >
                <option value="First Year">First Year</option>
                <option value="Second Year">Second Year</option>
                <option value="Third Year">Third Year</option>
                <option value="Fourth Year">Fourth Year</option>
                <option value="Alumnus / Graduate">Alumnus / Graduate</option>
              </select>
              <ChevronDown size={16} style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
                pointerEvents: 'none'
              }} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              marginTop: '0.75rem',
              padding: '0.9rem',
              borderRadius: '12px',
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              border: 'none',
              backgroundColor: 'var(--accent-color)',
              color: 'var(--accent-inverse)',
              fontWeight: '600',
              cursor: 'pointer'
            }}
            disabled={loading}
          >
            {loading ? 'Submitting...' : (
              <>
                <span>Okay</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem', fontSize: '0.9rem' }}>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('loop_current_user');
              navigate('/login');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-color)',
              cursor: 'pointer',
              fontWeight: '500',
              padding: 0,
              textDecoration: 'underline'
            }}
          >
            Sign Out / Use another account
          </button>
        </div>
      </div>
    </div>
  );
}
