import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { request } from './cache.ts';

export function hash(s: string) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export function physical(id: string, pages?: number) {
  const h = hash(id), rand = (offset: number) => hash(`${id}:${offset}`) / 4294967295;
  const binding = pages && pages > 420 ? 'hardcover' : pages && pages < 260 ? 'mass' : 'paperback';
  return {
    binding, finish: binding === 'hardcover' ? 'cloth' : h % 2 ? 'matte' : 'gloss',
    height: Math.round((binding === 'hardcover' ? 236 : binding === 'mass' ? 196 : 214) + rand(1) * (binding === 'mass' ? 14 : binding === 'hardcover' ? 18 : 16)),
    width: Math.round(Math.min(58, Math.max(16, (pages ?? 300) * .055 + rand(2) * 5))),
    lean: Number((-rand(3) * 5).toFixed(2)), depth: Number((rand(4) * 14 - 7).toFixed(2)),
    wear: Number((rand(5) * .35).toFixed(2)), face: ['serif', 'sans', 'mono'][h % 3], caps: h % 7 === 0,
  } as const;
}
const hex = (rgb: number[]) => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
export function palette(data: Uint8Array, width: number, height: number, channels: number) {
  const edge = [0, 0, 0], avg = [0, 0, 0]; let band = [160, 130, 85], saturation = -1;
  const edgeW = Math.max(1, Math.round(width * .06));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels, rgb = [data[i], data[i + 1], data[i + 2]];
    rgb.forEach((v, c) => { avg[c] += v; if (x < edgeW) edge[c] += v; });
    const hi = Math.max(...rgb), lo = Math.min(...rgb), sat = (hi - lo) / Math.max(1, hi);
    if (sat > saturation && hi > 65 && hi < 235) { saturation = sat; band = rgb; }
  }
  const spine = edge.map(v => v / (edgeW * height));
  return { spine: hex(spine), band: hex(band), ink: (spine[0] * .2126 + spine[1] * .7152 + spine[2] * .0722) / 255 > .55 ? '#241f19' : '#faf7f0', dominantColor: hex(avg.map(v => v / (width * height))) };
}
export async function artwork(url: string, id: string, kind: 'books' | 'screen' | 'backdrops') {
  const bytes = url && await request(url, {}, true);
  if (!bytes) return undefined;
  try {
    const image = sharp(bytes); const meta = await image.metadata();
    if (!meta.width || meta.width < 10 || !meta.height || meta.height < 10) return undefined;
    const { data, info } = await image.clone().resize({ width: 80 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const colors = palette(data, info.width, info.height, info.channels);
    const path = `public/artwork/${kind}/${id}.webp`;
    await mkdir(`public/artwork/${kind}`, { recursive: true });
    await writeFile(path, await image.resize({ width: kind === 'backdrops' ? 1000 : 500, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer());
    return { url: `/${path.slice(7)}`, ...colors };
  } catch { return undefined; }
}
