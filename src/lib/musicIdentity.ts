export const musicName = (value: string) => {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’‘]/g, "'").trim();
  return normalized.replace(/[^\p{L}\p{N}]+/gu, ' ').trim() || normalized;
};
export const albumName = (value: string) => musicName(value.replace(/\s*[([](?:super\s+)?(?:deluxe(?: edition| version)?|\d+(?:th|st|nd|rd) anniversary(?: edition)?|standard version|remastered(?: edition)?)[)\]]\s*/gi, ' '));
export const musicIdentity = (artist: string, title: string) => musicName(artist) + '\0' + albumName(title);
