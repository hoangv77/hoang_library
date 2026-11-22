# Between pages and screens

A single scene for Hoang's personal library and screen collection. React 19,
TypeScript, Tailwind CSS 4, Vite, and CSS 3D transforms. All collection metadata
is generated ahead of time; the browser makes no metadata API requests.

## Run locally

Use Node.js 22.12+ (Node 24 recommended).

```powershell
npm ci
npm run dev
```

Open the printed localhost URL. Build a static deployment with `npm run build`;
`dist/` can be served by any static host. `npm run preview` serves that build.
There is no backend, database, authentication, search, or tracking.

## Update the collection

Keep raw exports outside the repository (all CSV files are ignored). Copy
`.env.example` to `.env` if no local environment exists, and set either
`TMDB_READ_ACCESS_TOKEN` or `TMDB_API_KEY`. These are import-time variables;
never use a `VITE_` prefix for credentials. The existing `.env` is ignored.

```powershell
npm run import:books -- 'C:\path\to\goodreads_library_export.csv'
npm run import:screen -- 'C:\path\to\imdb-export.csv'
```

For an IMDb watchlist exported under an arbitrary filename, add `--watchlist`.
Filenames containing `watchlist` are recognized automatically. Generic list
exports cannot reliably identify watchlist membership from their headers.
Unrated generic list entries remain `unknown`; personally rated entries are
`watched` with `statusInferred: true`. Rating dates are never watch dates.

The scripts validate the headers, parse quoted multiline CSV fields, deduplicate
IDs, retry transient failures, and cache successful responses under ignored
`.cache/`. Re-run normally to retry unresolved lookups; add `--offline` to
regenerate using only the existing cache. Remove selected cache files to refresh
stale external metadata. No timestamps or random appearance values are generated.

Goodreads imports only `read` and `currently-reading`. Completion dates sort
newest first, with a stable ID fallback where dates are absent. ISBN matching
precedes strict title/author matching. Multiple distinct works are reported as
ambiguous and retained with CSV metadata instead of guessing. External subjects
map to the six requested normalized genres; unclassified subjects remain empty.
Cover palettes sample the left 6% of the actual downloaded artwork. Thickness,
binding, texture, and wear derive deterministically from page count and work ID.

IMDb imports films, TV movies, series, mini series, and shorts; individual
episodes are excluded. IMDb ID lookups in TMDB enrich only existing members.
Source personal ratings, community ratings, and dates stay separate. Missing
matches retain title/year fallbacks. Artwork is optimized into local WebP files
under `public/artwork/`. Import summaries, including unresolved and ambiguous IDs,
are printed and saved in `.cache/books-summary.json` and
`.cache/screen-summary.json`.

Generated sources are `src/data/books.ts` and `src/data/screen.ts`. Review their
diffs after importing. The generated public files intentionally include collection
membership, titles, external IDs, bibliographic metadata, personal ratings,
reading status/completion dates, list addition/rating dates, and inferred screen
status. Raw review text, IMDb descriptions, private notes, and raw CSVs are excluded.
Serving or publishing the static app makes the generated collection data
available to that site's audience. API credentials and import caches are excluded.

## Browse

The wall and bookshelf scroll independently with touch, trackpads, the mouse
wheel, or dragging. Focus either rail and use left/right keys to scroll; Tab
visits each unique title. Large rails loop with non-tabbable visual copies;
short collections stay centered. Select any spine or frame for details. Escape
returns it to the scene; left/right keys browse details. Dialogs trap focus and
return it to the original object. Reduced motion replaces the elaborate movement
with immediate state changes. Missing images have typeset fallbacks.

## Verify

```powershell
npm run build
npm test
npx tsx tests/verify-personal-import.ts 'C:\path\to\goodreads.csv' 'C:\path\to\imdb.csv'
```

Tests cover parsing, membership, deduplication, matching, ratings and status
semantics, deterministic physical properties, artwork paths, and credential
absence in the production JavaScript/CSS. The optional CSV comparison checks the
generated collection against the original exports. To check import repeatability,
hash the two data files, reimport with `--offline`, and compare their hashes.

## References and credits

Bookshelf design, fonts, physical geometry, and motion follow
[carollia99's Virtual Library Build Guide](https://github.com/carollia99/virtual-library-guide/blob/main/virtual_library_build_guide.md),
adapted for the supplied combined archive brief. No homepage mockup was present
with the request, so the composition follows the written reference.

Book metadata and cover artwork are provided by [Open Library](https://openlibrary.org).
Screen metadata and artwork are provided by [TMDB](https://www.themoviedb.org).
This product uses the TMDB API but is not endorsed or certified by TMDB.
The official TMDB logo and notice appear in the on-page credits. Artwork remains
the property of its respective rights holders; attribution does not transfer rights.
See [TMDB's attribution requirements](https://developer.themoviedb.org/docs/faq)
and [Open Library's API guidance](https://openlibrary.org/developers/api).

## Repository workflow

Develop on local `codex/<topic>` branches, review and validate the complete diff,
then approve the exact commit. Use the repository publish command for reviewed
changes destined for remote `main`. See [CONTRIBUTING.md](CONTRIBUTING.md).
