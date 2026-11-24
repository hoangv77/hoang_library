import './helpers/dom';
import React from 'react';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { advanceRail, useHorizontalRail } from '../src/hooks/useHorizontalRail';
import { logicalRailSource, measureRail, railCopiesPerSide, wrapRailPosition } from '../src/lib/infiniteRail';
import { BookShelf } from '../src/components/books/BookShelf';
import { PosterWall } from '../src/components/screen/PosterWall';
import { VinylShelf } from '../src/components/music/VinylShelf';
import { books } from '../src/data/books';
import { restoreFocus } from '../src/hooks/useDialogFocus';
import { screen } from '../src/data/screen';
import { albums } from '../src/data/music';

afterEach(cleanup);

const frame = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });

// jsdom does not lay out flex boxes. Supply fractional, scroll-relative boxes,
// including real row padding and inter-segment spacing, for the shared hook.
function layout(period = 320.375, viewport = 120) {
  const previousBox = HTMLElement.prototype.getBoundingClientRect;
  const previousObserver = globalThis.ResizeObserver;
  const client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
  let resize: (() => void) | undefined;
  const config = { period, viewport, resize: () => resize?.() };
  globalThis.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) { resize = () => callback([], this); }
    observe() {} unobserve() {} disconnect() {}
  };
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.matches('.test-rail') ? config.viewport : 0; } });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get() { return this.matches('.test-rail') ? this.querySelectorAll('[data-rail-segment]').length * config.period + 36 : 0; } });
  HTMLElement.prototype.getBoundingClientRect = function () {
    const rail = this.closest<HTMLElement>('.test-rail');
    if (!rail) return previousBox.call(this);
    if (this === rail) return new DOMRect(100, 200, config.viewport, 250);
    const segment = this.closest<HTMLElement>('[data-rail-segment]');
    if (!segment) return new DOMRect(100 - rail.scrollLeft, 200, rail.scrollWidth, 250);
    const position = [...rail.querySelectorAll('[data-rail-segment]')].indexOf(segment);
    const left = 100 + 18 + position * config.period - rail.scrollLeft;
    return new DOMRect(left + (this.dataset.mediaId === 'b' ? 44 : 0), 200, this === segment ? config.period - 8.25 : 40, 250);
  };
  return { config, restore() {
    cleanup(); HTMLElement.prototype.getBoundingClientRect = previousBox; globalThis.ResizeObserver = previousObserver;
    if (client) Object.defineProperty(HTMLElement.prototype, 'clientWidth', client); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
    if (scroll) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scroll); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
  } };
}

function LoopRail({ onOpen = () => {} }: { onOpen?: (id: string) => void }) {
  const { ref, copies } = useHorizontalRail(true);
  return <div className="horizontal-rail test-rail" ref={ref} tabIndex={0}>
    <div style={{ paddingLeft: 18 }}>{copies.map(copy => <div data-rail-segment data-rail-copy={copy} key={copy} aria-hidden={copy !== 0 || undefined}>
      {['a', 'b'].map(id => <button key={id} data-media-kind="book" data-media-id={id} tabIndex={copy === 0 ? 0 : -1} onClick={() => onOpen(id)}>{id}</button>)}
    </div>)}</div>
  </div>;
}

function gesture(target: HTMLElement, type: string, x = 100) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: type === 'touchstart' || type === 'touchmove' ? [{ identifier: 1, clientX: x, clientY: 200 }] : [] });
  fireEvent(target, event); assert.equal(event.defaultPrevented, false);
}

test('fractional edge measurement includes segment spacing and excludes the outer inset', () => {
  const fixture = layout();
  try {
    const view = render(<LoopRail />), rail = view.container.firstElementChild as HTMLElement;
    rail.scrollLeft += 17.125;
    assert.deepEqual(measureRail(rail), { period: 320.375, origin: 640.75 });
    // offsetWidth is zero in this fixture: measurements must not rely on it.
    assert.equal(rail.querySelector<HTMLElement>('[data-rail-segment]')!.offsetWidth, 0);
    for (let cycles = -1000; cycles <= 1000; cycles++) {
      const result = wrapRailPosition(640.75 + cycles * 320.375 + 17.125, measureRail(rail)!);
      assert.equal(result, 657.875);
    }
  } finally { fixture.restore(); }
});

test('short collections get bounded native runway and empty/single collections do not loop', () => {
  assert.equal(railCopiesPerSide(1000, 120), 1);
  assert.equal(railCopiesPerSide(48.25, 1440), 32);
  assert.equal(railCopiesPerSide(0, 1440), 1);
  const fixture = layout(90.25, 240);
  try {
    const view = render(<LoopRail />);
    assert.equal(view.container.querySelectorAll('[data-rail-segment]').length, 23);
    assert.equal(view.getAllByRole('button').length, 2);
    assert.equal(measureRail(view.container.firstElementChild as HTMLElement)?.origin, 992.75);
  } finally { fixture.restore(); }
  for (const count of [0, 1, 2]) {
    const view = render(<><BookShelf items={books.slice(0, count)} onOpen={() => {}} /><PosterWall items={screen.slice(0, count)} onOpen={() => {}} /><VinylShelf albums={albums.slice(0, count)} onOpen={() => {}} /></>);
    assert.equal(view.container.querySelectorAll('[data-rail-segment]').length, count < 2 ? 3 : 9);
    for (const rail of view.container.querySelectorAll('.horizontal-rail')) assert.equal(rail.querySelectorAll('[data-rail-copy="0"] [data-media-id]').length, count);
    cleanup();
  }
});

