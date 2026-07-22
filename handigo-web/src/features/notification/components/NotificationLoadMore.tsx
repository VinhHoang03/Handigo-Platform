/** Nút "xem thêm" phân trang kiểu vô hạn cho danh sách thông báo của khách hàng/nhà cung cấp. */
export function NotificationLoadMore({
  page,
  totalPages,
  loadingMore,
  hasItems,
  onLoadMore,
}: {
  page: number;
  totalPages: number;
  loadingMore: boolean;
  hasItems: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="mt-5 flex justify-center">
      {page < totalPages ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-5 py-3 font-semibold text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px]">
            expand_more
          </span>
          {loadingMore ? "Đang tải..." : "Xem thông báo trước đó"}
        </button>
      ) : hasItems ? (
        <p className="text-sm text-on-surface-variant">
          Đã hiển thị toàn bộ thông báo.
        </p>
      ) : null}
    </div>
  );
}
