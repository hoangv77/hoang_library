import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { PersonalAlbum, PersonalBook, PersonalScreenTitle } from '../../lib/personalization';
import type { MusicTrack } from '../../lib/musicTypes';
import type { Episode, ActiveCategory } from '../../lib/currentlyActive';
import type { ActiveController } from '../../hooks/useCurrentlyActive';
import type { Selection } from './DetailOverlay';
import type { AlbumSelection } from '../music/VinylShelf';
import { Artwork } from './Artwork';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { faceFont } from '../books/bookFaces';

function Recovery({ category, controller, canEdit }: { category: ActiveCategory; controller: ActiveController; canEdit: boolean }) {
  return <div className="missing-current"><span>Saved selection unavailable</span>{canEdit && <button className="text-button" onClick={async () => { try { await controller.save(category, null); } catch (error) { window.alert((error as Error).message); } }}>Clear saved selection</button>}</div>;
}
export function ReadingStand({ books, current, canEdit, onOpen }: { books: PersonalBook[]; current: ActiveController; canEdit: boolean; onOpen: (selection: Selection) => void }) {
  const selection = current.active.reading, index = books.findIndex(book => book.id === selection?.bookId), book = books[index];
  const [opening, setOpening] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), pending = useRef(false);
  useEffect(() => { clearTimeout(timer.current); pending.current = false; setOpening(false); return () => clearTimeout(timer.current); }, [book?.id]);
  const style = { '--read-case': book?.spine ?? '#73786e', '--read-ink': book?.ink ?? '#eee8dc', '--read-accent': book?.band ?? book?.ink ?? '#a6a99b', '--read-thickness': `${book ? Math.max(7, Math.min(15, book.width * .24)) : 7}px`, '--read-height': `${book ? Math.round(book.height * .63) : 120}px`, '--read-width': `${book ? Math.round(book.height * .42) : 174}px`, '--read-wear': book?.wear ?? .12, fontFamily: book ? faceFont[book.face] : undefined } as CSSProperties;
  return <aside className="reading-stand" aria-label="Currently reading">
    <p className="active-label mono">Currently Reading</p>
    <button className={`reading-book ${book ? 'has-book' : 'is-empty'} ${book?.finish ?? 'cloth'} ${opening ? 'is-opening' : ''}`} style={style} disabled={!book || opening} aria-haspopup={book ? 'dialog' : undefined} aria-busy={opening || undefined} aria-label={book ? `Currently reading ${book.title}, ${selection?.pageNumber ? 'page ' + selection.pageNumber : 'page unspecified'}` : 'Not currently reading'} onClick={event => {
      if (!book || pending.current) return;
      const target = { kind: 'book' as const, index, rect: event.currentTarget.getBoundingClientRect(), element: event.currentTarget };
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onOpen(target); return; }
      pending.current = true; setOpening(true);
      timer.current = setTimeout(() => { onOpen(target); setOpening(false); pending.current = false; }, 480);
    }}>
      <span className="reading-book-body">
        {book ? <>
          <span className="read-backboard" /><span className="read-page-edge fore" /><span className="read-page-edge head" /><span className="read-page-edge tail" />
          <span className="read-inner-paper" /><span className="read-center-binding" />
          <span className="read-spine" aria-hidden="true"><span>{book.title}</span></span>
          <span className="read-front-cover"><Artwork src={book.cover} title={book.title} subtitle={book.author} /><span className="read-cover-material" /><span className="read-cover-wear" /></span>
          <span className="read-headband" aria-hidden="true" />
        </> : <span className="read-open-hardcover" aria-hidden="true"><span className="read-empty-case left" /><span className="read-empty-case right" /><span className="read-open-pages left" /><span className="read-open-pages right" /><span className="read-center-binding" /></span>}
      </span>
    </button>
    <div className="reading-cradle" aria-hidden="true"><span /><span /></div>
    {book ? <p className="active-title">{book.title}</p> : !selection && <p className="reading-empty-label">Not currently reading</p>}
    {book && <p className="active-subtitle">{book.author}{selection?.pageNumber ? ` · Page ${selection.pageNumber}` : ''}</p>}
    {!book && <p className="illustration-note">Blank-page illustration</p>}
    {selection && !book && <Recovery category="reading" controller={current} canEdit={canEdit} />}
  </aside>;
}
export function WatchingTV({ screen, current, canEdit, onOpen, onEpisode, duplicate = false }: { screen: PersonalScreenTitle[]; current: ActiveController; canEdit: boolean; onOpen: (selection: Selection) => void; onEpisode: (episode: Episode, element: HTMLButtonElement) => void; duplicate?: boolean }) {
  const selection = current.active.watching, index = screen.findIndex(item => item.id === selection?.screenId), item = screen[index];
  const episode = selection && current.episodes[`${selection.screenId}:${selection.seasonNumber}`]?.find(episode => episode.episodeNumber === selection.episodeNumber);
  const [failed, setFailed] = useState<string[]>([]);
  const artwork = [episode?.still, item?.backdrop, item?.poster].find(path => path && !failed.includes(path));
  const episodeStill = !!artwork && artwork === episode?.still;
  return <aside className="watching-object" aria-label="Currently watching" aria-hidden={duplicate || undefined}><p className="active-label mono">Currently Watching</p>
    <button className="television" tabIndex={duplicate ? -1 : 0} disabled={!item} aria-label={item ? `Currently watching ${item.title}${episode ? ', ' + episode.title : ''}` : 'No screen title selected'} onClick={event => episode ? onEpisode(episode, event.currentTarget) : onOpen({ kind: 'screen', index, rect: event.currentTarget.getBoundingClientRect(), element: event.currentTarget })}>
      <span className="tv-screen">{artwork ? <img src={artwork} onError={() => setFailed(previous => [...previous, artwork])} alt={episodeStill ? `Still from ${episode!.title}` : `${item.title} artwork`} /> : <span className="tv-off" />}</span>
    </button>
    <p className="active-title">{episode?.title || item?.title || (selection ? '' : 'No title selected')}</p>
    {item && <p className="active-subtitle">{selection?.episodeNumber !== undefined ? `S${selection.seasonNumber} · E${selection.episodeNumber} · ` : ''}{!artwork ? 'Artwork unavailable' : episodeStill ? 'Episode still' : item.type === 'series' ? 'Series artwork' : 'Movie artwork'}{selection?.episodeNumber !== undefined && !episode ? ' · Episode metadata unavailable' : ''}</p>}
    {selection && !item && <Recovery category="watching" controller={current} canEdit={canEdit && !duplicate} />}
  </aside>;
}
export function PlayingPanel({ albums, tracks, current, canEdit, onOpen }: { albums: PersonalAlbum[]; tracks: MusicTrack[]; current: ActiveController; canEdit: boolean; onOpen: (selection: AlbumSelection) => void }) {
  const selection = current.active.playing, album = albums.find(item => item.id === selection?.albumId), track = tracks.find(item => item.albumId === album?.id && item.id === selection?.trackId);
  return <aside className="playing-panel" aria-label="Currently playing">
    <button className="playing-cover" disabled={!album} aria-label={album ? `Open currently playing album ${album.title}` : 'No album selected'} onClick={event => album && onOpen({ id: album.id, rect: event.currentTarget.getBoundingClientRect(), element: event.currentTarget })}>{album ? <Artwork src={album.artwork} title={album.title} subtitle={album.artist} /> : <span className="record-placeholder" aria-hidden="true" />}</button>
    <div className="playing-copy"><p className="active-label mono">Currently Playing</p><p className="playing-song">{album ? track?.title || (selection?.trackId ? 'Saved song unavailable' : 'No song selected') : selection ? 'Saved album unavailable' : 'Nothing selected'}</p>{album && <><p className="active-subtitle">{album.artist}</p><p className="playing-album">{album.title}</p></>}<span className="music-indicator" aria-hidden="true"><i /><i /><i /><i /><i /></span>{selection && !album && <Recovery category="playing" controller={current} canEdit={canEdit} />}</div>
  </aside>;
}
export function EpisodeDetail({ episode, screen, onClose, onParent }: { episode: Episode; screen: PersonalScreenTitle; onClose: () => void; onParent: () => void }) {
  const dialog = useRef<HTMLDivElement>(null); useDialogFocus(dialog);
  const [failed, setFailed] = useState<string[]>([]);
  const artwork = [episode.still, screen.backdrop, screen.poster].find(path => path && !failed.includes(path));
  const episodeStill = !!artwork && artwork === episode.still;
  useEffect(() => { const key = (event: KeyboardEvent) => { if (!event.defaultPrevented && event.key === 'Escape') { event.preventDefault(); onClose(); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [onClose]);
  return createPortal(<div className="detail-overlay is-out"><div className="detail-backdrop" onClick={onClose} /><div className="detail-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="episode-title" tabIndex={-1}><button className="close-detail mono" onClick={onClose}>× Close</button><div className="episode-layout">{artwork ? <img className="episode-picture" src={artwork} alt={episodeStill ? `Still from ${episode.title}` : `${screen.title} series artwork`} onError={() => setFailed(previous => [...previous, artwork])} /> : <Artwork title={screen.title} subtitle="Artwork unavailable" />}<p className="field-note">{episodeStill ? 'Episode still' : artwork ? 'Series artwork · episode still unavailable' : 'Artwork unavailable'}</p><p className="eyebrow mono">{screen.title} · Season {episode.seasonNumber} · Episode {episode.episodeNumber}</p><h2 id="episode-title">{episode.title}</h2><p>{episode.description || 'Episode description unavailable.'}</p>{episode.airDate && <p className="detail-facts mono">Aired {episode.airDate}</p>}<button className="text-button" onClick={onParent}>View parent series</button></div></div></div>, document.body);
}
