import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

export function MetadataTooltip({ title, subtitle, metadata, rect, children }: { title: string; subtitle?: string; metadata: string; rect: DOMRect; children?: ReactNode }) {
  const left = Math.max(140, Math.min(window.innerWidth - 140, rect.left + rect.width / 2));
  const below = rect.top < 170;
  return createPortal(<div role="tooltip" className={`metadata-tooltip ${below ? 'below' : ''}`} style={{ left, top: below ? rect.bottom + 14 : rect.top - 18 }}>
    <strong>{title}</strong>{subtitle && <span>{subtitle}</span>}<small>{metadata}</small>{children}
  </div>, document.body);
}
