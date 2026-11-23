import './helpers/dom';
import React, { useState } from 'react';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen as ui, cleanup, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import { books } from '../src/data/books';
import { screen } from '../src/data/screen';
import { albums, tracks } from '../src/data/music';
import { emptyActive, type CurrentlyActive } from '../src/lib/currentlyActive';
import { useCurrentlyActive, type ActiveController } from '../src/hooks/useCurrentlyActive';
import { CurrentEditor } from '../src/components/owner/CurrentEditor';
import { OwnerEditor } from '../src/components/owner/OwnerEditor';
import { PlayingPanel, EpisodeDetail } from '../src/components/shared/ActiveObjects';
import { VinylShelf } from '../src/components/music/VinylShelf';
import { BookShelf } from '../src/components/books/BookShelf';
import { PosterWall } from '../src/components/screen/PosterWall';
import { mergeAlbums } from '../src/lib/personalization';

afterEach(() => { cleanup(); document.body.innerHTML = ''; });
const controller = (active: CurrentlyActive = emptyActive): ActiveController => ({ active, episodes: {}, error: '', forgetPlayingAlbum: () => {}, save: async (category, selection) => ({ ...active, [category]: selection }), loadEpisodes: async () => [] });
test('empty current selections leave the collections unhighlighted and the player neutral', () => {
  const view = render(<><BookShelf items={books} onOpen={() => {}} /><PosterWall items={screen} onOpen={() => {}} /><PlayingPanel albums={albums} tracks={tracks} current={controller()} canEdit={false} onOpen={() => {}} /></>);
  assert.ok(ui.getByText('Nothing selected'));
  assert.equal(view.container.querySelectorAll('.is-current').length, 0);
  assert.equal(ui.getByRole('button', { name: 'No album selected' }).hasAttribute('disabled'), true);
});

