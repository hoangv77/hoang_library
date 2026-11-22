# Phase 2 delivery notes

Starting revision: `7fd43db0a2f436f415fad6e2ecfc15983f3d8018`.
Work branch: `codex/archive-personalization`, created after fetching and
fast-forwarding the clean local main to the latest remote main.

The existing React/Vite stack, generated collections, imports, artwork, physical
book construction, poster wall, and single-scene composition are retained.
Personalization is layered onto stable IDs through a separate overrides store.

## Implemented

- Manual favorites for books and screen titles, with shared warm-gold lighting,
  accessible favorite labels, a persistent legend, and matching detail artwork.
- Plain-text, multiline personal comments; missing/blank comments display N/A.
- SVG five-star book ratings and keyboard-operated star editing. Screen personal
  ratings stay on the ten-point scale; IMDb community ratings remain read-only.
- Discreet owner sign-in, sign-out, session restoration, explicit edit mode,
  favorite/comment/rating controls, save/cancel, confirmed-save feedback,
  recoverable error messages, and draft-preserving authorization failure handling.
- Separate imported/custom/unrated rating semantics; resetting a rating leaves
  the title's favorite and comment intact.
- Supabase transport, bounded requests, normal single-request override loading,
  pagination for large archives, static-data fallback, and explicit retry.
- PostgreSQL RLS and column privileges; a server-protected singleton owner
  account, immutable client timestamps, and database validation.
- Contextual visitor guidance, preserved modal keyboard behavior, fixed close
  control, and a backdrop that stays in place while long detail views scroll.

## Added files

| Files | Purpose |
| --- | --- |
| `src/lib/personalization.ts` | Shared types, validation, stable-key merging, comment fallback |
| `src/lib/archiveBackend.ts` | Supabase reads, confirmed writes, auth transport, errors |
| `src/lib/supabase.ts`, `src/lib/supabaseConfig.ts` | Optional public configuration and client initialization |
| `src/hooks/useArchive.ts` | Memoized derived collection, session/owner state, persistence |
| `src/hooks/useDialogFocus.ts` | Shared focus trapping and restoration |
| `src/components/shared/BookRating.tsx` | Read-only SVG stars and accessible star editor |
| `src/components/shared/PersonalComments.tsx` | Public plain-text notes |
| `src/components/owner/OwnerAccess.tsx` | Private sign-in and edit-mode entry |
| `src/components/owner/OwnerEditor.tsx` | In-detail edit controls and draft/save state |
| `src/vite-env.d.ts` | Vite environment types |
| `supabase/migrations/202611220001_media_overrides.sql` | Storage, constraints, owner RPC, privileges, RLS, timestamp trigger |
| `tests/backend.test.ts` | Actual Supabase SDK transport with controlled HTTP responses |
| `tests/database.test.ts` | Migration and PostgreSQL RLS tests independent of frontend controls |
| `tests/personalization.test.ts` | Ratings, merge/reload/reimport, validation and public configuration |
| `tests/ui.test.tsx` | Components, editor interactions, auth transitions and regression tests |
| `tests/helpers/backend.ts`, `tests/helpers/dom.ts` | Test-only auth/persistence and DOM fixtures |
| `docs/phase-2.md` | This delivery record |

## Modified files

| Files | Change |
| --- | --- |
| `src/App.tsx` | Derived collection, guidance, favorite legend and owner access |
| `src/components/books/BookShelf.tsx`, `src/components/screen/PosterWall.tsx` | Shared personalized types and memoization |
| `src/components/books/BookSpine.tsx` | Favorite lighting/label and star tooltip |
| `src/components/screen/FramedPoster.tsx` | Favorite lighting and accessible label |
| `src/components/shared/DetailOverlay.tsx` | Personal notes/stars, in-place editor, draft guards and keyboard integration |
| `src/components/shared/MetadataTooltip.tsx` | Shared tooltip content slot |
| `src/styles.css` | Favorite tokens, stars, guidance, editor/dialog layouts and responsive behavior |
| `vite.config.ts` | Refuse private credentials in frontend environment variables |
| `.env.example` | Document optional browser-safe Supabase variables |
| `package.json`, `package-lock.json` | Supabase client, test tools and expanded test command |
| `README.md` | Supabase provisioning, owner workflow, storage/security semantics and deployment instructions |

Generated `src/data/books.ts` and `src/data/screen.ts` remain unchanged. Import
scripts do not write to Supabase and cannot remove persisted customizations.
Ignored local visual QA fixtures and screenshots are not part of the production
entry, build, or commit.

## Configuration and use

Supabase setup is intentionally deferred at the owner's request. No project has
been provisioned and no account/password is embedded or simulated in the app.
The normal archive remains functional in read-only mode.

When ready, follow [the README owner setup](../README.md#optional-owner-setup):
apply the migration, manually create/confirm the owner, disable registration,
authorize the UUID in `archive_private.owner_account`, and configure:

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

The publishable/legacy anon key is browser-safe. Never use a Supabase secret or
service-role key. Existing TMDB environment variables stay import-only and ignored.
Restart Vite/rebuild the static site after changing its public build-time values.
Use HTTPS in deployment. No extra hosting backend or public page is needed.

After setup, open **Owner access**, sign in, enable **Edit mode**, select a title,
make changes, and save. Public visitors see only saved values. Sign out or leave
edit mode through the same footer control.

## Validation and limits

The production build and 35 automated checks passed, including seven PostgreSQL
authorization subchecks. Existing tests are preserved. Tests cover owner-only
writes, anonymous/public reads, non-owner upserts, owner revocation, validation,
safe comments, stars, imported/custom/unrated ratings, saved-state reloads,
stable import IDs, repeated rail copies, transport failures, session transitions,
stale authorization/read responses, loading existing notes before editing, duplicate saves, draft preservation, navigation
guards, and focus trapping.

Both actual supplied CSVs were reimported from cache and produced identical data
file hashes. A separate build guard check rejected a test private-key value in a
`VITE_` variable. The production asset scan found no local TMDB credentials.

Browser checks covered the real read-only archive on desktop and mobile, owner
configuration messaging, actual imported star ratings/comments, last-poster
keyboard access, overlay open/close and focus return. A clearly labeled,
isolated local component fixture exercised favorite glows and editor fields on
desktop/mobile without claiming live authentication or persistence. A scrolling
backdrop issue found during that check was fixed.

Live hosted Auth, owner provisioning, and real cross-device persistence still
require Supabase setup. RLS was exercised in actual PostgreSQL through PGlite,
with a minimal test `auth.uid()` fixture; the hosted Auth service was not used.
Other browsers refresh public notes on page load; there is no realtime polling.
Concurrent owner edits use last-successful-write-wins behavior. Notes and favorites
are public content, and the Supabase table needs its own normal backup process.
