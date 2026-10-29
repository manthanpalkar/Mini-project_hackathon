/**
 * content-bridge.js
 * Content script running on UniVerse website pages.
 * Bridges communication between the UniVerse React frontend and the Chrome Extension.
 *
 * Capabilities:
 * 1. Signals extension presence to the React app via DOM dataset and CustomEvents.
 * 2. Auto-syncs authentication tokens from the web app's localStorage into the extension.
 * 3. Relays live focus stats and triggers cloud synchronization on demand.
 */

(function () {
  // Mark the page so React immediately knows the extension is installed
  document.documentElement.dataset.universeExtensionInstalled = 'true';
  window.dispatchEvent(new CustomEvent('UNIVERSE_EXTENSION_READY', { detail: { version: '1.0.0' } }));

  // Auto-detect UniVerse authentication token from page localStorage and sync to extension
  function autoSyncAuthToken() {
    try {
      let token = localStorage.getItem('token') || sessionStorage.getItem('token');
      let userEmail = null;

      if (!token) {
        const userRaw = localStorage.getItem('loop_current_user');
        if (userRaw) {
          const parsed = JSON.parse(userRaw);
          token = parsed.token;
          userEmail = parsed.email;
        }
      }

      if (token && chrome.runtime?.id) {
        chrome.runtime.sendMessage({
          type: 'SAVE_AUTH_TOKEN',
          payload: {
            token,
            userEmail,
            apiUrl: 'http://localhost:5001/api/modules/d'
          }
        }, (res) => {
          if (chrome.runtime.lastError) {
            // Ignore if worker temporarily sleeping
          }
        });
      }
    } catch (e) {
      // Storage access or parse error
    }
  }

  // Attempt auto-sync immediately and periodically
  autoSyncAuthToken();
  window.addEventListener('load', autoSyncAuthToken);
  window.addEventListener('storage', autoSyncAuthToken);

  // Listen for messages from UniVerse web app (window.postMessage)
  window.addEventListener('message', (event) => {
    // Only accept messages from the same window
    if (event.source !== window || !event.data || event.data.source !== 'UNIVERSE_WEB') {
      return;
    }

    const { type, payload } = event.data;

    switch (type) {
      case 'PING_EXTENSION': {
        window.postMessage({
          source: 'UNIVERSE_EXTENSION',
          type: 'EXTENSION_PONG',
          data: { installed: true, version: '1.0.0' }
        }, '*');
        break;
      }

      case 'REQUEST_STATS': {
        if (!chrome.runtime?.id) return;
        chrome.runtime.sendMessage({ type: 'GET_ALL_STATS' }, (response) => {
          window.postMessage({
            source: 'UNIVERSE_EXTENSION',
            type: 'RECEIVE_STATS',
            data: response || { success: false }
          }, '*');
        });
        break;
      }

      case 'TRIGGER_SYNC_TO_CLOUD': {
        if (!chrome.runtime?.id) return;
        chrome.runtime.sendMessage({
          type: 'TRIGGER_SYNC_TO_CLOUD',
          payload
        }, (response) => {
          window.postMessage({
            source: 'UNIVERSE_EXTENSION',
            type: 'SYNC_COMPLETED',
            data: response || { success: false }
          }, '*');
        });
        break;
      }

      case 'PASS_AUTH_TOKEN': {
        if (!chrome.runtime?.id) return;
        chrome.runtime.sendMessage({
          type: 'SAVE_AUTH_TOKEN',
          payload
        }, (response) => {
          window.postMessage({
            source: 'UNIVERSE_EXTENSION',
            type: 'AUTH_SAVED',
            data: response || { success: false }
          }, '*');
        });
        break;
      }
    }
  });
})();
