/* ============================================
   HAASYA SHAH · PORTFOLIO
   script.js — Nav interactions + Animations
   ============================================ */

/* ================================================
   LOGO TYPEWRITER ANIMATION
   Each extension has its own color identity:
     .uofa → UAlberta #007C41 green / #FFDB05 gold (alternating)
     .ca   → Canadian flag red #D52B1E
     .ke   → Kenya red #BB0000 / green #006600 per char
     .dev  → Hacker terminal green #39FF14
   { phase: N } markers in steps[] switch the color mode.
   Positive numbers = pause ms. -1 = backspace.
   ================================================ */
(function initLogoTyping() {
  const navLogo = document.getElementById('navLogo');
  if (!navLogo) return;

  // Per-phase extension color configs
  const phaseColors = {
    0: { // .uofa — UAlberta: dot starts green, then alternates gold/green
      dot: '#007C41',
      char: (i) => i % 2 === 0 ? '#FFDB05' : '#007C41',
    },
    1: { // .ca — Canadian flag: . red, c white, a red (alternating)
      dot: '#D52B1E',
      char: (i) => i % 2 === 0 ? '#FFFFFF' : '#D52B1E',
    },
    2: { // .ke — Kenya flag order: . black, k red, e green
      dot: '#111111',
      char: (i) => i === 0 ? '#BB0000' : '#006600',
    },
    3: { // .dev — matches the site teal accent (#4af0c4)
      dot: '#4af0c4',
      char: () => '#4af0c4',
    },
  };

  let phase = -1; // -1 = name zone, no extension active yet

  function render(buf, showCursor) {
    const dotIdx = buf.indexOf('.');
    const slashIdx = buf.indexOf('/');
    let html = '';

    for (let i = 0; i < buf.length; i++) {
      const ch = buf[i] === '<' ? '&lt;' : buf[i] === '>' ? '&gt;' : buf[i];

      if (i === 0 || (slashIdx !== -1 && i >= slashIdx)) {
        // opening < and closing />
        html += `<span class="logo-bracket">${ch}</span>`;

      } else if (dotIdx !== -1 && i >= dotIdx && phase >= 0 && phaseColors[phase]) {
        // extension zone — per-phase per-character color
        const pc = phaseColors[phase];
        const color = (i === dotIdx) ? pc.dot : pc.char(i - dotIdx - 1);
        html += `<span style="color:${color};transition:color 0.15s">${ch}</span>`;

      } else {
        // name zone — plain text
        html += ch;
      }
    }

    if (showCursor) html += '<span class="logo-cursor" aria-hidden="true"></span>';
    navLogo.innerHTML = html;
  }

  // Steps: string = type char | -1 = backspace | number > 0 = pause ms | { phase: N } = set color mode
  const steps = [
    // ── Phase 1: nickname first ─────────────────────────────────
    '<', 'a', 'z', 'y', 'a',
    550,                                 // pause — hmm, not my name
    -1, -1, -1, -1,                         // backspace azya → back to <

    // ── Phase 2: real name + dot ─────────────────────────────────
    'h', 'a', 'a', 's', 'y', 'a', '.',         // <haasya.

    // ── Extension 1: .uofa (UAlberta) ────────────────────────────
    { phase: 0 },                        // dot turns gold, chars go green/gold
    'u', 'o', 'f', 'a',
    600,                                 // pause — tempting but nah
    -1, -1, -1, -1,                         // backspace uofa → back to .

    // ── Extension 2: .ca (Canada) ────────────────────────────────
    { phase: 1 },                        // dot + chars turn Canadian red
    'c', 'a',
    450,                                 // pause — close, still no
    -1, -1,                               // backspace ca → back to .

    // ── Extension 3: .ke (Kenya) ─────────────────────────────────
    { phase: 2 },                        // k = Kenya red, e = Kenya green
    'k', 'e',
    380,                                 // pause — nope
    -1, -1,                               // backspace ke → back to .

    // ── Extension 4: .dev — this is the one ──────────────────────
    { phase: 3 },                        // full hacker green
    'd', 'e', 'v',
    '/', '>',
  ];

  let buf = '';
  let stepIdx = 0;

  function nextStep() {
    if (stepIdx >= steps.length) {
      render(buf, true);
      const cursorEl = navLogo.querySelector('.logo-cursor');
      if (cursorEl) cursorEl.classList.add('logo-cursor--resting');
      return;
    }

    const step = steps[stepIdx++];

    // Phase change marker — update color mode and re-render immediately
    if (step && typeof step === 'object' && 'phase' in step) {
      phase = step.phase;
      render(buf, true);
      setTimeout(nextStep, 0);
      return;
    }

    // Pause (positive numbers only — -1 must fall through)
    if (typeof step === 'number' && step > 0) {
      setTimeout(nextStep, step);
      return;
    }

    if (step === -1) {
      buf = buf.slice(0, -1);
    } else {
      buf += step;
    }

    render(buf, true);

    let delay = 90 + Math.random() * 70;
    if (step === -1) delay = 65 + Math.random() * 45;
    if (step === '<') delay = 200;

    setTimeout(nextStep, delay);
  }

  render('', true);
  setTimeout(nextStep, 700);
})();

