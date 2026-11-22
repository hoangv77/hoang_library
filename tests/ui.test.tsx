import './helpers/dom';
import React from 'react';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen as ui, cleanup, fireEvent, waitFor, act, renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { BookRating, BookRatingEditor } from '../src/components/shared/BookRating';
import { PersonalComments } from '../src/components/shared/PersonalComments';
import { OwnerEditor } from '../src/components/owner/OwnerEditor';
import { OwnerAccess } from '../src/components/owner/OwnerAccess';
import { DetailOverlay } from '../src/components/shared/DetailOverlay';
import { BookShelf } from '../src/components/books/BookShelf';
import { PosterWall } from '../src/components/screen/PosterWall';
import { books } from '../src/data/books';
import { screen } from '../src/data/screen';
import { useArchive } from '../src/hooks/useArchive';
import { mergeCollections, type MediaOverride } from '../src/lib/personalization';
import { TestBackend } from './helpers/backend';

afterEach(() => { cleanup(); document.body.innerHTML = ''; });
const makeRow = (change: Partial<MediaOverride> = {}): MediaOverride => ({ media_type: 'book', media_id: books[0].id, is_favorite: true, personal_comment: 'My note', rating_is_overridden: true, personal_rating: 5, ...change });

test('book ratings render one through five filled SVG stars and accessible values', () => {
  for (let rating = 1; rating <= 5; rating++) {
    const html = renderToStaticMarkup(<BookRating rating={rating} />);
    assert.equal((html.match(/rating-star filled/g) ?? []).length, rating);
    assert.equal((html.match(/<svg/g) ?? []).length, 5);
    assert.ok(html.includes(`aria-label="${rating} out of 5 stars"`));
  }
  assert.ok(renderToStaticMarkup(<BookRating rating={0} />).includes('Unrated'));
  const selected: number[] = [];
  render(<BookRatingEditor rating={3} onChange={value => selected.push(value)} />);
  fireEvent.keyDown(ui.getByRole('radio', { name: '3 out of 5 stars' }), { key: 'ArrowRight' });
  fireEvent.keyDown(ui.getByRole('radio', { name: '4 out of 5 stars' }), { key: 'End' });
  assert.deepEqual(selected, [4, 5]);
});

test('comments support missing, multiline, long, and untrusted plain text', () => {
  const view = render(<PersonalComments comment={' \n '} />);
  assert.ok(ui.getByText('N/A'));
  const unsafe = '<img src=x onerror=alert(1)>\n<script>alert(1)</script>';
  view.rerender(<PersonalComments comment={unsafe} />);
  assert.equal(view.container.querySelector('p')?.textContent, unsafe);
  assert.equal(view.container.querySelectorAll('script,img').length, 0);
  view.rerender(<PersonalComments comment={'A'.repeat(2000)} />);
  assert.equal(view.container.querySelector('p')?.textContent?.length, 2000);
});

test('favorite appearance and labels reach every visual copy without changing artwork colors', () => {
  const merged = mergeCollections(books, screen, [makeRow(), makeRow({ media_type: 'screen', media_id: screen[0].id })]);
  const bookMarkup = renderToStaticMarkup(<BookShelf items={merged.books} onOpen={() => {}} />);
  const posterMarkup = renderToStaticMarkup(<PosterWall items={merged.screen} onOpen={() => {}} />);
  assert.equal((bookMarkup.match(/is-favorite/g) ?? []).length, 1);
  assert.equal((posterMarkup.match(/is-favorite/g) ?? []).length, 3);
  assert.ok(bookMarkup.includes(`--spine:${books[0].spine}`));
  assert.ok(posterMarkup.includes('personal favorite'));
  const css = readFileSync('src/styles.css', 'utf8');
  assert.ok(css.includes('.book-target.is-favorite .spine-face'));
  assert.ok(css.includes('.poster-target.is-favorite:hover .poster-frame'));
  assert.ok(css.includes('.detail-art.is-favorite'));
});

