import type { SupabaseClient } from '@supabase/supabase-js';
import { validateOverride, type MediaOverride } from './personalization';

export interface ArchiveBackend {
  readOverrides(): Promise<MediaOverride[]>;
  saveOverride(value: MediaOverride): Promise<MediaOverride>;
  isOwner(): Promise<boolean>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  subscribeAuth(listener: (userId: string | null) => void): () => void;
}

const columns = 'media_type,media_id,is_favorite,personal_comment,rating_is_overridden,personal_rating,updated_at';
export function persistenceError(error: unknown, operation: 'read' | 'save' | 'auth') {
  const code = (error as { code?: string })?.code;
  if (code === '42501' || code === 'PGRST301' || code === 'PGRST303') return new Error('Owner access could not be verified. Sign in again before saving. Your draft is still here.');
  if (code === '23514') return new Error('The change did not pass validation. Check the comment length and rating.');
  if (operation === 'read') return new Error('Personal notes are temporarily unavailable. The imported collection is still available.');
  if (operation === 'auth') return new Error('Sign-in failed. Check your credentials and connection, then try again.');
  return new Error('The change could not be saved. Check your connection and try again. Your draft is still here.');
}

export function createArchiveBackend(client: SupabaseClient): ArchiveBackend {
  let initialRead: Promise<MediaOverride[]> | undefined;
  async function read() {
    const result: MediaOverride[] = [];
    // One request for normal collections; paginate instead of silently truncating large archives.
    for (let offset = 0; offset < 100000; offset += 1000) {
      const { data, error } = await client.from('media_overrides').select(columns).order('media_type').order('media_id').range(offset, offset + 999).abortSignal(AbortSignal.timeout(15000));
      if (error || !data) throw persistenceError(error, 'read');
      result.push(...data as MediaOverride[]);
      if (data.length < 1000) return result;
    }
    throw persistenceError(undefined, 'read');
  }
  return {
    readOverrides() {
      // Deduplicate React Strict Mode's development mount. Failed reads can be retried explicitly.
      initialRead ??= read().catch(error => { initialRead = undefined; throw error; });
      return initialRead;
    },
    async saveOverride(value) {
      const payload = validateOverride(value);
      try {
        const { data, error } = await client.from('media_overrides').upsert(payload, { onConflict: 'media_type,media_id' }).select(columns).abortSignal(AbortSignal.timeout(15000)).single();
        if (error || !data) throw error;
        validateOverride(data as MediaOverride);
        // The next mount/reload must read persisted data rather than an old initial snapshot.
        initialRead = undefined;
        return data as MediaOverride;
      } catch (error) { throw persistenceError(error, 'save'); }
    },
    async isOwner() {
      const { data, error } = await client.rpc('is_archive_owner').abortSignal(AbortSignal.timeout(10000));
      if (error) throw new Error('Owner authorization is unavailable. Try checking access again.');
      return data === true;
    },
    async signIn(email, password) {
      try {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } catch (error) { throw persistenceError(error, 'auth'); }
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw new Error('Could not sign out. Check your connection and try again.');
    },
    subscribeAuth(listener) {
      // Keep the callback synchronous; make authorization requests from a separate React effect.
      const { data } = client.auth.onAuthStateChange((_event, session) => listener(session?.user.id ?? null));
      return () => data.subscription.unsubscribe();
    },
  };
}
