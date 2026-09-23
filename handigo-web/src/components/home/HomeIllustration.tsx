import { BadgeCheck, Droplets, Sparkles, Wrench } from "lucide-react";

/** Minh họa trang trí bằng vector, không tải ảnh hay thư viện chuyển động ngoài. */
export const HomeIllustration = () => (
  <div className="home-scene" aria-hidden="true">
    <div className="home-scene-orbit" />
    <svg className="home-scene-house" viewBox="0 0 480 360" fill="none">
      <ellipse cx="240" cy="319" rx="178" ry="20" fill="currentColor" opacity=".07" />
      <path d="M79 302V148L240 45L401 148V302H79Z" fill="var(--color-surface-container-lowest)" stroke="var(--color-outline-variant)" strokeWidth="2" />
      <path d="M57 153L240 35L423 153" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M349 97V54H378V116" fill="var(--color-primary-fixed)" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <path d="M240 63L384 155V287H240V63Z" fill="var(--color-surface-container-low)" />
      <rect x="106" y="163" width="109" height="87" rx="12" fill="var(--color-secondary-fixed)" />
      <path d="M160 163V250M106 206H215" stroke="white" strokeWidth="7" />
      <path d="M117 177L139 177M117 187H128" stroke="white" strokeWidth="4" strokeLinecap="round" />
      <rect x="269" y="196" width="69" height="106" rx="12" fill="var(--color-primary-fixed)" />
      <rect x="282" y="209" width="43" height="57" rx="6" fill="white" fillOpacity=".65" />
      <circle cx="324" cy="279" r="4" fill="currentColor" />
      <rect x="269" y="131" width="83" height="39" rx="10" fill="white" stroke="var(--color-outline-variant)" strokeWidth="2" />
      <path d="M281 155H340M281 161H340" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" strokeLinecap="round" />
      <circle cx="340" cy="143" r="3" fill="var(--color-success)" />
      <g className="home-scene-air" stroke="var(--color-secondary)" strokeWidth="3" strokeLinecap="round" opacity=".5">
        <path d="M288 178V186M306 178V190M324 178V186" />
      </g>
      <path d="M64 304H419" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M119 302V274H148V302" fill="var(--color-tertiary-fixed)" />
      <path d="M133 277V236" stroke="var(--color-success)" strokeWidth="4" />
      <path d="M133 260C105 260 105 236 113 234C129 233 135 249 133 260ZM134 250C156 250 160 229 152 226C138 228 130 239 134 250Z" fill="var(--color-success)" />
      <path d="M253 304H354L365 313H243L253 304Z" fill="var(--color-primary-fixed)" />
    </svg>
    <span className="home-scene-badge home-scene-badge--tools"><Wrench size={25} strokeWidth={1.6} /></span>
    <span className="home-scene-badge home-scene-badge--water"><Droplets size={25} strokeWidth={1.6} /></span>
    <span className="home-scene-badge home-scene-badge--sparkle"><Sparkles size={23} strokeWidth={1.6} /></span>
    <span className="home-scene-caption"><BadgeCheck size={18} /> Chăm chút từng góc nhà</span>
  </div>
);
