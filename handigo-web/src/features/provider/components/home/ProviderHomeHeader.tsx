import { Link } from "react-router-dom";
import { Banknote, Zap } from "lucide-react";

interface ProviderHomeHeaderProps {
  fullName: string;
  activeOrders: number | null;
}

export function ProviderHomeHeader({
  fullName,
  activeOrders,
}: ProviderHomeHeaderProps) {
  return (
    <section className="flex flex-col justify-between gap-md md:flex-row md:items-end">
      <div>
        <h2 className="font-headline-lg text-headline-lg text-primary">
          Xin chào, {fullName}!
        </h2>
        <p className="text-body-lg text-on-surface-variant">
          Chúc bạn một ngày làm việc hiệu quả.
          {activeOrders !== null && ` Bạn đang thực hiện ${activeOrders} đơn.`}
        </p>
      </div>
      <div className="flex flex-wrap gap-sm">
        <Link
          to="/provider/orders"
          className="flex items-center gap-base rounded-xl bg-primary px-md py-sm font-label-md text-on-primary shadow-md transition-all hover:scale-105"
        >
          <Zap aria-hidden="true" size={24} />
          Xem đơn mới
        </Link>
        <Link
          to="/provider/wallet"
          className="flex items-center gap-base rounded-xl bg-surface-container-high px-md py-sm font-label-md text-primary transition-all hover:bg-primary-fixed"
        >
          <Banknote aria-hidden="true" size={24} />
          Rút tiền
        </Link>
      </div>
    </section>
  );
}
