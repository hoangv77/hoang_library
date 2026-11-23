import type { Book } from '../data/books';
import type { ScreenTitle } from '../data/screen';
import type { Album, MusicTrack } from './musicTypes';

export type CurrentlyActive = {
  reading: { bookId: string; pageNumber?: number; pageImage?: string } | null;
  watching: { screenId: string; seasonNumber?: number; episodeNumber?: number } | null;
  playing: { albumId: string; trackId?: string } | null;
};
export type ActiveCategory = keyof CurrentlyActive;
export type Episode = { screenId: string; seasonNumber: number; episodeNumber: number; title: string; description: string; airDate?: string; still?: string; sourceStillPath?: string };
export type ActiveCollections = { books: Book[]; screen: ScreenTitle[]; albums: Album[]; tracks: MusicTrack[]; episodes?: Episode[] };
export const emptyActive: CurrentlyActive = { reading: null, watching: null, playing: null };
const id = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,180}$/.test(value);
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid current selection.');
  return value as Record<string,unknown>;
};
export const safePageImage = (path: unknown): path is string => typeof path === 'string' && /^\/page-images\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|avif)$/.test(path);
const whole = (value: unknown, minimum: number, maximum: number) => typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;

export function validateCurrentSelection<K extends ActiveCategory>(category: K, input: unknown, collections?: ActiveCollections): CurrentlyActive[K] {
  if (input === null) return null;
  const value = object(input);
  if (category === 'reading') {
    if (!id(value.bookId)) throw new Error('Choose a valid book.');
    const book = collections?.books.find(item => item.id === value.bookId);
    if (collections && !book) throw new Error('That book is not in the current collection. The saved reference can still be recovered.');
    if (value.pageNumber !== undefined && !whole(value.pageNumber,1,book?.editionPageCount ?? Number.MAX_SAFE_INTEGER)) throw new Error('Choose a valid page within the known edition page count.');
    if (value.pageImage !== undefined && !safePageImage(value.pageImage)) throw new Error('Use a local image path such as /page-images/book-page.webp.');
    return { bookId: value.bookId, ...(value.pageNumber !== undefined ? {pageNumber:value.pageNumber} : {}), ...(value.pageImage ? {pageImage:value.pageImage} : {}) } as CurrentlyActive[K];
  }
  if (category === 'watching') {
    if (!id(value.screenId)) throw new Error('Choose a valid movie or series.');
    const item = collections?.screen.find(item => item.id === value.screenId);
    if (collections && !item) throw new Error('That title is not in the current collection.');
    if (item && item.type !== 'series' && (value.seasonNumber !== undefined || value.episodeNumber !== undefined)) throw new Error('Movies do not have season or episode selections.');
    if (value.seasonNumber !== undefined && !whole(value.seasonNumber,0,item?.seasons ?? Number.MAX_SAFE_INTEGER)) throw new Error('Choose a valid season.');
    if (value.episodeNumber !== undefined && (!whole(value.episodeNumber,1,Number.MAX_SAFE_INTEGER) || value.seasonNumber === undefined)) throw new Error('Choose a season and a valid episode.');
    if (collections && value.episodeNumber !== undefined && !collections.episodes?.some(ep => ep.screenId === value.screenId && ep.seasonNumber === value.seasonNumber && ep.episodeNumber === value.episodeNumber)) throw new Error('Load and select an episode belonging to this season first.');
    return { screenId:value.screenId, ...(value.seasonNumber !== undefined?{seasonNumber:value.seasonNumber}:{}), ...(value.episodeNumber !== undefined?{episodeNumber:value.episodeNumber}:{}) } as CurrentlyActive[K];
  }
  if (category !== 'playing' || !id(value.albumId) || (value.trackId !== undefined && !id(value.trackId))) throw new Error('Choose a valid album and song.');
  const album = collections?.albums.find(item=>item.id===value.albumId);
  if (collections && !album) throw new Error('That album is not in the current collection.');
  if (collections && value.trackId !== undefined && !collections.tracks.some(track=>track.id===value.trackId&&track.albumId===value.albumId)) throw new Error('Choose a song belonging to the selected album.');
  return {albumId:value.albumId,...(value.trackId?{trackId:value.trackId}:{})} as CurrentlyActive[K];
}
export function validateCurrentlyActive(input: unknown): CurrentlyActive {
  const value=object(input);
  return {reading:validateCurrentSelection('reading',value.reading),watching:validateCurrentSelection('watching',value.watching),playing:validateCurrentSelection('playing',value.playing)};
}
