import { formatMoney } from "./providerHome.utils";

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-md rounded-3xl border border-outline-variant bg-surface-container-lowest p-md transition-transform hover:-translate-y-1">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}
      >
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
          {label}
        </p>
        <p className="text-headline-md font-bold text-on-surface tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}

interface ProviderHomeStatsProps {
  totalOrders: number;
  activeOrders: number;
  todayIncome: number;
  /** `null` khi chưa tải xong hồ sơ. */
  rating: { average: number; total: number } | null;
}

/**
 * Thẻ "Đánh giá" trước đây viết cứng `4.9/5`, nên thợ vừa đăng ký và chưa có
 * đơn nào cũng thấy 4.9/5. Nay lấy từ `averageRating`/`totalFeedbacks` thật và
 * nói rõ khi chưa có đánh giá nào.
 */
const ratingValue = (rating: { average: number; total: number } | null) => {
  if (!rating) return "...";
  if (!rating.total) return "Chưa có";
  return `${rating.average.toFixed(1)}/5`;
};

export function ProviderHomeStats({
  totalOrders,
  activeOrders,
  todayIncome,
  rating,
}: ProviderHomeStatsProps) {
  return (
    <section className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon="inventory"
        label="Tổng số đơn"
        value={String(totalOrders)}
        tone="bg-primary-container/20 text-primary"
      />
      <StatCard
        icon="pending_actions"
        label="Đang thực hiện"
        value={String(activeOrders)}
        tone="bg-secondary-container/30 text-secondary"
      />
      <StatCard
        icon="monetization_on"
        label="Thu nhập gần đây"
        value={formatMoney(todayIncome)}
        tone="bg-secondary/10 text-secondary"
      />
      <StatCard
        icon="star"
        label="Đánh giá"
        value={ratingValue(rating)}
        tone="bg-tertiary-fixed/30 text-tertiary"
      />
    </section>
  );
}
