import { useState } from 'react';
import {
  AirVent,
  Baby,
  Bug,
  Car,
  CookingPot,
  Drill,
  Droplets,
  Grid2X2,
  Hammer,
  House,
  Leaf,
  Paintbrush,
  PawPrint,
  PlugZap,
  ShieldCheck,
  Shirt,
  Snowflake,
  Sparkles,
  SprayCan,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

interface CategoryIconProps {
  icon?: string | null;
  name?: string;
  className?: string;
  imageClassName?: string;
  strokeWidth?: number;
}

const iconMap: Record<string, LucideIcon> = {
  category: Grid2X2,
  apps: Grid2X2,
  electrical: PlugZap,
  electrical_services: PlugZap,
  electricity: PlugZap,
  bolt: PlugZap,
  dien_dan_dung: PlugZap,
  air_conditioning: Snowflake,
  ac_unit: Snowflake,
  air_vent: AirVent,
  dien_lanh: Snowflake,
  plumbing: Wrench,
  water: Droplets,
  water_drop: Droplets,
  nuoc_va_duong_ong: Wrench,
  cleaning: Sparkles,
  cleaning_services: Sparkles,
  spray_cleaning: SprayCan,
  ve_sinh_nha_cua: Sparkles,
  appliance_repair: Drill,
  home_repair_service: Drill,
  home_repair: Hammer,
  sua_chua_gia_dung: Drill,
  handyman: Hammer,
  construction: Hammer,
  painting: Paintbrush,
  format_paint: Paintbrush,
  laundry: Shirt,
  local_laundry_service: Shirt,
  cooking: CookingPot,
  restaurant: CookingPot,
  gardening: Leaf,
  yard: Leaf,
  pest_control: Bug,
  car_repair: Car,
  childcare: Baby,
  child_care: Baby,
  pet_care: PawPrint,
  pets: PawPrint,
  security: ShieldCheck,
  shield: ShieldCheck,
  home: House,
};

const normalizeKey = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const isImageSource = (value?: string | null) => {
  if (!value) return false;
  return /^(https?:)?\/\//i.test(value) || value.startsWith('/') || value.startsWith('data:image/');
};

export const CategoryIcon = ({
  icon,
  name,
  className = 'h-6 w-6',
  imageClassName,
  strokeWidth = 1.8,
}: CategoryIconProps) => {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const imageFailed = Boolean(icon && failedImage === icon);

  if (isImageSource(icon) && !imageFailed) {
    const src = icon!.replace(/^http:\/\/res\.cloudinary\.com/i, 'https://res.cloudinary.com');
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className={imageClassName || `${className} object-contain`}
        onError={() => setFailedImage(icon || '')}
      />
    );
  }

  const Icon = iconMap[normalizeKey(icon)] || iconMap[normalizeKey(name)] || Grid2X2;
  return <Icon aria-hidden="true" className={className} strokeWidth={strokeWidth} />;
};
