/* ==========================================================
   cart.js  -  the pre-order cart
   Works on index.html (the "Add to order" buttons + the 🛒 badge)
   and on order.html (the full cart and the WhatsApp message).
   ========================================================== */

// ---------- 1. SETTINGS (they live in config.js) ----------
const CONFIG = window.BHAUNK_CONFIG || {};
const WHATSAPP_NUMBER = CONFIG.whatsapp || '';
const CAFE_NAME = CONFIG.name || 'Bhaunk Café';
const BACKEND_URL = CONFIG.backendUrl || '';     // the Google Apps Script link. Empty = WhatsApp-only mode

// ---------- 2. THE CART ----------
// The cart is just an object that says how many of each item we have.
// Example:  { latte: 2, chai: 1 }   means 2 lattes and 1 chai.
let cart = {};
let renderOrderPage = null;   // order.html fills this in, so other code can redraw that page

// localStorage is a tiny notebook in the browser. It lets the cart survive
// when you go from the menu page to the order page.
// (try/catch = "if the browser blocks storage, just carry on without it")
try {
  cart = JSON.parse(localStorage.getItem('bhaunk-cart')) || {};
} catch (error) {
  cart = {};
}

function saveCart() {
  try {
    localStorage.setItem('bhaunk-cart', JSON.stringify(cart));
  } catch (error) {
    // storage blocked: the cart still works until the page closes
  }
}

// add up how many items are in the cart
function countItems() {
  let total = 0;
  for (const id in cart) {
    total = total + cart[id];
  }
  return total;
}

// update the little number on the 🛒 in the menu bar
function updateBadge() {
  const badge = document.querySelector('[data-cart-count]');
  const count = countItems();
  badge.textContent = count;
  badge.hidden = count === 0;      // hide the badge when the cart is empty
}

// ---------- 3. "ADD TO ORDER" BUTTONS (index.html) ----------
const addButtons = document.querySelectorAll('[data-add]');

addButtons.forEach(function (button) {
  button.dataset.label = button.textContent;     // remember the text, we need it if an item sells out and comes back
  button.addEventListener('click', function () {
    const id = button.dataset.add;           // reads data-add="latte" from the HTML
    cart[id] = (cart[id] || 0) + 1;          // +1 (start from 0 if it's not in the cart yet)
    saveCart();
    updateBadge();

    // tiny "Added ♥" feedback for one second
    const oldText = button.textContent;
    button.textContent = 'Added ♥';
    setTimeout(function () { button.textContent = oldText; }, 1000);
  });
});

// ---------- 4. THE ORDER PAGE (order.html) ----------
const orderList = document.querySelector('.order-list');

