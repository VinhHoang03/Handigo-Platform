import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeader } from '../common/SectionHeader';
import { MaterialIcon } from '../common/MaterialIcon';
import { CategoryCard, FeatureCard, ProviderCard, StatItem, TestimonialCard } from './HomeCards';
import { features, stats } from './homeData';
import { homeApi, type FeaturedProvider, type LatestFeedback } from './home.api';
import { customerServiceApi } from '@/features/customer-service/api/customerService.api';
import type { Category } from '@/types/booking';

export const CategoriesSection = () => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    customerServiceApi.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  return (
    <section className="mx-auto mt-lg max-w-7xl px-4 md:px-8">
      <SectionHeader
        title="Danh mục dịch vụ"
        description="Mọi vấn đề trong gia đình đều có chuyên gia phù hợp hỗ trợ bạn"
        action={<Link to="/customer/services" className="flex w-fit items-center gap-2 font-label-md text-label-md text-primary hover:underline">Xem tất cả <MaterialIcon>arrow_forward</MaterialIcon></Link>}
      />
      <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
        {categories.slice(0, 8).map((category, index) => (
          <CategoryCard
            key={category._id}
            icon={category.icon || 'category'}
            imageUrl={category.image || (/^https?:\/\//i.test(category.icon || '') ? category.icon : undefined)}
            title={category.name}
            desc={category.description || 'Xem các dịch vụ phù hợp trong danh mục'}
            color={['primary', 'secondary', 'tertiary'][index % 3]}
            to={`/customer/services?categoryId=${category._id}`}
          />
        ))}
      </div>
    </section>
  );
};

export const ProvidersSection = () => {
  const [providers, setProviders] = useState<FeaturedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ active: false, startX: 0, lastX: 0, lastTime: 0, moved: false });
  const velocityRef = useRef(0);

  useEffect(() => {
    homeApi.featuredProviders()
      .then(setProviders)
      .catch(() => setProviders([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || providers.length === 0) return;

    let animationFrame = 0;
    let previousTime = performance.now();
    const initializeFrame = requestAnimationFrame(() => {
      const cycleStart = carousel.querySelector<HTMLElement>('[data-cycle-start="true"]');
      if (cycleStart) carousel.scrollLeft = cycleStart.offsetLeft;
    });

    const animate = (time: number) => {
      const elapsed = Math.min(time - previousTime, 32);
      previousTime = time;
      const cycleStart = carousel.querySelector<HTMLElement>('[data-cycle-start="true"]');
      const cycleWidth = cycleStart?.offsetLeft || 0;

      if (!dragState.current.active) {
        carousel.scrollLeft += 0.025 * elapsed + velocityRef.current * elapsed;
        velocityRef.current *= Math.pow(0.94, elapsed / 16.67);
        if (Math.abs(velocityRef.current) < 0.01) velocityRef.current = 0;
      }

      if (cycleWidth > 0) {
        if (carousel.scrollLeft >= cycleWidth * 2) carousel.scrollLeft -= cycleWidth;
        if (carousel.scrollLeft < cycleWidth * 0.5) carousel.scrollLeft += cycleWidth;
      }
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(initializeFrame);
      cancelAnimationFrame(animationFrame);
    };
  }, [providers]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    dragState.current = { active: true, startX: event.clientX, lastX: event.clientX, lastTime: performance.now(), moved: false };
    velocityRef.current = 0;
    carousel.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const carousel = carouselRef.current;
    if (!carousel || !dragState.current.active) return;
    const now = performance.now();
    const distance = event.clientX - dragState.current.lastX;
    const elapsed = Math.max(now - dragState.current.lastTime, 1);
    if (Math.abs(event.clientX - dragState.current.startX) > 5) dragState.current.moved = true;
    carousel.scrollLeft -= distance;
    velocityRef.current = -distance / elapsed;
    dragState.current.lastX = event.clientX;
    dragState.current.lastTime = now;
  };

  const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragState.current.active = false;
    if (carouselRef.current?.hasPointerCapture(event.pointerId)) {
      carouselRef.current.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section className="mt-lg bg-surface-container-low/50 py-lg">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeader title="Thợ chuyên nghiệp trong hệ thống" description="Các thợ có điểm đánh giá cao và hồ sơ đã được xác minh" centered />
        {loading ? (
          <p className="text-center text-on-surface-variant">Đang tải danh sách thợ...</p>
        ) : providers.length ? (
          <div
            ref={carouselRef}
            role="region"
            aria-label="Danh sách thợ nổi bật"
            className="relative flex cursor-grab touch-pan-y select-none gap-4 overflow-x-auto pb-3 active:cursor-grabbing md:gap-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onClickCapture={(event) => {
              if (dragState.current.moved) {
                event.preventDefault();
                event.stopPropagation();
                dragState.current.moved = false;
              }
            }}
          >
            {[0, 1, 2].flatMap((cycle) => providers.slice(0, 12).map((provider, index) => (
              <div
                key={`${cycle}-${provider.id}`}
                data-cycle-start={cycle === 1 && index === 0 ? 'true' : undefined}
                className="w-[220px] shrink-0 sm:w-[235px] lg:w-[250px]"
              >
                <ProviderCard
                  name={provider.user.fullName}
                  img={provider.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(provider.user.fullName)}&background=4f46e5&color=fff`}
                  rating={provider.averageRating}
                  services={provider.services.map((service) => service.name)}
                  area={provider.workingAreas.join(', ') || [provider.serviceArea?.ward, provider.serviceArea?.province].filter(Boolean).join(', ')}
                />
              </div>
            )))}
          </div>
        ) : <p className="text-center text-on-surface-variant">Chưa có thợ phù hợp để hiển thị.</p>}
      </div>
    </section>
  );
};

export const FeaturesSection = () => (
  <section className="mx-auto mt-lg grid max-w-7xl grid-cols-1 gap-6 px-4 md:grid-cols-2 md:gap-8 md:px-8 lg:grid-cols-4">
    {features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
  </section>
);

export const StatsSection = () => (
  <section className="relative mt-lg overflow-hidden bg-primary py-lg">
    <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 text-center text-white md:grid-cols-3 md:px-8">
      {stats.map((stat) => <StatItem key={stat.label} {...stat} />)}
    </div>
  </section>
);

export const TestimonialsSection = () => {
  const [feedbacks, setFeedbacks] = useState<LatestFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    homeApi.latestFeedbacks()
      .then(setFeedbacks)
      .catch(() => setFeedbacks([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="mx-auto mt-lg max-w-7xl px-4 md:px-8">
      <SectionHeader title="Đánh giá từ khách hàng" centered />
      {loading ? (
        <p className="text-center text-on-surface-variant">Đang tải đánh giá...</p>
      ) : feedbacks.length ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {feedbacks.map((feedback) => {
            const serviceName = feedback.serviceId?.name || 'Dịch vụ tại nhà';
            const comment = feedback.comment?.trim();
            const customerName = feedback.customerId?.fullName || 'Khách hàng';

            return (
              <TestimonialCard
                key={feedback._id}
                quote={comment || undefined}
                name={customerName}
                loc={serviceName}
                img={feedback.customerId?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(customerName)}&background=4f46e5&color=fff`}
                rating={feedback.rating}
                providerReply={feedback.providerReply?.content}
              />
            );
          })}
        </div>
      ) : (
        <p className="text-center text-on-surface-variant">Chưa có đánh giá để hiển thị.</p>
      )}
    </section>
  );
};
