import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Check, X, ShieldAlert, Plus, Trash2, Users, Clock, Edit, FileText, 
  ChevronDown, ChevronUp, ChevronRight, Search, Folder, HardDrive, 
  ShieldCheck, ExternalLink, GitBranch, FolderPlus, Sparkles, AlertTriangle,
  Globe, Lock, FolderInput, Eye, Copy, History
} from 'lucide-react';
import { useCachedData } from '../hooks/useCachedData';
import {
  getPendingStories,
  approveStory,
  rejectPendingStory,
  getPendingResources,
  approveResource,
  rejectPendingResource,
  getStories,
  getStoryById,
  deleteStory,
  updateStory,
  getResources,
  deleteResource,
  updateResource,
  getAchievements,
  deleteAchievement,
  addAchievement,
  updateAchievement,
  getUsers,
  addUser,
  deleteUser,
  getFolders,
  addFolder,
  updateFolder,
  deleteFolder,
  fileToBase64,
  approveProfileEdit,
  rejectProfileEdit,
  approveRegistration,
  updateUser,
  getAdminResourceStats,
  formatBytes,
  getResourceFileUrl
} from '../utils/db';
import { playApproveSound, playRejectSound } from '../utils/sound';
import SystemHealthDashboard from '../components/SystemHealthDashboard';
import AdminFeedbackTab from '../components/AdminFeedbackTab';
import AdminAuditLogsTab from '../components/AdminAuditLogsTab';
import AdminUserAuditModal from '../components/AdminUserAuditModal';

const parsePosition = (posStr) => {
  if (!posStr) return { x: 50, y: 50, zoom: 1.0 };
  if (posStr === 'center') return { x: 50, y: 50, zoom: 1.0 };
  if (posStr === 'top') return { x: 50, y: 0, zoom: 1.0 };
  if (posStr === 'bottom') return { x: 50, y: 100, zoom: 1.0 };
  if (posStr === 'left') return { x: 0, y: 50, zoom: 1.0 };
  if (posStr === 'right') return { x: 100, y: 50, zoom: 1.0 };
  if (posStr.startsWith('crop:')) return { x: 50, y: 50, zoom: 1.0 };
  const parts = posStr.split(' ');
  const x = parseInt(parts[0]) || 50;
  const y = parseInt(parts[1]) || 50;
  const zoom = parseFloat(parts[2]) || 1.0;
  return { x, y, zoom };
};

const parseCrop = (posStr) => {
  const defaults = {
    outer: { x: 10, y: 0, w: 80, h: 33 },
    inner: { x: 10, y: 0, w: 80, h: 24 }
  };
  if (!posStr || !posStr.startsWith('crop:')) return defaults;
  try {
    const parts = posStr.replace('crop:', '').split(';');
    if (parts.length >= 2) {
      const outerParts = parts[0].split(',').map(Number);
      const innerParts = parts[1].split(',').map(Number);
      return {
        outer: { x: outerParts[0] ?? 10, y: outerParts[1] ?? 0, w: outerParts[2] ?? 80, h: outerParts[3] ?? 33 },
        inner: { x: innerParts[0] ?? 10, y: innerParts[1] ?? 0, w: innerParts[2] ?? 80, h: innerParts[3] ?? 24 }
      };
    }
  } catch (e) {
    console.error("Error parsing crop string:", e);
  }
  return defaults;
};

