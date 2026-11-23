import './helpers/dom';
import React, { useState } from 'react';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen as ui, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { DetailOverlay, type Selection } from '../src/components/shared/DetailOverlay';
import { useObjectFlight, objectFlightTransform } from '../src/hooks/useObjectFlight';
import { books } from '../src/data/books';
import { screen } from '../src/data/screen';

afterEach(cleanup);

test('a spine uses an edge-on solid book and a finite 3D arc at mobile and desktop sizes', () => {
  for (const height of [240, 480]) {
    const path = objectFlightTransform(new DOMRect(20, 520, 16, 204), new DOMRect(100, 90, height * 2 / 3, height), 'book');
    assert.match(path.source, /rotateY\(90deg\)/);
    assert.match(path.arc, /translate3d\(.+75px\) rotateY/);
    assert.doesNotMatch(JSON.stringify(path), /NaN|Infinity/);
  }
});

test('navigated details return to the matching object, wait for the completed flight and restore focus without scrolling', async () => {
  const previous = HTMLElement.prototype.animate;
  const animations: { frames: Keyframe[]; finish: () => void }[] = [];
  HTMLElement.prototype.animate = function (frames) {
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    animations.push({ frames: frames as Keyframe[], finish });
    return { cancel() {}, finished } as unknown as Animation;
  };
  function Harness() {
    const [selected, select] = useState<Selection | null>(null);
    return <><main inert={!!selected || undefined}>{books.slice(0, 2).map((book, index) => <button key={book.id} data-media-kind="book" data-media-id={book.id} aria-label={`Open ${index}`} onClick={event => select({ kind: 'book', index, element: event.currentTarget, rect: event.currentTarget.getBoundingClientRect() })}>{book.title}</button>)}</main>{selected && <DetailOverlay key={selected.index} selection={selected} books={books} screen={screen} onChange={select} onClose={() => select(null)} />}</>;
  }
  try {
    render(<Harness />);
    const first = ui.getByRole('button', { name: 'Open 0' }), second = ui.getByRole('button', { name: 'Open 1' });
    fireEvent.click(first);
    assert.equal(first.dataset.inDetail, 'true');
    fireEvent.click(ui.getByRole('button', { name: 'Next', exact: true }));
    assert.equal(first.dataset.inDetail, undefined);
    assert.equal(second.dataset.inDetail, 'true');
    fireEvent.click(ui.getByRole('button', { name: 'Close details and return to archive' }));
    const home = animations.at(-1)!;
    assert.match(String(home.frames[1].transform), /rotateX\(4deg\)/);
    assert.ok(ui.getByRole('dialog')); // No timer or state change may unmount a flight early.
    await act(async () => { home.finish(); });
    await waitFor(() => assert.equal(ui.queryByRole('dialog'), null));
    await waitFor(() => assert.equal(document.activeElement, second));
    assert.equal(second.dataset.inDetail, undefined);
  } finally { HTMLElement.prototype.animate = previous; }
});

test('reduced motion skips object flights and closes immediately', async () => {
  const previous = window.matchMedia;
  window.matchMedia = query => ({ ...previous(query), matches: query.includes('prefers-reduced-motion') });
  let closed = false;
  const source = document.createElement('button'); source.dataset.mediaKind = 'album'; source.dataset.mediaId = 'record'; document.body.append(source);
  function Harness() {
    const flight = useObjectFlight('album', 'record', source, () => { closed = true; });
    return <><div ref={flight.art} /><button onClick={flight.close}>Return</button></>;
  }
  try {
    render(<Harness />); fireEvent.click(ui.getByText('Return'));
    await waitFor(() => assert.equal(closed, true));
    assert.equal(source.dataset.inDetail, undefined);
  } finally { window.matchMedia = previous; source.remove(); }
});
