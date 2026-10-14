import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import type { PublicProviderProfile } from "../api/customerService.api";
import { Metric } from "./ProviderProfilePrimitives";
import { BadgeCheck, Star } from "lucide-react";

interface ProviderProfileHeaderProps {
  profile: PublicProviderProfile;
  compact?: boolean;
}

/** Khối đầu trang hồ sơ thợ: avatar, tên, huy hiệu xác minh và số liệu tổng quan. */
export function ProviderProfileHeader({ profile, compact = false }: ProviderProfileHeaderProps) {
  const Heading = compact ? 'h3' : 'h1';
  return (
    <>
      <section className={`flex items-center border border-outline-variant/20 bg-surface-container-lowest shadow-sm ${compact ? 'gap-3 rounded-xl p-3 text-left' : 'flex-col gap-4 rounded-2xl p-4 text-center sm:flex-row sm:text-left md:p-5'}`}>
        <InitialsAvatar
          name={profile.user.fullName}
          src={profile.user.avatar}
          className={`shrink-0 border border-outline-variant/30 ${compact ? 'h-16 w-16' : 'h-24 w-24 md:h-28 md:w-28'}`}
          textClassName={compact ? 'text-lg' : 'text-2xl'}
        />
        <div className="min-w-0">
          <div className={`flex flex-wrap items-center gap-2 ${compact ? 'justify-start' : 'justify-center sm:justify-start'}`}>
            <Heading className={`break-words font-bold text-on-background ${compact ? 'text-lg leading-6' : 'text-2xl md:text-3xl'}`}>
              {profile.user.fullName}
            </Heading>
            {profile.provider.verified && (
              <span className={`inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 font-bold text-primary ${compact ? 'py-0.5 text-[11px]' : 'py-1 text-xs'}`}>
                <BadgeCheck aria-hidden="true" size={14} />
                Đã xác minh
              </span>
            )}
          </div>
        </div>
      </section>

      <section className={`grid ${compact ? 'grid-cols-4 gap-1.5' : 'grid-cols-2 gap-4 md:grid-cols-4'}`}>
        <Metric
          compact={compact}
          label="Đánh giá"
          value={profile.provider.averageRating.toFixed(1)}
          icon={Star}
        />
        <Metric
          compact={compact}
          label="Công việc"
          value={`${profile.provider.totalCompletedOrders}`}
        />
        <Metric
          compact={compact}
          label="Phản hồi"
          value={`${profile.provider.totalFeedbacks}`}
        />
        <Metric
          compact={compact}
          label="Kinh nghiệm"
          value={`${profile.provider.experienceYears}+ năm`}
        />
      </section>
    </>
  );
}
