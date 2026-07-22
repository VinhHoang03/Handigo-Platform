import React from "react";
import { AvatarEditor } from "@/features/profile/components/AvatarEditor";
import type { ProviderProfile } from "../../types/provider.types";

export const ProviderHero: React.FC<{
  profile: ProviderProfile;
  onAvatarSave: (url: string) => Promise<void> | void;
  isSaving?: boolean;
}> = ({ profile, onAvatarSave, isSaving }) => (
  <section className="flex flex-col items-center gap-6 overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 md:flex-row">
    <AvatarEditor
      src={profile.avatarUrl}
      fullName={profile.fullName}
      size="lg"
      disabled={isSaving}
      onSave={onAvatarSave}
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
            aria-hidden="true"
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
          <span aria-hidden="true" className="material-symbols-outlined text-primary">
            task_alt
          </span>
          <span className="font-bold">{profile.totalBookings}+</span>
          <span className="text-xs text-on-surface-variant">Đã hoàn thành</span>
        </div>
      </div>
    </div>
  </section>
);
