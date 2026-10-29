import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { previousRevenueRange } from "./revenue-period";
import { RevenueOperationsInsights } from "./RevenueOperationsInsights";
import type { RevenueQuery } from "../../types/adminRevenue.types";

export function DashboardRevenueSection({ range }: { range: RevenueQuery }) {
  const { hash } = useLocation();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (hash === "#admin-revenue") sectionRef.current?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <section ref={sectionRef} id="admin-revenue" aria-label="Phân tích doanh thu và dòng tiền" className="min-w-0 scroll-mt-28 space-y-5">
      <RevenueOperationsInsights range={range} monthly={previousRevenueRange(range).monthly} />
    </section>
  );
}
