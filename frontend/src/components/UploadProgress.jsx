import { Loader2, AlertCircle, CheckCircle, X, RotateCcw } from 'lucide-react';

export default function UploadProgress({
  progress,
  status,
  fileName,
  error,
  onCancel,
  onRetry
}) {
  const isBusy = status === 'uploading' || status === 'initializing' || status === 'completing';
  const isDone = status === 'success';
  const isErr = status === 'error';
  const isCancel = status === 'cancelled';

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary, rgba(255, 255, 255, 0.04))',
      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
      borderRadius: '14px',
      padding: '1rem 1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.65rem'
    }}>
      {/* File info & Top Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            margin: 0,
            fontSize: '0.88rem',
            fontWeight: 600,
            color: 'var(--text-primary, #ffffff)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {fileName || 'Uploading Resource...'}
          </p>
          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary, #8e8e93)' }}>
            {progress?.loadedFormatted || '0 B'} {progress?.totalFormatted ? `/ ${progress.totalFormatted}` : ''}
          </p>
        </div>

        {isBusy && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'rgba(255, 69, 58, 0.12)',
              border: '1px solid rgba(255, 69, 58, 0.25)',
              color: '#ff453a',
              borderRadius: '8px',
              padding: '0.35rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              transition: 'all 0.15s ease'
            }}
            title="Cancel active upload"
          >
            <X size={13} /> Cancel Upload
          </button>
        )}

        {isErr && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              background: 'rgba(0, 113, 227, 0.15)',
              border: '1px solid rgba(0, 113, 227, 0.3)',
              color: 'var(--accent-primary, #0071e3)',
              borderRadius: '8px',
              padding: '0.35rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
          >
            <RotateCcw size={13} /> Retry Upload
          </button>
        )}
      </div>

      {/* Progress Track */}
      <div style={{
        height: '7px',
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${progress?.percent || 0}%`,
          backgroundColor: isDone ? '#34c759' : isErr ? '#ff453a' : 'var(--accent-primary, #0071e3)',
          transition: 'width 0.2s linear',
          borderRadius: '4px'
        }} />
      </div>

      {/* Stats Footer: Speed, ETA, Percentage */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.76rem'
      }}>
        {isBusy && (
          <>
            <span style={{ fontWeight: 600, color: 'var(--accent-primary, #0071e3)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Loader2 size={12} className="animate-spin" />
              {progress?.percent}% • Speed: {progress?.speedFormatted || 'Calculating...'}
            </span>
            <span style={{ color: 'var(--text-secondary, #8e8e93)' }}>
              ETA: {progress?.etaFormatted || 'Calculating...'}
            </span>
          </>
        )}

        {isDone && (
          <span style={{ color: '#34c759', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <CheckCircle size={14} /> Upload complete! Saved to Storage
          </span>
        )}

        {isErr && (
          <span style={{ color: '#ff453a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <AlertCircle size={14} /> {error || 'Upload failed. Check connection or file.'}
          </span>
        )}

        {isCancel && (
          <span style={{ color: 'var(--text-secondary, #8e8e93)', fontStyle: 'italic' }}>
            Upload cancelled.
          </span>
        )}
      </div>
    </div>
  );
}
