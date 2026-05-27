import { Link } from 'react-router-dom';
import { BrandLogo } from '../common/BrandLogo';

interface LandingNavProps {
  isScrolled: boolean;
}

export const LandingNav = ({ isScrolled }: LandingNavProps) => (
  <nav className={`bg-surface/80 dark:bg-inverse-surface/80 backdrop-blur-md text-primary dark:text-primary-fixed fixed left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-7xl rounded-xl border border-outline-variant/30 dark:border-outline/20 flex justify-between items-center px-6 py-3 z-50 transition-all duration-300 ${isScrolled ? 'shadow-xl top-2' : 'top-4'}`}>
    <BrandLogo compact />
    <div className="hidden md:flex items-center gap-8 font-body-md text-body-md">
      <Link className="text-primary font-bold border-b-2 border-primary pb-1" to="/">Trang chủ</Link>
      <Link className="text-on-surface-variant hover:text-primary transition-colors" to="#">Dịch vụ</Link>
      <Link className="text-on-surface-variant hover:text-primary transition-colors" to="#">Trở thành đối tác</Link>
      <Link className="text-on-surface-variant hover:text-primary transition-colors" to="/profile">Hồ sơ</Link>
      <Link className="text-on-surface-variant hover:text-primary transition-colors" to="#">Hỗ trợ</Link>
    </div>
    <div className="flex items-center gap-3">
      <Link to="/signin" className="px-4 py-2 text-on-surface-variant hover:bg-surface-container-low dark:hover:bg-on-surface-variant/10 rounded-lg transition-all font-label-md text-label-md">Đăng nhập</Link>
      <button className="px-5 py-2 bg-primary-container text-on-primary-container font-label-md text-label-md rounded-xl shadow-md active:scale-95 transition-all">Đăng ký</button>
    </div>
  </nav>
);
