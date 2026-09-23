import React from "react";
import type { PerformanceStat } from "../../types/provider.types";

export const PerformanceStats: React.FC<{ stats: PerformanceStat[] }> = ({
  stats,
}) => (
  <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
    {stats.map((stat) => (
      <div
        key={stat.label}
        className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm transition-shadow hover:shadow-md md:p-6"
      >
        <p className="mb-2 text-xs font-bold uppercase tracking-tight text-on-surface-variant">
          {stat.label}
        </p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-bold text-primary">{stat.value}</h3>
          <span
            className={`text-[10px] font-bold ${
              stat.tone === "warning" ? "text-tertiary" : "text-secondary"
            }`}
          >
            {stat.meta}
          </span>
        </div>
      </div>
    ))}
  </section>
);
