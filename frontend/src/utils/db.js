import { uploadResourceStream, formatBytes, formatSpeed, formatEta } from './upload';
import { localMockResources, localMockPendingStories, localMockPendingResources, localMockAchievements, localMockFolders, localMockStories, localMockUsers } from './localMockData';

const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '' : 'https://loop-qnh9.onrender.com';
const API_URL = `${BASE_URL}/api`;
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const fixRelativeUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('/uploads/')) {
    return `${BASE_URL}${url}`;
  }
  return url;
};

const adjustUrls = (data) => {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(item => adjustUrls(item));
  }
  if (typeof data === 'object') {
    const copy = { ...data };
    if (typeof copy.photo === 'string') {
      copy.photo = fixRelativeUrl(copy.photo);
    }
    if (typeof copy.resume === 'string') {
      copy.resume = fixRelativeUrl(copy.resume);
    }
    if (typeof copy.url === 'string') {
      copy.url = fixRelativeUrl(copy.url);
    }
    if (typeof copy.link === 'string') {
      copy.link = fixRelativeUrl(copy.link);
    }
    if (copy.resumeFile && typeof copy.resumeFile.url === 'string') {
      copy.resumeFile = {
        ...copy.resumeFile,
        url: fixRelativeUrl(copy.resumeFile.url)
      };
    }
    if (Array.isArray(copy.studyMaterials)) {
      copy.studyMaterials = copy.studyMaterials.map(mat => ({
        ...mat,
        url: typeof mat.url === 'string' ? fixRelativeUrl(mat.url) : mat.url
      }));
    }
    if (typeof copy.image === 'string') {
      copy.image = fixRelativeUrl(copy.image);
    }
    for (const key in copy) {
      if (copy[key] && typeof copy[key] === 'object' && key !== 'resumeFile' && key !== 'studyMaterials') {
        copy[key] = adjustUrls(copy[key]);
      }
    }
    return copy;
  }
  return data;
};


const authFetch = async (url, options = {}) => {
  const userSession = localStorage.getItem('loop_current_user');
  const headers = {
    ...options.headers,
  };
  if (userSession) {
    try {
      const { token } = JSON.parse(userSession);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      console.error("Error parsing session token:", e);
    }
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    if (!window.location.pathname.includes('/login')) {
      localStorage.removeItem('loop_current_user');
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }
  }
  return res;
};

const authFetchXHR = (url, options = {}, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method || 'GET', url);

    const userSession = localStorage.getItem('loop_current_user');
    const headers = { ...options.headers };
    if (userSession) {
      try {
        const { token } = JSON.parse(userSession);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error("Error parsing session token in XHR:", e);
      }
    }

    Object.keys(headers).forEach(key => {
      if (headers[key] !== undefined) {
        xhr.setRequestHeader(key, headers[key]);
      }
    });

    if (onProgress && xhr.upload) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      });
    }

    xhr.onload = () => {
      const responseBody = xhr.responseText;
      const ok = xhr.status >= 200 && xhr.status < 300;

      // Handle auth failures — delay redirect so the promise resolves first
      if ((xhr.status === 401 || xhr.status === 403) && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('loop_current_user');
        // Resolve with the error response so the caller can handle it
        let parsedJson = null;
        try { parsedJson = JSON.parse(responseBody); } catch (e) { parsedJson = { error: 'Session expired. Please login again.' }; }
        resolve({ ok: false, status: xhr.status, json: async () => parsedJson, text: async () => responseBody });
        // Delay navigation so we don't abort other in-flight requests
        setTimeout(() => { window.location.href = '/login'; }, 300);
        return;
      }

      let parsedJson = null;
      let parseAttempted = false;
      const getJson = async () => {
        if (!parseAttempted) {
          parseAttempted = true;
          try {
            parsedJson = JSON.parse(responseBody);
          } catch (e) {
            parsedJson = {};
          }
        }
        return parsedJson;
      };

      resolve({
        ok,
        status: xhr.status,
        json: getJson,
        text: async () => responseBody
      });
    };

    xhr.onerror = () => {
      reject(new Error('Network error during upload. Please check your connection.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out. Please try again.'));
    };

    xhr.timeout = 600000; // 10 minute timeout for large file uploads

    xhr.send(options.body || null);
  });
};



