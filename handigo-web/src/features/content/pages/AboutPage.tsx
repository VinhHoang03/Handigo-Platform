import { PublicContentLayout } from "../components/PublicContentLayout";
import { AboutHero } from "../components/AboutHero";
import { AboutValues } from "../components/AboutValues";
import { AboutTimeline } from "../components/AboutTimeline";
import { useCategoryShowcase } from "@/features/home/hooks/useCategoryShowcase";

/**
 * Phần "Chúng tôi là ai?" trước đây là bốn đoạn văn dài bị nhồi vào một cột hẹp
 * cạnh ảnh minh hoạ do AI sinh, host trên CDN Google. Ảnh đã gỡ; nội dung nay
 * dàn thành bố cục biên tập: câu dẫn cỡ lớn, phần còn lại chia hai cột lệch.
 */
const AboutIntro = () => (
  <section
    aria-labelledby="about-intro-heading"
    className="mx-auto grid max-w-7xl gap-x-14 gap-y-6 px-6 pb-12 pt-4 lg:grid-cols-12"
  >
    <h2
      id="about-intro-heading"
      className="font-headline-lg text-3xl font-bold tracking-[-0.02em] text-on-surface lg:col-span-4"
    >
      Chúng tôi là ai?
    </h2>

    <div className="lg:col-span-8">
      <p className="max-w-[46ch] text-pretty text-xl leading-9 text-on-surface">
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
          dựng niềm tin lâu dài, đồng hành cùng khách hàng trong việc chăm sóc
          ngôi nhà và hỗ trợ nhà cung cấp phát triển sự nghiệp.
        </p>
      </div>
    </div>
  </section>
);

export default function AboutPage() {
  const { items } = useCategoryShowcase();
  // Bỏ qua danh mục đầu: ảnh đó đã dùng ở hero trang chủ, dùng lại ở đây thì hai
  // trang liền kề trong nav mở ra cùng một tấm hình.
  const illustrated = items.filter((item) => item.image).slice(1);

  return (
    <PublicContentLayout>
      <AboutHero
        image={illustrated[0]?.image}
        imageAlt={
          illustrated[0]
            ? `Thợ Handigo làm dịch vụ ${illustrated[0].name}`
            : undefined
        }
      />
      <AboutIntro />
      <AboutValues />
      <AboutTimeline
        image={illustrated[1]?.image}
        imageAlt={
          illustrated[1]
            ? `Thợ Handigo làm dịch vụ ${illustrated[1].name}`
            : undefined
        }
      />
    </PublicContentLayout>
  );
}
