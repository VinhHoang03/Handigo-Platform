/**
 * Dải thông báo dùng chung cho các trang xác thực.
 *
 * Lỗi dùng `role="alert"`, thông báo thường dùng `role="status"`. Trước đây cả
 * hai đều là `role="status"`, nghĩa là trình đọc màn hình chờ đọc xong nội dung
 * đang đọc mới thông báo — người dùng có thể tiếp tục điền form mà không biết
 * vừa có lỗi.
 */
export function AuthFeedback({
  error,
  notice,
}: {
  error?: string | null;
  notice?: string | null;
}) {
  if (!error && !notice) return null;

  return (
    <div
      role={error ? "alert" : "status"}
      className={`mb-5 rounded-xl border p-3 text-sm ${
        error
          ? "border-error/20 bg-error/10 text-error"
          : "border-success/20 bg-success/10 text-on-success-container"
      }`}
    >
      {error || notice}
    </div>
  );
}
