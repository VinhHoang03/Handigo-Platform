import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CategoryIcon } from '../common/CategoryIcon';
import { MaterialIcon } from '../common/MaterialIcon';
import { InitialsAvatar } from '../common/InitialsAvatar';
import { normalizeImageUrl } from '@/utils/imageUrl';

const colorClasses: Record<string, string> = {
  primary: 'bg-primary/8 text-primary',
  secondary: 'bg-secondary/8 text-secondary',
  tertiary: 'bg-tertiary/8 text-tertiary',
};

interface CategoryCardProps {
  icon: string;
  imageUrl?: string;
  title: string;
  desc: string;
  color: string;
  to?: string;
}

export const CategoryCard = ({ icon, imageUrl, title, desc, color, to = '/customer/services' }: CategoryCardProps) => {
  const [imageFailed, setImageFailed] = useState(false);
  const safeImageUrl = normalizeImageUrl(imageUrl);

  return (
    <Link
      to={to}
      className="group block overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-low transition-[background-color,box-shadow] duration-300 hover:bg-surface-container-lowest hover:shadow-[0_16px_40px_-16px_rgba(19,27,46,0.22)]"
    >
      {safeImageUrl && !imageFailed && (
        <img
          src={safeImageUrl}
          alt=""
          loading="lazy"
          className="aspect-[16/9] w-full bg-surface-container object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="p-6">
        {(!safeImageUrl || imageFailed) && (
          <div className={`mb-4 grid h-12 w-12 place-items-center rounded-2xl ${colorClasses[color]}`}>
            <CategoryIcon icon={icon} name={title} className="h-6 w-6" />
          </div>
        )}
        <h3 className="mb-1 font-headline-md text-base font-semibold text-on-surface">{title}</h3>
        <p className="line-clamp-2 text-label-sm text-on-surface-variant">{desc}</p>
      </div>
    </Link>
  );
};

interface ProviderCardProps {
  name: string;
  rating: number;
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

export const ProviderCard = ({ name, rating, services, area, img }: ProviderCardProps) => (
  <article className="group flex h-full flex-col rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 transition-shadow duration-200 hover:shadow-[0_16px_36px_-16px_rgba(19,27,46,0.24)]">
    <div className="relative mb-3">
      <ProviderCardMedia name={name} img={img} />
      <span className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-surface-container-lowest/95 px-2 py-1 shadow-sm">
        <MaterialIcon className="text-xs text-tertiary" filled>star</MaterialIcon>
        <span className="text-xs font-semibold tabular-nums text-on-surface">{rating.toFixed(1)}</span>
      </span>
    </div>

    <h3 className="truncate font-headline-md text-base font-semibold text-on-surface">{name}</h3>

    <p className="mt-2 flex min-h-8 items-start gap-1 text-on-surface-variant">
      <MaterialIcon className="text-sm">location_on</MaterialIcon>
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
      className="mt-auto block w-full rounded-lg bg-primary/6 pt-2.5 pb-2.5 text-center text-sm font-semibold text-primary transition-colors hover:translate-y-0 group-hover:bg-primary group-hover:text-on-primary"
    >
      Xem dịch vụ
    </Link>
  </article>
);

interface FeatureCardProps {
  icon: string;
  title: string;
  desc: string;
  color: string;
  fill?: boolean;
}

/** Hàng nội dung phân cách bằng đường kẻ — không viền, không đổ bóng, không căn giữa. */
export const FeatureCard = ({ icon, title, desc, color, fill }: FeatureCardProps) => (
  <div className="flex gap-5 border-b border-outline-variant/50 py-8">
    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${colorClasses[color]}`}>
      <MaterialIcon className="text-2xl" filled={fill}>{icon}</MaterialIcon>
    </span>
    <div className="min-w-0">
      <h3 className="font-headline-md text-base font-semibold text-on-surface">{title}</h3>
      <p className="mt-1.5 max-w-[46ch] text-pretty font-body-md text-body-md text-on-surface-variant">{desc}</p>
    </div>
  </div>
);

export const StatItem = ({ val, label }: { val: string; label: string }) => (
  <div>
    <div className="font-headline-xl text-5xl font-bold leading-none tracking-[-0.03em] tabular-nums">{val}</div>
    <p className="mt-3 text-body-md text-on-primary/75">{label}</p>
  </div>
);

interface TestimonialCardProps {
  quote?: string;
  name: string;
  loc: string;
  img?: string | null;
  rating?: number;
  service?: string;
  performedAt?: string;
  providerReply?: string;
  hideAuthor?: boolean;
}

export const TestimonialCard = ({ quote, name, loc, img, rating = 5, service, performedAt, providerReply, hideAuthor }: TestimonialCardProps) => (
  <figure className="rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-7">
    <div className="flex gap-0.5 text-tertiary" role="img" aria-label={`${rating} trên 5 sao`}>
      {[0, 1, 2, 3, 4].map((star) => (
        <MaterialIcon key={star} className={`text-base ${star < rating ? 'text-tertiary' : 'text-outline-variant'}`} filled={star < rating}>star</MaterialIcon>
      ))}
    </div>

    {quote && <blockquote className="mt-4 text-pretty font-body-md text-body-md text-on-surface">{quote}</blockquote>}

    <figcaption className="mt-6 flex items-center gap-3">
      {!hideAuthor && <InitialsAvatar name={name} src={img} className="h-11 w-11" textClassName="text-xs" />}
      <span className="min-w-0">
        {!hideAuthor && <span className="block truncate text-label-md font-semibold text-on-surface">{name}</span>}
        <span className="block truncate text-label-sm text-on-surface-variant">{loc}</span>
        {(service || performedAt) && <span className="mt-0.5 block truncate text-xs text-on-surface-variant">{[service, performedAt].filter(Boolean).join(' · ')}</span>}
      </span>
    </figcaption>

    {providerReply && (
      <div className="mt-5 rounded-xl border-l-2 border-primary bg-primary/5 p-4">
        <p className="text-label-sm font-semibold text-primary">Phản hồi của thợ</p>
        <p className="mt-1 text-sm text-on-surface">{providerReply}</p>
      </div>
    )}
  </figure>
);

export const SocialLink = ({ icon }: { icon: string }) => (
  <Link className="grid h-10 w-10 place-items-center rounded-full bg-surface-container-high text-primary transition-colors hover:translate-y-0 hover:bg-primary hover:text-on-primary" to="#"><MaterialIcon className="text-lg">{icon}</MaterialIcon></Link>
);

export const AppBadge = ({ icon, store, label }: { icon: string; store: string; label: string }) => (
  <button className="flex w-full items-center gap-2 rounded-xl bg-on-surface px-4 py-2 text-surface"><MaterialIcon>{icon}</MaterialIcon><span className="text-left"><span className="block text-[8px] opacity-60">{label}</span> {store}</span></button>
);
