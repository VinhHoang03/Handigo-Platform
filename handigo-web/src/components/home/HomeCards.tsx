import { useState } from 'react';
import { Link } from 'react-router-dom';
import { InitialsAvatar } from '../common/InitialsAvatar';
import { normalizeImageUrl } from '@/utils/imageUrl';
import { MapPin, Star, type LucideIcon } from "lucide-react";
interface ProviderCardProps {
  name: string;
  rating: number;
  totalFeedbacks: number;
  services: string[];
  area: string;
  img?: string | null;
}

/**
 * Ảnh bìa thẻ thợ. Khi thiếu ảnh thì dùng nền trung tính với avatar chữ cái cỡ
 * nhỏ ở giữa — tránh việc phóng một chữ cái ra kín cả khung.
 */
const ProviderCardMedia = ({ name, img }: { name: string; img?: string | null }) => {
  const [failed, setFailed] = useState(false);
  const safeSrc = normalizeImageUrl(img);

  if (safeSrc && !failed) {
    return (
      <img
        src={safeSrc}
        alt={name}
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
        className="h-32 w-full rounded-xl bg-surface-container object-cover sm:h-36"
      />
    );
  }

  return (
    <div className="grid h-32 w-full place-items-center rounded-xl bg-surface-container sm:h-36">
      <InitialsAvatar name={name} className="h-14 w-14" textClassName="text-lg" />
    </div>
  );
};

/**
 * Huy hiệu điểm đánh giá. Thợ chưa có nhận xét nào thì hiện nhãn chữ, không hiện
 * "0.0 ★": một thợ mới chưa ai chấm điểm khác hẳn một thợ bị chấm 0 điểm, mà
 * người đọc lướt qua chỉ thấy con số.
 */
const ProviderRatingBadge = ({ rating, totalFeedbacks }: { rating: number; totalFeedbacks: number }) => {
  if (!totalFeedbacks) {
    return (
      <span className="absolute right-2 top-2 rounded-lg bg-surface-container-lowest/95 px-2 py-1 text-[10px] font-semibold text-on-surface-variant shadow-sm">
        Chưa có đánh giá
      </span>
    );
  }

  return (
    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-surface-container-lowest/95 px-2 py-1 shadow-sm">
      <Star aria-hidden="true" size={12} className="text-tertiary" fill="currentColor" />
      <span className="text-xs font-semibold tabular-nums text-on-surface">{rating.toFixed(1)}</span>
      <span className="text-[10px] text-on-surface-variant">({totalFeedbacks})</span>
    </span>
  );
};

export const ProviderCard = ({ name, rating, totalFeedbacks, services, area, img }: ProviderCardProps) => (
  <article className="group flex h-full flex-col rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 transition-shadow duration-200 hover:shadow-[0_16px_36px_-16px_rgba(19,27,46,0.24)]">
    <div className="relative mb-3">
      <ProviderCardMedia name={name} img={img} />
      <ProviderRatingBadge rating={rating} totalFeedbacks={totalFeedbacks} />
    </div>

    <h3 className="truncate font-headline-md text-base font-semibold text-on-surface">{name}</h3>

    <p className="mt-2 flex min-h-8 items-start gap-1 text-on-surface-variant">
      <MapPin aria-hidden="true" size={14} />
      <span className="line-clamp-2 text-xs">{area || 'Chưa cập nhật khu vực hoạt động'}</span>
    </p>

    <div className="mt-2 flex min-h-6 flex-wrap gap-1">
      {services.slice(0, 2).map((service) => (
        <span key={service} className="max-w-full truncate rounded-md bg-surface-container px-2 py-1 text-[10px] font-medium text-on-surface-variant">
          {service}
        </span>
      ))}
    </div>

    {/* mt-auto ghim nút xuống đáy để các thẻ cạnh nhau thẳng hàng dù nội dung dài ngắn khác nhau */}
    <Link
      to="/customer/services"
      className="mt-auto flex min-h-11 w-full items-center justify-center rounded-lg bg-primary/6 text-sm font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary"
    >
      Xem dịch vụ
    </Link>
  </article>
);

export const SocialLink = ({ icon: Icon, label }: { icon: LucideIcon; label: string }) => (
  <Link
    to="#"
    aria-label={label}
    className="grid h-11 w-11 place-items-center rounded-full bg-surface-container-high text-primary transition-colors hover:bg-primary hover:text-on-primary"
  >
    <Icon aria-hidden="true" size={18} />
  </Link>
);
