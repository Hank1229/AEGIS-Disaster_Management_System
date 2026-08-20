// ============================================================
// api.js - Centralized API Call Management
// ============================================================
// Why centralize? The original code had fetch() calls scattered
// everywhere with inconsistent error handling. Now all API calls
// go through this module with unified token handling and errors.
// ============================================================

import { API_URL } from './constants.js';

// ============================================================
// Token Management
// ============================================================
export function getToken() {
  return localStorage.getItem('aegis_token');
}

export function setToken(token) {
  localStorage.setItem('aegis_token', token);
}

export function clearToken() {
  localStorage.removeItem('aegis_token');
}

// ============================================================
// Generic request function with automatic token attachment
// ============================================================
async function request(endpoint, options = {}) {
  const token = getToken();

  // Fixes Issue #10: entire fetch wrapped in try-catch
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
      }
    });

    // Try to parse JSON response
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }

    return data;

  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err.message);
    throw err;
  }
}

// ============================================================
// Auth API Functions
// ============================================================

export async function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function register(email, password) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function getCurrentUser() {
  return request('/auth/me');
}

export async function updateProfile(profileData) {
  return request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData)
  });
}

export async function updateLocation(locationData) {
  return request('/auth/location', {
    method: 'PUT',
    body: JSON.stringify(locationData)
  });
}

// ============================================================
// Disaster Data API Functions
// ============================================================

export async function fetchEarthquakes(params = {}) {
  const queryString = new URLSearchParams(params).toString();
  return request(`/proxy/earthquakes?${queryString}`);
}

export async function fetchStorms(days = 30) {
  return request(`/proxy/storms?days=${days}`);
}

// Fixes Issue #15: Promise.all for parallel requests
// Original: await earthquakes THEN await storms (sequential = slow)
// Now: both requests fire at the same time (parallel = fast)
export async function fetchDisasterData(params = {}) {
  const queryString = new URLSearchParams(params).toString();

  const [earthquakes, storms] = await Promise.all([
    request(`/proxy/earthquakes?${queryString}`),
    request('/proxy/storms')
  ]);

  return { earthquakes, storms };
}

export async function sendAlertEmail(templateParams) {
  return request('/proxy/send-email', {
    method: 'POST',
    body: JSON.stringify(templateParams)
  });
}
