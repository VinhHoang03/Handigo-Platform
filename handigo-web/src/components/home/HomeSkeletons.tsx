/**
 * Skeleton bám theo đúng hình dạng thẻ thật, thay cho dòng chữ "Đang tải..."
 * để tránh layout nhảy khi dữ liệu về.
 */

const shimmer = "animate-pulse rounded bg-surface-container-high";

export const CategoryCardSkeleton = () => (
  <div className="overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-low">
    <div className="aspect-[16/9] w-full animate-pulse bg-surface-container-high" />
    <div className="space-y-2 p-6">
      <div className={`h-4 w-2/3 ${shimmer}`} />
      <div className={`h-3 w-full ${shimmer}`} />
    </div>
  </div>
);

export const ProviderCardSkeleton = () => (
  <div className="h-full rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4">
    <div className="mb-3 h-32 w-full animate-pulse rounded-xl bg-surface-container-high sm:h-36" />
    <div className="space-y-2.5">
      <div className={`h-4 w-3/4 ${shimmer}`} />
      <div className={`h-3 w-full ${shimmer}`} />
      <div className="flex gap-1">
        <div className={`h-5 w-16 ${shimmer}`} />
        <div className={`h-5 w-12 ${shimmer}`} />
      </div>
      <div className="h-10 w-full animate-pulse rounded-lg bg-surface-container" />
    </div>
  </div>
);

export const TestimonialCardSkeleton = () => (
  <div className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-8">
    <div className={`mb-5 h-4 w-28 ${shimmer}`} />
    <div className="space-y-2">
      <div className={`h-3 w-full ${shimmer}`} />
      <div className={`h-3 w-5/6 ${shimmer}`} />
    </div>
    <div className="mt-6 flex items-center gap-4">
      <div className="h-11 w-11 animate-pulse rounded-full bg-surface-container-high" />
      <div className="flex-1 space-y-2">
        <div className={`h-3 w-1/3 ${shimmer}`} />
        <div className={`h-2.5 w-1/4 ${shimmer}`} />
      </div>
    </div>
  </div>
);

/** Thông báo khi danh sách rỗng — thay cho một dòng chữ trơ trọi. */
export const HomeEmptyState = ({ message }: { message: string }) => (
  <p className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low px-6 py-10 text-center text-body-md text-on-surface-variant">
    {message}
  </p>
);
