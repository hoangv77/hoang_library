import './helpers/dom';
import React from 'react';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, renderHook, screen as ui, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { books } from '../src/data/books';
import { screen } from '../src/data/screen';
import { albums, tracks } from '../src/data/music';
import { emptyActive, type CurrentlyActive } from '../src/lib/currentlyActive';
import type { ActiveController } from '../src/hooks/useCurrentlyActive';
import { useMusicCollection, type MusicController } from '../src/hooks/useMusicCollection';
import { BookShelf } from '../src/components/books/BookShelf';
import { VinylShelf } from '../src/components/music/VinylShelf';
import { PosterWall } from '../src/components/screen/PosterWall';
import { CurrentEditor } from '../src/components/owner/CurrentEditor';
import { MusicManager } from '../src/components/music/MusicManager';
import { AlbumDetail } from '../src/components/music/AlbumDetail';
import { manualAlbum, manualTrack } from '../scripts/import-music';
import { emptyMembership, type MusicMembership } from '../src/lib/musicMembership';
import type { MediaOverride } from '../src/lib/personalization';

afterEach(() => { cleanup(); document.body.innerHTML = ''; });
const current = (active: CurrentlyActive = emptyActive): ActiveController => ({ active, episodes: {}, error: '', forgetPlayingAlbum() {}, save: async (category, selection) => ({ ...active, [category]: selection }), loadEpisodes: async () => [] });
test('current highlights coexist with favorites on the actual books, albums and framed posters', () => {
  let opened = -1;
  const book = { ...books[0], isFavorite: true }, album = { ...albums[0], isFavorite: true }, poster = { ...screen[0], isFavorite: true };
  const view = render(<><BookShelf items={[book]} currentId={book.id} onOpen={selection => { opened = selection.index; }} /><VinylShelf albums={[album]} currentId={album.id} onOpen={() => {}} /><PosterWall items={[poster]} currentId={poster.id} onOpen={() => {}} /></>);
  assert.equal(view.container.querySelectorAll('.is-current.is-favorite').length, 3);
  assert.ok(ui.getByRole('button', { name: /currently watching/ }));
  fireEvent.click(ui.getByRole('button', { name: /currently reading/ })); assert.equal(opened, 0);
  assert.equal(view.container.querySelector('.reading-stand'), null);
});

test('page-image controls and display are retired while reading progress is preserved', () => {
  const controller = current({ ...emptyActive, reading: { bookId: books[0].id, pageNumber: 22, pageImage: '/page-images/page-22.webp' } });
  const view = render(<CurrentEditor category="reading" item={books[0]} controller={controller} tracks={[]} canEdit={false} setNavigationGuard={() => {}} />);
  assert.ok(ui.getByText('Page 22')); assert.equal(ui.queryByAltText('Personally supplied book page'), null);
  view.rerender(<CurrentEditor category="reading" item={books[0]} controller={controller} tracks={[]} canEdit setNavigationGuard={() => {}} />);
  assert.equal(ui.queryByLabelText('Local page image'), null);
  assert.ok(ui.getByLabelText('Current page'));
});

test('the current poster details retain verified episode information and fall back to their own series artwork', () => {
  const series = screen.find(item => item.type === 'series' && item.poster)!;
  const controller = current({ ...emptyActive, watching: { screenId: series.id, seasonNumber: 1, episodeNumber: 2 } });
  controller.episodes[`${series.id}:1`] = [{ screenId: series.id, seasonNumber: 1, episodeNumber: 2, title: 'Saved episode', description: 'Verified description', still: '/artwork/episodes/missing.webp' }];
  render(<CurrentEditor category="watching" item={series} controller={controller} tracks={[]} canEdit={false} setNavigationGuard={() => {}} />);
  assert.ok(ui.getByText('Saved episode')); assert.ok(ui.getByText('Verified description'));
  fireEvent.error(ui.getByAltText('Still from Saved episode'));
  assert.ok(ui.getByAltText(`${series.title} series artwork`));
});

test('two-row posters keep one keyboard entry per record and open the correct item', () => {
  let opened = -1;
  const view = render(<PosterWall items={screen} currentId={screen[0].id} onOpen={selection => { opened = selection.index; }} />);
  assert.equal(view.container.querySelectorAll('.poster-column').length, Math.ceil(screen.length / 2) * 3);
  assert.equal(ui.getAllByRole('button', { name: /currently watching/ }).length, 1);
  fireEvent.click(ui.getByRole('button', { name: /currently watching/ })); assert.equal(opened, 0);
  assert.equal(view.container.querySelector('.watching-slot'), null);
});

