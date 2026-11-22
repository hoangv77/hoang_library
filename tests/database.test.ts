import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL enforces public reads, owner-only writes, and override constraints independently of the UI', async t => {
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${owner}'), ('${other}');
  `);
  await db.exec(await readFile('supabase/migrations/202611220001_media_overrides.sql', 'utf8'));
  await db.query('insert into archive_private.owner_account (user_id) values ($1)', [owner]);
  async function as(role: 'anon' | 'authenticated', userId: string, action: () => Promise<void>) {
    await db.exec(`set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    try { await action(); } finally { await db.exec('reset role'); }
  }
  const insert = () => db.query("insert into public.media_overrides (media_type, media_id, is_favorite) values ('book', 'gr-10210', true)");
  try {
    await t.test('anonymous writes are rejected', () => as('anon', '', async () => {
      assert.deepEqual((await db.query('select * from public.media_overrides')).rows, []);
      await assert.rejects(insert(), /permission denied/);
      await assert.rejects(db.query("update public.media_overrides set is_favorite = false"), /permission denied/);
      await assert.rejects(db.query('delete from public.media_overrides'), /permission denied/);
      await assert.rejects(db.query('select * from archive_private.owner_account'), /permission denied/);
    }));
    await t.test('authenticated non-owner cannot insert or grant themselves ownership', () => as('authenticated', other, async () => {
      assert.equal((await db.query<{ is_archive_owner: boolean }>('select public.is_archive_owner()')).rows[0].is_archive_owner, false);
      await assert.rejects(insert(), /row-level security/);
      await assert.rejects(db.query('insert into archive_private.owner_account (user_id) values ($1)', [other]), /permission denied/);
    }));
    await t.test('owner can create, upsert, and clear comments and ratings', () => as('authenticated', owner, async () => {
      assert.equal((await db.query<{ is_archive_owner: boolean }>('select public.is_archive_owner()')).rows[0].is_archive_owner, true);
      await insert();
      await db.query(`insert into public.media_overrides (media_type,media_id,is_favorite,personal_comment,rating_is_overridden,personal_rating)
        values ('book','gr-10210',true,$1,true,5)
        on conflict (media_type,media_id) do update set media_type=excluded.media_type,media_id=excluded.media_id,
        is_favorite=excluded.is_favorite,personal_comment=excluded.personal_comment,rating_is_overridden=excluded.rating_is_overridden,personal_rating=excluded.personal_rating`, ['A favorite.\nRead it slowly.']);
      const saved = (await db.query<{ personal_comment: string; personal_rating: string }>("select * from public.media_overrides where media_id = 'gr-10210'")).rows[0];
      assert.equal(saved.personal_comment, 'A favorite.\nRead it slowly.'); assert.equal(Number(saved.personal_rating), 5);
      await db.query("update public.media_overrides set rating_is_overridden=true,personal_rating=null,personal_comment='  ' where media_id='gr-10210'");
      assert.equal((await db.query<{ personal_comment: string | null }>('select personal_comment from public.media_overrides')).rows[0].personal_comment, null);
      await db.query("insert into public.media_overrides (media_type,media_id,personal_comment) values ('screen','tt0108778','Warm and familiar')");
    }));
    await t.test('non-owner updates and deletes affect no rows, including forged upserts', () => as('authenticated', other, async () => {
      assert.equal((await db.query('update public.media_overrides set is_favorite=false returning media_id')).rows.length, 0);
      assert.equal((await db.query('delete from public.media_overrides returning media_id')).rows.length, 0);
      await assert.rejects(db.query("insert into public.media_overrides (media_type,media_id) values ('book','gr-10210') on conflict (media_type,media_id) do update set is_favorite=false"), /row-level security/);
    }));
    await t.test('public readers can see persisted favorites and notes', () => as('anon', '', async () => {
      const rows = (await db.query<{ is_favorite: boolean; personal_comment: string }>('select * from public.media_overrides order by media_type')).rows;
      assert.equal(rows.length, 2); assert.equal(rows[0].is_favorite, true); assert.equal(rows[1].personal_comment, 'Warm and familiar');
    }));
    await t.test('database rejects fractional, out-of-range, contradictory, or overlong values', () => as('authenticated', owner, async () => {
      for (const rating of [0, 6, 4.5]) await assert.rejects(db.query("update public.media_overrides set rating_is_overridden=true,personal_rating=$1 where media_type='book'", [rating]), /check constraint/);
      await assert.rejects(db.query("update public.media_overrides set rating_is_overridden=false,personal_rating=4 where media_type='book'"), /check constraint/);
      await assert.rejects(db.query("update public.media_overrides set personal_comment=$1", ['a'.repeat(2001)]), /check constraint/);
      await db.query("update public.media_overrides set rating_is_overridden=true,personal_rating=10 where media_type='screen'");
      await assert.rejects(db.query("update public.media_overrides set personal_rating=11 where media_type='screen'"), /check constraint/);
      await assert.rejects(db.query("update public.media_overrides set updated_at='2000-01-01'"), /permission denied/);
      await db.query("update public.media_overrides set rating_is_overridden=false,personal_rating=null where media_type='book'");
      await db.query("delete from public.media_overrides where media_type='screen'");
    }));
    await t.test('revoking ownership immediately removes write access', async () => {
      await db.exec('delete from archive_private.owner_account');
      await as('authenticated', owner, async () => {
        assert.equal((await db.query('update public.media_overrides set is_favorite=false returning media_id')).rows.length, 0);
        await assert.rejects(db.query("insert into public.media_overrides (media_type,media_id) values ('screen','tt123')"), /row-level security/);
      });
    });
  } finally { await db.close(); }
});