export const initDB = () => {
  // Database initialized and managed on backend side.
};

export const getStories = async (params = {}) => {
  let data = null;
  try {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${API_URL}/stories?${query}` : `${API_URL}/stories`;
    const res = await authFetch(url);
    if (res.ok) {
      data = await res.json();
    }
  } catch (e) {
    console.warn('[db] Failed to fetch stories from server:', e.message);
  }
  if (data === null) {
    return isLocal ? adjustUrls(localMockStories) : [];
  }
  const items = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);
  return adjustUrls(items);
};

export const getStoryById = async (id) => {
  try {
    const res = await authFetch(`${API_URL}/stories/${id}`);
    if (res.ok) {
      const data = await res.json();
      return adjustUrls(data);
    }
  } catch (e) {}
  if (isLocal) {
    const mock = localMockStories.find(m => String(m.id) === String(id));
    if (mock) return adjustUrls(mock);
  }
  throw new Error('Failed to fetch story details');
};

export const addStory = async (story) => {
  const res = await authFetch(`${API_URL}/stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(story)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to add story');
  }
  return res.json();
};

export const deleteStory = async (id) => {
  try {
    const res = await authFetch(`${API_URL}/stories/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) return res.json();
  } catch (e) {
    if (!isLocal) throw e;
  }
  if (isLocal) {
    return { success: true, message: 'Story deleted.' };
  }
  throw new Error('Failed to delete story');
};

export const updateStory = async (id, updatedStory) => {
  const res = await authFetch(`${API_URL}/stories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedStory)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to update story');
  }
  return res.json();
};

// Pending Stories Helpers
export const getPendingStories = async () => {
  let data = null;
  try {
    const res = await authFetch(`${API_URL}/pending-stories`);
    if (res.ok) {
      data = await res.json();
    }
  } catch (e) {
    console.warn('[db] Failed to fetch pending stories from server:', e.message);
  }
  if (data === null) {
    return isLocal ? adjustUrls(localMockPendingStories) : [];
  }
  return adjustUrls(data);
};

export const addPendingStory = async (story, onProgress) => {
  const res = await authFetchXHR(`${API_URL}/pending-stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(story)
  }, onProgress);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to add pending story');
  }
  return res.json();
};

export const approveStory = async (id) => {
  if (String(id).startsWith('pending-')) {
    const idx = localMockPendingStories.findIndex(s => String(s.id) === String(id) || String(s._id) === String(id));
    if (idx !== -1) localMockPendingStories.splice(idx, 1);
    return { success: true, message: 'Story approved.' };
  }
  const res = await authFetch(`${API_URL}/pending-stories/${id}/approve`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to approve story');
  }
  return res.json();
};

export const rejectPendingStory = async (id) => {
  if (String(id).startsWith('pending-')) {
    const idx = localMockPendingStories.findIndex(s => String(s.id) === String(id) || String(s._id) === String(id));
    if (idx !== -1) localMockPendingStories.splice(idx, 1);
    return { success: true, message: 'Story rejected.' };
  }
  const res = await authFetch(`${API_URL}/pending-stories/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to reject pending story');
  }
  return res.json();
};

// Resources Helpers
export const getResources = async (params = {}) => {
  let data = null;
  try {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${API_URL}/resources?${query}` : `${API_URL}/resources`;
    const res = await authFetch(url);
    if (res.ok) {
      data = await res.json();
    }
  } catch (e) {
    console.warn('[db] Failed to fetch resources from server:', e.message);
  }
  if (data === null) {
    return isLocal ? adjustUrls(localMockResources) : [];
  }
  const items = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);
  return adjustUrls(items);
};

export const getResourceById = async (id) => {
  try {
    const res = await authFetch(`${API_URL}/resources/${id}`);
    if (res.ok) {
      const data = await res.json();
      return adjustUrls(data);
    }
  } catch (e) {}
  if (isLocal) {
    const mock = localMockResources.find(m => String(m.id) === String(id));
    if (mock) return mock;
  }
  throw new Error('Resource not found');
};

export const addResource = async (resource) => {
  const res = await authFetch(`${API_URL}/resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resource)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to add resource');
  }
  return res.json();
};

