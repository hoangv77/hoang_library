import type { PersonalScreenTitle } from './personalization';

// The rail aligns this order's first canonical frame to its visible left inset.
export function arrangePosterWall(items: PersonalScreenTitle[]): string[] {
  return [...items.filter(item => item.isFavorite), ...items.filter(item => !item.isFavorite)].map(item => item.id);
}
