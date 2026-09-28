import { AboutScene } from "./AboutScene";

/**
 * Hero bất đối xứng thay cho khối căn giữa cũ.
 *
 * Trước đợt này toàn bộ trang Giới thiệu căn giữa từ trên xuống dưới và không có
 * hình minh họa nào, nên đọc như một bức tường văn bản. Cảnh ngôi nhà dùng
 * các mặt khối CSS 3D và phản ứng theo vị trí chuột.
 */
export function AboutHero() {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-x-14 gap-y-10 px-6 pb-12 pt-8 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <p className="mb-3 text-label-sm font-semibold uppercase tracking-[0.18em] text-secondary">
          Về Handigo
        </p>
        <h1 className="text-balance font-headline-xl text-4xl font-bold leading-tight tracking-[-0.02em] text-on-surface sm:text-5xl">
          Nâng tầm chất lượng cuộc sống Việt
        </h1>
        <p className="mt-5 max-w-[52ch] text-pretty text-lg leading-8 text-on-surface-variant">
          Chúng tôi kết nối dịch vụ gia đình thông minh, nhanh chóng và đáng tin
          cậy để bạn dành thời gian cho những điều quan trọng hơn.
        </p>
      </div>

      <div className="lg:col-span-5">
        <AboutScene variant="home" />
      </div>
    </section>
  );
}
