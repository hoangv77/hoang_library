import { useSyncExternalStore } from 'react';

// Shared breakpoint for responsive layout and vertical wheel propagation.
export const COMPACT_LAYOUT_QUERY = '(max-width: 1023px)';
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(COMPACT_LAYOUT_QUERY);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
export function useCompactLayout() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(COMPACT_LAYOUT_QUERY).matches, () => false);
}
