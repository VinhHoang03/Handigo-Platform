import { Link } from 'react-router-dom';
import { BrandLogo } from '../common/BrandLogo';
import { MaterialIcon } from '../common/MaterialIcon';
import { profileImages, sidebarItems } from './profileData';
import type { AuthUser } from '../../types/auth';

interface ProfileNavProps {
  user?: AuthUser;
  onLogout?: () => void;
}

export const ProfileTopNav = ({ user, onLogout }: ProfileNavProps) => (
  <nav className="sticky top-4 z-50 flex items-center justify-between px-md py-base bg-surface/80 backdrop-blur-md font-headline-md text-headline-md mx-auto rounded-xl max-w-[calc(100%-48px)] border border-outline-variant/50 shadow-md">
    <div className="flex items-center gap-4">
      <BrandLogo compact />
      <div className="hidden md:flex items-center ml-lg gap-gutter">
        <Link className="text-on-surface-variant hover:bg-surface-container-low transition-all duration-200 px-3 py-1 rounded-lg text-label-md font-label-md" to="/">Khám phá</Link>
        <Link className="text-on-surface-variant hover:bg-surface-container-low transition-all duration-200 px-3 py-1 rounded-lg text-label-md font-label-md" to="#">Dịch vụ</Link>
        <Link className="text-primary font-bold text-label-md font-label-md" to="/profile">Hồ sơ</Link>
      </div>
    </div>
    <div className="flex items-center gap-sm">
      <button className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-all" type="button" aria-label="Thông báo"><MaterialIcon>notifications</MaterialIcon></button>
      <button className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-all" type="button" aria-label="Tin nhắn"><MaterialIcon>chat_bubble</MaterialIcon></button>
      <div className="h-10 w-10 rounded-full border border-primary p-0.5 overflow-hidden">
        <img alt="Ảnh đại diện người dùng" className="h-full w-full object-cover rounded-full" src={user?.avatar || profileImages.avatar} />
      </div>
      <button className="hidden sm:inline-flex px-3 py-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-all text-label-md" type="button" onClick={onLogout}>
        Đăng xuất
      </button>
    </div>
  </nav>
);

export const ProfileSidebar = () => (
  <aside className="hidden md:flex flex-col h-screen p-md gap-4 w-64 fixed left-0 top-0 border-r border-outline-variant/30 bg-surface shadow-sm z-40">
    <div className="mb-lg pt-4">
      <h2 className="font-headline-md text-headline-md font-bold text-primary">Handigo</h2>
      <p className="text-on-surface-variant font-body-md text-[13px]">Trung tâm dịch vụ cao cấp</p>
    </div>
    <nav className="flex flex-col gap-2">
      {sidebarItems.map((item) => (
        <Link
          key={item.label}
          className={`flex items-center gap-3 p-3 rounded-lg transition-transform duration-200 ${item.active ? 'bg-primary-container text-on-primary-container font-semibold scale-[0.98]' : 'text-on-surface-variant hover:bg-surface-container-low hover:translate-x-1'}`}
          to="#"
        >
          <MaterialIcon>{item.icon}</MaterialIcon>
          <span className="font-label-md text-label-md">{item.label}</span>
        </Link>
      ))}
    </nav>
    <div className="mt-auto pb-4">
      <button className="w-full py-3 px-4 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:shadow-lg transition-all duration-300" type="button">Chuyển sang nhà cung cấp</button>
    </div>
  </aside>
);

export const MobileProfileNav = () => (
  <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/20 flex justify-around items-center py-4 px-6 z-50">
    {sidebarItems.filter((item) => item.label !== 'Ví tiền').map((item) => (
      <button key={item.label} className={`flex flex-col items-center gap-1 ${item.active ? 'text-primary' : 'text-on-surface-variant'}`} type="button">
        <MaterialIcon filled={item.active}>{item.icon === 'settings' ? 'person' : item.icon}</MaterialIcon>
        <span className="text-[10px] font-semibold">{item.label}</span>
      </button>
    ))}
  </nav>
);
