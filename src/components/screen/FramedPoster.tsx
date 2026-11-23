import { memo, useState, type CSSProperties } from 'react';
import type { PersonalScreenTitle as ScreenTitle } from '../../lib/personalization';
import { Artwork } from '../shared/Artwork';
import { MetadataTooltip } from '../shared/MetadataTooltip';

export const FramedPoster = memo(function FramedPoster({ item, index, duplicate, onOpen, isCurrent = false }: { item: ScreenTitle; isCurrent?: boolean; index: number; duplicate: boolean; onOpen: (rect: DOMRect, element: HTMLButtonElement) => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  return <button className={`poster-target poster-${index % 4} ${isCurrent ? 'is-current' : ''} ${item.isFavorite ? 'is-favorite' : ''}`} style={{ '--frame': item.frameColor, '--poster-color': item.dominantColor } as CSSProperties}
    data-media-kind="screen" data-media-id={item.id} tabIndex={duplicate ? -1 : 0} aria-hidden={duplicate || undefined} aria-label={`${item.title}, ${item.year ?? ''}, ${item.type === 'series' ? 'television' : item.type}${isCurrent ? ', currently watching' : ''}${item.isFavorite ? ', personal favorite' : ''}. Open screen details`}
    onPointerEnter={e => { if (e.pointerType !== 'touch') setRect(e.currentTarget.getBoundingClientRect()); }} onPointerLeave={() => setRect(null)} onFocus={e => { if (!e.currentTarget.dataset.returningFocus) setRect(e.currentTarget.getBoundingClientRect()); }} onBlur={() => setRect(null)}
    onClick={e => { setRect(null); onOpen(e.currentTarget.getBoundingClientRect(), e.currentTarget); }}>
    <span className="poster-frame"><Artwork src={item.poster} title={item.title} subtitle={String(item.year ?? '')} /><span className="frame-glass" /></span>
    {rect && <MetadataTooltip title={item.title} metadata={[item.year, isCurrent ? 'Watching now' : undefined, item.type === 'series' ? 'Television' : item.type === 'short' ? 'Short film' : 'Film', item.personalRating ? `${item.personalRating}/10 personal` : undefined, item.isFavorite ? 'Personal favorite' : undefined].filter(Boolean).join(' · ')} rect={rect} />}
  </button>;
});
