/**
 * popup.js
 * Controller for the Chrome Extension Popup interface.
 * Connects with background service worker to display live status and dispatch actions.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');
  const currentHostname = document.getElementById('current-hostname');
  const currentCategory = document.getElementById('current-category');
  const sessionTitleDisplay = document.getElementById('session-title-display');
  const timerDisplay = document.getElementById('timer-display');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressPercent = document.getElementById('progress-percent');
  const targetGoalText = document.getElementById('target-goal-text');

  const startFormSection = document.getElementById('start-form-section');
  const runningControlsSection = document.getElementById('running-controls-section');
  const sessionTitleInput = document.getElementById('session-title-input');
  const targetMinutesSelect = document.getElementById('target-minutes-select');
  const categorySelect = document.getElementById('category-select');

  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnStop = document.getElementById('btn-stop');
  const btnOpenDashboard = document.getElementById('btn-open-dashboard');
  const btnOpenOptions = document.getElementById('btn-open-options');

  let currentActiveSeconds = 0;
  let timerInterval = null;

  // Format Elapsed Time (MM:SS or HH:MM:SS)
  function formatTime(totalSec) {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Refresh UI state from Background
  async function refreshState() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      if (!response || !response.success) return;

      const { session, activeSeconds, currentTabInfo } = response;
      currentActiveSeconds = activeSeconds || 0;

      // 1. Current tab site category
      if (currentTabInfo && currentTabInfo.hostname) {
        currentHostname.textContent = currentTabInfo.hostname;
        currentCategory.textContent = (currentTabInfo.category || 'uncategorized').toUpperCase();
        currentCategory.className = `category-badge ${currentTabInfo.category || 'uncategorized'}`;
      } else {
        currentHostname.textContent = 'Non-web or Internal Tab';
        currentCategory.textContent = 'EXCLUDED';
        currentCategory.className = 'category-badge neutral';
      }

      // 2. Active Session State
      if (session && (session.status === 'active' || session.status === 'paused')) {
        sessionTitleDisplay.textContent = session.title;
        timerDisplay.textContent = formatTime(currentActiveSeconds);

        // Progress calculation
        progressContainer.classList.remove('hidden');
        const targetSeconds = (session.targetDurationMinutes || 25) * 60;
        const pct = Math.min(100, Math.round((currentActiveSeconds / targetSeconds) * 100));
        progressBar.style.width = `${pct}%`;
        progressPercent.textContent = `${pct}%`;
        targetGoalText.textContent = `Goal: ${session.targetDurationMinutes} mins`;

        // Switch to Running Controls
        startFormSection.classList.add('hidden');
        runningControlsSection.classList.remove('hidden');

        if (session.status === 'active') {
          statusPill.className = 'status-pill active';
          statusText.textContent = 'Active Focus';
          btnPause.classList.remove('hidden');
          btnResume.classList.add('hidden');

          // Local smooth ticking
          if (!timerInterval) {
            timerInterval = setInterval(() => {
              currentActiveSeconds++;
              timerDisplay.textContent = formatTime(currentActiveSeconds);
              const p = Math.min(100, Math.round((currentActiveSeconds / targetSeconds) * 100));
              progressBar.style.width = `${p}%`;
              progressPercent.textContent = `${p}%`;
            }, 1000);
          }
        } else {
          statusPill.className = 'status-pill paused';
          statusText.textContent = 'Paused';
          btnPause.classList.add('hidden');
          btnResume.classList.remove('hidden');
          clearInterval(timerInterval);
          timerInterval = null;
        }
      } else {
        // Idle State
        statusPill.className = 'status-pill idle';
        statusText.textContent = 'Idle';
        sessionTitleDisplay.textContent = 'Ready to Study';
        timerDisplay.textContent = '00:00';
        progressContainer.classList.add('hidden');
        startFormSection.classList.remove('hidden');
        runningControlsSection.classList.add('hidden');
        clearInterval(timerInterval);
        timerInterval = null;
      }
    } catch (err) {
      console.warn('[POPUP_REFRESH_WARN]', err);
    }
  }

  // --- Actions ---

  btnStart.addEventListener('click', async () => {
    btnStart.disabled = true;
    try {
      await chrome.runtime.sendMessage({
        type: 'START_SESSION',
        payload: {
          title: sessionTitleInput.value.trim() || 'Deep Focus Session',
          targetDurationMinutes: parseInt(targetMinutesSelect.value, 10),
          sessionCategory: categorySelect.value
        }
      });
      await refreshState();
    } finally {
      btnStart.disabled = false;
    }
  });

  btnPause.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'PAUSE_SESSION' });
    await refreshState();
  });

  btnResume.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'RESUME_SESSION' });
    await refreshState();
  });

  btnStop.addEventListener('click', async () => {
    const confirmStop = window.confirm('Complete and finalize this focus session?');
    if (!confirmStop) return;
    await chrome.runtime.sendMessage({
      type: 'STOP_SESSION',
      payload: { focusQualityScore: 8, reflectionNotes: 'Completed via Chrome Extension popup.' }
    });
    await refreshState();
  });

  btnOpenDashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
  });

  btnOpenOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Initial load
  await refreshState();
});
