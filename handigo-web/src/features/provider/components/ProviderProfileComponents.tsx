import React from "react";
import type {
  BankAccount,
  PerformanceStat,
  PortfolioItem,
  ProviderProfile,
  ServiceArea,
  VerificationItem,
} from "../types/provider.types";

type VerificationPanelItem = VerificationItem & {
  onClick?: () => void;
};

export const ProfileSection: React.FC<{
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}> = ({ title, actionLabel, onAction, children }) => (
  <section className="rounded-xl border border-outline-variant/20 bg-white p-6 shadow-sm md:p-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-headline-md text-headline-md text-on-surface">
        {title}
      </h3>
      {actionLabel && (
        <button
          type="button"
          className="text-sm font-bold text-primary hover:underline"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
    {children}
  </section>
);

export const ProviderHero: React.FC<{ profile: ProviderProfile }> = ({
  profile,
}) => (
  <section className="glass-card flex flex-col items-center gap-8 overflow-hidden rounded-xl p-6 md:flex-row md:p-8">
    <img
      alt={`${profile.fullName} profile`}
      className="h-32 w-32 shrink-0 rounded-full object-cover ring-4 ring-primary-container/20"
      src={profile.avatarUrl}
    />

    <div className="flex-1 text-center md:text-left">
      <div className="mb-1 flex flex-col gap-2 md:flex-row md:items-center">
        <h2 className="font-headline-md text-headline-md">
          {profile.fullName}
        </h2>
        {profile.isVerified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
            <span
              className="material-symbols-outlined text-[14px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified
            </span>
            Xác thực
          </span>
        )}
      </div>
      <p className="font-label-md text-on-surface-variant">
        Thành viên từ {profile.joinDate}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-4 md:justify-start">
        <div className="flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-high/50 px-3 py-1.5">
          <span
            className="material-symbols-outlined text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            star
          </span>
          <span className="font-bold">{profile.rating}</span>
          <span className="text-xs text-on-surface-variant">
            ({profile.reviewCount} đánh giá)
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-high/50 px-3 py-1.5">
          <span className="material-symbols-outlined text-primary">
            task_alt
          </span>
          <span className="font-bold">{profile.totalBookings}+</span>
          <span className="text-xs text-on-surface-variant">Đã hoàn thành</span>
        </div>
      </div>
    </div>
  </section>
);

export const PerformanceStats: React.FC<{ stats: PerformanceStat[] }> = ({
  stats,
}) => (
  <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
    {stats.map((stat) => (
      <div
        key={stat.label}
        className="rounded-xl border border-outline-variant/20 bg-white p-5 shadow-sm transition-shadow hover:shadow-md md:p-6"
      >
        <p className="mb-2 text-xs font-bold uppercase tracking-tight text-on-surface-variant">
          {stat.label}
        </p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-bold text-primary">{stat.value}</h3>
          <span
            className={`text-[10px] font-bold ${
              stat.tone === "warning" ? "text-tertiary" : "text-secondary"
            }`}
          >
            {stat.meta}
          </span>
        </div>
      </div>
    ))}
  </section>
);

export const InfoField: React.FC<{
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}> = ({ label, value, wide }) => (
  <div className={wide ? "md:col-span-2" : undefined}>
    <label className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
      {label}
    </label>
    <div className="font-body-md text-on-surface">{value}</div>
  </div>
);

export const SkillTags: React.FC<{ skills: string[] }> = ({ skills }) => (
  <div className="flex flex-wrap gap-2">
    {skills.length > 0 ? (
      skills.map((skill) => (
        <span
          key={skill}
          className="rounded-lg bg-surface-container px-3 py-1 text-sm font-medium text-on-surface-variant"
        >
          {skill}
        </span>
      ))
    ) : (
      <span className="text-sm text-on-surface-variant">Chưa cập nhật</span>
    )}
  </div>
);

export const PortfolioGrid: React.FC<{ items: PortfolioItem[] }> = ({
  items,
}) => (
  <div className="grid grid-cols-3 gap-4">
    {items.map((item) => (
      <div
        key={item.id}
        className="group relative aspect-square overflow-hidden rounded-xl"
      >
        <img
          alt={item.alt}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          src={item.imageUrl}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="material-symbols-outlined text-white">
            visibility
          </span>
        </div>
      </div>
    ))}
  </div>
);

function VerificationRow({ item }: { item: VerificationPanelItem }) {
  const isRejected = item.statusTone === "rejected";
  const isPending = item.statusTone === "pending";
  const icon = isRejected ? "cancel" : isPending ? "pending" : "check_circle";
  const iconClass = isRejected
    ? "text-error"
    : isPending
      ? "text-primary"
      : "text-secondary";
  const content = (
    <>
      <span
        className={`material-symbols-outlined ${iconClass}`}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-bold">{item.label}</span>
        <span
          className={`block text-[10px] uppercase ${
            isRejected
              ? "font-bold text-error"
              : isPending
                ? "font-bold text-primary"
                : "text-on-surface-variant"
          }`}
        >
          {item.status}
        </span>
      </span>
      {item.onClick && (
        <span className="material-symbols-outlined text-outline-variant">
          chevron_right
        </span>
      )}
    </>
  );

  const className = `flex w-full items-center gap-3 rounded-xl bg-surface-container-low p-3 text-left transition ${
    isPending ? "border-2 border-primary/20" : "border border-transparent"
  } ${item.onClick ? "hover:border-primary/30 hover:bg-surface-container" : ""}`;

  if (item.onClick) {
    return (
      <button type="button" className={className} onClick={item.onClick}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

export const VerificationPanel: React.FC<{
  items: VerificationPanelItem[];
}> = ({ items }) => (
  <aside className="rounded-xl border border-outline-variant/20 bg-white p-6 shadow-sm">
    <h3 className="mb-6 font-headline-md text-headline-md text-on-surface">
      Xác thực tài khoản
    </h3>
    <div className="space-y-4">
      {items.map((item) => (
        <VerificationRow key={item.label} item={item} />
      ))}
    </div>
  </aside>
);

export const ServiceAreaPanel: React.FC<{ area: ServiceArea; onEdit?: () => void }> = ({ area, onEdit }) => (
  <aside className="overflow-hidden rounded-xl border border-outline-variant/20 bg-white p-6 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="font-bold">Khu vực phục vụ</h3>
      {onEdit && <button type="button" className="text-sm font-bold text-primary hover:underline" onClick={onEdit}>Chỉnh sửa</button>}
    </div>
    {area.workingAreas?.length ? (
      <div className="flex flex-wrap gap-2">
        {area.workingAreas.map((item) => <span key={item} className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">{item}</span>)}
      </div>
    ) : <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-bold uppercase text-on-surface-variant">
          Tỉnh/Thành phố
        </p>
        <p className="text-sm">{area.province || "Chưa cập nhật"}</p>
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase text-on-surface-variant">
          Xã/Phường
        </p>
        <p className="text-sm">{area.ward || "Chưa cập nhật"}</p>
      </div>
    </div>}
  </aside>
);

export const BankAccountPanel: React.FC<{ account: BankAccount }> = ({
  account,
}) => (
  <aside className="rounded-xl border border-outline-variant/20 bg-white p-6 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="font-bold">Tài khoản ngân hàng</h3>
      <button
        type="button"
        className="text-sm font-bold text-primary hover:underline"
      >
        Cập nhật
      </button>
    </div>
    <div className="flex items-center gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant/20 bg-on-secondary font-black text-primary shadow-sm">
        {account.shortName}
      </div>
      <div>
        <p className="text-sm font-bold">{account.bankName}</p>
        <p className="text-sm text-on-surface-variant">
          {account.maskedNumber}
        </p>
      </div>
    </div>
  </aside>
);

export const AccountFunctionsPanel: React.FC<{
  onPasswordClick: () => void;
}> = ({ onPasswordClick }) => {
  const items = [
    {
      icon: "lock",
      label: "Mật khẩu và bảo mật",
      description: "Cập nhật mật khẩu đăng nhập.",
      onClick: onPasswordClick,
    },
    {
      icon: "shield",
      label: "Quyền riêng tư",
      description: "Tùy chọn quyền riêng tư sẽ được bổ sung.",
    },
    {
      icon: "more_horiz",
      label: "Các tùy chọn khác",
      description: "Khu vực cho thiết lập tài khoản.",
    },
  ];

  return (
    <aside className="rounded-xl border border-outline-variant/20 bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-headline-md text-headline-md text-on-surface">
        Chức năng tài khoản
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className="group flex w-full items-center justify-between rounded-lg p-3 text-left transition-all hover:bg-surface-container-low"
            onClick={item.onClick}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant transition-colors group-hover:text-primary">
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-0.5 block text-xs text-on-surface-variant">
                  {item.description}
                </span>
              </span>
            </span>
            <span className="material-symbols-outlined text-outline-variant">
              chevron_right
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
};
