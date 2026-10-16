import { isCategoryIconColor, resolveCategoryIcon } from './category-icons';

interface CategoryIconProps {
  icon?: string | null;
  name?: string;
  color?: string | null;
  className?: string;
  strokeWidth?: number;
}

export const CategoryIcon = ({
  icon,
  name,
  color,
  className = 'h-6 w-6',
  strokeWidth = 2,
}: CategoryIconProps) => {
  const Icon = resolveCategoryIcon(icon, name).component;
  return (
    <Icon
      aria-hidden="true"
      className={className}
      strokeWidth={strokeWidth}
      style={isCategoryIconColor(color) ? { color } : undefined}
    />
  );
};
