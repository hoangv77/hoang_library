import type { ScreenTitle } from '../../src/data/screen';
import { validateOverride, type MediaOverride } from '../../src/lib/personalization';

// The new export owns membership, with an exception for absent titles carrying
// personal work. Keep those records so their stable-ID overrides remain visible.
export function reconcileScreen(incoming: ScreenTitle[], previous: ScreenTitle[], overrides: MediaOverride[]) {
  const ids = new Set(incoming.map(item => item.id));
  const oldIds = new Set(previous.map(item => item.id));
  const editedIds = new Set(overrides.map(validateOverride)
    .filter(row => row.media_type === 'screen' && (row.is_favorite || row.personal_comment || row.rating_is_overridden))
    .map(row => row.media_id));
  const missing = previous.filter(item => !ids.has(item.id));
  const hasPersonalWork = (item: ScreenTitle) => editedIds.has(item.id) || (Number.isInteger(item.personalRating) && item.personalRating! >= 1 && item.personalRating! <= 10);
  const retained = missing.filter(hasPersonalWork);
  const removed = missing.filter(item => !hasPersonalWork(item));
  return {
    items: [...incoming, ...retained],
    added: incoming.filter(item => !oldIds.has(item.id)),
    matched: incoming.filter(item => oldIds.has(item.id)),
    retained, removed,
  };
}
