import type { ArchiveBackend } from '../../src/lib/archiveBackend';
import { overrideKey, validateOverride, type MediaOverride } from '../../src/lib/personalization';

// Test fixture only. Production authentication always uses Supabase Auth + PostgreSQL RLS.
export class TestBackend implements ArchiveBackend {
  rows = new Map<string, MediaOverride>();
  identity: string | null = null;
  listeners = new Set<(id: string | null) => void>();
  reads = 0; writes = 0;
  async readOverrides() { this.reads++; return [...this.rows.values()]; }
  async saveOverride(value: MediaOverride) {
    if (this.identity !== 'owner') throw new Error('Not authorized');
    this.writes++;
    const saved = validateOverride(value);
    this.rows.set(overrideKey(saved.media_type, saved.media_id), saved);
    return saved;
  }
  async isOwner() { return this.identity === 'owner'; }
  emit(id: string | null) { this.identity = id; this.listeners.forEach(listener => listener(id)); }
  async signIn(email: string, password: string) {
    if (password !== 'test-only-password') throw new Error('Sign-in failed');
    this.emit(email === 'owner@example.test' ? 'owner' : 'other');
  }
  async signOut() { this.emit(null); }
  subscribeAuth(listener: (id: string | null) => void) { this.listeners.add(listener); listener(this.identity); return () => { this.listeners.delete(listener); }; }
}
