interface SectionHeaderProps {
  title: string;
  description?: string;
  centered?: boolean;
  action?: React.ReactNode;
}

export const SectionHeader = ({ title, description, centered = false, action }: SectionHeaderProps) => (
  <div className={`${centered ? 'text-center' : 'flex flex-col md:flex-row md:items-center justify-between gap-4'} mb-lg`}>
    <div>
      <h2 className="font-headline-lg text-headline-lg text-on-surface">{title}</h2>
      {description && <p className="font-body-md text-body-md text-on-surface-variant mt-2">{description}</p>}
    </div>
    {action}
  </div>
);
