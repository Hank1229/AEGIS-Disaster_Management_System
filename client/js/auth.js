// ============================================================
// auth.js - Login/Register Frontend UI Logic
// ============================================================

import { login, register, getCurrentUser, setToken, getToken, clearToken } from './api.js';

let onAuthChangeCallback = null;

// ============================================================
// Initialize Auth Module
// ============================================================
export function initAuth(onAuthChange) {
  onAuthChangeCallback = onAuthChange;

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotForm = document.getElementById('forgotForm');

  // --- Login Form ---
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError('loginError');

      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const rememberMe = document.getElementById('rememberMe')?.checked;

      if (!email || !password) {
        showError('loginError', 'Please fill in all fields.');
        return;
      }

      try {
        const { token, user } = await login(email, password);

        // Only store token, never passwords (Fixes Issue #5)
        setToken(token);

        // Remember email if checkbox is checked
        if (rememberMe) {
          localStorage.setItem('aegis_remembered_email', email);
        } else {
          localStorage.removeItem('aegis_remembered_email');
        }

        closeModal('loginModal');
        loginForm.reset();

        if (onAuthChangeCallback) {
          onAuthChangeCallback(user);
        }

      } catch (err) {
        showError('loginError', err.message);
      }
    });
  }

  // --- Register Form ---
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError('registerError');

      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value;
      const confirmPassword = document.getElementById('confirmPassword')?.value;

      if (!email || !password) {
        showError('registerError', 'Please fill in all fields.');
        return;
      }

      if (confirmPassword && password !== confirmPassword) {
        showError('registerError', 'Passwords do not match.');
        return;
      }

      if (password.length < 8) {
        showError('registerError', 'Password must be at least 8 characters.');
        return;
      }

      try {
        const { token, user } = await register(email, password);
        setToken(token);

        closeModal('registerModal');
        registerForm.reset();

        if (onAuthChangeCallback) {
          onAuthChangeCallback(user);
        }

      } catch (err) {
        showError('registerError', err.message);
      }
    });
  }

  // --- Forgot Password Form (simulation) ---
  if (forgotForm) {
    forgotForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('forgotEmail')?.value.trim();

      if (email) {
        showSuccess('forgotSuccess', 'If this email exists, a reset link has been sent.');
        forgotForm.reset();
      }
    });
  }

  // --- Modal Navigation Links ---
  setupModalLinks();

  // --- Prefill remembered email ---
  const rememberedEmail = localStorage.getItem('aegis_remembered_email');
  if (rememberedEmail) {
    const loginEmailInput = document.getElementById('loginEmail');
    const rememberCheckbox = document.getElementById('rememberMe');
    if (loginEmailInput) loginEmailInput.value = rememberedEmail;
    if (rememberCheckbox) rememberCheckbox.checked = true;
  }
}

// ============================================================
// Check if user is already logged in
// ============================================================
export async function checkAuthState() {
  const token = getToken();
  if (!token) return null;

  try {
    const { user } = await getCurrentUser();
    return user;
  } catch (err) {
    // Token invalid or expired
    clearToken();
    return null;
  }
}

// ============================================================
// Logout
// ============================================================
export function logout() {
  clearToken();
  if (onAuthChangeCallback) {
    onAuthChangeCallback(null);
  }
}

// ============================================================
// Modal Helpers
// ============================================================
function setupModalLinks() {
  // Show Register from Login
  document.getElementById('showRegisterLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal('loginModal');
    openModal('registerModal');
  });

  // Show Login from Register
  document.getElementById('showLoginLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal('registerModal');
    openModal('loginModal');
  });

  // Show Forgot Password from Login
  document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal('loginModal');
    openModal('forgotModal');
  });

  // Back to Login from Forgot Password
  document.getElementById('backToLoginLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal('forgotModal');
    openModal('loginModal');
  });

  // Close modals when clicking overlay
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });

  // Close modal buttons
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) closeModal(modal.id);
    });
  });
}

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    // Focus first input for accessibility
    const firstInput = modal.querySelector('input');
    if (firstInput) firstInput.focus();
  }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    clearError(modalId.replace('Modal', 'Error'));
  }
}

// Fixes Issue #4: use textContent instead of innerHTML to prevent XSS
function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
    el.style.color = '#e66';
  }
}

function showSuccess(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
    el.style.color = '#6e6';
  }
}

function clearError(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = '';
    el.style.display = 'none';
  }
}
