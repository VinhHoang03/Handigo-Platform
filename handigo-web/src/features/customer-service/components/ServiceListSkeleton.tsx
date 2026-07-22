import { Skeleton } from "@/components/common/Skeleton";

/** Khung xương lưới dịch vụ, giữ đúng hình dạng thẻ thật để tránh layout nhảy. */
export function ServiceListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm"
        >
          <Skeleton className="h-48 w-full" rounded="rounded-none" />
          <div className="space-y-4 p-5">
            <Skeleton className="h-5 w-4/5" />
            <div className="flex items-center justify-between gap-3 border-t border-outline-variant/30 pt-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-9 w-24" rounded="rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
