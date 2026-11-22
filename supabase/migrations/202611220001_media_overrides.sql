-- Apply as the database administrator. Owner provisioning is a separate manual step.
create schema if not exists archive_private;
revoke all on schema archive_private from public, anon, authenticated;

create table archive_private.owner_account (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
revoke all on archive_private.owner_account from public, anon, authenticated;
alter table archive_private.owner_account enable row level security;

create function public.is_archive_owner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from archive_private.owner_account
    where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_archive_owner() from public;
grant execute on function public.is_archive_owner() to authenticated;

create table public.media_overrides (
  media_type text not null check (media_type in ('book', 'screen')),
  media_id text not null check (media_id ~ '^[a-zA-Z0-9_-]{1,180}$'),
  is_favorite boolean not null default false,
  personal_comment text check (char_length(personal_comment) <= 2000),
  -- false/null = imported rating; true/null = explicitly unrated.
  rating_is_overridden boolean not null default false,
  personal_rating numeric check (personal_rating is null or personal_rating = trunc(personal_rating)),
  updated_at timestamptz not null default now(),
  primary key (media_type, media_id),
  constraint rating_value_valid check (
    (not rating_is_overridden and personal_rating is null)
    or (rating_is_overridden and (
      personal_rating is null
      or (media_type = 'book' and personal_rating between 1 and 5)
      or (media_type = 'screen' and personal_rating between 1 and 10)
    ))
  )
);
alter table public.media_overrides enable row level security;
revoke all on public.media_overrides from public, anon, authenticated;
grant select on public.media_overrides to anon, authenticated;
grant insert (media_type, media_id, is_favorite, personal_comment, rating_is_overridden, personal_rating),
      update (media_type, media_id, is_favorite, personal_comment, rating_is_overridden, personal_rating),
      delete on public.media_overrides to authenticated;

create policy archive_public_read on public.media_overrides
for select to anon, authenticated using (true);
create policy archive_owner_insert on public.media_overrides
for insert to authenticated with check ((select public.is_archive_owner()));
create policy archive_owner_update on public.media_overrides
for update to authenticated
using ((select public.is_archive_owner())) with check ((select public.is_archive_owner()));
create policy archive_owner_delete on public.media_overrides
for delete to authenticated using ((select public.is_archive_owner()));

create function archive_private.stamp_override()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.personal_comment = nullif(btrim(new.personal_comment), '');
  return new;
end;
$$;
revoke all on function archive_private.stamp_override() from public, anon, authenticated;
create trigger stamp_media_override before insert or update on public.media_overrides
for each row execute function archive_private.stamp_override();
