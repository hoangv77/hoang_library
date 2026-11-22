import { createClient } from '@supabase/supabase-js';
import { createArchiveBackend } from './archiveBackend';
import { browserSafeKey, validProjectUrl } from './supabaseConfig';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const configurationError = !url || !key
  ? 'Persistent editing requires Supabase configuration. The archive is currently read-only.'
  : !validProjectUrl(url) || !browserSafeKey(key)
    ? 'The Supabase public configuration is invalid. The archive is currently read-only.' : null;

export const archiveBackend = !configurationError && url && key
  ? createArchiveBackend(createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'hoang-library-owner-session' },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([AbortSignal.timeout(15000), ...(init?.signal ? [init.signal] : [])]) }) },
  })) : null;
