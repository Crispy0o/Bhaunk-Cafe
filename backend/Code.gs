/* Bhaunk Café backend (Google Apps Script, bound to a Google Sheet).
   Sheets used: Menu, Orders, Staff (created by setup()).
   Staff passwords are stored only as salted SHA-256 hashes. */

var TZ = 'Asia/Kolkata';
var OPEN = '10:00', CLOSE = '18:45';
var SESSION_SECONDS = 6 * 60 * 60;      // staff stay logged in for 6 hours (CacheService max)
var MAX_FAILS = 5;                       // failed logins allowed ...
var LOCK_SECONDS = 15 * 60;              // ... per 15 minutes
var STATUSES = ['New', 'Preparing', 'Ready', 'Picked up', 'Cancelled'];
var MENU_SEED = [
  ['latte', 'Good Boy Latte', 180], ['chai', 'Zoomie Masala Chai', 90],
  ['lassi', 'Pup Mango Lassi', 130], ['strawberry-cake', 'Pupcake', 220],
  ['bone-cookies', 'Bone Butter Cookies', 120], ['waffles', 'Tail-Wag Waffles', 210]
];

/* ---------- ONE-TIME SETUP: run setup() once from the editor ---------- */
function setup() {
  var ss = SpreadsheetApp.getActive();
  var menu = ss.getSheetByName('Menu') || ss.insertSheet('Menu');
  if (menu.getLastRow() === 0) {
    menu.appendRow(['id', 'name', 'price', 'available']);
    MENU_SEED.forEach(function (m) { menu.appendRow([m[0], m[1], m[2], true]); });
  }
  var orders = ss.getSheetByName('Orders') || ss.insertSheet('Orders');
  if (orders.getLastRow() === 0) orders.appendRow(['orderId', 'number', 'timestamp', 'date', 'time', 'name', 'phone', 'items', 'total', 'notes', 'status']);
  var staff = ss.getSheetByName('Staff') || ss.insertSheet('Staff');
  if (staff.getLastRow() === 0) staff.appendRow(['username', 'displayName', 'salt', 'hash']);
}

/* Add or reset a staff member: edit the 3 values, run addStaff(), then DELETE the password from the code. */
function addStaff() {
  var username = 'Nitesh', displayName = 'Nitesh', password = 'NiteshDestroyer';
  if (password.length < 10) throw new Error('Use a password of at least 10 characters.');
  var sh = SpreadsheetApp.getActive().getSheetByName('Staff');
  var salt = Utilities.getUuid();
  var row = [username.toLowerCase(), displayName, salt, hash_(salt, password)];
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === row[0]) { sh.getRange(i + 1, 1, 1, 4).setValues([row]); return; }
  }
  sh.appendRow(row);
}

/* ---------- ENTRY POINTS ---------- */
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'menu') {
    return json_({ ok: true, items: menu_().map(function (m) { return { id: m.id, available: m.available }; }) });
  }
  return json_({ ok: false, error: 'Unknown request.' });
}

function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Bad request.' }); }
  try {
    switch (b.action) {
      case 'staffLogin': return json_(staffLogin_(b));
      case 'staffLogout': CacheService.getScriptCache().remove('sess:' + String(b.token || '')); return json_({ ok: true });
      case 'staffData': case 'staffSetAvailable': case 'staffSetStatus':
        var user = session_(b.token);
        if (!user) return json_({ ok: false, code: 'AUTH', error: 'Please log in.' });
        if (b.action === 'staffData') return json_(staffData_(user));
        if (b.action === 'staffSetAvailable') return json_(setAvailable_(b));
        return json_(setStatus_(b));
      default: return json_(placeOrder_(b));   // customer order (no action field)
    }
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Server error. Please try again.' });
  }
}

/* ---------- STAFF AUTH ---------- */
function staffLogin_(b) {
  var username = String(b.username || '').trim().toLowerCase();
  var cache = CacheService.getScriptCache();
  var failKey = 'fail:' + username;
  var fails = Number(cache.get(failKey) || 0);
  if (fails >= MAX_FAILS) return { ok: false, error: 'Too many attempts. Try again in 15 minutes.' };

  var data = SpreadsheetApp.getActive().getSheetByName('Staff').getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === username && safeEq_(data[i][3], hash_(data[i][2], String(b.password || '')))) {
      cache.remove(failKey);
      var token = Utilities.getUuid() + Utilities.getUuid();
      cache.put('sess:' + token, data[i][1], SESSION_SECONDS);
      return { ok: true, token: token, user: data[i][1] };
    }
  }
  cache.put(failKey, String(fails + 1), LOCK_SECONDS);
  return { ok: false, error: 'Wrong username or password.' };
}

