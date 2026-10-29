/**
 * service-worker.js
 * Chrome Extension Manifest V3 Background Service Worker
 *
 * Responsibilities:
 * 1. Maintain focus-session state across service-worker lifecycle.
 * 2. Track tab activations & navigations ONLY during active focus sessions.
 * 3. Enforce strict privacy rules: no incognito tracking, no internal URLs, hostnames only.
 * 4. Maintain extension badge icon state.
 */

import {
  getSession,
  saveSession,
  getUserRules,
  getSettings,
  appendEvent
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

// Internal tracking trackers for time attribution
let lastActiveDomain = null;
let lastActiveCategory = null;
let lastSwitchTimestamp = Date.now();

// -----------------------------------------------------------------------------
// 1. EXTENSION INSTALLATION & ALARMS
// -----------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[UniVerse Extension] Digital Wellbeing installed.');
  // Create periodic check alarm (every 1 minute)
  chrome.alarms.create('universe_session_reconcile', { periodInMinutes: 1 });
  updateBadgeState();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'universe_session_reconcile') {
    updateBadgeState();
  }
});

// -----------------------------------------------------------------------------
// 2. BADGE STATE SYNCHRONIZATION
// -----------------------------------------------------------------------------
async function updateBadgeState() {
  try {
    const session = await getSession();
    if (!session || session.status === 'completed') {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    if (session.status === 'paused') {
      chrome.action.setBadgeText({ text: '⏸' });
      chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
      return;
    }

    if (session.status === 'active') {
      const activeSeconds = calculateActiveSeconds(session);
      const mins = Math.floor(activeSeconds / 60);
      chrome.action.setBadgeText({ text: `${mins}m` });
      chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
    }
  } catch (err) {
    console.warn('[BADGE_UPDATE_WARN]', err);
  }
}

// -----------------------------------------------------------------------------
// 3. TAB EVENT LISTENERS (ONLY ACTIVE DURING AN ACTIVE FOCUS SESSION)
// -----------------------------------------------------------------------------

// User switched tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await handleTabChange(tab);
  } catch (err) {
    // Tab might have been closed immediately
  }
});

// User navigated in existing tab
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.active) {
    await handleTabChange(tab);
  }
});

/**
 * Core Privacy Tracking Handler
 * Enforces all privacy constraints before logging any event.
 */
async function handleTabChange(tab) {
  if (!tab || !tab.url) return;

  // PRIVACY CONSTRAINT 1: Never track incognito browsing
  if (tab.incognito) {
    return;
  }

  // PRIVACY CONSTRAINT 2: Only track when an explicit focus session is ACTIVE
  const session = await getSession();
  if (!session || session.status !== 'active') {
    return;
  }

  // PRIVACY CONSTRAINT 3: Never track internal browser URLs (chrome://, about:, etc.)
  if (isInternalBrowserUrl(tab.url)) {
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
// 4. IDLE STATE HANDLING (Pause on user absence)
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
// 5. MESSAGE DISPATCHER (UI <-> BACKGROUND)
// -----------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request)
    .then(sendResponse)
    .catch((err) => sendResponse({ success: false, error: err.message }));
  return true; // Keep message channel open for async response
});

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

      // If cloud synchronization is configured, optionally sync to backend
      const settings = await getSettings();
      if (settings.syncEnabled && settings.syncAuthToken && completed) {
        syncCompletedSession(completed, settings.syncAuthToken, settings.syncApiUrl)
          .catch(err => console.warn('[SYNC_BG_WARN]', err));
      }

      return { success: true, completed };
    }

    default:
      return { success: false, error: `Unknown message type: ${request.type}` };
  }
}
