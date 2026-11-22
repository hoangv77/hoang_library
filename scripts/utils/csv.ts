import { readFile } from 'node:fs/promises';

export function parseCsv(source: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const input = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || cell.length === 0) quoted = !quoted;
      else throw new Error('Unexpected quote in CSV.');
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); if (row.some(Boolean)) rows.push(row);
      row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('Unterminated quoted CSV field.');
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map(h => h.trim());
  if (!headers?.length || new Set(headers).size !== headers.length) throw new Error('Missing or duplicate CSV headers.');
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((h, i) => [h, values[i].trim()]));
  });
}

export function requireHeaders(rows: Record<string, string>[], headers: string[]) {
  if (!rows.length) throw new Error('CSV has no records.');
  const missing = headers.filter(h => !(h in rows[0]));
  if (missing.length) throw new Error(`Missing required CSV headers: ${missing.join(', ')}`);
}
export const readCsv = async (path: string) => parseCsv(await readFile(path, 'utf8'));
export const number = (s?: string): number | undefined => s?.trim() && Number.isFinite(Number(s)) ? Number(s) : undefined;
export const isbn = (s = '') => s.replace(/[="\s-]/g, '').replace(/[^\dXx]/g, '');
export const date = (s?: string) => s && /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(s) ? s.replaceAll('/', '-') : undefined;
export const normalize = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
