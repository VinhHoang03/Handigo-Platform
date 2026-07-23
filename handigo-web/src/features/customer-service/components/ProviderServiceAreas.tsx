interface ProviderServiceAreasProps {
  areas: string[];
}

/** Khu vực hoạt động của thợ. */
export function ProviderServiceAreas({ areas }: ProviderServiceAreasProps) {
  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold text-on-background">
        Khu vực hoạt động
      </h2>
      <div className="mb-4 flex items-center gap-2 text-on-surface-variant">
        <span className="material-symbols-outlined text-primary">
          location_on
        </span>
        Hỗ trợ nhanh tại các khu vực:
      </div>
      <div className="flex flex-wrap gap-2">
        {areas.length ? (
          areas.map((area) => (
            <span
              key={area}
              className="rounded-full border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 font-semibold"
            >
              {area}
            </span>
          ))
        ) : (
          <span className="text-on-surface-variant">
            Chưa cập nhật khu vực hoạt động.
          </span>
        )}
      </div>
    </section>
  );
}
