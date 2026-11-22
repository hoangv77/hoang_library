import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BookRatingEditor } from '../shared/BookRating';
import { validateOverride, type MediaOverride, type MediaType, type Personalization } from '../../lib/personalization';

type Draft = Pick<MediaOverride, 'is_favorite' | 'personal_comment' | 'rating_is_overridden' | 'personal_rating'>;
const fields = (item: Personalization, rating?: number): Draft => ({
  is_favorite: item.isFavorite ?? false, personal_comment: item.personalComment || '',
  rating_is_overridden: item.ratingIsOverridden ?? false, personal_rating: item.ratingIsOverridden ? rating || null : null,
});
export function OwnerEditor({ type, id, item, rating, importedRating, canEdit, save, setNavigationGuard }: {
  type: MediaType; id: string; item: Personalization; rating?: number; importedRating?: number; canEdit: boolean;
  save: (value: MediaOverride) => Promise<MediaOverride>;
  setNavigationGuard: (guard: (() => boolean) | null) => void;
}) {
  const [baseline, setBaseline] = useState(() => fields(item, rating));
  const [draft, setDraft] = useState(baseline), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [success, setSuccess] = useState('');
  const pending = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useEffect(() => {
    // Remote data may arrive while an overlay is open; never replace a dirty draft.
    if (dirty || pending.current) return;
    const latest = fields(item, rating);
    if (JSON.stringify(latest) !== JSON.stringify(baseline)) { setBaseline(latest); setDraft(latest); }
  }, [item.isFavorite, item.personalComment, item.ratingIsOverridden, rating, baseline, dirty]);
  useEffect(() => {
    setNavigationGuard(dirty || saving ? () => !pending.current && window.confirm('Discard unsaved changes to this title?') : null);
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    if (dirty) window.addEventListener('beforeunload', unload);
    return () => { setNavigationGuard(null); window.removeEventListener('beforeunload', unload); };
  }, [dirty, saving, setNavigationGuard]);
  const update = (change: Partial<Draft>) => { setDraft(previous => ({ ...previous, ...change })); setError(''); setSuccess(''); };
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending.current || !canEdit) return;
    try {
      const payload = validateOverride({ media_type: type, media_id: id, ...draft });
      pending.current = true; setSaving(true); setError(''); setSuccess('');
      const saved = await save(payload);
      const persisted: Draft = { is_favorite: saved.is_favorite, personal_comment: saved.personal_comment || '', rating_is_overridden: saved.rating_is_overridden, personal_rating: saved.personal_rating };
      setBaseline(persisted); setDraft(persisted); setSuccess('Changes saved.');
    } catch (error) { setError((error as Error).message); }
    finally { pending.current = false; setSaving(false); }
  }
  if (!canEdit && !dirty && !saving) return null;
  const previewRating = draft.rating_is_overridden ? draft.personal_rating ?? undefined : importedRating;
  return <form className="owner-editor" onSubmit={submit} aria-label="Edit this title">
    <h3 className="mono">Edit this title</h3>
    {!canEdit && <p role="status">Owner access must be verified before saving. Your draft is preserved.</p>}
    <fieldset disabled={saving}>
      <legend className="sr-only">Title personalization</legend>
      <label className="favorite-toggle"><input type="checkbox" checked={draft.is_favorite} onChange={e => update({ is_favorite: e.target.checked })} />Personal favorite / highly recommended</label>
      <label htmlFor="personal-comment">Personal comments</label>
      <textarea id="personal-comment" rows={5} maxLength={2000} value={draft.personal_comment ?? ''} onChange={e => update({ personal_comment: e.target.value })} />
      <p className="field-note">{Array.from(draft.personal_comment ?? '').length} / 2,000 characters · visible to visitors after saving</p>
      <div className="editor-rating">
        <span className="field-label">My rating</span>
        {type === 'book' ? <>
          <BookRatingEditor rating={previewRating} onChange={value => update({ rating_is_overridden: true, personal_rating: value })} disabled={saving} />
          <p className="field-note">{draft.rating_is_overridden ? previewRating ? `${previewRating}/5 · custom rating` : 'Intentionally unrated' : `Imported rating · ${importedRating ? `${importedRating}/5` : 'Unrated'}`}</p>
          <div className="rating-options"><button type="button" className="text-button" onClick={() => update({ rating_is_overridden: false, personal_rating: null })}>Use imported rating</button><button type="button" className="text-button" onClick={() => update({ rating_is_overridden: true, personal_rating: null })}>Mark unrated</button></div>
        </> : <label className="screen-rating-select"><span className="sr-only">Personal screen rating</span><select value={!draft.rating_is_overridden ? 'imported' : draft.personal_rating ?? 'unrated'} onChange={e => update({ rating_is_overridden: e.target.value !== 'imported', personal_rating: ['imported', 'unrated'].includes(e.target.value) ? null : Number(e.target.value) })}>
          <option value="imported">Use imported rating ({importedRating ? `${importedRating}/10` : 'Unrated'})</option><option value="unrated">Unrated</option>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}/10</option>)}
        </select></label>}
      </div>
    </fieldset>
    <div className="editor-actions"><button className="quiet-button" type="submit" disabled={saving || !canEdit || !dirty}>{saving ? 'Saving…' : 'Save changes'}</button><button type="button" className="text-button" disabled={saving} onClick={() => { setDraft(baseline); setError(''); setSuccess(''); }}>Cancel changes</button></div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <p role="status" className="save-status">{saving ? 'Saving…' : success}</p>
  </form>;
}
