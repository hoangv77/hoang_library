# Future Supabase setup

Setup is deferred. Local editing already works with `npm run dev`, without a
Supabase account or sign-in. Saves go to `src/data/personal-overrides.json` and
are included in the next static build. Production file editing is disabled.

The Supabase client, owner access UI, override merging, and owner-only SQL policies
are implemented. These tasks connect and verify a real hosted project:

- [ ] Create/select the project. Keep `archive_private` out of exposed API schemas.
- [ ] Apply `supabase/migrations/202611220001_media_overrides.sql` once through the
  normal migration process. See the SQL and [README owner setup](README.md#optional-owner-setup).
- [ ] Disable public sign-ups. Manually provision and confirm the owner's Auth
  user, then insert its UUID into `archive_private.owner_account` using the SQL
  editor. Keep the password out of source code and environment files.
- [ ] Put the project URL and browser-safe publishable/anon key in the ignored
  local `.env`, using the names from `.env.example`. Set the same two public
  variables in the deployment build environment. Never use a service-role/secret
  key in a `VITE_` variable. Restart development/rebuild after configuring.
- [ ] Move existing `src/data/personal-overrides.json` records into
  `public.media_overrides` with an administrator-only seed/import. Preserve
  `media_type` and `media_id`, favorites, comments, and both rating fields; omit
  `updated_at` so the server sets it. The file remains a public fallback snapshot;
  database rows win for matching IDs. Plan deliberately before removing fallback
  rows: deleting a database row reveals its file snapshot again. Explicit blank
  overrides clear comments/favorites or restore imported ratings.
- [ ] Configure the deployed HTTPS Site URL and relevant Auth settings. Deploy a
  fresh production build; local filesystem endpoints are never deployed.
- [ ] Verify a real owner can sign in, enter edit mode, save every editable field,
  reload, and see the persisted values from another browser/device.
- [ ] Verify anonymous and other authenticated users can read public comments but
  cannot insert/update/delete overrides or discover/change the private owner
  record. Test direct API writes as well as hidden UI controls.
- [ ] Verify sign-out and owner revocation stop writes immediately; failed saves
  retain drafts. Test expired sessions, unavailable network, and retry behavior.
- [ ] Arrange database backups and document owner account recovery/transfer.

Existing automated coverage exercises the migration's RLS using an isolated
Postgres fixture and the Supabase SDK using controlled responses. It does not
replace the hosted Auth and cross-device checks above. No project or owner has
been provisioned by this change.
