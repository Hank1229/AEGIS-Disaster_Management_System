// ============================================================
// database.js - SQLite Database Setup (using sql.js)
// ============================================================
// sql.js is a pure JavaScript implementation of SQLite.
// It runs in WASM and doesn't require native compilation.
// Data is persisted to a file on disk.
// ============================================================

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'aegis.db');

let db = null;

// ============================================================
// Initialize Database
// ============================================================
async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create users table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT DEFAULT 'Not set',
      phone TEXT DEFAULT 'Not set',
      location_enabled INTEGER DEFAULT 0,
      lat REAL DEFAULT NULL,
      lng REAL DEFAULT NULL,
      email_notify INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  saveDatabase();
  console.log('Database initialized');
  return db;
}

// ============================================================
// Save database to disk
// ============================================================
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// ============================================================
// Query helpers
// ============================================================
const queries = {
  findByEmail: (email) => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    stmt.bind([email]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  },

  createUser: (email, password) => {
    db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, password]);
    saveDatabase();
    // Get the ID of the just-inserted user by querying by email
    const stmt = db.prepare('SELECT id FROM users WHERE email = ?');
    stmt.bind([email]);
    let userId = null;
    if (stmt.step()) {
      userId = stmt.getAsObject().id;
    }
    stmt.free();
    return { lastInsertRowid: userId };
  },

  updateProfile: (name, phone, emailNotify, userId) => {
    db.run('UPDATE users SET name = ?, phone = ?, email_notify = ? WHERE id = ?',
      [name, phone, emailNotify, userId]);
    saveDatabase();
  },

  updateLocation: (lat, lng, locationEnabled, userId) => {
    db.run('UPDATE users SET lat = ?, lng = ?, location_enabled = ? WHERE id = ?',
      [lat, lng, locationEnabled, userId]);
    saveDatabase();
  },

  findById: (id) => {
    const stmt = db.prepare(`
      SELECT id, email, name, phone, location_enabled, lat, lng, email_notify, created_at
      FROM users WHERE id = ?
    `);
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }
};

// ============================================================
// Exports
// ============================================================
module.exports = {
  initDatabase,
  getDb: () => db,
  queries,
  saveDatabase
};
