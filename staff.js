/* Bhaunk Café: staff.js
   Staff page: log in, mark items sold out / available, and update order status.
   Everything talks to the Google Apps Script backend (backend/Code.gs) with one function: call(). */
(function () {
  'use strict';
  var URL = (window.BHAUNK_CONFIG || {}).backendUrl || '';
  var KEY = 'bhaunk-staff-token';
  var STATUSES = ['New', 'Preparing', 'Ready', 'Picked up', 'Cancelled'];
  var token = '';
  try { token = sessionStorage.getItem(KEY) || ''; } catch (e) { /* ignore */ }
  var timer = null;
  var $ = function (id) { return document.getElementById(id); };

  function say(text, kind) { var m = $('msg'); m.textContent = text || ''; m.dataset.kind = kind || ''; m.hidden = !text; }

  // one function for every request to the backend
  function call(body) {
    body.token = token;
    return fetch(URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (res) { if (res && res.code === 'AUTH') { showLogin('Session ended. Please log in again.'); } return res; });
  }

  function showLogin(note) {
    token = ''; try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    clearInterval(timer);
    $('login-box').hidden = false; $('panel').hidden = true; say(note || '', note ? 'error' : '');
  }

  function el(tag, text, cls) { var n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; }

  function render(res) {
    $('hello').textContent = 'Hi ' + res.user + '!';
    var items = $('items'); items.textContent = '';
    res.items.forEach(function (m) {
      var row = el('li', null, 'staff-row' + (m.available ? '' : ' off'));
      row.appendChild(el('strong', m.name + ' (₹' + m.price + ')'));
      var b = el('button', m.available ? 'Mark sold out' : 'Mark available again', 'button ' + (m.available ? 'button-secondary' : 'button-primary'));
      b.type = 'button';
      b.addEventListener('click', function () {
        b.disabled = true;
        call({ action: 'staffSetAvailable', id: m.id, available: !m.available }).then(function (r) { if (!r.ok) say(r.error, 'error'); load(); });
      });
      row.appendChild(b); items.appendChild(row);
    });
    var orders = $('orders'); orders.textContent = '';
    if (!res.orders.length) orders.appendChild(el('li', 'No orders yet.'));
    res.orders.forEach(function (o) {
      var row = el('li', null, 'staff-row');
      var info = el('article');
      info.appendChild(el('strong', o.number + ' · ' + o.name + ' · ' + o.phone));
      info.appendChild(el('small', o.date + ' ' + o.time + ' · ' + o.items + ' · ₹' + o.total + (o.notes ? ' · Note: ' + o.notes : '')));
      var sel = el('select'); sel.setAttribute('aria-label', 'Status of order ' + o.number);
      STATUSES.forEach(function (s) { var op = el('option', s); op.value = s; if (s === o.status) op.selected = true; sel.appendChild(op); });
      sel.addEventListener('change', function () {
        call({ action: 'staffSetStatus', orderId: o.orderId, status: sel.value }).then(function (r) { say(r.ok ? 'Saved ✓' : r.error, r.ok ? '' : 'error'); });
      });
      row.appendChild(info); row.appendChild(sel); orders.appendChild(row);
    });
  }

  function load() {
    return call({ action: 'staffData' }).then(function (res) {
      if (res && res.ok) { $('login-box').hidden = true; $('panel').hidden = false; render(res); }
    }).catch(function () { say('Could not reach the server. Check your internet.', 'error'); });
  }

  function start() { load(); clearInterval(timer); timer = setInterval(function () { if (!document.hidden) load(); }, 30000); }

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault(); say('');
    call({ action: 'staffLogin', username: $('u').value, password: $('p').value }).then(function (res) {
      if (res && res.ok) { token = res.token; try { sessionStorage.setItem(KEY, token); } catch (err) { /* ignore */ } $('p').value = ''; start(); }
      else say((res && res.error) || 'Login failed.', 'error');
    }).catch(function () { say('Could not reach the server. Check your internet.', 'error'); });
  });
  $('logout').addEventListener('click', function () { call({ action: 'staffLogout' }); showLogin(''); });

  if (!URL) { $('login-box').hidden = true; say('Backend not connected yet. Paste the Web app URL into config.js (see backend/SETUP.md).', 'error'); }
  else if (token) start();
})();
