import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Book } from '../data/books';
import type { ScreenTitle } from '../data/screen';
import type { ArchiveBackend } from '../lib/archiveBackend';
import { mergeCollections, overrideKey, type MediaOverride } from '../lib/personalization';

export type OwnerStatus = 'signed-out' | 'checking' | 'owner' | 'other' | 'error';
export function useArchive(baseBooks: Book[], baseScreen: ScreenTitle[], backend: ArchiveBackend | null, snapshot: MediaOverride[] = []) {
  const [overrides, setOverrides] = useState<MediaOverride[]>(snapshot);
  const baseline = useRef(snapshot);
  const [loadError, setLoadError] = useState('');
  const [readAttempt, setReadAttempt] = useState(0);
  const [overridesReady, setOverridesReady] = useState(!backend);
  const confirmedWrites = useRef(new Map<string, MediaOverride>());
  const [identity, setIdentity] = useState<{ id: string | null; revision: number }>({ id: null, revision: 0 });
  const [ownerStatus, setOwnerStatus] = useState<OwnerStatus>(backend ? 'checking' : 'signed-out');
  const [ownerError, setOwnerError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!backend) return;
    let current = true;
    backend.readOverrides().then(rows => { if (current) {
      // A slow read must not overwrite a save that has already been confirmed.
      setOverrides([...baseline.current, ...rows.filter(row => !confirmedWrites.current.has(overrideKey(row.media_type, row.media_id))), ...confirmedWrites.current.values()]);
      setOverridesReady(true); setLoadError('');
    } })
      .catch(() => { if (current) setLoadError('Personal notes are temporarily unavailable. The imported collection is still available.'); });
    return () => { current = false; };
  }, [backend, readAttempt]);

  useEffect(() => {
    if (!backend) return;
    return backend.subscribeAuth(id => {
      // Drop edit permissions synchronously on every auth event, including token refresh.
      setOwnerStatus(id ? 'checking' : 'signed-out');
      if (!id) setEditMode(false);
      setIdentity(previous => ({ id, revision: previous.revision + 1 }));
    });
  }, [backend]);
  useEffect(() => {
    if (!backend || !identity.id) return;
    let current = true;
    setOwnerStatus('checking'); setOwnerError('');
    backend.isOwner().then(owner => {
      if (!current) return;
      setOwnerStatus(owner ? 'owner' : 'other');
      if (!owner) setEditMode(false);
    }).catch(error => { if (current) { setOwnerStatus('error'); setOwnerError(error.message); } });
    return () => { current = false; };
  }, [backend, identity]);

  const save = useCallback(async (value: MediaOverride) => {
    if (!backend || ownerStatus !== 'owner') throw new Error('Sign in as the owner before saving. Your draft is still here.');
    if (!overridesReady) throw new Error('Wait for saved notes to load before editing this collection.');
    const saved = await backend.saveOverride(value);
    if (mounted.current) {
      confirmedWrites.current.set(overrideKey(saved.media_type, saved.media_id), saved);
      setOverrides(previous => [...previous.filter(row => overrideKey(row.media_type, row.media_id) !== overrideKey(saved.media_type, saved.media_id)), saved]);
    }
    return saved;
  }, [backend, ownerStatus, overridesReady]);
  const collections = useMemo(() => mergeCollections(baseBooks, baseScreen, overrides), [baseBooks, baseScreen, overrides]);
  return { ...collections, overrides, save, ownerStatus, ownerError, overridesReady, editMode: editMode && ownerStatus === 'owner' && overridesReady,
    setEditMode: (enabled: boolean) => setEditMode(enabled && ownerStatus === 'owner' && overridesReady),
    loadError, retryLoad: () => setReadAttempt(n => n + 1),
    recheckOwner: () => setIdentity(previous => ({ ...previous, revision: previous.revision + 1 })),
  };
}
