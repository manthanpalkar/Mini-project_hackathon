/**
 * syncClient.js
 * Optional, authenticated synchronization client connecting the Chrome Extension
 * to the UniVerse Module D backend API. Fully graceful when offline or disconnected.
 */

export async function testBackendConnection(token, apiUrl = 'http://localhost:5001/api/modules/d') {
  try {
    const res = await fetch(`${apiUrl}/health`);
    if (!res.ok) throw new Error(`Health check returned ${res.status}`);
    const health = await res.json();

    if (token) {
      const authRes = await fetch(`${apiUrl}/privacy/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (authRes.ok) {
        const userStatus = await authRes.json();
        return {
          connected: true,
          authenticated: true,
          userEmail: userStatus.userEmail,
          module: health.module
        };
      }
    }

    return {
      connected: true,
      authenticated: false,
      module: health.module
    };
  } catch (err) {
    return {
      connected: false,
      authenticated: false,
      error: err.message
    };
  }
}

export async function syncCompletedSession(session, events = [], token, apiUrl = 'http://localhost:5001/api/modules/d') {
  if (!token || !apiUrl) return { skipped: true, reason: 'No auth token or API URL configured.' };

  try {
    const payload = {
      session: {
        title: session.title || 'Chrome Focus Session',
        targetDurationMinutes: session.targetDurationMinutes || 25,
        sessionCategory: session.sessionCategory || 'deep_work',
        accumulatedActiveSeconds: session.accumulatedActiveSeconds || (session.durationMinutes ? session.durationMinutes * 60 : 1500),
        durationMinutes: Math.max(1, Math.round((session.accumulatedActiveSeconds || 0) / 60)),
        contextSwitchCount: session.contextSwitchCount || 0,
        distractingDurationSeconds: session.distractingDurationSeconds || 0,
        focusQualityScore: session.focusQualityScore || 8,
        reflectionNotes: session.reflectionNotes || 'Recorded via UniVerse Chrome Extension',
        startedAt: session.startedAt,
        completedAt: session.completedAt || new Date().toISOString()
      },
      events: Array.isArray(events) ? events.slice(0, 100) : []
    };

    const res = await fetch(`${apiUrl}/sync-extension`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Cloud sync returned HTTP ${res.status}`);
    }

    const created = await res.json();
    return {
      success: true,
      cloudId: created.data?.sessionId,
      insertedEventsCount: created.data?.insertedEventsCount,
      accumulatedActiveSeconds: created.data?.accumulatedActiveSeconds
    };
  } catch (err) {
    console.warn('[SYNC_WARN] Failed to sync session to cloud:', err.message);
    return { success: false, error: err.message };
  }
}