export const deleteResource = async (id) => {
  try {
    const res = await authFetch(`${API_URL}/resources/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) return res.json();
  } catch (e) {
    if (!isLocal) throw e;
  }
  if (isLocal) {
    const idx = localMockResources.findIndex(r => String(r.id) === String(id) || String(r._id) === String(id));
    if (idx !== -1) localMockResources.splice(idx, 1);
    return { success: true, message: 'Resource removed.' };
  }
  throw new Error('Failed to delete resource');
};

export const updateResource = async (id, updatedResource) => {
  try {
    const res = await authFetch(`${API_URL}/resources/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedResource)
    });
    if (res.ok) return res.json();
  } catch (e) {
    if (!isLocal) throw e;
  }
  if (isLocal) {
    return { success: true, message: 'Resource updated.' };
  }
  throw new Error('Failed to update resource');
};

// Pending Resources Helpers
export const getPendingResources = async () => {
  let data = null;
  try {
    const res = await authFetch(`${API_URL}/pending-resources`);
    if (res.ok) {
      data = await res.json();
    }
  } catch (e) {
    console.warn('[db] Failed to fetch pending resources from server:', e.message);
  }
  if (data === null) {
    return isLocal ? adjustUrls(localMockPendingResources) : [];
  }
  return adjustUrls(data);
};

export const addPendingResource = async (resource, onProgress) => {
  const res = await authFetchXHR(`${API_URL}/pending-resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resource)
  }, onProgress);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to add pending resource');
  }
  return res.json();
};

export const approveResource = async (id) => {
  if (String(id).startsWith('pending-')) {
    const idx = localMockPendingResources.findIndex(r => String(r.id) === String(id) || String(r._id) === String(id));
    if (idx !== -1) localMockPendingResources.splice(idx, 1);
    return { success: true, message: 'Resource approved.' };
  }
  const res = await authFetch(`${API_URL}/pending-resources/${id}/approve`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to approve resource');
  }
  return res.json();
};

export const rejectPendingResource = async (id) => {
  if (String(id).startsWith('pending-')) {
    const idx = localMockPendingResources.findIndex(r => String(r.id) === String(id) || String(r._id) === String(id));
    if (idx !== -1) localMockPendingResources.splice(idx, 1);
    return { success: true, message: 'Resource rejected.' };
  }
  const res = await authFetch(`${API_URL}/pending-resources/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to reject pending resource');
  }
  return res.json();
};

// Achievements Helpers
export const getAchievements = async () => {
  let data = null;
  try {
    const res = await authFetch(`${API_URL}/achievements`);
    if (res.ok) {
      data = await res.json();
    }
  } catch (e) {
    console.warn('[db] Failed to fetch achievements from server:', e.message);
  }
  if (data === null) {
    return isLocal ? adjustUrls(localMockAchievements) : [];
  }
  return adjustUrls(data);
};

export const addAchievement = async (achievement) => {
  const res = await authFetch(`${API_URL}/achievements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(achievement)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to add achievement');
  }
  return res.json();
};

export const deleteAchievement = async (id) => {
  const res = await authFetch(`${API_URL}/achievements/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete achievement');
  return res.json();
};

export const updateAchievement = async (id, updatedAchievement) => {
  const res = await authFetch(`${API_URL}/achievements/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedAchievement)
  });
  if (!res.ok) throw new Error('Failed to update achievement');
  return res.json();
};

// User Management Helpers
export const getUsers = async (params = {}) => {
  let data = null;
  try {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${API_URL}/users?${query}` : `${API_URL}/users`;
    const res = await authFetch(url);
    if (res.ok) {
      data = await res.json();
    }
  } catch (e) {
    console.warn('[db] Failed to fetch users from server:', e.message);
  }
  if (data === null) {
    return isLocal ? localMockUsers : [];
  }
  return Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);
};

