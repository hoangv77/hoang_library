export type Album = {
  origin?: 'manual';
  id: string; artistId: string; title: string; artist: string; year?: number; genres: string[]; artwork: string;
  musicbrainzId?: string; releaseId?: string; artistMbids: string[]; sourceAlbumMbids: string[];
  sourceTitles: string[]; observedScrobbles: number; lastPlayedAt: string;
  trackIds: string[]; verifiedTrackIds?: string[]; tracklistSource: 'observed' | 'verified' | 'provided';
  metadataStatus: 'resolved' | 'unresolved' | 'ambiguous';
  personalRating?: number;
};
export type MusicTrack = {
  id: string; albumId: string; title: string; trackNumber?: number; discNumber?: number;
  durationMs?: number; musicbrainzIds: string[]; observedScrobbles: number;
};
