import type { PersonalScreenTitle as ScreenTitle } from '../../lib/personalization';
import type { Selection } from '../shared/DetailOverlay';
import { useHorizontalRail } from '../../hooks/useHorizontalRail';
import { FramedPoster } from './FramedPoster';
import { memo } from 'react';

export const PosterWall = memo(function PosterWall({ items, onOpen }: { items: ScreenTitle[]; onOpen: (s: Selection) => void }) {
  const loop = items.length > 18;
  const rail = useHorizontalRail(loop);
  // Each pair forms a column; all titles share the same independently browsable wall.
  const columns = Array.from({ length: Math.ceil(items.length / 2) }, (_, i) => items.slice(i * 2, i * 2 + 2));
  return <section className="poster-wall" aria-label="Screen poster wall">
    <div ref={rail} className="poster-rail horizontal-rail" tabIndex={0} aria-label="Browse screen titles. Swipe, scroll, or use left and right arrow keys.">
      <div className="poster-row">{(loop ? [0, 1, 2] : [0]).map(copy => <div className="poster-segment" key={copy}>
        {columns.map((pair, column) => <div className={`poster-column column-${column % 3}`} key={column}>
          {pair.map((item, row) => <FramedPoster key={item.id} item={item} index={column * 2 + row} duplicate={loop && copy !== 1} onOpen={(rect, element) => onOpen({ kind: 'screen', index: column * 2 + row, rect, element })} />)}
        </div>)}
      </div>)}</div>
      {!items.length && <p className="empty-collection">The wall is waiting for its first frame.</p>}
    </div>
  </section>;
});
