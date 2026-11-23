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
  for progress. Goodreads edition page counts bound the page field
  when present. Open Library work-level estimates do not impose that bound.
- **Currently Watching**: choose a movie or series. For a series, enter a season,
  **Load episodes**, choose a verified episode, then save. Leaving the episode
  blank is a valid series selection. TMDB credentials remain server-side in the
  ignored `.env`. Metadata is cached locally; only the chosen episode still is
  downloaded on save. The current poster opens its series details, including the saved episode.
- **Currently Playing**: choose an album and optionally one of its known songs.
  An album without a track displays **No song selected**. No playback is implied.

Uncheck a category's toggle and save to clear it. Saving replaces that category's
previous item and preserves the other two. Current selections persist in
`src/data/currently-active.json`; episode metadata persists in
`src/data/tv-episodes.json`. Neither importer writes these files. Missing item
references are preserved; in local edit mode, select a replacement in the affected category or reimport the missing item. A missing
playing album also offers **Clear saved selection** in the song panel. A missing track can be replaced
from its album's detail editor.

The current book, screen title and album glow purple in their own collections.
Purple takes visual priority over favorite gold without clearing the favorite.
The legend below the shelf explains both colors with physical media symbols.
There is no separate reading stand. A thin-bezel episode screen occupies the
central space beneath the heading in the poster rail. Book page images can
no longer be added or displayed; optional page-number progress remains. Legacy
page-image references remain readable in saved JSON and are removed only when
that reading selection is explicitly saved again. Existing image files are not deleted.

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
# Optional explicit threshold (70 is the default):
npm run import:music -- 'C:\path\to\lastfm-history.csv' --min-scrobbles=70
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
70-scrobble threshold applies after normalization and deduplication. Empty or
invalid records are reported, never assigned to another album.

The importer writes `src/data/music.ts`, `src/data/music-tracks.ts`, and local WebP covers. Personal overrides
and current selections remain separate. It caches successful metadata and artwork
requests under ignored `.cache`, rate-limits MusicBrainz requests, retries transient
failures, and reports inclusion, exclusion, unresolved/ambiguous matches, missing
covers and complete tracklists in `.cache/music-summary.json`. With the same CSV
and cache, repeat imports produce identical data. Online reruns can resolve prior
failures as external data or availability improves.

## Persistent album management

Choose **Edit collection → Add Album** above the record bin. Search by title and
artist, choose a MusicBrainz result, review the fetched artwork and tracklist,
then **Save album**. Search does not save membership. If a lookup is unavailable,
enter title/artist and optional year, known track titles and a local cover path.
Place supplied cover files in `public/album-images` and use a path such as
`/album-images/my-record.webp`; PNG, JPG/JPEG, WebP and AVIF are supported.
Manually supplied lists are labeled **Owner-provided tracks**, not verified
release tracklists. Manual albums require no listening history.

Album details offer **Remove from collection** with confirmation. The album
disappears only after the files are successfully saved. **Add Album → Removed
albums → Restore** restores it, including its separate personal overrides.
Re-adding a removed record also clears its exclusion. Normalized artist/title,
stable IDs and verified MusicBrainz IDs prevent duplicate additions.

`src/data/music-membership.json` stores manual album/track records and exclusion
snapshots separately from Last.fm output. The visible collection is automatic
imports plus manual records minus exclusions. Imported counts stay authoritative;
saved custom metadata takes precedence when a manual album later qualifies for
automatic import. Restoring an album absent from the newest export retains its
saved metadata as a manual album. Original listening history is never edited.

Removing a currently playing album clears only that category. The backend
serializes this with current-selection writes and rolls the active clear back
if membership persistence fails. Favorites, comments and ratings remain stored
for later restoration. All membership endpoints use the existing local-only,
same-origin CSRF boundary. Public builds expose neither actions nor endpoints.

Verified complete tracklists describe one validated release; bonus tracks from
other observed editions are shown separately. Partial, duplicate-title or unresolved
tracklists retain only observed tracks and are labeled accordingly. Counts always
describe this export, not lifetime totals. Safe typeset sleeves cover unavailable
artwork. Both modern and legacy CAA thumbnail keys are supported, as documented
in the [Cover Art Archive API](https://musicbrainz.org/doc/Cover_Art_Archive/API).

## Scene behavior

The poster wall has two staggered rows surrounding the softly faded heading.
Once saved overrides load, favorites fill the lower frames around the opening
and then the outside upper frames. The episode screen is inserted into the
central opening and centered beneath the title on load; surrounding poster
columns move outward without dropping any titles. Saving a favorite does not
reorder the wall until reload.
Original source indices drive detail selection; decorative looping copies are
not extra keyboard entries. The rails measure actual segment widths for wrapping.

Currently Playing has a larger cover with song, artist and album text alongside
it on desktop. To its right, the record holder fits one complete album sleeve
with narrow neighboring sleeve edges. Scroll, swipe or use arrow keys to browse;
keyboard arrows move one sleeve at a time. Books fill the right side of the
shelf. The song panel remains manually selected, with a music indicator
and no playback controls. Footer legends describe gold favorites and purple
current selections. The legends, detailed drag/swipe icon, editing link and
credits share one desktop footer row, wrapping compactly on smaller screens.
The scene fits the viewport at common desktop sizes; very short screens may
need a small vertical scroll.

Detail views move the same solid cover/frame with visible edge faces through a
3D turn and return it to the matching visible object, including after Previous /
Next navigation. Offscreen objects recede locally rather than scrolling the page.
Closing waits for the animation to finish. Stable scrollbar space, focus without
page scrolling, and horizontal-only rail focus movement prevent layout jumps.
Dialogs trap focus and guard unsaved edits; reduced motion skips the flights.
The TV opens the saved episode details and retains a parent-series link. If a
still is missing, it falls back to its own series artwork. Album details retain
ratings, metadata and track durations but show no album or per-track play counts.
Listening-history counts remain in data for imports and thresholds.

Run `npm run build` and `npm test`. The captured import report is in
`imports/music-summary.json`. Final local review notes, screenshots and a
changed-file manifest are saved under ignored `artifacts/` for Hoang's review.
