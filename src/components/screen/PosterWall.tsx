import type { PersonalScreenTitle as ScreenTitle } from '../../lib/personalization';
import type { Selection } from '../shared/DetailOverlay';
import { useHorizontalRail } from '../../hooks/useHorizontalRail';
import { FramedPoster } from './FramedPoster';
import { Fragment, memo, useEffect, useState, type ReactNode } from 'react';
import { arrangePosterWall } from '../../lib/posterArrangement';

export const PosterWall = memo(function PosterWall({ items, onOpen, arrangementReady = true, currentId, watching }: { items: ScreenTitle[]; onOpen: (s: Selection) => void; arrangementReady?: boolean; currentId?: string; watching?: (duplicate: boolean) => ReactNode }) {
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
  const columns = Array.from({ length: Math.ceil(ordered.length / 2) }, (_, i) => ordered.slice(i * 2, i * 2 + 2));
  const center = Math.min(2, Math.floor((columns.length - 1) / 2));
  return <section className="poster-wall" aria-label="Screen poster wall">
    <div ref={rail} className="poster-rail horizontal-rail" tabIndex={0} aria-label="Browse screen titles. Swipe, scroll, or use left and right arrow keys.">
      <div className="poster-row">{(loop ? [0, 1, 2] : [0]).map(copy => <div className="poster-segment" data-rail-segment key={copy}>
        {columns.map((column, position) => <Fragment key={column[0].item.id}>
          {watching && position === center && <div className="watching-slot" data-opening-center={!loop || copy === 1 ? true : undefined}>{watching(loop && copy !== 1)}</div>}
          <div className={`poster-column column-${position % 3}`} data-opening-center={!watching && position === center && (!loop || copy === 1) ? true : undefined}>
          {column.map(({ item, index }) => <FramedPoster key={item.id} item={item} index={index} isCurrent={item.id === currentId} duplicate={loop && copy !== 1} onOpen={(rect, element) => onOpen({ kind: 'screen', index, rect, element })} />)}
        </div></Fragment>)}
        {!columns.length && watching && <div className="watching-slot" data-opening-center={!loop || copy === 1 ? true : undefined}>{watching(loop && copy !== 1)}</div>}
      </div>)}</div>
      {!items.length && <p className="empty-collection">The wall is waiting for its first frame.</p>}
    </div>
  </section>;
});
