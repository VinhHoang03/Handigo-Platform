import { reasons } from "@/features/home/data/homeData";

/**
 * Khuôn editorial: một câu khẳng định cỡ lớn ở cột trái, danh sách luận điểm ở
 * cột phải. Thay 4 thẻ icon đều nhau — khuôn đó đã dùng ở dải cam kết và lưới
 * danh mục, lặp lần thứ ba thì trang chỉ còn một nhịp duy nhất.
 *
 * Section này gánh phần thuyết phục sau khi dải số liệu bịa bị gỡ: nói bằng lời
 * hứa cụ thể, kiểm chứng được, thay vì bằng con số không có nguồn.
 */
export const FeaturesSection = () => (
  <section
    aria-labelledby="features-heading"
    className="mx-auto mt-lg max-w-7xl px-4 md:px-8"
  >
    <div className="grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <h2
          id="features-heading"
          className="text-balance font-headline-xl text-3xl font-bold leading-[1.12] tracking-[-0.03em] text-on-surface md:text-[2.75rem]"
        >
          Việc trong nhà thì{" "}
          <span className="text-primary">không thể phó mặc</span> cho may rủi.
        </h2>
      </div>

      <dl className="lg:col-span-7 lg:pt-2">
        {reasons.map((reason) => (
          <div
            key={reason.title}
            className="border-t border-outline-variant/50 py-7 first:border-t-0 first:pt-0"
          >
            <dt className="font-headline-md text-lg font-semibold text-on-surface">
              {reason.title}
            </dt>
            <dd className="mt-2 max-w-[58ch] text-pretty text-body-md text-on-surface-variant">
              {reason.desc}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  </section>
);
