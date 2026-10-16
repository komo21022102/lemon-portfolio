// Cursor
const cursor = document.getElementById('cursor');
const cursorRing = document.getElementById('cursorRing');
let mouseX = 0, mouseY = 0;
let ringX = 0, ringY = 0;

document.addEventListener('mousemove', e => {
  mouseX = e.clientX; mouseY = e.clientY;
  cursor.style.left = mouseX + 'px';
  cursor.style.top = mouseY + 'px';
});

function animateRing() {
  ringX += (mouseX - ringX) * 0.1;
  ringY += (mouseY - ringY) * 0.1;
  cursorRing.style.left = ringX + 'px';
  cursorRing.style.top = ringY + 'px';
  requestAnimationFrame(animateRing);
}
animateRing();

document.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursor.style.transform = 'translate(-50%,-50%) scale(2.5)';
    cursor.style.background = 'var(--warm)';
    cursorRing.style.width = '60px'; cursorRing.style.height = '60px';
  });
  el.addEventListener('mouseleave', () => {
    cursor.style.transform = 'translate(-50%,-50%) scale(1)';
    cursor.style.background = 'var(--ink)';
    cursorRing.style.width = '36px'; cursorRing.style.height = '36px';
  });
});

// Scroll reveal
const reveals = document.querySelectorAll('.reveal, .timeline-item, .edu-item');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 80);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

reveals.forEach(el => observer.observe(el));

// Smooth nav scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});
// Mobile Menu Toggle
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');

if (hamburger) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('active');
    document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
  });
}

// Close mobile menu when clicking a non-dropdown link
document.querySelectorAll('.nav-links > li:not(.has-dropdown) a').forEach(link => {
  link.addEventListener('click', () => {
    if (hamburger) hamburger.classList.remove('active');
    if (navLinks) navLinks.classList.remove('active');
    document.body.style.overflow = '';
  });
});

// Close menu when clicking dropdown sub-links too
document.querySelectorAll('.dropdown a').forEach(link => {
  link.addEventListener('click', () => {
    if (hamburger) hamburger.classList.remove('active');
    if (navLinks) navLinks.classList.remove('active');
    document.body.style.overflow = '';
  });
});

// Mobile dropdown toggle — only toggle when clicking the Works <a> directly
const worksDropdown = document.querySelector('.has-dropdown');
if (worksDropdown) {
  const worksLink = worksDropdown.querySelector(':scope > a');
  if (worksLink) {
    worksLink.addEventListener('click', (e) => {
      if (window.innerWidth <= 900) {
        e.preventDefault(); // prevent hash jump on mobile
        worksDropdown.classList.toggle('active');
      }
    });
  }
}

// Back to Top functionality
const backToTop = document.getElementById('backToTop');
if (backToTop) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 500) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  });

  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Force scroll to top/hero on page load or refresh
if (history.scrollRestoration) {
  history.scrollRestoration = 'manual';
}

// Once the user starts scrolling, never force the page back to the top.
// (The load event waits for every image, so it can fire mid-browse.)
let userHasScrolled = false;
['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(evt => {
  window.addEventListener(evt, () => { userHasScrolled = true; }, { once: true, passive: true });
});

function scrollToTopForce() {
  if (userHasScrolled) return;
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

// Execute immediately if possible
scrollToTopForce();

// Also on load
window.addEventListener('load', () => {
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      target.scrollIntoView();
      return;
    }
  }

  // A slight delay helps on mobile browsers
  setTimeout(scrollToTopForce, 0);
  setTimeout(scrollToTopForce, 100);
});

// For extra safety on mobile navigation
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    scrollToTopForce();
  }
});

// Category tabs on work pages: bring the current tab into view when the bar scrolls sideways (phones)
(() => {
  const bar = document.getElementById('catTabs');
  const tab = bar && bar.querySelector('.is-active');
  if (!tab) return;
  bar.scrollLeft = tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2;
})();
