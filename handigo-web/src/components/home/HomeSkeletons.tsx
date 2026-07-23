import { Skeleton, SkeletonText } from '../common/Skeleton';

/**
 * Skeleton riêng cho trang chủ, ghép từ primitive dùng chung ở
 * `components/common/Skeleton.tsx`. Mỗi cái bám đúng hình dạng thẻ thật tương ứng
 * trong `HomeCards.tsx` để layout không nhảy khi dữ liệu về.
 */

export const CategoryCardSkeleton = () => (
  <div className="overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-low">
    <Skeleton className="aspect-[16/9] w-full" rounded="rounded-none" />
    <div className="space-y-2 p-6">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
    </div>
  </div>
);

export const ProviderCardSkeleton = () => (
  <div className="h-full rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4">
    <Skeleton className="mb-3 h-32 w-full sm:h-36" rounded="rounded-xl" />
    <div className="space-y-2.5">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <div className="flex gap-1">
        <Skeleton className="h-5 w-16" rounded="rounded-md" />
        <Skeleton className="h-5 w-12" rounded="rounded-md" />
      </div>
      <Skeleton className="h-10 w-full" rounded="rounded-lg" />
    </div>
  </div>
);

export const TestimonialCardSkeleton = () => (
  <div className="rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-7">
    <Skeleton className="mb-5 h-4 w-28" />
    <SkeletonText lines={2} />
    <div className="mt-6 flex items-center gap-3">
      <Skeleton className="h-11 w-11" rounded="rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2.5 w-1/4" />
      </div>
    </div>
  </div>
);

/** Thông báo khi danh sách rỗng, thay cho một dòng chữ trơ trọi. */
export const HomeEmptyState = ({ message }: { message: string }) => (
  <p className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low px-6 py-10 text-center text-body-md text-on-surface-variant">
    {message}
  </p>
);
