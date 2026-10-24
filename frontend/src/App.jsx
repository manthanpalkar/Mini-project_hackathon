import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import Navbar from './components/Navbar';
import { UploadProvider } from './context/UploadContext';
import UploadDock from './components/UploadDock';
import ErrorBoundary from './components/ErrorBoundary';
import BRAND from './constants/branding';

// Resilient code-splitting with automatic reload on stale chunk deployment
function lazyWithRetry(componentImport) {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      const isChunkError = 
        error?.name === 'ChunkLoadError' || 
        error?.message?.includes('dynamically imported module') ||
        error?.message?.includes('Failed to fetch');
      
      const retryKey = 'loop_chunk_retry_' + window.location.pathname;
      const alreadyRetried = sessionStorage.getItem(retryKey);

      if (isChunkError && !alreadyRetried) {
        sessionStorage.setItem(retryKey, 'true');
        window.location.reload();
        return new Promise(() => {}); // Wait for reload
      }
      throw error;
    }
  });
}

// Route-level code-splitting with React.lazy for instant initial page loads
const Login = lazyWithRetry(() => import('./pages/Login'));
const Landing = lazyWithRetry(() => import('./pages/Landing'));
const Stories = lazyWithRetry(() => import('./pages/Stories'));
const StoryDetail = lazyWithRetry(() => import('./pages/StoryDetail'));
const Resources = lazyWithRetry(() => import('./pages/Resources'));
const Achievements = lazyWithRetry(() => import('./pages/Achievements'));
const AchievementDetail = lazyWithRetry(() => import('./pages/AchievementDetail'));
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));
const Onboarding = lazyWithRetry(() => import('./pages/Onboarding'));
const FilePreviewPage = lazyWithRetry(() => import('./pages/FilePreviewPage'));
const PrivacyPolicy = lazyWithRetry(() => import('./pages/PrivacyPolicy'));
const TermsOfUse = lazyWithRetry(() => import('./pages/TermsOfUse'));
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'));

// Lightweight Apple-style Route Loading Fallback
function RouteLoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '0.75rem',
      color: 'var(--text-secondary)'
    }}>
      <div style={{
        width: '28px',
        height: '28px',
        border: '2px solid var(--border-color)',
        borderTopColor: 'var(--text-primary)',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite'
      }} />
    </div>
  );
}

