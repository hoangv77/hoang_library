import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PersonalAlbum, PersonalScreenTitle } from '../../lib/personalization';
import type { MusicTrack } from '../../lib/musicTypes';
import type { Episode, ActiveCategory } from '../../lib/currentlyActive';
import type { ActiveController } from '../../hooks/useCurrentlyActive';
import type { AlbumSelection } from '../music/VinylShelf';
import { Artwork } from './Artwork';
import { useDialogFocus } from '../../hooks/useDialogFocus';

function Recovery({ category, controller, canEdit }: { category: ActiveCategory; controller: ActiveController; canEdit: boolean }) {
  return <div className="missing-current"><span>Saved selection unavailable</span>{canEdit && <button className="text-button" onClick={async () => { try { await controller.save(category, null); } catch (error) { window.alert((error as Error).message); } }}>Clear saved selection</button>}</div>;
}
export function PlayingPanel({ albums, tracks, current, canEdit, onOpen }: { albums: PersonalAlbum[]; tracks: MusicTrack[]; current: ActiveController; canEdit: boolean; onOpen: (selection: AlbumSelection) => void }) {
  const selection = current.active.playing, album = albums.find(item => item.id === selection?.albumId), track = tracks.find(item => item.albumId === album?.id && item.id === selection?.trackId);
  return <aside className="playing-panel" aria-label="Currently playing">
    <button className={`playing-cover ${album ? 'is-current' : ''}`} data-media-kind="album" data-media-id={album?.id} disabled={!album} aria-label={album ? `Open currently playing album ${album.title}` : 'No album selected'} onClick={event => album && onOpen({ id: album.id, rect: event.currentTarget.getBoundingClientRect(), element: event.currentTarget })}>{album ? <Artwork src={album.artwork} title={album.title} subtitle={album.artist} /> : <span className="record-placeholder" aria-hidden="true" />}</button>
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
