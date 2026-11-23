import { pathToFileURL } from 'node:url';
import type { Book } from '../src/data/books.ts';
import { date, isbn, normalize, number, readCsv, requireHeaders } from './utils/csv.ts';
import { loadEnv, request, summary, writeData } from './utils/cache.ts';
import { artwork, hash, physical } from './utils/colors.ts';

export function normalizeBooks(rows: Record<string, string>[]) {
  requireHeaders(rows, ['Book Id', 'Title', 'Author', 'Exclusive Shelf', 'My Rating']);
  const seen = new Set<string>();
  return rows.filter(row => ['read', 'currently-reading'].includes(row['Exclusive Shelf'])).flatMap(row => {
    const id = row['Book Id'] || normalize(row.Title + row.Author);
    if (!row.Title || !row.Author || seen.has(id)) return [];
    seen.add(id);
    const dateRead = date(row['Date Read']);
    return [{ id: `gr-${id}`, goodreadsId: row['Book Id'], title: row.Title, author: row.Author,
      isbn: isbn(row.ISBN) || undefined, isbn13: isbn(row.ISBN13) || undefined,
      rating: number(row['My Rating']) ?? 0, status: row['Exclusive Shelf'], dateRead,
      finished: dateRead ? new Date(dateRead + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '',
      year: number(row['Original Publication Year']) ?? number(row['Year Published']),
      publisher: row.Publisher || '', pages: number(row['Number of Pages']), editionPageCount: number(row['Number of Pages']), originalBinding: row.Binding || undefined,
      genres: [], cover: '', blurb: '',
      ...physical(id, number(row['Number of Pages'])),
      spine: ['#3c4c43', '#7b513d', '#b9a47b', '#344758', '#653f3b', '#c4b9a2'][hash(id) % 6], ink: '#faf7f0',
    } as Book];
  }).sort((a, b) => (b.dateRead ?? '').localeCompare(a.dateRead ?? '') || a.id.localeCompare(b.id));
}

export function reliableMatch(book: Pick<Book, 'title' | 'author' | 'isbn' | 'isbn13'>, doc: any) {
  if ([book.isbn, book.isbn13].some(i => i && doc.isbn?.includes(i))) return true;
  const title = normalize(book.title.split(/\s*\(/)[0]), candidate = normalize(doc.title ?? '');
  return title === candidate && doc.author_name?.some((a: string) => normalize(a) === normalize(book.author));
}
export function genres(subjects: string[] = []) {
  const s = subjects.join(' ').toLowerCase(), result: string[] = [];
  if (/science fiction|sci-fi/.test(s)) result.push('Sci-Fi');
  if (/fantasy|magic/.test(s)) result.push('Fantasy');
  if (/mystery|thriller|detective/.test(s)) result.push('Mystery & Thriller');
  if (/romance|love stories/.test(s)) result.push('Romance');
  const fiction = /\bfiction\b|\bnovels?\b|stories/.test(s.replace(/non[ -]?fiction/g, ''));
  if (!result.length && fiction) result.push('Fiction');
  if (!result.length && /nonfiction|non-fiction|biography|self-help|psychology|business|philosophy|history/.test(s)) result.push('Nonfiction');
  return result;
}
export async function run(path: string) {
  await loadEnv();
  const rows = await readCsv(path), books = normalizeBooks(rows);
  const headers = { 'User-Agent': `PersonalMediaArchive/1.0${process.env.OPEN_LIBRARY_CONTACT ? ` (${process.env.OPEN_LIBRARY_CONTACT})` : ''}` };
  const fields = 'key,title,author_name,isbn,cover_i,first_publish_year,subject,publisher,number_of_pages_median';
  const ids = books.flatMap(b => [b.isbn13 || b.isbn].filter(Boolean));
  const docs: any[] = [];
  for (let i = 0; i < ids.length; i += 8) {
    const q = ids.slice(i, i + 8).map(id => `isbn:${id}`).join(' OR ');
    const data = await request(`https://openlibrary.org/search.json?${new URLSearchParams({ q, fields, limit: '100' })}`, headers);
    if (data?.docs) docs.push(...data.docs);
  }
  const report = { input: rows.length, imported: books.length, skipped: rows.length - books.length, enriched: 0, artwork: 0, unresolved: [] as string[], ambiguous: [] as string[] };
  for (const book of books) {
    const exactIsbn = docs.filter(d => [book.isbn, book.isbn13].some(i => i && d.isbn?.includes(i)));
    let matches = exactIsbn.length ? exactIsbn : docs.filter(d => reliableMatch(book, d));
    if (!matches.length) {
      const params = new URLSearchParams({ title: book.title.split(/\s*\(/)[0], author: book.author, fields, limit: '6' });
      const data = await request(`https://openlibrary.org/search.json?${params}`, headers);
      matches = (data?.docs ?? []).filter((d: any) => reliableMatch(book, d));
    }
    const distinct = [...new Map(matches.map(d => [d.key, d])).values()].sort((a: any, b: any) => a.key.localeCompare(b.key));
    if (distinct.length > 1) report.ambiguous.push(book.id);
    if (distinct.length === 1) {
      const doc: any = distinct[0]; book.openLibraryId = doc.key;
      const work = await request(`https://openlibrary.org${doc.key}.json`, headers);
      book.blurb = typeof work?.description === 'string' ? work.description : work?.description?.value ?? '';
      book.genres = genres(work?.subjects ?? doc.subject);
      book.year ??= doc.first_publish_year;
      book.pages ??= doc.number_of_pages_median;
      book.publisher ||= doc.publisher?.[0] ?? '';
      Object.assign(book, physical(doc.key, book.pages));
      if (doc.cover_i) {
        const art = await artwork(`https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`, book.id, 'books');
        if (art) { book.cover = art.url; book.spine = art.spine; book.band = art.band; book.ink = art.ink; report.artwork++; }
      }
      report.enriched++;
    } else report.unresolved.push(book.id);
    console.log(`Book ${book.id}: ${book.openLibraryId ? 'matched' : 'CSV metadata retained'}`);
  }
  await writeData('src/data/books.ts', 'books', books); await summary('books', report);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path || path.startsWith('--')) throw new Error('Usage: npm run import:books -- <csv-path> [--offline]');
  await run(path);
}
