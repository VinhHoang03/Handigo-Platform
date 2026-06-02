import React from 'react';
import type {
  BankAccount,
  PerformanceStat,
  PortfolioItem,
  ProviderProfile,
  ServiceArea,
  VerificationItem,
} from '../types/provider.types';

export const ProfileSection: React.FC<{
  title: string;
  actionLabel?: string;
  children: React.ReactNode;
}> = ({ title, actionLabel, children }) => (
  <section className="bg-white p-6 md:p-8 rounded-xl border border-outline-variant/20 shadow-sm">
    <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
      <h3 className="font-headline-md text-headline-md text-on-surface">{title}</h3>
      {actionLabel && (
        <button type="button" className="text-primary font-bold text-sm hover:underline">
          {actionLabel}
        </button>
      )}
    </div>
    {children}
  </section>
);

export const ProviderHero: React.FC<{ profile: ProviderProfile }> = ({ profile }) => (
  <section className="glass-card rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-20 -mt-20" />
    <div className="relative group shrink-0">
      <img
        alt={`${profile.fullName} profile`}
        className="w-32 h-32 rounded-full object-cover ring-4 ring-primary-container/20"
        src={profile.avatarUrl}
      />
      <button type="button" className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform">
        <span className="material-symbols-outlined text-sm">photo_camera</span>
      </button>
    </div>

    <div className="flex-1 text-center md:text-left z-10">
      <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
        <h2 className="font-headline-md text-headline-md">{profile.fullName}</h2>
        {profile.isVerified && (
          <span className="inline-flex items-center gap-1 bg-secondary-container text-on-secondary-container text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            Xác thực
          </span>
        )}
      </div>
      <p className="text-on-surface-variant font-label-md">ID: {profile.providerCode} • Thành viên từ {profile.joinDate}</p>
      <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
        <div className="flex items-center gap-2 bg-surface-container-high/50 px-3 py-1.5 rounded-lg border border-outline-variant/30">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
          <span className="font-bold">{profile.rating}</span>
          <span className="text-xs text-on-surface-variant">({profile.reviewCount} đánh giá)</span>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-high/50 px-3 py-1.5 rounded-lg border border-outline-variant/30">
          <span className="material-symbols-outlined text-primary">task_alt</span>
          <span className="font-bold">{profile.totalBookings}+</span>
          <span className="text-xs text-on-surface-variant">Đã hoàn thành</span>
        </div>
      </div>
    </div>

    <button type="button" className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold shadow-md hover:shadow-lg active:scale-95 transition-all">
      Chỉnh sửa hồ sơ
    </button>
  </section>
);

export const PerformanceStats: React.FC<{ stats: PerformanceStat[] }> = ({ stats }) => (
  <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {stats.map((stat) => (
      <div key={stat.label} className="bg-white p-5 md:p-6 rounded-xl border border-outline-variant/20 shadow-sm hover:shadow-md transition-shadow">
        <p className="text-xs text-on-surface-variant uppercase font-bold tracking-tight mb-2">{stat.label}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-bold text-primary">{stat.value}</h3>
          <span className={`text-[10px] font-bold ${stat.tone === 'warning' ? 'text-tertiary' : 'text-secondary'}`}>
            {stat.meta}
          </span>
        </div>
      </div>
    ))}
  </section>
);

export const InfoField: React.FC<{ label: string; value: React.ReactNode; wide?: boolean }> = ({ label, value, wide }) => (
  <div className={wide ? 'md:col-span-2' : undefined}>
    <label className="block text-xs font-bold text-on-surface-variant uppercase mb-2">{label}</label>
    <div className="font-body-md text-on-surface">{value}</div>
  </div>
);

export const SkillTags: React.FC<{ skills: string[] }> = ({ skills }) => (
  <div className="flex flex-wrap gap-2">
    {skills.map((skill) => (
      <span key={skill} className="bg-surface-container text-on-surface-variant px-3 py-1 rounded-lg text-sm font-medium">
        {skill}
      </span>
    ))}
  </div>
);

export const PortfolioGrid: React.FC<{ items: PortfolioItem[] }> = ({ items }) => (
  <div className="grid grid-cols-3 gap-4">
    {items.map((item) => (
      <div key={item.id} className="aspect-square rounded-xl overflow-hidden group relative">
        <img alt={item.alt} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src={item.imageUrl} />
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="material-symbols-outlined text-white">visibility</span>
        </div>
      </div>
    ))}
  </div>
);

