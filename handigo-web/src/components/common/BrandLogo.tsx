import { Link } from 'react-router-dom';
import logoImg from '../../assets/logo.png';

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
  to?: string;
}

export const BrandLogo = ({ compact = false, className = '', to = '/' }: BrandLogoProps) => (
  <Link className={`inline-flex min-h-11 items-center ${className}`} to={to} aria-label="Handigo Service Platform">
    <span className={`relative block shrink-0 overflow-hidden rounded-lg bg-white ${compact ? 'h-12 w-44' : 'h-14 w-52'}`}>
      <img src={logoImg} alt="Handigo Service Platform" className="h-full w-full object-cover" />
    </span>
  </Link>
);

/** Biểu tượng rút gọn, cắt trực tiếp từ logo chính để dùng khi sidebar thu gọn. */
export const BrandMark = ({ className = '' }: Pick<BrandLogoProps, 'className'>) => (
  <span className={`relative block size-10 shrink-0 overflow-hidden rounded-xl bg-white ${className}`}>
    <img
      src={logoImg}
      alt=""
      aria-hidden="true"
      className="absolute -left-4 -top-16 h-[169px] w-[174px] max-w-none"
    />
  </span>
);
