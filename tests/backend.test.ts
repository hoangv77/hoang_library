import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createArchiveBackend } from '../src/lib/archiveBackend';
import type { MediaOverride } from '../src/lib/personalization';

const row: MediaOverride = { media_type: 'book', media_id: 'gr-123', is_favorite: true, personal_comment: 'A note', rating_is_overridden: true, personal_rating: 5 };
test('Supabase transport batches reads, deduplicates mounts, and persists explicit override fields', async () => {
  let reads = 0, writes = 0;
  const stored = new Map<string, MediaOverride>();
  const client = createClient('http://localhost:54321', 'test-public-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const url = String(input);
    if (url.includes('/rpc/is_archive_owner')) return new Response('true', { headers: { 'Content-Type': 'application/json' } });
    if (init?.method === 'POST') {
      writes++;
      const body = JSON.parse(String(init.body));
      assert.equal(body.imdbRating, undefined); assert.equal(body.updated_at, undefined);
      stored.set(body.media_id, body);
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }
    reads++; return new Response(JSON.stringify([...stored.values()]), { headers: { 'Content-Type': 'application/json' } });
  } } });
  const backend = createArchiveBackend(client);
  await Promise.all([backend.readOverrides(), backend.readOverrides()]); assert.equal(reads, 1);
  assert.equal(await backend.isOwner(), true);
  assert.deepEqual(await backend.saveOverride(row), row); assert.equal(writes, 1);
  assert.deepEqual(await backend.readOverrides(), [row]); assert.equal(reads, 2);
  const reloaded = createArchiveBackend(client);
  assert.deepEqual(await reloaded.readOverrides(), [row]);
});
test('Supabase transport reports write rejection and permits an explicit retry after read failure', async () => {
  let fail = true;
  const client = createClient('http://localhost:54321', 'test-public-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (_input, init) => {
    if (init?.method === 'POST') return new Response(JSON.stringify({ code: '42501', message: 'row-level security' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (fail) return new Response(JSON.stringify({ message: 'unavailable' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
  } } });
  const backend = createArchiveBackend(client);
  await assert.rejects(backend.readOverrides(), /temporarily unavailable/);
  fail = false; assert.deepEqual(await backend.readOverrides(), []);
  await assert.rejects(backend.saveOverride(row), /Owner access/);
});
