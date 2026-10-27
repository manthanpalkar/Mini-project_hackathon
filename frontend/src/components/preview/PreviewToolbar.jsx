import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

export default function PreviewToolbar({
  isPdf = false,
  pageNum = 1,
  numPages = 0,
  onPrevPage,
  onNextPage,
  allowZoom = false,
  scale = 1.0,
  onZoomIn,
  onZoomOut,
  onResetZoom
}) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.65rem'
    }}>
      {/* PDF Page Controls */}
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

      {/* Zoom Controls */}
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
    </div>
  );
}
