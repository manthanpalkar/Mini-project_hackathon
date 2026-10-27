import { 
  Download, X, Loader,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut
} from 'lucide-react';

export default function PreviewHeader({
  fileName = 'Document',
  fileSize = '',
  badge = { label: 'FILE', bg: 'rgba(255, 255, 255, 0.1)', text: '#ffffff' },
  contextInfo = '',
  // PDF page controls
  isPdf = false,
  pageNum = 1,
  numPages = 0,
  onPrevPage,
  onNextPage,
  // Zoom controls
  allowZoom = false,
  scale = 1.0,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  // Sibling file navigation
  currentIndex = -1,
  totalFiles = 0,
  onPrevFile,
  onNextFile,
  // Actions
  downloading = false,
  onDownload,
  onClose
}) {
  const hasSiblingNav = totalFiles > 1 && currentIndex >= 0;

  return (
    <header style={{
      height: '56px',
      backgroundColor: 'rgba(15, 15, 18, 0.95)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.25rem',
      gap: '0.75rem',
      flexShrink: 0,
      zIndex: 100,
      boxSizing: 'border-box'
    }}>
      {/* Left: Format Badge, Title, Size & Context */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        minWidth: 0,
        flex: '1 1 auto'
      }}>
        {/* Format Badge */}
        <span style={{
          backgroundColor: badge.bg,
          color: badge.text,
          fontSize: '0.72rem',
          fontWeight: 700,
          padding: '0.2rem 0.55rem',
          borderRadius: '5px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          flexShrink: 0,
          display: 'inline-block'
        }}>
          {badge.label}
        </span>

        {/* Title */}
        <h1 style={{
          margin: 0,
          fontSize: '0.92rem',
          fontWeight: 600,
          color: '#ffffff',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '380px'
        }} title={fileName}>
          {fileName}
        </h1>

        {/* Size */}
        {fileSize && (
          <span style={{
            fontSize: '0.78rem',
            color: '#71717a',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}>
            ({fileSize})
          </span>
        )}

        {/* Context info (e.g. Folder or Story) */}
        {contextInfo && (
          <span style={{
            fontSize: '0.78rem',
            color: '#a1a1aa',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            display: 'inline-block',
            marginLeft: '0.25rem',
            opacity: 0.85
          }} className="preview-header-context">
            • {contextInfo}
          </span>
        )}
      </div>

      {/* Center & Right Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        flexShrink: 0
      }}>
        {/* PDF Page Controls (if PDF loaded with pages) */}
        {isPdf && numPages > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            padding: '2px 4px',
            gap: '2px'
          }}>
            <button
              type="button"
              onClick={onPrevPage}
              disabled={pageNum <= 1}
              style={{
                background: 'none',
                border: 'none',
                color: pageNum <= 1 ? '#52525b' : '#e4e4e7',
                cursor: pageNum <= 1 ? 'not-allowed' : 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px'
              }}
              title="Previous Page"
            >
              <ChevronLeft size={15} />
            </button>
            <span style={{
              fontSize: '0.78rem',
              color: '#d4d4d8',
              fontWeight: 500,
              padding: '0 6px',
              fontVariantNumeric: 'tabular-nums'
            }}>
              {pageNum} / {numPages}
            </span>
            <button
              type="button"
              onClick={onNextPage}
              disabled={pageNum >= numPages}
              style={{
                background: 'none',
                border: 'none',
                color: pageNum >= numPages ? '#52525b' : '#e4e4e7',
                cursor: pageNum >= numPages ? 'not-allowed' : 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px'
              }}
              title="Next Page"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        {/* Zoom Controls (PDF or Image) */}
        {allowZoom && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            padding: '2px 4px',
            gap: '2px'
          }}>
            <button
              type="button"
              onClick={onZoomOut}
              disabled={scale <= 0.5}
              style={{
                background: 'none',
                border: 'none',
                color: scale <= 0.5 ? '#52525b' : '#e4e4e7',
                cursor: scale <= 0.5 ? 'not-allowed' : 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px'
              }}
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              onClick={onResetZoom}
              style={{
                background: 'none',
                border: 'none',
                color: '#d4d4d8',
                fontSize: '0.78rem',
                fontWeight: 500,
                padding: '0 6px',
                cursor: 'pointer',
                fontVariantNumeric: 'tabular-nums'
              }}
              title="Reset Zoom"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              onClick={onZoomIn}
              disabled={scale >= 2.5}
              style={{
                background: 'none',
                border: 'none',
                color: scale >= 2.5 ? '#52525b' : '#e4e4e7',
                cursor: scale >= 2.5 ? 'not-allowed' : 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px'
              }}
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        )}

        {/* Sibling File Navigation (e.g. 1 of 4) */}
        {hasSiblingNav && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            padding: '2px 4px',
            gap: '2px'
          }}>
            <button
              type="button"
              onClick={onPrevFile}
              disabled={currentIndex <= 0}
              style={{
                background: 'none',
                border: 'none',
                color: currentIndex <= 0 ? '#52525b' : '#e4e4e7',
                cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px'
              }}
              title="Previous File"
            >
              <ChevronLeft size={15} />
            </button>
            <span style={{
              fontSize: '0.78rem',
              color: '#d4d4d8',
              fontWeight: 500,
              padding: '0 6px',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap'
            }}>
              {currentIndex + 1} of {totalFiles}
            </span>
            <button
              type="button"
              onClick={onNextFile}
              disabled={currentIndex >= totalFiles - 1}
              style={{
                background: 'none',
                border: 'none',
                color: currentIndex >= totalFiles - 1 ? '#52525b' : '#e4e4e7',
                cursor: currentIndex >= totalFiles - 1 ? 'not-allowed' : 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px'
              }}
              title="Next File"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        {/* Download Button */}
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '0.42rem 0.85rem',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            fontSize: '0.82rem',
            fontWeight: 500,
            cursor: downloading ? 'wait' : 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            if (!downloading) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
          }}
          onMouseLeave={(e) => {
            if (!downloading) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          }}
          title="Download File"
        >
          {downloading ? <Loader size={14} className="spin-animation" /> : <Download size={14} />}
          <span>{downloading ? 'Downloading...' : 'Download'}</span>
        </button>

        {/* Close / Back Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '0.42rem 0.75rem',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.82rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          }}
          title="Close Preview (Esc)"
        >
          <X size={15} />
          <span>Close</span>
        </button>
      </div>
    </header>
  );
}
