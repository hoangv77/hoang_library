import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MusicController } from '../../hooks/useMusicCollection';
import type { AlbumRecord, AlbumSearchResult } from '../../lib/musicMembership';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { Artwork } from '../shared/Artwork';

export function MusicManager({ music, onClose }: { music: MusicController; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null); useDialogFocus(dialog);
  const [title, setTitle] = useState(''), [artist, setArtist] = useState(''), [year, setYear] = useState(''), [artwork, setArtwork] = useState(''), [trackText, setTrackText] = useState('');
  const [metadata, setMetadata] = useState<AlbumRecord | null>(null), [results, setResults] = useState<AlbumSearchResult[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const pending = useRef(false);
  const dirty = !!(title || artist || year || artwork || trackText || metadata);
  const close = () => { if (!pending.current && (!dirty || window.confirm('Discard this unsaved album?'))) onClose(); };
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (!event.defaultPrevented && event.key === 'Escape') { event.preventDefault(); close(); } };
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('keydown', key); if (dirty) window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('beforeunload', unload); };
  });
  async function run(task: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setStatus('');
    try { await task(); } catch (error) { setError((error as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  return createPortal(<div className="owner-overlay music-manager-overlay"><div className="owner-backdrop" onClick={close} aria-hidden="true" /><div className="owner-dialog music-manager" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="music-manager-title" tabIndex={-1}>
    <button className="owner-close" aria-label="Close album manager" disabled={busy} onClick={close}>×</button>
    <p className="eyebrow mono">Your record collection</p><h2 id="music-manager-title">Add an album</h2>
    <form onSubmit={event => { event.preventDefault(); void run(async () => { const found = await music.search(title, artist); setResults(found); setStatus(found.length ? 'Choose the matching album, or continue with manual entry.' : 'No matching albums found. You can enter the details manually below.'); }); }}>
      <fieldset disabled={busy}><label>Album title<input required maxLength={300} value={title} onChange={event => { setTitle(event.target.value); setMetadata(null); }} /></label><label>Artist<input required maxLength={300} value={artist} onChange={event => { setArtist(event.target.value); setMetadata(null); }} /></label><button className="quiet-button" type="submit">Search albums</button></fieldset>
    </form>
    {results.length > 0 && <ul className="album-search-results" aria-label="Album search results">{results.map(result => <li key={result.id}><button aria-label={`Select ${result.title} by ${result.artist}`} disabled={busy} onClick={() => void run(async () => {
      const record = await music.resolve(result.id); setMetadata(record); setTitle(record.album.title); setArtist(record.album.artist); setYear(record.album.year ? String(record.album.year) : ''); setArtwork(''); setTrackText(record.album.trackIds.flatMap(id => record.tracks.find(track => track.id === id)?.title ?? []).join('\n')); setStatus('Album details loaded. Review them, then save.');
    })}><strong>{result.title}</strong><span>{[result.artist, result.year, result.type].filter(Boolean).join(' · ')}</span></button></li>)}</ul>}
    {metadata && <div className="album-search-preview"><Artwork src={metadata.album.artwork} title={metadata.album.title} subtitle={metadata.album.artist} /><p className="field-note">{metadata.album.tracklistSource === 'verified' ? 'Verified release tracklist loaded.' : 'A complete tracklist is unavailable. Add only tracks you know below.'}</p></div>}
    <form className="manual-album-form" aria-label="Save album to collection" onSubmit={event => { event.preventDefault(); void run(async () => {
      await music.add({ title, artist, ...(year ? { year: Number(year) } : {}), ...(artwork ? { artwork } : {}), ...(metadata ? { metadataId: metadata.album.musicbrainzId } : {}), trackTitles: trackText.split(/\r?\n/).map(line => line.trim()).filter(Boolean) });
      onClose();
    }); }}>
      <fieldset disabled={busy}><p className="field-note">Search is optional. You can also enter an album manually; no listening threshold applies.</p><label>Release year<input type="number" min="1000" max="9999" value={year} onChange={event => setYear(event.target.value)} /></label><label>Local cover image<input placeholder="/album-images/my-album.webp" value={artwork} onChange={event => setArtwork(event.target.value)} /></label><p className="field-note">Optional: place your image in public/album-images, then enter its /album-images/ filename.</p><label>Known tracks, one per line<textarea rows={5} maxLength={40000} value={trackText} onChange={event => setTrackText(event.target.value)} /></label><p className="field-note">Leave blank if unknown. Edited tracklists are labeled owner-provided.</p><button className="quiet-button" disabled={!title.trim() || !artist.trim()} type="submit">Save album</button></fieldset>
    </form>
    {busy && <p className="save-status" role="status">Working…</p>}{status && <p className="save-status" role="status">{status}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    {music.state.excluded.length > 0 && <section className="removed-albums" aria-label="Removed albums"><h3 className="mono">Removed albums</h3><ul>{music.state.excluded.map(record => <li key={record.album.id}><span>{record.album.title}<small>{record.album.artist}</small></span><button className="text-button" disabled={busy} onClick={() => void run(async () => { await music.restore(record.album.id); setStatus(`${record.album.title} restored. Its saved ratings and comments are preserved.`); })}>Restore</button></li>)}</ul></section>}
  </div></div>, document.body);
}
