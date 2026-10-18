import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { uploadResourceStream } from '../utils/upload';
import { addPendingStory } from '../utils/db';

const UploadContext = createContext(null);

export function UploadProvider({ children }) {
  const [uploads, setUploads] = useState([]);
  const [isDockMinimized, setIsDockMinimized] = useState(false);
  const activeControllersRef = useRef(new Map());

  const startUpload = useCallback(async ({ file, title, description, category, folderId, semester, year, tags }, onComplete) => {
    const uploadId = 'up-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const abortController = new AbortController();
    activeControllersRef.current.set(uploadId, abortController);

    const newUpload = {
      id: uploadId,
      type: 'resource',
      file,
      fileName: file.name,
      fileSize: file.size,
      title: title || file.name,
      folderId,
      percent: 0,
      speedFormatted: 'Starting...',
      etaFormatted: 'Calculating...',
      remainingSecs: null,
      loadedFormatted: '0 B',
      totalFormatted: '',
      status: 'uploading', // 'uploading' | 'completed' | 'error' | 'cancelled'
      error: null,
      startedAt: Date.now()
    };

    setUploads(prev => [newUpload, ...prev]);
    setIsDockMinimized(false); // Pop up dock when new upload starts

    try {
      const result = await uploadResourceStream({
        file,
        title,
        description,
        category,
        folderId,
        semester,
        year,
        tags,
        onProgress: (stats) => {
          setUploads(prev => prev.map(u => {
            if (u.id !== uploadId) return u;
            return {
              ...u,
              percent: stats.percent,
              speedFormatted: stats.speedFormatted,
              etaFormatted: stats.etaFormatted,
              remainingSecs: stats.remainingSecs,
              loadedFormatted: stats.loadedFormatted,
              totalFormatted: stats.totalFormatted
            };
          }));
        },
        abortController
      });

      // Mark completed
      setUploads(prev => prev.map(u => {
        if (u.id !== uploadId) return u;
        return {
          ...u,
          percent: 100,
          status: 'completed',
          speedFormatted: 'Done',
          remainingSecs: 0,
          completedAt: Date.now()
        };
      }));

      // Notify any listening components (like Resources.jsx) to refresh
      window.dispatchEvent(new CustomEvent('loop_resource_uploaded', { detail: { folderId, resource: result } }));

      if (onComplete) onComplete(result);

      // Auto-remove completed upload after 8 seconds
      setTimeout(() => {
        setUploads(prev => prev.filter(u => u.id !== uploadId));
      }, 8000);

      return result;
    } catch (err) {
      if (err.message === 'Upload cancelled') {
        setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'cancelled', speedFormatted: 'Cancelled' } : u));
      } else {
        setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'error', error: err.message || 'Upload failed' } : u));
      }
      throw err;
    } finally {
      activeControllersRef.current.delete(uploadId);
    }
  }, []);

  const startStoryUpload = useCallback(async (submission, onComplete) => {
    // Prevent duplicate active story uploads in-flight for the exact same candidate, company, role, and passout year
    const duplicate = uploads.find(u =>
      u.status === 'uploading' &&
      u.type === 'story' &&
      (u.submissionData?.company || '').trim().toLowerCase() === (submission.company || '').trim().toLowerCase() &&
      (u.submissionData?.role || '').trim().toLowerCase() === (submission.role || '').trim().toLowerCase() &&
      (u.submissionData?.passoutYear || '') === (submission.passoutYear || '') &&
      (u.submissionData?.uploadedByEmail || u.submissionData?.name || '').trim().toLowerCase() === (submission.uploadedByEmail || submission.name || '').trim().toLowerCase()
    );
    if (duplicate) {
      throw new Error('This placement story is already actively submitting in the background.');
    }

    const uploadId = 'story-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const resumeFileName = submission.resumeFile?.fileName || (typeof submission.resume === 'object' ? submission.resume.fileName : (submission.resume || 'Resume.pdf'));

    const newUpload = {
      id: uploadId,
      type: 'story',
      submissionData: submission,
      fileName: resumeFileName,
      fileSize: submission.resumeFile?.fileSize || '',
      title: `${submission.name} — ${submission.company} Story`,
      percent: 0,
      speedFormatted: 'Preparing...',
      etaFormatted: 'Starting...',
      remainingSecs: null,
      loadedFormatted: '0 B',
      totalFormatted: '',
      status: 'uploading',
      error: null,
      startedAt: Date.now()
    };

    setUploads(prev => [newUpload, ...prev]);
    setIsDockMinimized(false);

    try {
      const result = await addPendingStory(submission, (percent) => {
        setUploads(prev => prev.map(u => {
          if (u.id !== uploadId) return u;
          return {
            ...u,
            percent: Math.min(99, percent),
            speedFormatted: percent >= 95 ? 'Persisting & Moderating...' : 'Submitting story...',
            etaFormatted: percent >= 95 ? 'A few seconds...' : `${percent}% complete`
          };
        }));
      });

      // Mark complete
      setUploads(prev => prev.map(u => {
        if (u.id !== uploadId) return u;
        return {
          ...u,
          percent: 100,
          status: 'completed',
          speedFormatted: 'Pending Moderation',
          etaFormatted: 'Submitted successfully',
          remainingSecs: 0,
          completedAt: Date.now()
        };
      }));

      window.dispatchEvent(new CustomEvent('loop_story_submitted', { detail: { story: result } }));
      if (onComplete) onComplete(result);

      // Auto dismiss completed after 8 seconds
      setTimeout(() => {
        setUploads(prev => prev.filter(u => u.id !== uploadId));
      }, 8000);

      return result;
    } catch (err) {
      setUploads(prev => prev.map(u => {
        if (u.id !== uploadId) return u;
        return {
          ...u,
          status: 'error',
          error: err.message || 'Story submission failed'
        };
      }));
      throw err;
    }
  }, [uploads]);

  const cancelUpload = useCallback((id) => {
    const controller = activeControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      activeControllersRef.current.delete(id);
    }
    setUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  const dismissUpload = useCallback((id) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  const retryUpload = useCallback((id) => {
    const item = uploads.find(u => u.id === id);
    if (!item) return;
    setUploads(prev => prev.filter(u => u.id !== id));
    if (item.type === 'story' && item.submissionData) {
      startStoryUpload(item.submissionData);
    } else if (item.file) {
      startUpload(item);
    }
  }, [uploads, startStoryUpload, startUpload]);

  const toggleDock = useCallback(() => {
    setIsDockMinimized(prev => !prev);
  }, []);

  return (
    <UploadContext.Provider value={{
      uploads,
      activeCount: uploads.filter(u => u.status === 'uploading').length,
      isDockMinimized,
      toggleDock,
      startUpload,
      startStoryUpload,
      retryUpload,
      cancelUpload,
      dismissUpload
    }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
}
