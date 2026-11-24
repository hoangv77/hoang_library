import type { PersonalAlbum } from '../../lib/personalization';
import { useHorizontalRail } from '../../hooks/useHorizontalRail';
import { Artwork } from '../shared/Artwork';

export type AlbumSelection = { id: string; rect: DOMRect; element: HTMLButtonElement };
export function VinylShelf({ albums, onOpen, currentId }: { albums: PersonalAlbum[]; currentId?: string; compact?: boolean; onOpen: (selection: AlbumSelection) => void }) {
  const loop = albums.length > 1;
  const { ref: rail, copies } = useHorizontalRail(loop);
  return <div className={`vinyl-bin ${albums.length > 1 ? 'has-more-albums' : ''}`} aria-label="Vinyl collection">
    {albums.length > 1 && <span className="vinyl-stack" aria-hidden="true"><i /><i /><i /></span>}
    <div className="vinyl-back" aria-hidden="true" />
    <div className="vinyl-rail horizontal-rail" data-snap-sleeves data-loop={loop || undefined} ref={rail} tabIndex={0} aria-label="Browse albums. Swipe, scroll, or use left and right arrow keys.">
      <div className="vinyl-row">{copies.map(copy => <div className="vinyl-segment" data-rail-segment data-rail-copy={copy} aria-hidden={copy !== 0 || undefined} key={copy}>{albums.map((album, index) => <button key={album.id} data-rail-step data-media-kind="album" data-media-id={album.id} className={`vinyl-target sleeve-${index % 4} ${album.id === currentId ? 'is-current' : ''} ${album.isFavorite ? 'is-favorite' : ''}`} tabIndex={copy !== 0 ? -1 : 0} aria-hidden={copy !== 0 || undefined} aria-label={`${album.title} by ${album.artist}${album.id === currentId ? ', currently playing' : ''}${album.isFavorite ? ', personal favorite' : ''}`} onClick={event => onOpen({ id: album.id, rect: event.currentTarget.getBoundingClientRect(), element: event.currentTarget })}>
        <span className="vinyl-sleeve"><Artwork src={album.artwork} title={album.title} subtitle={album.artist} /><span className="sleeve-glass" aria-hidden="true" /></span>
      </button>)}</div>)}</div>
      {!albums.length && <p className="empty-collection">No albums meet the import threshold yet.</p>}
    </div>
    <div className="vinyl-lip" aria-hidden="true" />
  </div>;
}
