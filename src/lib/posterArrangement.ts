import type { PersonalScreenTitle } from './personalization';

// Column-major source slots. The central pair sits side by side below the TV.
// Pick the nearest upper slots first, then assign favorites from left to right.
export function arrangePosterWall(items: PersonalScreenTitle[]): string[] {
  const favorites = items.filter(item => item.isFavorite);
  if (!favorites.length) return items.map(item => item.id);
  const columns = Math.ceil(items.length / 2);
  const center = Math.min(2, Math.floor((columns - 1) / 2));
  const upper: Array<{ slot: number; x: number }> = [], lower: typeof upper = [];
  for (let column = 0; column < columns; column++) {
    if (column === center) {
      for (const row of [0, 1]) if (column * 2 + row < items.length) lower.push({ slot: column * 2 + row, x: row - .5 });
      continue;
    }
    let offset = column - center;
    // The previous segment's last frames are immediately left of the opening.
    if (items.length > 18) {
      if (offset > Math.floor((columns - 1) / 2)) offset -= columns;
      if (offset < -Math.ceil((columns - 1) / 2)) offset += columns;
    }
    const x = offset + Math.sign(offset) * .5;
    upper.push({ slot: column * 2, x });
    if (column * 2 + 1 < items.length) lower.push({ slot: column * 2 + 1, x });
  }
  const nearest = (slots: typeof upper, count: number) => [...slots]
    .sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || a.x - b.x)
    .slice(0, count).sort((a, b) => a.x - b.x);
  const priority = [...nearest(upper, favorites.length), ...nearest(lower, Math.max(0, favorites.length - upper.length))];
  const arranged: Array<string | undefined> = Array(items.length);
  favorites.forEach((item, index) => { arranged[priority[index].slot] = item.id; });
  const remaining = items.filter(item => !item.isFavorite);
  let next = 0;
  return Array.from(arranged, id => id ?? remaining[next++].id);
}
