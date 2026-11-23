import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { normalizeMusic, enrichAlbum, albumName, matchingMusicAlbum, manualAlbum } from '../scripts/import-music';
import { albums, tracks } from '../src/data/music';
import { mergeAlbums, validateOverride } from '../src/lib/personalization';

const row = (uts: number, album = 'Home', artist = 'Artist', track = 'Song') => ({ uts: String(uts), album, artist, track });
test('music aggregation applies exactly 70 after edition normalization and genuine event deduplication', () => {
  const source = [...Array.from({ length: 69 }, (_, i) => row(1700000000 + i, 'Sixty-nine')), ...Array.from({ length: 70 }, (_, i) => row(1700000100 + i, i % 2 ? 'Seventy (Deluxe Edition)' : 'Seventy')), ...Array.from({ length: 71 }, (_, i) => row(1700000200 + i, 'Seventy-one'))];
  source.push(source[0]);
  const result = normalizeMusic(source);
  assert.equal(result.duplicates, 1); assert.equal(result.events, 210);
  assert.deepEqual(result.included.map(group => group.album.observedScrobbles), [71, 70]);
  assert.equal(result.groups.find(group => group.album.title === 'Seventy')!.album.sourceTitles.length, 2);
  assert.equal(normalizeMusic(source, 71).included.length, 1);
  assert.equal(normalizeMusic(source, 69).included.length, 3);
  assert.throws(() => normalizeMusic(source, 0), /positive whole number/);
  assert.deepEqual(result, normalizeMusic([...source].reverse()));
});
test('stable identities keep artists, distinct records and tracks associated across repeat imports', () => {
  const source = [row(1700000000), row(1700000001, 'Home', 'Other'), row(1700000002, 'Other record'), row(1700000003, '?', '¥$')];
  const result = normalizeMusic(source);
  assert.equal(result.groups.length, 4); assert.equal(result.invalid, 0);
  assert.equal(new Set(result.groups.map(group => group.album.id)).size, 4);
  const home = result.groups.find(group => group.album.title === 'Home' && group.album.artist === 'Artist')!;
  const reimport = normalizeMusic([...source, row(1700000004)]).groups.find(group => group.album.id === home.album.id)!;
  assert.equal(home.album.artistId, reimport.album.artistId);
  assert.deepEqual([...home.tracks.keys()], [...reimport.tracks.keys()]);
  for (const group of result.groups) for (const track of group.tracks.values()) assert.equal(track.albumId, group.album.id);
  assert.notEqual(albumName('Home (Live)'), albumName('Home'));
  assert.throws(() => normalizeMusic([{ album: 'Missing fields' }]), /Missing/);
  assert.equal(normalizeMusic([row(1700000000, '', 'Artist')]).invalid, 1);
});
test('metadata IDs are verified against album and artist; unavailable and ambiguous matches retain observed history', async () => {
  const original = normalizeMusic([row(1700000000)]).groups[0];
  assert.equal(matchingMusicAlbum(original.album, { title: 'Home', 'artist-credit': [{ artist: { name: 'Someone else' } }] }), false);
  const misleading = { ...original.album, artistMbids: ['misleading-source-id'] };
  assert.equal(matchingMusicAlbum(misleading, { title: 'Home', 'artist-credit': [{ artist: { id: 'misleading-source-id', name: 'Wrong artist' } }] }), false);
  const album = structuredClone(original.album); album.sourceAlbumMbids = ['00000000-0000-0000-0000-000000000001'];
  const observed = [...original.tracks.values()];
  const result = await enrichAlbum(album, observed, async url => url.includes('/release/') ? { id: 'wrong', title: 'Home', 'artist-credit': [{ artist: { name: 'Other' } }], 'release-group': { id: 'wrong' } } : undefined);
  assert.equal(result.album.metadataStatus, 'unresolved'); assert.equal(result.album.artwork, ''); assert.deepEqual(result.tracks, observed);
  const ambiguous = await enrichAlbum(structuredClone(original.album), observed, async () => ({ 'release-groups': ['one', 'two'].map(id => ({ id, title: 'Home', 'artist-credit': [{ artist: { name: 'Artist' } }] })) }));
  assert.equal(ambiguous.album.metadataStatus, 'ambiguous'); assert.equal(ambiguous.album.tracklistSource, 'observed');
});
test('only complete verified release metadata is advertised as a complete tracklist', async () => {
  const original = normalizeMusic([row(1700000000)]).groups[0];
  const album = structuredClone(original.album); album.sourceAlbumMbids = ['00000000-0000-0000-0000-000000000001'];
  const release = { id: 'release', title: 'Home', date: '2000-01-01', 'artist-credit': [{ artist: { name: 'Artist' } }], 'release-group': { id: 'group' }, media: [{ position: 1, 'track-count': 2, tracks: [{ title: 'Song', position: 1 }, { title: 'Other song', position: 2 }] }] };
  const lookup = async (url: string) => url.includes('/release/') ? release : undefined;
  const complete = await enrichAlbum(structuredClone(album), [...original.tracks.values()], lookup);
  assert.equal(complete.album.tracklistSource, 'verified'); assert.equal(complete.tracks.length, 2); assert.equal(complete.tracks.find(track => track.title === 'Song')?.observedScrobbles, 1);
  release.media[0]['track-count'] = 3;
  const partial = await enrichAlbum(structuredClone(album), [...original.tracks.values()], lookup);
  assert.equal(partial.album.tracklistSource, 'observed'); assert.equal(partial.tracks.length, 1);
});
test('generated music has bounded inclusion, unique references, local covers and independent five-star overrides', () => {
  assert.ok(albums.length > 0); const ids = new Set(albums.map(album => album.id));
  assert.equal(ids.size, albums.length); assert.equal(new Set(tracks.map(track => track.id)).size, tracks.length);
  for (const album of albums) {
    assert.ok(album.observedScrobbles >= 70); assert.ok(album.artistId);
    if (album.artwork) assert.ok(existsSync('public' + album.artwork));
    const observed = tracks.filter(track => track.albumId === album.id).reduce((sum, track) => sum + track.observedScrobbles, 0);
    assert.equal(observed, album.observedScrobbles);
    assert.ok(album.trackIds.every(id => tracks.some(track => track.id === id && track.albumId === album.id)));
  }
  const override = validateOverride({ media_type: 'album', media_id: albums[0].id, is_favorite: true, personal_comment: 'A keeper', rating_is_overridden: true, personal_rating: 4 });
  const merged = mergeAlbums(albums, [override]); assert.equal(merged[0].personalRating, 4); assert.equal(merged[0].isFavorite, true); assert.equal(merged[0].personalComment, 'A keeper');
  assert.throws(() => validateOverride({ ...override, personal_rating: 6 }));
});
test('an explicitly chosen metadata group cannot use another group’s same-named release', async () => {
  const groupId = '00000000-0000-0000-0000-000000000001';
  const album = manualAlbum('Home', 'Artist');
  const credits = [{ artist: { name: 'Artist' } }];
  const group = { id: groupId, title: 'Home', 'artist-credit': credits, releases: [{ id: 'edition', status: 'Official' }] };
  const release = { id: 'edition', title: 'Home', 'artist-credit': credits, 'release-group': { id: 'another-group' }, media: [{ position: 1, 'track-count': 1, tracks: [{ position: 1, title: 'A song' }] }] };
  const lookup = async (url: string) => url.includes('/release-group/') ? group : url.includes('/release/') ? release : undefined;
  const rejected = await enrichAlbum(structuredClone(album), [], lookup, groupId);
  assert.equal(rejected.album.releaseId, undefined); assert.equal(rejected.tracks.length, 0);
  release['release-group'].id = groupId;
  const selected = await enrichAlbum(structuredClone(album), [], lookup, groupId);
  assert.equal(selected.album.musicbrainzId, groupId); assert.equal(selected.album.tracklistSource, 'verified');
});
