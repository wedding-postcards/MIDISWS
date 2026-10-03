export type HeroUiFrame = {
  titleTop: number;
  titleBottom: number;
  scrollOffset: number;
  introComplete: boolean;
};
export type HeaderState = 'intro' | 'normal' | 'cinematic' | 'menu';
export type HeaderScrollState = { anchor: number; hidden: boolean };

/** Accumulate movement from the last extremum; paused frames preserve visibility. */
export function updateHeaderScroll(previous: HeaderScrollState, scrollOffset: number): HeaderScrollState {
  const offset = Math.max(0, scrollOffset);
  if (offset <= 2) return { anchor: offset, hidden: false };
  const anchor = previous.hidden ? Math.max(previous.anchor, offset) : Math.min(previous.anchor, offset);
  const distance = offset - anchor;
  if ((!previous.hidden && distance >= 6) || (previous.hidden && distance <= -6)) {
    return { anchor: offset, hidden: !previous.hidden };
  }
  return { anchor, hidden: previous.hidden };
}

/** The existing scene clock drives direction; title bounds never restore the UI. */
export function deriveHeaderState(frame: HeroUiFrame, context: {
  scrollHidden: boolean;
  menuOpen: boolean;
  headerFocused: boolean;
}): HeaderState {
  if (!frame.introComplete) return 'intro';
  if (context.menuOpen) return 'menu';
  if (context.headerFocused) return 'normal';
  return context.scrollHidden ? 'cinematic' : 'normal';
}

const dialog = document.querySelector<HTMLDialogElement>('#bg3-site-menu')!;
const trigger = document.querySelector<HTMLButtonElement>('.bg3-menu-toggle')!;
const close = document.querySelector<HTMLButtonElement>('.bg3-menu-close')!;
const header = document.querySelector<HTMLElement>('.bg3-header')!;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let closing = false;
let closeTimer = 0;
let restoringFocus = false;
let state: HeaderState | undefined;
let frame: HeroUiFrame = {
  titleTop: Infinity,
  titleBottom: Infinity,
  scrollOffset: scrollY,
  introComplete: document.body.classList.contains('intro-complete') || document.body.classList.contains('webgl-failed'),
};
let scrollState: HeaderScrollState = { anchor: Math.max(0, frame.scrollOffset), hidden: false };

function syncHeaderState(): void {
  const next = deriveHeaderState(frame, {
    scrollHidden: scrollState.hidden,
    menuOpen: dialog.open && !restoringFocus,
    headerFocused: restoringFocus || header.contains(document.activeElement),
  });
  if (next === state) return;
  state = next;
  header.dataset.uiState = next;
  header.classList.toggle('is-cinematic', next === 'cinematic');
  // IntroCover owns the initial inert flag until it removes the curtain.
  if (next === 'intro') return;
  const unavailable = next === 'cinematic' || next === 'menu';
  header.inert = unavailable;
  if (unavailable) header.setAttribute('aria-hidden', 'true');
  else header.removeAttribute('aria-hidden');
}

document.addEventListener('midis:hero-ui-frame', event => {
  frame = (event as CustomEvent<HeroUiFrame>).detail;
  scrollState = updateHeaderScroll(scrollState, frame.scrollOffset);
  syncHeaderState();
});
header.addEventListener('focusin', syncHeaderState);
header.addEventListener('focusout', () => queueMicrotask(syncHeaderState));
syncHeaderState();

function notify(open: boolean): void {
  document.documentElement.classList.toggle('bg3-menu-open', open);
  trigger.setAttribute('aria-expanded', String(open));
  document.dispatchEvent(new CustomEvent('midis:menu-change', { detail: open }));
}

function finishClose(): void {
  if (!closing) return;
  window.clearTimeout(closeTimer);
  // Restore availability before native dialog.close() returns focus.
  restoringFocus = true;
  syncHeaderState();
  dialog.close();
  closing = false;
  notify(false);
  trigger.focus({ preventScroll: true });
  restoringFocus = false;
  syncHeaderState();
}

function closeMenu(): void {
  if (!dialog.open || closing) return;
  closing = true;
  dialog.classList.remove('is-open');
  if (reducedMotion.matches) finishClose();
  else closeTimer = window.setTimeout(finishClose, 760);
}

trigger.addEventListener('click', () => {
  if (dialog.open || state === 'intro' || state === 'cinematic') return;
  dialog.showModal();
  syncHeaderState();
  notify(true);
  void dialog.offsetHeight;
  dialog.classList.add('is-open');
  close.focus({ preventScroll: true });
});
close.addEventListener('click', closeMenu);
dialog.addEventListener('cancel', event => { event.preventDefault(); closeMenu(); });
dialog.addEventListener('transitionend', event => {
  if (event.target === dialog && event.propertyName === 'height') finishClose();
});
dialog.addEventListener('click', event => {
  if (event.target === dialog && event.clientY > dialog.getBoundingClientRect().bottom) closeMenu();
});
