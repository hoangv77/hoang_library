import type { PersonalBook as Book } from '../../lib/personalization';
import type { Selection } from '../shared/DetailOverlay';
import { useHorizontalRail } from '../../hooks/useHorizontalRail';
import { BookSpine } from './BookSpine';
import { memo } from 'react';

export const BookShelf = memo(function BookShelf({ items, onOpen, currentId }: { items: Book[]; onOpen: (s: Selection) => void; currentId?: string; compact?: boolean }) {
  const loop = items.length > 1;
  const { ref: rail, copies } = useHorizontalRail(loop, true);
  return <section className="bookshelf" aria-label="Bookshelf">
    <div ref={rail} className="book-rail horizontal-rail" data-loop={loop || undefined} tabIndex={0} aria-label="Browse books. Swipe, scroll, or use left and right arrow keys.">
      <div className="book-row">
        {copies.map(copy => <div className="book-segment" data-rail-segment data-rail-copy={copy} aria-hidden={copy !== 0 || undefined} key={copy}>
          {items.map((book, index) => <BookSpine key={book.id} book={book} isCurrent={book.id === currentId} duplicate={copy !== 0} onOpen={(rect, element) => onOpen({ kind: 'book', index, rect, element })} />)}
        </div>)}
        {!items.length && <p className="empty-collection">The shelf is waiting for its first book.</p>}
      </div>
    </div>
    <div className="shelf-surface" aria-hidden="true" /><div className="shelf-ground" aria-hidden="true" />
  </section>;
});
