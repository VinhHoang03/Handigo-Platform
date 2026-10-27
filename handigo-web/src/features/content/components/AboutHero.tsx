import { AboutScene } from "./AboutScene";
import { ArrowDown, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { MouseEvent } from "react";

/**
 * Hero bất đối xứng thay cho khối căn giữa cũ.
 *
 * Trước đợt này toàn bộ trang Giới thiệu căn giữa từ trên xuống dưới và không có
 * hình minh họa nào, nên đọc như một bức tường văn bản. Cảnh ngôi nhà dùng
 * các mặt khối CSS 3D và phản ứng theo vị trí chuột.
 */
export function AboutHero() {
  const scrollToStory = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.getElementById("cau-chuyen-handigo");
    if (!target) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = window.scrollY;
    const destination = target.getBoundingClientRect().top + start - 96;

    if (reduceMotion) {
      window.scrollTo({ top: destination });
      return;
    }

    const duration = 900;
    const startedAt = performance.now();
    const ease = (progress: number) => 1 - Math.pow(1 - progress, 4);
    const animate = (time: number) => {
      const progress = Math.min((time - startedAt) / duration, 1);
      window.scrollTo({ top: start + (destination - start) * ease(progress) });
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  };

  return (
    <section className="about-hero mx-auto max-w-7xl px-6 pb-10 pt-6 lg:pb-16 lg:pt-10">
      <div className="about-hero__grid grid items-center gap-x-16 gap-y-10 lg:grid-cols-12">
        <div className="about-hero__copy lg:col-span-7">
          <p className="about-hero__eyebrow text-label-sm font-semibold uppercase tracking-[0.2em] text-secondary">
            Về Handigo · Dịch vụ gia đình
          </p>
          <h1 className="about-hero__title mt-5 text-balance font-headline-xl text-[clamp(2.75rem,6vw,5.25rem)] font-bold leading-[0.98] tracking-[-0.055em] text-on-surface">
            Chăm sóc ngôi nhà,
            <span className="block text-primary">nhẹ lòng mỗi ngày.</span>
          </h1>
          <p className="about-hero__lead mt-7 max-w-[54ch] text-pretty text-lg leading-8 text-on-surface-variant">
            Handigo kết nối bạn với nhà cung cấp dịch vụ phù hợp bằng một quy
            trình rõ ràng, từ đặt lịch đến hoàn tất công việc.
          </p>

          <div className="about-hero__actions mt-8 flex flex-wrap items-center gap-3">
            <Link to="/customer/services" className="btn-primary">
              Khám phá dịch vụ
            </Link>
            <a
              href="#cau-chuyen-handigo"
              className="about-hero__story-link"
              onClick={scrollToStory}
            >
              Câu chuyện của chúng tôi
              <ArrowDown aria-hidden="true" size={17} />
            </a>
          </div>

          <ul className="about-hero__proof mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm text-on-surface-variant">
            <li><CheckCircle2 aria-hidden="true" size={17} /> Hồ sơ được kiểm duyệt</li>
            <li><CheckCircle2 aria-hidden="true" size={17} /> Quy trình có thể theo dõi</li>
          </ul>
        </div>

        <div className="about-hero__visual lg:col-span-5">
          <div className="about-hero__visual-label" aria-hidden="true">
            <span>Handigo</span>
            <span>01</span>
          </div>
          <AboutScene variant="home" />
        </div>
      </div>
    </section>
  );
}
