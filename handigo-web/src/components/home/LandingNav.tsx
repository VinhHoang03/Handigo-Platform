import { Link } from 'react-router-dom';
import { BrandLogo } from '../common/BrandLogo';

interface LandingNavProps {
  isScrolled: boolean;
}

export const LandingNav = ({ isScrolled }: LandingNavProps) => (
  <nav className={`fixed left-1/2 z-50 flex w-[calc(100%-32px)] max-w-7xl -translate-x-1/2 items-center justify-between rounded-2xl border border-outline-variant/40 bg-white/85 px-4 py-3 text-primary shadow-sm backdrop-blur-xl transition-all duration-300 sm:px-6 ${isScrolled ? 'top-2 shadow-xl' : 'top-4'}`}>
    <BrandLogo compact />
    <div className="hidden md:flex items-center gap-8 font-body-md text-body-md">
      <Link className="text-primary font-bold border-b-2 border-primary pb-1" to="/">Trang chủ</Link>
      <Link className="text-on-surface-variant hover:text-primary transition-colors" to="#">Dịch vụ</Link>
      <Link className="text-on-surface-variant hover:text-primary transition-colors" to="#">Trở thành đối tác</Link>
      <Link className="text-on-surface-variant hover:text-primary transition-colors" to="/profile">Hồ sơ</Link>
      <Link className="text-on-surface-variant hover:text-primary transition-colors" to="#">Hỗ trợ</Link>
    </div>
    <div className="flex items-center gap-3">
      <Link to="/login" className="hidden rounded-lg px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low sm:inline-flex">Đăng nhập</Link>
      <Link to="/register" className="btn-primary min-h-10 px-4 py-2 text-sm sm:px-5">Đăng ký</Link>
    </div>
  </nav>
);
