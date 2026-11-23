import { useLayoutEffect, useRef, useState } from 'react';
import { restoreFocus } from './useDialogFocus';

type Kind = 'book' | 'screen' | 'album';
type Box = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
export const FLIGHT_DURATION = 720;

// A spine turns into a cover without stretching its artwork into a thin image.
export function objectFlightTransform(source: Box, target: Box, kind: Kind) {
  const scale = Math.max(.02, source.height / Math.max(1, target.height));
  const turn = kind === 'book' ? 90 : -3;
  const x = source.left + source.width / 2 - target.left - target.width / 2 + (kind === 'book' ? source.width / 2 : 0);
  const y = source.top + source.height / 2 - target.top - target.height / 2;
  return {
    source: `translate3d(${x}px, ${y}px, 0) rotateY(${turn}deg) scale(${scale})`,
    arc: `translate3d(${x * .4}px, ${y * .4}px, 75px) rotateY(${turn * .55 - 8}deg) rotateX(4deg) scale(${Math.sqrt(scale)})`,
  };
}

function visibleSource(kind: Kind, id: string, original: HTMLElement) {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-media-kind][data-media-id]'))
    .filter(el => el.dataset.mediaKind === kind && el.dataset.mediaId === id);
  const visible = candidates.filter(el => {
    const box = el.getBoundingClientRect(), rail = el.closest('.horizontal-rail')?.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.right > Math.max(0, rail?.left ?? 0) && box.left < Math.min(window.innerWidth, rail?.right ?? window.innerWidth) && box.bottom > 0 && box.top < window.innerHeight;
  });
  return visible.includes(original) ? original : visible[0];
}

export function useObjectFlight(kind: Kind, id: string, original: HTMLButtonElement, onClose: () => void) {
  const art = useRef<HTMLDivElement>(null);
  const [out, setOut] = useState(false), [closing, setClosing] = useState(false);
  const closeAction = useRef(onClose); closeAction.current = onClose;
  const animation = useRef<Animation | null>(null), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hiddenSource = useRef<HTMLElement | undefined>(undefined), returning = useRef(false);
  const restoreSource = () => { if (hiddenSource.current) delete hiddenSource.current.dataset.inDetail; hiddenSource.current = undefined; };
  useLayoutEffect(() => {
    const hero = art.current!;
    const source = visibleSource(kind, id, original);
    if (kind === 'book' && source) {
      const box = source.getBoundingClientRect(), height = hero.getBoundingClientRect().height;
      hero.style.setProperty('--object-thickness', `${box.width * height / Math.max(1, box.height)}px`);
      hero.style.setProperty('--flight-spine-font', `${15 * height / Math.max(1, box.height)}px`);
    }
    setOut(true);
    if (source && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && hero.animate) {
      const box = source.querySelector(kind === 'book' ? '.spine-face' : kind === 'screen' ? '.poster-frame' : '.vinyl-sleeve')?.getBoundingClientRect() ?? source.getBoundingClientRect();
      const path = objectFlightTransform(box, hero.getBoundingClientRect(), kind);
      source.dataset.inDetail = 'true'; hiddenSource.current = source;
      animation.current = hero.animate([{ transform: path.source }, { transform: path.arc, offset: .52 }, { transform: 'none' }], { duration: FLIGHT_DURATION, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both' });
    }
    return () => {
      animation.current?.cancel(); clearTimeout(timer.current); restoreSource();
      if (returning.current) requestAnimationFrame(() => restoreFocus(visibleSource(kind, id, original) ?? original));
    };
  }, [kind, id, original]);
  const close = () => {
    if (returning.current) return;
    returning.current = true; setClosing(true); setOut(false);
    const hero = art.current!, reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = getComputedStyle(hero).transform;
    animation.current?.cancel();
    const source = visibleSource(kind, id, original);
    restoreSource();
    if (source && !reduced) { source.dataset.inDetail = 'true'; hiddenSource.current = source; }
    if (!reduced && hero.animate) {
      const path = source ? objectFlightTransform(source.getBoundingClientRect(), hero.getBoundingClientRect(), kind) : null;
      animation.current = hero.animate(path
        ? [{ transform: start }, { transform: path.arc, offset: .45 }, { transform: path.source }]
        : [{ transform: start, opacity: 1 }, { transform: 'translateZ(-130px) rotateY(-18deg) scale(.85)', opacity: 0 }],
      { duration: FLIGHT_DURATION, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
      void animation.current.finished.then(() => closeAction.current(), () => { /* Unmounted or replaced. */ });
    } else {
      timer.current = setTimeout(() => closeAction.current(), reduced ? 0 : FLIGHT_DURATION);
    }
    // Wait for the complete flight, including when the browser slows its timeline.
  };
  return { art, out, closing, close };
}
