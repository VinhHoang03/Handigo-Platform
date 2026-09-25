import { Copy, Ticket } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/common/Toast";
import type { RewardVoucher } from "../api/rewards.api";

import { rewardMoney, rewardDate } from "../rewardFormat";

export function RewardVoucherCard({ voucher }: { voucher: RewardVoucher }) {
  const { addToast } = useToast();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const expired = new Date(voucher.endAt).getTime() < now;
  const inactive = !voucher.isActive || ["INACTIVE", "EXPIRED"].includes(voucher.status.toUpperCase());
  const used = voucher.usedCount > 0;
  const available = !used && !expired && !inactive;
  const copy = async () => {
    try { await navigator.clipboard.writeText(voucher.code); addToast("Đã sao chép mã giảm giá.", "success"); }
    catch { addToast("Chưa sao chép được. Bạn có thể chọn và sao chép mã bên dưới.", "error"); }
  };
  return (
    <article className="flex flex-col rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${available ? "bg-primary-fixed text-on-primary-fixed-variant" : "bg-surface-container text-on-surface-variant"}`}>
          {used ? "Đã sử dụng" : expired ? "Hết hạn" : inactive ? "Ngừng áp dụng" : voucher.reservedOrderId ? "Đang giữ cho đơn" : "Sẵn sàng sử dụng"}
        </span>
        <Ticket aria-hidden="true" size={22} className="text-primary" />
      </div>
      <h3 className="mt-5 text-lg font-bold text-on-surface">{voucher.name}</h3>
      <p className="mt-2 text-[13px] leading-6 text-on-surface-variant">Đơn giá cố định từ {rewardMoney(voucher.minOrderAmount)}. Dùng một lần cho tài khoản của bạn.</p>
      <div className="my-5 flex items-center gap-2 rounded-xl bg-surface-container-low p-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs text-on-surface-variant">Mã ưu đãi</p>
          <code className="block break-all text-[13px] font-bold text-primary select-all">{voucher.code}</code>
        </div>
        <button type="button" onClick={() => void copy()} aria-label={`Sao chép mã ${voucher.code}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-primary hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-primary"><Copy aria-hidden="true" size={18} /></button>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-outline-variant pt-4">
        <p className="text-xs text-on-surface-variant">Hạn dùng: {rewardDate(voucher.endAt)}</p>
        {available && (voucher.reservedOrderId ? (
          <Link to={`/customer/bookings/${voucher.reservedOrderId}`} className="text-[13px] font-semibold text-primary underline underline-offset-4">Xem đơn đang dùng mã</Link>
        ) : (
          <Link to="/customer/services" className="rounded-lg bg-primary px-4 py-3 text-[13px] font-semibold text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Đặt dịch vụ</Link>
        ))}
      </div>
    </article>
  );
}
