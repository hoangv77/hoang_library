import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrangePosterWall } from '../src/lib/posterArrangement';
import { screen } from '../src/data/screen';
import type { PersonalScreenTitle } from '../src/lib/personalization';

const fixture = (count: number, favorites: number[]) => Array.from({ length: count }, (_, index): PersonalScreenTitle => ({
  ...screen[index % screen.length], id: `title-${index}`, isFavorite: favorites.includes(index),
}));

test('favorites fill upper frames beside the TV from left to right, including wrapped neighbors', () => {
  const items = fixture(49, [12, 17, 24, 30, 32, 36, 40]);
  const arranged = arrangePosterWall(items);
  const slots = [46, 48, 0, 2, 6, 8, 10];
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

test('small favorite counts fill the closest flanks first; overflow reaches the row below the TV', () => {
  for (const [count, slots] of [[1,[2]], [2,[2,6]], [3,[0,2,6]], [4,[0,2,6,8]]] as const) {
    const items = fixture(49, Array.from({ length: count }, (_, i) => i + 12));
    const arranged = arrangePosterWall(items);
    items.filter(item => item.isFavorite).forEach((item, i) => assert.equal(arranged[slots[i]], item.id));
  }
  for (let count = 1; count <= 24; count++) {
    const items = fixture(49, Array.from({ length: count }, (_, i) => i));
    const favorites = new Set(items.filter(item => item.isFavorite).map(item => item.id));
    arrangePosterWall(items).forEach((id, slot) => { if (favorites.has(id)) { assert.equal(slot % 2, 0); assert.notEqual(slot, 4); } });
  }
  const items = fixture(49, Array.from({ length: 26 }, (_, i) => i));
  const favoriteIds = new Set(items.filter(item => item.isFavorite).map(item => item.id));
  const arranged = arrangePosterWall(items);
  assert.ok(favoriteIds.has(arranged[4]) && favoriteIds.has(arranged[5]));
});
