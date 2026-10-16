import { useState } from 'react';
import { Link } from 'react-router-dom';
import { InitialsAvatar } from '../common/InitialsAvatar';
import { normalizeImageUrl } from '@/utils/imageUrl';
import { ArrowUpRight, MapPin, Star, type LucideIcon } from "lucide-react";
interface ProviderCardProps {
  name: string;
  rating: number;
  totalFeedbacks: number;
  services: string[];
  area: string;
  img?: string | null;
  tabIndex?: number;
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
        width={500}
        height={300}
        onError={() => setFailed(true)}
        className="home-provider-image h-32 w-full bg-surface-container object-cover sm:h-36"
      />
    );
  }

  return (
    <div className="home-provider-image grid h-32 w-full place-items-center bg-surface-container sm:h-36">
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

export const ProviderCard = ({ name, rating, totalFeedbacks, services, area, img, tabIndex }: ProviderCardProps) => (
  <article className="home-provider-card group flex h-full flex-col rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-3">
    <div className="relative mb-4 overflow-hidden rounded-xl">
      <ProviderCardMedia name={name} img={img} />
      <ProviderRatingBadge rating={rating} totalFeedbacks={totalFeedbacks} />
    </div>

    <h3 title={name} className="truncate font-headline-md text-lg font-semibold tracking-tight text-on-surface">{name}</h3>

    <p className="mt-2 flex min-h-8 items-start gap-1 text-on-surface-variant">
      <MapPin aria-hidden="true" size={14} className="mt-0.5 shrink-0 text-primary" />
      <span title={area} className="line-clamp-2 text-xs leading-5">{area || 'Chưa cập nhật khu vực hoạt động'}</span>
    </p>

    <div className="mb-5 mt-3 flex min-h-6 flex-wrap gap-1.5">
      {services.slice(0, 2).map((service) => (
        <span key={service} title={service} className="max-w-full truncate rounded-md bg-surface-container-low px-2 py-1 text-xs font-medium text-on-surface-variant">
          {service}
        </span>
      ))}
    </div>

    {/* mt-auto ghim nút xuống đáy để các thẻ cạnh nhau thẳng hàng dù nội dung dài ngắn khác nhau */}
    <Link
      to="/customer/services"
      tabIndex={tabIndex}
      className="home-provider-link mt-auto flex min-h-11 w-full items-center justify-between gap-2 rounded-lg bg-primary/6 px-3 text-sm font-semibold text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:bg-primary-pressed active:text-on-primary"
    >
      Xem dịch vụ
      <ArrowUpRight aria-hidden="true" size={18} className="home-provider-arrow" />
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
