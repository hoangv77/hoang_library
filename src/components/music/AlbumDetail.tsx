import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AlbumSelection } from './VinylShelf';
import type { PersonalAlbum, MediaOverride } from '../../lib/personalization';
import type { MusicTrack } from '../../lib/musicTypes';
import type { ActiveController } from '../../hooks/useCurrentlyActive';
import { useObjectFlight } from '../../hooks/useObjectFlight';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { Artwork } from '../shared/Artwork';
import { BookRating } from '../shared/BookRating';
import { PersonalComments } from '../shared/PersonalComments';
import { OwnerEditor } from '../owner/OwnerEditor';
import { CurrentEditor } from '../owner/CurrentEditor';
import { ConfirmAlbumRemoval } from './ConfirmAlbumRemoval';

export function AlbumDetail({ selection, albums, tracks, canEdit, current, save, onClose, onChange, remove }: { selection: AlbumSelection; albums: PersonalAlbum[]; tracks: MusicTrack[]; canEdit: boolean; current: ActiveController; save: (value: MediaOverride) => Promise<MediaOverride>; onClose: () => void; onChange: (selection: AlbumSelection) => void; remove?: (id: string) => Promise<void> }) {
  const album = albums.find(item => item.id === selection.id)!;
  const dialog = useRef<HTMLDivElement>(null);
  const { art, out, closing, close: flyHome } = useObjectFlight('album', album.id, selection.element, onClose);
  const [removing, setRemoving] = useState(false), [removeError, setRemoveError] = useState('');
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const removalPending = useRef(false);
  const ownerGuard = useRef<(() => boolean) | null>(null), activeGuard = useRef<(() => boolean) | null>(null);
  const setOwnerGuard = useCallback((guard: (() => boolean) | null) => { ownerGuard.current = guard; }, []);
  const setActiveGuard = useCallback((guard: (() => boolean) | null) => { activeGuard.current = guard; }, []);
  const mayLeave = () => !removalPending.current && (!ownerGuard.current || ownerGuard.current()) && (!activeGuard.current || activeGuard.current());
  const close = () => {
    if (closing || confirmRemoval || !mayLeave()) return;
    flyHome();
  };
  const navigate = (step: number) => { if (!closing && mayLeave()) onChange({ ...selection, id: albums[(albums.indexOf(album) + step + albums.length) % albums.length].id }); };
  useDialogFocus(dialog, false);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || confirmRemoval) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[role="radiogroup"]')) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  const indexed = new Map(tracks.map(track => [track.id, track]));
  const verified = new Set(album.verifiedTrackIds ?? []);
  const list = (ids: string[]) => <ol className="album-tracks">{ids.flatMap(id => {
    const track = indexed.get(id); if (!track) return [];
    const duration = track.durationMs ? `${Math.floor(track.durationMs / 60000)}:${String(Math.floor(track.durationMs / 1000) % 60).padStart(2, '0')}` : '';
    return [<li key={id}><span>{track.discNumber && track.discNumber > 1 ? `${track.discNumber}.` : ''}{track.trackNumber ?? '—'}</span><strong>{track.title}</strong><small>{duration}</small></li>];
  })}</ol>;
  return createPortal(<div className={`detail-overlay ${out ? 'is-out' : ''} ${closing ? 'is-closing' : ''}`}>
    <div className="detail-backdrop" onClick={close} aria-hidden="true" />
    <div className="detail-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="album-title" tabIndex={-1} inert={confirmRemoval || undefined}>
      <button className="close-detail mono" onClick={close}><span aria-hidden="true">×</span> Close</button>
      <div className="detail-layout album-layout">
        <div ref={art} className={`detail-art detail-album ${album.isFavorite ? 'is-favorite' : ''} ${current.active.playing?.albumId === album.id ? 'is-current' : ''}`}><Artwork src={album.artwork} title={album.title} subtitle={album.artist} eager /><span className="object-depth object-side" aria-hidden="true" /><span className="object-depth object-right" aria-hidden="true" /><span className="object-depth object-top" aria-hidden="true" /><span className="object-back" aria-hidden="true" /></div>
        <div className="detail-copy"><p className="eyebrow mono">From the record bin</p>{album.isFavorite && <p className="favorite-label mono">Personal favorite</p>}<h2 id="album-title">{album.title}</h2><p className="detail-author">{album.artist}</p>
          <p className="detail-facts mono">{[album.year, ...album.genres].filter(Boolean).join(' · ')}</p>
          <div className="detail-ratings"><div><span className="mono">My rating</span><strong><BookRating rating={album.personalRating} /></strong></div></div>
          <PersonalComments comment={album.personalComment} />
          <CurrentEditor category="playing" item={album} controller={current} tracks={tracks} canEdit={canEdit} setNavigationGuard={setActiveGuard} />
          <OwnerEditor type="album" id={album.id} item={album} rating={album.personalRating} canEdit={canEdit} save={save} setNavigationGuard={setOwnerGuard} />
          <h3 className="tracklist-heading mono">{album.tracklistSource === 'verified' ? 'Verified release tracklist' : album.tracklistSource === 'provided' ? 'Owner-provided tracks' : album.origin === 'manual' ? 'Known tracks' : 'Tracks observed in the export'}</h3>
          {list(album.tracklistSource === 'verified' ? album.verifiedTrackIds ?? [] : album.trackIds)}
          {album.tracklistSource === 'verified' && album.trackIds.some(id => !verified.has(id)) && <><h3 className="tracklist-heading mono">Additional observed tracks</h3>{list(album.trackIds.filter(id => !verified.has(id)))}</>}
          {album.metadataStatus !== 'resolved' && <p className="field-note">{album.metadataStatus === 'ambiguous' ? 'Metadata matches were ambiguous.' : 'Complete album metadata could not be verified.'} {album.origin === 'manual' ? 'Only known or owner-provided tracks are shown.' : 'Only observed tracks are shown.'}</p>}
          {album.musicbrainzId && <p className="detail-links mono"><a href={`https://musicbrainz.org/release-group/${album.musicbrainzId}`} target="_blank" rel="noreferrer">MusicBrainz</a></p>}
          {canEdit && remove && <div className="album-removal"><button className="text-button" disabled={removing} onClick={() => { if (mayLeave()) { setRemoveError(''); setConfirmRemoval(true); } }}>Remove from collection</button></div>}
          <nav className="detail-navigation" aria-label="Browse album details"><button onClick={() => navigate(-1)}>Previous</button><span className="mono">{albums.indexOf(album) + 1} / {albums.length}</span><button onClick={() => navigate(1)}>Next</button></nav>
        </div>
      </div>
    </div>
    {confirmRemoval && remove && <ConfirmAlbumRemoval title={album.title} busy={removing} error={removeError} onCancel={() => setConfirmRemoval(false)} onConfirm={async () => {
      if (removalPending.current) return;
      removalPending.current = true; setRemoving(true); setRemoveError('');
      try { await remove(album.id); } catch (error) { setRemoveError((error as Error).message); } finally { removalPending.current = false; setRemoving(false); }
    }} />}
  </div>, document.body);
}
