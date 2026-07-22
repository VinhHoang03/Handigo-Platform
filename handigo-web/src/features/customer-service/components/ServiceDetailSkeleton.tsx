import { Skeleton } from "@/components/common/Skeleton";

/** Khung xương trang chi tiết dịch vụ, bám theo bố cục ảnh + mô tả + panel đặt lịch. */
export function ServiceDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <div className="space-y-8 lg:col-span-8">
        <Skeleton className="h-[360px] w-full" rounded="rounded-xl" />
        <div className="space-y-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full" rounded="rounded-xl" />
          ))}
        </div>
      </div>
      <div className="lg:col-span-4">
        <Skeleton className="h-96 w-full" rounded="rounded-xl" />
      </div>
    </div>
  );
}