export const VerificationPanel: React.FC<{ items: VerificationItem[] }> = ({ items }) => (
  <aside className="bg-white p-6 rounded-xl border border-outline-variant/20 shadow-sm">
    <h3 className="font-headline-md text-headline-md text-on-surface mb-6">Xác thực tài khoản</h3>
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label} className={`flex items-center gap-3 p-3 bg-surface-container-low rounded-xl ${item.statusTone === 'pending' ? 'border-2 border-primary/20' : ''}`}>
          <span className={`material-symbols-outlined ${item.statusTone === 'pending' ? 'text-primary' : 'text-secondary'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
            {item.statusTone === 'pending' ? 'pending' : 'check_circle'}
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold">{item.label}</p>
            <p className={`text-[10px] uppercase ${item.statusTone === 'pending' ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
              {item.status}
            </p>
          </div>
        </div>
      ))}
    </div>
  </aside>
);

export const ServiceAreaPanel: React.FC<{ area: ServiceArea }> = ({ area }) => (
  <aside className="bg-white p-6 rounded-xl border border-outline-variant/20 shadow-sm overflow-hidden">
    <div className="flex justify-between items-center mb-4">
      <h3 className="font-bold">Khu vực phục vụ</h3>
      <button type="button" className="text-primary text-sm font-bold hover:underline">Cập nhật</button>
    </div>
    <div className="space-y-4">
      <div>
        <p className="text-xs text-on-surface-variant font-bold uppercase mb-1">Địa chỉ chính</p>
        <p className="text-sm">{area.address}</p>
      </div>
      <div>
        <p className="text-xs text-on-surface-variant font-bold uppercase mb-1">Bán kính hỗ trợ</p>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${area.radiusPercent}%` }} />
          </div>
          <span className="text-sm font-bold">{area.radiusKm}km</span>
        </div>
      </div>
      <div className="relative w-full h-40 rounded-xl overflow-hidden bg-surface-container-highest">
        <img alt="Khu vực phục vụ trên bản đồ" className="w-full h-full object-cover grayscale opacity-60" src={area.mapImageUrl} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute w-24 h-24 rounded-full border-2 border-primary bg-primary/10 animate-pulse" />
          <div className="absolute w-3 h-3 bg-primary rounded-full shadow-lg" />
        </div>
      </div>
    </div>
  </aside>
);

export const BankAccountPanel: React.FC<{ account: BankAccount }> = ({ account }) => (
  <aside className="bg-white p-6 rounded-xl border border-outline-variant/20 shadow-sm">
    <div className="flex justify-between items-center mb-4">
      <h3 className="font-bold">Tài khoản ngân hàng</h3>
      <button type="button" className="text-primary text-sm font-bold hover:underline">Cập nhật</button>
    </div>
    <div className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/30 bg-gradient-to-br from-white to-surface-container-low">
      <div className="w-12 h-12 bg-on-secondary rounded-lg flex items-center justify-center font-black text-primary shadow-sm border border-outline-variant/20">
        {account.shortName}
      </div>
      <div>
        <p className="text-sm font-bold">{account.bankName}</p>
        <p className="text-sm text-on-surface-variant">{account.maskedNumber}</p>
      </div>
    </div>
  </aside>
);

export const SettingsMenu: React.FC = () => {
  const items = [
    { icon: 'lock', label: 'Mật khẩu & Bảo mật' },
    { icon: 'notifications', label: 'Cài đặt thông báo' },
    { icon: 'shield', label: 'Quyền riêng tư' },
  ];

  return (
    <aside className="bg-white p-2 rounded-xl border border-outline-variant/20 shadow-sm">
      {items.map((item) => (
        <a key={item.label} className="flex items-center justify-between p-4 hover:bg-surface-container-low rounded-lg transition-all group" href="#">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </div>
          <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
        </a>
      ))}
    </aside>
  );
};

export const DangerZone: React.FC = () => (
  <aside className="p-6 rounded-xl border-2 border-dashed border-error/30 bg-error-container/10">
    <h3 className="font-bold text-error mb-4">Vùng nguy hiểm</h3>
    <div className="space-y-3">
      <button type="button" className="w-full py-2.5 rounded-lg border border-error/30 text-error font-bold text-sm hover:bg-error/5 transition-all">
        Tạm ngừng nhận việc
      </button>
      <button type="button" className="w-full py-2.5 rounded-lg bg-error text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-all">
        Đăng xuất
      </button>
    </div>
  </aside>
);
