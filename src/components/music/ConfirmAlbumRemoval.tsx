import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../../hooks/useDialogFocus';

export function ConfirmAlbumRemoval({ title, busy, error, onCancel, onConfirm }: { title: string; busy: boolean; error: string; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDivElement>(null); useDialogFocus(dialog);
  const cancel = () => { if (!busy) onCancel(); };
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); cancel(); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  return createPortal(<div className="owner-overlay confirmation-overlay"><div className="owner-backdrop" onClick={cancel} aria-hidden="true" /><div className="owner-dialog removal-confirmation" ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby="removal-title" aria-describedby="removal-description" tabIndex={-1}>
    <p className="eyebrow mono">Collection membership</p><h2 id="removal-title">Remove this album?</h2><p id="removal-description">Remove “{title}” from your collection? You can restore it from Add Album. Its saved ratings and comments will be kept.</p>
    <div className="editor-actions"><button className="quiet-button" disabled={busy} onClick={onConfirm}>{busy ? 'Removing…' : 'Remove album'}</button><button className="text-button" disabled={busy} onClick={cancel}>Keep album</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div></div>, document.body);
}
