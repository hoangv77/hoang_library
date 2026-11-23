import { useEffect, useRef } from 'react';

// One DOM update per frame; scrolling does not rerender every object in the scene.
export function useHorizontalRail(loop: boolean, curved = false, openingKey?: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rail = ref.current; if (!rail) return;
    let frame = 0, dragged = false;
    let wheelEnd: ReturnType<typeof setTimeout> | undefined;
    let start: { x: number; scroll: number; pointer: number } | null = null;
    const segmentWidth = () => rail.querySelector<HTMLElement>('[data-rail-segment]')?.offsetWidth || rail.scrollWidth / 3;
    const update = () => {
      frame = 0;
      const segment = segmentWidth();
      // Let Tab keep the actual focused object on screen rather than wrapping to
      // a decorative copy. Pointer browsing resumes the seamless loop.
      if (loop && segment > rail.clientWidth && !rail.querySelector('button:focus-visible')) {
        if (rail.scrollLeft < segment * .5) rail.scrollLeft += segment;
        else if (rail.scrollLeft >= segment * 1.5) rail.scrollLeft -= segment;
      }
      rail.dataset.overflow = String(rail.scrollWidth > rail.clientWidth + 2);
      if (curved) {
        const center = rail.getBoundingClientRect().left + rail.clientWidth / 2;
        rail.querySelectorAll<HTMLElement>('[data-spine]').forEach(el => {
          const box = el.getBoundingClientRect();
          const t = Math.max(-1, Math.min(1, (box.left + box.width / 2 - center) / (rail.clientWidth / 2)));
          el.style.setProperty('--ry', `${-Math.sign(t) * Math.pow(Math.abs(t), 1.35) * 34}deg`);
        });
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || rail.scrollWidth <= rail.clientWidth) return;
      event.preventDefault();
      if (rail.hasAttribute('data-snap-sleeves')) {
        // Let small trackpad deltas accumulate before settling onto one sleeve.
        rail.dataset.wheeling = 'true'; clearTimeout(wheelEnd);
        wheelEnd = setTimeout(() => { delete rail.dataset.wheeling; }, 160);
      }
      const amount = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      rail.scrollLeft += amount * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? rail.clientWidth : 1);
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === 'touch') return;
      start = { x: event.clientX, scroll: rail.scrollLeft, pointer: event.pointerId }; dragged = false;
    };
    const move = (event: PointerEvent) => {
      if (!start) return;
      if (Math.abs(event.clientX - start.x) > 7) {
        dragged = true; rail.dataset.dragging = 'true';
        rail.setPointerCapture(start.pointer); rail.scrollLeft = start.scroll - (event.clientX - start.x);
      }
    };
    const up = () => { const active = start; start = null; if (active && rail.hasPointerCapture(active.pointer)) rail.releasePointerCapture(active.pointer); rail.dataset.dragging = 'false'; };
    const click = (event: MouseEvent) => { if (dragged) { event.preventDefault(); event.stopPropagation(); dragged = false; } };
    const focus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target.dataset.returningFocus) return;
      if (rail.matches(':focus-within') && event.target instanceof HTMLElement && event.target.matches(':focus-visible')) {
        const box = event.target.getBoundingClientRect(), bounds = rail.getBoundingClientRect();
        // Only move this rail. scrollIntoView also moved the whole page vertically.
        if (box.left < bounds.left || box.right > bounds.right) rail.scrollLeft += box.left + box.width / 2 - bounds.left - bounds.width / 2;
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.target !== rail) return;
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        if (event.key === 'Home') rail.scrollLeft = loop ? segmentWidth() : 0;
        else if (event.key === 'End') rail.scrollLeft = loop ? segmentWidth() * 2 - rail.clientWidth : rail.scrollWidth;
        else {
          const sleeve = rail.querySelector<HTMLElement>('[data-rail-step]');
          const step = sleeve?.offsetWidth ? sleeve.offsetWidth + (parseFloat(getComputedStyle(sleeve.parentElement!).columnGap) || 0) : 320;
          rail.scrollBy({ left: event.key === 'ArrowLeft' ? -step : step, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        }
      }
    };
    rail.addEventListener('wheel', wheel, { passive: false }); rail.addEventListener('scroll', schedule, { passive: true });
    rail.addEventListener('pointerdown', down); rail.addEventListener('pointermove', move); rail.addEventListener('pointerup', up); rail.addEventListener('pointercancel', up); rail.addEventListener('lostpointercapture', up);
    rail.addEventListener('click', click, true); rail.addEventListener('keydown', key); rail.addEventListener('focusin', focus);
    const resize = new ResizeObserver(schedule); resize.observe(rail);
    if (loop) rail.scrollLeft = segmentWidth();
    if (openingKey) {
      const startAnchor = rail.querySelector<HTMLElement>('[data-opening-start="true"]');
      if (startAnchor) rail.scrollLeft += startAnchor.getBoundingClientRect().left - rail.getBoundingClientRect().left - (parseFloat(getComputedStyle(rail).getPropertyValue('--opening-inset')) || 32);
      const anchor = rail.querySelector<HTMLElement>('[data-opening-center="true"]');
      if (anchor) {
        const box = anchor.getBoundingClientRect();
        rail.scrollLeft += box.left - rail.getBoundingClientRect().left + box.width / 2 - rail.clientWidth / 2;
      }
    }
    update();
    return () => {
      cancelAnimationFrame(frame); clearTimeout(wheelEnd); delete rail.dataset.wheeling; resize.disconnect();
      rail.removeEventListener('wheel', wheel); rail.removeEventListener('scroll', schedule); rail.removeEventListener('pointerdown', down); rail.removeEventListener('pointermove', move); rail.removeEventListener('pointerup', up); rail.removeEventListener('pointercancel', up); rail.removeEventListener('lostpointercapture', up); rail.removeEventListener('click', click, true); rail.removeEventListener('keydown', key); rail.removeEventListener('focusin', focus);
    };
  }, [loop, curved, openingKey]);
  return ref;
}
