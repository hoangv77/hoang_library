import { useEffect, useMemo, useRef, useState } from 'react';
import snapshot from '../data/music-membership.json';
import type { Album, MusicTrack } from '../lib/musicTypes';
import { mergeMusicMembership, validateMembership, type AlbumRecord, type AlbumSearchResult } from '../lib/musicMembership';

const endpoint = '/__archive/music-membership';
export type AlbumInput = { title: string; artist: string; year?: number; artwork?: string; trackTitles?: string[]; metadataId?: string };
export function useMusicCollection(albums: Album[], tracks: MusicTrack[], local: boolean) {
  const [state, setState] = useState(() => validateMembership(snapshot));
  const [ready, setReady] = useState(!local), [error, setError] = useState('');
  const token = useRef(''), changed = useRef(false);
  async function read() {
    const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Could not load album membership. Reload to retry.');
    const data = await response.json();
    if (typeof data.token !== 'string') throw new Error('Local album editing is unavailable.');
    token.current = data.token;
    if (!changed.current) setState(validateMembership(data.state));
    setReady(true); setError('');
  }
  useEffect(() => { if (local) void read().catch(error => setError(error.message)); }, [local]);
  const post = async (payload: unknown) => {
    if (!local) throw new Error('The public archive is read-only.');
    if (!token.current) await read();
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Archive-Token': token.current }, body: JSON.stringify(payload), signal: AbortSignal.timeout(180000) });
    const data = await response.json();
    if (!response.ok) { if (response.status === 403) token.current = ''; throw new Error(data.error || 'Could not save album membership. Your draft is preserved.'); }
    return data;
  };
  const persist = async (payload: unknown) => {
    const saved = validateMembership(await post(payload));
    changed.current = true; setState(saved); setError(''); return saved;
  };
  const visible = useMemo(() => mergeMusicMembership(albums, tracks, state), [albums, tracks, state]);
  return { ...visible, state, ready, error,
    search: (title: string, artist: string): Promise<AlbumSearchResult[]> => post({ action: 'search', title, artist }),
    async resolve(id: string): Promise<AlbumRecord> {
      const record = await post({ action: 'resolve', id });
      return validateMembership({ manual: [record], excluded: [] }).manual[0];
    },
    add: (value: AlbumInput) => persist({ action: 'add', ...value }),
    remove: (id: string) => persist({ action: 'remove', id }),
    restore: (id: string) => persist({ action: 'restore', id }),
  };
}
export type MusicController = ReturnType<typeof useMusicCollection>;
