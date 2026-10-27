import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PreviewNavigation({
  currentIndex = 0,
  totalFiles = 1,
  folderName = '',
  storyTitle = '',
  onPrev,
  onNext
}) {
  if (totalFiles <= 1) return null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < totalFiles - 1;
  const contextLabel = folderName ? `Folder: ${folderName}` : storyTitle ? `Story: ${storyTitle}` : '';

  return (
    <footer style={{
      height: '46px',
      backgroundColor: 'rgba(15, 15, 18, 0.92)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.25rem',
      flexShrink: 0,
      zIndex: 90,
      boxSizing: 'border-box'
    }}>
      {/* Context info */}
      <div style={{
        fontSize: '0.8rem',
        color: '#a1a1aa',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '300px'
      }}>
        {contextLabel}
      </div>

      {/* Center Sibling Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          style={{
            backgroundColor: hasPrev ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            color: hasPrev ? '#ffffff' : '#52525b',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '0.35rem 0.85rem',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.8rem',
            fontWeight: 500,
            cursor: hasPrev ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease'
          }}
          title="Previous File (Left Arrow)"
        >
          <ChevronLeft size={15} />
          <span>Previous File</span>
        </button>

        <span style={{
          fontSize: '0.82rem',
          color: '#e4e4e7',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          padding: '0 0.25rem'
        }}>
          {currentIndex + 1} of {totalFiles}
        </span>

        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          style={{
            backgroundColor: hasNext ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            color: hasNext ? '#ffffff' : '#52525b',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '0.35rem 0.85rem',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.8rem',
            fontWeight: 500,
            cursor: hasNext ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease'
          }}
          title="Next File (Right Arrow)"
        >
          <span>Next File</span>
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Right spacer for centering */}
      <div style={{ width: '120px', display: 'none' }} />
    </footer>
  );
}
