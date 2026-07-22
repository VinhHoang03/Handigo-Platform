import { StatItem } from "./HomeCards";
import { stats } from "@/features/home/data/homeData";

/**
 * Dải số liệu nền primary — điểm nhấn màu duy nhất cắt ngang trang.
 * Cam kết hẳn một khối đặc thay vì chắp vá gradient/blob, và dùng token
 * `on-primary` thay cho màu trắng cứng để đổi theme không bị vỡ.
 */
export const StatsSection = () => (
  <section
    aria-label="Số liệu hoạt động của Handigo"
    className="mt-lg bg-primary py-lg text-on-primary"
  >
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:grid-cols-3 md:px-8">
      {stats.map((stat) => (
        <StatItem key={stat.label} {...stat} />
      ))}
    </div>
  </section>
);
