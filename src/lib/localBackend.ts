import type { ArchiveBackend } from './archiveBackend';
import { validateOverride, type MediaOverride } from './personalization';

export const localOverridesEndpoint = '/__archive/local-overrides';

// Used only by Vite development. Production has no corresponding write endpoint.
export function createLocalBackend(request: typeof fetch = fetch): ArchiveBackend {
  let token = '';
  let initialRead: Promise<MediaOverride[]> | undefined;
  async function read() {
    const response = await request(localOverridesEndpoint, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Local notes could not be loaded. Check that the development server is running.');
    const data = await response.json();
    if (!Array.isArray(data.overrides) || typeof data.token !== 'string') throw new Error('The local editing endpoint is unavailable.');
    const rows = data.overrides.map(validateOverride);
    token = data.token;
    return rows;
  }
  return {
    readOverrides() {
      initialRead ??= read().catch(error => { initialRead = undefined; throw error; });
      return initialRead;
    },
    async saveOverride(value) {
      const payload = validateOverride(value);
      try {
        if (!token) await read();
        const response = await request(localOverridesEndpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Archive-Token': token },
          body: JSON.stringify(payload), signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
          if (response.status === 403) { token = ''; initialRead = undefined; }
          throw new Error('Local save failed');
        }
        const saved = validateOverride(await response.json());
        initialRead = undefined;
        return saved;
      } catch { throw new Error('Could not save to the local overrides file. Check the development server and retry. Your draft is still here.'); }
    },
    async isOwner() { await this.readOverrides(); return true; },
    async signIn() { throw new Error('Local editing does not require sign-in.'); },
    async signOut() { /* There is no local authentication session. */ },
    subscribeAuth(listener) { listener('local-development'); return () => {}; },
  };
}
