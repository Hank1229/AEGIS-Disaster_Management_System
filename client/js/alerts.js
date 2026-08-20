// ============================================================
// alerts.js - Disaster Risk Checking
// ============================================================

import { fetchDisasterData, sendAlertEmail } from './api.js';
import { EARTH_RADIUS_KM, ALERT_RADIUS_KM, MS_PER_DAY } from './constants.js';

// Track sent alerts to prevent duplicates (Fixes Issue #18: Map with expiry)
const sentAlerts = new Map();

// Prevent duplicate clicks (Fixes Issue #14)
let isChecking = false;

// ============================================================
// Haversine Formula: calculates distance between two points
// on Earth's surface, accounting for the planet's curvature.
// ============================================================
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// Main function: check for nearby disaster risks
// ============================================================
export async function checkForRisks(currentUser, options = {}) {
  const { onStatusChange, onAlertsFound } = options;

  const updateStatus = (msg) => {
    if (onStatusChange) onStatusChange(msg);
    const el = document.getElementById('riskStatus');
    if (el) el.textContent = msg;
  };

  // Fixes Issue #7: null check before using lat/lng
  if (!currentUser || currentUser.lat == null || currentUser.lng == null) {
    updateStatus('Please set your location first.');
    return [];
  }

  // Fixes Issue #14: prevent duplicate requests
  if (isChecking) {
    updateStatus('Already checking...');
    return [];
  }

  isChecking = true;

  try {
    updateStatus('Checking for nearby disaster risks...');

    // Fetch earthquake and storm data in parallel
    const startDate = new Date(Date.now() - MS_PER_DAY);
    const data = await fetchDisasterData({
      starttime: startDate.toISOString(),
      minmagnitude: 4.0
    });

    const alerts = [];

    // --- Process earthquake data ---
    // Fixes Issue #9: safe access with optional chaining (?.)
    const features = data.earthquakes?.features || [];

    for (const eq of features) {
      const coords = eq?.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;

      const eqLat = coords[1];
      const eqLng = coords[0];

      // Validate coordinates are numbers
      if (!Number.isFinite(eqLat) || !Number.isFinite(eqLng)) continue;

      const dist = haversineDistance(currentUser.lat, currentUser.lng, eqLat, eqLng);

      if (dist <= ALERT_RADIUS_KM) {
        const time = eq?.properties?.time;
        // Skip if older than 24 hours
        if (time && Date.now() - time > MS_PER_DAY) continue;

        alerts.push({
          id: eq.id || `eq-${eqLat}-${eqLng}`,
          type: 'Earthquake',
          magnitude: eq?.properties?.mag || 0,
          title: eq?.properties?.title || eq?.properties?.place || 'Unknown earthquake',
          dist: dist.toFixed(1),
          time: time ? new Date(time).toLocaleString() : 'Unknown',
          lat: eqLat,
          lng: eqLng
        });
      }
    }

    // --- Process storm data ---
    const events = data.storms?.events || [];

    for (const storm of events) {
      const geometry = storm?.geometry;
      if (!geometry || geometry.length === 0) continue;

      // Get latest position
      const latest = geometry[geometry.length - 1];
      const coords = latest?.coordinates;
      if (!coords || coords.length < 2) continue;

      const stormLat = coords[1];
      const stormLng = coords[0];

      if (!Number.isFinite(stormLat) || !Number.isFinite(stormLng)) continue;

      const dist = haversineDistance(currentUser.lat, currentUser.lng, stormLat, stormLng);

      if (dist <= ALERT_RADIUS_KM) {
        alerts.push({
          id: storm.id || `storm-${stormLat}-${stormLng}`,
          type: 'Storm/Hurricane',
          title: storm?.title || 'Unknown storm',
          dist: dist.toFixed(1),
          time: latest?.date ? new Date(latest.date).toLocaleString() : 'Unknown',
          lat: stormLat,
          lng: stormLng
        });
      }
    }

    // Render alerts to UI
    renderAlerts(alerts);

    // Send email notifications if enabled
    if (currentUser.email_notify) {
      for (const alert of alerts) {
        await trySendEmail(alert, currentUser);
      }
    }

    // Update status
    if (alerts.length === 0) {
      updateStatus(`No active alerts within ${ALERT_RADIUS_KM}km of your location.`);
    } else {
      updateStatus(`Warning: ${alerts.length} alert(s) found nearby!`);
    }

    if (onAlertsFound) onAlertsFound(alerts);

    return alerts;

  } catch (err) {
    updateStatus('Failed to check risks. Please try again.');
    console.error('Risk check error:', err);
    return [];
  } finally {
    isChecking = false;
  }
}

// ============================================================
// Render alerts using DOM API (Fixes Issue #4: no innerHTML for user data)
// ============================================================
function renderAlerts(alerts) {
  const listEl = document.getElementById('alertList');
  if (!listEl) return;

  // Clear existing alerts
  listEl.innerHTML = '';

  if (alerts.length === 0) {
    const li = document.createElement('li');
    li.className = 'no-alerts';
    li.textContent = 'No active alerts in your area.';
    li.style.textAlign = 'center';
    li.style.color = '#6e6';
    listEl.appendChild(li);
    return;
  }

  for (const alert of alerts) {
    const li = document.createElement('li');
    li.className = 'alert-item';

    // Using DOM API instead of innerHTML prevents XSS:
    // even if alert.title contains malicious HTML, it's treated as plain text
    const title = document.createElement('strong');
    title.textContent = `${alert.type}${alert.magnitude ? ` M${alert.magnitude.toFixed(1)}` : ''} (${alert.dist} km away)`;
    title.style.color = '#e66';

    const desc = document.createElement('p');
    desc.textContent = alert.title;
    desc.style.margin = '5px 0';

    const time = document.createElement('small');
    time.textContent = alert.time;
    time.style.color = '#99a';

    li.appendChild(title);
    li.appendChild(desc);
    li.appendChild(time);
    listEl.appendChild(li);
  }
}

// ============================================================
// Send email notification (Fixes Issue #19: errors reported)
// ============================================================
async function trySendEmail(alert, user) {
  // Fixes Issue #18: check if already sent (with expiry)
  if (sentAlerts.has(alert.id)) {
    const expiry = sentAlerts.get(alert.id);
    if (Date.now() < expiry) {
      console.log(`Skipping duplicate alert email: ${alert.id}`);
      return;
    }
  }

  try {
    // Fixes Issue #7: null check before .toFixed()
    const locationStr = (user.lat != null && user.lng != null)
      ? `${user.lat.toFixed(2)}, ${user.lng.toFixed(2)}`
      : 'Unknown';

    await sendAlertEmail({
      to_email: user.email,
      user_name: user.name || 'User',
      alert_type: alert.type,
      alert_details: alert.title,
      alert_time: alert.time,
      user_location: locationStr,
      distance: `${alert.dist} km`
    });

    // Mark as sent, expires after 24 hours
    sentAlerts.set(alert.id, Date.now() + MS_PER_DAY);
    console.log(`Alert email sent: ${alert.id}`);

  } catch (err) {
    console.error('Email send failed:', err.message);
    // Don't throw - email failure shouldn't break the alert check
  }
}

// ============================================================
// Get checking state
// ============================================================
export function isCheckingRisks() {
  return isChecking;
}
