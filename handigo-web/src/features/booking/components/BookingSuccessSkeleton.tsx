import { Skeleton } from '@/components/common/Skeleton';

/** Bám theo hình dạng nội dung thật của trang đặt lịch thành công. */
export const BookingSuccessSkeleton = () => (
  <div className="flex flex-col items-center py-lg w-full">
    <Skeleton className="h-24 w-24 mb-md" rounded="rounded-full" />
    <Skeleton className="h-8 w-72 mb-sm" />
    <Skeleton className="h-4 w-96 mb-lg" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-md w-full max-w-4xl">
      <Skeleton className="h-64 w-full md:col-span-2" rounded="rounded-3xl" />
      <Skeleton className="h-64 w-full md:col-span-1" rounded="rounded-3xl" />
    </div>
  </div>
);
