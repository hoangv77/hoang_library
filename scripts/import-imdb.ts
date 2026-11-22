import { pathToFileURL } from 'node:url';
import type { ScreenTitle } from '../src/data/screen.ts';
import { date, number, readCsv, requireHeaders } from './utils/csv.ts';
import { loadEnv, request, summary, writeData } from './utils/cache.ts';
import { artwork, hash } from './utils/colors.ts';

export function normalizeScreen(rows: Record<string, string>[], watchlist = false) {
  requireHeaders(rows, ['Const', 'Title', 'Title Type']);
  const seen = new Set<string>();
  const types: Record<string, ScreenTitle['type']> = { Movie: 'movie', 'TV Movie': 'movie', 'TV Series': 'series', 'TV Mini Series': 'series', Short: 'short', 'TV Short': 'short' };
  return rows.flatMap(row => {
    const id = row.Const, type = types[row['Title Type']];
    if (!/^tt\d+$/.test(id) || !type || !row.Title || seen.has(id)) return [];
    seen.add(id); const rating = number(row['Your Rating']);
    return [{ id, imdbId: id, title: row.Title, originalTitle: row['Original Title'] || undefined,
      type, originalType: row['Title Type'], year: number(row.Year),
      genres: row.Genres?.split(',').map(s => s.trim()).filter(Boolean) ?? [], poster: '',
      runtime: number(row['Runtime (mins)']), director: row.Directors?.split(',').map(s => s.trim()).filter(Boolean),
      personalRating: rating, imdbRating: number(row['IMDb Rating']),
      status: watchlist ? 'watchlist' : rating ? 'watched' : 'unknown', statusInferred: !watchlist && !!rating || undefined,
      dateAdded: date(row.Created), dateRated: date(row['Date Rated']),
      imdbUrl: `https://www.imdb.com/title/${id}/`, releaseDate: date(row['Release Date']),
      frameColor: hash(id) % 3 ? '#3f3931' : '#9c8867', accentColor: '#b29b72', dominantColor: '#756b5e',
    } as ScreenTitle];
  });
}
export async function run(path: string) {
  await loadEnv();
  const rows = await readCsv(path);
  // Generic IMDb lists do not encode watched status. Explicitly opt into watchlist semantics.
  const watchlist = process.argv.includes('--watchlist') || /watchlist/i.test(path);
  const screen = normalizeScreen(rows, watchlist);
  const token = process.env.TMDB_READ_ACCESS_TOKEN, key = process.env.TMDB_API_KEY;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const tmdb = (endpoint: string) => {
    if (!token && !key) return Promise.resolve(undefined);
    const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
    if (!token && key) url.searchParams.set('api_key', key);
    return request(url.toString(), headers);
  };
  const config = await tmdb('configuration');
  const image = (path: string | null, size: string, sizes?: string[]) => path && config?.images?.secure_base_url && sizes?.includes(size) ? config.images.secure_base_url + size + path : '';
  const report = { input: rows.length, imported: screen.length, skipped: rows.length - screen.length, enriched: 0, artwork: 0, unresolved: [] as string[], ambiguous: [] as string[] };
  for (const item of screen) {
    const found = await tmdb(`find/${item.imdbId}?external_source=imdb_id`);
    const expected = item.type === 'series' ? found?.tv_results : found?.movie_results;
    if (expected?.length > 1) report.ambiguous.push(item.id);
    if (expected?.length === 1) {
      const match = expected[0], kind = item.type === 'series' ? 'tv' : 'movie';
      const details = await tmdb(`${kind}/${match.id}?append_to_response=credits`);
      const data = details ?? match;
      item.tmdbId = match.id; item.synopsis = data.overview || undefined;
      item.genres = data.genres?.map((g: any) => g.name) ?? item.genres;
      item.releaseDate ??= data.release_date || data.first_air_date || undefined;
      item.runtime ??= data.runtime || data.episode_run_time?.[0] || undefined;
      item.director = item.director?.length ? item.director : data.credits?.crew?.filter((p: any) => p.job === 'Director').map((p: any) => p.name);
      item.creator = data.created_by?.map((p: any) => p.name);
      item.seasons = data.number_of_seasons; item.episodes = data.number_of_episodes;
      if (data.status === 'Ended' && data.last_air_date) item.endYear = Number(data.last_air_date.slice(0, 4));
      const art = await artwork(image(data.poster_path, 'w500', config?.images?.poster_sizes), item.id, 'screen');
      if (art) { item.poster = art.url; item.dominantColor = art.dominantColor; item.accentColor = art.band; report.artwork++; }
      const backdrop = await artwork(image(data.backdrop_path, 'w780', config?.images?.backdrop_sizes), item.id, 'backdrops');
      if (backdrop) item.backdrop = backdrop.url;
      report.enriched++;
    } else report.unresolved.push(item.id);
    console.log(`Screen ${item.id}: ${item.tmdbId ? 'matched' : 'CSV metadata retained'}`);
  }
  await writeData('src/data/screen.ts', 'screen', screen); await summary('screen', report);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path || path.startsWith('--')) throw new Error('Usage: npm run import:screen -- <csv-path> [--watchlist] [--offline]');
  await run(path);
}
