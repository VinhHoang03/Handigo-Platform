import { useEffect, useEffectEvent, useRef, useState } from "react";
import { bookingApi } from "@/features/booking/api/booking.api";
import { getErrorMessage } from "@/utils/apiError";
import { createAuthenticatedSocket } from "@/realtime/authenticatedSocket";
import type { AgentPayment } from "../types/agent.types";

type CheckoutState = "loading" | "ready" | "paid" | "deposit_paid" | "failed" | "refunded" | "error";
const statusMessages: Partial<Record<CheckoutState, string>> = {
  loading: "Đang tải mã QR thanh toán…",
  paid: "Thanh toán thành công.", deposit_paid: "Thanh toán tiền cọc thành công.",
  failed: "Giao dịch đã hủy, hết hạn hoặc thất bại. Vui lòng kiểm tra thanh toán trước khi tạo giao dịch mới.",
  refunded: "Giao dịch đã được hoàn tiền.",
};

export function AgentPayosCheckout({ payment, disabled, onCheck }: {
  payment: AgentPayment; disabled: boolean; onCheck: (orderId: string) => void;
}) {
  const [state, setState] = useState<CheckoutState>("loading");
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const terminal = useRef(false);
  const notified = useRef(false);
  const notify = useEffectEvent(() => {
    if (!disabled && terminal.current && !notified.current) {
      notified.current = true;
      onCheck(payment.orderId);
    }
  });
  useEffect(() => { notify(); }, [disabled, state]);

  useEffect(() => {
    let disposed = false;
    let imageUrl = "";
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    let refreshRequested = false;
    let lastReconciledAt = Date.now();
    const { socket, dispose } = createAuthenticatedSocket();
    terminal.current = false;
    notified.current = false;
    const verify = async () => {
      if (disposed || terminal.current) return;
      if (busy) { refreshRequested = true; return; }
      busy = true;
      clearTimeout(pollTimer);
      try {
        let current = payment.paymentId
          ? await bookingApi.getPaymentById(payment.paymentId)
          : (await bookingApi.getPaymentsByOrder(payment.orderId)).payments.find((item) => item.method === "payos");
        if (disposed) return;
        if (!current || current.orderId !== payment.orderId || current.method !== "payos") {
          throw new Error("Không tìm thấy giao dịch PayOS phù hợp với đơn hàng này.");
        }
        if (current.status === "pending" && Date.now() - lastReconciledAt >= 10000) {
          lastReconciledAt = Date.now();
          try {
            const result = await bookingApi.reconcilePayosPayment(payment.orderId);
            if (disposed) return;
            if (result.payment?._id === current._id) current = result.payment;
          } catch { /* Webhook và lần đọc kế tiếp vẫn xác minh được nếu đối soát tạm lỗi. */ }
        }
        if (current.status !== "pending") {
          terminal.current = true;
          setQrUrl("");
          setError("");
          setState(current.status === "paid" && current.paymentType === "inspection_deposit"
            ? "deposit_paid" : current.status);
          notify();
          return;
        }
        if (!imageUrl) {
          const image = await bookingApi.getPaymentQr(current._id);
          if (disposed) return;
          imageUrl = URL.createObjectURL(image);
          setQrUrl(imageUrl);
        }
        setError("");
        setState("ready");
      } catch (failure) {
        if (!disposed) {
          setError(getErrorMessage(failure, "Chưa thể tải hoặc xác minh thanh toán. Vui lòng thử lại."));
          setState("error");
        }
      } finally {
        busy = false;
        if (!disposed && !terminal.current) {
          const delay = refreshRequested ? 0 : 3000;
          refreshRequested = false;
          pollTimer = setTimeout(() => void verify(), delay);
        }
      }
    };
    const onPaymentStatus = (event: { orderId?: string; paymentId?: string }) => {
      if (event?.orderId === payment.orderId && (!payment.paymentId || event.paymentId === payment.paymentId)) void verify();
    };
    const onVisible = () => { if (document.visibilityState === "visible") void verify(); };
    const onFocus = () => { void verify(); };
    socket.on("payment:status", onPaymentStatus);
    socket.on("connect", onFocus);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    void verify();
    return () => {
      disposed = true;
      clearTimeout(pollTimer);
      socket.off("payment:status", onPaymentStatus);
      socket.off("connect", onFocus);
      dispose();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [attempt, payment.orderId, payment.paymentId]);

  return <div className="space-y-3" aria-busy={state === "loading"}>
    {statusMessages[state] && <p role="status" className="text-xs leading-5 text-on-surface-variant">{statusMessages[state]}</p>}
    {state === "ready" && qrUrl && <div className="rounded-xl bg-white p-2">
      <img src={qrUrl} alt={`Mã QR PayOS thanh toán đơn ${payment.orderCode}`}
        className="mx-auto aspect-square w-full max-w-[280px]" width={360} height={360}
        onError={() => { setError("Ảnh QR chưa hiển thị được. Vui lòng tải lại mã QR."); setState("error"); }} />
    </div>}
    {state === "ready" && <p className="text-xs text-on-surface-variant">Quét mã QR bằng ứng dụng ngân hàng. Kết quả sẽ được xác minh tự động.</p>}
    {state === "error" && <>
      <p role="alert" className="text-xs leading-5 text-error">{error}</p>
      <button type="button" disabled={disabled}
        onClick={() => { setError(""); setQrUrl(""); setState("loading"); setAttempt((value) => value + 1); }}
        className="min-h-11 w-full rounded-xl border border-outline-variant px-3 py-2 font-medium disabled:opacity-50">Tải lại mã QR</button>
    </>}
  </div>;
}
