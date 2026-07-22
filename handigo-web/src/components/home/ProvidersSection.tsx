import { useEffect, useState } from "react";
import { SectionHeader } from "../common/SectionHeader";
import { ProviderCard } from "./HomeCards";
import { HomeEmptyState, ProviderCardSkeleton } from "./HomeSkeletons";
import { useAutoScrollCarousel } from "./useAutoScrollCarousel";
import { homeApi, type FeaturedProvider } from "@/features/home/api/home.api";

const CARD_WIDTH = "w-[220px] shrink-0 sm:w-[235px] lg:w-[250px]";

export const ProvidersSection = () => {
  const [providers, setProviders] = useState<FeaturedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const {
    carouselRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClickCapture,
  } = useAutoScrollCarousel(providers.length);

  useEffect(() => {
    homeApi
      .featuredProviders()
      .then(setProviders)
      .catch(() => setProviders([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section
      aria-labelledby="providers-heading"
      className="mt-lg bg-surface-container-low/60 py-lg"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeader
          id="providers-heading"
          title="Thợ chuyên nghiệp trong hệ thống"
          description="Các thợ có điểm đánh giá cao và hồ sơ đã được xác minh"
          centered
        />

        {loading ? (
          <div className="flex gap-4 overflow-hidden md:gap-5">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className={CARD_WIDTH}>
                <ProviderCardSkeleton />
              </div>
            ))}
          </div>
        ) : providers.length ? (
          <div
            ref={carouselRef}
            role="region"
            aria-label="Danh sách thợ nổi bật"
            className="relative flex cursor-grab touch-pan-y select-none gap-4 overflow-x-auto pb-3 active:cursor-grabbing md:gap-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onClickCapture={onClickCapture}
          >
            {[0, 1, 2].flatMap((cycle) =>
              providers.slice(0, 12).map((provider, index) => (
                <div
                  key={`${cycle}-${provider.id}`}
                  data-cycle-start={
                    cycle === 1 && index === 0 ? "true" : undefined
                  }
                  className={CARD_WIDTH}
                  aria-hidden={cycle !== 1}
                >
                  <ProviderCard
                    name={provider.user.fullName}
                    img={provider.user.avatar}
                    rating={provider.averageRating}
                    services={provider.services.map((service) => service.name)}
                    area={
                      provider.workingAreas.join(", ") ||
                      [
                        provider.serviceArea?.ward,
                        provider.serviceArea?.province,
                      ]
                        .filter(Boolean)
                        .join(", ")
                    }
                  />
                </div>
              )),
            )}
          </div>
        ) : (
          <HomeEmptyState message="Chưa có thợ phù hợp để hiển thị." />
        )}
      </div>
    </section>
  );
};
