import { Skeleton } from "@/components/common/Skeleton";

/** Bộ khung xương bám theo hình dạng danh sách thông báo thật, tránh layout nhảy khi dữ liệu về. */
export function NotificationListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-outline-variant/10">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex gap-4 py-4">
          <Skeleton className="mt-1 h-11 w-11 shrink-0" rounded="rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
