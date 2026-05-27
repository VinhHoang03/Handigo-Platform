import { MaterialIcon } from '../common/MaterialIcon';
import { profileImages } from './profileData';
import type { AuthUser } from '../../types/auth';

interface ProfileHeroProps {
  user: AuthUser;
}

const roleLabels: Record<AuthUser['role'], string> = {
  ADMIN: 'Quản trị viên',
  CUSTOMER: 'Khách hàng',
  PROVIDER: 'Nhà cung cấp',
};

const statusLabels: Record<AuthUser['status'], string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Tạm ngưng',
  BANNED: 'Bị khóa',
};

export const ProfileHero = ({ user }: ProfileHeroProps) => (
  <section className="relative h-[320px] rounded-3xl overflow-hidden mt-base border border-outline-variant/30">
    <img alt="Ảnh bìa hồ sơ" className="w-full h-full object-cover" src={profileImages.cover} />
    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
    <div className="absolute bottom-6 left-6 flex items-end gap-md">
      <div className="relative">
        <div className="h-32 w-32 rounded-2xl border-4 border-background overflow-hidden shadow-xl">
          <img alt="Ảnh đại diện hồ sơ" className="h-full w-full object-cover" src={user.avatar || profileImages.avatar} />
        </div>
        <span className="absolute -bottom-2 -right-2 h-8 w-8 bg-surface border-4 border-background rounded-full flex items-center justify-center">
          <span className="h-3 w-3 bg-secondary rounded-full animate-pulse" />
        </span>
      </div>
      <div className="mb-xs">
        <h1 className="font-headline-lg text-headline-lg text-on-background">{user.fullName}</h1>
        <p className="text-on-surface-variant font-body-md flex items-center gap-1">
          <MaterialIcon className="text-[18px]">verified</MaterialIcon>
          {roleLabels[user.role]} - {statusLabels[user.status]}
        </p>
      </div>
    </div>
    <button className="absolute bottom-6 right-6 flex items-center gap-2 bg-surface/40 hover:bg-surface/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 transition-all font-label-md text-label-md" type="button">
      <MaterialIcon className="text-[20px]">photo_camera</MaterialIcon>
      Đổi ảnh bìa
    </button>
  </section>
);
