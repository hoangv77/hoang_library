# Music and currently active media

This phase stays local on `codex/music-and-currently-active`. Do not merge,
push, publish or deploy it before Hoang's review. The existing uncommitted
personal overrides are preserved independently of this implementation.

## Local preview and editing

From the repository root, run `npm run dev` and open the printed loopback URL.
Choose **Edit collection** in the footer, then open a spine, poster or record.
Albums use five stars; screen titles retain their ten-point scale. Favorites
and comments remain independent of ratings. **Save changes** confirms a write
to `src/data/personal-overrides.json`.

Current selections have their own form and **Save current selection** button:

- **Currently Reading**: choose a book, optionally enter a positive page number
  and local page-image path. Goodreads edition page counts bound the page field
  when present. Open Library work-level estimates do not impose that bound.
- **Currently Watching**: choose a movie or series. For a series, enter a season,
  **Load episodes**, choose a verified episode, then save. Leaving the episode
  blank is a valid series selection. TMDB credentials remain server-side in the
  ignored `.env`. Metadata is cached locally; only the chosen episode still is
  downloaded on save. The TV opens episode details with a parent-series link.
- **Currently Playing**: choose an album and optionally one of its known songs.
  An album without a track displays **No song selected**. No playback is implied.

Uncheck a category's toggle and save to clear it. Saving replaces that category's
previous item and preserves the other two. Current selections persist in
`src/data/currently-active.json`; episode metadata persists in
`src/data/tv-episodes.json`. Neither importer writes these files. Missing item
references are preserved; in local edit mode, use **Clear saved selection** on
the affected object or reimport the missing item. A missing track can be replaced
from its album's detail editor.

For a page image, place an image you supply in `public/page-images`, for example
`reading-page.webp`, then enter `/page-images/reading-page.webp` in the book
editor. Allowed formats are PNG, JPG/JPEG, WebP and AVIF; filenames may use letters,
numbers, hyphens and underscores. Remote URLs and nested paths are rejected.
The file must exist when saved. Page images become public build assets. Without
an available image, the stand shows blank pages labeled as an illustration.

Local writes require loopback, same-origin requests and the existing CSRF token.
Production and `npm run preview` expose no write middleware, make no metadata
requests, and render saved snapshots read-only. Supabase configuration cannot
enable production writes in this phase; future work is in `TODO_SUPABASE.md`.
Changes saved after a build need a new build to appear in its static output.

## Repeatable music imports

```powershell
npm run import:music -- 'C:\path\to\lastfm-history.csv'
# Regenerate from the current cache without network access:
npm run import:music -- 'C:\path\to\lastfm-history.csv' --offline
```

Required headers are `uts`, `artist`, `album`, `track`. Optional artist, album and
track MBIDs remain source hints until metadata matches are validated. Names are
normalized conservatively by artist plus album title, with recognized deluxe,
remaster, standard and anniversary suffixes folded into the same entity. Live
titles remain distinct. Symbol-only names are valid. Album and track IDs derive
from normalized names, so metadata enrichment and source ordering cannot change
saved owner references. Different artists with the same album title stay separate.

Deduplication uses the event timestamp, normalized artist/album identity and
track. Repeated listening at different timestamps counts separately. The strict
20-scrobble threshold applies after normalization and deduplication. Empty or
invalid records are reported, never assigned to another album.

The importer writes `src/data/music.ts`, `src/data/music-tracks.ts`, and local WebP covers. Personal overrides
and current selections remain separate. It caches successful metadata and artwork
requests under ignored `.cache`, rate-limits MusicBrainz requests, retries transient
failures, and reports inclusion, exclusion, unresolved/ambiguous matches, missing
covers and complete tracklists in `.cache/music-summary.json`. With the same CSV
and cache, repeat imports produce identical data. Online reruns can resolve prior
failures as external data or availability improves.

Verified complete tracklists describe one validated release; bonus tracks from
other observed editions are shown separately. Partial, duplicate-title or unresolved
tracklists retain only observed tracks and are labeled accordingly. Counts always
describe this export, not lifetime totals. Safe typeset sleeves cover unavailable
artwork. Both modern and legacy CAA thumbnail keys are supported, as documented
in the [Cover Art Archive API](https://musicbrainz.org/doc/Cover_Art_Archive/API).

## Scene behavior

The poster wall has exactly one row. Once saved overrides load, it captures a
stable favorite-first order and aligns the first canonical favorite to the visible
left inset. Saving a favorite does not reorder the wall until reload. Original
source indices drive detail selection; decorative looping copies are not extra
keyboard entries. The rails measure actual segment widths for seamless wrapping.

The wooden record bin, compact TV, and right-side reading stand belong to their
respective collections. The song panel is a manually selected display with a music
indicator and no playback controls. Footer guidance sits beside the gold legend.
The scene scrolls vertically on smaller screens. All detail dialogs trap focus,
return focus on close and guard unsaved edits; reduced-motion settings disable
decorative motion and transitions.

Run `npm run build` and `npm test`. The captured import report is in
`imports/music-summary.json`. Final local review notes, screenshots and a
changed-file manifest are saved under ignored `artifacts/` for Hoang's review.
