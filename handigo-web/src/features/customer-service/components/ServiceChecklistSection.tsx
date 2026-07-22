import { MaterialIcon } from "@/components/common/MaterialIcon";

/**
 * Cam kết đi kèm mọi đơn, dùng chung ngôn ngữ với dải cam kết ở trang chủ.
 *
 * Tiêu đề cũ là "Danh mục công việc", nhưng nội dung bên dưới không phải danh
 * mục công việc của dịch vụ này: đó là cam kết chung của nền tảng, giống hệt
 * nhau trên cả 16 dịch vụ. Nhãn sai làm người đọc tưởng sắp thấy phạm vi công
 * việc rồi hụt.
 *
 * Chuyển từ thẻ trắng sang dải kẻ để phá chuỗi 5 khối cùng khuôn
 * `rounded-xl bg-surface-container-lowest shadow-sm` xếp liên tiếp trên trang.
 */
const commitments = [
  { icon: "badge", text: "Thợ đã qua kiểm duyệt hồ sơ" },
  { icon: "request_quote", text: "Báo giá trước khi bắt đầu" },
  { icon: "timeline", text: "Theo dõi trạng thái đơn" },
  { icon: "payments", text: "Xong việc mới thanh toán" },
  { icon: "support_agent", text: "Gửi yêu cầu hỗ trợ ngay trong đơn" },
  { icon: "history", text: "Mọi trao đổi lưu lại để tra sau" },
];

export function ServiceChecklistSection() {
  return (
    <section
      aria-labelledby="service-commitments"
      className="border-y border-outline-variant/50 py-7"
    >
      <h2
        id="service-commitments"
        className="mb-5 font-headline-md text-lg font-semibold text-on-surface"
      >
        Đơn nào cũng có
      </h2>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {commitments.map((item) => (
          <li key={item.text} className="flex items-start gap-3">
            <MaterialIcon className="mt-0.5 shrink-0 text-[20px] text-primary">
              {item.icon}
            </MaterialIcon>
            <span className="text-pretty text-on-surface-variant">
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
