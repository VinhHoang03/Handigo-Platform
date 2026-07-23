import { Link } from "react-router-dom";
import { Skeleton } from "@/components/common/Skeleton";

interface ProviderWorkingAreasCardProps {
  workingAreas: string[];
  isLoadingAreas: boolean;
  areasError: string | null;
}

export function ProviderWorkingAreasCard({
  workingAreas,
  isLoadingAreas,
  areasError,
}: ProviderWorkingAreasCardProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container-lowest">
      <div className="relative h-48 bg-[radial-gradient(circle_at_20%_20%,rgba(53,37,205,0.18),transparent_30%),linear-gradient(135deg,#eef0ff,#dae2fc)]">
        <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(53,37,205,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(53,37,205,0.12)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute bottom-sm left-sm right-sm flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest/90 px-sm py-xs shadow-sm backdrop-blur">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant">
              Khu vực hoạt động
            </p>
            {isLoadingAreas ? (
              <Skeleton className="mt-1 h-5 w-32" />
            ) : areasError ? (
              <p className="mt-1 text-xs font-semibold text-error">
                {areasError}
              </p>
            ) : workingAreas.length ? (
              <div className="mt-1 flex max-h-16 flex-wrap gap-1.5 overflow-y-auto">
                {workingAreas.map((area) => (
                  <span
                    key={area}
                    className="max-w-full truncate rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary"
                    title={area}
                  >
                    {area}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                Chưa cập nhật
              </p>
            )}
          </div>
          <Link
            to="/provider/profile"
            aria-label="Cập nhật khu vực hoạt động"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-transform hover:scale-110"
          >
            <span className="material-symbols-outlined">near_me</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
