import { lstat, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { albums as importedAlbums, tracks as importedTracks } from '../src/data/music';
import { books } from '../src/data/books';
import { screen } from '../src/data/screen';
import { emptyMembership, localAlbumImage, mergeMusicMembership, validateMembership, type AlbumRecord, type MusicMembership, type AlbumSearchResult } from '../src/lib/musicMembership';
import { musicIdentity } from '../src/lib/musicIdentity';
import { manualAlbum, manualTrack, enrichAlbum } from './import-music';
import { request } from './utils/cache';
import type { createActiveStore } from './active-store';

const headers = { 'User-Agent': 'HoangLibrary/1.0 (https://github.com/hoangv77/hoang_library)', Accept: 'application/json' };
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
const text = (value: unknown, name: string, maximum = 300) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) throw new Error(`Enter a valid ${name}.`);
  return value.trim();
};
const lucene = (value: string) => value.replace(/[+\-!(){}\[\]^"~*?:\\/]/g, '\\$&');
export async function searchAlbums(title: unknown, artist: unknown): Promise<AlbumSearchResult[]> {
  const query = `releasegroup:"${lucene(text(title, 'album title'))}" AND artist:"${lucene(text(artist, 'artist'))}"`;
  const data = await request('https://musicbrainz.org/ws/2/release-group/?' + new URLSearchParams({ query, limit: '12', fmt: 'json' }), headers);
  if (!data || !Array.isArray(data['release-groups'])) throw new Error('Album search is unavailable. You can enter the album manually below.');
  return data['release-groups'].flatMap((group: any) => {
    const name = (group['artist-credit'] ?? []).map((credit: any) => (credit.name || credit.artist?.name || '') + (credit.joinphrase || '')).join('');
    return uuid(group.id) && group.title && name ? [{ id: group.id, title: group.title, artist: name, year: Number(group['first-release-date']?.slice(0, 4)) || undefined, type: group['primary-type'] }] : [];
  });
}
export async function resolveAlbum(id: unknown): Promise<AlbumRecord> {
  if (!uuid(id)) throw new Error('Select a valid metadata result.');
  const group = await request(`https://musicbrainz.org/ws/2/release-group/${id}?inc=artists+releases+genres&fmt=json`, headers);
  const artist = (group?.['artist-credit'] ?? []).map((credit: any) => (credit.name || credit.artist?.name || '') + (credit.joinphrase || '')).join('');
  if (group?.id !== id || !group.title || !artist) throw new Error('That album could not be resolved. Enter its details manually instead.');
  const album = manualAlbum(text(group.title, 'album title'), text(artist, 'artist'));
  // Search results are explicitly chosen by the owner; the selected group is
  // still checked against both artist and title before any release is accepted.
  const result = await enrichAlbum(album, [], request, id);
  result.album.musicbrainzId = id;
  result.album.year ??= Number(group['first-release-date']?.slice(0, 4)) || undefined;
  result.album.genres = result.album.genres.length ? result.album.genres : (group.genres ?? []).map((genre: any) => genre.name).filter((name: unknown) => typeof name === 'string');
  return result;
}

type ActiveStore = ReturnType<typeof createActiveStore>;
export function createMusicStore(root: string, active: Pick<ActiveStore, 'withPlayingRemoval'>, imported = { albums: importedAlbums, tracks: importedTracks }) {
  const filename = path.resolve(root, 'src/data/music-membership.json');
  let writes: Promise<unknown> = Promise.resolve();
  async function read(): Promise<MusicMembership> {
    try {
      const stat = await lstat(filename);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 * 1024) throw new Error('Invalid membership file.');
      return validateMembership(JSON.parse(await readFile(filename, 'utf8')));
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(emptyMembership); throw error; }
  }
  async function persist(state: MusicMembership) {
    await read();
    const output = JSON.stringify(validateMembership(state), null, 2) + '\n';
    if (Buffer.byteLength(output) > 8 * 1024 * 1024) throw new Error('The membership file is too large.');
    const temporary = `${filename}.${randomBytes(8).toString('hex')}.tmp`;
    try { await writeFile(temporary, output, { flag: 'wx' }); await rename(temporary, filename); }
    finally { await unlink(temporary).catch(() => {}); }
  }
  const serialize = <T,>(operation: () => Promise<T>) => { const task = writes.then(operation); writes = task.catch(() => {}); return task; };
  const collision = (record: AlbumRecord, visible: ReturnType<typeof mergeMusicMembership>['albums']) => visible.some(album => album.id === record.album.id || musicIdentity(album.artist, album.title) === musicIdentity(record.album.artist, record.album.title) || (!!album.musicbrainzId && album.musicbrainzId === record.album.musicbrainzId));
  return {
    read,
    async collections() { return { books, screen, ...mergeMusicMembership(imported.albums, imported.tracks, await read()) }; },
    add(input: Record<string, unknown>) {
      return serialize(async () => {
        const state = await read();
        const title = text(input.title, 'album title'), artist = text(input.artist, 'artist');
        let record = input.metadataId ? await resolveAlbum(input.metadataId) : { album: manualAlbum(title, artist), tracks: [] };
        if (musicIdentity(record.album.artist, record.album.title) !== musicIdentity(artist, title)) throw new Error('The selected metadata no longer matches the entered title and artist. Search again or use manual entry.');
        record.album.title = title; record.album.artist = artist;
        if (input.year !== undefined && input.year !== '') {
          if (typeof input.year !== 'number' || !Number.isInteger(input.year) || input.year < 1000 || input.year > 9999) throw new Error('Enter a valid release year.');
          record.album.year = input.year;
        }
        if (input.artwork) {
          if (typeof input.artwork !== 'string' || !localAlbumImage(input.artwork)) throw new Error('Use an existing /album-images/filename.webp local image.');
          const stat = await lstat(path.resolve(root, 'public' + input.artwork));
          if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('The album image must be a local file.');
          record.album.artwork = input.artwork;
        }
        if (input.trackTitles !== undefined) {
          if (!Array.isArray(input.trackTitles) || input.trackTitles.length > 500) throw new Error('Enter up to 500 track titles.');
          const provided = input.trackTitles.map(title => text(title, 'track title', 500));
          // Preserve verified duration/order/IDs if the owner has not edited the list.
          if (JSON.stringify(provided) !== JSON.stringify(record.tracks.map(track => track.title))) {
            record.tracks = provided.map((title, index) => ({ ...manualTrack(record.album.id, title), trackNumber: index + 1 }));
            if (new Set(record.tracks.map(track => track.id)).size !== record.tracks.length) throw new Error('Duplicate track titles are not supported in a manual tracklist.');
            record.album.trackIds = record.tracks.map(track => track.id); delete record.album.verifiedTrackIds;
            record.album.tracklistSource = 'provided';
          }
        }
        record.album.origin = 'manual';
        const visible = mergeMusicMembership(imported.albums, imported.tracks, state).albums;
        if (collision(record, visible)) throw new Error('This album is already in your collection.');
        state.manual = [...state.manual.filter(item => item.album.id !== record.album.id && musicIdentity(item.album.artist, item.album.title) !== musicIdentity(artist, title) && (!record.album.musicbrainzId || item.album.musicbrainzId !== record.album.musicbrainzId)), record];
        state.excluded = state.excluded.filter(item => item.album.id !== record.album.id && musicIdentity(item.album.artist, item.album.title) !== musicIdentity(artist, title) && (!record.album.musicbrainzId || item.album.musicbrainzId !== record.album.musicbrainzId));
        await persist(state); return state;
      });
    },
    remove(id: unknown) {
      return serialize(async () => {
        const state = await read(), visible = mergeMusicMembership(imported.albums, imported.tracks, state);
        const album = visible.albums.find(album => album.id === id);
        if (!album) {
          if (state.excluded.some(record => record.album.id === id)) { await active.withPlayingRemoval(id as string, async () => {}); return state; }
          throw new Error('That album is not in the collection.');
        }
        state.excluded.push({ album, tracks: visible.tracks.filter(track => track.albumId === id) });
        await active.withPlayingRemoval(album.id, () => persist(state));
        return state;
      });
    },
    restore(id: unknown) {
      return serialize(async () => {
        const state = await read(), record = state.excluded.find(record => record.album.id === id);
        if (!record) throw new Error('That album is not in the removed collection.');
        if (collision(record, mergeMusicMembership(imported.albums, imported.tracks, state).albums)) throw new Error('This album is already in your collection.');
        if (!imported.albums.some(album => album.id === id) && !state.manual.some(item => item.album.id === id)) state.manual.push(record);
        state.excluded = state.excluded.filter(item => item.album.id !== id);
        await persist(state); return state;
      });
    },
  };
}
