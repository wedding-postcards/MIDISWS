import './louver-header.css';

// Exact pointer arithmetic and timing from Louver's public
// shared-lib.BdX-LD-o.mjs, archived in references/louver-header-audit.
// No spring is used by these two buttons in the source.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fineHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
if (fineHover && !reduced) {
  document.querySelectorAll<HTMLElement>('.louver-button').forEach(element => {
    element.addEventListener('pointermove', event => {
      const rect = element.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - .5) * 16;
      const y = ((event.clientY - rect.top) / rect.height - .5) * 16;
      element.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    });
    element.addEventListener('pointerleave', () => { element.style.translate = '0px 0px'; });
  });
}
