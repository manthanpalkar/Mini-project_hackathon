/**
 * service-worker.js
 * Chrome Extension Manifest V3 Background Service Worker
 *
 * Responsibilities:
 * 1. Maintain focus-session state across service-worker lifecycle.
 * 2. Track tab activations & navigations ONLY during active focus sessions.
 * 3. Enforce strict privacy rules: no incognito tracking, no internal URLs, hostnames only.
 * 4. Maintain extension badge icon state.
 * 5. Bridge focus statistics and sessions to the UniVerse campus website.
 */

import {
  getSession,
  saveSession,
  getUserRules,
  getSettings,
  saveSettings,
  getEvents,
  appendEvent,
  getSessionHistory
} from '../shared/storage.js';

import {
  startFocusSession,
  pauseFocusSession,
  resumeFocusSession,
  stopFocusSession,
  calculateActiveSeconds,
  recordSessionActivity
} from '../shared/sessionManager.js';

import {
  normalizeHostname,
  isInternalBrowserUrl,
  classifyHostname
} from '../shared/rulesEngine.js';

import { syncCompletedSession } from '../shared/syncClient.js';

// Cache for tracking current domain transitions during an active session
let lastActiveDomain = null;
let lastActiveCategory = null;
let lastSwitchTimestamp = Date.now();

// -----------------------------------------------------------------------------
// 1. ALARMS & LIFECYCLE INITIALIZATION
// -----------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[UniVerse Extension] Installed & Initialized.');
  chrome.alarms.create('universe_badge_tick', { periodInMinutes: 1 });
  updateBadgeState();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'universe_badge_tick') {
    updateBadgeState();
  }
});

// Periodic badge updater to display elapsed active focus minutes
async function updateBadgeState() {
  try {
    const session = await getSession();
    if (!session || session.status === 'idle' || session.status === 'completed') {
      await chrome.action.setBadgeText({ text: '' });
      return;
    }

    if (session.status === 'paused') {
      await chrome.action.setBadgeText({ text: '⏸' });
      await chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' }); // Amber
      return;
    }

    if (session.status === 'active') {
      const activeSeconds = calculateActiveSeconds(session);
      const activeMinutes = Math.floor(activeSeconds / 60);
      const badgeText = activeMinutes > 0 ? `${activeMinutes}m` : '●';
      await chrome.action.setBadgeText({ text: badgeText });
      await chrome.action.setBadgeBackgroundColor({ color: '#10b981' }); // Emerald green
    }
  } catch (err) {
    // Service worker badge update fallback
  }
}

// -----------------------------------------------------------------------------
// 2. TAB TRACKING ENGINE (Active-Only Privacy Gate)
// -----------------------------------------------------------------------------
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await handleTabChange(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only inspect when URL has actually committed
  if (changeInfo.url || changeInfo.status === 'complete') {
    await handleTabChange(tabId, tab);
  }
});