test('owner editor saves favorite, multiline comment, and five-point rating only after confirmation', async () => {
  let saved: MediaOverride | undefined;
  render(<OwnerEditor type="book" id={books[0].id} item={{}} rating={4} importedRating={4} canEdit save={async value => { saved = value; return value; }} setNavigationGuard={() => {}} />);
  fireEvent.click(ui.getByRole('checkbox'));
  fireEvent.change(ui.getByLabelText('Personal comments'), { target: { value: 'A favorite.\nWorth returning to.' } });
  fireEvent.click(ui.getByRole('radio', { name: '5 out of 5 stars' }));
  fireEvent.click(ui.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => assert.ok(ui.getByText('Changes saved.')));
  assert.equal(saved?.is_favorite, true); assert.equal(saved?.personal_rating, 5);
  assert.equal(saved?.personal_comment, 'A favorite.\nWorth returning to.');
  assert.equal(ui.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled'), true);
});

test('resetting ratings, intentionally unrated, removing comments, and cancel behave distinctly', async () => {
  const saved: MediaOverride[] = [];
  const props = { type: 'book' as const, id: books[0].id, item: { isFavorite: true, personalComment: 'Old note', ratingIsOverridden: true }, rating: 5, importedRating: 4, canEdit: true, save: async (value: MediaOverride) => { saved.push(value); return value; }, setNavigationGuard: () => {} };
  const view = render(<OwnerEditor {...props} />);
  fireEvent.change(ui.getByLabelText('Personal comments'), { target: { value: 'Temporary' } });
  fireEvent.click(ui.getByRole('button', { name: 'Cancel changes' }));
  assert.equal((ui.getByLabelText('Personal comments') as HTMLTextAreaElement).value, 'Old note');
  fireEvent.click(ui.getByRole('button', { name: 'Use imported rating' }));
  fireEvent.change(ui.getByLabelText('Personal comments'), { target: { value: '  ' } });
  fireEvent.click(ui.getByRole('checkbox'));
  fireEvent.click(ui.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => assert.equal(saved.length, 1));
  assert.equal(saved[0].rating_is_overridden, false); assert.equal(saved[0].personal_rating, null);
  assert.equal(saved[0].personal_comment, null); assert.equal(saved[0].is_favorite, false);
  view.unmount();
  render(<OwnerEditor {...props} />);
  fireEvent.click(ui.getByRole('button', { name: 'Mark unrated' }));
  fireEvent.click(ui.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => assert.equal(saved.length, 2));
  assert.equal(saved[1].rating_is_overridden, true); assert.equal(saved[1].personal_rating, null);
});

test('screen editor keeps a ten-point scale and has no external rating control', async () => {
  let saved: MediaOverride | undefined;
  render(<OwnerEditor type="screen" id={screen[0].id} item={{}} importedRating={8} canEdit save={async value => { saved = value; return value; }} setNavigationGuard={() => {}} />);
  fireEvent.change(ui.getByLabelText('Personal screen rating'), { target: { value: '10' } });
  fireEvent.click(ui.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => assert.equal(saved?.personal_rating, 10));
  assert.equal(ui.queryByLabelText('IMDb community rating'), null);
});

test('failed saves retain drafts; duplicate submits are blocked; expired access does not discard edits', async () => {
  let rejectSave: (error: Error) => void = () => {};
  let writes = 0;
  let guard: (() => boolean) | null = null;
  const setGuard = (value: (() => boolean) | null) => { guard = value; };
  const props = { type: 'book' as const, id: books[0].id, item: {}, canEdit: true, save: () => { writes++; return new Promise<MediaOverride>((_, reject) => { rejectSave = reject; }); }, setNavigationGuard: setGuard };
  const view = render(<OwnerEditor {...props} />);
  fireEvent.change(ui.getByLabelText('Personal comments'), { target: { value: 'Keep this draft' } });
  window.confirm = () => false;
  assert.equal((guard as unknown as () => boolean)(), false);
  fireEvent.submit(ui.getByRole('form', { name: 'Edit this title' }));
  fireEvent.submit(ui.getByRole('form', { name: 'Edit this title' }));
  assert.equal(writes, 1);
  await act(async () => rejectSave(new Error('Connection unavailable. Your draft is still here.')));
  assert.ok(ui.getByRole('alert').textContent?.includes('draft'));
  assert.equal((ui.getByLabelText('Personal comments') as HTMLTextAreaElement).value, 'Keep this draft');
  view.rerender(<OwnerEditor {...props} canEdit={false} />);
  assert.equal((ui.getByLabelText('Personal comments') as HTMLTextAreaElement).value, 'Keep this draft');
  assert.equal(ui.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled'), true);
});

test('detail editing owns arrow keys, traps focus, and guards close and next actions', async () => {
  let navigations = 0, closes = 0;
  const element = document.createElement('button'); document.body.append(element);
  render(<DetailOverlay selection={{ kind: 'book', index: 0, rect: new DOMRect(20, 400, 25, 230), element }} books={books} screen={screen} onClose={() => { closes++; }} onChange={() => { navigations++; }} canEdit importedRating={4} save={async value => value} />);
  const textarea = ui.getByRole('textbox', { name: 'Personal comments' });
  fireEvent.change(textarea, { target: { value: 'Unsaved' } });
  fireEvent.keyDown(textarea, { key: 'ArrowRight' }); assert.equal(navigations, 0);
  fireEvent.keyDown(ui.getByRole('radio', { name: '4 out of 5 stars' }), { key: 'ArrowLeft' }); assert.equal(navigations, 0);
  window.confirm = () => false;
  fireEvent.click(ui.getByRole('button', { name: 'Next' }));
  fireEvent.click(ui.getByRole('button', { name: 'Close details and return to archive' }));
  assert.equal(navigations, 0); assert.equal(closes, 0);
  const close = ui.getByRole('button', { name: 'Close details and return to archive' }); close.focus();
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true }); assert.equal(document.activeElement, ui.getByRole('button', { name: 'Next' }));
  window.confirm = () => true;
  fireEvent.click(ui.getByRole('button', { name: 'Next' })); assert.equal(navigations, 1);
});

