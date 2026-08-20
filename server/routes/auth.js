// ============================================================
// routes/auth.js - Login & Register API
// ============================================================
// Handles:
//   POST /api/auth/register - Create new account
//   POST /api/auth/login    - Authenticate user
//   GET  /api/auth/me       - Get current user (with token)
//   PUT  /api/auth/profile  - Update user profile
//   PUT  /api/auth/location - Update user location
// ============================================================

const express = require('express');
const router = express.Router();

// bcrypt: industry-standard password hashing algorithm
// It converts "mypassword" into an irreversible hash string.
// To verify, it hashes the input and compares the two hashes.
const bcrypt = require('bcryptjs');

// JWT (JSON Web Token): an encrypted string used for authentication.
// After login, the server generates a token for the client.
// The client sends this token with every request to prove identity.
const jwt = require('jsonwebtoken');

const { queries } = require('../database');

// ============================================================
// JWT Verification Middleware
// ============================================================
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

// ============================================================
// POST /api/auth/register
// ============================================================
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // --- Input validation (Fixes Issue #41) ---
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    // --- Normalize email to lowercase (Fixes Issue #12) ---
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is already registered
    const existingUser = queries.findByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'This email is already registered.' });
    }

    // --- Hash password with bcrypt (Fixes Issue #3) ---
    // 10 = salt rounds (encryption strength). 10 is industry standard.
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store hashed password in database (never plaintext)
    const result = queries.createUser(normalizedEmail, hashedPassword);

    // --- Generate JWT token ---
    const token = jwt.sign(
      { id: result.lastInsertRowid },  // payload: user id
      process.env.JWT_SECRET,           // secret key for signing
      { expiresIn: '7d' }              // expires in 7 days
    );

    // Return token and user data (password excluded)
    const user = queries.findById(result.lastInsertRowid);
    res.status(201).json({ token, user });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

// ============================================================
// POST /api/auth/login
// ============================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = queries.findByEmail(normalizedEmail);
    if (!user) {
      // Don't reveal whether the email exists (security best practice)
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // --- Compare password hashes (Fixes Issue #6) ---
    // bcrypt.compare hashes the input and checks against the stored hash
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const safeUser = queries.findById(user.id);
    res.json({ token, user: safeUser });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

// ============================================================
// GET /api/auth/me - Get current user from token
// ============================================================
router.get('/me', verifyToken, (req, res) => {
  try {
    const user = queries.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================================
// PUT /api/auth/profile - Update user profile
// ============================================================
router.put('/profile', verifyToken, (req, res) => {
  try {
    const { name, phone, emailNotify } = req.body;

    queries.updateProfile(
      name || 'Not set',
      phone || 'Not set',
      emailNotify ? 1 : 0,
      req.userId
    );

    const user = queries.findById(req.userId);
    res.json({ user });

  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ============================================================
// PUT /api/auth/location - Update user location
// ============================================================
router.put('/location', verifyToken, (req, res) => {
  try {
    const { lat, lng, locationEnabled } = req.body;

    // Validate coordinates (Fixes Issue #11)
    if (lat !== null && lng !== null) {
      if (lat < -90 || lat > 90) {
        return res.status(400).json({ error: 'Latitude must be between -90 and 90.' });
      }
      if (lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'Longitude must be between -180 and 180.' });
      }
    }

    queries.updateLocation(
      lat,
      lng,
      locationEnabled ? 1 : 0,
      req.userId
    );

    const user = queries.findById(req.userId);
    res.json({ user });

  } catch (err) {
    console.error('Update location error:', err);
    res.status(500).json({ error: 'Failed to update location.' });
  }
});

module.exports = router;
