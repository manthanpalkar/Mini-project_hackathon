import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Shield, Menu, X, User as UserIcon, BookOpen, Calendar, ChevronDown, Lock, Palette, AtSign, Mail, MessageSquare } from 'lucide-react';
import { requestProfileEdit, updateUser, logoutUser, getStories, getResources, getFolders, getAchievements } from '../utils/db';
import { prefetchData } from '../hooks/useCachedData';
import FeedbackModal from './FeedbackModal';

// Preset palette colors for the user name badge
const PRESET_NAME_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Electric Blue', value: '#0071E3' },
  { name: 'Emerald', value: '#34C759' },
  { name: 'Amber Orange', value: '#FF9500' },
  { name: 'Crimson', value: '#FF3B30' },
  { name: 'Royal Purple', value: '#AF52DE' },
  { name: 'Vibrant Pink', value: '#FF2D55' },
  { name: 'Teal Cyan', value: '#5AC8FA' },
  { name: 'Volt Lime', value: '#A5D600' }
];

// Deterministic avatar hue/color based on email or user ID
const getRandomUserColor = (seed = '') => {
  if (!seed) return '#0071E3';
  const colors = [
    '#0071E3', // Blue
    '#34C759', // Green
    '#FF9500', // Orange
    '#AF52DE', // Purple
    '#FF2D55', // Pink
    '#5AC8FA', // Teal/Cyan
    '#5856D6', // Indigo
    '#FF3B30'  // Coral Red
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(() => {
    const currentUser = localStorage.getItem('loop_current_user');
    return currentUser ? JSON.parse(currentUser) : null;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Detect scroll position with hysteresis to smoothly trigger liquid glass pill mode
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 35) {
        setIsScrolled(true);
      } else if (currentScrollY < 15) {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Profile modal states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [branch, setBranch] = useState('CSE');
  const [cseSpecialization, setCseSpecialization] = useState('CSE');
  const [passoutYear, setPassoutYear] = useState('2026');
  const [nameColor, setNameColor] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Initialize profile form values when modal opens or user updates
  useEffect(() => {
    if (user && showProfileModal) {
      const activeBranch = user.hasPendingEdit ? user.pendingBranch : user.branch;
      const isCse = ['CSE', 'CSE AI', 'CSE DS'].includes(activeBranch);

      setName(user.hasPendingEdit ? user.pendingName : (user.name || ''));
      setUsername(user.username || '');
      setBranch(isCse ? 'CSE' : (activeBranch || 'CSE'));
      setCseSpecialization(isCse ? activeBranch : 'CSE');

      // Default to user's passoutYear or calculate from currentYear if present
      const rawYear = user.hasPendingEdit ? user.pendingCurrentYear : (user.passoutYear || user.currentYear || '2026');
      let defaultPassoutYear = '2026';
      if (rawYear && String(rawYear).match(/\d{4}/)) {
        defaultPassoutYear = String(rawYear);
      } else if (rawYear === 'First Year') defaultPassoutYear = '2028';
      else if (rawYear === 'Second Year') defaultPassoutYear = '2027';
      else if (rawYear === 'Third Year') defaultPassoutYear = '2026';
      else if (rawYear === 'Fourth Year') defaultPassoutYear = '2025';
      else if (rawYear === 'Alumnus / Graduate') defaultPassoutYear = '2024';

      setPassoutYear(defaultPassoutYear);
      setNameColor(user.nameColor || '');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setSuccess('');
    }
  }, [user, showProfileModal]);

  useEffect(() => {
    // Check for user session and synchronize across events and storage updates
    const syncUser = () => {
      try {
        const currentUser = localStorage.getItem('loop_current_user');
        setUser(currentUser ? JSON.parse(currentUser) : null);
      } catch (e) {
        setUser(null);
      }
    };

    syncUser();

    // Enforce light theme by default, just like Hinge
    document.documentElement.setAttribute('data-theme', 'light');

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
  }, [location]);

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    navigate('/login');
  };

  // Prevent background scrolling when Profile modal is open and handle Escape key
  useEffect(() => {
    if (showProfileModal) {
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      const handleKeyDown = (e) => {
        if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
          e.preventDefault();
          e.stopPropagation();
          setShowProfileModal(false);
          setError('');
          setSuccess('');
        }
      };

      // Listen on capture and bubble phases
      window.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('keydown', handleKeyDown, true);

      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
        window.removeEventListener('keydown', handleKeyDown, true);
        document.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, [showProfileModal]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Full Name is required');
      return;
    }

    if (username && !/^[a-zA-Z0-9_-]{3,30}$/.test(username.trim())) {
      setError('Username must be 3-30 characters and contain only letters, numbers, underscores, or hyphens.');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const selectedBranch = branch === 'CSE' ? cseSpecialization : branch;
      const isAdmin = user.isAdmin || user.role === 'Administrator' || user.role === 'Admin' || user.email?.toLowerCase() === 'admin@spit.ac.in';

      // 1. Update payload including nameColor & username
      const updatePayload = {
        name: name.trim(),
        username: username.trim(),
        branch: selectedBranch,
        currentYear: passoutYear,
        nameColor: nameColor || '',
        ...(newPassword ? { password: newPassword } : {})
      };

      let updatedUser = null;
      if (isAdmin) {
        // Direct update for admin
        const res = await updateUser(user.email, updatePayload);
        updatedUser = res.user || res;
      } else {
        // If password is changed, update password directly
        if (newPassword) {
          await updateUser(user.email, { password: newPassword });
        }
        // Direct update profile info directly
        try {
          const res = await updateUser(user.email, {
            name: name.trim(),
            username: username.trim(),
            branch: selectedBranch,
            currentYear: passoutYear,
            nameColor: nameColor || ''
          });
          updatedUser = res.user || res;
        } catch {
          // Fallback to requestProfileEdit if direct edit endpoint restricts
          updatedUser = await requestProfileEdit(user.email, {
            name: name.trim(),
            username: username.trim(),
            role: user.role || 'Student',
            branch: selectedBranch,
            currentYear: passoutYear,
            nameColor: nameColor || ''
          });
        }
      }

      // Update local storage session
      const newSession = {
        ...user,
        ...(updatedUser || {}),
        name: name.trim(),
        username: username.trim(),
        branch: selectedBranch,
        currentYear: passoutYear,
        passoutYear: passoutYear,
        nameColor: nameColor || '',
        hasPendingEdit: false,
        token: user.token,
        refreshToken: user.refreshToken,
        sessionId: user.sessionId,
        isAdmin: user.isAdmin,
        onboarded: true
      };
      localStorage.setItem('loop_current_user', JSON.stringify(newSession));
      setUser(newSession);

      setSuccess('Profile updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  // Do not display navbar on login page or onboarding page
  if (location.pathname === '/login' || location.pathname === '/onboarding') {
    return null;
  }

  const isActive = (path) => location.pathname === path;
  const isForgotPasswordPage = location.pathname === '/forgot-password';

  return (
    <>
      <header
        className="navbar-header-sticky"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        padding: isScrolled ? '12px 1rem 0 1rem' : '0',
        transition: 'padding 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <nav
        className={`liquid-glass-nav ${isScrolled ? 'scrolled-liquid-pill' : 'glass-panel'}`}
        style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: isScrolled ? '980px' : '100%',
          borderRadius: isScrolled ? '9999px' : '0px',
          borderTop: isScrolled ? '1px solid var(--liquid-pill-border)' : 'none',
          borderLeft: isScrolled ? '1px solid var(--liquid-pill-border)' : 'none',
          borderRight: isScrolled ? '1px solid var(--liquid-pill-border)' : 'none',
          borderBottom: isScrolled ? '1px solid var(--liquid-pill-border)' : '1px solid var(--border-color)',
          padding: isScrolled ? '0.68rem 1.8rem' : '1.1rem 0',
          minHeight: isScrolled ? '58px' : 'auto',
          boxShadow: isScrolled ? 'var(--liquid-pill-shadow)' : 'none',
          backgroundColor: isScrolled ? 'var(--liquid-pill-bg)' : 'var(--glass-bg)',
          backdropFilter: isScrolled ? 'blur(30px) saturate(190%) contrast(105%)' : 'blur(24px)',
          WebkitBackdropFilter: isScrolled ? 'blur(30px) saturate(190%) contrast(105%)' : 'blur(24px)',
          transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <div
          className="navbar-grid"
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            maxWidth: isScrolled ? '100%' : '1200px',
            margin: '0 auto',
            padding: isScrolled ? '0 0.6rem' : '0 2rem',
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* COLUMN 1: LEFT NAV LINKS (Desktop only) */}
          {!isForgotPasswordPage ? (
            <div className="nav-col-left" style={{
              display: 'flex',
              alignItems: 'center',
              gap: isScrolled ? '1.5rem' : '2rem',
              fontFamily: 'var(--font-sans)',
              fontSize: isScrolled ? '0.88rem' : '0.9rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
              transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              zIndex: 2
            }}>
              <Link
                to="/stories"
                onMouseEnter={() => {
                  import('../pages/Stories');
                  prefetchData('stories', getStories);
                }}
                style={{
                  color: isActive('/stories') ? 'var(--text-primary)' : 'var(--text-secondary)',
                  position: 'relative',
                  transition: 'color 0.2s ease'
                }}
              >
                Stories
                {isActive('/stories') && <span style={{ position: 'absolute', bottom: isScrolled ? '-11px' : '-21px', left: 0, right: 0, height: '2.5px', borderRadius: '2px', backgroundColor: 'var(--text-primary)', transition: 'bottom 0.35s ease' }} />}
              </Link>

              <Link
                to="/resources"
                onMouseEnter={() => {
                  import('../pages/Resources');
                  prefetchData('resources', getResources);
                  prefetchData('folders', getFolders);
                }}
                style={{
                  color: isActive('/resources') ? 'var(--text-primary)' : 'var(--text-secondary)',
                  position: 'relative',
                  transition: 'color 0.2s ease'
                }}
              >
                Resources
                {isActive('/resources') && <span style={{ position: 'absolute', bottom: isScrolled ? '-11px' : '-21px', left: 0, right: 0, height: '2.5px', borderRadius: '2px', backgroundColor: 'var(--text-primary)', transition: 'bottom 0.35s ease' }} />}
              </Link>

              <Link
                to="/achievements"
                onMouseEnter={() => {
                  import('../pages/Achievements');
                  prefetchData('achievements', getAchievements);
                }}
                style={{
                  color: isActive('/achievements') ? 'var(--text-primary)' : 'var(--text-secondary)',
                  position: 'relative',
                  transition: 'color 0.2s ease'
                }}
              >
                Achievements
                {isActive('/achievements') && <span style={{ position: 'absolute', bottom: isScrolled ? '-11px' : '-21px', left: 0, right: 0, height: '2.5px', borderRadius: '2px', backgroundColor: 'var(--text-primary)', transition: 'bottom 0.35s ease' }} />}
              </Link>
            </div>
          ) : (
            <div className="nav-col-left" style={{ display: 'flex', alignItems: 'center', zIndex: 2 }} />
          )}

          {/* COLUMN 2: CENTER LOGO - ALWAYS MATHEMATICALLY DEAD CENTER */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 3,
            pointerEvents: 'auto'
          }}>
            <Link
              to="/"
              onMouseEnter={() => {
                import('../pages/Landing');
              }}
              style={{
                fontSize: isScrolled ? '1.45rem' : '1.65rem',
                fontWeight: 800,
                fontFamily: 'var(--font-sans)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: isScrolled ? '0.35rem' : '0.4rem',
                marginRight: '-0.2em',
                transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <img
                src="/loop-logo.png"
                alt="LOOP Logo"
                style={{
                  height: isScrolled ? '24px' : '26px',
                  width: 'auto',
                  filter: 'var(--logo-filter)',
                  marginRight: '0.2rem',
                  transition: 'height 0.35s ease'
                }}
              />
              Loop
              <span style={{
                fontSize: isScrolled ? '0.52rem' : '0.55rem',
                letterSpacing: '0.02em',
                padding: '1px 5px',
                border: '1px solid var(--text-primary)',
                borderRadius: '4px',
                fontWeight: '700',
                transition: 'all 0.35s ease'
              }}>SPIT</span>
            </Link>
          </div>

          {/* COLUMN 3: RIGHT NAV ACTIONS (Desktop only) */}
          <div className="nav-col-right" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: isScrolled ? '0.75rem' : '1rem',
            fontFamily: 'var(--font-sans)',
            fontSize: isScrolled ? '0.86rem' : '0.9rem',
            fontWeight: 600,
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: 2
          }}>
            {user?.isAdmin && (
              <Link
                to="/admin"
                onMouseEnter={() => {
                  import('../pages/AdminDashboard');
                }}
                style={{
                  color: isActive('/admin') ? 'var(--text-primary)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: isScrolled ? '3px 10px' : '4px 12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '20px',
                  fontSize: isScrolled ? '0.8rem' : '0.84rem',
                  backgroundColor: isActive('/admin') ? 'var(--bg-tertiary)' : 'transparent',
                  transition: 'all 0.35s ease'
                }}
              >
                <Shield size={isScrolled ? 12 : 13} />
                <span>Admin</span>
              </Link>
            )}

            {user?.isAdmin && (
              <span style={{ color: 'var(--border-color)', userSelect: 'none' }}>•</span>
            )}

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: isScrolled ? '0.5rem' : '0.65rem' }}>
                {/* Profile Button with First Name & Custom User Color */}
                {(() => {
                  const effectiveColor = user?.nameColor || getRandomUserColor(user?.email || user?.id || user?.name || '');
                  return (
                    <button
                      type="button"
                      onClick={() => setShowProfileModal(true)}
                      className="btn"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.42rem',
                        padding: isScrolled ? '0.32rem 0.8rem' : '0.42rem 0.95rem',
                        borderRadius: '20px',
                        fontSize: isScrolled ? '0.78rem' : '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                        backgroundColor: `${effectiveColor}14`,
                        color: effectiveColor,
                        border: `1.5px solid ${effectiveColor}38`,
                        boxShadow: `0 2px 10px ${effectiveColor}1A`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${effectiveColor}24`;
                        e.currentTarget.style.borderColor = effectiveColor;
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = `${effectiveColor}14`;
                        e.currentTarget.style.borderColor = `${effectiveColor}38`;
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                      title="View & Edit Profile (Change Name Button Color)"
                    >
                      <UserIcon size={isScrolled ? 13 : 14} strokeWidth={2.4} style={{ color: effectiveColor }} />
                      <span style={{ color: effectiveColor, letterSpacing: '-0.01em' }}>
                        {user?.name?.trim() ? user.name.trim().split(/\s+/)[0] : 'Profile'}
                      </span>
                    </button>
                  );
                })()}

                {/* Feedback / Bug Report button */}
                <button
                  onClick={() => setShowFeedbackModal(true)}
                  className="btn btn-secondary"
                  style={{ padding: isScrolled ? '0.32rem 0.65rem' : '0.42rem 0.75rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: isScrolled ? '0.75rem' : '0.8rem', transition: 'all 0.35s ease' }}
                  title="Submit Feedback or Report Bug"
                >
                  <MessageSquare size={isScrolled ? 11 : 12} />
                  <span>Feedback</span>
                </button>

                {/* Exit / Logout button */}
                <button
                  onClick={handleLogout}
                  className="btn btn-secondary"
                  style={{ padding: isScrolled ? '0.32rem 0.7rem' : '0.42rem 0.8rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: isScrolled ? '0.75rem' : '0.8rem', transition: 'all 0.35s ease' }}
                  title="Log out"
                >
                  <LogOut size={11} />
                  <span>Exit</span>
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn btn-primary" style={{ padding: isScrolled ? '0.35rem 0.9rem' : '0.45rem 1.1rem', borderRadius: '20px', fontSize: isScrolled ? '0.75rem' : '0.8rem', transition: 'all 0.35s ease' }}>
                Login
              </Link>
            )}
          </div>

          {/* MOBILE MENU TOGGLE (Mobile only) */}
          <div className="mobile-nav-toggle" style={{ display: 'none' }}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="btn btn-secondary"
              style={{ padding: '0.5rem', borderRadius: '50%', border: 'none' }}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* MOBILE MENU DROPDOWN */}
        {mobileMenuOpen && (
          <div className="glass-panel animate-fade-in" style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            border: '1px solid var(--border-color)',
            borderRadius: isScrolled ? '24px' : '0 0 16px 16px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            pointerEvents: 'auto'
          }}>
          {!isForgotPasswordPage && (
            <>
              <Link to="/stories" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                Stories
              </Link>
              <Link to="/resources" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                Resources
              </Link>
              <Link to="/achievements" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                Achievements
              </Link>
            </>
          )}

          {user?.isAdmin && (
            <Link to="/admin" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={16} /> Admin Panel
            </Link>
          )}
          <hr style={{ border: 0, borderTop: '1px solid var(--border-color)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            {user ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {(() => {
                    const effectiveColor = user?.nameColor || getRandomUserColor(user?.email || user?.id || user?.name || '');
                    return (
                      <button
                        type="button"
                        onClick={() => { setShowProfileModal(true); setMobileMenuOpen(false); }}
                        className="btn"
                        style={{
                          padding: '0.45rem 0.95rem',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          borderRadius: '14px',
                          fontWeight: 700,
                          backgroundColor: `${effectiveColor}14`,
                          color: effectiveColor,
                          border: `1.5px solid ${effectiveColor}38`,
                          cursor: 'pointer'
                        }}
                      >
                        <UserIcon size={14} style={{ color: effectiveColor }} strokeWidth={2.4} />
                        <span style={{ color: effectiveColor }}>
                          {user?.name?.trim() ? user.name.trim().split(/\s+/)[0] : 'Profile'}
                        </span>
                      </button>
                    );
                  })()}
                  <span
                    className="badge"
                    style={{
                      textTransform: 'none',
                      fontSize: '0.8rem',
                      padding: '0.3rem 0.75rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '20px',
                      fontWeight: 600,
                      pointerEvents: 'none'
                    }}
                  >
                    {user.role || 'Student'}
                  </span>
                </div>
                <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="btn btn-secondary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '14px' }}>
                  <LogOut size={13} /> Exit
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="btn btn-primary" style={{ padding: '0.5rem 1rem', width: '100%', textAlign: 'center' }}>
                Login
              </Link>
            )}
          </div>
        </div>
      )}
      </nav>

      {/* Inline styles for responsive grid */}
      <style>{`
        @media (max-width: 900px) {
          .navbar-grid {
            grid-template-columns: 1fr auto !important;
          }
          .nav-col-left, .nav-col-right {
            display: none !important;
          }
          .mobile-nav-toggle {
            display: flex !important;
            justify-content: flex-end;
          }
        }
      `}</style>
    </header>

    {/* Profile Modal - Clean Portal Overlay (outside header to avoid any pointer-events interference) */}
    {showProfileModal && typeof document !== 'undefined' && createPortal(
      <div
        onClick={() => { setShowProfileModal(false); setError(''); setSuccess(''); }}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(30px) saturate(190%)',
          WebkitBackdropFilter: 'blur(30px) saturate(190%)',
          zIndex: 100000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2.5rem 1rem',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          pointerEvents: 'auto'
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="animate-fade-in custom-scrollbar"
          style={{
            margin: 'auto',
            width: '100%',
            maxWidth: '680px',
            borderRadius: '28px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.28), 0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            maxHeight: 'calc(100vh - 4rem)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            position: 'relative',
            padding: '2.75rem 2.5rem 2.25rem 2.5rem',
            pointerEvents: 'auto'
          }}
        >
          {/* Close Button - Apple Style Circle Button (Cross) */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowProfileModal(false);
              setError('');
              setSuccess('');
            }}
            style={{
              position: 'absolute',
              top: '1.5rem',
              right: '1.5rem',
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              pointerEvents: 'auto',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--text-primary)';
              e.currentTarget.style.color = 'var(--bg-surface)';
              e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            aria-label="Close Profile"
            title="Close (Esc)"
          >
            <X size={20} strokeWidth={2.2} style={{ pointerEvents: 'none' }} />
          </button>

          {/* Header Banner - Matching Share Your Journey */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.3rem 0.75rem',
              borderRadius: '20px',
              backgroundColor: 'rgba(212, 255, 50, 0.22)',
              border: '1px solid rgba(212, 255, 50, 0.45)',
              color: 'var(--text-primary)',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '0.75rem'
            }}>
              Account & Profile Settings
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>
              User Profile
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span>{user?.email}</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span style={{
                display: 'inline-block',
                padding: '0.15rem 0.55rem',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}>
                {user?.role || 'Student'}
              </span>
            </p>
          </div>

          {user?.hasPendingEdit && (
            <div style={{
              backgroundColor: 'rgba(255, 149, 0, 0.12)',
              border: '1px solid rgba(255, 149, 0, 0.3)',
              color: '#ff9500',
              borderRadius: '16px',
              padding: '0.85rem 1.15rem',
              fontSize: '0.82rem',
              marginBottom: '1.5rem',
              textAlign: 'left',
              fontWeight: 500,
              lineHeight: 1.45
            }}>
              ⚠️ <strong>Pending Request:</strong> Your previous profile edit request is currently under review by the administrator.
            </div>
          )}

          {error && (
            <div style={{
              backgroundColor: 'rgba(255, 69, 58, 0.12)',
              border: '1px solid rgba(255, 69, 58, 0.3)',
              color: '#ff453a',
              borderRadius: '16px',
              padding: '0.85rem 1.15rem',
              fontSize: '0.82rem',
              marginBottom: '1.5rem',
              textAlign: 'left',
              fontWeight: 500
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              backgroundColor: 'rgba(52, 199, 89, 0.12)',
              border: '1px solid rgba(52, 199, 89, 0.3)',
              color: '#34c759',
              borderRadius: '16px',
              padding: '0.85rem 1.15rem',
              fontSize: '0.82rem',
              marginBottom: '1.5rem',
              textAlign: 'center',
              fontWeight: 600
            }}>
              ✓ {success}
            </div>
          )}

          <form onSubmit={handleProfileSubmit}>
            {/* Card 1: Academic & Personal Details */}
            <div style={{
              padding: '1.5rem 1.75rem',
              borderRadius: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 800
                }}>1</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, color: 'var(--text-primary)' }}>
                  Academic & Personal Details
                </h3>
              </div>

              {/* Email (Read-Only) */}
              <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="input-label">SPIT Email Address</label>
                  <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Shield size={12} /> Verified • Read-Only
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)',
                    pointerEvents: 'none'
                  }} />
                  <input
                    type="email"
                    className="input-field"
                    value={user?.email || ''}
                    readOnly
                    disabled
                    style={{
                      paddingLeft: '2.75rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      cursor: 'not-allowed',
                      opacity: 0.85
                    }}
                  />
                </div>
              </div>

              {/* Name and Username Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                {/* Name */}
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Full Name *</label>
                  <div style={{ position: 'relative' }}>
                    <UserIcon size={16} style={{
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-secondary)',
                      pointerEvents: 'none'
                    }} />
                    <input
                      type="text"
                      className="input-field"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={{ paddingLeft: '2.75rem', cursor: 'text' }}
                      disabled={loading}
                      placeholder="e.g. John Doe"
                      required
                    />
                  </div>
                </div>

                {/* Username */}
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="input-label">Username</label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>3-30 chars</span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <AtSign size={16} style={{
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-secondary)',
                      pointerEvents: 'none'
                    }} />
                    <input
                      type="text"
                      className="input-field"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      style={{ paddingLeft: '2.75rem', cursor: 'text' }}
                      disabled={loading}
                      placeholder="e.g. aditya_patil"
                    />
                  </div>
                </div>
              </div>

              {/* Branch, Specialization, Passout Year Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: branch === 'CSE' ? 'repeat(auto-fit, minmax(160px, 1fr))' : 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem'
              }}>
                {/* Branch select */}
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Branch *</label>
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
                        cursor: loading ? 'not-allowed' : 'pointer'
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

                {/* Sub-Category (if CSE) */}
                {branch === 'CSE' && (
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Sub-Category *</label>
                    <div style={{ position: 'relative' }}>
                      <select
                        className="input-field"
                        value={cseSpecialization}
                        onChange={(e) => setCseSpecialization(e.target.value)}
                        style={{
                          paddingRight: '2.5rem',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                        disabled={loading}
                      >
                        <option value="CSE">CSE</option>
                        <option value="CSE AI">AI</option>
                        <option value="CSE DS">DS</option>
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

                {/* Passout Year input */}
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Which year are you / Passout Year *</label>
                  <div style={{ position: 'relative' }}>
                    <Calendar size={16} style={{
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-secondary)',
                      pointerEvents: 'none'
                    }} />
                    <input
                      type="number"
                      className="input-field"
                      placeholder="2026"
                      value={passoutYear}
                      onChange={(e) => setPassoutYear(e.target.value)}
                      style={{ paddingLeft: '2.75rem', cursor: 'text' }}
                      disabled={loading}
                      required
                      min="2000"
                      max="2035"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Name Button Color & Appearance */}
            <div style={{
              padding: '1.5rem 1.75rem',
              borderRadius: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--text-primary)',
                    color: 'var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800
                  }}>2</div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, color: 'var(--text-primary)' }}>
                    Name Button Color
                  </h3>
                </div>

                {/* Live Preview of Button */}
                {(() => {
                  const previewColor = nameColor || getRandomUserColor(user?.email || user?.id || name || '');
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>Live Preview:</span>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.28rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        backgroundColor: `${previewColor}14`,
                        color: previewColor,
                        border: `1.5px solid ${previewColor}38`,
                        boxShadow: `0 2px 8px ${previewColor}1A`
                      }}>
                        <UserIcon size={13} strokeWidth={2.4} style={{ color: previewColor }} />
                        <span>{name.trim() ? name.trim().split(/\s+/)[0] : 'Profile'}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 1.15rem 0', lineHeight: 1.45 }}>
                Personalize your navbar button. Choose a color from the palette, select your own custom shade, or keep it on default (random assigned color).
              </p>

              {/* Color Presets Grid */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {PRESET_NAME_COLORS.map(p => {
                  const isSelected = nameColor.toLowerCase() === p.value.toLowerCase();
                  if (!p.value) {
                    // Default / Remove Color button
                    return (
                      <button
                        key="default-random"
                        type="button"
                        onClick={() => setNameColor('')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '16px',
                          border: isSelected ? '1.5px solid var(--text-primary)' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'var(--text-primary)' : 'var(--bg-secondary)',
                          color: isSelected ? 'var(--bg-surface)' : 'var(--text-primary)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        title="Remove custom color and use automatic random color"
                      >
                        <span>Default (Random)</span>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setNameColor(p.value)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: p.value,
                        border: isSelected ? '3px solid var(--bg-surface)' : '2px solid transparent',
                        boxShadow: isSelected ? `0 0 0 2px ${p.value}, 0 4px 10px ${p.value}40` : '0 2px 5px rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                        transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF'
                      }}
                      title={`${p.name} (${p.value})`}
                    >
                      {isSelected ? '✓' : ''}
                    </button>
                  );
                })}
              </div>

              {/* Custom Color Input / Picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Palette size={15} style={{ color: nameColor || 'var(--accent-primary)' }} /> Custom Color Picker:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="color"
                    value={nameColor || '#0071E3'}
                    onChange={(e) => setNameColor(e.target.value)}
                    style={{
                      width: '36px',
                      height: '32px',
                      padding: 0,
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: 'transparent'
                    }}
                    title="Click to pick any hex color"
                  />
                  <input
                    type="text"
                    placeholder="#0071E3"
                    value={nameColor}
                    onChange={(e) => setNameColor(e.target.value)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.82rem',
                      width: '90px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace'
                    }}
                  />
                  {nameColor && (
                    <button
                      type="button"
                      onClick={() => setNameColor('')}
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                      title="Reset back to default random color"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Card 3: Security & Password Change */}
            <div style={{
              padding: '1.5rem 1.75rem',
              borderRadius: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              marginBottom: '1.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 800
                }}>3</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, color: 'var(--text-primary)' }}>
                  Security & Password
                </h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 1.25rem 0' }}>
                Leave blank if you do not want to change your current password.
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem'
              }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-secondary)',
                      pointerEvents: 'none'
                    }} />
                    <input
                      type="password"
                      className="input-field"
                      placeholder="New password (min 6 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ paddingLeft: '2.75rem', cursor: 'text' }}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Confirm New Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-secondary)',
                      pointerEvents: 'none'
                    }} />
                    <input
                      type="password"
                      className="input-field"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{ paddingLeft: '2.75rem', cursor: 'text' }}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => { setShowProfileModal(false); setError(''); setSuccess(''); }}
                style={{
                  flex: 1,
                  padding: '0.9rem',
                  borderRadius: '14px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  flex: 2,
                  padding: '0.9rem',
                  borderRadius: '14px',
                  border: 'none',
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-inverse)',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.2s'
                }}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save & Update Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )}

    {/* User Feedback & Bug Reporting Modal */}
    <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
  </>
  );
}
