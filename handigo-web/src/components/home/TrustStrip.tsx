import { MaterialIcon } from "../common/MaterialIcon";
import { commitments } from "@/features/home/data/homeData";

/**
 * Dải ngang mảnh, không thẻ, không viền bao — chỉ đường kẻ chia cột.
 *
 * Thay cho dải số liệu nền tím trước đây ("10.000+ khách hàng"...): những con số
 * đó không truy được về dữ liệu nào và mâu thuẫn với trang Giới thiệu. Ba cam
 * kết dưới đây mô tả cơ chế có thật trong sản phẩm nên kiểm chứng được.
 */
export const TrustStrip = () => (
  <section
    aria-label="Cam kết của Handigo"
    className="mt-lg border-y border-outline-variant/50 bg-surface-container-low/50"
  >
    <ul className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-outline-variant/50 px-4 md:px-8 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
      {commitments.map((item) => (
        <li
          key={item.title}
          className="flex items-start gap-4 py-7 lg:px-8 lg:first:pl-0 lg:last:pr-0"
        >
          <MaterialIcon className="mt-0.5 shrink-0 text-[22px] text-primary">
            {item.icon}
          </MaterialIcon>
          <div className="min-w-0">
            <h3 className="font-headline-md text-base font-semibold text-on-surface">
              {item.title}
            </h3>
            <p className="mt-1 text-pretty text-label-md text-on-surface-variant">
              {item.desc}
            </p>
          </div>
        </li>
      ))}
    </ul>
  </section>
);
