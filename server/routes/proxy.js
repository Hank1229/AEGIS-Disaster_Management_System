// ============================================================
// routes/proxy.js - API Proxy (Protects API Keys)
// ============================================================
// Why do we need a proxy?
//   Previously, the NASA API Key was hardcoded in frontend JS.
//   Anyone could see it in browser DevTools.
//   Now: frontend calls our backend -> backend uses the API Key
//   to call NASA -> the key never reaches the browser.
// ============================================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// ============================================================
// JWT Verification Middleware
// ============================================================
// Every protected route passes through this middleware first.
// It checks the token in the Authorization header.
function verifyToken(req, res, next) {
  // Frontend sends: Authorization: Bearer <token>
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next(); // Token valid, proceed to route handler

  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

// All routes below require authentication
router.use(verifyToken);

// ============================================================
// GET /api/proxy/earthquakes - Proxy for USGS Earthquake Data
// ============================================================
router.get('/earthquakes', async (req, res) => {
  try {
    const params = new URLSearchParams({
      format: 'geojson',
      ...req.query
    });

    const response = await fetch(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`
    );

    if (!response.ok) {
      throw new Error(`USGS API returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('Earthquake API error:', err.message);
    res.status(502).json({ error: 'Failed to fetch earthquake data. Please try again later.' });
  }
});

// ============================================================
// GET /api/proxy/storms - Proxy for NASA Storm Data
// ============================================================
// This is the key security fix:
// process.env.NASA_API_KEY only exists on the server
router.get('/storms', async (req, res) => {
  try {
    const apiKey = process.env.NASA_API_KEY;
    const days = req.query.days || 30;

    const response = await fetch(
      `https://eonet.gsfc.nasa.gov/api/v3/events?api_key=${apiKey}&category=severeStorms&days=${days}&status=open`
    );

    if (!response.ok) {
      throw new Error(`NASA API returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('Storm API error:', err.message);
    res.status(502).json({ error: 'Failed to fetch storm data. Please try again later.' });
  }
});

// ============================================================
// POST /api/proxy/send-email - Proxy for EmailJS
// ============================================================
router.post('/send-email', async (req, res) => {
  try {
    const { to_email, user_name, alert_type, alert_details, alert_time, user_location, distance } = req.body;

    if (!to_email || !alert_type) {
      return res.status(400).json({ error: 'Missing required email fields.' });
    }

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: process.env.EMAIL_SERVICE_ID,
        template_id: process.env.EMAIL_TEMPLATE_ID,
        user_id: process.env.EMAIL_PUBLIC_KEY,
        template_params: {
          to_email,
          user_name: user_name || 'User',
          alert_type,
          alert_details: alert_details || 'No details available',
          alert_time: alert_time || new Date().toISOString(),
          user_location: user_location || 'Unknown',
          distance: distance || 'Unknown'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('EmailJS error response:', errorText);
      throw new Error('EmailJS send failed');
    }

    // Fixes Issue #19: return success/failure to client instead of silent failure
    res.json({ success: true, message: 'Alert email sent successfully.' });

  } catch (err) {
    console.error('Email error:', err.message);
    res.status(500).json({ error: 'Failed to send alert email.' });
  }
});

// ============================================================
// GET /api/proxy/config - Get public config (no secrets)
// ============================================================
// Returns configuration values the frontend needs without exposing keys
router.get('/config', (req, res) => {
  res.json({
    alertRadiusKm: 2000,
    mapDefaultCenter: [37.5, -96],
    mapDefaultZoom: 4
  });
});

module.exports = router;
