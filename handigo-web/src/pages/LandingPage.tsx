import {
  CategoriesSection,
  ClosingCta,
  FeaturesSection,
  HeroSection,
  HomeFooter,
  HowItWorksSection,
  ProvidersSection,
  TestimonialsSection,
  TrustStrip,
} from "../components/home";
import { Navbar } from "../components/common/Navbar";
import { Reveal } from "../components/common/Reveal";
import { useCategoryShowcase } from "@/features/home/hooks/useCategoryShowcase";
import { AnimatedBackground } from "../components/home/AnimatedBackground";

/**
 * Tìm kiếm là trọng tâm đầu trang; ảnh dịch vụ nằm trong danh mục bên dưới.
 *
 * Hai section phụ thuộc dữ liệu (thợ, đánh giá) tự ẩn khi chưa đủ nội dung đạt
 * chuẩn — thà mất một section còn hơn hiện một danh sách nghèo nàn.
 *
 * Hero không bọc `Reveal`: nội dung đầu trang phải thấy được ngay.
 */
const LandingPage = () => {
  const { items, loading } = useCategoryShowcase();

  return (
    <div className="relative isolate min-h-dvh text-on-surface selection:bg-primary-container selection:text-on-primary-container">
      <AnimatedBackground />
      <Navbar />
      <main id="main-content" className="pb-12 pt-28 md:pt-32">
        <HeroSection items={items} />
        <TrustStrip />
        <Reveal>
          <CategoriesSection items={items} loading={loading} />
        </Reveal>
        <Reveal>
          <HowItWorksSection />
        </Reveal>
        <Reveal>
          <ProvidersSection />
        </Reveal>
        <Reveal>
          <FeaturesSection />
        </Reveal>
        <Reveal>
          <TestimonialsSection />
        </Reveal>
        <Reveal>
          <ClosingCta />
        </Reveal>
      </main>
      <HomeFooter transparent />
    </div>
  );
};

export default LandingPage;
