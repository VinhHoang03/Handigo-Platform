import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import type { PublicProviderProfile } from "../api/customerService.api";
import { Metric } from "./ProviderProfilePrimitives";
import { BadgeCheck, Star } from "lucide-react";

interface ProviderProfileHeaderProps {
  profile: PublicProviderProfile;
}

/** Khối đầu trang hồ sơ thợ: avatar, tên, huy hiệu xác minh và số liệu tổng quan. */
export function ProviderProfileHeader({ profile }: ProviderProfileHeaderProps) {
  return (
    <>
      <section className="flex flex-col items-center gap-4 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4 text-center shadow-sm sm:flex-row sm:text-left md:p-5">
        <InitialsAvatar
          name={profile.user.fullName}
          src={profile.user.avatar}
          className="h-24 w-24 shrink-0 border border-outline-variant/30 md:h-28 md:w-28"
          textClassName="text-2xl"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="break-words text-2xl font-bold text-on-background md:text-3xl">
              {profile.user.fullName}
            </h1>
            {profile.provider.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                <BadgeCheck aria-hidden="true" size={14} />
                Đã xác minh
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric
          label="Đánh giá"
          value={profile.provider.averageRating.toFixed(1)}
          icon={Star}
        />
        <Metric
          label="Công việc"
          value={`${profile.provider.totalCompletedOrders}`}
        />
        <Metric
          label="Phản hồi"
          value={`${profile.provider.totalFeedbacks}`}
        />
        <Metric
          label="Kinh nghiệm"
          value={`${profile.provider.experienceYears}+ năm`}
        />
      </section>
    </>
  );
}
