import React from 'react';
import { UploadCloud, CheckCircle, AlertCircle, X, Minimize2, Maximize2, Loader2, RotateCcw } from 'lucide-react';
import { useUpload } from '../context/UploadContext';

export default function UploadDock() {
  const { uploads, activeCount, isDockMinimized, toggleDock, cancelUpload, dismissUpload, retryUpload } = useUpload();

  if (!uploads || uploads.length === 0) return null;

  const currentActive = uploads.find(u => u.status === 'uploading') || uploads[0];

  // Minimized floating pill
  if (isDockMinimized) {
    return (
      <div 
        onClick={toggleDock}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          backgroundColor: 'var(--bg-primary, #1c1c1e)',
          border: '1px solid var(--border-color, #38383a)',
          color: 'var(--text-primary, #ffffff)',
          borderRadius: '30px',
          padding: '0.6rem 1.2rem',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          cursor: 'pointer',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          transition: 'all 0.2s ease',
          userSelect: 'none'
        }}
        title="Click to expand upload details"
      >
        {activeCount > 0 ? (
          <>
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-primary, #0071e3)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Uploading ({currentActive.percent}%)
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #8e8e93)' }}>
              • {currentActive.speedFormatted}
            </span>
          </>
        ) : (
          <>
            <CheckCircle size={16} style={{ color: '#34c759' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Uploads Complete</span>
          </>
        )}
        <Maximize2 size={14} style={{ color: 'var(--text-secondary, #8e8e93)', marginLeft: '0.25rem' }} />
      </div>
    );
  }

  // Expanded floating drawer
  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '380px',
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 9999,
        backgroundColor: 'var(--bg-primary, #1c1c1e)',
        border: '1px solid var(--border-color, #38383a)',
        borderRadius: '20px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
        overflow: 'hidden',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.25s ease-out'
      }}
    >
      {/* Header */}
      <div 
        style={{
          padding: '0.9rem 1.2rem',
          borderBottom: '1px solid var(--border-color, #38383a)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary, rgba(255,255,255,0.04))'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UploadCloud size={18} style={{ color: activeCount > 0 ? 'var(--accent-primary, #0071e3)' : '#34c759' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {activeCount > 0 ? `Uploading in Background (${activeCount})` : 'Upload Complete'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            type="button"
            onClick={toggleDock}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.3rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Minimize"
          >
            <Minimize2 size={15} />
          </button>
        </div>
      </div>

      {/* Upload Items List */}
      <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {uploads.map((item) => {
          const isDone = item.status === 'completed';
          const isErr = item.status === 'error';
          const isCancel = item.status === 'cancelled';
          const isBusy = item.status === 'uploading';

          return (
            <div 
              key={item.id}
              style={{
                backgroundColor: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                borderRadius: '12px',
                padding: '0.85rem 1rem',
                border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}
            >
              {/* Item Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title || item.fileName}
                  </p>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {item.loadedFormatted} {item.totalFormatted ? `/ ${item.totalFormatted}` : ''}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {isBusy && (
                    <button
                      type="button"
                      onClick={() => cancelUpload(item.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '0.2rem',
                        borderRadius: '4px'
                      }}
                      title="Cancel Upload"
                    >
                      <X size={14} />
                    </button>
                  )}
                  {(isDone || isErr || isCancel) && (
                    <button
                      type="button"
                      onClick={() => dismissUpload(item.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '0.2rem',
                        borderRadius: '4px'
                      }}
                      title="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ height: '5px', backgroundColor: 'var(--border-color, rgba(255,255,255,0.1))', borderRadius: '3px', overflow: 'hidden' }}>
                <div 
                  style={{
                    height: '100%',
                    width: `${item.percent}%`,
                    backgroundColor: isDone ? '#34c759' : isErr ? '#ff453a' : 'var(--accent-primary, #0071e3)',
                    transition: 'width 0.2s ease'
                  }}
                />
              </div>

              {/* Stats Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                {isBusy && (
                  <>
                    <span style={{ fontWeight: 600, color: 'var(--accent-primary, #0071e3)' }}>
                      {item.percent}% • Speed: {item.speedFormatted}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      ETA: {item.etaFormatted || (item.remainingSecs ? `~${item.remainingSecs}s` : 'Calculating...')}
                    </span>
                  </>
                )}
                {isDone && (
                  <span style={{ color: '#34c759', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle size={12} /> {item.type === 'story' ? 'Submitted for moderation' : 'Ready in library'}
                  </span>
                )}
                {isErr && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#ff453a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <AlertCircle size={12} /> {item.error || 'Failed'}
                    </span>
                    <button
                      type="button"
                      onClick={() => retryUpload(item.id)}
                      style={{
                        background: 'rgba(255, 69, 58, 0.15)',
                        border: '1px solid rgba(255, 69, 58, 0.3)',
                        color: '#ff453a',
                        borderRadius: '6px',
                        padding: '0.15rem 0.45rem',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                      title="Retry Upload"
                    >
                      <RotateCcw size={10} /> Retry
                    </button>
                  </div>
                )}
                {isCancel && (
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Cancelled
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Footer Info */}
      <div style={{ padding: '0.6rem 1.2rem', borderTop: '1px solid var(--border-color, #38383a)', fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        You can navigate to any other tab while uploads finish.
      </div>
    </div>
  );
}
