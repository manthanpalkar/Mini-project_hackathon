/**
 * wellbeingApi.js
 * API Client for UniVerse Module D: Privacy-Aware Digital Wellbeing
 */

const BASE_URL = '/api/modules/d';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function handleResponse(response) {
  if (!response.ok) {
    let errMsg = `Request failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      errMsg = errJson.error || errJson.message || errMsg;
    } catch {
      // non-JSON response fallback
    }
    const err = new Error(errMsg);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

// 1. Health
export async function fetchWellbeingHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  return handleResponse(res);
}

// 2. Focus Sessions Lifecycle
export async function fetchActiveSession() {
  const res = await fetch(`${BASE_URL}/sessions/active`, { headers: getAuthHeaders() });
  return handleResponse(res);
}

export async function startFocusSession(payload) {
  const res = await fetch(`${BASE_URL}/sessions/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function pauseFocusSession(sessionId) {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}/pause`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return handleResponse(res);
}

export async function resumeFocusSession(sessionId) {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}/resume`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return handleResponse(res);
}

export async function stopFocusSession(sessionId, payload = {}) {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}/stop`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function discardFocusSession(sessionId) {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return handleResponse(res);
}

export async function fetchUserSessions(params = {}) {
  const qs = new URLSearchParams();
  if (params.limit) qs.append('limit', params.limit);
  if (params.offset) qs.append('offset', params.offset);
  const res = await fetch(`${BASE_URL}/sessions?${qs.toString()}`, { headers: getAuthHeaders() });
  return handleResponse(res);
}

// 3. Rules
export async function fetchCategorizationRules() {
  const res = await fetch(`${BASE_URL}/rules`, { headers: getAuthHeaders() });
  return handleResponse(res);
}

export async function createCategorizationRule(payload) {
  const res = await fetch(`${BASE_URL}/rules`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function toggleCategorizationRule(ruleId) {
  const res = await fetch(`${BASE_URL}/rules/${ruleId}/toggle`, {
    method: 'PATCH',
    headers: getAuthHeaders()
  });
  return handleResponse(res);
}

export async function deleteCategorizationRule(ruleId) {
  const res = await fetch(`${BASE_URL}/rules/${ruleId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return handleResponse(res);
}

export async function previewDomainClassification(domain) {
  const res = await fetch(`${BASE_URL}/rules/preview`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ domain })
  });
  return handleResponse(res);
}

// 4. Synthetic Event Generator & Event Log
export async function generateSyntheticActivity(payload) {
  const res = await fetch(`${BASE_URL}/events/generate-synthetic`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function fetchActivityEvents(params = {}) {
  const qs = new URLSearchParams();
  if (params.limit) qs.append('limit', params.limit);
  if (params.offset) qs.append('offset', params.offset);
  if (params.category) qs.append('category', params.category);
  if (params.sessionId) qs.append('sessionId', params.sessionId);
  const res = await fetch(`${BASE_URL}/events?${qs.toString()}`, { headers: getAuthHeaders() });
  return handleResponse(res);
}

export async function deleteActivityEvent(eventId) {
  const res = await fetch(`${BASE_URL}/events/${eventId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return handleResponse(res);
}

// 5. Analytics
export async function fetchWellbeingAnalytics(range = 'all', sessionId = null) {
  const qs = new URLSearchParams({ range });
  if (sessionId) qs.append('sessionId', sessionId);
  const res = await fetch(`${BASE_URL}/analytics?${qs.toString()}`, { headers: getAuthHeaders() });
  return handleResponse(res);
}

// 6. Privacy Center
export async function fetchPrivacyStatus() {
  const res = await fetch(`${BASE_URL}/privacy/status`, { headers: getAuthHeaders() });
  return handleResponse(res);
}

export async function clearWellbeingHistory() {
  const res = await fetch(`${BASE_URL}/privacy/clear-history`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return handleResponse(res);
}

export async function exportWellbeingJson() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}/privacy/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error('Failed to download privacy export');
  return res.blob();
}
