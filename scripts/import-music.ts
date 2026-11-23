import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import type { Album, MusicTrack } from '../src/lib/musicTypes';
import { readCsv, requireHeaders } from './utils/csv';
import { request, summary } from './utils/cache';
import { musicName, albumName } from '../src/lib/musicIdentity';
export { musicName, albumName } from '../src/lib/musicIdentity';
export const DEFAULT_MUSIC_MINIMUM = 70;

const trackName = (s: string) => musicName(s.replace(/\s*[-–]\s*(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?$/i, ''));
const digest = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 24);
const mbid = (s = '') => /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(s) ? s.toLowerCase() : '';
const stable = (values: string[]) => [...new Set(values.filter(Boolean))].sort();

export function normalizeMusic(rows: Record<string, string>[], minimum = DEFAULT_MUSIC_MINIMUM) {
  if (!Number.isSafeInteger(minimum) || minimum < 1) throw new Error('The minimum scrobble count must be a positive whole number.');
  requireHeaders(rows, ['uts', 'artist', 'album', 'track']);
  const grouped = new Map<string, { album: Album; tracks: Map<string, MusicTrack> }>();
  const seen = new Set<string>();
  let duplicates = 0, invalid = 0;
  let earliest = Infinity, latest = 0;
  for (const row of [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))) {
    const timestamp = Number(row.uts);
    if (!/^\d+$/.test(row.uts) || !Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp > 8640000000000 || !row.artist?.trim() || !row.album?.trim() || !row.track?.trim()) { invalid++; continue; }
    const artist = musicName(row.artist), title = albumName(row.album);
    if (!artist || !title || !trackName(row.track)) { invalid++; continue; }
    const key = artist + '\0' + title;
    const event = [timestamp, key, trackName(row.track)].join('\0');
    if (seen.has(event)) { duplicates++; continue; }
    seen.add(event); earliest = Math.min(earliest, timestamp); latest = Math.max(latest, timestamp);
    const albumId = 'album-' + digest(key);
    let group = grouped.get(key);
    if (!group) {
      group = { album: { id: albumId, artistId: 'artist-' + digest(artist), title: row.album.trim(), artist: row.artist.trim(), genres: [], artwork: '',
        artistMbids: [], sourceAlbumMbids: [], sourceTitles: [], observedScrobbles: 0, lastPlayedAt: '', trackIds: [], tracklistSource: 'observed', metadataStatus: 'unresolved' }, tracks: new Map() };
      grouped.set(key, group);
    }
    const album = group.album;
    album.observedScrobbles++;
    const iso = new Date(timestamp * 1000).toISOString();
    if (iso > album.lastPlayedAt) album.lastPlayedAt = iso;
    album.artistMbids = stable([...album.artistMbids, mbid(row.artist_mbid)]);
    album.sourceAlbumMbids = stable([...album.sourceAlbumMbids, mbid(row.album_mbid)]);
    album.sourceTitles = stable([...album.sourceTitles, row.album.trim()]);
    const trackId = 'track-' + digest(albumId + '\0' + trackName(row.track));
    const track = group.tracks.get(trackId) ?? { id: trackId, albumId, title: row.track.trim(), observedScrobbles: 0, musicbrainzIds: [] };
    track.observedScrobbles++; track.musicbrainzIds = stable([...track.musicbrainzIds, mbid(row.track_mbid)]);
    group.tracks.set(trackId, track);
  }
  const groups = [...grouped.values()].sort((a, b) => b.album.observedScrobbles - a.album.observedScrobbles || a.album.id.localeCompare(b.album.id));
  for (const group of groups) { group.album.sourceTitles.sort((a,b) => a.length - b.length || a.localeCompare(b)); group.album.title = group.album.sourceTitles[0]; group.album.trackIds = [...group.tracks.keys()].sort(); }
  return { groups, included: groups.filter(group => group.album.observedScrobbles >= minimum), duplicates, invalid, events: seen.size, range: seen.size ? [new Date(earliest*1000).toISOString(), new Date(latest*1000).toISOString()] : [] };
}

