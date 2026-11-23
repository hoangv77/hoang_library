import { lstat, readFile, rename, unlink, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { books } from '../src/data/books';
import { screen } from '../src/data/screen';
import { albums, tracks } from '../src/data/music';
import { emptyActive, validateCurrentlyActive, validateCurrentSelection, type ActiveCollections, type ActiveCategory, type Episode } from '../src/lib/currentlyActive';
import { loadEnv, request } from './utils/cache';

export function createActiveStore(root: string, collections: ActiveCollections = { books, screen, albums, tracks }) {
  const activePath = path.resolve(root, 'src/data/currently-active.json');
  const episodePath = path.resolve(root, 'src/data/tv-episodes.json');
  let writes: Promise<unknown> = Promise.resolve();
  async function readJson(filename: string, fallback: unknown) {
    try {
      const stat = await lstat(filename);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 * 1024) throw new Error('Invalid local data file.');
      return JSON.parse(await readFile(filename, 'utf8'));
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback; throw error; }
  }
  async function atomic(filename: string, value: unknown) {
    // Refuse to replace malformed data or symlinks.
    await readJson(filename, null);
    const temporary = `${filename}.${randomBytes(8).toString('hex')}.tmp`;
    try { await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); await rename(temporary, filename); }
    finally { await unlink(temporary).catch(() => {}); }
  }
  const readActive = async () => validateCurrentlyActive(await readJson(activePath, emptyActive));
  const readEpisodes = async (): Promise<Record<string, Episode[]>> => readJson(episodePath, {});
  async function cacheStill(episode: Episode) {
    if (episode.still || !episode.sourceStillPath || !/^\/[a-zA-Z0-9]+\.(?:jpg|png)$/.test(episode.sourceStillPath)) return;
    const bytes = await request('https://image.tmdb.org/t/p/w780' + episode.sourceStillPath, {}, true);
    if (bytes) try {
      const still = `/artwork/episodes/${episode.screenId}-${episode.seasonNumber}-${episode.episodeNumber}.webp`;
      await mkdir(path.resolve(root, 'public/artwork/episodes'), { recursive: true });
      await writeFile(path.resolve(root, 'public' + still), await sharp(bytes).resize(780, 440, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer());
      episode.still = still;
    } catch { /* The selected episode uses its own series-level fallback. */ }
  }
  const serialize = <T,>(operation: () => Promise<T>) => {
    const task = writes.then(operation); writes = task.catch(() => {}); return task;
  };
  return {
    async read() { return { active: await readActive(), episodes: await readEpisodes() }; },
    save(category: ActiveCategory, selection: unknown) {
      return serialize(async () => {
        if (!['reading', 'watching', 'playing'].includes(category)) throw new Error('Invalid current category.');
        const episodeData = await readEpisodes();
        const episodes = Object.values(episodeData).flat();
        const valid = validateCurrentSelection(category, selection, { ...collections, episodes });
        if (category === 'reading' && valid && 'pageImage' in valid && valid.pageImage) {
          const image = await lstat(path.resolve(root, 'public' + valid.pageImage));
          if (!image.isFile() || image.isSymbolicLink()) throw new Error('The page image must exist in public/page-images.');
        }
        const active = await readActive();
        if (category === 'watching' && valid && 'screenId' in valid && valid.episodeNumber !== undefined) {
          const episode = episodes.find(episode => episode.screenId === valid.screenId && episode.seasonNumber === valid.seasonNumber && episode.episodeNumber === valid.episodeNumber)!;
          await cacheStill(episode);
          await atomic(episodePath, episodeData);
        }
        const updated = { ...active, [category]: valid };
        await atomic(activePath, updated); return updated;
      });
    },
    episodes(screenId: unknown, season: unknown) {
      return serialize(async () => {
        const item = collections.screen.find(item => item.id === screenId);
        if (!item || item.type !== 'series' || !item.tmdbId || typeof season !== 'number' || !Number.isInteger(season) || season < 0 || season > (item.seasons ?? 1000)) throw new Error('Choose a known series and season.');
        const all = await readEpisodes(); const key = `${item.id}:${season}`;
        if (all[key]?.length) return all[key];
        await loadEnv();
        const apiKey = process.env.TMDB_API_KEY;
        const bearer = process.env.TMDB_READ_ACCESS_TOKEN;
        if (!apiKey && !bearer) throw new Error('TMDB configuration is missing from the local .env file.');
        const headers: Record<string, string> = bearer ? { Authorization: `Bearer ${bearer}` } : {};
        const endpoint = `https://api.themoviedb.org/3/tv/${item.tmdbId}/season/${season}${apiKey ? '?api_key=' + encodeURIComponent(apiKey) : ''}`;
        const data = await request(endpoint, headers);
        if (data?.season_number !== season || !Array.isArray(data.episodes) || !data.episodes.length) throw new Error('Episode metadata is unavailable. Keep a series-level selection or try again later.');
        const result: Episode[] = [];
        for (const episode of data.episodes) {
          if (episode.season_number !== season || !Number.isInteger(episode.episode_number) || episode.episode_number < 1 || !episode.name) continue;
          const sourceStillPath = typeof episode.still_path === 'string' && /^\/[a-zA-Z0-9]+\.(?:jpg|png)$/.test(episode.still_path) ? episode.still_path : undefined;
          result.push({ screenId: item.id, seasonNumber: season, episodeNumber: episode.episode_number, title: episode.name, description: episode.overview || '', ...(episode.air_date ? { airDate: episode.air_date } : {}), ...(sourceStillPath ? { sourceStillPath } : {}) });
        }
        if (!result.length) throw new Error('No valid episodes were returned.');
        all[key] = result; await atomic(episodePath, all); return result;
      });
    },
  };
}
