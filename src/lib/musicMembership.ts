import type { Album, MusicTrack } from './musicTypes';
import { musicIdentity, musicName } from './musicIdentity';

export type AlbumRecord = { album: Album; tracks: MusicTrack[] };
export type MusicMembership = { manual: AlbumRecord[]; excluded: AlbumRecord[] };
export type AlbumSearchResult = { id: string; title: string; artist: string; year?: number; type?: string };
export const emptyMembership: MusicMembership = { manual: [], excluded: [] };
export const localAlbumImage = (value: string) => /^\/album-images\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|avif)$/.test(value);
const identifier = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,180}$/.test(value);
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid music membership file.');
  return value as Record<string, unknown>;
};
export function validateMembership(input: unknown): MusicMembership {
  const value = object(input);
  if (!Array.isArray(value.manual) || !Array.isArray(value.excluded) || value.manual.length > 5000 || value.excluded.length > 5000) throw new Error('Invalid music membership file.');
  function record(input: unknown): AlbumRecord {
    const value = object(input), album = object(value.album);
    const strings = ['genres', 'artistMbids', 'sourceAlbumMbids', 'sourceTitles', 'trackIds'];
    if (!identifier(album.id) || !identifier(album.artistId) || typeof album.title !== 'string' || !album.title.trim() || album.title.length > 300 || typeof album.artist !== 'string' || !album.artist.trim() || album.artist.length > 300 || typeof album.artwork !== 'string' || (album.artwork && !localAlbumImage(album.artwork) && !/^\/artwork\/music\/album-[a-f0-9]+\.webp$/.test(album.artwork)) || typeof album.lastPlayedAt !== 'string' || !Number.isSafeInteger(album.observedScrobbles) || (album.observedScrobbles as number) < 0 || !strings.every(key => Array.isArray(album[key]) && (album[key] as unknown[]).every(item => typeof item === 'string')) || !['observed', 'verified', 'provided'].includes(album.tracklistSource as string) || !['resolved', 'unresolved', 'ambiguous'].includes(album.metadataStatus as string) || !Array.isArray(value.tracks)) throw new Error('Invalid saved album.');
    const tracks = value.tracks.map(input => {
      const track = object(input);
      if (!identifier(track.id) || track.albumId !== album.id || typeof track.title !== 'string' || !track.title.trim() || track.title.length > 500 || !Number.isSafeInteger(track.observedScrobbles) || (track.observedScrobbles as number) < 0 || !Array.isArray(track.musicbrainzIds) || !track.musicbrainzIds.every(id => typeof id === 'string')) throw new Error('Invalid saved track.');
      return track as MusicTrack;
    });
    const ids = new Set(tracks.map(track => track.id));
    if (ids.size !== tracks.length || !(album.trackIds as string[]).every(id => ids.has(id)) || (album.verifiedTrackIds !== undefined && (!Array.isArray(album.verifiedTrackIds) || !album.verifiedTrackIds.every(id => typeof id === 'string' && ids.has(id))))) throw new Error('Invalid saved track references.');
    return { album: album as Album, tracks };
  }
  const result = { manual: value.manual.map(record), excluded: value.excluded.map(record) };
  for (const rows of [result.manual, result.excluded]) {
    if (new Set(rows.map(row => row.album.id)).size !== rows.length || new Set(rows.map(row => musicIdentity(row.album.artist, row.album.title))).size !== rows.length) throw new Error('Duplicate saved album.');
  }
  return result;
}

export function mergeMusicMembership(importedAlbums: Album[], importedTracks: MusicTrack[], membership: MusicMembership) {
  const albums = new Map(importedAlbums.map(album => [album.id, album]));
  const tracks = new Map(importedTracks.map(track => [track.id, track]));
  for (const record of membership.manual) {
    const observed = albums.get(record.album.id) ?? [...albums.values()].find(album => musicIdentity(album.artist, album.title) === musicIdentity(record.album.artist, record.album.title) || (!!record.album.musicbrainzId && record.album.musicbrainzId === album.musicbrainzId));
    const previousTracks = [...tracks.values()].filter(track => track.albumId === observed?.id);
    const manualNames = new Map(record.tracks.map(track => [musicName(track.title), track]));
    const mergedTracks = previousTracks.map(track => ({ ...track, ...manualNames.get(musicName(track.title)), albumId: record.album.id, observedScrobbles: track.observedScrobbles }));
    if (observed) albums.delete(observed.id);
    for (const track of previousTracks) tracks.delete(track.id);
    for (const track of mergedTracks) tracks.set(track.id, track);
    const trackIds = [...new Set([...record.album.trackIds, ...mergedTracks.map(track => track.id)])];
    albums.set(record.album.id, { ...record.album, trackIds, observedScrobbles: observed?.observedScrobbles ?? record.album.observedScrobbles, lastPlayedAt: observed?.lastPlayedAt || record.album.lastPlayedAt });
    for (const track of record.tracks) tracks.set(track.id, { ...track, observedScrobbles: tracks.get(track.id)?.observedScrobbles ?? track.observedScrobbles });
  }
  const excluded = new Set(membership.excluded.map(record => record.album.id));
  const excludedNames = new Set(membership.excluded.map(record => musicIdentity(record.album.artist, record.album.title)));
  const excludedGroups = new Set(membership.excluded.flatMap(record => record.album.musicbrainzId ? [record.album.musicbrainzId] : []));
  const visible = [...albums.values()].filter(album => !excluded.has(album.id) && !excludedNames.has(musicIdentity(album.artist, album.title)) && (!album.musicbrainzId || !excludedGroups.has(album.musicbrainzId)));
  const visibleIds = new Set(visible.map(album => album.id));
  return { albums: visible, tracks: [...tracks.values()].filter(track => visibleIds.has(track.albumId)) };
}
