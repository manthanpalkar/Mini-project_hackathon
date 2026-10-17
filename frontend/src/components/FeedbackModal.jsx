import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  MessageSquare, Bug, X, UploadCloud, AlertCircle, CheckCircle, 
  Clock, Image, FileText, ChevronRight, Copy, Check, Sparkles, RefreshCw, Smartphone, Laptop
} from 'lucide-react';
import { submitFeedback, getMyFeedback, getFeedbackAttachmentUrl } from '../utils/db';

const CATEGORIES = [
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

const SEVERITIES = [
  { value: 'Minor', label: 'Minor (Visual/Cosmetic)', color: '#3b82f6' },
  { value: 'Moderate', label: 'Moderate (Non-blocking bug)', color: '#f59e0b' },
  { value: 'Major', label: 'Major (Broken feature)', color: '#f97316' },
  { value: 'Critical', label: 'Critical (Cannot proceed / crash)', color: '#ef4444' }
];

export default function FeedbackModal({ isOpen, onClose, initialCategory = 'Bug / Error' }) {
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [severity, setSeverity] = useState('Moderate');
  const [description, setDescription] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null); // { referenceId, message }
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedRef, setCopiedRef] = useState(false);

  // History state
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setSubmitSuccess(null);
      setCopiedRef(false);
      if (activeTab === 'history') {
        loadHistory();
      }
    }
  }, [isOpen, activeTab]);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const items = await getMyFeedback();
      setHistory(items || []);
    } catch (err) {
      console.warn('Failed to load feedback history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.mimetype || file.type)) {
      setErrorMessage('Only PNG, JPEG, and WebP images are allowed for screenshots.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Screenshot exceeds 5MB size limit.');
      return;
    }

    setErrorMessage('');
    setScreenshot(file);
    const reader = new FileReader();
    reader.onload = (event) => setScreenshotPreview(event.target.result);
    reader.readAsDataURL(file);
  };

  const clearScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getDiagnostics = () => {
    const ua = navigator.userAgent || '';
    let os = 'Unknown OS';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/linux/i.test(ua)) os = 'Linux';

    let browser = 'Unknown Browser';
    if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';

    return {
      browser,
      os,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      appVersion: '2.2.0',
      correlationId: `CLI-${Date.now()}`
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Please provide a title for your report.');
      return;
    }
    if (!description.trim()) {
      setErrorMessage('Please provide a detailed description.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('category', category);
      formData.append('severity', severity);
      formData.append('description', description.trim());
      formData.append('expectedBehavior', expectedBehavior.trim());
      formData.append('actualBehavior', actualBehavior.trim());
      formData.append('stepsToReproduce', stepsToReproduce.trim());
      formData.append('route', window.location.pathname);
      formData.append('deviceDiagnostics', JSON.stringify(getDiagnostics()));

      if (screenshot) {
        formData.append('screenshot', screenshot);
      }

      const res = await submitFeedback(formData);
      setSubmitSuccess({
        referenceId: res.referenceId,
        message: res.message || 'Feedback submitted successfully!'
      });

      // Clear form
      setTitle('');
      setDescription('');
      setExpectedBehavior('');
      setActualBehavior('');
      setStepsToReproduce('');
      clearScreenshot();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyRefToClipboard = (refId) => {
    navigator.clipboard.writeText(refId);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const isBugCategory = ['Bug / Error', 'Authentication / Login Issue', 'Performance / Slowness', 'Mobile / Responsiveness'].includes(category);

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
        maxWidth: '640px',
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
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: 'rgba(0, 113, 227, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-color, #0071E3)'
            }}>
              <MessageSquare size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>Feedback & Bug Reporting</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)', margin: '2px 0 0' }}>
                Help us improve the SPIT placement platform experience
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

        {/* Tab selection */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: 'var(--bg-secondary, #f9fafb)',
          padding: '0 1.5rem'
        }}>
          <button
            onClick={() => setActiveTab('new')}
            style={{
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              fontWeight: activeTab === 'new' ? 600 : 500,
              color: activeTab === 'new' ? 'var(--primary-color, #0071E3)' : 'var(--text-secondary, #6b7280)',
              borderBottom: activeTab === 'new' ? '2px solid var(--primary-color, #0071E3)' : '2px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer'
            }}
          >
            Submit Feedback
          </button>
          <button
            onClick={() => { setActiveTab('history'); loadHistory(); }}
            style={{
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              fontWeight: activeTab === 'history' ? 600 : 500,
              color: activeTab === 'history' ? 'var(--primary-color, #0071E3)' : 'var(--text-secondary, #6b7280)',
              borderBottom: activeTab === 'history' ? '2px solid var(--primary-color, #0071E3)' : '2px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer'
            }}
          >
            My Reports ({history.length})
          </button>
        </div>

        {/* Body content */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'new' ? (
            submitSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}>
                  <CheckCircle size={32} />
                </div>
                <h4 style={{ fontSize: '1.2rem', fontWeight: 600, margin: '0 0 0.5rem' }}>Thank You for Your Feedback!</h4>
                <p style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  {submitSuccess.message}
                </p>

                <div style={{
                  backgroundColor: 'var(--bg-secondary, #f9fafb)',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  borderRadius: '12px',
                  padding: '1rem',
                  maxWidth: '360px',
                  margin: '0 auto 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)' }}>Reference Tracking ID:</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '0.5px' }}>{submitSuccess.referenceId}</div>
                  </div>
                  <button
                    onClick={() => copyRefToClipboard(submitSuccess.referenceId)}
                    style={{
                      padding: '0.4rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #d1d5db)',
                      background: 'var(--bg-primary, #ffffff)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.8rem'
                    }}
                  >
                    {copiedRef ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    {copiedRef ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button
                    onClick={() => { setSubmitSuccess(null); setActiveTab('new'); }}
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '10px' }}
                  >
                    Submit Another Report
                  </button>
                  <button
                    onClick={onClose}
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', borderRadius: '10px' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {errorMessage && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <AlertCircle size={16} />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Category & Severity Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Category *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color, #d1d5db)',
                        backgroundColor: 'var(--bg-primary, #ffffff)',
                        color: 'inherit',
                        fontSize: '0.85rem'
                      }}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Severity Impact *
                    </label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color, #d1d5db)',
                        backgroundColor: 'var(--bg-primary, #ffffff)',
                        color: 'inherit',
                        fontSize: '0.85rem'
                      }}
                    >
                      {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Title / Summary *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Brief description of the feedback or issue..."
                    maxLength={150}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color, #d1d5db)',
                      backgroundColor: 'var(--bg-primary, #ffffff)',
                      color: 'inherit',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Details & Observations *
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Please explain what you experienced, what was expected, or what feature you'd like to see..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color, #d1d5db)',
                      backgroundColor: 'var(--bg-primary, #ffffff)',
                      color: 'inherit',
                      fontSize: '0.85rem',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Bug Specific Context Fields */}
                {isBugCategory && (
                  <div style={{
                    backgroundColor: 'var(--bg-secondary, #f9fafb)',
                    borderRadius: '12px',
                    padding: '1rem',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)' }}>
                      BUG REPRODUCTION CONTEXT (OPTIONAL)
                    </span>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                        Steps to Reproduce
                      </label>
                      <input
                        type="text"
                        value={stepsToReproduce}
                        onChange={(e) => setStepsToReproduce(e.target.value)}
                        placeholder="e.g., 1. Go to Resources 2. Click PDF preview..."
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color, #d1d5db)',
                          fontSize: '0.8rem',
                          backgroundColor: 'var(--bg-primary, #ffffff)'
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                          Expected Behavior
                        </label>
                        <input
                          type="text"
                          value={expectedBehavior}
                          onChange={(e) => setExpectedBehavior(e.target.value)}
                          placeholder="What should have happened?"
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #d1d5db)',
                            fontSize: '0.8rem',
                            backgroundColor: 'var(--bg-primary, #ffffff)'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                          Actual Behavior
                        </label>
                        <input
                          type="text"
                          value={actualBehavior}
                          onChange={(e) => setActualBehavior(e.target.value)}
                          placeholder="What actually occurred?"
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #d1d5db)',
                            fontSize: '0.8rem',
                            backgroundColor: 'var(--bg-primary, #ffffff)'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Screenshot Upload */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Screenshot / Attachment (Max 5MB)
                  </label>
                  {screenshotPreview ? (
                    <div style={{
                      position: 'relative',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: '1px solid var(--border-color, #e5e7eb)',
                      maxHeight: '180px',
                      backgroundColor: '#000000'
                    }}>
                      <img
                        src={screenshotPreview}
                        alt="Screenshot Preview"
                        style={{ width: '100%', maxHeight: '180px', objectFit: 'contain' }}
                      />
                      <button
                        type="button"
                        onClick={clearScreenshot}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          backgroundColor: 'rgba(0, 0, 0, 0.7)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '50%',
                          padding: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      style={{
                        border: '2px dashed var(--border-color, #d1d5db)',
                        borderRadius: '12px',
                        padding: '1.25rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: 'var(--bg-secondary, #f9fafb)',
                        transition: 'border-color 0.2s'
                      }}
                    >
                      <UploadCloud size={24} style={{ margin: '0 auto 0.5rem', color: 'var(--text-secondary, #6b7280)' }} />
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                        Click to attach screenshot (PNG, JPEG, WebP)
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)', marginTop: '2px' }}>
                        Helps developers identify and reproduce the issue rapidly
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Diagnostics Preview Pill */}
                <div style={{
                  padding: '0.6rem 0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary, #f9fafb)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary, #6b7280)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Laptop size={14} />
                  <span>
                    Privacy note: Browser info and screen size ({window.innerWidth}x{window.innerHeight}) will be sent to help debug layout issues.
                  </span>
                </div>

                {/* Submit button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '10px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', borderRadius: '10px' }}
                  >
                    {submitting ? 'Submitting Report...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )
          ) : (
            <div>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary, #6b7280)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                  <p style={{ fontSize: '0.85rem' }}>Loading your feedback history...</p>
                </div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary, #6b7280)' }}>
                  <MessageSquare size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                  <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>No feedback reports submitted yet</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Reports you submit will appear here with live admin resolution updates.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {history.map((item) => (
                    <div
                      key={item._id}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color, #e5e7eb)',
                        backgroundColor: 'var(--bg-secondary, #f9fafb)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.title}</span>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: item.status === 'Resolved' ? 'rgba(34, 197, 94, 0.15)' :
                                               item.status === 'In Progress' ? 'rgba(59, 130, 246, 0.15)' :
                                               'rgba(245, 158, 11, 0.15)',
                              color: item.status === 'Resolved' ? '#16a34a' :
                                     item.status === 'In Progress' ? '#2563eb' :
                                     '#d97706'
                            }}>
                              {item.status}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)', marginTop: '2px' }}>
                            Ref: {item.referenceId} • {item.category} • {new Date(item.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary, #111827)', margin: '0.5rem 0' }}>
                        {item.description}
                      </p>

                      {/* Admin Response Note if resolved or answered */}
                      {item.adminResponse && (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(0, 113, 227, 0.05)',
                          border: '1px solid rgba(0, 113, 227, 0.15)'
                        }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-color, #0071E3)', marginBottom: '2px' }}>
                            ADMIN RESPONSE:
                          </div>
                          <div style={{ fontSize: '0.8rem' }}>
                            {item.adminResponse}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
