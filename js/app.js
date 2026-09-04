import { AudioLab } from './audio-lab.js';
import { TEAM_MEMBERS } from './data/team-data.js';
import { initHeroScroll } from './controllers/hero-scroll.js';

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

          // If we just loaded the audio lab, initialize or re-initialize it
          if (route === 'audio-lab') {
            try {
              // Re-create the controller to ensure event listeners bind to the newly injected DOM
              window.audioLab = new AudioLab();
            } catch (err) {
              console.error('Failed to initialize AudioLab:', err);
            }
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

    // ── Route-Specific Dynamic Hooks ─────────────────────────────
    if (route === 'home') {
      requestAnimationFrame(() => {
        initHeroScroll();
      });
    } else if (route === 'team') {
      renderTeam();
    }
    // ─────────────────────────────────────────────────────────────

    // Safety: if the view content is unexpectedly empty after loading, provide a retry message
    if (!activeView.innerHTML.trim()) {
      console.warn(`View ${route} is empty after load — inserting fallback message.`);
      activeView.innerHTML = `<div style="padding: 4rem; text-align: center; color: #EF4444;">Content failed to load. <button id="retry-load" style="margin-left:12px;padding:6px 10px;">Retry</button></div>`;
      const btn = activeView.querySelector('#retry-load');
      if (btn) btn.addEventListener('click', () => handleRoute());
    }

    // Re-initialize scroll reveal after view switch
    requestAnimationFrame(() => {
      initScrollReveal();
    });

    // Ensure AudioLab bindings whenever the audio-lab view becomes active
    if (route === 'audio-lab') {
      try {
        if (window.audioLab && typeof window.audioLab._bindDOM === 'function') {
          window.audioLab._bindDOM();
        } else if (!window.audioLab) {
          window.audioLab = new AudioLab();
        }
      } catch (err) {
        console.error('AudioLab bind error:', err);
      }
    }

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
  




function renderTeam() {
  const container = document.getElementById('team-grid');
  if (!container) return;

  container.innerHTML = TEAM_MEMBERS.map(member => `
    <div class="team-card group relative rounded-2xl border border-white/[0.08] bg-neutral-900/40 backdrop-blur-md p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] flex flex-col items-center text-center">
      
      <!-- Avatar Monogram -->
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-neutral-800 to-neutral-700 border border-white/10 flex items-center justify-center font-bold text-xl text-cyan-400 mb-4 group-hover:border-cyan-400/50 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all">
        ${member.name.charAt(0)}
      </div>

      <!-- Member Details -->
      <h3 class="font-semibold text-lg text-white group-hover:text-cyan-300 transition-colors">
        ${member.name}
      </h3>
      <p class="text-xs uppercase tracking-wider text-cyan-400/80 font-medium mt-1 mb-6">
        Core Contributor
      </p>

      <!-- Profile Links -->
      <div class="flex items-center gap-4 pt-4 border-t border-white/[0.06] w-full justify-center">
        <a href="${member.github}" target="_blank" rel="noopener noreferrer" class="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5">
          <i data-lucide="github" class="w-4 h-4"></i> GitHub
        </a>
        <a href="${member.linkedin}" target="_blank" rel="noopener noreferrer" class="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5">
          <i data-lucide="linkedin" class="w-4 h-4"></i> LinkedIn
        </a>
      </div>
    </div>
  `).join('');

  // Re-run Lucide so the GitHub & LinkedIn icons render
  if (window.lucide) {
    window.lucide.createIcons();
  }
}


document.addEventListener('DOMContentLoaded', renderTeam);
document.addEventListener('DOMContentLoaded', () => {
  initHeroScroll();
});