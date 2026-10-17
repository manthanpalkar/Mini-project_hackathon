import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  History, 
  Search, 
  RefreshCw, 
  User, 
  Calendar, 
  Shield, 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  LogIn, 
  LogOut, 
  FileUp, 
  FileText, 
  Key, 
  Trash2, 
  UserCheck, 
  Clock,
  Layers,
  Info
} from 'lucide-react';
import { getAdminUserActivity, getAdminUserActivitySummary } from '../utils/db';

export default function AdminUserAuditModal({ isOpen, onClose, user }) {
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [expandedEventId, setExpandedEventId] = useState(null);

  const fetchUserData = useCallback(async (isRefresh = false) => {
    if (!user || (!user.email && !user._id && !user.id)) return;
    const identifier = user._id || user.id || user.email;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [activityRes, summaryRes] = await Promise.all([
        getAdminUserActivity(identifier, {
          page,
          limit: 15,
          category: activeCategory,
          search: searchQuery
        }),
        getAdminUserActivitySummary(identifier)
      ]);

      setEvents(activityRes.events || []);
      setTotalPages(activityRes.pagination?.pages || 1);
      setTotalEvents(activityRes.pagination?.total || 0);
      setSummary(summaryRes.summary || null);
    } catch (err) {
      console.error('[AUDIT_MODAL_FETCH_ERROR]', err);
      setError(err.message || 'Failed to load user activity audit logs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, page, activeCategory, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      setSearchQuery('');
      setActiveCategory('ALL');
      setExpandedEventId(null);
    }
  }, [isOpen, user?.email]);

  useEffect(() => {
    if (isOpen) {
      fetchUserData();
    }
  }, [isOpen, fetchUserData]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getCategoryColor = (category) => {
    switch ((category || '').toUpperCase()) {
      case 'AUTH':
        return { bg: 'rgba(0, 113, 227, 0.12)', text: '#0071e3', border: 'rgba(0, 113, 227, 0.25)' };
      case 'PROFILE':
        return { bg: 'rgba(175, 82, 222, 0.12)', text: '#af52de', border: 'rgba(175, 82, 222, 0.25)' };
      case 'CONTENT':
        return { bg: 'rgba(48, 209, 88, 0.12)', text: '#30d158', border: 'rgba(48, 209, 88, 0.25)' };
      case 'ADMIN':
        return { bg: 'rgba(255, 149, 0, 0.12)', text: '#ff9500', border: 'rgba(255, 149, 0, 0.25)' };
      case 'SECURITY':
        return { bg: 'rgba(255, 69, 58, 0.12)', text: '#ff453a', border: 'rgba(255, 69, 58, 0.25)' };
      case 'FEEDBACK':
        return { bg: 'rgba(100, 210, 255, 0.12)', text: '#64d2ff', border: 'rgba(100, 210, 255, 0.25)' };
      default:
        return { bg: 'rgba(142, 142, 147, 0.12)', text: 'var(--text-secondary)', border: 'rgba(142, 142, 147, 0.25)' };
    }
  };

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'AUTH_LOGIN_SUCCESS':
        return <LogIn size={15} style={{ color: '#30d158' }} />;
      case 'AUTH_LOGIN_FAIL':
        return <LogIn size={15} style={{ color: '#ff453a' }} />;
      case 'AUTH_LOGOUT':
        return <LogOut size={15} style={{ color: 'var(--text-secondary)' }} />;
      case 'AUTH_PASSWORD_RESET_REQ':
      case 'AUTH_PASSWORD_RESET_SUCCESS':
      case 'AUTH_PASSWORD_CHANGE':
        return <Key size={15} style={{ color: '#ff9500' }} />;
      case 'CONTENT_RESOURCE_UPLOAD':
      case 'CONTENT_RESOURCE_SUBMIT':
        return <FileUp size={15} style={{ color: '#30d158' }} />;
      case 'CONTENT_RESOURCE_DELETE':
      case 'CONTENT_STORY_DELETE':
      case 'USER_DELETE':
        return <Trash2 size={15} style={{ color: '#ff453a' }} />;
      case 'CONTENT_STORY_ADD':
      case 'CONTENT_STORY_SUBMIT':
        return <FileText size={15} style={{ color: '#0071e3' }} />;
      case 'PROFILE_UPDATE':
      case 'ONBOARDING_COMPLETE':
        return <UserCheck size={15} style={{ color: '#af52de' }} />;
      case 'USER_CREATE':
        return <User size={15} style={{ color: '#30d158' }} />;
      case 'ADMIN_ACTION':
      case 'ADMIN_APPROVE_RESOURCE':
      case 'CONTENT_STORY_APPROVE':
        return <Shield size={15} style={{ color: '#ff9500' }} />;
      case 'SECURITY_WARN':
        return <ShieldAlert size={15} style={{ color: '#ff453a' }} />;
      default:
        return <Clock size={15} style={{ color: 'var(--text-secondary)' }} />;
    }
  };

  const categories = ['ALL', 'AUTH', 'PROFILE', 'CONTENT', 'ADMIN', 'SECURITY', 'FEEDBACK'];

  return (
    <div 
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
    >
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '1020px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary)',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(0, 113, 227, 0.12)',
              border: '1px solid rgba(0, 113, 227, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0071e3'
            }}>
              <History size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h2 id="audit-modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  User Activity Audit Trail
                </h2>
                <span className="badge" style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                  backgroundColor: user.status === 'Active' ? 'rgba(48, 209, 88, 0.12)' : 'rgba(255, 69, 58, 0.12)',
                  color: user.status === 'Active' ? '#30d158' : '#ff453a',
                  border: `1px solid ${user.status === 'Active' ? 'rgba(48, 209, 88, 0.25)' : 'rgba(255, 69, 58, 0.25)'}`
                }}>
                  {user.status || 'Active'}
                </span>
                <span className="badge" style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(0, 113, 227, 0.1)',
                  color: '#0071e3',
                  border: '1px solid rgba(0, 113, 227, 0.2)'
                }}>
                  {user.role || 'Student'}
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Identity: <strong style={{ color: 'var(--text-primary)' }}>{user.email}</strong>
                {user.name && ` • ${user.name}`}
                {(user.branch || user.currentYear) && ` • ${user.branch || ''} ${user.currentYear || ''}`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => fetchUserData(true)}
              className="btn btn-secondary"
              title="Refresh Activity Log"
              disabled={refreshing || loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                borderRadius: '8px'
              }}
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="btn btn-secondary"
              title="Close Audit Trail (Esc)"
              aria-label="Close"
              style={{
                padding: '0.45rem',
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body - Scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Activity Intelligence Summary Cards */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <Layers size={16} style={{ color: '#0071e3' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                Activity Intelligence & Event Metrics
              </h3>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.75rem'
            }}>
              <div className="glass-panel" style={{ padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Events</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {summary ? summary.totalEvents : (loading ? '...' : 0)}
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#30d158', textTransform: 'uppercase' }}>Logins (Success)</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#30d158' }}>
                  {summary ? summary.successfulLogins : (loading ? '...' : 0)}
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#ff453a', textTransform: 'uppercase' }}>Failed Logins</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#ff453a' }}>
                  {summary ? summary.failedLogins : (loading ? '...' : 0)}
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#0071e3', textTransform: 'uppercase' }}>Uploads</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#0071e3' }}>
                  {summary ? summary.resourceUploads : (loading ? '...' : 0)}
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#af52de', textTransform: 'uppercase' }}>Profile Updates</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#af52de' }}>
                  {summary ? summary.profileUpdates : (loading ? '...' : 0)}
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#ff9500', textTransform: 'uppercase' }}>Password Events</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#ff9500' }}>
                  {summary ? summary.passwordEvents : (loading ? '...' : 0)}
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#ff9500', textTransform: 'uppercase' }}>Admin Actions</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#ff9500' }}>
                  {summary ? summary.adminInterventions : (loading ? '...' : 0)}
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', gridColumn: 'span 2' }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Recent Activity</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {summary?.recentActivityAt ? formatDate(summary.recentActivityAt) : (loading ? 'Loading...' : 'No activity on record')}
                </p>
              </div>
            </div>
          </div>

          {/* Search & Category Filter Toolbar */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            padding: '1rem',
            borderRadius: '14px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {/* Category Pills */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      setPage(1);
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: activeCategory === cat ? '1px solid #0071e3' : '1px solid var(--border-color)',
                      backgroundColor: activeCategory === cat ? '#0071e3' : 'var(--bg-surface)',
                      color: activeCategory === cat ? '#ffffff' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 240px', maxWidth: '360px' }}>
                <Search size={15} style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                  pointerEvents: 'none'
                }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Filter by action, target, or status..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    paddingLeft: '2.25rem',
                    paddingTop: '0.45rem',
                    paddingBottom: '0.45rem',
                    margin: 0,
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    height: '34px'
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setPage(1);
                    }}
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Activity Timeline / Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                Audit Timeline ({totalEvents} recorded {totalEvents === 1 ? 'event' : 'events'})
              </h3>
              {user.createdAt && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Account Created: {formatDate(user.createdAt)}
                </span>
              )}
            </div>

            {error && (
              <div style={{
                padding: '1rem',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 69, 58, 0.1)',
                border: '1px solid rgba(255, 69, 58, 0.25)',
                color: '#ff453a',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.88rem'
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem auto' }} />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Loading activity audit records...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="glass-panel" style={{
                padding: '3rem 1.5rem',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                textAlign: 'center'
              }}>
                <Info size={32} style={{ color: 'var(--text-secondary)', opacity: 0.5, margin: '0 auto 0.75rem auto' }} />
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {searchQuery || activeCategory !== 'ALL' ? 'No matching activity records' : 'No recorded activity for this user'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto' }}>
                  {searchQuery || activeCategory !== 'ALL'
                    ? 'Try adjusting your search terms or clearing the category filter.'
                    : 'This user account has no recorded audit logs in the system yet. Activities like logins, uploads, and profile edits will automatically populate here.'}
                </p>
              </div>
            ) : (
              <div className="glass-panel" style={{
                borderRadius: '14px',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)'
              }}>
                <div className="responsive-scroll-x">
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Timestamp</th>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Activity</th>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Category</th>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Origin</th>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Result</th>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Details</th>
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center' }}>Inspect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((evt) => {
                        const catStyle = getCategoryColor(evt.category);
                        const isExpanded = expandedEventId === evt._id || expandedEventId === evt.eventId;
                        const isByAdmin = evt.actionDirection === 'ON_USER_BY_ADMIN' || (evt.actorEmail && evt.actorEmail !== user.email);

                        return (
                          <React.Fragment key={evt._id || evt.eventId}>
                            <tr style={{
                              borderBottom: '1px solid var(--border-color)',
                              backgroundColor: isExpanded ? 'rgba(0, 113, 227, 0.04)' : 'transparent',
                              transition: 'background-color 0.15s ease'
                            }}>
                              <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                {formatDate(evt.createdAt)}
                              </td>
                              
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                  {getEventIcon(evt.eventType)}
                                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                                    {evt.eventType.replace(/_/g, ' ')}
                                  </span>
                                </div>
                              </td>

                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '6px',
                                  backgroundColor: catStyle.bg,
                                  color: catStyle.text,
                                  border: `1px solid ${catStyle.border}`
                                }}>
                                  {evt.category || 'SYSTEM'}
                                </span>
                              </td>

                              <td style={{ padding: '0.75rem 1rem' }}>
                                {isByAdmin ? (
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(255, 149, 0, 0.12)',
                                    color: '#ff9500',
                                    border: '1px solid rgba(255, 149, 0, 0.25)'
                                  }}>
                                    By Admin ({evt.actorEmail})
                                  </span>
                                ) : (
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(48, 209, 88, 0.12)',
                                    color: '#30d158',
                                    border: '1px solid rgba(48, 209, 88, 0.25)'
                                  }}>
                                    Self Action
                                  </span>
                                )}
                              </td>

                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: evt.outcome === 'SUCCESS' ? '#30d158' : '#ff453a'
                                }}>
                                  {evt.outcome === 'SUCCESS' ? <CheckCircle size={13} /> : <XCircle size={13} />}
                                  <span>{evt.outcome || 'SUCCESS'}</span>
                                </span>
                              </td>

                              <td style={{ padding: '0.75rem 1rem', maxWidth: '280px' }}>
                                <p style={{
                                  margin: 0,
                                  fontSize: '0.82rem',
                                  color: 'var(--text-primary)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }} title={evt.summary}>
                                  {evt.summary}
                                </p>
                              </td>

                              <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                <button
                                  onClick={() => setExpandedEventId(isExpanded ? null : (evt._id || evt.eventId))}
                                  className="btn btn-secondary"
                                  style={{
                                    padding: '0.25rem 0.6rem',
                                    fontSize: '0.75rem',
                                    borderRadius: '6px',
                                    background: isExpanded ? 'var(--bg-secondary)' : 'transparent'
                                  }}
                                  aria-expanded={isExpanded}
                                >
                                  {isExpanded ? 'Hide' : 'Inspect'}
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Metadata Row */}
                            {isExpanded && (
                              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                <td colSpan="7" style={{ padding: '1rem 1.25rem' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.82rem' }}>
                                    <div>
                                      <p style={{ margin: '0 0 0.35rem 0', fontWeight: 600, color: 'var(--text-secondary)' }}>Event Details</p>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <div><strong>Event ID:</strong> <code>{evt.eventId}</code></div>
                                        <div><strong>Target Type:</strong> {evt.targetType || 'N/A'}</div>
                                        {evt.targetId && <div><strong>Target ID:</strong> <code>{evt.targetId}</code></div>}
                                        <div><strong>Actor:</strong> {evt.actorEmail} ({evt.actorRole || 'Student'})</div>
                                        {evt.targetUserEmail && <div><strong>Target User:</strong> {evt.targetUserEmail}</div>}
                                      </div>
                                    </div>

                                    <div>
                                      <p style={{ margin: '0 0 0.35rem 0', fontWeight: 600, color: 'var(--text-secondary)' }}>Network & Client</p>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <div><strong>IP Address:</strong> <code>{evt.ipAddress || '127.0.0.1'}</code></div>
                                        <div><strong>Client Agent:</strong> <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{evt.userAgent || 'Unknown'}</span></div>
                                      </div>
                                    </div>

                                    {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                                      <div>
                                        <p style={{ margin: '0 0 0.35rem 0', fontWeight: 600, color: 'var(--text-secondary)' }}>Sanitized Event Metadata</p>
                                        <pre style={{
                                          margin: 0,
                                          padding: '0.5rem',
                                          borderRadius: '8px',
                                          backgroundColor: 'var(--bg-surface)',
                                          border: '1px solid var(--border-color)',
                                          fontSize: '0.75rem',
                                          maxHeight: '120px',
                                          overflowY: 'auto'
                                        }}>
                                          {JSON.stringify(evt.metadata, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0 0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Page {page} of {totalPages} ({totalEvents} total)
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="btn btn-secondary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.82rem',
                      borderRadius: '8px'
                    }}
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    className="btn btn-secondary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.82rem',
                      borderRadius: '8px'
                    }}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center'
        }}>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '10px',
              fontSize: '0.88rem',
              fontWeight: 600
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
