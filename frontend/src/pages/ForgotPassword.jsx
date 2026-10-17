import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Mail, KeyRound, Lock, Eye, EyeOff, 
  CheckCircle2, AlertCircle, RefreshCw, Shield, 
  Sun, Moon, Check 
} from 'lucide-react';
import { requestPasswordReset, verifyPasswordResetCode, resetPassword } from '../utils/db';

export default function ForgotPassword() {
  const navigate = useNavigate();

  // Theme: dark by default as specified in design requirement
  const [isDark, setIsDark] = useState(true);

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
  const [successMsg, setSuccessMsg] = useState('');

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

  // Color theme tokens
  const theme = {
    pageBg: isDark ? '#0b0b0e' : '#f4f4f6',
    cardBg: isDark ? '#16161b' : '#ffffff',
    inputBg: isDark ? '#1f1f27' : '#f9f9fb',
    border: isDark ? '#3f3f46' : '#e4e4e7',
    guideRing: isDark ? '#272732' : '#e2e2ea',
    badgeBg: isDark ? '#1c1c24' : '#f1f1f5',
    textPrimary: isDark ? '#ffffff' : '#111827',
    textSecondary: isDark ? '#71717a' : '#6b7280',
    redAccent: '#ef4444',
    successGreen: '#10b981',
    cardShadow: isDark 
      ? '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)'
      : '0 20px 40px -12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)'
  };

  // STEP 1: Request 6-digit OTP to SPIT email
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your registered SPIT email address.');
      return;
    }

    setLoading(true);
    try {
      const data = await requestPasswordReset(trimmedEmail);
      setSuccessMsg(data.message || 'If an account exists, a 6-digit recovery code has been sent.');
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      setOtpStage('entry');
      setStep(2);
      setTimeout(() => {
        if (otpInputRefs.current[0]) {
          otpInputRefs.current[0].focus();
        }
      }, 100);
    } catch (err) {
      setError(err.message || 'Failed to request verification code. Please try again.');
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
      setTimeout(() => {
        if (otpInputRefs.current[0]) {
          otpInputRefs.current[0].focus();
        }
      }, 100);
    } catch (err) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger State B & API Verification
  const executeVerification = async (codeToVerify) => {
    if (loading || otpStage !== 'entry') return;
    setError('');
    setSuccessMsg('');
    setLoading(true);
    setOtpStage('verifying'); // State B: Orbital Animation starts

    try {
      const startTime = Date.now();
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
      setError(err.message || 'Invalid or expired verification code.');
      setOtpStage('entry'); // Revert back to State A
      setLoading(false);
      setTimeout(() => {
        if (otpInputRefs.current[0]) {
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
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1rem',
        backgroundColor: theme.pageBg,
        transition: 'background-color 0.3s ease',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)'
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '380px',
          backgroundColor: theme.cardBg,
          borderRadius: '26px',
          border: `1px solid ${theme.border}`,
          padding: '32px',
          boxShadow: theme.cardShadow,
          position: 'relative',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          boxSizing: 'border-box'
        }}
      >
        {/* Top Bar: Back Link & Theme Toggle */}
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
              gap: '0.4rem',
              color: theme.textSecondary,
              fontSize: '0.85rem',
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = theme.textPrimary; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = theme.textSecondary; }}
          >
            <ArrowLeft size={16} />
            <span>Sign in</span>
          </Link>

          {/* Accessible Theme Toggle */}
          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: theme.inputBg,
              border: `1px solid ${theme.border}`,
              color: theme.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = theme.textPrimary;
              e.currentTarget.style.borderColor = theme.redAccent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = theme.textSecondary;
              e.currentTarget.style.borderColor = theme.border;
            }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        {/* STEP 1: Enter Email */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                color: theme.redAccent
              }}>
                <Mail size={24} />
              </div>

              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                color: theme.textPrimary,
                margin: '0 0 0.4rem 0'
              }}>
                Reset Password
              </h1>
              <p style={{
                color: theme.textSecondary,
                fontSize: '0.88rem',
                lineHeight: 1.45,
                margin: 0
              }}>
                Enter your SPIT email address to receive a secure 6-digit recovery code.
              </p>
            </div>

            {error && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: theme.redAccent,
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

            <form onSubmit={handleRequestCode} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label 
                  htmlFor="spit-email-input" 
                  style={{ 
                    display: 'block', 
                    fontSize: '0.82rem', 
                    fontWeight: 600, 
                    color: theme.textPrimary, 
                    marginBottom: '0.4rem' 
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
                    height: '46px',
                    borderRadius: '12px',
                    fontSize: '0.92rem',
                    backgroundColor: theme.inputBg,
                    border: `1px solid ${theme.border}`,
                    color: theme.textPrimary,
                    padding: '0 1rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = theme.redAccent; }}
                  onBlur={(e) => { e.target.style.borderColor = theme.border; }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  height: '46px',
                  borderRadius: '12px',
                  width: '100%',
                  border: 'none',
                  backgroundColor: theme.redAccent,
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
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
          </div>
        )}

        {/* STEP 2: Three-Stage Animated OTP Verification */}
        {step === 2 && (
          <div>
            {/* Header Titles Based on Sub-Stage */}
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <h1 style={{
                fontSize: '1.45rem',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                color: theme.textPrimary,
                margin: '0 0 0.35rem 0'
              }}>
                {otpStage === 'entry' && 'Enter Verification Code'}
                {otpStage === 'verifying' && 'Verifying...'}
                {otpStage === 'success' && 'Verification Complete'}
              </h1>
              <p style={{
                color: theme.textSecondary,
                fontSize: '0.85rem',
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
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: theme.redAccent,
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
                      disabled={loading}
                      style={{
                        width: '46px',
                        height: '52px',
                        borderRadius: '12px',
                        fontSize: '1.35rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        backgroundColor: theme.inputBg,
                        border: `1.5px solid ${digit ? theme.redAccent : theme.border}`,
                        color: theme.textPrimary,
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'border-color 0.2s ease, transform 0.15s ease'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = theme.redAccent;
                        e.target.style.transform = 'scale(1.04)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = digit ? theme.redAccent : theme.border;
                        e.target.style.transform = 'scale(1)';
                      }}
                    />
                  ))}
                </div>

                {/* Resend Cooldown Section */}
                <div style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || loading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: resendCooldown > 0 ? theme.textSecondary : theme.redAccent,
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
                    border: `1.5px dashed ${theme.guideRing}`,
                    pointerEvents: 'none'
                  }}
                />

                {/* Center Core Pulse */}
                <div style={{
                  position: 'absolute',
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: `${theme.redAccent}15`,
                  border: `1px solid ${theme.redAccent}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.redAccent
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
                          backgroundColor: theme.badgeBg,
                          border: `1.5px solid ${theme.border}`,
                          color: theme.textPrimary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)'
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
                    backgroundColor: theme.successGreen,
                    boxShadow: `0 0 24px ${theme.successGreen}60`,
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
                color: theme.successGreen,
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
                backgroundColor: theme.inputBg,
                border: `1px solid ${theme.border}`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                color: theme.successGreen
              }}>
                <Lock size={24} />
              </div>

              <h1 style={{
                fontSize: '1.45rem',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                color: theme.textPrimary,
                margin: '0 0 0.35rem 0'
              }}>
                Create New Password
              </h1>
              <p style={{
                color: theme.textSecondary,
                fontSize: '0.85rem',
                lineHeight: 1.45,
                margin: 0
              }}>
                Set a strong, unique password for your account.
              </p>
            </div>

            {error && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: theme.redAccent,
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
                    fontSize: '0.82rem', 
                    fontWeight: 600, 
                    color: theme.textPrimary, 
                    marginBottom: '0.4rem' 
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
                      height: '46px',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.border}`,
                      color: theme.textPrimary,
                      padding: '0 2.5rem 0 1rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => { e.target.style.borderColor = theme.redAccent; }}
                    onBlur={(e) => { e.target.style.borderColor = theme.border; }}
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
                      color: theme.textSecondary,
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
                    fontSize: '0.82rem', 
                    fontWeight: 600, 
                    color: theme.textPrimary, 
                    marginBottom: '0.4rem' 
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
                      height: '46px',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      backgroundColor: theme.inputBg,
                      border: `1px solid ${theme.border}`,
                      color: theme.textPrimary,
                      padding: '0 2.5rem 0 1rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => { e.target.style.borderColor = theme.redAccent; }}
                    onBlur={(e) => { e.target.style.borderColor = theme.border; }}
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
                      color: theme.textSecondary,
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
                  height: '46px',
                  borderRadius: '12px',
                  width: '100%',
                  border: 'none',
                  backgroundColor: theme.redAccent,
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
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
              backgroundColor: `${theme.successGreen}20`,
              border: `2px solid ${theme.successGreen}`,
              color: theme.successGreen,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0.5rem auto 0 auto'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h1 style={{
                fontSize: '1.45rem',
                fontWeight: 800,
                color: theme.textPrimary,
                margin: '0 0 0.4rem 0'
              }}>
                Password Updated
              </h1>
              <p style={{
                color: theme.textSecondary,
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
                height: '46px',
                borderRadius: '12px',
                width: '100%',
                border: 'none',
                backgroundColor: theme.redAccent,
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.92rem',
                cursor: 'pointer'
              }}
            >
              Sign In to Your Account
            </button>
          </div>
        )}

        {/* Footer Security Badge */}
        <div style={{
          marginTop: '1.75rem',
          paddingTop: '1.25rem',
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          color: theme.textSecondary,
          fontSize: '0.76rem'
        }}>
          <Shield size={13} color={theme.successGreen} />
          <span>Encrypted with 256-bit server-side verification</span>
        </div>
      </div>
    </div>
  );
}
