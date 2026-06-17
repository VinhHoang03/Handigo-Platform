import type { FormEvent, ReactNode } from 'react';
import { FormField } from '../common/FormField';
import { MaterialIcon } from '../common/MaterialIcon';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { activityStats, notifications, quickLinks, skills } from './profileData';
import type { AuthUser, ChangePasswordInput, ProfileUpdateInput } from '../../types/auth';

const settingAccentClasses = {
  primary: 'bg-primary-container/20 text-primary',
  secondary: 'bg-secondary-container/20 text-secondary',
};

const roleLabels: Record<AuthUser['role'], string> = {
  ADMIN: 'Quản trị viên',
  CUSTOMER: 'Khách hàng',
  PROVIDER: 'Nhà cung cấp',
};

const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`glass-card p-md rounded-2xl ${className}`}>{children}</div>
);

const formatJoinDate = (date?: string) => {
  if (!date) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(new Date(date));
};

export const ActivityOverview = ({ user }: { user: AuthUser }) => {
  const stats = [
    ...activityStats,
    { label: 'Ngày tham gia', value: formatJoinDate(user.createdAt) },
  ];

  return (
    <Card>
      <h3 className="font-headline-md text-headline-md text-on-surface mb-4">Tổng Quan Hoạt Động</h3>
      <div className="space-y-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex justify-between items-center p-3 bg-surface-container-low rounded-xl">
            <span className="text-on-surface-variant font-label-md">{stat.label}</span>
            <span className="flex items-center gap-1 font-bold text-primary">
              {stat.value}
              {'icon' in stat && stat.icon && <MaterialIcon className="text-[16px] text-tertiary-container" filled>{stat.icon}</MaterialIcon>}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};

export const ProfileQuickLinks = () => (
  <Card>
    <nav className="space-y-1">
      {quickLinks.map((link) => (
        <button key={link.label} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${link.active ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface-variant hover:bg-surface-container-low'}`} type="button">
          <MaterialIcon>{link.icon}</MaterialIcon>
          {link.label}
        </button>
      ))}
    </nav>
  </Card>
);

interface PersonalInfoSectionProps {
  form: ProfileUpdateInput;
  user: AuthUser;
  isSaving: boolean;
  message: string | null;
  onChange: (field: keyof ProfileUpdateInput, value: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const PersonalInfoSection = ({ form, user, isSaving, message, onChange, onCancel, onSubmit }: PersonalInfoSectionProps) => (
  <form className="glass-card p-lg rounded-3xl" onSubmit={onSubmit}>
    <div className="flex justify-between items-center mb-lg">
      <h3 className="font-headline-lg text-headline-lg text-on-surface">Thông Tin Cá Nhân</h3>
      <span className={`px-3 py-1 rounded-full text-label-sm ${user.isEmailVerified ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'}`}>
        {user.isEmailVerified ? 'Email đã xác minh' : 'Email chưa xác minh'}
      </span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
      <FormField id="fullName" label="Họ và tên" value={form.fullName} onChange={(value) => onChange('fullName', value)} />
      <FormField id="email" label="Địa chỉ email" type="email" value={user.email} disabled />
      <FormField id="phone" label="Số điện thoại" type="tel" value={form.phone ?? ''} onChange={(value) => onChange('phone', value)} />
      <FormField id="role" label="Vai trò" value={roleLabels[user.role]} disabled />
      <FormField id="avatar" label="Đường dẫn ảnh đại diện" value={form.avatar ?? ''} className="md:col-span-2" onChange={(value) => onChange('avatar', value)} />
    </div>
    {message && <p className="mt-4 text-label-md text-primary">{message}</p>}
    <div className="flex justify-end gap-md pt-lg">
      <button className="px-8 py-3 text-on-surface-variant font-label-md hover:text-primary transition-all" type="button" onClick={onCancel}>Hủy thay đổi</button>
      <button className="px-12 py-3 bg-primary text-on-primary rounded-2xl font-bold hover:shadow-xl active:scale-95 transition-all duration-200 shadow-md disabled:opacity-60" disabled={isSaving} type="submit">
        {isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
      </button>
    </div>
  </form>
);

export const ProfessionalDetailsSection = ({ role }: { role: AuthUser['role'] }) => {
  if (role !== 'PROVIDER') {
    return null;
  }

  return (
    <div className="glass-card p-lg rounded-3xl">
      <div className="flex items-center gap-3 mb-lg">
        <h3 className="font-headline-lg text-headline-lg text-on-surface">Thông Tin Nghề Nghiệp</h3>
        <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-label-sm">Nhà cung cấp</span>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {skills.map((skill) => (
          <span key={skill} className="px-3 py-1.5 bg-secondary-fixed text-on-secondary-fixed rounded-lg text-label-sm flex items-center gap-1">
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
};

interface SecuritySectionProps {
  form: ChangePasswordInput;
  isSaving: boolean;
  message: string | null;
  onChange: (field: keyof ChangePasswordInput, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const SecuritySection = ({ form, isSaving, message, onChange, onSubmit }: SecuritySectionProps) => (
  <form className="glass-card p-lg rounded-3xl" onSubmit={onSubmit}>
    <h3 className="font-headline-lg text-headline-lg text-on-surface mb-lg">Bảo Mật & Quyền Riêng Tư</h3>
    <div className="space-y-gutter">
      <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20">
        <div className="flex items-center gap-md mb-4">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-primary-container/20 text-primary">
            <MaterialIcon>lock</MaterialIcon>
          </div>
          <div>
            <p className="font-label-md text-label-md text-on-surface">Mật khẩu</p>
            <p className="text-body-md text-on-surface-variant text-sm">Cập nhật mật khẩu tài khoản của bạn.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          <FormField id="currentPassword" label="Mật khẩu hiện tại" type="password" value={form.currentPassword} onChange={(value) => onChange('currentPassword', value)} />
          <FormField id="newPassword" label="Mật khẩu mới" type="password" value={form.newPassword} onChange={(value) => onChange('newPassword', value)} />
        </div>
        {message && <p className="mt-4 text-label-md text-primary">{message}</p>}
        <div className="flex justify-end mt-4">
          <button className="px-6 py-2 border border-primary text-primary rounded-xl font-label-md hover:bg-primary-container transition-all disabled:opacity-60" disabled={isSaving} type="submit">
            {isSaving ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
          </button>
        </div>
      </div>
      <SettingsRow icon="shield_person" title="Xác thực hai lớp (2FA)" description="Thêm một lớp bảo mật cho tài khoản của bạn." action={<ToggleSwitch defaultChecked />} accent="secondary" />
    </div>
  </form>
);

export const NotificationSection = () => (
  <div className="glass-card p-lg rounded-3xl">
    <h3 className="font-headline-lg text-headline-lg text-on-surface mb-lg">Tùy Chọn Thông Báo</h3>
    <div className="space-y-4">
      {notifications.map((notification, index) => (
        <div key={notification.title}>
          <SettingsRow title={notification.title} description={notification.description} action={<ToggleSwitch defaultChecked={notification.enabled} />} compact />
          {index < notifications.length - 1 && <hr className="border-outline-variant/30 mt-4" />}
        </div>
      ))}
    </div>
  </div>
);

interface SettingsRowProps {
  title: string;
  description: string;
  action: ReactNode;
  icon?: string;
  accent?: 'primary' | 'secondary';
  compact?: boolean;
}

const SettingsRow = ({ title, description, action, icon, accent = 'primary', compact = false }: SettingsRowProps) => (
  <div className={`flex items-center justify-between ${compact ? 'py-2' : 'p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20'}`}>
    <div className="flex items-center gap-md">
      {icon && (
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${settingAccentClasses[accent]}`}>
          <MaterialIcon>{icon}</MaterialIcon>
        </div>
      )}
      <div>
        <p className="font-label-md text-label-md text-on-surface">{title}</p>
        <p className="text-body-md text-on-surface-variant text-sm">{description}</p>
      </div>
    </div>
    {action}
  </div>
);
