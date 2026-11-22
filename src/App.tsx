import { useState } from 'react';
import { books } from './data/books';
import { screen } from './data/screen';
import { BookShelf } from './components/books/BookShelf';
import { PosterWall } from './components/screen/PosterWall';
import { TypedTitle } from './components/shared/TypedTitle';
import { DetailOverlay, type Selection } from './components/shared/DetailOverlay';

export default function App() {
  const [selection, setSelection] = useState<Selection | null>(null);
  return <>
    <main className="archive-scene" inert={selection ? true : undefined}>
      <div className="ambient-light" aria-hidden="true" />
      <div className="archive-mark" aria-hidden="true"><span /> <span /> <span /></div>
      <p className="corner-note mono">A collection, kept close.</p>
      <PosterWall items={screen} onOpen={setSelection} />
      <div className="heading-scrim" aria-hidden="true" />
      <header className="scene-header text-center">
        <p className="eyebrow mono">A personal archive</p>
        <TypedTitle />
        <p className="collection-count mono">{books.length} books <span>·</span> {screen.length} screen titles</p>
      </header>
      <BookShelf items={books} onOpen={setSelection} />
      <div className="scene-colophon"><span className="tiny-star" aria-hidden="true">✳</span><p>Some worlds stay with you.</p></div>
      <footer className="scene-footer">
        <span className="mono">Collected by Hoang</span>
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
    {selection && <DetailOverlay key={`${selection.kind}-${selection.index}`} selection={selection} books={books} screen={screen} onClose={() => setSelection(null)} onChange={setSelection} />}
  </>;
}
