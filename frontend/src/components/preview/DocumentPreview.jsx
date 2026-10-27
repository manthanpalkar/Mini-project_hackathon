import { useEffect, useRef, useState, useMemo } from 'react';
import { Loader, AlertCircle } from 'lucide-react';

// Global polyfill for Uint8Array toHex / fromHex and Promise.withResolvers
if (typeof Uint8Array !== 'undefined') {
  if (!Uint8Array.prototype.toHex) {
    Uint8Array.prototype.toHex = function() {
      let hex = '';
      for (let i = 0; i < this.length; i++) {
        hex += this[i].toString(16).padStart(2, '0');
      }
      return hex;
    };
  }
  if (!Uint8Array.fromHex) {
    Uint8Array.fromHex = function(hex) {
      if (typeof hex !== 'string' || hex.length % 2 !== 0) {
        throw new TypeError('Invalid hex string');
      }
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
      }
      return bytes;
    };
  }
}
if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Lazy singleton loader for PDF.js (uses legacy build with broad cross-browser polyfills)
let pdfjsLibPromise = null;
const getPdfjs = async () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.min.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    ]).then(([pdfjsLib, workerModule]) => {
      if (workerModule && workerModule.default) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
      }
      return pdfjsLib;
    }).catch(async (err) => {
      console.warn('[DocumentPreview] Legacy worker import failed, falling back to standard loader:', err);
      const pdfjsLib = await import('pdfjs-dist');
      return pdfjsLib;
    });
  }
  return pdfjsLibPromise;
};

