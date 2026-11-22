import { useState } from 'react';
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
import { validateOverride } from './lib/personalization';

const snapshot = savedOverrides.map(validateOverride);

export default function App() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [ownerAccess, setOwnerAccess] = useState(false);
  const archive = useArchive(importedBooks, importedScreen, archiveBackend, snapshot);
  const { books, screen } = archive;
  return <>
    <main className="archive-scene" inert={selection || ownerAccess ? true : undefined}>
      <div className="ambient-light" aria-hidden="true" />
      <div className="archive-mark" aria-hidden="true"><span /> <span /> <span /></div>
      <PosterWall items={screen} onOpen={setSelection} arrangementReady={archive.overridesReady} />
      <div className="heading-scrim" aria-hidden="true" />
      <header className="scene-header text-center">
        <TypedTitle />
        <p className="collection-count mono">{books.length} books <span>·</span> {screen.length} screen titles</p>
        <p className="visitor-guidance"><span className="pointer-guidance">Drag to explore · Select a title for details & personal comments</span><span className="touch-guidance">Swipe to explore · Tap for details & personal comments</span></p>
        {archive.loadError && <p className="archive-notice" role="status">{archive.loadError} <button onClick={archive.retryLoad}>Try again</button></p>}
      </header>
      <BookShelf items={books} onOpen={setSelection} />
      <p className="favorite-legend">
        <span className="favorite-objects" aria-hidden="true"><span className="favorite-mini-frame" /><span className="favorite-mini-book" /></span>
        <span><strong>Personal favorites</strong><span className="favorite-legend-caption">& highly recommended</span></span>
      </p>
      <footer className="scene-footer">
        {archive.editMode && <span className="edit-mode-indicator mono" role="status">{localEditing ? 'Local edit mode · Saves to file' : 'Edit mode'}</span>}
        {localEditing
          ? <button className="owner-access-link mono" disabled={!archive.overridesReady || archive.ownerStatus !== 'owner'} onClick={() => archive.setEditMode(!archive.editMode)}>{archive.editMode ? 'Finish editing' : 'Edit collection'}</button>
          : <button className="owner-access-link mono" onClick={() => setOwnerAccess(true)}>Owner access</button>}
        {localEditing && archive.ownerStatus === 'error' && <button className="owner-access-link mono" onClick={archive.recheckOwner}>Retry local access</button>}
        <details className="credits">
          <summary className="mono">Notes & credits</summary>
          <div className="credits-content">
            <p>Books read and in progress, alongside a collection of films and television. Personal ratings and dates come from Goodreads and IMDb exports.</p>
            <p>Book metadata and covers via <a href="https://openlibrary.org" target="_blank" rel="noreferrer">Open Library</a>. Screen metadata and artwork via <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer"><img src="/tmdb-logo.svg" alt="TMDB" width="82" height="12" /></a>.</p>
            <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
          </div>
        </details>
      </footer>
    </main>
    {selection && <DetailOverlay key={`${selection.kind}-${selection.index}`} selection={selection} books={books} screen={screen} onClose={() => setSelection(null)} onChange={setSelection} canEdit={archive.editMode} save={archive.save} importedRating={selection.kind === 'book' ? importedBooks[selection.index]?.rating : importedScreen[selection.index]?.personalRating} />}
    {ownerAccess && <OwnerAccess backend={archiveBackend} configurationError={configurationError} status={archive.ownerStatus} ownerError={archive.ownerError} editMode={archive.editMode} onEditMode={archive.setEditMode} recheckOwner={archive.recheckOwner} notesReady={archive.overridesReady} notesError={archive.loadError} retryNotes={archive.retryLoad} onClose={() => setOwnerAccess(false)} />}
  </>;
}
