import { SectionHeader } from "../common/SectionHeader";
import { FeatureCard } from "./HomeCards";
import { features } from "@/features/home/data/homeData";

/**
 * Bố cục 2 cột chia bằng đường kẻ mảnh thay cho hàng thẻ đều nhau —
 * dùng khoảng trắng để phân cấp thay vì viền + đổ bóng.
 */
export const FeaturesSection = () => (
  <section
    aria-labelledby="features-heading"
    className="mx-auto mt-lg max-w-7xl px-4 md:px-8"
  >
    <SectionHeader
      id="features-heading"
      title="Vì sao chọn Handigo"
      description="Những điều chúng tôi cam kết trong mỗi lần bạn đặt dịch vụ"
    />

    <div className="grid grid-cols-1 gap-x-16 border-t border-outline-variant/50 md:grid-cols-2">
      {features.map((feature) => (
        <FeatureCard key={feature.title} {...feature} />
      ))}
    </div>
  </section>
);
