import { useLayoutEffect, useRef, useState } from 'react';
import { COMPACT_LAYOUT_QUERY } from './useCompactLayout';
import { measureRail, railCopiesPerSide, wrapRailPosition, type RailGeometry } from '../lib/infiniteRail';

export function advanceRail(rail: HTMLDivElement, direction: number) {
  const sleeve = rail.querySelector<HTMLElement>('[data-rail-step]');
  const step = sleeve?.offsetWidth;
  const amount = step ? step + (parseFloat(getComputedStyle(sleeve!.parentElement!).columnGap) || 0) : 320;
  rail.scrollBy({ left: direction * amount, behavior: rail.hasAttribute('data-loop') || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

export function useHorizontalRail(loop: boolean, curved = false, openingKey?: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [sides, setSides] = useState(1);
  const geometry = useRef<RailGeometry | null>(null);
  const refresh = useRef<() => void>(() => {});
  const opening = useRef<string | undefined>(undefined);
  const copies = loop ? Array.from({ length: sides * 2 + 1 }, (_, index) => index - sides) : [0];

  useLayoutEffect(() => {
    const rail = ref.current; if (!rail) return;
    const compactViewport = window.matchMedia(COMPACT_LAYOUT_QUERY);
    let frame = 0, rebaseFrame = 0, dragged = false, nativeTouch = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let start: { x: number; scroll: number; pointer: number } | null = null;
    let touch: { x: number; y: number; id: number } | null = null;
    let observed: HTMLElement | null = null;
    const keyboardItem = () => rail.querySelector('button:focus-visible');
    const rebase = () => {
      const measured = geometry.current;
      if (!loop || !measured || keyboardItem() || rail.dataset.returningFocus) return;
      const target = wrapRailPosition(rail.scrollLeft, measured), delta = target - rail.scrollLeft;
      if (Math.abs(delta) < .01) return;
      rail.dataset.rebasing = 'true';
      cancelAnimationFrame(rebaseFrame);
      rail.scrollLeft = target;
      // Continuing a mouse drag must use the corrected coordinate system.
      if (start) start.scroll += delta;
    };
    const update = () => {
      frame = 0;
      // iOS can undo scrollLeft writes with a finger down. Copies carry the
      // gesture; recenter at scrollend, preserving native momentum. Only an
      // unusually long fling needs the emergency guard near a physical edge.
      const nearEdge = rail.scrollLeft < rail.clientWidth / 2 || rail.scrollLeft > rail.scrollWidth - rail.clientWidth * 1.5;
      if (!touch && (!nativeTouch || nearEdge)) rebase();
      rail.dataset.overflow = String(rail.scrollWidth > rail.clientWidth + 2);
      if (curved) {
        const bounds = rail.getBoundingClientRect(), half = rail.clientWidth / 2;
        const center = bounds.left + half;
        const angles: [HTMLElement, number][] = [];
        // Batch reads before writes, and skip books far outside the viewport.
        rail.querySelectorAll<HTMLElement>('[data-rail-segment]').forEach(segment => {
          const segmentBox = segment.getBoundingClientRect();
          if (segmentBox.right < bounds.left - 200 || segmentBox.left > bounds.right + 200) return;
          segment.querySelectorAll<HTMLElement>('[data-spine]').forEach(element => {
            const box = element.getBoundingClientRect();
            if (box.right < bounds.left - 200 || box.left > bounds.right + 200) return;
            const t = Math.max(-1, Math.min(1, (box.left + box.width / 2 - center) / Math.max(1, half)));
            angles.push([element, -Math.sign(t) * Math.pow(Math.abs(t), 1.35) * 34]);
          });
        });
        angles.forEach(([element, angle]) => element.style.setProperty('--ry', `${angle}deg`));
      }
      if (rail.dataset.rebasing) { cancelAnimationFrame(rebaseFrame); rebaseFrame = requestAnimationFrame(() => { delete rail.dataset.rebasing; }); }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const settle = () => { if (!touch) { nativeTouch = false; rebase(); schedule(); } };
    const scroll = () => {
      schedule(); clearTimeout(settleTimer);
      // Older-browser fallback for native scrollend.
      settleTimer = setTimeout(settle, 180);
    };
    const measure = () => {
      const previous = geometry.current, next = loop ? measureRail(rail) : null;
      if (next) {
        const phase = previous ? (rail.scrollLeft - previous.origin) / previous.period : 0;
        geometry.current = next;
        const needed = railCopiesPerSide(next.period, rail.clientWidth);
        setSides(value => value === needed ? value : needed);
        const desired = next.origin + phase * next.period;
        if (Math.abs(desired - rail.scrollLeft) > .01) rail.scrollLeft = desired;
      } else geometry.current = null;
      const canonical = rail.querySelector<HTMLElement>('[data-rail-copy="0"]');
      if (canonical !== observed) { if (observed) resize.unobserve(observed); if (canonical) resize.observe(canonical); observed = canonical; }
      schedule();
    };
    refresh.current = measure;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || rail.scrollWidth <= rail.clientWidth) return;
      delete rail.dataset.returningFocus;
      if (compactViewport.matches && !event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)) return;
      // Native horizontal input retains browser/trackpad momentum.
      if (!event.shiftKey && Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      event.preventDefault();
      const amount = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      rail.scrollLeft += amount * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? rail.clientWidth : 1); schedule();
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === 'touch') return;
      nativeTouch = false; delete rail.dataset.returningFocus; rebase();
      start = { x: event.clientX, scroll: rail.scrollLeft, pointer: event.pointerId }; dragged = false;
    };
    const move = (event: PointerEvent) => {
      if (!start) return;
      if (Math.abs(event.clientX - start.x) > 7) {
        dragged = true; rail.dataset.dragging = 'true';
        rail.setPointerCapture(start.pointer); rail.scrollLeft = start.scroll - (event.clientX - start.x); schedule();
      }
    };
    const up = () => { const active = start; start = null; if (active && rail.hasPointerCapture(active.pointer)) rail.releasePointerCapture(active.pointer); rail.dataset.dragging = 'false'; };
    const touchStart = (event: TouchEvent) => {
      nativeTouch = false; delete rail.dataset.returningFocus; rebase();
      const point = event.touches[0];
      touch = point ? { x: point.clientX, y: point.clientY, id: point.identifier } : null;
      nativeTouch = true; dragged = event.touches.length > 1;
    };
    const touchMove = (event: TouchEvent) => {
      const point = Array.from(event.touches).find(point => point.identifier === touch?.id);
      if (touch && point && Math.hypot(point.clientX - touch.x, point.clientY - touch.y) > 8) dragged = true;
    };
    const touchEnd = () => { touch = null; clearTimeout(settleTimer); settleTimer = setTimeout(settle, 180); };
    const click = (event: MouseEvent) => { if (dragged && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); dragged = false; } };
    const preventImageDrag = (event: DragEvent) => event.preventDefault();
    const focus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target.dataset.returningFocus) return;
      if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) {
        const box = event.target.getBoundingClientRect(), bounds = rail.getBoundingClientRect();
        if (box.left < bounds.left || box.right > bounds.right) rail.scrollLeft += box.left + box.width / 2 - bounds.left - bounds.width / 2;
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.target !== rail || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); nativeTouch = false; delete rail.dataset.returningFocus;
      const measured = geometry.current;
      if (event.key === 'Home') rail.scrollLeft = measured?.origin ?? 0;
      else if (event.key === 'End') {
        const lastSleeve = rail.querySelector<HTMLElement>('[data-rail-copy="0"] [data-rail-step]:last-child');
        if (lastSleeve) { const box = lastSleeve.getBoundingClientRect(); rail.scrollLeft += box.left + box.width / 2 - rail.getBoundingClientRect().left - rail.clientWidth / 2; }
        else rail.scrollLeft = measured ? measured.origin + measured.period - rail.clientWidth : rail.scrollWidth;
      }
      else { rebase(); advanceRail(rail, event.key === 'ArrowLeft' ? -1 : 1); }
      schedule();
    };
    const resize = new ResizeObserver(measure);
    resize.observe(rail); measure();
    rail.addEventListener('wheel', wheel, { passive: false }); rail.addEventListener('scroll', scroll, { passive: true }); rail.addEventListener('scrollend', settle);
    rail.addEventListener('pointerdown', down); rail.addEventListener('pointermove', move); rail.addEventListener('pointerup', up); rail.addEventListener('pointercancel', up); rail.addEventListener('lostpointercapture', up);
    rail.addEventListener('touchstart', touchStart, { passive: true }); rail.addEventListener('touchmove', touchMove, { passive: true }); rail.addEventListener('touchend', touchEnd, { passive: true }); rail.addEventListener('touchcancel', touchEnd, { passive: true });
    rail.addEventListener('dragstart', preventImageDrag); rail.addEventListener('click', click, true); rail.addEventListener('keydown', key); rail.addEventListener('focusin', focus);
    return () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(rebaseFrame); delete rail.dataset.rebasing; clearTimeout(settleTimer); resize.disconnect(); geometry.current = null;
      rail.removeEventListener('wheel', wheel); rail.removeEventListener('scroll', scroll); rail.removeEventListener('scrollend', settle);
      rail.removeEventListener('pointerdown', down); rail.removeEventListener('pointermove', move); rail.removeEventListener('pointerup', up); rail.removeEventListener('pointercancel', up); rail.removeEventListener('lostpointercapture', up);
      rail.removeEventListener('touchstart', touchStart); rail.removeEventListener('touchmove', touchMove); rail.removeEventListener('touchend', touchEnd); rail.removeEventListener('touchcancel', touchEnd);
      rail.removeEventListener('dragstart', preventImageDrag); rail.removeEventListener('click', click, true); rail.removeEventListener('keydown', key); rail.removeEventListener('focusin', focus);
    };
  }, [loop, curved]);

  // Remeasure committed DOM without reinstalling listeners or resetting on edits.
  useLayoutEffect(() => {
    refresh.current();
    const rail = ref.current; if (!rail || !openingKey || opening.current === openingKey || openingKey === 'pending') return;
    opening.current = openingKey;
    const anchor = rail.querySelector<HTMLElement>('[data-opening-center="true"]');
    if (anchor) { const box = anchor.getBoundingClientRect(); rail.scrollLeft += box.left - rail.getBoundingClientRect().left + box.width / 2 - rail.clientWidth / 2; }
  });
  return { ref, copies };
}
