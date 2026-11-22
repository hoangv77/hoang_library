import type { Book } from '../data/books';
import type { ScreenTitle } from '../data/screen';

export type MediaType = 'book' | 'screen';
export type MediaOverride = {
  media_type: MediaType;
  media_id: string;
  is_favorite: boolean;
  personal_comment: string | null;
  rating_is_overridden: boolean;
  personal_rating: number | null;
  updated_at?: string;
};
export type Personalization = {
  isFavorite?: boolean;
  personalComment?: string | null;
  ratingIsOverridden?: boolean;
};
export type PersonalBook = Book & Personalization;
export type PersonalScreenTitle = ScreenTitle & Personalization;
export const commentText = (comment?: string | null) => comment?.trim() || 'N/A';
export const overrideKey = (type: MediaType, id: string) => `${type}:${id}`;

export function validateOverride(input: unknown): MediaOverride {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid collection override.');
  const value = input as Record<string, unknown>;
  if ((value.media_type !== 'book' && value.media_type !== 'screen') || typeof value.media_id !== 'string' || !/^[a-zA-Z0-9_-]{1,180}$/.test(value.media_id)) throw new Error('This title has an invalid collection identifier.');
  if (typeof value.is_favorite !== 'boolean' || typeof value.rating_is_overridden !== 'boolean') throw new Error('Invalid favorite or rating setting.');
  if (value.personal_comment !== null && typeof value.personal_comment !== 'string') throw new Error('Comments must be plain text.');
  // PostgreSQL char_length counts Unicode code points rather than UTF-16 units.
  if (Array.from(value.personal_comment ?? '').length > 2000) throw new Error('Personal comments must be 2,000 characters or fewer.');
  const maximum = value.media_type === 'book' ? 5 : 10;
  if (value.personal_rating !== null && (typeof value.personal_rating !== 'number' || !Number.isInteger(value.personal_rating) || value.personal_rating < 1 || value.personal_rating > maximum)) throw new Error(`Choose a whole-number rating from 1 to ${maximum}.`);
  if (!value.rating_is_overridden && value.personal_rating !== null) throw new Error('An imported rating cannot also have an override value.');
  return { media_type: value.media_type, media_id: value.media_id, is_favorite: value.is_favorite,
    personal_comment: value.personal_comment?.trim() || null, rating_is_overridden: value.rating_is_overridden,
    personal_rating: value.personal_rating };
}

export function mergeCollections(books: Book[], screen: ScreenTitle[], overrides: MediaOverride[]) {
  const indexed = new Map<string, MediaOverride>();
  for (const override of overrides) {
    try { validateOverride(override); indexed.set(overrideKey(override.media_type, override.media_id), override); }
    catch { /* Invalid remote records cannot replace the static collection. */ }
  }
  const fields = (row?: MediaOverride) => ({ isFavorite: row?.is_favorite ?? false, personalComment: row?.personal_comment?.trim() || null, ratingIsOverridden: row?.rating_is_overridden ?? false });
  return {
    books: books.map(book => {
      const row = indexed.get(overrideKey('book', book.id));
      return { ...book, ...fields(row), rating: row?.rating_is_overridden ? row.personal_rating ?? 0 : book.rating };
    }),
    screen: screen.map(item => {
      const row = indexed.get(overrideKey('screen', item.id));
      return { ...item, ...fields(row), personalRating: row?.rating_is_overridden ? row.personal_rating ?? undefined : item.personalRating };
    }),
  };
}
