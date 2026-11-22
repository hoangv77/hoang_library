import { useEffect, useState } from 'react';

const title = 'Between pages and screens.';
export function TypedTitle() {
  const [length, setLength] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? title.length : 0);
  useEffect(() => {
    const timer = window.setInterval(() => setLength(n => {
      if (n >= title.length) window.clearInterval(timer);
      return Math.min(title.length, n + 1);
    }), 95);
    return () => window.clearInterval(timer);
  }, []);
  return <h1 aria-label={title}><span aria-hidden="true">{title.slice(0, length)}<span className={`type-caret ${length === title.length ? 'finished' : ''}`}>|</span></span></h1>;
}
