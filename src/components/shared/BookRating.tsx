const points = '12 2.5 14.9 8.4 21.4 9.3 16.7 13.9 17.8 20.4 12 17.3 6.2 20.4 7.3 13.9 2.6 9.3 9.1 8.4';
export function Star({ filled }: { filled: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={`rating-star ${filled ? 'filled' : ''}`}><polygon points={points} /></svg>;
}

export function BookRating({ rating, compact = false }: { rating?: number; compact?: boolean }) {
  if (!rating) return <span className="unrated">Unrated</span>;
  return <span className={`book-rating ${compact ? 'compact' : ''}`} role="img" aria-label={`${rating} out of 5 stars`}>
    <span className="rating-stars" aria-hidden="true">{[1, 2, 3, 4, 5].map(n => <Star key={n} filled={n <= rating} />)}</span>
    <span className="rating-number" aria-hidden="true">{rating}/5</span>
  </span>;
}

export function BookRatingEditor({ rating, onChange, disabled, label = 'Book rating' }: { rating?: number; onChange: (rating: number) => void; disabled?: boolean; label?: string }) {
  return <div role="radiogroup" aria-label={label} className="rating-editor-stars">
    {[1, 2, 3, 4, 5].map(n => <button type="button" role="radio" aria-checked={rating === n} aria-label={`${n} out of 5 stars`} key={n} disabled={disabled}
      tabIndex={n === (rating || 1) ? 0 : -1} onClick={() => onChange(n)} onKeyDown={e => {
        let next = n;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = n === 5 ? 1 : n + 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = n === 1 ? 5 : n - 1;
        else if (e.key === 'Home') next = 1;
        else if (e.key === 'End') next = 5;
        else return;
        e.preventDefault(); onChange(next);
        e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next - 1].focus();
      }}><Star filled={n <= (rating ?? 0)} /></button>)}
  </div>;
}
