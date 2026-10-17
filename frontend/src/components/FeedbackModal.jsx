import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  MessageSquare, X, Image as ImageIcon, CheckCircle, 
  AlertCircle, Copy, Check, ChevronDown, Trash2, Loader2
} from 'lucide-react';
import { submitFeedback } from '../utils/db';

const CATEGORIES = [
  { id: 'Bug / Technical Issue', label: 'Bug / Technical Issue', short: 'Bug', color: '#ef4444' },
  { id: 'Feature Request', label: 'Feature Request', short: 'Feature', color: '#8b5cf6' },
  { id: 'Improvement Suggestion', label: 'Improvement Suggestion', short: 'Suggestion', color: '#3b82f6' },
  { id: 'UI / Design Feedback', label: 'UI / Design Feedback', short: 'UI / Design', color: '#06b6d4' },
  { id: 'Performance Issue', label: 'Performance Issue', short: 'Performance', color: '#f59e0b' },
  { id: 'Login / Account Issue', label: 'Login / Account Issue', short: 'Account', color: '#ec4899' },
  { id: 'Resource / Upload Issue', label: 'Resource / Upload Issue', short: 'Resource', color: '#10b981' },
  { id: 'Security / Privacy Concern', label: 'Security / Privacy Concern', short: 'Security', color: '#dc2626' },
  { id: 'Positive Feedback', label: 'Positive Feedback', short: 'Praise', color: '#16a34a' },
  { id: 'Other', label: 'Other', short: 'Other', color: '#6b7280' }
];