export default function DocumentPreview({
  blobUrl,
  pdfData = null,
  fileName = 'Document',
  isPdf = false,
  isCodeOrText = false,
  textContent = '',
  scale = 1.0,
  pageNum = 1,
  onDocLoaded,
  onError
}) {
  const canvasRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [isPageRendered, setIsPageRendered] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [pdfJsFailed, setPdfJsFailed] = useState(false);
  const [useNativeViewer, setUseNativeViewer] = useState(false);
  const renderTaskRef = useRef(null);

  const callbacksRef = useRef({ onDocLoaded, onError });
  useEffect(() => {
    callbacksRef.current = { onDocLoaded, onError };
  }, [onDocLoaded, onError]);

  // Track window dimensions for responsive canvas sizing
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowDimensions({
          width: window.innerWidth,
          height: window.innerHeight
        });
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // 1. Load PDF Document asynchronously when blobUrl or pdfData changes
  useEffect(() => {
    let active = true;
    let loadingTask = null;
    let loadedDoc = null;

    if (!isPdf || (!blobUrl && !pdfData)) {
      setPdfDoc(null);
      setIsPageRendered(false);
      setPdfJsFailed(false);
      return;
    }

    setRendering(true);
    setIsPageRendered(false);
    setPdfDoc(null);
    setPdfJsFailed(false);

    getPdfjs()
      .then((pdfjsLib) => {
        if (!active) return null;

        // Prefer passing binary Uint8Array directly to bypass cross-origin worker blob fetch restrictions
        const docConfig = pdfData
          ? {
              data: pdfData,
              cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist/cmaps/',
              cMapPacked: true
            }
          : {
              url: blobUrl,
              cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist/cmaps/',
              cMapPacked: true
            };

        loadingTask = pdfjsLib.getDocument(docConfig);
        return loadingTask.promise;
      })
      .then((doc) => {
        if (!doc) return;
        if (!active) {
          try { doc.destroy(); } catch {}
          return;
        }
        loadedDoc = doc;
        setPdfDoc(doc);
        setPdfJsFailed(false);
        if (callbacksRef.current.onDocLoaded) {
          callbacksRef.current.onDocLoaded(doc.numPages);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.warn('[DocumentPreview] PDF.js rendering encountered an issue, enabling native browser PDF fallback:', err);
        // Fallback gracefully to native browser PDF viewer
        setPdfJsFailed(true);
        if (!blobUrl && callbacksRef.current.onError) {
          callbacksRef.current.onError('Could not load PDF document. It may be corrupt or encrypted.');
        }
      })
      .finally(() => {
        if (active) setRendering(false);
      });

    return () => {
      active = false;
      if (loadedDoc) {
        try { loadedDoc.destroy(); } catch {}
      }
      if (loadingTask) {
        try { loadingTask.destroy(); } catch {}
      }
    };
  }, [blobUrl, pdfData, isPdf]);

  // 2. Render current page automatically when pdfDoc, pageNum, scale, or window size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!pdfDoc || !canvas || !isPdf) return;

    let cancelRender = false;

    pdfDoc.getPage(pageNum)
      .then((page) => {
        if (cancelRender) return;

        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Cancel previous render task safely
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
          renderTaskRef.current = null;
        }

        const availWidth = Math.max(windowDimensions.width - 64, 360);
        const unscaledViewport = page.getViewport({ scale: 1.0 });

        // Calculate responsive, comfortable reading width (840px - 1040px on desktop)
        const targetWidth = Math.min(
          Math.max(unscaledViewport.width * 1.35, 820),
          availWidth * 0.94
        );
        const baseScale = targetWidth / unscaledViewport.width;
        const effectiveScale = +(baseScale * scale).toFixed(2);

        const viewport = page.getViewport({ scale: effectiveScale });

        // Memory-safe high-DPI scaling: clamp to 1.75 to prevent huge canvas bitmap allocations on low-RAM devices
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        return renderTask.promise;
      })
      .then(() => {
        if (!cancelRender) {
          setIsPageRendered(true);
        }
      })
      .catch((err) => {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('[DocumentPreview] Page render warning:', err);
        }
      });

    return () => {
      cancelRender = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
        renderTaskRef.current = null;
      }
      // Reclaim canvas buffer memory
      if (canvas) {
        canvas.width = 1;
        canvas.height = 1;
      }
    };
  }, [pdfDoc, pageNum, scale, isPdf, windowDimensions]);

  // Safeguard: Bounded text content rendering to avoid DOM freezing on massive code/log dumps
  const isTruncated = textContent && textContent.length > 50000;
  const displayedText = useMemo(() => {
    if (!textContent) return '';
    return isTruncated ? textContent.slice(0, 50000) : textContent;
  }, [textContent, isTruncated]);

  if (isPdf) {
    if (useNativeViewer || (pdfJsFailed && blobUrl)) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingBottom: '1rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: '1040px',
            marginBottom: '0.75rem',
            padding: '0.45rem 1rem',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '0.82rem',
            color: '#a1a1aa'
          }}>
            <span>Displaying with Browser Native PDF Viewer</span>
            {!pdfJsFailed && (
              <button
                type="button"
                onClick={() => setUseNativeViewer(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-color, #0a84ff)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.82rem'
                }}
              >
                Switch to Canvas Viewer
              </button>
            )}
          </div>
          <iframe
            src={`${blobUrl}#toolbar=1&navpanes=1`}
            title={fileName || 'PDF Document'}
            style={{
              width: '100%',
              maxWidth: '1040px',
              height: 'calc(100vh - 140px)',
              minHeight: '650px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              backgroundColor: '#525659'
            }}
          />
        </div>
      );
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%',
        minHeight: '100%',
        paddingBottom: '2.5rem',
        position: 'relative'
      }}>
        {(!isPageRendered || rendering) && (
          <div style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#a1a1aa'
          }}>
            <Loader size={36} className="spin-animation" color="#0a84ff" />
            <span style={{ fontSize: '0.88rem' }}>Rendering document...</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.85)',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            maxWidth: '100%',
            display: isPageRendered ? 'block' : 'none',
            opacity: isPageRendered ? 1 : 0,
            transition: 'opacity 0.2s ease'
          }}
        />
        {isPageRendered && (
          <div style={{
            marginTop: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            color: '#71717a'
          }}>
            <span>Having trouble viewing?</span>
            <button
              type="button"
              onClick={() => setUseNativeViewer(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-color, #0a84ff)',
                cursor: 'pointer',
                padding: 0,
                fontSize: '0.8rem',
                textDecoration: 'underline'
              }}
            >
              Open in Browser Native Viewer
            </button>
          </div>
        )}
      </div>
    );
  }

  if (isCodeOrText) {
    return (
      <div style={{
        width: '100%',
        maxWidth: '1000px',
        backgroundColor: '#111113',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '1.75rem',
        overflow: 'auto',
        boxSizing: 'border-box',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
        margin: 'auto'
      }}>
        {isTruncated && (
          <div style={{
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: '8px',
            padding: '0.65rem 1rem',
            marginBottom: '1rem',
            color: '#facc15',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} />
            <span>File is very large. Showing first 50,000 characters for high performance. Download to view the entire file.</span>
          </div>
        )}
        <pre style={{
          margin: 0,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.88rem',
          lineHeight: '1.65',
          color: '#e4e4e7',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}>
          <code>{displayedText || 'Empty file content'}</code>
        </pre>
      </div>
    );
  }

  return null;
}
