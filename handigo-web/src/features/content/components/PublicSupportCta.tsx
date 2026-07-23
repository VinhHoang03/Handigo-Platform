import { Link } from "react-router-dom";

/**
 * Lối vào tạo yêu cầu hỗ trợ cho khách chưa đăng nhập.
 *
 * Chỗ này trước đây là một biểu mẫu đầy đủ (chủ đề, danh mục, mô tả, đính kèm
 * ảnh). Nhưng `handleSubmit` chỉ gọi `setSubmitted(true)` rồi `reset()` — không
 * hề gửi dữ liệu đi đâu, trong khi vẫn hiện "Yêu cầu đã được ghi nhận. Bộ phận
 * hỗ trợ sẽ sớm liên hệ với bạn." Người dùng mô tả sự cố, bấm gửi, và mọi thứ
 * biến mất cùng lời xác nhận sai.
 *
 * Backend không có endpoint công khai để sửa: `supportTicket.routes.ts` gắn
 * `router.use(authMiddleware)` cho toàn bộ route, và tạo ticket còn yêu cầu vai
 * trò CUSTOMER/PROVIDER. Vì vậy thay biểu mẫu bằng hai lối đi có thật: đăng nhập
 * để tạo yêu cầu có mã theo dõi, hoặc dùng tổng đài/email.
 */
export function PublicSupportCta() {
  return (
    <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 sm:p-8">
      <h2 className="font-headline-lg text-2xl font-bold tracking-[-0.02em] text-on-surface sm:text-3xl">
        Gửi yêu cầu hỗ trợ
      </h2>
      <p className="mt-3 max-w-[60ch] text-pretty leading-7 text-on-surface-variant">
        Đăng nhập để tạo yêu cầu có mã theo dõi. Bạn xem được tiến độ xử lý và
        trao đổi trực tiếp với bộ phận hỗ trợ ngay trong ứng dụng.
      </p>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link to="/login?redirect=/ho-tro" className="btn-primary px-7">
          Đăng nhập để gửi yêu cầu
        </Link>
        <Link to="/register" className="btn-secondary px-7">
          Tạo tài khoản
        </Link>
      </div>

      {/* Khối "Cần hỗ trợ ngay?" kèm số tổng đài và email đã gỡ: cột "Kênh hỗ
          trợ" ngay bên cạnh đã liệt kê đúng hai kênh đó. In hai lần trên cùng
          một màn hình chỉ làm người đọc phân vân xem có khác nhau chỗ nào. */}
    </section>
  );
}