// Route Guard Component
function ProtectedRoute({ children }) {
  const userSession = localStorage.getItem('loop_current_user');
  const location = useLocation();

  if (!userSession) {
    try {
      const fullPath = location.pathname + location.search + location.hash;
      if (fullPath && fullPath !== '/' && fullPath !== '/login' && fullPath !== '/home') {
        sessionStorage.setItem('loop_redirect_after_login', fullPath);
      }
    } catch (e) {}

    // Redirect to login while saving the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  let user = null;
  try {
    user = JSON.parse(userSession);
  } catch (e) {
    localStorage.removeItem('loop_current_user');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user || (!user.token && !user.refreshToken)) {
    localStorage.removeItem('loop_current_user');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // If not onboarded, not an admin, and not currently on the onboarding page, redirect to onboarding
  const isOnboarded = Boolean(user.onboarded || (user.name && user.branch) || user.isAdmin);
  if (!isOnboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" state={{ from: location }} replace />;
  }

  return children;
}

// Layout wrapper to easily render footer and manage pages
function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/onboarding' || location.pathname === '/forgot-password';
  const isPreviewPage = location.pathname.startsWith('/preview');

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname]);

  // Smooth SPA authentication expiration navigation & cross-tab synchronization
  useEffect(() => {
    const handleAuthExpired = () => {
      if (!location.pathname.includes('/login')) {
        navigate('/login', { replace: true, state: { message: 'Your session has expired. Please sign in again.' } });
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === 'loop_current_user') {
        if (!e.newValue && !location.pathname.includes('/login')) {
          navigate('/login', { replace: true, state: { message: 'You have signed out in another tab.' } });
        } else if (e.newValue && e.oldValue) {
          try {
            const oldUser = JSON.parse(e.oldValue);
            const newUser = JSON.parse(e.newValue);
            if (oldUser?.email && newUser?.email && oldUser.email.toLowerCase() !== newUser.email.toLowerCase()) {
              window.dispatchEvent(new CustomEvent('loop_login_success', { detail: newUser }));
              navigate('/home', { replace: true });
            }
          } catch (parseErr) {}
        }
      }
    };

    window.addEventListener('loop_auth_expired', handleAuthExpired);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('loop_auth_expired', handleAuthExpired);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [navigate, location.pathname]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)'
    }}>
      {!isPreviewPage && <Navbar />}
      
      <main style={{ flexGrow: 1 }}>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* Public Login & Auth Redirection Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route path="/request-account" element={<Navigate to="/login" replace />} />

            {/* Dedicated Public Legal & Documentation Routes */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfUse />} />

            {/* Onboarding Route (requires login but not completed onboarding) */}
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            } />

            {/* Dedicated Full-Viewport File Preview Route */}
            <Route path="/preview/:id" element={
              <ProtectedRoute>
                <FilePreviewPage />
              </ProtectedRoute>
            } />

            {/* Public Canonical Content Routes (Crawleable & Accessible) */}
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Landing />} />
            <Route path="/stories" element={<Stories />} />
            <Route path="/stories/:id" element={<StoryDetail />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/achievements/:id" element={<AchievementDetail />} />

            {/* Authenticated Administrative & Management Routes */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            {/* Catch-all Redirect */}
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* Global Background Upload Dock (hidden during full-screen preview) */}
      {!isPreviewPage && <UploadDock />}

      {/* Modern Monochrome Footer */}
      {!isAuthPage && !isPreviewPage && (
        <footer style={{
          borderTop: '1px solid var(--border-color)',
          padding: '3rem 0',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-secondary)',
          fontSize: '0.85rem'
        }}>
          <div className="container" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.5rem'
          }}>
            <div>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', letterSpacing: '0.02em' }}>
                {BRAND.fullName}
              </p>
              <p>{BRAND.tagline} Designed for educational mentoring and peer placement guidance.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Link 
                to="/privacy-policy" 
                className="btn-text"
                style={{ 
                  color: location.pathname === '/privacy-policy' ? 'var(--text-primary)' : 'inherit', 
                  textDecoration: 'none', 
                  fontWeight: location.pathname === '/privacy-policy' ? 600 : 500,
                  transition: 'color 0.2s ease' 
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => {
                  if (location.pathname !== '/privacy-policy') e.currentTarget.style.color = 'inherit';
                }}
              >
                Privacy Policy
              </Link>
              <Link 
                to="/terms" 
                className="btn-text"
                style={{ 
                  color: location.pathname === '/terms' ? 'var(--text-primary)' : 'inherit', 
                  textDecoration: 'none', 
                  fontWeight: location.pathname === '/terms' ? 600 : 500,
                  transition: 'color 0.2s ease' 
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => {
                  if (location.pathname !== '/terms') e.currentTarget.style.color = 'inherit';
                }}
              >
                Terms of Use
              </Link>
              <a 
                href="https://www.spit.ac.in/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-text"
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.35rem', 
                  color: 'inherit', 
                  textDecoration: 'none', 
                  fontWeight: 500,
                  transition: 'color 0.2s ease' 
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'inherit'}
                title="Open official Sardar Patel Institute of Technology website in a new tab"
              >
                <span>SPIT Portal</span>
                <ExternalLink size={13} strokeWidth={2.2} />
              </a>
            </div>
          </div>
          <div className="container" style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)'
          }}>
            <p style={{ margin: 0, opacity: 0.75 }}>
              © 2026 Loop. Created exclusively for Sardar Patel Institute of Technology.
            </p>
            <p style={{ 
              margin: 0, 
              fontSize: '0.925rem', 
              fontWeight: 600, 
              color: 'var(--text-primary)',
              letterSpacing: '0.01em'
            }}>
              Developed by Swapnil Patil
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}

function SplashIntro() {
  const [visible, setVisible] = React.useState(() => {
    // Only show splash once per browser session to prevent blocking page refreshes
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return !sessionStorage.getItem('loop_splash_shown');
    }
    return true;
  });
  const [fading, setFading] = React.useState(false);

  React.useEffect(() => {
    if (!visible) return;
    try {
      sessionStorage.setItem('loop_splash_shown', 'true');
    } catch (e) {}

    // Hide scrollbar on mount to avoid the right white line (scrollbar gutter) during splash animation
    document.body.style.overflow = 'hidden';

    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 1800);

    const removeTimer = setTimeout(() => {
      setVisible(false);
      // Restore scrollbar once splash is fully removed
      document.body.style.overflow = '';
    }, 2500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
      document.body.style.overflow = '';
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className={`splash-container ${fading ? 'fade-out' : ''}`}>
      <div className="splash-logo">LOOP</div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ErrorBoundary>
        <UploadProvider>
          <SplashIntro />
          <AppLayout />
        </UploadProvider>
      </ErrorBoundary>
    </Router>
  );
}
