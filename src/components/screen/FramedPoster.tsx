import { memo, useState, type CSSProperties } from 'react';
import type { ScreenTitle } from '../../data/screen';
import { Artwork } from '../shared/Artwork';
import { MetadataTooltip } from '../shared/MetadataTooltip';

export const FramedPoster = memo(function FramedPoster({ item, index, duplicate, onOpen }: { item: ScreenTitle; index: number; duplicate: boolean; onOpen: (rect: DOMRect, element: HTMLButtonElement) => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  return <button className={`poster-target poster-${index % 4}`} style={{ '--frame': item.frameColor, '--poster-color': item.dominantColor } as CSSProperties}
    tabIndex={duplicate ? -1 : 0} aria-hidden={duplicate || undefined} aria-label={`${item.title}, ${item.year ?? ''}, ${item.type === 'series' ? 'television' : item.type}. Open screen details`}
    onPointerEnter={e => { if (e.pointerType !== 'touch') setRect(e.currentTarget.getBoundingClientRect()); }} onPointerLeave={() => setRect(null)} onFocus={e => setRect(e.currentTarget.getBoundingClientRect())} onBlur={() => setRect(null)}
    onClick={e => { setRect(null); onOpen(e.currentTarget.getBoundingClientRect(), e.currentTarget); }}>
    <span className="poster-frame"><Artwork src={item.poster} title={item.title} subtitle={String(item.year ?? '')} /><span className="frame-glass" /></span>
    {rect && <MetadataTooltip title={item.title} metadata={[item.year, item.type === 'series' ? 'Television' : item.type === 'short' ? 'Short film' : 'Film', item.personalRating ? `${item.personalRating}/10 personal` : undefined].filter(Boolean).join(' · ')} rect={rect} />}
  </button>;
});