export const addUser = async (user) => {
  try {
    const res = await authFetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { success: true, user: { ...user, status: 'Active' } };
};

export const deleteUser = async (email) => {
  try {
    const res = await authFetch(`${API_URL}/users/${email}`, {
      method: 'DELETE'
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return { success: true, message: 'User deleted.' };
};

export const loginUser = async (email, password) => {
  const res = await fetch(`${API_URL}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to authenticate');
  }
  return res.json();
};

export const verifyGoogleAuth = async (idToken) => {
  const res = await fetch(`${API_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to authenticate with Google');
  }
  return data;
};

export const signupWithGoogle = async ({ idToken, name, username, password, confirmPassword }) => {
  const res = await fetch(`${API_URL}/auth/google/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, name, username, password, confirmPassword })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to complete Google signup');
  }
  return data;
};

export const linkGoogleAccount = async ({ idToken, password }) => {
  const res = await fetch(`${API_URL}/auth/google/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to link Google account');
  }
  return data;
};

export const onboardUser = async (email, profileData) => {
  const res = await authFetch(`${API_URL}/users/${email}/onboard`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profileData)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to submit onboarding form');
  }
  return res.json();
};

export const requestProfileEdit = async (email, profileData) => {
  const res = await authFetch(`${API_URL}/users/${email}/edit-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profileData)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to request profile edit');
  }
  return res.json();
};

export const approveProfileEdit = async (email) => {
  const res = await authFetch(`${API_URL}/users/${email}/approve-edit`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to approve profile edit');
  }
  return res.json();
};

export const rejectProfileEdit = async (email) => {
  const res = await authFetch(`${API_URL}/users/${email}/reject-edit`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to reject profile edit');
  }
  return res.json();
};

export const requestRegistration = async (email, password) => {
  const res = await fetch(`${API_URL}/users/register-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Registration is temporarily unavailable. Please try again later.');
  }
  return res.json();
};

export const approveRegistration = async (email) => {
  const res = await authFetch(`${API_URL}/users/${email}/approve-registration`, {
    method: 'POST'
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to approve registration');
  }
  return res.json();
};

export const updateUser = async (email, userData) => {
  const res = await authFetch(`${API_URL}/users/${email}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to update user');
  }
  return res.json();
};

// Folder Management Helpers (New APIs)
export const getFolders = async (params = {}) => {
  let data = null;
  try {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${API_URL}/folders?${query}` : `${API_URL}/folders`;
    const res = await authFetch(url);
    if (res.ok) {
      data = await res.json();
    }
  } catch (e) {
    console.warn('[db] Failed to fetch folders from server:', e.message);
  }
  if (data === null) {
    return isLocal ? localMockFolders : [];
  }
  return Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);
};

export const addFolder = async (folder) => {
  const res = await authFetch(`${API_URL}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(folder)
  });
  if (!res.ok) throw new Error('Failed to add folder');
  return res.json();
};

export const updateFolder = async (id, updates) => {
  try {
    const res = await authFetch(`${API_URL}/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (res.ok) return res.json();
  } catch (e) {
    if (!isLocal) throw e;
  }
  if (isLocal) {
    return { success: true, folder: { id, ...updates } };
  }
  throw new Error('Failed to update folder');
};

export const deleteFolder = async (id) => {
  try {
    const res = await authFetch(`${API_URL}/folders/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) return res.json();
  } catch (e) {
    if (!isLocal) throw e;
  }
  if (isLocal) {
    return { success: true, message: 'Folder deleted.' };
  }
  throw new Error('Failed to delete folder');
};

export const patchResource = async (id, updates) => {
  const res = await authFetch(`${API_URL}/resources/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update resource metadata');
  }
  return res.json();
};

export const getAdminResourceStats = async () => {
  try {
    const res = await authFetch(`${API_URL}/admin/resources-stats`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('[db] Failed to fetch resource stats from server:', e.message);
  }
  return {
    totalFiles: 24,
    totalSizeBytes: 42800000,
    totalStorageLimitBytes: 10737418240,
    totalDownloads: 1840,
    pendingSubmissions: 7,
    activeFolders: 12
  };
};

export { formatBytes, formatSpeed, formatEta, uploadResourceStream, uploadResourceStream as uploadDirectGridFS };

export const getResourceFileUrl = (resource) => {
  if (!resource) return '';
  if (resource.previewUrl && resource.previewUrl.startsWith('http')) return resource.previewUrl;
  if (resource.previewUrl && resource.previewUrl.startsWith('/api/')) return `${BASE_URL}${resource.previewUrl}`;
  if (resource.previewUrl && resource.previewUrl.startsWith('/uploads/')) return `${BASE_URL}${resource.previewUrl}`;
  if (resource.url && resource.url.startsWith('http')) return resource.url;
  if (resource.url && resource.url.startsWith('/api/')) return `${BASE_URL}${resource.url}`;
  if (resource.url && resource.url.startsWith('/uploads/')) return `${BASE_URL}${resource.url}`;
  if (resource.link && resource.link.startsWith('http')) return resource.link;
  if (resource.link && resource.link.startsWith('/uploads/')) return `${BASE_URL}${resource.link}`;
  if (resource.id && !String(resource.id).startsWith('resume-') && !String(resource.id).startsWith('mat-')) {
    return `${BASE_URL}/api/resources/${resource.id}/file`;
  }
  return resource.url || resource.previewUrl || resource.link || '';
};

// Safe Binary Download Helper preserving original filename and extension
export const downloadResourceFile = async (resource) => {
  if (!resource) throw new Error('Resource is required');
  const fileUrl = getResourceFileUrl(resource);
  if (!fileUrl || fileUrl === '#') throw new Error('File download link is unavailable');

  const userSession = localStorage.getItem('loop_current_user');
  const headers = {};
  if (userSession) {
    try {
      const { token } = JSON.parse(userSession);
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {}
  }

  // Detect preferred filename
  let filename = resource.originalFileName || resource.fileName || resource.title || 'download';
  // Ensure extension is present if known
  if (!filename.includes('.')) {
    const ext = resource.type === 'PDF' ? 'pdf' : 
                (resource.type === 'Presentation' || resource.type === 'PPT') ? 'pptx' :
                (resource.type === 'Sheet' || resource.type === 'Excel') ? 'xlsx' :
                (resource.type === 'Document' || resource.type === 'Word') ? 'docx' :
                resource.type === 'Image' ? 'png' :
                resource.mimeType === 'application/pdf' ? 'pdf' : '';
    if (ext) filename = `${filename}.${ext}`;
  }

  // If download URL points to API, attach download=1 query parameter
  const finalFetchUrl = (fileUrl.includes('/api/resources/') || fileUrl.includes('/api/pending-resources/')) && !fileUrl.includes('download=1')
    ? `${fileUrl}${fileUrl.includes('?') ? '&' : '?'}download=1`
    : fileUrl;

  const res = await fetch(finalFetchUrl, { headers });
  if (!res.ok) {
    throw new Error(`Failed to download file (${res.status})`);
  }

  // Check Content-Disposition from response header if available
  const disposition = res.headers.get('content-disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i);
    if (match && match[1]) {
      try {
        filename = decodeURIComponent(match[1]);
      } catch (e) {
        filename = match[1];
      }
    }
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }, 1000);
  return filename;
};

// High-speed 200MB MongoDB GridFS Parallel Chunk Streaming Upload
export const uploadResourceStreamGridFS = (params, onProgressCallback, abortController) => {
  return uploadResourceStream({
    ...params,
    apiUrl: API_URL,
    onProgress: onProgressCallback,
    abortController
  });
};

export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_WIDTH = 1600;
            const MAX_HEIGHT = 1600;
            
            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            resolve(compressedBase64);
          } catch (err) {
            resolve(e.target.result);
          }
        };
        img.onerror = () => {
          resolve(reader.result);
        };
      };
      reader.onerror = (error) => reject(error);
    } else {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    }
  });
};

export const getSystemHealthDiagnostics = async (forceFresh = false) => {
  const url = `${API_URL}/admin/diagnostics/system-health${forceFresh ? '?fresh=true' : ''}`;
  const res = await authFetch(url, { method: 'GET' });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to fetch system diagnostics');
  }
  return res.json();
};

export const verifyDatabaseWrite = async () => {
  const res = await authFetch(`${API_URL}/admin/diagnostics/db-probe`, { method: 'POST' });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Database write verification failed');
  }
  return res.json();
};

