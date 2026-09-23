import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { HeroSearch } from "./HeroSearch";
import { HomeIllustration } from "./HomeIllustration";
import "./home-motion.css";
import type { CategoryShowcaseItem } from "@/features/home/hooks/useCategoryShowcase";

export const HeroSection = ({ items }: { items: CategoryShowcaseItem[] }) => {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)");
    let frame = 0;
    let bounds: DOMRect | undefined;
    const reset = () => {
      cancelAnimationFrame(frame);
      bounds = undefined;
      hero.style.removeProperty("--home-x");
      hero.style.removeProperty("--home-y");
    };
    const move = (event: PointerEvent) => {
      if (!motion.matches || event.pointerType !== "mouse") return;
      bounds ??= hero.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        hero.style.setProperty("--home-x", `${x * 16}px`);
        hero.style.setProperty("--home-y", `${y * 12}px`);
      });
    };
    hero.addEventListener("pointermove", move, { passive: true });
    hero.addEventListener("pointerleave", reset);
    window.addEventListener("resize", reset);
    window.addEventListener("scroll", reset, { passive: true });
    motion.addEventListener("change", reset);
    return () => {
      reset();
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", reset);
      window.removeEventListener("resize", reset);
      window.removeEventListener("scroll", reset);
      motion.removeEventListener("change", reset);
    };
  }, []);

  return (
  <section ref={heroRef} aria-labelledby="hero-heading" className="home-hero mx-auto max-w-7xl px-4 pb-8 pt-6 md:px-8 md:pb-10 md:pt-10">
    <div className="home-hero-backdrop" aria-hidden="true"><div className="home-hero-lines" /></div>
    <div className="grid items-center gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-8">
    <div className="relative z-10 mx-auto max-w-2xl text-center lg:text-left">
      <p className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-label-sm text-primary">
        <BadgeCheck aria-hidden="true" size={16} />
        Thợ đã qua kiểm duyệt hồ sơ
      </p>
      <h1 id="hero-heading" className="mt-5 text-balance font-headline-xl text-[2rem] font-bold leading-[1.12] tracking-[-0.035em] text-on-surface sm:text-5xl lg:text-[3.5rem]">
        Chăm sóc ngôi nhà,<br />
        <span className="text-primary">nhẹ việc của bạn.</span>
      </h1>
      <p className="mx-auto mt-6 max-w-[34rem] text-pretty text-body-md text-on-surface-variant sm:text-body-lg lg:mx-0">
        Tìm thợ điện, nước, điều hoà và nhiều dịch vụ tại nhà.
        Xem báo giá trước, theo dõi công việc ngay trên đơn.
      </p>
    </div>
    <div className="mx-auto hidden w-full max-w-[400px] sm:block lg:max-w-none"><HomeIllustration /></div>
    </div>
    <div className="relative z-10 mx-auto mt-8 max-w-5xl text-left md:mt-10">
      <HeroSearch />
      <div className="mt-4 flex min-h-11 flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
        {items.length > 0 && <span className="mr-1 text-on-surface-variant">Khám phá nhanh:</span>}
        {items.slice(0, 4).map((item) => (
          <Link key={item.id} to={`/customer/services?categoryId=${item.id}`} className="inline-flex min-h-11 items-center rounded-full px-3 py-2 text-on-surface-variant transition-colors hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary">
            {item.name}
          </Link>
        ))}
        <Link to="/customer/services" className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-2 font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary">
          Tất cả dịch vụ <ArrowRight aria-hidden="true" size={14} />
        </Link>
      </div>
    </div>
  </section>
  );
};
