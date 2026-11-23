import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { PersonalBook as Book, PersonalScreenTitle as ScreenTitle } from '../../lib/personalization';
import { Artwork } from './Artwork';
import { BookRating } from './BookRating';
import { PersonalComments } from './PersonalComments';
import { OwnerEditor } from '../owner/OwnerEditor';
import type { MediaOverride } from '../../lib/personalization';
import { trapFocus } from '../../hooks/useDialogFocus';
import { CurrentEditor } from '../owner/CurrentEditor';
import type { ActiveController } from '../../hooks/useCurrentlyActive';

export type Selection = { kind: 'book' | 'screen'; index: number; rect: DOMRect; element: HTMLButtonElement };
export function DetailOverlay({ selection, books, screen, onClose, onChange, canEdit = false, importedRating, save, current }: {
  selection: Selection; books: Book[]; screen: ScreenTitle[]; onClose: () => void; onChange: (s: Selection) => void;
  canEdit?: boolean; importedRating?: number; save?: (value: MediaOverride) => Promise<MediaOverride>;
  current?: ActiveController;
}) {
  const book = selection.kind === 'book' ? books[selection.index] : undefined;
  const film = selection.kind === 'screen' ? screen[selection.index] : undefined;
  const item = book ?? film!;
  const [out, setOut] = useState(false), [closing, setClosing] = useState(false);
  const [origin, setOrigin] = useState<CSSProperties>({});
  const art = useRef<HTMLDivElement>(null), dialog = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const returnFocus = useRef(false);
  const navigationGuard = useRef<(() => boolean) | null>(null);
  const activeGuard = useRef<(() => boolean) | null>(null);
  const setActiveGuard = useCallback((guard: (() => boolean) | null) => { activeGuard.current = guard; }, []);
  const setNavigationGuard = useCallback((guard: (() => boolean) | null) => { navigationGuard.current = guard; }, []);
  const mayLeave = () => (!navigationGuard.current || navigationGuard.current()) && (!activeGuard.current || activeGuard.current());
  const close = () => { if (closing || !mayLeave()) return; returnFocus.current = true; setClosing(true); setOut(false); closeTimer.current = setTimeout(onClose, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 620); };
  const navigate = (step: number) => {
    if (closing || !mayLeave()) return;
    const length = book ? books.length : screen.length;
    onChange({ ...selection, index: (selection.index + step + length) % length });
  };
  useLayoutEffect(() => {
    const target = art.current!.getBoundingClientRect();
    const source = selection.rect;
    const scale = source.height / target.height;
    setOrigin({ '--origin-x': `${source.left + source.width / 2 - (target.left + target.width / 2)}px`, '--origin-y': `${source.top + source.height / 2 - (target.top + target.height / 2)}px`, '--origin-scale': scale, '--origin-turn': selection.kind === 'book' ? '82deg' : '-4deg' } as CSSProperties);
    let frame2 = 0;
    const frame1 = requestAnimationFrame(() => { frame2 = requestAnimationFrame(() => setOut(true)); });
    return () => { cancelAnimationFrame(frame1); cancelAnimationFrame(frame2); };
  }, [selection]);
  useEffect(() => {
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => { document.body.style.overflow = oldOverflow; clearTimeout(closeTimer.current); if (returnFocus.current) selection.element.focus({ preventScroll: true }); };
  }, [selection.element]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      trapFocus(e, dialog.current!);
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      // Editing text, selects, and star radios own their arrow keys.
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"], [role="radiogroup"]')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); navigate(1); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  const bookStatus = book?.status === 'currently-reading' ? 'Currently reading' : book?.finished ? `Finished ${book.finished}` : 'Read · date not recorded';
  const screenStatus = film?.status === 'watched' ? `Watched${film.statusInferred ? ' · inferred from personal rating' : ''}` : film?.status === 'watchlist' ? 'On the watchlist' : 'In the collection · watch status unknown';
  return createPortal(<div className={`detail-overlay ${out ? 'is-out' : ''} ${closing ? 'is-closing' : ''}`}>
    <div className="detail-backdrop" onClick={close} aria-hidden="true" />
    {film?.backdrop && <div className="detail-atmosphere" style={{ backgroundImage: `url(${film.backdrop})` }} aria-hidden="true" />}
    <div className="detail-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="detail-title" tabIndex={-1}>
      <button className="close-detail mono" onClick={close} aria-label="Close details and return to archive"><span aria-hidden="true">×</span> Close</button>
      <div className="detail-layout">
        <div className={`detail-art ${book ? 'detail-book' : 'detail-poster'} ${item.isFavorite ? 'is-favorite' : ''}`} ref={art} style={{ ...origin, '--art-color': book?.spine ?? film?.frameColor } as CSSProperties}>
          <Artwork key={item.id} src={book?.cover || film?.poster} title={item.title} subtitle={book?.author ?? String(film?.year ?? '')} eager />
          {book && <span className="detail-page-edge" aria-hidden="true" />}
        </div>
        <div className="detail-copy">
          <p className="eyebrow mono">{book ? 'From the bookshelf' : 'From the screen collection'}</p>
          {item.isFavorite && <p className="favorite-label mono">Personal favorite</p>}
          <h2 id="detail-title">{item.title}</h2>
          {book && <p className="detail-author">{book.author}</p>}
          <p className="detail-facts mono">{[item.year, film ? film.type === 'series' ? 'Television series' : film.type === 'short' ? 'Short film' : 'Film' : book?.originalBinding || book?.binding, film?.type === 'series' ? film.seasons ? `${film.seasons} seasons` : undefined : film?.runtime ? `${film.runtime} min` : book?.pages ? `${book.pages} pages` : undefined].filter(Boolean).join(' · ')}</p>
          <div className="detail-ratings">
            <div><span className="mono">My rating</span><strong>{book ? <BookRating rating={book.rating} /> : film?.personalRating ? `${film.personalRating} / 10` : 'Unrated'}</strong></div>
            {film?.imdbRating && <div><span className="mono">IMDb community</span><strong>{film.imdbRating} <small>/ 10</small></strong></div>}
          </div>
          {item.genres.length > 0 && <p className="detail-genres">{item.genres.join(' / ')}</p>}
          {(book?.blurb || film?.synopsis) && <p className="detail-description">{plainDescription(book?.blurb || film?.synopsis || '')}</p>}
          <PersonalComments comment={item.personalComment} />
          {current && <CurrentEditor category={book ? 'reading' : 'watching'} item={item} controller={current} tracks={[]} canEdit={canEdit} setNavigationGuard={setActiveGuard} />}
          {save && <OwnerEditor type={selection.kind} id={item.id} item={item} rating={book?.rating ?? film?.personalRating} importedRating={importedRating} canEdit={canEdit} save={save} setNavigationGuard={setNavigationGuard} />}
          <dl className="detail-metadata">
            {film?.director?.length ? <><dt>Directed by</dt><dd>{film.director.join(', ')}</dd></> : null}
            {film?.creator?.length ? <><dt>Created by</dt><dd>{film.creator.join(', ')}</dd></> : null}
            {book?.publisher && <><dt>Publisher</dt><dd>{book.publisher}</dd></>}
            <dt>Collection</dt><dd>{book ? bookStatus : screenStatus}</dd>
            {film?.dateRated && <><dt>Rated on</dt><dd>{film.dateRated}</dd></>}
          </dl>
          <div className="detail-links mono">
            {film?.imdbUrl && <a href={film.imdbUrl} target="_blank" rel="noreferrer">View on IMDb</a>}
            {book?.openLibraryId && <a href={`https://openlibrary.org${book.openLibraryId}`} target="_blank" rel="noreferrer">Open Library</a>}
            {book?.goodreadsId && <a href={`https://www.goodreads.com/book/show/${book.goodreadsId}`} target="_blank" rel="noreferrer">Goodreads</a>}
          </div>
          <nav className="detail-navigation" aria-label="Browse collection details"><button onClick={() => navigate(-1)}>Previous</button><span className="mono">{selection.index + 1} / {book ? books.length : screen.length}</span><button onClick={() => navigate(1)}>Next</button></nav>
        </div>
      </div>
      <p className="detail-key-hint mono">Esc to return · left / right to browse</p>
    </div>
  </div>, document.body);
}

function plainDescription(text: string) {
  return text.replace(/^\s*\[\d+\]:.*$/gm, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\[\d+\]/g, '$1').replace(/\(source\)/g, '').trim();
}
