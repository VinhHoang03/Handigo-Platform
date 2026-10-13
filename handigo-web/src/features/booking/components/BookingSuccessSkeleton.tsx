import { Skeleton } from '@/components/common/Skeleton';

/** Bám theo hình dạng nội dung thật của trang đặt lịch thành công. */
export const BookingSuccessSkeleton = () => (
  <div className="flex flex-col items-center w-full">
    <Skeleton className="h-16 w-16 mb-3" rounded="rounded-full" />
    <Skeleton className="h-7 w-3/4 max-w-72 mb-2" />
    <Skeleton className="h-4 w-full max-w-96 mb-4" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-4xl">
      <Skeleton className="h-56 w-full md:col-span-2" rounded="rounded-2xl" />
      <Skeleton className="h-56 w-full md:col-span-1" rounded="rounded-2xl" />
    </div>
  </div>
);
