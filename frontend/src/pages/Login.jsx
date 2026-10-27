import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, Sparkles, ArrowLeft, ArrowRight } from 'lucide-react';
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

  // Dual Video Architecture for Butter-Smooth Transitions
  // IDLE: idle-butterfly.mp4 (4.0s seamless loop of character watching butterfly)
  // ACTIVE: character-login.mp4 (1.5-4.5s Email | 4.5-7.5s Password | 7.5-10.0s Login)
  const [characterState, setCharacterState] = useState('IDLE');
  const idleVideoRef = useRef(null);
  const actionVideoRef = useRef(null);
  const stateRef = useRef('IDLE');

  // Trigger video transitions smoothly
  const triggerCharacterState = useCallback((newState) => {
    if (stateRef.current === newState) return;
    
    stateRef.current = newState;
    setCharacterState(newState);

    const idleVideo = idleVideoRef.current;
    const actionVideo = actionVideoRef.current;

    try {
      if (newState === 'IDLE') {
        if (idleVideo) {
          idleVideo.play().catch(() => {});
        }
      } else {
        if (actionVideo) {
          if (newState === 'EMAIL_ACTIVE') {
            actionVideo.currentTime = 1.5;
          } else if (newState === 'PASSWORD_ACTIVE') {
            actionVideo.currentTime = 4.5;
          } else if (newState === 'LOGIN_SUBMITTED') {
            actionVideo.currentTime = 7.5;
          }
          actionVideo.play().catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Media transition error:", e);
    }
  }, []);

  // Frame-accurate 60fps loop controller for both video sources
  useEffect(() => {
    let animId = null;

    const checkSegmentLoop = () => {
      const current = stateRef.current;
      const idleVideo = idleVideoRef.current;
      const actionVideo = actionVideoRef.current;

      if (current === 'IDLE') {
        if (idleVideo && !idleVideo.paused) {
          if (idleVideo.currentTime >= 3.9) {
            idleVideo.currentTime = 0.05;
            idleVideo.play().catch(() => {});
          }
        }
      } else {
        if (actionVideo && !actionVideo.paused) {
          const t = actionVideo.currentTime;

          if (current === 'EMAIL_ACTIVE') {
            // 1.5-4.5s: Email typing video loop
            if (t >= 4.45) {
              actionVideo.currentTime = 1.6;
              actionVideo.play().catch(() => {});
            }
          } else if (current === 'PASSWORD_ACTIVE') {
            // 4.5-7.5s: Password looking-away video loop
            if (t >= 7.45) {
              actionVideo.currentTime = 4.8;
              actionVideo.play().catch(() => {});
            }
          } else if (current === 'LOGIN_SUBMITTED') {
            // 7.5-10.0s: Login reaction nod video loop
            if (t >= 9.9) {
              actionVideo.currentTime = 7.8;
              actionVideo.play().catch(() => {});
            }
          }
        }
      }

      animId = requestAnimationFrame(checkSegmentLoop);
    };

    animId = requestAnimationFrame(checkSegmentLoop);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  // Input Focus & Blur Handlers
  const handleEmailFocus = () => {
    if (stateRef.current !== 'LOGIN_SUBMITTED') {
      triggerCharacterState('EMAIL_ACTIVE');
    }
  };

  const handlePasswordFocus = () => {
    if (stateRef.current !== 'LOGIN_SUBMITTED') {
      triggerCharacterState('PASSWORD_ACTIVE');
    }
  };

  const handleInputBlur = (e) => {
    // If focus moved to another input inside our form, don't reset to idle
    const nextTarget = e.relatedTarget;
    if (
      nextTarget &&
      (nextTarget.id === 'email-input' || nextTarget.id === 'password-input')
    ) {
      return;
    }

    // Return to IDLE if blurred outside
    if (!loading && stateRef.current !== 'LOGIN_SUBMITTED') {
      triggerCharacterState('IDLE');
    }
  };

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
    // Ensure email and password start completely blank without browser autofill
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
      const parsed = JSON.parse(userSession);
      const targetUrl = getRedirectUrl();
      const isOnboarded = Boolean(parsed.onboarded || (parsed.name && parsed.branch) || parsed.isAdmin);
      if (isOnboarded) {
        navigate(targetUrl, { replace: true });
      } else {
        navigate('/onboarding', { replace: true, state: { redirectAfter: targetUrl } });
      }
    }
  }, [navigate, getRedirectUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedInput = email.trim();
    if (!trimmedInput) {
      setError('Username or email is required');
      triggerCharacterState('IDLE');
      return;
    }

    if (trimmedInput.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedInput)) {
        setError('Please enter a valid email address');
        triggerCharacterState('IDLE');
        return;
      }
    }

    if (!password) {
      setError('Password is required');
      triggerCharacterState('IDLE');
      return;
    }

    setLoading(true);
    triggerCharacterState('LOGIN_SUBMITTED');

    try {
      const userData = await loginUser(trimmedInput, password);
      handleLoginSuccess(userData);
    } catch (err) {
      if (err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
        setError('Network or server connection error. Please try again.');
      } else {
        setError(err.message || 'Invalid username/email or password. Please try again.');
      }
      triggerCharacterState('IDLE');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = useCallback((userData) => {
    // Zero cross-account leakage: strictly wipe prior session & memory caches on account switch
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
    }, 500);
  }, [getRedirectUrl, navigate]);


  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '779605241663-vp20b6cbhoccdeibjlcbtp7d9kbcf5bu.apps.googleusercontent.com';

  const handleGoogleCredentialResponse = useCallback(async (response) => {
    const idToken = response?.credential;
    if (!idToken) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');
    triggerCharacterState('LOGIN_SUBMITTED');

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
        triggerCharacterState('IDLE');
      } else if (result.action === 'LINK_REQUIRED') {
        setGoogleIdToken(idToken);
        setLinkEmail(result.email);
        setLinkPassword('');
        setGoogleAuthStep('LINK');
        triggerCharacterState('IDLE');
      }
    } catch (err) {
      setError(err.message || 'Google authentication failed.');
      triggerCharacterState('IDLE');
    } finally {
      setLoading(false);
    }
  }, [triggerCharacterState, handleLoginSuccess]);

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
              shape: 'pill',
              logo_alignment: 'left',
              width: 400
            });
            setIsGoogleAvailable(true);
          }

          // Trigger One Tap prompt if supported by user's browser session
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
    triggerCharacterState('LOGIN_SUBMITTED');

    try {
      // Auto-generate username from the verified SPIT email
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
      triggerCharacterState('IDLE');
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
    triggerCharacterState('LOGIN_SUBMITTED');

    try {
      const result = await linkGoogleAccount({
        idToken: googleIdToken,
        password: linkPassword
      });

      handleLoginSuccess(result);
    } catch (err) {
      setError(err.message || 'Failed to link Google account.');
      triggerCharacterState('IDLE');
    } finally {
      setLoading(false);
    }
  };

  // Status Badge Indicator
  const getStatusBadge = () => {
    switch (characterState) {
      case 'EMAIL_ACTIVE':
        return {
          icon: <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0071E3', boxShadow: '0 0 8px #0071E3' }} />,
          label: 'Watching Email Input',
          color: '#0071E3'
        };
      case 'PASSWORD_ACTIVE':
        return {
          icon: <ShieldCheck size={12} strokeWidth={2.4} style={{ color: '#34C759' }} />,
          label: 'Privacy Mode • Looking Away 🙈',
          color: '#34C759'
        };
      case 'LOGIN_SUBMITTED':
        return {
          icon: <Sparkles size={12} strokeWidth={2.4} style={{ color: '#AF52DE' }} />,
          label: 'Authenticating...',
          color: '#AF52DE'
        };
      case 'IDLE':
      default:
        return {
          icon: <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#8E8E93' }} />,
          label: 'Senior Guide • Ready',
          color: 'var(--text-secondary)'
        };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="login-split-page" style={{
      width: '100vw',
      minHeight: '100vh',
      display: 'flex',
      backgroundColor: 'var(--bg-surface)',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      <SEOHead 
        title={`Sign In | ${BRAND.fullName}`}
        description={`${BRAND.tagline} Sign in to ${BRAND.name} with your Sardar Patel Institute of Technology student account or Google authentication.`}
        canonicalUrl="/login"
        noIndex={true}
      />
      {/* LEFT HALF (50%): FULL-BLEED VIDEO HERO PANEL (NO BOX) */}
      <div className="login-media-half" style={{
        width: '50%',
        flex: '0 0 50%',
        height: '100vh',
        position: 'sticky',
        top: 0,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        {/* Full-Bleed Stacked Dual-Video Elements with Seamless Transition */}
        {/* 1. Idle Butterfly Video (Natural loop while idle) */}
        <video
          ref={idleVideoRef}
          src="/idle-butterfly.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            pointerEvents: 'none',
            userSelect: 'none',
            opacity: characterState === 'IDLE' ? 1 : 0,
            transition: 'opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'block',
            zIndex: characterState === 'IDLE' ? 1 : 0
          }}
        />

        {/* 2. Active Interaction Video (Email typing, Password privacy, Login reaction) */}
        <video
          ref={actionVideoRef}
          src="/character-login.mp4"
          muted
          playsInline
          preload="auto"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            pointerEvents: 'none',
            userSelect: 'none',
            opacity: characterState !== 'IDLE' ? 1 : 0,
            transition: 'opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'block',
            zIndex: characterState !== 'IDLE' ? 1 : 0
          }}
        />

        {/* Top Header Overlay on Video */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          padding: '2.5rem 3rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.4rem 0.85rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
            border: '1px solid rgba(0,0,0,0.06)'
          }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#1d1d1f'
            }}>
              {BRAND.fullForm}
            </span>
          </div>

          {/* Live Privacy & Focus Indicator */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.4rem 0.85rem',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            fontSize: '0.76rem',
            fontWeight: 600,
            color: statusBadge.color,
            border: '1px solid rgba(0,0,0,0.06)'
          }}>
            {statusBadge.icon}
            <span>{statusBadge.label}</span>
          </div>
        </div>

        {/* Bottom Quote Overlay on Video, matching the reference image */}
        <div className="login-quote-overlay" style={{
          position: 'relative',
          zIndex: 2,
          padding: '4rem 3rem 3rem',
          background: 'linear-gradient(to top, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.82) 60%, rgba(255,255,255,0) 100%)',
          pointerEvents: 'none'
        }}>
          <h2 style={{
            fontSize: '2.4rem',
            fontWeight: 800,
            letterSpacing: '-0.035em',
            color: '#111111',
            lineHeight: 1.15,
            marginBottom: '0.55rem',
            fontFamily: 'var(--font-sans)'
          }}>
            {BRAND.tagline}
          </h2>
          <p style={{
            fontSize: '0.94rem',
            color: '#555555',
            lineHeight: 1.55,
            maxWidth: '430px'
          }}>
            {BRAND.fullName}. Connect with seniors and alumni, learn from placement experiences, and discover career opportunities.
          </p>
        </div>
      </div>

      {/* RIGHT HALF (50%): FULL LOGIN FORM & AUTHENTICATION LOGIC */}
      <div className="login-form-half" style={{
        width: '50%',
        flex: '0 0 50%',
        minHeight: '100vh',
        height: '100vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '3rem 4rem',
        backgroundColor: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-color)',
        boxSizing: 'border-box'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '430px',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto 0'
        }}>
          {/* Top Logo and Branding */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '2rem'
          }}>
            <img 
              src="/loop-logo.png" 
              alt="LOOP Logo" 
              style={{ 
                height: '42px', 
                width: 'auto', 
                filter: 'var(--logo-filter)',
                marginRight: '0.3rem'
              }} 
            />
            <span style={{
              fontSize: '2.1rem',
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-display)',
              lineHeight: 1
            }}>
              {BRAND.name}
            </span>
            <span style={{
              fontSize: '0.78rem',
              letterSpacing: '0.05em',
              padding: '3px 8px',
              border: '1.5px solid var(--text-primary)',
              borderRadius: '6px',
              fontWeight: '800',
              lineHeight: 1.2
            }}>SPIT</span>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: '1.75rem' }}>
            {googleAuthStep === 'SIGNUP' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setGoogleAuthStep('IDLE');
                    setGoogleIdToken('');
                    setError('');
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    padding: 0,
                    marginBottom: '0.75rem'
                  }}
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </button>
                <h1 style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  marginBottom: '0.4rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.15
                }}>
                  Complete Your Profile
                </h1>
                <p style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.92rem',
                  fontWeight: 400,
                  lineHeight: 1.45
                }}>
                  First-time Google Sign-In with verified SPIT account. Please create a password to secure your account.
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
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    padding: 0,
                    marginBottom: '0.75rem'
                  }}
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </button>
                <h1 style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  marginBottom: '0.4rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.15
                }}>
                  Link SPIT Account
                </h1>
                <p style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.92rem',
                  fontWeight: 400,
                  lineHeight: 1.45
                }}>
                  An account for <strong>{linkEmail}</strong> already exists. Enter your password to securely link your Google account.
                </p>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <h1 style={{
                  fontSize: '2.25rem',
                  fontWeight: 800,
                  letterSpacing: '-0.035em',
                  marginBottom: '0.45rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.15
                }}>
                  Sign in to LOOP
                </h1>
                <p style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.94rem',
                  fontWeight: 400,
                  lineHeight: 1.45,
                  margin: 0
                }}>
                  Access placement stories and campus resources with your SPIT account.
                </p>
              </div>
            )}
          </div>

          {/* Global Error Banner */}
          {error && (
            <div style={{
              backgroundColor: 'rgba(255, 69, 58, 0.1)',
              border: '1px solid rgba(255, 69, 58, 0.25)',
              color: '#ff453a',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              fontSize: '0.86rem',
              textAlign: 'left',
              marginBottom: '1.25rem',
              lineHeight: 1.45
            }}>
              {error}
            </div>
          )}

          {/* Global Success Banner */}
          {successMsg && (
            <div style={{
              backgroundColor: 'rgba(48, 209, 88, 0.1)',
              border: '1px solid rgba(48, 209, 88, 0.2)',
              color: '#30d158',
              borderRadius: '12px',
              padding: '0.8rem 1rem',
              fontSize: '0.85rem',
              textAlign: 'left',
              marginBottom: '1.25rem'
            }}>
              {successMsg}
            </div>
          )}

          {/* 1. STEP: FIRST-TIME GOOGLE SIGNUP FORM */}
          {googleAuthStep === 'SIGNUP' && (
            <form onSubmit={handleGoogleSignupSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* Off-screen dummy inputs to prevent browser autofill from populating the user fields */}
              <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1, overflow: 'hidden' }} aria-hidden="true">
                <input type="text" name="dummy_username_autofill" tabIndex="-1" autoComplete="off" />
                <input type="password" name="dummy_password_autofill" tabIndex="-1" autoComplete="new-password" />
              </div>

              {/* Full Name (pre-filled, editable) */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" htmlFor="google-name" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Full Name *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="google-name"
                    type="text"
                    className="input-field"
                    value={googleSignupData.name}
                    onChange={(e) => setGoogleSignupData(prev => ({ ...prev, name: e.target.value }))}
                    style={{
                      height: '48px',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      paddingLeft: '1.1rem'
                    }}
                    placeholder="Enter your full name"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Email (pre-filled, read-only) */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="input-label" htmlFor="google-email" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    SPIT Email Address
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <ShieldCheck size={12} /> Verified • Read-Only
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="google-email"
                    type="email"
                    className="input-field"
                    value={googleSignupData.email}
                    readOnly
                    disabled
                    style={{
                      height: '48px',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      paddingLeft: '1.1rem',
                      color: 'var(--text-secondary)',
                      cursor: 'not-allowed',
                      opacity: 0.85
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" htmlFor="google-password" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="google-password"
                    name="loop_new_password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="input-field"
                    value={googleSignupData.password}
                    onChange={(e) => setGoogleSignupData(prev => ({ ...prev, password: e.target.value }))}
                    style={{
                      height: '48px',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      paddingLeft: '1.1rem',
                      paddingRight: '2.75rem'
                    }}
                    placeholder="Create a password (min 6 characters)"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" htmlFor="google-confirm-password" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Confirm Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="google-confirm-password"
                    name="loop_new_confirm_password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="input-field"
                    value={googleSignupData.confirmPassword}
                    onChange={(e) => setGoogleSignupData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    style={{
                      height: '48px',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      paddingLeft: '1.1rem'
                    }}
                    placeholder="Re-enter password to confirm"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  marginTop: '0.5rem',
                  height: '48px',
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
                  fontSize: '0.94rem',
                  cursor: loading ? 'wait' : 'pointer',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)'
                }}
                disabled={loading}
              >
                {loading ? 'Completing Registration...' : 'Complete Registration & Sign In'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setGoogleAuthStep('IDLE');
                  setGoogleIdToken('');
                  setError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  padding: '0.4rem',
                  textDecoration: 'underline'
                }}
              >
                Cancel
              </button>
            </form>
          )}

          {/* 2. STEP: ACCOUNT LINKING FORM */}
          {googleAuthStep === 'LINK' && (
            <form onSubmit={handleGoogleLinkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  SPIT Email
                </label>
                <input
                  type="email"
                  className="input-field"
                  value={linkEmail}
                  readOnly
                  disabled
                  style={{
                    height: '48px',
                    borderRadius: '12px',
                    fontSize: '0.92rem',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    paddingLeft: '1.1rem',
                    color: 'var(--text-secondary)',
                    cursor: 'not-allowed',
                    opacity: 0.85
                  }}
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" htmlFor="link-password" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Enter Account Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="link-password"
                    type={showPassword ? "text" : "password"}
                    className="input-field"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    placeholder="Enter your existing account password"
                    style={{
                      height: '48px',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      paddingLeft: '1.1rem',
                      paddingRight: '2.75rem'
                    }}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  marginTop: '0.5rem',
                  height: '48px',
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
                  fontSize: '0.94rem',
                  cursor: loading ? 'wait' : 'pointer',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)'
                }}
                disabled={loading}
              >
                {loading ? 'Verifying & Linking...' : 'Verify Password & Link Google'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setGoogleAuthStep('IDLE');
                  setGoogleIdToken('');
                  setError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  padding: '0.4rem',
                  textDecoration: 'underline'
                }}
              >
                Cancel
              </button>
            </form>
          )}

          {/* 3. STEP: STANDARD LOGIN / REGISTER + GOOGLE SIGN-IN BUTTON */}
          {googleAuthStep === 'IDLE' && (
            <>
              {/* Continue with Google Button Container */}
              <div style={{ width: '100%', marginBottom: '1.25rem', minHeight: '48px', display: 'flex', justifyContent: 'center' }}>
                <div
                  ref={googleButtonRef}
                  className="google-btn-wrapper"
                  style={{
                    width: '100%',
                    display: isGoogleAvailable ? 'flex' : 'none',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: '999px',
                    overflow: 'hidden',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                />

                {!isGoogleAvailable && (
                  <button
                    type="button"
                    onClick={handleGoogleSignInClick}
                    disabled={loading}
                    className="google-fallback-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.75rem',
                      width: '100%',
                      height: '48px',
                      borderRadius: '999px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: '0.92rem',
                      fontWeight: 600,
                      cursor: loading ? 'wait' : 'pointer',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                )}
              </div>

              {/* Divider */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                margin: '1.1rem 0 1.35rem 0',
                gap: '0.85rem'
              }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  or continue with email
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
              </div>

              {/* Existing Form */}
              <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Off-screen dummy inputs to absorb aggressive browser autofill */}
                <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1, overflow: 'hidden' }} aria-hidden="true">
                  <input type="text" name="dummy_email_autofill" tabIndex="-1" autoComplete="off" />
                  <input type="password" name="dummy_password_autofill" tabIndex="-1" autoComplete="new-password" />
                </div>

                {/* Username or SPIT Email Field */}
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label" htmlFor="email-input" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    SPIT email or username
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="email-input"
                      name="loop_login_email"
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck="false"
                      className="input-field"
                      placeholder="Enter your SPIT email or username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={handleEmailFocus}
                      onBlur={handleInputBlur}
                      style={{
                        height: '48px',
                        borderRadius: '12px',
                        fontSize: '0.92rem',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        paddingLeft: '1.1rem'
                      }}
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label" htmlFor="password-input" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="password-input"
                      name="loop_login_password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className="input-field"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={handlePasswordFocus}
                      onBlur={handleInputBlur}
                      style={{
                        height: '48px',
                        borderRadius: '12px',
                        fontSize: '0.92rem',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        paddingLeft: '1.1rem',
                        paddingRight: '2.75rem'
                      }}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '1rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      tabIndex="-1"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  fontSize: '0.86rem',
                  marginTop: '-0.25rem',
                  marginBottom: '0.1rem'
                }}>
                  <Link
                    to="/forgot-password"
                    style={{
                      fontSize: '0.86rem',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      textDecoration: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    height: '48px',
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
                    fontSize: '0.94rem',
                    cursor: loading ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)'
                  }}
                  disabled={loading}
                >
                  {loading ? 'Authenticating...' : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}


        </div>
      </div>

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 960px) {
          .login-split-page {
            flex-direction: column !important;
            overflow-y: auto !important;
          }
          .login-media-half {
            width: 100% !important;
            flex: none !important;
            height: 320px !important;
            position: relative !important;
            top: 0 !important;
          }
          .login-media-half video {
            object-position: center 12% !important;
          }
          .login-quote-overlay {
            display: none !important;
          }
          .login-form-half {
            width: 100% !important;
            flex: none !important;
            height: auto !important;
            min-height: auto !important;
            padding: 2.5rem 1.5rem !important;
            border-left: none !important;
            border-top: 1px solid var(--border-color) !important;
            overflow-y: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