test('native touch and momentum cross three boundaries each way without mid-gesture corrections', async () => {
  const fixture = layout();
  try {
    const view = render(<LoopRail />), rail = view.container.firstElementChild as HTMLElement;
    const measured = measureRail(rail)!;
    for (const direction of [-1, 1]) for (let cycle = 0; cycle < 3; cycle++) {
      gesture(rail, 'touchstart'); gesture(rail, 'touchmove', direction < 0 ? 190 : 10);
      const position = measured.origin + direction * measured.period + 21.25;
      rail.scrollLeft = position; fireEvent.scroll(rail); await frame();
      assert.equal(rail.scrollLeft, position, 'Finger-down scroll is left to the browser');
      gesture(rail, 'touchend');
      rail.scrollLeft += direction * 5; fireEvent.scroll(rail); await frame();
      assert.equal(rail.scrollLeft, position + direction * 5, 'Momentum is not cancelled');
      fireEvent(rail, new window.Event('scrollend')); await frame();
      assert.equal(rail.scrollLeft, measured.origin + 21.25 + direction * 5);
    }
  } finally { fixture.restore(); }
});

test('mouse drag continues in the corrected coordinate system after crossing a boundary', async () => {
  const fixture = layout();
  try {
    const view = render(<LoopRail />), rail = view.container.firstElementChild as HTMLElement;
    rail.setPointerCapture = () => {}; rail.hasPointerCapture = () => false;
    const measured = measureRail(rail)!;
    rail.scrollLeft = measured.origin + measured.period - 10;
    const pointer = (type: string, clientX: number) => {
      const event = new window.MouseEvent(type, { bubbles: true, button: 0, clientX });
      Object.defineProperties(event, { pointerType: { value: 'mouse' }, pointerId: { value: 1 } }); fireEvent(rail, event);
    };
    pointer('pointerdown', 100); pointer('pointermove', 50); await frame();
    assert.equal(rail.scrollLeft, measured.origin + 40);
    pointer('pointermove', 30); await frame();
    assert.equal(rail.scrollLeft, measured.origin + 60);
    pointer('pointerup', 30);
  } finally { fixture.restore(); }
});

test('rerenders, buffer changes and resize preserve the logical offset and canonical DOM identity', () => {
  const fixture = layout();
  try {
    const view = render(<LoopRail />), rail = view.container.firstElementChild as HTMLElement;
    const canonical = rail.querySelector('[data-rail-copy="0"]');
    rail.scrollLeft = measureRail(rail)!.origin + 80.09375;
    view.rerender(<LoopRail />);
    assert.equal(rail.scrollLeft - measureRail(rail)!.origin, 80.09375);
    act(() => { fixture.config.viewport = 1000; fixture.config.resize(); });
    assert.equal(rail.querySelector('[data-rail-copy="0"]'), canonical);
    assert.equal(rail.scrollLeft - measureRail(rail)!.origin, 80.09375);
    act(() => { fixture.config.period = 640.75; fixture.config.resize(); });
    assert.equal(rail.scrollLeft - measureRail(rail)!.origin, 160.1875);
  } finally { fixture.restore(); }
});

test('duplicate selection uses the logical ID and focus return preserves its apparent position', async () => {
  const fixture = layout(); let opened = '';
  try {
    const view = render(<LoopRail onOpen={id => { opened = id; }} />), rail = view.container.firstElementChild as HTMLElement;
    const copy = rail.querySelector<HTMLElement>('[data-rail-copy="1"] [data-media-id="b"]')!;
    const logical = rail.querySelector<HTMLElement>('[data-rail-copy="0"] [data-media-id="b"]')!;
    const before = copy.getBoundingClientRect().left;
    fireEvent.click(copy); assert.equal(opened, 'b');
    restoreFocus(copy);
    assert.equal(logicalRailSource(logical), logical);
    fireEvent.scroll(rail); fireEvent(rail, new window.Event('scrollend')); await frame();
    assert.equal(logical.getBoundingClientRect().left, before);
    assert.equal(document.activeElement, logical);
    assert.equal(logical.tabIndex, 0);
    assert.equal(view.getAllByRole('button', { name: 'b' }).length, 1);
  } finally { fixture.restore(); }
});

test('keyboard browsing honors reduced motion and uses instant corrections', () => {
  const previous = window.matchMedia;
  const fixture = layout();
  try {
    window.matchMedia = query => ({ ...previous(query), matches: query.includes('prefers-reduced-motion') });
    const view = render(<LoopRail />), rail = view.container.firstElementChild as HTMLDivElement;
    const moves: ScrollToOptions[] = [];
    rail.scrollBy = (options: ScrollToOptions) => { moves.push(options); };
    advanceRail(rail, -1); fireEvent.keyDown(rail, { key: 'ArrowRight' });
    assert.deepEqual(moves, [{ left: -320, behavior: 'instant' }, { left: 320, behavior: 'instant' }]);
    fireEvent.keyDown(rail, { key: 'Home' }); assert.equal(rail.scrollLeft, measureRail(rail)!.origin);
    fireEvent.keyDown(rail, { key: 'End' }); assert.equal(rail.scrollLeft, measureRail(rail)!.origin + fixture.config.period - fixture.config.viewport);
  } finally { window.matchMedia = previous; fixture.restore(); }
});
