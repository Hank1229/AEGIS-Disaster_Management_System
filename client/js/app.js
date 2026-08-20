// ============================================================
// app.js - Application Entry Point
// ============================================================
// This is the main file that initializes all modules and
// coordinates the application. It's loaded as an ES module.
// ============================================================

import { initMap, searchDisasters } from './map.js';
import { initAuth, checkAuthState, logout, openModal } from './auth.js';
import { updateDashboard, initDashboard, showView, showNotification } from './ui.js';
import { checkForRisks } from './alerts.js';
import { ALERT_RADIUS_KM } from './constants.js';

// ============================================================
// Application State
// ============================================================
let currentUser = null;

function getCurrentUser() {
  return currentUser;
}

function setCurrentUser(user) {
  currentUser = user;
}

// ============================================================
// Initialize Application
// ============================================================
async function init() {
  console.log('AEGIS Disaster Management System initializing...');

  // Initialize map
  initMap();

  // Initialize auth with callback for login/logout
  initAuth((user) => {
    currentUser = user;
    if (user) {
      updateDashboard(user);
      showView('dashboard');
      showNotification(`Welcome, ${user.name || user.email}!`, 'success');
    } else {
      showView('map');
    }
  });

  // Initialize dashboard handlers
  initDashboard(getCurrentUser, setCurrentUser);

  // Check if user is already logged in
  const existingUser = await checkAuthState();
  if (existingUser) {
    currentUser = existingUser;
    updateDashboard(existingUser);
    updateNavForLoggedIn();
  }

  // Setup navigation
  setupNavigation();

  // Setup search form
  setupSearchForm();

  // Update alert radius display
  const radiusDisplay = document.getElementById('alertRadiusDisplay');
  if (radiusDisplay) {
    radiusDisplay.textContent = `${ALERT_RADIUS_KM} km`;
  }

  console.log('AEGIS initialized successfully');
}

// ============================================================
// Navigation Setup
// ============================================================
function setupNavigation() {
  // Login button
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      openModal('loginModal');
    });
  }

  // Register button
  const registerBtn = document.getElementById('registerBtn');
  if (registerBtn) {
    registerBtn.addEventListener('click', () => {
      openModal('registerModal');
    });
  }

  // Dashboard button
  const dashboardBtn = document.getElementById('dashboardBtn');
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
      if (currentUser) {
        updateDashboard(currentUser);
        showView('dashboard');
      } else {
        openModal('loginModal');
      }
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout();
      currentUser = null;
      showView('map');
      updateNavForLoggedOut();
      showNotification('Logged out successfully', 'info');
    });
  }

  // Back to Map button
  const backToMapBtn = document.getElementById('backToMapBtn');
  if (backToMapBtn) {
    backToMapBtn.addEventListener('click', () => {
      showView('map');
    });
  }

  // Check Now button (risk checking)
  const checkNowBtn = document.getElementById('checkNowBtn');
  if (checkNowBtn) {
    checkNowBtn.addEventListener('click', () => {
      if (currentUser) {
        checkForRisks(currentUser);
      } else {
        showNotification('Please log in first', 'error');
      }
    });
  }
}

// ============================================================
// Search Form Setup
// ============================================================
function setupSearchForm() {
  const searchForm = document.getElementById('searchForm');
  if (!searchForm) return;

  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const disasterType = document.getElementById('disasterType')?.value || 'earthquake';
    const region = document.getElementById('region')?.value || 'usa';
    const days = parseInt(document.getElementById('days')?.value) || 7;
    const minMag = parseFloat(document.getElementById('minMag')?.value) || 0;

    await searchDisasters(disasterType, region, days, minMag);
  });

  // Show/hide magnitude filter based on disaster type
  const disasterTypeSelect = document.getElementById('disasterType');
  const magFilterGroup = document.getElementById('magFilterGroup');

  if (disasterTypeSelect && magFilterGroup) {
    disasterTypeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'earthquake') {
        magFilterGroup.style.display = 'block';
      } else {
        magFilterGroup.style.display = 'none';
      }
    });
  }
}

// ============================================================
// Update Navigation Based on Auth State
// ============================================================
function updateNavForLoggedIn() {
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const dashboardBtn = document.getElementById('dashboardBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (loginBtn) loginBtn.style.display = 'none';
  if (registerBtn) registerBtn.style.display = 'none';
  if (dashboardBtn) dashboardBtn.style.display = 'inline-block';
  if (logoutBtn) logoutBtn.style.display = 'inline-block';
}

function updateNavForLoggedOut() {
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const dashboardBtn = document.getElementById('dashboardBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (loginBtn) loginBtn.style.display = 'inline-block';
  if (registerBtn) registerBtn.style.display = 'inline-block';
  if (dashboardBtn) dashboardBtn.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'none';
}

// ============================================================
// Start Application
// ============================================================
document.addEventListener('DOMContentLoaded', init);
