/**
 * options.js
 * Controller for the Chrome Extension Options page.
 * Manages user-defined categorization rules, excluded domains, sync credentials,
 * and data deletion workflows.
 */

import {
  getUserRules,
  saveUserRules,
  getSettings,
  saveSettings,
  clearAllActivityHistory
} from '../shared/storage.js';

import { normalizeHostname } from '../shared/rulesEngine.js';
import { testBackendConnection } from '../shared/syncClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const toastMsg = document.getElementById('toast-msg');
  const addRuleForm = document.getElementById('add-rule-form');
  const ruleNameInput = document.getElementById('rule-name');
  const rulePatternInput = document.getElementById('rule-pattern');
  const ruleCategorySelect = document.getElementById('rule-category');
  const ruleMatchTypeSelect = document.getElementById('rule-match-type');
  const userRulesList = document.getElementById('user-rules-list');

  const newExcludedInput = document.getElementById('new-excluded-input');
  const btnAddExcluded = document.getElementById('btn-add-excluded');
  const excludedChips = document.getElementById('excluded-chips');

  const defaultGoalMinutes = document.getElementById('default-goal-minutes');
  const idlePauseSelect = document.getElementById('idle-pause-select');
  const btnSavePrefs = document.getElementById('btn-save-prefs');

  const syncUrlInput = document.getElementById('sync-url-input');
  const syncTokenInput = document.getElementById('sync-token-input');
  const btnTestSync = document.getElementById('btn-test-sync');
  const syncStatusIndicator = document.getElementById('sync-status-indicator');

  const btnClearHistory = document.getElementById('btn-clear-history');

  function showToast(msg, isError = false) {
    toastMsg.textContent = msg;
    toastMsg.style.background = isError ? '#EF4444' : '#10B981';
    toastMsg.classList.remove('hidden');
    setTimeout(() => {
      toastMsg.classList.add('hidden');
    }, 3500);
  }

  // --- 1. Load Rules ---
  async function renderRules() {
    const rules = await getUserRules();
    userRulesList.innerHTML = '';

    if (rules.length === 0) {
      userRulesList.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.8rem; padding: 0.75rem 0;">No custom rules defined yet. System defaults are active.</div>';
      return;
    }

    rules.forEach((rule, idx) => {
      const item = document.createElement('div');
      item.className = 'rule-item';
      item.innerHTML = `
        <div class="rule-info">
          <strong>${rule.ruleName}</strong>
          <span class="rule-meta">Pattern: <code>${rule.pattern}</code> (${rule.matchType}) • Priority: ${rule.priority || 80}</span>
        </div>
        <div class="rule-actions">
          <span class="tag ${rule.category}">${rule.category}</span>
          <button class="btn btn-secondary btn-toggle" data-rule-idx="${idx}" style="padding: 3px 8px; font-size: 0.72rem;">
            ${rule.isEnabled !== false ? 'Enabled' : 'Disabled'}
          </button>
          <button class="btn-delete-rule" data-rule-idx="${idx}" style="background: transparent; border: none; color: #EF4444; cursor: pointer;">
            🗑️
          </button>
        </div>
      `;
      userRulesList.appendChild(item);
    });

    // Attach listeners
    document.querySelectorAll('.btn-toggle').forEach(b => {
      b.addEventListener('click', async (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-rule-idx'), 10);
        const r = await getUserRules();
        r[index].isEnabled = !(r[index].isEnabled !== false);
        await saveUserRules(r);
        await renderRules();
        showToast('Rule toggled.');
      });
    });

    document.querySelectorAll('.btn-delete-rule').forEach(b => {
      b.addEventListener('click', async (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-rule-idx'), 10);
        const r = await getUserRules();
        r.splice(index, 1);
        await saveUserRules(r);
        await renderRules();
        showToast('Rule deleted.');
      });
    });
  }

  // Add rule submit
  addRuleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pattern = normalizeHostname(rulePatternInput.value.trim());
    if (!pattern) {
      showToast('Please enter a valid domain pattern.', true);
      return;
    }

    const newRule = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ruleName: ruleNameInput.value.trim(),
      pattern,
      category: ruleCategorySelect.value,
      matchType: ruleMatchTypeSelect.value,
      priority: 85,
      isEnabled: true
    };

    const rules = await getUserRules();
    rules.unshift(newRule);
    await saveUserRules(rules);

    ruleNameInput.value = '';
    rulePatternInput.value = '';
    await renderRules();
    showToast('Rule added successfully!');
  });

  // --- 2. Excluded Domains ---
  async function renderExcluded() {
    const settings = await getSettings();
    const list = settings.excludedDomains || [];
    excludedChips.innerHTML = '';

    list.forEach((domain, idx) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `
        <span>${domain}</span>
        <button data-excluded-idx="${idx}">✕</button>
      `;
      excludedChips.appendChild(chip);
    });

    excludedChips.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', async (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-excluded-idx'), 10);
        const s = await getSettings();
        s.excludedDomains.splice(index, 1);
        await saveSettings(s);
        await renderExcluded();
        showToast('Domain removed from exclusion list.');
      });
    });
  }

  btnAddExcluded.addEventListener('click', async () => {
    const raw = newExcludedInput.value.trim();
    const domain = normalizeHostname(raw);
    if (!domain) return;

    const s = await getSettings();
    if (!s.excludedDomains.includes(domain)) {
      s.excludedDomains.push(domain);
      await saveSettings(s);
      newExcludedInput.value = '';
      await renderExcluded();
      showToast(`'${domain}' added to excluded list.`);
    }
  });

  // --- 3. Focus & Timing Preferences ---
  async function loadSettings() {
    const settings = await getSettings();
    defaultGoalMinutes.value = settings.focusGoalMinutes || 25;
    idlePauseSelect.value = settings.pauseOnIdleMinutes || 5;
    syncUrlInput.value = settings.syncApiUrl || 'http://localhost:5001/api/modules/d';
    syncTokenInput.value = settings.syncAuthToken || '';
  }

  btnSavePrefs.addEventListener('click', async () => {
    await saveSettings({
      focusGoalMinutes: parseInt(defaultGoalMinutes.value, 10),
      pauseOnIdleMinutes: parseInt(idlePauseSelect.value, 10),
      syncApiUrl: syncUrlInput.value.trim(),
      syncAuthToken: syncTokenInput.value.trim(),
      syncEnabled: Boolean(syncTokenInput.value.trim())
    });
    showToast('Preferences saved successfully!');
  });

  // --- 4. Sync Connection Test ---
  btnTestSync.addEventListener('click', async () => {
    syncStatusIndicator.textContent = 'Testing connection...';
    syncStatusIndicator.style.color = '#38BDF8';

    const token = syncTokenInput.value.trim();
    const url = syncUrlInput.value.trim();

    const res = await testBackendConnection(token, url);
    if (res.connected) {
      if (res.authenticated) {
        syncStatusIndicator.textContent = `✓ Connected & authenticated as ${res.userEmail}`;
        syncStatusIndicator.style.color = '#10B981';
      } else {
        syncStatusIndicator.textContent = '✓ Backend reachable (anonymous)';
        syncStatusIndicator.style.color = '#F59E0B';
      }
    } else {
      syncStatusIndicator.textContent = `✕ Connection failed: ${res.error}`;
      syncStatusIndicator.style.color = '#EF4444';
    }
  });

  // --- 5. Danger Zone / Wipe All Data ---
  btnClearHistory.addEventListener('click', async () => {
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete all local focus sessions and browsing activity records? This action cannot be undone.'
    );
    if (!confirmed) return;

    await clearAllActivityHistory();
    showToast('All local browsing records and session history wiped cleanly.');
  });

  // Initialize
  await renderRules();
  await renderExcluded();
  await loadSettings();
});
