import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Mail, KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, Shield } from 'lucide-react';
import { requestPasswordReset, verifyPasswordResetCode, resetPassword } from '../utils/db';

export default function ForgotPassword() {
  const navigate = useNavigate();

  // Step state: 1 = Email, 2 = Verify Code, 3 = New Password, 4 = Success Screen
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Resend cooldown timer (60 seconds)
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

  // Step 1: Submit email to request 6-digit verification code
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const data = await requestPasswordReset(trimmedEmail);
      setSuccessMsg(data.message || 'If an account exists, a 6-digit verification code has been sent to your email.');
      setResendCooldown(60);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to request verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Resend code with cooldown protection
  const handleResendCode = async () => {
    if (resendCooldown > 0 || loading) return;
    setError('');
    setSuccessMsg('');

    setLoading(true);
    try {
      const data = await requestPasswordReset(email.trim().toLowerCase());
      setSuccessMsg(data.message || 'A new verification code has been sent to your email.');
      setResendCooldown(60);
      setCode('');
    } catch (err) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify the 6-digit code
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedCode = code.trim();
    if (!trimmedCode || !/^\d{6}$/.test(trimmedCode)) {
      setError('Please enter the valid 6-digit verification code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const data = await verifyPasswordResetCode({
        email: email.trim().toLowerCase(),
        code: trimmedCode
      });
      setResetToken(data.resetToken);
      setSuccessMsg('Code verified. Please enter your new password.');
      setStep(3);
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set and confirm new password
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

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      backgroundColor: 'var(--bg-primary)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '24px',
        border: '1px solid var(--border-color)',
        padding: '2.5rem 2.25rem',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.07)',
        position: 'relative'
      }}>
        {/* Back Link */}
        <div style={{ marginBottom: '1.75rem' }}>
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

        {/* Step Indicator Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
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
            {step === 1 && <Mail size={24} />}
            {step === 2 && <KeyRound size={24} />}
            {step === 3 && <Lock size={24} />}
            {step === 4 && <CheckCircle2 size={26} color="#34C759" />}
          </div>

          <h1 style={{
            fontSize: '1.65rem',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            color: 'var(--text-primary)',
            marginBottom: '0.4rem',
            lineHeight: 1.2
          }}>
            {step === 1 && 'Reset your password'}
            {step === 2 && 'Enter verification code'}
            {step === 3 && 'Choose a new password'}
            {step === 4 && 'Password reset complete'}
          </h1>

          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            lineHeight: 1.45,
            margin: 0
          }}>
            {step === 1 && 'Enter your SPIT email to receive a secure 6-digit recovery code.'}
            {step === 2 && `We sent a 6-digit code to ${email}. It expires in 10 minutes.`}
            {step === 3 && 'Create a strong, unique password for your account.'}
            {step === 4 && 'Your password has been securely updated. You can now sign in.'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#ef4444',
            borderRadius: '12px',
            padding: '0.8rem 1rem',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            lineHeight: 1.4
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && step !== 4 && (
          <div style={{
            backgroundColor: 'rgba(52, 199, 89, 0.1)',
            border: '1px solid rgba(52, 199, 89, 0.25)',
            color: '#34c759',
            borderRadius: '12px',
            padding: '0.8rem 1rem',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            lineHeight: 1.4
          }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1: Email Form */}
        {step === 1 && (
          <form onSubmit={handleRequestCode} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label htmlFor="reset-email" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                SPIT Email Address
              </label>
              <input
                id="reset-email"
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
                  padding: '0 1.1rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
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
                fontWeight: 600,
                fontSize: '0.94rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
                transition: 'opacity 0.2s ease'
              }}
            >
              {loading ? 'Sending code...' : 'Send verification code'}
            </button>
          </form>
        )}

        {/* STEP 2: Code Verification Form */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label htmlFor="reset-code" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                6-Digit Verification Code
              </label>
              <input
                id="reset-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
                autoFocus
                disabled={loading}
                style={{
                  width: '100%',
                  height: '52px',
                  borderRadius: '12px',
                  fontSize: '1.35rem',
                  letterSpacing: '0.35em',
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.trim().length !== 6}
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
                fontWeight: 600,
                fontSize: '0.94rem',
                cursor: (loading || code.trim().length !== 6) ? 'not-allowed' : 'pointer',
                opacity: (loading || code.trim().length !== 6) ? 0.65 : 1,
                transition: 'opacity 0.2s ease'
              }}
            >
              {loading ? 'Verifying code...' : 'Verify code'}
            </button>

            {/* Resend Cooldown Section */}
            <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
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
                  padding: '4px 8px',
                  borderRadius: '6px'
                }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend verification code'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Set New Password Form */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label htmlFor="new-password" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
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
                    padding: '0 2.75rem 0 1.1rem',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
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
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-new-password" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirm-new-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
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
                    padding: '0 2.75rem 0 1.1rem',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem',
                border: 'none',
                backgroundColor: 'var(--accent-color)',
                color: 'var(--accent-inverse)',
                fontWeight: 600,
                fontSize: '0.94rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
                transition: 'opacity 0.2s ease'
              }}
            >
              {loading ? 'Updating password...' : 'Save and set new password'}
            </button>
          </form>
        )}

        {/* STEP 4: Success Screen */}
        {step === 4 && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{
              backgroundColor: 'rgba(52, 199, 89, 0.1)',
              borderRadius: '16px',
              padding: '1.25rem',
              color: '#34c759',
              fontSize: '0.92rem',
              lineHeight: 1.5
            }}>
              Your account password has been updated securely. For security, please sign in with your new password.
            </div>

            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
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
                fontWeight: 600,
                fontSize: '0.94rem',
                cursor: 'pointer'
              }}
            >
              Proceed to Sign In
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
