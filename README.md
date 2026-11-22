# hoang's library

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
The public archive needs no sign-in. Optional Supabase Auth and a small overrides
table support private owner editing. There is no search, tracking, public
registration, or separate administration dashboard.

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

Golden edges and a restrained glow identify personal favorites; the legend and
detail labels explain their meaning without depending on color alone. Favorites
are manually selected and independent of ratings. Books use accessible five-star
ratings; zero means **Unrated**. Screen personal ratings stay on the ten-point
scale and are separate from IMDb community ratings. Every detail view includes
**Personal comments**, with **N/A** when no note has been saved.

## Optional owner setup

Supabase setup has intentionally been left for later. Without its configuration,
the existing archive works in read-only mode using imported metadata and ratings.
Favorites default to false, missing comments display N/A, and **Owner access**
explains the required setup. There is no simulated login or local-only save mode.

1. Create or select a Supabase project. Keep only the normal `public` schema
   exposed through its Data API; do not expose `archive_private`.
2. Run [the migration](supabase/migrations/202611220001_media_overrides.sql) once
   in the project's SQL editor as the database administrator, or apply it through
   your existing Supabase migration workflow. Do not rerun the one-time migration
   against an already-migrated database.
3. In Supabase Authentication, manually create the owner's email/password user
   and confirm its email. Provision the password through Supabase; never put it
   in the repository or frontend environment. Disable **Allow new users to sign
   up**, anonymous sign-ins, and unused providers in the project's Auth settings.
   See [Supabase's authentication configuration](https://supabase.com/docs/guides/auth/general-configuration)
   and [password sign-in guidance](https://supabase.com/docs/guides/auth/passwords).
4. Copy that account's user UUID from Authentication → Users. In the SQL editor,
   authorize it using the query below, replacing the placeholder. This table has
   room for exactly one designated owner and cannot be edited by browser clients.

   ```sql
   insert into archive_private.owner_account (singleton, user_id)
   values (true, 'REPLACE-WITH-THE-OWNER-USER-UUID'::uuid)
   on conflict (singleton) do update set user_id = excluded.user_id;
   ```

5. Add the following **browser-safe** configuration to the ignored `.env`. Leave
   the existing TMDB import credentials as they are.

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
   ```

   Use a publishable key (`sb_publishable_…`) or the legacy `anon` key. Never use
   a secret key, `service_role` key, database password, or TMDB key here. These
   `VITE_` values are intentionally included in the frontend build; RLS supplies
   write authorization. Vite refuses private-key/TMDB variables with `VITE_`
   prefixes. See [Supabase's key guidance](https://supabase.com/docs/guides/api/api-keys).
6. Restart Vite, or rebuild and deploy `dist/` with these build-time variables.
   Use HTTPS for a deployed archive and Supabase endpoint; local HTTP is accepted
   only for loopback Supabase development. Configure the project's Site URL for
   the deployed origin. This app uses password sign-in, with no OAuth redirects
   or public registration flow.

Use the discreet **Owner access** footer control to sign in, then choose **Enter
edit mode**. Open any title, edit its favorite/comment/personal rating, and choose
**Save changes**. Updates appear after the database confirms persistence. **Cancel
changes** restores the saved values. Books support keyboard-operated rating stars,
**Use imported rating**, and **Mark unrated**. Screen ratings provide the same
imported/unrated choices on their ten-point scale. Exit edit mode or sign out
through **Owner access**. A valid session is restored on reload, but editing must
be explicitly enabled again. Password recovery/account changes are handled in
Supabase, not through a public archive registration page.

All saved comments, favorite states, and personal rating overrides are **public
archive content**, even though editing is private. Comments are plain text, allow
line breaks, and have a maximum of 2,000 characters. They are separate from imported
reviews, metadata descriptions, and personal ratings.

### Storage and authorization

`media_overrides` uses `(media_type, media_id)` as its primary key: `book` plus
the stable existing `gr-<Goodreads ID>`, or `screen` plus `tt<IMDb ID>`. Generated
membership, metadata, artwork, physical properties, ratings, and import scripts
stay in their original files. A single fetch normally loads all overrides, with
pagination for very large archives. A memoized derived collection merges only
favorite, comment, and personal-rating fields. Orphaned overrides are ignored
without being deleted, so a later reimport can restore their association.

`rating_is_overridden = false, personal_rating = null` uses the imported rating.
`rating_is_overridden = true, personal_rating = null` intentionally displays
Unrated. A true flag with a valid whole-number value overrides the imported
rating. Resetting a rating does not remove its saved favorite or comment. Imports
never connect to the overrides database and cannot overwrite saved customizations.

RLS permits public reads of these intentionally public fields and permits inserts,
updates, and deletes only when `auth.uid()` matches the protected singleton owner
record. The server-controlled `is_archive_owner()` RPC is also used to determine
whether to show the editor; browser controls are not the authorization boundary.
The database enforces rating ranges/integer values, comment length, key shape,
and update timestamps. A revoked owner cannot keep writing with an existing
session. To revoke editing, delete the row from `archive_private.owner_account`
through the SQL editor. Replacing that row transfers ownership deliberately.

Supabase handles session persistence/refresh. Every authentication event triggers
a fresh owner check. Invalid/missing configuration fails closed. A failed override
fetch leaves the static collection usable and offers a manual retry. Save failures
retain the draft; duplicate submissions are blocked. Closing, browsing to another
title, or leaving the page with unsaved edits prompts a discard warning. A sign-in
expiration temporarily disables saving and preserves a dirty editor.
Editing waits until existing saved overrides have loaded, so a slow connection
cannot turn unknown values into empty notes. A late read cannot replace a save
that this browser has already confirmed.

Public overrides refresh on a new page load; there are no realtime subscriptions
or continuous polling. After an owner save, that browser updates immediately.
Other devices see the saved value when they next load the archive. Concurrent
owner sessions use last-successful-write-wins behavior; avoid editing the same
title in two sessions simultaneously.

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

Additional Phase 2 tests cover override merging/reload/reimport compatibility,
five-star rendering and editing, comments and safe text rendering, repeated visual
copies, save/cancel/failure states, focus trapping, unsaved navigation, and owner
session transitions. Supabase transport tests exercise the actual SDK with
controlled HTTP responses. `tests/database.test.ts` runs the real migration in
PGlite (PostgreSQL compiled to WASM), with isolated `anon` and `authenticated`
roles and a minimal Supabase `auth.uid()` test fixture. It tests RLS independently
of frontend checks, including non-owner upserts and immediate owner revocation.
Test authentication fixtures are confined to `tests/` and are never used by the app.

Live Supabase account provisioning, Auth service configuration, and cross-device
network verification remain deployment steps until a project is configured. The
local tests do not claim to verify an unconfigured hosted Auth service. After
setup, sign in as the owner, save a note, reload on another browser/device, verify
the public note appears, and confirm anonymous/non-owner writes remain rejected.
Keep a backup of the overrides table as part of the project's normal database
backup process; generated CSV data and Git do not back up manually saved notes.

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
