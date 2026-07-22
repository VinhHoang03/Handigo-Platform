import { MaterialIcon } from "../common/MaterialIcon";
import { HeroPreviewCard } from "./HeroPreviewCard";
import { HeroSearch } from "./HeroSearch";

/** Khách hàng thật hiển thị ở dải tín nhiệm — mỗi người một avatar riêng. */
const trustedCustomers = [
  { initials: "NL", name: "Nguyễn Lan", tone: "bg-primary text-on-primary" },
  { initials: "TH", name: "Trần Hải", tone: "bg-secondary text-on-secondary" },
  { initials: "PD", name: "Phạm Duy", tone: "bg-tertiary text-on-tertiary" },
];

const HeroTrustRow = () => (
  <div className="flex items-center gap-4">
    <ul className="flex -space-x-2.5">
      {trustedCustomers.map((customer) => (
        <li
          key={customer.initials}
          title={customer.name}
          className={`grid h-9 w-9 place-items-center rounded-full text-[11px] font-semibold ring-2 ring-surface ${customer.tone}`}
        >
          <span aria-hidden="true">{customer.initials}</span>
          <span className="sr-only">{customer.name}</span>
        </li>
      ))}
    </ul>
    <p className="text-label-sm text-on-surface-variant">
      <span className="font-semibold text-on-surface">50.000+</span> việc đã hoàn
      thành
    </p>
  </div>
);

export const HeroSection = () => (
  <section
    aria-labelledby="hero-heading"
    className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-x-16 gap-y-20 px-4 md:px-8 lg:grid-cols-12"
  >
    <div className="lg:col-span-7">
      <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-outline-variant/60 bg-surface-container-low py-1.5 pl-2 pr-4 text-label-sm text-on-surface-variant">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-secondary/15 text-secondary">
          <MaterialIcon filled className="text-[13px]">
            verified
          </MaterialIcon>
        </span>
        Thợ đã qua kiểm duyệt hồ sơ
      </p>

      <h1
        id="hero-heading"
        className="text-balance text-4xl font-bold leading-[1.08] tracking-[-0.03em] text-on-surface md:text-5xl lg:text-[3.5rem]"
      >
        Sửa gì cũng có thợ,{" "}
        <span className="text-primary">đến tận nhà bạn</span>
      </h1>

      <p className="mt-6 max-w-[52ch] text-pretty text-body-lg text-on-surface-variant">
        Điện, nước, điều hoà, đồ gỗ — đặt thợ trong vài phút và theo dõi tiến độ
        ngay trên ứng dụng.
      </p>

      <div className="mt-9">
        <HeroSearch />
      </div>

      <div className="mt-8">
        <HeroTrustRow />
      </div>
    </div>

    <div className="lg:col-span-5">
      <HeroPreviewCard />
    </div>
  </section>
);
