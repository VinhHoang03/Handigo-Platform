import { AboutScene } from "./AboutScene";
import { milestones } from "../data/aboutData";

/**
 * Dòng thời gian giữ nguyên nội dung, kèm minh họa các bậc phát triển bằng CSS 3D.
 *
 * Sau khi gỡ dải số liệu thổi phồng, mốc 5/2026 đến 7/2026 trở nên trung thực và
 * hợp lý: một sản phẩm hai tháng tuổi kể đúng hai tháng của mình.
 */
export function AboutTimeline() {
  return (
    <section
      aria-labelledby="about-timeline-heading"
      className="about-timeline mx-auto grid max-w-7xl gap-x-16 gap-y-10 px-6 py-16 lg:grid-cols-12 lg:py-24"
    >
      <div className="lg:col-span-5">
        <p className="about-section-index">03 / Hành trình</p>
        <h2
          id="about-timeline-heading"
          className="mt-4 text-balance font-headline-lg text-3xl font-bold tracking-[-0.03em] text-on-surface sm:text-4xl"
        >
          Từng bước xây dựng một hệ sinh thái tử tế
        </h2>
        <div className="mt-8"><AboutScene variant="journey" /></div>
      </div>

      <ol className="about-timeline__list relative lg:col-span-7 lg:pt-8">
        {milestones.map((milestone, index) => (
          <li
            key={milestone.period}
            className="about-milestone relative pb-10 pl-14 last:pb-0 sm:pl-20"
          >
            <span className="about-milestone__marker" aria-hidden="true">0{index + 1}</span>
            <p className="text-label-sm font-semibold uppercase tracking-[0.12em] text-secondary">{milestone.period}</p>
            <h3 className="mt-2 font-headline-md text-xl font-semibold text-on-surface">
              {milestone.title}
            </h3>
            <p className="mt-2 text-pretty leading-7 text-on-surface-variant">
              {milestone.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
