import { Skeleton } from "@/components/common/Skeleton";

/** Khung xương bám theo bố cục thật của trang chi tiết đơn hàng (nội dung chính + cột phụ). */
export const BookingDetailSkeleton = () => (
  <div className="grid grid-cols-1 gap-lg lg:grid-cols-12">
    <div className="flex flex-col gap-lg lg:col-span-8">
      <Skeleton className="h-56 w-full" rounded="rounded-3xl" />
      <div className="space-y-md rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-lg">
        <div className="flex items-center gap-md">
          <Skeleton className="h-20 w-20 shrink-0" rounded="rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-24 w-full" rounded="rounded-2xl" />
      </div>
    </div>
    <div className="flex flex-col gap-lg lg:col-span-4">
      <Skeleton className="h-40 w-full" rounded="rounded-3xl" />
      <Skeleton className="h-64 w-full" rounded="rounded-3xl" />
    </div>
  </div>
);
