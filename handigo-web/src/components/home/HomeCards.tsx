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

const providerBadgeClasses: Record<string, string> = {
  'primary-container': 'bg-primary-container text-on-primary-container',
  'secondary-container': 'bg-secondary-container text-on-secondary-container',
};

interface CategoryCardProps {
  icon: string;
  title: string;
  desc: string;
  color: string;
}

export const CategoryCard = ({ icon, title, desc, color }: CategoryCardProps) => (
  <div className="group p-6 rounded-3xl bg-surface-container-low border border-outline-variant/30 hover:bg-white hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer">
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:text-white transition-all ${colorClasses[color]}`}>
      <MaterialIcon className="text-3xl">{icon}</MaterialIcon>
    </div>
    <h3 className="font-headline-md text-headline-md text-on-surface mb-1">{title}</h3>
    <p className="font-label-sm text-label-sm text-on-surface-variant">{desc}</p>
  </div>
);

interface ProviderCardProps {
  name: string;
  category: string;
  rating: string;
  dist: string;
  tags: string[];
  img: string;
  catColor: string;
}

export const ProviderCard = ({ name, category, rating, dist, tags, img, catColor }: ProviderCardProps) => (
  <div className="bg-white dark:bg-inverse-surface p-5 rounded-[32px] border border-outline-variant/20 shadow-sm hover:shadow-xl transition-all group">
    <div className="relative mb-4">
      <img alt={name} className="w-full h-48 object-cover rounded-2xl" src={img} />
      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
        <MaterialIcon className="text-tertiary text-xs" filled>star</MaterialIcon>
        <span className="font-label-sm text-label-sm font-bold text-on-surface">{rating}</span>
      </div>
      <div className={`absolute bottom-3 left-3 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${providerBadgeClasses[catColor]}`}>
        {category}
      </div>
    </div>
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-headline-md text-headline-md text-on-surface">{name}</h4>
        <span className="flex h-3 w-3 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
      </div>
      <div className="flex items-center gap-1 text-on-surface-variant">
        <MaterialIcon className="text-sm">location_on</MaterialIcon>
        <span className="text-label-sm font-label-sm">Cách bạn {dist}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span key={tag} className="bg-surface-container px-2 py-1 rounded-md text-[10px] font-medium text-on-surface-variant">
            {tag}
          </span>
        ))}
      </div>
      <button className="w-full py-3 bg-primary/5 text-primary font-label-md text-label-md rounded-xl group-hover:bg-primary group-hover:text-white transition-all">Đặt ngay</button>
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
  <div className="text-center p-8 rounded-3xl bg-white border border-outline-variant/30 shadow-soft">
    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${featureColorClasses[color]}`}>
      <MaterialIcon className="text-4xl" filled={fill}>{icon}</MaterialIcon>
    </div>
    <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{title}</h3>
    <p className="font-body-md text-body-md text-on-surface-variant">{desc}</p>
  </div>
);

export const StatItem = ({ val, label }: { val: string; label: string }) => (
  <div className="space-y-1">
    <div className="text-[56px] font-black tracking-tight leading-none">{val}</div>
    <p className="font-label-md text-label-md opacity-80 uppercase tracking-widest">{label}</p>
  </div>
);

interface TestimonialCardProps {
  quote: string;
  name: string;
  loc: string;
  img: string;
  hasQuoteIcon?: boolean;
}

export const TestimonialCard = ({ quote, name, loc, img, hasQuoteIcon }: TestimonialCardProps) => (
  <div className="p-8 rounded-3xl glass-card border border-outline-variant/30 shadow-lg relative">
    {hasQuoteIcon && (
      <div className="absolute -top-4 -left-4 w-12 h-12 bg-primary flex items-center justify-center rounded-2xl text-white">
        <MaterialIcon>format_quote</MaterialIcon>
      </div>
    )}
    <div className="flex gap-1 text-tertiary mb-4">
      {[0, 1, 2, 3, 4].map((star) => (
        <MaterialIcon key={star} className="text-sm" filled>star</MaterialIcon>
      ))}
    </div>
    <p className="font-body-md text-body-md text-on-surface-variant italic mb-6">"{quote}"</p>
    <div className="flex items-center gap-4">
      <img alt={name} className="w-12 h-12 rounded-full" src={img} />
      <div>
        <h4 className="font-label-md text-label-md font-bold text-on-surface">{name}</h4>
        <p className="font-label-sm text-label-sm text-on-surface-variant">{loc}</p>
      </div>
    </div>
  </div>
);

export const SocialLink = ({ icon }: { icon: string }) => (
  <Link className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all" to="#">
    <MaterialIcon className="text-lg">{icon}</MaterialIcon>
  </Link>
);

export const AppBadge = ({ icon, store, label }: { icon: string; store: string; label: string }) => (
  <button className="flex items-center gap-2 bg-on-surface text-white px-4 py-2 rounded-xl w-full">
    <MaterialIcon>{icon}</MaterialIcon>
    <span className="text-left"><span className="block text-[8px] opacity-60">{label}</span> {store}</span>
  </button>
);
