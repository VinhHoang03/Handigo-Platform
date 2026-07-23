import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Ban,
  ClipboardList,
  PiggyBank,
  Star,
  UserRoundCheck,
  WalletCards,
  Wallet,
} from "lucide-react";
import { chartMoney, chartNumber } from "@/components/common/chart";
import type {
  AdminOrderAnalytics,
  AdminOverview,
  AdminProviderAnalytics,
} from "../../types/adminOperations.types";

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="rounded-2xl border border-outline-variant/40 bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon size={21} />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-on-surface-variant">{label}</p>
          <p className="mt-1 text-headline-md font-bold tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{note}</p>
        </div>
      </div>
    </article>
  );
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

/**
 * Tám chỉ số chia hai hàng bốn cột. Bốn thẻ hàng dưới lấy từ các trường backend
 * đã trả về nhưng trước đây UI không hiển thị ở đâu.
 */
export function DashboardMetricGrid({
  overview,
  orders,
  providers,
}: {
  overview: AdminOverview;
  orders: AdminOrderAnalytics;
  providers: AdminProviderAnalytics;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={WalletCards}
        label="Tổng doanh thu"
        value={chartMoney.format(overview.totalRevenue)}
        note={`Doanh thu nền tảng ${chartMoney.format(overview.platformRevenue)}`}
      />
      <MetricCard
        icon={ClipboardList}
        label="Tổng đơn"
        value={chartNumber.format(overview.totalOrders)}
        note={`${overview.completedOrders} hoàn thành · ${overview.cancelledOrders} đã hủy`}
      />
      <MetricCard
        icon={UserRoundCheck}
        label="Provider đang hoạt động"
        value={chartNumber.format(providers.activeProviders)}
        note={`${providers.onlineProviders} đang trực tuyến / ${providers.totalProviders} hồ sơ`}
      />
      <MetricCard
        icon={Activity}
        label="Yêu cầu rút đang chờ"
        value={chartNumber.format(overview.pendingWithdrawals)}
        note={chartMoney.format(overview.pendingWithdrawalAmount)}
      />
      <MetricCard
        icon={Ban}
        label="Tỷ lệ hủy đơn"
        value={percent(orders.cancellationRate)}
        note={`Tỷ lệ hoàn thành ${percent(orders.completionRate)}`}
      />
      <MetricCard
        icon={Star}
        label="Điểm provider trung bình"
        value={providers.averageProviderRating.toFixed(2)}
        note={`Trên ${providers.totalProviders} hồ sơ provider`}
      />
      <MetricCard
        icon={PiggyBank}
        label="Thu nhập provider"
        value={chartMoney.format(overview.providerEarnings)}
        note={`Đã rút ${chartMoney.format(overview.totalWithdrawals)}`}
      />
      <MetricCard
        icon={Wallet}
        label="Tổng nạp ví"
        value={chartMoney.format(overview.totalDeposits)}
        note="Tiền khách nạp vào ví trong kỳ"
      />
    </section>
  );
}
