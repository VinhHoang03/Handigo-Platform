import { aboutCommitments, coreValues } from "../data/aboutData";

/**
 * Cam kết và giá trị cốt lõi gộp thành một khối hai cột lệch.
 *
 * Trước đây là hai section rời: bốn thẻ giá trị đều nhau, rồi một dải số liệu
 * bịa trên nền tím. Bốn thẻ đều nhau là khuôn đã dùng ở trang chủ và trang Hỗ
 * trợ; lặp lần thứ ba thì cả site chỉ còn một nhịp.
 */
export function AboutValues() {
  return (
    <section
      aria-labelledby="about-values-heading"
      className="bg-surface-container-low px-6 py-12 lg:py-16"
    >
      <div className="mx-auto grid max-w-7xl gap-x-14 gap-y-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2
            id="about-values-heading"
            className="text-balance font-headline-lg text-3xl font-bold tracking-[-0.02em] text-on-surface"
          >
            Điều chúng tôi cam kết được ngay hôm nay
          </h2>
          <ul className="mt-8 space-y-7">
            {aboutCommitments.map((item) => (
              <li key={item.title} className="flex items-start gap-4">
                <item.icon aria-hidden="true" size={22} className="mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <h3 className="font-headline-md text-base font-semibold text-on-surface">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-pretty leading-7 text-on-surface-variant">
                    {item.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-7 lg:pt-2">
          <h3 className="font-headline-md text-lg font-semibold text-on-surface">
            Giá trị cốt lõi
          </h3>
          <dl className="mt-4 border-t border-outline-variant/50">
            {coreValues.map((value) => (
              <div
                key={value.title}
                className="grid gap-1 border-b border-outline-variant/50 py-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6"
              >
                <dt className="font-headline-md text-base font-semibold text-on-surface">
                  {value.title}
                </dt>
                <dd className="text-pretty leading-7 text-on-surface-variant">
                  {value.text}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
