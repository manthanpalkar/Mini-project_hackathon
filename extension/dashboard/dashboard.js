/**
 * dashboard.js
 * Controller for the full Extension Analytics Dashboard.
 * Reads local storage data to present transparent metrics, category distributions,
 * and individual record management.
 */

import {
  getSessionHistory,
  getEvents,
  getSettings,
  deleteEventById,
  exportAllDataJson
} from '../shared/storage.js';

import { calculateActiveSeconds } from '../shared/sessionManager.js';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const kpiFocusMins = document.getElementById('kpi-focus-mins');
  const kpiFocusSessions = document.getElementById('kpi-focus-sessions');
  const kpiSwitches = document.getElementById('kpi-switches');
  const kpiDistractingMins = document.getElementById('kpi-distracting-mins');
  const kpiGoalPercent = document.getElementById('kpi-goal-percent');
  const categoryBarsContainer = document.getElementById('category-bars-container');
  const eventsTableBody = document.getElementById('events-table-body');
  const sessionsTableBody = document.getElementById('sessions-table-body');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnGoOptions = document.getElementById('btn-go-options');

  const CATEGORY_COLORS = {
    learning: '#0284C7',
    productive: '#10B981',
    distracting: '#EF4444',
    neutral: '#64748B',
    uncategorized: '#94A3B8'
  };

  async function loadDashboard() {
    const [history, events, settings, stateRes] = await Promise.all([
      getSessionHistory(),
      getEvents(),
      getSettings(),
      chrome.runtime.sendMessage({ type: 'GET_STATE' }).catch(() => null)
    ]);

    // 1. Compute Focus Time Totals
    let totalActiveSeconds = 0;
    history.forEach(s => {
      totalActiveSeconds += (s.accumulatedActiveSeconds || 0);
    });

    // Add current live session if active
    if (stateRes && stateRes.session) {
      totalActiveSeconds += (stateRes.activeSeconds || 0);
    }

    const totalActiveMins = Math.round(totalActiveSeconds / 60);
    kpiFocusMins.textContent = `${totalActiveMins} mins`;
    kpiFocusSessions.textContent = `${history.length} completed session(s)`;

    // 2. Context Switches & Distracting Duration
    let totalContextSwitches = 0;
    let totalDistractingSeconds = 0;

    history.forEach(s => {
      totalContextSwitches += (s.contextSwitchCount || 0);
      totalDistractingSeconds += (s.distractingDurationSeconds || 0);
    });

    if (stateRes && stateRes.session) {
      totalContextSwitches += (stateRes.session.contextSwitchCount || 0);
      totalDistractingSeconds += (stateRes.session.distractingDurationSeconds || 0);
    }

    kpiSwitches.textContent = totalContextSwitches;
    kpiDistractingMins.textContent = `${Math.round(totalDistractingSeconds / 60)} mins`;

    // 3. Goal Completion
    const targetGoalMins = settings.focusGoalMinutes || 25;
    const goalPercent = Math.min(100, Math.round((totalActiveMins / targetGoalMins) * 100));
    kpiGoalPercent.textContent = `${goalPercent}%`;

    // 4. Category Breakdown Distribution
    const categoryTotals = {
      learning: 0,
      productive: 0,
      distracting: 0,
      neutral: 0,
      uncategorized: 0
    };

    events.forEach(ev => {
      const cat = categoryTotals[ev.category] !== undefined ? ev.category : 'uncategorized';
      categoryTotals[cat] += (ev.durationSeconds || 30);
    });

    const totalDuration = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

    categoryBarsContainer.innerHTML = '';
    Object.keys(categoryTotals).forEach(cat => {
      const durationSec = categoryTotals[cat];
      const mins = Math.round(durationSec / 60);
      const pct = totalDuration > 0 ? Math.round((durationSec / totalDuration) * 100) : 0;
      const color = CATEGORY_COLORS[cat] || '#64748B';

      const barRow = document.createElement('div');
      barRow.className = 'bar-row';
      barRow.innerHTML = `
        <div class="bar-meta">
          <span style="color: ${color}; text-transform: capitalize;">● ${cat}</span>
          <span>${mins} mins (${pct}%)</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; background: ${color};"></div>
        </div>
      `;
      categoryBarsContainer.appendChild(barRow);
    });

    // 5. Populate Events Table
    eventsTableBody.innerHTML = '';
    if (events.length === 0) {
      eventsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">No browsing activity recorded yet. Start an active focus session to track.</td></tr>';
    } else {
      events.slice(0, 30).forEach(ev => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
          <td><strong><code>${ev.domain}</code></strong></td>
          <td><span class="category-tag ${ev.category}">${ev.category}</span></td>
          <td>${ev.durationSeconds || 30}s</td>
          <td style="text-align: right;">
            <button class="btn-delete" data-event-id="${ev.id}" title="Delete record">🗑️</button>
          </td>
        `;
        eventsTableBody.appendChild(tr);
      });

      // Attach single-record delete listeners
      document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const eventId = e.currentTarget.getAttribute('data-event-id');
          await deleteEventById(eventId);
          await loadDashboard();
        });
      });
    }

    // 6. Populate Sessions Table
    sessionsTableBody.innerHTML = '';
    if (history.length === 0) {
      sessionsTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">No completed sessions in history.</td></tr>';
    } else {
      history.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${new Date(s.startTime).toLocaleDateString()}</td>
          <td><strong>${s.title}</strong></td>
          <td style="text-transform: capitalize;">${s.sessionCategory}</td>
          <td>${Math.round((s.accumulatedActiveSeconds || 0) / 60)} mins</td>
          <td>${s.contextSwitchCount || 0}</td>
          <td>${s.focusQualityScore || 8}/10 ⭐</td>
          <td style="color: var(--text-secondary);">${s.reflectionNotes || '-'}</td>
        `;
        sessionsTableBody.appendChild(tr);
      });
    }
  }

  // Actions
  btnExportJson.addEventListener('click', async () => {
    const data = await exportAllDataJson();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `universe_wellbeing_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  btnGoOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  await loadDashboard();
});
