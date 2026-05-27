import { Link } from 'react-router-dom';

export const AuthLegalLinks = () => (
  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 lg:left-auto lg:right-8 lg:translate-x-0 flex space-x-4 text-[10px] font-bold text-on-surface-variant/60 dark:text-outline-variant/40 uppercase tracking-widest whitespace-nowrap">
    <Link className="hover:text-primary transition-colors" to="#">Trợ giúp</Link>
    <Link className="hover:text-primary transition-colors" to="#">Điều khoản</Link>
    <Link className="hover:text-primary transition-colors" to="#">Bảo mật</Link>
    <span>© 2024 Handigo</span>
  </div>
);
