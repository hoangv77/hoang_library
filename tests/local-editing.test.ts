import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest, type RequestListener } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createLocalEditingMiddleware, localEditingPlugin } from '../scripts/local-editing';
import { createLocalBackend, localOverridesEndpoint } from '../src/lib/localBackend';
import type { MediaOverride } from '../src/lib/personalization';

const row = (id: string, changes: Partial<MediaOverride> = {}): MediaOverride => ({
  media_type: 'book', media_id: id, is_favorite: true, personal_comment: 'A saved note 📚',
  rating_is_overridden: true, personal_rating: 4, ...changes,
});

test('local editing persists validated file data and rejects unsafe HTTP requests', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'archive-local-editing-'));
  const filename = path.join(root, 'src/data/personal-overrides.json');
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, '[]\n');
  const middleware = createLocalEditingMiddleware(root);
  const handler: RequestListener = (request, response) => middleware(request, response, () => { response.statusCode = 404; response.end(); });
  const server = createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const endpoint = base + localOverridesEndpoint;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  });
  const localFetch: typeof fetch = (input, init) => fetch(base + input, init);
  const backend = createLocalBackend(localFetch);
  const read = await fetch(endpoint);
  const { token } = await read.json();
  assert.equal(read.headers.get('cache-control'), 'no-store');
  assert.equal(read.headers.get('access-control-allow-origin'), null);
  const post = (value: unknown, headers: Record<string, string> = {}) => fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Archive-Token': token, Origin: base, ...headers }, body: JSON.stringify(value),
  });
  const rawGetStatus = (headers: Record<string, string>) => new Promise<number>((resolve, reject) => {
    const request = httpRequest(endpoint, { headers }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode!));
    });
    request.on('error', reject); request.end();
  });

  await t.test('local access needs no login and saves survive a fresh client and server middleware', async () => {
    assert.equal(await backend.isOwner(), true);
    let identity: string | null = null;
    backend.subscribeAuth(value => { identity = value; })();
    assert.equal(identity, 'local-development');
    assert.deepEqual(await backend.readOverrides(), []);
    assert.deepEqual(await backend.saveOverride(row('gr-1')), row('gr-1'));
    assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')), [row('gr-1')]);
    assert.deepEqual(await createLocalBackend(localFetch).readOverrides(), [row('gr-1')]);
    // A new middleware has a fresh token but retains the same source file.
    const restarted = createLocalEditingMiddleware(root);
    server.removeAllListeners('request');
    server.on('request', (request, response) => restarted(request, response, () => response.end()));
    try {
      assert.deepEqual(await createLocalBackend(localFetch).readOverrides(), [row('gr-1')]);
      await assert.rejects(backend.saveOverride(row('gr-2')), /draft is still here/);
      // The first failed save drops the stale token; retry obtains the restarted server's token.
      assert.deepEqual(await backend.saveOverride(row('gr-2')), row('gr-2'));
    } finally {
      server.removeAllListeners('request');
      server.on('request', handler);
    }
  });

  await t.test('concurrent saves preserve different titles and reset fields persist explicitly', async () => {
    await Promise.all([post(row('gr-3')), post(row('tt4', { media_type: 'screen', personal_rating: 10 }))].map(async pending => assert.equal((await pending).status, 200)));
    assert.equal(JSON.parse(await readFile(filename, 'utf8')).length, 4);
    const reset = row('gr-1', { is_favorite: false, personal_comment: null, rating_is_overridden: false, personal_rating: null });
    assert.equal((await post(reset)).status, 200);
    const persisted = await createLocalBackend(localFetch).readOverrides();
    assert.deepEqual(persisted.find(value => value.media_id === 'gr-1'), reset);
    assert.equal((await post(row('gr-3', { rating_is_overridden: true, personal_rating: null }))).status, 200);
  });

  await t.test('foreign origins, hosts, methods, content types and missing/invalid tokens cannot write', async () => {
    const before = await readFile(filename, 'utf8');
    const readHeaders: Record<string, string>[] = [{ Origin: 'https://example.com' }, { Origin: 'null' }, { Host: 'example.com' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'same-site' }];
    for (const headers of readHeaders) {
      // Node fetch normalizes Host; use a raw HTTP request to exercise server host validation.
      assert.equal(await rawGetStatus(headers), 403, JSON.stringify(headers));
    }
    const writeHeaders: Record<string, string>[] = [{ Origin: 'https://example.com' }, { 'X-Archive-Token': '' }, { 'X-Archive-Token': 'x'.repeat(64) }, { 'X-Archive-Token': 'é'.repeat(64) }];
    for (const headers of writeHeaders) {
      assert.equal((await post(row('gr-denied'), headers)).status, 403);
    }
    assert.equal((await post(row('gr-denied'), { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await fetch(endpoint, { method: 'DELETE' })).status, 405);
    assert.equal((await fetch(endpoint, { method: 'OPTIONS', headers: { Origin: 'https://example.com' } })).status, 403);
    assert.equal(await readFile(filename, 'utf8'), before);
  });

  await t.test('invalid data and oversized requests leave the file intact', async () => {
    const before = await readFile(filename, 'utf8');
    for (const value of [null, [], {}, row('../outside'), row('gr-1', { personal_rating: 6 }), row('gr-1', { personal_comment: 'a'.repeat(2001) })]) {
      assert.equal((await post(value)).status, 400);
    }
    assert.equal((await post({ ...row('gr-1'), extra: 'a'.repeat(17000) })).status, 413);
    assert.equal(await readFile(filename, 'utf8'), before);
  });

  await t.test('chunked Unicode data is decoded after collecting complete bytes', async () => {
    const value = row('gr-unicode', { personal_comment: '📚'.repeat(2000) });
    const body = Buffer.from(JSON.stringify(value));
    const emoji = body.indexOf(Buffer.from('📚'));
    const status = await new Promise<number>(resolve => {
      const request = httpRequest(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Archive-Token': token, Origin: base } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode!)); });
      request.write(body.subarray(0, emoji + 1));
      request.end(body.subarray(emoji + 1));
    });
    assert.equal(status, 200);
    const persisted = await createLocalBackend(localFetch).readOverrides();
    assert.deepEqual(persisted.find(value => value.media_id === 'gr-unicode'), value);
  });

  await t.test('a malformed existing file fails closed and can recover without restarting', async () => {
    const before = await readFile(filename, 'utf8');
    await writeFile(filename, '{ invalid json');
    assert.equal((await fetch(endpoint)).status, 500);
    assert.equal((await post(row('gr-1'))).status, 500);
    assert.equal(await readFile(filename, 'utf8'), '{ invalid json');
    await writeFile(filename, before);
    assert.equal((await post(row('gr-1'))).status, 200);
  });
});

test('local write middleware is installed only in development, never in preview', () => {
  const plugin = localEditingPlugin();
  assert.equal(plugin.apply, 'serve');
  assert.equal(typeof plugin.configureServer, 'function');
  assert.equal(plugin.configurePreviewServer, undefined);
});
