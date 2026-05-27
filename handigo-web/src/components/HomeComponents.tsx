import { Link } from 'react-router-dom';

interface CategoryCardProps {
  icon: string;
  title: string;
  desc: string;
  color: string;
}

export const CategoryCard = ({ icon, title, desc, color }: CategoryCardProps) => (
  <div className="group p-6 rounded-3xl bg-surface-container-low border border-outline-variant/30 hover:bg-white hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer">
    <div className={`w-14 h-14 rounded-2xl bg-${color}/5 text-${color} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-${color} group-hover:text-white transition-all`}>
      <span className="material-symbols-outlined text-3xl">{icon}</span>
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
      <img alt="Provider" className="w-full h-48 object-cover rounded-2xl" src={img} />
      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
        <span className="material-symbols-outlined text-tertiary text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
        <span className="font-label-sm text-label-sm font-bold text-on-surface">{rating}</span>
      </div>
      <div className={`absolute bottom-3 left-3 bg-${catColor} text-on-${catColor} px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider`}>
        {category}
      </div>
    </div>
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-headline-md text-headline-md text-on-surface">{name}</h4>
        <span className="flex h-3 w-3 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
      </div>
      <div className="flex items-center gap-1 text-on-surface-variant">
        <span className="material-symbols-outlined text-sm">location_on</span>
        <span className="text-label-sm font-label-sm">Cách bạn {dist}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag: string) => (
          <span key={tag} className="bg-surface-container px-2 py-1 rounded-md text-[10px] font-medium text-on-surface-variant">{tag}</span>
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
    <div className={`w-16 h-16 bg-${color}/10 text-${color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
      <span className="material-symbols-outlined text-4xl" style={fill ? { fontVariationSettings: "'FILL' 1" } : {}}>{icon}</span>
    </div>
    <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{title}</h3>
    <p className="font-body-md text-body-md text-on-surface-variant">{desc}</p>
  </div>
);

interface StatItemProps {
  val: string;
  label: string;
}

export const StatItem = ({ val, label }: StatItemProps) => (
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
        <span className="material-symbols-outlined">format_quote</span>
      </div>
    )}
    <div className="flex gap-1 text-tertiary mb-4">
      {[...Array(5)].map((_, i) => (
        <span key={i} className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
      ))}
    </div>
    <p className="font-body-md text-body-md text-on-surface-variant italic mb-6">"{quote}"</p>
    <div className="flex items-center gap-4">
      <img alt="Customer" className="w-12 h-12 rounded-full" src={img} />
      <div>
        <h4 className="font-label-md text-label-md font-bold text-on-surface">{name}</h4>
        <p className="font-label-sm text-label-sm text-on-surface-variant">{loc}</p>
      </div>
    </div>
  </div>
);

interface SocialLinkProps {
  icon: string;
}

export const SocialLink = ({ icon }: SocialLinkProps) => (
  <Link className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all" to="#">
    <span className="material-symbols-outlined text-lg">{icon}</span>
  </Link>
);

interface FooterColumnProps {
  title: string;
  links: string[];
}

export const FooterColumn = ({ title, links }: FooterColumnProps) => (
  <div>
    <h4 className="font-label-md text-label-md font-bold text-on-surface mb-4">{title}</h4>
    <ul className="space-y-2 font-body-md text-body-md text-on-surface-variant">
      {links.map((link: string) => (
        <li key={link}><Link className="hover:text-primary transition-all" to="#">{link}</Link></li>
      ))}
    </ul>
  </div>
);

interface AppBadgeProps {
  icon: string;
  store: string;
  label: string;
}

export const AppBadge = ({ icon, store, label }: AppBadgeProps) => (
  <button className="flex items-center gap-2 bg-on-surface text-white px-4 py-2 rounded-xl w-full">
    <span className="material-symbols-outlined">{icon}</span>
    <span className="text-left"><span className="block text-[8px] opacity-60">{label}</span> {store}</span>
  </button>
);
