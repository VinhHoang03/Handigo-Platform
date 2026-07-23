interface SectionHeaderProps {
  title: string;
  description?: string;
  centered?: boolean;
  action?: React.ReactNode;
  /** Gắn vào <h2> để section cha tham chiếu được qua aria-labelledby. */
  id?: string;
}

export const SectionHeader = ({
  title,
  description,
  centered = false,
  action,
  id,
}: SectionHeaderProps) => (
  <div
    className={`${centered ? 'text-center' : 'flex flex-col justify-between gap-4 md:flex-row md:items-end'} mb-lg`}
  >
    <div className={centered ? 'mx-auto max-w-2xl' : 'max-w-2xl'}>
      <h2
        id={id}
        className="text-balance font-headline-lg text-headline-lg tracking-[-0.02em] text-on-surface"
      >
        {title}
      </h2>
      {description && (
        <p className="mt-2.5 text-pretty font-body-md text-body-md text-on-surface-variant">
          {description}
        </p>
      )}
    </div>
    {action}
  </div>
);
