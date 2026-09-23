import { Skeleton } from '@/components/common/Skeleton';

/** Khung xương danh sách đơn dịch vụ, bám theo bố cục hàng thẻ đơn. */
export function ProviderOrdersListSkeleton() {
  return (
    <div className="space-y-sm" role="status" aria-busy="true" aria-label="Đang tải danh sách đơn">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-20 w-full" rounded="rounded-2xl" />
      ))}
    </div>
  );
}
