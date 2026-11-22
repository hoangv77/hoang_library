import { test } from 'node:test';
import assert from 'node:assert/strict';
import { books } from '../src/data/books';
import { screen } from '../src/data/screen';
import { commentText, mergeCollections, validateOverride, type MediaOverride } from '../src/lib/personalization';
import { browserSafeKey, validProjectUrl } from '../src/lib/supabaseConfig';
import { normalizeBooks } from '../scripts/import-goodreads';
import { normalizeScreen } from '../scripts/import-imdb';

export const override = (changes: Partial<MediaOverride> = {}): MediaOverride => ({ media_type: 'book', media_id: books[0].id, is_favorite: true, personal_comment: 'A note.\nA second line.', rating_is_overridden: true, personal_rating: 5, ...changes });
test('favorites and comments merge by stable media type and ID without changing imports', () => {
  const original = JSON.stringify({ books, screen });
  const saved = [override(), override({ media_type: 'screen', media_id: screen[0].id, personal_rating: 7 })];
  const merged = mergeCollections(books, screen, saved);
  assert.equal(merged.books[0].isFavorite, true); assert.equal(merged.screen[0].isFavorite, true);
  assert.equal(merged.books[0].personalComment, 'A note.\nA second line.');
  assert.equal(merged.screen[0].personalRating, 7); assert.equal(merged.screen[0].imdbRating, screen[0].imdbRating);
  assert.equal(merged.books[1].isFavorite, false);
  assert.equal(JSON.stringify({ books, screen }), original);
  const reloaded = mergeCollections(books, screen, JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(reloaded, merged);
  const removed = mergeCollections(books, screen, [override({ is_favorite: false })]);
  assert.equal(removed.books[0].isFavorite, false);
  assert.equal(mergeCollections(books, screen, [override({ media_id: 'removed-title' })]).books[0].isFavorite, false);
});
test('rating overrides distinguish imported, rated, and explicitly unrated', () => {
  const base = [{ ...books[0], rating: 4 }];
  assert.equal(mergeCollections(base, [], [override()]).books[0].rating, 5);
  assert.equal(mergeCollections(base, [], [override({ personal_rating: null })]).books[0].rating, 0);
  assert.equal(mergeCollections(base, [], [override({ rating_is_overridden: false, personal_rating: null })]).books[0].rating, 4);
  assert.equal(mergeCollections([], screen, [override({ media_type: 'screen', media_id: screen[0].id, personal_rating: null })]).screen[0].personalRating, undefined);
});
test('comments normalize missing text and validate both rating scales', () => {
  for (const value of ['', ' \n ', null, undefined]) assert.equal(commentText(value), 'N/A');
  assert.equal(commentText('One\nTwo'), 'One\nTwo');
  assert.equal(validateOverride(override({ personal_comment: '   ' })).personal_comment, null);
  assert.throws(() => validateOverride(override({ personal_comment: 'a'.repeat(2001) })));
  for (const value of [0, 6, 4.5, NaN]) assert.throws(() => validateOverride(override({ personal_rating: value })));
  assert.equal(validateOverride(override({ media_type: 'screen', media_id: 'tt123', personal_rating: 10 })).personal_rating, 10);
  assert.throws(() => validateOverride(override({ media_type: 'screen', personal_rating: 11 })));
  assert.throws(() => validateOverride(override({ rating_is_overridden: false })));
});
test('CSV reimports keep stable IDs and cannot erase saved overrides', () => {
  const rows = [{ 'Book Id': '123', Title: 'A title', Author: 'An author', 'My Rating': '4', 'Exclusive Shelf': 'read' }];
  const imdb = [{ Const: 'tt123', Title: 'A film', 'Title Type': 'Movie', 'Your Rating': '8' }];
  const saved = [override({ media_id: 'gr-123' }), override({ media_type: 'screen', media_id: 'tt123', personal_rating: 10 })];
  const first = mergeCollections(normalizeBooks(rows), normalizeScreen(imdb), saved);
  const second = mergeCollections(normalizeBooks([...rows, ...rows]), normalizeScreen([...imdb, ...imdb]), saved);
  assert.deepEqual(first, second); assert.equal(second.books[0].rating, 5); assert.equal(second.screen[0].personalRating, 10);
});
test('public configuration rejects private keys and nonlocal HTTP URLs', () => {
  assert.equal(browserSafeKey('sb_publishable_example'), true); assert.equal(browserSafeKey('sb_secret_private'), false);
  const jwt = (role: string) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
  assert.equal(browserSafeKey(jwt('anon')), true); assert.equal(browserSafeKey(jwt('service_role')), false);
  assert.equal(validProjectUrl('https://example.supabase.co'), true); assert.equal(validProjectUrl('http://localhost:54321'), true);
  assert.equal(validProjectUrl('http://example.com'), false); assert.equal(validProjectUrl('https://user:pass@example.com'), false);
});
