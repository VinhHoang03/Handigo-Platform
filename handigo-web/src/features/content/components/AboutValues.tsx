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
      className="about-values px-6 py-16 lg:py-24"
    >
      <div className="mx-auto grid max-w-7xl gap-x-14 gap-y-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="about-section-index">02 / Điều chúng tôi giữ vững</p>
          <h2
            id="about-values-heading"
            className="mt-4 text-balance font-headline-lg text-3xl font-bold tracking-[-0.03em] text-on-surface sm:text-4xl"
          >
            Niềm tin bắt đầu từ những điều có thể kiểm chứng
          </h2>
          <ul className="mt-10 space-y-3">
            {aboutCommitments.map((item, index) => (
              <li key={item.title} className="about-commitment flex items-start gap-4">
                <span className="about-commitment__number">0{index + 1}</span>
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-headline-md text-base font-semibold text-on-surface">
                    <item.icon aria-hidden="true" size={18} className="shrink-0 text-primary" />
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

        <div className="about-values__panel lg:col-span-7">
          <p className="text-label-sm font-semibold uppercase tracking-[0.18em] text-secondary">
            Giá trị cốt lõi
          </p>
          <dl className="mt-5">
            {coreValues.map((value, index) => (
              <div
                key={value.title}
                className="about-value-row grid gap-2 py-6 sm:grid-cols-[42px_150px_minmax(0,1fr)] sm:items-start sm:gap-5"
              >
                <span className="about-value-row__index" aria-hidden="true">0{index + 1}</span>
                <dt className="flex items-center gap-2 font-headline-md text-base font-semibold text-on-surface">
                  <value.icon aria-hidden="true" size={18} className="text-primary" />
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
