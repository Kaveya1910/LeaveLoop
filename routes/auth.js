// routes/auth.js - register & login
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const makeToken = (u) =>
  jwt.sign({ id: u.id, name: u.name, role: u.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ message: 'Name, email and a 6+ character password are required' });
  try {
    const hash = await bcrypt.hash(password, 10); // never store plain passwords
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES (?,?,?)",
      [name.trim(), email.trim().toLowerCase(), hash]
    );
    const user = { id: result.insertId, name: name.trim(), role: 'employee' };
    res.status(201).json({ token: makeToken(user), user });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email already registered' });
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
    const u = rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash)))
      return res.status(401).json({ message: 'Wrong email or password' });
    const user = { id: u.id, name: u.name, role: u.role };
    res.json({ token: makeToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
