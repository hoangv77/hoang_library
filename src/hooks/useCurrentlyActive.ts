import { useCallback, useEffect, useRef, useState } from 'react';
import initial from '../data/currently-active.json';
import episodeSnapshot from '../data/tv-episodes.json';
import { validateCurrentlyActive, type ActiveCategory, type CurrentlyActive, type Episode } from '../lib/currentlyActive';

const endpoint = '/__archive/currently-active';
export function useCurrentlyActive(local: boolean) {
  const [active, setActive] = useState(() => validateCurrentlyActive(initial));
  const [episodes, setEpisodes] = useState<Record<string, Episode[]>>(episodeSnapshot);
  const [error, setError] = useState('');
  const token = useRef(''), changed = useRef(false);
  const read = useCallback(async () => {
    const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Could not load local current selections.');
    const data = await response.json();
    if (typeof data.token !== 'string') throw new Error('Local editing is unavailable.');
    token.current = data.token;
    if (!changed.current) { setActive(validateCurrentlyActive(data.active)); setEpisodes(data.episodes); }
  }, []);
  useEffect(() => { if (local) void read().catch(error => setError(error.message)); }, [local, read]);
  const post = async (payload: unknown) => {
    if (!local) throw new Error('The deployed archive is read-only.');
    if (!token.current) await read();
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Archive-Token': token.current }, body: JSON.stringify(payload), signal: AbortSignal.timeout(180000) });
    const data = await response.json();
    if (!response.ok) { if (response.status === 403) token.current = ''; throw new Error(data.error || 'Could not save. Your draft is still here.'); }
    return data;
  };
  return { active, episodes, error,
    forgetPlayingAlbum(id: string) {
      // Called only after the server confirms the exclusion and active clear.
      changed.current = true;
      setActive(previous => previous.playing?.albumId === id ? { ...previous, playing: null } : previous);
    },
    async save<K extends ActiveCategory>(category: K, selection: CurrentlyActive[K]) {
      const saved = validateCurrentlyActive(await post({ category, selection }));
      changed.current = true; setActive(saved); setError('');
      if (category === 'watching' && saved.watching?.episodeNumber !== undefined) {
        // Saving downloads only the chosen still, rather than every episode in
        // a potentially very large season. Refresh the confirmed metadata.
        try {
          const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
          if (response.ok) { const data = await response.json(); setEpisodes(data.episodes); }
        } catch { /* Existing series artwork stays an honest fallback. */ }
      }
      return saved;
    },
    async loadEpisodes(screenId: string, season: number): Promise<Episode[]> {
      const rows: Episode[] = await post({ action: 'episodes', screenId, season });
      setEpisodes(previous => ({ ...previous, [`${screenId}:${season}`]: rows })); return rows;
    },
  };
}
export type ActiveController = ReturnType<typeof useCurrentlyActive>;
