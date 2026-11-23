import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screen } from '../src/data/screen';
import type { ScreenTitle } from '../src/data/screen';
import type { MediaOverride } from '../src/lib/personalization';
import { mergeCollections } from '../src/lib/personalization';
import { reconcileScreen } from '../scripts/utils/reconcile-screen';

const title = (id: string, rating?: number): ScreenTitle => ({ ...screen[0], id, imdbId: id, personalRating: rating });
const edit = (id: string, change: Partial<MediaOverride>): MediaOverride => ({ media_type: 'screen', media_id: id,
  is_favorite: false, personal_comment: null, rating_is_overridden: false, personal_rating: null, ...change });

test('replacement retains absent favorites, comments, custom/unrated ratings and existing personal ratings', () => {
  const previous = ['shared', 'favorite', 'comment', 'custom', 'unrated', 'rated', 'empty', 'removed'].map(id => title(id, id === 'rated' ? 8 : undefined));
  const incoming = [title('new', 9), title('shared', 7)];
  const overrides = [edit('favorite', { is_favorite: true }), edit('comment', { personal_comment: 'Keep my note' }),
    edit('custom', { rating_is_overridden: true, personal_rating: 6 }), edit('unrated', { rating_is_overridden: true }),
    edit('empty', {}), edit('shared', { is_favorite: true, personal_comment: 'Still here', rating_is_overridden: true, personal_rating: 10 })];
  const before = JSON.stringify({ previous, incoming, overrides });
  const result = reconcileScreen(incoming, previous, overrides);
  assert.deepEqual(result.items.map(item => item.id), ['new', 'shared', 'favorite', 'comment', 'custom', 'unrated', 'rated']);
  assert.deepEqual(result.removed.map(item => item.id), ['empty', 'removed']);
  assert.deepEqual(result.added.map(item => item.id), ['new']);
  assert.deepEqual(result.matched.map(item => item.id), ['shared']);
  const merged = mergeCollections([], result.items, overrides).screen;
  assert.equal(merged.find(item => item.id === 'shared')?.personalRating, 10);
  assert.equal(merged.find(item => item.id === 'shared')?.personalComment, 'Still here');
  assert.equal(merged.find(item => item.id === 'comment')?.personalComment, 'Keep my note');
  assert.equal(merged.find(item => item.id === 'unrated')?.personalRating, undefined);
  assert.equal(JSON.stringify({ previous, incoming, overrides }), before);
});

test('book edits and blank screen override records do not retain unrelated titles', () => {
  const previous = [title('book-only'), title('blank')];
  const result = reconcileScreen([], previous, [edit('book-only', { media_type: 'book', is_favorite: true }), edit('blank', { personal_comment: '  ' })]);
  assert.deepEqual(result.items, []);
  assert.equal(result.removed.length, 2);
  assert.throws(() => reconcileScreen([], previous, [edit('blank', { personal_rating: 11 })]));
});