export function matchingMusicArtist(album: Album, credits: any[] = []) {
  // A source artist MBID is a hint, never permission to accept a different
  // artist. MusicBrainz's credited name can retain a verified artist alias.
  const combined = credits.map(credit => (credit.name || credit.artist?.name || '') + (credit.joinphrase || '')).join('');
  return musicName(combined) === musicName(album.artist) || credits.some(credit => [credit.artist?.name, credit.name].some(name => typeof name === 'string' && musicName(name) === musicName(album.artist)));
}
export function matchingMusicAlbum(album: Album, candidate: any) {
  return albumName(candidate.title ?? '') === albumName(album.title) && matchingMusicArtist(album, candidate['artist-credit']);
}
const headers = { 'User-Agent': 'HoangLibrary/1.0 (https://github.com/hoangv77/hoang_library)', Accept: 'application/json' };
const lucene = (s: string) => s.replace(/[+\-!(){}\[\]^"~*?:\\/]/g, '\\$&');

export async function enrichAlbum(album: Album, observed: MusicTrack[], lookup: typeof request = request, selectedGroupId?: string) {
  const brainz = (endpoint: string) => lookup('https://musicbrainz.org/ws/2/' + endpoint + (endpoint.includes('?') ? '&' : '?') + 'fmt=json', headers);
  let release: any, group: any;
  const verifiedGroups = new Map<string, any>();
  // IDs are hints until the returned artist and album agree with the source.
  for (const id of album.sourceAlbumMbids.slice(0, 4)) {
    const result = await brainz(`release/${id}?inc=recordings+artist-credits+release-groups+genres`);
    if (result && matchingMusicAlbum(album, result) && result['release-group']?.id) verifiedGroups.set(result['release-group'].id, result);
  }
  if (verifiedGroups.size > 1) { album.metadataStatus = 'ambiguous'; return { album, tracks: observed }; }
  if (verifiedGroups.size === 1) release = [...verifiedGroups.values()][0];
  if (!release) {
    if (selectedGroupId) {
      const selected = await brainz(`release-group/${selectedGroupId}?inc=artists+releases+genres`);
      if (!selected || !matchingMusicAlbum(album, selected)) throw new Error('The selected metadata does not match this album and artist.');
      group = selected;
    } else {
      const query = `releasegroup:"${lucene(album.title.replace(/\s*[([][^)\]]*(?:deluxe|remaster|anniversary|standard)[^)\]]*[)\]]/gi,''))}" AND artist:"${lucene(album.artist)}"`;
      const found = await brainz('release-group/?' + new URLSearchParams({ query, limit: '12' }));
      const matches = (found?.['release-groups'] ?? []).filter((item: any) => matchingMusicAlbum(album, item));
      if (new Set(matches.map((item: any) => item.id)).size > 1) { album.metadataStatus = 'ambiguous'; return { album, tracks: observed }; }
      if (matches.length === 1) group = await brainz(`release-group/${matches[0].id}?inc=artists+releases+genres`);
    }
    if (group) {
      const editions = (group.releases ?? []).filter((r: any) => !r.status || r.status === 'Official').sort((a: any,b: any) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.id.localeCompare(b.id));
      for (const edition of editions.slice(0, 2)) {
        const candidate = await brainz(`release/${edition.id}?inc=recordings+artist-credits+release-groups+genres`);
        if (candidate && matchingMusicAlbum(album,candidate) && (!selectedGroupId || candidate['release-group']?.id === selectedGroupId)) { release=candidate; break; }
      }
    }
  }
  if (!release) return { album, tracks: observed };
  album.metadataStatus = 'resolved'; album.releaseId = release.id; album.musicbrainzId = release['release-group']?.id ?? group?.id;
  album.year = Number((group?.['first-release-date'] ?? release.date ?? '').slice(0,4)) || undefined;
  album.genres = stable((group?.genres ?? release.genres ?? []).map((g: any) => g.name));
  let trackMap = new Map(observed.map(track => [track.id,track])); const verified: string[] = [];
  let duplicateTrack = false;
  const media = release.media ?? [];
  for (const disc of media) for (const item of disc.tracks ?? []) {
    const title = item.title ?? item.recording?.title;
    if (!title) continue;
    const id = 'track-' + digest(album.id + '\0' + trackName(title));
    // Do not present two same-named disc tracks as one verified tracklist.
    if (verified.includes(id)) { duplicateTrack = true; continue; }
    const previous = trackMap.get(id);
    trackMap.set(id, { id, albumId: album.id, title, discNumber: disc.position, trackNumber: item.position,
      durationMs: item.length ?? item.recording?.length ?? undefined, observedScrobbles: previous?.observedScrobbles ?? 0,
      musicbrainzIds: stable([...(previous?.musicbrainzIds ?? []), mbid(item.recording?.id)]) });
    verified.push(id);
  }
  const complete = !duplicateTrack && media.length > 0 && media.every((disc: any) => disc.tracks?.length > 0 && disc.tracks.length === disc['track-count']) && verified.length === media.reduce((n: number,disc: any)=>n + disc.tracks.length,0);
  if (complete) { album.verifiedTrackIds=verified; album.tracklistSource='verified'; }
  if (complete) album.trackIds = [...verified, ...observed.filter(t => !verified.includes(t.id)).map(t => t.id)];
  else trackMap = new Map(observed.map(track => [track.id,track]));
  const covers = album.musicbrainzId && await lookup(`https://coverartarchive.org/release-group/${album.musicbrainzId}`, headers);
  const cover = covers?.images?.find((item: any) => item.front === true && item.approved !== false);
  const coverUrl = cover?.thumbnails?.['500'] ?? cover?.thumbnails?.large ?? cover?.thumbnails?.['250'] ?? cover?.thumbnails?.small;
  if (coverUrl && /^https?:\/\//.test(coverUrl)) {
    const bytes = await lookup(coverUrl.replace(/^http:/,'https:'), headers, true);
    if (bytes) try {
      const output = `public/artwork/music/${album.id}.webp`;
      await mkdir('public/artwork/music',{recursive:true});
      await writeFile(output,await sharp(bytes).resize(500,500,{fit:'cover',withoutEnlargement:true}).webp({quality:84}).toBuffer());
      album.artwork='/artwork/music/'+album.id+'.webp';
    } catch { /* Keep a typeset sleeve when artwork is unavailable. */ }
  }
  return { album, tracks: [...trackMap.values()] };
}

export async function runMusic(path: string, minimum = DEFAULT_MUSIC_MINIMUM) {
  const raw=await readCsv(path); const normalized=normalizeMusic(raw, minimum); const included=normalized.included;
  const outputAlbums: Album[]=[]; const outputTracks: MusicTrack[]=[];
  for(const item of included){const enriched=await enrichAlbum(item.album,[...item.tracks.values()]);outputAlbums.push(enriched.album);outputTracks.push(...enriched.tracks);console.log(`Album ${outputAlbums.length}/${included.length}: ${item.album.artist} — ${item.album.title}: ${item.album.metadataStatus}${item.album.artwork?' + artwork':''}`);}
  outputTracks.sort((a,b)=>a.albumId.localeCompare(b.albumId)||a.id.localeCompare(b.id));
  await writeFile('src/data/music.ts',`import type { Album } from '../lib/musicTypes';\nexport { tracks } from './music-tracks';\n// Generated from observed Last.fm scrobbles; owner personalization is stored separately.\nexport const albums: Album[] = ${JSON.stringify(outputAlbums,null,2)};\n`);
  await writeFile('src/data/music-tracks.ts',`import type { MusicTrack } from '../lib/musicTypes';\n// Generated from observed history and verified release tracklists.\nexport const tracks: MusicTrack[] = ${JSON.stringify(outputTracks,null,2)};\n`);
  await summary('music',{minimumScrobbles:minimum,input:raw.length,observedEvents:normalized.events,duplicates:normalized.duplicates,invalid:normalized.invalid,range:normalized.range,included:included.length,excluded:normalized.groups.length-included.length,
    unresolved:outputAlbums.filter(a=>a.metadataStatus==='unresolved').map(a=>({id:a.id,artist:a.artist,title:a.title})),ambiguous:outputAlbums.filter(a=>a.metadataStatus==='ambiguous').map(a=>({id:a.id,artist:a.artist,title:a.title})),missingArtwork:outputAlbums.filter(a=>!a.artwork).map(a=>({id:a.id,title:a.title})),verifiedTracklists:outputAlbums.filter(a=>a.tracklistSource==='verified').length});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const path=process.argv[2];if(!path||path.startsWith('--'))throw new Error('Usage: npm run import:music -- <lastfm.csv> [--offline] [--min-scrobbles=70]');const argument=process.argv.find(value=>value.startsWith('--min-scrobbles='));await runMusic(path,argument?Number(argument.split('=')[1]):DEFAULT_MUSIC_MINIMUM);}

export function manualAlbum(title: string, artist: string): Album {
  return { id: 'album-' + digest(musicName(artist) + '\0' + albumName(title)), artistId: 'artist-' + digest(musicName(artist)), title, artist, genres: [], artwork: '', artistMbids: [], sourceAlbumMbids: [], sourceTitles: [title], observedScrobbles: 0, lastPlayedAt: '', trackIds: [], tracklistSource: 'observed', metadataStatus: 'unresolved', origin: 'manual' };
}
export function manualTrack(albumId: string, title: string): MusicTrack {
  return { id: 'track-' + digest(albumId + '\0' + trackName(title)), albumId, title, musicbrainzIds: [], observedScrobbles: 0 };
}
