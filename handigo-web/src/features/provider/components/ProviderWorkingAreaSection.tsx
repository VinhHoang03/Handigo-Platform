import { LoaderCircle, LocateFixed, MapPin, MapPinOff, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useProviderWorkingArea } from "../hooks/useProviderWorkingArea";
import { ProfileSection } from "./profile/ProfileSectionPrimitives";

export function ProviderWorkingAreaSection() {
  const userId = useAuthStore((state) => state.user?.id || state.user?._id);
  return <ProviderWorkingAreaContent key={userId} />;
}

function ProviderWorkingAreaContent() {
  const { address, error, loading, locating, retry } = useProviderWorkingArea();
  return (
    <ProfileSection title="Khu vực làm việc" actions={
      <button type="button" onClick={retry} disabled={loading}
        aria-label={loading ? "Đang cập nhật vị trí" : "Cập nhật vị trí"}
        title="Cập nhật vị trí"
        className="inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-outline-variant/40 bg-surface-container-low text-primary transition-colors hover:border-primary/30 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-50">
        <RefreshCw aria-hidden="true" size={18} className={loading ? "motion-safe:animate-spin" : undefined} />
      </button>
    }>
      {loading ? (
        <div role="status" className="flex min-h-28 items-center gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-container-lowest text-primary">
            <LoaderCircle aria-hidden="true" size={22} className="motion-safe:animate-spin" />
          </span>
          <p className="text-sm font-medium leading-6 text-on-surface-variant">
            {locating ? "Đang xác định vị trí GPS…" : "Đang tìm địa chỉ theo GPS…"}
          </p>
        </div>
      ) : error ? (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-error/15 bg-error/5 p-4">
          <MapPinOff aria-hidden="true" size={22} className="mt-0.5 shrink-0 text-error" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-on-surface">Chưa xác định được vị trí</p>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">{error}</p>
          </div>
        </div>
      ) : address && (
        <>
          <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-2xl border border-primary/10 bg-primary/5 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-container-lowest text-primary">
              <MapPin aria-hidden="true" size={22} />
            </span>
            <div className="min-w-0">
              <p className="mb-1 text-xs font-medium text-on-surface-variant">{address.nearby ? "Địa chỉ gần bạn" : "Vị trí hiện tại"}</p>
              <p className="break-words text-sm font-semibold leading-6 text-on-surface">{address.nearby ? "Gần " : ""}{address.address}</p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs leading-5 text-on-surface-variant">
            <LocateFixed aria-hidden="true" size={14} className="shrink-0 text-primary" />
            Tự cập nhật theo GPS khi bạn di chuyển.
          </p>
        </>
      )}
    </ProfileSection>
  );
}
