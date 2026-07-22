import {
  PublicContentLayout,
  SectionTitle,
} from "../components/PublicContentLayout";
import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { MaterialIcon } from "@/components/common/MaterialIcon";
import {
  aboutStats,
  coreValues,
  leaders,
  milestones,
} from "../data/aboutData";

/**
 * Phần "Chúng tôi là ai?" trước đây là bốn đoạn văn dài bị nhồi vào một cột hẹp
 * cạnh ảnh minh hoạ do AI sinh, host trên CDN Google. Ảnh đã gỡ; nội dung nay
 * dàn thành bố cục biên tập: câu dẫn cỡ lớn, phần còn lại chia hai cột.
 */
const AboutIntro = () => (
  <section className="mx-auto max-w-5xl px-6 pb-12 pt-4">
    <h2 className="font-headline-lg text-3xl font-bold tracking-[-0.02em] text-on-surface">
      Chúng tôi là ai?
    </h2>

    <p className="mt-6 max-w-3xl text-pretty text-xl leading-9 text-on-surface">
      Handigo là nền tảng kết nối khách hàng với các chuyên gia dịch vụ uy tín,
      giúp việc tìm kiếm và đặt lịch dịch vụ gia đình trở nên nhanh chóng, minh
      bạch và thuận tiện hơn.
    </p>

    <div className="mt-8 grid gap-x-12 gap-y-5 text-pretty leading-8 text-on-surface-variant md:grid-cols-2">
      <p>
        Chúng tôi hướng đến một hệ sinh thái nơi khách hàng dễ dàng tiếp cận
        những nhà cung cấp chất lượng, đồng thời tạo môi trường phát triển bền
        vững cho cộng đồng nhà cung cấp.
      </p>
      <p>
        Công nghệ giúp quy trình đặt lịch, theo dõi và đánh giá dịch vụ trở nên
        rõ ràng, từ gợi ý dịch vụ phù hợp đến tối ưu quy trình làm việc cho nhà
        cung cấp.
      </p>
      <p className="md:col-span-2 md:max-w-[75ch]">
        Chúng tôi tin rằng minh bạch, chất lượng và uy tín là nền tảng để xây
        dựng niềm tin lâu dài — đồng hành cùng khách hàng trong việc chăm sóc
        ngôi nhà và hỗ trợ nhà cung cấp phát triển sự nghiệp.
      </p>
    </div>
  </section>
);

const CoreValues = () => (
  <section className="bg-surface-container-low px-6 py-12 lg:py-14">
    <div className="mx-auto max-w-7xl">
      <SectionTitle
        title="Giá trị cốt lõi"
        description="Những nguyên tắc định hướng mọi quyết định và trải nghiệm tại Handigo."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {coreValues.map((value) => (
          <article
            key={value.title}
            className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-7"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/8 text-primary">
              <MaterialIcon className="text-2xl">{value.icon}</MaterialIcon>
            </span>
            <h3 className="mt-5 text-lg font-semibold text-on-surface">
              {value.title}
            </h3>
            <p className="mt-2 text-pretty text-sm leading-6 text-on-surface-variant">
              {value.text}
            </p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

const AboutStats = () => (
  <section className="mx-auto max-w-7xl px-6 py-12 lg:py-14">
    <div className="grid gap-6 rounded-3xl bg-primary px-8 py-10 text-on-primary sm:grid-cols-3">
      {aboutStats.map((stat) => (
        <div key={stat.label}>
          <p className="font-headline-xl text-4xl font-bold tabular-nums">
            {stat.value}
          </p>
          <p className="mt-2 text-body-md text-on-primary/75">{stat.label}</p>
        </div>
      ))}
    </div>
  </section>
);

const Leadership = () => (
  <section className="bg-surface-container px-6 py-12 lg:py-14">
    <div className="mx-auto max-w-5xl">
      <SectionTitle title="Đội ngũ lãnh đạo" />
      <div className="grid gap-8 sm:grid-cols-3">
        {leaders.map((leader) => (
          <article key={leader.name} className="text-center">
            <InitialsAvatar
              name={leader.name}
              className="mx-auto h-28 w-28"
              textClassName="text-2xl"
            />
            <h3 className="mt-4 text-lg font-semibold text-on-surface">
              {leader.name}
            </h3>
            <p className="mt-1 text-label-sm text-on-surface-variant">
              {leader.role}
            </p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

const Timeline = () => (
  <section className="mx-auto max-w-4xl px-6 py-12 lg:py-14">
    <SectionTitle title="Hành trình phát triển" />
    <ol className="relative space-y-4 before:absolute before:bottom-3 before:left-5 before:top-3 before:w-px before:bg-outline-variant">
      {milestones.map((milestone, index) => (
        <li key={milestone.period} className="relative flex gap-5">
          <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold leading-none text-on-primary">
            T{index + 5}
          </span>
          <div className="min-w-0 flex-1 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5">
            <p className="text-label-sm font-semibold text-secondary">
              {milestone.period}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-on-surface">
              {milestone.title}
            </h3>
            <p className="mt-2 text-pretty text-sm leading-6 text-on-surface-variant">
              {milestone.text}
            </p>
          </div>
        </li>
      ))}
    </ol>
  </section>
);

export default function AboutPage() {
  return (
    <PublicContentLayout>
      <section className="px-6 pb-8 pt-8 text-center sm:pb-10 sm:pt-10">
        <p className="mb-3 text-label-sm font-semibold uppercase tracking-[0.18em] text-secondary">
          Về Handigo
        </p>
        <h1 className="mx-auto max-w-4xl text-balance font-headline-xl text-4xl font-bold leading-tight tracking-[-0.02em] text-on-surface sm:text-5xl">
          Nâng tầm chất lượng cuộc sống Việt
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-8 text-on-surface-variant">
          Chúng tôi kết nối dịch vụ gia đình thông minh, nhanh chóng và đáng tin
          cậy để bạn dành thời gian cho những điều quan trọng hơn.
        </p>
      </section>

      <AboutIntro />
      <CoreValues />
      <AboutStats />
      <Leadership />
      <Timeline />
    </PublicContentLayout>
  );
}
