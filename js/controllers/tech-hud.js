export function initTechHUD() {
  const cards = document.querySelectorAll('.tech-card');
  if (!cards.length) return;

  // Add Apple/Linear-style radial cursor spotlight tracking
  cards.forEach(card => {
    const glowLayer = card.querySelector('.glow-layer');

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (glowLayer) {
        glowLayer.style.background = `radial-gradient(400px circle at ${x}px ${y}px, rgba(255, 255, 255, 0.06), transparent 80%)`;
      }
    });

    card.addEventListener('mouseleave', () => {
      if (glowLayer) {
        glowLayer.style.background = 'none';
      }
    });
  });
}