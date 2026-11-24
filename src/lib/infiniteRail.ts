export type RailGeometry = { origin: number; period: number };

// Distance between homologous edges includes the actual flex gap, padding and
// fractional layout pixels. scrollWidth / copies and offsetWidth lose these.
export function measureRail(rail: HTMLElement): RailGeometry | null {
  const segments = [...rail.querySelectorAll<HTMLElement>('[data-rail-segment]')];
  const canonical = segments.findIndex(segment => segment.dataset.railCopy === '0');
  if (canonical < 0 || segments.length < 2) return null;
  const segment = segments[canonical], adjacent = segments[canonical + 1] ?? segments[canonical - 1];
  const box = segment.getBoundingClientRect();
  const period = Math.abs(adjacent.getBoundingClientRect().left - box.left);
  if (!Number.isFinite(period) || period <= 0) return null;
  const inset = (parseFloat(getComputedStyle(rail).paddingLeft) || 0) + (parseFloat(getComputedStyle(segment.parentElement!).paddingLeft) || 0);
  return { period, origin: rail.scrollLeft + box.left - rail.getBoundingClientRect().left - inset };
}

export function wrapRailPosition(position: number, { origin, period }: RailGeometry) {
  if (!(period > 0) || !Number.isFinite(position)) return position;
  return origin + ((position - origin) % period + period) % period;
}

// Native runway for finger movement and momentum; bounded for short collections.
export function railCopiesPerSide(period: number, viewport: number) {
  return period > 0 ? Math.min(32, Math.max(1, Math.ceil(viewport * 4 / period))) : 1;
}

export function logicalRailSource(element: HTMLElement) {
  const segment = element.closest<HTMLElement>('[data-rail-segment]');
  if (!segment || segment.dataset.railCopy === '0' || (!element.dataset.mediaId && !element.dataset.railFocus)) return element;
  const rail = segment.closest<HTMLElement>('.horizontal-rail');
  const canonical = rail?.querySelector<HTMLElement>('[data-rail-copy="0"]');
  const logical = [...canonical?.querySelectorAll<HTMLElement>('[data-media-id],[data-rail-focus]') ?? []].find(candidate => element.dataset.railFocus ? candidate.dataset.railFocus === element.dataset.railFocus : candidate.dataset.mediaId === element.dataset.mediaId && candidate.dataset.mediaKind === element.dataset.mediaKind);
  if (!rail || !logical) return element;
  // Move the logical source into the same spot before returning focus, rather
  // than focusing an aria-hidden decoration. The visible scene stays identical.
  rail.dataset.rebasing = 'true';
  rail.scrollLeft += logical.getBoundingClientRect().left - element.getBoundingClientRect().left;
  return logical;
}
