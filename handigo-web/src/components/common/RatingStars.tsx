interface RatingStarsProps {
  value: number;
  editable?: boolean;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function RatingStars({ value, editable, onChange, size = 'md' }: RatingStarsProps) {
  const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' };
  return (
    <div className="flex gap-1" aria-label={`${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!editable}
          onClick={() => onChange?.(star)}
          className={`${sizes[size]} ${star <= value ? 'text-amber-400' : 'text-outline-variant'} disabled:cursor-default`}
          aria-label={`${star} sao`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
