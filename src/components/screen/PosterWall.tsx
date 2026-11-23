import type { PersonalScreenTitle as ScreenTitle } from '../../lib/personalization';
import type { Selection } from '../shared/DetailOverlay';
import { useHorizontalRail } from '../../hooks/useHorizontalRail';
import { FramedPoster } from './FramedPoster';
import { memo, useEffect, useState } from 'react';
import { arrangePosterWall } from '../../lib/posterArrangement';

export const PosterWall = memo(function PosterWall({ items, onOpen, arrangementReady = true }: { items: ScreenTitle[]; onOpen: (s: Selection) => void; arrangementReady?: boolean }) {
  // Capture once after persisted favorites load. Saving an edit never moves an open title.
  const [openingOrder, setOpeningOrder] = useState(() => arrangementReady ? arrangePosterWall(items) : null);
  useEffect(() => {
    if (!openingOrder && arrangementReady) setOpeningOrder(arrangePosterWall(items));
  }, [items, arrangementReady, openingOrder]);
  const loop = items.length > 18;
  const rail = useHorizontalRail(loop, false, openingOrder?.join('|') ?? 'pending');
  const indexed = new Map(items.map((item, index) => [item.id, { item, index }]));
  const ordered = (openingOrder ?? arrangePosterWall(items)).flatMap(id => indexed.has(id) ? [indexed.get(id)!] : []);
  const known = new Set(ordered.map(({ item }) => item.id));
  ordered.push(...items.flatMap((item, index) => known.has(item.id) ? [] : [{ item, index }]));
  return <section className="poster-wall" aria-label="Screen poster wall">
    <div ref={rail} className="poster-rail horizontal-rail" tabIndex={0} aria-label="Browse screen titles. Swipe, scroll, or use left and right arrow keys.">
      <div className="poster-row">{(loop ? [0, 1, 2] : [0]).map(copy => <div className="poster-segment" data-rail-segment key={copy}>
        {ordered.map(({ item, index }, position) => <div className="poster-slot" key={item.id} data-opening-start={position === 0 && (!loop || copy === 1) ? true : undefined}>
          <FramedPoster item={item} index={index} duplicate={loop && copy !== 1} onOpen={(rect, element) => onOpen({ kind: 'screen', index, rect, element })} />
        </div>)}
      </div>)}</div>
      {!items.length && <p className="empty-collection">The wall is waiting for its first frame.</p>}
    </div>
  </section>;
});
