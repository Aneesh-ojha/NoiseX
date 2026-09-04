import { initBoard3D } from './controllers/board-3d.js';
import { AudioLab } from './audio-lab.js';
import { TEAM_MEMBERS } from './data/team-data.js';
import { initHeroScroll } from './controllers/hero-scroll.js';
import { initSolutionHUD } from './controllers/solution-hud.js';
import { initTechHUD } from './controllers/tech-hud.js';

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
  // Scroll-reveal via IntersectionObserver
  // ────────────────────────────────────────────────────────────────
  let revealObserver = null;

  function initScrollReveal() {
    if (revealObserver) revealObserver.disconnect();

    const targets = document.querySelectorAll('.view-section.active .scroll-reveal');
    if (!targets.length) return;

    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.05,
      rootMargin: '50px'
    });

    targets.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight) {
        el.classList.add('visible');
      } else {
        revealObserver.observe(el);
      }
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Audio Lab Activation Hook
  // ────────────────────────────────────────────────────────────────
  function activateAudioLab(activeView) {
    try {
      activeView.querySelectorAll('.scroll-reveal').forEach(el => el.classList.add('visible'));

      if (!window.audioLab) {
        window.audioLab = new AudioLab();
      } else if (typeof window.audioLab._bindDOM === 'function') {
        window.audioLab._bindDOM();
      }

      requestAnimationFrame(() => {
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));

          if (window.lucide) {
            window.lucide.createIcons();
          }

          if (window.audioLab && typeof window.audioLab.renderVisualizers === 'function') {
            window.audioLab.renderVisualizers();
          }
        }, 60);
      });
    } catch (err) {
      console.error('AudioLab activation error:', err);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Hash-based routing with dynamic fetching
  // ────────────────────────────────────────────────────────────────
  async function handleRoute() {
    let hash  = window.location.hash || '#/';
    let route = hash.replace(/^#\/?/, '');
    if (route === '') route = 'home';

    document.querySelectorAll('.view-section').forEach(el => {
      el.classList.remove('active');
      el.style.removeProperty('display');
    });

    document.querySelectorAll('.nav-link, #mobile-nav a').forEach(el => {
      el.classList.remove('text-cyan-500', 'text-white');
      el.classList.add('text-gray-500');
    });

    let activeView = document.getElementById('view-' + route);
    if (!activeView) {
      activeView = document.getElementById('view-home');
      route = 'home';
    }

    if (!activeView.innerHTML.trim()) {
      try {
        const response = await fetch(`views/${route}.html`);
        if (response.ok) {
          activeView.innerHTML = await response.text();
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

    activeView.querySelectorAll('.scroll-reveal').forEach(el => {
      el.classList.add('visible');
      el.style.opacity = '1';
      el.style.transform = 'none';
    });

    // Initialize controller for the active view
    if (route === 'home') {
      requestAnimationFrame(() => {
        initHeroScroll();
        initBoard3D();
      });
    } else if (route === 'solution') {
      requestAnimationFrame(() => {
        initSolutionHUD();
        if (window.lucide) window.lucide.createIcons();
      });
    } else if (route === 'technology') {
      requestAnimationFrame(() => {
        initTechHUD();
        if (window.lucide) window.lucide.createIcons();
      });
    } else if (route === 'team') {
      renderTeam();
    } else if (route === 'audio-lab') {
      activateAudioLab(activeView);
    }

    if (!activeView.innerHTML.trim()) {
      console.warn(`View ${route} is empty after load — inserting fallback message.`);
      activeView.innerHTML = `<div style="padding: 4rem; text-align: center; color: #EF4444;">Content failed to load. <button id="retry-load" style="margin-left:12px;padding:6px 10px;">Retry</button></div>`;
      const btn = activeView.querySelector('#retry-load');
      if (btn) btn.addEventListener('click', () => handleRoute());
    }

    requestAnimationFrame(() => {
      initScrollReveal();
    });

    document.querySelectorAll('.nav-link, #mobile-nav a').forEach(el => {
      const href = el.getAttribute('href');
      if (href === hash || (hash === '#/' && href === '#/')) {
        el.classList.remove('text-gray-500');
        el.classList.add('text-white');
      }
    });

    if (mobileNav && !mobileNav.classList.contains('hidden')) {
      mobileNav.classList.add('hidden');
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
});

function renderTeam() {
  const container = document.getElementById('team-grid');
  if (!container) return;

  container.innerHTML = TEAM_MEMBERS.map(member => `
    <div class="team-card group relative rounded-2xl border border-white/[0.08] bg-neutral-900/40 backdrop-blur-md p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] flex flex-col items-center text-center">
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-neutral-800 to-neutral-700 border border-white/10 flex items-center justify-center font-bold text-xl text-cyan-400 mb-4 group-hover:border-cyan-400/50 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all">
        ${member.name.charAt(0)}
      </div>
      <h3 class="font-semibold text-lg text-white group-hover:text-cyan-300 transition-colors">
        ${member.name}
      </h3>
      <p class="text-xs uppercase tracking-wider text-cyan-400/80 font-medium mt-1 mb-6">
        Core Contributor
      </p>
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

  if (window.lucide) {
    window.lucide.createIcons();
  }
}