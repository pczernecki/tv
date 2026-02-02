/**
 * Backend Server for Gyerkoc Video Player
 * 
 * This server is NOT used currently - the frontend uses MockAPI (localStorage).
 * When ready to use real backend:
 * 1. Start this server: cd server && npm start
 * 2. In App.jsx, replace MockAPI calls with fetch calls to these endpoints
 * 
 * Endpoints:
 * - POST /api/login     - Login, returns token
 * - POST /api/logout    - Logout
 * - GET  /api/check-auth - Verify token
 * - GET  /api/videos    - Get videos list (public)
 * - POST /api/videos    - Save videos list (requires auth)
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Hardcoded credentials - change in production!
const ADMIN_USER = 'Gyerkoc';
const ADMIN_PASS = 'Gyerkoc123';

// Simple token storage (in production, use proper session/JWT)
const validTokens = new Set();

app.use(cors());
app.use(express.json());

// Path to videos.json
const VIDEOS_FILE = path.join(__dirname, '..', 'public', 'videos.json');

// Middleware to check auth
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !validTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    // Generate simple token
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    validTokens.add(token);
    
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Logout endpoint
app.post('/api/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  validTokens.delete(token);
  res.json({ success: true });
});

// Check if logged in
app.get('/api/check-auth', requireAuth, (req, res) => {
  res.json({ authenticated: true });
});

// Get videos.json (public)
app.get('/api/videos', (req, res) => {
  try {
    const data = fs.readFileSync(VIDEOS_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('Error reading videos.json:', err);
    res.status(500).json({ error: 'Failed to read videos' });
  }
});

// Save videos.json (requires auth)
app.post('/api/videos', requireAuth, (req, res) => {
  try {
    const videos = req.body;
    
    // Validate it's an array
    if (!Array.isArray(videos)) {
      return res.status(400).json({ error: 'Videos must be an array' });
    }
    
    // Write to file
    fs.writeFileSync(VIDEOS_FILE, JSON.stringify(videos, null, 2), 'utf8');
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving videos.json:', err);
    res.status(500).json({ error: 'Failed to save videos' });
  }
});

// Serve static files from public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin login: ${ADMIN_USER} / ${ADMIN_PASS}`);
});
