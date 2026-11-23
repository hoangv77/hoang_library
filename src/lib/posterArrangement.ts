import type { PersonalScreenTitle } from './personalization';

// Column-major slots: upper, lower. The first five columns surround the heading.
// Keep the middle upper frames for last, where the heading naturally obscures them.
export function arrangePosterWall(items: PersonalScreenTitle[]): string[] {
  const favorites = items.filter(item => item.isFavorite);
  if (!favorites.length) return items.map(item => item.id);
  const columns = Math.ceil(items.length / 2);
  const center = Math.min(2, Math.floor((columns - 1) / 2));
  const priority: number[] = [];
  const add = (column: number, row: number) => {
    const slot = column * 2 + row;
    if (column >= 0 && column < columns && slot < items.length && !priority.includes(slot)) priority.push(slot);
  };
  // Lower center, then its left/right neighbors and the two outside lower frames.
  for (const column of [center, center - 1, center + 1, center - 2, center + 2]) add(column, 1);
  for (const column of [center - 2, center + 2]) add(column, 0);
  // The rail loops: the last columns are immediately to the left of the opening.
  for (let distance = 3; distance <= columns; distance++) {
    const left = (center - distance + columns) % columns;
    const right = (center + distance) % columns;
    for (const row of [1, 0]) { add(left, row); add(right, row); }
  }
  for (let slot = 0; slot < items.length; slot++) if (!priority.includes(slot)) priority.push(slot);
  const arranged: Array<string | undefined> = Array(items.length);
  favorites.forEach((item, index) => { arranged[priority[index]] = item.id; });
  const remaining = items.filter(item => !item.isFavorite);
  let next = 0;
  return Array.from(arranged, id => id ?? remaining[next++].id);
}
