import { Link } from 'react-router-dom';
import logoImg from '../../assets/logo.png';

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
  to?: string;
}

export const BrandLogo = ({ compact = false, className = '', to = '/' }: BrandLogoProps) => (
  <Link className={`flex items-center gap-2 ${className}`} to={to}>
    <img src={logoImg} alt="Logo Handigo" className={`${compact ? 'h-8' : 'h-10'} w-auto object-contain`} />
    <span className={`${compact ? 'font-headline-md text-headline-md' : 'text-xl'} font-bold text-primary`}>
      Handigo
    </span>
  </Link>
);
