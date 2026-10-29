import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  startFocusSession,
  pauseFocusSession,
  resumeFocusSession,
  stopFocusSession,
  calculateActiveSeconds,
  recordSessionActivity
} from '../shared/sessionManager.js';

import {
  getSession,
  getSessionHistory,
  clearAllActivityHistory,
  getSettings,
  saveSettings,
  exportAllDataJson
} from '../shared/storage.js';

describe('Chrome Extension: Focus Session State Machine & Time Accounting', () => {

  test('start, pause, resume, stop lifecycle works correctly', async () => {
    await clearAllActivityHistory();

    // 1. Start Session
    const startRes = await startFocusSession({
      title: 'Operating Systems Virtual Memory',
      targetDurationMinutes: 30,
      sessionCategory: 'coding'
    });

    assert.equal(startRes.alreadyRunning, false);
    assert.equal(startRes.session.status, 'active');
    assert.equal(startRes.session.title, 'Operating Systems Virtual Memory');

    // 2. Active duration calculation using timestamps
    const now = Date.now();
    const mockSession = {
      status: 'active',
      accumulatedActiveSeconds: 40,
      lastResumedAt: now - 15000 // 15 seconds ago
    };
    const active = calculateActiveSeconds(mockSession, now);
    assert.equal(active, 55); // 40 + 15

    // 3. Pause Session
    const paused = await pauseFocusSession();
    assert.equal(paused.status, 'paused');
    assert.equal(paused.lastResumedAt, null);
    assert.ok(paused.lastPausedAt);

    // 4. Paused duration is frozen
    const pausedCalc = calculateActiveSeconds(paused, now + 3600000); // 1 hour in the future
    assert.equal(pausedCalc, paused.accumulatedActiveSeconds); // active seconds do not increase!

    // 5. Resume Session
    const resumed = await resumeFocusSession();
    assert.equal(resumed.status, 'active');
    assert.ok(resumed.lastResumedAt);
    assert.equal(resumed.lastPausedAt, null);

    // 6. Record activity & context switches
    await recordSessionActivity({
      domain: 'docs.python.org',
      category: 'learning',
      durationSeconds: 60
    });

    const switchRes = await recordSessionActivity({
      domain: 'youtube.com',
      category: 'distracting',
      durationSeconds: 45
    });

    assert.equal(switchRes.isContextSwitch, true);
    assert.equal(switchRes.session.contextSwitchCount, 1);
    assert.equal(switchRes.session.distractingDurationSeconds, 45);

    // 7. Complete Session
    const completed = await stopFocusSession({
      focusQualityScore: 9,
      reflectionNotes: 'Finished virtual memory simulation.'
    });

    assert.equal(completed.status, 'completed');
    assert.equal(completed.focusQualityScore, 9);

    // Check active session is cleared
    const activeSessionAfter = await getSession();
    assert.equal(activeSessionAfter, null);

    // Check history contains completed session
    const history = await getSessionHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].title, 'Operating Systems Virtual Memory');
  });

  test('right-to-be-forgotten wipes all records cleanly', async () => {
    await clearAllActivityHistory();

    const history = await getSessionHistory();
    const session = await getSession();

    assert.equal(history.length, 0);
    assert.equal(session, null);
  });

  test('exportAllDataJson provides clean JSON package', async () => {
    const exported = await exportAllDataJson();
    assert.ok(exported.exportDate);
    assert.equal(exported.clientVersion, '1.0.0-mv3');
    assert.ok(Array.isArray(exported.events));
    assert.ok(Array.isArray(exported.sessionHistory));
  });

});
