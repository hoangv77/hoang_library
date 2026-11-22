import assert from 'node:assert/strict';
import { readCsv } from '../scripts/utils/csv.ts';
import { normalizeBooks } from '../scripts/import-goodreads.ts';
import { normalizeScreen } from '../scripts/import-imdb.ts';
import { books } from '../src/data/books.ts';
import { screen } from '../src/data/screen.ts';

const [goodreads, imdb] = process.argv.slice(2);
if (!goodreads || !imdb) throw new Error('Supply Goodreads and IMDb CSV paths.');
const expectedBooks = normalizeBooks(await readCsv(goodreads));
const expectedScreen = normalizeScreen(await readCsv(imdb));
assert.deepEqual(books.map(b => b.id), expectedBooks.map(b => b.id));
assert.deepEqual(screen.map(s => s.id), expectedScreen.map(s => s.id));
for (const [i, book] of books.entries()) {
  for (const key of ['title', 'author', 'rating', 'status', 'dateRead', 'isbn', 'isbn13'] as const) assert.equal(book[key], expectedBooks[i][key], `${book.id}: ${key}`);
}
for (const [i, item] of screen.entries()) {
  for (const key of ['title', 'year', 'personalRating', 'imdbRating', 'status', 'statusInferred', 'dateAdded', 'dateRated'] as const) assert.equal(item[key], expectedScreen[i][key], `${item.id}: ${key}`);
}
console.log(`Verified ${books.length} books and ${screen.length} unique screen titles against the supplied CSVs.`);
