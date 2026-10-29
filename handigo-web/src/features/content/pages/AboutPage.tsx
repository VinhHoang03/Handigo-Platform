import { PublicContentLayout } from "../components/PublicContentLayout";
import { AboutHero } from "../components/AboutHero";
import { AboutValues } from "../components/AboutValues";
import { AboutTimeline } from "../components/AboutTimeline";
import { Reveal } from "@/components/common/Reveal";
import "../components/about-page.css";

/**
 * Phần "Chúng tôi là ai?" trước đây là bốn đoạn văn dài bị nhồi vào một cột hẹp
 * cạnh ảnh minh hoạ do AI sinh, host trên CDN Google. Ảnh đã gỡ; nội dung nay
 * dàn thành bố cục biên tập: câu dẫn cỡ lớn, phần còn lại chia hai cột lệch.
 */
const AboutIntro = () => (
  <section
    id="cau-chuyen-handigo"
    aria-labelledby="about-intro-heading"
    className="about-intro mx-auto grid max-w-7xl gap-x-16 gap-y-8 px-6 py-16 lg:grid-cols-12 lg:py-24"
  >
    <div className="lg:col-span-4">
      <p className="about-section-index">01 / Chúng tôi là ai</p>
      <h2
        id="about-intro-heading"
        className="mt-4 text-balance font-headline-lg text-3xl font-bold tracking-[-0.03em] text-on-surface sm:text-4xl"
      >
        Một điểm chạm tin cậy cho mọi nhu cầu trong nhà
      </h2>
    </div>

    <div className="lg:col-span-8 lg:pt-9">
      <p className="max-w-[48ch] text-pretty text-xl font-medium leading-9 text-on-surface sm:text-2xl sm:leading-10">
        Handigo là nền tảng kết nối khách hàng với các chuyên gia dịch vụ uy tín,
        giúp việc tìm kiếm và đặt lịch dịch vụ gia đình trở nên nhanh chóng, minh
        bạch và thuận tiện hơn.
      </p>

      <div className="mt-10 grid gap-x-10 gap-y-6 border-t border-outline-variant/50 pt-8 text-pretty leading-8 text-on-surface-variant md:grid-cols-2">
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
        <p className="md:col-span-2 md:max-w-[72ch]">
          Chúng tôi tin rằng minh bạch, chất lượng và uy tín là nền tảng để xây
          dựng niềm tin lâu dài, đồng hành cùng khách hàng trong việc chăm sóc
          ngôi nhà và hỗ trợ nhà cung cấp phát triển sự nghiệp.
        </p>
      </div>
    </div>
  </section>
);

export default function AboutPage() {
  return (
    <PublicContentLayout>
      <AboutHero />
      <Reveal><AboutIntro /></Reveal>
      <Reveal><AboutValues /></Reveal>
      <Reveal><AboutTimeline /></Reveal>
    </PublicContentLayout>
  );
}
