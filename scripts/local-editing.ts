import { randomBytes, timingSafeEqual } from 'node:crypto';
import { lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';
import { localOverridesEndpoint } from '../src/lib/localBackend';
import { overrideKey, validateOverride, type MediaOverride } from '../src/lib/personalization';
import { createActiveStore } from './active-store';
import type { ActiveCategory } from '../src/lib/currentlyActive';
import { createMusicStore, searchAlbums, resolveAlbum } from './music-store';

const loopback = new Set(['127.0.0.1', 'localhost', '[::1]']);
const localAddresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const maximumBytes = 2 * 1024 * 1024;

// Write endpoints use fixed repository files; request bodies never choose a storage filename.
export function createLocalEditingMiddleware(root: string) {
  let musicStore: ReturnType<typeof createMusicStore>;
  const activeStore = createActiveStore(root, undefined, () => musicStore.collections());
  musicStore = createMusicStore(root, activeStore);
  const filename = path.resolve(root, 'src/data/personal-overrides.json');
  const token = randomBytes(32).toString('hex');
  let writes: Promise<unknown> = Promise.resolve();
  async function read(): Promise<MediaOverride[]> {
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximumBytes) throw new Error('Invalid overrides file');
    const rows = JSON.parse(await readFile(filename, 'utf8'));
    if (!Array.isArray(rows)) throw new Error('Invalid overrides file');
    const validated = rows.map(validateOverride);
    if (new Set(validated.map(row => overrideKey(row.media_type, row.media_id))).size !== validated.length) throw new Error('Duplicate overrides');
    return validated;
  }
  function allowed(request: IncomingMessage) {
    try {
      const host = request.headers.host;
      if (!host || !localAddresses.has(request.socket.remoteAddress ?? '')) return false;
      const url = new URL(`http://${host}`);
      if (!loopback.has(url.hostname) || url.host !== host || url.username || url.password || url.pathname !== '/') return false;
      const origin = request.headers.origin;
      return (!origin || origin === url.origin) && !['cross-site', 'same-site'].includes(request.headers['sec-fetch-site'] as string);
    } catch { return false; }
  }
  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const endpoint = request.url?.split('?')[0];
    if (![localOverridesEndpoint, '/__archive/currently-active', '/__archive/music-membership'].includes(endpoint ?? '')) return next();
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json');
    // Vite's general CORS policy must never expose the editing token.
    response.removeHeader('Access-Control-Allow-Origin');
    const send = (status: number, body: unknown) => { response.statusCode = status; response.end(JSON.stringify(body)); };
    if (!allowed(request)) return send(403, { error: 'Local editing requires a same-origin loopback connection.' });
    if (request.method === 'GET') {
      if (endpoint === '/__archive/music-membership') { void musicStore.read().then(state => send(200, { state, token })).catch(() => send(500, { error: 'Could not read album membership.' })); return; }
      if (endpoint === '/__archive/currently-active') { void activeStore.read().then(data => send(200, { ...data, token })).catch(() => send(500, { error: 'Could not read current selections.' })); return; }
      void read().then(overrides => send(200, { overrides, token })).catch(() => send(500, { error: 'Could not read the local overrides file.' }));
      return;
    }
    if (request.method !== 'POST') { response.setHeader('Allow', 'GET, POST'); return send(405, { error: 'Method not allowed.' }); }
    const suppliedToken = request.headers['x-archive-token'];
    if (typeof suppliedToken !== 'string' || !/^[a-f0-9]{64}$/.test(suppliedToken) || !timingSafeEqual(Buffer.from(suppliedToken), Buffer.from(token))) return send(403, { error: 'Reload the collection before saving.' });
    if (request.headers['content-type'] !== 'application/json') return send(415, { error: 'Expected JSON.' });
    void (async () => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of request) {
        const buffer = Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > (endpoint === '/__archive/music-membership' ? 131072 : 16384)) return send(413, { error: 'The change is too large.' });
        chunks.push(buffer);
      }
      let value: MediaOverride;
      if (endpoint === '/__archive/music-membership') {
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          let result;
          if (payload.action === 'search') result = await searchAlbums(payload.title, payload.artist);
          else if (payload.action === 'resolve') result = await resolveAlbum(payload.id);
          else if (payload.action === 'add') result = await musicStore.add(payload);
          else if (payload.action === 'remove') result = await musicStore.remove(payload.id);
          else if (payload.action === 'restore') result = await musicStore.restore(payload.id);
          else throw new Error('Unknown music action.');
          return send(200, result);
        } catch (error) { return send(400, { error: (error as Error).message }); }
      }
      if (endpoint === '/__archive/currently-active') {
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const result = payload.action === 'episodes' ? await activeStore.episodes(payload.screenId, payload.season) : await activeStore.save(payload.category as ActiveCategory, payload.selection);
          return send(200, result);
        } catch (error) { return send(400, { error: (error as Error).message }); }
      }
      try { value = validateOverride(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { return send(400, { error: 'Invalid collection override.' }); }
      const save = writes.then(async () => {
        const rows = await read(); // Never replace a malformed existing file with an empty collection.
        const key = overrideKey(value.media_type, value.media_id);
        const updated = [...rows.filter(row => overrideKey(row.media_type, row.media_id) !== key), value]
          .sort((a, b) => overrideKey(a.media_type, a.media_id).localeCompare(overrideKey(b.media_type, b.media_id)));
        const output = JSON.stringify(updated, null, 2) + '\n';
        if (Buffer.byteLength(output) > maximumBytes) throw new Error('Overrides file is too large');
        const temporary = `${filename}.${randomBytes(8).toString('hex')}.tmp`;
        try { await writeFile(temporary, output, { flag: 'wx' }); await rename(temporary, filename); }
        finally { await unlink(temporary).catch(() => {}); }
        return value;
      });
      writes = save.catch(() => {}); // Serialize writes while allowing recovery after an error.
      await save;
      send(200, value);
    })().catch(() => send(500, { error: 'Could not save the local overrides file.' }));
  };
}

export function localEditingPlugin(): Plugin {
  let filename = '';
  return {
    name: 'archive-local-editing', apply: 'serve',
    configureServer(server) {
      filename = path.resolve(server.config.root, 'src/data/personal-overrides.json');
      // Run before Vite's CORS and static middleware. configurePreviewServer is deliberately absent.
      server.middlewares.use(createLocalEditingMiddleware(server.config.root));
    },
    handleHotUpdate(context) {
      // The confirmed save updates React. Re-importing the file would discard an open editor's state.
      if ([filename, ...['currently-active.json', 'tv-episodes.json', 'music-membership.json'].map(name => path.resolve(context.server.config.root, 'src/data', name))].includes(path.resolve(context.file))) return [];
    },
  };
}
