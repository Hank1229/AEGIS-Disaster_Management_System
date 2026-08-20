// ============================================================
// ui.js - Dashboard UI Updates
// ============================================================

import { LAT_MIN, LAT_MAX, LNG_MIN, LNG_MAX, ALERT_RADIUS_KM } from './constants.js';
import { updateProfile, updateLocation } from './api.js';

// ============================================================
// Update Dashboard Display
// ============================================================
export function updateDashboard(user) {
  if (!user) return;

  // Profile info
  setText('#emailDisplay', user.email || 'Not set');
  setText('#nameDisplay', user.name || 'Not set');
  setText('#phoneDisplay', user.phone || 'Not set');

  // Fixes Issue #7: null check before calling .toFixed()
  if (user.lat != null && user.lng != null) {
    setText('#locationDisplay', `${user.lat.toFixed(4)}, ${user.lng.toFixed(4)}`);
  } else {
    setText('#locationDisplay', 'Not set');
  }

  // Fixes Issue #27: use text + color, not just color for status
  const statusEl = document.querySelector('#locationStatus');
  if (statusEl) {
    if (user.location_enabled) {
      statusEl.textContent = 'GPS Active';
      statusEl.style.color = '#28a745';
    } else {
      statusEl.textContent = 'GPS Inactive';
      statusEl.style.color = '#ffa500';
    }
  }

  // Email notification status
  const emailStatusEl = document.querySelector('#emailNotifyStatus');
  if (emailStatusEl) {
    if (user.email_notify) {
      emailStatusEl.textContent = 'Enabled';
      emailStatusEl.style.color = '#28a745';
    } else {
      emailStatusEl.textContent = 'Disabled';
      emailStatusEl.style.color = '#99a';
    }
  }

  // Fixes Issue #16: show the correct alert radius
  setText('#alertRadiusDisplay', `${ALERT_RADIUS_KM} km`);

  // Update form fields for edit mode
  const editName = document.getElementById('editName');
  const editPhone = document.getElementById('editPhone');
  const emailNotifyToggle = document.getElementById('emailNotifyToggle');
  const gpsToggle = document.getElementById('gpsToggle');
  const manualLat = document.getElementById('manualLat');
  const manualLng = document.getElementById('manualLng');

  if (editName) editName.value = user.name !== 'Not set' ? user.name : '';
  if (editPhone) editPhone.value = user.phone !== 'Not set' ? user.phone : '';
  if (emailNotifyToggle) emailNotifyToggle.checked = Boolean(user.email_notify);
  if (gpsToggle) gpsToggle.checked = Boolean(user.location_enabled);
  if (manualLat && user.lat != null) manualLat.value = user.lat;
  if (manualLng && user.lng != null) manualLng.value = user.lng;
}

// ============================================================
// Initialize Dashboard Event Handlers
// ============================================================
export function initDashboard(getCurrentUser, setCurrentUser) {
  // Edit Profile Button
  const editProfileBtn = document.getElementById('editProfileBtn');
  const profileDisplay = document.getElementById('profileDisplay');
  const profileEdit = document.getElementById('profileEdit');

  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', () => {
      if (profileDisplay) profileDisplay.style.display = 'none';
      if (profileEdit) profileEdit.style.display = 'block';
    });
  }

  // Cancel Edit Button
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      if (profileDisplay) profileDisplay.style.display = 'block';
      if (profileEdit) profileEdit.style.display = 'none';
      // Reset form to current values
      const user = getCurrentUser();
      if (user) updateDashboard(user);
    });
  }

  // Save Profile Form
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('editName')?.value.trim();
      const phone = document.getElementById('editPhone')?.value.trim();
      const emailNotify = document.getElementById('emailNotifyToggle')?.checked;

      try {
        const { user } = await updateProfile({ name, phone, emailNotify });
        setCurrentUser(user);
        updateDashboard(user);

        if (profileDisplay) profileDisplay.style.display = 'block';
        if (profileEdit) profileEdit.style.display = 'none';

        showNotification('Profile updated successfully!', 'success');
      } catch (err) {
        showNotification('Failed to update profile: ' + err.message, 'error');
      }
    });
  }

  // GPS Toggle
  const gpsToggle = document.getElementById('gpsToggle');
  if (gpsToggle) {
    gpsToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;

      if (enabled) {
        // Request GPS permission
        if (!navigator.geolocation) {
          showNotification('Geolocation is not supported by your browser.', 'error');
          e.target.checked = false;
          return;
        }

        showNotification('Getting your location...', 'info');

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { user } = await updateLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                locationEnabled: true
              });
              setCurrentUser(user);
              updateDashboard(user);
              showNotification('Location updated!', 'success');
            } catch (err) {
              showNotification('Failed to save location: ' + err.message, 'error');
              e.target.checked = false;
            }
          },
          (error) => {
            showNotification('Unable to get location: ' + error.message, 'error');
            e.target.checked = false;
          },
          { timeout: 10000, maximumAge: 300000 } // Fixes Issue #20
        );
      } else {
        // Disable GPS
        try {
          const { user } = await updateLocation({ lat: null, lng: null, locationEnabled: false });
          setCurrentUser(user);
          updateDashboard(user);
        } catch (err) {
          showNotification('Failed to update: ' + err.message, 'error');
        }
      }
    });
  }

  // Manual Location Form
  const manualLocationForm = document.getElementById('manualLocationForm');
  if (manualLocationForm) {
    manualLocationForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const latStr = document.getElementById('manualLat')?.value;
      const lngStr = document.getElementById('manualLng')?.value;

      const validation = validateCoordinates(latStr, lngStr);
      if (!validation.valid) {
        showNotification(validation.error, 'error');
        return;
      }

      try {
        const { user } = await updateLocation({
          lat: validation.lat,
          lng: validation.lng,
          locationEnabled: false
        });
        setCurrentUser(user);
        updateDashboard(user);
        showNotification('Location saved!', 'success');
      } catch (err) {
        showNotification('Failed to save location: ' + err.message, 'error');
      }
    });
  }
}

// ============================================================
// Coordinate Validation (Fixes Issues #11, #13)
// ============================================================
export function validateCoordinates(latStr, lngStr) {
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    return { valid: false, error: 'Please enter valid numerical coordinates.' };
  }

  if (lat < LAT_MIN || lat > LAT_MAX) {
    return { valid: false, error: `Latitude must be between ${LAT_MIN} and ${LAT_MAX}.` };
  }

  if (lng < LNG_MIN || lng > LNG_MAX) {
    return { valid: false, error: `Longitude must be between ${LNG_MIN} and ${LNG_MAX}.` };
  }

  return { valid: true, lat, lng };
}

// ============================================================
// View Switching
// ============================================================
export function showView(viewName) {
  const mapView = document.getElementById('mapView');
  const dashboardView = document.getElementById('dashboardView');

  if (viewName === 'map') {
    if (mapView) mapView.style.display = 'block';
    if (dashboardView) dashboardView.style.display = 'none';
  } else if (viewName === 'dashboard') {
    if (mapView) mapView.style.display = 'none';
    if (dashboardView) dashboardView.style.display = 'block';
  }
}

// ============================================================
// Notification System
// ============================================================
export function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  // Style based on type
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 4px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;

  if (type === 'success') notification.style.background = '#28a745';
  else if (type === 'error') notification.style.background = '#dc3545';
  else notification.style.background = '#17a2b8';

  document.body.appendChild(notification);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ============================================================
// Helper Functions
// ============================================================
function setText(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}
