import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookingShell } from "../components/BookingComponents";
import { bookingApi } from "@/features/booking/api/booking.api";
import { Modal } from "../../../components/common/Modal";
import type {
  CancellationPreview,
  Order,
  OrderQuotation,
  Payment,
} from "../../../types/booking";
import { OrderChatButton } from "@/features/chat/components/OrderChatButton";
import { ReliableImage } from "@/components/common/ReliableImage";
import { OrderFeedbackSection } from "@/features/feedback/components/OrderFeedbackSection";
import { OrderTrackingMap } from "@/features/tracking/components/OrderTrackingMap";
import { NearbyProviderSelector } from "@/features/customer-service/components/NearbyProviderSelector";
import { tokenStorage } from "@/api/tokenStorage";
import { getErrorMessage } from "@/utils/apiError";

type PendingAction = {
  type: "confirmQuotation" | "rejectQuotation" | "cancelOrder" | "cancelSeries";
  reason: string;
  additionalInfo?: string;
  error?: string;
};

const customerCancellationReasons = [
  "Không còn nhu cầu sử dụng dịch vụ",
  "Đặt nhầm dịch vụ hoặc thông tin",
  "Thời gian thực hiện không còn phù hợp",
  "Không liên hệ được với chuyên gia",
  "Chi phí không phù hợp",
  "Lý do khác",
];