/* ---- Scroll progress bar (lerp-smoothed) ---- */
const scrollProgress = document.getElementById('scroll-progress');
let scrollTarget = 0;
let scrollCurrent = 0;

window.addEventListener('scroll', () => {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  scrollTarget = total > 0 ? (window.scrollY / total) * 100 : 0;
}, { passive: true });

(function tickProgress() {
  scrollCurrent += (scrollTarget - scrollCurrent) * 0.1;
  scrollProgress.style.width = scrollCurrent.toFixed(3) + '%';
  requestAnimationFrame(tickProgress);
})();

/* ---- Navbar scroll effect ---- */
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
  updateActiveNavLink();
}, { passive: true });

/* ---- Theme toggle (dark / light) ---- */
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

// Apply saved preference — defaults to dark if nothing saved
const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') html.setAttribute('data-theme', 'light');

themeToggle.addEventListener('click', () => {
  const isLight = html.getAttribute('data-theme') === 'light';
  if (isLight) {
    html.removeAttribute('data-theme');
    localStorage.setItem('theme', 'dark');
  } else {
    html.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
  }
});


navToggle.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', isOpen);
  const spans = navToggle.querySelectorAll('span');
  if (isOpen) {
    spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
    spans[1].style.opacity = '0';
    spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
  } else {
    spans[0].style.transform = '';
    spans[1].style.opacity = '';
    spans[2].style.transform = '';
  }
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    const spans = navToggle.querySelectorAll('span');
    spans[0].style.transform = '';
    spans[1].style.opacity = '';
    spans[2].style.transform = '';
  });
});

/* ---- Active nav link based on scroll ---- */
const sections = document.querySelectorAll('section[id]');
const navLinkEls = document.querySelectorAll('.nav-link');

function updateActiveNavLink() {
  let current = '';
  sections.forEach(section => {
    const sectionTop = section.offsetTop - 100;
    if (window.scrollY >= sectionTop) {
      current = section.getAttribute('id');
    }
  });
  navLinkEls.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${current}`) {
      link.classList.add('active');
    }
  });
}

/* ---- Smooth scroll for anchor links ---- */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: offset, behavior: 'smooth' });
  });
});

/* ---- Scroll-triggered fade-in animations ---- */
const fadeEls = document.querySelectorAll(
  '.about-grid, .project-card, .skill-group, .contact-grid, ' +
  '.section-header, .projects-footer'
);

fadeEls.forEach(el => el.classList.add('fade-in'));

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), 60);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

fadeEls.forEach(el => observer.observe(el));

/* Stagger project cards and skill groups */
function staggerObserve(selector, delayStep = 80) {
  const els = document.querySelectorAll(selector);
  const groupObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const siblings = Array.from(
          entry.target.parentElement.querySelectorAll(selector)
        );
        siblings.forEach((sibling, idx) => {
          setTimeout(() => sibling.classList.add('visible'), idx * delayStep);
        });
        groupObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  if (els.length > 0) groupObserver.observe(els[0]);
}

staggerObserve('.project-card', 100);
staggerObserve('.skill-group', 80);

/* ---- Animated number counters ---- */
function animateCounter(el, target, duration = 1200) {
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = target;
  }
  requestAnimationFrame(update);
}

const statNums = document.querySelectorAll('.stat-num[data-target]');
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target, parseInt(entry.target.dataset.target));
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

statNums.forEach(el => counterObserver.observe(el));

/* ---- Subtle parallax on hero glow ---- */
const heroGlow = document.querySelector('.hero-glow');
if (heroGlow) {
  window.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 30;
    const y = (e.clientY / window.innerHeight - 0.5) * 30;
    heroGlow.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }, { passive: true });
}

/* ---- Project card cursor tilt ---- */
document.querySelectorAll('.project-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `translateY(-4px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg)`;
    card.style.transition = 'box-shadow 0.2s, border-color 0.2s';
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.transition = 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
  });
});

/* ---- Custom cursor ---- */
(function initCursor() {
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;

  let mouseX = 0, mouseY = 0;
  let ringX = 0, ringY = 0;
  let visible = false;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.left = mouseX + 'px';
    dot.style.top = mouseY + 'px';
    if (!visible) {
      visible = true;
      dot.style.opacity = '1';
      ring.style.opacity = '1';
      // Snap ring to cursor on first appearance to avoid swooping in from 0,0
      ringX = mouseX;
      ringY = mouseY;
    }
  });

  // Ring lerp loop
  (function tickRing() {
    ringX += (mouseX - ringX) * 0.1;
    ringY += (mouseY - ringY) * 0.1;
    ring.style.left = ringX.toFixed(2) + 'px';
    ring.style.top = ringY.toFixed(2) + 'px';
    requestAnimationFrame(tickRing);
  })();

  // Expand ring on interactive elements
  const interactives = 'a, button, [role="button"], .project-card, .nav-link, .nav-cta';
  document.querySelectorAll(interactives).forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('hovering'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hovering'));
  });

  // Hide when cursor leaves the window
  document.addEventListener('mouseleave', () => {
    dot.style.opacity = '0';
    ring.style.opacity = '0';
    visible = false;
  });

  // Start hidden — revealed on first mousemove
  dot.style.opacity = '0';
  ring.style.opacity = '0';
})();
