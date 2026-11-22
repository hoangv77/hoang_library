import { useState } from 'react';

export function Artwork({ src, title, subtitle, className = '', eager = false }: { src?: string; title: string; subtitle?: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <span className={`artwork ${className}`}>
    {src && !failed ? <img src={src} alt={title} draggable={false} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} /> : <span className="artwork-fallback"><span className="fallback-rule" /><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}<span className="fallback-rule" /></span>}
  </span>;
}
