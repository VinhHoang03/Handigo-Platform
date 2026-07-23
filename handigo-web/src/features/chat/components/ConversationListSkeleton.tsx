import { Skeleton } from "@/components/common/Skeleton";

/** Vài dòng giả lặp lại hình dạng một mục hội thoại trong khi chờ tải danh sách. */
export function ConversationListSkeleton() {
  return (
    <div className="space-y-1 p-1" role="status" aria-busy="true" aria-label="Đang tải tin nhắn">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-xl p-3">
          <Skeleton className="h-11 w-11" rounded="rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
