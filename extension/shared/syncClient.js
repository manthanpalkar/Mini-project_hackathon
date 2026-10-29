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

export async function syncCompletedSession(session, token, apiUrl = 'http://localhost:5001/api/modules/d') {
  if (!token || !apiUrl) return { skipped: true, reason: 'No auth token or API URL configured.' };

  try {
    const payload = {
      title: session.title,
      targetDurationMinutes: session.targetDurationMinutes,
      sessionCategory: session.sessionCategory,
      durationMinutes: Math.max(1, Math.round((session.accumulatedActiveSeconds || 0) / 60)),
      focusQualityScore: session.focusQualityScore,
      reflectionNotes: session.reflectionNotes
    };

    const res = await fetch(`${apiUrl}/sessions/start`, {
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
    return { success: true, cloudId: created.data?._id };
  } catch (err) {
    console.warn('[SYNC_WARN] Failed to sync session to cloud:', err.message);
    return { success: false, error: err.message };
  }
}
