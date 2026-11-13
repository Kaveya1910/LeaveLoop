// db.js - MySQL connection pool + automatic table setup
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DB_NAME = process.env.DB_NAME || 'leaveloop';
const config = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Cloud MySQL providers (Aiven, TiDB, etc.) require an encrypted connection.
  // Set DB_SSL=true in the hosting dashboard; leave it unset for local MySQL.
  ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
};

// A pool reuses connections instead of opening a new one per request.
// It connects lazily, so it is safe to create before the database exists.
const pool = mysql.createPool({ ...config, database: DB_NAME, waitForConnections: true, connectionLimit: 10 });

// Runs once at startup: creates the database, tables and a demo manager.
async function initDb() {
  // Try to create the database. Cloud providers usually give you one already
  // (and may block CREATE DATABASE), so a failure here is not fatal.
  try {
    const conn = await mysql.createConnection(config); // one-off connection, no DB selected yet
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await conn.end();
  } catch (e) {
    console.warn('Skipped CREATE DATABASE (using existing database):', e.message);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('employee','manager') NOT NULL DEFAULT 'employee',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      leave_type ENUM('Casual','Sick','Annual') NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      days INT NOT NULL,
      reason VARCHAR(255) NOT NULL,
      status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

  const [rows] = await pool.query("SELECT id FROM users WHERE role = 'manager' LIMIT 1");
  if (rows.length === 0) {
    const hash = await bcrypt.hash('manager123', 10);
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,'manager')",
      ['Demo Manager', 'manager@leaveloop.com', hash]
    );
    console.log('Demo manager created -> manager@leaveloop.com / manager123');
  }
}

module.exports = { pool, initDb };
