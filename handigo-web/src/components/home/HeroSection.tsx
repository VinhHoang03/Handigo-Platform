import { MaterialIcon } from "../common/MaterialIcon";
import { ReliableImage } from "../common/ReliableImage";
import { HeroSearch } from "./HeroSearch";

interface HeroSectionProps {
  /** Ảnh minh hoạ dịch vụ thật, lấy từ API danh mục. */
  image?: string;
  imageAlt?: string;
}

/**
 * Chia đôi bất đối xứng: chữ chiếm 7 cột, ảnh 5 cột.
 *
 * Bên phải trước đây là một giao diện đơn hàng **giả** dựng bằng div (mã đơn,
 * tên thợ, số tiền, mốc giờ — bịa toàn bộ). Trên một sàn mà người dùng sắp cho
 * người lạ vào nhà, dựng bằng chứng giả là rủi ro thật chứ không phải trang trí.
 * Thay bằng ảnh dịch vụ thật của chính hệ thống.
 *
 * Hàng avatar kèm số việc đã hoàn thành cũng bị gỡ khỏi hero: con số đó không
 * truy được về dữ liệu nào, và hero chỉ nên làm một việc duy nhất là để người
 * dùng gõ được thứ họ cần sửa. Vai trò tạo niềm tin chuyển sang dải cam kết.
 */
export const HeroSection = ({ image, imageAlt }: HeroSectionProps) => (
  <section
    aria-labelledby="hero-heading"
    className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-x-16 gap-y-12 px-4 md:px-8 lg:grid-cols-12"
  >
    <div className="lg:col-span-7">
      <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-outline-variant/60 bg-surface-container-low py-1.5 pl-2 pr-4 text-label-sm text-on-surface-variant">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-secondary/15 text-secondary">
          <MaterialIcon filled className="text-[13px]">
            verified
          </MaterialIcon>
        </span>
        Thợ đã qua kiểm duyệt hồ sơ
      </p>

      <h1
        id="hero-heading"
        className="text-balance font-headline-xl text-4xl font-bold leading-[1.08] tracking-[-0.03em] text-on-surface md:text-5xl lg:text-[3.5rem]"
      >
        Sửa gì cũng có thợ, <span className="text-primary">đến tận nhà bạn</span>
      </h1>

      <p className="mt-6 max-w-[46ch] text-pretty text-body-lg text-on-surface-variant">
        Điện, nước, điều hoà, đồ gỗ. Đặt thợ trong vài phút và theo dõi tiến độ
        ngay trên đơn.
      </p>

      <div className="mt-9">
        <HeroSearch />
      </div>
    </div>

    <div className="lg:col-span-5">
      <ReliableImage
        src={image}
        alt={imageAlt || ""}
        className="aspect-[4/5] w-full rounded-3xl bg-surface-container object-cover shadow-[0_24px_60px_-24px_rgba(19,27,46,0.35)] sm:aspect-[16/10] lg:aspect-[4/5]"
      />
    </div>
  </section>
);
