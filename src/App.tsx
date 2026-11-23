import { useMemo, useState } from 'react';
import { books as importedBooks } from './data/books';
import { screen as importedScreen } from './data/screen';
import { BookShelf } from './components/books/BookShelf';
import { PosterWall } from './components/screen/PosterWall';
import { TypedTitle } from './components/shared/TypedTitle';
import { DetailOverlay, type Selection } from './components/shared/DetailOverlay';
import { useArchive } from './hooks/useArchive';
import { archiveBackend, configurationError, localEditing } from './lib/supabase';
import { OwnerAccess } from './components/owner/OwnerAccess';
import savedOverrides from './data/personal-overrides.json';
import { mergeAlbums, validateOverride } from './lib/personalization';
import { albums as importedAlbums, tracks } from './data/music';
import { VinylShelf, type AlbumSelection } from './components/music/VinylShelf';
import { AlbumDetail } from './components/music/AlbumDetail';
import { ReadingStand, WatchingTV, PlayingPanel, EpisodeDetail } from './components/shared/ActiveObjects';
import { useCurrentlyActive } from './hooks/useCurrentlyActive';
import type { Episode } from './lib/currentlyActive';

const snapshot = savedOverrides.map(validateOverride);

export default function App() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [ownerAccess, setOwnerAccess] = useState(false);
  const [albumSelection, setAlbumSelection] = useState<AlbumSelection | null>(null);
  const [episodeSelection, setEpisodeSelection] = useState<{ episode: Episode; element: HTMLButtonElement } | null>(null);
  const archive = useArchive(importedBooks, importedScreen, archiveBackend, snapshot);
  const { books, screen } = archive;
  const albums = useMemo(() => mergeAlbums(importedAlbums, archive.overrides), [archive.overrides]);
  const current = useCurrentlyActive(localEditing);
  const canEdit = localEditing && archive.editMode;
  return <>
    <main className="archive-scene" inert={selection || ownerAccess || albumSelection || episodeSelection ? true : undefined}>
      <div className="ambient-light" aria-hidden="true" />
      <div className="archive-mark" aria-hidden="true"><span /> <span /> <span /></div>
      <PosterWall items={screen} onOpen={setSelection} arrangementReady={archive.overridesReady} />
      <div className="heading-scrim" aria-hidden="true" />
      <header className="scene-header text-center">
        <TypedTitle />
        {archive.loadError && <p className="archive-notice" role="status">{archive.loadError} <button onClick={archive.retryLoad}>Try again</button></p>}
      </header>
      <WatchingTV screen={screen} current={current} canEdit={canEdit} onOpen={setSelection} onEpisode={(episode, element) => setEpisodeSelection({ episode, element })} />
      <div className="book-stage"><BookShelf items={books} onOpen={setSelection} /><ReadingStand books={books} current={current} canEdit={canEdit} onOpen={setSelection} /></div>
      <section className="music-stage" aria-label="Music collection"><VinylShelf albums={albums} onOpen={setAlbumSelection} /><PlayingPanel albums={albums} tracks={tracks} current={current} canEdit={canEdit} onOpen={setAlbumSelection} /></section>
      <div className="scene-guidance"><p className="favorite-legend">
        <span className="favorite-objects" aria-hidden="true"><span className="favorite-mini-frame" /><span className="favorite-mini-book" /></span>
        <span><strong>Personal favorites</strong><span className="favorite-legend-caption">& highly recommended</span></span>
      </p><p className="visitor-guidance"><svg className="drag-icon" viewBox="0 0 42 24" fill="none" aria-hidden="true"><path d="M1 12h40M7 6l-6 6 6 6m28-12 6 6-6 6M17 3h8v18h-8z" stroke="currentColor" strokeWidth="1.2" /></svg><span className="pointer-guidance">Drag to explore · Select a title for details</span><span className="touch-guidance">Swipe to explore · Tap a title for details</span></p></div>
      {current.error && <p className="current-load-error" role="status">{current.error} Reload the page to retry.</p>}
      <footer className="scene-footer">
        {archive.editMode && <span className="edit-mode-indicator mono" role="status">{localEditing ? 'Local edit mode · Saves to file' : 'Edit mode'}</span>}
        {localEditing
          ? <button className="owner-access-link mono" disabled={!archive.overridesReady || archive.ownerStatus !== 'owner'} onClick={() => archive.setEditMode(!archive.editMode)}>{archive.editMode ? 'Finish editing' : 'Edit collection'}</button>
          : <button className="owner-access-link mono" onClick={() => setOwnerAccess(true)}>Owner access</button>}
        {localEditing && archive.ownerStatus === 'error' && <button className="owner-access-link mono" onClick={archive.recheckOwner}>Retry local access</button>}
        <details className="credits">
          <summary className="mono">Notes & credits</summary>
          <div className="credits-content">
            <p>Books, films, television and records. Collection history comes from Goodreads, IMDb and a Last.fm export. Currently active media is selected manually.</p>
            <p>Book metadata and covers via <a href="https://openlibrary.org" target="_blank" rel="noreferrer">Open Library</a>. Screen metadata and artwork via <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer"><img src="/tmdb-logo.svg" alt="TMDB" width="82" height="12" /></a>.</p>
            <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
            <p>Music metadata via <a href="https://musicbrainz.org" target="_blank" rel="noreferrer">MusicBrainz</a> and covers via <a href="https://coverartarchive.org" target="_blank" rel="noreferrer">Cover Art Archive</a>. Scrobbles represent only the supplied export.</p>
          </div>
        </details>
      </footer>
    </main>
    {selection && <DetailOverlay key={`${selection.kind}-${selection.index}`} selection={selection} books={books} screen={screen} onClose={() => setSelection(null)} onChange={setSelection} canEdit={canEdit} current={current} save={archive.save} importedRating={selection.kind === 'book' ? importedBooks[selection.index]?.rating : importedScreen[selection.index]?.personalRating} />}
    {albumSelection && <AlbumDetail key={albumSelection.id} selection={albumSelection} albums={albums} tracks={tracks} canEdit={canEdit} current={current} save={archive.save} onClose={() => setAlbumSelection(null)} onChange={setAlbumSelection} />}
    {episodeSelection && <EpisodeDetail episode={episodeSelection.episode} screen={screen.find(item => item.id === episodeSelection.episode.screenId)!} onClose={() => setEpisodeSelection(null)} onParent={() => { setSelection({ kind: 'screen', index: screen.findIndex(item => item.id === episodeSelection.episode.screenId), element: episodeSelection.element, rect: episodeSelection.element.getBoundingClientRect() }); setEpisodeSelection(null); }} />}
    {ownerAccess && <OwnerAccess backend={archiveBackend} configurationError={configurationError} status={archive.ownerStatus} ownerError={archive.ownerError} editMode={archive.editMode} onEditMode={archive.setEditMode} recheckOwner={archive.recheckOwner} notesReady={archive.overridesReady} notesError={archive.loadError} retryNotes={archive.retryLoad} onClose={() => setOwnerAccess(false)} />}
  </>;
}