function session_(token) { return token ? CacheService.getScriptCache().get('sess:' + String(token)) : null; }
function hash_(salt, pw) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw, Utilities.Charset.UTF_8);
  return bytes.map(function (x) { return ('0' + (x & 0xff).toString(16)).slice(-2); }).join('');
}
function safeEq_(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; var r = 0; for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

/* ---------- STAFF ACTIONS ---------- */
function staffData_(user) {
  var sh = SpreadsheetApp.getActive().getSheetByName('Orders');
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues() : [];
  var orders = rows.reverse().slice(0, 100).map(function (r) {
    return { orderId: r[0], number: r[1], date: r[3], time: r[4], name: r[5], phone: r[6], items: r[7], total: r[8], notes: r[9], status: r[10] };
  });
  return { ok: true, user: user, items: menu_(), orders: orders };
}

function setAvailable_(b) {
  var sh = SpreadsheetApp.getActive().getSheetByName('Menu');
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === b.id) { sh.getRange(i + 1, 4).setValue(b.available === true); return { ok: true }; }
  }
  return { ok: false, error: 'Item not found.' };
}

function setStatus_(b) {
  if (STATUSES.indexOf(b.status) < 0) return { ok: false, error: 'Invalid status.' };
  var sh = SpreadsheetApp.getActive().getSheetByName('Orders');
  var ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === b.orderId) { sh.getRange(i + 2, 11).setValue(b.status); return { ok: true }; }
  }
  return { ok: false, error: 'Order not found.' };
}

/* ---------- CUSTOMER ORDER ---------- */
function placeOrder_(b) {
  var name = String(b.name || '').trim().slice(0, 40);
  var phone = String(b.phone || '').replace(/\D/g, '').slice(-10);
  var time = String(b.time || '');
  var notes = String(b.notes || '').trim().slice(0, 200);
  if (!name) return { ok: false, error: 'Please enter your name.' };
  if (!/^[6-9][0-9]{9}$/.test(phone)) return { ok: false, error: 'Please enter a valid 10-digit mobile number.' };
  if (!/^\d{2}:\d{2}$/.test(time) || time < OPEN || time > CLOSE) return { ok: false, error: 'Pickup time must be between ' + OPEN + ' and ' + CLOSE + '.' };
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 20) return { ok: false, error: 'Your order is empty.' };

  var menu = {}; menu_().forEach(function (m) { menu[m.id] = m; });
  var total = 0, lines = [];
  for (var i = 0; i < b.items.length; i++) {
    var it = b.items[i], m = menu[it.id], q = Math.floor(Number(it.qty));
    if (!m) return { ok: false, error: 'Unknown item.' };
    if (!m.available) return { ok: false, error: m.name + ' is sold out today.' };
    if (!(q >= 1 && q <= 10)) return { ok: false, error: 'Invalid quantity.' };
    total += q * m.price; lines.push(q + ' x ' + m.name);
  }

  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var n = Number(props.getProperty('orderCounter') || 0) + 1; props.setProperty('orderCounter', String(n));
    var number = 'BC-' + ('000' + n).slice(-3);
    var now = new Date();
    // leading ' stops Sheets treating text as formulas / converting phone numbers
    SpreadsheetApp.getActive().getSheetByName('Orders').appendRow([
      Utilities.getUuid(), number, now, Utilities.formatDate(now, TZ, 'dd MMM'), time,
      safeCell_(name), "'" + phone, lines.join(', '), total, safeCell_(notes), 'New'
    ]);
    return { ok: true, orderNumber: number, total: total };
  } finally { lock.releaseLock(); }
}
function safeCell_(s) { return /^[=+\-@]/.test(s) ? "'" + s : s; }   // blocks spreadsheet formula injection

/* ---------- HELPERS ---------- */
function menu_() {
  var data = SpreadsheetApp.getActive().getSheetByName('Menu').getDataRange().getValues();
  return data.slice(1).map(function (r) { return { id: r[0], name: r[1], price: Number(r[2]), available: r[3] === true || r[3] === 'TRUE' }; });
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
