/* ==========================================================
   dog.js  -  the fun stuff
   1. a heart pops up wherever you click or tap
   2. the dog buddy that follows your mouse
   3. small safety nets: missing photos / videos
   ========================================================== */

// Some people turn on "reduce motion" in their settings. We respect that.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 1. HEARTS ON CLICK ----------
function makeHeart(x, y) {
  const heart = document.createElement('i');   // make a new <i> (decorative icon)
  heart.className = 'pet-heart';                  // the CSS makes it float up and fade
  heart.textContent = '♥';
  heart.style.left = x - 9 + 'px';                // put it where we clicked
  heart.style.top = y - 14 + 'px';
  document.body.appendChild(heart);               // put it on the page
  setTimeout(function () { heart.remove(); }, 1100);   // clean up after 1.1 seconds
}

if (!reduceMotion) {
  document.addEventListener('pointerdown', function (event) {
    makeHeart(event.clientX, event.clientY);
  });
}

// ---------- 2. THE DOG BUDDY ----------
// Only on computers with a real mouse (not phones) and when motion is allowed.
const hasMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

if (hasMouse && !reduceMotion) {

  // 2a. Build the dog. Its looks live in an SVG (a drawing made of code).
  const pet = document.createElement('aside');
  pet.className = 'pet';
  pet.setAttribute('aria-hidden', 'true');   // screen readers should skip decoration
  pet.dataset.state = 'idle';                // the CSS changes the dog's pose based on this
  pet.innerHTML = `
    <output class="pet-bubble"></output>
    <small class="pet-zzz">z z z</small>
    <figure class="pet-flip">
    <svg viewBox="0 0 90 82" xmlns="http://www.w3.org/2000/svg">
    <ellipse class="pet-shadow" cx="45" cy="78" rx="28" ry="4"/>
    <path class="pet-tail" d="M68 62 C 84 58, 86 44, 80 32"/>
    <g class="pet-leg pet-leg-a"><rect class="pet-fur" x="28" y="64" width="11" height="12" rx="5"/></g>
    <g class="pet-leg pet-leg-b"><rect class="pet-fur" x="51" y="64" width="11" height="12" rx="5"/></g>
    <g class="pet-body-group">
    <ellipse class="pet-fur" cx="45" cy="60" rx="25" ry="16"/>
    <ellipse class="pet-chest" cx="45" cy="63" rx="11" ry="9"/>
    <path class="pet-collar" d="M30 54 Q45 62 60 54"/>
    <circle class="pet-tag" cx="45" cy="59" r="2.6"/>
    </g>
    <g class="pet-head">
    <ellipse class="pet-fur" cx="45" cy="36" rx="21" ry="18"/>
    <ellipse class="pet-patch" cx="54" cy="33" rx="7" ry="8"/>
    <ellipse class="pet-muzzle" cx="45" cy="43" rx="10" ry="8"/>
    <g class="pet-eyes">
    <ellipse class="pet-eye" cx="37" cy="34" rx="2.4" ry="3.3"/>
    <ellipse class="pet-eye" cx="53" cy="34" rx="2.4" ry="3.3"/>
    </g>
    <path class="pet-eye-closed" d="M33 35 q4 4 8 0 M49 35 q4 4 8 0"/>
    <path class="pet-tongue" d="M41.5 46.5 q3.5 10 7 0 Z"/>
    <path class="pet-mouth" d="M45 42.5 v3 M45 45.5 q-3.5 3 -6.5 0 M45 45.5 q3.5 3 6.5 0"/>
    <ellipse class="pet-yawn" cx="45" cy="48" rx="5" ry="6"/>
    <ellipse class="pet-nose" cx="45" cy="40" rx="4" ry="3"/>
    <path class="pet-ear pet-ear-l" d="M27 24 C 16 22, 11 38, 15 52 C 20 56, 27 50, 29 38 Z"/>
    <path class="pet-ear pet-ear-r" d="M63 24 C 74 22, 79 38, 75 52 C 70 56, 63 50, 61 38 Z"/>
    </g>
    </svg>
    </figure>`;
  document.body.appendChild(pet);

  const bubble = pet.querySelector('.pet-bubble');   // the little speech bubble

  // 2b. The on/off button
  const toggle = document.createElement('button');
  toggle.className = 'pet-toggle';
  toggle.type = 'button';
  toggle.textContent = '🐾 Dog buddy: on';
  toggle.addEventListener('click', function () {
    const isOff = document.body.classList.toggle('pet-off');
    toggle.textContent = isOff ? '🐾 Dog buddy: off' : '🐾 Dog buddy: on';
  });
  document.body.appendChild(toggle);

  // 2c. Variables the dog needs to remember
  let x = -120, y = window.innerHeight - 110;   // where the dog is (starts off-screen, left)
  let targetX = x, targetY = y;                 // where the dog wants to go (near the mouse)
  let lastMove = performance.now();             // when the dog last moved (for sleeping)
  let nextAction = performance.now() + 4000;    // when to do the next random action
  let shown = false;                            // has the mouse moved yet?

  // 2d. Little helpers
  function say(text) {                          // show a speech bubble for 1.8 seconds
    bubble.textContent = text;
    bubble.classList.add('show');
    setTimeout(function () { bubble.classList.remove('show'); }, 1800);
  }

  function doAction(name, ms) {                 // turn on a CSS animation for a while
    pet.classList.add('act-' + name);           // e.g. act-yawn, act-spin
    setTimeout(function () { pet.classList.remove('act-' + name); }, ms);
  }

  function randomIdleAction() {                 // pick one random thing for the dog to do
    const pick = Math.floor(Math.random() * 6);
    if (pick === 0) { doAction('yawn', 1600); say('*yaaawn*'); }
    if (pick === 1) { doAction('pant', 2200); say('*pant pant*'); }
    if (pick === 2) { doAction('spin', 900); say('my tail!'); }
    if (pick === 3) { doAction('wiggle', 1400); }
    if (pick === 4) { doAction('bark', 1000); say('bhow! bhow!'); }
    if (pick === 5) { doAction('sniff', 1600); say('*sniff sniff*'); }
  }

  // 2e. Listen to the mouse
  document.addEventListener('pointermove', function (event) {
    targetX = event.clientX + 40 - 46;          // stay a little to the side of the mouse
    targetY = event.clientY + 18 - 41;
    lastMove = performance.now();
    if (!shown) {                               // first time the mouse moves: say hi
      shown = true;
      pet.classList.add('is-visible');
      doAction('entrance', 1300);
      setTimeout(function () { say('bhow! welcome ♡'); }, 1400);
    }
  });

  document.addEventListener('pointerdown', function () {
    doAction('hop', 500);                       // hop and wag when you click
    doAction('wag', 1400);
  });

  // 2f. The animation loop. This function runs about 60 times a second.
  function frame(now) {
    if (shown) {
      const dx = targetX - x;
      const dy = targetY - y;
      const distance = Math.hypot(dx, dy);      // straight-line distance to the target

      if (distance > 14) {
        // far away: trot toward the mouse, a little faster the farther it is
        const speed = Math.min(7, 1.2 + distance * 0.045);
        x = x + (dx / distance) * speed;
        y = y + (dy / distance) * speed;
        pet.classList.toggle('facing-left', dx < 0);   // turn to face the way we walk
        pet.dataset.state = 'walk';
        lastMove = now;
        nextAction = now + 4000;
      } else {
        // close enough: stand, then sit, then sleep the longer the mouse is still
        const stillFor = now - lastMove;
        if (stillFor > 14000) pet.dataset.state = 'sleep';
        else if (stillFor > 5000) pet.dataset.state = 'sit';
        else pet.dataset.state = 'idle';

        if (now > nextAction && pet.dataset.state !== 'sleep') {
          randomIdleAction();
          nextAction = now + 5000 + Math.random() * 4000;
        }
      }
    }
    pet.style.transform = 'translate3d(' + Math.round(x) + 'px, ' + Math.round(y) + 'px, 0)';
    requestAnimationFrame(frame);               // ask the browser to run frame() again
  }
  requestAnimationFrame(frame);
}

// ---------- 3. SAFETY NETS ----------
// If a photo file is missing, hide the broken image so the emoji / drawing shows instead.
document.querySelectorAll('.menu-illustration img, .dog-avatar img, .staff-avatar img').forEach(function (img) {
  img.addEventListener('error', function () { img.hidden = true; });
  if (img.complete && img.naturalWidth === 0) img.hidden = true;   // it already failed before this ran
});

// If a video file is missing, show the "add your video" note instead.
document.querySelectorAll('.video-frame source').forEach(function (source) {
  source.addEventListener('error', function () {
    source.closest('.video-frame').classList.add('is-missing');
  });
});
