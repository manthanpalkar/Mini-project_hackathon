import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader, Download } from 'lucide-react';
import PreviewHeader from '../components/preview/PreviewHeader';
import PreviewToolbar from '../components/preview/PreviewToolbar';
import DocumentPreview from '../components/preview/DocumentPreview';
import ImagePreview from '../components/preview/ImagePreview';
import VideoPreview from '../components/preview/VideoPreview';
import AudioPreview from '../components/preview/AudioPreview';
import UnsupportedFilePreview from '../components/preview/UnsupportedFilePreview';
import { 
  getResourceById, 
  getResources, 
  getStoryById, 
  getPendingStories,
  getPendingResources,
  getResourceFileUrl, 
  downloadResourceFile, 
  formatBytes 
} from '../utils/db';

export default function FilePreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Route query params
  const folderId = searchParams.get('folderId');
  const storyIdParam = searchParams.get('storyId');
  const isPending = searchParams.get('pending') === 'true';

  // Smart derivation of storyId even if query param was omitted (e.g. direct link or refresh)
  const derivedStoryId = useMemo(() => {
    if (storyIdParam) return storyIdParam;
    if (id?.startsWith('resume-')) return id.replace('resume-', '');
    if (id?.startsWith('mat-')) {
      const parts = id.split('-');
      if (parts.length >= 3) {
        return parts.slice(1, -1).join('-');
      }
    }
    return null;
  }, [id, storyIdParam]);

  // Component state
  const [file, setFile] = useState(location.state?.file || null);
  const [files, setFiles] = useState(location.state?.files || []);
  const [folderName, setFolderName] = useState(location.state?.folderName || '');
  const [storyTitle, setStoryTitle] = useState(location.state?.storyTitle || '');

  const [loading, setLoading] = useState(!location.state?.file);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // Content state
  const [blobUrl, setBlobUrl] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [textContent, setTextContent] = useState('');

  // PDF & Viewport controls
  const [scale, setScale] = useState(1.0);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);

  // 1. Resolve file and sibling list (handles initial state, direct link, refresh, and pending items)
  useEffect(() => {
    let active = true;

    async function loadData() {
      // If file was passed in state and matches id, use it immediately
      if (location.state?.file && String(location.state.file.id) === String(id)) {
        setFile(location.state.file);
        if (location.state.files?.length) setFiles(location.state.files);
        if (location.state.folderName) setFolderName(location.state.folderName);
        if (location.state.storyTitle) setStoryTitle(location.state.storyTitle);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (derivedStoryId) {
          // A. Story attachments context
          let story = null;
          try {
            story = await getStoryById(derivedStoryId);
          } catch (e) {
            // Check pending stories if not found or if isPending
            const pendingList = await getPendingStories();
            story = pendingList.find(s => String(s.id) === String(derivedStoryId));
          }

          if (!story && isPending) {
            const pendingList = await getPendingStories();
            story = pendingList.find(s => String(s.id) === String(derivedStoryId));
          }

          if (!active) return;
          if (!story) throw new Error('Story or interview experience not found.');

          setStoryTitle(story.name || 'Story');
          const storyFilesList = [];

          // Resume doc
          const resumeName = story.resumeFile?.fileName || (typeof story.resume === 'object' ? story.resume.fileName : (story.resume || 'Resume.pdf'));
          const resumeUrl = story.resumeFile?.url || (typeof story.resume === 'object' ? story.resume.url : (story.resume && story.resume.startsWith('http') ? story.resume : null));
          const resumeDoc = {
            id: `resume-${story.id}`,
            title: `${story.name}'s Resume`,
            fileName: resumeName,
            type: 'PDF',
            mimeType: 'application/pdf',
            fileSize: story.resumeFile?.fileSize || '',
            url: resumeUrl || '#',
            previewUrl: resumeUrl || '#'
          };
          storyFilesList.push(resumeDoc);

          // Study materials
          if (Array.isArray(story.studyMaterials)) {
            story.studyMaterials.forEach((m, idx) => {
              storyFilesList.push({
                id: `mat-${story.id}-${idx}`,
                title: m.title || `Material ${idx + 1}`,
                fileName: m.fileName || m.title || `Material-${idx + 1}`,
                type: m.type || 'Document',
                fileSize: m.fileSize || '',
                url: m.url || '#',
                previewUrl: m.url || '#'
              });
            });
          }

          setFiles(storyFilesList);
          const matched = storyFilesList.find(f => String(f.id) === String(id)) || storyFilesList[0];
          setFile(matched);
        } else {
          // B. Resources context
          let currentRes = null;
          try {
            currentRes = await getResourceById(id);
          } catch (e) {
            // Check pending resources
            if (isPending) {
              try {
                const pendingList = await getPendingResources();
                currentRes = pendingList.find(r => String(r.id) === String(id));
              } catch (pe) {}
            }
            if (!currentRes) {
              const allRes = await getResources();
              currentRes = allRes.find(r => String(r.id) === String(id));
            }
          }

          if (!active) return;
          if (!currentRes) throw new Error('File not found or access denied.');

          setFile(currentRes);

          // Load sibling files for folder navigation
          const targetFolder = folderId || currentRes.folderId;
          if (targetFolder) {
            try {
              const folderFiles = await getResources({ folderId: targetFolder });
              if (active) {
                setFiles(folderFiles && folderFiles.length > 0 ? folderFiles : [currentRes]);
              }
            } catch (e) {
              setFiles([currentRes]);
            }
          } else {
            setFiles([currentRes]);
          }
        }
      } catch (err) {
        if (!active) return;
        console.error('[FilePreviewPage] Load error:', err);
        setError(err.message || 'Failed to load file preview.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [id, derivedStoryId, folderId, isPending]);

  // File identity and format detection
  const fileName = useMemo(() => {
    return file?.originalFileName || file?.fileName || file?.title || 'Document';
  }, [file]);

  const ext = useMemo(() => {
    if (!fileName || !fileName.includes('.')) return '';
    return fileName.split('.').pop().toLowerCase().trim();
  }, [fileName]);

  const mimeType = (file?.mimeType || '').toLowerCase();
  const fileType = file?.type || '';

  const isPdf = ext === 'pdf' || mimeType === 'application/pdf' || fileType === 'PDF';
  const isImage = !isPdf && (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext) || mimeType.startsWith('image/') || fileType === 'Image');
  const isVideo = !isPdf && !isImage && (['mp4', 'webm', 'mov'].includes(ext) || mimeType.startsWith('video/') || fileType === 'Video');
  const isAudio = !isPdf && !isImage && !isVideo && (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext) || mimeType.startsWith('audio/') || fileType === 'Audio');
  const isCodeOrText = !isPdf && !isImage && !isVideo && !isAudio && (
    ['txt', 'csv', 'java', 'py', 'js', 'jsx', 'ts', 'tsx', 'c', 'cpp', 'h', 'css', 'html', 'json', 'xml', 'sql', 'md', 'log'].includes(ext) ||
    mimeType.startsWith('text/')
  );

  // Compute format badge
  const badge = useMemo(() => {
    if (isPdf) return { label: 'PDF', bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' };
    if (ext === 'pptx' || ext === 'ppt') return { label: 'PPTX', bg: 'rgba(249, 115, 22, 0.2)', text: '#f97316' };
    if (ext === 'docx' || ext === 'doc') return { label: 'DOCX', bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' };
    if (ext === 'xlsx' || ext === 'xls') return { label: 'SHEET', bg: 'rgba(16, 185, 129, 0.2)', text: '#10b981' };
    if (isImage) return { label: 'IMAGE', bg: 'rgba(168, 85, 247, 0.2)', text: '#a855f7' };
    if (isVideo) return { label: 'VIDEO', bg: 'rgba(236, 72, 153, 0.2)', text: '#ec4899' };
    if (isAudio) return { label: 'AUDIO', bg: 'rgba(168, 85, 247, 0.2)', text: '#c084fc' };
    if (isCodeOrText) return { label: 'CODE', bg: 'rgba(6, 182, 212, 0.2)', text: '#06b6d4' };
    if (['zip', 'rar', '7z'].includes(ext)) return { label: 'ZIP', bg: 'rgba(234, 179, 8, 0.2)', text: '#eab308' };
    return { label: ext.toUpperCase() || 'FILE', bg: 'rgba(255, 255, 255, 0.1)', text: '#ffffff' };
  }, [ext, isPdf, isImage, isVideo, isAudio, isCodeOrText]);

  const formattedSize = useMemo(() => {
    if (file?.fileSize) return file.fileSize;
    if (file?.size) return formatBytes(file.size);
    return '';
  }, [file]);

  // Sibling index
  const currentIndex = useMemo(() => {
    if (!files || files.length === 0 || !file) return -1;
    return files.findIndex(f => String(f.id) === String(file.id));
  }, [files, file]);

  const totalFiles = files.length;

  // 2. Load file binary into blob URL or streaming URL with AbortController & instant memory cleanup
  useEffect(() => {
    let active = true;
    let objectUrl = null;
    const abortController = new AbortController();

    if (!file) return;

    // Reset viewer params for new file
    setScale(1.0);
    setPageNum(1);
    setNumPages(0);
    setTextContent('');
    setError(null);
    setBlobUrl(null);
    setPdfData(null);
    setStreamUrl(null);

    const fileUrl = getResourceFileUrl(file);

    if (!fileUrl || fileUrl === '#') {
      // If it's an unsupported format like PPTX, render fallback card directly
      if (!isPdf && !isImage && !isVideo && !isAudio && !isCodeOrText) {
        return;
      }
      setError('File link is not available.');
      return;
    }

    // Direct blobUrl or data URI
    if (fileUrl.startsWith('data:') || fileUrl.startsWith('blob:')) {
      setBlobUrl(fileUrl);
      setStreamUrl(fileUrl);
      return;
    }

    // Prepare auth headers and authenticated streaming URL
    const userSession = localStorage.getItem('loop_current_user');
    const headers = {};
    let authToken = null;
    if (userSession) {
      try {
        const { token } = JSON.parse(userSession);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          authToken = token;
        }
      } catch (e) {}
    }

    // Construct authenticated stream URL for native video & audio Range request streaming
    let authenticatedStreamUrl = fileUrl;
    if (authToken && (isVideo || isAudio)) {
      const separator = fileUrl.includes('?') ? '&' : '?';
      authenticatedStreamUrl = `${fileUrl}${separator}token=${encodeURIComponent(authToken)}`;
    }

    if (isVideo || isAudio) {
      // Native audio and video support authenticated Range requests directly without RAM buffering!
      setStreamUrl(authenticatedStreamUrl);
      return;
    }

    // If unsupported format (PPTX, DOCX, XLSX, ZIP, etc.), no need to buffer binary; fallback card displays directly
    if (!isPdf && !isImage && !isCodeOrText) {
      return;
    }

    // For PDF, Image, and Code/Text: fetch stream with abort controller
    fetch(fileUrl, { headers, signal: abortController.signal })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          throw new Error(`Failed to load file stream (${res.status})`);
        }

        if (isCodeOrText) {
          const text = await res.text();
          if (active) setTextContent(text);
          return;
        }

        const arrayBuffer = await res.arrayBuffer();
        if (!active) return;

        const mime = res.headers.get('content-type') || (isPdf ? 'application/pdf' : 'application/octet-stream');
        const blob = new Blob([arrayBuffer], { type: mime });
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);

        if (isPdf) {
          setPdfData(new Uint8Array(arrayBuffer));
        }
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return;
        console.warn('[FilePreviewPage] Stream load error:', err.message);
        if (isPdf || isImage || isVideo || isAudio || isCodeOrText) {
          setError('Could not load preview. You can download the file directly.');
        }
      });

    return () => {
      active = false;
      abortController.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setPdfData(null);
    };
  }, [file, isVideo, isAudio, isPdf, isImage, isCodeOrText]);

  // Navigate between sibling files in the same folder or story
  const navigateToFile = (targetFile) => {
    if (!targetFile) return;
    const query = new URLSearchParams(searchParams);
    if (derivedStoryId && !query.get('storyId')) {
      query.set('storyId', derivedStoryId);
    }
    navigate(`/preview/${targetFile.id}?${query.toString()}`, {
      state: {
        file: targetFile,
        files,
        folderName,
        storyTitle
      }
    });
  };

  const handlePrevFile = () => {
    if (currentIndex > 0) {
      navigateToFile(files[currentIndex - 1]);
    }
  };

  const handleNextFile = () => {
    if (currentIndex >= 0 && currentIndex < totalFiles - 1) {
      navigateToFile(files[currentIndex + 1]);
    }
  };

  // Close / Back button action
  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (derivedStoryId) {
      navigate(`/stories/${derivedStoryId}`);
    } else {
      navigate('/resources');
    }
  };

  // Safe Binary Download Handler
  const handleDownload = async () => {
    if (!file || downloading) return;
    setDownloading(true);
    try {
      await downloadResourceFile(file);
    } catch (err) {
      console.error('[FilePreviewPage] Download error:', err);
      alert('Failed to download file: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowLeft') {
        if (isPdf && pageNum > 1 && !e.shiftKey) {
          setPageNum(p => Math.max(1, p - 1));
        } else if (currentIndex > 0) {
          handlePrevFile();
        }
      } else if (e.key === 'ArrowRight') {
        if (isPdf && pageNum < numPages && !e.shiftKey) {
          setPageNum(p => Math.min(numPages, p + 1));
        } else if (currentIndex < totalFiles - 1) {
          handleNextFile();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, totalFiles, isPdf, pageNum, numPages]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100dvh',
      backgroundColor: '#09090b',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 99999,
      overflow: 'hidden',
      userSelect: 'none'
    }}>
      {/* 1. Header Toolbar */}
      <PreviewHeader
        fileName={fileName}
        fileSize={formattedSize}
        badge={badge}
        contextInfo={folderName ? `Folder: ${folderName}` : storyTitle ? `Story: ${storyTitle}` : ''}
        // PDF controls
        isPdf={isPdf}
        pageNum={pageNum}
        numPages={numPages}
        onPrevPage={() => setPageNum(p => Math.max(1, p - 1))}
        onNextPage={() => setPageNum(p => Math.min(numPages, p + 1))}
        // Zoom controls
        allowZoom={isPdf || isImage}
        scale={scale}
        onZoomIn={() => setScale(s => Math.min(2.5, +(s + 0.15).toFixed(2)))}
        onZoomOut={() => setScale(s => Math.max(0.5, +(s - 0.15).toFixed(2)))}
        onResetZoom={() => setScale(1.0)}
        // Sibling navigation
        currentIndex={currentIndex}
        totalFiles={totalFiles}
        onPrevFile={handlePrevFile}
        onNextFile={handleNextFile}
        // Actions
        downloading={downloading}
        onDownload={handleDownload}
        onClose={handleClose}
      />

      {/* 2. Main Viewport Stage */}
      <main style={{
        flex: '1 1 0%',
        minHeight: 0,
        width: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isPdf ? 'flex-start' : 'center',
        padding: '1.5rem 1rem',
        boxSizing: 'border-box',
        position: 'relative'
      }}>
        {/* Loading Indicator */}
        {loading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.85rem',
            color: '#a1a1aa',
            margin: 'auto'
          }}>
            <Loader size={36} className="spin-animation" color="var(--accent-color, #0a84ff)" />
            <p style={{ fontSize: '0.9rem', margin: 0 }}>Loading file preview...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div style={{
            textAlign: 'center',
            maxWidth: '440px',
            padding: '2.5rem 2rem',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            margin: 'auto'
          }}>
            <AlertCircle size={44} color="#ff453a" style={{ marginBottom: '0.85rem' }} />
            <h4 style={{ color: '#fff', fontSize: '1.15rem', margin: '0 0 0.5rem 0' }}>Preview Unavailable</h4>
            <p style={{ color: '#a1a1aa', fontSize: '0.85rem', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
              {error}
            </p>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              style={{
                backgroundColor: 'var(--accent-color, #0a84ff)',
                color: '#ffffff',
                border: 'none',
                padding: '0.65rem 1.4rem',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: downloading ? 'wait' : 'pointer'
              }}
            >
              <Download size={16} /> Download File
            </button>
          </div>
        )}

        {/* Content Renderers */}
        {!loading && !error && (
          <>
            {/* A. PDF Document Viewer */}
            {isPdf && (
              <DocumentPreview
                blobUrl={blobUrl}
                pdfData={pdfData}
                fileName={fileName}
                isPdf={true}
                scale={scale}
                pageNum={pageNum}
                onDocLoaded={(pages) => setNumPages(pages)}
                onError={(err) => setError(err)}
              />
            )}

            {/* B. Image Viewer */}
            {isImage && (
              <ImagePreview
                src={blobUrl}
                alt={fileName}
                scale={scale}
              />
            )}

            {/* C. Video Player */}
            {isVideo && (
              <VideoPreview
                src={streamUrl || blobUrl}
              />
            )}

            {/* D. Audio Player */}
            {isAudio && (
              <AudioPreview
                src={streamUrl || blobUrl}
                fileName={fileName}
                fileSize={formattedSize}
              />
            )}

            {/* E. Code & Text Viewer */}
            {isCodeOrText && (
              <DocumentPreview
                isCodeOrText={true}
                textContent={textContent}
              />
            )}

            {/* F. Unsupported Format Fallback (PPTX, DOCX, XLSX, ZIP, etc.) */}
            {!isPdf && !isImage && !isVideo && !isAudio && !isCodeOrText && (
              <UnsupportedFilePreview
                fileName={fileName}
                ext={ext}
                badge={badge}
                downloading={downloading}
                onDownload={handleDownload}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
