import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Shield, AlertTriangle, CheckCircle, XCircle,
  Search, RefreshCw, ChevronDown, ChevronRight
} from 'lucide-react';
import { getAdminAuditLogs } from '../utils/db';

const CATEGORIES = ['All', 'AUTH', 'PROFILE', 'CONTENT', 'FEEDBACK', 'ADMIN', 'SECURITY'];
const OUTCOMES = ['All', 'SUCCESS', 'FAILURE', 'DENIED'];

export default function AdminAuditLogsTab() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [category, setCategory] = useState('All');
  const [outcome, setOutcome] = useState('All');
  const [search, setSearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  const fetchLogs = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await getAdminAuditLogs({
        page,
        limit: 25,
        category,
        outcome,
        search: searchRef.current
      });
      setLogs(res.items || []);
      setPagination(res.pagination || { total: 0, page: 1, limit: 25, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [category, outcome]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const toggleExpand = (eventId) => {
    setExpandedLogId(prev => prev === eventId ? null : eventId);
  };

  const getOutcomeBadge = (outc) => {
    switch (outc) {
      case 'SUCCESS':
        return { bg: 'rgba(34, 197, 94, 0.15)', color: '#16a34a', icon: <CheckCircle size={12} /> };
      case 'FAILURE':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', icon: <XCircle size={12} /> };
      case 'DENIED':
      default:
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#d97706', icon: <AlertTriangle size={12} /> };
    }
  };

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'AUTH':
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#2563eb' };
      case 'SECURITY':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' };
      case 'ADMIN':
        return { bg: 'rgba(168, 85, 247, 0.15)', color: '#9333ea' };
      case 'FEEDBACK':
        return { bg: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04' };
      case 'CONTENT':
      default:
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#059669' };
    }
  };

  return (
    <div>
      {/* Header Info */}
      <div style={{
        padding: '1.25rem',
        borderRadius: '16px',
        border: '1px solid var(--border-color, #e5e7eb)',
        backgroundColor: 'var(--bg-secondary, #f9fafb)',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: 'rgba(0, 113, 227, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary-color, #0071E3)'
          }}>
            <Shield size={22} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Security Audit & Activity Intelligence Trail</h4>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
              Immutable system logging with automatic 90-day retention and sensitive data redaction
            </p>
          </div>
        </div>

        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
          Total Logged Events: <span style={{ color: 'var(--primary-color, #0071E3)' }}>{pagination.total}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1.25rem',
        alignItems: 'center'
      }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: '1 1 240px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary, #6b7280)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search event ID, actor email, or summary..."
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2rem',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #d1d5db)',
                fontSize: '0.85rem',
                backgroundColor: 'var(--bg-primary, #ffffff)'
              }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '10px' }}>
            Filter
          </button>
        </form>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #d1d5db)',
            fontSize: '0.85rem',
            backgroundColor: 'var(--bg-primary, #ffffff)'
          }}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>Category: {c}</option>)}
        </select>

        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #d1d5db)',
            fontSize: '0.85rem',
            backgroundColor: 'var(--bg-primary, #ffffff)'
          }}
        >
          {OUTCOMES.map(o => <option key={o} value={o}>Outcome: {o}</option>)}
        </select>

        <button
          onClick={() => fetchLogs(pagination.page)}
          className="btn btn-secondary"
          style={{ padding: '0.5rem 0.75rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Audit Logs Table */}
      <div style={{
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '16px',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary, #ffffff)'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary, #6b7280)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '0.85rem' }}>Loading audit events...</p>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary, #6b7280)' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>No audit logs found for these filters</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, width: '40px' }}></th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Event ID</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Event Type</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Outcome</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Actor</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Summary</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const outBadge = getOutcomeBadge(log.outcome);
                  const catBadge = getCategoryBadge(log.category);
                  const isExpanded = expandedLogId === log.eventId;

                  return (
                    <React.Fragment key={log.eventId}>
                      <tr
                        onClick={() => toggleExpand(log.eventId)}
                        style={{
                          borderBottom: isExpanded ? 'none' : '1px solid var(--border-color, #e5e7eb)',
                          cursor: 'pointer',
                          backgroundColor: isExpanded ? 'rgba(0, 113, 227, 0.03)' : 'transparent',
                          transition: 'background-color 0.15s'
                        }}
                      >
                        <td style={{ padding: '0.75rem 0.5rem 0.75rem 1rem', textAlign: 'center' }}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {log.eventId}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            backgroundColor: catBadge.bg,
                            color: catBadge.color
                          }}>
                            {log.category}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {log.eventType}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            backgroundColor: outBadge.bg,
                            color: outBadge.color,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {outBadge.icon}
                            {log.outcome}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                          <div>{log.actorEmail}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #6b7280)' }}>{log.actorRole}</div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.summary}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary, #6b7280)' }}>
                          {log.ipAddress}
                        </td>
                      </tr>

                      {/* Expanded Metadata Inspector */}
                      {isExpanded && (
                        <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', backgroundColor: 'rgba(0, 113, 227, 0.03)' }}>
                          <td colSpan={9} style={{ padding: '0.5rem 1.5rem 1rem' }}>
                            <div style={{
                              padding: '0.75rem',
                              borderRadius: '8px',
                              backgroundColor: 'var(--bg-secondary, #f9fafb)',
                              border: '1px solid var(--border-color, #e5e7eb)',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace'
                            }}>
                              <div style={{ marginBottom: '0.25rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)' }}>
                                SANITIZED EVENT METADATA:
                              </div>
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {JSON.stringify({
                                  userAgent: log.userAgent,
                                  targetType: log.targetType,
                                  targetId: log.targetId,
                                  metadata: log.metadata
                                }, null, 2)}
                              </pre>
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
        )}

        {/* Pagination controls */}
        {pagination.totalPages > 1 && (
          <div style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem'
          }}>
            <span style={{ color: 'var(--text-secondary, #6b7280)' }}>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total events)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchLogs(pagination.page - 1)}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchLogs(pagination.page + 1)}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