const BookingDetailPage = () => {
  const { bookingId: id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [recurringOrders, setRecurringOrders] = useState<Order[]>([]);
  const [quotation, setQuotation] = useState<OrderQuotation | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [replacementProviderId, setReplacementProviderId] = useState<string>();
  const [replacementProviderError, setReplacementProviderError] = useState<string | null>(null);
  const [cancellationPreview, setCancellationPreview] =
    useState<CancellationPreview | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  const loadData = useCallback(async () => {
    if (!id) {
      setApiError("Mã đơn hàng không hợp lệ.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let data = await bookingApi.getOrderById(id);
      if (["awaiting_payment", "expired"].includes(data?.bookingStatus || "")) {
        try {
          const reconciliation = await bookingApi.reconcilePayosPayment(id);
          if (reconciliation.order) data = reconciliation.order;
        } catch (error) {
          console.error("Không thể đối soát thanh toán PayOS:", error);
        }
      }
      if (!data) {
        setApiError("Không tìm thấy thông tin đơn hàng.");
      } else {
        setOrder(data);

        if (data.orderType === "recurring") {
          try {
            setRecurringOrders(await bookingApi.getRecurringSeries(id));
          } catch (error) {
            console.error("Không thể tải các buổi trong lịch định kỳ:", error);
            setRecurringOrders([]);
          }
        } else {
          setRecurringOrders([]);
        }

        try {
          const paymentResult = await bookingApi.getPaymentsByOrder(id);
          setPayments(paymentResult.payments);
        } catch (error) {
          console.error("Không thể tải lịch sử thanh toán:", error);
          setPayments([]);
        }

        try {
          const quo = await bookingApi.getQuotation(id);
          if (quo && quo.quotation) {
            setQuotation(quo);
          } else {
            setQuotation(null);
          }
        } catch (e) {
          console.error("No quotation found yet or error:", e);
          setQuotation(null);
        }
        setApiError(null);
      }
    } catch (err: unknown) {
      console.error("Error fetching order:", err);
      setApiError("Đã có lỗi xảy ra khi tải thông tin đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const handleConfirmQuotation = () => {
    if (!quotation) return;
    setPendingAction({ type: "confirmQuotation", reason: "" });
  };

  const handleRejectQuotation = () => {
    if (!quotation) return;
    setPendingAction({ type: "rejectQuotation", reason: "" });
  };

  const handleCancelOrder = async () => {
    if (!order || !["created", "accepted"].includes(order.status)) return;
    try {
      setBusy(true);
      const preview = await bookingApi.getCancellationPreview(order._id);
      setCancellationPreview(preview);
      setPendingAction({
        type: "cancelOrder",
        reason: "",
        additionalInfo: "",
        error: preview.canCancel ? undefined : preview.items[0]?.policyReason,
      });
    } catch {
      setCancellationPreview(null);
      setPendingAction({
        type: "cancelOrder",
        reason: "",
        additionalInfo: "",
        error: "Không thể tải chính sách hoàn tiền. Vui lòng đóng và thử lại.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRemainingPayment = async () => {
    if (!order || !quotation) return;

    try {
      setBusy(true);
      setPaymentError(null);
      const detailUrl = `${window.location.origin}/customer/bookings/${order._id}`;
      const result = await bookingApi.createPayment({
        orderId: order._id,
        method: "PAYOS",
        paymentType: "REMAINING",
        returnUrl: detailUrl,
        cancelUrl: detailUrl,
      });
      if (!result.checkoutUrl) {
        throw new Error("PayOS không trả về liên kết thanh toán.");
      }
      tokenStorage.prepareExternalRedirect();
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      console.error("Không thể tạo thanh toán phần còn lại:", error);
      setPaymentError(
        "Không thể tạo thanh toán phần còn lại. Vui lòng tải lại trang và thử lại.",
      );
      setBusy(false);
    }
  };

  const handleCancelSeries = async () => {
    if (
      !order ||
      order.orderType !== "recurring" ||
      !["created", "accepted"].includes(order.status)
    ) return;
    try {
      setBusy(true);
      const preview = await bookingApi.getCancellationPreview(order._id, "series");
      setCancellationPreview(preview);
      setPendingAction({
        type: "cancelSeries",
        reason: "",
        additionalInfo: "",
        error: preview.canCancel
          ? undefined
          : "Có buổi đã đến giờ thực hiện và không thể tự hủy.",
      });
    } catch {
      setCancellationPreview(null);
      setPendingAction({
        type: "cancelSeries",
        reason: "",
        additionalInfo: "",
        error:
          "Không thể tải chính sách hoàn tiền cho chuỗi lịch. Vui lòng đóng và thử lại.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAppointmentPayment = async () => {
    if (!order || order.bookingStatus !== "awaiting_payment") return;

    try {
      setBusy(true);
      setPaymentError(null);
      const detailUrl = `${window.location.origin}/customer/bookings/${order._id}`;
      const method =
        order.paymentMethod === "bank"
          ? "PAYOS"
          : order.paymentMethod === "wallet"
            ? "WALLET"
            : "CASH";
      const result = await bookingApi.createPayment({
        orderId: order._id,
        method,
        paymentType: order.inspectionRequired ? "INSPECTION_DEPOSIT" : "FULL",
        returnUrl: detailUrl,
        cancelUrl: detailUrl,
      });

      if (method === "PAYOS") {
        if (!result.checkoutUrl) {
          throw new Error("PayOS không trả về liên kết thanh toán.");
        }
        tokenStorage.prepareExternalRedirect();
        window.location.assign(result.checkoutUrl);
        return;
      }
      await loadData();
    } catch (error) {
      console.error("Không thể thanh toán giữ lịch:", error);
      setPaymentError(
        "Không thể thanh toán giữ lịch. Vui lòng tải lại trang và thử lại.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSelectReplacementProvider = async () => {
    if (!order || !replacementProviderId) {
      setReplacementProviderError("Vui lòng chọn một chuyên gia còn lịch trống.");
      return;
    }
    try {
      setBusy(true);
      setReplacementProviderError(null);
      await bookingApi.selectAppointmentProvider(order._id, replacementProviderId);
      setReplacementProviderId(undefined);
      await loadData();
    } catch (error) {
      console.error("Không thể gửi lại yêu cầu lịch hẹn:", error);
      setReplacementProviderError(
        "Không thể gửi yêu cầu cho chuyên gia này. Vui lòng chọn người khác.",
      );
    } finally {
      setBusy(false);
    }
  };

  const closeActionDialog = () => {
    if (!busy) {
      setPendingAction(null);
      setCancellationPreview(null);
    }
  };

  const updateActionReason = (reason: string) => {
    setPendingAction((current) =>
      current ? { ...current, reason, error: undefined } : current,
    );
  };

  const updateAdditionalInfo = (additionalInfo: string) => {
    setPendingAction((current) =>
      current ? { ...current, additionalInfo, error: undefined } : current,
    );
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;

    let reason = pendingAction.reason.trim();
    const additionalInfo = pendingAction.additionalInfo?.trim() || "";
    const isCancellationAction = ["cancelOrder", "cancelSeries"].includes(
      pendingAction.type,
    );
    if (pendingAction.type !== "confirmQuotation" && !reason) {
      setPendingAction({
        ...pendingAction,
        error: isCancellationAction ? "Vui lòng chọn lý do hủy đơn." : "Vui lòng nhập lý do.",
      });
      return;
    }
    if (isCancellationAction && reason === "Lý do khác" && !additionalInfo) {
      setPendingAction({ ...pendingAction, error: "Vui lòng nhập thông tin cho lý do khác." });
      return;
    }
    if (isCancellationAction && additionalInfo) {
      reason = `${reason}: ${additionalInfo}`;
    }

    try {
      setBusy(true);
      if (pendingAction.type === "confirmQuotation") {
        if (!quotation) return;
        await bookingApi.confirmQuotation(quotation.quotation._id);
      } else if (pendingAction.type === "rejectQuotation") {
        if (!quotation) return;
        await bookingApi.rejectQuotation(quotation.quotation._id, reason);
      } else if (pendingAction.type === "cancelOrder") {
        if (!order) return;
        await bookingApi.cancelOrder(order._id, reason);
      } else if (pendingAction.type === "cancelSeries") {
        if (!order) return;
        await bookingApi.cancelRecurringSeries(order._id, reason);
      }

      setPendingAction(null);
      setCancellationPreview(null);
      await loadData();
    } catch (error) {
      setPendingAction((current) =>
        current
          ? {
              ...current,
              error: getErrorMessage(
                error,
                "Không thể thực hiện thao tác. Vui lòng thử lại.",
              ),
            }
          : current,
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <BookingShell>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-sm">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-on-surface-variant animate-pulse font-medium">
            Đang tải thông tin đơn hàng...
          </p>
        </div>
      </BookingShell>
    );
  }

  if (apiError || !order) {
    return (
      <BookingShell>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-md">
          <span className="material-symbols-outlined text-6xl text-red-400 mb-sm">
            error_outline
          </span>
          <h2 className="font-headline-md text-headline-md">
            {apiError || "Không tìm thấy đơn hàng"}
          </h2>
          <p className="text-on-surface-variant mb-md max-w-xs">
            {apiError
              ? "Vui lòng kiểm tra lại đường dẫn hoặc quay lại danh sách."
              : "Đơn hàng này không tồn tại hoặc bạn không có quyền xem."}
          </p>
          <Link
            to="/customer/bookings"
            className="bg-primary text-on-primary px-lg py-2 rounded-full font-bold transition-all active:scale-95 shadow-lg shadow-primary/20"
          >
            Quay lại danh sách
          </Link>
        </div>
      </BookingShell>
    );
  }

  const statusOrder: Record<Order["status"], number> = {
    created: 0,
    accepted: 1,
    in_progress: 2,
    completed: 3,
    cancelled: -1,
  };
  const currentStatusIndex = statusOrder[order.status];
  const timeline =
    order.status === "cancelled"
      ? [
          {
            icon: "close",
            title: "Đơn hàng đã hủy",
            description:
              "Đơn hàng đã kết thúc và không tiếp tục được thực hiện.",
            time: new Date(order.updatedAt).toLocaleString("vi-VN"),
            state: "cancelled",
          },
        ]
      : [
          {
            icon: "check",
            title: "Đã tạo đơn hàng",
            description: "Yêu cầu dịch vụ đã được gửi thành công.",
            time: new Date(order.createdAt).toLocaleString("vi-VN"),
            state: currentStatusIndex > 0 ? "done" : "active",
          },
          {
            icon: "person_check",
            title: "Chuyên gia đã nhận đơn",
            description:
              currentStatusIndex >= 1
                ? "Chuyên gia đã xác nhận tiếp nhận đơn hàng."
                : "Đang chờ chuyên gia phù hợp tiếp nhận.",
            time: "",
            state:
              currentStatusIndex > 1
                ? "done"
                : currentStatusIndex === 1
                  ? "active"
                  : "pending",
          },
          {
            icon: "construction",
            title: "Đang thực hiện",
            description:
              currentStatusIndex >= 2
                ? "Chuyên gia đang thực hiện dịch vụ."
                : "Dịch vụ sẽ bắt đầu sau khi chuyên gia xác nhận.",
            time: "",
            state:
              currentStatusIndex > 2
                ? "done"
                : currentStatusIndex === 2
                  ? "active"
                  : "pending",
          },
          {
            icon: "verified",
            title: "Hoàn thành",
            description:
              order.status === "completed"
                ? "Dịch vụ đã hoàn tất thành công."
                : "Dự kiến hoàn tất sau khi thực hiện.",
            time:
              order.status === "completed"
                ? new Date(order.updatedAt).toLocaleString("vi-VN")
                : "",
            state: currentStatusIndex === 3 ? "done" : "pending",
          },
        ];

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "created":
        return "Chờ xử lý";
      case "accepted":
        return "Đã xác nhận";
      case "in_progress":
        return "Đang thực hiện";
      case "completed":
        return "Đã hoàn thành";
      case "cancelled":
        return "Đã hủy";
      default:
        return status;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "wallet":
        return "Ví HandiGo";
      case "bank":
        return "Chuyển khoản";
      case "cash":
        return "Tiền mặt";
      default:
        return method;
    }
  };

  const formatCurrency = (amount?: number | null) =>
    `${(typeof amount === "number" && Number.isFinite(amount) ? amount : 0).toLocaleString("vi-VN")}đ`;

  const getPaymentStatusDisplay = (currentOrder: Order) => {
    const isFlexiblePrice =
      currentOrder.serviceId?.serviceType !== "fixed_price";

    if (currentOrder.status === "cancelled") {
      if (currentOrder.paymentStatus === "refunded") {
        const refundPolicy = currentOrder.cancellation?.refundPolicy;
        return {
          label:
            refundPolicy && refundPolicy.paidAmount > refundPolicy.refundAmount
              ? `Đã hoàn ${formatCurrency(refundPolicy.refundAmount)} (${refundPolicy.refundRate}%)`
              : "Đã hoàn tiền",
          className: "text-emerald-600",
        };
      }

      if (
        currentOrder.paymentStatus === "paid" ||
        currentOrder.paymentStatus === "partially_paid"
      ) {
        return {
          label: "Đang xử lý hoàn tiền",
          className: "text-amber-600",
        };
      }

      return {
        label: "Đã hủy, chưa phát sinh thanh toán",
        className: "text-on-surface-variant",
      };
    }

    if (currentOrder.paymentStatus === "refunded") {
      return {
        label: "Đã hoàn tiền",
        className: "text-emerald-600",
      };
    }

    if (currentOrder.paymentStatus === "paid") {
      return {
        label: "Đã thanh toán",
        className: "text-emerald-600",
      };
    }

    if (currentOrder.paymentStatus === "partially_paid") {
      return {
        label: "Đã thanh toán tiền cọc",
        className: "text-amber-600",
      };
    }

    if (isFlexiblePrice) {
      return {
        label: "Chờ báo giá",
        className: "text-amber-600",
      };
    }

    if (currentOrder.paymentMethod === "cash") {
      return {
        label: "Thanh toán sau khi hoàn thành",
        className: "text-on-surface-variant",
      };
    }

    return { label: "Chờ thanh toán", className: "text-primary" };
  };

  const getQuotationStatusLabel = (
    status: OrderQuotation["quotation"]["status"],
  ) => {
    switch (status) {
      case "pending":
        return "Chờ xác nhận";
      case "approved":
        return "Đã đồng ý";
      case "rejected":
        return "Đã từ chối";
      case "expired":
        return "Đã hết hạn";
      case "cancelled":
        return "Đã hủy";
      default:
        return status;
    }
  };

  const getQuotationStatusClass = (
    status: OrderQuotation["quotation"]["status"],
  ) => {
    switch (status) {
      case "approved":
        return "bg-emerald-100 text-emerald-700";
      case "rejected":
      case "cancelled":
        return "bg-red-100 text-red-700";
      case "expired":
        return "bg-slate-100 text-slate-700";
      default:
        return "bg-amber-100 text-amber-700 animate-pulse";
    }
  };

  const actionDialogConfig = pendingAction
    ? {
        confirmQuotation: {
          title: "Xác nhận báo giá",
          message: "Bạn có chắc chắn muốn đồng ý báo giá này?",
          confirmLabel: "Đồng ý",
          tone: "primary",
          requiresReason: false,
        },
        rejectQuotation: {
          title: "Từ chối báo giá",
          message: "Nhập lý do từ chối để chuyển phản hồi cho chuyên gia.",
          confirmLabel: "Từ chối",
          tone: "danger",
          requiresReason: true,
        },
        cancelOrder: {
          title: "Hủy yêu cầu",
          message:
            "Nhập lý do hủy yêu cầu. Thao tác này sẽ cập nhật trạng thái đơn hàng thành đã hủy.",
          confirmLabel: "Hủy yêu cầu",
          tone: "danger",
          requiresReason: true,
        },
        cancelSeries: {
          title: "Hủy các buổi còn lại",
          message:
            "Buổi đang xem và tất cả buổi phía sau còn có thể hủy sẽ được hủy. Khoản đã thanh toán của từng buổi được xử lý theo chính sách hiện tại.",
          confirmLabel: "Hủy các buổi còn lại",
          tone: "danger",
          requiresReason: true,
        },
      }[pendingAction.type]
    : null;

  const getProviderInfo = () => {
    if (!order.providerId) return null;
    const p = order.providerId;
    const area = p.serviceArea
      ? [p.serviceArea.ward, p.serviceArea.province].filter(Boolean).join(", ")
      : p.workingAreas?.join(", ");
    return {
      name: p.userId?.fullName || p.name || "Chuyên gia",
      phone: p.userId?.phone,
      avatar: p.userId?.avatar || p.avatar,
      area,
      completedOrders: p.totalCompletedOrders ?? p.completedOrders ?? 0,
      rating: p.averageRating ?? 0,
      feedbacks: p.totalFeedbacks ?? 0,
      experienceYears: p.experienceYears ?? 0,
      verified: p.verified ?? false,
    };
  };

  const providerInfo = getProviderInfo();
  const paymentStatusDisplay = getPaymentStatusDisplay(order);
  const paidAmount = payments
    .filter((payment) => payment.status === "paid")
    .reduce((total, payment) => total + payment.amount, 0);
  const remainingAmount = quotation
    ? Math.max(quotation.quotation.finalAmount - paidAmount, 0)
    : 0;
  const hasPendingRemainingPayment = payments.some(
    (payment) =>
      payment.paymentType === "remaining" && payment.status === "pending",
  );

  return (
    <BookingShell>
      <div className="flex items-center gap-sm mb-lg">
        <Link
          to="/customer/bookings"
          className="material-symbols-outlined text-primary p-2 hover:bg-primary/10 rounded-full transition-all active:scale-90"
        >
          arrow_back
        </Link>
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Chi tiết đơn hàng
          </h1>
          <nav className="flex items-center gap-xs text-label-sm text-on-surface-variant font-label-sm uppercase tracking-wider">
            <Link to="/customer/bookings" className="hover:text-primary">
              Lịch sử
            </Link>
            <span className="material-symbols-outlined text-sm">
              chevron_right
            </span>
            <span className="text-primary font-bold">#{order.orderCode}</span>
          </nav>
        </div>
      </div>

      {order.bookingStatus === "awaiting_provider" && (
        <div className="mb-lg rounded-2xl border border-primary/20 bg-primary-container/10 p-md text-sm text-on-surface">
          <p className="font-bold">Đang chờ chuyên gia xác nhận lịch hẹn</p>
          <p className="mt-1 text-on-surface-variant">
            Bạn chưa cần thanh toán. Handigo sẽ thông báo ngay khi chuyên gia phản hồi.
          </p>
        </div>
      )}

      {order.bookingStatus === "awaiting_payment" && (
        <div className="mb-lg rounded-2xl border border-amber-300 bg-amber-50 p-md text-sm text-amber-950">
          <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">Chuyên gia đã nhận lịch</p>
              <p className="mt-1">
                Thanh toán trước {order.paymentDueAt
                  ? new Date(order.paymentDueAt).toLocaleString("vi-VN")
                  : "thời hạn giữ lịch"} để xác nhận lịch hẹn.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAppointmentPayment()}
              className="rounded-xl bg-primary px-5 py-3 font-bold text-on-primary disabled:opacity-60"
            >
              {busy ? "Đang xử lý..." : "Thanh toán giữ lịch"}
            </button>
          </div>
          {paymentError && <p className="mt-sm font-medium text-error">{paymentError}</p>}
        </div>
      )}

      {order.bookingStatus === "reserved" && (
        <div className="mb-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-md text-sm text-emerald-950">
          <p className="font-bold">Chuyên gia đã giữ lịch cho buổi này</p>
          <p className="mt-1 text-emerald-800">
            Thanh toán sẽ được mở trước giờ thực hiện 24 giờ. Handigo sẽ gửi thông báo khi đến hạn.
          </p>
        </div>
      )}

      {order.bookingStatus === "rejected" && (
        <div className="mb-lg rounded-2xl border border-error/20 bg-error/5 p-md">
          <p className="font-bold text-error">Chuyên gia chưa thể nhận lịch này</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Chọn một chuyên gia khác còn trống trong cùng khung giờ.
          </p>
          <div className="mt-md">
            <NearbyProviderSelector
              serviceId={order.serviceId._id}
              addressId={order.addressId._id}
              scheduledAt={order.scheduledAt || undefined}
              recurrenceUnit={order.recurrenceUnit || undefined}
              recurrenceCount={order.totalOccurrences || undefined}
              requireSelection
              selectedProviderId={replacementProviderId}
              onSelectProvider={(providerId) => {
                setReplacementProviderId(providerId);
                setReplacementProviderError(null);
              }}
            />
          </div>
          {replacementProviderError && (
            <p className="mt-sm text-sm font-medium text-error">{replacementProviderError}</p>
          )}
          <button
            type="button"
            disabled={busy || !replacementProviderId}
            onClick={() => void handleSelectReplacementProvider()}
            className="mt-md rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary disabled:opacity-50"
          >
            {busy ? "Đang gửi..." : "Gửi yêu cầu cho chuyên gia"}
          </button>
        </div>
      )}

      {order.bookingStatus === "expired" && (
        <div className="mb-lg rounded-2xl border border-error/20 bg-error/10 p-md text-sm text-error">
          <p className="font-bold">Lịch hẹn đã hết thời gian thanh toán</p>
          <p className="mt-1">Yêu cầu đã được giải phóng để chuyên gia nhận lịch khác.</p>
        </div>
      )}

      <div className="mb-lg">
        <OrderTrackingMap order={order} viewerRole="CUSTOMER" />
      </div>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <div className="lg:col-span-8 flex flex-col gap-lg">
          {order.orderType === "recurring" && (
            <section className="glass-card rounded-3xl border border-outline-variant/30 p-lg shadow-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-label-sm font-bold uppercase tracking-wider text-primary">
                    Lịch định kỳ
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-on-surface">
                    Buổi {order.occurrenceNumber || 1}/{order.totalOccurrences || recurringOrders.length}
                  </h2>
                </div>
                <p className="text-sm text-on-surface-variant">
                  Lặp theo {order.recurrenceUnit === "monthly" ? "tháng" : "tuần"}
                </p>
              </div>

              {recurringOrders.length > 0 ? (
                <div className="mt-md grid gap-2 sm:grid-cols-2">
                  {recurringOrders.map((recurringOrder) => {
                    const isCurrent = recurringOrder._id === order._id;
                    return (
                      <Link
                        key={recurringOrder._id}
                        to={`/customer/bookings/${recurringOrder._id}`}
                        className={`rounded-2xl border p-3 transition hover:border-primary/50 ${
                          isCurrent
                            ? "border-primary bg-primary/5"
                            : "border-outline-variant/50 bg-surface-container-low"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-on-surface">
                            Buổi {recurringOrder.occurrenceNumber}
                          </span>
                          <span className="text-xs font-semibold text-on-surface-variant">
                            {getStatusLabel(recurringOrder.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          {recurringOrder.scheduledAt
                            ? new Date(recurringOrder.scheduledAt).toLocaleString("vi-VN")
                            : "Chưa có thời gian"}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-md text-sm text-on-surface-variant">
                  Chưa thể tải danh sách các buổi trong chuỗi.
                </p>
              )}
            </section>
          )}

          {/* Main Info Card */}
          <section className="glass-card rounded-3xl p-lg shadow-sm border border-outline-variant/30">
            <div className="flex flex-col md:flex-row md:justify-between items-start gap-md mb-lg">
              <div className="flex gap-md items-center">
                <ReliableImage
                  className="w-20 h-20 rounded-2xl object-cover shadow-sm bg-surface-container"
                  src={order.serviceId?.image}
                  alt={order.serviceId?.name}
                />
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface leading-tight">
                    {order.serviceId?.name}
                  </h2>
                  <div className="flex flex-wrap gap-xs mt-1">
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-label-sm text-label-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">
                        category
                      </span>
                      {order.serviceId?.serviceType === "fixed_price"
                        ? "Giá cố định"
                        : "Báo giá sau"}
                    </span>
                    <span className="bg-surface-container text-on-surface-variant px-3 py-1 rounded-full font-label-sm text-label-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">
                        schedule
                      </span>
                      {order.scheduledAt
                        ? new Date(order.scheduledAt).toLocaleString("vi-VN")
                        : "Sớm nhất"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col md:items-end w-full md:w-auto">
                <div
                  className={`px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-sm ${
                    order.status === "completed"
                      ? "bg-emerald-100 text-emerald-700"
                      : order.status === "cancelled"
                        ? "bg-red-100 text-red-700"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${order.status === "completed" ? "bg-emerald-600" : order.status === "cancelled" ? "bg-red-600" : "bg-primary animate-pulse"}`}
                  />
                  {getStatusLabel(order.status)}
                </div>
                <p className="text-on-surface-variant text-label-sm mt-2 font-label-sm">
                  Khởi tạo: {new Date(order.createdAt).toLocaleString("vi-VN")}
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-lg pt-lg border-t border-outline-variant/30">
              <div className="space-y-sm">
                <div className="flex items-start gap-sm">
                  <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">
                    location_on
                  </span>
                  <div>
                    <h4 className="text-label-sm font-label-sm text-on-surface-variant uppercase">
                      Địa điểm thực hiện
                    </h4>
                    <p className="font-medium text-on-surface mt-1">
                      {formatOrderAddress(order) || "Chưa cập nhật địa chỉ"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-sm">
                <div className="flex items-start gap-sm">
                  <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">
                    payments
                  </span>
                  <div>
                    <h4 className="text-label-sm font-label-sm text-on-surface-variant uppercase">
                      Thanh toán
                    </h4>
                    <p className="font-medium text-on-surface mt-1">
                      {getPaymentMethodLabel(order.paymentMethod)} -
                      <span
                        className={`${paymentStatusDisplay.className} ml-1`}
                      >
                        {paymentStatusDisplay.label}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Problem Description Section */}
            {(order.problemDescription ||
              (order.customerAttachments &&
                order.customerAttachments.length > 0)) && (
              <div className="mt-lg pt-lg border-t border-outline-variant/30">
                <h4 className="text-label-sm font-label-sm text-on-surface-variant uppercase mb-md">
                  Mô tả vấn đề & Hình ảnh hiện trạng
                </h4>
                {order.problemDescription && (
                  <p className="bg-surface-container-low p-md rounded-2xl text-on-surface mb-md">
                    {order.problemDescription}
                  </p>
                )}
                {order.customerAttachments &&
                  order.customerAttachments.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-md mt-md">
                      {order.customerAttachments.map((url, idx) => (
                        <div
                          key={idx}
                          className="aspect-square rounded-2xl overflow-hidden shadow-sm border border-outline-variant/30"
                        >
                          <ReliableImage
                            src={url}
                            className="w-full h-full object-cover"
                            alt={`Attachment ${idx + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}

            {/* Repair Quotation Section */}
            {(order.serviceId?.serviceType !== "fixed_price" ||
              order.inspectionRequired ||
              order.hasAdditionalQuotation) && (
              <div className="mt-lg pt-lg border-t-4 border-primary/20 w-full overflow-hidden">
                {quotation ? (
                  <>
                    <div className="flex flex-col gap-3 mb-lg sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-headline-md text-headline-md text-primary flex min-w-0 items-center gap-2">
                        <span className="material-symbols-outlined">
                          request_quote
                        </span>
                        Báo giá sửa chữa
                      </h3>
                      <span
                        className={`inline-flex max-w-full whitespace-normal break-words px-3 py-1 rounded-full text-xs font-bold uppercase leading-snug ${getQuotationStatusClass(quotation.quotation.status)}`}
                      >
                        {getQuotationStatusLabel(quotation.quotation.status)}
                      </span>
                    </div>

                    <div className="grid gap-sm mb-lg sm:grid-cols-2">
                      {quotation.quotation.quotationCode && (
                        <div className="rounded-2xl bg-surface-container-low p-sm">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                            Mã báo giá
                          </p>
                          <p className="mt-1 font-semibold text-on-surface">
                            {quotation.quotation.quotationCode}
                          </p>
                        </div>
                      )}
                      {quotation.quotation.createdAt && (
                        <div className="rounded-2xl bg-surface-container-low p-sm">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                            Thời gian gửi
                          </p>
                          <p className="mt-1 font-semibold text-on-surface">
                            {new Date(
                              quotation.quotation.createdAt,
                            ).toLocaleString("vi-VN")}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-sm mb-lg">
                      {quotation.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center bg-surface-container-low p-md rounded-2xl"
                        >
                          <div className="flex-1 min-w-0 mr-md">
                            <p className="font-bold text-on-surface truncate">
                              {item.title}
                            </p>
                            <p className="text-sm text-on-surface-variant">
                              {item.quantity} x {formatCurrency(item.unitPrice)}
                            </p>
                            {item.description && (
                              <p className="mt-1 text-xs text-on-surface-variant line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <p className="font-headline-sm text-primary shrink-0">
                            {formatCurrency(item.totalPrice)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-md p-lg bg-primary/5 rounded-3xl border border-primary/10 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        {typeof quotation.quotation.subtotalAmount ===
                          "number" && (
                          <p className="text-sm text-on-surface-variant">
                            Tạm tính:{" "}
                            <span className="font-semibold text-on-surface">
                              {formatCurrency(
                                quotation.quotation.subtotalAmount,
                              )}
                            </span>
                          </p>
                        )}
                        {!!quotation.quotation.discountAmount && (
                          <p className="text-sm text-emerald-700">
                            Giảm giá: -
                            {formatCurrency(quotation.quotation.discountAmount)}
                          </p>
                        )}
                        <p className="text-label-sm text-on-surface-variant font-bold uppercase">
                          Tổng chi phí dự kiến
                        </p>
                        <p className="text-headline-lg font-black text-primary leading-none mt-1">
                          {formatCurrency(quotation.quotation.finalAmount)}
                        </p>
                      </div>
                      {quotation.quotation.status === "pending" && (
                        <div className="flex flex-col gap-sm sm:flex-row">
                          <button
                            disabled={busy}
                            onClick={handleRejectQuotation}
                            className="px-6 py-3 border-2 border-red-200 text-red-600 rounded-2xl font-bold hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50"
                          >
                            Từ chối
                          </button>
                          <button
                            disabled={busy}
                            onClick={handleConfirmQuotation}
                            className="px-8 py-3 bg-primary text-on-primary rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                          >
                            {busy && (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            )}
                            Đồng ý báo giá
                          </button>
                        </div>
                      )}
                    </div>

                    {quotation.quotation.status === "approved" && (
                      <div className="mt-md rounded-3xl border border-outline-variant/40 bg-surface-container-low p-md">
                        <div className="grid gap-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-bold uppercase text-on-surface-variant">
                              Đã thanh toán
                            </p>
                            <p className="mt-1 text-lg font-bold text-emerald-700">
                              {formatCurrency(paidAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase text-on-surface-variant">
                              Còn phải thanh toán
                            </p>
                            <p className="mt-1 text-lg font-bold text-primary">
                              {formatCurrency(remainingAmount)}
                            </p>
                          </div>
                        </div>

                        {remainingAmount > 0 && (
                          <div className="mt-md">
                            <button
                              type="button"
                              disabled={busy || hasPendingRemainingPayment}
                              onClick={handleRemainingPayment}
                              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-bold text-on-primary shadow-lg shadow-primary/20 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-lg">
                                payments
                              </span>
                              {hasPendingRemainingPayment
                                ? "Đang chờ xác nhận thanh toán"
                                : `Thanh toán ${formatCurrency(remainingAmount)}`}
                            </button>
                            {paymentError && (
                              <p className="mt-2 text-sm font-medium text-red-600">
                                {paymentError}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {quotation.quotation.inspectionNote && (
                      <div className="mt-md p-md bg-surface-container rounded-2xl border border-outline-variant/30 italic text-on-surface-variant text-sm">
                        <strong>Ghi chú khảo sát:</strong>{" "}
                        {quotation.quotation.inspectionNote}
                      </div>
                    )}
                    {quotation.quotation.recommendation && (
                      <div className="mt-md p-md bg-surface-container rounded-2xl border border-outline-variant/30 text-on-surface-variant text-sm">
                        <strong>Đề xuất xử lý:</strong>{" "}
                        {quotation.quotation.recommendation}
                      </div>
                    )}
                    {quotation.quotation.status === "rejected" &&
                      quotation.quotation.rejectionReason && (
                        <div className="mt-md p-md bg-red-50 rounded-2xl border border-red-100 text-red-700 text-sm">
                          <strong>Lý do từ chối:</strong>{" "}
                          {quotation.quotation.rejectionReason}
                        </div>
                      )}
                  </>
                ) : (
                  <div className="w-full overflow-hidden rounded-3xl border border-dashed border-amber-300/70 bg-amber-50/70 p-4 sm:p-5">
                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 sm:mx-0">
                        <span className="material-symbols-outlined text-2xl">
                          request_quote
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 text-center sm:text-left">
                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="min-w-0 whitespace-normal break-words text-base font-bold leading-snug text-on-surface sm:text-lg">
                            Đang chờ chuyên gia báo giá
                          </h3>
                          <span className="mx-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 sm:mx-0">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            Chờ báo giá
                          </span>
                        </div>

                        <div className="mt-3 space-y-2 text-sm leading-relaxed text-on-surface-variant">
                          <p className="whitespace-normal break-words">
                            {order.status === "created"
                              ? "Đơn của bạn đã được ghi nhận. Sau khi chuyên gia nhận đơn, họ sẽ khảo sát và gửi báo giá chi tiết."
                              : "Chuyên gia đang kiểm tra thông tin và lập báo giá chi tiết cho đơn này."}
                          </p>
                          <p className="whitespace-normal break-words">
                            Khi có báo giá, bạn sẽ nhận được thông báo để xem
                            chi phí và xác nhận trước khi tiếp tục.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
          {order.status === "completed" && (
            <OrderFeedbackSection orderId={order._id} />
          )}
        </div>

        <aside className="lg:col-span-4 flex flex-col gap-lg">
          <section className="glass-card overflow-hidden rounded-3xl border border-outline-variant/30 p-md shadow-sm sm:p-lg">
            <div className="mb-md flex items-center justify-between gap-sm">
              <h3 className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                Chuyên gia thực hiện
              </h3>
            </div>
            {providerInfo ? (
              <div className="space-y-md">
                <div className="flex items-center gap-md">
                  <div className="shrink-0">
                    <ReliableImage
                      className="h-16 w-16 rounded-2xl border border-outline-variant/30 bg-surface-container object-cover shadow-sm"
                      src={
                        providerInfo.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(providerInfo.name)}&background=4f46e5&color=fff`
                      }
                      alt={providerInfo.name}
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="truncate font-headline-sm text-headline-sm text-on-surface">
                      {providerInfo.name}
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-x-1 text-tertiary">
                      <span
                        className="material-symbols-outlined text-[16px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        star
                      </span>
                      <span className="font-bold text-label-md">
                        {providerInfo.rating.toFixed(1)}
                      </span>
                      <span className="text-label-sm font-normal text-on-surface-variant">
                        ({providerInfo.feedbacks} đánh giá)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 rounded-2xl bg-surface-container-low p-sm text-sm">
                  <ProviderDetail
                    icon="phone"
                    label="Số điện thoại"
                    value={providerInfo.phone || "Chưa cập nhật"}
                  />
                  <ProviderDetail
                    icon="location_on"
                    label="Khu vực"
                    value={providerInfo.area || "Chưa cập nhật"}
                  />
                  <ProviderDetail
                    icon="handyman"
                    label="Kinh nghiệm"
                    value={`${providerInfo.experienceYears} năm · ${providerInfo.completedOrders} đơn hoàn thành`}
                  />
                </div>
                {["accepted", "in_progress"].includes(order.status) && (
                  <OrderChatButton orderId={order._id} />
                )}
              </div>
            ) : (
              <div className="py-md text-center">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-sm">
                  <span className="material-symbols-outlined animate-spin">
                    search
                  </span>
                </div>
                <p className="text-on-surface-variant text-sm px-md">
                  Bác thợ phù hợp nhất đang được điều phối đến bạn.
                </p>
              </div>
            )}
          </section>

          <section className="glass-card rounded-3xl border border-outline-variant/30 p-md shadow-sm sm:p-lg">
            <div className="mb-lg flex items-center justify-between gap-sm">
              <h3 className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                Theo dõi tiến độ
              </h3>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${order.status === "cancelled" ? "bg-error/10 text-error" : "bg-primary/10 text-primary"}`}
              >
                {getStatusLabel(order.status)}
              </span>
            </div>
            <div className="relative">
              {timeline.map((step, index) => {
                const isDone = step.state === "done";
                const isActive = step.state === "active";
                const isCancelled = step.state === "cancelled";
                const isLast = index === timeline.length - 1;

                return (
                  <div
                    key={step.title}
                    className={`flex min-w-0 gap-sm pb-lg last:pb-0 ${step.state === "pending" ? "opacity-50" : ""}`}
                  >
                    <div className="flex flex-col items-center relative">
                      <div
                        className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                          isCancelled
                            ? "bg-error text-on-error"
                            : isDone
                              ? "bg-primary text-on-primary shadow-lg shadow-primary/20 scale-100"
                              : isActive
                                ? "border-[3px] border-primary bg-surface text-primary shadow-md"
                                : "bg-surface-container-highest text-on-surface-variant"
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[16px] ${isActive ? "animate-pulse font-bold" : ""}`}
                        >
                          {step.icon}
                        </span>
                      </div>
                      {!isLast && (
                        <div
                          className={`absolute bottom-0 top-9 w-0.5 ${isDone ? "bg-primary" : "bg-outline-variant/50"}`}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-grow pt-1">
                      <div className="flex flex-col">
                        <h4
                          className={`text-sm font-bold ${isCancelled ? "text-error" : isActive ? "text-primary" : "text-on-surface"}`}
                        >
                          {step.title}
                        </h4>
                        {step.time && (
                          <span className="mt-0.5 break-words text-xs text-on-surface-variant">
                            {step.time}
                          </span>
                        )}
                      </div>
                      <p
                        className={`mt-1 break-words text-sm leading-5 ${isActive ? "font-medium text-primary" : "text-on-surface-variant"}`}
                      >
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {["created", "accepted"].includes(order.status) && (
            <div className="space-y-2">
              <button
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-100 py-3 font-bold text-red-600 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleCancelOrder}
              >
                {busy ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
                ) : (
                  <span className="material-symbols-outlined text-sm">close</span>
                )}
                {order.orderType === "recurring" ? "Hủy buổi này" : "Hủy yêu cầu"}
              </button>
              {order.orderType === "recurring" && (
                <button
                  disabled={busy}
                  className="w-full rounded-2xl bg-red-600 py-3 font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleCancelSeries}
                >
                  Hủy buổi này và các buổi sau
                </button>
              )}
            </div>
          )}

          <button className="flex items-center justify-center gap-2 text-on-surface-variant hover:text-primary transition-colors py-2 group">
            <span className="material-symbols-outlined text-sm">flag</span>
            <span className="text-label-sm font-label-sm border-b border-transparent group-hover:border-primary">
              Báo cáo vấn đề đơn hàng
            </span>
          </button>
        </aside>
      </main>

      {pendingAction && actionDialogConfig && (
        <Modal
          open
          title={actionDialogConfig.title}
          onClose={closeActionDialog}
          size="sm"
          closeOnEsc={!busy}
          closeOnOverlayClick={!busy}
        >
          <div className="space-y-md">
            <p className="text-body-md text-on-surface-variant">
              {actionDialogConfig.message}
            </p>

            {["cancelOrder", "cancelSeries"].includes(pendingAction.type) &&
              cancellationPreview && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-on-surface">
                        Chính sách hoàn tiền
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {cancellationPreview.scope === "series"
                          ? `${cancellationPreview.orderCount} buổi được tính riêng theo thời gian bắt đầu.`
                          : cancellationPreview.items[0]?.policyReason}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-on-primary">
                      Hoàn {cancellationPreview.items.length === 1
                        ? `${cancellationPreview.items[0].refundRate}%`
                        : "theo từng buổi"}
                    </span>
                  </div>

                  {cancellationPreview.paidAmount > 0 ? (
                    <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-white p-2">
                        <dt className="text-[11px] text-on-surface-variant">Đã thanh toán</dt>
                        <dd className="mt-1 text-sm font-bold text-on-surface">
                          {formatCurrency(cancellationPreview.paidAmount)}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-white p-2">
                        <dt className="text-[11px] text-on-surface-variant">Hoàn lại</dt>
                        <dd className="mt-1 text-sm font-bold text-primary">
                          {formatCurrency(cancellationPreview.refundAmount)}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-white p-2">
                        <dt className="text-[11px] text-on-surface-variant">Phí hủy</dt>
                        <dd className="mt-1 text-sm font-bold text-error">
                          {formatCurrency(cancellationPreview.cancellationFee)}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-on-surface-variant">
                      Chưa ghi nhận khoản thanh toán trực tuyến cần hoàn cho đơn này.
                    </p>
                  )}
                </div>
              )}

            {["cancelOrder", "cancelSeries"].includes(pendingAction.type) ? (
              <div className="space-y-md">
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-label-sm font-bold uppercase text-on-surface-variant">
                    Chọn lý do hủy
                  </legend>
                  {customerCancellationReasons.map((reason) => (
                    <label
                      key={reason}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${pendingAction.reason === reason ? "border-red-300 bg-red-50" : "border-outline-variant/50 hover:bg-surface-container-low"}`}
                    >
                      <input
                        type="radio"
                        name="customer-cancellation-reason"
                        value={reason}
                        checked={pendingAction.reason === reason}
                        onChange={() => updateActionReason(reason)}
                        disabled={busy}
                        className="mt-0.5 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm font-medium text-on-surface">{reason}</span>
                    </label>
                  ))}
                </fieldset>
                <label className="block">
                  <span className="mb-2 block text-label-sm font-bold uppercase text-on-surface-variant">
                    Thông tin thêm {pendingAction.reason === "Lý do khác" && <span className="text-error">*</span>}
                  </span>
                  <textarea
                    value={pendingAction.additionalInfo || ""}
                    onChange={(event) => updateAdditionalInfo(event.target.value)}
                    disabled={busy}
                    maxLength={500}
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                    placeholder="Nhập thêm thông tin để chúng tôi hỗ trợ tốt hơn..."
                  />
                  <span className="mt-1 block text-right text-xs text-on-surface-variant">{pendingAction.additionalInfo?.length || 0}/500</span>
                </label>
              </div>
            ) : actionDialogConfig.requiresReason && (
              <label className="block">
                <span className="mb-2 block text-label-sm font-bold uppercase text-on-surface-variant">
                  Lý do
                </span>
                <textarea
                  value={pendingAction.reason}
                  onChange={(event) => updateActionReason(event.target.value)}
                  disabled={busy}
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  placeholder="Nhập lý do..."
                />
              </label>
            )}

            {pendingAction.error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {pendingAction.error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-sm pt-sm sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={closeActionDialog}
                className="rounded-2xl bg-surface-container-high px-5 py-3 font-bold text-on-surface transition hover:bg-surface-container-highest disabled:opacity-50"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  (["cancelOrder", "cancelSeries"].includes(pendingAction.type) &&
                    (!cancellationPreview || !cancellationPreview.canCancel))
                }
                onClick={executePendingAction}
                className={`rounded-2xl px-5 py-3 font-bold text-white transition disabled:opacity-50 ${
                  actionDialogConfig.tone === "danger"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-primary hover:bg-primary/90"
                }`}
              >
                {busy ? "Đang xử lý..." : actionDialogConfig.confirmLabel}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </BookingShell>
  );
};

export default BookingDetailPage;

function formatOrderAddress(order: Order) {
  const address = order.addressId;
  if (!address) return "";

  return (
    address.fullAddress?.trim() ||
    [address.detailAddress, address.ward, address.district, address.province]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ")
  );
}

function ProviderDetail({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="material-symbols-outlined mt-0.5 text-base text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-on-surface-variant">{label}</p>
        <p className="break-words font-medium text-on-surface">{value}</p>
      </div>
    </div>
  );
}