test('production music hooks never issue membership requests or allow public mutations', async () => {
  const previous = globalThis.fetch; let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('Unexpected production request'); };
  try {
    const hook = renderHook(() => useMusicCollection(albums, tracks, false));
    await assert.rejects(hook.result.current.add({ title: 'Record', artist: 'Artist' }), /read-only/);
    await assert.rejects(hook.result.current.remove(albums[0].id), /read-only/);
    await assert.rejects(hook.result.current.restore(albums[0].id), /read-only/);
    assert.equal(requests, 0);
  } finally { globalThis.fetch = previous; }
});
test('local membership hook reports only confirmed writes and retains additions and exclusions across remounts', async () => {
  const previous = globalThis.fetch; let stored: MusicMembership = structuredClone(emptyMembership);
  const album = manualAlbum('A local album', 'Artist');
  globalThis.fetch = async (_url, init) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body as string);
      if (body.action === 'add') stored.manual = [{ album, tracks: [] }];
      if (body.action === 'remove') stored.excluded = [{ album, tracks: [] }];
      return Response.json(stored);
    }
    return Response.json({ state: stored, token: 'test-token' });
  };
  try {
    const first = renderHook(() => useMusicCollection(albums, tracks, true));
    await waitFor(() => assert.ok(first.result.current.ready));
    await act(async () => { await first.result.current.add({ title: album.title, artist: album.artist }); });
    assert.ok(first.result.current.albums.some(item => item.id === album.id)); first.unmount();
    const second = renderHook(() => useMusicCollection(albums, tracks, true));
    await waitFor(() => assert.ok(second.result.current.albums.some(item => item.id === album.id)));
    await act(async () => { await second.result.current.remove(album.id); }); second.unmount();
    const third = renderHook(() => useMusicCollection(albums, tracks, true));
    await waitFor(() => assert.equal(third.result.current.state.excluded.length, 1));
    assert.ok(!third.result.current.albums.some(item => item.id === album.id));
  } finally { globalThis.fetch = previous; }
});
test('album manager supports metadata selection, reviewed saving and removed-album restoration', async () => {
  const album = { ...manualAlbum('A record', 'Artist'), musicbrainzId: '00000000-0000-0000-0000-000000000001' };
  const track = manualTrack(album.id, 'A track'); album.trackIds = [track.id];
  let saved: unknown, restored = false;
  const controller: MusicController = { albums: [], tracks: [], state: { manual: [], excluded: [{ album, tracks: [track] }] }, ready: true, error: '', search: async () => [{ id: album.musicbrainzId, title: album.title, artist: album.artist }], resolve: async () => ({ album, tracks: [track] }), add: async value => { saved = value; return emptyMembership; }, remove: async () => emptyMembership, restore: async () => { restored = true; return emptyMembership; } };
  render(<MusicManager music={controller} onClose={() => {}} />);
  fireEvent.change(ui.getByLabelText('Album title'), { target: { value: album.title } }); fireEvent.change(ui.getByLabelText('Artist'), { target: { value: album.artist } });
  fireEvent.click(ui.getByRole('button', { name: 'Search albums' }));
  await waitFor(() => assert.ok(ui.getByRole('list', { name: 'Album search results' })));
  fireEvent.click(ui.getByRole('button', { name: 'Select A record by Artist' }));
  await waitFor(() => assert.ok(ui.getByText('Album details loaded. Review them, then save.')));
  assert.equal(saved, undefined); fireEvent.click(ui.getByRole('button', { name: 'Save album' }));
  await waitFor(() => assert.ok(saved)); assert.equal((saved as { metadataId: string }).metadataId, album.musicbrainzId);
  fireEvent.click(ui.getByRole('button', { name: 'Restore' })); await waitFor(() => assert.ok(restored));
});
test('album removal needs confirmation and remains unavailable to visitors', async () => {
  let removed = 0;
  const selection = { id: albums[0].id, rect: new DOMRect(0, 0, 100, 100), element: document.createElement('button') };
  const props = { selection, albums, tracks, current: current(), save: async (value: MediaOverride) => value, onClose() {}, onChange() {}, remove: async () => { removed++; } };
  const view = render(<AlbumDetail {...props} canEdit={false} />); assert.equal(ui.queryByText('Remove from collection'), null);
  view.rerender(<AlbumDetail {...props} canEdit />);
  fireEvent.click(ui.getByText('Remove from collection')); assert.equal(removed, 0);
  assert.ok(ui.getByRole('alertdialog')); fireEvent.click(ui.getByText('Keep album')); assert.equal(ui.queryByRole('alertdialog'), null);
  fireEvent.click(ui.getByText('Remove from collection')); fireEvent.click(ui.getByText('Remove album')); await waitFor(() => assert.equal(removed, 1));
});
