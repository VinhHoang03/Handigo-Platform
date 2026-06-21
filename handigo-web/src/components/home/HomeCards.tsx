import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../common/MaterialIcon';

const colorClasses: Record<string, string> = {
  primary: 'bg-primary/5 text-primary group-hover:bg-primary',
  secondary: 'bg-secondary/5 text-secondary group-hover:bg-secondary',
  tertiary: 'bg-tertiary/5 text-tertiary group-hover:bg-tertiary',
};

const featureColorClasses: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  tertiary: 'bg-tertiary/10 text-tertiary',
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
  const safeImageUrl = imageUrl?.replace(/^http:\/\/res\.cloudinary\.com/i, 'https://res.cloudinary.com');

  return (
    <Link to={to} className="group block overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-low transition-all duration-300 hover:bg-white hover:shadow-xl hover:shadow-primary/5">
      {safeImageUrl && !imageFailed && (
        <img
          src={safeImageUrl}
          alt={title}
          loading="lazy"
          className="aspect-[16/9] w-full bg-surface-container object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="p-6">
        {(!safeImageUrl || imageFailed) && (
          <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-all group-hover:scale-110 group-hover:text-white ${colorClasses[color]}`}>
            <MaterialIcon className="text-3xl">{/^https?:\/\//i.test(icon) ? 'category' : icon}</MaterialIcon>
          </div>
        )}
        <h3 className="mb-1 font-headline-md text-headline-md text-on-surface">{title}</h3>
        <p className="font-label-sm text-label-sm text-on-surface-variant">{desc}</p>
      </div>
    </Link>
  );
};

interface ProviderCardProps {
  name: string;
  rating: number;
  services: string[];
  area: string;
  img: string;
}

export const ProviderCard = ({ name, rating, services, area, img }: ProviderCardProps) => (
  <div className="group h-full rounded-2xl border border-outline-variant/20 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
    <div className="relative mb-3">
      <img alt={name} className="h-32 w-full rounded-xl object-cover sm:h-36" src={img} draggable={false} />
      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 shadow-sm backdrop-blur-md">
        <MaterialIcon className="text-xs text-tertiary" filled>star</MaterialIcon>
        <span className="text-xs font-bold text-on-surface">{rating.toFixed(1)}</span>
      </div>
    </div>
    <div className="space-y-2.5">
      <h4 className="truncate font-headline-md text-base text-on-surface">{name}</h4>
      <div className="flex min-h-8 items-start gap-1 text-on-surface-variant">
        <MaterialIcon className="text-sm">location_on</MaterialIcon>
        <span className="line-clamp-2 text-xs">{area || 'Chưa cập nhật khu vực hoạt động'}</span>
      </div>
      <div className="flex min-h-6 flex-wrap gap-1">
        {services.slice(0, 2).map((service) => (
          <span key={service} className="max-w-full truncate rounded-md bg-surface-container px-2 py-1 text-[10px] font-medium text-on-surface-variant">
            {service}
          </span>
        ))}
      </div>
      <Link to="/customer/services" className="block w-full rounded-lg bg-primary/5 py-2.5 text-center text-sm font-semibold text-primary transition-all group-hover:bg-primary group-hover:text-white">
        Xem dịch vụ
      </Link>
    </div>
  </div>
);

interface FeatureCardProps {
  icon: string;
  title: string;
  desc: string;
  color: string;
  fill?: boolean;
}

export const FeatureCard = ({ icon, title, desc, color, fill }: FeatureCardProps) => (
  <div className="rounded-3xl border border-outline-variant/30 bg-white p-8 text-center shadow-soft">
    <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${featureColorClasses[color]}`}>
      <MaterialIcon className="text-4xl" filled={fill}>{icon}</MaterialIcon>
    </div>
    <h3 className="mb-2 font-headline-md text-headline-md text-on-surface">{title}</h3>
    <p className="font-body-md text-body-md text-on-surface-variant">{desc}</p>
  </div>
);

export const StatItem = ({ val, label }: { val: string; label: string }) => (
  <div className="space-y-1">
    <div className="text-[56px] font-black leading-none tracking-tight">{val}</div>
    <p className="font-label-md text-label-md uppercase tracking-widest opacity-80">{label}</p>
  </div>
);

interface TestimonialCardProps {
  quote: string;
  name: string;
  loc: string;
  img: string;
  hasQuoteIcon?: boolean;
  rating?: number;
  service?: string;
  performedAt?: string;
  providerReply?: string;
}

export const TestimonialCard = ({ quote, name, loc, img, hasQuoteIcon, rating = 5, service, performedAt, providerReply }: TestimonialCardProps) => (
  <div className="glass-card relative rounded-3xl border border-outline-variant/30 p-8 shadow-lg">
    {hasQuoteIcon && <div className="absolute -left-4 -top-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white"><MaterialIcon>format_quote</MaterialIcon></div>}
    <div className="mb-4 flex gap-1 text-tertiary">
      {[0, 1, 2, 3, 4].map((star) => <MaterialIcon key={star} className={`text-sm ${star < rating ? 'text-tertiary' : 'text-outline-variant'}`} filled={star < rating}>star</MaterialIcon>)}
    </div>
    <p className="mb-6 font-body-md text-body-md italic text-on-surface-variant">&quot;{quote}&quot;</p>
    <div className="flex items-center gap-4">
      <img alt={name} className="h-12 w-12 rounded-full object-cover" src={img} />
      <div>
        <h4 className="font-label-md text-label-md font-bold text-on-surface">{name}</h4>
        <p className="font-label-sm text-label-sm text-on-surface-variant">{loc}</p>
        {(service || performedAt) && <p className="mt-1 text-xs text-on-surface-variant">{[service, performedAt].filter(Boolean).join(' · ')}</p>}
      </div>
    </div>
    {providerReply && <div className="mt-5 rounded-xl border-l-4 border-primary bg-primary/5 p-4"><p className="text-xs font-bold uppercase text-primary">Phản hồi của thợ</p><p className="mt-1 text-sm not-italic text-on-surface">{providerReply}</p></div>}
  </div>
);

export const SocialLink = ({ icon }: { icon: string }) => (
  <Link className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-primary transition-all hover:bg-primary hover:text-white" to="#"><MaterialIcon className="text-lg">{icon}</MaterialIcon></Link>
);

export const AppBadge = ({ icon, store, label }: { icon: string; store: string; label: string }) => (
  <button className="flex w-full items-center gap-2 rounded-xl bg-on-surface px-4 py-2 text-white"><MaterialIcon>{icon}</MaterialIcon><span className="text-left"><span className="block text-[8px] opacity-60">{label}</span> {store}</span></button>
);
