import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Check, ShieldCheck, ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
import { loginUser, verifyGoogleAuth, signupWithGoogle, linkGoogleAccount } from '../utils/db';
import { clearAllCaches } from '../hooks/useCachedData';
import SEOHead from '../components/SEOHead';
import BRAND from '../constants/branding';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Redirect /login?mode=register cleanly to /login
  useEffect(() => {
    if (searchParams.has('mode')) {
      searchParams.delete('mode');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [infoNotice, setInfoNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Google OAuth States
  const [googleAuthStep, setGoogleAuthStep] = useState('IDLE'); // 'IDLE' | 'SIGNUP' | 'LINK'
  const [googleIdToken, setGoogleIdToken] = useState('');
  const [googleSignupData, setGoogleSignupData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const googleButtonRef = useRef(null);
  const [isGoogleAvailable, setIsGoogleAvailable] = useState(false);

  // Helper to validate and sanitize redirect destinations against open redirects (OWASP ASVS 5.1.5)
  const sanitizeRedirectUrl = (url) => {
    if (!url || typeof url !== 'string') return '/';
    const trimmed = url.trim();
    if (
      !trimmed.startsWith('/') ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/\\') ||
      trimmed.includes('://')
    ) {
      return '/';
    }
    if (trimmed === '/login' || trimmed === '/onboarding' || trimmed === '/home') {
      return '/';
    }
    return trimmed;
  };

  // Helper to resolve redirect destination
  const getRedirectUrl = useCallback(() => {
    let target = null;
    const fromState = location.state?.from;
    if (fromState) {
      if (typeof fromState === 'string') {
        target = fromState;
      } else if (fromState.pathname) {
        target = fromState.pathname + (fromState.search || '') + (fromState.hash || '');
      }
    }

    if (!target) {
      target = searchParams.get('redirect') || searchParams.get('returnUrl');
    }

    if (!target) {
      try {
        target = sessionStorage.getItem('loop_redirect_after_login');
      } catch {
        // Ignore sessionStorage access errors
      }
    }

    try {
      sessionStorage.removeItem('loop_redirect_after_login');
    } catch {
      // Ignore sessionStorage removal errors
    }

    return sanitizeRedirectUrl(target);
  }, [location.state?.from, searchParams]);

  useEffect(() => {
    const fromState = location.state?.from;
    if (fromState) {
      const path = typeof fromState === 'string' ? fromState : fromState.pathname + (fromState.search || '') + (fromState.hash || '');
      const safePath = sanitizeRedirectUrl(path);
      if (safePath && safePath !== '/') {
        try {
          sessionStorage.setItem('loop_redirect_after_login', safePath);
        } catch {
          // Ignore storage errors
        }
      }
    }
    const redirectParam = searchParams.get('redirect') || searchParams.get('returnUrl');
    if (redirectParam) {
      const safeRedirect = sanitizeRedirectUrl(redirectParam);
      if (safeRedirect && safeRedirect !== '/') {
        try {
          sessionStorage.setItem('loop_redirect_after_login', safeRedirect);
        } catch {
          // Ignore storage errors
        }
      }
    }
  }, [location.state, searchParams]);

  useEffect(() => {
    if (location.state?.infoMessage) {
      setError(location.state.infoMessage);
    } else if (location.state?.error) {
      setError(location.state.error);
    }
  }, [location.state]);

  useEffect(() => {
    document.title = `Login | ${BRAND.fullName}`;
    setEmail('');
    setPassword('');
    const timer = setTimeout(() => {
      setEmail('');
      setPassword('');
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const userSession = localStorage.getItem('loop_current_user');
    if (userSession) {
      try {
        const parsed = JSON.parse(userSession);
        const targetUrl = getRedirectUrl();
        const isOnboarded = Boolean(parsed.onboarded || (parsed.name && parsed.branch) || parsed.isAdmin);
        if (isOnboarded) {
          navigate(targetUrl, { replace: true });
        } else {
          navigate('/onboarding', { replace: true, state: { redirectAfter: targetUrl } });
        }
      } catch {
        localStorage.removeItem('loop_current_user');
      }
    }
  }, [navigate, getRedirectUrl]);

  const handleLoginSuccess = useCallback((userData) => {
    clearAllCaches();
    localStorage.setItem('loop_current_user', JSON.stringify(userData));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('loop_login_success', { detail: userData }));
    }
    setTimeout(() => {
      const targetUrl = getRedirectUrl();
      const isOnboarded = Boolean(userData.onboarded || (userData.name && userData.branch) || userData.isAdmin);
      if (isOnboarded) {
        navigate(targetUrl, { replace: true });
      } else {
        navigate('/onboarding', { replace: true, state: { redirectAfter: targetUrl } });
      }
    }, 400);
  }, [getRedirectUrl, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setInfoNotice('');

    const trimmedInput = email.trim();
    if (!trimmedInput) {
      setError('Please enter your SPIT email or username');
      return;
    }

    if (trimmedInput.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedInput)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      const userData = await loginUser(trimmedInput, password);
      handleLoginSuccess(userData);
    } catch (err) {
      if (err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
        setError('Network or server connection error. Please try again.');
      } else {
        setError(err.message || 'Invalid username/email or password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '779605241663-vp20b6cbhoccdeibjlcbtp7d9kbcf5bu.apps.googleusercontent.com';

  const handleGoogleCredentialResponse = useCallback(async (response) => {
    const idToken = response?.credential;
    if (!idToken) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');
    setInfoNotice('');

    try {
      const result = await verifyGoogleAuth(idToken);

      if (result.action === 'LOGIN_SUCCESS') {
        handleLoginSuccess(result);
      } else if (result.action === 'NEEDS_SIGNUP') {
        setGoogleIdToken(idToken);
        setGoogleSignupData({
          name: result.name || '',
          email: result.email,
          username: '',
          password: '',
          confirmPassword: ''
        });
        setGoogleAuthStep('SIGNUP');
      } else if (result.action === 'LINK_REQUIRED') {
        setGoogleIdToken(idToken);
        setLinkEmail(result.email);
        setLinkPassword('');
        setGoogleAuthStep('LINK');
      }
    } catch (err) {
      setError(err.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  }, [handleLoginSuccess]);

  useEffect(() => {
    let checkTimer = null;
    let isMounted = true;

    const setupGoogle = () => {
      if (!isMounted) return;
      if (window.google?.accounts?.id && googleClientId && !googleClientId.includes('your-google-client-id')) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
          });

          if (googleButtonRef.current) {
            window.google.accounts.id.renderButton(googleButtonRef.current, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 380
            });
            setIsGoogleAvailable(true);
          }

          window.google.accounts.id.prompt(() => {});
        } catch (e) {
          console.warn('Google Identity Services initialization error:', e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      setupGoogle();
    } else {
      checkTimer = setInterval(() => {
        if (window.google?.accounts?.id) {
          setupGoogle();
          clearInterval(checkTimer);
        }
      }, 250);
    }

    return () => {
      isMounted = false;
      if (checkTimer) clearInterval(checkTimer);
    };
  }, [googleClientId, googleAuthStep, handleGoogleCredentialResponse]);

  const handleGoogleSignInClick = () => {
    setError('');
    setSuccessMsg('');
    setInfoNotice('');

    if (window.google?.accounts?.id && googleClientId && !googleClientId.includes('your-google-client-id')) {
      try {
        window.google.accounts.id.prompt();
      } catch (e) {
        console.warn('Google prompt error:', e);
        setError('Unable to open Google Sign-In. Please check your browser settings.');
      }
    } else if (!googleClientId || googleClientId.includes('your-google-client-id')) {
      setError('Google Sign-In is not configured. Please set VITE_GOOGLE_CLIENT_ID.');
    } else {
      setError('Google Identity Services is loading. Please try again in a moment.');
    }
  };

  const handleSignupPrompt = () => {
    setInfoNotice('To create an account, sign in using "Continue with Google" using your official SPIT email (@spit.ac.in). Your student account will be activated instantly.');
    setError('');
  };

  const handleGoogleSignupSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!googleSignupData.name.trim()) {
      setError('Full Name is required.');
      return;
    }
    if (!googleSignupData.password || googleSignupData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (googleSignupData.password !== googleSignupData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const autoUsername = googleSignupData.email
        ? googleSignupData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30)
        : `spit_user_${Date.now().toString().slice(-4)}`;

      const result = await signupWithGoogle({
        idToken: googleIdToken,
        name: googleSignupData.name.trim(),
        username: autoUsername,
        password: googleSignupData.password,
        confirmPassword: googleSignupData.confirmPassword
      });

      handleLoginSuccess(result);
    } catch (err) {
      setError(err.message || 'Registration is temporarily unavailable. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLinkSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!linkPassword) {
      setError('Password is required to link your account.');
      return;
    }

    setLoading(true);

    try {
      const result = await linkGoogleAccount({
        idToken: googleIdToken,
        password: linkPassword
      });

      handleLoginSuccess(result);
    } catch (err) {
      setError(err.message || 'Failed to link Google account.');
    } finally {
      setLoading(false);
    }
  };

  // LOOP Core Features list (matching GitHub screenshot's left checklist)
  const productFeatures = [
    {
      title: "Senior Placement Debriefs",
      desc: "Read real interview rounds, technical coding questions, and CTC breakdowns from SPIT alumni."
    },
    {
      title: "Curated Academic & Placement Repository",
      desc: "Branch-wise semester notes, lab manuals, and syllabus roadmaps in one centralized archive."
    },
    {
      title: "Private & Community Resource Folders",
      desc: "Organize personal preparation materials securely with cloud storage and folder permissions."
    },
    {
      title: "SPIT Hall of Fame & Achievements",
      desc: "Stay inspired with campus hackathon victories, research breakthroughs, and placement honors."
    },
    {
      title: "Student-Verified Institutional Platform",
      desc: "Protected campus ecosystem built exclusively for Sardar Patel Institute of Technology students."
    }
  ];

  return (
    <div className="github-split-layout">
      <SEOHead 
        title={`Sign In | ${BRAND.fullName}`}
        description={`${BRAND.tagline} Sign in to ${BRAND.name} with your Sardar Patel Institute of Technology student account or Google authentication.`}
        canonicalUrl="/login"
        noIndex={true}
      />

      {/* ========================================================================= */}
      {/* LEFT PANEL: PURE BLACK (#000000) WITH BRANDING, CHECKLIST & AMBIENT GLOW  */}
      {/* ========================================================================= */}
      <aside className="github-left-panel">
        {/* Ambient Top Glow */}
        <div className="left-panel-glow" aria-hidden="true" />

        <div className="left-panel-content">
          {/* Header Brand Mark */}
          <div className="left-brand-row">
            <Link to="/" className="left-brand-logo-link" title="LOOP Home">
              <img 
                src="/loop-logo.png" 
                alt="LOOP Logo" 
                className="left-brand-logo"
              />
              <span className="left-brand-title">{BRAND.name}</span>
            </Link>
            <span className="left-brand-badge">SPIT</span>
          </div>

          {/* Large Bold White Heading */}
          <h1 className="left-heading">
            Empower your placement journey
          </h1>

          {/* Supporting Description */}
          <p className="left-description">
            Explore LOOP’s verified placement debriefs, interview preparation, and curated academic resources for SPIT students.
          </p>

          {/* Collapsible Section Label */}
          <div className="left-section-label">
            <span>See what's included</span>
            <ChevronDown size={14} className="left-chevron-icon" />
          </div>

          {/* 5 Product Features Checklist */}
          <ul className="left-features-list">
            {productFeatures.map((feature, idx) => (
              <li key={idx} className="left-feature-item">
                <span className="left-check-icon-wrapper" aria-hidden="true">
                  <Check size={13} strokeWidth={2.8} className="left-check-icon" />
                </span>
                <div className="left-feature-text">
                  <h2 className="left-feature-title">{feature.title}</h2>
                  <p className="left-feature-desc">{feature.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom Ambient Glow & Platform Highlights */}
        <div className="left-illustration-container">
          <div className="stars-layer" aria-hidden="true" />
          <div className="cosmic-glow-purple" aria-hidden="true" />
          <div className="cosmic-glow-blue" aria-hidden="true" />

          {/* Floating Metric Badges */}
          <div className="floating-badge badge-left">
            <span className="badge-dot dot-green" />
            <span>430+ Interview Stories</span>
          </div>
          <div className="floating-badge badge-right">
            <ShieldCheck size={12} className="badge-shield" />
            <span>100% SPIT Verified</span>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* RIGHT PANEL: CRISP WHITE (#FFFFFF) WITH CENTERED FORM & GITHUB STYLING   */}
      {/* ========================================================================= */}
      <main className="github-right-panel">
        {/* Top-Right Account Registration Link */}
        <header className="right-top-nav">
          <span className="top-nav-text">Don’t have an account?</span>
          <button 
            type="button" 
            onClick={handleSignupPrompt} 
            className="top-nav-link"
          >
            Sign up <span aria-hidden="true">→</span>
          </button>
        </header>

        {/* Centered Form Wrapper */}
        <div className="form-center-container">
          {/* Form Heading */}
          <div className="form-heading-block">
            {googleAuthStep === 'SIGNUP' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setGoogleAuthStep('IDLE');
                    setGoogleIdToken('');
                    setError('');
                  }}
                  className="back-btn"
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </button>
                <h2 className="form-title">Complete Your Profile</h2>
                <p className="form-subtitle">
                  First-time Google Sign-In with verified SPIT account. Please enter your name and create a password.
                </p>
              </>
            ) : googleAuthStep === 'LINK' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setGoogleAuthStep('IDLE');
                    setGoogleIdToken('');
                    setError('');
                  }}
                  className="back-btn"
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </button>
                <h2 className="form-title">Link SPIT Account</h2>
                <p className="form-subtitle">
                  An account for <strong>{linkEmail}</strong> already exists. Enter your password to securely link your Google account.
                </p>
              </>
            ) : (
              <>
                <h2 className="form-title">Welcome back to LOOP</h2>
                <p className="form-subtitle">
                  Sign in with your SPIT student account or Google credentials.
                </p>
              </>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="banner error-banner" role="alert">
              {error}
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="banner success-banner" role="status">
              {successMsg}
            </div>
          )}

          {/* Info / Registration Guide Notice */}
          {infoNotice && (
            <div className="banner info-banner" role="status">
              {infoNotice}
            </div>
          )}

          {/* ------------------------------------------------------------------- */}
          {/* STEP 1: FIRST-TIME GOOGLE SIGNUP FORM                               */}
          {/* ------------------------------------------------------------------- */}
          {googleAuthStep === 'SIGNUP' && (
            <form onSubmit={handleGoogleSignupSubmit} autoComplete="off" className="auth-form">
              <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1, overflow: 'hidden' }} aria-hidden="true">
                <input type="text" name="dummy_username_autofill" tabIndex="-1" autoComplete="off" />
                <input type="password" name="dummy_password_autofill" tabIndex="-1" autoComplete="new-password" />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="google-name">
                  Full Name <span className="req">*</span>
                </label>
                <input
                  id="google-name"
                  type="text"
                  className="field-input"
                  value={googleSignupData.name}
                  onChange={(e) => setGoogleSignupData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your full name"
                  required
                  disabled={loading}
                />
              </div>

              <div className="field-group">
                <div className="field-label-split">
                  <label className="field-label" htmlFor="google-email">
                    SPIT Email Address
                  </label>
                  <span className="verified-badge">
                    <ShieldCheck size={12} /> Verified
                  </span>
                </div>
                <input
                  id="google-email"
                  type="email"
                  className="field-input read-only-input"
                  value={googleSignupData.email}
                  readOnly
                  disabled
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="google-password">
                  Password <span className="req">*</span>
                </label>
                <div className="input-with-icon">
                  <input
                    id="google-password"
                    name="loop_new_password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="field-input"
                    value={googleSignupData.password}
                    onChange={(e) => setGoogleSignupData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Create a password (min 6 characters)"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="icon-btn"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="field-hint">Password should be at least 6 characters.</p>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="google-confirm-password">
                  Confirm Password <span className="req">*</span>
                </label>
                <input
                  id="google-confirm-password"
                  name="loop_new_confirm_password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="field-input"
                  value={googleSignupData.confirmPassword}
                  onChange={(e) => setGoogleSignupData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Re-enter password to confirm"
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                className="btn-github-green"
                disabled={loading}
              >
                {loading ? 'Completing Registration...' : 'Create account →'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setGoogleAuthStep('IDLE');
                  setGoogleIdToken('');
                  setError('');
                }}
                className="btn-link-cancel"
              >
                Cancel
              </button>
            </form>
          )}

          {/* ------------------------------------------------------------------- */}
          {/* STEP 2: ACCOUNT LINKING FORM                                        */}
          {/* ------------------------------------------------------------------- */}
          {googleAuthStep === 'LINK' && (
            <form onSubmit={handleGoogleLinkSubmit} className="auth-form">
              <div className="field-group">
                <label className="field-label">SPIT Email</label>
                <input
                  type="email"
                  className="field-input read-only-input"
                  value={linkEmail}
                  readOnly
                  disabled
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="link-password">
                  Enter Account Password <span className="req">*</span>
                </label>
                <div className="input-with-icon">
                  <input
                    id="link-password"
                    type={showPassword ? "text" : "password"}
                    className="field-input"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    placeholder="Enter your existing account password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="icon-btn"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn-github-green"
                disabled={loading}
              >
                {loading ? 'Verifying & Linking...' : 'Verify Password & Link Google →'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setGoogleAuthStep('IDLE');
                  setGoogleIdToken('');
                  setError('');
                }}
                className="btn-link-cancel"
              >
                Cancel
              </button>
            </form>
          )}

          {/* ------------------------------------------------------------------- */}
          {/* STEP 3: MAIN LOGIN FORM (MATCHING GITHUB SCREENSHOT ORDER)          */}
          {/* ------------------------------------------------------------------- */}
          {googleAuthStep === 'IDLE' && (
            <>
              {/* 1. Continue with Google Button */}
              <div className="social-login-wrapper">
                <div
                  ref={googleButtonRef}
                  className="google-gsi-container"
                  style={{ display: isGoogleAvailable ? 'flex' : 'none' }}
                />

                {!isGoogleAvailable && (
                  <button
                    type="button"
                    onClick={handleGoogleSignInClick}
                    disabled={loading}
                    className="btn-social btn-google"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" className="social-icon">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                )}
              </div>

              {/* 2. Horizontal Divider with "or" */}
              <div className="horizontal-divider">
                <span className="divider-line" />
                <span className="divider-label">or</span>
                <span className="divider-line" />
              </div>

              {/* Email & Password Form */}
              <form onSubmit={handleSubmit} autoComplete="off" className="auth-form">
                <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1, overflow: 'hidden' }} aria-hidden="true">
                  <input type="text" name="dummy_email_autofill" tabIndex="-1" autoComplete="off" />
                  <input type="password" name="dummy_password_autofill" tabIndex="-1" autoComplete="new-password" />
                </div>

                {/* 3. Email Input Field */}
                <div className="field-group">
                  <label className="field-label" htmlFor="email-input">
                    Email or username <span className="req">*</span>
                  </label>
                  <input
                    id="email-input"
                    name="loop_login_email"
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    className="field-input"
                    placeholder="name@spit.ac.in or username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                {/* 4. Password Input Field with Forgot Password Link */}
                <div className="field-group">
                  <div className="field-label-split">
                    <label className="field-label" htmlFor="password-input">
                      Password <span className="req">*</span>
                    </label>
                    <Link to="/forgot-password" className="forgot-link">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="input-with-icon">
                    <input
                      id="password-input"
                      name="loop_login_password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="field-input"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="icon-btn"
                      tabIndex="-1"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="field-hint">
                    Password should be at least 6 characters.
                  </p>
                </div>

                {/* 5. Primary Green "Log in" Button */}
                <button
                  type="submit"
                  className="btn-github-green"
                  disabled={loading}
                >
                  {loading ? (
                    'Authenticating...'
                  ) : (
                    <>
                      <span>Log in</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>

              {/* 6. Registration Link: "Don't have an account? Sign up" */}
              <div className="bottom-signup-row">
                <span>Don’t have an account? </span>
                <button 
                  type="button" 
                  onClick={handleSignupPrompt} 
                  className="bottom-signup-btn"
                >
                  Sign up
                </button>
              </div>

              {/* Terms of Service & Privacy Statement */}
              <footer className="form-legal-footer">
                By logging in, you agree to the{' '}
                <Link to="/terms" className="legal-link">Terms of Service</Link>. For more information about LOOP’s privacy practices, see the{' '}
                <Link to="/privacy-policy" className="legal-link">Privacy Policy</Link>.
              </footer>
            </>
          )}
        </div>
      </main>

      {/* ========================================================================= */}
      {/* SCOPED CSS STYLES FOR PIXEL-PERFECT GITHUB SPLIT SCREEN COMPOSITION       */}
      {/* ========================================================================= */}
      <style>{`
        /* Full-Screen Two-Column Split Layout */
        .github-split-layout {
          width: 100vw;
          height: 100vh;
          min-height: 100vh;
          display: flex;
          overflow: hidden;
          background-color: #000000;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
          color: #1f2328;
          box-sizing: border-box;
        }

        /* ----------------------------------------------------------------------- */
        /* LEFT PANEL: PURE BLACK (#000000)                                       */
        /* ----------------------------------------------------------------------- */
        .github-left-panel {
          width: 50%;
          flex: 0 0 50%;
          height: 100vh;
          background-color: #000000;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
          position: relative;
          overflow-y: auto;
          overflow-x: hidden;
          box-sizing: border-box;
        }

        .github-left-panel::-webkit-scrollbar {
          width: 6px;
        }
        .github-left-panel::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.15);
          border-radius: 999px;
        }

        .left-panel-glow {
          position: absolute;
          top: -120px;
          left: -120px;
          width: 380px;
          height: 380px;
          background: radial-gradient(circle, rgba(138, 43, 226, 0.15) 0%, rgba(0, 0, 0, 0) 70%);
          pointer-events: none;
        }

        .left-panel-content {
          padding: 3.5rem 3.5rem 1.5rem 3.5rem;
          position: relative;
          z-index: 2;
        }

        .left-brand-row {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          margin-bottom: 2rem;
        }

        .left-brand-logo-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
          color: #ffffff;
        }

        .left-brand-logo {
          height: 24px;
          width: auto;
          display: block;
        }

        .left-brand-title {
          font-size: 1.15rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #ffffff;
        }

        .left-brand-badge {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.28);
          color: #ffffff;
          line-height: 1.2;
        }

        .left-heading {
          font-size: 2.25rem;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: #ffffff;
          line-height: 1.2;
          margin: 0 0 0.85rem 0;
        }

        .left-description {
          font-size: 0.95rem;
          line-height: 1.55;
          color: #8c949e;
          max-width: 460px;
          margin: 0 0 1.5rem 0;
        }

        .left-section-label {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.82rem;
          font-weight: 600;
          color: #c9d1d9;
          margin-bottom: 1.35rem;
        }

        .left-chevron-icon {
          transform: rotate(180deg);
          color: #8c949e;
        }

        .left-features-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
          max-width: 480px;
        }

        .left-feature-item {
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
        }

        .left-check-icon-wrapper {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
          color: #ffffff;
        }

        .left-check-icon {
          color: #ffffff;
        }

        .left-feature-text {
          flex: 1;
        }

        .left-feature-title {
          font-size: 0.88rem;
          font-weight: 600;
          color: #ffffff;
          margin: 0 0 0.2rem 0;
          line-height: 1.35;
        }

        .left-feature-desc {
          font-size: 0.8rem;
          color: #8c949e;
          line-height: 1.45;
          margin: 0;
        }

        /* Bottom Ambient Highlights Container */
        .left-illustration-container {
          position: relative;
          height: 140px;
          width: 100%;
          margin-top: auto;
          display: flex;
          justify-content: center;
          align-items: center;
          background: linear-gradient(to top, #0f0a20 0%, #080514 60%, rgba(0, 0, 0, 0) 100%);
          overflow: hidden;
          padding: 0 1.5rem;
        }

        .cosmic-glow-purple {
          position: absolute;
          bottom: -30px;
          left: 20%;
          width: 240px;
          height: 160px;
          background: radial-gradient(circle, rgba(147, 51, 234, 0.3) 0%, rgba(0, 0, 0, 0) 70%);
          pointer-events: none;
        }

        .cosmic-glow-blue {
          position: absolute;
          bottom: -40px;
          right: 20%;
          width: 220px;
          height: 150px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, rgba(0, 0, 0, 0) 70%);
          pointer-events: none;
        }

        .stars-layer {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(1px 1px at 20% 30%, rgba(255, 255, 255, 0.7), transparent),
            radial-gradient(1.5px 1.5px at 40% 70%, rgba(255, 255, 255, 0.8), transparent),
            radial-gradient(1px 1px at 65% 25%, rgba(255, 255, 255, 0.6), transparent),
            radial-gradient(1.5px 1.5px at 85% 60%, rgba(255, 255, 255, 0.75), transparent),
            radial-gradient(1px 1px at 90% 15%, rgba(255, 255, 255, 0.6), transparent);
          pointer-events: none;
        }

        .floating-badge {
          position: absolute;
          z-index: 3;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.85rem;
          border-radius: 999px;
          background-color: rgba(18, 19, 26, 0.82);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          font-size: 0.72rem;
          font-weight: 600;
          color: #ffffff;
          animation: floatSlow 5s ease-in-out infinite alternate;
        }

        .badge-left {
          left: 2.5rem;
          bottom: 2rem;
          animation-delay: 0s;
        }

        .badge-right {
          right: 2.5rem;
          bottom: 2.25rem;
          animation-delay: 2.2s;
        }

        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .dot-green {
          background-color: #2da44e;
          box-shadow: 0 0 8px #2da44e;
        }
        .badge-shield {
          color: #58a6ff;
        }

        @keyframes floatSlow {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-6px); }
        }

        /* ----------------------------------------------------------------------- */
        /* RIGHT PANEL: CRISP WHITE (#FFFFFF)                                    */
        /* ----------------------------------------------------------------------- */
        .github-right-panel {
          width: 50%;
          flex: 0 0 50%;
          height: 100vh;
          background-color: #ffffff;
          color: #1f2328;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow-y: auto;
          overflow-x: hidden;
          box-sizing: border-box;
          padding: 2rem 2.5rem;
        }

        .github-right-panel::-webkit-scrollbar {
          width: 6px;
        }
        .github-right-panel::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.12);
          border-radius: 999px;
        }

        .right-top-nav {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 0.35rem;
          width: 100%;
          font-size: 13px;
          color: #656d76;
          margin-bottom: 1.5rem;
        }

        .top-nav-text {
          color: #656d76;
        }

        .top-nav-link {
          background: none;
          border: none;
          color: #0969da;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          padding: 0;
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
        }
        .top-nav-link:hover {
          text-decoration: underline;
        }

        .form-center-container {
          width: 100%;
          max-width: 440px;
          margin: auto;
          display: flex;
          flex-direction: column;
        }

        .form-heading-block {
          margin-bottom: 1.5rem;
        }

        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: none;
          border: none;
          color: #0969da;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          padding: 0;
          margin-bottom: 0.75rem;
        }
        .back-btn:hover {
          text-decoration: underline;
        }

        .form-title {
          font-size: 24px;
          font-weight: 600;
          letter-spacing: -0.025em;
          color: #1f2328;
          line-height: 1.25;
          margin: 0 0 0.35rem 0;
        }

        .form-subtitle {
          font-size: 14px;
          color: #656d76;
          line-height: 1.5;
          margin: 0;
        }

        /* Alerts & Banners */
        .banner {
          border-radius: 6px;
          padding: 10px 14px;
          font-size: 13px;
          line-height: 1.45;
          margin-bottom: 1rem;
        }
        .error-banner {
          background-color: #ffebe9;
          border: 1px solid rgba(255, 129, 130, 0.4);
          color: #cf222e;
        }
        .success-banner {
          background-color: #dafbe1;
          border: 1px solid rgba(74, 194, 107, 0.4);
          color: #1a7f37;
        }
        .info-banner {
          background-color: #ddf4ff;
          border: 1px solid rgba(84, 174, 255, 0.4);
          color: #0969da;
        }

        /* Social / Google Buttons */
        .social-login-wrapper {
          width: 100%;
          margin-bottom: 0.25rem;
        }

        .google-gsi-container {
          width: 100%;
          justify-content: center;
          align-items: center;
          min-height: 42px;
        }

        .btn-social {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          width: 100%;
          height: 42px;
          border-radius: 6px;
          border: 1px solid #d0d7de;
          background-color: #ffffff;
          color: #1f2328;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 1px 0 rgba(27, 31, 36, 0.04);
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }
        .btn-social:hover {
          background-color: #f6f8fa;
          border-color: #afb8c1;
        }
        .btn-social:active {
          background-color: #f3f4f6;
        }

        /* Divider with "or" */
        .horizontal-divider {
          display: flex;
          align-items: center;
          margin: 1.25rem 0;
          gap: 0.75rem;
        }

        .divider-line {
          flex: 1;
          height: 1px;
          background-color: #d0d7de;
        }

        .divider-label {
          font-size: 12px;
          color: #656d76;
          text-transform: lowercase;
        }

        /* Form Controls */
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .field-group {
          display: flex;
          flex-direction: column;
        }

        .field-label {
          font-size: 14px;
          font-weight: 500;
          color: #1f2328;
          margin-bottom: 6px;
          display: block;
        }

        .field-label .req {
          color: #cf222e;
          font-weight: 600;
        }

        .field-label-split {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .verified-badge {
          font-size: 12px;
          font-weight: 600;
          color: #1a7f37;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }

        .forgot-link {
          font-size: 12px;
          color: #0969da;
          text-decoration: none;
          font-weight: 500;
        }
        .forgot-link:hover {
          text-decoration: underline;
        }

        .field-input {
          height: 40px;
          padding: 8px 12px;
          border: 1px solid #d0d7de;
          border-radius: 6px;
          font-size: 14px;
          color: #1f2328;
          background-color: #ffffff;
          box-sizing: border-box;
          width: 100%;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .field-input::placeholder {
          color: #8c949e;
        }
        .field-input:focus {
          border-color: #0969da;
          box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.15);
        }
        .field-input:disabled {
          background-color: #f6f8fa;
          cursor: not-allowed;
          color: #8c949e;
        }

        .read-only-input {
          background-color: #f6f8fa;
          color: #656d76;
          cursor: not-allowed;
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-with-icon .field-input {
          padding-right: 38px;
        }

        .icon-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          padding: 4px;
          color: #656d76;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-btn:hover {
          color: #1f2328;
        }

        .field-hint {
          font-size: 12px;
          color: #656d76;
          margin: 5px 0 0 0;
          line-height: 1.4;
        }

        /* Primary Green Button (GitHub Signature Style) */
        .btn-github-green {
          height: 42px;
          border-radius: 6px;
          border: 1px solid rgba(27, 31, 36, 0.15);
          background-color: #1f883d;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          box-shadow: 0 1px 0 rgba(27, 31, 36, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.03);
          transition: background-color 0.15s cubic-bezier(0.3, 0, 0.5, 1);
          margin-top: 0.5rem;
        }
        .btn-github-green:hover:not(:disabled) {
          background-color: #1a7f37;
        }
        .btn-github-green:active:not(:disabled) {
          background-color: #197635;
          box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.2);
        }
        .btn-github-green:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .btn-link-cancel {
          background: none;
          border: none;
          color: #656d76;
          cursor: pointer;
          font-size: 13px;
          padding: 4px;
          text-decoration: underline;
          text-align: center;
          margin-top: 4px;
        }
        .btn-link-cancel:hover {
          color: #1f2328;
        }

        /* Bottom Signup Row */
        .bottom-signup-row {
          text-align: center;
          font-size: 14px;
          color: #656d76;
          margin-top: 1.25rem;
        }

        .bottom-signup-btn {
          background: none;
          border: none;
          color: #0969da;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          padding: 0;
        }
        .bottom-signup-btn:hover {
          text-decoration: underline;
        }

        /* Legal Footer */
        .form-legal-footer {
          font-size: 12px;
          color: #656d76;
          line-height: 1.5;
          margin-top: 1.5rem;
          text-align: center;
        }

        .legal-link {
          color: #0969da;
          text-decoration: none;
        }
        .legal-link:hover {
          text-decoration: underline;
        }

        /* ----------------------------------------------------------------------- */
        /* RESPONSIVE BREAKPOINTS (MOBILE & TABLET)                                */
        /* ----------------------------------------------------------------------- */
        @media (max-width: 960px) {
          .github-split-layout {
            flex-direction: column;
            height: auto;
            min-height: 100vh;
            overflow-y: auto;
          }

          .github-left-panel {
            width: 100%;
            flex: none;
            height: auto;
            min-height: auto;
            padding-bottom: 2rem;
          }

          .left-panel-content {
            padding: 2.5rem 1.75rem 1rem 1.75rem;
          }

          .left-heading {
            font-size: 1.85rem;
          }

          .left-illustration-container {
            height: 120px;
          }

          .badge-left {
            left: 1rem;
            bottom: 1.5rem;
          }
          .badge-right {
            right: 1rem;
            bottom: 1.5rem;
          }

          .github-right-panel {
            width: 100%;
            flex: none;
            height: auto;
            min-height: auto;
            padding: 2.5rem 1.75rem 3.5rem 1.75rem;
          }

          .form-center-container {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
