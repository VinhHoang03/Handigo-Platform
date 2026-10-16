import { CalendarCheck, MessageCircle, Search, Sparkles } from "lucide-react";

const aiCapabilities = [
  {
    icon: Search,
    title: "Hiểu nhu cầu, gợi ý dịch vụ",
    description:
      "Mô tả việc bạn cần bằng lời tự nhiên. Trợ lý AI giúp tìm dịch vụ và giải thích thông tin để bạn dễ lựa chọn.",
  },
  {
    icon: CalendarCheck,
    title: "Hỗ trợ bạn đặt lịch",
    description:
      "Từ chọn dịch vụ, địa chỉ đến thời gian mong muốn, AI hướng dẫn từng bước. Bạn xem lại và xác nhận trước khi tạo đơn.",
  },
  {
    icon: MessageCircle,
    title: "Giải đáp và kết nối hỗ trợ",
    description:
      "Tra cứu hướng dẫn, chính sách và tình trạng đơn hàng ngay trong cuộc trò chuyện. Khi cần, AI hỗ trợ bạn gửi yêu cầu đến Handigo.",
  },
];

export const AiIntroductionSection = () => (
  <section
    aria-labelledby="ai-introduction-heading"
    className="mx-auto mt-14 max-w-7xl px-4 md:mt-20 md:px-8"
  >
    <div className="rounded-3xl border border-outline-variant/50 bg-surface px-6 py-10 sm:px-10 md:py-12">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-4 inline-flex items-center gap-2 text-label-sm font-semibold uppercase tracking-[0.12em] text-primary">
          <Sparkles aria-hidden="true" size={18} />
          Công nghệ AI tại Handigo
        </p>
        <h2
          id="ai-introduction-heading"
          className="text-balance font-headline-lg text-headline-lg tracking-[-0.02em] text-on-surface"
        >
          Thêm một trợ lý, bớt một việc lo
        </h2>
        <p className="mt-3 text-pretty text-body-md text-on-surface-variant">
          Không cần biết bắt đầu từ đâu. Hãy chia sẻ nhu cầu, AI sẽ giúp bạn
          tìm hiểu dịch vụ và thực hiện các bước tiếp theo ngay trên Handigo.
        </p>
      </div>

      <ul className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-0">
        {aiCapabilities.map(({ icon: Icon, title, description }) => (
          <li
            key={title}
            className="border-t border-outline-variant/50 pt-8 first:border-t-0 first:pt-0 md:border-l md:border-t-0 md:px-6 md:pt-0 md:first:border-l-0 md:first:pl-0 md:last:pr-0 lg:px-8"
          >
            <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
              <Icon aria-hidden="true" size={24} />
            </span>
            <h3 className="font-headline-md text-lg font-semibold text-on-surface">
              {title}
            </h3>
            <p className="mt-2 text-pretty text-body-md text-on-surface-variant">
              {description}
            </p>
          </li>
        ))}
      </ul>

    </div>
  </section>
);
