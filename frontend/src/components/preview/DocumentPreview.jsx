import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { Loader, AlertCircle } from 'lucide-react';

// Configure PDF.js worker using Vite asset URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export default function DocumentPreview({
  blobUrl,
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
  const renderTaskRef = useRef(null);

  // Track window dimensions for responsive canvas sizing on window change
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

  // 1. Load PDF Document when blobUrl changes
  useEffect(() => {
    let active = true;

    if (!isPdf || !blobUrl) {
      setPdfDoc(null);
      setIsPageRendered(false);
      return;
    }

    setRendering(true);
    setIsPageRendered(false);
    setPdfDoc(null);

    const loadingTask = pdfjsLib.getDocument({
      url: blobUrl,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist/cmaps/',
      cMapPacked: true
    });

    let loadedDoc = null;

    loadingTask.promise
      .then((doc) => {
        if (!active) {
          try { doc.destroy(); } catch (e) {}
          return;
        }
        loadedDoc = doc;
        setPdfDoc(doc);
        if (onDocLoaded) {
          onDocLoaded(doc.numPages);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error('[DocumentPreview] PDF Load Error:', err);
        if (onError) onError('Could not load PDF document. It may be corrupt or encrypted.');
      })
      .finally(() => {
        if (active) setRendering(false);
      });

    return () => {
      active = false;
      if (loadedDoc) {
        try { loadedDoc.destroy(); } catch (e) {}
      }
      try {
        loadingTask.destroy();
      } catch (e) {}
    };
  }, [blobUrl, isPdf]);

  // 2. Render current page automatically when pdfDoc, pageNum, scale, or window size changes
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !isPdf) return;

    let cancelRender = false;

    pdfDoc.getPage(pageNum)
      .then((page) => {
        if (cancelRender) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Cancel previous render task safely
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {}
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

        // High-DPI support (devicePixelRatio) for sharp rendering
        const pixelRatio = window.devicePixelRatio || 1;
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
        } catch (e) {}
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, pageNum, scale, isPdf, windowDimensions]);

  if (isPdf) {
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
        <pre style={{
          margin: 0,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.88rem',
          lineHeight: '1.65',
          color: '#e4e4e7',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}>
          <code>{textContent || 'Empty file content'}</code>
        </pre>
      </div>
    );
  }

  return null;
}
