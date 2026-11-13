// app.js - talks to the backend with fetch() and updates the page
const $ = (id) => document.getElementById(id);
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');
let isRegister = false;

// One helper for every API call: adds the JWT header and handles errors
async function api(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) logout();
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

// ---------- Login / Register ----------
function setMode(register) {
  isRegister = register;
  $('name').classList.toggle('hidden', !register);
  $('tab-login').classList.toggle('active', !register);
  $('tab-register').classList.toggle('active', register);
  $('auth-btn').textContent = register ? 'Create account' : 'Login';
  $('auth-msg').textContent = '';
}
$('tab-login').onclick = () => setMode(false);
$('tab-register').onclick = () => setMode(true);

$('auth-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const data = await api(`/api/auth/${isRegister ? 'register' : 'login'}`, 'POST', {
      name: $('name').value, email: $('email').value, password: $('password').value,
    });
    token = data.token; user = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    showApp();
  } catch (err) { $('auth-msg').textContent = err.message; $('auth-msg').className = 'msg err'; }
};

function logout() {
  localStorage.clear(); token = null; user = null;
  $('app-view').classList.add('hidden');
  $('auth-view').classList.remove('hidden');
}
$('logout').onclick = logout;

// ---------- Dashboard ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function showApp() {
  $('auth-view').classList.add('hidden');
  $('app-view').classList.remove('hidden');
  const manager = user.role === 'manager';
  $('who').textContent = `${user.name} · ${user.role}`;
  $('apply-panel').classList.toggle('hidden', manager); // managers approve, they don't apply
  $('list-title').textContent = manager ? 'All leave requests' : 'My leave requests';
  $('thead').innerHTML = (manager ? '<th>Employee</th>' : '') +
    '<th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th>Action</th>';
  load();
}

async function load() {
  try {
    const [stats, leaves] = await Promise.all([api('/api/leaves/stats'), api('/api/leaves')]);
    const manager = user.role === 'manager';
    $('cards').innerHTML = [
      manager ? '' : `<div class="stat"><small>Leave balance</small><h2>${stats.balance} days</h2></div>`,
      `<div class="stat warn"><small>Pending</small><h2>${stats.Pending}</h2></div>`,
      `<div class="stat ok"><small>Approved</small><h2>${stats.Approved}</h2></div>`,
      `<div class="stat bad"><small>Rejected</small><h2>${stats.Rejected}</h2></div>`,
    ].join('');

    $('empty').classList.toggle('hidden', leaves.length > 0);
    $('tbody').innerHTML = leaves.map((l) => `
      <tr>
        ${manager ? `<td>${esc(l.employee_name)}</td>` : ''}
        <td>${l.leave_type}</td>
        <td>${fmt(l.start_date)} → ${fmt(l.end_date)}</td>
        <td>${l.days}</td>
        <td>${esc(l.reason)}</td>
        <td><span class="badge ${l.status}">${l.status}</span></td>
        <td>${l.status !== 'Pending' ? '–' : manager
          ? `<button class="act a" data-id="${l.id}" data-s="Approved">Approve</button><button class="act r" data-id="${l.id}" data-s="Rejected">Reject</button>`
          : `<button class="act c" data-id="${l.id}" data-del="1">Cancel</button>`}</td>
      </tr>`).join('');
  } catch (err) { console.error(err); }
}

// One click listener for all row buttons (event delegation)
$('tbody').onclick = async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.dataset.del) await api(`/api/leaves/${b.dataset.id}`, 'DELETE');
    else await api(`/api/leaves/${b.dataset.id}/status`, 'PATCH', { status: b.dataset.s });
    load();
  } catch (err) { alert(err.message); }
};

$('leave-form').onsubmit = async (e) => {
  e.preventDefault();
  const msg = $('leave-msg');
  try {
    const r = await api('/api/leaves', 'POST', {
      leave_type: $('leave_type').value, start_date: $('start_date').value,
      end_date: $('end_date').value, reason: $('reason').value,
    });
    msg.textContent = r.message; msg.className = 'msg ok';
    e.target.reset(); load();
  } catch (err) { msg.textContent = err.message; msg.className = 'msg err'; }
};

if (token && user) showApp();