if (orderList) {                              // only run this part on order.html
  const summaryList = document.querySelector('#summary-list');
  const summaryEmpty = document.querySelector('#summary-empty');
  const totalEl = document.querySelector('#order-total');
  const form = document.querySelector('#order-form');
  const preview = document.querySelector('#order-preview');
  const message = document.querySelector('#order-message');
  const rows = document.querySelectorAll('.order-item');

  // Draw everything on the page from the cart (runs every time the cart changes)
  function render() {
    let total = 0;
    summaryList.innerHTML = '';

    rows.forEach(function (row) {
      const id = row.dataset.id;
      const name = row.dataset.name;
      const price = Number(row.dataset.price);   // data-price is text, so turn it into a number
      const qty = cart[id] || 0;

      row.querySelector('output').textContent = qty;   // the number between − and +

      if (qty > 0) {
        total = total + qty * price;
        summaryList.innerHTML += '<li>' + qty + ' × ' + name + '<data value="' + (qty * price) + '">₹' + (qty * price) + '</data></li>';
      }
    });

    summaryEmpty.hidden = countItems() > 0;
    totalEl.textContent = '₹' + total;
    updateBadge();
  }

  // One click listener for all the + and − buttons ("event delegation")
  orderList.addEventListener('click', function (event) {
    const button = event.target.closest('button');
    if (!button) return;

    const id = button.closest('.order-item').dataset.id;
    if (button.hasAttribute('data-inc') && (cart[id] || 0) < 10) {
      cart[id] = (cart[id] || 0) + 1;
    }
    if (button.hasAttribute('data-dec') && cart[id] > 0) {
      cart[id] = cart[id] - 1;
      if (cart[id] === 0) delete cart[id];      // remove it from the cart at zero
    }
    saveCart();
    render();
  });

  document.querySelector('#clear-order').addEventListener('click', function () {
    cart = {};
    saveCart();
    preview.hidden = true;
    render();
  });

  // Build the order as plain text (used for the WhatsApp message and the preview)
  function buildMessage() {
    let text = 'Hi ' + CAFE_NAME + '! New pre-order 🐾\n';
    text += 'Name: ' + form.elements.customer.value + '\n';
    text += 'Phone: ' + form.elements.phone.value + '\n';
    text += 'Pickup: today at ' + form.elements.pickup.value + '\n\nItems:\n';
    let total = 0;
    rows.forEach(function (row) {
      const qty = cart[row.dataset.id] || 0;
      if (qty > 0) {
        const price = Number(row.dataset.price);
        total = total + qty * price;
        text += '- ' + qty + ' x ' + row.dataset.name + ' (₹' + (qty * price) + ')\n';
      }
    });
    text += '\nTotal: ₹' + total + ' (pay at pickup)';
    if (form.elements.notes.value) text += '\nNotes: ' + form.elements.notes.value;
    return text;
  }

  function showMessage(text, kind) {
    message.textContent = text;
    message.dataset.kind = kind || '';
    message.hidden = false;
  }

  // Basic checks before we send anything (the server checks again, never trust the browser)
  function formIsValid() {
    if (countItems() === 0) { showMessage('Your order is empty. Add something yummy first 🍪', 'warn'); return false; }
    if (!form.elements.customer.value.trim()) { showMessage('Please enter your name.', 'error'); return false; }
    const phone = form.elements.phone.value.replace(/\D/g, '').slice(-10);   // keep the last 10 digits
    if (!/^[6-9][0-9]{9}$/.test(phone)) { showMessage('Please enter a valid 10-digit mobile number.', 'error'); return false; }
    return true;
  }

  // MAIN WAY: send the order to the Google Sheet through the backend
  form.addEventListener('submit', function (event) {
    event.preventDefault();                     // stop the page from reloading
    if (!formIsValid()) return;

    if (!BACKEND_URL) { sendOnWhatsApp(); return; }   // no backend set up: use WhatsApp instead

    const items = [];
    for (const id in cart) items.push({ id: id, qty: cart[id] });   // only ids and quantities, never prices
    const button = document.querySelector('#place-btn');
    button.disabled = true;                      // stops accidental double clicks
    showMessage('Placing your order…', '');

    fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // plain text avoids a CORS pre-check with Apps Script
      body: JSON.stringify({
        name: form.elements.customer.value.trim(),
        phone: form.elements.phone.value,
        time: form.elements.pickup.value,
        notes: form.elements.notes.value.trim(),
        items: items
      })
    })
      .then(function (response) { return response.json(); })
      .then(function (result) {
        if (result.ok) {
          cart = {};
          saveCart();
          render();
          showMessage('✅ Order ' + result.orderNumber + ' placed! Total ₹' + result.total + '. Show this number at the counter and pay at pickup.', '');
        } else {
          showMessage(result.error || 'Something went wrong. Please try again.', 'error');
          loadMenuStatus();                      // maybe an item just sold out, refresh
        }
      })
      .catch(function () {
        showMessage('Could not reach the server. Please use the WhatsApp button instead.', 'error');
      })
      .then(function () { button.disabled = false; });
  });

  // BACKUP WAY: open WhatsApp with the order text (also the only way if there is no backend)
  function sendOnWhatsApp() {
    if (!formIsValid()) return;
    const text = buildMessage();
    preview.textContent = text;                 // show the message on the page (great for a demo)
    preview.hidden = false;
    if (WHATSAPP_NUMBER) {
      // encodeURIComponent makes the text safe to put inside a link
      window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text), '_blank');
      showMessage('Opening WhatsApp. Press send there to place your order.', '');
    } else {
      showMessage('Demo mode: add the café WhatsApp number in config.js to send this for real.', 'warn');
    }
  }
  document.querySelector('#whatsapp-btn').addEventListener('click', sendOnWhatsApp);

  renderOrderPage = render;
  render();
}

// run once when the page loads so the badge shows the saved cart
updateBadge();

// ---------- 5. SOLD-OUT ITEMS (live from the Google Sheet) ----------
// Staff mark an item "sold out" on staff.html. Here we ask the backend which items are available
// and switch the buttons off for the sold-out ones. It re-checks every 60 seconds.
function loadMenuStatus() {
  if (!BACKEND_URL) return;                      // no backend = nothing to check
  fetch(BACKEND_URL + '?action=menu')
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (!data.ok) return;
      data.items.forEach(function (item) {
        const soldOut = !item.available;
        document.querySelectorAll('[data-add="' + item.id + '"]').forEach(function (button) {
          button.disabled = soldOut;
          button.textContent = soldOut ? 'Sold out today' : button.dataset.label;
        });
        document.querySelectorAll('.order-item[data-id="' + item.id + '"]').forEach(function (row) {
          row.classList.toggle('is-soldout', soldOut);
          row.querySelectorAll('[data-inc]').forEach(function (b) { b.disabled = soldOut; });
        });
        if (soldOut && cart[item.id]) { delete cart[item.id]; saveCart(); }   // remove it from the cart
      });
      updateBadge();
      if (renderOrderPage) renderOrderPage();
    })
    .catch(function () { /* backend unreachable: keep the page as it is */ });
}
loadMenuStatus();
setInterval(loadMenuStatus, 60000);
