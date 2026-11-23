import type { PersonalAlbum } from '../../lib/personalization';
import { advanceRail, useHorizontalRail } from '../../hooks/useHorizontalRail';
import { Artwork } from '../shared/Artwork';

export type AlbumSelection = { id: string; rect: DOMRect; element: HTMLButtonElement };
export function VinylShelf({ albums, onOpen, currentId }: { albums: PersonalAlbum[]; currentId?: string; onOpen: (selection: AlbumSelection) => void }) {
  const loop = albums.length > 12;
  const rail = useHorizontalRail(loop);
  return <div className={`vinyl-bin ${albums.length > 1 ? 'has-more-albums' : ''}`} aria-label="Vinyl collection">
    <div className="vinyl-back" aria-hidden="true" />
    <div className="vinyl-rail horizontal-rail" data-snap-sleeves ref={rail} tabIndex={0} aria-label="Browse albums. Swipe, scroll, or use left and right arrow keys.">
      <div className="vinyl-row">{(loop ? [0, 1, 2] : [0]).map(copy => <div className="vinyl-segment" data-rail-segment key={copy}>{albums.map((album, index) => <button key={album.id} data-rail-step data-media-kind="album" data-media-id={album.id} className={`vinyl-target sleeve-${index % 4} ${album.id === currentId ? 'is-current' : ''} ${album.isFavorite ? 'is-favorite' : ''}`} tabIndex={loop && copy !== 1 ? -1 : 0} aria-hidden={loop && copy !== 1 ? true : undefined} aria-label={`${album.title} by ${album.artist}${album.id === currentId ? ', currently playing' : ''}${album.isFavorite ? ', personal favorite' : ''}`} onClick={event => onOpen({ id: album.id, rect: event.currentTarget.getBoundingClientRect(), element: event.currentTarget })}>
        <span className="vinyl-sleeve"><Artwork src={album.artwork} title={album.title} subtitle={album.artist} /><span className="sleeve-glass" aria-hidden="true" /></span>
      </button>)}</div>)}</div>
      {!albums.length && <p className="empty-collection">No albums meet the import threshold yet.</p>}
    </div>
    <div className="vinyl-lip" aria-hidden="true" />
    {albums.length > 1 && <><button className="vinyl-browse previous" aria-label="Previous album" onClick={() => rail.current && advanceRail(rail.current, -1)}><svg viewBox="0 0 12 20" fill="none" aria-hidden="true"><path d="m8 5-5 5 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button><button className="vinyl-browse next" aria-label="Next album" onClick={() => rail.current && advanceRail(rail.current, 1)}><svg viewBox="0 0 12 20" fill="none" aria-hidden="true"><path d="m4 5 5 5-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button></>}
  </div>;
}
