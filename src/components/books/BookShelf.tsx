import type { PersonalBook as Book } from '../../lib/personalization';
import type { Selection } from '../shared/DetailOverlay';
import { useHorizontalRail } from '../../hooks/useHorizontalRail';
import { BookSpine } from './BookSpine';
import { memo } from 'react';

export const BookShelf = memo(function BookShelf({ items, onOpen }: { items: Book[]; onOpen: (s: Selection) => void }) {
  const loop = items.reduce((n, b) => n + b.width + 2, 0) > 2600;
  const rail = useHorizontalRail(loop, true);
  return <section className="bookshelf" aria-label="Bookshelf">
    <div ref={rail} className="book-rail horizontal-rail" tabIndex={0} aria-label="Browse books. Swipe, scroll, or use left and right arrow keys.">
      <div className="book-row">
        {(loop ? [0, 1, 2] : [0]).map(copy => <div className="book-segment" key={copy}>
          {items.map((book, index) => <BookSpine key={`${copy}-${book.id}`} book={book} duplicate={loop && copy !== 1} onOpen={(rect, element) => onOpen({ kind: 'book', index, rect, element })} />)}
        </div>)}
        {!items.length && <p className="empty-collection">The shelf is waiting for its first book.</p>}
      </div>
    </div>
    <div className="shelf-surface" aria-hidden="true" /><div className="shelf-ground" aria-hidden="true" />
  </section>;
});
