import { ChevronDown, Copy, Ticket } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/common/Toast";
import type { RewardVoucher } from "../api/rewards.api";

import { rewardMoney, rewardDate } from "../rewardFormat";

export function RewardVoucherCard({ voucher }: { voucher: RewardVoucher }) {
  const { addToast } = useToast();
  const detailsId = useId();
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const showDetails = hovered || expanded;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const expired = new Date(voucher.endAt).getTime() < now;
  const inactive = !voucher.isActive || ["INACTIVE", "EXPIRED"].includes(voucher.status.toUpperCase());
  const used = voucher.usedCount > 0;
  const available = !used && !expired && !inactive;
  const discountLabel = voucher.discountType === "PERCENT"
    ? `Giảm ${voucher.discountValue}%${voucher.applicableOrderType === "variable_price" ? " phí cọc" : ""}`
    : `Giảm ${rewardMoney(voucher.discountValue)}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(voucher.code); addToast("Đã sao chép mã giảm giá.", "success"); }
    catch { addToast("Chưa sao chép được. Bạn có thể chọn và sao chép mã bên dưới.", "error"); }
  };
  return (
    <article
      className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm hover:border-primary/40"
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onKeyDown={(event) => { if (event.key === "Escape") { setExpanded(false); setHovered(false); } }}
    >
      <button
        type="button"
        aria-expanded={showDetails}
        aria-controls={detailsId}
        aria-label={`${discountLabel}, mã ${voucher.code}. Xem chi tiết`}
        onClick={() => { setExpanded(!expanded); setHovered(false); }}
        className="flex w-full items-center gap-3 rounded-2xl p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-fixed text-primary"><Ticket aria-hidden="true" size={22} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-on-surface">{discountLabel}</span>
          <code title={voucher.code} className="mt-1 block truncate text-xs font-semibold text-primary">{voucher.code}</code>
        </span>
        <ChevronDown aria-hidden="true" size={18} className={`shrink-0 text-on-surface-variant ${showDetails ? "rotate-180" : ""}`} />
      </button>
      <div id={detailsId} hidden={!showDetails} className="border-t border-outline-variant/40 px-4 pb-4 pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${available ? "bg-primary-fixed text-on-primary-fixed-variant" : "bg-surface-container text-on-surface-variant"}`}>
            {used ? "Đã sử dụng" : expired ? "Hết hạn" : inactive ? "Ngừng áp dụng" : voucher.reservedOrderId ? "Đang giữ cho đơn" : "Sẵn sàng sử dụng"}
          </span>
        </div>
        <h3 className="mt-3 text-[13px] font-semibold text-on-surface">{voucher.name}</h3>
        <p className="mt-2 text-[13px] leading-6 text-on-surface-variant">{voucher.applicableOrderType === "variable_price"
          ? "Mã áp dụng với đơn báo giá. Hạn dùng được ghi bên dưới."
          : `Đơn giá cố định từ ${rewardMoney(voucher.minOrderAmount)}.`} Dùng một lần cho tài khoản của bạn.</p>
        {voucher.maxDiscountAmount != null && <p className="mt-2 text-[13px] font-medium text-on-surface-variant">Giảm tối đa {rewardMoney(voucher.maxDiscountAmount)}.</p>}
        <div className="my-3 flex items-center gap-2 rounded-xl bg-surface-container-low p-3">
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
        </div>
    </article>
  );
}
