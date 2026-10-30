export async function fetchAvailableRides() {
  try {
    const res = await fetch(`${BASE_MODULE_B}/rides`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    return [];
  }
}

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

// ==========================================
// Trip Progression & Simulation APIs
// ==========================================

export async function startRide(rideId) {
  const res = await fetch(`${BASE_MODULE_B}/rides/${rideId}/start`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start ride');
  }
  return await res.json();
}

export async function completeRide(rideId) {
  const res = await fetch(`${BASE_MODULE_B}/rides/${rideId}/complete`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to complete ride');
  }
  return await res.json();
}

export async function fetchRideProgress(rideId) {
  const res = await fetch(`${BASE_MODULE_B}/rides/${rideId}/progress`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch ride progress');
  }
  const json = await res.json();
  return json.data;
}

export async function advanceSimulation(rideId, step = 0.25) {
  const res = await fetch(`${BASE_MODULE_B}/rides/${rideId}/progress/advance`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ step })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to advance simulation');
  }
  return await res.json();
}

// ==========================================
// Ratings & Safety Feedback APIs
// ==========================================

export async function submitRating(rideId, ratingData) {
  const res = await fetch(`${BASE_MODULE_B}/rides/${rideId}/ratings`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(ratingData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit rating');
  }
  return await res.json();
}

export async function fetchDriverRatings(driverEmail) {
  const res = await fetch(`${BASE_MODULE_B}/drivers/${encodeURIComponent(driverEmail)}/ratings`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch driver ratings');
  }
  const json = await res.json();
  return json.data;
}

// ==========================================
// Driver Contact & Privacy APIs
// ==========================================

export async function fetchAuthorizedDriverContact(rideId) {
  const res = await fetch(`${BASE_MODULE_B}/rides/${rideId}/contact`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to retrieve driver contact');
  }
  const json = await res.json();
  return json.data;
}

// ==========================================
// In-App Notifications APIs
// ==========================================

export async function fetchNotifications(limit = 20, unreadOnly = false) {
  const res = await fetch(`${BASE_MODULE_B}/notifications?limit=${limit}&unread=${unreadOnly}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch notifications');
  }
  const json = await res.json();
  return json.data || [];
}

export async function fetchUnreadNotificationCount() {
  const res = await fetch(`${BASE_MODULE_B}/notifications/unread-count`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    return 0;
  }
  const json = await res.json();
  return json.unreadCount || 0;
}

export async function markNotificationRead(id) {
  const res = await fetch(`${BASE_MODULE_B}/notifications/${id}/read`, {
    method: 'PATCH',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to mark notification read');
  }
  return await res.json();
}

export async function markAllNotificationsRead() {
  const res = await fetch(`${BASE_MODULE_B}/notifications/read-all`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to mark all notifications read');
  }
  return await res.json();
}

// ==========================================
// Recurring Commute Templates APIs
// ==========================================

export async function createRecurringTemplate(templateData) {
  const res = await fetch(`${BASE_MODULE_B}/recurring-templates`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(templateData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create recurring commute template');
  }
  return await res.json();
}

export async function fetchMyRecurringTemplates() {
  const res = await fetch(`${BASE_MODULE_B}/recurring-templates/mine`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load recurring templates');
  }
  const json = await res.json();
  return json.data || [];
}

export async function toggleRecurringTemplate(templateId, enabled) {
  const res = await fetch(`${BASE_MODULE_B}/recurring-templates/${templateId}/toggle`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ enabled })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update template status');
  }
  return await res.json();
}

export async function deleteRecurringTemplate(templateId) {
  const res = await fetch(`${BASE_MODULE_B}/recurring-templates/${templateId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete recurring template');
  }
  return await res.json();
}

export async function generateRecurringOccurrences(templateId, horizonDays = 7) {
  const res = await fetch(`${BASE_MODULE_B}/recurring-templates/${templateId}/generate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ horizonDays })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate recurring rides');
  }
  return await res.json();
}

export async function previewRecurringOccurrences(templateId, horizonDays = 14) {
  const res = await fetch(`${BASE_MODULE_B}/recurring-templates/${templateId}/preview?horizonDays=${horizonDays}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to preview template departures');
  }
  const json = await res.json();
  return json.data || [];
}

export async function fetchMySustainabilityOutcomes() {
  const res = await fetch(`${BASE_MODULE_B}/outcomes/mine`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch student sustainability history');
  }
  return await res.json();
}
