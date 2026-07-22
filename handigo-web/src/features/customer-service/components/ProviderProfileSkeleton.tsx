import { Skeleton } from "@/components/common/Skeleton";

/** Khung xương trang hồ sơ thợ, bám theo bố cục hero + nội dung + panel đặt lịch. */
export function ProviderProfileSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
      <div className="space-y-10 lg:col-span-8">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4 sm:flex-row md:p-5">
          <Skeleton className="h-24 w-24 md:h-28 md:w-28" rounded="rounded-full" />
          <div className="w-full space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" rounded="rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" rounded="rounded-2xl" />
      </div>
      <div className="lg:col-span-4">
        <Skeleton className="h-96 w-full" rounded="rounded-2xl" />
      </div>
    </div>
  );
}
