// server.js - entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add it to .env (local) or the hosting dashboard (Render).');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // serves the frontend

// Health check used by hosting platforms
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/leaves', require('./routes/leaves'));

const PORT = process.env.PORT || 5000; // Render sets PORT automatically
initDb()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`LeaveLoop running -> http://localhost:${PORT}`)))
  .catch((e) => { console.error('Database setup failed:', e.message); process.exit(1); });
