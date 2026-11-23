import { useEffect, useRef, useState } from 'react';
import type { ActiveController } from '../../hooks/useCurrentlyActive';
import type { Book } from '../../data/books';
import type { ScreenTitle } from '../../data/screen';
import type { Album, MusicTrack } from '../../lib/musicTypes';
import type { Episode } from '../../lib/currentlyActive';
import { Artwork } from '../shared/Artwork';
import type { ActiveCategory } from '../../lib/currentlyActive';

export function CurrentEditor({ category, item, controller, tracks, canEdit, setNavigationGuard }: { category: ActiveCategory; item: Book | ScreenTitle | Album; controller: ActiveController; tracks: MusicTrack[]; canEdit: boolean; setNavigationGuard: (guard: (() => boolean) | null) => void }) {
  const saved = controller.active[category];
  const belongs = saved && ('bookId' in saved ? saved.bookId : 'screenId' in saved ? saved.screenId : saved.albumId) === item.id;
  const current = belongs ? saved : null;
  const [baseline, setBaseline] = useState(current), [draft, setDraft] = useState(current);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const pending = useRef(false);
  const dirty = JSON.stringify(baseline) !== JSON.stringify(draft);
  useEffect(() => {
    // Do not enqueue an identical draft reset after a confirmed save: it can
    // race the next user input, particularly an immediate clear/replace action.
    if (!dirty && !pending.current && JSON.stringify(baseline) !== JSON.stringify(current)) {
      setBaseline(current); setDraft(current);
    }
  }, [current, baseline, dirty]);
  useEffect(() => {
    setNavigationGuard(dirty || busy ? () => !pending.current && window.confirm('Discard unsaved current selection?') : null);
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    if (dirty) window.addEventListener('beforeunload', unload);
    return () => { setNavigationGuard(null); window.removeEventListener('beforeunload', unload); };
  }, [dirty, busy, setNavigationGuard]);
  const label = category === 'reading' ? 'Currently Reading' : category === 'watching' ? 'Currently Watching' : 'Currently Playing';
  const seed = () => category === 'reading' ? { bookId: item.id } : category === 'watching' ? { screenId: item.id } : { albumId: item.id };
  const update = (value: typeof draft) => { setDraft(value); setError(''); setMessage(''); };
  const reading = draft && 'bookId' in draft ? draft : null;
  const watching = draft && 'screenId' in draft ? draft : null;
  const playing = draft && 'albumId' in draft ? draft : null;
  const season = watching?.seasonNumber;
  const episodes = season === undefined ? [] : controller.episodes[`${item.id}:${season}`] ?? [];
  const episode = current && 'screenId' in current ? controller.episodes[`${item.id}:${current.seasonNumber}`]?.find(value => value.episodeNumber === current.episodeNumber) : undefined;
  if (!canEdit && !dirty && !busy) return belongs ? <div className="current-detail-note"><p className="mono">{label}</p>{current && 'bookId' in current && current.pageNumber && <p>Page {current.pageNumber}</p>}{current && 'screenId' in current && <><p>{current.episodeNumber !== undefined ? `Season ${current.seasonNumber} · Episode ${current.episodeNumber}` : 'No episode selected'}</p>{episode && <><h3>{episode.title}</h3><CurrentEpisodeArtwork episode={episode} item={item as ScreenTitle} /><p>{episode.description || 'Episode description unavailable.'}</p></>}</>}</div> : null;
  return <form className="owner-editor current-editor" aria-label={`Edit ${label}`} onSubmit={async event => {
    event.preventDefault(); if (pending.current || !canEdit) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try { const result = await controller.save(category, draft && 'bookId' in draft ? { bookId: draft.bookId, ...(draft.pageNumber ? { pageNumber: draft.pageNumber } : {}) } : draft); const value = result[category]; setBaseline(value); setDraft(value); setMessage('Current selection saved.'); }
    catch (error) { setError((error as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }}>
    <h3 className="mono">{label}</h3>
    <fieldset disabled={busy || !canEdit}>
      <label className="favorite-toggle"><input type="checkbox" checked={!!draft} onChange={event => update(event.target.checked ? seed() : null)} />{label}</label>
      {reading && <>
        <label>Current page<input type="number" min="1" max={'editionPageCount' in item ? item.editionPageCount : undefined} value={reading.pageNumber ?? ''} onChange={event => update({ ...reading, pageNumber: event.target.value ? Number(event.target.value) : undefined })} /></label>
      </>}
      {playing && <label>Song<select aria-label="Song" value={playing.trackId ?? ''} onChange={event => update({ ...playing, trackId: event.target.value || undefined })}><option value="">No song selected</option>{('trackIds' in item ? item.trackIds.flatMap(id => tracks.find(track => track.id === id && track.albumId === item.id) ?? []) : []).map(track => <option value={track.id} key={track.id}>{track.title}</option>)}</select></label>}
      {watching && 'type' in item && item.type === 'series' && <>
        <label>Season<input type="number" min="0" max={item.seasons} value={season ?? ''} onChange={event => update({ screenId: item.id, seasonNumber: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
        <button type="button" className="text-button" disabled={season === undefined} onClick={async () => {
          if (season === undefined || pending.current) return;
          pending.current = true; setBusy(true); setLoadingEpisodes(true); setError('');
          try { await controller.loadEpisodes(item.id, season); setMessage('Episodes loaded. Choose one, then save.'); } catch (error) { setError((error as Error).message); } finally { pending.current = false; setBusy(false); setLoadingEpisodes(false); }
        }}>Load episodes</button>
        <label>Episode<select aria-label="Episode" value={watching.episodeNumber ?? ''} onChange={event => update({ ...watching, episodeNumber: event.target.value ? Number(event.target.value) : undefined })}><option value="">No episode selected · series artwork</option>{episodes.map(episode => <option value={episode.episodeNumber} key={episode.episodeNumber}>{episode.episodeNumber}. {episode.title}</option>)}</select></label>
      </>}
      <p className="field-note">Saving replaces the previous selection in this category. Other categories stay active.</p>
    </fieldset>
    <div className="editor-actions"><button className="quiet-button" disabled={!dirty || busy || !canEdit}>{busy ? loadingEpisodes ? 'Loading episodes…' : 'Saving…' : 'Save current selection'}</button><button type="button" className="text-button" disabled={busy} onClick={() => update(baseline)}>Cancel</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}<p className="save-status" role="status">{busy ? 'Working…' : message}</p>
  </form>;
}

function CurrentEpisodeArtwork({ episode, item }: { episode: Episode; item: ScreenTitle }) {
  const [failed, setFailed] = useState<string[]>([]);
  const artwork = [episode.still, item.backdrop, item.poster].find(path => path && !failed.includes(path));
  return <>{artwork ? <img className="episode-picture" src={artwork} alt={artwork === episode.still ? `Still from ${episode.title}` : `${item.title} series artwork`} onError={() => setFailed(previous => [...previous, artwork])} /> : <div className="episode-picture"><Artwork title={item.title} subtitle="Artwork unavailable" /></div>}</>;
}
