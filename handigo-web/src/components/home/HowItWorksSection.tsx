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
    className="mx-auto mt-14 max-w-7xl px-4 md:mt-20 md:px-8"
  >
    <div className="border-t border-outline-variant/50 py-8 sm:py-10 lg:py-12">
    <div className="max-w-2xl">
      <p className="mb-3 text-label-sm font-semibold uppercase tracking-[0.12em] text-primary">Đơn giản từ đầu đến cuối</p>
      <h2
        id="how-it-works-heading"
        className="text-balance font-headline-lg text-headline-lg tracking-[-0.02em] text-on-surface"
      >
        Từ việc cần sửa đến nhà được chăm
      </h2>
      <p className="mt-2.5 text-pretty text-body-md text-on-surface-variant">
        Bốn bước rõ ràng. Bạn luôn biết công việc đang đến đâu.
      </p>
    </div>

    <ol className="relative mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
      {howItWorksSteps.map((step, index) => (
        <li key={step.title} className="relative">
          <div className="flex items-center justify-between border-b border-outline-variant/60 pb-5">
          <span className="grid h-12 w-12 place-items-center text-primary">
            <step.icon aria-hidden="true" size={24} />
          </span>
          <span aria-hidden="true" className="font-headline-md text-3xl font-semibold tabular-nums text-primary/50">0{index + 1}</span>
          </div>
          <h3 className="mt-5 font-headline-md text-lg font-semibold text-on-surface">
            {step.title}
          </h3>
          <p className="mt-1.5 max-w-[34ch] text-pretty text-body-md text-on-surface-variant">
            {step.desc}
          </p>
        </li>
      ))}
    </ol>
    </div>
  </section>
);
