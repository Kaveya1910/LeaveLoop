// routes/leaves.js - CRUD for leave requests (+ manager approval)
const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth, requireManager } = require('../middleware/auth');

const ANNUAL_ALLOWANCE = 20;
router.use(requireAuth); // every route below needs a valid token

// Count calendar days between two dates, inclusive
const countDays = (s, e) => Math.round((new Date(e) - new Date(s)) / 86400000) + 1;
const fail = (res, err) => { console.error(err); res.status(500).json({ message: 'Server error' }); };

// STATS for the dashboard cards (declared before '/:id' routes)
router.get('/stats', async (req, res) => {
  try {
    const isManager = req.user.role === 'manager';
    const [rows] = await pool.query(
      `SELECT status, COUNT(*) AS total, SUM(days) AS days FROM leave_requests
       ${isManager ? '' : 'WHERE user_id = ?'} GROUP BY status`,
      isManager ? [] : [req.user.id]);
    const out = { Pending: 0, Approved: 0, Rejected: 0, approvedDays: 0 };
    rows.forEach((r) => { out[r.status] = r.total; if (r.status === 'Approved') out.approvedDays = Number(r.days); });
    out.balance = ANNUAL_ALLOWANCE - out.approvedDays;
    res.json(out);
  } catch (err) { fail(res, err); }
});

// READ: employee sees own leaves, manager sees everyone's (JOIN gets the name)
router.get('/', async (req, res) => {
  try {
    const isManager = req.user.role === 'manager';
    const [rows] = await pool.query(
      `SELECT l.*, u.name AS employee_name
       FROM leave_requests l JOIN users u ON u.id = l.user_id
       ${isManager ? '' : 'WHERE l.user_id = ?'}
       ORDER BY l.created_at DESC`,
      isManager ? [] : [req.user.id]);
    res.json(rows);
  } catch (err) { fail(res, err); }
});

// CREATE
router.post('/', async (req, res) => {
  const { leave_type, start_date, end_date, reason } = req.body;
  if (!leave_type || !start_date || !end_date || !reason)
    return res.status(400).json({ message: 'All fields are required' });
  const days = countDays(start_date, end_date);
  if (isNaN(days) || days < 1) return res.status(400).json({ message: 'End date must be on or after start date' });
  try {
    const [used] = await pool.query(
      "SELECT COALESCE(SUM(days),0) AS used FROM leave_requests WHERE user_id=? AND status IN ('Approved','Pending')",
      [req.user.id]);
    const left = ANNUAL_ALLOWANCE - Number(used[0].used);
    if (days > left) return res.status(400).json({ message: `Not enough balance. You have ${left} day(s) left` });
    const [r] = await pool.query(
      "INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, days, reason) VALUES (?,?,?,?,?,?)",
      [req.user.id, leave_type, start_date, end_date, days, reason.trim()]);
    res.status(201).json({ id: r.insertId, message: 'Leave request submitted' });
  } catch (err) { fail(res, err); }
});

// UPDATE: manager approves / rejects
router.patch('/:id/status', requireManager, async (req, res) => {
  const { status } = req.body;
  if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
  try {
    const [r] = await pool.query("UPDATE leave_requests SET status=? WHERE id=? AND status='Pending'", [status, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Pending request not found' });
    res.json({ message: `Leave ${status.toLowerCase()}` });
  } catch (err) { fail(res, err); }
});

// DELETE: employee cancels own pending request
router.delete('/:id', async (req, res) => {
  try {
    const [r] = await pool.query(
      "DELETE FROM leave_requests WHERE id=? AND user_id=? AND status='Pending'", [req.params.id, req.user.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Only your pending requests can be cancelled' });
    res.json({ message: 'Request cancelled' });
  } catch (err) { fail(res, err); }
});

module.exports = router;
