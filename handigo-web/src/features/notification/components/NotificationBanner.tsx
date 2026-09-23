import { toneChipClasses } from "@/utils/statusTone";

/** Dải thông báo lỗi/thành công phía trên danh sách. Ưu tiên hiển thị lỗi nếu có cả hai. */
export function NotificationBanner({
  error,
  notice,
}: {
  error: string;
  notice: string;
}) {
  if (!error && !notice) return null;

  return (
    <div
      className={`rounded-xl px-4 py-3 ${
        error ? "bg-error/10 text-error" : toneChipClasses.success
      }`}
    >
      {error || notice}
    </div>
  );
}
