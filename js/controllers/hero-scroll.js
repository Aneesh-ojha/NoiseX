export function initHeroScroll() {
  const track = document.getElementById('hero-scroll-track');
  const logoContainer = document.getElementById('hero-logo-container');
  const tagline = document.getElementById('hero-tagline');
  const scrollHint = document.getElementById('hero-scroll-hint');

  // Guard clause if elements are not found
  if (!track || !logoContainer) return;

  let ticking = false;

  function updateHero() {
    const rect = track.getBoundingClientRect();
    const trackHeight = rect.height - window.innerHeight;

    if (trackHeight <= 0) return;

    // Normalize progress between 0 (top) and 1 (fully scrolled)
    let progress = -rect.top / trackHeight;
    progress = Math.max(0, Math.min(1, progress));

    // Scale from 1x to 3.6x
    const scale = 1 + progress * 2.6;

    // Keep opaque early, then fade smoothly to 0 after 40% scroll
    const opacity = progress > 0.4 
      ? Math.max(0, 1 - (progress - 0.4) / 0.55) 
      : 1;

    // Subtle progressive lens blur
    const blur = progress * 5;

    // GPU-accelerated transforms
    logoContainer.style.transform = `scale3d(${scale}, ${scale}, 1)`;
    logoContainer.style.opacity = opacity.toFixed(3);
    logoContainer.style.filter = `blur(${blur.toFixed(1)}px)`;

    // Fade out helper elements early
    if (scrollHint) scrollHint.style.opacity = Math.max(0, 1 - progress * 2.5).toString();
    if (tagline) tagline.style.opacity = Math.max(0, 1 - progress * 2).toString();
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateHero();
        ticking = false;
      });
      ticking = true;
    }
  }

  // Attach listener and run initial calculation
  window.addEventListener('scroll', onScroll, { passive: true });
  updateHero();
}