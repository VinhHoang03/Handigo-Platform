import { howItWorksSteps } from "@/features/home/data/homeData";

/**
 * Chuỗi bước nối tiếp — khuôn bố cục không xuất hiện ở section nào khác.
 *
 * Nhãn là động từ ("Mô tả việc") chứ không phải "Bước 1": người đọc nhớ được
 * việc mình phải làm, thay vì phải nhớ thứ tự. Đường kẻ nối chỉ vẽ ở desktop,
 * nơi 4 bước nằm ngang; ở mobile chúng xếp dọc nên đường nối thành nhiễu.
 */
export const HowItWorksSection = () => (
  <section
    aria-labelledby="how-it-works-heading"
    className="mx-auto mt-lg max-w-7xl px-4 md:px-8"
  >
    <div className="max-w-2xl">
      <h2
        id="how-it-works-heading"
        className="text-balance font-headline-lg text-headline-lg tracking-[-0.02em] text-on-surface"
      >
        Đặt một việc mất bao lâu
      </h2>
      <p className="mt-2.5 text-pretty text-body-md text-on-surface-variant">
        Bốn bước, làm hết trên một màn hình.
      </p>
    </div>

    <ol className="relative mt-lg grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
      <span
        aria-hidden="true"
        className="absolute left-0 right-0 top-7 hidden h-px bg-outline-variant/60 lg:block"
      />
      {howItWorksSteps.map((step) => (
        <li key={step.title} className="relative">
          <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-primary text-on-primary shadow-[0_10px_24px_-10px_rgba(53,37,205,0.6)]">
            <step.icon aria-hidden="true" size={24} />
          </span>
          <h3 className="mt-5 font-headline-md text-lg font-semibold text-on-surface">
            {step.title}
          </h3>
          <p className="mt-1.5 max-w-[34ch] text-pretty text-body-md text-on-surface-variant">
            {step.desc}
          </p>
        </li>
      ))}
    </ol>
  </section>
);
