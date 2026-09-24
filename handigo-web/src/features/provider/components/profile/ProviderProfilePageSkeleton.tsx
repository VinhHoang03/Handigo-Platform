import { Skeleton } from "@/components/common/Skeleton";

/** Page-level loading placeholder shown while the provider profile loads. */
export function ProviderProfilePageSkeleton() {
  return (
    <div className="grid grid-cols-12 items-start gap-gutter">
      <div className="col-span-12">
        <div className="flex flex-col items-center gap-6 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 md:flex-row">
          <Skeleton className="h-24 w-24" rounded="rounded-full" />
          <div className="w-full space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>

      <div className="col-span-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" rounded="rounded-xl" />
        ))}
      </div>

      <div className="col-span-12 flex min-w-0 flex-col gap-gutter xl:col-span-7">
        <Skeleton className="h-64 w-full" rounded="rounded-xl" />
        <Skeleton className="h-40 w-full" rounded="rounded-xl" />
      </div>

      <div className="col-span-12 flex min-w-0 flex-col gap-gutter xl:col-span-5">
        <Skeleton className="h-48 w-full" rounded="rounded-xl" />
        <Skeleton className="h-48 w-full" rounded="rounded-xl" />
      </div>
    </div>
  );
}
