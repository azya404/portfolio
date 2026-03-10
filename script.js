/* ============================================
   HAASYA SHAH · PORTFOLIO
   script.js — Nav interactions + Animations
   ============================================ */

/* ================================================
   LOGO TYPEWRITER ANIMATION
   Colors are content-aware: based on where the dot
   and slash sit in the buffer at any given moment.
   Sequence: <azya → <haasya → .uofa → .ca → .ke → .dev/>
   Number entries in steps[] = explicit pause in ms
   ================================================ */
(function initLogoTyping() {
  const navLogo = document.getElementById('navLogo');
  if (!navLogo) return;

  // Color determined by buffer structure, not fixed positions
  // Before the dot → plain name | dot onward → accent | slash onward → bracket
  function getClass(buf, pos) {
    const dotIdx = buf.indexOf('.');
    const slashIdx = buf.indexOf('/');
    if (pos === 0) return 'logo-bracket'; // <
    if (slashIdx !== -1 && pos >= slashIdx) return 'logo-bracket'; // />
    if (dotIdx !== -1 && pos >= dotIdx) return 'logo-accent';  // .ext
    return '';                                                       // name
  }

  // Render buffer with structural coloring + optional blinking cursor
  function render(buf, showCursor) {
    let html = '';
    let i = 0;
    while (i < buf.length) {
      const cls = getClass(buf, i);
      let chunk = '';
      while (i < buf.length && getClass(buf, i) === cls) {
        const ch = buf[i] === '<' ? '&lt;' : buf[i] === '>' ? '&gt;' : buf[i];
        chunk += ch;
        i++;
      }
      html += cls ? `<span class="${cls}">${chunk}</span>` : chunk;
    }
    if (showCursor) html += '<span class="logo-cursor" aria-hidden="true"></span>';
    navLogo.innerHTML = html;
  }

  // Steps: string char = type it, -1 = backspace, positive number = pause (ms)
  const steps = [
    // ── Phase 1: nickname first ─────────────────────────────────
    '<', 'a', 'z', 'y', 'a',             // <azya
    550,                             // hmm… that's not my real name
    -1, -1, -1, -1,                     // backspace azya

    // ── Phase 2: real name ──────────────────────────────────────
    'h', 'a', 'a', 's', 'y', 'a',        // <haasya

    // ── Phase 3: try university domain ──────────────────────────
    '.', 'u', 'o', 'f', 'a',            // .uofa
    600,                            // tempting… but nah
    -1, -1, -1, -1,                    // backspace uofa

    // ── Phase 4: try country TLD ────────────────────────────────
    'c', 'a',                        // .ca
    450,                            // close… still not right
    -1, -1,                          // backspace ca

    // ── Phase 5: try .ke ───────────────────────────────────────
    'k', 'e',                    // .ke
    380,                            // nope
    -1, -1, -1,                       // backspace ke

    // ── Phase 6: the right one ──────────────────────────────────
    'd', 'e', 'v',                    // .dev  ← this is it
    '/', '>',                        // />
  ];

  let buf = '';
  let stepIdx = 0;

  function nextStep() {
    if (stepIdx >= steps.length) {
      // Done — cursor stays, switches to slower resting blink
      render(buf, true);
      const cursorEl = navLogo.querySelector('.logo-cursor');
      if (cursorEl) cursorEl.classList.add('logo-cursor--resting');
      return;
    }

    const step = steps[stepIdx++];

    // Pause marker — wait silently without changing the display
    if (typeof step === 'number') {
      setTimeout(nextStep, step);
      return;
    }

    if (step === -1) {
      buf = buf.slice(0, -1);
    } else {
      buf += step;
    }

    render(buf, true);

    // Human-like timing
    let delay = 90 + Math.random() * 70;              // 90–160 ms normal
    if (step === -1) delay = 65 + Math.random() * 45; // backspace a touch faster
    if (step === '<') delay = 200;                      // slight pause before first char

    setTimeout(nextStep, delay);
  }

  // Show lone cursor, then start the sequence
  render('', true);
  setTimeout(nextStep, 700);
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

/* ---- Mobile nav toggle ---- */
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