test('album selection without a song is explicit and missing records offer local recovery', async () => {
  const current = controller({ ...emptyActive, playing: { albumId: albums[0].id } });
  const view = render(<PlayingPanel albums={albums} tracks={tracks} current={current} canEdit={false} onOpen={() => {}} />);
  assert.ok(ui.getByText('No song selected'));
  let cleared = false;
  const missing = controller({ ...emptyActive, playing: { albumId: 'missing-after-import' } });
  missing.save = async (category, selection) => { assert.equal(category, 'playing'); assert.equal(selection, null); cleared = true; return emptyActive; };
  view.rerender(<PlayingPanel albums={albums} tracks={tracks} current={missing} canEdit onOpen={() => {}} />);
  fireEvent.click(ui.getByText('Clear saved selection')); await waitFor(() => assert.ok(cleared));
});
test('current song editor confirms saves, selects only album tracks, replaces and clears selection', async () => {
  const album = albums[0]; let guard: (() => boolean) | null = null;
  const calls: CurrentlyActive[] = [];
  function Harness() {
    const [active, setActive] = useState<CurrentlyActive>(emptyActive);
    const current = controller(active);
    current.save = async (category, selection) => { const next = { ...active, [category]: selection }; calls.push(next); setActive(next); return next; };
    return <CurrentEditor category="playing" item={album} tracks={tracks} controller={current} canEdit setNavigationGuard={value => { guard = value; }} />;
  }
  render(<Harness />);
  fireEvent.click(ui.getByRole('checkbox', { name: 'Currently Playing' }));
  assert.ok(guard); assert.equal(calls.length, 0);
  const select = ui.getByRole('combobox', { name: 'Song' }) as HTMLSelectElement;
  assert.equal(select.options.length, album.trackIds.length + 1);
  const track = tracks.find(track => track.albumId === album.id)!;
  fireEvent.change(select, { target: { value: track.id } });
  fireEvent.click(ui.getByText('Save current selection'));
  await waitFor(() => assert.equal(ui.getByRole('status').textContent, 'Current selection saved.'));
  assert.deepEqual(calls[0].playing, { albumId: album.id, trackId: track.id });
  assert.equal((ui.getByRole('checkbox', { name: 'Currently Playing' }) as HTMLInputElement).checked, true);
  fireEvent.click(ui.getByRole('checkbox', { name: 'Currently Playing' }));
  assert.equal((ui.getByRole('button', { name: 'Save current selection' }) as HTMLButtonElement).disabled, false);
  fireEvent.click(ui.getByText('Save current selection')); await waitFor(() => assert.equal(calls.length, 2));
  assert.equal(calls[1].playing, null);
});
test('album editor uses five stars and favorites independently; infinite copies have one keyboard target per album', async () => {
  let saved: unknown;
  render(<OwnerEditor type="album" id={albums[0].id} item={{}} canEdit save={async value => { saved = value; return value; }} setNavigationGuard={() => {}} />);
  assert.ok(ui.getByRole('radiogroup', { name: 'Album rating' }));
  fireEvent.click(ui.getByRole('radio', { name: '3 out of 5 stars' }));
  fireEvent.click(ui.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => assert.ok(saved));
  assert.equal((saved as { personal_rating: number }).personal_rating, 3); assert.equal((saved as { is_favorite: boolean }).is_favorite, false);
  cleanup();
  const view = render(<VinylShelf albums={mergeAlbums(albums, [])} onOpen={() => {}} />);
  assert.equal(view.container.querySelectorAll('button[tabindex="0"]').length, albums.length);
  assert.equal(view.container.querySelectorAll('button[aria-hidden="true"]').length, albums.length * 2);
});
test('episode artwork falls back only to its own parent series and links to parent information', () => {
  let parent = false;
  const series = screen.find(item => item.type === 'series')!;
  const episode = { screenId: series.id, seasonNumber: 1, episodeNumber: 2, title: 'Verified episode', description: 'Episode description' };
  render(<EpisodeDetail episode={episode} screen={series} onClose={() => {}} onParent={() => { parent = true; }} />);
  assert.ok(ui.getByText('Series artwork · episode still unavailable'));
  fireEvent.click(ui.getByText('View parent series')); assert.ok(parent);
});
test('episode stills fall back without inventing episode content', () => {
  const series = screen.find(item => item.type === 'series' && item.poster)!;
  render(<EpisodeDetail episode={{ screenId: series.id, seasonNumber: 1, episodeNumber: 1, title: 'An episode', description: '', still: '/artwork/episodes/missing.webp' }} screen={series} onClose={() => {}} onParent={() => {}} />);
  fireEvent.error(ui.getByAltText('Still from An episode'));
  assert.ok(ui.getByText('Series artwork · episode still unavailable'));
  assert.ok(ui.getByAltText(`${series.title} series artwork`));
});
test('current selections survive fresh hooks and production never calls a write endpoint', async () => {
  const original = globalThis.fetch;
  let saved = structuredClone(emptyActive), requests = 0;
  globalThis.fetch = async (_input, init) => {
    requests++;
    if (init?.method === 'POST') { const body = JSON.parse(init.body as string); saved = { ...saved, [body.category]: body.selection }; return Response.json(saved); }
    return Response.json({ active: saved, episodes: {}, token: 'test-token' });
  };
  try {
    const first = renderHook(() => useCurrentlyActive(true));
    await act(async () => { await first.result.current.save('playing', { albumId: albums[0].id }); });
    first.unmount();
    const second = renderHook(() => useCurrentlyActive(true));
    await waitFor(() => assert.equal(second.result.current.active.playing?.albumId, albums[0].id));
    second.unmount(); const before = requests;
    const production = renderHook(() => useCurrentlyActive(false));
    await assert.rejects(production.result.current.save('playing', null), /read-only/); assert.equal(requests, before);
  } finally { globalThis.fetch = original; }
});
test('opening anchor centers the TV and the poster row beneath it across viewport widths', () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
  let width = 375; const span = screen.length * 179;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return width; } });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get() { return span * 3; } });
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('data-opening-center')) return new DOMRect(span + 48 - this.closest('.poster-rail')!.scrollLeft, 135, 140, 210);
    return new DOMRect(0, 135, width, 255);
  };
  try {
    for (width of [375, 768, 1280]) {
      const items = screen.map((item, index) => ({ ...item, isFavorite: index === 22 || index === 30 }));
      const view = render(<PosterWall items={items} onOpen={() => {}} watching={() => <span>Currently Watching</span>} />);
      const anchor = view.container.querySelector<HTMLElement>('[data-opening-center]')!;
      assert.equal(anchor.getBoundingClientRect().left + 70, width / 2);
      assert.ok(anchor.classList.contains('watching-slot'));
      assert.equal(anchor.querySelectorAll('.watching-lower-row .poster-target').length, 2);
      view.unmount();
    }
  } finally {
    HTMLElement.prototype.getBoundingClientRect = originalRect;
    if (originalWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalWidth); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
    if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScroll); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
  }
});