const getResourceLink = (res) => {
  if (!res) return null;
  const raw = res.url || res.link || (typeof res.name === 'string' ? res.name : '');
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^www\./i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  if (/^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return null;
};

const parseSliders = (posStr) => {
  const defaults = {
    outer: { x: 48, y: 0, zoom: 1.8 },
    inner: { x: 50, y: 50, zoom: 1.0 }
  };
  if (!posStr) return defaults;
  if (posStr.startsWith('sliders:')) {
    try {
      const parts = posStr.replace('sliders:', '').split(';');
      if (parts.length >= 2) {
        const outerParts = parts[0].split(',');
        const innerParts = parts[1].split(',');
        return {
          outer: {
            x: isNaN(parseInt(outerParts[0])) ? 48 : parseInt(outerParts[0]),
            y: isNaN(parseInt(outerParts[1])) ? 0 : parseInt(outerParts[1]),
            zoom: isNaN(parseFloat(outerParts[2])) ? 1.8 : parseFloat(outerParts[2])
          },
          inner: {
            x: isNaN(parseInt(innerParts[0])) ? 50 : parseInt(innerParts[0]),
            y: isNaN(parseInt(innerParts[1])) ? 50 : parseInt(innerParts[1]),
            zoom: isNaN(parseFloat(innerParts[2])) ? 1.0 : parseFloat(innerParts[2])
          }
        };
      }
    } catch (e) {
      console.error("Error parsing sliders string:", e);
    }
  }
  const p = parsePosition(posStr);
  return {
    outer: { ...p },
    inner: { ...p }
  };
};

import { useRef } from 'react';

const ImageCropper = ({ imageUrl, imagePosition, onChangePosition, activeTab }) => {
  const [lockAspect, setLockAspect] = useState(true);
  const containerRef = useRef(null);

  const crops = parseCrop(imagePosition);
  const currentCrop = activeTab === 'outer' ? crops.outer : crops.inner;

  const handleDragStart = (e, action) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const isTouch = e.type.startsWith('touch');
    const startX = isTouch ? e.touches[0].clientX : e.clientX;
    const startY = isTouch ? e.touches[0].clientY : e.clientY;

    const initialCrop = { ...currentCrop };
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerW = containerRect.width;
    const containerH = containerRect.height;
    const aspect = activeTab === 'outer' ? 2.42 : 3.33;

    const handleMove = (moveEvent) => {
      const currentX = isTouch ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = isTouch ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const deltaX = ((currentX - startX) / containerW) * 100;
      const deltaY = ((currentY - startY) / containerH) * 100;

      let newX = initialCrop.x;
      let newY = initialCrop.y;
      let newW = initialCrop.w;
      let newH = initialCrop.h;

      if (action === 'move') {
        newX = Math.max(0, Math.min(100 - initialCrop.w, initialCrop.x + deltaX));
        newY = Math.max(0, Math.min(100 - initialCrop.h, initialCrop.y + deltaY));
      } else if (action === 'br') {
        if (lockAspect) {
          newW = Math.max(10, Math.min(100 - initialCrop.x, initialCrop.w + deltaX));
          newH = (newW * containerW) / (containerH * aspect);
          if (newH > 100 - initialCrop.y) {
            newH = 100 - initialCrop.y;
            newW = (newH * containerH * aspect) / containerW;
          }
        } else {
          newW = Math.max(10, Math.min(100 - initialCrop.x, initialCrop.w + deltaX));
          newH = Math.max(10, Math.min(100 - initialCrop.y, initialCrop.h + deltaY));
        }
      } else if (action === 'bl') {
        if (lockAspect) {
          const maxDeltaX = initialCrop.x;
          const actualDeltaX = Math.max(-maxDeltaX, Math.min(initialCrop.w - 10, deltaX));
          newX = initialCrop.x + actualDeltaX;
          newW = initialCrop.w - actualDeltaX;
          newH = (newW * containerW) / (containerH * aspect);
          if (newH > 100 - initialCrop.y) {
            newH = 100 - initialCrop.y;
            newW = (newH * containerH * aspect) / containerW;
            newX = initialCrop.x + (initialCrop.w - newW);
          }
        } else {
          const maxDeltaX = initialCrop.x;
          const actualDeltaX = Math.max(-maxDeltaX, Math.min(initialCrop.w - 10, deltaX));
          newX = initialCrop.x + actualDeltaX;
          newW = initialCrop.w - actualDeltaX;
          newH = Math.max(10, Math.min(100 - initialCrop.y, initialCrop.h + deltaY));
        }
      } else if (action === 'tr') {
        if (lockAspect) {
          newW = Math.max(10, Math.min(100 - initialCrop.x, initialCrop.w + deltaX));
          newH = (newW * containerW) / (containerH * aspect);
          if (newH > initialCrop.h + initialCrop.y) {
            newH = initialCrop.h + initialCrop.y;
            newW = (newH * containerH * aspect) / containerW;
          }
          newY = initialCrop.y + (initialCrop.h - newH);
        } else {
          const maxDeltaY = initialCrop.y;
          const actualDeltaY = Math.max(-maxDeltaY, Math.min(initialCrop.h - 10, deltaY));
          newY = initialCrop.y + actualDeltaY;
          newH = initialCrop.h - actualDeltaY;
          newW = Math.max(10, Math.min(100 - initialCrop.x, initialCrop.w + deltaX));
        }
      } else if (action === 'tl') {
        if (lockAspect) {
          const maxDeltaX = initialCrop.x;
          const actualDeltaX = Math.max(-maxDeltaX, Math.min(initialCrop.w - 10, deltaX));
          newX = initialCrop.x + actualDeltaX;
          newW = initialCrop.w - actualDeltaX;
          newH = (newW * containerW) / (containerH * aspect);
          if (newH > initialCrop.h + initialCrop.y) {
            newH = initialCrop.h + initialCrop.y;
            newW = (newH * containerH * aspect) / containerW;
            newX = initialCrop.x + (initialCrop.w - newW);
          }
          newY = initialCrop.y + (initialCrop.h - newH);
        } else {
          const maxDeltaX = initialCrop.x;
          const actualDeltaX = Math.max(-maxDeltaX, Math.min(initialCrop.w - 10, deltaX));
          const maxDeltaY = initialCrop.y;
          const actualDeltaY = Math.max(-maxDeltaY, Math.min(initialCrop.h - 10, deltaY));
          newX = initialCrop.x + actualDeltaX;
          newW = initialCrop.w - actualDeltaX;
          newY = initialCrop.y + actualDeltaY;
          newH = initialCrop.h - actualDeltaY;
        }
      }

      const rounded = {
        x: Math.max(0, Math.min(100, Math.round(newX))),
        y: Math.max(0, Math.min(100, Math.round(newY))),
        w: Math.max(5, Math.min(100, Math.round(newW))),
        h: Math.max(5, Math.min(100, Math.round(newH)))
      };

      const updatedCrops = {
        ...crops,
        [activeTab]: rounded
      };
      
      const val = `crop:${updatedCrops.outer.x},${updatedCrops.outer.y},${updatedCrops.outer.w},${updatedCrops.outer.h};${updatedCrops.inner.x},${updatedCrops.inner.y},${updatedCrops.inner.w},${updatedCrops.inner.h}`;
      onChangePosition(val);
    };

    const handleEnd = () => {
      document.removeEventListener(isTouch ? 'touchmove' : 'mousemove', handleMove);
      document.removeEventListener(isTouch ? 'touchend' : 'mouseup', handleEnd);
    };

    document.addEventListener(isTouch ? 'touchmove' : 'mousemove', handleMove);
    document.addEventListener(isTouch ? 'touchend' : 'mouseup', handleEnd);
  };

  const handlePreset = (preset) => {
    let updated;
    if (preset === 'center') {
      updated = {
        ...crops,
        [activeTab]: activeTab === 'outer' ? { x: 10, y: 24, w: 80, h: 33 } : { x: 10, y: 28, w: 80, h: 24 }
      };
    } else {
      updated = {
        ...crops,
        [activeTab]: { x: 0, y: 0, w: 100, h: 100 }
      };
    }
    const val = `crop:${updated.outer.x},${updated.outer.y},${updated.outer.w},${updated.outer.h};${updated.inner.x},${updated.inner.y},${updated.inner.w},${updated.inner.h}`;
    onChangePosition(val);
  };

  return (
    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Adjusting: {activeTab === 'outer' ? 'Outer Card (Listing)' : 'Inner View (Details)'}
        </div>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={lockAspect}
            onChange={(e) => setLockAspect(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Lock Aspect Ratio ({activeTab === 'outer' ? '2.42:1' : '3.33:1'})
        </label>
      </div>

      <div 
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          backgroundColor: '#111111',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          userSelect: 'none',
          touchAction: 'none'
        }}
      >
        <img
          src={imageUrl}
          alt="Cropper Source"
          style={{
            width: '100%',
            display: 'block',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
        />

        <div
          onMouseDown={(e) => handleDragStart(e, 'move')}
          onTouchStart={(e) => handleDragStart(e, 'move')}
          style={{
            position: 'absolute',
            left: `${currentCrop.x}%`,
            top: `${currentCrop.y}%`,
            width: `${currentCrop.w}%`,
            height: `${currentCrop.h}%`,
            border: '2px dashed #00e5ff',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
            cursor: 'move',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '33.3%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.25)' }} />
            <div style={{ position: 'absolute', top: '66.6%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.25)' }} />
            <div style={{ position: 'absolute', left: '33.3%', top: 0, bottom: 0, borderLeft: '1px dashed rgba(255,255,255,0.25)' }} />
            <div style={{ position: 'absolute', left: '66.6%', top: 0, bottom: 0, borderLeft: '1px dashed rgba(255,255,255,0.25)' }} />
          </div>

          <div style={{
            position: 'absolute',
            top: '4px',
            left: '4px',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: '#fff',
            fontSize: '0.65rem',
            padding: '2px 4px',
            borderRadius: '4px',
            pointerEvents: 'none',
            fontWeight: 600
          }}>
            {activeTab === 'outer' ? 'Outer Listing' : 'Inner Details'}: {currentCrop.w}%×{currentCrop.h}%
          </div>

          <div
            onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e, 'tl'); }}
            onTouchStart={(e) => { e.stopPropagation(); handleDragStart(e, 'tl'); }}
            style={{
              position: 'absolute',
              width: '12px',
              height: '12px',
              backgroundColor: '#ffffff',
              border: '2px solid #00e5ff',
              borderRadius: '50%',
              top: '-6px',
              left: '-6px',
              cursor: 'nwse-resize',
              zIndex: 10
            }}
          />
          <div
            onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e, 'tr'); }}
            onTouchStart={(e) => { e.stopPropagation(); handleDragStart(e, 'tr'); }}
            style={{
              position: 'absolute',
              width: '12px',
              height: '12px',
              backgroundColor: '#ffffff',
              border: '2px solid #00e5ff',
              borderRadius: '50%',
              top: '-6px',
              right: '-6px',
              cursor: 'nesw-resize',
              zIndex: 10
            }}
          />
          <div
            onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e, 'bl'); }}
            onTouchStart={(e) => { e.stopPropagation(); handleDragStart(e, 'bl'); }}
            style={{
              position: 'absolute',
              width: '12px',
              height: '12px',
              backgroundColor: '#ffffff',
              border: '2px solid #00e5ff',
              borderRadius: '50%',
              bottom: '-6px',
              left: '-6px',
              cursor: 'nesw-resize',
              zIndex: 10
            }}
          />
          <div
            onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e, 'br'); }}
            onTouchStart={(e) => { e.stopPropagation(); handleDragStart(e, 'br'); }}
            style={{
              position: 'absolute',
              width: '12px',
              height: '12px',
              backgroundColor: '#ffffff',
              border: '2px solid #00e5ff',
              borderRadius: '50%',
              bottom: '-6px',
              right: '-6px',
              cursor: 'nwse-resize',
              zIndex: 10
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
        <button
          type="button"
          className="btn"
          style={{
            padding: '0.35rem 0.7rem',
            fontSize: '0.75rem',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer'
          }}
          onClick={() => handlePreset('center')}
        >
          Center Preset
        </button>
        <button
          type="button"
          className="btn"
          style={{
            padding: '0.35rem 0.7rem',
            fontSize: '0.75rem',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer'
          }}
          onClick={() => handlePreset('full')}
        >
          Use Full Image
        </button>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const resolveUrl = (url) => {
    if (typeof url === 'string' && url.startsWith('/uploads/')) {
      const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
        ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
        : 'https://loop-qnh9.onrender.com';
      return baseUrl + url;
    }
    return url;
  };
  const navigate = useNavigate();
  const [isAdmin] = useState(() => {
    const userSession = localStorage.getItem('loop_current_user');
    if (userSession) {
      const parsed = JSON.parse(userSession);
      return !!parsed.isAdmin;
    }
    return false;
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'approvals';
  const setActiveTab = (tab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  useEffect(() => {
    const tabName = activeTab === 'health' ? 'System Health' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
    document.title = `LOOP | Admin - ${tabName}`;
  }, [activeTab]);

  const [createTab, setCreateTab] = useState('outer');
  const [editTab, setEditTab] = useState('outer');
  
  // Expand/collapse and search states for admin active content management
  const [storiesExpanded, setStoriesExpanded] = useState(true);
  const [resourcesExpanded, setResourcesExpanded] = useState(true);
  const [achievementsExpanded, setAchievementsExpanded] = useState(true);
  const [storiesSearch, setStoriesSearch] = useState('');
  const [resourcesSearch, setResourcesSearch] = useState('');
  const [achievementsSearch, setAchievementsSearch] = useState('');
  
  // Db data states (Adopt SWR caching)
  const { data: cachedPendingStories, mutate: mutatePendingStories } = useCachedData('pendingStories', getPendingStories);
  const { data: cachedPendingResources, mutate: mutatePendingResources } = useCachedData('pendingResources', getPendingResources);
  const { data: cachedActiveStories, mutate: mutateActiveStories } = useCachedData('stories', getStories);
  const { data: cachedActiveResources, mutate: mutateActiveResources } = useCachedData('resources', getResources);
  const { data: cachedActiveAchievements, mutate: mutateActiveAchievements } = useCachedData('achievements', getAchievements);
  const { data: cachedUsersList, mutate: mutateUsersList } = useCachedData('users', getUsers);
  const { data: cachedFolders, mutate: mutateFolders } = useCachedData('folders', getFolders);
  const { data: cachedResourceStats, mutate: mutateResourceStats } = useCachedData('adminResourceStats', getAdminResourceStats);

  const pendingStories = cachedPendingStories || [];
  const pendingResources = cachedPendingResources || [];
  const activeStories = cachedActiveStories || [];
  const activeResources = cachedActiveResources || [];
  const activeAchievements = cachedActiveAchievements || [];
  const usersList = cachedUsersList || [];
  const folders = cachedFolders || [];
  const resourceStats = cachedResourceStats || null;

  const loading = !cachedPendingStories || !cachedPendingResources || !cachedActiveStories || !cachedActiveResources || !cachedActiveAchievements || !cachedUsersList || !cachedFolders;
  const [usersSearch, setUsersSearch] = useState('');
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    password: '',
    role: 'Student',
    branch: 'CSE',
    currentYear: 'First Year',
    status: 'Active',
    onboarded: false
  });

  const getFolderName = (folderId) => {
    if (!folderId) return '';
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return folderId;
    
    const path = [folder.name];
    let parentId = folder.parentId;
    while (parentId) {
      const parent = folders.find(f => f.id === parentId);
      if (parent) {
        path.unshift(parent.name);
        parentId = parent.parentId;
      } else {
        break;
      }
    }
    return path.join(' > ');
  };

  // Folder Editing State
  const [editingFolderItem, setEditingFolderItem] = useState(null);
  const [folderRenameInput, setFolderRenameInput] = useState('');
  const [folderVisibilityInput, setFolderVisibilityInput] = useState('public');
  const [folderDescriptionInput, setFolderDescriptionInput] = useState('');

  // Moving Resource File between Folders
  const [movingResourceItem, setMovingResourceItem] = useState(null);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState('');

  const handleStartMoveResource = (resource) => {
    setMovingResourceItem(resource);
    setTargetMoveFolderId(resource.folderId || 'system-placement-material');
  };

  const handleSaveMoveResource = async (e) => {
    e.preventDefault();
    if (!movingResourceItem || !targetMoveFolderId) return;
    try {
      await updateResource(movingResourceItem.id, {
        folderId: targetMoveFolderId
      });
      setMovingResourceItem(null);
      await refreshData();
    } catch (err) {
      alert(err.message || 'Failed to move resource file');
    }
  };

  const handleStartEditFolder = (folder) => {
    setEditingFolderItem(folder);
    setFolderRenameInput(folder.name || '');
    setFolderVisibilityInput(folder.visibility || 'public');
    setFolderDescriptionInput(folder.description || '');
  };

  const handleSaveEditFolder = async (e) => {
    e.preventDefault();
    if (!editingFolderItem || !folderRenameInput.trim()) return;
    try {
      await updateFolder(editingFolderItem.id, {
        name: folderRenameInput.trim(),
        visibility: folderVisibilityInput,
        description: folderDescriptionInput.trim()
      });
      setEditingFolderItem(null);
      await refreshData();
    } catch (err) {
      alert(err.message || 'Failed to update folder');
    }
  };

  const handleDeleteFolder = async (folder) => {
    const folderObj = typeof folder === 'string' ? folders.find(f => f.id === folder) : folder;
    const folderName = folderObj?.name || 'this folder';
    const isSys = folderObj && (folderObj.isSystemFolder || folderObj.folderType === 'system');

    const confirmMsg = isSys
      ? `CAUTION: "${folderName}" is an academic system folder. As an Administrator, deleting this will remove it, all its nested subfolders, and unlink its resources. Do you want to proceed?`
      : `Are you sure you want to delete folder "${folderName}"? All nested subfolders and resources inside this folder will be unassigned or removed.`;

    if (window.confirm(confirmMsg)) {
      try {
        await deleteFolder(folderObj?.id || folder);
        await refreshData();
      } catch (err) {
        alert(err.message || 'Failed to delete folder');
      }
    }
  };

  // Diagrammatic Folder Tree States
  const [folderSearchQuery, setFolderSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(() => new Set(['system-placement-material', 'system-cse-ce', 'system-extc']));
  const [parentFolderSelection, setParentFolderSelection] = useState('none');

  const toggleFolderNode = (id) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAllFolders = () => {
    setExpandedNodes(new Set(folders.map(f => f.id)));
  };

  const collapseAllFolders = () => {
    setExpandedNodes(new Set());
  };

  // Build hierarchical folder tree
  const folderTree = useMemo(() => {
    const map = new Map();
    folders.forEach(f => map.set(f.id, { ...f, children: [] }));
    const roots = [];
    folders.forEach(f => {
      const node = map.get(f.id);
      if (f.parentId && map.has(f.parentId)) {
        map.get(f.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }, [folders]);

  const [previewingPendingStory, setPreviewingPendingStory] = useState(null);
  const [previewingPendingResource, setPreviewingPendingResource] = useState(null);

  // New User form state
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('Student');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [copiedDefaultPassword, setCopiedDefaultPassword] = useState(false);
  const [auditModalUser, setAuditModalUser] = useState(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  
  // Add Achievement form state
  const [achievementForm, setAchievementForm] = useState({
    title: '',
    category: 'Hackathon Winners',
    description: '',
    date: new Date().toISOString().split('T')[0],
    image: '',
    imageFit: 'cover',
    imagePosition: 'center'
  });

  const [formSuccess, setFormSuccess] = useState(false);

  // Editing modal states
  const [editingItem, setEditingItem] = useState(null);
  const [editingType, setEditingType] = useState(''); // 'story' or 'achievement'

  const [editStoryForm, setEditStoryForm] = useState({
    name: '',
    company: '',
    role: '',
    branch: 'CSE',
    passoutYear: '',
    semester: '',
    cgpa: '',
    journey: {
      firstYear: '',
      secondYear: '',
      thirdYear: '',
      fourthYear: '',
      prep: ''
    },
    studyMaterials: [],
    resume: ''
  });

  const [editAchievementForm, setEditAchievementForm] = useState({
    title: '',
    category: 'Hackathon Winners',
    description: '',
    date: '',
    image: '',
    imageFit: 'cover',
    imagePosition: 'center'
  });

  const [editMaterialInput, setEditMaterialInput] = useState({
    title: '',
    type: 'PDF',
    fileName: '',
    fileSize: '',
    previewUrl: ''
  });

  const processMaterialFile = (file) => {
    const extension = file.name.split('.').pop().toLowerCase();
    let determinedType = 'Notes';
    if (extension === 'pdf') {
      determinedType = 'PDF';
    } else if (['png', 'jpg', 'jpeg'].includes(extension)) {
      determinedType = 'Image';
    } else if (file.name.toLowerCase().includes('roadmap')) {
      determinedType = 'Roadmap';
    }
    
    fileToBase64(file).then(base64Url => {
      setEditMaterialInput({
        title: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
        type: determinedType,
        fileName: file.name,
        fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        previewUrl: base64Url
      });
    }).catch(err => {
      console.error("Error reading file:", err);
      alert("Failed to read file.");
    });
  };

  const handleEditFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processMaterialFile(file);
  };

  const processResumeFile = (file) => {
    fileToBase64(file).then(base64Url => {
      setEditStoryForm(prev => ({
        ...prev,
        resume: {
          fileName: file.name,
          fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
          url: base64Url
        }
      }));
    }).catch(err => {
      console.error("Error reading file:", err);
      alert("Failed to read file.");
    });
  };

  const processAchievementImage = (file) => {
    fileToBase64(file).then(base64Url => {
      setFormSuccess(false);
      setAchievementForm(prev => ({
        ...prev,
        image: base64Url
      }));
    }).catch(err => {
      console.error("Error reading file:", err);
      alert("Failed to read file.");
    });
  };

  const processEditAchievementImage = (file) => {
    fileToBase64(file).then(base64Url => {
      setEditAchievementForm(prev => ({
        ...prev,
        image: base64Url
      }));
    }).catch(err => {
      console.error("Error reading file:", err);
      alert("Failed to read file.");
    });
  };
  const [editResourceForm, setEditResourceForm] = useState({
    title: '',
    category: 'Coding',
    type: 'PDF',
    folderId: 'sem-1',
    link: ''
  });

  const refreshData = async () => {
    try {
      const [pStories, pResources, aStories, aResources, aAchievements, uList, savedFolders, rStats] = await Promise.all([
        getPendingStories(),
        getPendingResources(),
        getStories(),
        getResources(),
        getAchievements(),
        getUsers(),
        getFolders(),
        getAdminResourceStats().catch(() => null)
      ]);
      
      mutatePendingStories(pStories, false);
      mutatePendingResources(pResources, false);
      mutateActiveStories(aStories, false);
      mutateActiveResources(aResources, false);
      mutateActiveAchievements(aAchievements, false);
      mutateUsersList(uList, false);
      mutateFolders(savedFolders, false);
      if (rStats) mutateResourceStats(rStats, false);
    } catch (err) {
      console.error("Error refreshing data:", err);
    }
  };

  useEffect(() => {
    // Background fetch to sync on mount
    refreshData();
  }, []);

  // Handle Escape key to close any active modal & isolate background scrolling
  useEffect(() => {
    const isAnyModalOpen = !!(editingItem || previewingPendingStory || previewingPendingResource);
    if (isAnyModalOpen) {
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      const handleKeyDown = (e) => {
        if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
          e.preventDefault();
          e.stopPropagation();
          setEditingItem(null);
          setPreviewingPendingStory(null);
          setPreviewingPendingResource(null);
        }
      };

      window.addEventListener('keydown', handleKeyDown, true);

      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
        window.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, [editingItem, previewingPendingStory, previewingPendingResource]);

  const handleApproveStory = async (id) => {
    playApproveSound();
    const previousPending = [...pendingStories];
    const previousActive = [...activeStories];
    const approvedStory = pendingStories.find(s => String(s.id) === String(id) || String(s._id) === String(id));
    
    mutatePendingStories(pendingStories.filter(s => String(s.id) !== String(id) && String(s._id) !== String(id)), false);
    if (approvedStory) {
      mutateActiveStories([...activeStories, { ...approvedStory, status: 'approved' }], false);
    }
    
    try {
      await approveStory(id);
      refreshData();
    } catch (e) {
      alert("Failed to approve story: " + e.message);
      mutatePendingStories(previousPending, false);
      mutateActiveStories(previousActive, false);
    }
  };

  const handleRejectStory = async (id) => {
    playRejectSound();
    const previousPending = [...pendingStories];
    mutatePendingStories(pendingStories.filter(s => String(s.id) !== String(id) && String(s._id) !== String(id)), false);
    try {
      await rejectPendingStory(id);
      refreshData();
    } catch (e) {
      alert("Failed to reject story: " + e.message);
      mutatePendingStories(previousPending, false);
    }
  };

  const handleApproveResource = async (id) => {
    playApproveSound();
    const previousPending = [...pendingResources];
    const previousActive = [...activeResources];
    const approvedResource = pendingResources.find(r => String(r.id) === String(id) || String(r._id) === String(id));
    
    mutatePendingResources(pendingResources.filter(r => String(r.id) !== String(id) && String(r._id) !== String(id)), false);
    if (approvedResource) {
      mutateActiveResources([...activeResources, { ...approvedResource, status: 'approved' }], false);
    }
    
    try {
      await approveResource(id);
      refreshData();
    } catch (e) {
      alert("Failed to approve resource: " + e.message);
      mutatePendingResources(previousPending, false);
      mutateActiveResources(previousActive, false);
    }
  };

  const handleRejectResource = async (id) => {
    playRejectSound();
    const previousPending = [...pendingResources];
    mutatePendingResources(pendingResources.filter(r => String(r.id) !== String(id) && String(r._id) !== String(id)), false);
    try {
      await rejectPendingResource(id);
      refreshData();
    } catch (e) {
      alert("Failed to reject resource: " + e.message);
      mutatePendingResources(previousPending, false);
    }
  };

  const handleDeleteStory = async (id) => {
    if (window.confirm('Are you sure you want to remove this story?')) {
      const previousActive = [...activeStories];
      mutateActiveStories(activeStories.filter(s => s.id !== id), false);
      try {
        await deleteStory(id);
        refreshData();
      } catch (e) {
        alert("Failed to delete story: " + e.message);
        mutateActiveStories(previousActive, false);
      }
    }
  };

  const handleDeleteResource = async (id) => {
    if (window.confirm('Are you sure you want to remove this resource?')) {
      const previousActive = [...activeResources];
      mutateActiveResources(activeResources.filter(r => r.id !== id), false);
      try {
        await deleteResource(id);
        refreshData();
      } catch (e) {
        alert("Failed to delete resource: " + e.message);
        mutateActiveResources(previousActive, false);
      }
    }
  };

  const handleDeleteAchievement = async (id) => {
    if (window.confirm('Are you sure you want to remove this achievement?')) {
      const previousActive = [...activeAchievements];
      mutateActiveAchievements(activeAchievements.filter(a => a.id !== id), false);
      try {
        await deleteAchievement(id);
        refreshData();
      } catch (e) {
        alert("Failed to delete achievement: " + e.message);
        mutateActiveAchievements(previousActive, false);
      }
    }
  };

  const handleCreateAchievement = async (e) => {
    e.preventDefault();
    if (!achievementForm.title || !achievementForm.description) {
      alert('Please fill out required fields');
      return;
    }

    const imgUrl = achievementForm.image.trim() || '/images/placement-record.jpg';

    await addAchievement({
      ...achievementForm,
      image: imgUrl
    });

    setFormSuccess(true);
    await refreshData();

    setTimeout(() => {
      setFormSuccess(false);
      setAchievementForm({
        title: '',
        category: 'Hackathon Winners',
        description: '',
        date: new Date().toISOString().split('T')[0],
        image: '',
        imageFit: 'cover',
        imagePosition: 'center'
      });
    }, 1500);
  };

  // User management handlers
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUserEmail.trim()) return;
    try {
      await addUser({ 
        email: newUserEmail.trim(), 
        role: newUserRole,
        password: newUserPassword.trim() || 'spit123'
      });
      setNewUserEmail('');
      setNewUserPassword('');
      await refreshData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveUser = async (email) => {
    if (window.confirm(`Are you sure you want to remove user "${email}"?`)) {
      await deleteUser(email);
      await refreshData();
    }
  };

  const handleApproveProfileEdit = async (email) => {
    playApproveSound();
    try {
      await approveProfileEdit(email);
      await refreshData();
    } catch (err) {
      alert(err.message || 'Failed to approve profile edit');
    }
  };

  const handleRejectProfileEdit = async (email) => {
    playRejectSound();
    try {
      await rejectProfileEdit(email);
      await refreshData();
    } catch (err) {
      alert(err.message || 'Failed to reject profile edit');
    }
  };

  const handleApproveRegistration = async (email) => {
    playApproveSound();
    try {
      await approveRegistration(email);
      await refreshData();
    } catch (err) {
      alert(err.message || 'Failed to approve registration');
    }
  };

  const handleRejectRegistration = async (email) => {
    if (window.confirm(`Are you sure you want to reject and remove access request for "${email}"?`)) {
      playRejectSound();
      try {
        await deleteUser(email);
        await refreshData();
      } catch (err) {
        alert(err.message || 'Failed to reject registration');
      }
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      await updateUser(editingItem.email, editUserForm);
      setEditingItem(null);
      await refreshData();
    } catch (err) {
      alert(err.message || 'Failed to update user');
    }
  };

  const startEditUser = (u) => {
    setEditingType('user');
    setEditingItem(u);
    setEditUserForm({
      name: u.name || '',
      password: '', // default to blank, keep original password on backend if empty
      role: u.role || 'Student',
      branch: u.branch || 'CSE',
      currentYear: u.currentYear || 'First Year',
      status: u.status || 'Active',
      onboarded: !!u.onboarded
    });
  };

  // Editing helpers
  const startEditStory = async (item) => {
    setEditingType('story');
    setEditingItem(item);
    setEditStoryForm({
      name: item.name || '',
      company: item.company || '',
      role: item.role || '',
      branch: item.branch || 'CSE',
      subBranch: item.subBranch || 'CSE',
      passoutYear: item.passoutYear || '',
      semester: item.semester || '',
      cgpa: item.cgpa || '',
      journey: {
        firstYear: item.journey?.firstYear || '',
        secondYear: item.journey?.secondYear || '',
        thirdYear: item.journey?.thirdYear || '',
        fourthYear: item.journey?.fourthYear || '',
        prep: item.journey?.prep || '',
        projects: item.journey?.projects || '',
        howSecured: item.journey?.howSecured || ''
      },
      resources: item.resources || [],
      resume: item.resume || '',
      resumeFile: item.resumeFile || { fileName: '', fileSize: '', url: '' },
      studyMaterials: item.studyMaterials || [],
      customSections: item.customSections || []
    });

    // Background fetch to load full details (including journey, resume, and study materials)
    try {
      const fullDetails = await getStoryById(item.id);
      if (fullDetails) {
        setEditingItem(fullDetails);
        setEditStoryForm({
          name: fullDetails.name || '',
          company: fullDetails.company || '',
          role: fullDetails.role || '',
          branch: fullDetails.branch || 'CSE',
          subBranch: fullDetails.subBranch || 'CSE',
          passoutYear: fullDetails.passoutYear || '',
          semester: fullDetails.semester || '',
          cgpa: fullDetails.cgpa || '',
          journey: {
            firstYear: fullDetails.journey?.firstYear || '',
            secondYear: fullDetails.journey?.secondYear || '',
            thirdYear: fullDetails.journey?.thirdYear || '',
            fourthYear: fullDetails.journey?.fourthYear || '',
            prep: fullDetails.journey?.prep || '',
            projects: fullDetails.journey?.projects || '',
            howSecured: fullDetails.journey?.howSecured || ''
          },
          resources: fullDetails.resources || [],
          resume: fullDetails.resume || '',
          resumeFile: fullDetails.resumeFile || { fileName: '', fileSize: '', url: '' },
          studyMaterials: fullDetails.studyMaterials || [],
          customSections: fullDetails.customSections || []
        });
      }
    } catch (err) {
      console.error("Error fetching full story details:", err);
    }
  };

  const startEditAchievement = (item) => {
    setEditingType('achievement');
    setEditingItem(item);
    setEditAchievementForm({
      title: item.title || '',
      category: item.category || 'Hackathon Winners',
      description: item.description || '',
      date: item.date || '',
      image: item.image || '',
      imageFit: item.imageFit || 'cover',
      imagePosition: item.imagePosition || 'center'
    });
  };

  const handleSaveStory = async (e) => {
    e.preventDefault();
    
    // Format the payload correctly for backend Mongoose schemas
    const payload = { ...editStoryForm };
    if (payload.resume && typeof payload.resume === 'object') {
      payload.resumeFile = payload.resume;
      payload.resume = payload.resume.fileName;
    } else {
      payload.resumeFile = null;
    }

    await updateStory(editingItem.id, payload);
    setEditingItem(null);
    if (editMaterialInput.previewUrl && editMaterialInput.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editMaterialInput.previewUrl);
    }
    setEditMaterialInput({ title: '', type: 'PDF', fileName: '', fileSize: '', previewUrl: '' });
    await refreshData();
  };


  const handleSaveAchievement = async (e) => {
    e.preventDefault();
    await updateAchievement(editingItem.id, editAchievementForm);
    setEditingItem(null);
    await refreshData();
  };

  const startEditResource = (res) => {
    setEditingType('resource');
    setEditingItem(res);
    setEditResourceForm({
      title: res.title || '',
      category: res.category || 'Coding',
      type: res.type || 'PDF',
      folderId: res.folderId || 'sem-1',
      link: res.link || ''
    });
  };

  const handleSaveResource = async (e) => {
    e.preventDefault();
    await updateResource(editingItem.id, editResourceForm);
    setEditingItem(null);
    await refreshData();
  };

  if (!isAdmin) {
    return (
      <div className="container" style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div className="glass-panel" style={{
          maxWidth: '450px',
          width: '100%',
          padding: '3rem 2rem',
          borderRadius: '24px',
          textAlign: 'center',
          border: '1px solid var(--border-color)'
        }}>
          <ShieldAlert size={60} style={{ color: '#ff453a', marginBottom: '1.5rem' }} />
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.75rem' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
            You do not have administrator permissions to view this dashboard. Please sign in with an official admin account.
          </p>
          <button onClick={() => navigate('/login')} className="btn btn-primary" style={{ width: '100%' }}>
            Sign in as Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container animate-fade-in" style={{ paddingTop: '6.5rem', paddingBottom: '5rem' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '3.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>Administrator Controls</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Moderate stories, resources, resumes, publish news, and oversee platform activity.
        </p>
      </div>

      {/* Dashboard Nav Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('approvals')}
          className="btn"
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            borderRadius: '10px',
            backgroundColor: activeTab === 'approvals' ? 'var(--text-primary)' : 'transparent',
            color: activeTab === 'approvals' ? 'var(--accent-inverse)' : 'var(--text-secondary)',
            border: activeTab === 'approvals' ? '1px solid var(--text-primary)' : '1px solid transparent'
          }}
        >
          Approvals ({pendingStories.length + pendingResources.length})
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className="btn"
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            borderRadius: '10px',
            backgroundColor: activeTab === 'active' ? 'var(--text-primary)' : 'transparent',
            color: activeTab === 'active' ? 'var(--accent-inverse)' : 'var(--text-secondary)',
            border: activeTab === 'active' ? '1px solid var(--text-primary)' : '1px solid transparent'
          }}
        >
          Manage Content
        </button>
        <button
          onClick={() => setActiveTab('news')}
          className="btn"
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            borderRadius: '10px',
            backgroundColor: activeTab === 'news' ? 'var(--text-primary)' : 'transparent',
            color: activeTab === 'news' ? 'var(--accent-inverse)' : 'var(--text-secondary)',
            border: activeTab === 'news' ? '1px solid var(--text-primary)' : '1px solid transparent'
          }}
        >
          Add News/Achievement
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className="btn"
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            borderRadius: '10px',
            backgroundColor: activeTab === 'users' ? 'var(--text-primary)' : 'transparent',
            color: activeTab === 'users' ? 'var(--accent-inverse)' : 'var(--text-secondary)',
            border: activeTab === 'users' ? '1px solid var(--text-primary)' : '1px solid transparent'
          }}
        >
          Users ({usersList.length})
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className="btn"
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            borderRadius: '10px',
            backgroundColor: activeTab === 'health' ? 'var(--text-primary)' : 'transparent',
            color: activeTab === 'health' ? 'var(--accent-inverse)' : 'var(--text-secondary)',
            border: activeTab === 'health' ? '1px solid var(--text-primary)' : '1px solid transparent'
          }}
        >
          System Health
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className="btn"
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            borderRadius: '10px',
            backgroundColor: activeTab === 'feedback' ? 'var(--text-primary)' : 'transparent',
            color: activeTab === 'feedback' ? 'var(--accent-inverse)' : 'var(--text-secondary)',
            border: activeTab === 'feedback' ? '1px solid var(--text-primary)' : '1px solid transparent'
          }}
        >
          Feedback & Bug Reports
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className="btn"
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            borderRadius: '10px',
            backgroundColor: activeTab === 'audit' ? 'var(--text-primary)' : 'transparent',
            color: activeTab === 'audit' ? 'var(--accent-inverse)' : 'var(--text-secondary)',
            border: activeTab === 'audit' ? '1px solid var(--text-primary)' : '1px solid transparent'
          }}
        >
          Activity & Audit Trail
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '2rem' }}>
          {[1, 2, 3].map(n => (
            <div 
              key={n}
              className="loop-card skeleton-pulse"
              style={{
                padding: '2.2rem 2rem',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                minHeight: '110px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ height: '1.5rem', width: '250px', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
                <div style={{ height: '1.8rem', width: '100px', backgroundColor: 'var(--border-color)', borderRadius: '8px' }} />
              </div>
              <div style={{ height: '1rem', width: '80%', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Tab: Approvals */}
          {activeTab === 'approvals' && (
        <div>
          {/* Stories Queue */}
          <div style={{ marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} />
              <span>Pending Senior Stories ({pendingStories.length})</span>
            </h2>
            
            {pendingStories.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {pendingStories.map(story => (
                  <div key={story.id} className="glass-panel" style={{
                    padding: '1.5rem 2rem',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{story.name}</span>
                          {story.requestType === 'delete' && (
                            <span className="badge" style={{ backgroundColor: 'rgba(255, 69, 58, 0.15)', borderColor: 'rgba(255, 69, 58, 0.3)', color: '#ff453a', fontSize: '0.65rem' }}>
                              Deletion Request
                            </span>
                          )}
                          {story.requestType === 'edit' && (
                            <span className="badge" style={{ backgroundColor: 'rgba(0, 122, 255, 0.15)', borderColor: 'rgba(0, 122, 255, 0.3)', color: '#0a84ff', fontSize: '0.65rem' }}>
                              Edit Request
                            </span>
                          )}
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {story.branch} Class of {story.passoutYear} • Placed: {story.company} ({story.role}) • Sem {story.semester} • CGPA {story.cgpa || 'N/A'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => setPreviewingPendingStory(story)}
                          className="btn btn-secondary"
                          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--text-primary)', borderColor: 'var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                        >
                          <FileText size={14} /> Preview Submission
                        </button>
                        <button 
                          onClick={() => handleApproveStory(story.id || story._id)}
                          className="btn btn-primary"
                          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', backgroundColor: '#30d158', borderColor: '#30d158', color: '#fff', cursor: 'pointer' }}
                        >
                          <Check size={14} /> {story.requestType === 'delete' ? 'Approve Deletion' : story.requestType === 'edit' ? 'Approve Edits' : 'Approve Story & Resume'}
                        </button>
                        <button 
                          onClick={() => handleRejectStory(story.id || story._id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: '#ff453a', borderColor: 'rgba(255, 69, 58, 0.2)', cursor: 'pointer' }}
                        >
                          <X size={14} /> Reject
                        </button>
                      </div>
                    </div>

                    <div style={{
                      backgroundColor: 'var(--bg-primary)',
                      padding: '1rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)'
                    }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Strategy Draft preview:</p>
                      "{story.journey?.prep}"
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No pending senior stories to review.</p>
            )}
          </div>

          {/* Resources Queue */}
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} />
              <span>Pending Resources ({pendingResources.length})</span>
            </h2>

            {pendingResources.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {pendingResources.map(res => (
                  <div key={res.id} className="glass-panel" style={{
                    padding: '1.5rem 2rem',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{res.title}</span>
                        {res.requestType === 'delete' && (
                          <span className="badge" style={{ backgroundColor: 'rgba(255, 69, 58, 0.15)', borderColor: 'rgba(255, 69, 58, 0.3)', color: '#ff453a', fontSize: '0.65rem' }}>
                            Deletion Request
                          </span>
                        )}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Category: {res.category} • Folder: {getFolderName(res.folderId) || res.folder || 'None'} • File: {res.type} • Uploaded by: {res.uploadedBy}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => setPreviewingPendingResource(res)}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--text-primary)', borderColor: 'var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                      >
                        <FileText size={14} /> Preview
                      </button>
                      <button 
                        onClick={() => handleApproveResource(res.id || res._id)}
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', backgroundColor: '#30d158', borderColor: '#30d158', color: '#fff', cursor: 'pointer' }}
                      >
                        <Check size={14} /> {res.requestType === 'delete' ? 'Approve Deletion' : 'Approve Resource'}
                      </button>
                      <button 
                        onClick={() => handleRejectResource(res.id || res._id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: '#ff453a', borderColor: 'rgba(255, 69, 58, 0.2)', cursor: 'pointer' }}
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No pending study resources to review.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Manage active content */}
      {activeTab === 'active' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          
          {(() => {
            const filteredActiveStories = activeStories.filter((story) => {
              if (!story) return false;
              const query = (storiesSearch || '').toLowerCase();
              return (
                (story.name || '').toLowerCase().includes(query) ||
                (story.company || '').toLowerCase().includes(query) ||
                (story.role && String(story.role).toLowerCase().includes(query)) ||
                (story.branch && String(story.branch).toLowerCase().includes(query))
              );
            });

            const filteredActiveResources = activeResources.filter((res) => {
              if (!res) return false;
              const query = (resourcesSearch || '').toLowerCase();
              return (
                (res.title || '').toLowerCase().includes(query) ||
                (res.category || '').toLowerCase().includes(query) ||
                (res.uploadedBy && String(res.uploadedBy).toLowerCase().includes(query))
              );
            });

            const filteredActiveAchievements = activeAchievements.filter((item) => {
              if (!item) return false;
              const query = (achievementsSearch || '').toLowerCase();
              return (
                (item.title || '').toLowerCase().includes(query) ||
                (item.category || '').toLowerCase().includes(query) ||
                (item.description && String(item.description).toLowerCase().includes(query))
              );
            });

            return (
              <>
                {/* Active Stories */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div 
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }} 
                      onClick={() => setStoriesExpanded(!storiesExpanded)}
                    >
                      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Active Senior Stories ({filteredActiveStories.length})</h2>
                      {storiesExpanded ? <ChevronUp size={20} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={20} style={{ color: 'var(--text-secondary)' }} />}
                    </div>
                    {storiesExpanded && (
                      <div style={{ position: 'relative', minWidth: '240px', maxWidth: '100%' }}>
                        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                          type="text"
                          placeholder="Search senior stories..."
                          value={storiesSearch}
                          onChange={(e) => setStoriesSearch(e.target.value)}
                          style={{
                            padding: '0.4rem 0.75rem 0.4rem 2rem',
                            fontSize: '0.85rem',
                            borderRadius: '20px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            width: '100%'
                          }}
                        />
                      </div>
                    )}
                  </div>
                  
                  {storiesExpanded && (
                    <div className="glass-panel" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      {filteredActiveStories.length > 0 ? (
                        filteredActiveStories.map((story) => (
                          <div key={story.id} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '1rem 1.5rem',
                            borderBottom: '1px solid var(--border-color)'
                          }}>
                            <div>
                              <p style={{ fontWeight: 600 }}>{story.name} ({story.company})</p>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{story.branch} • Year: {story.passoutYear} • Role: {story.role}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                onClick={() => startEditStory(story)} 
                                className="btn btn-secondary" 
                                style={{ padding: '0.4rem', color: 'var(--text-primary)', border: 'none', cursor: 'pointer' }}
                                title="Edit Story"
                              >
                                <Edit size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteStory(story.id)} 
                                className="btn btn-secondary" 
                                style={{ padding: '0.4rem', color: '#ff453a', border: 'none', cursor: 'pointer' }}
                                title="Delete Story"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ padding: '1.5rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>No stories found.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Active Resources & Storage Metrics Banner */}
                {resourceStats && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(0, 113, 227, 0.1)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <HardDrive size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Storage Used</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{resourceStats.totalStorageFormatted || '0 B'}</div>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(52, 199, 89, 0.1)', color: '#34c759', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Resources</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{activeResources.length} files</div>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(255, 149, 0, 0.1)', color: '#ff9500', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Folder size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Folders</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{folders.length}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                          {resourceStats.systemFolders || 0} Sys • {resourceStats.publicFolders || 0} Pub • {resourceStats.privateFolders || 0} Priv
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Achievements */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div 
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }} 
                      onClick={() => setAchievementsExpanded(!achievementsExpanded)}
                    >
                      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Active Achievements/News ({filteredActiveAchievements.length})</h2>
                      {achievementsExpanded ? <ChevronUp size={20} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={20} style={{ color: 'var(--text-secondary)' }} />}
                    </div>
                    {achievementsExpanded && (
                      <div style={{ position: 'relative', minWidth: '240px', maxWidth: '100%' }}>
                        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                          type="text"
                          placeholder="Search achievements..."
                          value={achievementsSearch}
                          onChange={(e) => setAchievementsSearch(e.target.value)}
                          style={{
                            padding: '0.4rem 0.75rem 0.4rem 2rem',
                            fontSize: '0.85rem',
                            borderRadius: '20px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            width: '100%'
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {achievementsExpanded && (
                    <div className="glass-panel" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      {filteredActiveAchievements.length > 0 ? (
                        filteredActiveAchievements.map((item) => (
                          <div key={item.id} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '1rem 1.5rem',
                            borderBottom: '1px solid var(--border-color)'
                          }}>
                            <div>
                              <p style={{ fontWeight: 600 }}>{item.title}</p>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.category} • Date: {item.date}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                onClick={() => startEditAchievement(item)} 
                                className="btn btn-secondary" 
                                style={{ padding: '0.4rem', color: 'var(--text-primary)', border: 'none', cursor: 'pointer' }}
                                title="Edit Achievement"
                              >
                                <Edit size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteAchievement(item.id)} 
                                className="btn btn-secondary" 
                                style={{ padding: '0.4rem', color: '#ff453a', border: 'none', cursor: 'pointer' }}
                                title="Delete Achievement"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ padding: '1.5rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>No achievements found.</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* Diagrammatic Hierarchical Resource Folders Explorer */}
          <div style={{ marginTop: '3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <GitBranch size={22} style={{ color: 'var(--accent-primary)' }} />
                  <span>Diagrammatic Folder Explorer ({folders.length})</span>
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                  Full academic hierarchy tree. Admins can rename, delete, and structure any folder.
                </p>
              </div>

              {/* Tree Controls & Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', minWidth: '220px', maxWidth: '100%' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    placeholder="Find folder or branch..."
                    value={folderSearchQuery}
                    onChange={(e) => setFolderSearchQuery(e.target.value)}
                    style={{
                      padding: '0.4rem 0.75rem 0.4rem 2rem',
                      fontSize: '0.82rem',
                      borderRadius: '20px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      width: '100%'
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={expandAllFolders}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', borderRadius: '8px' }}
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAllFolders}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', borderRadius: '8px' }}
                >
                  Collapse All
                </button>
              </div>
            </div>

            <div className="grid-admin-folders" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(280px, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
              {/* Diagrammatic Tree View Panel */}
              <div className="glass-panel" style={{ borderRadius: '16px', border: '1px solid var(--border-color)', padding: '1.25rem', maxHeight: '550px', overflowY: 'auto' }}>
                {folderTree.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>No folders created yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {/* Academic System Root Branch */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <ShieldCheck size={14} /> Academic System Hierarchy
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {folderTree
                          .filter(node => node.isSystemFolder || node.folderType === 'system')
                          .map(node => {
                            const renderNode = (n, depth = 0) => {
                              const hasChildren = n.children && n.children.length > 0;
                              const fileCount = activeResources.filter(r => r.folderId === n.id).length;
                              const hasExpandable = hasChildren || fileCount > 0;
                              const isExp = expandedNodes.has(n.id) || !!folderSearchQuery;

                              if (folderSearchQuery) {
                                const q = folderSearchQuery.toLowerCase();
                                const matches = n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q);
                                const childMatches = (arr) => arr.some(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || childMatches(c.children));
                                if (!matches && !childMatches(n.children)) return null;
                              }

                              return (
                                <div key={n.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.55rem 0.75rem',
                                    marginLeft: `${depth * 22}px`,
                                    borderRadius: '10px',
                                    backgroundColor: depth % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                                    borderLeft: depth > 0 ? '2px solid rgba(0, 113, 227, 0.35)' : 'none',
                                    marginBottom: '3px',
                                    gap: '0.6rem',
                                    flexWrap: 'wrap'
                                  }}>
                                    <div 
                                      onClick={() => hasExpandable && toggleFolderNode(n.id)}
                                      style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: '180px', flex: 1, cursor: hasExpandable ? 'pointer' : 'default', userSelect: 'none' }}
                                    >
                                      {hasExpandable ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFolderNode(n.id);
                                          }}
                                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                        >
                                          {isExp ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                        </button>
                                      ) : (
                                        <span style={{ width: '15px' }} />
                                      )}
                                      <ShieldCheck size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                      <span style={{ fontWeight: depth === 0 ? 700 : 600, fontSize: depth === 0 ? '0.92rem' : '0.85rem' }}>
                                        {n.name}
                                      </span>
                                      {fileCount > 0 && (
                                        <span 
                                          title="Click to view/hide files"
                                          style={{ fontSize: '0.65rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.08rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}
                                        >
                                          {fileCount} {fileCount === 1 ? 'file' : 'files'}
                                        </span>
                                      )}
                                      {hasChildren && (
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                          ({n.children.length} subfolders)
                                        </span>
                                      )}
                                    </div>

                                    {/* Action Buttons for Admin */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setParentFolderSelection(n.id);
                                          const el = document.getElementById('admin-create-folder-form');
                                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        className="btn btn-secondary"
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '6px' }}
                                        title="Add Subfolder here"
                                      >
                                        <Plus size={11} /> Sub
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditFolder(n)}
                                        className="btn btn-secondary"
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '6px' }}
                                        title="Rename / Edit Folder"
                                      >
                                        <Edit size={11} /> Rename
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteFolder(n)}
                                        className="btn btn-secondary"
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '6px', color: '#ff453a', borderColor: 'rgba(255, 69, 58, 0.25)' }}
                                        title="Delete Folder"
                                      >
                                        <Trash2 size={11} /> Delete
                                      </button>
                                    </div>
                                  </div>

                                  {/* Folder's Files when expanded */}
                                  {isExp && (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      {activeResources
                                        .filter(r => r.folderId === n.id)
                                        .map(res => (
                                          <div key={res.id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.45rem 0.75rem',
                                            marginLeft: `${(depth + 1) * 22}px`,
                                            borderRadius: '8px',
                                            backgroundColor: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)',
                                            borderLeft: '3px solid rgba(0, 113, 227, 0.45)',
                                            marginBottom: '3px',
                                            gap: '0.5rem',
                                            flexWrap: 'wrap'
                                          }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: '150px', flex: 1 }}>
                                              <span style={{ fontSize: '0.75rem', color: 'rgba(0, 113, 227, 0.6)', fontWeight: 700, marginRight: '-2px' }}>└──</span>
                                              <FileText size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{res.title}</span>
                                              {res.size ? (
                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                                  ({res.fileSizeFormatted || formatBytes(res.size)})
                                                </span>
                                              ) : null}
                                              <span style={{
                                                fontSize: '0.62rem',
                                                textTransform: 'uppercase',
                                                color: (res.storageProvider === 'r2' || res.storageProvider === 's3') ? '#ff9500' : '#0071e3',
                                                backgroundColor: (res.storageProvider === 'r2' || res.storageProvider === 's3') ? 'rgba(255, 149, 0, 0.1)' : 'rgba(0, 113, 227, 0.1)',
                                                border: `1px solid ${(res.storageProvider === 'r2' || res.storageProvider === 's3') ? 'rgba(255, 149, 0, 0.25)' : 'rgba(0, 113, 227, 0.25)'}`,
                                                padding: '0.05rem 0.35rem',
                                                borderRadius: '4px',
                                                fontWeight: 600
                                              }}>
                                                {res.storageProvider?.toUpperCase() || 'GRIDFS'}
                                              </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                              <button
                                                type="button"
                                                onClick={() => navigate(`/preview/${res.id}?folderId=${res.folderId || ''}`, {
                                                  state: {
                                                    file: res,
                                                    files: [res],
                                                    folderName: n.name
                                                  }
                                                })}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px' }}
                                                title="Preview / View File"
                                              >
                                                <Eye size={11} /> View
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => startEditResource(res)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px' }}
                                                title="Rename / Edit Resource"
                                              >
                                                <Edit size={11} /> Rename
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleStartMoveResource(res)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px', color: '#0071e3', borderColor: 'rgba(0,113,227,0.3)' }}
                                                title="Move Document / File to another folder"
                                              >
                                                <FolderInput size={11} /> Move
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteResource(res.id)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px', color: '#ff453a', borderColor: 'rgba(255, 69, 58, 0.25)' }}
                                                title="Delete File"
                                              >
                                                <Trash2 size={11} />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  )}

                                  {hasChildren && isExp && (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      {n.children.map(child => renderNode(child, depth + 1))}
                                    </div>
                                  )}
                                </div>
                              );
                            };
                            return renderNode(node, 0);
                          })}
                      </div>
                    </div>

                    {/* Community & User Folders Branch */}
                    {folderTree.some(node => !(node.isSystemFolder || node.folderType === 'system')) && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#34c759', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Globe size={14} /> Community & User Folders
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {folderTree
                            .filter(node => !(node.isSystemFolder || node.folderType === 'system'))
                            .map(node => {
                              const renderUserNode = (n, depth = 0) => {
                                const hasChildren = n.children && n.children.length > 0;
                                const fileCount = activeResources.filter(r => r.folderId === n.id).length;
                                const hasExpandable = hasChildren || fileCount > 0;
                                const isExp = expandedNodes.has(n.id) || !!folderSearchQuery;
                                const isPriv = n.visibility === 'private';

                                if (folderSearchQuery) {
                                  const q = folderSearchQuery.toLowerCase();
                                  const matches = n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q);
                                  const childMatches = (arr) => arr.some(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || childMatches(c.children));
                                  if (!matches && !childMatches(n.children)) return null;
                                }

                                return (
                                  <div key={n.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '0.55rem 0.75rem',
                                      marginLeft: `${depth * 22}px`,
                                      borderRadius: '10px',
                                      backgroundColor: depth % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                                      borderLeft: depth > 0 ? '2px solid rgba(52, 199, 89, 0.35)' : 'none',
                                      marginBottom: '3px',
                                      gap: '0.6rem',
                                      flexWrap: 'wrap'
                                    }}>
                                      <div 
                                        onClick={() => hasExpandable && toggleFolderNode(n.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: '180px', flex: 1, cursor: hasExpandable ? 'pointer' : 'default', userSelect: 'none' }}
                                      >
                                        {hasExpandable ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleFolderNode(n.id);
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                          >
                                            {isExp ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                          </button>
                                        ) : (
                                          <span style={{ width: '15px' }} />
                                        )}
                                        {isPriv ? <Lock size={16} style={{ color: '#ff9500', flexShrink: 0 }} /> : <Globe size={16} style={{ color: '#34c759', flexShrink: 0 }} />}
                                        <span style={{ fontWeight: depth === 0 ? 700 : 600, fontSize: depth === 0 ? '0.92rem' : '0.85rem' }}>
                                          {n.name}
                                        </span>
                                        <span style={{ fontSize: '0.62rem', backgroundColor: isPriv ? 'rgba(255, 149, 0, 0.12)' : 'rgba(52, 199, 89, 0.12)', color: isPriv ? '#ff9500' : '#34c759', padding: '0.05rem 0.35rem', borderRadius: '4px' }}>
                                          {isPriv ? 'Private' : 'Public'}
                                        </span>
                                        {fileCount > 0 && (
                                          <span 
                                            title="Click to view/hide files"
                                            style={{ fontSize: '0.65rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.08rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}
                                          >
                                            {fileCount} {fileCount === 1 ? 'file' : 'files'}
                                          </span>
                                        )}
                                      </div>

                                      {/* Action Buttons */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setParentFolderSelection(n.id);
                                            const el = document.getElementById('admin-create-folder-form');
                                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                                          }}
                                          className="btn btn-secondary"
                                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '6px' }}
                                        >
                                          <Plus size={11} /> Sub
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditFolder(n)}
                                          className="btn btn-secondary"
                                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '6px' }}
                                        >
                                          <Edit size={11} /> Rename
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteFolder(n)}
                                          className="btn btn-secondary"
                                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '6px', color: '#ff453a', borderColor: 'rgba(255, 69, 58, 0.25)' }}
                                        >
                                          <Trash2 size={11} /> Delete
                                        </button>
                                      </div>
                                    </div>

                                    {/* Folder's Files when expanded */}
                                    {isExp && (
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {activeResources
                                          .filter(r => r.folderId === n.id)
                                          .map(res => (
                                            <div key={res.id} style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              padding: '0.45rem 0.75rem',
                                              marginLeft: `${(depth + 1) * 22}px`,
                                              borderRadius: '8px',
                                              backgroundColor: 'var(--bg-secondary)',
                                              border: '1px solid var(--border-color)',
                                              borderLeft: '3px solid rgba(52, 199, 89, 0.45)',
                                              marginBottom: '3px',
                                              gap: '0.5rem',
                                              flexWrap: 'wrap'
                                            }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: '150px', flex: 1 }}>
                                                <span style={{ fontSize: '0.75rem', color: 'rgba(52, 199, 89, 0.6)', fontWeight: 700, marginRight: '-2px' }}>└──</span>
                                                <FileText size={14} style={{ color: '#34c759', flexShrink: 0 }} />
                                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{res.title}</span>
                                                {res.size ? (
                                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                                    ({res.fileSizeFormatted || formatBytes(res.size)})
                                                  </span>
                                                ) : null}
                                                <span style={{
                                                  fontSize: '0.62rem',
                                                  textTransform: 'uppercase',
                                                  color: (res.storageProvider === 'r2' || res.storageProvider === 's3') ? '#ff9500' : '#0071e3',
                                                  backgroundColor: (res.storageProvider === 'r2' || res.storageProvider === 's3') ? 'rgba(255, 149, 0, 0.1)' : 'rgba(0, 113, 227, 0.1)',
                                                  border: `1px solid ${(res.storageProvider === 'r2' || res.storageProvider === 's3') ? 'rgba(255, 149, 0, 0.25)' : 'rgba(0, 113, 227, 0.25)'}`,
                                                  padding: '0.05rem 0.35rem',
                                                  borderRadius: '4px',
                                                  fontWeight: 600
                                                }}>
                                                  {res.storageProvider?.toUpperCase() || 'GRIDFS'}
                                                </span>
                                              </div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => navigate(`/preview/${res.id}?folderId=${res.folderId || ''}`, {
                                                    state: {
                                                      file: res,
                                                      files: [res],
                                                      folderName: n.name
                                                    }
                                                  })}
                                                  className="btn btn-secondary"
                                                  style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px' }}
                                                  title="Preview / View File"
                                                >
                                                  <Eye size={11} /> View
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => startEditResource(res)}
                                                  className="btn btn-secondary"
                                                  style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px' }}
                                                  title="Rename / Edit Resource"
                                                >
                                                  <Edit size={11} /> Rename
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleStartMoveResource(res)}
                                                  className="btn btn-secondary"
                                                  style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px', color: '#0071e3', borderColor: 'rgba(0,113,227,0.3)' }}
                                                  title="Move Document / File to another folder"
                                                >
                                                  <FolderInput size={11} /> Move
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteResource(res.id)}
                                                  className="btn btn-secondary"
                                                  style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px', color: '#ff453a', borderColor: 'rgba(255, 69, 58, 0.25)' }}
                                                  title="Delete File"
                                                >
                                                  <Trash2 size={11} />
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    )}

                                    {hasChildren && isExp && (
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {n.children.map(child => renderUserNode(child, depth + 1))}
                                      </div>
                                    )}
                                  </div>
                                );
                              };
                              return renderUserNode(node, 0);
                            })}
                        </div>
                      </div>
                    )}

                    {/* Unassigned / Root Files (if any resource has folderId not in known folders) */}
                    {activeResources.some(r => !folders.some(f => f.id === r.folderId)) && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ff9500', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <FileText size={14} /> Unassigned / Root Files
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {activeResources
                            .filter(r => !folders.some(f => f.id === r.folderId))
                            .map(res => (
                              <div key={res.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.4rem 0.65rem',
                                borderRadius: '8px',
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                gap: '0.5rem',
                                flexWrap: 'wrap'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: '150px', flex: 1 }}>
                                  <FileText size={14} style={{ color: '#ff9500', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{res.title}</span>
                                  {res.size ? (
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                      ({res.fileSizeFormatted || formatBytes(res.size)})
                                    </span>
                                  ) : null}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/preview/${res.id}?folderId=${res.folderId || ''}`, {
                                      state: { file: res, files: [res], folderName: 'Unassigned' }
                                    })}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px' }}
                                    title="Preview / View File"
                                  >
                                    <Eye size={11} /> View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startEditResource(res)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px' }}
                                    title="Rename / Edit Resource"
                                  >
                                    <Edit size={11} /> Rename
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStartMoveResource(res)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px', color: '#0071e3', borderColor: 'rgba(0,113,227,0.3)' }}
                                    title="Move Document / File to another folder"
                                  >
                                    <FolderInput size={11} /> Move
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteResource(res.id)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px', color: '#ff453a', borderColor: 'rgba(255, 69, 58, 0.25)' }}
                                    title="Delete File"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Add Folder Form */}
              <form 
                id="admin-create-folder-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const name = e.target.folderName.value.trim();
                  const parentId = e.target.folderParent.value;
                  if (!name) return;
                  
                  const newFolder = {
                    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
                    name,
                    parentId: parentId === 'none' ? null : parentId,
                    folderType: 'system',
                    isSystemFolder: true,
                    visibility: 'public'
                  };
                  
                  await addFolder(newFolder);
                  e.target.reset();
                  setParentFolderSelection('none');
                  await refreshData();
                }}
                className="glass-panel" 
                style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}
              >
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FolderPlus size={18} style={{ color: 'var(--accent-primary)' }} />
                  <span>Create New Folder</span>
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  Add a root folder or place it under any selected branch.
                </p>
                
                <div className="input-group" style={{ marginBottom: '1rem' }}>
                  <label className="input-label" style={{ fontSize: '0.8rem' }}>Folder Name *</label>
                  <input 
                    type="text" 
                    name="folderName" 
                    className="input-field" 
                    placeholder="e.g. Mechanical Engineering" 
                    required 
                  />
                </div>

                <div className="input-group" style={{ marginBottom: '1rem' }}>
                  <label className="input-label" style={{ fontSize: '0.8rem' }}>Parent Branch / Folder</label>
                  <select 
                    name="folderParent" 
                    value={parentFolderSelection}
                    onChange={(e) => setParentFolderSelection(e.target.value)}
                    className="input-field"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  >
                    <option value="none">None (Root Level Branch)</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>{getFolderName(f.id)}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', cursor: 'pointer', padding: '0.65rem' }}>
                  Add Folder to Structure
                </button>
              </form>
            </div>
          </div>

        </div>
      )}

      {/* Tab: Add news and achievement */}
      {activeTab === 'news' && (
        <div style={{ maxWidth: '600px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.25rem' }}>Publish New News & Achievement</h2>
          
          <form onSubmit={handleCreateAchievement} className="glass-panel" style={{ padding: '2rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
            {formSuccess && (
              <div style={{
                backgroundColor: 'rgba(48, 209, 88, 0.1)',
                border: '1px solid rgba(48, 209, 88, 0.2)',
                color: '#30d158',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                fontSize: '0.85rem',
                marginBottom: '1.25rem'
              }}>
                News/Achievement published successfully!
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Title *</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. SPIT Team wins Hackathon 2026"
                value={achievementForm.title}
                onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })}
                required
              />
            </div>

            <div className="form-grid-2col">
              <div className="input-group">
                <label className="input-label">Category *</label>
                <select
                  className="input-field"
                  value={achievementForm.category}
                  onChange={(e) => setAchievementForm({ ...achievementForm, category: e.target.value })}
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <option value="Hackathon Winners">Hackathon Winners</option>
                  <option value="Placement Successes">Placement Successes</option>
                  <option value="Internship Achievements">Internship Achievements</option>
                  <option value="Competition Winners">Competition Winners</option>
                  <option value="Research Publications">Research Publications</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Date *</label>
                <input
                  type="date"
                  className="input-field"
                  value={achievementForm.date}
                  onChange={(e) => setAchievementForm({ ...achievementForm, date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Achievement Image (Upload or URL)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                <div 
                  onClick={() => document.getElementById('achievement-image-upload')?.click()}
                  style={{
                    border: achievementForm.image ? '2px solid var(--border-dropzone, #000000)' : '2px dashed var(--border-dropzone, #000000)',
                    borderRadius: '16px',
                    padding: '1rem',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-dropzone, rgba(0, 0, 0, 0.02))',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100px',
                    color: 'var(--text-primary)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary, #0071e3)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-dropzone, #000000)'}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) processAchievementImage(file);
                  }}
                >
                  <input 
                    type="file" 
                    id="achievement-image-upload" 
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) processAchievementImage(file);
                    }} 
                    style={{ display: 'none' }}
                    accept="image/*"
                  />
                  {achievementForm.image ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                          <img src={achievementForm.image} alt="Achievement Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Image Selected</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {achievementForm.image}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAchievementForm({ ...achievementForm, image: '' });
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem', color: '#ff453a', border: 'none', background: 'transparent', cursor: 'pointer' }}
                        title="Remove Image"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Plus size={22} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, margin: 0 }}>
                        Click to select an image, or drop here
                      </p>
                    </>
                  )}
                </div>
                
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Or paste image URL directly"
                  value={achievementForm.image.startsWith('data:') ? '' : achievementForm.image} 
                  onChange={(e) => setAchievementForm({ ...achievementForm, image: e.target.value })} 
                  style={{ fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {(() => {
              const slidersData = parseSliders(achievementForm.imagePosition);
              const activeSlider = createTab === 'outer' ? slidersData.outer : slidersData.inner;
              return (
                <>
                  <div className="form-grid-2col" style={{ marginBottom: '1.25rem' }}>
                    <div className="input-group">
                      <label className="input-label">Image Fitting Selection</label>
                      <select
                        className="input-field"
                        value={achievementForm.imageFit || 'crop'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'crop') {
                            setAchievementForm({ 
                              ...achievementForm, 
                              imageFit: 'crop', 
                              imagePosition: 'crop:10,0,80,33;10,0,80,24'
                            });
                          } else if (val === 'cover') {
                            setAchievementForm({ 
                              ...achievementForm, 
                              imageFit: 'cover', 
                              imagePosition: 'sliders:48,0,1.8;50,50,1.0'
                            });
                          } else {
                            setAchievementForm({ 
                              ...achievementForm, 
                              imageFit: 'contain', 
                              imagePosition: 'center'
                            });
                          }
                        }}
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <option value="crop">Visual Crop Tool (Recommended)</option>
                        <option value="cover">Presets / Manual Sliders (Cover)</option>
                        <option value="contain">Show Full Image (Contain)</option>
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Image Presets / Manual</label>
                      <select
                        className="input-field"
                        value={['center', 'top', 'bottom', 'left', 'right'].includes(achievementForm.imagePosition) ? achievementForm.imagePosition : 'custom'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'custom') {
                            setAchievementForm({ ...achievementForm, imagePosition: 'sliders:48,0,1.8;50,50,1.0', imageFit: 'cover' });
                          } else {
                            setAchievementForm({ ...achievementForm, imagePosition: val, imageFit: 'cover' });
                          }
                        }}
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                        disabled={achievementForm.imageFit === 'contain' || achievementForm.imageFit === 'crop'}
                      >
                        <option value="center">Center</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="custom">Manual Sliders (X, Y & Zoom)</option>
                      </select>
                    </div>
                  </div>

                  {['crop', 'cover'].includes(achievementForm.imageFit) && achievementForm.image && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8rem',
                          borderRadius: '8px',
                          backgroundColor: createTab === 'outer' ? 'var(--accent-color, #007aff)' : 'var(--bg-secondary)',
                          color: createTab === 'outer' ? '#ffffff' : 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        onClick={() => setCreateTab('outer')}
                      >
                        {achievementForm.imageFit === 'crop' ? 'Outer Card Crop (Listing)' : 'Outer Card Sliders (Listing)'}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8rem',
                          borderRadius: '8px',
                          backgroundColor: createTab === 'inner' ? 'var(--accent-color, #007aff)' : 'var(--bg-secondary)',
                          color: createTab === 'inner' ? '#ffffff' : 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        onClick={() => setCreateTab('inner')}
                      >
                        {achievementForm.imageFit === 'crop' ? 'Inner View Crop (Details)' : 'Inner View Sliders (Details)'}
                      </button>
                    </div>
                  )}

                  {achievementForm.imageFit === 'crop' && achievementForm.image && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <ImageCropper
                        imageUrl={achievementForm.image}
                        imagePosition={achievementForm.imagePosition}
                        onChangePosition={(posStr) => setAchievementForm({ ...achievementForm, imagePosition: posStr })}
                        activeTab={createTab}
                      />
                    </div>
                  )}

                  {achievementForm.imageFit === 'cover' && achievementForm.image && (
                    <div style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                            <span>Horizontal Offset (X-Axis): {activeSlider.x}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={activeSlider.x} 
                            onChange={(e) => {
                              const updated = {
                                ...slidersData,
                                [createTab]: { ...activeSlider, x: parseInt(e.target.value) }
                              };
                              setAchievementForm({ 
                                ...achievementForm, 
                                imagePosition: `sliders:${updated.outer.x},${updated.outer.y},${updated.outer.zoom};${updated.inner.x},${updated.inner.y},${updated.inner.zoom}` 
                              });
                            }}
                            style={{ width: '100%', cursor: 'pointer' }}
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                            <span>Vertical Offset (Y-Axis): {activeSlider.y}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={activeSlider.y} 
                            onChange={(e) => {
                              const updated = {
                                ...slidersData,
                                [createTab]: { ...activeSlider, y: parseInt(e.target.value) }
                              };
                              setAchievementForm({ 
                                ...achievementForm, 
                                imagePosition: `sliders:${updated.outer.x},${updated.outer.y},${updated.outer.zoom};${updated.inner.x},${updated.inner.y},${updated.inner.zoom}` 
                              });
                            }}
                            style={{ width: '100%', cursor: 'pointer' }}
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                            <span>Zoom Scale: {activeSlider.zoom}x</span>
                          </div>
                          <input 
                            type="range" 
                            min="1.0" 
                            max="3.0" 
                            step="0.1"
                            value={activeSlider.zoom} 
                            onChange={(e) => {
                              const updated = {
                                ...slidersData,
                                [createTab]: { ...activeSlider, zoom: parseFloat(e.target.value) }
                              };
                              setAchievementForm({ 
                                ...achievementForm, 
                                imagePosition: `sliders:${updated.outer.x},${updated.outer.y},${updated.outer.zoom};${updated.inner.x},${updated.inner.y},${updated.inner.zoom}` 
                              });
                            }}
                            style={{ width: '100%', cursor: 'pointer' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {achievementForm.image && (
                    <div style={{
                      marginBottom: '1.25rem',
                      padding: '1rem',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px'
                    }}>
                      <h4 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                        Live Crop & Fitting Previews
                      </h4>
                      <div className="grid-admin-folders" style={{ gap: '1.5rem' }}>
                        <div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                            Outer Card (Listing) - Aspect Ratio ~2.42
                          </span>
                          <div style={{
                            height: '110px',
                            width: '264px',
                            overflow: 'hidden',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            position: 'relative',
                            backgroundColor: 'var(--bg-primary)'
                          }}>
                            {(() => {
                              const isCrop = achievementForm.imageFit === 'crop' && achievementForm.imagePosition && achievementForm.imagePosition.startsWith('crop:');
                              if (isCrop) {
                                const cropData = parseCrop(achievementForm.imagePosition);
                                const { x, y, w, h } = cropData.outer;
                                return (
                                  <img 
                                    src={achievementForm.image} 
                                    alt="Outer Card Preview" 
                                    style={{
                                      position: 'absolute',
                                      width: `${10000 / w}%`,
                                      height: `${10000 / h}%`,
                                      left: `${-x * (100 / w)}%`,
                                      top: `${-y * (100 / h)}%`,
                                      objectFit: 'cover'
                                    }}
                                  />
                                );
                              }
                              const p = slidersData.outer;
                              return (
                                <img 
                                  src={achievementForm.image} 
                                  alt="Outer Card Preview" 
                                  style={{
                                    position: 'absolute',
                                    width: `${p.zoom * 100}%`,
                                    height: `${p.zoom * 100}%`,
                                    left: `${-p.x * (p.zoom - 1)}%`,
                                    top: `${-p.y * (p.zoom - 1)}%`,
                                    objectFit: 'cover',
                                    objectPosition: `${p.x}% ${p.y}%`
                                  }}
                                />
                              );
                            })()}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                            Inner View (Details) - Aspect Ratio ~3.33
                          </span>
                          <div style={{
                            height: '78px',
                            width: '260px',
                            overflow: 'hidden',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            position: 'relative',
                            backgroundColor: 'var(--bg-primary)'
                          }}>
                            {(() => {
                              const isCrop = achievementForm.imageFit === 'crop' && achievementForm.imagePosition && achievementForm.imagePosition.startsWith('crop:');
                              if (isCrop) {
                                const cropData = parseCrop(achievementForm.imagePosition);
                                const { x, y, w, h } = cropData.inner;
                                return (
                                  <img 
                                    src={achievementForm.image} 
                                    alt="Inner View Preview" 
                                    style={{
                                      position: 'absolute',
                                      width: `${10000 / w}%`,
                                      height: `${10000 / h}%`,
                                      left: `${-x * (100 / w)}%`,
                                      top: `${-y * (100 / h)}%`,
                                      objectFit: 'cover'
                                    }}
                                  />
                                );
                              }
                              const p = slidersData.inner;
                              return (
                                <img 
                                  src={achievementForm.image} 
                                  alt="Inner View Preview" 
                                  style={{
                                    position: 'absolute',
                                    width: `${p.zoom * 100}%`,
                                    height: `${p.zoom * 100}%`,
                                    left: `${-p.x * (p.zoom - 1)}%`,
                                    top: `${-p.y * (p.zoom - 1)}%`,
                                    objectFit: 'cover',
                                    objectPosition: `${p.x}% ${p.y}%`
                                  }}
                                />
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            <div className="input-group">
              <label className="input-label">Description *</label>
              <textarea
                className="input-field"
                rows={4}
                placeholder="Write detail summary of achievement..."
                value={achievementForm.description}
                onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              <Plus size={16} /> Publish News
            </button>
          </form>
        </div>
      )}

      {/* Tab: Users list */}
      {activeTab === 'users' && (
        <>
          {/* Pending Registration Requests Section */}
          {usersList.some(u => u.status === 'Pending') && (
            <div style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={20} style={{ color: '#ff9500' }} />
                <span>Pending Access Requests ({usersList.filter(u => u.status === 'Pending').length})</span>
              </h2>
              <div className="glass-panel responsive-scroll-x" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                      <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)' }}>Email Address</th>
                      <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)' }}>Default Role</th>
                      <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.filter(u => u.status === 'Pending').map((u, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.85rem 1.25rem', fontWeight: 500 }}>{u.email}</td>
                        <td style={{ padding: '0.85rem 1.25rem' }}>{u.role}</td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleApproveRegistration(u.email)}
                              className="btn btn-primary"
                              style={{
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.8rem',
                                backgroundColor: '#30d158',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                cursor: 'pointer'
                              }}
                            >
                              <Check size={14} /> Approve
                            </button>
                            <button
                              onClick={() => handleRejectRegistration(u.email)}
                              className="btn btn-secondary"
                              style={{
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.8rem',
                                backgroundColor: 'rgba(255, 69, 58, 0.1)',
                                color: '#ff453a',
                                border: '1px solid rgba(255, 69, 58, 0.2)',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                cursor: 'pointer'
                              }}
                            >
                              <X size={14} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid-1-2col">
          
          {/* Add User panel */}
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.25rem' }}>Add Platform User</h2>
            <form onSubmit={handleAddUser} className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              <div className="input-group">
                <label className="input-label">Email Address *</label>
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="user@example.com or user@spit.ac.in" 
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Assigned Role *</label>
                <select 
                  className="input-field"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <option value="Student">Student</option>
                  <option value="Senior / Contributor">Senior / Contributor</option>
                  <option value="Alumni / Contributor">Alumni / Contributor</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>

              {/* Default Password Display & Override */}
              <div style={{
                marginBottom: '1rem',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                fontSize: '0.82rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Default Initial Password:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <code style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      fontWeight: 700,
                      color: '#0071e3',
                      letterSpacing: '0.05em'
                    }}>spit123</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('spit123');
                        setCopiedDefaultPassword(true);
                        setTimeout(() => setCopiedDefaultPassword(false), 2000);
                      }}
                      className="btn btn-secondary"
                      style={{
                        padding: '0.2rem 0.45rem',
                        fontSize: '0.72rem',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        cursor: 'pointer'
                      }}
                      title="Copy default password"
                      aria-label="Copy default password spit123"
                    >
                      {copiedDefaultPassword ? <Check size={12} style={{ color: '#30d158' }} /> : <Copy size={12} />}
                      <span>{copiedDefaultPassword ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
                <p style={{ margin: '0 0 0.65rem 0', color: 'var(--text-secondary)', fontSize: '0.76rem', lineHeight: 1.4 }}>
                  New accounts can immediately log in with this initial password and should change it on first sign-in.
                </p>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Initial Password Override (Optional)
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Leave empty to use spit123"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    style={{ fontSize: '0.82rem', height: '36px' }}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                <Plus size={14} /> Add User
              </button>
            </form>
          </div>

          {/* Users List Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Users size={20} />
                <span>Simulated Platform Users ({usersList.filter(u => u.status !== 'Pending').length})</span>
              </h2>
              {/* Search Bar */}
              <div style={{ position: 'relative', width: '250px' }}>
                <Search size={16} style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                  pointerEvents: 'none'
                }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search email, name..."
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  style={{
                    paddingLeft: '2.25rem',
                    paddingTop: '0.45rem',
                    paddingBottom: '0.45rem',
                    margin: 0,
                    borderRadius: '10px',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>

            <div className="glass-panel responsive-scroll-x" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                    <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)' }}>Email Address</th>
                    <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)' }}>Assigned Role</th>
                    <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)' }}>Profile Details</th>
                    <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Activity / Audit</th>
                    <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.filter(u => u.status !== 'Pending').filter(u => {
                    const search = usersSearch.toLowerCase();
                    return (
                      (u.email && u.email.toLowerCase().includes(search)) ||
                      (u.name && u.name.toLowerCase().includes(search)) ||
                      (u.role && u.role.toLowerCase().includes(search)) ||
                      (u.branch && u.branch.toLowerCase().includes(search)) ||
                      (u.currentYear && u.currentYear.toLowerCase().includes(search))
                    );
                  }).length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        No users found
                      </td>
                    </tr>
                  ) : (
                    usersList.filter(u => u.status !== 'Pending').filter(u => {
                      const search = usersSearch.toLowerCase();
                      return (
                        (u.email && u.email.toLowerCase().includes(search)) ||
                        (u.name && u.name.toLowerCase().includes(search)) ||
                        (u.role && u.role.toLowerCase().includes(search)) ||
                        (u.branch && u.branch.toLowerCase().includes(search)) ||
                        (u.currentYear && u.currentYear.toLowerCase().includes(search))
                      );
                    }).map((u, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.85rem 1.25rem', fontWeight: 500 }}>{u.email}</td>
                        <td style={{ padding: '0.85rem 1.25rem' }}>{u.role}</td>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          {u.name || u.branch || u.currentYear ? (
                            `${u.name || 'N/A'} | ${u.branch || 'N/A'} | ${u.currentYear || 'N/A'}`
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', opacity: 0.6, fontStyle: 'italic' }}>Not onboarded</span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <span className="badge" style={{ 
                            backgroundColor: u.status === 'Active' ? 'rgba(48, 209, 88, 0.1)' : 'rgba(255, 69, 58, 0.1)', 
                            borderColor: u.status === 'Active' ? 'rgba(48, 209, 88, 0.2)' : 'rgba(255, 69, 58, 0.2)', 
                            color: u.status === 'Active' ? '#30d158' : '#ff453a' 
                          }}>
                            {u.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                          <button 
                            onClick={() => {
                              setAuditModalUser(u);
                              setIsAuditModalOpen(true);
                            }}
                            className="btn btn-secondary" 
                            style={{ 
                              padding: '0.35rem 0.65rem', 
                              color: 'var(--text-primary)', 
                              border: '1px solid var(--border-color)', 
                              backgroundColor: 'var(--bg-secondary)',
                              borderRadius: '8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                            title="View activity for this user"
                            aria-label={`View activity audit trail for ${u.email}`}
                          >
                            <History size={14} style={{ color: '#0071e3' }} />
                            <span>Audit</span>
                          </button>
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                            <button 
                              onClick={() => startEditUser(u)} 
                              className="btn btn-secondary" 
                              style={{ padding: '0.35rem', color: 'var(--text-primary)', border: 'none', background: 'transparent' }}
                              title="Edit User"
                            >
                              <Edit size={15} />
                            </button>
                            <button 
                              onClick={() => handleRemoveUser(u.email)} 
                              className="btn btn-secondary" 
                              style={{ padding: '0.35rem', color: '#ff453a', border: 'none', background: 'transparent' }}
                              title="Remove User"
                              disabled={u.email.toLowerCase() === 'admin@spit.ac.in'}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pending Profile Edits */}
        {usersList.some(u => u.hasPendingEdit) && (
          <div style={{ marginTop: '3rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={20} style={{ color: '#ff9500' }} />
              <span>Pending Profile Edit Requests ({usersList.filter(u => u.hasPendingEdit).length})</span>
            </h2>
            <div className="glass-panel" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', padding: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {usersList.filter(u => u.hasPendingEdit).map((u, i) => (
                  <div key={i} className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{u.email}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status: Active</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => handleApproveProfileEdit(u.email)}
                          className="btn btn-primary"
                          style={{ 
                            padding: '0.45rem 1rem', 
                            fontSize: '0.8rem', 
                            backgroundColor: '#30d158', 
                            color: '#ffffff', 
                            border: 'none',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <Check size={14} />
                          <span>Approve</span>
                        </button>
                        <button 
                          onClick={() => handleRejectProfileEdit(u.email)}
                          className="btn btn-secondary"
                          style={{ 
                            padding: '0.45rem 1rem', 
                            fontSize: '0.8rem', 
                            backgroundColor: 'rgba(255, 69, 58, 0.1)', 
                            color: '#ff453a', 
                            border: '1px solid rgba(255, 69, 58, 0.2)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <X size={14} />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>

                    {/* Side-by-side comparison */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      {/* Current Profile */}
                      <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
                        <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.5rem' }}>
                          Current Details
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
                          <p><strong>Name:</strong> {u.name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>}</p>
                          <p><strong>Role:</strong> {u.role}</p>
                          <p><strong>Branch:</strong> {u.branch || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>}</p>
                          <p><strong>Year:</strong> {u.currentYear || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>}</p>
                        </div>
                      </div>

                      {/* Proposed Profile */}
                      <div>
                        <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#ff9500', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.5rem' }}>
                          Proposed Details
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
                          <p><strong>Name:</strong> <span style={{ color: u.name !== u.pendingName ? '#ff9500' : 'var(--text-primary)', fontWeight: u.name !== u.pendingName ? 600 : 400 }}>{u.pendingName}</span></p>
                          <p><strong>Role:</strong> <span style={{ color: u.role !== u.pendingRole ? '#ff9500' : 'var(--text-primary)', fontWeight: u.role !== u.pendingRole ? 600 : 400 }}>{u.pendingRole}</span></p>
                          <p><strong>Branch:</strong> <span style={{ color: u.branch !== u.pendingBranch ? '#ff9500' : 'var(--text-primary)', fontWeight: u.branch !== u.pendingBranch ? 600 : 400 }}>{u.pendingBranch}</span></p>
                          <p><strong>Year:</strong> <span style={{ color: u.currentYear !== u.pendingCurrentYear ? '#ff9500' : 'var(--text-primary)', fontWeight: u.currentYear !== u.pendingCurrentYear ? 600 : 400 }}>{u.pendingCurrentYear}</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        </>
      )}

      {/* Tab: System Health & Diagnostics */}
      {activeTab === 'health' && (
        <SystemHealthDashboard />
      )}

      {/* Tab: Feedback & Bug Reports */}
      {activeTab === 'feedback' && (
        <AdminFeedbackTab />
      )}

      {/* Tab: Security Audit & Activity Logs */}
      {activeTab === 'audit' && (
        <AdminAuditLogsTab />
      )}
      </>
      )}
    </div>

    {/* Glassmorphic Edit Details Overlay Modal */}
    {editingItem && createPortal(
        <div 
          onClick={() => setEditingItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
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
            className="glass-panel animate-fade-in custom-scrollbar" 
            style={{
              margin: 'auto',
              width: '100%',
              maxWidth: '650px',
              borderRadius: '24px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              position: 'relative',
              padding: '2rem',
              maxHeight: 'calc(100vh - 4rem)',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.4), 0 0 1px 1px rgba(255, 255, 255, 0.1) inset'
            }}
          >
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setEditingItem(null);
              }}
              style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                zIndex: 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Close (Esc)"
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2rem' }}>
              Edit {editingType === 'story' ? 'Senior Story' : editingType === 'resource' ? 'Study Resource' : 'Achievement'} Details
            </h2>

            {editingType === 'story' ? (
              <form onSubmit={handleSaveStory}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Name</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={editStoryForm.name} 
                      onChange={e => setEditStoryForm({ ...editStoryForm, name: e.target.value })} 
                      required
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Company</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={editStoryForm.company} 
                      onChange={e => setEditStoryForm({ ...editStoryForm, company: e.target.value })} 
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Role</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={editStoryForm.role} 
                      onChange={e => setEditStoryForm({ ...editStoryForm, role: e.target.value })} 
                      required
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Branch</label>
                    <select 
                      className="input-field" 
                      value={editStoryForm.branch} 
                      onChange={e => setEditStoryForm({ ...editStoryForm, branch: e.target.value })}
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <option value="CSE">CSE</option>
                      <option value="IT">IT</option>
                      <option value="EXTC">EXTC</option>
                      <option value="AI & DS">AI & DS</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Passout Year</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={editStoryForm.passoutYear} 
                      onChange={e => setEditStoryForm({ ...editStoryForm, passoutYear: e.target.value })} 
                      required
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Semester</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={editStoryForm.semester} 
                      onChange={e => setEditStoryForm({ ...editStoryForm, semester: e.target.value })} 
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">CGPA</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={editStoryForm.cgpa} 
                      onChange={e => setEditStoryForm({ ...editStoryForm, cgpa: e.target.value })} 
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">1st Year Strategy</label>
                    <textarea 
                      className="input-field" 
                      rows={2} 
                      value={editStoryForm.journey.firstYear} 
                      onChange={e => setEditStoryForm({
                        ...editStoryForm,
                        journey: { ...editStoryForm.journey, firstYear: e.target.value }
                      })}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">2nd Year Strategy</label>
                    <textarea 
                      className="input-field" 
                      rows={2} 
                      value={editStoryForm.journey.secondYear} 
                      onChange={e => setEditStoryForm({
                        ...editStoryForm,
                        journey: { ...editStoryForm.journey, secondYear: e.target.value }
                      })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">3rd Year Strategy</label>
                    <textarea 
                      className="input-field" 
                      rows={2} 
                      value={editStoryForm.journey.thirdYear} 
                      onChange={e => setEditStoryForm({
                        ...editStoryForm,
                        journey: { ...editStoryForm.journey, thirdYear: e.target.value }
                      })}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">4th Year Strategy</label>
                    <textarea 
                      className="input-field" 
                      rows={2} 
                      value={editStoryForm.journey.fourthYear} 
                      onChange={e => setEditStoryForm({
                        ...editStoryForm,
                        journey: { ...editStoryForm.journey, fourthYear: e.target.value }
                      })}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Preparation Strategy & Tips *</label>
                  <textarea 
                    className="input-field" 
                    rows={3} 
                    value={editStoryForm.journey.prep} 
                    onChange={e => setEditStoryForm({
                      ...editStoryForm,
                      journey: { ...editStoryForm.journey, prep: e.target.value }
                    })}
                    required
                  />
                </div>

                {/* Resume Section in Edit Modal */}
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                    Senior Resume File
                  </h4>
                  
                  <div 
                    onClick={() => document.getElementById('edit-resume-file-upload')?.click()}
                    style={{
                      border: editStoryForm.resume ? '2px solid var(--border-dropzone, #000000)' : '2px dashed var(--border-dropzone, #000000)',
                      borderRadius: '16px',
                      padding: '1rem',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-dropzone, rgba(0, 0, 0, 0.02))',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '100px',
                      color: 'var(--text-primary)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary, #0071e3)'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-dropzone, #000000)'}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file) processResumeFile(file);
                    }}
                  >
                    <input 
                      type="file" 
                      id="edit-resume-file-upload" 
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) processResumeFile(file);
                      }} 
                      style={{ display: 'none' }}
                      accept=".pdf"
                    />
                    {editStoryForm.resume ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
                          <span style={{
                            padding: '0.4rem',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ff3b30'
                          }}>
                            <FileText size={18} />
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {typeof editStoryForm.resume === 'object' ? editStoryForm.resume.fileName : editStoryForm.resume}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {typeof editStoryForm.resume === 'object' ? editStoryForm.resume.fileSize : '1.2 MB'}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentResume = editStoryForm.resume;
                              const resUrl = getResourceFileUrl({ resume: currentResume });
                              const resumeDoc = {
                                id: `resume-${editingStory?.id || 'edit'}`,
                                title: `${editStoryForm.name || 'Candidate'}'s Resume`,
                                type: 'PDF',
                                fileName: typeof currentResume === 'object' ? currentResume.fileName : (currentResume || 'resume.pdf'),
                                fileSize: typeof currentResume === 'object' ? currentResume.fileSize : '',
                                url: resUrl || '',
                                previewUrl: resUrl || ''
                              };
                              navigate(`/preview/${resumeDoc.id}?storyId=${editingStory?.id || ''}`, {
                                state: {
                                  file: resumeDoc,
                                  files: [resumeDoc],
                                  storyTitle: editStoryForm.name
                                }
                              });
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                          >
                            View Resume
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditStoryForm({ ...editStoryForm, resume: '' });
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem', color: '#ff453a', border: 'none', background: 'transparent', cursor: 'pointer' }}
                            title="Remove Resume"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <FileText size={22} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, margin: 0 }}>
                          Click to upload Resume PDF
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Study Materials Section in Edit Modal */}
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                    Study Materials / Files
                  </h4>
                  
                  {editStoryForm.studyMaterials && editStoryForm.studyMaterials.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                      {editStoryForm.studyMaterials.map((material, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.75rem 1rem',
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
                            <span style={{
                              padding: '0.4rem',
                              backgroundColor: 'var(--bg-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-primary)'
                            }}>
                              <FileText size={18} />
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{material.title}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {material.type} {material.fileName ? `• ${material.fileName}` : ''}
                              </span>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <button 
                                type="button"
                                onClick={() => navigate(`/preview/mat-${editingStory?.id || 'edit'}-${idx}?storyId=${editingStory?.id || ''}`, {
                                  state: {
                                    file: {
                                      ...material,
                                      id: `mat-${editingStory?.id || 'edit'}-${idx}`,
                                      title: material.title || material.fileName
                                    },
                                    files: (editStoryForm.studyMaterials || []).map((m, i) => ({
                                      ...m,
                                      id: `mat-${editingStory?.id || 'edit'}-${i}`,
                                      title: m.title || m.fileName
                                    })),
                                    storyTitle: editStoryForm.name
                                  }
                                })}
                                className="btn btn-secondary"
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                              >
                                View File
                              </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updatedMaterials = editStoryForm.studyMaterials.filter((_, i) => i !== idx);
                                setEditStoryForm({ ...editStoryForm, studyMaterials: updatedMaterials });
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem', color: '#ff453a', border: 'none', background: 'transparent', cursor: 'pointer' }}
                              title="Remove File"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '1.5rem', textAlign: 'left' }}>
                      No study materials attached to this story.
                    </p>
                  )}

                  {/* Drag and Drop File Selector inside Edit Modal */}
                  <div style={{
                    padding: '1.25rem',
                    border: '1px dashed var(--border-color)',
                    borderRadius: '16px',
                    backgroundColor: 'var(--bg-secondary)',
                    textAlign: 'left'
                  }}>
                    <h5 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                      Add Study Material
                    </h5>
                    
                    {/* Mock Dropzone Area */}
                    <div 
                      onClick={() => document.getElementById('edit-material-file-upload')?.click()}
                      style={{
                        border: editMaterialInput.previewUrl ? '2px solid var(--border-dropzone, #000000)' : '2px dashed var(--border-dropzone, #000000)',
                        borderRadius: '16px',
                        padding: editMaterialInput.previewUrl ? '1rem' : '1.5rem',
                        textAlign: 'center',
                        backgroundColor: 'var(--bg-dropzone, rgba(0, 0, 0, 0.02))',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '110px',
                        marginBottom: '1rem',
                        color: 'var(--text-primary)'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary, #0071e3)'}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-dropzone, #000000)'}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) processMaterialFile(file);
                      }}
                    >
                      <input 
                        type="file" 
                        id="edit-material-file-upload" 
                        onChange={handleEditFileChange} 
                        style={{ display: 'none' }}
                        accept=".pdf,.png,.jpg,.jpeg"
                      />
                      
                      {editMaterialInput.previewUrl ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', width: '100%' }}>
                          {editMaterialInput.type === 'Image' ? (
                            <div style={{ position: 'relative', width: '100%', height: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              <img 
                                src={editMaterialInput.previewUrl} 
                                alt="Selected preview" 
                                style={{ maxHeight: '100%', maxWidth: '100px', objectFit: 'contain', borderRadius: '6px' }}
                              />
                            </div>
                          ) : (
                            <FileText size={36} style={{ color: 'var(--text-primary)' }} />
                          )}
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, wordBreak: 'break-all', color: 'var(--text-primary)' }}>
                            {editMaterialInput.fileName}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {editMaterialInput.fileSize}
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                          <Plus size={24} style={{ color: 'var(--text-secondary)' }} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                            Drag & drop study material here, or click to browse
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Supports PDF, PNG, JPG
                          </span>
                        </div>
                      )}
                    </div>

                    {editMaterialInput.previewUrl && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.75rem' }}>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="input-label" style={{ fontSize: '0.7rem' }}>Material Title *</label>
                            <input 
                              type="text" 
                              value={editMaterialInput.title}
                              onChange={(e) => setEditMaterialInput({ ...editMaterialInput, title: e.target.value })}
                              className="input-field" 
                              placeholder="Material Title"
                              style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', backgroundColor: 'var(--bg-primary)' }}
                            />
                          </div>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="input-label" style={{ fontSize: '0.7rem' }}>File Type *</label>
                            <select 
                              value={editMaterialInput.type}
                              onChange={(e) => setEditMaterialInput({ ...editMaterialInput, type: e.target.value })}
                              className="input-field"
                              style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', backgroundColor: 'var(--bg-primary)' }}
                            >
                              <option value="PDF">PDF Document</option>
                              <option value="Image">Image Roadmap</option>
                              <option value="Notes">Notes File</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditMaterialInput({ title: '', type: 'PDF', fileName: '', fileSize: '', previewUrl: '' });
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', borderRadius: '8px' }}
                          >
                            Clear File
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editMaterialInput.title.trim()) {
                                const newMaterial = {
                                  title: editMaterialInput.title.trim(),
                                  type: editMaterialInput.type,
                                  previewUrl: editMaterialInput.previewUrl,
                                  fileName: editMaterialInput.fileName || (editMaterialInput.title.trim().toLowerCase().replace(/\s+/g, '_') + (editMaterialInput.type === 'PDF' ? '.pdf' : '.png')),
                                  fileSize: editMaterialInput.fileSize
                                };
                                const updatedMaterials = [...(editStoryForm.studyMaterials || []), newMaterial];
                                setEditStoryForm({ ...editStoryForm, studyMaterials: updatedMaterials });
                                setEditMaterialInput({ title: '', type: 'PDF', fileName: '', fileSize: '', previewUrl: '' });
                              } else {
                                alert('Please provide a title for the material.');
                              }
                            }}
                            className="btn btn-primary"
                            style={{ padding: '0.45rem 1.2rem', fontSize: '0.8rem', borderRadius: '8px' }}
                          >
                            Add to Story
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                  Save Story Details
                </button>
              </form>
            ) : editingType === 'resource' ? (
              <form onSubmit={handleSaveResource}>
                <div className="input-group">
                  <label className="input-label">Title *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editResourceForm.title} 
                    onChange={e => setEditResourceForm({ ...editResourceForm, title: e.target.value })} 
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Category *</label>
                    <select
                      className="input-field"
                      value={editResourceForm.category}
                      onChange={e => setEditResourceForm({ ...editResourceForm, category: e.target.value })}
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    >
                      <option value="Coding">Coding</option>
                      <option value="College Subjects">College Subjects</option>
                      <option value="Web Development">Web Development</option>
                      <option value="CSE">CSE</option>
                      <option value="Placement">Placement</option>
                    </select>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">File Type *</label>
                    <select
                      className="input-field"
                      value={editResourceForm.type}
                      onChange={e => setEditResourceForm({ ...editResourceForm, type: e.target.value })}
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    >
                      <option value="PDF">PDF</option>
                      <option value="Link">Link</option>
                      <option value="Note">Note</option>
                      <option value="Sheet">Sheet</option>
                      <option value="Roadmap">Roadmap</option>
                      <option value="Interview Questions">Interview Questions</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Folder Location *</label>
                    <select
                      className="input-field"
                      value={editResourceForm.folderId}
                      onChange={e => setEditResourceForm({ ...editResourceForm, folderId: e.target.value })}
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    >
                      {folders.map(f => (
                        <option key={f.id} value={f.id}>{getFolderName(f.id) || f.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">File Link / URL</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={editResourceForm.link} 
                      onChange={e => setEditResourceForm({ ...editResourceForm, link: e.target.value })} 
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                  Save Resource Details
                </button>
              </form>
            ) : editingType === 'user' ? (
              <form onSubmit={handleSaveUser}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Email Address (Read-only)</label>
                    <input 
                      type="email" 
                      className="input-field" 
                      value={editingItem.email} 
                      disabled 
                      style={{ opacity: 0.7 }}
                    />
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Password</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Leave blank to keep current password"
                      value={editUserForm.password} 
                      onChange={e => setEditUserForm({ ...editUserForm, password: e.target.value })} 
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Full Name</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="User's name"
                      value={editUserForm.name} 
                      onChange={e => setEditUserForm({ ...editUserForm, name: e.target.value })} 
                    />
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Role</label>
                    <select
                      className="input-field"
                      value={editUserForm.role}
                      onChange={e => setEditUserForm({ ...editUserForm, role: e.target.value })}
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      disabled={editingItem.email.toLowerCase() === 'admin@spit.ac.in'}
                    >
                      <option value="Student">Student</option>
                      <option value="Senior / Contributor">Senior / Contributor</option>
                      <option value="Alumni / Contributor">Alumni / Contributor</option>
                      <option value="Administrator">Administrator</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Branch</label>
                    <select
                      className="input-field"
                      value={editUserForm.branch}
                      onChange={e => setEditUserForm({ ...editUserForm, branch: e.target.value })}
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    >
                      <option value="CSE">CSE</option>
                      <option value="CSE AI">CSE AI</option>
                      <option value="CSE DS">CSE DS</option>
                      <option value="CE">CE</option>
                      <option value="EXTC">EXTC</option>
                    </select>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Current Year</label>
                    <select
                      className="input-field"
                      value={editUserForm.currentYear}
                      onChange={e => setEditUserForm({ ...editUserForm, currentYear: e.target.value })}
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    >
                      <option value="First Year">First Year</option>
                      <option value="Second Year">Second Year</option>
                      <option value="Third Year">Third Year</option>
                      <option value="Fourth Year">Fourth Year</option>
                      <option value="Alumnus / Graduate">Alumnus / Graduate</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Status</label>
                    <select
                      className="input-field"
                      value={editUserForm.status}
                      onChange={e => setEditUserForm({ ...editUserForm, status: e.target.value })}
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Onboarding Completed</label>
                    <select
                      className="input-field"
                      value={editUserForm.onboarded ? "true" : "false"}
                      onChange={e => setEditUserForm({ ...editUserForm, onboarded: e.target.value === "true" })}
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    >
                      <option value="true">Yes (True)</option>
                      <option value="false">No (False)</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  Save User Details
                </button>
              </form>
            ) : (
              <form onSubmit={handleSaveAchievement}>
                <div className="input-group">
                  <label className="input-label">Title *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editAchievementForm.title} 
                    onChange={e => setEditAchievementForm({ ...editAchievementForm, title: e.target.value })} 
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Category *</label>
                    <select 
                      className="input-field" 
                      value={editAchievementForm.category} 
                      onChange={e => setEditAchievementForm({ ...editAchievementForm, category: e.target.value })}
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <option value="Hackathon Winners">Hackathon Winners</option>
                      <option value="Placement Successes">Placement Successes</option>
                      <option value="Internship Achievements">Internship Achievements</option>
                      <option value="Competition Winners">Competition Winners</option>
                      <option value="Research Publications">Research Publications</option>
                    </select>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Date *</label>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={editAchievementForm.date} 
                      onChange={e => setEditAchievementForm({ ...editAchievementForm, date: e.target.value })} 
                      required
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Achievement Image (Upload or URL)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <div 
                      onClick={() => document.getElementById('edit-achievement-image-upload')?.click()}
                      style={{
                        border: editAchievementForm.image ? '2px solid var(--border-dropzone, #000000)' : '2px dashed var(--border-dropzone, #000000)',
                        borderRadius: '16px',
                        padding: '1rem',
                        textAlign: 'center',
                        backgroundColor: 'var(--bg-dropzone, rgba(0, 0, 0, 0.02))',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '100px',
                        color: 'var(--text-primary)'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary, #0071e3)'}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-dropzone, #000000)'}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) processEditAchievementImage(file);
                      }}
                    >
                      <input 
                        type="file" 
                        id="edit-achievement-image-upload" 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) processEditAchievementImage(file);
                        }} 
                        style={{ display: 'none' }}
                        accept="image/*"
                      />
                      {editAchievementForm.image ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                              <img src={editAchievementForm.image} alt="Achievement" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Image Selected</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {editAchievementForm.image}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditAchievementForm({ ...editAchievementForm, image: '' });
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem', color: '#ff453a', border: 'none', background: 'transparent', cursor: 'pointer' }}
                            title="Remove Image"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Plus size={22} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, margin: 0 }}>
                            Click to select an image, or drop here
                          </p>
                        </>
                      )}
                    </div>
                    
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Or paste image URL directly"
                        value={editAchievementForm.image.startsWith('data:') ? '' : editAchievementForm.image} 
                        onChange={e => setEditAchievementForm({ ...editAchievementForm, image: e.target.value })} 
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  {(() => {
                    const slidersData = parseSliders(editAchievementForm.imagePosition);
                    const activeSlider = editTab === 'outer' ? slidersData.outer : slidersData.inner;
                    return (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                          <div className="input-group">
                            <label className="input-label">Image Fitting Selection</label>
                            <select
                              className="input-field"
                              value={editAchievementForm.imageFit || 'crop'}
                               onChange={(e) => {
                                 const val = e.target.value;
                                 if (val === 'crop') {
                                   setEditAchievementForm({ 
                                     ...editAchievementForm, 
                                     imageFit: 'crop', 
                                     imagePosition: 'crop:10,0,80,33;10,0,80,24'
                                   });
                                 } else if (val === 'cover') {
                                   setEditAchievementForm({ 
                                     ...editAchievementForm, 
                                     imageFit: 'cover', 
                                     imagePosition: 'sliders:48,0,1.8;50,50,1.0'
                                   });
                                 } else {
                                   setEditAchievementForm({ 
                                     ...editAchievementForm, 
                                     imageFit: 'contain', 
                                     imagePosition: 'center'
                                   });
                                 }
                               }}
                               style={{ backgroundColor: 'var(--bg-secondary)' }}
                             >
                               <option value="crop">Visual Crop Tool (Recommended)</option>
                               <option value="cover">Presets / Manual Sliders (Cover)</option>
                               <option value="contain">Show Full Image (Contain)</option>
                             </select>
                           </div>

                           <div className="input-group">
                             <label className="input-label">Image Presets / Manual</label>
                             <select
                               className="input-field"
                               value={['center', 'top', 'bottom', 'left', 'right'].includes(editAchievementForm.imagePosition) ? editAchievementForm.imagePosition : 'custom'}
                               onChange={(e) => {
                                 const val = e.target.value;
                                 if (val === 'custom') {
                                   setEditAchievementForm({ ...editAchievementForm, imagePosition: 'sliders:48,0,1.8;50,50,1.0', imageFit: 'cover' });
                                 } else {
                                   setEditAchievementForm({ ...editAchievementForm, imagePosition: val, imageFit: 'cover' });
                                 }
                               }}
                              style={{ backgroundColor: 'var(--bg-secondary)' }}
                              disabled={editAchievementForm.imageFit === 'contain' || editAchievementForm.imageFit === 'crop'}
                            >
                              <option value="center">Center</option>
                              <option value="top">Top</option>
                              <option value="bottom">Bottom</option>
                              <option value="left">Left</option>
                              <option value="right">Right</option>
                              <option value="custom">Manual Sliders (X, Y & Zoom)</option>
                            </select>
                          </div>
                        </div>

                        {['crop', 'cover'].includes(editAchievementForm.imageFit) && editAchievementForm.image && (
                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <button
                              type="button"
                              className="btn"
                              style={{
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.8rem',
                                borderRadius: '8px',
                                backgroundColor: editTab === 'outer' ? 'var(--accent-color, #007aff)' : 'var(--bg-secondary)',
                                color: editTab === 'outer' ? '#ffffff' : 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                              onClick={() => setEditTab('outer')}
                            >
                              {editAchievementForm.imageFit === 'crop' ? 'Outer Card Crop (Listing)' : 'Outer Card Sliders (Listing)'}
                            </button>
                            <button
                              type="button"
                              className="btn"
                              style={{
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.8rem',
                                borderRadius: '8px',
                                backgroundColor: editTab === 'inner' ? 'var(--accent-color, #007aff)' : 'var(--bg-secondary)',
                                color: editTab === 'inner' ? '#ffffff' : 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                              onClick={() => setEditTab('inner')}
                            >
                              {editAchievementForm.imageFit === 'crop' ? 'Inner View Crop (Details)' : 'Inner View Sliders (Details)'}
                            </button>
                          </div>
                        )}

                        {editAchievementForm.imageFit === 'crop' && editAchievementForm.image && (
                          <div style={{ marginBottom: '1.25rem' }}>
                            <ImageCropper
                              imageUrl={editAchievementForm.image}
                              imagePosition={editAchievementForm.imagePosition}
                              onChangePosition={(posStr) => setEditAchievementForm({ ...editAchievementForm, imagePosition: posStr })}
                              activeTab={editTab}
                            />
                          </div>
                        )}

                        {editAchievementForm.imageFit === 'cover' && editAchievementForm.image && (
                          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                  <span>Horizontal Offset (X-Axis): {activeSlider.x}%</span>
                                </div>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  value={activeSlider.x} 
                                  onChange={(e) => {
                                    const updated = {
                                      ...slidersData,
                                      [editTab]: { ...activeSlider, x: parseInt(e.target.value) }
                                    };
                                    setEditAchievementForm({ 
                                      ...editAchievementForm, 
                                      imagePosition: `sliders:${updated.outer.x},${updated.outer.y},${updated.outer.zoom};${updated.inner.x},${updated.inner.y},${updated.inner.zoom}` 
                                    });
                                  }}
                                  style={{ width: '100%', cursor: 'pointer' }}
                                />
                              </div>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                  <span>Vertical Offset (Y-Axis): {activeSlider.y}%</span>
                                </div>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  value={activeSlider.y} 
                                  onChange={(e) => {
                                    const updated = {
                                      ...slidersData,
                                      [editTab]: { ...activeSlider, y: parseInt(e.target.value) }
                                    };
                                    setEditAchievementForm({ 
                                      ...editAchievementForm, 
                                      imagePosition: `sliders:${updated.outer.x},${updated.outer.y},${updated.outer.zoom};${updated.inner.x},${updated.inner.y},${updated.inner.zoom}` 
                                    });
                                  }}
                                  style={{ width: '100%', cursor: 'pointer' }}
                                />
                              </div>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                  <span>Zoom Scale: {activeSlider.zoom}x</span>
                                </div>
                                <input 
                                  type="range" 
                                  min="1.0" 
                                  max="3.0" 
                                  step="0.1"
                                  value={activeSlider.zoom} 
                                  onChange={(e) => {
                                    const updated = {
                                      ...slidersData,
                                      [editTab]: { ...activeSlider, zoom: parseFloat(e.target.value) }
                                    };
                                    setEditAchievementForm({ 
                                      ...editAchievementForm, 
                                      imagePosition: `sliders:${updated.outer.x},${updated.outer.y},${updated.outer.zoom};${updated.inner.x},${updated.inner.y},${updated.inner.zoom}` 
                                    });
                                  }}
                                  style={{ width: '100%', cursor: 'pointer' }}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {editAchievementForm.image && (
                          <div style={{
                            marginBottom: '1.25rem',
                            padding: '1rem',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '16px'
                          }}>
                            <h4 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                              Live Crop & Fitting Previews
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                              <div>
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                                  Outer Card (Listing) - Aspect Ratio ~2.42
                                </span>
                                <div style={{
                                  height: '110px',
                                  width: '264px',
                                  overflow: 'hidden',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border-color)',
                                  position: 'relative',
                                  backgroundColor: 'var(--bg-primary)'
                                }}>
                                  {(() => {
                                    const isCrop = editAchievementForm.imageFit === 'crop' && editAchievementForm.imagePosition && editAchievementForm.imagePosition.startsWith('crop:');
                                    if (isCrop) {
                                      const cropData = parseCrop(editAchievementForm.imagePosition);
                                      const { x, y, w, h } = cropData.outer;
                                      return (
                                        <img 
                                          src={editAchievementForm.image} 
                                          alt="Outer Card Preview" 
                                          style={{
                                            position: 'absolute',
                                            width: `${10000 / w}%`,
                                            height: `${10000 / h}%`,
                                            left: `${-x * (100 / w)}%`,
                                            top: `${-y * (100 / h)}%`,
                                            objectFit: 'cover'
                                          }}
                                        />
                                      );
                                    }
                                    const p = slidersData.outer;
                                    return (
                                      <img 
                                        src={editAchievementForm.image} 
                                        alt="Outer Card Preview" 
                                        style={{
                                          position: 'absolute',
                                          width: `${p.zoom * 100}%`,
                                          height: `${p.zoom * 100}%`,
                                          left: `${-p.x * (p.zoom - 1)}%`,
                                          top: `${-p.y * (p.zoom - 1)}%`,
                                          objectFit: 'cover',
                                          objectPosition: `${p.x}% ${p.y}%`
                                        }}
                                      />
                                    );
                                  })()}
                                </div>
                              </div>
                              <div>
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                                  Inner View (Details) - Aspect Ratio ~3.33
                                </span>
                                <div style={{
                                  height: '78px',
                                  width: '260px',
                                  overflow: 'hidden',
                                  borderRadius: '12px',
                                  border: '1px solid var(--border-color)',
                                  position: 'relative',
                                  backgroundColor: 'var(--bg-primary)'
                                }}>
                                  {(() => {
                                    const isCrop = editAchievementForm.imageFit === 'crop' && editAchievementForm.imagePosition && editAchievementForm.imagePosition.startsWith('crop:');
                                    if (isCrop) {
                                      const cropData = parseCrop(editAchievementForm.imagePosition);
                                      const { x, y, w, h } = cropData.inner;
                                      return (
                                        <img 
                                          src={editAchievementForm.image} 
                                          alt="Inner View Preview" 
                                          style={{
                                            position: 'absolute',
                                            width: `${10000 / w}%`,
                                            height: `${10000 / h}%`,
                                            left: `${-x * (100 / w)}%`,
                                            top: `${-y * (100 / h)}%`,
                                            objectFit: 'cover'
                                          }}
                                        />
                                      );
                                    }
                                    const p = slidersData.inner;
                                    return (
                                      <img 
                                        src={editAchievementForm.image} 
                                        alt="Inner View Preview" 
                                        style={{
                                          position: 'absolute',
                                          width: `${p.zoom * 100}%`,
                                          height: `${p.zoom * 100}%`,
                                          left: `${-p.x * (p.zoom - 1)}%`,
                                          top: `${-p.y * (p.zoom - 1)}%`,
                                          objectFit: 'cover',
                                          objectPosition: `${p.x}% ${p.y}%`
                                        }}
                                      />
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  <div className="input-group">
                  <label className="input-label">Description *</label>
                  <textarea 
                    className="input-field" 
                    rows={6} 
                    value={editAchievementForm.description} 
                    onChange={e => setEditAchievementForm({ ...editAchievementForm, description: e.target.value })} 
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                  Save Achievement Details
                </button>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Glassmorphic Preview Story Details Overlay Modal */}
      {previewingPendingStory && createPortal(
        <div 
          onClick={() => setPreviewingPendingStory(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
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
            className="glass-panel animate-fade-in custom-scrollbar" 
            style={{
              margin: 'auto',
              width: '100%',
              maxWidth: '750px',
              borderRadius: '24px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              position: 'relative',
              padding: '2.5rem',
              maxHeight: 'calc(100vh - 4rem)',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.4), 0 0 1px 1px rgba(255, 255, 255, 0.1) inset'
            }}
          >
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPreviewingPendingStory(null);
              }}
              style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                zIndex: 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Close (Esc)"
            >
              <X size={20} />
            </button>

            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              <span className="badge" style={{ fontSize: '0.7rem', marginBottom: '0.5rem', backgroundColor: previewingPendingStory.requestType === 'delete' ? 'rgba(255, 69, 58, 0.15)' : previewingPendingStory.requestType === 'edit' ? 'rgba(0, 122, 255, 0.15)' : 'var(--bg-secondary)', color: previewingPendingStory.requestType === 'delete' ? '#ff453a' : previewingPendingStory.requestType === 'edit' ? '#0a84ff' : 'var(--text-primary)' }}>
                {previewingPendingStory.requestType === 'delete' ? 'Deletion Approval Request' : previewingPendingStory.requestType === 'edit' ? 'Edit Approval Request' : 'Pending Senior Story Preview'}
              </span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {previewingPendingStory.name}
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {previewingPendingStory.branch} Class of {previewingPendingStory.passoutYear} • Placed: {previewingPendingStory.company} ({previewingPendingStory.role}) • Sem {previewingPendingStory.semester} • CGPA {previewingPendingStory.cgpa || 'N/A'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
              {/* Journey Details */}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                  Four-Year Journey
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: '0.5rem' }}>
                  {previewingPendingStory.journey?.firstYear && (
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                      <strong>1st Year:</strong> {previewingPendingStory.journey.firstYear}
                    </p>
                  )}
                  {previewingPendingStory.journey?.secondYear && (
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                      <strong>2nd Year:</strong> {previewingPendingStory.journey.secondYear}
                    </p>
                  )}
                  {previewingPendingStory.journey?.thirdYear && (
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                      <strong>3rd Year:</strong> {previewingPendingStory.journey.thirdYear}
                    </p>
                  )}
                  {previewingPendingStory.journey?.fourthYear && (
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                      <strong>4th Year:</strong> {previewingPendingStory.journey.fourthYear}
                    </p>
                  )}
                </div>
              </div>

              {previewingPendingStory.journey?.prep && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                    Preparation Strategy & Tips
                  </h3>
                  <p style={{ fontSize: '0.9rem', lineHeight: '1.6', paddingLeft: '0.5rem', whiteSpace: 'pre-wrap', margin: 0 }}>
                    {previewingPendingStory.journey.prep}
                  </p>
                </div>
              )}

              {previewingPendingStory.journey?.projects && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                    Projects Built
                  </h3>
                  <div style={{ paddingLeft: '0.5rem', whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: '1.6' }}>
                    {previewingPendingStory.journey.projects}
                  </div>
                </div>
              )}

              {previewingPendingStory.journey?.howSecured && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                    How I Secured the Role
                  </h3>
                  <p style={{ fontSize: '0.9rem', lineHeight: '1.6', paddingLeft: '0.5rem', margin: 0 }}>
                    {previewingPendingStory.journey.howSecured}
                  </p>
                </div>
              )}

              {/* Resume File */}
              {(previewingPendingStory.resumeFile || previewingPendingStory.resume) && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                    Resume
                  </h3>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    marginLeft: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <FileText size={20} style={{ color: '#ff3b30' }} />
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                        {previewingPendingStory.resumeFile?.fileName || 
                         (typeof previewingPendingStory.resume === 'object' ? previewingPendingStory.resume.fileName : previewingPendingStory.resume)}
                      </span>
                    </div>
                    <button 
                      onClick={() => {
                        const rf = previewingPendingStory.resumeFile;
                        const cr = previewingPendingStory.resume;
                        const resUrl = getResourceFileUrl({ resumeFile: rf, resume: cr, url: rf?.url });
                        const resumeDoc = {
                          id: `resume-${previewingPendingStory.id}`,
                          title: `${previewingPendingStory.name}'s Resume`,
                          type: 'PDF',
                          fileName: rf?.fileName || (typeof cr === 'object' ? cr.fileName : (cr || 'resume.pdf')),
                          fileSize: rf?.fileSize || '',
                          url: resUrl || '',
                          previewUrl: resUrl || ''
                        };
                        navigate(`/preview/${resumeDoc.id}?storyId=${previewingPendingStory.id}&pending=true`, {
                          state: {
                            file: resumeDoc,
                            files: [resumeDoc],
                            storyTitle: previewingPendingStory.name
                          }
                        });
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      View Resume
                    </button>
                  </div>
                </div>
              )}

              {/* Study Materials */}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                  Study Materials Uploaded
                </h3>
                {previewingPendingStory.studyMaterials && previewingPendingStory.studyMaterials.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '0.5rem' }}>
                    {previewingPendingStory.studyMaterials.map((mat, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <FileText size={18} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{mat.title}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {mat.type} {mat.fileName ? `• ${mat.fileName}` : ''}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            const pendingMatDoc = {
                              ...mat,
                              id: `mat-${previewingPendingStory.id}-${idx}`,
                              title: mat.title || mat.fileName
                            };
                            navigate(`/preview/${pendingMatDoc.id}?storyId=${previewingPendingStory.id}&pending=true`, {
                              state: {
                                file: pendingMatDoc,
                                files: (previewingPendingStory.studyMaterials || []).map((m, i) => ({
                                  ...m,
                                  id: `mat-${previewingPendingStory.id}-${i}`,
                                  title: m.title || m.fileName
                                })),
                                storyTitle: previewingPendingStory.name
                              }
                            });
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          View File
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginLeft: '0.5rem', margin: 0 }}>
                    No study materials uploaded for this story.
                  </p>
                )}
              </div>

              {/* Resources Used */}
              {previewingPendingStory.resources && previewingPendingStory.resources.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                    Resources Used
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginLeft: '0.5rem' }}>
                    {previewingPendingStory.resources.map((res, idx) => {
                      const link = getResourceLink(res);
                      return link ? (
                        <a
                          key={idx}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glass-panel"
                          title={`Open ${link} in a new tab`}
                          style={{
                            padding: '0.5rem 0.85rem',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.85rem',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            textDecoration: 'none',
                            cursor: 'pointer',
                            maxWidth: '100%',
                            overflowWrap: 'anywhere'
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{res.name}</span>
                          {res.type && <span className="badge" style={{ fontSize: '0.65rem' }}>{res.type}</span>}
                          <ExternalLink size={12} style={{ color: 'var(--text-secondary)' }} />
                        </a>
                      ) : (
                        <div
                          key={idx}
                          className="glass-panel"
                          style={{
                            padding: '0.5rem 0.85rem',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.85rem',
                            border: '1px solid var(--border-color)',
                            maxWidth: '100%',
                            overflowWrap: 'anywhere'
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{res.name}</span>
                          {res.type && <span className="badge" style={{ fontSize: '0.65rem' }}>{res.type}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{
              marginTop: '2.5rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <button
                onClick={() => setPreviewingPendingStory(null)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1.25rem', borderRadius: '10px', cursor: 'pointer' }}
              >
                Close Preview
              </button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => {
                    handleRejectStory(previewingPendingStory.id || previewingPendingStory._id);
                    setPreviewingPendingStory(null);
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1.25rem', color: '#ff453a', borderColor: 'rgba(255, 69, 58, 0.2)', borderRadius: '10px', cursor: 'pointer' }}
                >
                  <X size={14} style={{ marginRight: '0.25rem' }} /> {previewingPendingStory.requestType === 'delete' ? 'Reject Deletion' : previewingPendingStory.requestType === 'edit' ? 'Reject Edits' : 'Reject Submission'}
                </button>
                <button
                  onClick={() => {
                    handleApproveStory(previewingPendingStory.id || previewingPendingStory._id);
                    setPreviewingPendingStory(null);
                  }}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.5rem', backgroundColor: '#30d158', borderColor: '#30d158', color: '#fff', borderRadius: '10px', cursor: 'pointer' }}
                >
                  <Check size={14} style={{ marginRight: '0.25rem' }} /> {previewingPendingStory.requestType === 'delete' ? 'Approve Deletion' : previewingPendingStory.requestType === 'edit' ? 'Approve Edits' : 'Approve & Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Glassmorphic Preview Resource Details Overlay Modal */}
      {previewingPendingResource && createPortal(
        <div 
          onClick={() => setPreviewingPendingResource(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
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
            className="glass-panel animate-fade-in custom-scrollbar" 
            style={{
              margin: 'auto',
              width: '100%',
              maxWidth: '550px',
              borderRadius: '24px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              position: 'relative',
              padding: '2.5rem',
              maxHeight: 'calc(100vh - 4rem)',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.4), 0 0 1px 1px rgba(255, 255, 255, 0.1) inset'
            }}
          >
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPreviewingPendingResource(null);
              }}
              style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                zIndex: 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Close (Esc)"
            >
              <X size={20} />
            </button>

            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              <span className="badge" style={{ fontSize: '0.7rem', marginBottom: '0.5rem', backgroundColor: previewingPendingResource.requestType === 'delete' ? 'rgba(255, 69, 58, 0.15)' : 'var(--bg-secondary)', color: previewingPendingResource.requestType === 'delete' ? '#ff453a' : 'var(--text-primary)' }}>
                {previewingPendingResource.requestType === 'delete' ? 'Deletion Approval Request' : 'Pending Resource Preview'}
              </span>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {previewingPendingResource.title}
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                Category: {previewingPendingResource.category} • File Type: {previewingPendingResource.type}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
              <div>
                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.25rem', margin: 0 }}>
                  Uploaded By
                </p>
                <p style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>{previewingPendingResource.uploadedBy}</p>
              </div>

              <div>
                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.25rem', margin: 0 }}>
                  Target Folder / Year
                </p>
                <p style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>{getFolderName(previewingPendingResource.folderId) || previewingPendingResource.folder || 'Not Specified'}</p>
              </div>

              <div>
                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.25rem', margin: 0 }}>
                  Submission Date
                </p>
                <p style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>{previewingPendingResource.date || new Date().toISOString().split('T')[0]}</p>
              </div>

              <div style={{
                marginTop: '0.5rem',
                border: '1px dashed var(--border-color)',
                borderRadius: '16px',
                padding: '1.5rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem'
              }}>
                <FileText size={32} style={{ color: 'var(--text-secondary)' }} />
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Study Material Document</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>Inspect the file content in the sandbox document viewer</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/preview/${previewingPendingResource.id}?pending=true`, {
                    state: {
                      file: previewingPendingResource,
                      files: [previewingPendingResource],
                      folderName: getFolderName(previewingPendingResource.folderId) || 'Pending Resource'
                    }
                  })}
                  className="btn btn-secondary"
                  style={{ padding: '0.45rem 1.25rem', fontSize: '0.8rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Preview File Content
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{
              marginTop: '2.5rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <button
                onClick={() => setPreviewingPendingResource(null)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1.25rem', borderRadius: '10px', cursor: 'pointer' }}
              >
                Close Preview
              </button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => {
                    handleRejectResource(previewingPendingResource.id || previewingPendingResource._id);
                    setPreviewingPendingResource(null);
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1.25rem', color: '#ff453a', borderColor: 'rgba(255, 69, 58, 0.2)', borderRadius: '10px', cursor: 'pointer' }}
                >
                  <X size={14} style={{ marginRight: '0.25rem' }} /> {previewingPendingResource.requestType === 'delete' ? 'Reject Deletion' : 'Reject'}
                </button>
                <button
                  onClick={() => {
                    handleApproveResource(previewingPendingResource.id || previewingPendingResource._id);
                    setPreviewingPendingResource(null);
                  }}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.5rem', backgroundColor: '#30d158', borderColor: '#30d158', color: '#fff', borderRadius: '10px', cursor: 'pointer' }}
                >
                  <Check size={14} style={{ marginRight: '0.25rem' }} /> {previewingPendingResource.requestType === 'delete' ? 'Approve Deletion' : 'Approve & Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Move Resource / File Modal */}
      {movingResourceItem && createPortal(
        <div
          className="modal-backdrop"
          onClick={() => setMovingResourceItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: '2.5rem 1rem',
            overflowY: 'auto',
            overscrollBehavior: 'contain'
          }}
        >
          <div
            className="loop-card custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
            style={{
              margin: 'auto',
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              padding: '2rem',
              maxHeight: 'calc(100vh - 4rem)',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              position: 'relative'
            }}
          >
            <button
              type="button"
              onClick={() => setMovingResourceItem(null)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FolderInput size={20} style={{ color: 'var(--accent-primary)' }} />
              <span>Move Document / File</span>
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Moving document: <strong style={{ color: 'var(--text-primary)' }}>{movingResourceItem.title}</strong>
            </p>

            <form onSubmit={handleSaveMoveResource} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Destination Folder *</label>
                <select
                  value={targetMoveFolderId}
                  onChange={(e) => setTargetMoveFolderId(e.target.value)}
                  className="input-field"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  required
                >
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.isSystemFolder ? '📁 [System] ' : '📂 '} {getFolderName(f.id) || f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setMovingResourceItem(null)}
                  className="btn btn-secondary"
                  style={{ padding: '0.6rem 1.25rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <FolderInput size={15} /> Confirm Move
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Folder Modal */}
      {editingFolderItem && createPortal(
        <div 
          className="modal-backdrop" 
          onClick={() => setEditingFolderItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: '2.5rem 1rem',
            overflowY: 'auto',
            overscrollBehavior: 'contain'
          }}
        >
          <div 
            className="loop-card custom-scrollbar" 
            onClick={(e) => e.stopPropagation()}
            style={{
              margin: 'auto',
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              padding: '2rem',
              maxHeight: 'calc(100vh - 4rem)',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              position: 'relative'
            }}
          >
            <button
              type="button"
              onClick={() => setEditingFolderItem(null)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Edit size={20} style={{ color: 'var(--accent-primary)' }} />
              <span>Edit / Rename Folder</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Folder ID: <code style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{editingFolderItem.id}</code>
            </p>

            <form onSubmit={handleSaveEditFolder} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Folder Name *</label>
                <input
                  type="text"
                  value={folderRenameInput}
                  onChange={(e) => setFolderRenameInput(e.target.value)}
                  className="input-field"
                  required
                  autoFocus
                />
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Visibility</label>
                <select
                  value={folderVisibilityInput}
                  onChange={(e) => setFolderVisibilityInput(e.target.value)}
                  className="input-field"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  <option value="public">🌐 Public (All students can view)</option>
                  <option value="private">🔒 Private (Restricted)</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Description (Optional)</label>
                <textarea
                  value={folderDescriptionInput}
                  onChange={(e) => setFolderDescriptionInput(e.target.value)}
                  className="input-field"
                  rows={3}
                  placeholder="Notes or description for this folder..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingFolderItem(null)}
                  className="btn btn-secondary"
                  style={{ padding: '0.6rem 1.25rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.6rem 1.5rem' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}


      {isAuditModalOpen && auditModalUser && (
        <AdminUserAuditModal
          isOpen={isAuditModalOpen}
          onClose={() => {
            setIsAuditModalOpen(false);
            setAuditModalUser(null);
          }}
          user={auditModalUser}
        />
      )}

    </>
  );
}
