import { MapPin } from "lucide-react";
interface ProviderServiceAreasProps {
  areas: string[];
  compact?: boolean;
}

/** Khu vực hoạt động của thợ. */
export function ProviderServiceAreas({ areas, compact = false }: ProviderServiceAreasProps) {
  return (
    <section className={compact ? 'rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-3 shadow-sm' : undefined}>
      <h2 className={`font-bold text-on-background ${compact ? 'mb-2 flex items-center gap-1.5 text-base leading-6' : 'mb-4 text-2xl'}`}>
        {compact && <MapPin aria-hidden="true" size={16} className="shrink-0 text-primary" />}
        Khu vực hoạt động
      </h2>
      {!compact && <div className="mb-4 flex items-center gap-2 text-on-surface-variant">
        <MapPin aria-hidden="true" size={24} className="shrink-0 text-primary" />
        Hỗ trợ nhanh tại các khu vực:
      </div>}
      <div className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {areas.length ? (
          areas.map((area) => (
            <span
              key={area}
              className={`rounded-full border border-outline-variant/30 bg-surface-container-lowest ${compact ? 'px-2 py-1 text-[13px] font-medium' : 'px-4 py-2 font-semibold'}`}
            >
              {area}
            </span>
          ))
        ) : (
          <span className={`text-on-surface-variant ${compact ? 'text-[15px]' : ''}`}>
            Chưa cập nhật khu vực hoạt động.
          </span>
        )}
      </div>
    </section>
  );
}
