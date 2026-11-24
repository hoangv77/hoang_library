import './helpers/dom';
import React from 'react';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, cleanup, fireEvent, act, renderHook } from '@testing-library/react';
import { PosterWall } from '../src/components/screen/PosterWall';
import { BookShelf } from '../src/components/books/BookShelf';
import { VinylShelf } from '../src/components/music/VinylShelf';
import { useHorizontalRail } from '../src/hooks/useHorizontalRail';
import { useCompactLayout } from '../src/hooks/useCompactLayout';
import { books } from '../src/data/books';
import { screen } from '../src/data/screen';
import { albums } from '../src/data/music';

afterEach(cleanup);

test('compact collections loop with one accessible logical record and integrated TV', () => {
  const opened: string[] = [];
  const view = render(<><PosterWall compact items={screen} onOpen={selection => opened.push(screen[selection.index].id)} watching={() => <button>Episode details</button>} /><BookShelf compact items={books} onOpen={selection => opened.push(books[selection.index].id)} /><VinylShelf compact albums={albums} onOpen={selection => opened.push(selection.id)} /></>);
  assert.equal(view.getAllByRole('button', { name: 'Episode details' }).length, 1);
  for (const [selector, count] of [['.poster-target', screen.length], ['.book-target', books.length], ['.vinyl-target', albums.length]] as const) {
    const buttons = view.container.querySelectorAll<HTMLButtonElement>(selector);
    assert.equal(buttons.length, count * 3);
    assert.equal(new Set([...buttons].map(button => button.dataset.mediaId)).size, count);
    const logical = [...buttons].filter(button => button.tabIndex === 0 && !button.hasAttribute('aria-hidden'));
    assert.equal(logical.length, count);
    assert.ok([...buttons].filter(button => button.hasAttribute('aria-hidden')).every(button => button.tabIndex === -1));
    fireEvent.click(buttons[buttons.length - 1]);
  }
  assert.deepEqual(opened, [screen.at(-1)!.id, books.at(-1)!.id, albums.at(-1)!.id]);
  assert.equal(view.container.querySelectorAll('.watching-slot').length, 3);
  assert.equal(view.container.querySelector('.watching-feature'), null);
  assert.equal(view.container.querySelectorAll('[data-rail-copy="0"] .watching-slot .watching-lower-row .poster-target').length, 2);
  assert.equal(view.container.querySelectorAll('[data-rail-copy="0"] .poster-column').length, Math.ceil(screen.length / 2) - 1);
});

function Rail({ opened }: { opened: () => void }) {
  const { ref: rail } = useHorizontalRail(false);
  return <div ref={rail} className="horizontal-rail"><button onClick={opened}>Open record</button></div>;
}
function touch(target: Element, type: string, x: number, y: number) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: type === 'touchend' || type === 'touchcancel' ? [] : [{ identifier: 1, clientX: x, clientY: y }] });
  fireEvent(target, event);
  assert.equal(event.defaultPrevented, false, 'Native touch scrolling must not be cancelled');
}

test('touch swipes never activate a record while taps and keyboard activation still do', () => {
  let opened = 0;
  const view = render(<Rail opened={() => opened++} />), button = view.getByRole('button');
  for (const direction of [-1, 1]) {
    touch(button, 'touchstart', 100, 100);
    touch(button, 'touchmove', 100 + direction * 90, 103);
    // Browsers cancel pointer events when native scrolling takes over.
    fireEvent(button, new window.Event('pointercancel', { bubbles: true }));
    touch(button, 'touchend', 100 + direction * 90, 103);
    fireEvent.click(button, { detail: 1 });
    assert.equal(opened, 0);
  }
  touch(button, 'touchstart', 100, 100);
  touch(button, 'touchmove', 102, 103);
  touch(button, 'touchend', 102, 103);
  fireEvent.click(button, { detail: 1 }); assert.equal(opened, 1);
  touch(button, 'touchstart', 100, 100);
  touch(button, 'touchmove', 100, 190);
  touch(button, 'touchcancel', 100, 190);
  fireEvent.click(button, { detail: 0 }); assert.equal(opened, 2);
});

test('compact vertical wheel input can scroll the page and horizontal input browses the rail', () => {
  const original = window.matchMedia;
  let compact = true;
  window.matchMedia = query => ({ ...original(query), get matches() { return compact; } });
  try {
    const view = render(<Rail opened={() => {}} />), rail = view.container.firstElementChild as HTMLElement;
    Object.defineProperty(rail, 'scrollWidth', { value: 2000 });
    Object.defineProperty(rail, 'clientWidth', { value: 360 });
    const wheel = (deltaX: number, deltaY: number) => {
      const event = new window.WheelEvent('wheel', { deltaX, deltaY, bubbles: true, cancelable: true });
      fireEvent(rail, event); return event;
    };
    assert.equal(wheel(0, 120).defaultPrevented, false); assert.equal(rail.scrollLeft, 0);
    // jsdom has no native default scrolling; verify the event is left to the browser.
    assert.equal(wheel(120, 0).defaultPrevented, false); assert.equal(rail.scrollLeft, 0);
    assert.equal(wheel(-80, 0).defaultPrevented, false); assert.equal(rail.scrollLeft, 0);
    compact = false;
    assert.equal(wheel(0, 120).defaultPrevented, true); assert.equal(rail.scrollLeft, 120);
  } finally { window.matchMedia = original; }
});

test('desktop dragging still moves the rail and suppresses the following pointer click', () => {
  let opened = 0, captured = false;
  const view = render(<Rail opened={() => opened++} />), rail = view.container.firstElementChild as HTMLElement;
  rail.setPointerCapture = () => { captured = true; };
  rail.hasPointerCapture = () => captured;
  rail.releasePointerCapture = () => { captured = false; };
  const pointer = (type: string, clientX: number) => {
    const event = new window.MouseEvent(type, { clientX, button: 0, bubbles: true });
    Object.defineProperties(event, { pointerType: { value: 'mouse' }, pointerId: { value: 1 } });
    fireEvent(rail, event);
  };
  pointer('pointerdown', 200); pointer('pointermove', 100);
  assert.equal(rail.scrollLeft, 100); assert.equal(captured, true);
  pointer('pointerup', 100); assert.equal(captured, false);
  fireEvent.click(view.getByRole('button'), { detail: 1 }); assert.equal(opened, 0);
  pointer('pointerdown', 100); pointer('pointerup', 100);
  fireEvent.click(view.getByRole('button'), { detail: 1 }); assert.equal(opened, 1);
});

test('responsive mode follows media-query changes and unsubscribes on unmount', () => {
  const original = window.matchMedia;
  let listener: (() => void) | undefined, compact = false;
  window.matchMedia = query => ({ ...original(query), matches: compact, addEventListener: (_event, callback) => { listener = callback as () => void; }, removeEventListener: () => { listener = undefined; } });
  try {
    const hook = renderHook(useCompactLayout);
    assert.equal(hook.result.current, false);
    act(() => { compact = true; listener!(); }); assert.equal(hook.result.current, true);
    act(() => { compact = false; listener!(); }); assert.equal(hook.result.current, false);
    hook.unmount(); assert.equal(listener, undefined);
  } finally { window.matchMedia = original; }
});
