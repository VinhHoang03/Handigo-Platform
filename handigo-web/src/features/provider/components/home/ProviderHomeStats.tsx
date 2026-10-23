import { formatMoney } from "./providerHome.utils";
import type { LucideIcon } from "lucide-react";
import { CircleDollarSign, ClipboardClock, Package, Star } from "lucide-react";
function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-md rounded-3xl border border-outline-variant bg-surface-container-lowest p-md transition-transform hover:-translate-y-1">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}
      >
        <Icon aria-hidden="true" size={24} />
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
  totalOrders: number | null;
  activeOrders: number | null;
  monthlyIncome: number | null;
  isLoadingIncome: boolean;
  incomeError: string | null;
  isLoadingOrders: boolean;
  isLoadingActiveOrders: boolean;
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
  monthlyIncome,
  isLoadingIncome,
  incomeError,
  isLoadingOrders,
  isLoadingActiveOrders,
  rating,
}: ProviderHomeStatsProps) {
  return (
    <section className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Package}
        label="Tổng số đơn"
        value={totalOrders !== null ? String(totalOrders) : isLoadingOrders ? "Đang tải…" : "Chưa tải được"}
        tone="bg-primary-container/20 text-primary"
      />
      <StatCard
        icon={ClipboardClock}
        label="Đang thực hiện"
        value={activeOrders !== null ? String(activeOrders) : isLoadingActiveOrders ? "Đang tải…" : "Chưa tải được"}
        tone="bg-secondary-container/30 text-secondary"
      />
      <StatCard
        icon={CircleDollarSign}
        label="Thu nhập tháng này"
        value={isLoadingIncome ? "Đang tải…" : incomeError || monthlyIncome === null ? "Chưa tải được" : formatMoney(monthlyIncome)}
        tone="bg-secondary/10 text-secondary"
      />
      <StatCard
        icon={Star}
        label="Đánh giá"
        value={ratingValue(rating)}
        tone="bg-tertiary-fixed/30 text-tertiary"
      />
    </section>
  );
}
