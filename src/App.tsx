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
import { albums as importedAlbums, tracks as importedTracks } from './data/music';
import { VinylShelf, type AlbumSelection } from './components/music/VinylShelf';
import { AlbumDetail } from './components/music/AlbumDetail';
import { PlayingPanel } from './components/shared/ActiveObjects';
import { useCurrentlyActive } from './hooks/useCurrentlyActive';
import { useMusicCollection } from './hooks/useMusicCollection';
import { MusicManager } from './components/music/MusicManager';

const snapshot = savedOverrides.map(validateOverride);

export default function App() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [ownerAccess, setOwnerAccess] = useState(false);
  const [albumSelection, setAlbumSelection] = useState<AlbumSelection | null>(null);
  const [musicManager, setMusicManager] = useState(false);
  const archive = useArchive(importedBooks, importedScreen, archiveBackend, snapshot);
  const { books, screen } = archive;
  const music = useMusicCollection(importedAlbums, importedTracks, localEditing);
  const albums = useMemo(() => mergeAlbums(music.albums, archive.overrides), [music.albums, archive.overrides]);
  const tracks = music.tracks;
  const current = useCurrentlyActive(localEditing);
  const canEdit = localEditing && archive.editMode;
  return <>
    <main className="archive-scene" inert={selection || ownerAccess || albumSelection || musicManager ? true : undefined}>
      <div className="ambient-light" aria-hidden="true" />
      <PosterWall items={screen} onOpen={setSelection} arrangementReady={archive.overridesReady} currentId={current.active.watching?.screenId} />
      <div className="heading-scrim" aria-hidden="true" />
      <header className="scene-header text-center">
        <TypedTitle />
        {archive.loadError && <p className="archive-notice" role="status">{archive.loadError} <button onClick={archive.retryLoad}>Try again</button></p>}
      </header>
      <div className="collection-shelf">
        <section className="shelf-music" aria-label="Music collection">
          <PlayingPanel albums={albums} tracks={tracks} current={current} canEdit={canEdit} onOpen={setAlbumSelection} />
          <div className="album-browser"><VinylShelf albums={albums} currentId={current.active.playing?.albumId} onOpen={setAlbumSelection} />{canEdit && <button className="add-album-action text-button" disabled={!music.ready} onClick={() => setMusicManager(true)}>Add Album</button>}</div>
          {music.error && <p className="music-load-error" role="status">{music.error}</p>}
        </section>
        <BookShelf items={books} currentId={current.active.reading?.bookId} onOpen={setSelection} />
        <div className="shared-shelf-surface shelf-surface" aria-hidden="true" />
      </div>
      <div className="scene-guidance"><p className="favorite-legend">
        <span className="favorite-objects" aria-hidden="true"><span className="favorite-mini-frame" /><span className="favorite-mini-book" /></span>
        <span><strong>Personal favorites</strong><span className="favorite-legend-caption">& highly recommended</span></span>
      </p><p className="current-legend"><span className="current-objects" aria-hidden="true"><span>▤</span><span>▷</span><span>♫</span></span><span><strong>Currently reading, watching & playing</strong><span className="current-legend-caption">Purple marks the current selection</span></span></p><p className="visitor-guidance"><svg className="drag-icon" viewBox="0 0 42 24" fill="none" aria-hidden="true"><path d="M1 12h40M7 6l-6 6 6 6m28-12 6 6-6 6M17 3h8v18h-8z" stroke="currentColor" strokeWidth="1.2" /></svg><span className="pointer-guidance">Drag to explore · Select a title for details</span><span className="touch-guidance">Swipe to explore · Tap a title for details</span></p></div>
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
    {albumSelection && albums.some(album => album.id === albumSelection.id) && <AlbumDetail key={albumSelection.id} selection={albumSelection} albums={albums} tracks={tracks} canEdit={canEdit && music.ready} current={current} save={archive.save} onClose={() => setAlbumSelection(null)} onChange={setAlbumSelection} remove={async id => { await music.remove(id); current.forgetPlayingAlbum(id); setAlbumSelection(null); document.querySelector<HTMLButtonElement>('.add-album-action')?.focus(); }} />}
    {musicManager && canEdit && <MusicManager music={music} onClose={() => setMusicManager(false)} />}
    {ownerAccess && <OwnerAccess backend={archiveBackend} configurationError={configurationError} status={archive.ownerStatus} ownerError={archive.ownerError} editMode={archive.editMode} onEditMode={archive.setEditMode} recheckOwner={archive.recheckOwner} notesReady={archive.overridesReady} notesError={archive.loadError} retryNotes={archive.retryLoad} onClose={() => setOwnerAccess(false)} />}
  </>;
}