test('owner access supports sign-in, edit mode, sign-out, and denies a non-owner', async () => {
  const backend = new TestBackend();
  function Harness() {
    const archive = useArchive(books, screen, backend);
    return <><output>{archive.editMode ? 'Editing enabled' : 'Read only'}</output><OwnerAccess backend={backend} configurationError={null} status={archive.ownerStatus} ownerError={archive.ownerError} editMode={archive.editMode} onEditMode={archive.setEditMode} recheckOwner={archive.recheckOwner} onClose={() => {}} /></>;
  }
  render(<Harness />);
  fireEvent.change(ui.getByLabelText('Email'), { target: { value: 'owner@example.test' } });
  fireEvent.change(ui.getByLabelText('Password'), { target: { value: 'test-only-password' } });
  fireEvent.click(ui.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Enter edit mode' })));
  fireEvent.click(ui.getByRole('button', { name: 'Enter edit mode' }));
  assert.ok(ui.getByText('Editing enabled'));
  fireEvent.click(ui.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => assert.ok(ui.getByLabelText('Email')));
  assert.ok(ui.getByText('Read only'));
  fireEvent.change(ui.getByLabelText('Email'), { target: { value: 'other@example.test' } });
  fireEvent.change(ui.getByLabelText('Password'), { target: { value: 'test-only-password' } });
  fireEvent.click(ui.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => assert.ok(ui.getByText(/does not have owner access/)));
  assert.equal(ui.queryByRole('button', { name: 'Enter edit mode' }), null);
});

test('restored owner session can persist edits across remounts without resetting unrelated collection state', async () => {
  const backend = new TestBackend(); backend.identity = 'owner';
  const first = renderHook(() => useArchive(books, screen, backend));
  await waitFor(() => assert.equal(first.result.current.ownerStatus, 'owner'));
  const before = first.result.current.books;
  act(() => first.result.current.setEditMode(true));
  assert.equal(first.result.current.books, before);
  await act(async () => { await first.result.current.save(makeRow()); });
  assert.equal(first.result.current.books[0].isFavorite, true);
  first.unmount();
  const second = renderHook(() => useArchive(books, screen, backend));
  await waitFor(() => assert.equal(second.result.current.books[0].isFavorite, true));
  assert.equal(second.result.current.books[0].personalComment, 'My note');
  assert.equal(second.result.current.books[0].rating, 5);
});

test('read failures and absent configuration preserve the static collection and fail closed', async () => {
  const backend = new TestBackend(); backend.readOverrides = async () => { backend.reads++; throw new Error('Offline'); };
  const configured = renderHook(() => useArchive(books, screen, backend));
  await waitFor(() => assert.ok(configured.result.current.loadError));
  assert.equal(configured.result.current.books.length, books.length); assert.equal(backend.reads, 1);
  await assert.rejects(configured.result.current.save(makeRow()), /owner/);
  configured.unmount();
  const unconfigured = renderHook(() => useArchive(books, screen, null));
  assert.equal(unconfigured.result.current.ownerStatus, 'signed-out');
  assert.equal(unconfigured.result.current.books[0].isFavorite, false);
  render(<OwnerAccess backend={null} configurationError="Persistent editing requires Supabase configuration." status="signed-out" ownerError="" editMode={false} onEditMode={() => {}} recheckOwner={() => {}} onClose={() => {}} />);
  assert.ok(ui.getByText(/Persistent editing requires/)); assert.equal(ui.queryByLabelText('Password'), null);
});

test('stale authorization responses cannot enable editing after the account changes', async () => {
  const backend = new TestBackend(); backend.identity = 'owner';
  let resolveOwner: (value: boolean) => void = () => {};
  backend.isOwner = () => backend.identity === 'owner' ? new Promise<boolean>(resolve => { resolveOwner = resolve; }) : Promise.resolve(false);
  const view = renderHook(() => useArchive(books, screen, backend));
  assert.equal(view.result.current.ownerStatus, 'checking');
  act(() => backend.emit('other'));
  await waitFor(() => assert.equal(view.result.current.ownerStatus, 'other'));
  await act(async () => resolveOwner(true));
  assert.equal(view.result.current.ownerStatus, 'other');
  act(() => view.result.current.setEditMode(true));
  assert.equal(view.result.current.editMode, false);
});

test('editing waits for existing overrides and slow reads cannot replace confirmed saves', async () => {
  const backend = new TestBackend(); backend.identity = 'owner';
  let finishRead: (rows: MediaOverride[]) => void = () => {};
  backend.readOverrides = () => new Promise(resolve => { finishRead = resolve; });
  const view = renderHook(() => useArchive(books, screen, backend));
  await waitFor(() => assert.equal(view.result.current.ownerStatus, 'owner'));
  act(() => view.result.current.setEditMode(true));
  assert.equal(view.result.current.editMode, false);
  await assert.rejects(view.result.current.save(makeRow()), /notes to load/);
  await act(async () => finishRead([makeRow({ personal_comment: 'Previously saved note' })]));
  assert.equal(view.result.current.books[0].personalComment, 'Previously saved note');
  act(() => view.result.current.setEditMode(true));
  assert.equal(view.result.current.editMode, true);
  act(() => view.result.current.retryLoad());
  await act(async () => { await view.result.current.save(makeRow({ personal_comment: 'Newest confirmed note' })); });
  await act(async () => finishRead([makeRow({ personal_comment: 'Stale read snapshot' })]));
  assert.equal(view.result.current.books[0].personalComment, 'Newest confirmed note');
});
