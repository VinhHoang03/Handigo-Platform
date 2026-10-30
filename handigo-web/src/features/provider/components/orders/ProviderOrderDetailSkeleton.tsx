import { Skeleton } from '@/components/common/Skeleton';

/** Khung xương trang chi tiết đơn dịch vụ, bám theo bố cục thông tin chính + cột tóm tắt. */
export function ProviderOrderDetailSkeleton() {
  return (
    <div className="space-y-gutter">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-28 w-full" rounded="rounded-3xl" />
      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-12">
        <Skeleton className="h-[32rem] w-full lg:col-span-7" rounded="rounded-3xl" />
        <div className="space-y-gutter lg:col-span-5">
          <Skeleton className="h-52 w-full" rounded="rounded-3xl" />
          <Skeleton className="h-80 w-full" rounded="rounded-3xl" />
        </div>
      </div>
      <Skeleton className="h-56 w-full" rounded="rounded-3xl" />
    </div>
  );
}
