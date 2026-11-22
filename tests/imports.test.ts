import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parseCsv, isbn, requireHeaders } from '../scripts/utils/csv.ts';
import { normalizeBooks, reliableMatch, genres } from '../scripts/import-goodreads.ts';
import { normalizeScreen } from '../scripts/import-imdb.ts';
import { physical, palette } from '../scripts/utils/colors.ts';
import { books } from '../src/data/books.ts';
import { screen } from '../src/data/screen.ts';

test('CSV handles BOM, CRLF, multiline fields, escaped quotes, and rejects broken rows', () => {
  assert.deepEqual(parseCsv('\uFEFFTitle,Note\r\n"A, B","two\nlines and ""quotes"""\r\n'), [{ Title: 'A, B', Note: 'two\nlines and "quotes"' }]);
  assert.throws(() => parseCsv('a,b\n"unfinished,b'));
  assert.throws(() => parseCsv('a,b\n1,2,3'));
  assert.throws(() => requireHeaders([{ Title: 'Book' }], ['Author']));
  assert.equal(isbn('="978-1234567890"'), '9781234567890');
  assert.equal(isbn('=""'), '');
});
const row = (overrides = {}) => ({ 'Book Id': '123', Title: 'A book', Author: 'An author', 'Exclusive Shelf': 'read', 'My Rating': '4', 'Date Read': '2025/02/12', ...overrides });
test('Goodreads membership, identifiers, ratings, missing dates, ordering and deduplication', () => {
  const data = normalizeBooks([row(), row(), row({ 'Book Id': '2', 'Exclusive Shelf': 'to-read' }), row({ 'Book Id': '3', 'Exclusive Shelf': 'currently-reading', 'Date Read': '', 'My Rating': '0' })]);
  assert.equal(data.length, 2); assert.equal(data[0].rating, 4); assert.equal(data[0].dateRead, '2025-02-12');
  assert.equal(data[0].finished, 'Feb 2025'); assert.equal(data[1].dateRead, undefined); assert.equal(data[1].status, 'currently-reading');
  assert.equal(data[0].goodreadsId, '123');
});
test('book matching rejects wrong authors and sequels; genre subjects do not turn novels into nonfiction', () => {
  assert.equal(reliableMatch({ title: 'Dune (Dune, #1)', author: 'Frank Herbert' }, { title: 'Dune', author_name: ['Frank Herbert'] }), true);
  assert.equal(reliableMatch({ title: 'Dune', author: 'Frank Herbert' }, { title: 'Dune Messiah', author_name: ['Frank Herbert'] }), false);
  assert.equal(reliableMatch({ title: 'Dune', author: 'Frank Herbert' }, { title: 'Dune', author_name: ['Other'] }), false);
  assert.deepEqual(genres(['Fiction', 'History', 'Love stories']), ['Romance']);
  assert.deepEqual(genres(['History', 'Novels']), ['Fiction']);
  assert.deepEqual(genres(['Nonfiction', 'Psychology']), ['Nonfiction']);
});
const imdb = (overrides = {}) => ({ Const: 'tt123', Title: 'A film', 'Title Type': 'Movie', 'Your Rating': '9', 'IMDb Rating': '6.1', 'Date Rated': '2025-02-12', ...overrides });
test('IMDb ratings stay distinct; rated watched status is inferred and unrated lists remain unknown', () => {
  const items = normalizeScreen([imdb(), imdb(), imdb({ Const: 'tt2', 'Title Type': 'TV Episode' }), imdb({ Const: 'tt3', 'Title Type': 'TV Mini Series', 'Your Rating': '' })]);
  assert.equal(items.length, 2); assert.equal(items[0].personalRating, 9); assert.equal(items[0].imdbRating, 6.1);
  assert.equal(items[0].status, 'watched'); assert.equal(items[0].statusInferred, true); assert.equal(items[0].watchedDate, undefined);
  assert.equal(items[1].status, 'unknown'); assert.equal(items[1].type, 'series');
  assert.equal(normalizeScreen([imdb()], true)[0].status, 'watchlist');
});
test('physical properties are stable and bounded, and palette samples the left edge', () => {
  assert.deepEqual(physical('abc', 650), physical('abc', 650));
  assert.equal(physical('abc', 650).binding, 'hardcover'); assert.equal(physical('abc', 200).binding, 'mass');
  assert.equal(physical('abc', 2000).width, 58);
  const colors = palette(new Uint8Array([255, 0, 0, 0, 0, 255]), 2, 1, 3);
  assert.equal(colors.spine, '#ff0000');
});
test('generated collections have unique IDs, legitimate statuses, and existing artwork', () => {
  assert.equal(new Set(books.map(b => b.id)).size, books.length);
  assert.equal(new Set(screen.map(s => s.imdbId)).size, screen.length);
  for (const book of books) { assert.ok(['read', 'currently-reading'].includes(book.status)); assert.ok(book.width >= 16 && book.width <= 58); if (book.cover) assert.ok(existsSync('public' + book.cover)); }
  for (const item of screen) { assert.match(item.imdbId, /^tt\d+$/); if (item.poster) assert.ok(existsSync('public' + item.poster)); if (item.statusInferred) assert.ok(item.personalRating); }
});
test('production assets contain no TMDB credentials', () => {
  if (!existsSync('dist/assets') || !existsSync('.env')) return;
  const values = readFileSync('.env', 'utf8').split(/\r?\n/).map(line => line.match(/^TMDB_\w+=(.+)$/)?.[1]).filter(Boolean) as string[];
  for (const name of readdirSync('dist/assets').filter(n => /\.(js|css)$/.test(n))) {
    const text = readFileSync('dist/assets/' + name, 'utf8');
    for (const value of values) assert.ok(!text.includes(value), `Credential found in ${name}`);
    assert.ok(!text.includes('api.themoviedb.org'));
  }
});
