import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PersonalBook as Book } from '../../lib/personalization';
import { Artwork } from '../shared/Artwork';
import { MetadataTooltip } from '../shared/MetadataTooltip';
import { faceFont, COVER_W } from './bookFaces';
import { BookRating } from '../shared/BookRating';

export const BookSpine = memo(function BookSpine({ book, duplicate, onOpen, isCurrent = false }: { book: Book; duplicate: boolean; isCurrent?: boolean; onOpen: (rect: DOMRect, element: HTMLButtonElement) => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = (el: HTMLButtonElement) => { clearTimeout(timer.current); setRect(el.getBoundingClientRect()); };
  const hide = () => { timer.current = setTimeout(() => setRect(null), 90); };
  const style = { width: book.width, height: book.height, '--spine': book.spine, '--ink': book.ink, '--band': book.band ?? book.ink, '--lean': `${book.lean}deg`, '--depth': `${book.depth}px`, '--wear': book.wear, '--cover-width': `${COVER_W}px`, fontFamily: faceFont[book.face] } as CSSProperties;
  return <button data-spine data-media-kind="book" data-media-id={book.id} className={`book-target ${book.finish} ${isCurrent ? 'is-current' : ''} ${rect ? 'is-hovered' : ''} ${book.isFavorite ? 'is-favorite' : ''}`} style={style} tabIndex={duplicate ? -1 : 0} aria-hidden={duplicate || undefined}
    aria-label={`${book.title}, ${book.author}${isCurrent ? ', currently reading' : book.status === 'currently-reading' ? ', in progress' : ''}${book.isFavorite ? ', personal favorite' : ''}. Open book details`}
    onPointerEnter={e => { if (e.pointerType !== 'touch') show(e.currentTarget); }} onPointerLeave={hide}
    onFocus={e => { if (!e.currentTarget.dataset.returningFocus) show(e.currentTarget); }} onBlur={() => { clearTimeout(timer.current); setRect(null); }}
    onClick={e => { clearTimeout(timer.current); setRect(null); onOpen(e.currentTarget.getBoundingClientRect(), e.currentTarget); }}>
    <span className="book-object">
      <span className="spine-face">
        {book.cover && <img className="cover-wrap" src={book.cover} alt="" aria-hidden="true" loading="lazy" decoding="async" draggable={false} onError={e => { e.currentTarget.style.opacity = '0'; }} />}
        <span className="spine-settle" />
        <span className="spine-rule top" /><span className="spine-rule bottom" />
        <span className={`spine-title ${book.caps ? 'uppercase' : ''}`}>{book.title}</span>
        {book.width >= 44 && <span className="spine-author">{book.author}</span>}
        {book.width >= 30 && <span className="publisher-mark" aria-hidden="true">❧</span>}
        <span className="spine-material" /><span className="spine-sheen" /><span className="spine-wear" />
      </span>
      <span className="book-cover"><Artwork src={book.cover} title={book.title} subtitle={book.author} /></span>
      <span className="page-block" />{book.binding === 'hardcover' && <span className="headband" />}
    </span>
    {rect && <MetadataTooltip title={book.title} subtitle={book.author} metadata={[book.year, isCurrent ? 'Reading now' : undefined, book.isFavorite ? 'Personal favorite' : undefined].filter(Boolean).join(' · ')} rect={rect}><BookRating rating={book.rating} compact /></MetadataTooltip>}
  </button>;
});
