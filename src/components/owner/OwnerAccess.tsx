import { useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ArchiveBackend } from '../../lib/archiveBackend';
import type { OwnerStatus } from '../../hooks/useArchive';
import { useDialogFocus } from '../../hooks/useDialogFocus';

export function OwnerAccess({ backend, configurationError, status, ownerError, editMode, onEditMode, recheckOwner, onClose, notesReady = true, notesError = '', retryNotes }: {
  backend: ArchiveBackend | null; configurationError: string | null; status: OwnerStatus; ownerError: string;
  editMode: boolean; onEditMode: (enabled: boolean) => void; recheckOwner: () => void; onClose: () => void;
  notesReady?: boolean; notesError?: string; retryNotes?: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null), pending = useRef(false);
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useDialogFocus(dialog);
  const close = () => { if (!pending.current) onClose(); };
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!backend || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await backend.signIn(email, password); setPassword(''); }
    catch (error) { setError((error as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  async function signOut() {
    if (!backend || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await backend.signOut(); }
    catch (error) { setError((error as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  return createPortal(<div className="owner-overlay">
    <div className="owner-backdrop" onClick={close} aria-hidden="true" />
    <div className="owner-dialog" role="dialog" aria-modal="true" aria-labelledby="owner-title" ref={dialog} tabIndex={-1} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <button className="owner-close" aria-label="Close owner access" onClick={close} disabled={busy}>×</button>
      <p className="eyebrow mono">Private editing</p><h2 id="owner-title">Owner access</h2>
      {!backend ? <p>{configurationError || 'This archive is read-only.'}</p> : <>
        {status === 'signed-out' && <form onSubmit={submit} className="owner-sign-in">
          <p>Sign in with the manually provisioned owner account.</p>
          <label htmlFor="owner-email">Email</label><input id="owner-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required disabled={busy} />
          <label htmlFor="owner-password">Password</label><input id="owner-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} />
          <button className="quiet-button" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>}
        {status === 'checking' && <p role="status">Checking owner access…</p>}
        {status === 'owner' && <><p>You’re signed in as the archive owner. Open a title to edit its favorite, comment, or personal rating.</p>
          {!notesReady && <p role="status">{notesError || 'Loading saved notes before editing…'}</p>}
          {!notesReady && notesError && retryNotes && <button className="text-button" onClick={retryNotes}>Try loading notes again</button>}
          <button className="quiet-button" onClick={() => { onEditMode(!editMode); onClose(); }} disabled={busy || !notesReady}>{editMode ? 'Leave edit mode' : 'Enter edit mode'}</button></>}
        {status === 'other' && <p>This account does not have owner access. The archive remains read-only.</p>}
        {status === 'error' && <><p role="alert">{ownerError}</p><button className="text-button" onClick={recheckOwner} disabled={busy}>Check access again</button></>}
        {status !== 'signed-out' && <button className="text-button sign-out" onClick={signOut} disabled={busy}>{busy ? 'Please wait…' : 'Sign out'}</button>}
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </div>, document.body);
}
