import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, Download, Plus, X, Folder, Lock, Globe, Shield, 
  Trash2, Edit, ChevronRight, ArrowLeft, FileText, Image as ImageIcon, 
  FileSpreadsheet, Eye, UploadCloud, CheckCircle, AlertCircle, 
  CornerDownRight, MoreVertical, RefreshCw, Layers, Sparkles,
  Info, ShieldCheck
} from 'lucide-react';
import { 
  getResources, getFolders, addFolder, updateFolder, deleteFolder, 
  uploadResourceStream, deleteResource, patchResource, formatBytes,
  downloadResourceFile
} from '../utils/db';
import { useCachedData } from '../hooks/useCachedData';
import { useUpload } from '../context/UploadContext';

function ResourceFolder3DCard({
  folder,
  resCount,
  isSystem = false,
  onOpenFolder,
  onEditFolder,
  onDeleteFolder
}) {
  const cardRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const animFrameRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    if (animFrameRef.current) return;

    const clientX = e.clientX;
    const clientY = e.clientY;

    animFrameRef.current = requestAnimationFrame(() => {
      if (!cardRef.current) {
        animFrameRef.current = null;
        return;
      }
      const rect = cardRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;
      setTilt({ x: rotateX, y: rotateY, active: true });
      animFrameRef.current = null;
    });
  };

  const handleMouseLeave = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setTilt({ x: 0, y: 0, active: false });
  };

  const transformStyle = isVisible
    ? tilt.active
      ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-6px) scale(1.02)`
      : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)'
    : 'perspective(1000px) rotateX(12deg) translateY(40px) scale(0.96)';

  return (
    <div
      ref={cardRef}
      onClick={() => onOpenFolder(folder.id)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="bento-card glass-panel"
      style={{
        padding: '1.75rem',
        borderRadius: '22px',
        cursor: 'pointer',
        border: tilt.active
          ? `1px solid ${isSystem ? 'var(--text-primary)' : '#ff9f0a'}`
          : '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface)',
        boxShadow: tilt.active
          ? '0 24px 50px -10px rgba(0, 0, 0, 0.22), 0 0 1px 1px rgba(255, 255, 255, 0.15) inset'
          : 'var(--card-shadow)',
        transform: transformStyle,
        opacity: isVisible ? 1 : 0,
        transition: tilt.active
          ? 'transform 0.12s ease-out, box-shadow 0.25s ease, border-color 0.25s ease'
          : 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease, border-color 0.25s ease',
        transformStyle: 'preserve-3d',
        willChange: 'transform, opacity',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '190px'
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <div style={{
            backgroundColor: isSystem ? 'rgba(212, 255, 50, 0.22)' : 'rgba(255, 159, 10, 0.12)',
            border: isSystem ? '1px solid rgba(212, 255, 50, 0.45)' : 'none',
            borderRadius: '12px',
            padding: '0.55rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {isSystem ? <Folder size={20} color="var(--text-primary)" /> : <Lock size={20} color="#ff9f0a" />}
          </div>
          <span style={{
            backgroundColor: isSystem ? 'rgba(212, 255, 50, 0.25)' : 'rgba(255, 159, 10, 0.15)',
            border: isSystem ? '1px solid rgba(212, 255, 50, 0.45)' : 'none',
            color: isSystem ? 'var(--text-primary)' : '#ff9f0a',
            fontSize: '0.68rem',
            fontWeight: 800,
            padding: '0.2rem 0.55rem',
            borderRadius: '10px',
            letterSpacing: '0.04em'
          }}>
            {isSystem ? 'OFFICIAL' : 'PRIVATE'}
          </span>
        </div>
        <h3 style={{ fontSize: '1.18rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          {folder.name}
        </h3>
        <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
          {folder.description || (isSystem ? 'Academic course modules and semester question banks.' : 'Personal private resource folder.')}
        </p>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
          <span>{isSystem ? 'Curated Academic Vault' : 'Personal Vault'}</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{resCount} {resCount === 1 ? 'file' : 'files'}</span>
        </div>
        <div style={{ height: '4px', width: '100%', backgroundColor: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.85rem' }}>
          <div style={{
            height: '100%',
            width: resCount > 0 ? '100%' : (isSystem ? '20%' : '15%'),
            backgroundColor: isSystem ? 'var(--text-primary)' : '#ff9f0a',
            borderRadius: '999px'
          }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.65rem', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {isSystem ? 'Verified SPIT Material' : 'Visible only to you'}
          </span>
          {isSystem ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.78rem' }}>
              Explore <ChevronRight size={13} />
            </span>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onEditFolder(folder)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                title="Rename Folder"
              >
                <Edit size={14} />
              </button>
              <button
                type="button"
                onClick={() => onDeleteFolder({ type: 'folder', item: folder })}
                style={{ background: 'none', border: 'none', color: '#ff453a', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                title="Delete Folder"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Subfolder3DCard({ subf, resCount, onOpenFolder }) {
  const cardRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1, rootMargin: '0px 0px -20px 0px' }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setTilt({ x: ((y - centerY) / centerY) * -4, y: ((x - centerX) / centerX) * 4, active: true });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0, active: false });
  };

  return (
    <div
      ref={cardRef}
      onClick={() => onOpenFolder(subf.id)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="glass-panel"
      style={{
        padding: '1.25rem',
        borderRadius: '16px',
        cursor: 'pointer',
        border: tilt.active ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
        boxShadow: tilt.active ? '0 16px 32px -8px rgba(0,0,0,0.2)' : 'none',
        transform: isVisible
          ? tilt.active
            ? `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-4px) scale(1.02)`
            : 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)'
          : 'perspective(800px) rotateX(10deg) translateY(30px) scale(0.97)',
        opacity: isVisible ? 1 : 0,
        transition: tilt.active
          ? 'transform 0.12s ease-out, box-shadow 0.2s ease, border-color 0.2s ease'
          : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transformStyle: 'preserve-3d'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
        <Folder size={20} color="var(--accent-color)" />
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{subf.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {resCount} items
          </div>
        </div>
      </div>
      <ChevronRight size={16} color="var(--text-secondary)" />
    </div>
  );
}

export default function Resources() {
  const navigate = useNavigate();
  const { data: cachedResources, loading: loadingResources, mutate: mutateResources } = useCachedData('resources', getResources);
  const { data: cachedFolders, loading: loadingFolders, mutate: mutateFolders } = useCachedData('folders', getFolders);
  const { startUpload } = useUpload();

  const resources = cachedResources || [];
  const folders = cachedFolders || [];
  const loading = loadingResources || loadingFolders;

  // URL search params sync
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') || 'all';
  const urlFolder = searchParams.get('folder') || null;

  // Current navigation state synchronized with URL
  const [currentFolderId, setCurrentFolderIdState] = useState(urlFolder);
  const [filterTab, setFilterTabState] = useState(urlTab);
  const [searchQuery, setSearchQuery] = useState('');

  const setCurrentFolderId = (folderId) => {
    setCurrentFolderIdState(folderId);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (folderId) {
        next.set('folder', folderId);
      } else {
        next.delete('folder');
      }
      return next;
    });
  };

  const setFilterTab = (tab) => {
    setFilterTabState(tab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab && tab !== 'all') {
        next.set('tab', tab);
      } else {
        next.delete('tab');
      }
      return next;
    });
  };

  // Keep state in sync if browser back/forward buttons are clicked
  useEffect(() => {
    const t = searchParams.get('tab') || 'all';
    const f = searchParams.get('folder') || null;
    setCurrentFolderIdState(f);
    setFilterTabState(t);
  }, [searchParams]);

  // Listen for background upload completions
  useEffect(() => {
    const handleUploaded = () => {
      mutateResources();
    };
    window.addEventListener('loop_resource_uploaded', handleUploaded);
    return () => window.removeEventListener('loop_resource_uploaded', handleUploaded);
  }, [mutateResources]);

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [editingFolder, setEditingFolder] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'file' | 'folder', item: any }

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCategory, setUploadCategory] = useState('General');
  const [uploadFolderId, setUploadFolderId] = useState('system-placement-material');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const abortControllerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Global Cmd+K / Ctrl+K search shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // New Folder form state
  const [folderForm, setFolderForm] = useState({
    name: '',
    description: '',
    visibility: 'private',
    allowContributions: false,
    parentId: null
  });

  // Edit Resource form state
  const [editResourceForm, setEditResourceForm] = useState({
    title: '',
    description: '',
    category: 'General',
    folderId: ''
  });

  // Track downloading file ID to prevent duplicate requests
  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownloadResource = async (resItem, e) => {
    e?.stopPropagation?.();
    if (downloadingId === resItem.id) return;
    setDownloadingId(resItem.id);
    try {
      await downloadResourceFile(resItem);
    } catch (err) {
      console.error('Download error:', err);
      alert(err.message || 'Failed to download file.');
    } finally {
      setTimeout(() => setDownloadingId(null), 800);
    }
  };

  // Current user authentication & role
  const userSession = localStorage.getItem('loop_current_user');
  const currentUser = useMemo(() => {
    try {
      return userSession ? JSON.parse(userSession) : null;
    } catch (e) {
      return null;
    }
  }, [userSession]);

  const isAdmin = currentUser?.isAdmin || currentUser?.role === 'Admin' || currentUser?.role === 'Administrator';
  const currentUserEmail = currentUser?.email || '';

  // Prevent background scrolling when modals open
  useEffect(() => {
    if (isUploadModalOpen || isFolderModalOpen || editingResource || editingFolder || deleteConfirm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isUploadModalOpen, isFolderModalOpen, editingResource, editingFolder, deleteConfirm]);

  // Current folder object
  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null;
    return folders.find(f => f.id === currentFolderId) || null;
  }, [currentFolderId, folders]);

  useEffect(() => {
    if (currentFolder) {
      document.title = `${currentFolder.name} | Study Resources - LOOP`;
    } else {
      document.title = 'LOOP | Study Resources';
    }
  }, [currentFolder]);

  // Generate breadcrumb path
  const breadcrumbs = useMemo(() => {
    const crumbs = [];
    let curr = currentFolder;
    while (curr) {
      crumbs.unshift(curr);
      if (curr.parentId) {
        curr = folders.find(f => f.id === curr.parentId) || null;
      } else {
        curr = null;
      }
    }
    return crumbs;
  }, [currentFolder, folders]);

  // Check ownership
  const isOwnerOfFolder = (folder) => {
    if (!folder || !currentUser) return false;
    if (isAdmin) return true;
    return folder.ownerEmail === currentUserEmail || (folder.ownerId && String(folder.ownerId) === String(currentUser.id));
  };

  const isOwnerOfResource = (res) => {
    if (!res || !currentUser) return false;
    if (isAdmin) return true;
    return res.uploadedByEmail === currentUserEmail || (res.ownerId && String(res.ownerId) === String(currentUser.id));
  };

  // Group root folders into categories
  const { systemFolders, myPrivateFolders } = useMemo(() => {
    // Only consider folders with parentId === null for root categories
    const rootFolders = folders.filter(f => !f.parentId);

    const system = rootFolders.filter(f => f.folderType === 'system' || f.isSystemFolder || f.id?.startsWith('system-'));
    const myPrivate = isAdmin
      ? rootFolders.filter(f => f.visibility === 'private' || (!f.isSystemFolder && f.folderType !== 'system'))
      : [];

    return { systemFolders: system, myPrivateFolders: myPrivate };
  }, [folders, isAdmin]);

  // If a non-admin somehow has private filter selected, reset to all
  useEffect(() => {
    if (!isAdmin && filterTab === 'private') {
      setFilterTab('all');
    }
  }, [isAdmin, filterTab]);

  // Subfolders of the currently active folder
  const currentSubfolders = useMemo(() => {
    if (!currentFolderId) return [];
    return folders.filter(f => f.parentId === currentFolderId);
  }, [currentFolderId, folders]);

  // Resources inside current folder
  const currentFolderResources = useMemo(() => {
    if (!currentFolderId) return [];
    return resources.filter(r => r.folderId === currentFolderId);
  }, [currentFolderId, resources]);

  // Filtered resources for search or root
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return resources.filter(r => 
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.uploadedBy && r.uploadedBy.toLowerCase().includes(q)) ||
      (r.originalFileName && r.originalFileName.toLowerCase().includes(q))
    );
  }, [searchQuery, resources]);

  // Get total files count for a folder (recursive)
  const getResourceCountForFolder = (folderId) => {
    const collectFolderIds = (id) => {
      const ids = [id];
      const children = folders.filter(f => f.parentId === id);
      children.forEach(c => ids.push(...collectFolderIds(c.id)));
      return ids;
    };
    const allIds = collectFolderIds(folderId);
    return resources.filter(r => allIds.includes(r.folderId)).length;
  };

  // Open upload modal with current folder context
  const handleOpenUpload = (targetFolderId = null) => {
    const folderToUse = targetFolderId || currentFolderId || 'system-placement-material';
    setUploadFolderId(folderToUse);
    setUploadFile(null);
    setUploadTitle('');
    setUploadDescription('');
    setUploadCategory('General');
    setUploadStats(null);
    setUploadError(null);
    setUploadSuccess(false);
    setIsUploadModalOpen(true);
  };

  // Cancel running upload
  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsUploading(false);
    setUploadStats(null);
    setUploadError('Upload cancelled by user.');
  };

  // Perform upload in background
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }
    if (uploadFile.size > 200 * 1024 * 1024) {
      setUploadError('File exceeds the maximum allowed size of 200 MB.');
      return;
    }

    const fileToUpload = uploadFile;
    const titleToUpload = uploadTitle.trim() || uploadFile.name.replace(/\.[^/.]+$/, '');
    const descToUpload = uploadDescription.trim();
    const catToUpload = uploadCategory;
    const folderToUpload = uploadFolderId;

    // Hand off to global background uploader
    startUpload({
      file: fileToUpload,
      title: titleToUpload,
      description: descToUpload,
      category: catToUpload,
      folderId: folderToUpload
    }, () => {
      mutateResources();
    });

    // Close modal immediately so the user can continue browsing
    setIsUploadModalOpen(false);
    setUploadFile(null);
    setUploadTitle('');
    setUploadDescription('');
    setUploadStats(null);
    setUploadError(null);
  };

  // Create folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Folder creation is restricted to administrators only.');
      return;
    }
    if (!folderForm.name.trim()) return;

    try {
      const newFolder = await addFolder({
        name: folderForm.name.trim(),
        description: folderForm.description.trim(),
        visibility: isAdmin ? folderForm.visibility : 'private',
        allowContributions: isAdmin ? folderForm.allowContributions : false,
        parentId: folderForm.parentId || currentFolderId || null,
        isSystemFolder: isAdmin && folderForm.isSystemFolder
      });

      mutateFolders([...folders, newFolder], false);
      setIsFolderModalOpen(false);
      setFolderForm({
        name: '',
        description: '',
        visibility: isAdmin ? 'public' : 'private',
        allowContributions: isAdmin,
        parentId: null
      });
    } catch (err) {
      alert(err.message || 'Failed to create folder.');
    }
  };

  // Rename/update folder
  const handleSaveEditFolder = async (e) => {
    e.preventDefault();
    if (!editingFolder) return;

    try {
      const updated = await updateFolder(editingFolder.id, {
        name: editingFolder.name.trim(),
        description: editingFolder.description?.trim() || '',
        visibility: editingFolder.visibility,
        allowContributions: editingFolder.allowContributions
      });

      mutateFolders(folders.map(f => f.id === updated.id ? updated : f), false);
      setEditingFolder(null);
    } catch (err) {
      alert(err.message || 'Failed to update folder.');
    }
  };

  // Edit resource metadata
  const handleSaveEditResource = async (e) => {
    e.preventDefault();
    if (!editingResource) return;

    try {
      const updated = await patchResource(editingResource.id, {
        title: editResourceForm.title.trim(),
        description: editResourceForm.description.trim(),
        category: editResourceForm.category,
        folderId: editResourceForm.folderId || editingResource.folderId
      });

      mutateResources(resources.map(r => r.id === updated.id ? updated : r), false);
      setEditingResource(null);
    } catch (err) {
      alert(err.message || 'Failed to update resource metadata.');
    }
  };

  // Execute confirmed deletion
  const handleExecuteDelete = async () => {
    if (!deleteConfirm) return;
    const { type, item } = deleteConfirm;

    try {
      if (type === 'file') {
        await deleteResource(item.id);
        mutateResources(resources.filter(r => r.id !== item.id), false);
      } else if (type === 'folder') {
        await deleteFolder(item.id);
        mutateFolders(folders.filter(f => f.id !== item.id), false);
        // If we were inside the deleted folder, jump back to parent
        if (currentFolderId === item.id) {
          setCurrentFolderId(item.parentId || null);
        }
      }
      setDeleteConfirm(null);
    } catch (err) {
      alert(err.message || 'Failed to delete item.');
    }
  };

  // Helper to get file icon
  const getFileIcon = (res) => {
    const type = res.type || '';
    const mime = (res.mimeType || '').toLowerCase();
    if (type === 'PDF' || mime === 'application/pdf') return <FileText size={20} color="#ff453a" />;
    if (type === 'Image' || mime.startsWith('image/')) return <ImageIcon size={20} color="#0a84ff" />;
    if (type === 'Sheet' || mime.includes('spreadsheet') || mime.includes('excel')) return <FileSpreadsheet size={20} color="#30d158" />;
    return <FileText size={20} color="#ff9f0a" />;
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem', minHeight: '85vh' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, margin: 0, letterSpacing: '-0.03em', fontFamily: 'var(--font-serif)' }}>
              Resources
            </h1>
            <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Academic & Placement Repository
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, maxWidth: '640px' }}>
            Official syllabus materials, semester notes, handwritten formulas, and senior placement interview playbooks.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setFolderForm({
                  name: '',
                  description: '',
                  visibility: 'private',
                  allowContributions: false,
                  parentId: currentFolderId || null
                });
                setIsFolderModalOpen(true);
              }}
              className="btn btn-secondary"
              style={{ borderRadius: '12px', padding: '0.65rem 1.1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Lock size={15} /> ＋ New Private Folder
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenUpload()}
            className="btn btn-primary"
            style={{ borderRadius: '12px', padding: '0.65rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
          >
            <UploadCloud size={16} /> Add Resource
          </button>
        </div>
      </div>

      {/* Top Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Resources', icon: Layers },
            { id: 'system', label: 'College / System', icon: Shield },
            ...(isAdmin ? [{ id: 'private', label: 'My Private Folders', icon: Lock }] : [])
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setFilterTab(tab.id);
                  if (currentFolderId) setCurrentFolderId(null);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  border: isActive ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                  backgroundColor: isActive ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? 'var(--accent-inverse, #000)' : 'var(--text-primary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            ref={searchInputRef}
            type="text"
            className="input-field"
            placeholder="Search files, notes, subjects and resources…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem', paddingRight: searchQuery ? '2.5rem' : '4rem', borderRadius: '12px', fontSize: '0.85rem', height: '40px', margin: 0, transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
          {!searchQuery && (
            <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', pointerEvents: 'none' }}>
              ⌘K
            </span>
          )}
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb Trail Navigation */}
      {currentFolderId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.75rem', flexWrap: 'wrap', backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => {
              if (currentFolder?.parentId) {
                setCurrentFolderId(currentFolder.parentId);
              } else {
                setCurrentFolderId(null);
              }
            }}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ArrowLeft size={14} /> Back
          </button>

          <span style={{ color: 'var(--border-color)', margin: '0 0.25rem' }}>|</span>

          <button
            type="button"
            onClick={() => setCurrentFolderId(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
          >
            Resources
          </button>

          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.id}>
                <ChevronRight size={14} color="var(--text-secondary)" />
                <button
                  type="button"
                  onClick={() => !isLast && setCurrentFolderId(crumb.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isLast ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: isLast ? 700 : 500,
                    fontSize: '0.85rem',
                    cursor: isLast ? 'default' : 'pointer',
                    textDecoration: isLast ? 'none' : 'hover'
                  }}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* SEARCH RESULTS VIEW */}
      {searchQuery.trim() !== '' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              Search Results ({searchResults.length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Matching "{searchQuery}"</span>
          </div>

          {searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', border: '1px dashed var(--border-color)', borderRadius: '16px' }}>
              <FileText size={40} color="var(--text-secondary)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>No study resources found matching "{searchQuery}".</p>
            </div>
          ) : (
            <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>File</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Folder</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Size</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Uploader</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map(res => (
                    <tr key={res.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {getFileIcon(res)}
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{res.title}</div>
                            {res.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{res.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {folders.find(f => f.id === res.folderId)?.name || res.folderId}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {res.fileSizeFormatted || formatBytes(res.size) || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {res.uploadedBy || 'Senior'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/preview/${res.id}${res.folderId ? `?folderId=${res.folderId}` : ''}`, {
                                state: {
                                  file: res,
                                  files: searchResults,
                                  folderName: 'Search Results'
                                }
                              });
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            title="Preview File"
                          >
                            <Eye size={13} /> Preview
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDownloadResource(res, e)}
                            disabled={downloadingId === res.id}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: downloadingId === res.id ? 'wait' : 'pointer' }}
                            title="Download File"
                          >
                            <Download size={13} /> {downloadingId === res.id ? '...' : 'Download'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ROOT LEVEL VIEW (Categorized Folders) */}
      {!currentFolderId && searchQuery.trim() === '' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* SECTION A: SYSTEM / COLLEGE RESOURCES */}
          {(filterTab === 'all' || filterTab === 'system') && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={18} color="var(--accent-color)" />
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                    System / College Resources
                  </h2>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Protected Official Academic Curricula
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.25rem' }}>
                {systemFolders.map(folder => (
                  <ResourceFolder3DCard
                    key={folder.id}
                    folder={folder}
                    resCount={getResourceCountForFolder(folder.id)}
                    isSystem={true}
                    onOpenFolder={setCurrentFolderId}
                    onEditFolder={setEditingFolder}
                    onDeleteFolder={setDeleteConfirm}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SECTION B: MY PRIVATE FOLDERS (Admin Only) */}
          {isAdmin && (filterTab === 'all' || filterTab === 'private') && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Lock size={18} color="#ff9f0a" />
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                    My Private Folders
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFolderForm({
                      name: '',
                      description: '',
                      visibility: 'private',
                      allowContributions: false,
                      parentId: null
                    });
                    setIsFolderModalOpen(true);
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Plus size={14} /> Create Private Folder
                </button>
              </div>

              {myPrivateFolders.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '16px', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
                  <Lock size={32} color="#ff9f0a" style={{ opacity: 0.6, marginBottom: '0.75rem' }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>No Private Folders Yet</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
                    Keep personal notes, resumes, and study materials visible only to you.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFolderForm({
                        name: '',
                        description: '',
                        visibility: 'private',
                        allowContributions: false,
                        parentId: null
                      });
                      setIsFolderModalOpen(true);
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', borderRadius: '8px' }}
                  >
                    Create Your First Private Folder
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.25rem' }}>
                  {myPrivateFolders.map(folder => (
                    <ResourceFolder3DCard
                      key={folder.id}
                      folder={folder}
                      resCount={getResourceCountForFolder(folder.id)}
                      isSystem={false}
                      onOpenFolder={setCurrentFolderId}
                      onEditFolder={setEditingFolder}
                      onDeleteFolder={setDeleteConfirm}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* INSIDE A FOLDER VIEW */}
      {currentFolderId && searchQuery.trim() === '' && currentFolder && (
        <div>
          {/* Active Folder Header Banner */}
          <div className="glass-panel" style={{ padding: '1.75rem 2rem', borderRadius: '18px', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Folder size={24} color="var(--accent-color)" />
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                  {currentFolder.name}
                </h2>
                <span className="badge" style={{
                  backgroundColor: currentFolder.visibility === 'private' ? 'rgba(255, 159, 10, 0.15)' : 'rgba(48, 209, 88, 0.15)',
                  color: currentFolder.visibility === 'private' ? '#ff9f0a' : '#30d158',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}>
                  {currentFolder.isSystemFolder ? 'SYSTEM' : currentFolder.visibility.toUpperCase()}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
                {currentFolder.description || 'Folder directory.'} 
                {currentFolder.ownerName && ` • Created by ${currentFolder.ownerName}`}
                {currentFolder.allowContributions && !currentFolder.isSystemFolder && ' • Community contributions enabled'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Add Subfolder Button (Admin Only) */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setFolderForm({
                      name: '',
                      description: '',
                      visibility: currentFolder.visibility,
                      allowContributions: currentFolder.allowContributions,
                      parentId: currentFolder.id
                    });
                    setIsFolderModalOpen(true);
                  }}
                  className="btn btn-secondary"
                  style={{ borderRadius: '10px', padding: '0.55rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Plus size={15} /> Add Subfolder
                </button>
              )}

              {/* Add Resource to this folder */}
              {(currentFolder.allowContributions || isOwnerOfFolder(currentFolder) || isAdmin) && (
                <button
                  type="button"
                  onClick={() => handleOpenUpload(currentFolder.id)}
                  className="btn btn-primary"
                  style={{ borderRadius: '10px', padding: '0.55rem 1.15rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                >
                  <UploadCloud size={16} /> Upload File
                </button>
              )}
            </div>
          </div>

          {/* SUBFOLDERS SECTION */}
          {currentSubfolders.length > 0 && (
            <div style={{ marginBottom: '2.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Subfolders ({currentSubfolders.length})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                {currentSubfolders.map(subf => (
                  <Subfolder3DCard
                    key={subf.id}
                    subf={subf}
                    resCount={getResourceCountForFolder(subf.id)}
                    onOpenFolder={setCurrentFolderId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* RESOURCES / FILES LIST SECTION */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Files in {currentFolder.name} ({currentFolderResources.length})
              </h3>
            </div>

            {currentFolderResources.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1.5rem', border: '1px dashed var(--border-color)', borderRadius: '16px', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
                <UploadCloud size={44} color="var(--text-secondary)" style={{ opacity: 0.5, marginBottom: '0.75rem' }} />
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>Folder is Empty</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
                  No materials or PDFs uploaded to this folder yet.
                </p>
                {(currentFolder.allowContributions || isOwnerOfFolder(currentFolder) || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => handleOpenUpload(currentFolder.id)}
                    className="btn btn-primary"
                    style={{ fontSize: '0.85rem', padding: '0.6rem 1.25rem', borderRadius: '10px' }}
                  >
                    Upload First Resource
                  </button>
                )}
              </div>
            ) : (
              <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
                    <tr>
                      <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600 }}>File Name</th>
                      <th style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Category</th>
                      <th style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Size</th>
                      <th style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Uploaded By</th>
                      <th style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentFolderResources.map(res => {
                      const canManage = isOwnerOfResource(res) || isAdmin;
                      return (
                        <tr 
                          key={res.id} 
                          style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s ease' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {getFileIcon(res)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                  {res.title}
                                </div>
                                {res.description && (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    {res.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                            <span className="badge" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', fontSize: '0.75rem' }}>
                              {res.category || 'General'}
                            </span>
                          </td>

                          <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {res.fileSizeFormatted || (res.size ? formatBytes(res.size) : '—')}
                          </td>

                          <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {res.uploadedBy || 'Senior'}
                          </td>

                          <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {res.date || res.createdAt?.split('T')[0] || '—'}
                          </td>

                          <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/preview/${res.id}?folderId=${res.folderId || currentFolderId || ''}`, {
                                    state: {
                                      file: res,
                                      files: currentFolderResources,
                                      folderName: currentFolder?.name || 'Folder'
                                    }
                                  });
                                }}
                                className="btn btn-secondary"
                                style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                title="Preview File"
                              >
                                <Eye size={14} /> Preview
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleDownloadResource(res, e)}
                                disabled={downloadingId === res.id}
                                className="btn btn-secondary"
                                style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: downloadingId === res.id ? 'wait' : 'pointer' }}
                                title="Download Original File"
                              >
                                <Download size={14} /> {downloadingId === res.id ? '...' : 'Download'}
                              </button>

                              {canManage && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingResource(res);
                                      setEditResourceForm({
                                        title: res.title || '',
                                        description: res.description || '',
                                        category: res.category || 'General',
                                        folderId: res.folderId || currentFolderId
                                      });
                                    }}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.4rem', borderRadius: '8px', color: 'var(--text-secondary)' }}
                                    title="Edit Metadata"
                                  >
                                    <Edit size={14} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirm({ type: 'file', item: res })}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.4rem', borderRadius: '8px', color: '#ff453a' }}
                                    title="Delete File"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 100MB STREAMING FILE UPLOAD MODAL */}
      {isUploadModalOpen && createPortal(
        <div 
          onClick={() => !isUploading && setIsUploadModalOpen(false)}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.75)', 
            backdropFilter: 'blur(12px)', 
            WebkitBackdropFilter: 'blur(12px)', 
            zIndex: 100000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '2.5rem 1rem',
            overflowY: 'auto',
            overscrollBehavior: 'contain'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass-panel custom-scrollbar" 
            style={{ 
              margin: 'auto',
              width: '100%', 
              maxWidth: '560px', 
              maxHeight: 'calc(100vh - 4rem)',
              overflowY: 'auto',
              borderRadius: '20px', 
              padding: '2rem', 
              border: '1px solid var(--border-color)', 
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)' 
            }}
          >
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UploadCloud size={20} color="var(--accent-color)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Add Resource</h3>
              </div>
              <button
                type="button"
                onClick={() => !isUploading && setIsUploadModalOpen(false)}
                disabled={isUploading}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: isUploading ? 'not-allowed' : 'pointer', padding: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Drag & Drop File Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const f = e.dataTransfer.files[0];
                    setUploadFile(f);
                    if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^/.]+$/, ''));
                  }
                }}
                style={{
                  border: uploadFile ? '2px solid var(--accent-color)' : '2px dashed var(--border-color)',
                  borderRadius: '14px',
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  backgroundColor: uploadFile ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                  transition: 'all 0.2s ease',
                  cursor: isUploading ? 'not-allowed' : 'pointer'
                }}
                onClick={() => {
                  if (!isUploading) document.getElementById('resource-file-input')?.click();
                }}
              >
                <input
                  id="resource-file-input"
                  type="file"
                  style={{ display: 'none' }}
                  disabled={isUploading}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const f = e.target.files[0];
                      setUploadFile(f);
                      if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                />

                {uploadFile ? (
                  <div>
                    <CheckCircle size={32} color="var(--accent-color)" style={{ marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{uploadFile.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Size: {formatBytes(uploadFile.size)}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', marginTop: '0.5rem', display: 'inline-block' }}>
                      Click to change file
                    </span>
                  </div>
                ) : (
                  <div>
                    <UploadCloud size={36} color="var(--text-secondary)" style={{ opacity: 0.6, marginBottom: '0.75rem' }} />
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      Drag & Drop File Here
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      or click to browse from device (Up to 200 MB)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      PDF • DOCX • PPTX • XLSX • ZIP • Images • Code
                    </div>
                  </div>
                )}
              </div>

              {/* Resource Name */}
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Resource Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. DSA Complete Placement Roadmap"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  disabled={isUploading}
                  required
                />
              </div>

              {/* Description */}
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Description (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Brief note or chapter summary"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  disabled={isUploading}
                />
              </div>

              {/* Target Folder & Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label className="input-label">Target Folder</label>
                  <select
                    className="input-field"
                    value={uploadFolderId}
                    onChange={(e) => setUploadFolderId(e.target.value)}
                    disabled={isUploading}
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  >
                    {folders
                      .filter(f => isAdmin || f.visibility !== 'private')
                      .map(f => (
                        <option key={f.id} value={f.id}>
                          {f.parentId ? `  ↳ ${f.name}` : f.name} {f.visibility === 'private' ? '🔒' : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="input-group" style={{ margin: 0 }}>
                  <label className="input-label">Category</label>
                  <select
                    className="input-field"
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    disabled={isUploading}
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  >
                    <option value="General">General</option>
                    <option value="Placement">Placement</option>
                    <option value="Coding">Coding</option>
                    <option value="Notes">Notes</option>
                    <option value="Interview">Interview</option>
                    <option value="Cheatsheet">Cheatsheet</option>
                  </select>
                </div>
              </div>

              {/* Upload Progress Bar & Stats */}
              {isUploading && uploadStats && (
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    <span>Uploading... {uploadStats.percent}%</span>
                    <span>{uploadStats.loadedFormatted} / {uploadStats.totalFormatted}</span>
                  </div>
                  
                  {/* Real progress track */}
                  <div style={{ height: '8px', width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                    <div style={{
                      height: '100%',
                      width: `${uploadStats.percent}%`,
                      backgroundColor: 'var(--accent-color)',
                      transition: 'width 0.2s linear',
                      borderRadius: '4px'
                    }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>Speed: {uploadStats.speedFormatted}</span>
                    <span>{uploadStats.remainingSecs !== null ? `~${uploadStats.remainingSecs} sec remaining` : 'Calculating...'}</span>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {uploadError && (
                <div style={{ backgroundColor: 'rgba(255, 69, 58, 0.1)', border: '1px solid rgba(255, 69, 58, 0.3)', color: '#ff453a', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}>
                  {uploadError}
                </div>
              )}

              {/* Success Notification */}
              {uploadSuccess && (
                <div style={{ backgroundColor: 'rgba(48, 209, 88, 0.1)', border: '1px solid rgba(48, 209, 88, 0.3)', color: '#30d158', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} />
                  <span>Upload completed successfully! Added to folder.</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                {isUploading ? (
                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="btn btn-secondary"
                    style={{ padding: '0.65rem 1.25rem', borderRadius: '10px', color: '#ff453a' }}
                  >
                    Cancel Upload
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsUploadModalOpen(false)}
                      className="btn btn-secondary"
                      style={{ padding: '0.65rem 1.25rem', borderRadius: '10px' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!uploadFile}
                      style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', fontWeight: 600 }}
                    >
                      Start Upload
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* CREATE FOLDER MODAL */}
      {isFolderModalOpen && createPortal(
        <div 
          onClick={() => setIsFolderModalOpen(false)}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.75)', 
            backdropFilter: 'blur(12px)', 
            WebkitBackdropFilter: 'blur(12px)', 
            zIndex: 100000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '2.5rem 1rem',
            overflowY: 'auto',
            overscrollBehavior: 'contain'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass-panel custom-scrollbar" 
            style={{ 
              margin: 'auto',
              width: '100%', 
              maxWidth: '480px', 
              maxHeight: 'calc(100vh - 4rem)',
              overflowY: 'auto',
              borderRadius: '20px', 
              padding: '2rem', 
              border: '1px solid var(--border-color)', 
              boxShadow: '0 30px 60px rgba(0,0,0,0.6)' 
            }}
          >
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Folder size={20} color="var(--accent-color)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Create New Folder</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Folder Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Dynamic Programming, Personal Notes"
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Description (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Brief purpose of this folder"
                  value={folderForm.description}
                  onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                />
              </div>

              {/* Visibility: All user/admin custom folders are Private */}
              <div style={{
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '0.9rem 1rem',
                backgroundColor: 'rgba(255, 159, 10, 0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem'
              }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 159, 10, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Lock size={19} color="#ff9f0a" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    Private Folder
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Personal study vault visible only to you and administrators
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '10px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', fontWeight: 600 }}
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* EDIT FOLDER MODAL */}
      {editingFolder && createPortal(
        <div 
          onClick={() => setEditingFolder(null)}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.75)', 
            backdropFilter: 'blur(12px)', 
            WebkitBackdropFilter: 'blur(12px)', 
            zIndex: 100000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '2.5rem 1rem',
            overflowY: 'auto',
            overscrollBehavior: 'contain'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass-panel custom-scrollbar" 
            style={{ 
              margin: 'auto',
              width: '100%', 
              maxWidth: '480px', 
              maxHeight: 'calc(100vh - 4rem)',
              overflowY: 'auto',
              borderRadius: '20px', 
              padding: '2rem', 
              border: '1px solid var(--border-color)',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)'
            }}
          >
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit size={18} color="var(--accent-color)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Edit Folder Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingFolder(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditFolder} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Folder Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={editingFolder.name}
                  onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })}
                  required
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Description</label>
                <input
                  type="text"
                  className="input-field"
                  value={editingFolder.description || ''}
                  onChange={(e) => setEditingFolder({ ...editingFolder, description: e.target.value })}
                />
              </div>

              {!editingFolder.isSystemFolder && (
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  backgroundColor: 'rgba(255, 159, 10, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  <Lock size={18} color="#ff9f0a" />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Private Folder</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Visible only to you and administrators</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingFolder(null)}
                  className="btn btn-secondary"
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '10px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', fontWeight: 600 }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* EDIT RESOURCE METADATA MODAL */}
      {editingResource && createPortal(
        <div 
          onClick={() => setEditingResource(null)}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.75)', 
            backdropFilter: 'blur(12px)', 
            WebkitBackdropFilter: 'blur(12px)', 
            zIndex: 100000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '2.5rem 1rem',
            overflowY: 'auto',
            overscrollBehavior: 'contain'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass-panel custom-scrollbar" 
            style={{ 
              margin: 'auto',
              width: '100%', 
              maxWidth: '480px', 
              maxHeight: 'calc(100vh - 4rem)',
              overflowY: 'auto',
              borderRadius: '20px', 
              padding: '2rem', 
              border: '1px solid var(--border-color)',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)'
            }}
          >
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit size={18} color="var(--accent-color)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Edit Resource Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingResource(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditResource} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Title</label>
                <input
                  type="text"
                  className="input-field"
                  value={editResourceForm.title}
                  onChange={(e) => setEditResourceForm({ ...editResourceForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Description</label>
                <input
                  type="text"
                  className="input-field"
                  value={editResourceForm.description}
                  onChange={(e) => setEditResourceForm({ ...editResourceForm, description: e.target.value })}
                />
              </div>

              {/* Move to another folder */}
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Move to Folder</label>
                <select
                  className="input-field"
                  value={editResourceForm.folderId}
                  onChange={(e) => setEditResourceForm({ ...editResourceForm, folderId: e.target.value })}
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.parentId ? `  ↳ ${f.name}` : f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingResource(null)}
                  className="btn btn-secondary"
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '10px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', fontWeight: 600 }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && createPortal(
        <div 
          onClick={() => setDeleteConfirm(null)}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.8)', 
            backdropFilter: 'blur(12px)', 
            WebkitBackdropFilter: 'blur(12px)', 
            zIndex: 100000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '2.5rem 1rem',
            overflowY: 'auto',
            overscrollBehavior: 'contain'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass-panel custom-scrollbar" 
            style={{ 
              margin: 'auto',
              width: '100%', 
              maxWidth: '440px', 
              maxHeight: 'calc(100vh - 4rem)',
              overflowY: 'auto',
              borderRadius: '20px', 
              padding: '2rem', 
              border: '1px solid rgba(255, 69, 58, 0.3)', 
              textAlign: 'center',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)'
            }}
          >
            <AlertCircle size={48} color="#ff453a" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
              Confirm Permanent Deletion
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.75rem', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete{' '}
              <strong style={{ color: 'var(--text-primary)' }}>"{deleteConfirm.item?.name || deleteConfirm.item?.title}"</strong>?
              {deleteConfirm.type === 'folder' && ' All files and subfolders inside it will also be permanently deleted from storage.'}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="btn btn-secondary"
                style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                style={{
                  padding: '0.65rem 1.5rem',
                  borderRadius: '10px',
                  flex: 1,
                  backgroundColor: '#ff453a',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}



    </div>
  );
}
