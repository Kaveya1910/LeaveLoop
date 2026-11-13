// middleware/auth.js - protects routes using the JWT sent by the browser
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please log in first' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, name, role }
    next();
  } catch {
    res.status(401).json({ message: 'Session expired, please log in again' });
  }
}

function requireManager(req, res, next) {
  if (req.user.role !== 'manager') return res.status(403).json({ message: 'Managers only' });
  next();
}

module.exports = { requireAuth, requireManager };
