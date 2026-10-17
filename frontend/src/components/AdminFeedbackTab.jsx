import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Bug, CheckCircle, Clock, AlertTriangle, AlertCircle, 
  Search, Filter, ChevronRight, X, ExternalLink, User, Shield, Send, RefreshCw
} from 'lucide-react';
import { getAdminFeedback, updateAdminFeedback, getFeedbackAttachmentUrl } from '../utils/db';

const CATEGORIES = [
  'All',
  'Bug / Error',
  'UI / Usability',
  'Placement Story Issue',
  'Resource / Material Issue',
  'Authentication / Login Issue',
  'Performance / Slowness',
  'Mobile / Responsiveness',
  'Feature Request',
  'Account / Profile Issue',
  'Other'
];

const STATUSES = ['All', 'New', 'Acknowledged', 'In Progress', 'Waiting for Information', 'Resolved', 'Closed', 'Rejected'];
const SEVERITIES = ['All', 'Minor', 'Moderate', 'Major', 'Critical'];
const PRIORITIES = ['All', 'Low', 'Medium', 'High', 'Urgent'];

export default function AdminFeedbackTab() {
  const [items, setItems] = useState([]);
  const [metrics, setMetrics] = useState({ totalAll: 0, statusCounts: {}, criticalOpen: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected item modal / drawer
  const [selectedItem, setSelectedItem] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [adminResponse, setAdminResponse] = useState('');
  const [newNote, setNewNote] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('');

  const fetchFeedback = async (page = 1) => {
    try {
      setLoading(true);
      const res = await getAdminFeedback({
        page,
        limit: 20,
        status: selectedStatus,
        category: selectedCategory,
        severity: selectedSeverity,
        search: searchQuery
      });
      setItems(res.items || []);
      setMetrics(res.metrics || {});
      setPagination(res.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load admin feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback(1);
  }, [selectedStatus, selectedCategory, selectedSeverity]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchFeedback(1);
  };

  const openItemDetails = (item) => {
    setSelectedItem(item);
    setNewStatus(item.status);
    setStatusReason('');
    setAdminResponse(item.adminResponse || '');
    setNewNote('');
    setAssignedTo(item.assignedTo || '');
    setPriority(item.priority || 'Medium');
  };

  const handleSaveItemUpdates = async () => {
    if (!selectedItem) return;
    try {
      setUpdating(true);
      const updates = {
        status: newStatus,
        reason: statusReason,
        adminResponse,
        assignedTo,
        priority
      };
      if (newNote.trim()) {
        updates.note = newNote.trim();
      }

      const res = await updateAdminFeedback(selectedItem._id, updates);
      setSelectedItem(res.feedback);
      setNewNote('');
      fetchFeedback(pagination.page);
    } catch (err) {
      alert(err.message || 'Failed to update feedback record.');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Resolved':
      case 'Closed':
        return { bg: 'rgba(34, 197, 94, 0.15)', color: '#16a34a' };
      case 'In Progress':
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#2563eb' };
      case 'Acknowledged':
        return { bg: 'rgba(168, 85, 247, 0.15)', color: '#9333ea' };
      case 'Waiting for Information':
        return { bg: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04' };
      case 'Rejected':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
      case 'New':
      default:
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#d97706' };
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'Critical':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
      case 'Major':
        return { bg: 'rgba(249, 115, 22, 0.15)', color: '#ea580c' };
      case 'Moderate':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#d97706' };
      case 'Minor':
      default:
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#2563eb' };
    }
  };

  return (
    <div>
      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          padding: '1.25rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-secondary, #f9fafb)'
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)', fontWeight: 500 }}>
            TOTAL SUBMISSIONS
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px' }}>
            {metrics.totalAll || 0}
          </div>
        </div>

        <div style={{
          padding: '1.25rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-secondary, #f9fafb)'
        }}>
          <div style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 500 }}>
            NEW & UNREVIEWED
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px', color: '#d97706' }}>
            {metrics.statusCounts?.New || 0}
          </div>
        </div>

        <div style={{
          padding: '1.25rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-secondary, #f9fafb)'
        }}>
          <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 500 }}>
            IN PROGRESS
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px', color: '#2563eb' }}>
            {metrics.statusCounts?.['In Progress'] || 0}
          </div>
        </div>

        <div style={{
          padding: '1.25rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-secondary, #f9fafb)'
        }}>
          <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 500 }}>
            CRITICAL OPEN ISSUES
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px', color: '#ef4444' }}>
            {metrics.criticalOpen || 0}
          </div>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference ID, title, or reporter email..."
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
            Search
          </button>
        </form>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #d1d5db)',
            fontSize: '0.85rem',
            backgroundColor: 'var(--bg-primary, #ffffff)'
          }}
        >
          {STATUSES.map(s => <option key={s} value={s}>Status: {s}</option>)}
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
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
          value={selectedSeverity}
          onChange={(e) => setSelectedSeverity(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #d1d5db)',
            fontSize: '0.85rem',
            backgroundColor: 'var(--bg-primary, #ffffff)'
          }}
        >
          {SEVERITIES.map(s => <option key={s} value={s}>Severity: {s}</option>)}
        </select>

        <button
          onClick={() => fetchFeedback(pagination.page)}
          className="btn btn-secondary"
          style={{ padding: '0.5rem 0.75rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Feedback Items Table */}
      <div style={{
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '16px',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary, #ffffff)'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary, #6b7280)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '0.85rem' }}>Loading feedback reports...</p>
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary, #6b7280)' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>No feedback reports match your filters</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Ref ID</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Title</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Severity</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Reporter</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Submitted</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const statBadge = getStatusBadge(item.status);
                  const sevBadge = getSeverityBadge(item.severity);
                  return (
                    <tr
                      key={item._id}
                      style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', transition: 'background-color 0.15s' }}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>
                        {item.referenceId}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)' }}>
                          {item.category}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: sevBadge.bg,
                          color: sevBadge.color
                        }}>
                          {item.severity}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: statBadge.bg,
                          color: statBadge.color
                        }}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
                        {item.reporterEmail}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button
                          onClick={() => openItemDetails(item)}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px' }}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
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
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} reports)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchFeedback(pagination.page - 1)}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchFeedback(pagination.page + 1)}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Drawer / Modal */}
      {selectedItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary, #ffffff)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '720px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-color, #e5e7eb)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color, #e5e7eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-color, #0071E3)' }}>
                    {selectedItem.referenceId}
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', backgroundColor: 'var(--bg-secondary, #f9fafb)', border: '1px solid var(--border-color, #e5e7eb)' }}>
                    {selectedItem.category}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '4px 0 0' }}>{selectedItem.title}</h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Reporter and Diagnostics Meta */}
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-secondary, #f9fafb)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary, #6b7280)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.5rem'
              }}>
                <div><strong>Reporter:</strong> {selectedItem.reporterEmail}</div>
                <div><strong>Route:</strong> {selectedItem.route || '/'}</div>
                <div><strong>Browser / OS:</strong> {selectedItem.deviceDiagnostics?.browser} on {selectedItem.deviceDiagnostics?.os}</div>
                <div><strong>Viewport:</strong> {selectedItem.deviceDiagnostics?.viewport}</div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Report Description
                </label>
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-secondary, #f9fafb)',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  fontSize: '0.85rem',
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedItem.description}
                </div>
              </div>

              {/* Reproduction steps if available */}
              {(selectedItem.stepsToReproduce || selectedItem.expectedBehavior || selectedItem.actualBehavior) && (
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-secondary, #f9fafb)',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.85rem'
                }}>
                  {selectedItem.stepsToReproduce && <div><strong>Steps:</strong> {selectedItem.stepsToReproduce}</div>}
                  {selectedItem.expectedBehavior && <div><strong>Expected:</strong> {selectedItem.expectedBehavior}</div>}
                  {selectedItem.actualBehavior && <div><strong>Actual:</strong> {selectedItem.actualBehavior}</div>}
                </div>
              )}

              {/* Screenshot preview */}
              {selectedItem.screenshotFileId && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Attachment Screenshot
                  </label>
                  <div style={{
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    maxHeight: '220px',
                    backgroundColor: '#000000',
                    textAlign: 'center'
                  }}>
                    <img
                      src={getFeedbackAttachmentUrl(selectedItem.screenshotFileId)}
                      alt="Feedback Attachment"
                      style={{ maxHeight: '220px', width: 'auto', margin: '0 auto', display: 'block' }}
                    />
                  </div>
                </div>
              )}

              {/* Admin Actions: Status, Priority, Assignee */}
              <div style={{
                borderTop: '1px solid var(--border-color, #e5e7eb)',
                paddingTop: '1rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '0.75rem'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #d1d5db)',
                      fontSize: '0.85rem',
                      backgroundColor: 'var(--bg-primary, #ffffff)'
                    }}
                  >
                    {STATUSES.filter(s => s !== 'All').map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #d1d5db)',
                      fontSize: '0.85rem',
                      backgroundColor: 'var(--bg-primary, #ffffff)'
                    }}
                  >
                    {PRIORITIES.filter(p => p !== 'All').map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Assigned To
                  </label>
                  <input
                    type="text"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    placeholder="Admin name / email"
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #d1d5db)',
                      fontSize: '0.85rem',
                      backgroundColor: 'var(--bg-primary, #ffffff)'
                    }}
                  />
                </div>
              </div>

              {/* Status change reason */}
              {newStatus !== selectedItem.status && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Reason for Status Transition (Saved to Audit Log)
                  </label>
                  <input
                    type="text"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="e.g., Confirmed bug in staging, hotfix released..."
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #d1d5db)',
                      fontSize: '0.85rem',
                      backgroundColor: 'var(--bg-primary, #ffffff)'
                    }}
                  />
                </div>
              )}

              {/* Official Response to Student */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Official Response (Visible to Student Reporter)
                </label>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Provide an informative reply that the student can view in their feedback history..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #d1d5db)',
                    fontSize: '0.85rem',
                    backgroundColor: 'var(--bg-primary, #ffffff)'
                  }}
                />
              </div>

              {/* Internal Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Internal Admin Notes
                </label>
                {selectedItem.adminNotes && selectedItem.adminNotes.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {selectedItem.adminNotes.map((n, i) => (
                      <div key={i} style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', backgroundColor: 'var(--bg-secondary, #f9fafb)', fontSize: '0.8rem' }}>
                        <div>{n.note}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #6b7280)', marginTop: '2px' }}>
                          By {n.authorEmail} on {new Date(n.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add private note for engineering team..."
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #d1d5db)',
                    fontSize: '0.85rem',
                    backgroundColor: 'var(--bg-primary, #ffffff)'
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-color, #e5e7eb)',
              backgroundColor: 'var(--bg-secondary, #f9fafb)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}>
              <button
                onClick={() => setSelectedItem(null)}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItemUpdates}
                disabled={updating}
                className="btn btn-primary"
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem', borderRadius: '8px' }}
              >
                {updating ? 'Saving Changes...' : 'Save Updates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
