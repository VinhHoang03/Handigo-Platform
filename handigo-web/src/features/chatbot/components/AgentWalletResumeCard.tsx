import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { walletApi } from "@/features/wallet/api/wallet.api";
import { getErrorMessage } from "@/utils/apiError";
import type { AgentWalletResume } from "../utils/agentWalletResume";
import { Wallet } from "lucide-react";

export function AgentWalletResumeCard({ context, disabled, onContinue, onDismiss }: {
  context: AgentWalletResume; disabled: boolean; onContinue: () => Promise<void>; onDismiss: () => void;
}) {
  const [balance, setBalance] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    walletApi.getMine().then((wallet) => { if (active) setBalance(wallet.balance); })
      .catch((failure: unknown) => { if (active) setError(getErrorMessage(failure, "Chưa kiểm tra được số dư ví.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  return <section aria-label="Tiếp tục đặt dịch vụ sau nạp ví" className="space-y-3 rounded-2xl border border-primary/20 bg-surface-container-lowest p-4 text-sm">
    <div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary"><Wallet size={19} aria-hidden="true" /></span>
      <h3 className="min-w-0 break-words font-semibold">{context.orderCode ? `Tiếp tục đơn ${context.orderCode}` : "Tiếp tục bản nháp sau nạp ví"}</h3>
    </div>
    <p className="text-xs leading-5 text-on-surface-variant">Trợ lý đã mở lại đúng cuộc trò chuyện. Số dư và thanh toán được kiểm tra từ hệ thống; nạp ví không tự thanh toán đơn.</p>
    {loading ? <p role="status">Đang kiểm tra số dư…</p> : balance !== undefined && <div className="rounded-xl bg-primary/5 px-3 py-3"><p className="text-xs text-on-surface-variant">Số dư hiện tại</p><strong className="mt-1 block text-2xl font-semibold tracking-tight text-primary tabular-nums">{balance.toLocaleString("vi-VN")} đ</strong></div>}
    {error && <p role="alert" className="text-xs text-error">{error}</p>}
    <div className="grid grid-cols-2 gap-2">
      <button type="button" disabled={disabled || loading} onClick={() => void onContinue().catch(() => undefined)} className="col-span-2 min-h-12 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{context.orderId ? "Kiểm tra đơn và thanh toán bằng ví" : "Tiếp tục bản nháp"}</button>
      <button type="button" disabled={disabled || loading} onClick={() => { setError(""); setLoading(true); setAttempt((value) => value + 1); }} className="min-h-11 rounded-xl border border-outline-variant/60 px-3 text-xs focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Kiểm tra số dư</button>
      <button type="button" onClick={onDismiss} className="min-h-11 rounded-xl px-2 text-xs text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">Đóng nhắc nhở</button>
    </div>
    {context.orderId && <Link className="block text-xs font-medium text-primary underline" to={`/customer/bookings/${context.orderId}`}>Xem đơn hàng</Link>}
  </section>;
}
