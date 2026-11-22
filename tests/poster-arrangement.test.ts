import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrangePosterWall } from '../src/lib/posterArrangement';
import { screen } from '../src/data/screen';
import type { PersonalScreenTitle } from '../src/lib/personalization';

const fixture = (count: number, favorites: number[]) => Array.from({ length: count }, (_, index): PersonalScreenTitle => ({
  ...screen[index % screen.length], id: `title-${index}`, isFavorite: favorites.includes(index),
}));

test('favorites fill the five lower opening frames, then the upper outside frames', () => {
  const items = fixture(49, [12, 17, 24, 30, 32, 36, 40, 41, 42]);
  const arranged = arrangePosterWall(items);
  const slots = [5, 3, 7, 1, 9, 0, 8, 11, 48];
  // An odd last column has no lower frame; the next available outside lower slot is 11.
  items.filter(item => item.isFavorite).forEach((item, index) => assert.equal(arranged[slots[index]], item.id));
  assert.equal(arranged.length, items.length);
  assert.equal(new Set(arranged).size, items.length);
});

test('arrangement is deterministic, preserves nonfavorite order, and does not drop small or odd collections', () => {
  for (let count = 0; count <= 60; count++) {
    for (const favorites of [[], [0], [0, 2, 5, 8], Array.from({ length: count }, (_, i) => i)]) {
      const items = fixture(count, favorites);
      const before = structuredClone(items);
      const arranged = arrangePosterWall(items);
      assert.deepEqual(arranged, arrangePosterWall(items));
      assert.deepEqual([...arranged].sort(), items.map(item => item.id).sort());
      const favoriteIds = new Set(items.filter(item => item.isFavorite).map(item => item.id));
      assert.deepEqual(arranged.filter(id => !favoriteIds.has(id)), items.filter(item => !item.isFavorite).map(item => item.id));
      assert.deepEqual(items, before);
      if (!favoriteIds.size) assert.deepEqual(arranged, items.map(item => item.id));
    }
  }
});
