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

/**
 * Tám section, tám khuôn bố cục khác nhau: chia đôi bất đối xứng → dải ngang →
 * lưới bento → chuỗi bước → carousel → editorial hai cột → trích dẫn 1 lớn 2 nhỏ
 * → dải CTA. Trước đây bốn section liên tiếp cùng dùng khuôn "lưới thẻ trắng".
 *
 * Hai section phụ thuộc dữ liệu (thợ, đánh giá) tự ẩn khi chưa đủ nội dung đạt
 * chuẩn — thà mất một section còn hơn hiện một danh sách nghèo nàn.
 *
 * Hero không bọc `Reveal`: nội dung đầu trang phải thấy được ngay.
 */
const LandingPage = () => {
  const { items, loading } = useCategoryShowcase();
  const heroImage = items.find((item) => item.image);

  return (
    <div className="min-h-dvh bg-surface text-on-surface selection:bg-primary-container selection:text-on-primary-container">
      <Navbar />
      <main id="main-content" className="pb-xl pt-32">
        <HeroSection
          image={heroImage?.image}
          imageAlt={
            heroImage ? `Thợ Handigo làm dịch vụ ${heroImage.name}` : undefined
          }
        />
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
      <HomeFooter />
    </div>
  );
};

export default LandingPage;
