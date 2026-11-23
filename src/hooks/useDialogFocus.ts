import { useEffect, type RefObject } from 'react';

export function restoreFocus(element: HTMLElement | null) {
  if (!element?.isConnected) return;
  element.dataset.returningFocus = 'true';
  element.focus({ preventScroll: true });
  requestAnimationFrame(() => { delete element.dataset.returningFocus; });
}

export function trapFocus(event: KeyboardEvent, dialog: HTMLElement) {
  if (event.key !== 'Tab') return;
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')).filter(el => el.tabIndex >= 0 && !el.hidden);
  const first = controls[0], last = controls.at(-1);
  if (!first) { event.preventDefault(); dialog.focus(); return; }
  if (!dialog.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); return; }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first?.focus(); }
}

export function useDialogFocus(ref: RefObject<HTMLDivElement | null>, returnFocus = true) {
  useEffect(() => {
    const original = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; ref.current?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => { if (ref.current && !ref.current.inert) trapFocus(event, ref.current); };
    window.addEventListener('keydown', key);
    return () => { document.body.style.overflow = overflow; window.removeEventListener('keydown', key); if (returnFocus) restoreFocus(original); };
  }, [ref, returnFocus]);
}
