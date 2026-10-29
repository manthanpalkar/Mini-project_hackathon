/**
 * storage.js
 * Chrome Storage Local wrapper with automatic fallback for Node.js test environments.
 * Manages schema keys, size limits, and right-to-be-forgotten data deletion.
 */

const STORAGE_KEYS = {
  SESSION: 'universe_session',
  RULES: 'universe_rules',
  EVENTS: 'universe_events',
  HISTORY: 'universe_history',
  SETTINGS: 'universe_settings'
};

const DEFAULT_SETTINGS = {
  focusGoalMinutes: 25,
  excludedDomains: ['localhost', '127.0.0.1'],
  maxStoredEvents: 500,
  syncEnabled: false,
  syncApiUrl: 'http://localhost:5001/api/modules/d',
  syncAuthToken: '',
  pauseOnIdleMinutes: 5,
  enableNudges: true
};

// Check environment capabilities
const isChromeStorageAvailable = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
const memoryStore = new Map();

export async function getStorage(key, defaultValue = null) {
  if (isChromeStorageAvailable) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          console.warn('[STORAGE_GET_WARN]', chrome.runtime.lastError);
          resolve(defaultValue);
        } else {
          resolve(result[key] !== undefined ? result[key] : defaultValue);
        }
      });
    });
  }

  // Fallback for tests or standard browser
  if (memoryStore.has(key)) {
    return JSON.parse(JSON.stringify(memoryStore.get(key)));
  }
  return defaultValue;
}

export async function setStorage(key, value) {
  if (isChromeStorageAvailable) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(true);
        }
      });
    });
  }

  memoryStore.set(key, JSON.parse(JSON.stringify(value)));
  return true;
}

export async function removeStorage(key) {
  if (isChromeStorageAvailable) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => {
        resolve(true);
      });
    });
  }
  memoryStore.delete(key);
  return true;
}

// Higher level helpers
export async function getSession() {
  return getStorage(STORAGE_KEYS.SESSION, null);
}

export async function saveSession(session) {
  return setStorage(STORAGE_KEYS.SESSION, session);
}

export async function clearSession() {
  return removeStorage(STORAGE_KEYS.SESSION);
}

export async function getUserRules() {
  return getStorage(STORAGE_KEYS.RULES, []);
}

export async function saveUserRules(rules) {
  return setStorage(STORAGE_KEYS.RULES, rules);
}

export async function getSettings() {
  const current = await getStorage(STORAGE_KEYS.SETTINGS, {});
  return { ...DEFAULT_SETTINGS, ...current };
}

export async function saveSettings(settings) {
  const current = await getSettings();
  return setStorage(STORAGE_KEYS.SETTINGS, { ...current, ...settings });
}

export async function getEvents() {
  return getStorage(STORAGE_KEYS.EVENTS, []);
}

export async function appendEvent(event) {
  const events = await getEvents();
  const settings = await getSettings();
  const maxEvents = settings.maxStoredEvents || 500;

  // Insert newest first
  events.unshift(event);

  // Enforce retention cap to avoid storage bloat
  const trimmed = events.slice(0, maxEvents);
  await setStorage(STORAGE_KEYS.EVENTS, trimmed);
  return trimmed;
}

export async function deleteEventById(eventId) {
  const events = await getEvents();
  const filtered = events.filter(e => e.id !== eventId);
  await setStorage(STORAGE_KEYS.EVENTS, filtered);
  return filtered;
}

export async function getSessionHistory() {
  return getStorage(STORAGE_KEYS.HISTORY, []);
}

export async function appendCompletedSession(completedSession) {
  const history = await getSessionHistory();
  history.unshift(completedSession);
  const trimmed = history.slice(0, 100);
  await setStorage(STORAGE_KEYS.HISTORY, trimmed);
  return trimmed;
}

/**
 * Right-to-be-forgotten: wipes all tracking telemetry while preserving custom settings
 */
export async function clearAllActivityHistory() {
  await removeStorage(STORAGE_KEYS.SESSION);
  await removeStorage(STORAGE_KEYS.EVENTS);
  await removeStorage(STORAGE_KEYS.HISTORY);
  return { success: true, message: 'All local browsing records and focus session history cleared.' };
}

/**
 * Full JSON export of student data
 */
export async function exportAllDataJson() {
  const [session, rules, events, history, settings] = await Promise.all([
    getSession(),
    getUserRules(),
    getEvents(),
    getSessionHistory(),
    getSettings()
  ]);

  return {
    exportDate: new Date().toISOString(),
    clientVersion: '1.0.0-mv3',
    privacyCommitment: 'Exported from UniVerse Digital Wellbeing Chrome Extension. Zero background surveillance.',
    activeSession: session,
    userRules: rules,
    eventsCount: events.length,
    events,
    sessionHistoryCount: history.length,
    sessionHistory: history,
    settings
  };
}

export { STORAGE_KEYS, DEFAULT_SETTINGS };
