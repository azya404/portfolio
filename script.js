/* ============================================
   HAASYA SHAH · PORTFOLIO
   script.js — Nav interactions + Animations
   ============================================ */

/* ================================================
   LOGO TYPEWRITER ANIMATION
   Sequence: <haasya.co [BS][BS] dev/>
   Colors applied by buffer position regardless
   of whether char is correct (typo goes purple too)
   ================================================ */
(function initLogoTyping() {
  const navLogo = document.getElementById('navLogo');
  if (!navLogo) return;

  // Map buffer index → CSS class for that character zone
  // Target: < h a a s y a . d e v / >
  //         0 1 2 3 4 5 6 7 8 9 10 11 12
  function getClass(pos) {
    if (pos === 0) return 'logo-bracket'; // <
    if (pos >= 1 && pos <= 6) return '';              // haasya
    if (pos >= 7 && pos <= 10) return 'logo-accent';  // .dev
    if (pos >= 11) return 'logo-bracket'; // />
    return '';
  }

  // Build coloured HTML from current buffer + optional blinking cursor element
  function render(buf, showCursor) {
    let html = '';
    let i = 0;
    while (i < buf.length) {
      const cls = getClass(i);
      let chunk = '';
      while (i < buf.length && getClass(i) === cls) {
        // Escape < and > so they display as literals
        const ch = buf[i] === '<' ? '&lt;' : buf[i] === '>' ? '&gt;' : buf[i];
        chunk += ch;
        i++;
      }
      html += cls ? `<span class="${cls}">${chunk}</span>` : chunk;
    }
    if (showCursor) html += '<span class="logo-cursor" aria-hidden="true"></span>';
    navLogo.innerHTML = html;
  }

  // Typing sequence — strings are chars to add, -1 means backspace
  // Story: confidently types <haasya.co … pauses … backspaces … finishes dev/>
  const steps = [
    '<',                   // open bracket
    'h', 'a', 'a', 's', 'y', 'a', // name
    '.',                   // dot
    'c', 'o',               // TYPO: typed .co instead of .dev
    -1, -1,                // realise mistake, delete 'o' then 'c'
    'd', 'e', 'v',           // correct extension
    '/', '>',               // close bracket
  ];

  // Index of the last "wrong" character before we start correcting
  // (step index 9 = 'o', the second typo char)
  const TYPO_LINGER_IDX = 9;

  let buf = '';
  let stepIdx = 0;

  function nextStep() {
    if (stepIdx >= steps.length) {
      // Typing done — keep cursor blinking but switch to slower resting speed
      render(buf, true);
      const cursorEl = navLogo.querySelector('.logo-cursor');
      if (cursorEl) cursorEl.classList.add('logo-cursor--resting');
      return;
    }

    const step = steps[stepIdx];
    stepIdx++;

    if (step === -1) {
      buf = buf.slice(0, -1); // backspace
    } else {
      buf += step;
    }

    render(buf, true);

    // Timing — mimic real human typing rhythm
    let delay = 90 + Math.random() * 70;        // base 90–160 ms
    if (step === -1) delay = 70 + Math.random() * 50; // backspace faster
    if (stepIdx === TYPO_LINGER_IDX + 1) delay = 460; // pause after noticing typo
    if (step === '<' && stepIdx === 1) delay = 180; // slight hesitation at start

    setTimeout(nextStep, delay);
  }

  // Show cursor alone first, then start typing after a short settle delay
  render('', true);
  setTimeout(nextStep, 650);
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
