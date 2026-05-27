import { SectionHeader } from '../common/SectionHeader';
import { MaterialIcon } from '../common/MaterialIcon';
import { CategoryCard, FeatureCard, ProviderCard, StatItem, TestimonialCard } from './HomeCards';
import { categories, features, providers, stats, testimonials } from './homeData';

export const CategoriesSection = () => (
  <section className="max-w-7xl mx-auto px-4 md:px-8 mt-xl">
    <SectionHeader
      title="Danh Mục Dịch Vụ"
      description="Mọi vấn đề gia đình của bạn đều có chuyên gia của chúng tôi"
      action={<button className="flex items-center gap-2 text-primary font-label-md text-label-md hover:underline w-fit">Xem tất cả <MaterialIcon>arrow_forward</MaterialIcon></button>}
    />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {categories.map((category) => <CategoryCard key={category.title} {...category} />)}
    </div>
  </section>
);

export const ProvidersSection = () => (
  <section className="bg-surface-container-low/50 py-xl mt-xl">
    <div className="max-w-7xl mx-auto px-4 md:px-8">
      <SectionHeader title="Thợ Chuyên Nghiệp Đang Online" description="Những người thợ xuất sắc nhất luôn sẵn sàng giúp đỡ bạn" centered />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {providers.map((provider) => <ProviderCard key={provider.name} {...provider} />)}
      </div>
    </div>
  </section>
);

export const FeaturesSection = () => (
  <section className="max-w-7xl mx-auto px-4 md:px-8 mt-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
    {features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
  </section>
);

export const StatsSection = () => (
  <section className="mt-xl bg-primary py-lg overflow-hidden relative">
    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
    <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-white text-center">
      {stats.map((stat) => <StatItem key={stat.label} {...stat} />)}
    </div>
  </section>
);

export const TestimonialsSection = () => (
  <section className="max-w-7xl mx-auto px-4 md:px-8 mt-xl">
    <SectionHeader title="Đánh Giá Từ Khách Hàng" centered />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
      {testimonials.map((testimonial) => <TestimonialCard key={testimonial.name} {...testimonial} />)}
    </div>
  </section>
);
