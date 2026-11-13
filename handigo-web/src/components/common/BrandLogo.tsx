import { Link } from 'react-router-dom';
import logoImg from '../../assets/logo.png';

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
  to?: string;
}

export const BrandLogo = ({ compact = false, className = '', to = '/' }: BrandLogoProps) => (
  <Link className={`inline-flex min-h-11 items-center ${className}`} to={to} aria-label="Handigo Service Platform">
    <BrandLogoArtwork className={compact ? 'h-12 w-44' : 'h-14 w-52'} />
  </Link>
);

export const BrandLogoArtwork = ({ className = '' }: Pick<BrandLogoProps, 'className'>) => (
  <span className={`relative block shrink-0 overflow-hidden rounded-lg bg-white ${className}`}>
    <img src={logoImg} alt="Handigo Service Platform" className="h-full w-full object-cover" />
  </span>
);

export const BrandMark = ({ className = '' }: Pick<BrandLogoProps, 'className'>) => (
  <img src="/favicon.png" alt="" className={`size-10 shrink-0 rounded-xl ${className}`} />
);
