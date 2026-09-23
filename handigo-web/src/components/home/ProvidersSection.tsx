import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "../common/SectionHeader";
import { ProviderCard } from "./HomeCards";
import { HomeEmptyState, ProviderCardSkeleton } from "./HomeSkeletons";
import { useAutoScrollCarousel } from "./useAutoScrollCarousel";
import { homeApi, type FeaturedProvider } from "@/features/home/api/home.api";

const CARD_WIDTH = "w-[220px] shrink-0 sm:w-[235px] lg:w-[250px]";

/** Tên seed dạng `Provider01`: tài khoản dựng để test, không phải người thật. */
const PLACEHOLDER_NAME = /^provider\s*\d+$/i;

/** Dưới ngưỡng này thì thà ẩn cả section còn hơn hiện một danh sách nghèo nàn. */
const MIN_PROVIDERS = 3;

export const ProvidersSection = () => {
  const [providers, setProviders] = useState<FeaturedProvider[]>([]);
  const [loading, setLoading] = useState(true);

  // Lọc ở tầng hiển thị, không đụng API: đây là quyết định về việc trang chủ nên
  // giới thiệu ai, không phải thay đổi dữ liệu.
  const visibleProviders = useMemo(
    () =>
      providers.filter(
        (provider) =>
          provider.user.fullName?.trim() &&
          !PLACEHOLDER_NAME.test(provider.user.fullName.trim()),
      ),
    [providers],
  );

  const {
    carouselRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClickCapture,
  } = useAutoScrollCarousel(visibleProviders.length);

  useEffect(() => {
    homeApi
      .featuredProviders()
      .then(setProviders)
      .catch(() => setProviders([]))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && visibleProviders.length < MIN_PROVIDERS) return null;

  return (
    <section
      aria-labelledby="providers-heading"
      className="mt-lg bg-surface-container-low/60 py-lg"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeader
          id="providers-heading"
          title="Thợ trong hệ thống"
          description="Hồ sơ đã qua kiểm duyệt, xem được trước khi đặt"
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
        ) : visibleProviders.length ? (
          // Dải mờ hai mép cho thấy danh sách còn kéo được, thay vì để thẻ cuối
          // bị cắt cụt trông như lỗi bố cục.
          <div className="relative [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
            <div
              ref={carouselRef}
              role="region"
              aria-label="Danh sách thợ trong hệ thống"
              className="flex cursor-grab touch-pan-y snap-x snap-mandatory select-none gap-4 overflow-x-auto pb-3 active:cursor-grabbing md:gap-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onClickCapture={onClickCapture}
            >
              {[0, 1, 2].flatMap((cycle) =>
                visibleProviders.slice(0, 12).map((provider, index) => (
                  <div
                    key={`${cycle}-${provider.id}`}
                    data-cycle-start={
                      cycle === 1 && index === 0 ? "true" : undefined
                    }
                    className={`${CARD_WIDTH} snap-start`}
                    aria-hidden={cycle !== 1}
                  >
                    <ProviderCard
                      name={provider.user.fullName}
                      img={provider.user.avatar}
                      rating={provider.averageRating}
                      totalFeedbacks={provider.totalFeedbacks}
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
          </div>
        ) : (
          <HomeEmptyState message="Chưa có thợ phù hợp để hiển thị." />
        )}
      </div>
    </section>
  );
};
