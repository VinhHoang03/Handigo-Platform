import { Skeleton } from "@/components/common/Skeleton";

/** Bám theo bố cục của `BookingHistoryCard`: ảnh, thông tin, cột hành động. */
export const BookingHistoryCardSkeleton = () => (
  <div className="flex flex-col items-stretch gap-md rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-md sm:flex-row">
    <Skeleton className="h-44 w-full shrink-0 sm:h-28 sm:w-28" rounded="rounded-xl" />

    <div className="w-full min-w-0 flex-1 space-y-2.5">
      <Skeleton className="h-5 w-2/3" />
      <div className="flex gap-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-4 w-24" />
    </div>

    <div className="flex w-full shrink-0 flex-col items-stretch gap-sm sm:w-52 sm:items-end">
      <Skeleton className="h-8 w-28" rounded="rounded-full" />
      <Skeleton className="h-10 w-full sm:w-36" rounded="rounded-xl" />
    </div>
  </div>
);

export const BookingHistoryListSkeleton = () => (
  <div className="grid grid-cols-1 gap-md">
    {[0, 1, 2].map((row) => (
      <BookingHistoryCardSkeleton key={row} />
    ))}
  </div>
);
