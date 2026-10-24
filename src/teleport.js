// "Teleport" to a section: a starry veil fades in over the page, the page jumps
// underneath it, and the veil fades out on the new spot. Used for the hero's
// calendar links, where a long smooth scroll through the whole page felt slow.
// Reduced motion: a plain jump, no veil.
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let veil = null;

export function teleport(target) {
  if (!target) return;
  // 'instant' overrides html { scroll-behavior: smooth }.
  const jump = () => target.scrollIntoView({ behavior: 'instant', block: 'start' });
  if (reduced()) return jump();
  if (!veil) {
    veil = document.createElement('div');
    veil.className = 'teleport';
    veil.setAttribute('aria-hidden', 'true');
    document.body.appendChild(veil);
  }
  requestAnimationFrame(() => {
    veil.classList.remove('is-out');
    veil.classList.add('is-in');
    setTimeout(() => {
      jump();
      requestAnimationFrame(() => {
        veil.classList.remove('is-in');
        veil.classList.add('is-out');
      });
    }, 280);
  });
}
