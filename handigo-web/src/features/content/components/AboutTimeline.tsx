import { ReliableImage } from "@/components/common/ReliableImage";
import { milestones } from "../data/aboutData";

interface AboutTimelineProps {
  image?: string;
  imageAlt?: string;
}

/**
 * Dòng thời gian giữ nguyên nội dung, chuyển sang bố cục hai cột kèm ảnh.
 *
 * Sau khi gỡ dải số liệu thổi phồng, mốc 5/2026 đến 7/2026 trở nên trung thực và
 * hợp lý: một sản phẩm hai tháng tuổi kể đúng hai tháng của mình.
 */
export function AboutTimeline({ image, imageAlt }: AboutTimelineProps) {
  return (
    <section
      aria-labelledby="about-timeline-heading"
      className="mx-auto grid max-w-7xl gap-x-14 gap-y-10 px-6 py-12 lg:grid-cols-12 lg:py-16"
    >
      <div className="lg:col-span-5">
        <h2
          id="about-timeline-heading"
          className="text-balance font-headline-lg text-3xl font-bold tracking-[-0.02em] text-on-surface"
        >
          Hành trình phát triển
        </h2>
        <ReliableImage
          src={image}
          alt={imageAlt || ""}
          className="mt-8 aspect-[5/4] w-full rounded-3xl bg-surface-container object-cover"
        />
      </div>

      <ol className="relative space-y-4 lg:col-span-7">
        {milestones.map((milestone) => (
          <li
            key={milestone.period}
            className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6"
          >
            <p className="text-label-sm font-semibold text-secondary">
              {milestone.period}
            </p>
            <h3 className="mt-1 font-headline-md text-lg font-semibold text-on-surface">
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
