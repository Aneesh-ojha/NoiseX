import { AudioLab } from './audio-lab.js';

document.addEventListener('DOMContentLoaded', () => {
  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav     = document.getElementById('mobile-nav');
  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileNav.classList.toggle('hidden');
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Scroll-reveal via IntersectionObserver (not setTimeout)
  // ────────────────────────────────────────────────────────────────
  let revealObserver = null;

  function initScrollReveal() {
    if (revealObserver) revealObserver.disconnect();

    const targets = document.querySelectorAll('.scroll-reveal');
    if (!targets.length) return;

    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px'
    });

    targets.forEach(el => {
      el.classList.remove('visible');
      revealObserver.observe(el);
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Hash-based routing with dynamic fetching
  // ────────────────────────────────────────────────────────────────
  async function handleRoute() {
    let hash  = window.location.hash || '#/';
    let route = hash.replace(/^#\/?/, '');
    if (route === '') route = 'home';

    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => {
      el.classList.remove('active');
    });

    // Deactivate nav links
    document.querySelectorAll('.nav-link, #mobile-nav a').forEach(el => {
      el.classList.remove('text-cyan-500', 'text-white');
      el.classList.add('text-gray-500');
    });

    // Get or create target view container
    let activeView = document.getElementById('view-' + route);
    if (!activeView) {
      activeView = document.getElementById('view-home');
      route = 'home';
    }

    // Dynamically load the content if it's empty
    if (!activeView.innerHTML.trim()) {
      try {
        const response = await fetch(`views/${route}.html`);
        if (response.ok) {
          activeView.innerHTML = await response.text();
          
          // If we just loaded the audio lab, initialize it
          if (route === 'audio-lab' && !window.audioLab) {
            window.audioLab = new AudioLab();
          }
          
          // Re-create lucide icons for newly injected HTML
          if (window.lucide) {
            window.lucide.createIcons();
          }
        } else {
          console.error(`Failed to load view: ${route}`);
          activeView.innerHTML = `<div style="padding: 4rem; text-align: center; color: #EF4444;">Failed to load section content.</div>`;
        }
      } catch (err) {
        console.error(`Error fetching view ${route}:`, err);
      }
    }

    activeView.classList.add('active');

    // Re-initialize scroll reveal after view switch
    requestAnimationFrame(() => {
      initScrollReveal();
    });

    // Highlight active nav link
    document.querySelectorAll('.nav-link, #mobile-nav a').forEach(el => {
      const href = el.getAttribute('href');
      if (href === hash || (hash === '#/' && href === '#/')) {
        el.classList.remove('text-gray-500');
        el.classList.add('text-white');
      }
    });

    // Close mobile menu
    if (mobileNav && !mobileNav.classList.contains('hidden')) {
      mobileNav.classList.add('hidden');
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute(); // Initial route
});
