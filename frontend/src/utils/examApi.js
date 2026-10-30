/**
 * UniVerse — Module E: Responsible Examination Monitoring API Client
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const MODULE_E_BASE = `${API_BASE}/modules/e`;

export async function fetchExamHealth() {
  const res = await fetch(`${MODULE_E_BASE}/health`);
  if (!res.ok) throw new Error('Failed to retrieve Module E health status');
  return res.json();
}

export async function fetchSampleVideos() {
  const res = await fetch(`${MODULE_E_BASE}/samples`);
  if (!res.ok) throw new Error('Failed to retrieve sample examination videos');
  return res.json();
}

export async function fetchExamSessions() {
  const res = await fetch(`${MODULE_E_BASE}/sessions`);
  if (!res.ok) throw new Error('Failed to retrieve exam monitoring sessions');
  return res.json();
}

export async function createExamSession(payload) {
  const res = await fetch(`${MODULE_E_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create exam monitoring session');
  }
  return res.json();
}

export async function startExamSession(sessionId) {
  const res = await fetch(`${MODULE_E_BASE}/sessions/${sessionId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start exam surveillance analysis');
  }
  return res.json();
}

export async function pauseExamSession(sessionId) {
  const res = await fetch(`${MODULE_E_BASE}/sessions/${sessionId}/pause`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to pause exam session');
  return res.json();
}

export async function resumeExamSession(sessionId) {
  const res = await fetch(`${MODULE_E_BASE}/sessions/${sessionId}/resume`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to resume exam session');
  return res.json();
}

export async function stopExamSession(sessionId) {
  const res = await fetch(`${MODULE_E_BASE}/sessions/${sessionId}/stop`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to stop exam session');
  return res.json();
}

export async function fetchSessionIncidents(sessionId, filter = {}) {
  const params = new URLSearchParams();
  if (filter.status) params.append('status', filter.status);
  if (filter.eventType) params.append('eventType', filter.eventType);

  const res = await fetch(`${MODULE_E_BASE}/sessions/${sessionId}/incidents?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to retrieve session incidents');
  return res.json();
}

export async function updateIncidentReview(incidentId, payload) {
  const res = await fetch(`${MODULE_E_BASE}/incidents/${incidentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update incident review status');
  }
  return res.json();
}

export async function uploadExamVideo(file) {
  const formData = new FormData();
  formData.append('video', file);

  const res = await fetch(`${MODULE_E_BASE}/upload`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload examination video');
  }
  return res.json();
}

export async function fetchExamReport(sessionId) {
  const res = await fetch(`${MODULE_E_BASE}/sessions/${sessionId}/report`);
  if (!res.ok) throw new Error('Failed to retrieve structured exam audit report');
  return res.json();
}

export function getExamCsvExportUrl(sessionId) {
  return `${MODULE_E_BASE}/sessions/${sessionId}/export/csv`;
}
