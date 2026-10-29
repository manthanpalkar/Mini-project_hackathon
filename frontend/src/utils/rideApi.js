/**
 * UniVerse Module B: Smart Campus Ride-Pooling API Client
 */

const getAuthHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const raw = localStorage.getItem('loop_current_user');
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
      }
    }
  } catch (err) {
    console.error('Failed to get auth token', err);
  }
  return headers;
};

const BASE_MODULE_B = '/api/modules/b';

export async function fetchLocations() {
  const res = await fetch(`${BASE_MODULE_B}/locations`);
  if (!res.ok) throw new Error('Failed to load campus locations');
  const json = await res.json();
  return json.data || [];
}

export async function fetchGraphNetwork() {
  const res = await fetch(`${BASE_MODULE_B}/graph`);
  if (!res.ok) throw new Error('Failed to load campus mobility network');
  const json = await res.json();
  return json.data || { nodes: [], edges: [] };
}

export async function computeRoute(fromNodeId, toNodeId, criteria = 'distance') {
  const res = await fetch(`${BASE_MODULE_B}/routes?from=${encodeURIComponent(fromNodeId)}&to=${encodeURIComponent(toNodeId)}&criteria=${encodeURIComponent(criteria)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to compute route');
  }
  const json = await res.json();
  return json.data;
}

export async function searchRides(params) {
  const res = await fetch(`${BASE_MODULE_B}/rides/search`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to search rides');
  }
  return await res.json();
}

export async function createRideOffer(rideData) {
  const res = await fetch(`${BASE_MODULE_B}/rides`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(rideData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to offer ride');
  }
  return await res.json();
}

export async function fetchMyOfferedRides() {
  const res = await fetch(`${BASE_MODULE_B}/rides/mine`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch offered rides');
  }
  const json = await res.json();
  return json.data || [];
}

export async function cancelRideOffer(rideId, reason = 'Cancelled by driver') {
  const res = await fetch(`${BASE_MODULE_B}/rides/${rideId}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to cancel ride');
  }
  return await res.json();
}

export async function requestSeat(rideId, payload) {
  const res = await fetch(`${BASE_MODULE_B}/rides/${rideId}/requests`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to request seat');
  }
  return await res.json();
}

export async function fetchMyRequests() {
  const res = await fetch(`${BASE_MODULE_B}/requests/mine`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch requests');
  }
  const json = await res.json();
  return json.data || [];
}

export async function cancelRideRequest(requestId) {
  const res = await fetch(`${BASE_MODULE_B}/requests/${requestId}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to cancel request');
  }
  return await res.json();
}

export async function fetchRequestsForRide(rideId) {
  const res = await fetch(`${BASE_MODULE_B}/rides/${rideId}/requests`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch ride requests');
  }
  const json = await res.json();
  return json.data || [];
}

export async function acceptRideRequest(requestId) {
  const res = await fetch(`${BASE_MODULE_B}/requests/${requestId}/accept`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to accept passenger request');
  }
  return await res.json();
}

export async function rejectRideRequest(requestId, reason = 'Declined by driver') {
  const res = await fetch(`${BASE_MODULE_B}/requests/${requestId}/reject`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reject passenger request');
  }
  return await res.json();
}

export async function fetchSustainabilityMetrics() {
  const res = await fetch(`${BASE_MODULE_B}/metrics`);
  if (!res.ok) throw new Error('Failed to load mobility metrics');
  const json = await res.json();
  return json.data;
}