async function handleTabChange(tabId, tabObj = null) {
  // PRIVACY CONSTRAINT 1: Only monitor when an active session is in progress
  const session = await getSession();
  if (!session || session.status !== 'active') {
    return;
  }

  let tab = tabObj;
  if (!tab) {
    try {
      tab = await chrome.tabs.get(tabId);
    } catch (e) {
      return; // Tab closed or inaccessible
    }
  }

  // PRIVACY CONSTRAINT 2: Strict exemption for Incognito windows
  if (tab.incognito) {
    return;
  }

  // PRIVACY CONSTRAINT 3: Strict exemption for internal browser pages
  if (!tab.url || isInternalBrowserUrl(tab.url)) {
    return;
  }

  // Extract clean hostname ONLY - never store path, query parameters, or credentials
  const hostname = normalizeHostname(tab.url);
  if (!hostname) return;

  const [rules, settings] = await Promise.all([
    getUserRules(),
    getSettings()
  ]);

  // PRIVACY CONSTRAINT 4: Respect user's excluded domains list
  const classification = classifyHostname(hostname, rules, settings.excludedDomains);
  if (classification.isExcluded) {
    return;
  }

  // Time attribution calculation: compute duration on PREVIOUS domain
  const now = Date.now();
  const rawDuration = Math.max(1, Math.floor((now - lastSwitchTimestamp) / 1000));
  // Cap single-tab duration estimate at 5 mins (300s) to prevent idle spikes
  const attributedDuration = Math.min(300, rawDuration);

  // If transitioning to a new domain or category, record the previous event
  if (lastActiveDomain && lastActiveDomain !== hostname) {
    const eventRecord = {
      id: `ev_${now}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId: session.id,
      timestamp: now,
      domain: lastActiveDomain, // Storing clean domain only
      category: lastActiveCategory || 'uncategorized',
      durationSeconds: attributedDuration,
      isDistracting: lastActiveCategory === 'distracting'
    };

    // Save event to local storage
    await appendEvent(eventRecord);

    // Update parent session's context switch & distracting counters
    await recordSessionActivity(eventRecord);
  }

  // Update active tracking pointers
  lastActiveDomain = hostname;
  lastActiveCategory = classification.category;
  lastSwitchTimestamp = now;

  // Refresh badge
  updateBadgeState();
}

// -----------------------------------------------------------------------------
// 3. IDLE STATE HANDLING (Pause on user absence)
// -----------------------------------------------------------------------------
if (chrome.idle) {
  chrome.idle.onStateChanged.addListener(async (newState) => {
    const session = await getSession();
    if (!session || session.status !== 'active') return;

    if (newState === 'idle' || newState === 'locked') {
      console.log('[IDLE] User is away. Pausing active session.');
      await pauseFocusSession();
      updateBadgeState();
    }
  });
}

// -----------------------------------------------------------------------------
// 4. MESSAGE DISPATCHER (UI & WEB BRIDGE <-> BACKGROUND)
// -----------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request)
    .then(sendResponse)
    .catch((err) => sendResponse({ success: false, error: err.message }));
  return true; // Keep message channel open for async response
});

if (chrome.runtime.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    handleMessage(request)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  });
}

async function handleMessage(request) {
  switch (request.type) {
    case 'GET_STATE': {
      const session = await getSession();
      const settings = await getSettings();
      let activeSeconds = 0;
      if (session) {
        activeSeconds = calculateActiveSeconds(session);
      }

      // Check current active tab category
      let currentTabInfo = null;
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.url && !activeTab.incognito && !isInternalBrowserUrl(activeTab.url)) {
          const host = normalizeHostname(activeTab.url);
          const rules = await getUserRules();
          const classification = classifyHostname(host, rules, settings.excludedDomains);
          currentTabInfo = {
            hostname: host,
            category: classification.category,
            ruleName: classification.ruleName,
            isExcluded: classification.isExcluded
          };
        }
      } catch (e) {
        // Tab query failed
      }

      return {
        success: true,
        session,
        activeSeconds,
        settings,
        currentTabInfo
      };
    }

    case 'START_SESSION': {
      const result = await startFocusSession(request.payload || {});
      lastActiveDomain = null;
      lastSwitchTimestamp = Date.now();
      updateBadgeState();
      return { success: true, ...result };
    }

    case 'PAUSE_SESSION': {
      const session = await pauseFocusSession();
      updateBadgeState();
      return { success: true, session };
    }

    case 'RESUME_SESSION': {
      const session = await resumeFocusSession();
      lastSwitchTimestamp = Date.now();
      updateBadgeState();
      return { success: true, session };
    }

    case 'STOP_SESSION': {
      const completed = await stopFocusSession(request.payload || {});
      lastActiveDomain = null;
      updateBadgeState();

      // Retrieve events associated with this session to sync together
      const events = await getEvents();
      const sessionEvents = events.filter(e => e.sessionId === completed?.id);

      // If cloud synchronization is configured, sync to UniVerse backend
      const settings = await getSettings();
      if (settings.syncEnabled && settings.syncAuthToken && completed) {
        syncCompletedSession(completed, sessionEvents, settings.syncAuthToken, settings.syncApiUrl)
          .catch(err => console.warn('[SYNC_BG_WARN]', err));
      }

      return { success: true, completed };
    }

    case 'SAVE_AUTH_TOKEN': {
      const settings = await getSettings();
      if (request.payload?.token) {
        settings.syncAuthToken = request.payload.token;
        settings.syncEnabled = true;
      }
      if (request.payload?.apiUrl) {
        settings.syncApiUrl = request.payload.apiUrl;
      }
      await saveSettings(settings);
      return { success: true, userEmail: request.payload?.userEmail };
    }

    case 'TRIGGER_SYNC_TO_CLOUD': {
      const settings = await getSettings();
      const token = request.payload?.token || settings.syncAuthToken;
      const apiUrl = request.payload?.apiUrl || settings.syncApiUrl;

      if (!token) {
        return { success: false, error: 'No UniVerse authentication token found. Please log in on the website.' };
      }

      const history = await getSessionHistory();
      const currentSession = await getSession();
      const events = await getEvents();
      const sessionToSync = history[0];

      if (!sessionToSync) {
        if (currentSession && (currentSession.status === 'active' || currentSession.status === 'paused')) {
          return { success: false, error: 'Focus session is currently active in browser! Click "Complete & Save" in the extension popup before syncing.' };
        }
        return { success: false, error: 'No completed study sessions found to sync yet. Start and complete a focus session in the extension first!' };
      }

      const sessionEvents = events.filter(e => e.sessionId === sessionToSync.id);
      const res = await syncCompletedSession(sessionToSync, sessionEvents, token, apiUrl);

      if (res.success) {
        settings.syncAuthToken = token;
        settings.syncEnabled = true;
        await saveSettings(settings);
      }

      return res;
    }

    case 'GET_ALL_STATS': {
      const [session, history, events, settings] = await Promise.all([
        getSession(),
        getSessionHistory(),
        getEvents(),
        getSettings()
      ]);
      const activeSeconds = session ? calculateActiveSeconds(session) : 0;
      return {
        success: true,
        session,
        activeSeconds,
        history,
        eventsCount: events.length,
        settings: {
          syncEnabled: settings.syncEnabled,
          hasAuthToken: Boolean(settings.syncAuthToken)
        }
      };
    }

    default:
      return { success: false, error: `Unknown message type: ${request.type}` };
  }
}
