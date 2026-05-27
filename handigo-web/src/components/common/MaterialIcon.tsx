interface MaterialIconProps {
  children: string;
  className?: string;
  filled?: boolean;
}

export const MaterialIcon = ({ children, className = '', filled = false }: MaterialIconProps) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
  >
    {children}
  </span>
);
