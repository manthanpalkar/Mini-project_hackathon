import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Mail, KeyRound, Lock, Eye, EyeOff, 
  CheckCircle2, AlertCircle, RefreshCw, Shield, 
  Check, Info 
} from 'lucide-react';
import { requestPasswordReset, verifyPasswordResetCode, resetPassword } from '../utils/db';

export default function ForgotPassword() {
  const navigate = useNavigate();

  // Recovery flow step:
  // 1 = Enter Email
  // 2 = OTP Verification (States A, B, C)
  // 3 = Set New Password (State D)
  // 4 = Complete / Success screen
  const [step, setStep] = useState(1);

  // OTP Sub-stages for step 2:
  // 'entry' = State A (6 separate input boxes)
  // 'verifying' = State B (orbital rotation animation)
  // 'success' = State C (collapse to center, 64px emerald circle checkmark, confetti)
  const [otpStage, setOtpStage] = useState('entry');

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpInputRefs = useRef([]);

  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isGoogleOnly, setIsGoogleOnly] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [isLocked, setIsLocked] = useState(false);

  // 60-second cooldown timer for code resend
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let timer = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  // STEP 1: Request 6-digit OTP to SPIT email
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSuccessMsg('');
    setIsGoogleOnly(false);
    setIsNotFound(false);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your registered SPIT email address.');
      return;
    }

    setLoading(true);
    try {
      const data = await requestPasswordReset(trimmedEmail);
      if (data && (data.success || data.emailSent)) {
        setSuccessMsg(data.message || 'A 6-digit recovery code has been sent to your registered SPIT email address.');
        setResendCooldown(60);
        setOtp(['', '', '', '', '', '']);
        setOtpStage('entry');
        setRemainingAttempts(5);
        setIsLocked(false);
        setStep(2);
        setTimeout(() => {
          if (otpInputRefs.current[0]) {
            otpInputRefs.current[0].focus();
          }
        }, 100);
      } else {
        setError('No account found with this email. Please sign up with Google using your SPIT email.');
        setIsNotFound(true);
      }
    } catch (err) {
      if (err.isNotFound || err.code === 'ACCOUNT_NOT_FOUND') {
        setError(err.message || 'No account found with this email. Please sign up with Google using your SPIT email.');
        setIsNotFound(true);
      } else if (err.code === 'GOOGLE_ACCOUNT_ONLY' || err.isGoogleOnly || err.message?.includes('Continue with Google')) {
        setError(err.message || 'Password reset isn’t available for this account. If you signed up with Google, return to Login and choose Continue with Google.');
        setIsGoogleOnly(true);
      } else {
        setError(err.message || 'Failed to request password reset. Please try again.');
        setIsGoogleOnly(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // Resend code with cooldown protection
  const handleResendCode = async () => {
    if (resendCooldown > 0 || loading) return;
    setError('');
    setSuccessMsg('');

    setLoading(true);
    try {
      const data = await requestPasswordReset(email.trim().toLowerCase());
      setSuccessMsg(data.message || 'A new verification code has been sent to your email.');
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      setOtpStage('entry');
      setRemainingAttempts(5);
      setIsLocked(false);
      setTimeout(() => {
        if (otpInputRefs.current[0]) {
          otpInputRefs.current[0].focus();
        }
      }, 100);
    } catch (err) {
      if (err.isNotFound || err.code === 'ACCOUNT_NOT_FOUND') {
        setError(err.message || 'No account found with this email. Please sign up with Google using your SPIT email.');
        setIsNotFound(true);
        setStep(1);
      } else {
        setError(err.message || 'Failed to resend verification code.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Trigger State B & API Verification
  const executeVerification = async (codeToVerify) => {
    if (loading || otpStage !== 'entry' || isLocked) return;
    setError('');
    setSuccessMsg('');
    setLoading(true);
    setOtpStage('verifying'); // State B: Orbital Animation starts

    try {
      const verifyPromise = verifyPasswordResetCode({
        email: email.trim().toLowerCase(),
        code: codeToVerify
      });

      // Ensure minimum 1200ms so orbital animation is observed smoothly
      const [data] = await Promise.all([
        verifyPromise,
        new Promise((resolve) => setTimeout(resolve, 1200))
      ]);

      setResetToken(data.resetToken);
      setOtpStage('success'); // State C: Badges collapse, 64px emerald circle checkmark & confetti

      // Hold State C for 1400ms before advancing to State D (Set New Password)
      setTimeout(() => {
        setStep(3);
        setOtpStage('entry');
        setLoading(false);
      }, 1400);
    } catch (err) {
      if (err.isLocked || err.code === 'MAX_ATTEMPTS_EXCEEDED' || err.code === 'RATE_LIMIT_EXCEEDED') {
        setIsLocked(true);
        setRemainingAttempts(0);
        setError(err.message || 'Too many incorrect attempts (maximum 5 attempts). This code is locked. Please request a new code.');
      } else {
        if (typeof err.remainingAttempts === 'number') {
          setRemainingAttempts(err.remainingAttempts);
        }
        setError(err.message || 'Invalid or expired verification code.');
      }
      setOtpStage('entry'); // Revert back to State A
      setLoading(false);
      setTimeout(() => {
        if (otpInputRefs.current[0] && !err.isLocked && err.code !== 'MAX_ATTEMPTS_EXCEEDED') {
          otpInputRefs.current[0].focus();
        }
      }, 100);
    }
  };

  // State A: OTP input change handler
  const handleOtpChange = (index, val) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);

    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-trigger when all 6 boxes are filled
    const fullCode = newOtp.join('');
    if (fullCode.length === 6 && !newOtp.includes('')) {
      executeVerification(fullCode);
    }
  };

  // State A: OTP key down handler (backspace / arrow navigation)
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        otpInputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
      } else {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // State A: Paste full 6-digit code
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;

    const newOtp = ['', '', '', '', '', ''];
    for (let i = 0; i < pasteData.length; i++) {
      newOtp[i] = pasteData[i];
    }
    setOtp(newOtp);

    const nextIndex = Math.min(pasteData.length, 5);
    otpInputRefs.current[nextIndex]?.focus();

    if (pasteData.length === 6) {
      executeVerification(pasteData);
    }
  };

  // STEP 3: Submit new password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters in length.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const data = await resetPassword({
        email: email.trim().toLowerCase(),
        resetToken,
        newPassword,
        confirmPassword
      });
      setSuccessMsg(data.message || 'Your password has been successfully reset.');
      setStep(4);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please restart the recovery process.');
    } finally {
      setLoading(false);
    }
  };

  // 6 Orbital coordinates calculation for State B (radius = 65px around center 100,100)
  const orbitRadius = 65;
  const orbitBadges = [0, 1, 2, 3, 4, 5].map((idx) => {
    const angleDeg = idx * 60;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = Math.round(100 + orbitRadius * Math.cos(angleRad) - 18);
    const y = Math.round(100 + orbitRadius * Math.sin(angleRad) - 18);
    return {
      digit: otp[idx] || String(idx + 1),
      x,
      y,
      angleDeg
    };
  });

  // Confetti particles for State C
  const confettiParticles = [
    { angle: 0, dist: 55, color: '#10b981' },
    { angle: 45, dist: 60, color: '#34d399' },
    { angle: 90, dist: 52, color: '#6ee7b7' },
    { angle: 135, dist: 62, color: '#10b981' },
    { angle: 180, dist: 54, color: '#34d399' },
    { angle: 225, dist: 58, color: '#a7f3d0' },
    { angle: 270, dist: 50, color: '#10b981' },
    { angle: 315, dist: 64, color: '#6ee7b7' }
  ];

  return (
    <div 
      style={{
        minHeight: '85vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        backgroundColor: 'var(--bg-primary)',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)'
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          borderRadius: '24px',
          border: '1px solid var(--border-color)',
          padding: '2.5rem 2.25rem',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.07)',
          position: 'relative',
          boxSizing: 'border-box'
        }}
      >
        {/* Top Bar: Back Link */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.75rem'
        }}>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              color: 'var(--text-secondary)',
              fontSize: '0.86rem',
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <ArrowLeft size={16} />
            <span>Back to sign in</span>
          </Link>
        </div>

        {/* STEP 1: Enter Email */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                color: 'var(--text-primary)'
              }}>
                <Mail size={24} />
              </div>

              <h1 style={{
                fontSize: '1.55rem',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                color: 'var(--text-primary)',
                margin: '0 0 0.4rem 0'
              }}>
                Reset Password
              </h1>
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '0.88rem',
                lineHeight: 1.45,
                margin: 0
              }}>
                Enter your SPIT email address to receive a secure 6-digit recovery code.
              </p>
            </div>

            {error && isGoogleOnly && (
              <div style={{
                backgroundColor: 'rgba(234, 67, 53, 0.08)',
                border: '1px solid rgba(234, 67, 53, 0.25)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1.25rem',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <AlertCircle size={18} style={{ color: '#ea4335', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {error}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/login', { state: { infoMessage: error } })}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: '#ea4335',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s ease'
                  }}
                >
                  Return to Login & Continue with Google
                </button>
              </div>
            )}

            {isNotFound && (
              <div style={{
                backgroundColor: 'rgba(234, 67, 53, 0.08)',
                border: '1px solid rgba(234, 67, 53, 0.3)',
                borderRadius: '12px',
                padding: '1.1rem',
                marginBottom: '1.25rem',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', marginBottom: '0.75rem' }}>
                  <AlertCircle size={20} style={{ color: '#ea4335', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ea4335', marginBottom: '0.2rem' }}>
                      Account Not Found
                    </div>
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {error || 'No account found with this email. Please sign up with Google using your SPIT email.'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: '#ea4335',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s ease',
                    boxShadow: '0 2px 6px rgba(234, 67, 53, 0.25)'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  Sign up with Google with SPIT email
                </button>
              </div>
            )}

            {error && !isGoogleOnly && !isNotFound && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                borderRadius: '12px',
                padding: '0.75rem 0.9rem',
                fontSize: '0.84rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            {notice && (
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1.25rem',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', marginBottom: '0.65rem' }}>
                  <Info size={18} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {notice}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', paddingLeft: '1.75rem' }}>
                  <Link
                    to="/login"
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#3b82f6',
                      textDecoration: 'underline'
                    }}
                  >
                    Go to Login
                  </Link>
                </div>
              </div>
            )}

            <form onSubmit={handleRequestCode} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label 
                  htmlFor="spit-email-input" 
                  style={{ 
                    display: 'block', 
                    fontSize: '0.84rem', 
                    fontWeight: 600, 
                    color: 'var(--text-primary)', 
                    marginBottom: '0.45rem' 
                  }}
                >
                  SPIT Email
                </label>
                <input
                  id="spit-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student.2026@spit.ac.in"
                  required
                  autoFocus
                  disabled={loading}
                  style={{
                    width: '100%',
                    height: '48px',
                    borderRadius: '12px',
                    fontSize: '0.92rem',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '0 1rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--text-primary)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  height: '48px',
                  borderRadius: '12px',
                  width: '100%',
                  border: 'none',
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-inverse)',
                  fontWeight: 600,
                  fontSize: '0.94rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.75 : 1,
                  transition: 'opacity 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                {loading && <RefreshCw size={15} className="animate-spin" />}
                <span>{loading ? 'Sending code...' : 'Send Recovery Code'}</span>
              </button>
            </form>

            <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Signed up with Google? Return to{' '}
                <Link to="/login" style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'underline' }}>
                  Login
                </Link>{' '}
                and choose Continue with Google.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: Three-Stage Animated OTP Verification */}
        {step === 2 && (
          <div>
            {/* Header Titles Based on Sub-Stage */}
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                color: 'var(--text-primary)'
              }}>
                <KeyRound size={24} />
              </div>

              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                color: 'var(--text-primary)',
                margin: '0 0 0.35rem 0'
              }}>
                {otpStage === 'entry' && 'Enter Verification Code'}
                {otpStage === 'verifying' && 'Verifying...'}
                {otpStage === 'success' && 'Verification Complete'}
              </h1>
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '0.86rem',
                lineHeight: 1.45,
                margin: 0
              }}>
                {otpStage === 'entry' && `We sent a 6-digit code to ${email}`}
                {otpStage === 'verifying' && 'Processing security authentication'}
                {otpStage === 'success' && 'Code verified successfully'}
              </p>
            </div>

            {error && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                borderRadius: '12px',
                padding: '0.75rem 0.9rem',
                fontSize: '0.84rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            {/* STATE A: OTP Entry (6 separate numeric inputs) */}
            {otpStage === 'entry' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div 
                  onPaste={handleOtpPaste}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpInputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      autoFocus={idx === 0}
                      disabled={loading || isLocked}
                      style={{
                        width: '46px',
                        height: '52px',
                        borderRadius: '12px',
                        fontSize: '1.35rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        backgroundColor: isLocked ? 'rgba(239, 68, 68, 0.04)' : 'var(--bg-tertiary)',
                        border: `1.5px solid ${isLocked ? '#ef4444' : digit ? 'var(--text-primary)' : 'var(--border-color)'}`,
                        color: 'var(--text-primary)',
                        boxSizing: 'border-box',
                        outline: 'none',
                        cursor: isLocked ? 'not-allowed' : 'text',
                        transition: 'border-color 0.2s ease, transform 0.15s ease'
                      }}
                      onFocus={(e) => {
                        if (!isLocked) {
                          e.target.style.borderColor = 'var(--text-primary)';
                          e.target.style.transform = 'scale(1.04)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!isLocked) {
                          e.target.style.borderColor = digit ? 'var(--text-primary)' : 'var(--border-color)';
                          e.target.style.transform = 'scale(1)';
                        }
                      }}
                    />
                  ))}
                </div>

                {/* Remaining Attempts / Rate Limit Indicator */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  fontSize: '0.82rem',
                  color: isLocked ? '#ef4444' : remainingAttempts <= 2 ? '#f59e0b' : 'var(--text-secondary)',
                  fontWeight: isLocked || remainingAttempts <= 2 ? 600 : 500,
                  marginTop: '-0.35rem'
                }}>
                  <Shield size={14} />
                  <span>
                    {isLocked 
                      ? 'Maximum attempts reached (5/5). Code is locked.' 
                      : `Attempts remaining: ${remainingAttempts} of 5`}
                  </span>
                </div>

                {/* If locked, display direct Recovery Button */}
                {isLocked ? (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={loading}
                    style={{
                      height: '46px',
                      borderRadius: '12px',
                      width: '100%',
                      border: 'none',
                      backgroundColor: 'var(--accent-color)',
                      color: 'var(--accent-inverse)',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    <span>Request New Recovery Code</span>
                  </button>
                ) : (
                  /* Resend Cooldown Section */
                  <div style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendCooldown > 0 || loading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: resendCooldown > 0 ? 'var(--text-secondary)' : 'var(--accent-color)',
                        cursor: resendCooldown > 0 ? 'default' : 'pointer',
                        fontSize: '0.84rem',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '4px 8px'
                      }}
                    >
                      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                      <span>
                        {resendCooldown > 0 
                          ? `Resend code in ${resendCooldown}s` 
                          : 'Resend verification code'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STATE B: Orbital Rotation Animation */}
            {otpStage === 'verifying' && (
              <div style={{
                position: 'relative',
                width: '200px',
                height: '200px',
                margin: '0 auto 1.5rem auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {/* Guide Ring */}
                <div 
                  className="animate-pulse-ring"
                  style={{
                    position: 'absolute',
                    width: '130px',
                    height: '130px',
                    borderRadius: '50%',
                    border: '1.5px dashed var(--border-color)',
                    pointerEvents: 'none'
                  }}
                />

                {/* Center Core Pulse */}
                <div style={{
                  position: 'absolute',
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444'
                }}>
                  <KeyRound size={20} />
                </div>

                {/* Rotating Orbital Track */}
                <div 
                  className="animate-loop-orbit"
                  style={{
                    position: 'absolute',
                    width: '200px',
                    height: '200px',
                    top: 0,
                    left: 0
                  }}
                >
                  {orbitBadges.map((badge, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'absolute',
                        left: `${badge.x}px`,
                        top: `${badge.y}px`,
                        width: '36px',
                        height: '36px'
                      }}
                    >
                      {/* Counter-rotating badge keeps digits upright */}
                      <div
                        className="animate-loop-counter-orbit"
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--bg-surface, #ffffff)',
                          border: '1.5px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                        }}
                      >
                        {badge.digit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STATE C: Success Animation (Emerald Circle Checkmark & Confetti) */}
            {otpStage === 'success' && (
              <div style={{
                position: 'relative',
                width: '200px',
                height: '200px',
                margin: '0 auto 1.5rem auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {/* Radial Confetti Burst Particles */}
                {confettiParticles.map((particle, idx) => {
                  const rad = (particle.angle * Math.PI) / 180;
                  const tx = Math.round(particle.dist * Math.cos(rad));
                  const ty = Math.round(particle.dist * Math.sin(rad));
                  return (
                    <div
                      key={idx}
                      style={{
                        position: 'absolute',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: particle.color,
                        '--tx': `${tx}px`,
                        '--ty': `${ty}px`,
                        animation: 'loop-confetti-burst 0.8s ease-out forwards',
                        boxShadow: `0 0 8px ${particle.color}`
                      }}
                    />
                  );
                })}

                {/* 64px Emerald Circle with Spring Overshoot */}
                <div 
                  className="animate-spring-overshoot"
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 24px rgba(16, 185, 129, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    zIndex: 2
                  }}
                >
                  <Check size={36} strokeWidth={3} />
                </div>
              </div>
            )}

            {/* Footer Status Display */}
            {otpStage === 'success' ? (
              <div style={{
                textAlign: 'center',
                color: '#10b981',
                fontWeight: 600,
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                paddingTop: '0.5rem'
              }}>
                <Lock size={15} />
                <span>Verified and Secure</span>
              </div>
            ) : null}
          </div>
        )}

        {/* STEP 3 / STATE D: Secure New-Password Form */}
        {step === 3 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                color: '#10b981'
              }}>
                <Lock size={24} />
              </div>

              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                color: 'var(--text-primary)',
                margin: '0 0 0.35rem 0'
              }}>
                Create New Password
              </h1>
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '0.86rem',
                lineHeight: 1.45,
                margin: 0
              }}>
                Set a strong, unique password for your account.
              </p>
            </div>

            {error && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                borderRadius: '12px',
                padding: '0.75rem 0.9rem',
                fontSize: '0.84rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label 
                  htmlFor="new-pwd" 
                  style={{ 
                    display: 'block', 
                    fontSize: '0.84rem', 
                    fontWeight: 600, 
                    color: 'var(--text-primary)', 
                    marginBottom: '0.45rem' 
                  }}
                >
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="new-pwd"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    autoFocus
                    disabled={loading}
                    style={{
                      width: '100%',
                      height: '48px',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '0 2.5rem 0 1rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--text-primary)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.9rem',
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
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label 
                  htmlFor="confirm-new-pwd" 
                  style={{ 
                    display: 'block', 
                    fontSize: '0.84rem', 
                    fontWeight: 600, 
                    color: 'var(--text-primary)', 
                    marginBottom: '0.45rem' 
                  }}
                >
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="confirm-new-pwd"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    disabled={loading}
                    style={{
                      width: '100%',
                      height: '48px',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '0 2.5rem 0 1rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--text-primary)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.9rem',
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
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  height: '48px',
                  borderRadius: '12px',
                  width: '100%',
                  border: 'none',
                  backgroundColor: 'var(--accent-color)',
                  color: 'var(--accent-inverse)',
                  fontWeight: 600,
                  fontSize: '0.94rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.75 : 1,
                  transition: 'opacity 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                {loading && <RefreshCw size={15} className="animate-spin" />}
                <span>{loading ? 'Saving password...' : 'Save and Set Password'}</span>
              </button>
            </form>
          </div>
        )}

        {/* STEP 4: Success Completion */}
        {step === 4 && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(52, 199, 89, 0.1)',
              border: '2px solid #34c759',
              color: '#34c759',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0.5rem auto 0 auto'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: '0 0 0.4rem 0'
              }}>
                Password Updated
              </h1>
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '0.88rem',
                lineHeight: 1.5,
                margin: 0
              }}>
                Your password has been securely reset. You can now sign in using your new credentials.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              style={{
                height: '48px',
                borderRadius: '12px',
                width: '100%',
                border: 'none',
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-inverse)',
                fontWeight: 600,
                fontSize: '0.94rem',
                cursor: 'pointer'
              }}
            >
              Sign In to Your Account
            </button>
          </div>
        )}

        {/* Footer Security Badge */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          color: 'var(--text-secondary)',
          fontSize: '0.78rem'
        }}>
          <Shield size={14} color="#34C759" />
          <span>Encrypted with 256-bit server-side verification</span>
        </div>
      </div>
    </div>
  );
}
