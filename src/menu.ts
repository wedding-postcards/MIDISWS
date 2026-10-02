const dialog = document.querySelector<HTMLDialogElement>('#site-menu')!;
const trigger = document.querySelector<HTMLButtonElement>('.louver-menu[aria-controls]')!;
const closeButton = dialog.querySelector<HTMLButtonElement>('.site-menu-close')!;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let closing = false;
let opening = false;
let closeTimer = 0;
let backdropPress = false;

function notify(open: boolean): void {
  document.documentElement.classList.toggle('menu-open', open);
  trigger.setAttribute('aria-expanded', String(open));
  document.dispatchEvent(new CustomEvent('midis:menu-change', { detail: open }));
}

trigger.addEventListener('click', () => {
  if (dialog.open) return;
  opening = true;
  dialog.showModal();
  notify(true);
  // Establish the source's offscreen starting frame before its CSS transition.
  void dialog.offsetHeight;
  dialog.classList.add('is-open');
  closeButton.focus({ preventScroll: true });
  if (reduced) opening = false;
});

function finishClose(): void {
  if (!closing) return;
  window.clearTimeout(closeTimer);
  dialog.close();
  closing = false;
  notify(false);
  trigger.focus({ preventScroll: true });
}

function closeMenu(): void {
  if (!dialog.open || closing) return;
  closing = true;
  dialog.classList.remove('is-open');
  if (reduced) finishClose();
  else closeTimer = window.setTimeout(finishClose, 500);
}

dialog.addEventListener('transitionend', event => {
  if (event.target !== dialog || event.propertyName !== 'transform') return;
  opening = false;
  finishClose();
});
closeButton.addEventListener('click', closeMenu);
dialog.addEventListener('cancel', event => { event.preventDefault(); closeMenu(); });
dialog.addEventListener('pointerdown', event => {
  backdropPress = !opening && event.target === dialog && event.clientY > dialog.getBoundingClientRect().bottom;
});
dialog.addEventListener('click', () => {
  if (backdropPress) closeMenu();
  backdropPress = false;
});
