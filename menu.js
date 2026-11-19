/* Bhaunk Café: menu.js
   Switches between the Drinks and Bakes lists on the home page.
   Without JavaScript both lists simply show one after the other. */
(function () {
  'use strict';
  var tabs = document.querySelector('.menu-tabs');
  if (!tabs) return;
  var buttons = tabs.querySelectorAll('button');
  var lists = document.querySelectorAll('.menu-list');

  function show(id) {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.show === id)); });
    lists.forEach(function (l) { l.hidden = l.id !== id; });
  }

  tabs.addEventListener('click', function (event) {
    var button = event.target.closest('button');
    if (button) show(button.dataset.show);
  });

  tabs.hidden = false;          // the buttons only appear when JavaScript works
  show(buttons[0].dataset.show);
})();
