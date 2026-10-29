// Frontend API Client for UniVerse Module C: Sustainable Computing Observatory

function getAuthHeaders() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchServices() {
  const res = await fetch('/api/modules/c/services', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch compute services');
  const json = await res.json();
  return json.data || [];
}

export async function fetchAssumptions() {
  const res = await fetch('/api/modules/c/assumptions', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch sustainability assumptions');
  const json = await res.json();
  return json.data || {};
}

export async function runSimulation(config) {
  const res = await fetch('/api/modules/c/simulations', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(config)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Simulation failed');
  return json;
}

export async function fetchSimulationHistory(page = 1, limit = 10, mineOnly = false) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit), mineOnly: String(mineOnly) });
  const res = await fetch(`/api/modules/c/simulations?${query}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch simulation history');
  const json = await res.json();
  return json;
}

export async function fetchSimulationById(id) {
  const res = await fetch(`/api/modules/c/simulations/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to load simulation run');
  const json = await res.json();
  return json.data;
}

export async function fetchObservatoryMetrics() {
  const res = await fetch('/api/modules/c/metrics', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch observatory metrics');
  const json = await res.json();
  return json.data || {};
}
