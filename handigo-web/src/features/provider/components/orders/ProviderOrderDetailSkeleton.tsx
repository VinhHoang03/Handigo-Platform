import { Skeleton } from '@/components/common/Skeleton';

/** Khung xương trang chi tiết đơn dịch vụ, bám theo bố cục header + 3 thẻ + panel thao tác. */
export function ProviderOrderDetailSkeleton() {
  return (
    <div className="space-y-gutter">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-28 w-full" rounded="rounded-3xl" />
      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-64 w-full" rounded="rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-56 w-full" rounded="rounded-3xl" />
    </div>
  );
}
