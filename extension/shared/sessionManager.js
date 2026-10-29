/**
 * sessionManager.js
 * Session state machine and authoritative time accounting for Chrome Extension.
 * Operates on timestamps so session state survives service worker suspensions and restarts.
 */

import {
  getSession,
  saveSession,
  clearSession,
  appendCompletedSession
} from './storage.js';

/**
 * Calculates true elapsed active focus seconds at a given timestamp
 */
export function calculateActiveSeconds(session, asOfMs = Date.now()) {
  if (!session) return 0;
  let active = session.accumulatedActiveSeconds || 0;
  if (session.status === 'active' && session.lastResumedAt) {
    const delta = Math.max(0, Math.floor((asOfMs - session.lastResumedAt) / 1000));
    active += delta;
  }
  return active;
}

/**
 * Starts a new focus session
 */
export async function startFocusSession({
  title = 'Deep Study Focus',
  targetDurationMinutes = 25,
  sessionCategory = 'coding'
} = {}) {
  const existing = await getSession();
  if (existing && (existing.status === 'active' || existing.status === 'paused')) {
    return {
      session: existing,
      alreadyRunning: true
    };
  }

  const now = Date.now();
  const newSession = {
    id: `ext_ses_${now}_${Math.random().toString(36).substring(2, 7)}`,
    title: (title || 'Deep Study Focus').trim(),
    targetDurationMinutes: parseInt(targetDurationMinutes, 10) || 25,
    sessionCategory: sessionCategory || 'coding',
    status: 'active',
    startTime: now,
    lastResumedAt: now,
    lastPausedAt: null,
    endTime: null,
    accumulatedActiveSeconds: 0,
    totalPausedSeconds: 0,
    contextSwitchCount: 0,
    distractingDurationSeconds: 0,
    eventCount: 0,
    lastRecordedCategory: null,
    lastRecordedDomain: null,
    focusQualityScore: 8,
    reflectionNotes: ''
  };

  await saveSession(newSession);
  return {
    session: newSession,
    alreadyRunning: false
  };
}

/**
 * Pauses active session
 */
export async function pauseFocusSession() {
  const session = await getSession();
  if (!session || session.status !== 'active') return session;

  const now = Date.now();
  const additionalActive = session.lastResumedAt
    ? Math.max(0, Math.floor((now - session.lastResumedAt) / 1000))
    : 0;

  session.accumulatedActiveSeconds = (session.accumulatedActiveSeconds || 0) + additionalActive;
  session.status = 'paused';
  session.lastPausedAt = now;
  session.lastResumedAt = null;

  await saveSession(session);
  return session;
}

/**
 * Resumes paused session
 */
export async function resumeFocusSession() {
  const session = await getSession();
  if (!session || session.status !== 'paused') return session;

  const now = Date.now();
  const additionalPaused = session.lastPausedAt
    ? Math.max(0, Math.floor((now - session.lastPausedAt) / 1000))
    : 0;

  session.totalPausedSeconds = (session.totalPausedSeconds || 0) + additionalPaused;
  session.status = 'active';
  session.lastResumedAt = now;
  session.lastPausedAt = null;

  await saveSession(session);
  return session;
}

/**
 * Stops and finalizes focus session, saving to history
 */
export async function stopFocusSession({ focusQualityScore = 8, reflectionNotes = '' } = {}) {
  const session = await getSession();
  if (!session) return null;

  const now = Date.now();
  if (session.status === 'active' && session.lastResumedAt) {
    const delta = Math.max(0, Math.floor((now - session.lastResumedAt) / 1000));
    session.accumulatedActiveSeconds = (session.accumulatedActiveSeconds || 0) + delta;
  } else if (session.status === 'paused' && session.lastPausedAt) {
    const delta = Math.max(0, Math.floor((now - session.lastPausedAt) / 1000));
    session.totalPausedSeconds = (session.totalPausedSeconds || 0) + delta;
  }

  session.status = 'completed';
  session.endTime = now;
  session.lastResumedAt = null;
  session.lastPausedAt = null;
  session.focusQualityScore = focusQualityScore;
  session.reflectionNotes = reflectionNotes;

  // Persist to completed history
  await appendCompletedSession(session);

  // Clear active session slot
  await clearSession();

  return session;
}

/**
 * Records an observed tab transition within the active session
 */
export async function recordSessionActivity(event) {
  const session = await getSession();
  if (!session || session.status !== 'active') return null;

  let isContextSwitch = false;
  if (session.lastRecordedCategory && session.lastRecordedCategory !== event.category) {
    isContextSwitch = true;
    session.contextSwitchCount = (session.contextSwitchCount || 0) + 1;
  }

  session.eventCount = (session.eventCount || 0) + 1;
  session.lastRecordedCategory = event.category;
  session.lastRecordedDomain = event.domain;

  if (event.category === 'distracting') {
    session.distractingDurationSeconds = (session.distractingDurationSeconds || 0) + (event.durationSeconds || 30);
  }

  await saveSession(session);
  return { session, isContextSwitch };
}
