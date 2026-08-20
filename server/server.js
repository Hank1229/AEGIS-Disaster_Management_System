// ============================================================
// server.js - Express Backend Entry Point
// ============================================================
// Express is the most popular Node.js backend framework.
// It handles incoming HTTP requests and sends responses.
// Routes are defined with app.get(), app.post(), etc.
// ============================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDatabase } = require('./database');
const authRoutes = require('./routes/auth');
const proxyRoutes = require('./routes/proxy');

const app = express();

// ============================================================
// Middleware - processes every incoming request
// ============================================================

// CORS: allows the frontend (different port) to call backend APIs
// Without this, the browser's same-origin policy blocks cross-origin requests
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// ============================================================
// API Routes
// ============================================================

app.use('/api/auth', authRoutes);   // /api/auth/login, /api/auth/register
app.use('/api/proxy', proxyRoutes); // /api/proxy/earthquakes, /api/proxy/storms

// ============================================================
// Serve frontend static files in production
// ============================================================
app.use(express.static(path.join(__dirname, '../client')));

// Serve CSS from the css subdirectory
app.use('/css', express.static(path.join(__dirname, '../client/css')));

// Serve JS from the js subdirectory
app.use('/js', express.static(path.join(__dirname, '../client/js')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ============================================================
// Start server (after database initialization)
// ============================================================
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`AEGIS server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
