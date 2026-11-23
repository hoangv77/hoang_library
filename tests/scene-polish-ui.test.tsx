import './helpers/dom';
import React from 'react';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen as ui, fireEvent, cleanup } from '@testing-library/react';
import { screen } from '../src/data/screen';
import { albums, tracks } from '../src/data/music';
import { emptyActive } from '../src/lib/currentlyActive';
import type { ActiveController } from '../src/hooks/useCurrentlyActive';
import { WatchingTV } from '../src/components/shared/ActiveObjects';
import { PosterWall } from '../src/components/screen/PosterWall';
import { AlbumDetail } from '../src/components/music/AlbumDetail';
import { VinylShelf } from '../src/components/music/VinylShelf';

afterEach(cleanup);
const current = (): ActiveController => ({ active: emptyActive, episodes: {}, error: '', forgetPlayingAlbum() {}, save: async () => emptyActive, loadEpisodes: async () => [] });

test('the restored TV owns the opening center and opens the saved episode without losing posters or adding keyboard copies', () => {
  const series = screen.find(item => item.type === 'series')!, controller = current();
  const episode = { screenId: series.id, seasonNumber: 1, episodeNumber: 2, title: 'Selected episode', description: 'Known description', still: '/artwork/episodes/still.webp' };
  controller.active = { ...emptyActive, watching: { screenId: series.id, seasonNumber: 1, episodeNumber: 2 } };
  controller.episodes[`${series.id}:1`] = [episode];
  let opened = '';
  const view = render(<PosterWall items={screen} onOpen={() => {}} watching={duplicate => <WatchingTV screen={screen} current={controller} canEdit={false} duplicate={duplicate} onOpen={() => assert.fail('Episode should open first')} onEpisode={value => { opened = value.title; }} />} />);
  assert.equal(view.container.querySelectorAll('.watching-slot').length, 3);
  assert.equal(view.container.querySelectorAll('[data-opening-center]').length, 1);
  assert.ok(view.container.querySelector('[data-opening-center] .television'));
  assert.equal(view.container.querySelectorAll('.poster-target:not([aria-hidden])').length, screen.length);
  assert.equal(ui.getAllByRole('button', { name: /Currently watching/ }).length, 1);
  fireEvent.click(ui.getByRole('button', { name: /Currently watching/ })); assert.equal(opened, 'Selected episode');
  fireEvent.error(ui.getByRole('img', { name: 'Still from Selected episode' }));
  assert.ok(ui.getByRole('img', { name: `${series.title} series artwork` }));
});

test('the TV has a neutral empty state and movies open their own source record', () => {
  const controller = current(); let index = -1;
  const view = render(<WatchingTV screen={screen} current={controller} canEdit={false} onEpisode={() => {}} onOpen={value => { index = value.index; }} />);
  assert.equal((ui.getByRole('button') as HTMLButtonElement).disabled, true);
  assert.ok(view.container.querySelector('.tv-off'));
  const movieIndex = screen.findIndex(item => item.type === 'movie');
  controller.active = { ...emptyActive, watching: { screenId: screen[movieIndex].id } };
  view.rerender(<WatchingTV screen={screen} current={controller} canEdit={false} onEpisode={() => {}} onOpen={value => { index = value.index; }} />);
  fireEvent.click(ui.getByRole('button')); assert.equal(index, movieIndex);
});

test('album details show tracks and ratings without total or per-track play counts', () => {
  const album = albums[0], element = document.createElement('button');
  render(<AlbumDetail selection={{ id: album.id, element, rect: new DOMRect() }} albums={albums} tracks={tracks} canEdit={false} current={current()} save={async value => value} onClose={() => {}} onChange={() => {}} />);
  assert.ok(ui.getByText('My rating'));
  assert.equal(ui.queryByText('Observed scrobbles'), null);
  assert.equal(ui.queryByText(/\d+ plays/), null);
  assert.equal(ui.queryByText(/Counts come from/), null);
  assert.ok(document.querySelectorAll('.album-tracks li').length > 0);
  assert.equal(document.querySelector('.album-tracks li')?.children.length, 3);
});

test('album keyboard browsing advances one measured sleeve rather than a fixed multi-album jump', () => {
  const view = render(<VinylShelf albums={albums} onOpen={() => {}} />);
  const rail = view.container.querySelector<HTMLDivElement>('.vinyl-rail')!;
  const sleeve = view.container.querySelector<HTMLElement>('[data-rail-step]')!;
  Object.defineProperty(sleeve, 'offsetWidth', { configurable: true, value: 140 });
  sleeve.parentElement!.style.columnGap = '8px';
  const moves: number[] = [];
  rail.scrollBy = ((options: ScrollToOptions) => { moves.push(options.left!); }) as typeof rail.scrollBy;
  fireEvent.keyDown(rail, { key: 'ArrowRight' }); fireEvent.keyDown(rail, { key: 'ArrowLeft' });
  assert.deepEqual(moves, [148, -148]);
});
