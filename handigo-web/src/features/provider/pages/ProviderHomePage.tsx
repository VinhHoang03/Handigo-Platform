import { DashboardShell } from "@/components/common/DashboardShell";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { ProviderHomeHeader } from "../components/home/ProviderHomeHeader";
import { ProviderHomeStats } from "../components/home/ProviderHomeStats";
import { ProviderRevenueChart } from "../components/home/ProviderRevenueChart";
import { ProviderRecentBookings } from "../components/home/ProviderRecentBookings";
import { ProviderTodaySchedule } from "../components/home/ProviderTodaySchedule";
import { ProviderWorkingAreasCard } from "../components/home/ProviderWorkingAreasCard";
import { useProviderHomeData } from "../components/home/useProviderHomeData";

const ProviderHomePage = () => {
  const user = useAuthStore((state) => state.user);
  const data = useProviderHomeData();

  return (
    <DashboardShell role="PROVIDER">
      <div className="space-y-gutter">
        <ProviderHomeHeader
          firstName={user?.fullName?.split(" ")[0] || "Provider"}
          activeOrders={data.activeOrders}
        />

        <ProviderHomeStats
          totalOrders={data.totalOrders}
          activeOrders={data.activeOrders}
          todayIncome={data.todayIncome}
        />

        <section className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
          <div className="space-y-gutter lg:col-span-8">
            <ProviderRevenueChart
              revenuePeriod={data.revenuePeriod}
              onPeriodChange={data.setRevenuePeriod}
              isLoadingEarnings={data.isLoadingEarnings}
              earningsError={data.earningsError}
              revenueChart={data.revenueChart}
              maxRevenue={data.maxRevenue}
              revenueTotal={data.revenueTotal}
              revenueLabel={data.revenueRange.label}
            />

            <ProviderRecentBookings
              recentOrders={data.recentOrders}
              isLoadingOrders={data.isLoadingOrders}
              ordersError={data.ordersError}
            />
          </div>

          <div className="space-y-gutter lg:col-span-4">
            <ProviderTodaySchedule
              todaySchedule={data.todaySchedule}
              isLoadingSchedule={data.isLoadingSchedule}
              scheduleError={data.scheduleError}
            />

            <ProviderWorkingAreasCard
              workingAreas={data.workingAreas}
              isLoadingAreas={data.isLoadingAreas}
              areasError={data.areasError}
            />
          </div>
        </section>
      </div>
    </DashboardShell>
  );
};

export default ProviderHomePage;
