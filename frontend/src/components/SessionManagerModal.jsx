import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Laptop, Smartphone, Monitor, X, Trash2, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { getUserSessions, revokeUserSession, revokeOtherUserSessions } from '../utils/db';

export default function SessionManagerModal({ isOpen, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const loadSessions = async () => {
    try {
      setLoading(true);
      const res = await getUserSessions();
      setSessions(res.sessions || []);
    } catch (err) {
      setMessage({ text: err.message || 'Failed to load active sessions.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setMessage({ text: '', type: '' });
      loadSessions();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRevokeSingle = async (sessionId) => {
    try {
      setRevokingId(sessionId);
      await revokeUserSession(sessionId);
      setMessage({ text: 'Session terminated successfully.', type: 'success' });
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    } catch (err) {
      setMessage({ text: err.message || 'Failed to terminate session.', type: 'error' });
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    if (!window.confirm('Are you sure you want to log out of all other devices? This will invalidate all other active sessions.')) {
      return;
    }
    try {
      setRevokingAll(true);
      const res = await revokeOtherUserSessions();
      setMessage({ text: res.message || 'All other sessions have been terminated.', type: 'success' });
      setSessions(prev => prev.filter(s => s.isCurrent));
    } catch (err) {
      setMessage({ text: err.message || 'Failed to revoke other sessions.', type: 'error' });
    } finally {
      setRevokingAll(false);
    }
  };

  const getDeviceIcon = (deviceSummary = '') => {
    const lower = deviceSummary.toLowerCase();
    if (lower.includes('android') || lower.includes('ios') || lower.includes('iphone')) {
      return <Smartphone size={18} className="text-blue-500" />;
    }
    if (lower.includes('mac') || lower.includes('windows') || lower.includes('linux')) {
      return <Laptop size={18} className="text-emerald-500" />;
    }
    return <Monitor size={18} className="text-purple-500" />;
  };

  const otherSessionsCount = sessions.filter(s => !s.isCurrent).length;

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary, #ffffff)',
        color: 'var(--text-primary, #111827)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-color, #e5e7eb)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(0, 113, 227, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-color, #0071E3)'
            }}>
              <Shield size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Active Devices & Sessions</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)', margin: '2px 0 0' }}>
                Manage persistent logins and multi-device access
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary, #6b7280)',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {message.text && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              marginBottom: '1rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
              color: message.type === 'error' ? '#ef4444' : '#16a34a',
              border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`
            }}>
              {message.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)' }}>
              LOGGED-IN DEVICES ({sessions.length})
            </span>
            {otherSessionsCount > 0 && (
              <button
                onClick={handleRevokeOthers}
                disabled={revokingAll}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#dc2626',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  cursor: 'pointer',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Trash2 size={13} />
                {revokingAll ? 'Revoking...' : `Log out of other devices (${otherSessionsCount})`}
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary, #6b7280)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '0.85rem' }}>Loading active sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary, #6b7280)' }}>
              <p>No active sessions found.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sessions.map((s) => (
                <div
                  key={s.sessionId}
                  style={{
                    padding: '0.9rem 1rem',
                    borderRadius: '12px',
                    border: s.isCurrent ? '1.5px solid var(--primary-color, #0071E3)' : '1px solid var(--border-color, #e5e7eb)',
                    backgroundColor: s.isCurrent ? 'rgba(0, 113, 227, 0.03)' : 'var(--bg-secondary, #f9fafb)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-primary, #ffffff)',
                      border: '1px solid var(--border-color, #e5e7eb)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {getDeviceIcon(s.deviceSummary)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{s.deviceSummary || 'Web Browser'}</span>
                        {s.isCurrent && (
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(0, 113, 227, 0.15)',
                            color: 'var(--primary-color, #0071E3)'
                          }}>
                            This Device
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)', marginTop: '2px', display: 'flex', gap: '0.75rem' }}>
                        <span>IP: {s.ipAddress || '127.0.0.1'}</span>
                        <span>•</span>
                        <span>Active: {new Date(s.lastActive || s.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {!s.isCurrent && (
                    <button
                      onClick={() => handleRevokeSingle(s.sessionId)}
                      disabled={revokingId === s.sessionId}
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color, #d1d5db)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary, #6b7280)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Trash2 size={13} />
                      {revokingId === s.sessionId ? 'Revoking...' : 'Revoke'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-secondary, #f9fafb)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)' }}>
            Tokens automatically refresh without requiring re-login
          </span>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem', borderRadius: '10px' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
