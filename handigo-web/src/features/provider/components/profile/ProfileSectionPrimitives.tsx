import React from "react";
import type { PortfolioItem } from "../../types/provider.types";
import { Eye } from "lucide-react";

export const ProfileSection: React.FC<{
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, actionLabel, onAction, actions, children }) => (
  <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-pretty font-headline-md text-headline-md text-on-surface">
        {title}
      </h3>
      {actions ?? (actionLabel && (
        <button
          type="button"
          className="text-sm font-bold text-primary hover:underline"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ))}
    </div>
    {children}
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
          <Eye aria-hidden="true" size={24} className="text-on-primary" />
        </div>
      </div>
    ))}
  </div>
);