export default function FeedbackModal({ isOpen, onClose, initialCategory = 'Bug / Technical Issue' }) {
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(() => {
    return CATEGORIES.find(c => c.id === initialCategory) || CATEGORIES[0];
  });
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null); // { referenceId, message }
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedRef, setCopiedRef] = useState(false);

  const fileInputRef = useRef(null);
  const selectorButtonRef = useRef(null);
  const popoverRef = useRef(null);
  const textareaRef = useRef(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setSubmitSuccess(null);
      setCopiedRef(false);
      setPopoverOpen(false);
      // Auto-focus textarea on open after short delay
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  // Handle click outside popover & escape key
  useEffect(() => {
    if (!popoverOpen) return;

    const handleClickOutside = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        selectorButtonRef.current && !selectorButtonRef.current.contains(e.target)
      ) {
        setPopoverOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPopoverOpen(false);
        selectorButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [popoverOpen]);

  // Handle escape key to close modal (when popover is closed)
  useEffect(() => {
    if (!isOpen) return;

    const handleModalEsc = (e) => {
      if (e.key === 'Escape' && !popoverOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleModalEsc);
    return () => document.removeEventListener('keydown', handleModalEsc);
  }, [isOpen, popoverOpen, onClose]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const mime = file.type || '';
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mime.toLowerCase())) {
      setErrorMessage('Only PNG, JPEG, and WebP image formats are supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image exceeds the 5MB size limit.');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanDesc = description.trim();
    if (!cleanDesc) {
      setErrorMessage('Please describe your feedback or issue before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');

      const formData = new FormData();
      formData.append('description', cleanDesc);
      formData.append('category', selectedCategory.id);
      formData.append('route', window.location.pathname);
      formData.append('deviceDiagnostics', JSON.stringify({
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        appVersion: '2.2.0'
      }));

      if (screenshot) {
        formData.append('screenshot', screenshot);
      }

      const res = await submitFeedback(formData);
      setSubmitSuccess({
        referenceId: res.referenceId,
        message: res.message || 'Thank you! Your feedback has been submitted successfully.'
      });

      // Clear draft on successful submission
      setDescription('');
      clearScreenshot();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyRefToClipboard = (refId) => {
    if (!refId) return;
    navigator.clipboard.writeText(refId);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  return createPortal(
    <div 
      style={{
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
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        style={{
          backgroundColor: 'var(--bg-primary, #ffffff)',
          color: 'var(--text-primary, #111827)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '520px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          border: '1px solid var(--border-color, #e5e7eb)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title, Category Selector, and Close */}
        <div style={{
          padding: '1.15rem 1.35rem',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          {/* Title Area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              backgroundColor: 'rgba(0, 113, 227, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-color, #0071E3)',
              flexShrink: 0
            }}>
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, lineHeight: 1.25 }}>
                Feedback & Bug Reporting
              </h3>
            </div>
          </div>

          {/* Top-Right Controls: Category Selector Pill + Close Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
            {/* Category Selector Pill */}
            {!submitSuccess && (
              <div style={{ position: 'relative' }}>
                <button
                  ref={selectorButtonRef}
                  type="button"
                  onClick={() => setPopoverOpen(prev => !prev)}
                  aria-expanded={popoverOpen}
                  aria-haspopup="menu"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 11px',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    backgroundColor: popoverOpen ? 'var(--bg-primary, #ffffff)' : 'var(--bg-secondary, #f3f4f6)',
                    color: 'var(--text-primary, #111827)',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: popoverOpen ? '0 0 0 2px rgba(0, 113, 227, 0.2)' : 'none'
                  }}
                  title="Select Feedback Category"
                >
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: selectedCategory.color,
                    flexShrink: 0
                  }} />
                  <span>{selectedCategory.short}</span>
                  <ChevronDown 
                    size={12} 
                    style={{ 
                      color: 'var(--text-secondary, #6b7280)',
                      transform: popoverOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.18s ease'
                    }} 
                  />
                </button>

                {/* Popover Dropdown */}
                {popoverOpen && (
                  <div
                    ref={popoverRef}
                    role="menu"
                    aria-label="Feedback categories"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      zIndex: 1000,
                      backgroundColor: 'var(--bg-primary, #ffffff)',
                      border: '1px solid var(--border-color, #e5e7eb)',
                      borderRadius: '14px',
                      boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.2), 0 4px 8px -2px rgba(0, 0, 0, 0.08)',
                      minWidth: '220px',
                      padding: '5px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      animation: 'fadeIn 0.12s ease-out'
                    }}
                  >
                    <div style={{
                      padding: '4px 8px 6px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--text-secondary, #6b7280)'
                    }}>
                      Select Category
                    </div>
                    {CATEGORIES.map(cat => {
                      const isSelected = cat.id === selectedCategory.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setSelectedCategory(cat);
                            setPopoverOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            border: 'none',
                            background: isSelected ? 'rgba(0, 113, 227, 0.08)' : 'transparent',
                            color: isSelected ? 'var(--primary-color, #0071E3)' : 'var(--text-primary, #111827)',
                            fontSize: '0.8rem',
                            fontWeight: isSelected ? 600 : 400,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background-color 0.12s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-secondary, #f3f4f6)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: cat.color,
                              flexShrink: 0
                            }} />
                            <span>{cat.label}</span>
                          </div>
                          {isSelected && <Check size={14} style={{ color: 'var(--primary-color, #0071E3)' }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Modal Close Button */}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary, #6b7280)',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s ease'
              }}
              title="Close modal (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.35rem' }}>
          {submitSuccess ? (
            /* Success State */
            <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <CheckCircle size={30} />
              </div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
                Thank You!
              </h4>
              <p style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '0.88rem', margin: '0 0 1.25rem' }}>
                {submitSuccess.message}
              </p>

              {/* Reference ID Pill */}
              <div style={{
                backgroundColor: 'var(--bg-secondary, #f9fafb)',
                border: '1px solid var(--border-color, #e5e7eb)',
                borderRadius: '12px',
                padding: '0.85rem 1rem',
                maxWidth: '320px',
                margin: '0 auto 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Reference ID:
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.5px' }}>
                    {submitSuccess.referenceId}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyRefToClipboard(submitSuccess.referenceId)}
                  style={{
                    padding: '0.4rem 0.65rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #d1d5db)',
                    background: 'var(--bg-primary, #ffffff)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.75rem',
                    color: copiedRef ? '#16a34a' : 'inherit'
                  }}
                  title="Copy reference ID"
                >
                  {copiedRef ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedRef ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="btn btn-primary"
                style={{
                  padding: '0.55rem 2rem',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  fontWeight: 500
                }}
              >
                Done
              </button>
            </div>
          ) : (
            /* Main Form */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Error Banner */}
              {errorMessage && (
                <div style={{
                  padding: '0.7rem 0.9rem',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#dc2626',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. Main Multiline Text Area */}
              <div>
                <textarea
                  ref={textareaRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your feedback, bug, suggestion, or experience..."
                  rows={5}
                  required
                  style={{
                    width: '100%',
                    minHeight: '130px',
                    maxHeight: '260px',
                    padding: '0.85rem',
                    fontSize: '0.88rem',
                    lineHeight: '1.45',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color, #d1d5db)',
                    backgroundColor: 'var(--bg-primary, #ffffff)',
                    color: 'var(--text-primary, #111827)',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--primary-color, #0071E3)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(0, 113, 227, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-color, #d1d5db)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* 2. Upload Image (Optional) */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />

                {!screenshot ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.5rem 0.85rem',
                      borderRadius: '10px',
                      border: '1px dashed var(--border-color, #d1d5db)',
                      backgroundColor: 'var(--bg-secondary, #f9fafb)',
                      color: 'var(--text-secondary, #4b5563)',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary-color, #0071E3)';
                      e.currentTarget.style.color = 'var(--primary-color, #0071E3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color, #d1d5db)';
                      e.currentTarget.style.color = 'var(--text-secondary, #4b5563)';
                    }}
                  >
                    <ImageIcon size={15} />
                    <span>+ Upload Image (Optional)</span>
                  </button>
                ) : (
                  /* Image Preview Thumbnail with Remove button */
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    backgroundColor: 'var(--bg-secondary, #f9fafb)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
                      {screenshotPreview ? (
                        <img 
                          src={screenshotPreview} 
                          alt="Attachment preview" 
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '6px',
                            objectFit: 'cover',
                            border: '1px solid var(--border-color, #d1d5db)'
                          }} 
                        />
                      ) : (
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(0, 113, 227, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--primary-color, #0071E3)'
                        }}>
                          <ImageIcon size={18} />
                        </div>
                      )}
                      <div style={{ overflow: 'hidden', textAlign: 'left' }}>
                        <div style={{
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '260px'
                        }}>
                          {screenshot.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #6b7280)' }}>
                          {(screenshot.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={clearScreenshot}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#ef4444',
                        padding: '6px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Remove image"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Form Action Buttons: Cancel and Submit */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.65rem',
                marginTop: '0.35rem',
                paddingTop: '0.85rem',
                borderTop: '1px solid var(--border-color, #f3f4f6)'
              }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, #d1d5db)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary, #4b5563)',
                    fontSize: '0.84rem',
                    fontWeight: 500,
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !description.trim()}
                  className="btn btn-primary"
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '10px',
                    fontSize: '0.84rem',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    opacity: (!description.trim() || submitting) ? 0.6 : 1,
                    cursor: (!description.trim() || submitting) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Feedback</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
